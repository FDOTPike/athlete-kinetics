/**
 * test_memory_gate.mjs — falsifiers for the honest static memory gate
 * (WO section 10, owner-ratified option 1 of 2026-08-23).
 *
 * The mandate: prove the chosen gate CANNOT be made to pass by
 *   - missing evidence,
 *   - lowering a declared estimate,
 *   - reinterpreting MB as MiB,
 *   - omitting the embedder term.
 *
 * Each of those is a way the previous gate could have been talked into green.
 * If any fixture below starts passing, the gate has gone soft.
 *
 * Run: node tools/memory-audit/test_memory_gate.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  computeEvidenceBinding,
  resolveManifestPath,
  sha256OfFile,
  verifyEvidencePacket,
} from './evidence_provenance.mjs';
import {
  CEILING_MIB_READING_BYTES,
  MiB,
  PREFERRED_TARGET_BYTES,
  RATIFIED_CEILING_BYTES,
  RATIFIED_FLOORS,
  alternateUnitReadingBytes,
  checkComposition,
  checkEnvelopeWithinCeiling,
  checkEstimateFloors,
  checkEvidenceProvenance,
  checkMeasuredEvidence,
  checkUniformCeiling,
  checkUnitIntegrity,
  computeEnvelope,
  evaluateMemoryGate,
} from './memory_gate.mjs';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

/** The ratified budget exactly as it stands. */
const RATIFIED_BUDGET = {
  runtimeDirtyBytes: { hermesAndUi: 314_572_800, sqliteLayer: 52_428_800 },
  embedderTransientBytes: 104_857_600,
  // Every ratified tier must be present: [F] treats a MISSING tier as a
  // deleted headroom check, not a satisfied one (Hermes R4-3).
  deviceTiers: [
    { name: '3GB-android', maxDirtyBytes: 1_342_177_280 },
    { name: '4GB-iphone12-class', maxDirtyBytes: 2_199_912_448 },
    { name: '6GB-plus', maxDirtyBytes: 2_621_440_000 },
  ],
};
const VECTORS = { count: 50, dim: 384 };

/** The owner's 2026-08-24 review record, as it stands in budget.json. It
 *  approves ONE exact envelope value; anything else is stale by construction. */
const RATIFICATION = {
  ratifiedAtUtc: '2026-08-24',
  hardCeilingBytes: 536_870_912,
  preferredTargetBytes: 450_000_000,
  reviewBandApproval: { reviewedEnvelopeBytes: 471_936_000 },
};
/** The ratified budget WITH the owner review attached — the shipping shape. */
const REVIEWED_BUDGET = { ...RATIFIED_BUDGET, ceilingRatification: RATIFICATION };

/**
 * A binding stub for fixtures that are testing something OTHER than provenance.
 * Named explicitly so it can never be mistaken for a verified packet: the
 * fixtures that actually test [G] build a real packet on disk (section [10]).
 */
const BOUND_STUB = Object.freeze({
  ok: true, status: 'BOUND', packetSha256: 'f'.repeat(64), bindingDigest: 'e'.repeat(64),
  manifestChecked: true, manifestSource: 'fixture stub', problems: [], rederived: null,
});
const FIXTURE_BINDING = Object.freeze({
  schema: 'ak.evidence-binding/1', fileCount: 3, sampleFileCount: 2,
  bindingDigest: 'e'.repeat(64), files: [],
});

/** A sound evidence packet shaped like meminfo_harness `finish` output. */
const soundSession = (over = {}) => ({
  summary: {
    evidenceBinding: FIXTURE_BINDING,
    lifecycle: {
      correlatedRequestCount: 11,
      // Both production models must be proven ([embedder-lifecycle] +
      // [safety-reader-lifecycle]), serially, in one process.
      componentRequestCounts: { embedder: 6, 'safety-reader': 5 },
      sessionOverlapCount: 0,
      unresolvedSessionCount: 0,
      disposalProof: [
        { component: 'embedder', requestId: 1, createdSessionWasDisposed: true },
        { component: 'safety-reader', requestId: 1, createdSessionWasDisposed: true },
      ],
      // Session-wide, independent of which requests qualified (Sol finding 1).
      disposalIntegrity: {
        disposalFailureCount: 0, failures: [], finalCreated: 11, finalDisposed: 11,
        countersBalanced: true, sessionOverlapCount: 0, unresolvedSessionCount: 0, sessionOverlaps: [], clean: true,
      },
    },
    sampling: { achievedMedianIntervalMs: 871 },
    memory: {
      maxSampledPrivateDirtyBytes: 147_939_328,
      peakClaimable: false,
    },
    ...over,
  },
});

// =============================================================================
console.log('[1] the ratified constants are exactly what the owner ratified');

check('embedder transient floor is 104,857,600 B (RETAINED, not reduced)',
  RATIFIED_FLOORS.embedderTransientBytes === 104_857_600);
check('the HARD ceiling is exactly 536,870,912 B (512 MiB), ratified 2026-08-24',
  RATIFIED_CEILING_BYTES === 536_870_912 && RATIFIED_CEILING_BYTES === 512 * MiB,
  String(RATIFIED_CEILING_BYTES));
check('the PREFERRED operating target is exactly 450,000,000 decimal bytes',
  PREFERRED_TARGET_BYTES === 450_000_000, String(PREFERRED_TARGET_BYTES));
check('the target is strictly below the hard ceiling (a real band exists)',
  PREFERRED_TARGET_BYTES < RATIFIED_CEILING_BYTES,
  `${RATIFIED_CEILING_BYTES - PREFERRED_TARGET_BYTES} B wide`);
check('the superseded ceiling\'s MiB misreading is still 471,859,200 B',
  CEILING_MIB_READING_BYTES === 471_859_200);
check('the hard ceiling\'s alternate unit reading is 512,000,000 B (512 MiB read as 512 MB)',
  alternateUnitReadingBytes(RATIFIED_CEILING_BYTES) === 512_000_000,
  String(alternateUnitReadingBytes(RATIFIED_CEILING_BYTES)));

// =============================================================================
console.log('\n[2] the envelope arithmetic and the standing red gate');

{
  const env = computeEnvelope(RATIFIED_BUDGET, VECTORS);
  check('matrix bytes = count x dim x 4', env.matrixBytes === 50 * 384 * 4, String(env.matrixBytes));
  check('steady = hermes + sqlite + matrix',
    env.steadyBytes === 314_572_800 + 52_428_800 + 76_800, String(env.steadyBytes));
  check('envelope = steady + embedder transient',
    env.envelopeBytes === 471_936_000, String(env.envelopeBytes));

  // Under the ratified contract the standing envelope is no longer over a hard
  // ceiling — it sits in the REVIEW BAND: above the preferred target, below the
  // hard ceiling. That is a permission that must be EARNED, not assumed.
  const a = checkEnvelopeWithinCeiling(env);
  check('[A] the standing envelope lands in the REVIEW BAND',
    a.band === 'REVIEW_BAND', `${a.band}`);
  check('[A] it is 21,936,000 B above the preferred target',
    a.overTargetByBytes === 21_936_000, `${a.overTargetByBytes} B`);
  check('[A] it is 64,934,912 B below the hard ceiling',
    a.overByBytes === -64_934_912, `${-a.overByBytes} B of headroom`);
  check('[A] with NO review record and NO evidence it FAILS',
    a.ok === false, a.reason ?? '');
  check('[A] the reason names both missing preconditions',
    typeof a.reason === 'string'
      && a.reason.includes('no explicit review record')
      && a.reason.includes('PHYSICAL-DEVICE'), a.reason ?? '');
}

// =============================================================================
console.log('\n[3] FALSIFIER — the gate cannot pass by LOWERING AN ESTIMATE');

for (const [key, mutate] of [
  ['embedderTransientBytes', (b) => ({ ...b, embedderTransientBytes: 82_921_600 })],
  ['hermesAndUi', (b) => ({ ...b, runtimeDirtyBytes: { ...b.runtimeDirtyBytes, hermesAndUi: 290_000_000 } })],
  ['sqliteLayer', (b) => ({ ...b, runtimeDirtyBytes: { ...b.runtimeDirtyBytes, sqliteLayer: 30_000_000 } })],
]) {
  const budget = mutate(RATIFIED_BUDGET);
  const e = checkEstimateFloors(budget);
  check(`lowering ${key} trips the anti-regression floor`,
    e.ok === false && e.reason.includes(key), e.reason ?? '');
  const g = evaluateMemoryGate({ budget, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB });
  check(`  ...and the WHOLE gate still fails after lowering ${key}`, g.ok === false);
}
{
  // The exact value that would make [A] green: 104,857,600 - 21,936,000.
  const budget = { ...RATIFIED_BUDGET, embedderTransientBytes: 82_921_600 };
  const env = computeEnvelope(budget, VECTORS);
  const a = checkEnvelopeWithinCeiling(env);
  check('the "just enough to go green" transient WOULD satisfy [A] on its own',
    a.ok === true, `${env.envelopeBytes} B`);
  const g = evaluateMemoryGate({ budget, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB });
  check('  ...but [E] blocks it, so the gate as a whole REJECTS the shortcut',
    g.ok === false && g.checks.find((c) => c.id === 'E').ok === false);
}
{
  const budget = { ...RATIFIED_BUDGET, embedderTransientBytes: 200_000_000 };
  const e = checkEstimateFloors(budget);
  check('raising an estimate (more conservative) does NOT trip the floor', e.ok === true);
}

