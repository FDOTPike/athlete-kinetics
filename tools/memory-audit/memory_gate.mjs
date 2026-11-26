/**
 * memory_gate.mjs — PURE, testable static memory-gate logic (WO section 10,
 * implementing the owner-ratified decision of 2026-08-23:
 *   "1 — Retain 100 MB, fix the gate honestly (Recommended)").
 *
 * WHAT THE OWNER RATIFIED, VERBATIM IN EFFECT:
 *   - `embedderTransientBytes` STAYS 104,857,600. It is NOT reduced.
 *   - The physical ceiling STAYS exactly 450,000,000 decimal bytes.
 *   - The gate is redesigned so it stops conflating a conservative COMPONENT
 *     ENVELOPE with MEASURED PHYSICAL EVIDENCE — without downgrading the
 *     failing contract into an advisory warning.
 *
 * THE DISTINCTION THIS MODULE EXISTS TO ENFORCE
 *
 *   Envelope E — a sum of conservative, UNMEASURED worst-case allowances,
 *     authored in MiB. E is a design budget. It is not, and has never been, a
 *     measurement of anything.
 *
 *   Measured M — the maximum SAMPLED process Private Dirty from an authorized
 *     physical-device evidence packet. Because a `dumpsys meminfo` probe costs
 *     ~0.8-1.6 s per capture and a semantic inference lasts ~150 ms, M is a
 *     LOWER BOUND on the true transient peak, never the peak itself, unless the
 *     packet's own cadence analysis says otherwise (`peakClaimable`).
 *
 * Conflating the two is what allowed "450 MiB of allowances" to be reported as
 * though it were a measured 450 MB footprint. E and M are now computed, named,
 * and reported separately, and no evidence check can ever satisfy the envelope
 * contract on the envelope's behalf.
 *
 * Every check FAILS CLOSED. A missing input is a failure, never a skip.
 */

export const MiB = 1024 ** 2;

/**
 * THE RATIFIED PRODUCT CONTRACT — owner decision, 2026-08-24, verbatim:
 *
 *   "I ratify 536,870,912 bytes (512 MiB) as the hard mobile memory ceiling for
 *    all supported Android and iOS devices. The preferred operating target
 *    remains 450,000,000 bytes. Results between those values require physical-
 *    device evidence and explicit review; exceeding 536,870,912 bytes blocks
 *    release. No higher allowance applies to better-equipped devices."
 *
 * This supersedes the single 450,000,000-byte ceiling settled 2026-08-22. It is
 * a RATIFICATION of the ceiling, not a change to any component estimate: the
 * floors in RATIFIED_FLOORS are untouched and [E] still blocks lowering an
 * estimate to manufacture headroom.
 *
 * Three bands, not two:
 *   envelope <= target                  -> clean pass
 *   target   <  envelope <= ceiling     -> pass ONLY with physical-device
 *                                          evidence AND an explicit review
 *                                          record naming this exact envelope
 *   envelope >  ceiling                 -> blocked, no paperwork can rescue it
 */
export const RATIFIED_CEILING_BYTES = 536_870_912; // 512 MiB, hard, blocks release
export const PREFERRED_TARGET_BYTES = 450_000_000; // decimal MB, operating target

/** The superseded ceiling's MiB misreading. Retained because the historical
 *  falsifiers pass 450,000,000 explicitly and must keep working. */
export const CEILING_MIB_READING_BYTES = 450 * MiB; // 471,859,200

/**
 * The OTHER plausible reading of the same ceiling, derived rather than
 * hardcoded so [B] stays meaningful whenever the owner ratifies a new figure.
 *
 * A ceiling that is a whole number of MiB was written in MiB, so its
 * misreading is the same count of decimal MB (512 MiB -> 512 MB). Any other
 * ceiling was written in decimal MB, so its misreading is the same count of
 * MiB (450 MB -> 450 MiB). In both directions the alternate reading is the one
 * a careless reader would substitute.
 */
export function alternateUnitReadingBytes(ceiling) {
  if (Number.isInteger(ceiling / MiB)) return (ceiling / MiB) * 1e6;
  return (ceiling / 1e6) * MiB;
}

/** Ratified component floors. An estimate may be raised (more conservative) but
 *  never lowered — lowering an estimate to turn the gate green is precisely the
 *  move this floor set exists to make impossible. */
