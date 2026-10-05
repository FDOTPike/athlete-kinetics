/**
 * evidence_provenance.mjs — bind gate [D] to the SEALED BYTES it claims to
 * describe (Hermes audit r3, blocking finding B-1).
 *
 * The defect this module exists to close: `checkMeasuredEvidence` read a
 * `summary` object and believed it. A fifteen-line hand-written JSON asserting
 * `correlatedRequestCount: 11` and `disposalFailureCount: 0` satisfied [D],
 * and because the ratified review band makes [A] depend on [D], that single
 * fabricated file turned the ENTIRE memory gate green with zero device data.
 * The APK had provenance recomputation from Sol's round 1; the device evidence
 * packet did not. This is the same fix applied to the other artifact.
 *
 * The principle: a summary is not evidence, it is a CLAIM ABOUT evidence. The
 * evidence is the raw `logcat-epoch.txt` and the raw `sample-NNN-*.txt` dumps.
 * So every scalar the gate relies on is RE-DERIVED here from those bytes, using
 * the same pure functions `meminfo_harness finish` used, and compared against
 * what the packet claims. A packet whose claims are not reproducible from its
 * own raw bytes is rejected.
 *
 * What this DOES bind:
 *   - the exact bytes of every raw input, by digest;
 *   - every sample's Private Dirty value, re-parsed from its raw dump;
 *   - the achieved cadence, the continuity threshold and the segments;
 *   - the correlated request count and disposal integrity, re-correlated from
 *     the raw logcat;
 *   - the reported maximum and the peak-claim verdict.
 *
 * What it CANNOT bind, stated plainly:
 *   - Sample TIMESTAMPS are recorded by the harness at capture time and do not
 *     appear in a `dumpsys meminfo` dump, so they are asserted, not derivable.
 *     They are however CONSTRAINED: correlation requires lifecycle markers —
 *     which carry real device timestamps from logcat — to fall inside
 *     continuous segments built from those sample times. Shifting the sample
 *     timeline away from the logcat therefore breaks correlation.
 *   - A sufficiently determined fabricator could author a self-consistent raw
 *     corpus. Manifest binding (below) is the answer to that: the packet must
 *     be a member of an evidence manifest whose detached seal verifies.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

import { parseMeminfoDump, privateDirtyBytes } from './meminfo_parser.mjs';
import {
  computeCadence,
  computeSamplingSegments,
  correlateRequests,
  defaultContinuityGapMs,
  parseLifecycleMarkers,
  summarizeMemory,
} from './lifecycle_correlator.mjs';

export const EVIDENCE_BINDING_SCHEMA = 'ak.evidence-binding/1';

/** The raw logcat capture a packet is derived from. */
export const LOGCAT_FILENAME = 'logcat-epoch.txt';

export const sha256OfFile = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
export const sha256OfString = (s) => createHash('sha256').update(s, 'utf-8').digest('hex');

/**
 * The raw inputs a packet consumed, resolved INSIDE the packet directory.
 *
 * `session.samples[].rawFile` holds an absolute path from the capturing
 * machine. Resolving by basename against the packet directory keeps a packet
 * verifiable after it has been moved or archived, which is the normal case for
 * evidence.
 */
export function evidenceInputs({ evidenceDir, session }) {
  const inputs = [];
  const logcat = join(evidenceDir, LOGCAT_FILENAME);
  if (existsSync(logcat)) inputs.push({ name: LOGCAT_FILENAME, kind: 'logcat', path: logcat });
  for (const s of session?.samples ?? []) {
    const name = basename(String(s?.rawFile ?? ''));
    if (!name) continue;
    inputs.push({ name, kind: 'raw-meminfo-sample', path: join(evidenceDir, name), seq: s.seq });
  }
  return inputs;
}

/**
 * Canonical digest over the raw inputs. Sorted by name so the digest does not
 * depend on filesystem ordering, and newline-delimited `name  sha256` so it is
 * reproducible by hand (`sha256sum` output shape).
 */