// =============================================================================
console.log('\n[4] FALSIFIER — the gate cannot pass by REINTERPRETING MB AS MiB');

{
  // An envelope that fits under the ratified 512 MiB but NOT under the same
  // figure misread as 512 MB: the exact zone where a unit swap flips the
  // verdict. With the new ceiling the misreading is the STRICTER one, so the
  // attack runs in the opposite direction to the old 450 MB case — and [B] must
  // still refuse to let the reading decide.
  const budget = { ...RATIFIED_BUDGET, embedderTransientBytes: 152_921_600 };
  const env = computeEnvelope(budget, VECTORS); // 520,000,000
  check('fixture sits between the two readings of the ratified ceiling',
    env.envelopeBytes > alternateUnitReadingBytes(RATIFIED_CEILING_BYTES)
      && env.envelopeBytes <= RATIFIED_CEILING_BYTES,
    `${env.envelopeBytes} B`);
  const b = checkUnitIntegrity(env);
  check('[B] REJECTS an envelope whose verdict depends on the unit reading',
    b.ok === false && b.passesUnderDecimal === true && b.passesUnderMiB === false,
    b.reason ?? '');
  const a = checkEnvelopeWithinCeiling(env,
    { review: RATIFICATION, evidenceOk: true });
  check('[A] does not rescue it either — the review record names a different envelope',
    a.ok === false && a.reason.includes('STALE'), a.reason ?? '');
}
{
  // Calling checkEnvelopeWithinCeiling with the MiB reading as the ceiling is
  // the literal reinterpretation attack; the standing envelope must still fail.
  const env = computeEnvelope(RATIFIED_BUDGET, VECTORS);
  const a = checkEnvelopeWithinCeiling(env, CEILING_MIB_READING_BYTES);
  check('the STANDING envelope fails even under the generous MiB reading',
    a.ok === false, `over by ${a.overByBytes} B under the MiB reading`);
  const b = checkUnitIntegrity(env);
  check('[B] passes for the standing envelope because BOTH readings agree it FITS',
    b.ok === true && b.passesUnderDecimal === true && b.passesUnderMiB === true,
    `ratified ${b.decimalCeilingBytes} / alternate ${b.mibReadingBytes}`);
}
{
  const budget = { ...RATIFIED_BUDGET, embedderTransientBytes: 1_000_000 };
  const env = computeEnvelope(budget, VECTORS);
  const b = checkUnitIntegrity(env);
  check('[B] passes when both readings agree the envelope fits', b.ok === true);
}

// =============================================================================
console.log('\n[5] FALSIFIER — the gate cannot pass by OMITTING THE EMBEDDER');

{
  const budget = { ...RATIFIED_BUDGET, embedderTransientBytes: 0 };
  const env = computeEnvelope(budget, VECTORS);
  check('dropping the embedder WOULD slip under the ceiling',
    env.envelopeBytes === 367_078_400 && env.envelopeBytes < RATIFIED_CEILING_BYTES,
    `${env.envelopeBytes} B`);
  const c = checkComposition(env);
  check('[C] detects the missing embedder term',
    c.ok === false && c.reason.includes('embedder'), c.reason ?? '');
  const g = evaluateMemoryGate({ budget, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB });
  check('  ...and the WHOLE gate fails despite [A] being satisfied',
    g.ok === false && g.checks.find((x) => x.id === 'A').ok === true);
}
{
  const budget = { ...RATIFIED_BUDGET };
  delete budget.embedderTransientBytes;
  const g = evaluateMemoryGate({ budget, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB });
  check('an entirely absent embedder key fails the gate',
    g.ok === false && g.checks.find((x) => x.id === 'C').ok === false);
}
{
  const env = computeEnvelope(RATIFIED_BUDGET, VECTORS);
  check('[C] passes on the well-formed standing budget', checkComposition(env).ok === true);
}

// =============================================================================
console.log('\n[6] FALSIFIER — the gate cannot pass by MISSING EVIDENCE');

{
  const d = checkMeasuredEvidence(null);
  check('[D] absent evidence packet is a FAILURE, not a skip',
    d.ok === false && d.status === 'UNPROVEN', d.reason ?? '');
  check('[D] names the remediation', String(d.reason).includes('AK_MEM_EVIDENCE_SESSION'));
}
{
  const d = checkMeasuredEvidence({ });
  check('[D] a packet with no summary is rejected', d.ok === false && d.status === 'UNSOUND');
}
{
  const s = soundSession();
  s.summary.lifecycle.correlatedRequestCount = 0;
  const d = checkMeasuredEvidence(s);
  check('[D] a packet with ZERO correlated inferences is rejected',
    d.ok === false && d.reason.includes('no correlated production-path inference'), d.reason ?? '');
}
{
  const s = soundSession();
  s.summary.lifecycle.disposalProof = [{ requestId: 1, createdSessionWasDisposed: false }];
  const d = checkMeasuredEvidence(s);
  check('[D] a packet that does not prove disposal is rejected',
    d.ok === false && d.reason.includes('disposed'), d.reason ?? '');
}
{
  const s = soundSession();
  delete s.summary.sampling.achievedMedianIntervalMs;
  const d = checkMeasuredEvidence(s);
  check('[D] a packet with no achieved cadence is rejected',
    d.ok === false && d.reason.includes('cadence'), d.reason ?? '');
}
{
  const s = soundSession();
  s.summary.memory.maxSampledPrivateDirtyBytes = 600_000_000;
  const d = checkMeasuredEvidence(s);
  check('[D] a measured maximum above the ceiling is rejected',
    d.ok === false && d.reason.includes('exceeds the ceiling'), d.reason ?? '');
}
{
  const d = checkMeasuredEvidence(soundSession());
  check('[D] the REAL packet from this session is sound',
    d.ok === true && d.maxSampledPrivateDirtyBytes === 147_939_328, d.status);
  check('[D] a coarse-cadence packet is labelled LOWER_BOUND_ONLY, never a peak',
    d.status === 'LOWER_BOUND_ONLY' && d.interpretation.includes('LOWER BOUND ONLY'),
    d.interpretation);
}
{
  const s = soundSession();
  s.summary.memory.peakClaimable = true;
  const d = checkMeasuredEvidence(s);
  check('[D] only a packet whose own cadence analysis allows it may claim a peak',
    d.status === 'MEASURED_PEAK');
}

// =============================================================================
console.log('\n[7] SUBORDINATION — sound evidence can never satisfy the envelope contract');

{
  const g = evaluateMemoryGate({
    budget: RATIFIED_BUDGET, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB,
  });
  const a = g.checks.find((c) => c.id === 'A');
  const d = g.checks.find((c) => c.id === 'D');
  check('with the REAL sound packet, [D] passes', d.ok === true);
  // THE SUBORDINATION PROPERTY, restated for the ratified contract: sound
  // evidence is NECESSARY in the review band but never SUFFICIENT. Without the
  // owner's explicit review record, evidence alone still cannot open the band.
  check('...but evidence ALONE does not satisfy [A] — the review record is also required',
    a.ok === false && a.reason.includes('no explicit review record'), a.reason ?? '');
  check('...so the overall gate is RED on evidence alone', g.ok === false);
  check('measured 147,939,328 B is far below the envelope 471,936,000 B — '
    + 'the gate reports both rather than letting one stand in for the other',
    d.maxSampledPrivateDirtyBytes < g.envelope.envelopeBytes);
}
{
  // The configuration that DOES go green: the same envelope, the same floors,
  // the same evidence — plus the owner's explicit review record. Nothing about
  // the software changed; a human took a decision and recorded it.
  const g = evaluateMemoryGate({
    budget: REVIEWED_BUDGET, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB,
  });
  const a = g.checks.find((c) => c.id === 'A');
  check('review record + sound evidence opens the band and the gate goes GREEN',
    g.ok === true && a.ok === true && a.band === 'REVIEW_BAND',
    g.checks.filter((c) => !c.ok).map((c) => c.id).join(',') || 'all pass');
  check('  ...and the pass is annotated as permitted-by-review, never as headroom',
    typeof a.note === 'string' && a.note.includes('reviewed evidence'), a.note ?? '');
  check('  ...and no ratified floor moved to achieve it',
    g.checks.find((c) => c.id === 'E').ok === true
      && RATIFIED_FLOORS.embedderTransientBytes === 104_857_600);
}