export const RATIFIED_FLOORS = Object.freeze({
  hermesAndUi: 314_572_800,
  sqliteLayer: 52_428_800,
  embedderTransientBytes: 104_857_600,
});

export const SAFETY_READER_ASSET = 'assets/safety_reader.onnx';
export const SAFETY_READER_SIZE = 22881187;
export const SAFETY_READER_SHA256 =
  'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf';
export const SAFETY_READER_MANIFEST_PIN = Object.freeze({
  id: 'm10-r15-reader-seed3',
  policyId: 'r15/denial-floor',
  releaseTag: 'ml-reader-m10-r15-s3',
  releaseCommit: 'b6ceee70c7b7a9afd793968e8ca15ba17704b572',
  assetId: 775095775,
  assetPath: SAFETY_READER_ASSET,
  sha256: SAFETY_READER_SHA256,
  sizeBytes: SAFETY_READER_SIZE,
});

/**
 * Validate that a candidate_manifest.json object pins the ratified safety-reader
 * model (supporting both the 8-field APK `safetyReader` object and flattened
 * `safetyReaderPresent` + `safetyReaderModelSha256` representations).
 */
export function checkCandidateManifestSafetyReader(candidateManifest) {
  if (candidateManifest === null || typeof candidateManifest !== 'object' || Array.isArray(candidateManifest)) {
    return ['candidate_manifest.json is missing or not an object'];
  }
  const problems = [];
  if (Object.hasOwn(candidateManifest, 'safetyReader')) {
    const sr = candidateManifest.safetyReader;
    if (sr === null || typeof sr !== 'object' || Array.isArray(sr)) {
      problems.push('candidate_manifest.json safetyReader is not an object');
    } else {
      const expectedKeys = Object.keys(SAFETY_READER_MANIFEST_PIN);
      for (const key of Object.keys(sr)) {
        if (!expectedKeys.includes(key)) {
          problems.push(`candidate_manifest.json safetyReader has unexpected key ${key}`);
        }
      }
      for (const key of expectedKeys) {
        if (!Object.hasOwn(sr, key)) {
          problems.push(`candidate_manifest.json safetyReader missing ${key}`);
        } else if (sr[key] !== SAFETY_READER_MANIFEST_PIN[key]) {
          problems.push(`candidate_manifest.json safetyReader.${key}=${JSON.stringify(sr[key])} `
            + `does not match ratified ${JSON.stringify(SAFETY_READER_MANIFEST_PIN[key])}`);
        }
      }
    }
    if (Object.hasOwn(candidateManifest, 'safetyReaderPresent') && candidateManifest.safetyReaderPresent !== true) {
      problems.push('candidate_manifest.json safetyReaderPresent must be true');
    }
    if (Object.hasOwn(candidateManifest, 'safetyReaderModelSha256')
        && candidateManifest.safetyReaderModelSha256 !== SAFETY_READER_SHA256) {
      problems.push('candidate_manifest.json safetyReaderModelSha256 does not match ratified safetyReader SHA-256');
    }
    return problems;
  }
  if (candidateManifest.safetyReaderPresent === true) {
    if (candidateManifest.safetyReaderModelSha256 !== SAFETY_READER_SHA256) {
      problems.push('candidate_manifest.json declares safetyReaderPresent:true without ratified safetyReaderModelSha256');
    }
    if (Object.hasOwn(candidateManifest, 'safetyReaderModelSizeBytes')
        && candidateManifest.safetyReaderModelSizeBytes !== SAFETY_READER_SIZE) {
      problems.push('candidate_manifest.json safetyReaderModelSizeBytes does not match ratified safetyReader size');
    }
    return problems;
  }
  problems.push('candidate_manifest.json omits ratified safetyReader metadata');
  return problems;
}

/**
 * Envelope arithmetic. Pure: no filesystem, no environment.
 * @param {{runtimeDirtyBytes:{hermesAndUi:number,sqliteLayer:number}, embedderTransientBytes:number}} budget
 * @param {{count:number, dim:number}} vectors
 */
