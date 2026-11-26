/**
 * test_lifecycle_correlator.mjs — falsifier fixtures for the QA lifecycle /
 * memory correlation logic (WO remediation P1).
 *
 * Every fixture below targets a specific way the PREVIOUS harness could have
 * reported success without a real production-path inference having happened
 * during real sampling. If any of these ever passes, the correlator is lying.
 *
 * Run: node tools/memory-audit/test_lifecycle_correlator.mjs
 */
import {
  MIN_SAMPLES_IN_REQUEST_WINDOW,
  WRAPPER_REQUEST_ID,
  bindTargetSamples,
  computeCadence,
  computeSamplingSegments,
  correlateRequests,
  defaultContinuityGapMs,
  parseLifecycleMarkers,
  parseLogcatTimestamp,
  parseLogcatProcess,
  segmentIndexFor,
  summarizeDisposalIntegrity,
  summarizeMemory,
} from './lifecycle_correlator.mjs';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// --- fixture builders -------------------------------------------------------

const epochLine = (tsMs, msg) =>
  `${Math.floor(tsMs / 1000)}.${String(tsMs % 1000).padStart(3, '0')}  26491 26529 I ReactNativeJS: ${msg}`;

const phaseMsg = (p, s, req, ok, created, disposed) =>
  `[embedder-lifecycle] ${p}:${s} req=${req} ok=${ok} created=${created} disposed=${disposed}`;

const completionMsg = (req, ok, totalMs) =>
  `[embedder-lifecycle] request=${req} ok=${ok} totalMs=${totalMs}`;

/** A complete, well-formed production-path lifecycle for one request.
 *  `mutate` lets a fixture corrupt exactly one property and nothing else. */
function lifecycleLines(t0, { req = 1, created = 0, disposed = 0, mutate = (x) => x } = {}) {
  const rows = [
    { dt: 0, msg: phaseMsg('session', 'start', req, 1, created, disposed) },
    { dt: 113, msg: phaseMsg('session', 'settled', req, 1, created + 1, disposed) },
    { dt: 113, msg: phaseMsg('inference', 'start', req, 1, created + 1, disposed) },
    { dt: 132, msg: phaseMsg('inference', 'settled', req, 1, created + 1, disposed) },
    { dt: 132, msg: phaseMsg('disposal', 'start', req, 1, created + 1, disposed) },
    { dt: 157, msg: phaseMsg('disposal', 'settled', req, 1, created + 1, disposed + 1) },
    { dt: 157, msg: completionMsg(req, 1, 157) },
  ];
  return mutate(rows).map((r) => epochLine(t0 + r.dt, r.msg));
}

/** Evenly spaced sample timestamps. */
const sampleTimes = (start, count, stepMs) =>
  Array.from({ length: count }, (_, i) => start + i * stepMs);

/**
 * Prepend a `wrapper:settled` anchor for every pid in `logLines` that does not
 * already have one.
 *
 * A real capture that starts at process launch always contains the wrapper
 * line; a capture that starts mid-run may not, and the correlator now refuses
 * to correlate anything it cannot anchor to one wrapper instance
 * (`wrapperEpoch === 0`). Fixtures that are testing something ELSE — ok=0,
 * counter drift, ordering, segment coverage — must therefore be anchored, or
 * they would be rejected on the epoch rule before ever reaching the property
 * they exist to test, and pass vacuously.
 *
 * Fixtures that ARE testing the epoch rule pass `{ anchor: false }`.
 */
function anchored(logLines) {
  const parsed = logLines.map((l) => ({ line: l, ...parseLogcatProcess(l) }));
  const withPid = parsed.filter((x) => Number.isFinite(x.pid));
  if (withPid.length === 0) return logLines;
  const already = new Set(
    withPid.filter((x) => x.line.includes('wrapper:settled')).map((x) => x.pid),
  );
  const need = [...new Set(withPid.map((x) => x.pid))].filter((pid) => !already.has(pid));
  if (need.length === 0) return logLines;
  const earliest = Math.min(...withPid
    .map((x) => parseLogcatTimestamp(x.line).tsMs)
    .filter(Number.isFinite));
  const at = earliest - 1000;
  return [
    ...need.map((pid) => `${Math.floor(at / 1000)}.${String(at % 1000).padStart(3, '0')} `
      + `${pid} ${pid + 40} I ReactNativeJS: ${phaseMsg('wrapper', 'settled', 0, 1, 0, 0)}`),
    ...logLines,
  ];
}

/** Run the whole pipeline the way the harness does. */
function correlate(logLines, times, { continuityGapMs = 2000, anchor = true } = {}) {
  const { markers } = parseLifecycleMarkers((anchor ? anchored(logLines) : logLines).join('\n'));
  const segments = computeSamplingSegments(times, { continuityGapMs });
  const result = correlateRequests({ markers, segments });
  return {
    ...result,
    // The wrapper bookkeeping group (req=0) is ALWAYS rejected and is never
    // what these fixtures are about. `rejected` keeps it; `lifecycleRejected`
    // drops it so a fixture can assert on the reason it actually targets.
    lifecycleRejected: result.rejected.filter((r) => r.requestId !== WRAPPER_REQUEST_ID),
    segments,
    markers,
  };
}

const BASE = Date.UTC(2026, 7, 23, 7, 20, 0, 0); // 2026-08-23T07:20:00.000Z

// =============================================================================
console.log('[1] timestamp handling — epoch preferred, local requires explicit offset');

{
  const r = parseLogcatTimestamp('1755930001.791  26491 26529 I ReactNativeJS: hi');
  check('epoch format parses to exact milliseconds',
    r.ok && r.tsMs === 1755930001791 && r.format === 'epoch', String(r.tsMs));
}
{
  // Brisbane UTC+10: local 17:20:01.791 on 08-23 is 07:20:01.791Z.
  const expected = Date.UTC(2026, 7, 23, 7, 20, 1, 791);
  const r = parseLogcatTimestamp('08-23 17:20:01.791  26491 26529 I ReactNativeJS: hi',
    { tzOffsetMinutes: 600, year: 2026 });
  check('UTC+10 month-day local timestamp converts to correct UTC',
    r.ok && r.tsMs === expected, `${r.tsMs} vs ${expected}`);

  const y = parseLogcatTimestamp('2026-08-23 17:20:01.791  26491 26529 I ReactNativeJS: hi',
    { tzOffsetMinutes: 600 });
  check('UTC+10 year-format local timestamp converts to correct UTC',
    y.ok && y.tsMs === expected, `${y.tsMs} vs ${expected}`);

  const west = parseLogcatTimestamp('08-23 01:20:01.791  1 1 I X: hi',
    { tzOffsetMinutes: -300, year: 2026 }); // UTC-5
  check('negative (west-of-UTC) offset converts correctly',
    west.ok && west.tsMs === Date.UTC(2026, 7, 23, 6, 20, 1, 791), String(west.tsMs));
}
{
  const noTz = parseLogcatTimestamp('08-23 17:20:01.791  1 1 I X: hi', { year: 2026 });
  check('local timestamp WITHOUT an explicit offset is refused, never guessed',
    !noTz.ok && noTz.reason.includes('tzOffsetMinutes'), noTz.reason ?? '');
  const noYear = parseLogcatTimestamp('08-23 17:20:01.791  1 1 I X: hi', { tzOffsetMinutes: 600 });
  check('month-day timestamp WITHOUT an explicit year is refused',
    !noYear.ok && noYear.reason.includes('year'), noYear.reason ?? '');
  const junk = parseLogcatTimestamp('no timestamp here');
  check('unrecognised line yields no timestamp', !junk.ok && junk.tsMs === null);
}
{
  const text = [
    epochLine(BASE, phaseMsg('session', 'start', 1, 1, 0, 0)),
    'I ReactNativeJS: [embedder-lifecycle] session:start req=1 ok=1 created=0 disposed=0', // no ts
    epochLine(BASE + 10, '[embedder-lifecycle] something entirely different'),
  ].join('\n');
  const { markers, undated, malformed } = parseLifecycleMarkers(text);
  check('markers without a resolvable timestamp are quarantined, not counted',
    markers.length === 1 && undated.length === 1, `${markers.length}/${undated.length}`);
  check('lifecycle lines with unknown grammar are reported as malformed',
    malformed.length === 1, String(malformed.length));
}

// =============================================================================
console.log('\n[2] the positive control — a real lifecycle inside continuous sampling');

const GOOD_TIMES = sampleTimes(BASE, 20, 1000); // 1 Hz, BASE .. BASE+19000
{
  const { qualified, rejected, lifecycleRejected } = correlate(lifecycleLines(BASE + 5000), GOOD_TIMES);
  check('complete same-request lifecycle inside one continuous segment QUALIFIES',
    qualified.length === 1 && qualified[0].requestId === 1,
    `${qualified.length} qualified, ${rejected.length} rejected`);
  check('qualified request reports its created/disposed session index',
    qualified[0]?.createdIndex === 1 && qualified[0]?.disposedIndex === 1);
  check('qualified request records end-to-end latency from the completion line',
    qualified[0]?.totalMs === 157, String(qualified[0]?.totalMs));
}