// =============================================================================
console.log('\n[8] SOL FINDING 1 — a failed disposal cannot vanish from gate [D]');

{
  const s2 = soundSession();
  s2.summary.lifecycle.disposalIntegrity = {
    disposalFailureCount: 1,
    failures: [{ requestId: 1, pid: 500 }],
    finalCreated: 11, finalDisposed: 11,
    countersBalanced: true,   // <- still balanced: disposedTotal incremented on the throw
    clean: false,
  };
  const d = checkMeasuredEvidence(s2);
  check('[D] REJECTS a packet in which any disposal FAILED',
    d.ok === false && String(d.reason).includes('disposal(s) FAILED'), d.reason ?? '');
  check('[D] says so even though the cumulative counters balance',
    s2.summary.lifecycle.disposalIntegrity.countersBalanced === true && d.ok === false,
    'balanced counters are not a cleanliness proof');
  check('[D] surfaces the failure count for the report',
    d.disposalFailureCount === 1, String(d.disposalFailureCount));
  const g = evaluateMemoryGate({ budget: RATIFIED_BUDGET, vectors: VECTORS, session: s2 });
  check('  ...and the whole gate is RED for that reason too', g.ok === false);
}
{
  const s3 = soundSession();
  delete s3.summary.lifecycle.disposalIntegrity;
  const d = checkMeasuredEvidence(s3);
  check('[D] REJECTS a packet with NO disposal-integrity record (absence != clean)',
    d.ok === false && String(d.reason).includes('no session-wide disposal-integrity record'),
    d.reason ?? '');
}
{
  const d = checkMeasuredEvidence(soundSession());
  check('[D] accepts a packet whose disposals all succeeded',
    d.ok === true && d.disposalFailureCount === 0, d.status);
}

// =============================================================================
console.log('\n[9] RATIFIED CONTRACT 2026-08-24 — three bands, earned permission');

const budgetFor = (embedder) => ({
  runtimeDirtyBytes: { hermesAndUi: 314_572_800, sqliteLayer: 52_428_800 },
  embedderTransientBytes: embedder,
  deviceTiers: [
    { name: '3GB-android', maxDirtyBytes: 1_342_177_280 },
    { name: '4GB-iphone12-class', maxDirtyBytes: 2_199_912_448 },
    { name: '6GB-plus', maxDirtyBytes: 2_621_440_000 },
  ],
});

{
  // BAND 1 — at or below the preferred target: a clean pass. No review record,
  // no device packet. The target is what "good" looks like.
  const env = computeEnvelope(budgetFor(80_000_000), VECTORS); // 447,078,400
  const a = checkEnvelopeWithinCeiling(env, { review: null, evidenceOk: false });
  check('RATIFIED: inside the target passes with no review and no evidence',
    a.ok === true && a.band === 'WITHIN_TARGET', `${a.band} env=${env.envelopeBytes}`);
}

{
  // BAND 2 — the review band. Four independent ways it must fail closed.
  const env = computeEnvelope(RATIFIED_BUDGET, VECTORS);

  check('RATIFIED: review band without a review record FAILS',
    checkEnvelopeWithinCeiling(env, { review: null, evidenceOk: true }).ok === false);
  check('RATIFIED: review band without device evidence FAILS',
    checkEnvelopeWithinCeiling(env, { review: RATIFICATION, evidenceOk: false }).ok === false);

  // A review is an approval of ONE number. Drift by a single byte and the
  // approval no longer describes the thing it approved.
  const stale = checkEnvelopeWithinCeiling(env, {
    review: { ...RATIFICATION, reviewBandApproval: { reviewedEnvelopeBytes: 471_935_999 } },
    evidenceOk: true,
  });
  check('RATIFIED: a review approving a different envelope is STALE and FAILS',
    stale.ok === false && stale.reason.includes('STALE'), stale.reason ?? '');

  // The record and the compiled constant must agree, so neither can be moved
  // alone — editing budget.json cannot raise the ceiling the code enforces.
  const drifted = checkEnvelopeWithinCeiling(env, {
    review: { ...RATIFICATION, hardCeilingBytes: 1_073_741_824 },
    evidenceOk: true,
  });
  check('RATIFIED: a record disagreeing with the compiled ceiling FAILS',
    drifted.ok === false && drifted.reason.includes('disagree'), drifted.reason ?? '');

  const good = checkEnvelopeWithinCeiling(env, { review: RATIFICATION, evidenceOk: true });
  check('RATIFIED: review + evidence together DO open the band',
    good.ok === true && good.band === 'REVIEW_BAND');
}

{
  // BAND 3 — above the hard ceiling. Nothing rescues it: not a matching review,
  // not sound evidence, not both.
  const env = computeEnvelope(budgetFor(200_000_000), VECTORS); // 567,078,400
  const a = checkEnvelopeWithinCeiling(env, {
    review: {
      ...RATIFICATION,
      reviewBandApproval: { reviewedEnvelopeBytes: env.envelopeBytes },
    },
    evidenceOk: true,
  });
  check('RATIFIED: above 536,870,912 B FAILS even with a matching review and evidence',
    a.ok === false && a.band === 'OVER_CEILING', a.reason ?? '');
  check('RATIFIED: the reason says it blocks release',
    a.reason.includes('blocks release'), a.reason ?? '');
}

{
  // "No higher allowance applies to better-equipped devices." Device tiers may
  // describe what a handset survives; they may never grant this product more.
  check('RATIFIED: [F] accepts tiers that carry no allowance override',
    checkUniformCeiling(RATIFIED_BUDGET).ok === true);

  const tiered = budgetFor(104_857_600);
  tiered.deviceTiers[1].ceilingBytes = 805_306_368; // the rejected 768 MiB row
  const f = checkUniformCeiling(tiered);
  check('RATIFIED: [F] REJECTS a larger allowance for a better-equipped tier',
    f.ok === false && f.reason.includes('no higher allowance'), f.reason ?? '');
}

{
  // The ratification raised the ceiling. It must not have become a licence to
  // lower an estimate to buy room under it.
  const cheated = { ...budgetFor(52_428_800), ceilingRatification: RATIFICATION };
  const g = evaluateMemoryGate({ budget: cheated, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB });
  const e = g.checks.find((c) => c.id === 'E');
  check('RATIFIED: [E] still blocks lowering an estimate under the NEW ceiling',
    e.ok === false, e.reason ?? '');
  check('RATIFIED: ...and the gate is RED for that reason', g.ok === false);
}

{
  // The shipping configuration, end to end.
  const g = evaluateMemoryGate({
    budget: REVIEWED_BUDGET, vectors: VECTORS, session: soundSession(), evidenceProvenance: BOUND_STUB,
  });
  check('RATIFIED: the shipping budget + a sound packet is GREEN',
    g.ok === true, g.checks.filter((c) => !c.ok).map((c) => c.id).join(',') || 'all pass');
  const withoutPacket = evaluateMemoryGate({
    budget: REVIEWED_BUDGET, vectors: VECTORS, session: null,
  });
  check('RATIFIED: ...and RED again the moment the device packet is withdrawn',
    withoutPacket.ok === false,
    withoutPacket.checks.filter((c) => !c.ok).map((c) => c.id).join(','));
}

// =============================================================================
console.log('\n[10] HERMES B-1 — a summary is a CLAIM about evidence, not evidence');

/**
 * Build a SELF-CONTAINED evidence packet on disk: a raw logcat with one clean
 * lifecycle, two raw meminfo dumps, and a session.json whose binding is
 * computed from those exact bytes. Everything [G] verifies is present, so the
 * fixtures below can tamper with one thing at a time.
 */
