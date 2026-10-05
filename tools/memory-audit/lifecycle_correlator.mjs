/**
 * lifecycle_correlator.mjs — PURE, testable correlation logic for QA embedder
 * lifecycle/memory evidence (WO remediation P1).
 *
 * Split out of meminfo_harness.mjs because the previous inline correlation was
 * not a proof. Defect classes this module exists to make impossible:
 *
 *   1. `ok=0` requests counted as successful inferences;
 *   2. ANY `created=` marker treated as inference proof — including the
 *      wrapper's own `wrapper:settled req=0 ok=1 created=0 disposed=0`
 *      bookkeeping event, which proves only that a wrapper object exists;
 *   3. session / inference / disposal / request markers accepted without
 *      proving they share ONE request id;
 *   4. markers compared against `first sample .. last sample`, so a marker
 *      landing in a multi-hour UNSAMPLED gap passed as "during sampling";
 *   5. +/-120 s of clock slack silently widening the window;
 *   6. `max(all samples) - first sample` labelled an increment "around
 *      inference" when neither endpoint need be near an inference;
 *   7. no achieved-cadence reporting, so "sampled" was unquantified;
 *   8. no fixtures — the logic had never been falsified;
 *   9. markers with no process id pooled into one pseudo-group and correlated;
 *  10. `wrapperEpoch === 0` (no wrapper marker seen) treated as a real epoch, so
 *      complementary halves of two wrapper instances in ONE process assembled
 *      into a single apparently-complete lifecycle;
 *  11. duplicate markers under one request identity silently resolved
 *      first-occurrence-wins, so a replayed or concatenated log merged into one
 *      clean-looking request.
 *
 * Everything here is a pure function of its arguments: no adb, no clock, no
 * filesystem. `meminfo_harness.mjs` supplies device I/O; `test_lifecycle_
 * correlator.mjs` supplies falsifiers.
 *
 * MARKER GRAMMAR (emitted by apps/mobile/src/inference/deviceEmbedder.ts):
 *   [embedder-lifecycle] <phase>:<stage> req=N ok=B created=C disposed=D
 *   [embedder-lifecycle] request=N ok=B totalMs=T
 * phase in {wrapper,request,session,inference,disposal}; stage in {start,settled}.
 * requestId is 1-based per wrapper; 0 is reserved for the wrapper event.
 */

export const LIFECYCLE_TAG = '[embedder-lifecycle]';

/** requestId reserved by the wrapper's own creation event. Never a real
 *  inference — see createLazySingleFlightEmbedder's `emit('wrapper',...,0,...)`. */
export const WRAPPER_REQUEST_ID = 0;

/** The six phase markers plus the completion line that a production-path
 *  inference MUST produce, all under one request id. */
export const REQUIRED_PHASE_MARKERS = [
  ['session', 'start'],
  ['session', 'settled'],
  ['inference', 'start'],
  ['inference', 'settled'],
  ['disposal', 'start'],
  ['disposal', 'settled'],
];

// --- timestamp parsing ------------------------------------------------------

/** `logcat -v epoch`:  1755930001.791  26491 26529 I Tag: msg */
const TS_EPOCH = /^\s*(\d{9,13})\.(\d{3})(?=\s|$)/;
/** `logcat -v year`:   2026-08-23 17:20:01.791  26491 ... */
const TS_YEAR = /^\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})(?=\s|$)/;
/** default logcat:     08-23 17:20:01.791  26491 ... */
const TS_MONTHDAY = /^\s*(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})(?=\s|$)/;

/**
 * Parse a logcat line's leading timestamp to epoch milliseconds UTC.
 *
 * Epoch format needs nothing else and is therefore PREFERRED (`logcat -v epoch`)
 * — it removes timezone guessing entirely. Local formats are still supported,
 * but ONLY when the caller supplies the device's UTC offset explicitly; the
 * previous implementation inferred an offset from a host/device clock delta at
 * finish time and silently fell back to 0, which is a guess, not evidence.
 *
 * @param {string} line
 * @param {{ tzOffsetMinutes?: number|null, year?: number|null }} [opts]
 *        tzOffsetMinutes: minutes EAST of UTC (Brisbane UTC+10 => 600).
 * @returns {{ ok: boolean, tsMs: number|null, format: string|null, reason: string|null }}
 */