export function computeEnvelope(budget, vectors) {
  const hermesAndUi = budget?.runtimeDirtyBytes?.hermesAndUi;
  const sqliteLayer = budget?.runtimeDirtyBytes?.sqliteLayer;
  const embedderTransientBytes = budget?.embedderTransientBytes;
  const matrixBytes = Number(vectors?.count) * Number(vectors?.dim) * 4;
  const steadyBytes = hermesAndUi + sqliteLayer + matrixBytes;
  const envelopeBytes = steadyBytes + embedderTransientBytes;
  return {
    hermesAndUi,
    sqliteLayer,
    matrixBytes,
    steadyBytes,
    embedderTransientBytes,
    envelopeBytes,
    wellFormed: [hermesAndUi, sqliteLayer, matrixBytes, embedderTransientBytes]
      .every((v) => Number.isFinite(v) && v >= 0),
  };
}

/**
 * [A] THE CONTRACT. Envelope against the ratified three-band scale.
 *
 * A hard check; a failure here is never advisory.
 *
 * The review band is the delicate part. "Requires explicit review" is worthless
 * as a checkbox the gate ticks for itself, so the review must be a RECORD that
 * names the exact envelope it approved. If the envelope moves by a single byte
 * the approval no longer describes reality and the band fails closed. The
 * record must also agree with the ceiling and target compiled into this module,
 * so neither the code nor the paperwork can drift alone.
 *
 * @param {object} env computeEnvelope() result
 * @param {number|{ceiling?:number,target?:number,review?:object|null,evidenceOk?:boolean}} opts
 *        A bare number is the legacy ceiling-only form, retained so the
 *        historical falsifiers keep exercising the original arithmetic.
 */
export function checkEnvelopeWithinCeiling(env, opts = {}) {
  const {
    ceiling = RATIFIED_CEILING_BYTES,
    target = PREFERRED_TARGET_BYTES,
    review = null,
    evidenceOk = false,
  } = typeof opts === 'number' ? { ceiling: opts, target: opts } : opts;

  if (!env.wellFormed) {
    return {
      id: 'A', ok: false, band: null, reason: 'envelope inputs are missing or malformed',
      overByBytes: null,
    };
  }

  const overByBytes = env.envelopeBytes - ceiling;
  const base = {
    id: 'A',
    ceilingBytes: ceiling,
    targetBytes: target,
    envelopeBytes: env.envelopeBytes,
    overByBytes,
    overTargetByBytes: env.envelopeBytes - target,
  };

  if (overByBytes > 0) {
    return {
      ...base,
      ok: false,
      band: 'OVER_CEILING',
      reason: `component envelope exceeds the ratified HARD ceiling by `
        + `${overByBytes.toLocaleString('en-US')} B — this blocks release and no review `
        + 'or device evidence can rescue it',
    };
  }

  if (env.envelopeBytes <= target) {
    return { ...base, ok: true, band: 'WITHIN_TARGET', reason: null };
  }

  // --- review band -----------------------------------------------------
  const problems = [];
  if (!review || typeof review !== 'object') {
    problems.push('no explicit review record (budget.ceilingRatification) covering this band');
  } else {
    if (review.hardCeilingBytes !== ceiling) {
      problems.push(`review record names ceiling ${review.hardCeilingBytes} but the gate `
        + `enforces ${ceiling} — code and ratification disagree`);
    }
    if (review.preferredTargetBytes !== target) {
      problems.push(`review record names target ${review.preferredTargetBytes} but the gate `
        + `enforces ${target}`);
    }
    const reviewed = review.reviewBandApproval?.reviewedEnvelopeBytes;
    if (!Number.isFinite(reviewed)) {
      problems.push('review record approves no specific envelope value');
    } else if (reviewed !== env.envelopeBytes) {
      problems.push(`the review approved an envelope of ${reviewed.toLocaleString('en-US')} B `
        + `but the envelope is now ${env.envelopeBytes.toLocaleString('en-US')} B — the review `
        + 'is STALE and must be re-taken');
    }
  }
  if (!evidenceOk) {
    problems.push('the ratification requires PHYSICAL-DEVICE evidence in this band and '
      + 'check [D] is not satisfied');
  }

  return {
    ...base,
    ok: problems.length === 0,
    band: 'REVIEW_BAND',
    reason: problems.join('; ') || null,
    note: problems.length === 0
      ? `envelope is ${(env.envelopeBytes - target).toLocaleString('en-US')} B above the `
        + 'preferred target and is permitted only because reviewed evidence supports it'
      : null,
  };
}