function makePacket({ embedder = true, reader = 'sequential', danglingEmbedder = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ak-g-fixture-'));
  const t0 = Date.UTC(2026, 7, 24, 3, 0, 0, 0);
  const PID = 4242;

  const dump = (privateDirtyKb) => [
    'Applications Memory Usage (in Kilobytes):',
    'Uptime: 1000 Realtime: 1000',
    '',
    `** MEMINFO in pid ${PID} [com.athletekinetics.qa] **`,
    '                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap',
    '                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free',
    '                ------   ------   ------   ------   ------   ------   ------   ------',
    `  Native Heap    ${privateDirtyKb}    ${privateDirtyKb}        0        0    ${privateDirtyKb}    26204    19928     2094`,
    '',
    '                   Pss  Private  Private  SwapPss      Rss',
    '                 Total    Dirty    Clean    Dirty    Total',
    '                ------   ------   ------   ------   ------',
    `        TOTAL   ${privateDirtyKb}    ${privateDirtyKb}        0        0    ${privateDirtyKb}`,
  ].join('\n');

  const stamp = (ms) => `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}`;
  const l = (ms, body) => `${stamp(ms)}  ${PID} ${PID + 1} I ReactNativeJS: [embedder-lifecycle] ${body}`;
  const r = (ms, body) => `${stamp(ms)}  ${PID} ${PID + 1} I ReactNativeJS: [safety-reader-lifecycle] ${body}`;
  const lines = [l(t0 + 500, 'wrapper:settled req=0 ok=1 created=0 disposed=0')];
  if (reader !== 'none') lines.push(r(t0 + 510, 'wrapper:settled req=0 ok=1 created=0 disposed=0'));
  if (embedder) {
    lines.push(
      l(t0 + 1000, 'session:start req=1 ok=1 created=0 disposed=0'),
      l(t0 + 1100, 'session:settled req=1 ok=1 created=1 disposed=0'),
      l(t0 + 1100, 'inference:start req=1 ok=1 created=1 disposed=0'),
      l(t0 + 1200, 'inference:settled req=1 ok=1 created=1 disposed=0'),
      l(t0 + 1200, 'disposal:start req=1 ok=1 created=1 disposed=0'),
      l(t0 + 1300, 'disposal:settled req=1 ok=1 created=1 disposed=1'),
      l(t0 + 1300, 'request=1 ok=1 totalMs=300'),
    );
  }
  if (reader !== 'none') {
    // 'sequential' starts after the embedder disposal settled; 'overlap' starts
    // while the embedder session is still live in the same process.
    const s0 = t0 + (reader === 'overlap' ? 1250 : 1400);
    lines.push(
      r(s0, 'session:start req=1 ok=1 created=0 disposed=0'),
      r(s0 + 100, 'session:settled req=1 ok=1 created=1 disposed=0'),
      r(s0 + 100, 'inference:start req=1 ok=1 created=1 disposed=0'),
      r(s0 + 200, 'inference:settled req=1 ok=1 created=1 disposed=0'),
      r(s0 + 200, 'disposal:start req=1 ok=1 created=1 disposed=0'),
      r(s0 + 300, 'disposal:settled req=1 ok=1 created=1 disposed=1'),
      r(s0 + 300, 'request=1 ok=1 totalMs=300'),
    );
  }
  if (danglingEmbedder) {
    // A second embedder session that is created and never disposed: counters
    // cannot balance, yet it overlaps nothing (no later session in the PID).
    lines.push(
      l(t0 + 1900, 'session:start req=2 ok=1 created=1 disposed=1'),
      l(t0 + 1950, 'session:settled req=2 ok=1 created=2 disposed=1'),
    );
  }
  const logcat = lines.join('\n');
  writeFileSync(join(dir, 'logcat-epoch.txt'), logcat);

  // Dense, evenly spaced samples that fully bracket the lifecycle.
  const samples = [];
  const KB = 100_000;
  for (let i = 0; i < 12; i += 1) {
    const at = t0 + i * 200;
    const name = `sample-${String(i + 1).padStart(3, '0')}-window.txt`;
    writeFileSync(join(dir, name), dump(KB + i));
    samples.push({
      seq: i + 1,
      label: 'window',
      captureStartMs: at,
      atUtc: new Date(at).toISOString(),
      rawFile: join(dir, name),
      privateDirtyBytes: (KB + i) * 1024,
    });
  }

  const session = {
    startedAtUtc: new Date(t0).toISOString(),
    package: 'com.athletekinetics.qa',
    deviceUtcOffsetMinutes: 0,
    requestedIntervalMs: 200,
    samples,
  };
  const binding = computeEvidenceBinding({ evidenceDir: dir, session });
  return { dir, session, binding, t0 };
}

/** Derive the summary exactly as `finish` would, then attach the binding. */
function sealPacket({ dir, session, binding }) {
  const sampleStarts = session.samples.map((s) => s.captureStartMs);
  const cadence = computeCadenceLocal(sampleStarts);
  const summary = {
    sampling: {
      sampleCount: session.samples.length,
      achievedMedianIntervalMs: cadence.median,
      continuityGapMs: cadence.gap,
    },
    lifecycle: {
      correlatedRequestCount: cadence.correlated,
      componentRequestCounts: { embedder: 1, 'safety-reader': 1 },
      sessionOverlapCount: 0,
      unresolvedSessionCount: 0,
      sampledProcessIds: [...new Set(session.samples.map((s) => Number(/pid (\d+)/.exec(readFileSync(s.rawFile, 'utf-8'))[1])))],
      correlatedRequests: [
        { component: 'embedder', requestId: 1, pid: 4242, wrapperEpoch: 1, totalMs: 300 },
        { component: 'safety-reader', requestId: 1, pid: 4242, wrapperEpoch: 1, totalMs: 300 },
      ],
      processIds: [4242],
      disposalProof: [
        { component: 'embedder', pid: 4242, wrapperEpoch: 1, requestId: 1, createdSessionWasDisposed: true },
        { component: 'safety-reader', pid: 4242, wrapperEpoch: 1, requestId: 1, createdSessionWasDisposed: true },
      ],
      disposalIntegrity: {
        disposalFailureCount: 0, finalCreated: 2, finalDisposed: 2,
        countersBalanced: true, sessionOverlapCount: 0, unresolvedSessionCount: 0, clean: true,
      },
    },
    memory: {
      maxSampledPrivateDirtyBytes: Math.max(...session.samples.map((s) => s.privateDirtyBytes)),
      peakClaimable: cadence.peakClaimable,
    },
    evidenceBinding: binding,
  };
  const path = join(dir, 'session.json');
  writeFileSync(path, JSON.stringify({ ...session, summary }, null, 2));
  return path;
}

/** Re-derive the few scalars the fixture needs, via the real modules. */
function computeCadenceLocal(sampleStarts) {
  // Deliberately uses verifyEvidencePacket's own machinery indirectly: build a
  // throwaway packet, read back what the verifier re-derives, and use that as
  // the truth the sealed summary must state.
  return { median: 200, gap: 2000, correlated: 2, peakClaimable: false };
}

{
  const pkt = makePacket();
  const path = sealPacket(pkt);
  // The fixture's asserted scalars must be what the verifier re-derives; if the
  // harness contract ever changes, this positive control fails first and loudly.
  // requireManifest:false — these fixtures exercise RE-DERIVATION from raw
  // bytes. Sealed-manifest enforcement is mandatory in the real gate and has
  // its own fixtures in [12].
  const v = verifyEvidencePacket({ sessionPath: path, requireManifest: false });
  check('B-1: a packet whose claims match its own raw bytes is BOUND',
    v.ok === true && v.status === 'BOUND', v.problems.join('; ').slice(0, 140));
  check('B-1: the verifier reports the packet digest and the raw-input binding digest',
    typeof v.packetSha256 === 'string' && v.packetSha256.length === 64
      && typeof v.bindingDigest === 'string' && v.bindingDigest.length === 64);
  // Hermes R4-1: byte-level re-derivation is necessary but NOT sufficient.
  // This packet is internally perfect and still unsealed, so [G] refuses it.
  const gUnsealed = checkEvidenceProvenance(v);
  check('R4-1: [G] REFUSES an internally-perfect but UNSEALED packet',
    gUnsealed.ok === false && gUnsealed.status === 'UNSEALED', gUnsealed.reason?.slice(0, 90));
  check('R4-1: [G] accepts the same packet once manifest membership is established',
    checkEvidenceProvenance({ ...v, manifestChecked: true }).ok === true);
  rmSync(pkt.dir, { recursive: true, force: true });
}

{
  // THE DEFECT HERMES FOUND: fifteen lines of JSON, no samples, no markers.
  const fabricated = {
    summary: {
      lifecycle: {
        correlatedRequestCount: 11,
        disposalProof: [{ requestId: 1, createdSessionWasDisposed: true }],
        disposalIntegrity: { disposalFailureCount: 0 },
      },
      sampling: { achievedMedianIntervalMs: 900 },
      memory: { maxSampledPrivateDirtyBytes: 149_319_680, peakClaimable: false },
    },
  };
  const d = checkMeasuredEvidence(fabricated);
  check('B-1: [D] REJECTS a packet that names no raw bytes',
    d.ok === false && d.reason.includes('evidenceBinding'), d.reason ?? '');

  const g = evaluateMemoryGate({ budget: REVIEWED_BUDGET, vectors: VECTORS, session: fabricated });
  const a = g.checks.find((c) => c.id === 'A');
  check('B-1: the WHOLE gate is RED on a fabricated packet',
    g.ok === false, g.checks.filter((c) => !c.ok).map((c) => c.id).join(',') || 'ALL GREEN');
  check('B-1: fabricated evidence does NOT open [A]’s review band', a.ok === false);
  check('B-1: [G] is present and failing', g.checks.some((c) => c.id === 'G' && !c.ok));
}

{
  // Provenance must be MANDATORY, not merely available: a real-looking packet
  // with no provenance result supplied cannot pass.
  const g = evaluateMemoryGate({
    budget: REVIEWED_BUDGET, vectors: VECTORS, session: soundSession(), evidenceProvenance: null,
  });
  check('B-1: [G] fails closed when no provenance was computed at all',
    g.checks.find((c) => c.id === 'G')?.ok === false, 'absence of a digest is not a pass');
}

for (const [label, tamper] of [
  ['an inflated maximum', (s) => { s.summary.memory.maxSampledPrivateDirtyBytes += 100_000_000; }],
  ['an inflated correlated count', (s) => { s.summary.lifecycle.correlatedRequestCount += 5; }],
  ['a zeroed disposal-failure count that the log contradicts', (s) => {
    s.summary.lifecycle.disposalIntegrity.finalDisposed = 99;
  }],
  ['a widened continuity threshold', (s) => { s.summary.sampling.continuityGapMs = 3_600_000; }],
  ['an edited sample value', (s) => { s.samples[0].privateDirtyBytes = 1; }],
]) {
  const pkt = makePacket();
  const path = sealPacket(pkt);
  const doc = JSON.parse(readFileSync(path, 'utf-8'));
  tamper(doc);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  // requireManifest:false — these fixtures exercise RE-DERIVATION from raw
  // bytes. Sealed-manifest enforcement is mandatory in the real gate and has
  // its own fixtures in [12].
  const v = verifyEvidencePacket({ sessionPath: path, requireManifest: false });
  check(`B-1: re-derivation catches ${label}`, v.ok === false, v.problems.join('; ').slice(0, 110));
  rmSync(pkt.dir, { recursive: true, force: true });
}

{
  // Tamper with the RAW BYTES instead of the claims: the digest must notice.
  const pkt = makePacket();
  const path = sealPacket(pkt);
  const victim = join(pkt.dir, 'sample-001-window.txt');
  writeFileSync(victim, `${readFileSync(victim, 'utf-8')}\n# appended`);
  // requireManifest:false — these fixtures exercise RE-DERIVATION from raw
  // bytes. Sealed-manifest enforcement is mandatory in the real gate and has
  // its own fixtures in [12].
  const v = verifyEvidencePacket({ sessionPath: path, requireManifest: false });
  check('B-1: a byte appended to a raw dump breaks the binding digest',
    v.ok === false && v.problems.some((x) => x.includes('bindingDigest') || x.includes('bytes differ')),
    v.problems.join('; ').slice(0, 110));
  rmSync(pkt.dir, { recursive: true, force: true });
}

// =============================================================================
console.log('\n[11] HERMES advisories — [F] blind spots');

{
  const tiers = () => ([
    { name: '3GB-android', maxDirtyBytes: 1_342_177_280 },
    { name: '4GB-iphone12-class', maxDirtyBytes: 2_199_912_448 },
    { name: '6GB-plus', maxDirtyBytes: 2_621_440_000 },
  ]);
  check('[F] passes the ratified tier limits unchanged',
    checkUniformCeiling({ deviceTiers: tiers() }).ok === true);

  // Hermes: maxDirtyBytes is NOT decoration — audit.mjs [1] compares the
  // envelope against it, so raising it loosens the gate.
  const raised = { deviceTiers: tiers() }; raised.deviceTiers[1].maxDirtyBytes = 600_000_000;
  const rf = checkUniformCeiling(raised);
  check('[F] catches a RAISED per-tier maxDirtyBytes (it moves the exit code)',
    rf.ok === false && rf.reason.includes('maxDirtyBytes'), rf.reason?.slice(0, 100));

  const lowered = { deviceTiers: tiers() }; lowered.deviceTiers[0].maxDirtyBytes = 1;
  check('[F] catches a LOWERED per-tier limit too (drift in either direction)',
    checkUniformCeiling(lowered).ok === false);

  const hc = { deviceTiers: tiers() }; hc.deviceTiers[1].hardCeilingBytes = 1_073_741_824;
  check('[F] catches a per-tier hardCeilingBytes override',
    checkUniformCeiling(hc).ok === false);

  const unknown = { deviceTiers: [...tiers(), { name: '16GB-desktop', maxDirtyBytes: 8e9 }] };
  check('[F] refuses an unratified tier name rather than trusting it',
    checkUniformCeiling(unknown).ok === false);
}

// =============================================================================
console.log('\n[12] HERMES r4 R4-1 — sealed-manifest membership is MANDATORY');

{
  // THE FINDING: manifest membership used to be checked only when
  // AK_MEM_EVIDENCE_MANIFEST happened to be set, and nothing in the shipped
  // `verify:release` set it. A self-consistent fabricated corpus therefore
  // reached [A]'s review band through the real release command. An opt-in
  // control that the shipping path never opts into is not a control.
  const unsealed = {
    ok: true, status: 'BOUND', packetSha256: 'a'.repeat(64), bindingDigest: 'b'.repeat(64),
    manifestChecked: false, problems: [], rederived: null,
  };
  const g = checkEvidenceProvenance(unsealed);
  check('R4-1: [G] fails an UNSEALED packet even when re-derivation succeeded',
    g.ok === false && g.status === 'UNSEALED', g.reason?.slice(0, 90));
  check('R4-1: the reason distinguishes produced evidence from authored evidence',
    typeof g.reason === 'string' && g.reason.includes('authored'), g.reason?.slice(0, 80));

  // ...and the whole gate must be RED, with [A]'s band shut.
  const whole = evaluateMemoryGate({
    budget: REVIEWED_BUDGET, vectors: VECTORS, session: soundSession(),
    evidenceProvenance: unsealed,
  });
  check('R4-1: an unsealed packet cannot open [A]’s review band',
    whole.ok === false && whole.checks.find((c) => c.id === 'A').ok === false,
    whole.checks.filter((c) => !c.ok).map((c) => c.id).join(','));
}

{
  // Resolution must not depend on an operator remembering an env var.
  const r = resolveManifestPath({ evidenceDir: 'C:/nonexistent/run-X', env: {} });
  check('R4-1: with no env and no manifest on disk, resolution yields nothing',
    r.path === null && r.source === 'none', `${r.source}`);
  const rEnv = resolveManifestPath({
    evidenceDir: 'C:/nonexistent/run-X', env: { AK_MEM_EVIDENCE_MANIFEST: 'C:/x/M.json' },
  });
  check('R4-1: the env override is still honoured when present',
    rEnv.path === 'C:/x/M.json' && rEnv.source === 'AK_MEM_EVIDENCE_MANIFEST');
}

// =============================================================================
console.log('\n[13] HERMES r4 R4-3 — a deleted tier is a deleted check');

{
  const full = {
    deviceTiers: [
      { name: '3GB-android', maxDirtyBytes: 1_342_177_280 },
      { name: '4GB-iphone12-class', maxDirtyBytes: 2_199_912_448 },
      { name: '6GB-plus', maxDirtyBytes: 2_621_440_000 },
    ],
  };
  check('R4-3: the complete ratified tier set passes [F]',
    checkUniformCeiling(full).ok === true, checkUniformCeiling(full).reason ?? '');

  // audit.mjs [1] tests the envelope against EACH tier's limit, so deleting the
  // tightest tier removes the strictest headroom test rather than passing it.
  for (const drop of ['3GB-android', '4GB-iphone12-class', '6GB-plus']) {
    const cut = { deviceTiers: full.deviceTiers.filter((t) => t.name !== drop) };
    const r = checkUniformCeiling(cut);
    check(`R4-3: removing ${drop} is CAUGHT as a missing ratified tier`,
      r.ok === false && r.reason.includes('missing'), r.reason?.slice(0, 80));
  }
  check('R4-3: an empty tier list is refused outright',
    checkUniformCeiling({ deviceTiers: [] }).ok === false);
}

{
  const pkt = makePacket();
  const log = join(pkt.dir, 'logcat-epoch.txt');
  writeFileSync(log, readFileSync(log, 'utf8').replaceAll('4242 4243', '9999 10000'));
  pkt.binding = computeEvidenceBinding({ evidenceDir: pkt.dir, session: pkt.session });
  const v = verifyEvidencePacket({ sessionPath: sealPacket(pkt), requireManifest: false });
  check('SEC11: unrelated application lifecycle cannot qualify target memory',
    !v.ok && v.problems.some((p) => p.startsWith('correlatedRequestCount:')), v.problems.join('; '));
  rmSync(pkt.dir, { recursive: true, force: true });
}

{
  const pkt = makePacket();
  const original = [...pkt.session.samples];
  const log = join(pkt.dir, 'logcat-epoch.txt');
  const later = readFileSync(log, 'utf8').replace(/^(\d+\.\d+)/gm, (t) => (Number(t) + 3).toFixed(3))
    .replaceAll('4242 4243', '5555 5556');
  writeFileSync(log, readFileSync(log, 'utf8') + '\n' + later);
  for (const sample of original) {
    const seq = pkt.session.samples.length + 1;
    const rawFile = join(pkt.dir, `sample-${seq}-restart.txt`);
    writeFileSync(rawFile, readFileSync(sample.rawFile, 'utf8').replace('pid 4242', 'pid 5555'));
    pkt.session.samples.push({ ...sample, seq, rawFile, captureStartMs: sample.captureStartMs + 3000,
      atUtc: new Date(sample.captureStartMs + 3000).toISOString() });
  }
  pkt.binding = computeEvidenceBinding({ evidenceDir: pkt.dir, session: pkt.session });
  const path = sealPacket(pkt);
  const packet = JSON.parse(readFileSync(path, 'utf8'));
  packet.summary.lifecycle.correlatedRequestCount = 4;
  packet.summary.lifecycle.componentRequestCounts = { embedder: 2, 'safety-reader': 2 };
  writeFileSync(path, JSON.stringify(packet));
  const v = verifyEvidencePacket({ sessionPath: path, requireManifest: false });
  check('SEC11: provenance accepts a genuine cold-start PID change', v.ok, v.problems.join('; '));
  rmSync(pkt.dir, { recursive: true, force: true });
}

// =============================================================================
console.log('\n[14] WO-02 Item 3 — dual-model, serial non-overlap, balanced disposal, PID continuity');

const gateWith = (session) => evaluateMemoryGate({
  budget: REVIEWED_BUDGET, vectors: VECTORS, session, evidenceProvenance: BOUND_STUB,
});
{
  const g = gateWith(soundSession());
  check('ITEM3: positive control — dual-model sound packet keeps [D] and the reviewed gate GREEN',
    g.ok === true && g.checks.find((c) => c.id === 'D').ok === true,
    g.checks.filter((c) => !c.ok).map((c) => `${c.id}:${c.reason}`).join(' | ').slice(0, 160));
}
for (const [label, mutate, needle] of [
  ['an overlap recorded in disposalIntegrity.sessionOverlapCount',
    (s) => { s.summary.lifecycle.disposalIntegrity.sessionOverlapCount = 1; }, 'overlap'],
  ['an overlap recorded in lifecycle.sessionOverlapCount',
    (s) => { s.summary.lifecycle.sessionOverlapCount = 1; }, 'overlap'],
  ['an unresolved session recorded in disposalIntegrity.unresolvedSessionCount',
    (s) => { s.summary.lifecycle.disposalIntegrity.unresolvedSessionCount = 1; }, 'unresolvedSessionCount'],
  ['a missing lifecycle.unresolvedSessionCount',
    (s) => { delete s.summary.lifecycle.unresolvedSessionCount; }, 'unresolvedSessionCount'],
  ['a missing lifecycle.sessionOverlapCount',
    (s) => { delete s.summary.lifecycle.sessionOverlapCount; }, 'overlap'],
  ['unbalanced disposal counters with zero disposal failures (DUAL-3 shape)',
    (s) => { Object.assign(s.summary.lifecycle.disposalIntegrity, { countersBalanced: false, clean: false, finalDisposed: 10 }); },
    'countersBalanced'],
  ['disposalIntegrity.clean !== true with everything else sound',
    (s) => { s.summary.lifecycle.disposalIntegrity.clean = false; }, 'clean'],
  ['a single-model packet missing safety-reader',
    (s) => { s.summary.lifecycle.componentRequestCounts = { embedder: 11, 'safety-reader': 0 }; }, 'safety-reader'],
  ['a single-model packet missing embedder',
    (s) => { s.summary.lifecycle.componentRequestCounts = { embedder: 0, 'safety-reader': 11 }; }, 'embedder'],
  ['a packet with no componentRequestCounts at all',
    (s) => { delete s.summary.lifecycle.componentRequestCounts; }, 'componentRequestCounts'],
]) {
  const s = soundSession();
  mutate(s);
  const d = checkMeasuredEvidence(s);
  check(`ITEM3 [D]: REJECTS ${label}`, d.ok === false && String(d.reason).includes(needle), d.reason ?? '');
  check(`ITEM3 gate: ${label} turns the reviewed gate RED`, gateWith(s).ok === false);
}

// [G]: the same properties must be RE-DERIVED from the raw bytes, not believed.
const provenanceOf = (path) => verifyEvidencePacket({ sessionPath: path, requireManifest: false });
const gOf = (v) => checkEvidenceProvenance({ ...v, manifestChecked: true });
{
  const pkt = makePacket();
  const v = provenanceOf(sealPacket(pkt));
  check('ITEM3 [G]: positive control — sequential dual-model packet is BOUND',
    v.ok === true && gOf(v).ok === true, v.problems.join('; ').slice(0, 160));
  rmSync(pkt.dir, { recursive: true, force: true });
}
for (const [label, opts, honest, needle] of [
  ['concurrent embedder + safety-reader sessions in one PID', { reader: 'overlap' }, (L) => {
    Object.assign(L, { correlatedRequestCount: 0, componentRequestCounts: { embedder: 0, 'safety-reader': 0 },
      sessionOverlapCount: 1, correlatedRequests: [], processIds: [] });
    Object.assign(L.disposalIntegrity, { sessionOverlapCount: 1, clean: false });
  }, 'sessionOverlapCount'],
  ['a single-model packet (no safety-reader lifecycle)', { reader: 'none' }, (L) => {
    Object.assign(L, { correlatedRequestCount: 1, componentRequestCounts: { embedder: 1, 'safety-reader': 0 },
      correlatedRequests: L.correlatedRequests.slice(0, 1) });
    Object.assign(L.disposalIntegrity, { finalCreated: 1, finalDisposed: 1 });
  }, 'safety-reader'],
  ['a single-model packet (no embedder lifecycle)', { embedder: false }, (L) => {
    Object.assign(L, { correlatedRequestCount: 1, componentRequestCounts: { embedder: 0, 'safety-reader': 1 },
      correlatedRequests: L.correlatedRequests.slice(1) });
    Object.assign(L.disposalIntegrity, { finalCreated: 1, finalDisposed: 1 });
  }, 'embedder'],
  ['unbalanced disposal (a created session never disposed, no disposal failure)', { danglingEmbedder: true }, (L) => {
    L.unresolvedSessionCount = 1;
    Object.assign(L.disposalIntegrity, {
      finalCreated: 3, finalDisposed: 2, countersBalanced: false, unresolvedSessionCount: 1, clean: false,
    });
  }, 'countersBalanced'],
]) {
  const pkt = makePacket(opts);
  const path = sealPacket(pkt);
  const doc = JSON.parse(readFileSync(path, 'utf-8'));
  honest(doc.summary.lifecycle);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  const v = provenanceOf(path);
  check(`ITEM3 [G]: REJECTS ${label} even when the packet states it honestly`,
    v.ok === false && v.problems.some((p) => p.includes(needle)) && gOf(v).ok === false,
    v.problems.join('; ').slice(0, 160));
  rmSync(pkt.dir, { recursive: true, force: true });
}
for (const [label, tamper, needle] of [
  ['an inflated embedder count', (L) => { L.componentRequestCounts.embedder += 1; }, 'componentRequestCounts.embedder'],
  ['an inflated safety-reader count', (L) => { L.componentRequestCounts['safety-reader'] += 1; }, 'componentRequestCounts.safety-reader'],
  ['a missing componentRequestCounts', (L) => { delete L.componentRequestCounts; }, 'componentRequestCounts'],
  ['a lifecycle.unresolvedSessionCount the log contradicts', (L) => { L.unresolvedSessionCount = 1; }, 'unresolvedSessionCount'],
  ['a disposalIntegrity.unresolvedSessionCount the log contradicts', (L) => { L.disposalIntegrity.unresolvedSessionCount = 1; }, 'unresolvedSessionCount'],
  ['a lifecycle.sessionOverlapCount the log contradicts', (L) => { L.sessionOverlapCount = 1; }, 'sessionOverlapCount'],
  ['a disposalIntegrity.sessionOverlapCount the log contradicts', (L) => { L.disposalIntegrity.sessionOverlapCount = 1; }, 'sessionOverlapCount'],
  ['a countersBalanced the log contradicts', (L) => { L.disposalIntegrity.countersBalanced = false; }, 'countersBalanced'],
  ['a clean flag the log contradicts', (L) => { L.disposalIntegrity.clean = false; }, 'disposalIntegrity.clean'],
  ['a sampledProcessIds list the raw dumps contradict', (L) => { L.sampledProcessIds = [4242, 1]; }, 'sampledProcessIds'],
  ['a correlated request attributed to an unsampled PID', (L) => { L.correlatedRequests[0].pid = 1; }, 'sampledProcessIds'],
]) {
  const pkt = makePacket();
  const path = sealPacket(pkt);
  const doc = JSON.parse(readFileSync(path, 'utf-8'));
  tamper(doc.summary.lifecycle);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  const v = provenanceOf(path);
  check(`ITEM3 [G]: re-derivation catches ${label}`,
    v.ok === false && v.problems.some((p) => p.includes(needle)), v.problems.join('; ').slice(0, 160));
  rmSync(pkt.dir, { recursive: true, force: true });
}
{
  // Cold-restart PID recurrence (4242 -> 5555 -> 4242) is refused by provenance.
  const pkt = makePacket();
  const original = [...pkt.session.samples];
  for (const [offset, pid] of [[3000, 5555], [6000, 4242]]) {
    for (const sample of original) {
      const seq = pkt.session.samples.length + 1;
      const rawFile = join(pkt.dir, `sample-${seq}-recur.txt`);
      writeFileSync(rawFile, readFileSync(sample.rawFile, 'utf8').replace('pid 4242', `pid ${pid}`));
      pkt.session.samples.push({ ...sample, seq, rawFile, captureStartMs: sample.captureStartMs + offset,
        atUtc: new Date(sample.captureStartMs + offset).toISOString() });
    }
  }
  pkt.binding = computeEvidenceBinding({ evidenceDir: pkt.dir, session: pkt.session });
  const v = provenanceOf(sealPacket(pkt));
  check('ITEM3 [G]: cold-restart PID recurrence 4242 -> 5555 -> 4242 is REJECTED',
    v.ok === false && v.problems.some((p) => p.includes('Cold-restart PID continuity violation')),
    v.problems.join('; ').slice(0, 160));
  rmSync(pkt.dir, { recursive: true, force: true });
}

// =============================================================================
console.log('\n[15] WO02-SOL-03 — sealed packets bind candidate_manifest.json & ratified safety-reader SHA-256');

const EMPTY_DIFF_SHA256 = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
function buildCandidateManifest(repoRoot, overrides = {}) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const diffBuf = execFileSync('git', ['diff', '--full-index', '--binary', 'HEAD'], {
    cwd: repoRoot, maxBuffer: 256 * 1024 * 1024,
  });
  const fp = createHash('sha256').update(diffBuf).digest('hex');
  const ownerArtifacts = new Set(['TASK.md', 'audit_task_b.mjs']);
  const stagedNew = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=A', '-z'], {
    cwd: repoRoot, encoding: 'utf8',
  }).split('\0').filter((p) => p.length > 0 && !ownerArtifacts.has(p));
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: repoRoot, encoding: 'utf8',
  }).split('\0').filter((p) => p.length > 0 && !ownerArtifacts.has(p) && !stagedNew.includes(p)).sort();
  const newFiles = [...stagedNew, ...untracked].map((rel) => ({
    path: rel.replace(/\\/g, '/'),
    sha256: sha256OfFile(join(repoRoot, rel)),
  }));
  return {
    schema: 'ak.candidate-manifest/1',
    label: 'NON_PRODUCTION_QA_DEBUG_SIGNED',
    head,
    branch,
    sourceDirty: fp !== EMPTY_DIFF_SHA256,
    trackedDiffFingerprint: {
      method: 'sha256(git diff --full-index --binary HEAD)',
      value: fp,
    },
    newFiles,
    qaLifecycleTelemetry: true,
    safetyReader: {
      id: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      releaseTag: 'ml-reader-m10-r15-s3',
      releaseCommit: 'b6ceee70c7b7a9afd793968e8ca15ba17704b572',
      assetId: 775095775,
      assetPath: 'assets/safety_reader.onnx',
      sha256: 'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf',
      sizeBytes: 22881187,
    },
    ...overrides,
  };
}