export function parseLogcatTimestamp(line, opts = {}) {
  const { tzOffsetMinutes = null, year = null } = opts;
  const text = String(line ?? '');

  const epoch = text.match(TS_EPOCH);
  if (epoch) {
    return {
      ok: true,
      tsMs: Number(epoch[1]) * 1000 + Number(epoch[2]),
      format: 'epoch',
      reason: null,
    };
  }

  const withYear = text.match(TS_YEAR);
  if (withYear) {
    if (!Number.isFinite(tzOffsetMinutes)) {
      return { ok: false, tsMs: null, format: 'year', reason: 'tzOffsetMinutes required for local timestamps' };
    }
    const [, y, mo, d, h, mi, s, ms] = withYear;
    const local = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms));
    return { ok: true, tsMs: local - tzOffsetMinutes * 60_000, format: 'year', reason: null };
  }

  const md = text.match(TS_MONTHDAY);
  if (md) {
    if (!Number.isFinite(tzOffsetMinutes)) {
      return { ok: false, tsMs: null, format: 'monthday', reason: 'tzOffsetMinutes required for local timestamps' };
    }
    if (!Number.isFinite(year)) {
      // The default logcat format carries no year. Inventing "this year" breaks
      // across a new-year boundary; the caller must state it.
      return { ok: false, tsMs: null, format: 'monthday', reason: 'year required for month-day timestamps' };
    }
    const [, mo, d, h, mi, s, ms] = md;
    const local = Date.UTC(Number(year), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms));
    return { ok: true, tsMs: local - tzOffsetMinutes * 60_000, format: 'monthday', reason: null };
  }

  return { ok: false, tsMs: null, format: null, reason: 'no recognised logcat timestamp' };
}

/** Leading timestamp shapes, reused to find the pid/tid columns that follow. */
const TS_PREFIX = String.raw`(?:\d{9,13}\.\d{3}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})`;
const PROCESS_RE = new RegExp(String.raw`^\s*${TS_PREFIX}\s+(\d+)\s+(\d+)\s+[VDIWEF]\s`);

/**
 * Extract the emitting process and thread ids from a logcat line.
 *
 * REQUIRED for correctness, not decoration: `requestId` is a per-WRAPPER
 * counter that restarts at 1 every time `createLazySingleFlightEmbedder` runs.
 * A process restart (or a second wrapper in one process) therefore reissues the
 * same ids. Correlating on `requestId` alone lets half a lifecycle from one
 * process be stitched to half from another and pass as a single inference.
 */
export function parseLogcatProcess(line) {
  const m = String(line ?? '').match(PROCESS_RE);
  if (!m) return { pid: null, tid: null };
  return { pid: Number(m[1]), tid: Number(m[2]) };
}

// --- marker parsing ---------------------------------------------------------

const PHASE_RE = new RegExp(
  String.raw`\[embedder-lifecycle\]\s+(wrapper|request|session|inference|disposal):(start|settled)`
  + String.raw`\s+req=(\d+)\s+ok=(\d+)\s+created=(\d+)\s+disposed=(\d+)`,
);
const COMPLETION_RE = new RegExp(
  String.raw`\[embedder-lifecycle\]\s+request=(\d+)\s+ok=(\d+)\s+totalMs=(-?\d+(?:\.\d+)?)`,
);

/**
 * Extract every lifecycle marker with a resolvable UTC timestamp.
 *
 * Markers whose timestamp cannot be resolved are NOT silently dropped into the
 * evidence set — they are returned under `undated` so the caller reports them.
 * A marker that cannot be placed in time cannot support a temporal claim.
 *
 * @returns {{ markers: object[], undated: object[], malformed: object[] }}
 */
