/**
 * meminfo_harness.mjs — repeatable Android memory measurement harness
 * (WO remediation E2, correlation hardened at P1). Drives authorized-device
 * QA sessions:
 *
 *   node tools/memory-audit/meminfo_harness.mjs start   [--package com.athletekinetics.qa]
 *   node tools/memory-audit/meminfo_harness.mjs sample --label "cold-launch-baseline"
 *   node tools/memory-audit/meminfo_harness.mjs watch   --interval-ms 250 --duration-s 60 --label auto
 *   node tools/memory-audit/meminfo_harness.mjs finish
 *
 * Capture logcat CONTINUOUSLY, in epoch format, in a separate shell, so markers
 * cannot rotate out of the ring buffer before `finish` reads them:
 *
 *   adb logcat -v epoch > "$AK_LOGCAT_FILE"
 *
 * Guarantees:
 *   - targets the QA application id explicitly (never a guessed package);
 *   - stores RAW `adb shell dumpsys meminfo -d <pkg>` output for EVERY sample;
 *   - parses via meminfo_parser.mjs (TOTAL table row BY COLUMN; the later
 *     "TOTAL PSS:" line can never overwrite Private Dirty — regression-tested);
 *   - records per-sample capture START, capture COMPLETION and duration, so the
 *     achieved cadence is measured rather than assumed;
 *   - correlates lifecycle markers via lifecycle_correlator.mjs, which requires
 *     ONE request id to carry session+inference+disposal+completion, all ok=1,
 *     with cumulative counters proving the created session was the disposed one,
 *     inside ONE CONTINUOUS sampling segment and with no clock slack;
 *   - writes ALL evidence outside the repository (AK_MEM_EVIDENCE_DIR or the
 *     OS temp dir) — never into the worktree;
 *   - finish FAILS unless at least one request qualifies under that contract;
 *   - reports "maximum sampled Private Dirty" and refuses to call it a peak
 *     unless the achieved cadence actually supports a transient-peak claim.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMeminfoDump, privateDirtyBytes } from './meminfo_parser.mjs';
import {
  computeCadence,
  computeSamplingSegments,
  correlateRequests,
  defaultContinuityGapMs,
  parseLifecycleMarkers,
  summarizeMemory,
} from './lifecycle_correlator.mjs';
import { computeEvidenceBinding } from './evidence_provenance.mjs';

const PACKAGE_DEFAULT = 'com.athletekinetics.qa';
const SESSION_FILE = () => join(evidenceRoot(), 'session.json');
const PRODUCT_CEILING_BYTES = 450_000_000;

function evidenceRoot() {
  return process.env.AK_MEM_EVIDENCE_DIR || join(tmpdir(), 'ak-mem-evidence');
}

function adb(args, { optional = false } = {}) {
  try {
    return execFileSync('adb', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (optional) return null;
    throw new Error(`adb ${args.join(' ')} failed: ${String(e.message).slice(0, 200)}`);
  }
}

function loadSession() {
  const p = SESSION_FILE();
  if (!existsSync(p)) {
    throw new Error('No active session. Run: node tools/memory-audit/meminfo_harness.mjs start');
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Total physical RAM in bytes from /proc/meminfo (`MemTotal: N kB`).
 *  `ro.hw_ram` is absent on many devices; /proc/meminfo is authoritative and is
 *  therefore recorded ALWAYS, not only as a fallback. */
function readProcMemTotal() {
  const raw = adb(['shell', 'cat', '/proc/meminfo'], { optional: true });
  if (!raw) return { memTotalKb: null, memTotalBytes: null, raw: null };
  const m = raw.match(/^MemTotal:\s+(\d+)\s*kB/mi);
  if (!m) return { memTotalKb: null, memTotalBytes: null, raw: raw.slice(0, 400) };
  const kb = Number(m[1]);
  return { memTotalKb: kb, memTotalBytes: kb * 1024, raw: raw.slice(0, 400) };
}

/** Device UTC offset in minutes east of UTC, read explicitly from the device.
 *  Only used when a captured logcat is NOT in epoch format; never inferred from
 *  a host/device clock delta. */