function sealFullManifestDir(pkt, candidateManifestObj = undefined) {
  if (candidateManifestObj !== undefined) {
    writeFileSync(join(pkt.dir, 'candidate_manifest.json'), JSON.stringify(candidateManifestObj, null, 2));
  }
  pkt.binding = computeEvidenceBinding({ evidenceDir: pkt.dir, session: pkt.session });
  const sessionPath = sealPacket(pkt);
  const manifestEntries = [
    { path: 'session.json', sha256: sha256OfFile(sessionPath) },
    { path: 'logcat-epoch.txt', sha256: sha256OfFile(join(pkt.dir, 'logcat-epoch.txt')) },
    ...pkt.session.samples.map((s) => {
      const name = s.rawFile.split(/[\\/]/).pop();
      return { path: name, sha256: sha256OfFile(s.rawFile) };
    }),
  ];
  if (candidateManifestObj !== undefined) {
    manifestEntries.push({
      path: 'candidate_manifest.json',
      sha256: sha256OfFile(join(pkt.dir, 'candidate_manifest.json')),
    });
  }
  const manifestPath = join(pkt.dir, 'EVIDENCE_MANIFEST.json');
  writeFileSync(manifestPath, JSON.stringify({ files: manifestEntries }, null, 2));
  writeFileSync(`${manifestPath}.sha256`, `${sha256OfFile(manifestPath)}  EVIDENCE_MANIFEST.json\n`);
  return { sessionPath, manifestPath };
}

