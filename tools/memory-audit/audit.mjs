/**
 * audit.mjs — the memory gate CLI.
 *
 * Footprint model:
 *   steady dirty = Hermes/RN/UI + SQLite + packed codebase matrix
 *   envelope     = steady + transient embedder allowance (single embed call)
 * The codebase matrix size is computed from the SHIPPED asset, so growing the
 * phrase dictionary is automatically re-audited. Also gates against the
 * generative stack sneaking back in (llama.rn in any manifest).
 *
 * Section [2] implements the owner-ratified decision of 2026-08-23, option 1:
 * "Retain 100 MB, fix the gate honestly". `embedderTransientBytes` stays at
 * 104,857,600 and the ceiling stays at exactly 450,000,000 decimal bytes; what
 * changed is that the gate no longer lets a conservative COMPONENT ENVELOPE
 * pass itself off as MEASURED PHYSICAL EVIDENCE. See memory_gate.mjs for the
 * pure logic and test_memory_gate.mjs for the falsifiers.
 *
 * The envelope contract [A] is expected to FAIL until the modelled envelope is
 * genuinely reduced with allocation/lifetime evidence. That failure is a real
 * failure with a non-zero exit code — never an advisory warning. Lowering a
 * declared estimate to make it green is blocked outright by [E].
 *
 * Run:  node tools/memory-audit/audit.mjs
 *   optional: AK_MEM_EVIDENCE_SESSION=<path to session.json from the harness>
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  MiB,
  RATIFIED_CEILING_BYTES,
  PREFERRED_TARGET_BYTES,
  CEILING_MIB_READING_BYTES,
  alternateUnitReadingBytes,
  evaluateMemoryGate,
} from './memory_gate.mjs';
import { verifyEvidencePacket } from './evidence_provenance.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const budget = JSON.parse(readFileSync(join(import.meta.dirname, 'budget.json'), 'utf-8'));
const vectors = JSON.parse(readFileSync(
  join(ROOT, 'packages', 'inference', 'assets', 'phrase-codebase.vectors.json'), 'utf-8'));
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

const fmt = (b) => `${(b / MiB).toFixed(1)} MiB`;
const n = (b) => Number(b).toLocaleString('en-US');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

console.log('[0] generative stack stays removed');
const allDeps = JSON.stringify({ ...rootPkg.dependencies, ...rootPkg.devDependencies });
check('no llama.rn dependency', !allDeps.includes('llama.rn'));

console.log('\n[1] footprint vs device-tier limits');
const matrixBytes = vectors.count * vectors.dim * 4;
const steady =
  budget.runtimeDirtyBytes.hermesAndUi + budget.runtimeDirtyBytes.sqliteLayer + matrixBytes;
const envelope = steady + budget.embedderTransientBytes;
console.log(
  `  codebase matrix ${fmt(matrixBytes)} (${vectors.count} x ${vectors.dim}), `
  + `steady dirty ${fmt(steady)}, envelope (embed in flight) ${fmt(envelope)}`);
check('codebase matrix stays trivial (< 8 MiB; Path A assumption)', matrixBytes < 8 * MiB,
  fmt(matrixBytes));
for (const tier of budget.deviceTiers) {
  check(`${tier.name}: envelope within limit`, envelope <= tier.maxDirtyBytes,
    `${fmt(envelope)} <= ${fmt(tier.maxDirtyBytes)}`);
  check(`${tier.name}: >=50% headroom at envelope`, envelope <= tier.maxDirtyBytes * 0.5,
    `${Math.round((1 - envelope / tier.maxDirtyBytes) * 100)}% headroom`);
}

// --- [2] the ratified product ceiling, honestly gated -----------------------------
console.log('\n[2] component envelope vs measured evidence vs the ratified ceiling');

const sessionPath = process.env.AK_MEM_EVIDENCE_SESSION;
let session = null;
let sessionNote = 'no packet supplied';
if (sessionPath) {
  if (!existsSync(sessionPath)) {
    sessionNote = `packet path does not exist: ${sessionPath}`;
  } else {
    try {
      session = JSON.parse(readFileSync(sessionPath, 'utf-8'));
      sessionNote = sessionPath;
    } catch (e) {
      sessionNote = `packet unreadable: ${String(e.message).slice(0, 120)}`;
    }
  }
}

// [G] Hermes B-1: DIGEST what we are about to believe. A summary is a claim
// about evidence; the raw logcat and meminfo dumps are the evidence. Without
// this, a hand-written packet satisfied [D] and opened [A]'s review band.
const evidenceProvenance = sessionPath
  ? verifyEvidencePacket({
    sessionPath: sessionPath,
    // Left undefined on purpose so evidence_provenance resolves it: explicit
    // arg -> AK_MEM_EVIDENCE_MANIFEST -> discovery beside the packet. Passing
    // `?? null` here is what made the seal check opt-in (Hermes R4-1).
    manifestPath: undefined,
  })
  : null;

const gate = evaluateMemoryGate({ budget, vectors, session, evidenceProvenance });
const byId = Object.fromEntries(gate.checks.map((c) => [c.id, c]));

console.log(
  `  ENVELOPE E (conservative, UNMEASURED component allowances, authored in MiB)\n`
  + `    steady            ${n(gate.envelope.steadyBytes).padStart(13)} B\n`
  + `  + embedder transient${n(gate.envelope.embedderTransientBytes).padStart(13)} B   (ratified 2026-08-23: RETAINED)\n`
  + `  = envelope          ${n(gate.envelope.envelopeBytes).padStart(13)} B  = ${(gate.envelope.envelopeBytes / 1e6).toFixed(3)} MB = ${(gate.envelope.envelopeBytes / MiB).toFixed(4)} MiB\n`
  + `    target T          ${n(PREFERRED_TARGET_BYTES).padStart(13)} B  = ${(PREFERRED_TARGET_BYTES / 1e6).toFixed(3)} MB = ${(PREFERRED_TARGET_BYTES / MiB).toFixed(4)} MiB   (preferred operating target)\n`
  + `    ceiling C         ${n(RATIFIED_CEILING_BYTES).padStart(13)} B  = ${(RATIFIED_CEILING_BYTES / 1e6).toFixed(3)} MB = ${(RATIFIED_CEILING_BYTES / MiB).toFixed(4)} MiB   (HARD — exceeding blocks release)\n`
  + `    band              ${String(byId.A.band).padStart(13)}\n`
  + `    vs target         ${(byId.A.overTargetByBytes > 0 ? 'OVER BY ' : 'under by')} ${n(Math.abs(byId.A.overTargetByBytes)).padStart(13)} B\n`
  + `    vs ceiling        ${(byId.A.overByBytes > 0 ? 'OVER BY ' : 'under by')} ${n(Math.abs(byId.A.overByBytes)).padStart(13)} B  = ${(Math.abs(byId.A.overByBytes) / MiB).toFixed(4)} MiB`);

check('[A] component envelope satisfies the ratified contract '
  + '(<= 450,000,000 B outright, or <= 536,870,912 B with device evidence and review)',
  byId.A.ok,
  byId.A.reason ?? `${byId.A.band}: ${n(gate.envelope.envelopeBytes)} B <= `
    + `${n(RATIFIED_CEILING_BYTES)} B${byId.A.note ? ` — ${byId.A.note}` : ''}`);

check('[B] the verdict does not depend on reading the ceiling as MB vs MiB',
  byId.B.ok,
  `as ratified ${n(RATIFIED_CEILING_BYTES)} B -> ${byId.B.passesUnderDecimal ? 'pass' : 'fail'}; `
  + `alternate unit reading ${n(alternateUnitReadingBytes(RATIFIED_CEILING_BYTES))} B -> `
  + `${byId.B.passesUnderMiB ? 'pass' : 'fail'}`);

check('[C] the envelope includes every component (embedder cannot be silently omitted)',
  byId.C.ok, byId.C.reason ?? `steady ${n(byId.C.steadyBytes)} + embedder ${n(byId.C.embedderTransientBytes)}`);

console.log(`  MEASURED M (authorized-device evidence): ${sessionNote}`);
if (byId.D.maxSampledPrivateDirtyBytes !== null) {
  console.log(
    `    max sampled Private Dirty ${n(byId.D.maxSampledPrivateDirtyBytes)} B`
    + `  (${byId.D.correlatedRequestCount} correlated request(s), median sampling interval `
    + `${byId.D.achievedMedianIntervalMs} ms)\n`
    + `    status ${byId.D.status}: ${byId.D.interpretation}`);
}
check('[D] measured physical evidence exists and is internally sound',
  byId.D.ok, byId.D.reason ?? `${byId.D.status}`);

check('[E] no declared estimate has been lowered below its ratified floor',
  byId.E.ok, byId.E.reason ?? 'all component estimates at or above their ratified floors');

check('[F] one ceiling applies to every device tier (no higher allowance for better hardware)',
  byId.F.ok, byId.F.reason ?? `${byId.F.tierCount} tier(s), no per-tier allowance override`);

if (byId.G) {
  if (byId.G.packetSha256) {
    console.log(
      `  PACKET PROVENANCE  session.json sha256 ${byId.G.packetSha256}
`
      + `    raw-input binding digest ${byId.G.bindingDigest ?? '(none)'}
`
      + `    manifest membership ${byId.G.manifestChecked ? `CHECKED (${byId.G.manifestSource})` : 'ABSENT — REQUIRED, gate fails closed'}`
      + (byId.G.rederived
        ? `
    re-derived from raw bytes: ${byId.G.rederived.correlatedRequestCount} correlated `
          + `request(s), pid(s) ${JSON.stringify(byId.G.rederived.processIds)}, epoch(s) `
          + `${JSON.stringify(byId.G.rederived.wrapperEpochs)}, ${byId.G.rederived.disposalFailureCount} `
          + `disposal failure(s), max ${n(byId.G.rederived.maxSampledPrivateDirtyBytes)} B`
        : ''));
  }
  check('[G] the packet claims are re-derivable from its own sealed raw bytes',
    byId.G.ok, byId.G.reason ?? `${byId.G.status}`);
}

console.log(
  `\n  RATIFIED 2026-08-24: hard ceiling ${n(RATIFIED_CEILING_BYTES)} B (512 MiB), preferred\n`
  + `        target ${n(PREFERRED_TARGET_BYTES)} B. An envelope between them is permitted ONLY\n`
  + '        with physical-device evidence [D] AND an explicit review record naming that\n'
  + '        exact envelope value; the record goes stale the moment the envelope moves.\n'
  + '        Above the hard ceiling nothing rescues it. The same ceiling applies to every\n'
  + '        supported device — better hardware buys no extra allowance [F].\n'
  + '\n  NOTE  [A] is a contractual check on a CONSERVATIVE ENVELOPE of unmeasured\n'
  + '        allowances. [D] is separate physical evidence and is SUBORDINATE: a sound\n'
  + '        evidence packet can never satisfy [A] on the envelope\'s behalf, and a\n'
  + '        sampled maximum is a LOWER BOUND unless the packet\'s own cadence analysis\n'
  + '        says otherwise. Neither check is advisory; both affect the exit code.');

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