export function parseLifecycleMarkers(logText, opts = {}) {
  const markers = [];
  const undated = [];
  const malformed = [];
  const lines = String(logText ?? '').split(/\r?\n/);

  lines.forEach((raw, i) => {
    if (!raw.includes(LIFECYCLE_TAG)) return;
    const lineNo = i + 1;
    const ts = parseLogcatTimestamp(raw, opts);

    const phase = raw.match(PHASE_RE);
    const completion = raw.match(COMPLETION_RE);
    let marker = null;

    if (phase) {
      marker = {
        kind: 'phase',
        phase: phase[1],
        stage: phase[2],
        requestId: Number(phase[3]),
        ok: Number(phase[4]) === 1,
        created: Number(phase[5]),
        disposed: Number(phase[6]),
        totalMs: null,
      };
    } else if (completion) {
      marker = {
        kind: 'completion',
        phase: 'request',
        stage: 'completion',
        requestId: Number(completion[1]),
        ok: Number(completion[2]) === 1,
        created: null,
        disposed: null,
        totalMs: Number(completion[3]),
      };
    } else {
      malformed.push({ lineNo, raw, reason: 'lifecycle tag present but marker grammar unrecognised' });
      return;
    }

    const { pid, tid } = parseLogcatProcess(raw);
    const record = { ...marker, lineNo, raw, tsMs: ts.tsMs, tsFormat: ts.format, pid, tid };
    if (ts.ok) markers.push(record);
    else undated.push({ ...record, reason: ts.reason });
  });

  // Stamp a wrapper epoch per process. Every `wrapper:settled` marker announces
  // a FRESH wrapper whose request counter restarts at 1, so markers before and
  // after it must never be pooled even within one process.
  const epochByPid = new Map();
  for (const m of markers) {
    const key = String(m.pid);
    if (m.phase === 'wrapper') epochByPid.set(key, (epochByPid.get(key) ?? 0) + 1);
    m.wrapperEpoch = epochByPid.get(key) ?? 0;
  }

  return { markers, undated, malformed };
}

/**
 * Session-wide disposal integrity, independent of which requests qualified.
 *
 * `disposedTotal` increments even when disposal THROWS (see
 * createLazySingleFlightEmbedder's catch block), so counter equality alone can
 * never prove nothing leaked. The only honest signal is an explicit
 * `disposal:settled ... ok=0`. A failed disposal is a leaked native session and
 * must be visible even when the failing request is itself rejected and a later
 * request succeeds cleanly.
 */
export function summarizeDisposalIntegrity(markers) {
  const failures = markers
    .filter((m) => m.phase === 'disposal' && m.stage === 'settled' && m.ok === false)
    .map((m) => ({
      pid: m.pid, wrapperEpoch: m.wrapperEpoch, requestId: m.requestId,
      tsMs: m.tsMs, created: m.created, disposed: m.disposed, raw: m.raw,
    }));
  const settled = markers.filter((m) => m.phase === 'disposal' && m.stage === 'settled');
  const sessions = markers.filter((m) => m.phase === 'session' && m.stage === 'settled');
  const finalCreated = sessions.length ? Math.max(...sessions.map((m) => m.created)) : 0;
  const finalDisposed = settled.length ? Math.max(...settled.map((m) => m.disposed)) : 0;
  return {
    disposalFailureCount: failures.length,
    failures,
    finalCreated,
    finalDisposed,
    countersBalanced: finalCreated === finalDisposed,
    clean: failures.length === 0 && finalCreated === finalDisposed,
    note: 'disposedTotal increments even on a THROWN disposal, so countersBalanced '
      + 'alone does not prove absence of a leak; disposalFailureCount is decisive.',
  };
}

// --- sampling cadence and continuity ---------------------------------------

const percentileNearestRank = (sortedAsc, p) => {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil(p * sortedAsc.length);
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))];
};

/**
 * Achieved sampling cadence derived from ACTUAL sample timestamps — never from
 * the requested interval. `dumpsys meminfo` on a loaded device routinely takes
 * far longer than the requested period, so the requested interval is reported
 * alongside as an intent, not a measurement.
 */