/**
 * [F] UNIFORM CEILING. "No higher allowance applies to better-equipped devices."
 *
 * Device tiers describe what a HANDSET can survive (lmkd / jetsam), which is
 * legitimately different per tier. What must never differ is the allowance this
 * product grants itself. A per-tier ceiling or cap override would let a
 * 6 GB-device path quietly claim more than the ratified figure, which is
 * exactly what the owner excluded.
 */
export function checkUniformCeiling(budget, ceiling = RATIFIED_CEILING_BYTES) {
  // Hermes advisory: the original list missed `hardCeilingBytes`, and — more
  // importantly — `maxDirtyBytes`, which is NOT decoration: audit.mjs check [1]
  // compares the envelope against each tier's maxDirtyBytes, so editing a tier
  // DOES move the exit code. Device limits are facts about handsets, so they
  // are pinned to their ratified values rather than merely pattern-matched.
  const OVERRIDE_KEYS = [
    'ceilingBytes', 'hardCeilingBytes', 'maxAppBytes', 'allowanceBytes',
    'capBytes', 'envelopeBytes', 'targetBytes', 'headroomBytes',
  ];
  const RATIFIED_TIER_LIMITS = Object.freeze({
    '3GB-android': 1_342_177_280,
    '4GB-iphone12-class': 2_199_912_448,
    '6GB-plus': 2_621_440_000,
  });
  const tiers = Array.isArray(budget?.deviceTiers) ? budget.deviceTiers : [];
  const offenders = [];
  for (const t of tiers) {
    for (const k of OVERRIDE_KEYS) {
      if (t && t[k] !== undefined) offenders.push(`${t.name ?? '(unnamed tier)'}.${k}=${t[k]}`);
    }
  }
  const topLevel = OVERRIDE_KEYS
    .filter((k) => budget?.[k] !== undefined && budget[k] !== ceiling)
    .map((k) => `budget.${k}=${budget[k]}`);
  // A raised device limit is a loosened gate, because [1] tests the envelope
  // against it. Pin every KNOWN tier to its ratified limit; unknown tier names
  // are reported rather than silently trusted.
  const drifted = [];
  for (const t of tiers) {
    const ratified = RATIFIED_TIER_LIMITS[t?.name];
    if (ratified === undefined) {
      drifted.push(`${t?.name ?? '(unnamed tier)'} is not a ratified tier name`);
    } else if (t.maxDirtyBytes !== ratified) {
      drifted.push(`${t.name}.maxDirtyBytes=${t.maxDirtyBytes} but the ratified device limit `
        + `is ${ratified}`);
    }
  }
  // Hermes R4-3: pinning the tiers that are PRESENT is not enough. audit.mjs
  // check [1] tests the envelope against each tier's limit, so DELETING the
  // tightest tier (3GB-android) silently removes the strictest headroom test
  // while leaving [F] green. Every ratified tier must be present.
  const present = new Set(tiers.map((t) => t?.name));
  const missing = Object.keys(RATIFIED_TIER_LIMITS).filter((n) => !present.has(n));
  if (missing.length > 0) {
    drifted.push(`ratified device tier(s) missing from the budget: ${missing.join(', ')} — `
      + 'removing a tier deletes its headroom check rather than satisfying it');
  }
  const all = [...offenders, ...topLevel, ...drifted];
  return {
    id: 'F',
    ok: all.length === 0,
    ceilingBytes: ceiling,
    tierCount: tiers.length,
    reason: all.length === 0 ? null
      : `per-tier memory allowance override(s) found: ${all.join(', ')} — the ratified `
        + `ceiling of ${ceiling.toLocaleString('en-US')} B applies to EVERY supported device; `
        + 'no higher allowance exists for better-equipped hardware',
  };
}

/** [B] UNIT INTEGRITY. The comparison is byte-exact against the DECIMAL ceiling,
 *  and re-reading the contract as 450 MiB must not rescue a failing envelope.
 *  Fails if someone swaps the interpretation to manufacture headroom. */