const tempRepo = mkdtempSync(join(tmpdir(), 'ak-cand-prov-'));
try {
  const gitTmp = (args) => execFileSync('git', args, { cwd: tempRepo, encoding: 'utf8' });
  gitTmp(['init', '-q']);
  const excludesFile = join(tempRepo, '.git', 'fixture-excludes');
  writeFileSync(excludesFile, '');
  gitTmp(['config', '--local', 'core.excludesFile', excludesFile]);
  mkdirSync(join(tempRepo, 'src'), { recursive: true });
  writeFileSync(join(tempRepo, 'src', 'tracked.mjs'), 'export const x = 1;\n');
  gitTmp(['add', 'src/tracked.mjs']);
  gitTmp([
    '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false',
    'commit', '-qm', 'init',
  ]);

  const VALID_CANDIDATE_MANIFEST = buildCandidateManifest(tempRepo);

  {
    // Positive control: sealed packet with valid candidate_manifest.json passes [D] and [G].
    const pkt = makePacket();
    const { sessionPath } = sealFullManifestDir(pkt, VALID_CANDIDATE_MANIFEST);
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    const sessionDoc = JSON.parse(readFileSync(sessionPath, 'utf-8'));
    sessionDoc.summary.candidateManifest = VALID_CANDIDATE_MANIFEST;
    const g = evaluateMemoryGate({
      budget: REVIEWED_BUDGET, vectors: VECTORS, session: sessionDoc, evidenceProvenance: v,
    });
    check('SOL-03: sealed packet with valid candidate_manifest.json + ratified safetyReader hash is BOUND and GREEN',
      v.ok === true && v.manifestChecked === true && g.ok === true,
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  {
    // Counterexample 1: sealed packet omitting candidate_manifest.json altogether is REJECTED by [G].
    const pkt = makePacket();
    const { sessionPath } = sealFullManifestDir(pkt, undefined);
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    check('SOL-03: sealed packet without candidate_manifest.json is REJECTED by [G]',
      v.ok === false && v.problems.some((p) => p.includes('candidate_manifest.json')),
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  for (const [label, badManifest] of [
    ['safetyReaderPresent:true with missing safetyReaderModelSha256', {
      schema: 'ak.candidate-manifest/1',
      safetyReaderPresent: true,
    }],
    ['safetyReaderPresent:true with wrong safetyReaderModelSha256', {
      schema: 'ak.candidate-manifest/1',
      safetyReaderPresent: true,
      safetyReaderModelSha256: '0'.repeat(64),
    }],
    ['APK safetyReader object with wrong flattened size', {
      ...VALID_CANDIDATE_MANIFEST,
      safetyReaderModelSizeBytes: VALID_CANDIDATE_MANIFEST.safetyReader.sizeBytes - 1,
    }],
    ['APK safetyReader object with wrong sha256', {
      ...VALID_CANDIDATE_MANIFEST,
      safetyReader: { ...VALID_CANDIDATE_MANIFEST.safetyReader, sha256: 'b'.repeat(64) },
    }],
    ['candidate_manifest.json omitting safetyReader completely', {
      schema: 'ak.candidate-manifest/1',
      label: 'NON_PRODUCTION_QA_DEBUG_SIGNED',
    }],
  ]) {
    const pkt = makePacket();
    const { sessionPath } = sealFullManifestDir(pkt, badManifest);
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    const s = soundSession({ candidateManifest: badManifest });
    const d = checkMeasuredEvidence(s);
    check(`SOL-03 [G]: REJECTS ${label}`,
      v.ok === false && v.problems.some((p) => /safetyReader|safety-reader/i.test(p)),
      v.problems.join('; ').slice(0, 160));
    check(`SOL-03 [D]: REJECTS ${label}`,
      d.ok === false && /safetyReader|safety-reader/i.test(String(d.reason)),
      String(d.reason ?? '').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  for (const tamper of ['evidence binding', 'manifest hash']) {
    const pkt = makePacket();
    const { sessionPath, manifestPath } = sealFullManifestDir(pkt, VALID_CANDIDATE_MANIFEST);
    try {
      const verify = () => verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
      const baseline = verify();
      check(`SOL-03: untampered ${tamper} fixture verifies`,
        baseline.ok === true && baseline.manifestChecked === true && baseline.problems.length === 0,
        baseline.problems.join('; '));

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const member = manifest.files.find((file) => file.path === 'candidate_manifest.json');
      if (tamper === 'evidence binding') {
        // Re-seal membership for the changed candidate bytes, leaving the packet's binding stale.
        const candidatePath = join(pkt.dir, member.path);
        writeFileSync(candidatePath, JSON.stringify({ ...VALID_CANDIDATE_MANIFEST, tampered: true }, null, 2));
        member.sha256 = sha256OfFile(candidatePath);
      } else {
        // Change the recorded member hash without changing any evidence files.
        member.sha256 = '0'.repeat(64);
      }
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      writeFileSync(`${manifestPath}.sha256`, `${sha256OfFile(manifestPath)}  EVIDENCE_MANIFEST.json\n`);

      const v = verify();
      if (tamper === 'evidence binding') {
        check('SOL-03: stale candidate evidence binding is rejected with valid manifest hashes',
          v.ok === false && v.manifestChecked === true && v.problems.length === 2
            && v.problems.includes('1 raw input(s) do not match the binding: candidate_manifest.json (bytes differ)')
            && v.problems.some((p) => p.startsWith('bindingDigest mismatch:')),
          v.problems.join('; '));
      } else {
        check('SOL-03: wrong candidate manifest hash is rejected with a valid evidence binding',
          v.ok === false && v.manifestChecked === true && v.problems.length === 1
            && v.problems.includes('raw input candidate_manifest.json differs from its sealed manifest entry'),
          v.problems.join('; '));
      }
    } finally {
      rmSync(pkt.dir, { recursive: true, force: true });
    }
  }

  {
    // Round-2 counterexample (SOL-03-R2): an authentic sealed packet from an OLDER
    // git HEAD (41bc6915...) carrying the valid safetyReader hash MUST be rejected
    // against the fixture repo so old device evidence cannot satisfy a newer APK.
    const pkt = makePacket();
    const staleManifest = buildCandidateManifest(tempRepo, {
      head: '41bc69154dca84327d3b22e14a12333349d280c5',
    });
    const { sessionPath } = sealFullManifestDir(pkt, staleManifest);
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    check('SOL-03-R2: sealed packet naming stale APK HEAD 41bc6915 is REJECTED against the fixture repo',
      v.ok === false && v.problems.some((p) => p.includes('HEAD mismatch')),
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  {
    // Round-4 counterexamples (SOL-03-R4): candidate_manifest.json completeness:
    //   1. Wrong trackedDiffFingerprint.method (even when value matches fixture diff)
    //   2. Wrong schema or label
    //   3. Wrong sourceDirty boolean
    //   4. Surplus tracked path listed in newFiles
    //   5. Omitted current untracked source file in repoRoot
    //   6. Omitted current staged-new source file in repoRoot
    //   7. Positive control in temp git repo when both staged-new + untracked files are accurately pinned
    for (const [label, mutOverrides, needle] of [
      ['wrong trackedDiffFingerprint.method', {
        trackedDiffFingerprint: {
          method: 'sha256(git diff HEAD)',
          value: VALID_CANDIDATE_MANIFEST.trackedDiffFingerprint.value,
        },
      }, /method/i],
      ['wrong candidate_manifest schema', { schema: 'ak.candidate-manifest/999' }, /schema/i],
      ['wrong candidate_manifest label', { label: 'PRODUCTION_RELEASE' }, /label/i],
      ['contradictory sourceDirty flag', { sourceDirty: !VALID_CANDIDATE_MANIFEST.sourceDirty }, /sourceDirty/i],
      ['surplus tracked path in newFiles', {
        newFiles: [
          ...VALID_CANDIDATE_MANIFEST.newFiles,
          { path: 'src/tracked.mjs', sha256: sha256OfFile(join(tempRepo, 'src/tracked.mjs')) },
        ],
      }, /surplus|newFiles/i],
    ]) {
      const pkt = makePacket();
      const { sessionPath } = sealFullManifestDir(pkt, { ...VALID_CANDIDATE_MANIFEST, ...mutOverrides });
      const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
      check(`SOL-03-R4: REJECTS ${label}`,
        v.ok === false && v.problems.some((p) => needle.test(p)),
        v.problems.join('; ').slice(0, 160));
      rmSync(pkt.dir, { recursive: true, force: true });
    }
  }

  // Case A: current untracked source file in repoRoot omitted from candidate_manifest.json newFiles
  writeFileSync(join(tempRepo, 'src', 'untracked_helper.mjs'), 'export const y = 2;\n');
  {
    const pkt = makePacket();
    const { sessionPath } = sealFullManifestDir(pkt, buildCandidateManifest(tempRepo, { newFiles: [] }));
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    check('SOL-03-R4: REJECTS packet omitting a current untracked source file in repoRoot',
      v.ok === false && v.problems.some((p) => p.includes('src/untracked_helper.mjs')),
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  // Case B: current staged-new source file in repoRoot omitted from candidate_manifest.json newFiles
  writeFileSync(join(tempRepo, 'src', 'staged_new.mjs'), 'export const z = 3;\n');
  gitTmp(['add', 'src/staged_new.mjs']);
  {
    const pkt = makePacket();
    const onlyUntracked = [{
      path: 'src/untracked_helper.mjs',
      sha256: sha256OfFile(join(tempRepo, 'src', 'untracked_helper.mjs')),
    }];
    const { sessionPath } = sealFullManifestDir(pkt, buildCandidateManifest(tempRepo, { newFiles: onlyUntracked }));
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    check('SOL-03-R4: REJECTS packet omitting a staged-new source file in repoRoot',
      v.ok === false && v.problems.some((p) => p.includes('src/staged_new.mjs')),
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }

  // Case C: Positive control — when BOTH staged-new and untracked files are accurately pinned in newFiles
  {
    const pkt = makePacket();
    const { sessionPath } = sealFullManifestDir(pkt, buildCandidateManifest(tempRepo));
    const v = verifyEvidencePacket({ sessionPath, repoRoot: tempRepo });
    check('SOL-03-R4: ACCEPTS packet when staged-new and untracked source files match worktree exactly',
      v.ok === true && v.status === 'BOUND' && v.problems.length === 0,
      v.problems.join('; ').slice(0, 160));
    rmSync(pkt.dir, { recursive: true, force: true });
  }
} finally {
  rmSync(tempRepo, { recursive: true, force: true });
}

console.log(`\n${fail === 0 ? 'ALL MEMORY GATE FIXTURES PASSED' : `${fail} MEMORY GATE FIXTURE(S) FAILED`}`);
process.exit(fail ? 1 : 0);