export function computeCadence(sampleTimesMs, { requestedIntervalMs = null } = {}) {
  const times = [...sampleTimesMs].filter(Number.isFinite).sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < times.length; i += 1) intervals.push(times[i] - times[i - 1]);
  const sorted = [...intervals].sort((a, b) => a - b);
  const spanMs = times.length > 1 ? times[times.length - 1] - times[0] : 0;

  let medianMs = null;
  if (sorted.length > 0) {
    const mid = Math.floor(sorted.length / 2);
    medianMs = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return {
    sampleCount: times.length,
    requestedIntervalMs,
    intervalCount: intervals.length,
    minIntervalMs: sorted.length ? sorted[0] : null,
    medianIntervalMs: medianMs,
    p95IntervalMs: percentileNearestRank(sorted, 0.95),
    maxIntervalMs: sorted.length ? sorted[sorted.length - 1] : null,
    meanIntervalMs: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null,
    spanMs,
    effectiveSamplesPerSecond: spanMs > 0 ? (times.length - 1) / (spanMs / 1000) : null,
  };
}

/**
 * Continuity threshold: the largest inter-sample gap still counted as
 * uninterrupted coverage. Derived from the ACHIEVED median interval so a slow
 * device widens it honestly rather than failing on its own jitter, with a floor
 * so a pathologically fast burst cannot shrink it to nothing.
 */
export const CONTINUITY_MULTIPLE = 3;
export const CONTINUITY_FLOOR_MS = 2_000;
export function defaultContinuityGapMs(cadence) {
  const median = Number.isFinite(cadence?.medianIntervalMs) ? cadence.medianIntervalMs : 0;
  return Math.max(CONTINUITY_FLOOR_MS, Math.round(CONTINUITY_MULTIPLE * median));
}

/**
 * Split sample timestamps into CONTINUOUS segments. A gap larger than
 * `continuityGapMs` ends a segment: the probe demonstrably was not watching
 * across it, so nothing inside that gap is evidence of anything.
 *
 * This replaces `first sample .. last sample`, under which a marker sitting in
 * a multi-hour unsampled hole passed the window test.
 */
export function computeSamplingSegments(sampleTimesMs, { continuityGapMs }) {
  if (!Number.isFinite(continuityGapMs)) {
    throw new Error('computeSamplingSegments requires an explicit continuityGapMs');
  }
  const times = [...sampleTimesMs].filter(Number.isFinite).sort((a, b) => a - b);
  const segments = [];
  for (const t of times) {
    const current = segments[segments.length - 1];
    if (current && t - current.endMs <= continuityGapMs) {
      current.endMs = t;
      current.sampleCount += 1;
    } else {
      segments.push({ index: segments.length, startMs: t, endMs: t, sampleCount: 1 });
    }
  }
  return segments.map((s) => ({ ...s, spanMs: s.endMs - s.startMs, continuityGapMs }));
}

/** Index of the continuous segment containing `tsMs`, or -1. Inclusive bounds:
 *  a marker at the exact instant of a sample is covered by that sample. */
export function segmentIndexFor(segments, tsMs) {
  if (!Number.isFinite(tsMs)) return -1;
  for (const s of segments) {
    if (tsMs >= s.startMs && tsMs <= s.endMs) return s.index;
  }
  return -1;
}

// --- request correlation ----------------------------------------------------

const keyOf = (phase, stage) => `${phase}:${stage}`;

/**
 * Decide which request ids are proven production-path inferences.
 *
 * A request qualifies ONLY when every one of these holds for that ONE id:
 *   1. session:start and session:settled, both ok=1;
 *   2. inference:start and inference:settled, both ok=1;
 *   3. disposal:start and disposal:settled, both ok=1;
 *   4. the request completion line with ok=1;
 *   5. cumulative counters prove THIS request's session was created and that
 *      same session index was disposed:
 *        session:settled.created  === session:start.created  + 1
 *        disposal:settled.disposed === disposal:start.disposed + 1
 *        disposal:settled.disposed === session:settled.created
 *   6. the markers are non-decreasing in time AND all seven fall inside ONE
 *      continuous sampling segment.
 *
 * There is no slack term. Clock alignment is a capture-time responsibility
 * (`logcat -v epoch`), not something to paper over with +/-120 s here.
 */