export function checkUnitIntegrity(env, ceiling = RATIFIED_CEILING_BYTES) {
  if (!env.wellFormed) {
    return { id: 'B', ok: false, reason: 'envelope inputs are missing or malformed' };
  }
  // The paired reading is derived from the ceiling IN FORCE, not hardcoded: a
  // ceiling of N decimal bytes states "N/1e6 MB", whose MiB misreading is
  // (N/1e6) x 1024^2. For the ratified 450,000,000 this is exactly
  // CEILING_MIB_READING_BYTES. Deriving it keeps the check meaningful if the
  // owner ever ratifies a different ceiling, instead of failing spuriously.
  const alternateReadingBytes = alternateUnitReadingBytes(ceiling);
  const decimalOk = env.envelopeBytes <= ceiling;
  const mibOk = env.envelopeBytes <= alternateReadingBytes;
  // The gate is honest only when the verdict does not depend on the reading.
  const readingsAgree = decimalOk === mibOk;
  return {
    id: 'B',
    ok: readingsAgree,
    decimalCeilingBytes: ceiling,
    mibReadingBytes: alternateReadingBytes,
    passesUnderDecimal: decimalOk,
    passesUnderMiB: mibOk,
    reason: readingsAgree ? null
      : 'the verdict depends on whether the ceiling is read as MB or MiB — the ratified '
        + 'reading is DECIMAL bytes; a pass that exists only under the MiB reading is not a pass',
  };
}

/** [C] COMPOSITION COMPLETENESS. Every declared component must be present in the
 *  envelope. Dropping the embedder term yields 367,078,400 B, which WOULD pass
 *  the ceiling — so silent omission has to be detectable. */
export function checkComposition(env) {
  const problems = [];
  if (!env.wellFormed) problems.push('envelope inputs are missing or malformed');
  if (!(env.embedderTransientBytes > 0)) {
    problems.push('embedder transient term is absent or zero');
  }
  if (env.envelopeBytes - env.steadyBytes !== env.embedderTransientBytes) {
    problems.push('envelope does not decompose into steady + embedder transient');
  }
  if (!(env.steadyBytes > 0)) problems.push('steady term is absent or zero');
  return {
    id: 'C',
    ok: problems.length === 0,
    steadyBytes: env.steadyBytes,
    embedderTransientBytes: env.embedderTransientBytes,
    envelopeBytes: env.envelopeBytes,
    reason: problems.join('; ') || null,
  };
}

/** [E] ANTI-REGRESSION FLOORS. Estimates may rise, never fall. */
export function checkEstimateFloors(budget, floors = RATIFIED_FLOORS) {
  const actual = {
    hermesAndUi: budget?.runtimeDirtyBytes?.hermesAndUi,
    sqliteLayer: budget?.runtimeDirtyBytes?.sqliteLayer,
    embedderTransientBytes: budget?.embedderTransientBytes,
  };
  const violations = [];
  for (const [key, floor] of Object.entries(floors)) {
    const v = actual[key];
    if (!Number.isFinite(v)) { violations.push(`${key} is missing`); continue; }
    if (v < floor) {
      violations.push(`${key} lowered to ${v.toLocaleString('en-US')} below the ratified floor ${floor.toLocaleString('en-US')}`);
    }
  }
  return { id: 'E', ok: violations.length === 0, actual, floors, reason: violations.join('; ') || null };
}

/**
 * [D] MEASURED PHYSICAL EVIDENCE — separate from, and SUBORDINATE to, [A].
 *
 * Passing D can never satisfy A. D exists to answer a different question: does a
 * real authorized-device packet exist, is it internally sound, and what did it
 * actually observe? Absent or unsound evidence is a FAILURE, not a skip — a
 * memory contract that reports itself satisfied with no physical evidence is
 * the original defect this whole remediation exists to close.
 *
 * @param {object|null} session parsed session.json from meminfo_harness finish
 */