// =============================================================================
console.log('\n[3] outcome falsifiers — ok=0 anywhere must not pass');

for (const target of ['session:settled', 'inference:settled', 'disposal:settled', 'session:start']) {
  const [p, s] = target.split(':');
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => rows.map((r) =>
      r.msg.includes(`${p}:${s} `) ? { ...r, msg: r.msg.replace('ok=1', 'ok=0') } : r),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check(`${target} with ok=0 is REJECTED`,
    qualified.length === 0 && rejected.some((r) => r.reasons.some((x) => x.includes('ok=0'))),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => rows.map((r) =>
      r.msg.startsWith('[embedder-lifecycle] request=')
        ? { ...r, msg: completionMsg(1, 0, 157) } : r),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('request completion with ok=0 is REJECTED (the old harness counted it)',
    qualified.length === 0
    && rejected.some((r) => r.reasons.some((x) => x.includes('completion reported ok=0'))),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}

// =============================================================================
console.log('\n[4] the wrapper event is not inference proof');

{
  // Exactly what a launched-but-never-used app emits: a wrapper marker with
  // `created=0`. The old harness accepted ANY `created=` as inference proof.
  const lines = [epochLine(BASE + 3000, phaseMsg('wrapper', 'settled', 0, 1, 0, 0))];
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('wrapper created=0 marker alone yields ZERO qualified requests',
    qualified.length === 0, `${qualified.length}`);
  check('wrapper marker is explicitly rejected as bookkeeping',
    rejected.some((r) => r.requestId === 0 && r.reasons.some((x) => x.includes('wrapper bookkeeping'))),
    lifecycleRejected[0]?.reasons[0] ?? '');
}
{
  // Wrapper event present alongside a genuine request: the wrapper must not
  // contaminate the good request, and must still not qualify on its own.
  const lines = [
    epochLine(BASE + 1000, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...lifecycleLines(BASE + 5000),
  ];
  const { qualified } = correlate(lines, GOOD_TIMES);
  check('a wrapper event next to a real request does not add a phantom request',
    qualified.length === 1 && qualified[0].requestId === 1, String(qualified.length));
}

// =============================================================================
console.log('\n[5] request-id correlation falsifiers');

{
  // session belongs to req=7, everything else to req=8 — the old harness never
  // compared ids at all, so this looked like a complete lifecycle.
  const lines = lifecycleLines(BASE + 5000, {
    req: 8,
    mutate: (rows) => rows.map((r) =>
      r.msg.includes('session:start') || r.msg.includes('session:settled')
        ? { ...r, msg: r.msg.replace('req=8', 'req=7') } : r),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('lifecycle split across two request ids is REJECTED for both',
    qualified.length === 0 && lifecycleRejected.length === 2,
    lifecycleRejected.map((r) => `${r.requestId}:${r.reasons.length}`).join(' '));
  check('  ...req=8 is rejected for the missing session markers',
    lifecycleRejected.find((r) => r.requestId === 8)?.reasons.some((x) => x.includes('missing session')),
    lifecycleRejected.find((r) => r.requestId === 8)?.reasons.join('; ').slice(0, 80) ?? '');
}
for (const drop of ['inference:settled', 'disposal:settled', 'session:settled', 'disposal:start']) {
  const [p, s] = drop.split(':');
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => rows.filter((r) => !r.msg.includes(`${p}:${s} `)),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check(`missing ${drop} is REJECTED`,
    qualified.length === 0 && lifecycleRejected[0]?.reasons.some((x) => x.includes(`missing ${drop}`)),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 80) ?? '');
}
{
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => rows.filter((r) => !r.msg.startsWith('[embedder-lifecycle] request=')),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('missing request completion line is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('missing request completion')));
}

// =============================================================================
console.log('\n[6] cumulative-counter falsifiers — the created session must be the disposed one');

{
  // disposal settles, but the disposed index does not match the created index:
  // some OTHER session was disposed. Counters must catch it.
  const lines = lifecycleLines(BASE + 5000, {
    created: 4,
    disposed: 4,
    mutate: (rows) => rows.map((r) =>
      r.msg.includes('disposal:settled')
        ? { ...r, msg: phaseMsg('disposal', 'settled', 1, 1, 5, 4) } : r),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('disposal that does not advance the disposed counter is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('disposed counter did not advance')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => rows.map((r) =>
      r.msg.includes('session:settled')
        ? { ...r, msg: phaseMsg('session', 'settled', 1, 1, 0, 0) } : r),
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('session settle that does not advance the created counter is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('created counter did not advance')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  // created=6 but disposed=9: a leaked/mismatched session pair.
  const lines = lifecycleLines(BASE + 5000, {
    created: 5,
    disposed: 8,
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('created index != disposed index is REJECTED (session leak signature)',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('was not the one disposed')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  const lines = lifecycleLines(BASE + 5000, {
    mutate: (rows) => {
      const out = [...rows];
      const a = out.findIndex((r) => r.msg.includes('disposal:start'));
      out[a] = { ...out[a], dt: 1 }; // disposal starts before the session settles
      return out;
    },
  });
  const { qualified, rejected, lifecycleRejected } = correlate(lines, GOOD_TIMES);
  check('markers out of chronological order are REJECTED',
    qualified.length === 0 && lifecycleRejected[0]?.reasons.some((x) => x.includes('out of order')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}

// =============================================================================
console.log('\n[7] temporal falsifiers — no slack, real continuous segments only');

{
  // 31 minutes AFTER the last sample. Under the old +/-120 s slack this was
  // already out of range, but under `first..last` with a long session it could
  // sit inside the span. Here it is unambiguously outside every segment.
  const t = BASE + 19_000 + 31 * 60_000;
  const { qualified, rejected, lifecycleRejected } = correlate(lifecycleLines(t), GOOD_TIMES);
  check('a lifecycle 31 minutes after the last sample is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('outside every continuous sampling segment')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  // THE headline defect: two sampling bursts two hours apart. `first..last`
  // spans the whole gap, so a marker in the dead zone used to "overlap the
  // sampling window". It must not.
  const burstA = sampleTimes(BASE, 10, 1000);
  const burstB = sampleTimes(BASE + 2 * 3600_000, 10, 1000);
  const times = [...burstA, ...burstB];
  const inGap = BASE + 3600_000; // one hour in: no probe was watching
  const { qualified, rejected, lifecycleRejected, segments } = correlate(lifecycleLines(inGap), times);
  check('sampling splits into two continuous segments, not one span',
    segments.length === 2, `${segments.length} segments`);
  check('a lifecycle inside a 2-hour UNSAMPLED gap is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('outside every continuous sampling segment')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
  // ...and the same lifecycle inside burst B still passes, proving the rejection
  // is about coverage, not about being late.
  const okRun = correlate(lifecycleLines(BASE + 2 * 3600_000 + 2000), times);
  check('the same lifecycle inside the SECOND burst still qualifies',
    okRun.qualified.length === 1 && okRun.qualified[0].segmentIndex === 1,
    `segment ${okRun.qualified[0]?.segmentIndex}`);
}
{
  // A lifecycle straddling a segment boundary: starts in burst A, completes in
  // burst B. No single continuous segment covers it.
  const burstA = sampleTimes(BASE, 5, 1000);            // BASE .. BASE+4000
  const burstB = sampleTimes(BASE + 600_000, 5, 1000);  // +10 min
  const lines = [
    epochLine(BASE + 1000, phaseMsg('session', 'start', 1, 1, 0, 0)),
    epochLine(BASE + 1100, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    epochLine(BASE + 1100, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    epochLine(BASE + 600_500, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    epochLine(BASE + 600_500, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    epochLine(BASE + 600_600, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    epochLine(BASE + 600_600, completionMsg(1, 1, 599_600)),
  ];
  const { qualified, rejected, lifecycleRejected } = correlate(lines, [...burstA, ...burstB]);
  check('a lifecycle straddling two sampling segments is REJECTED',
    qualified.length === 0
    && lifecycleRejected[0]?.reasons.some((x) => x.includes('different sampling segments')),
    lifecycleRejected[0]?.reasons.join('; ').slice(0, 90) ?? '');
}
{
  const segs = computeSamplingSegments([0, 1000, 2000, 50_000, 51_000], { continuityGapMs: 2000 });
  check('segment boundaries are inclusive at both ends',
    segmentIndexFor(segs, 0) === 0 && segmentIndexFor(segs, 2000) === 0
    && segmentIndexFor(segs, 2001) === -1 && segmentIndexFor(segs, 50_000) === 1);
  let threw = false;
  try { computeSamplingSegments([0, 1], {}); } catch { threw = true; }
  check('computeSamplingSegments refuses to invent a continuity threshold', threw);
}

// =============================================================================
console.log('\n[8] achieved cadence is measured, never assumed');

{
  const times = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 9500];
  const c = computeCadence(times, { requestedIntervalMs: 250 });
  check('cadence: sample and interval counts', c.sampleCount === 11 && c.intervalCount === 10);
  check('cadence: min interval', c.minIntervalMs === 100, String(c.minIntervalMs));
  check('cadence: median interval (even count -> mean of middle pair)',
    c.medianIntervalMs === 550, String(c.medianIntervalMs));
  check('cadence: p95 interval (nearest rank) surfaces the stall',
    c.p95IntervalMs === 5000, String(c.p95IntervalMs));
  check('cadence: max interval', c.maxIntervalMs === 5000, String(c.maxIntervalMs));
  check('cadence: effective samples/second over the span',
    Math.abs(c.effectiveSamplesPerSecond - 10 / 9.5) < 1e-9,
    String(c.effectiveSamplesPerSecond));
  check('cadence: requested interval is reported as intent, distinct from achieved',
    c.requestedIntervalMs === 250 && c.medianIntervalMs !== c.requestedIntervalMs);
  check('continuity threshold derives from achieved median with a floor',
    defaultContinuityGapMs(c) === 2000, String(defaultContinuityGapMs(c)));
  check('continuity threshold widens for a genuinely slow probe',
    defaultContinuityGapMs({ medianIntervalMs: 4000 }) === 12_000,
    String(defaultContinuityGapMs({ medianIntervalMs: 4000 })));
}

// =============================================================================
console.log('\n[9] increment attribution — per request and per run, never span-wide');

{
  const MB = 1_000_000;
  const t0 = BASE;
  // Segment 0: baseline 100 MB, rises to 110 MB during request 1.
  // Segment 1 (two hours later, unrelated): 300 MB.
  const samples = [
    { atUtcMs: t0 + 0, privateDirtyBytes: 100 * MB },
    { atUtcMs: t0 + 1000, privateDirtyBytes: 102 * MB },
    { atUtcMs: t0 + 2000, privateDirtyBytes: 100 * MB },  // pre-request baseline
    { atUtcMs: t0 + 3000, privateDirtyBytes: 108 * MB },  // inside request
    { atUtcMs: t0 + 4000, privateDirtyBytes: 110 * MB },  // inside request
    { atUtcMs: t0 + 5000, privateDirtyBytes: 101 * MB },
    { atUtcMs: t0 + 2 * 3600_000, privateDirtyBytes: 300 * MB },
    { atUtcMs: t0 + 2 * 3600_000 + 1000, privateDirtyBytes: 305 * MB },
  ];
  const times = samples.map((s) => s.atUtcMs);
  const lines = lifecycleLines(t0 + 2500, { req: 1 }); // spans 2500..2657
  // widen the request so real samples land inside it
  const wide = [
    epochLine(t0 + 2500, phaseMsg('session', 'start', 1, 1, 0, 0)),
    epochLine(t0 + 2600, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    epochLine(t0 + 2700, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    epochLine(t0 + 4200, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    epochLine(t0 + 4300, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    epochLine(t0 + 4400, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    epochLine(t0 + 4400, completionMsg(1, 1, 1900)),
  ];
  void lines;
  const cadence = computeCadence(times, { requestedIntervalMs: 1000 });
  const segments = computeSamplingSegments(times, { continuityGapMs: 2000 });
  const { markers } = parseLifecycleMarkers(anchored(wide).join('\n'));
  const { qualified } = correlateRequests({ markers, segments });
  check('the wide request qualifies inside segment 0',
    qualified.length === 1 && qualified[0].segmentIndex === 0);

  const sum = summarizeMemory({ samples, segments, qualified, cadence });
  check('absolute maximum sampled Private Dirty is reported across ALL samples',
    sum.maxSampledPrivateDirtyBytes === 305 * MB, String(sum.maxSampledPrivateDirtyBytes));
  const r = sum.perRequest[0];
  check('per-request pre-request baseline is the last sample at/before the request start',
    r.preRequestBaselineBytes === 100 * MB, String(r.preRequestBaselineBytes));
  check('per-request maximum is taken INSIDE the request window only',
    r.maxSampledInsideRequestBytes === 110 * MB, String(r.maxSampledInsideRequestBytes));
  check('per-request increment = in-window max - pre-request baseline',
    r.incrementBytes === 10 * MB, String(r.incrementBytes));
  check('per-request sample count inside the window is reported',
    r.samplesInsideRequest === 2, String(r.samplesInsideRequest));

  const run0 = sum.perRun[0];
  const run1 = sum.perRun[1];
  check('per-run increment is scoped to its own segment',
    run0.incrementBytes === 10 * MB && run1.incrementBytes === 5 * MB,
    `${run0.incrementBytes} / ${run1.incrementBytes}`);
  check('REGRESSION: increment is NOT max(all samples) - first(all samples)',
    run0.incrementBytes !== 305 * MB - 100 * MB
    && r.incrementBytes !== 305 * MB - 100 * MB,
    `old-style value would have been ${205 * MB}`);
  check('an uncorrelated segment reports no correlated request ids',
    run1.correlatedRequestIds.length === 0);
}
{
  const MB = 1_000_000;
  const samples = [
    { atUtcMs: BASE, privateDirtyBytes: 100 * MB },
    { atUtcMs: BASE + 20_000, privateDirtyBytes: 120 * MB },
  ];
  const segments = computeSamplingSegments([BASE, BASE + 20_000], { continuityGapMs: 60_000 });
  const { markers } = parseLifecycleMarkers(anchored(lifecycleLines(BASE + 5000)).join('\n'));
  const { qualified } = correlateRequests({ markers, segments });
  const sum = summarizeMemory({
    samples, segments, qualified, cadence: computeCadence(samples.map((s) => s.atUtcMs)),
  });
  check('a request with no sample inside its window reports a null increment, not a guess',
    sum.perRequest[0].incrementBytes === null
    && sum.perRequest[0].note.includes('not measurable'),
    sum.perRequest[0].note ?? '');
}

// =============================================================================
console.log('\n[10] the metric is labelled honestly for the cadence achieved');

{
  const slow = summarizeMemory({
    samples: [{ atUtcMs: BASE, privateDirtyBytes: 1 }],
    segments: [], qualified: [], cadence: { medianIntervalMs: 1000 },
  });
  check('a ~1 Hz probe may only claim "maximum sampled", not a peak',
    slow.peakClaimable === false && slow.metricLabel.includes('maximum sampled'),
    slow.metricLabel);
  // A fast MEDIAN alone must NOT unlock the claim (Sol finding 3): the probe
  // must additionally have watched THROUGH every correlated request.
  const medianOnly = summarizeMemory({
    samples: [{ atUtcMs: BASE, privateDirtyBytes: 1 }],
    segments: [], qualified: [], cadence: { medianIntervalMs: 50, p95IntervalMs: 50 },
  });
  check('a fast median with NO correlated request does not unlock a peak claim',
    medianOnly.peakClaimable === false,
    medianOnly.peakClaimBlockers.join('; '));

  {
    // The genuine positive: 20 ms cadence with dense coverage THROUGH the request.
    const t0 = BASE;
    const times = Array.from({ length: 60 }, (_, i) => t0 + i * 20); // 0..1180
    const lines = [
      epochLine(t0 + 400, phaseMsg('session', 'start', 1, 1, 0, 0)),
      epochLine(t0 + 420, phaseMsg('session', 'settled', 1, 1, 1, 0)),
      epochLine(t0 + 440, phaseMsg('inference', 'start', 1, 1, 1, 0)),
      epochLine(t0 + 500, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
      epochLine(t0 + 520, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
      epochLine(t0 + 560, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
      epochLine(t0 + 560, completionMsg(1, 1, 160)),
    ];
    const cadence = computeCadence(times, { requestedIntervalMs: 20 });
    const segments = computeSamplingSegments(times, { continuityGapMs: 2000 });
    const { markers } = parseLifecycleMarkers(anchored(lines).join('\n'));
    const { qualified } = correlateRequests({ markers, segments });
    const samples = times.map((x) => ({ atUtcMs: x, privateDirtyBytes: 100 }));
    const sum = summarizeMemory({ samples, segments, qualified, cadence });
    check('a fast probe that DID watch through the request unlocks the peak claim',
      qualified.length === 1 && sum.peakClaimable === true,
      sum.peakClaimBlockers.join('; ') || sum.metricLabel);
    check('  ...and it reports dense in-window coverage',
      sum.perRequest[0].samplesInsideRequest >= MIN_SAMPLES_IN_REQUEST_WINDOW
      && sum.perRequest[0].windowMaxGapMs <= 100,
      `${sum.perRequest[0].samplesInsideRequest} samples, max hole ${sum.perRequest[0].windowMaxGapMs} ms`);
  }
  const unknown = summarizeMemory({
    samples: [], segments: [], qualified: [], cadence: null,
  });
  check('unknown cadence defaults to the conservative label',
    unknown.peakClaimable === false);
}

// =============================================================================
console.log('\n[11] SOL AUDIT FALSIFIERS — process identity and disposal integrity');

/** logcat line with an explicit pid, for process-identity fixtures. */
const pidLine = (tsMs, pid, msg) =>
  `${Math.floor(tsMs / 1000)}.${String(tsMs % 1000).padStart(3, '0')} ${pid} ${pid + 40} I ReactNativeJS: ${msg}`;

{
  const r = parseLogcatProcess('1787496370.074 17783 17815 I ReactNativeJS: hi');
  check('SOL: pid/tid parsed from an epoch logcat line',
    r.pid === 17783 && r.tid === 17815, `${r.pid}/${r.tid}`);
  const md = parseLogcatProcess('08-23 17:20:01.791 26491 26529 I ReactNativeJS: hi');
  check('SOL: pid/tid parsed from a month-day logcat line',
    md.pid === 26491 && md.tid === 26529, `${md.pid}/${md.tid}`);
  check('SOL: a line with no process columns yields nulls',
    parseLogcatProcess('no timestamp here').pid === null);
}

{
  // SOL FINDING 2: half a lifecycle from PID 111, half from PID 222. Request ids
  // restart per wrapper, so both halves say req=1.
  const t = BASE;
  const lines = [
    pidLine(t + 1000, 111, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1100, 111, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1100, 111, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1200, 222, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1200, 222, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 1300, 222, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 1300, 222, completionMsg(1, 1, 300)),
  ];
  const { qualified, rejected, lifecycleRejected } = correlate(lines, sampleTimes(t, 20, 300));
  check('SOL: a lifecycle stitched across two PIDs is REJECTED',
    qualified.length === 0, qualified.length ? `qualified req=${qualified[0].requestId}` : '');
  check('SOL: both process groups are reported separately',
    lifecycleRejected.length === 2 && new Set(lifecycleRejected.map((r) => r.pid)).size === 2,
    lifecycleRejected.map((r) => `pid ${r.pid}`).join(', '));
}
{
  // Same process, but a SECOND wrapper restarts the request counter. The two
  // req=1 lifecycles must not be pooled.
  const t = BASE;
  const lines = [
    pidLine(t + 500, 111, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 1000, 111, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1100, 111, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1100, 111, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1200, 111, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 2000, 111, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 2200, 111, phaseMsg('disposal', 'start', 1, 1, 0, 0)),
    pidLine(t + 2300, 111, phaseMsg('disposal', 'settled', 1, 1, 0, 1)),
    pidLine(t + 2300, 111, completionMsg(1, 1, 300)),
  ];
  const { qualified } = correlate(lines, sampleTimes(t, 20, 300));
  check('SOL: a lifecycle split across two WRAPPER instances in one PID is REJECTED',
    qualified.length === 0, qualified.length ? 'it qualified' : '');
}
{
  // A clean same-pid, same-wrapper lifecycle still qualifies, and carries its
  // process identity into the evidence.
  const t = BASE;
  const lines = [
    pidLine(t + 500, 777, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...[
      [0, phaseMsg('session', 'start', 1, 1, 0, 0)],
      [113, phaseMsg('session', 'settled', 1, 1, 1, 0)],
      [113, phaseMsg('inference', 'start', 1, 1, 1, 0)],
      [132, phaseMsg('inference', 'settled', 1, 1, 1, 0)],
      [132, phaseMsg('disposal', 'start', 1, 1, 1, 0)],
      [157, phaseMsg('disposal', 'settled', 1, 1, 1, 1)],
      [157, completionMsg(1, 1, 157)],
    ].map(([dt, msg]) => pidLine(t + 1000 + dt, 777, msg)),
  ];
  const { qualified } = correlate(lines, sampleTimes(t, 20, 300));
  check('SOL: a clean single-process lifecycle still qualifies',
    qualified.length === 1, String(qualified.length));
  check('SOL: qualified evidence records pid and wrapper epoch',
    qualified[0]?.pid === 777 && qualified[0]?.wrapperEpoch === 1,
    `pid=${qualified[0]?.pid} epoch=${qualified[0]?.wrapperEpoch}`);
}

{
  // SOL FINDING 1 (Owner-ratified OPTION_A, 2026-11-27): disposal THROWS on
  // req 1 (disposedTotal still increments), leaving that native session leaked
  // in PID 500. Under strict native leak physics, req 2 in the SAME PID (500)
  // overlaps the un-disposed session and is REJECTED, whereas a clean request
  // after a cold restart into a NEW PID (501) QUALIFIES while PID 500's failed
  // disposal stays surfaced in disposalIntegrity.
  const t = BASE;
  const lines = [
    pidLine(t + 1000, 500, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1100, 500, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1100, 500, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1200, 500, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1200, 500, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 1300, 500, phaseMsg('disposal', 'settled', 1, 0, 1, 1)),
    pidLine(t + 1300, 500, completionMsg(1, 0, 300)),
    pidLine(t + 3000, 500, phaseMsg('session', 'start', 2, 1, 1, 1)),
    pidLine(t + 3100, 500, phaseMsg('session', 'settled', 2, 1, 2, 1)),
    pidLine(t + 3100, 500, phaseMsg('inference', 'start', 2, 1, 2, 1)),
    pidLine(t + 3200, 500, phaseMsg('inference', 'settled', 2, 1, 2, 1)),
    pidLine(t + 3200, 500, phaseMsg('disposal', 'start', 2, 1, 2, 1)),
    pidLine(t + 3300, 500, phaseMsg('disposal', 'settled', 2, 1, 2, 2)),
    pidLine(t + 3300, 500, completionMsg(2, 1, 300)),
  ];
  const { qualified, lifecycleRejected, disposalIntegrity } = correlate(lines, sampleTimes(t, 20, 300));
  check('SOL: a later request in the SAME PID after a failed disposal is REJECTED for overlapping the leaked session',
    qualified.length === 0
      && disposalIntegrity.sessionOverlapCount === 1
      && lifecycleRejected.some((r) => r.requestId === 2 && r.reasons.some((x) => x.includes('overlap'))),
    `qualified=${qualified.length} overlaps=${disposalIntegrity.sessionOverlapCount}`);
  check('SOL: the FAILED disposal is surfaced despite that request being rejected',
    disposalIntegrity.disposalFailureCount === 1,
    `failures=${disposalIntegrity.disposalFailureCount}`);
  check('SOL: disposalIntegrity is NOT clean',
    disposalIntegrity.clean === false);
  check('SOL: balanced counters alone do NOT certify cleanliness',
    disposalIntegrity.countersBalanced === true && disposalIntegrity.clean === false,
    'created==disposed yet a disposal threw — exactly why counters cannot be the test');
  check('SOL: the failing request id is named',
    disposalIntegrity.failures[0].requestId === 1 && disposalIntegrity.failures[0].pid === 500);

  const restartLines = [
    ...lines.slice(0, 7),
    pidLine(t + 3000, 501, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 3100, 501, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 3100, 501, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 3200, 501, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 3200, 501, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 3300, 501, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 3300, 501, completionMsg(1, 1, 300)),
  ];
  const restartRes = correlate(restartLines, sampleTimes(t, 20, 300));
  check('SOL: a clean request after a cold restart into a NEW PID still qualifies while preserving the earlier PID disposal failure',
    restartRes.qualified.length === 1
      && restartRes.qualified[0].pid === 501
      && restartRes.qualified[0].requestId === 1
      && restartRes.disposalIntegrity.sessionOverlapCount === 0
      && restartRes.disposalIntegrity.disposalFailureCount === 1
      && restartRes.disposalIntegrity.clean === false,
    `qualified=${restartRes.qualified.length} pid=${restartRes.qualified[0]?.pid} overlaps=${restartRes.disposalIntegrity.sessionOverlapCount} failures=${restartRes.disposalIntegrity.disposalFailureCount}`);
}
{
  const t = BASE;
  const { disposalIntegrity } = correlate(lifecycleLines(t + 5000), GOOD_TIMES);
  check('SOL: a session with no failed disposal reports clean',
    disposalIntegrity.disposalFailureCount === 0 && disposalIntegrity.clean === true);
}
{
  const empty = summarizeDisposalIntegrity([]);
  check('SOL: an empty marker set is trivially balanced but reports zero activity',
    empty.disposalFailureCount === 0 && empty.finalCreated === 0 && empty.finalDisposed === 0);
}

{
  // SOL FINDING 3: 50 ms median, but a 1.35 s hole exactly across the inference
  // and ZERO samples inside the request window.
  const t = BASE;
  const before = Array.from({ length: 30 }, (_, i) => t + i * 50);
  const after = Array.from({ length: 30 }, (_, i) => t + 2900 + i * 50);
  const times = [...before, ...after];
  const lines = [
    pidLine(t + 1800, 500, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1850, 500, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1850, 500, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 2100, 500, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 2100, 500, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 2200, 500, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 2200, 500, completionMsg(1, 1, 400)),
  ];
  const cadence = computeCadence(times, { requestedIntervalMs: 50 });
  const segments = computeSamplingSegments(times, { continuityGapMs: 2000 });
  const { markers } = parseLifecycleMarkers(anchored(lines).join('\n'));
  const { qualified } = correlateRequests({ markers, segments });
  const samples = times.map((x) => ({ atUtcMs: x, privateDirtyBytes: 100 }));
  const sum = summarizeMemory({ samples, segments, qualified, cadence });
  check('SOL: median cadence is genuinely fast in this fixture',
    cadence.medianIntervalMs === 50, String(cadence.medianIntervalMs));
  check('SOL: yet ZERO samples land inside the request window',
    sum.perRequest[0].samplesInsideRequest === 0);
  check('SOL: a fast median does NOT license a peak claim over an observation hole',
    sum.peakClaimable === false, sum.peakClaimBlockers.join('; '));
  check('SOL: the blocker names the uncovered request',
    sum.peakClaimBlockers.some((b) => b.includes('sample(s) inside its window')),
    sum.peakClaimBlockers.join('; '));
  check('SOL: the metric stays labelled a maximum, not a peak',
    sum.metricLabel.includes('maximum sampled'));
}

// =============================================================================
console.log('\n[12] SOL ROUND-2 — an unanchored or ambiguous lifecycle is not evidence');

/** Seven well-formed markers for one request, at an explicit pid. */
const fullLifecycleAt = (t, pid, { req = 1, created = 0, line = pidLine } = {}) => [
  [0, phaseMsg('session', 'start', req, 1, created, created)],
  [100, phaseMsg('session', 'settled', req, 1, created + 1, created)],
  [100, phaseMsg('inference', 'start', req, 1, created + 1, created)],
  [200, phaseMsg('inference', 'settled', req, 1, created + 1, created)],
  [200, phaseMsg('disposal', 'start', req, 1, created + 1, created)],
  [300, phaseMsg('disposal', 'settled', req, 1, created + 1, created + 1)],
  [300, completionMsg(req, 1, 300)],
].map(([dt, msg]) => line(t + dt, pid, msg));

/** Same, but with no pid/tid columns at all. */
const noPidLine = (tsMs, _pid, msg) =>
  `${Math.floor(tsMs / 1000)}.${String(tsMs % 1000).padStart(3, '0')} I ReactNativeJS: ${msg}`;

const DENSE = sampleTimes(BASE - 2000, 120, 200);

{
  // POSITIVE CONTROL. Everything below must reject; this must NOT, or the rules
  // are simply refusing all evidence.
  const lines = [
    pidLine(BASE + 500, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...fullLifecycleAt(BASE + 1000, 900),
  ];
  const { qualified } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: a genuine wrapper-anchored epoch-1 lifecycle still QUALIFIES',
    qualified.length === 1 && qualified[0].wrapperEpoch === 1 && qualified[0].pid === 900,
    `${qualified.length} qualified, pid=${qualified[0]?.pid}, epoch=${qualified[0]?.wrapperEpoch}`);
}

{
  // SOL ROUND-2: two wrapper instances in ONE process, wrapper lines lost from
  // the ring buffer. Both halves say req=1, both stamp epoch 0, and the halves
  // are COMPLEMENTARY — first half from instance A, second from instance B.
  // Under the old rule this assembled into one apparently-perfect inference.
  const lines = [
    pidLine(BASE + 1000, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(BASE + 1100, 900, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(BASE + 1100, 900, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    // ---- process still alive; a SECOND wrapper was constructed here ----
    pidLine(BASE + 5000, 900, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(BASE + 5000, 900, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(BASE + 5100, 900, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(BASE + 5100, 900, completionMsg(1, 1, 4100)),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: complementary halves with NO wrapper marker are REJECTED',
    qualified.length === 0, `${qualified.length} qualified`);
  check('SOL2:   ...and the reason names the missing wrapper anchor',
    rejected.some((r) => r.reasons.some((x) => x.includes('wrapperEpoch 0'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 90));
}

{
  // SOL ROUND-2: two COMPLETE lifecycles, same pid, same req id, no wrapper.
  const lines = [
    ...fullLifecycleAt(BASE + 1000, 900, { req: 1, created: 0 }),
    ...fullLifecycleAt(BASE + 6000, 900, { req: 1, created: 1 }),
  ];
  const { qualified } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: two pooled complete epoch-0 lifecycles yield NO qualified request',
    qualified.length === 0, `${qualified.length} qualified`);
}

{
  // The same ambiguity WITH a wrapper anchor, so only the duplicate rule can
  // catch it: a replayed, concatenated or doubly-captured log.
  const lines = [
    pidLine(BASE + 500, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...fullLifecycleAt(BASE + 1000, 900, { req: 1, created: 0 }),
    ...fullLifecycleAt(BASE + 6000, 900, { req: 1, created: 1 }),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: duplicated complete lifecycles are REJECTED, not merged first-wins',
    qualified.length === 0, `${qualified.length} qualified`);
  check('SOL2:   ...and the reason names the duplication',
    rejected.some((r) => r.reasons.some((x) => x.includes('duplicate markers'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 100));
}

{
  // A single extra marker is enough: there is no way to tell a re-delivered
  // line from a second real lifecycle, so neither is evidence.
  const lines = [
    pidLine(BASE + 500, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...fullLifecycleAt(BASE + 1000, 900),
    pidLine(BASE + 1400, 900, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: ONE duplicated phase marker disqualifies the request',
    qualified.length === 0
      && rejected.some((r) => r.reasons.some((x) => x.includes('inference:settled x2'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 100));
}

{
  // SOL ROUND-2: logcat captured without the pid/tid columns. Every marker in
  // the whole log pools into one `null` pseudo-group.
  const lines = [
    noPidLine(BASE + 500, 0, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...fullLifecycleAt(BASE + 1000, 0, { line: noPidLine }),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: an unattributable lifecycle (no pid columns) is REJECTED',
    qualified.length === 0, `${qualified.length} qualified`);
  check('SOL2:   ...and the reason names the missing process id',
    rejected.some((r) => r.reasons.some((x) => x.includes('no process id'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 90));
}

{
  // Fail-closed must not be selective: a pid-less log carrying a REAL disposal
  // failure still surfaces it session-wide, even though nothing qualifies.
  const lines = [
    noPidLine(BASE + 1000, 0, phaseMsg('session', 'start', 1, 1, 0, 0)),
    noPidLine(BASE + 1100, 0, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    noPidLine(BASE + 1100, 0, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    noPidLine(BASE + 1200, 0, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    noPidLine(BASE + 1200, 0, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    noPidLine(BASE + 1300, 0, phaseMsg('disposal', 'settled', 1, 0, 1, 1)),
  ];
  const { qualified, disposalIntegrity } = correlate(lines, DENSE, { anchor: false });
  check('SOL2: nothing qualifies, yet the failed disposal is still reported',
    qualified.length === 0 && disposalIntegrity.disposalFailureCount === 1
      && disposalIntegrity.clean === false,
    `qualified=${qualified.length} failures=${disposalIntegrity.disposalFailureCount}`);
}

// =============================================================================
console.log('\n[13] HERMES r3 residual — the created snapshot must be consistent');

{
  // The stitch Hermes found: instance A emits session+inference (created 0->1),
  // its disposal is lost, and a SECOND instance whose wrapper line fell out of
  // the ring buffer contributes the disposal at epoch 1 with created still 0.
  // Both halves pool under (pid, epoch 1, req 1). `disposed === created` holds
  // by coincidence (both 1), so only the created-snapshot cross-check catches
  // that session:settled says created=1 while disposal says created=0.
  const t = BASE;
  const lines = [
    pidLine(t + 500, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 1000, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1100, 900, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1100, 900, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1200, 900, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    // disposal half from a different instance: created counter still 0
    pidLine(t + 5000, 900, phaseMsg('disposal', 'start', 1, 1, 0, 0)),
    pidLine(t + 5100, 900, phaseMsg('disposal', 'settled', 1, 1, 0, 1)),
    pidLine(t + 5100, 900, completionMsg(1, 1, 4100)),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('HERMES: a lifecycle stitched across instances (created 1 vs 0) is REJECTED',
    qualified.length === 0, `${qualified.length} qualified`);
  check('HERMES:   ...and the reason names the created-count disagreement',
    rejected.some((r) => r.reasons.some((x) => x.includes('disagree about the process-wide created'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 100));
}

{
  // Positive control: a genuine lifecycle carries ONE created snapshot (1)
  // across session:settled, inference and disposal, and still qualifies.
  const t = BASE;
  const lines = [
    pidLine(t + 500, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 1000, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1100, 900, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1100, 900, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1200, 900, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1200, 900, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 1300, 900, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 1300, 900, completionMsg(1, 1, 300)),
  ];
  const { qualified } = correlate(lines, DENSE, { anchor: false });
  check('HERMES: a consistent-snapshot lifecycle still QUALIFIES',
    qualified.length === 1, `${qualified.length} qualified`);
}

// =============================================================================
console.log('\n[14] HERMES r4 R4-2 — the epoch session ledger');

{
  // Hermes' S1: instance A reaches created=5; instance B (wrapper line lost)
  // sits COINCIDENTALLY at the same 5/4 counters. Every created snapshot in
  // the group agrees, so the [13] cross-check cannot see it — the markers are
  // byte-for-byte what one genuine lifecycle emits. The epoch ledger catches
  // it: `created` reaches 5 while the capture witnessed only ONE session
  // creation, so four sessions were created that this capture never saw.
  const t = BASE;
  const lines = [
    pidLine(t + 500, 555, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 1000, 555, phaseMsg('session', 'start', 9, 1, 4, 4)),
    pidLine(t + 1100, 555, phaseMsg('session', 'settled', 9, 1, 5, 4)),
    pidLine(t + 1100, 555, phaseMsg('inference', 'start', 9, 1, 5, 4)),
    pidLine(t + 1200, 555, phaseMsg('inference', 'settled', 9, 1, 5, 4)),
    pidLine(t + 1500, 555, phaseMsg('disposal', 'start', 9, 1, 5, 4)),
    pidLine(t + 1600, 555, phaseMsg('disposal', 'settled', 9, 1, 5, 5)),
    pidLine(t + 1700, 555, completionMsg(9, 1, 700)),
  ];
  const { qualified, rejected } = correlate(lines, DENSE, { anchor: false });
  check('HERMES R4-2: a coincidence-equal stitch is REJECTED by the epoch ledger',
    qualified.length === 0, `${qualified.length} qualified`);
  check('HERMES R4-2:   ...and the reason names the uncaptured session creations',
    rejected.some((r) => r.reasons.some((x) => x.includes('capture never saw'))),
    rejected.flatMap((r) => r.reasons).join('; ').slice(0, 110));
}

{
  // Positive control: a genuine run creates exactly as many sessions as the
  // capture witnessed, so the ledger balances. Real device runs satisfy this
  // exactly (maxCreated === sessionSettled: 11/11, 10/10, 11/11).
  const t = BASE;
  const lines = [pidLine(t + 500, 556, phaseMsg('wrapper', 'settled', 0, 1, 0, 0))];
  for (let i = 1; i <= 3; i += 1) {
    const at = t + 1000 + (i - 1) * 800;
    lines.push(
      pidLine(at, 556, phaseMsg('session', 'start', i, 1, i - 1, i - 1)),
      pidLine(at + 50, 556, phaseMsg('session', 'settled', i, 1, i, i - 1)),
      pidLine(at + 50, 556, phaseMsg('inference', 'start', i, 1, i, i - 1)),
      pidLine(at + 150, 556, phaseMsg('inference', 'settled', i, 1, i, i - 1)),
      pidLine(at + 150, 556, phaseMsg('disposal', 'start', i, 1, i, i - 1)),
      pidLine(at + 250, 556, phaseMsg('disposal', 'settled', i, 1, i, i)),
      pidLine(at + 250, 556, completionMsg(i, 1, 250)),
    );
  }
  const { qualified } = correlate(lines, DENSE, { anchor: false });
  check('HERMES R4-2: a balanced ledger (3 creations, 3 witnessed) still QUALIFIES',
    qualified.length === 3, `${qualified.length} qualified`);
}

{
  const lines = anchored([
    ...fullLifecycleAt(BASE + 1000, 900),
    pidLine(BASE + 2200, 901, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    ...fullLifecycleAt(BASE + 3000, 901),
    ...fullLifecycleAt(BASE + 1000, 999),
  ]);
  const { markers } = parseLifecycleMarkers(lines.join('\n'));
  const samples = Array.from({ length: 41 }, (_, i) => ({
    captureStartMs: BASE + i * 100, appName: 'target.app', processId: i < 20 ? 900 : 901,
  }));
  const segments = computeSamplingSegments(samples.map((s) => s.captureStartMs), { continuityGapMs: 2000 });
  const bound = bindTargetSamples({ samples, markers, segments, packageName: 'target.app' });
  const result = correlateRequests(bound);
  check('SEC11: cold restart qualifies both target process lifetimes', result.qualified.length === 2);
  check('SEC11: foreign PID markers are excluded', bound.markers.every((m) => m.pid !== 999));
  check('SEC11: sampling segments split at a PID change', bound.segments.length === 2);
  let refused = false;
  try { bindTargetSamples({ samples, markers, segments, packageName: 'other.app' }); } catch { refused = true; }
  check('SEC11: mismatched raw package identity fails closed', refused);
}

console.log('\n[15] Stream 2 PR 3 — co-scheduled [embedder-lifecycle] + [safety-reader-lifecycle]');
{
  const readerPhaseMsg = (p, s, req, ok, created, disposed) =>
    `[safety-reader-lifecycle] ${p}:${s} req=${req} ok=${ok} created=${created} disposed=${disposed}`;
  const readerCompletionMsg = (req, ok, totalMs) =>
    `[safety-reader-lifecycle] request=${req} ok=${ok} totalMs=${totalMs}`;

  const t = BASE;
  const dualLines = [
    pidLine(t + 100, 777, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 120, 777, readerPhaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    // Request 1 on embedder (t+1000..t+1160)
    pidLine(t + 1000, 777, phaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1050, 777, phaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1050, 777, phaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1120, 777, phaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1120, 777, phaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 1160, 777, phaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 1160, 777, completionMsg(1, 1, 160)),
    // Co-scheduled Request 1 on safety-reader AFTER embedder disposed (t+1170..t+1310)
    pidLine(t + 1170, 777, readerPhaseMsg('session', 'start', 1, 1, 0, 0)),
    pidLine(t + 1210, 777, readerPhaseMsg('session', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1210, 777, readerPhaseMsg('inference', 'start', 1, 1, 1, 0)),
    pidLine(t + 1270, 777, readerPhaseMsg('inference', 'settled', 1, 1, 1, 0)),
    pidLine(t + 1270, 777, readerPhaseMsg('disposal', 'start', 1, 1, 1, 0)),
    pidLine(t + 1310, 777, readerPhaseMsg('disposal', 'settled', 1, 1, 1, 1)),
    pidLine(t + 1310, 777, readerCompletionMsg(1, 1, 140)),
  ];
  const dualRes = correlate(dualLines, DENSE, { anchor: false });
  check(
    'DUAL-1: co-scheduled embedder + safety-reader req=1 both qualify without epoch or requestId collision',
    dualRes.qualified.length === 2
      && dualRes.qualified.some((q) => q.component === 'embedder' && q.requestId === 1)
      && dualRes.qualified.some((q) => q.component === 'safety-reader' && q.requestId === 1)
      && dualRes.disposalIntegrity.clean === true
      && dualRes.disposalIntegrity.finalCreated === 2
      && dualRes.disposalIntegrity.finalDisposed === 2,
    `qualified=${dualRes.qualified.length}, created=${dualRes.disposalIntegrity.finalCreated}, disposed=${dualRes.disposalIntegrity.finalDisposed}`,
  );

  // Negative falsifier: safety-reader disposal ok=0 fails session-wide disposalIntegrity even when embedder is clean
  const leakedReaderLines = dualLines.map((line) =>
    line.includes('[safety-reader-lifecycle] disposal:settled')
      ? pidLine(t + 1310, 777, readerPhaseMsg('disposal', 'settled', 1, 0, 1, 1))
      : line,
  );
  const leakedReaderRes = correlate(leakedReaderLines, DENSE, { anchor: false });
  check(
    'DUAL-2: safety-reader disposal:settled ok=0 fails disposalIntegrity closed even when embedder is clean',
    leakedReaderRes.qualified.length === 1
      && leakedReaderRes.qualified[0].component === 'embedder'
      && leakedReaderRes.disposalIntegrity.disposalFailureCount === 1
      && leakedReaderRes.disposalIntegrity.clean === false,
    `failures=${leakedReaderRes.disposalIntegrity.disposalFailureCount}, clean=${leakedReaderRes.disposalIntegrity.clean}`,
  );

  // Negative falsifier: safety-reader missing disposal (unbalanced 1 != 0) fails countersBalanced even when embedder is 1/1
  const unbalancedReaderLines = dualLines.filter(
    (line) => !line.includes('[safety-reader-lifecycle] disposal:') && !line.includes('[safety-reader-lifecycle] request=1'),
  );
  const unbalancedRes = correlate(unbalancedReaderLines, DENSE, { anchor: false });
  check(
    'DUAL-3: unbalanced safety-reader session (created=1, disposed=0) fails countersBalanced even when embedder is 1/1',
    unbalancedRes.disposalIntegrity.finalCreated === 2
      && unbalancedRes.disposalIntegrity.finalDisposed === 1
      && unbalancedRes.disposalIntegrity.countersBalanced === false
      && unbalancedRes.disposalIntegrity.clean === false,
    `created=${unbalancedRes.disposalIntegrity.finalCreated}, disposed=${unbalancedRes.disposalIntegrity.finalDisposed}`,
  );
}

console.log('\n[16] WO-02 Item 3 — serial non-overlap, cold-restart PID continuity, attribution identity');
{
  const rPhase = (p, s, req, ok, created, disposed) =>
    `[safety-reader-lifecycle] ${p}:${s} req=${req} ok=${ok} created=${created} disposed=${disposed}`;
  const rDone = (req, ok, totalMs) => `[safety-reader-lifecycle] request=${req} ok=${ok} totalMs=${totalMs}`;
  /** Seven markers for one request of `component` at explicit offsets. */
  const life = (component, pid, req, created, at) => {
    const ph = component === 'embedder' ? phaseMsg : rPhase;
    const done = component === 'embedder' ? completionMsg : rDone;
    const [s0, s1, i0, i1, d0, d1] = at;
    return [
      pidLine(s0, pid, ph('session', 'start', req, 1, created, created)),
      pidLine(s1, pid, ph('session', 'settled', req, 1, created + 1, created)),
      pidLine(i0, pid, ph('inference', 'start', req, 1, created + 1, created)),
      pidLine(i1, pid, ph('inference', 'settled', req, 1, created + 1, created)),
      pidLine(d0, pid, ph('disposal', 'start', req, 1, created + 1, created)),
      pidLine(d1, pid, ph('disposal', 'settled', req, 1, created + 1, created + 1)),
      pidLine(d1, pid, done(req, 1, d1 - s0)),
    ];
  };
  const wrappers = (pid, t) => [
    pidLine(t, pid, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
    pidLine(t + 10, pid, rPhase('wrapper', 'settled', 0, 1, 0, 0)),
  ];
  const t = BASE;

  // Positive control: strictly sequential dual-model run.
  const seq = correlate([
    ...wrappers(777, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160]),
    ...life('safety-reader', 777, 1, 0, [t + 1170, t + 1210, t + 1210, t + 1270, t + 1270, t + 1310]),
  ], DENSE, { anchor: false });
  check('OVL-0: sequential embedder then safety-reader in one PID: sessionOverlapCount === 0 and clean',
    seq.disposalIntegrity.sessionOverlapCount === 0 && seq.disposalIntegrity.clean === true
      && seq.qualified.length === 2,
    `overlaps=${seq.disposalIntegrity.sessionOverlapCount} qualified=${seq.qualified.length}`);
  check('OVL-0: componentRequestCounts reports one request per model',
    seq.componentRequestCounts?.embedder === 1 && seq.componentRequestCounts?.['safety-reader'] === 1,
    JSON.stringify(seq.componentRequestCounts));

  // Concurrent: safety-reader session starts BEFORE the embedder session settles its disposal.
  const conc = correlate([
    ...wrappers(777, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160]),
    ...life('safety-reader', 777, 1, 0, [t + 1100, t + 1210, t + 1210, t + 1270, t + 1270, t + 1310]),
  ], DENSE, { anchor: false });
  check('OVL-1: overlapping embedder + safety-reader sessions in one PID yield sessionOverlapCount > 0',
    conc.disposalIntegrity.sessionOverlapCount > 0, String(conc.disposalIntegrity.sessionOverlapCount));
  check('OVL-1: an overlap makes disposalIntegrity NOT clean even with balanced counters and no failures',
    conc.disposalIntegrity.clean === false && conc.disposalIntegrity.countersBalanced === true
      && conc.disposalIntegrity.disposalFailureCount === 0);
  check('OVL-1: sessionOverlaps names BOTH conflicting session identities and timestamps',
    conc.disposalIntegrity.sessionOverlaps?.length === 1
      && JSON.stringify(conc.disposalIntegrity.sessionOverlaps[0]).includes('"embedder"')
      && JSON.stringify(conc.disposalIntegrity.sessionOverlaps[0]).includes('"safety-reader"')
      && JSON.stringify(conc.disposalIntegrity.sessionOverlaps[0]).includes(String(t + 1100))
      && JSON.stringify(conc.disposalIntegrity.sessionOverlaps[0]).includes(String(t + 1160)),
    JSON.stringify(conc.disposalIntegrity.sessionOverlaps ?? null).slice(0, 160));
  check('OVL-1: correlateRequests rejects BOTH overlapping requests',
    conc.qualified.length === 0
      && conc.componentRequestCounts?.embedder === 0 && conc.componentRequestCounts?.['safety-reader'] === 0
      && conc.lifecycleRejected.filter((r) => r.reasons.some((x) => x.includes('overlap'))).length === 2,
    conc.lifecycleRejected.map((r) => `${r.component}:${r.reasons.join('|')}`).join(' ; ').slice(0, 160));

  // Same-millisecond sequential handoff: disposal:settled on an EARLIER line, session:start on a LATER line, equal tsMs.
  const handoff = correlate([
    ...wrappers(777, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160]),
    ...life('safety-reader', 777, 1, 0, [t + 1160, t + 1210, t + 1210, t + 1270, t + 1270, t + 1310]),
  ], DENSE, { anchor: false });
  check('OVL-2: same-millisecond sequential handoff (disposal line before session:start line) is NOT an overlap',
    handoff.disposalIntegrity.sessionOverlapCount === 0 && handoff.qualified.length === 2
      && handoff.disposalIntegrity.clean === true,
    `overlaps=${handoff.disposalIntegrity.sessionOverlapCount} qualified=${handoff.qualified.length}`);

  // Same millisecond, but session:start is logged on an EARLIER line than the disposal:settled.
  const embedderLines = life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160]);
  const readerLines = life('safety-reader', 777, 1, 0, [t + 1160, t + 1210, t + 1210, t + 1270, t + 1270, t + 1310]);
  const sameMsReversed = correlate([
    ...wrappers(777, t + 100),
    ...embedderLines.slice(0, 5), readerLines[0], ...embedderLines.slice(5), ...readerLines.slice(1),
  ], DENSE, { anchor: false });
  check('OVL-3: equal-timestamp start logged BEFORE the earlier disposal settles IS an overlap',
    sameMsReversed.disposalIntegrity.sessionOverlapCount === 1 && sameMsReversed.qualified.length === 0,
    `overlaps=${sameMsReversed.disposalIntegrity.sessionOverlapCount}`);

  // A contains B and C; B and C do not overlap each other. Predecessor-only comparison would miss A-C.
  const nested = correlate([
    ...wrappers(777, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1900, t + 1900, t + 2000]),
    ...life('safety-reader', 777, 1, 0, [t + 1100, t + 1150, t + 1150, t + 1200, t + 1200, t + 1250]),
    ...life('safety-reader', 777, 2, 1, [t + 1300, t + 1350, t + 1350, t + 1400, t + 1400, t + 1450]),
  ], DENSE, { anchor: false });
  check('OVL-4: one long session containing two shorter ones records BOTH overlaps',
    nested.disposalIntegrity.sessionOverlapCount === 2, String(nested.disposalIntegrity.sessionOverlapCount));
  check('OVL-4: the third session (overlapping only the first, not its immediate predecessor) is rejected',
    nested.qualified.length === 0
      && nested.lifecycleRejected.some((r) => r.component === 'safety-reader' && r.requestId === 2
        && r.reasons.some((x) => x.includes('overlap'))),
    nested.qualified.map((q) => `${q.component}:${q.requestId}`).join(','));

  // Different PIDs never overlap each other.
  const twoPids = correlate([
    ...wrappers(777, t + 100), ...wrappers(778, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160]),
    ...life('safety-reader', 778, 1, 0, [t + 1100, t + 1210, t + 1210, t + 1270, t + 1270, t + 1310]),
  ], DENSE, { anchor: false });
  check('OVL-5: concurrent sessions in DIFFERENT PIDs are not an overlap',
    twoPids.disposalIntegrity.sessionOverlapCount === 0, String(twoPids.disposalIntegrity.sessionOverlapCount));

  // Single-model packet: the counts expose the missing model.
  const embOnly = correlate([...wrappers(777, t + 100),
    ...life('embedder', 777, 1, 0, [t + 1000, t + 1050, t + 1050, t + 1120, t + 1120, t + 1160])], DENSE, { anchor: false });
  check('OVL-6: single-model (embedder-only) run reports safety-reader count 0',
    embOnly.componentRequestCounts?.embedder === 1 && embOnly.componentRequestCounts?.['safety-reader'] === 0,
    JSON.stringify(embOnly.componentRequestCounts));

  // --- cold-restart PID continuity in bindTargetSamples ----------------------
  const mkSamples = (pids) => pids.map((pid, i) => ({ captureStartMs: BASE + i * 100, appName: 'target.app', processId: pid }));
  const bind = (samples, lines) => {
    const { markers } = parseLifecycleMarkers(lines.join('\n'));
    const segments = computeSamplingSegments(samples.map((s) => s.captureStartMs), { continuityGapMs: 2000 });
    return bindTargetSamples({ samples, markers, segments, packageName: 'target.app' });
  };
  const recurrence = mkSamples([...Array(10).fill(900), ...Array(10).fill(901), ...Array(10).fill(900)]);
  let recurErr = null;
  try { bind(recurrence, [pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0))]); } catch (e) { recurErr = e; }
  check('PID-1: PID recurrence 900 -> 901 -> 900 is rejected by bindTargetSamples',
    recurErr?.message === 'Cold-restart PID continuity violation: process ID reappeared after a PID transition',
    recurErr?.message ?? 'no error');

  const coldRestart = mkSamples([...Array(10).fill(900), ...Array(10).fill(901)]); // 900 until BASE+900, 901 from BASE+1000
  let lateErr = null;
  try {
    bind(coldRestart, [
      pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      pidLine(BASE + 1050, 901, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      pidLine(BASE + 1500, 900, phaseMsg('session', 'start', 1, 1, 0, 0)), // after 901 started sampling
    ]);
  } catch (e) { lateErr = e; }
  check('PID-2: a target-PID marker AFTER the next process sampling window began is rejected, not filtered',
    lateErr?.message === 'Cold-restart PID continuity violation: target PID lifecycle marker falls outside its process sampling window',
    lateErr?.message ?? 'no error');
  let earlyErr = null;
  try {
    bind(coldRestart, [
      pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      pidLine(BASE + 500, 901, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)), // before 900's last sample
    ]);
  } catch (e) { earlyErr = e; }
  check('PID-3: a target-PID marker BEFORE the previous process last sample is rejected',
    earlyErr?.message === 'Cold-restart PID continuity violation: target PID lifecycle marker falls outside its process sampling window',
    earlyErr?.message ?? 'no error');
  let okErr = null;
  let okBound = null;
  try {
    okBound = bind(coldRestart, [
      pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      pidLine(BASE + 950, 901, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)), // between 900's last and 901's first
      pidLine(BASE + 960, 999, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)), // foreign pid: filtered
    ]);
  } catch (e) { okErr = e; }
  check('PID-4: an in-window cold restart with a foreign PID binds without error and drops the foreign PID',
    okErr === null && okBound.markers.length === 2 && okBound.markers.every((m) => m.pid !== 999),
    okErr?.message ?? `${okBound?.markers.length} markers`);

  // wrapperEpoch is recomputed on the bound set: a poisoned input epoch cannot survive binding.
  {
    const { markers } = parseLifecycleMarkers([
      pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      pidLine(BASE + 300, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
    ].join('\n'));
    const poisoned = markers.map((m) => ({ ...m, wrapperEpoch: 7 }));
    const samples = mkSamples(Array(10).fill(900));
    const segments = computeSamplingSegments(samples.map((s) => s.captureStartMs), { continuityGapMs: 2000 });
    const b = bindTargetSamples({ samples, markers: poisoned, segments, packageName: 'target.app' });
    check('PID-5: wrapperEpoch is recomputed on the bound target markers (poisoned epoch 7 -> 1)',
      b.markers.length === 2 && b.markers.every((m) => m.wrapperEpoch === 1),
      b.markers.map((m) => m.wrapperEpoch).join(','));
  }

  // --- memory attribution identity ------------------------------------------
  {
    const cadence = computeCadence(DENSE, { requestedIntervalMs: 200 });
    const segments = computeSamplingSegments(DENSE, { continuityGapMs: 2000 }).map((s) => ({ ...s, pid: 777 }));
    const sum = summarizeMemory({
      samples: DENSE.map((x) => ({ atUtcMs: x, privateDirtyBytes: 100 })),
      segments, qualified: seq.qualified, cadence,
    });
    const reader = sum.perRequest.find((r) => r.component === 'safety-reader');
    check('ATTR-1: perRequest carries component, pid and wrapperEpoch',
      reader?.pid === 777 && reader?.wrapperEpoch === 1
        && sum.perRequest.some((r) => r.component === 'embedder'),
      JSON.stringify(sum.perRequest.map((r) => [r.component, r.pid, r.wrapperEpoch])));
    check('ATTR-2: perRun carries pid', sum.perRun.every((r) => r.pid === 777), JSON.stringify(sum.perRun.map((r) => r.pid)));
    check('ATTR-3: peakClaimBlockers name component and pid',
      sum.peakClaimBlockers.some((b) => b.startsWith('safety-reader request 1 (pid 777)'))
        && sum.peakClaimBlockers.some((b) => b.startsWith('embedder request 1 (pid 777)')),
      sum.peakClaimBlockers.join('; ').slice(0, 160));
  }

  console.log('\n[17] GPT 6.2 Sol adversarial provenance falsifiers (WO02-SOL-01, 05, 07)');
  {
    // WO02-SOL-01: reader disposes at +160 ms; embedder req 1 started at +140 ms
    // and settled at +170 ms, but its session:start line was lost from logcat,
    // followed by a clean embedder req 2. Dropping session:start must NOT shrink
    // req 1's interval to +170 ms and hide the cross-model overlap.
    const emb1WithoutStart = life('embedder', 900, 1, 0, [t + 140, t + 170, t + 170, t + 190, t + 190, t + 210]).slice(1);
    const lostStart = correlate([
      ...wrappers(900, t + 50),
      ...life('safety-reader', 900, 1, 0, [t + 100, t + 120, t + 120, t + 145, t + 145, t + 160]),
      ...emb1WithoutStart,
      ...life('embedder', 900, 2, 1, [t + 500, t + 530, t + 530, t + 560, t + 560, t + 590]),
    ], DENSE, { anchor: false });
    check('SOL-R3-1 (WO02-SOL-01): missing session:start fails closed on overlap and cannot pass clean with a later request',
      lostStart.disposalIntegrity.sessionOverlapCount >= 1
        && lostStart.disposalIntegrity.clean === false
        && !lostStart.qualified.some((q) => q.component === 'safety-reader' && q.requestId === 1),
      `overlaps=${lostStart.disposalIntegrity.sessionOverlapCount} clean=${lostStart.disposalIntegrity.clean} qualified=${lostStart.qualified.length}`);

    // WO02-SOL-05a: interleaved PID recurrence (900 -> 901 -> 900) inside the inter-sample gap.
    let gapRecurErr = null;
    try {
      bind(coldRestart, [
        pidLine(BASE + 880, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
        pidLine(BASE + 920, 901, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
        pidLine(BASE + 950, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
      ]);
    } catch (e) { gapRecurErr = e; }
    check('SOL-R3-2a (WO02-SOL-05): marker PID recurrence 900 -> 901 -> 900 inside inter-sample gap is rejected',
      gapRecurErr !== null && gapRecurErr.message.includes('Cold-restart PID continuity violation'),
      gapRecurErr?.message ?? 'no error');

    // WO02-SOL-05b: old-PID marker at exact first sample timestamp of the new PID (BASE + 1000).
    let boundaryErr = null;
    try {
      bind(coldRestart, [
        pidLine(BASE + 50, 900, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
        pidLine(BASE + 1000, 900, phaseMsg('session', 'start', 1, 1, 0, 0)),
      ]);
    } catch (e) { boundaryErr = e; }
    check('SOL-R3-2b (WO02-SOL-05): old-PID marker at exact start timestamp of next PID sampling window is rejected',
      boundaryErr !== null && boundaryErr.message.includes('Cold-restart PID continuity violation'),
      boundaryErr?.message ?? 'no error');

    // WO02-SOL-07a: all 7 lines of a request at the same millisecond in REVERSED log order.
    const sameMsReversed = [
      pidLine(t + 100, 777, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      ...life('embedder', 777, 1, 0, [t + 1000, t + 1000, t + 1000, t + 1000, t + 1000, t + 1000]).reverse(),
    ];
    const revRes = correlate(sameMsReversed, DENSE, { anchor: false });
    check('SOL-R3-3 (WO02-SOL-07): same-millisecond markers in reversed log line order are rejected',
      revRes.qualified.length === 0
        && revRes.lifecycleRejected.some((r) => r.reasons.some((x) => x.includes('out of order'))),
      `qualified=${revRes.qualified.length}`);

    // WO02-SOL-07b: wrapper:settled logged earlier in file with a LATER timestamp (+400 ms) than request (+100 ms).
    const invertedAnchor = correlate([
      pidLine(t + 400, 777, phaseMsg('wrapper', 'settled', 0, 1, 0, 0)),
      ...life('embedder', 777, 1, 0, [t + 100, t + 120, t + 120, t + 140, t + 140, t + 160]),
    ], DENSE, { anchor: false });
    check('SOL-R3-4 (WO02-SOL-07): request markers with timestamps earlier than their wrapper:settled anchor are rejected',
      invertedAnchor.qualified.length === 0,
      `qualified=${invertedAnchor.qualified.length}`);
  }
}

console.log(`\n${fail === 0 ? 'ALL LIFECYCLE CORRELATOR FIXTURES PASSED' : `${fail} LIFECYCLE CORRELATOR FIXTURE(S) FAILED`}`);
process.exit(fail ? 1 : 0);