export function correlateRequests({ markers, segments }) {
  // Identity is (process, wrapper instance, request id) — NOT request id alone.
  const byRequest = new Map();
  for (const m of markers) {
    const key = `${m.pid}|${m.wrapperEpoch ?? 0}|${m.requestId}`;
    if (!byRequest.has(key)) byRequest.set(key, []);
    byRequest.get(key).push(m);
  }

  const qualified = [];
  const rejected = [];

  // --- per-(pid, epoch) session ledger -------------------------------------
  // Hermes R4-2: a stitch whose two halves carry IDENTICAL created snapshots is
  // byte-for-byte indistinguishable from one genuine lifecycle, so no
  // per-group comparison can catch it. It IS catchable at the epoch level:
  // `created` counts sessions actually constructed, so within one wrapper
  // instance it can never exceed the number of session:settled events the
  // capture witnessed. When it does, sessions were created that this capture
  // never saw — the markers belong to an instance the capture does not cover,
  // or the capture is incomplete. Either way the evidence is not trustworthy.
  // Verified against every real device run: maxCreated === sessionSettled
  // exactly (11/11, 10/10, 11/11).
  const epochLedger = new Map();
  for (const m of markers) {
    if (!Number.isFinite(m.pid)) continue;
    const k = `${m.pid}|${m.wrapperEpoch ?? 0}`;
    if (!epochLedger.has(k)) epochLedger.set(k, { sessionSettled: 0, maxCreated: 0 });
    const e = epochLedger.get(k);
    if (m.phase === 'session' && m.stage === 'settled') e.sessionSettled += 1;
    if (Number.isFinite(m.created)) e.maxCreated = Math.max(e.maxCreated, m.created);
  }

  const keys = [...byRequest.keys()].sort((a, b) => {
    const [ap, ae, ar] = a.split('|').map(Number);
    const [bp, be, br] = b.split('|').map(Number);
    return ap - bp || ae - be || ar - br;
  });

  for (const key of keys) {
    const group = byRequest.get(key);
    const [pidStr, epochStr] = key.split('|');
    const pid = Number(pidStr);
    const wrapperEpoch = Number(epochStr);
    const requestId = group[0].requestId;
    const reasons = [];

    if (requestId === WRAPPER_REQUEST_ID) {
      rejected.push({
        requestId, pid, wrapperEpoch,
        reasons: ['wrapper bookkeeping event (req=0, created=0) is not evidence of an inference'],
        markerCount: group.length,
      });
      continue;
    }

    // A marker with no process id cannot be attributed to a wrapper instance
    // either, so EVERY unattributed marker in the log pools into a single
    // pseudo-group keyed on `null`. That pool is not a lifecycle. Capture
    // logcat with the pid/tid columns or this evidence is unusable.
    if (!Number.isFinite(pid)) {
      rejected.push({
        requestId,
        pid: null,
        wrapperEpoch,
        reasons: ['markers carry no process id: logcat was captured without the pid/tid '
          + 'columns, so these markers cannot be attributed to one process'],
        markerCount: group.length,
      });
      continue;
    }

    // wrapperEpoch 0 means NO `wrapper:settled` marker for this process was seen
    // BEFORE these markers. Request ids restart at 1 for every wrapper, so
    // without that anchor every wrapper instance in the process pools at epoch
    // 0, and complementary halves of two different lifecycles can be assembled
    // into one apparently-complete request. Fail closed: an unanchored
    // lifecycle is not evidence, however complete it looks. In practice this
    // means the capture began mid-run and the wrapper line was lost from the
    // ring buffer — recapture from process start.
    if (wrapperEpoch === 0) {
      rejected.push({
        requestId,
        pid,
        wrapperEpoch,
        reasons: ['no wrapper:settled marker precedes these markers (wrapperEpoch 0), so they '
          + 'cannot be anchored to a single wrapper instance; request ids restart per wrapper'],
        markerCount: group.length,
      });
      continue;
    }

    // Only real lifecycle phases may satisfy the contract; a `wrapper` marker
    // carrying a non-zero id would still not be a session/inference/disposal.
    //
    // EXACTLY ONE of each required marker is required. The previous
    // first-occurrence-wins index silently merged a replayed, concatenated or
    // doubly-captured log into one apparently-clean request. Even a
    // byte-identical duplicate is rejected: the correlator cannot distinguish a
    // re-delivered line from a second real lifecycle, and guessing is exactly
    // the failure mode this module exists to prevent.
    const index = new Map();
    const occurrences = new Map();
    for (const m of group) {
      let k = null;
      if (m.kind === 'completion') k = 'request:completion';
      else if (m.phase !== 'wrapper') k = keyOf(m.phase, m.stage);
      if (k === null) continue;
      occurrences.set(k, (occurrences.get(k) ?? 0) + 1);
      if (!index.has(k)) index.set(k, m);
    }
    const duplicated = [...occurrences.entries()].filter(([, n]) => n > 1);
    if (duplicated.length > 0) {
      rejected.push({
        requestId,
        pid,
        wrapperEpoch,
        reasons: [`duplicate markers under one request identity (${duplicated
          .map(([k, n]) => `${k} x${n}`).join(', ')}): two lifecycles cannot be told `
          + 'apart, so neither is evidence'],
        markerCount: group.length,
      });
      continue;
    }

    for (const [phase, stage] of REQUIRED_PHASE_MARKERS) {
      const m = index.get(keyOf(phase, stage));
      if (!m) reasons.push(`missing ${phase}:${stage}`);
      else if (!m.ok) reasons.push(`${phase}:${stage} reported ok=0`);
    }
    const completion = index.get('request:completion');
    if (!completion) reasons.push('missing request completion line');
    else if (!completion.ok) reasons.push('request completion reported ok=0');

    const sessionStart = index.get('session:start');
    const sessionSettled = index.get('session:settled');
    const disposalStart = index.get('disposal:start');
    const disposalSettled = index.get('disposal:settled');

    if (sessionStart && sessionSettled) {
      if (sessionSettled.created !== sessionStart.created + 1) {
        reasons.push(
          `created counter did not advance by exactly 1 across session settle `
          + `(${sessionStart.created} -> ${sessionSettled.created})`,
        );
      }
    }
    if (disposalStart && disposalSettled) {
      if (disposalSettled.disposed !== disposalStart.disposed + 1) {
        reasons.push(
          `disposed counter did not advance by exactly 1 across disposal settle `
          + `(${disposalStart.disposed} -> ${disposalSettled.disposed})`,
        );
      }
    }
    if (sessionSettled && disposalSettled) {
      if (disposalSettled.disposed !== sessionSettled.created) {
        reasons.push(
          `the session created for this request was not the one disposed `
          + `(created=${sessionSettled.created}, disposed=${disposalSettled.disposed})`,
        );
      }
    }

    // The `created` counter is a per-process monotonic total. Within ONE
    // continuous lifecycle no other session is created, so session:settled,
    // inference:*, and disposal:* must all carry the SAME `created` snapshot.
    // A disagreement means the markers came from different wrapper instances
    // that happened to share a (pid, epoch, requestId) key — the residual
    // stitch Hermes found when a second wrapper line is lost from the ring
    // buffer. `disposed === created` can still hold by coincidence, so this is
    // the decisive cross-check, not that one.
    const createdSnapshots = [sessionSettled, index.get(keyOf('inference', 'start')),
      index.get(keyOf('inference', 'settled')), disposalStart, disposalSettled]
      .filter(Boolean)
      .map((m) => m.created);
    const distinctCreated = [...new Set(createdSnapshots)];
    if (distinctCreated.length > 1) {
      reasons.push(
        `markers disagree about the process-wide created count `
        + `(${distinctCreated.join(', ')}) — they cannot belong to one continuous `
        + 'lifecycle and were assembled from different wrapper instances',
      );
    }

    // Epoch-level ledger (Hermes R4-2). Catches the stitch whose halves agree
    // on their snapshots, because the capture never witnessed enough session
    // creations to justify the counter value those markers carry.
    const ledger = epochLedger.get(`${pid}|${wrapperEpoch}`);
    if (ledger && ledger.maxCreated > ledger.sessionSettled) {
      reasons.push(
        `the created counter reaches ${ledger.maxCreated} in this wrapper instance but only `
        + `${ledger.sessionSettled} session creation(s) were captured — `
        + `${ledger.maxCreated - ledger.sessionSettled} session(s) were created that this `
        + 'capture never saw, so these markers cannot be attributed to a lifecycle it covers',
      );
    }

    const ordered = [
      ...REQUIRED_PHASE_MARKERS.map(([p, s]) => index.get(keyOf(p, s))),
      completion,
    ];
    if (ordered.every(Boolean)) {
      for (let i = 1; i < ordered.length; i += 1) {
        if (ordered[i].tsMs < ordered[i - 1].tsMs) {
          reasons.push(
            `markers out of order: ${ordered[i - 1].phase}:${ordered[i - 1].stage} `
            + `after ${ordered[i].phase}:${ordered[i].stage}`,
          );
          break;
        }
      }
      const segIdx = ordered.map((m) => segmentIndexFor(segments, m.tsMs));
      const outside = segIdx.filter((v) => v === -1).length;
      if (outside > 0) {
        reasons.push(`${outside} of ${segIdx.length} markers fall outside every continuous sampling segment`);
      } else if (new Set(segIdx).size !== 1) {
        reasons.push(`markers span ${new Set(segIdx).size} different sampling segments`);
      }
    }

    // Defensive: every marker in a group must share the process identity the
    // key was built from.
    if (group.some((m) => m.pid !== pid || (m.wrapperEpoch ?? 0) !== wrapperEpoch)) {
      reasons.push('markers in this group disagree about process/wrapper identity');
    }

    if (reasons.length > 0) {
      rejected.push({ requestId, pid, wrapperEpoch, reasons, markerCount: group.length });
      continue;
    }

    qualified.push({
      requestId,
      pid,
      wrapperEpoch,
      segmentIndex: segmentIndexFor(segments, sessionStart.tsMs),
      startMs: sessionStart.tsMs,
      endMs: completion.tsMs,
      totalMs: completion.totalMs,
      createdIndex: sessionSettled.created,
      disposedIndex: disposalSettled.disposed,
      markerTimestamps: Object.fromEntries(
        [...REQUIRED_PHASE_MARKERS.map(([p, s]) => [keyOf(p, s), index.get(keyOf(p, s)).tsMs]),
          ['request:completion', completion.tsMs]],
      ),
    });
  }

  return { qualified, rejected, disposalIntegrity: summarizeDisposalIntegrity(markers) };
}