function readDeviceUtcOffsetMinutes() {
  const out = adb(['shell', 'date', '+%z'], { optional: true });
  const m = String(out ?? '').trim().match(/^([+-])(\d{2})(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function cmdStart(argv) {
  const pkg = argv.package ?? PACKAGE_DEFAULT;
  mkdirSync(evidenceRoot(), { recursive: true });
  const devices = adb(['devices'], { optional: true });
  if (!devices || !/\tdevice/.test(devices.replace(/\r/g, ''))) {
    throw new Error('No authorized device attached via adb. Attach one and re-run.');
  }
  const props = ['ro.product.model', 'ro.build.version.release', 'ro.build.version.sdk',
    'ro.product.cpu.abi', 'ro.hw_ram'].map((name) => ({
    name,
    value: adb(['shell', 'getprop', name], { optional: true })?.trim() ?? null,
  }));
  const hwRam = props.find((p) => p.name === 'ro.hw_ram')?.value;
  const procMem = readProcMemTotal();
  const dumpsysPackage = adb(['shell', 'dumpsys', 'package', pkg], { optional: true }) ?? '';
  const installedMatch = dumpsysPackage.match(/versionName=([\w.-]+)/);
  const session = {
    startedAtUtc: new Date().toISOString(),
    package: pkg,
    packageInstalled: dumpsysPackage.length > 0,
    installedVersionName: installedMatch ? installedMatch[1] : null,
    device: props,
    deviceUtcOffsetMinutes: readDeviceUtcOffsetMinutes(),
    deviceRam: {
      roHwRam: hwRam && hwRam.length > 0 ? hwRam : null,
      source: hwRam && hwRam.length > 0 ? 'ro.hw_ram + /proc/meminfo' : '/proc/meminfo (ro.hw_ram empty)',
      memTotalKb: procMem.memTotalKb,
      memTotalBytes: procMem.memTotalBytes,
    },
    samples: [],
  };
  writeFileSync(SESSION_FILE(), JSON.stringify(session, null, 2));
  if (procMem.raw) writeFileSync(join(evidenceRoot(), 'proc-meminfo.txt'), procMem.raw);
  console.log(`[harness] session opened for ${pkg}; evidence in ${evidenceRoot()}`);
  console.log(`[harness] device RAM: ${procMem.memTotalBytes ?? 'UNKNOWN'} B (${session.deviceRam.source})`);
  console.log(`[harness] device UTC offset: ${session.deviceUtcOffsetMinutes ?? 'UNKNOWN'} min`);
  console.log('[harness] capture logcat continuously in another shell:');
  console.log('[harness]   adb logcat -v epoch > "$AK_LOGCAT_FILE"');
}

function captureSample(label) {
  const session = loadSession();
  const captureStartMs = Date.now();
  const raw = adb(['shell', 'dumpsys', 'meminfo', '-d', session.package]);
  const captureEndMs = Date.now();
  const seq = session.samples.length + 1;
  const rawPath = join(evidenceRoot(), `sample-${String(seq).padStart(3, '0')}-${label}.txt`);
  writeFileSync(rawPath, raw);
  const parsed = parseMeminfoDump(raw);
  if (!parsed.totalRowFound) {
    throw new Error(`sample ${seq}: TOTAL table row missing from dumpsys output (raw kept at ${rawPath})`);
  }
  const record = {
    seq,
    label,
    captureStartUtc: new Date(captureStartMs).toISOString(),
    captureEndUtc: new Date(captureEndMs).toISOString(),
    captureStartMs,
    captureEndMs,
    captureDurationMs: captureEndMs - captureStartMs,
    // Retained for continuity with the historical packet format.
    atUtc: new Date(captureStartMs).toISOString(),
    rawFile: rawPath,
    metrics: parsed.samples, // [{ metric, kB, bytes }]
    privateDirtyBytes: privateDirtyBytes(parsed),
    informationalSummary: parsed.summary,
  };
  session.samples.push(record);
  writeFileSync(SESSION_FILE(), JSON.stringify(session, null, 2));
  console.log(
    `[harness] sample ${seq} (${label}): Private Dirty ${record.privateDirtyBytes} B`
    + ` (capture took ${record.captureDurationMs} ms)`,
  );
  return record;
}

function cmdSample(argv) {
  if (!argv.label) throw new Error('--label required (e.g. "pre-request", "post-disposal")');
  captureSample(String(argv.label));
}

async function cmdWatch(argv) {
  const intervalMs = Number(argv['interval-ms'] ?? 250);
  const durationS = Number(argv['duration-s'] ?? 60);
  const label = String(argv.label ?? 'auto');
  // Record the REQUESTED interval so finish can contrast intent with achieved
  // cadence instead of implying the request was honoured.
  const session = loadSession();
  session.requestedIntervalMs = intervalMs;
  writeFileSync(SESSION_FILE(), JSON.stringify(session, null, 2));

  const deadline = Date.now() + durationS * 1000;
  let n = 0;
  while (Date.now() < deadline) {
    const started = Date.now();
    captureSample(`${label}-${++n}`);
    // Subtract the capture cost so the loop targets the requested PERIOD rather
    // than requested-plus-dumpsys; a negative remainder means the device cannot
    // keep up, which the cadence report then states plainly.
    const remaining = intervalMs - (Date.now() - started);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  }
}

function cmdFinish() {
  const session = loadSession();
  if (session.samples.length === 0) throw new Error('No samples captured in this session.');

  // --- lifecycle markers -----------------------------------------------------
  // Prefer an explicitly captured logcat file: buffer churn on chatty devices
  // rotates markers out of `logcat -d` within seconds. Epoch format removes
  // timezone guessing entirely; local formats need the device offset recorded
  // at `start`, and are refused outright if it is unknown.
  const logFile = process.env.AK_LOGCAT_FILE;
  const logcat = logFile
    ? readFileSync(logFile, 'utf-8')
    : (adb(['logcat', '-d', '-v', 'epoch', '-t', '5000'], { optional: true }) ?? '');
  const tzOffsetMinutes = Number.isFinite(session.deviceUtcOffsetMinutes)
    ? session.deviceUtcOffsetMinutes : null;
  const { markers, undated, malformed } = parseLifecycleMarkers(logcat, {
    tzOffsetMinutes,
    year: new Date(session.startedAtUtc).getUTCFullYear(),
  });
  writeFileSync(join(evidenceRoot(), 'lifecycle-markers.txt'),
    markers.map((m) => m.raw).join('\n'));

  // --- cadence and continuous sampling segments -------------------------------
  const sampleStarts = session.samples
    .map((s) => (Number.isFinite(s.captureStartMs) ? s.captureStartMs : Date.parse(s.atUtc)))
    .filter(Number.isFinite);
  const cadence = computeCadence(sampleStarts, {
    requestedIntervalMs: Number.isFinite(session.requestedIntervalMs) ? session.requestedIntervalMs : null,
  });
  const continuityGapMs = Number.isFinite(Number(process.env.AK_CONTINUITY_GAP_MS))
    ? Number(process.env.AK_CONTINUITY_GAP_MS)
    : defaultContinuityGapMs(cadence);
  const segments = computeSamplingSegments(sampleStarts, { continuityGapMs });

  // --- correlation ------------------------------------------------------------
  const { qualified, rejected, disposalIntegrity } = correlateRequests({ markers, segments });
  if (qualified.length === 0) {
    writeFileSync(join(evidenceRoot(), 'correlation-rejections.json'),
      JSON.stringify({ rejected, undatedCount: undated.length, malformed }, null, 2));
    throw new Error(
      'No request satisfied the production-path inference contract during continuous sampling. '
      + `Parsed ${markers.length} dated markers (${undated.length} undated, ${malformed.length} malformed) `
      + `across ${segments.length} continuous segment(s); ${rejected.length} request id(s) examined. `
      + 'A request qualifies only with session+inference+disposal+completion under ONE id, all ok=1, '
      + 'counters proving the created session was disposed, inside one continuous segment. '
      + 'See correlation-rejections.json.',
    );
  }

  // --- memory attribution -----------------------------------------------------
  const samplesForSummary = session.samples.map((s) => ({
    atUtcMs: Number.isFinite(s.captureStartMs) ? s.captureStartMs : Date.parse(s.atUtc),
    privateDirtyBytes: s.privateDirtyBytes,
  }));
  const memory = summarizeMemory({ samples: samplesForSummary, segments, qualified, cadence });

  const latency = qualified.map((q) => q.totalMs).filter((v) => Number.isFinite(v) && v >= 0);
  const captureDurations = session.samples
    .map((s) => s.captureDurationMs).filter(Number.isFinite).sort((a, b) => a - b);

  const summary = {
    finishedAtUtc: new Date().toISOString(),
    package: session.package,
    device: session.device,
    deviceRam: session.deviceRam,
    deviceUtcOffsetMinutes: tzOffsetMinutes,
    logcatSource: logFile ? `file:${logFile}` : 'adb logcat -d -v epoch',
    markerTimestampFormats: [...new Set(markers.map((m) => m.tsFormat))],

    sampling: {
      sampleCount: session.samples.length,
      requestedIntervalMs: cadence.requestedIntervalMs,
      achievedMinIntervalMs: cadence.minIntervalMs,
      achievedMedianIntervalMs: cadence.medianIntervalMs,
      achievedP95IntervalMs: cadence.p95IntervalMs,
      achievedMaxIntervalMs: cadence.maxIntervalMs,
      effectiveSamplesPerSecond: cadence.effectiveSamplesPerSecond,
      captureDurationMs: captureDurations.length
        ? { min: captureDurations[0], max: captureDurations[captureDurations.length - 1] }
        : null,
      continuityGapMs,
      continuousSegments: segments.map((s) => ({
        index: s.index,
        startUtc: new Date(s.startMs).toISOString(),
        endUtc: new Date(s.endMs).toISOString(),
        spanMs: s.spanMs,
        sampleCount: s.sampleCount,
      })),
    },

    lifecycle: {
      datedMarkerCount: markers.length,
      undatedMarkerCount: undated.length,
      malformedMarkerCount: malformed.length,
      correlatedRequestIds: qualified.map((q) => q.requestId),
      correlatedRequestCount: qualified.length,
      // Process identity is part of the proof: request ids restart per wrapper.
      correlatedRequests: qualified.map((q) => ({
        requestId: q.requestId, pid: q.pid, wrapperEpoch: q.wrapperEpoch, totalMs: q.totalMs,
      })),
      processIds: [...new Set(qualified.map((q) => q.pid))],
      // Session-wide, independent of which requests qualified. A disposal that
      // THREW still incremented disposedTotal, so counters cannot be the test.
      disposalIntegrity,
      rejectedRequests: rejected,
      disposalProof: qualified.map((q) => ({
        requestId: q.requestId,
        createdIndex: q.createdIndex,
        disposedIndex: q.disposedIndex,
        createdSessionWasDisposed: q.createdIndex === q.disposedIndex,
      })),
    },

    memory: {
      metricLabel: memory.metricLabel,
      peakClaimable: memory.peakClaimable,
      peakClaimBlockers: memory.peakClaimBlockers,
      maxSampledPrivateDirtyBytes: memory.maxSampledPrivateDirtyBytes,
      perRequest: memory.perRequest,
      perRun: memory.perRun,
      ratifiedCeilingBytes: PRODUCT_CEILING_BYTES,
      withinRatifiedCeiling: memory.maxSampledPrivateDirtyBytes !== null
        && memory.maxSampledPrivateDirtyBytes <= PRODUCT_CEILING_BYTES,
    },

    endToEndLatencyMs: latency.length ? {
      min: Math.min(...latency),
      max: Math.max(...latency),
      avg: latency.reduce((a, b) => a + b, 0) / latency.length,
      n: latency.length,
    } : null,

    limitations: [
      disposalIntegrity.clean
        ? 'No disposal failure was observed in this session.'
        : `DISPOSAL FAILURES OBSERVED: ${disposalIntegrity.disposalFailureCount}. At least one `
          + 'native session leaked; cumulative counters still balance because disposedTotal '
          + 'increments on a thrown disposal.',
      `Decisive metric is process Private Dirty. ${memory.metricLabel}.`,
      'PSS/RSS are informational only.',
      'A discrete dumpsys probe cannot prove a transient allocation peak unless the achieved '
      + 'median interval is at or below the peak-claim threshold; see sampling.achieved*.',
      'Results describe THIS device and RAM class only; they do not by themselves prove '
      + 'lower-memory-device behaviour.',
      'Latency is reported for correlated requests only.',
    ],
  };
  // BIND the summary to the raw bytes it was derived from (Hermes B-1). Without
  // this, a hand-written summary satisfied gate [D] — and because the ratified
  // review band makes [A] depend on [D], one fabricated file turned the whole
  // memory gate green with no device data at all.
  summary.evidenceBinding = computeEvidenceBinding({ evidenceDir: evidenceRoot(), session });
  console.log(`[harness] evidence binding: ${summary.evidenceBinding.fileCount} raw input(s), `
    + `digest ${summary.evidenceBinding.bindingDigest}`);

  writeFileSync(join(evidenceRoot(), 'session.json'), JSON.stringify({ ...session, summary }, null, 2));
  writeFileSync(join(evidenceRoot(), 'correlation-rejections.json'),
    JSON.stringify({ rejected, undatedCount: undated.length, malformed }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

// --- dispatch -------------------------------------------------------------------
const [, , command, ...rest] = process.argv;
const argv = Object.fromEntries(rest.flatMap((a, i) => {
  if (a.startsWith('--')) {
    const next = rest[i + 1];
    return next === undefined || next.startsWith('--') ? [[a.slice(2), true]] : [[a.slice(2), next]];
  }
  return [];
}));

try {
  switch (command) {
    case 'start': cmdStart(argv); break;
    case 'sample': cmdSample(argv); break;
    case 'watch': await cmdWatch(argv); break;
    case 'finish': cmdFinish(); break;
    default:
      console.error('usage: meminfo_harness.mjs <start|sample|watch|finish> [options]');
      console.error('  start                                   open a session (device props, RAM, UTC offset)');
      console.error('  sample --label <name>                   one dumpsys sample');
      console.error('  watch --interval-ms N --duration-s S    periodic samples');
      console.error('  finish                                  correlate + summarize (fails without a qualified request)');
      console.error('');
      console.error('  capture logcat continuously, in epoch format, in a separate shell:');
      console.error('    adb logcat -v epoch > "$AK_LOGCAT_FILE"');
      process.exit(2);
  }
} catch (e) {
  console.error(`[harness] ERROR: ${e.message}`);
  process.exit(1);
}