export function checkMeasuredEvidence(session, ceiling = RATIFIED_CEILING_BYTES) {
  if (session === null || session === undefined) {
    return {
      id: 'D',
      ok: false,
      status: 'UNPROVEN',
      reason: 'no authorized-device evidence packet supplied (set AK_MEM_EVIDENCE_SESSION '
        + 'to a session.json produced by meminfo_harness finish)',
      maxSampledPrivateDirtyBytes: null,
    };
  }
  const s = session.summary;
  const problems = [];
  if (!s) problems.push('packet has no summary (harness finish did not complete)');
  const correlated = s?.lifecycle?.correlatedRequestCount;
  if (!Number.isFinite(correlated) || correlated < 1) {
    problems.push('packet proves no correlated production-path inference');
  }
  const disposal = s?.lifecycle?.disposalProof;
  if (!Array.isArray(disposal) || disposal.length === 0
    || !disposal.every((d) => d.createdSessionWasDisposed === true)) {
    problems.push('packet does not prove every created session was disposed');
  }
  // A disposal that THREW still incremented disposedTotal, and the failing
  // request is itself rejected, so it would otherwise vanish from the proof
  // entirely. Absence of the field is treated as absence of evidence.
  const integrity = s?.lifecycle?.disposalIntegrity;
  if (!integrity || typeof integrity.disposalFailureCount !== 'number') {
    problems.push('packet carries no session-wide disposal-integrity record');
  } else if (integrity.disposalFailureCount > 0) {
    problems.push(
      `${integrity.disposalFailureCount} disposal(s) FAILED in this session — at least one `
      + 'native session leaked (counters still balance; that is why they are not the test)',
    );
  }
  // Counters that do NOT balance are a leak even with zero explicit failures
  // (a session created and never disposed), and `clean` is the conjunction
  // the harness certifies. Neither may be absent or anything but true.
  if (integrity) {
    if (integrity.countersBalanced !== true) {
      problems.push('session-wide disposal counters do not balance (countersBalanced is not true)');
    }
    if (integrity.clean !== true) {
      problems.push('session-wide disposal integrity is not clean (clean is not true)');
    }
  }
  // Serial non-overlap: two live native sessions in one process at once make
  // per-request memory attribution meaningless. Absence is not zero.
  if (integrity?.sessionOverlapCount !== 0 || s?.lifecycle?.sessionOverlapCount !== 0) {
    problems.push(`packet does not prove serial sessions: disposalIntegrity.sessionOverlapCount=`
      + `${integrity?.sessionOverlapCount}, lifecycle.sessionOverlapCount=${s?.lifecycle?.sessionOverlapCount} `
      + '(both must be 0; overlapping sessions are not attributable)');
  }
  // Both production models must be proven by this packet.
  const counts = s?.lifecycle?.componentRequestCounts;
  if (!(counts?.embedder >= 1) || !(counts?.['safety-reader'] >= 1)) {
    problems.push(`packet does not prove both models: componentRequestCounts embedder=${counts?.embedder}, `
      + `safety-reader=${counts?.['safety-reader']} (each must be >= 1)`);
  }
  const median = s?.sampling?.achievedMedianIntervalMs;
  if (!Number.isFinite(median)) problems.push('packet reports no achieved sampling cadence');
  const max = s?.memory?.maxSampledPrivateDirtyBytes;
  if (!Number.isFinite(max)) problems.push('packet reports no sampled Private Dirty maximum');
  else if (max > ceiling) {
    problems.push(`measured maximum ${max.toLocaleString('en-US')} B exceeds the ceiling`);
  }

  // A packet that does not even NAME the raw bytes it came from is an
  // assertion, not evidence. Absence of the binding is a failure here as well
  // as in [G], so [D] alone can never be satisfied by a fabricated summary.
  if (!s?.evidenceBinding || s.evidenceBinding.schema !== 'ak.evidence-binding/1') {
    problems.push('packet carries no evidenceBinding: it asserts results without naming the '
      + 'raw logcat and meminfo dumps they were derived from (see [G])');
  }

  const candidateManifest = (s && Object.hasOwn(s, 'candidateManifest'))
    ? s.candidateManifest
    : (Object.hasOwn(session, 'candidateManifest') ? session.candidateManifest : undefined);
  if (candidateManifest !== undefined) {
    problems.push(...checkCandidateManifestSafetyReader(candidateManifest));
  }

  const peakClaimable = s?.memory?.peakClaimable === true;
  return {
    id: 'D',
    ok: problems.length === 0,
    disposalFailureCount: integrity?.disposalFailureCount ?? null,
    peakClaimBlockers: s?.memory?.peakClaimBlockers ?? null,
    status: problems.length === 0 ? (peakClaimable ? 'MEASURED_PEAK' : 'LOWER_BOUND_ONLY') : 'UNSOUND',
    correlatedRequestCount: correlated ?? null,
    achievedMedianIntervalMs: median ?? null,
    maxSampledPrivateDirtyBytes: Number.isFinite(max) ? max : null,
    peakClaimable,
    interpretation: peakClaimable
      ? 'cadence supports treating this as a transient peak'
      : 'LOWER BOUND ONLY — the probe is far slower than one inference, so the true '
        + 'transient peak is unknown and is not bounded above by this number',
    reason: problems.join('; ') || null,
  };
}