export function computeEvidenceBinding({ evidenceDir, session }) {
  const inputs = evidenceInputs({ evidenceDir, session });
  const files = [];
  const missing = [];
  for (const i of inputs) {
    if (!existsSync(i.path)) { missing.push(i.name); continue; }
    files.push({ name: i.name, kind: i.kind, sizeBytes: statSync(i.path).size, sha256: sha256OfFile(i.path) });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  const canonical = files.map((f) => `${f.name}  ${f.sha256}`).join('\n');
  return {
    schema: EVIDENCE_BINDING_SCHEMA,
    fileCount: files.length,
    sampleFileCount: files.filter((f) => f.kind === 'raw-meminfo-sample').length,
    missingCount: missing.length,
    missing,
    files,
    bindingDigest: sha256OfString(canonical),
    note: 'bindingDigest = sha256 over the newline-joined, name-sorted "name  sha256" '
      + 'lines of every raw input this packet was derived from.',
  };
}

const near = (a, b, tol = 0) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** The sealed manifest's conventional filename, beside the run directories. */
export const MANIFEST_FILENAME = 'EVIDENCE_MANIFEST.json';

/**
 * Find the sealed manifest for a packet WITHOUT depending on an operator
 * remembering an environment variable.
 *
 * Hermes round-4 R4-1: manifest membership was checked only when
 * `AK_MEM_EVIDENCE_MANIFEST` happened to be set, and nothing in the shipped
 * `verify:release` set it. A self-consistent fabricated corpus therefore
 * reached `[A]`'s review band through the real release command. An opt-in
 * security control that the shipping path never opts into is not a control.
 *
 * Resolution order: explicit argument, then the environment override, then
 * discovery by walking up from the packet directory. Evidence packets live at
 * `<evidence root>/run-XXX/session.json` with the manifest at the root, so one
 * or two levels up finds it in the normal layout.
 */
export function resolveManifestPath({ evidenceDir, explicit = undefined, env = process.env } = {}) {
  if (explicit) return { path: explicit, source: 'explicit' };
  const fromEnv = env?.AK_MEM_EVIDENCE_MANIFEST;
  if (fromEnv) return { path: fromEnv, source: 'AK_MEM_EVIDENCE_MANIFEST' };
  let dir = evidenceDir;
  for (let i = 0; i < 4 && dir; i += 1) {
    const candidate = join(dir, MANIFEST_FILENAME);
    if (existsSync(candidate)) return { path: candidate, source: 'discovered beside the packet' };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { path: null, source: 'none' };
}

/**
 * Re-derive a packet's summary from its own raw bytes and compare.
 *
 * `requireManifest` defaults to TRUE and must stay that way: the manifest is
 * what distinguishes "these numbers are self-consistent" from "this evidence
 * was actually produced and sealed". Self-consistency alone is forgeable in a
 * few minutes, which is precisely what Hermes demonstrated.
 *
 * @param {{sessionPath:string, manifestPath?:string|null, requireManifest?:boolean}} args
 * @returns {{ok:boolean, status:'BOUND'|'MISMATCH'|'UNBOUND', problems:string[],
 *            packetSha256:string|null, bindingDigest:string|null,
 *            manifestChecked:boolean, rederived:object|null}}
 */
export function verifyEvidencePacket({
  sessionPath,
  manifestPath = undefined,
  requireManifest = true,
} = {}) {
  const problems = [];
  const fail = (status) => ({
    ok: false, status, problems, packetSha256: null, bindingDigest: null, rederived: null,
  });

  if (!sessionPath || !existsSync(sessionPath)) {
    problems.push(`evidence packet not found at ${sessionPath ?? '(no path given)'}`);
    return fail('UNBOUND');
  }
  const packetSha256 = sha256OfFile(sessionPath);
  const evidenceDir = dirname(sessionPath);

  let session;
  try {
    session = JSON.parse(readFileSync(sessionPath, 'utf-8'));
  } catch (e) {
    problems.push(`evidence packet is not parseable JSON: ${e.message}`);
    return { ...fail('UNBOUND'), packetSha256 };
  }

  const summary = session?.summary;
  if (!summary) {
    problems.push('packet has no summary — meminfo_harness finish did not complete');
    return { ...fail('UNBOUND'), packetSha256 };
  }

  // --- 1. the packet must CARRY a binding at all --------------------------
  const claimed = summary.evidenceBinding;
  if (!claimed || claimed.schema !== EVIDENCE_BINDING_SCHEMA) {
    problems.push('packet carries no evidenceBinding of schema '
      + `${EVIDENCE_BINDING_SCHEMA} — it asserts results without naming the raw bytes `
      + 'they came from, which is exactly the fabricated-packet hole this check closes');
    return { ...fail('UNBOUND'), packetSha256 };
  }

  // --- 2. re-hash every raw input ----------------------------------------
  const observed = computeEvidenceBinding({ evidenceDir, session });
  if (observed.missingCount > 0) {
    problems.push(`${observed.missingCount} raw input(s) named by the packet are absent from `
      + `${evidenceDir}: ${observed.missing.slice(0, 5).join(', ')}`
      + (observed.missing.length > 5 ? ` (+${observed.missing.length - 5} more)` : ''));
  }
  if (observed.fileCount !== claimed.fileCount) {
    problems.push(`raw input count changed: packet recorded ${claimed.fileCount}, `
      + `${observed.fileCount} present`);
  }
  const claimedByName = new Map((claimed.files ?? []).map((f) => [f.name, f.sha256]));
  const changed = [];
  for (const f of observed.files) {
    const was = claimedByName.get(f.name);
    if (was === undefined) { changed.push(`${f.name} (not in the binding)`); continue; }
    if (was !== f.sha256) changed.push(`${f.name} (bytes differ)`);
  }
  if (changed.length > 0) {
    problems.push(`${changed.length} raw input(s) do not match the binding: `
      + `${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ' …' : ''}`);
  }
  if (observed.bindingDigest !== claimed.bindingDigest) {
    problems.push(`bindingDigest mismatch: packet says ${String(claimed.bindingDigest).slice(0, 16)}…, `
      + `recomputed ${observed.bindingDigest.slice(0, 16)}… — the raw evidence is not the evidence `
      + 'this packet was sealed against');
  }

  // --- 3. re-parse every raw sample and re-derive its Private Dirty -------
  const samples = session.samples ?? [];
  let reparsed = 0;
  const valueMismatches = [];
  for (const s of samples) {
    const p = join(evidenceDir, basename(String(s?.rawFile ?? '')));
    if (!existsSync(p)) continue;
    let derived = null;
    try {
      derived = privateDirtyBytes(parseMeminfoDump(readFileSync(p, 'utf-8')));
    } catch { derived = null; }
    reparsed += 1;
    if (derived !== s.privateDirtyBytes) {
      valueMismatches.push(`sample ${s.seq}: packet says ${s.privateDirtyBytes}, raw dump yields ${derived}`);
    }
  }
  if (valueMismatches.length > 0) {
    problems.push(`${valueMismatches.length} sample value(s) are not what the raw dump says: `
      + `${valueMismatches.slice(0, 3).join('; ')}${valueMismatches.length > 3 ? ' …' : ''}`);
  }

  // --- 4. re-derive cadence, segments, correlation and memory ------------
  const logcatPath = join(evidenceDir, LOGCAT_FILENAME);
  let rederived = null;
  if (!existsSync(logcatPath)) {
    problems.push(`no ${LOGCAT_FILENAME} in the packet directory — the lifecycle claims cannot be re-derived`);
  } else {
    const sampleStarts = samples
      .map((s) => (Number.isFinite(s.captureStartMs) ? s.captureStartMs : Date.parse(s.atUtc)))
      .filter(Number.isFinite);
    const cadence = computeCadence(sampleStarts, {
      requestedIntervalMs: Number.isFinite(session.requestedIntervalMs) ? session.requestedIntervalMs : null,
    });
    const recordedGap = summary.sampling?.continuityGapMs;
    const defaultGap = defaultContinuityGapMs(cadence);
    if (Number.isFinite(recordedGap) && recordedGap !== defaultGap) {
      problems.push(`continuityGapMs ${recordedGap} is not the value derived from the achieved `
        + `cadence (${defaultGap}) — a widened continuity threshold makes unsampled holes look `
        + 'like coverage, so it may not be asserted by the packet');
    }
    const segments = computeSamplingSegments(sampleStarts, {
      continuityGapMs: Number.isFinite(recordedGap) ? recordedGap : defaultGap,
    });
    const { markers } = parseLifecycleMarkers(readFileSync(logcatPath, 'utf-8'), {
      tzOffsetMinutes: Number.isFinite(session.deviceUtcOffsetMinutes) ? session.deviceUtcOffsetMinutes : null,
      year: new Date(session.startedAtUtc).getUTCFullYear(),
    });
    const { qualified, disposalIntegrity } = correlateRequests({ markers, segments });
    const mem = summarizeMemory({
      samples: samples.map((s) => ({
        atUtcMs: Number.isFinite(s.captureStartMs) ? s.captureStartMs : Date.parse(s.atUtc),
        privateDirtyBytes: s.privateDirtyBytes,
      })),
      segments,
      qualified,
      cadence,
    });

    rederived = {
      sampleCount: sampleStarts.length,
      achievedMedianIntervalMs: cadence.medianIntervalMs,
      segmentCount: segments.length,
      correlatedRequestCount: qualified.length,
      correlatedRequestIds: qualified.map((q) => q.requestId),
      processIds: [...new Set(qualified.map((q) => q.pid))],
      wrapperEpochs: [...new Set(qualified.map((q) => q.wrapperEpoch))],
      disposalFailureCount: disposalIntegrity.disposalFailureCount,
      finalCreated: disposalIntegrity.finalCreated,
      finalDisposed: disposalIntegrity.finalDisposed,
      maxSampledPrivateDirtyBytes: mem.maxSampledPrivateDirtyBytes,
      peakClaimable: mem.peakClaimable,
    };

    const L = summary.lifecycle ?? {};
    const M = summary.memory ?? {};
    const S = summary.sampling ?? {};
    const cmp = [
      ['sampleCount', S.sampleCount, rederived.sampleCount],
      ['achievedMedianIntervalMs', S.achievedMedianIntervalMs, rederived.achievedMedianIntervalMs],
      ['correlatedRequestCount', L.correlatedRequestCount, rederived.correlatedRequestCount],
      ['disposalIntegrity.disposalFailureCount', L.disposalIntegrity?.disposalFailureCount, rederived.disposalFailureCount],
      ['disposalIntegrity.finalCreated', L.disposalIntegrity?.finalCreated, rederived.finalCreated],
      ['disposalIntegrity.finalDisposed', L.disposalIntegrity?.finalDisposed, rederived.finalDisposed],
      ['memory.maxSampledPrivateDirtyBytes', M.maxSampledPrivateDirtyBytes, rederived.maxSampledPrivateDirtyBytes],
    ];
    for (const [name, claimedVal, derivedVal] of cmp) {
      if (!near(claimedVal, derivedVal)) {
        problems.push(`${name}: packet claims ${claimedVal}, re-derivation from the raw bytes `
          + `yields ${derivedVal}`);
      }
    }
    if (M.peakClaimable !== rederived.peakClaimable) {
      problems.push(`memory.peakClaimable: packet claims ${M.peakClaimable}, re-derivation yields `
        + `${rederived.peakClaimable}`);
    }
  }

  // --- 5. MANDATORY: membership of a SEALED evidence manifest -------------
  // Steps 1-4 prove a packet is INTERNALLY CONSISTENT. They cannot prove it was
  // ever produced by a device, because a consistent corpus can simply be
  // authored. Only the seal — which an auditor verifies out of band via the
  // detached hash — distinguishes the two. This step is therefore required.
  const resolved = resolveManifestPath({ evidenceDir, explicit: manifestPath });
  let manifestChecked = false;
  if (resolved.path) {
    const r = verifyManifestMembership({
      manifestPath: resolved.path, evidenceDir, session, packetSha256,
    });
    problems.push(...r.problems);
    manifestChecked = true;
  } else if (requireManifest) {
    problems.push('no sealed evidence manifest found for this packet: internal consistency '
      + 'alone does not prove the evidence was produced rather than authored. Place '
      + `${MANIFEST_FILENAME} (with its detached .sha256) at the evidence root, or set `
      + 'AK_MEM_EVIDENCE_MANIFEST');
  }

  const ok = problems.length === 0;
  return {
    ok,
    status: ok ? 'BOUND' : 'MISMATCH',
    problems,
    packetSha256,
    bindingDigest: observed.bindingDigest,
    manifestChecked,
    manifestPath: resolved.path,
    manifestSource: resolved.source,
    rederived,
  };
}

/**
 * The packet and its raw inputs must be members of an evidence manifest whose
 * DETACHED seal verifies. This is what makes fabricating a self-consistent raw
 * corpus insufficient: the corpus would also have to be re-sealed, and the
 * detached hash is what an independent auditor checks first.
 */
export function verifyManifestMembership({ manifestPath, evidenceDir, session, packetSha256 }) {
  const problems = [];
  if (!existsSync(manifestPath)) {
    problems.push(`evidence manifest not found at ${manifestPath}`);
    return { ok: false, problems };
  }
  const detachedPath = `${manifestPath}.sha256`;
  if (!existsSync(detachedPath)) {
    problems.push(`no detached seal (${basename(detachedPath)}) beside the manifest — layer 2 missing`);
  } else {
    const want = readFileSync(detachedPath, 'utf-8').trim().split(/\s+/)[0];
    const got = sha256OfFile(manifestPath);
    if (want !== got) {
      problems.push(`manifest does not match its detached seal: seal says ${want.slice(0, 16)}…, `
        + `manifest hashes to ${got.slice(0, 16)}…`);
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    problems.push(`manifest is not parseable JSON: ${e.message}`);
    return { ok: problems.length === 0, problems };
  }

  const root = dirname(manifestPath);
  // Hermes R4 M3b: `relative()` is LEXICAL and case-sensitive, but Windows
  // resolves either case to the same file. A correctly-sealed packet reached
  // through a case-shifted path was therefore reported as "not a member" — a
  // false NEGATIVE that would push an operator toward disabling the check.
  // Compare case-insensitively where the filesystem is, and only there.
  const foldCase = process.platform === 'win32' || process.platform === 'darwin';
  const norm = (p) => (foldCase ? p.toLowerCase() : p);
  const rel = (p) => relative(root, p).split(sep).join('/');
  const byPath = new Map((manifest.files ?? []).map((f) => [norm(f.path), f.sha256]));

  const sessionRel = rel(join(evidenceDir, 'session.json'));
  const sealedSession = byPath.get(norm(sessionRel));
  if (sealedSession === undefined) {
    problems.push(`the packet (${sessionRel}) is not a member of the sealed manifest`);
  } else if (sealedSession !== packetSha256) {
    problems.push(`the packet's bytes differ from the sealed manifest entry for ${sessionRel}`);
  }

  for (const i of evidenceInputs({ evidenceDir, session })) {
    const r = rel(i.path);
    const sealed = byPath.get(norm(r));
    if (sealed === undefined) { problems.push(`raw input ${r} is not in the sealed manifest`); break; }
    if (existsSync(i.path) && sealed !== sha256OfFile(i.path)) {
      problems.push(`raw input ${r} differs from its sealed manifest entry`); break;
    }
  }

  return { ok: problems.length === 0, problems };
}