// --- memory summarisation ---------------------------------------------------

/**
 * Attribute sampled Private Dirty to correlated requests and runs.
 *
 * Naming is deliberate: `maxSampledPrivateDirtyBytes` — the maximum a discrete
 * probe HAPPENED to observe. Calling it a peak would assert the probe outran
 * the allocation, which a ~1 Hz `dumpsys` loop cannot support. `peakClaimable`
 * is surfaced separately so a caller can only claim a true transient peak when
 * cadence genuinely supports it.
 *
 * @param {{ samples: {atUtcMs:number, privateDirtyBytes:number|null}[],
 *           segments: object[], qualified: object[],
 *           peakClaimIntervalMs?: number }} args
 */
export const PEAK_CLAIM_INTERVAL_MS = 100;
/** A transient peak claim additionally requires this many samples inside EVERY
 *  correlated request window. A fast median means nothing if the probe happened
 *  to be looking away exactly while the allocation occurred. */
export const MIN_SAMPLES_IN_REQUEST_WINDOW = 2;

export function summarizeMemory({ samples, segments, qualified, cadence, peakClaimIntervalMs = PEAK_CLAIM_INTERVAL_MS }) {
  const usable = [...samples]
    .filter((s) => Number.isFinite(s.atUtcMs) && Number.isFinite(s.privateDirtyBytes))
    .sort((a, b) => a.atUtcMs - b.atUtcMs);

  const maxSampled = usable.length ? Math.max(...usable.map((s) => s.privateDirtyBytes)) : null;

  const perRequest = qualified.map((q) => {
    const inSegment = usable.filter((s) => segmentIndexFor(segments, s.atUtcMs) === q.segmentIndex);
    const before = inSegment.filter((s) => s.atUtcMs <= q.startMs);
    const inside = inSegment.filter((s) => s.atUtcMs >= q.startMs && s.atUtcMs <= q.endMs);
    const baseline = before.length ? before[before.length - 1].privateDirtyBytes : null;
    const maxInside = inside.length ? Math.max(...inside.map((s) => s.privateDirtyBytes)) : null;
    // Largest observation hole spanning the request, including the reach from
    // the last sample before it and to the first sample after it.
    const edges = [q.startMs, ...inside.map((s) => s.atUtcMs), q.endMs];
    let windowMaxGapMs = 0;
    for (let i = 1; i < edges.length; i += 1) {
      windowMaxGapMs = Math.max(windowMaxGapMs, edges[i] - edges[i - 1]);
    }
    return {
      windowMaxGapMs,
      requestId: q.requestId,
      segmentIndex: q.segmentIndex,
      startMs: q.startMs,
      endMs: q.endMs,
      totalMs: q.totalMs,
      samplesInsideRequest: inside.length,
      preRequestBaselineBytes: baseline,
      maxSampledInsideRequestBytes: maxInside,
      incrementBytes: baseline !== null && maxInside !== null ? maxInside - baseline : null,
      note: inside.length === 0
        ? 'no sample landed inside this request window — increment not measurable'
        : null,
    };
  });

  const perRun = segments.map((seg) => {
    const inSeg = usable.filter((s) => s.atUtcMs >= seg.startMs && s.atUtcMs <= seg.endMs);
    const requestsHere = qualified.filter((q) => q.segmentIndex === seg.index).map((q) => q.requestId);
    const baseline = inSeg.length ? inSeg[0].privateDirtyBytes : null;
    const max = inSeg.length ? Math.max(...inSeg.map((s) => s.privateDirtyBytes)) : null;
    return {
      segmentIndex: seg.index,
      startMs: seg.startMs,
      endMs: seg.endMs,
      spanMs: seg.spanMs,
      sampleCount: seg.sampleCount,
      correlatedRequestIds: requestsHere,
      baselineBytes: baseline,
      maxSampledBytes: max,
      incrementBytes: baseline !== null && max !== null ? max - baseline : null,
    };
  });

  // A peak may be claimed ONLY when the probe demonstrably watched THROUGH every
  // correlated request. Median cadence alone is not sufficient: a 50 ms median
  // with a 1.35 s hole across the inference is still blind exactly where it
  // matters. All four conditions must hold.
  const medianInterval = cadence?.medianIntervalMs;
  const p95Interval = cadence?.p95IntervalMs;
  const cadenceFastEnough = Number.isFinite(medianInterval) && medianInterval <= peakClaimIntervalMs
    && Number.isFinite(p95Interval) && p95Interval <= peakClaimIntervalMs;
  const everyRequestObserved = perRequest.length > 0 && perRequest.every(
    (r) => r.samplesInsideRequest >= MIN_SAMPLES_IN_REQUEST_WINDOW
      && r.windowMaxGapMs <= peakClaimIntervalMs,
  );
  const peakClaimable = cadenceFastEnough && everyRequestObserved;
  const peakClaimBlockers = [];
  if (!Number.isFinite(medianInterval)) peakClaimBlockers.push('no cadence available');
  else if (medianInterval > peakClaimIntervalMs) peakClaimBlockers.push(`median interval ${medianInterval} ms > ${peakClaimIntervalMs} ms`);
  if (Number.isFinite(p95Interval) && p95Interval > peakClaimIntervalMs) peakClaimBlockers.push(`p95 interval ${p95Interval} ms > ${peakClaimIntervalMs} ms`);
  if (perRequest.length === 0) peakClaimBlockers.push('no correlated request to observe');
  for (const r of perRequest) {
    if (r.samplesInsideRequest < MIN_SAMPLES_IN_REQUEST_WINDOW) {
      peakClaimBlockers.push(`request ${r.requestId} had ${r.samplesInsideRequest} sample(s) inside its window`);
    } else if (r.windowMaxGapMs > peakClaimIntervalMs) {
      peakClaimBlockers.push(`request ${r.requestId} has a ${r.windowMaxGapMs} ms observation hole`);
    }
  }

  return {
    usableSampleCount: usable.length,
    maxSampledPrivateDirtyBytes: maxSampled,
    perRequest,
    perRun,
    peakClaimable,
    peakClaimIntervalMs,
    peakClaimBlockers,
    minSamplesInRequestWindow: MIN_SAMPLES_IN_REQUEST_WINDOW,
    metricLabel: peakClaimable
      ? 'peak Private Dirty (cadence supports a transient-peak claim)'
      : 'maximum sampled Private Dirty (NOT a proven transient peak — sampling cadence is too coarse)',
  };
}