/**
 * [G] EVIDENCE PROVENANCE. The packet's claims must be RE-DERIVABLE from its own
 * raw bytes.
 *
 * [D] asks "is this packet internally sound?". [G] asks the prior question:
 * "does this packet describe evidence that actually exists?". Hermes' audit
 * demonstrated that without [G] a fifteen-line hand-written JSON satisfied [D]
 * and, through the ratified review band, turned the entire gate green.
 *
 * The re-derivation itself lives in `evidence_provenance.mjs` so this module
 * stays pure; pass its result in.
 */
export function checkEvidenceProvenance(provenance, { required = true } = {}) {
  if (!required) {
    return { id: 'G', ok: true, status: 'NOT_REQUIRED', reason: null };
  }
  if (!provenance || typeof provenance !== 'object') {
    return {
      id: 'G',
      ok: false,
      status: 'UNBOUND',
      reason: 'no evidence-provenance result supplied — the packet was never digested, so '
        + 'nothing binds its claims to real bytes',
    };
  }
  // Hermes R4-1: a caller must not be able to soften this by passing a result
  // that was computed WITHOUT manifest membership. Self-consistency is not
  // provenance, so an unsealed packet fails here regardless of what the
  // provenance result's own `ok` says.
  const manifestChecked = provenance.manifestChecked === true;
  const problems = [...(provenance.problems ?? [])];
  if (!manifestChecked) {
    problems.push('provenance was computed WITHOUT sealed-manifest membership — internal '
      + 'consistency alone cannot distinguish produced evidence from authored evidence');
  }
  const ok = provenance.ok === true && manifestChecked;
  return {
    id: 'G',
    ok,
    status: ok ? (provenance.status ?? 'BOUND') : (manifestChecked ? (provenance.status ?? 'UNBOUND') : 'UNSEALED'),
    packetSha256: provenance.packetSha256 ?? null,
    bindingDigest: provenance.bindingDigest ?? null,
    manifestChecked,
    manifestSource: provenance.manifestSource ?? 'none',
    rederived: provenance.rederived ?? null,
    reason: ok ? null : problems.join('; ') || 'unbound',
  };
}

/**
 * Evaluate the whole static gate. Returns every check plus the overall verdict.
 * `ok` is true only when EVERY check passes — D can never carry A.
 */
export function evaluateMemoryGate({
  budget,
  vectors,
  session = null,
  ceiling = RATIFIED_CEILING_BYTES,
  target = PREFERRED_TARGET_BYTES,
  evidenceProvenance = null,
  requireEvidenceProvenance = true,
}) {
  const envelope = computeEnvelope(budget, vectors);
  // [D] is computed FIRST because the ratified review band makes [A] depend on
  // it. That dependency runs one way only: evidence can permit an envelope that
  // is already inside the hard ceiling, and can never raise the ceiling itself
  // or excuse an envelope above it.
  const evidence = checkMeasuredEvidence(session, ceiling);
  // [G] is computed alongside [D] because the review band requires BOTH: the
  // packet must be internally sound AND provably derived from real bytes.
  const provenanceCheck = checkEvidenceProvenance(evidenceProvenance, {
    required: requireEvidenceProvenance && session !== null && session !== undefined,
  });
  const checks = [
    checkEnvelopeWithinCeiling(envelope, {
      ceiling,
      target,
      review: budget?.ceilingRatification ?? null,
      evidenceOk: evidence.ok && provenanceCheck.ok,
    }),
    checkUnitIntegrity(envelope, ceiling),
    checkComposition(envelope),
    evidence,
    checkEstimateFloors(budget),
    checkUniformCeiling(budget, ceiling),
    provenanceCheck,
  ];
  return { envelope, checks, ok: checks.every((c) => c.ok) };
}
