/**
 * verify_qa_artifact.mjs — read-only QA artifact verifier (WO remediation B3,
 * hardened at P2).
 *
 * FAILS unless the exact QA APK contains:
 *   - a non-empty JavaScript/Hermes application bundle;
 *   - the generated candidate manifest (schema/label/telemetry opt-in intact,
 *     fingerprint METHOD and VALUE exact, staged/new paths unique + relative +
 *     SHA-256-shaped);
 *   - the expected package/variant identity (com.athletekinetics.qa, variant qa);
 *   - assets/minilm.onnx at exactly 22,972,370 bytes and the ratified SHA-256;
 *   - libonnxruntimejsi.so paired with libonnxruntime.so per supported ABI;
 *   - the Android Debug signing class, established from apksigner output or a
 *     real X.509 subject/issuer parse — never from a certificate size range;
 *   - 16 KB zip alignment (zipalign -c -P 16 4);
 *   - every ELF64 PT_LOAD segment aligned to at least 0x4000.
 *
 * TWO MODES.
 *   real-candidate (DEFAULT): external Android SDK tools are MANDATORY. They are
 *     discovered deterministically from ANDROID_HOME/ANDROID_SDK_ROOT (highest
 *     build-tools version) or named explicitly via AAPT_PATH/APKSIGNER_PATH/
 *     ZIPALIGN_PATH. If any is missing the artifact is REJECTED — it is never
 *     "passed" on the strength of values the manifest declares about itself.
 *   fixture (--fixture-mode): synthetic negative fixtures may bypass external
 *     tools and the ratified model hash. Fixture mode can never be reached from
 *     the real-candidate CLI path.
 *
 * Failure state is PER INVOCATION. The previous module-global counter leaked
 * across calls, so a bad artifact permanently poisoned every later verification
 * in the same process.
 *
 * Read-only by contract: the target file is never opened for writing; negative
 * tests operate on external scratch copies only (see test_verify_qa_artifact.mjs).
 *
 * Usage:
 *   node tools/verify_qa_artifact.mjs <apk-path>                  # real candidate
 *   node tools/verify_qa_artifact.mjs <apk-path> --fixture-mode   # synthetic only
 */
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

// --- contract constants --------------------------------------------------------
const MODEL_SIZE = 22972370;
const MODEL_SHA256 = 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1';
const PACKAGE_ID = 'com.athletekinetics.qa';
const MANIFEST_ASSET = 'assets/candidate_manifest.json';
const MANIFEST_SCHEMA = 'ak.candidate-manifest/1';
const MANIFEST_LABEL = 'NON_PRODUCTION_QA_DEBUG_SIGNED';
const MIN_ELF_LOAD_ALIGN = 0x4000;
const FINGERPRINT_METHOD = 'sha256(git diff --full-index --binary HEAD)';
const SHA256_RE = /^[0-9a-f]{64}$/;

/** The Android debug keystore has shipped in TWO distinguished-name shapes:
 *    classic Studio/AGP : C=US, O=Android, CN=Android Debug
 *    current keytool    : C=US, ST=Unknown, L=Unknown, O=Unknown, OU=Android,
 *                         CN=Android Debug        <- what this SDK generates
 *  The invariant across both, and the thing a QA artifact must prove, is:
 *  self-signed, CN exactly "Android Debug", C exactly "US", and "Android" as
 *  the organisation OR organisational unit. A release/upload key satisfies none
 *  of these, so this remains a real signing-class assertion and not a
 *  "self-signed is good enough" waiver. */
export const ANDROID_DEBUG_CN = 'Android Debug';
export const ANDROID_DEBUG_COUNTRY = 'US';
export const DEBUG_CLASS_DESCRIPTION =
  'self-signed, CN="Android Debug", C="US", with Android as O or OU';

/** Shared predicate for BOTH the X.509 parse and the apksigner DN, so the two
 *  paths can never disagree about what "debug class" means. */
export function isAndroidDebugClass(attrs) {
  if (!attrs) return false;
  return attrs.CN === ANDROID_DEBUG_CN
    && attrs.C === ANDROID_DEBUG_COUNTRY
    && (attrs.O === 'Android' || attrs.OU === 'Android');
}

/** Parse an apksigner-printed DN into the same shape parseDerName produces. */
export function parseDnString(dn) {
  const attrs = {};
  for (const part of String(dn ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    attrs[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return attrs;
}

export class QaRejectionError extends Error {}

// --- minimal ZIP central-directory reader (read-only) ---------------------------
/** Parses enough of a zip to enumerate entries with compressed data offsets.
 *  Works on unencrypted STORE/DEFLATE entries as produced by AGP. Throws on
 *  structural corruption before EOCD/CD invariants hold. */
export function readZipEntries(path) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size < 22) throw new Error('file too small to be a zip');
    const tailWindow = Math.min(size, 22 + 0xffff);
    const tail = Buffer.alloc(tailWindow);
    readSync(fd, tail, 0, tailWindow, size - tailWindow);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === 0x06054b50) { eocd = size - tailWindow + i; break; }
    }
    if (eocd < 0) throw new Error('end-of-central-directory not found');
    const eocdBuf = Buffer.alloc(22);
    readSync(fd, eocdBuf, 0, 22, eocd);
    if (eocdBuf.readUInt32LE(0) !== 0x06054b50) throw new Error('EOCD signature corrupt');
    const total = eocdBuf.readUInt16LE(10);
    const cdSize = eocdBuf.readUInt32LE(12);
    const cdOffset = eocdBuf.readUInt32LE(16);
    if (cdOffset + cdSize > size) throw new Error('central directory extends past end of file');
    const cd = Buffer.alloc(cdSize);
    readSync(fd, cd, 0, cdSize, cdOffset);

    const entries = new Map();
    let off = 0;
    for (let i = 0; i < total; i += 1) {
      if (off + 46 > cd.length || cd.readUInt32LE(off) !== 0x02014b50) {
        throw new Error(`central directory entry ${i} corrupt`);
      }
      const method = cd.readUInt16LE(off + 10);
      const compSize = cd.readUInt32LE(off + 20);
      const nameLen = cd.readUInt16LE(off + 28);
      const extraLen = cd.readUInt16LE(off + 30);
      const commentLen = cd.readUInt16LE(off + 32);
      const lfhOffset = cd.readUInt32LE(off + 42);
      const name = cd.toString('utf8', off + 46, off + 46 + nameLen);
      // Resolve the actual data offset through the local file header.
      const lfh = Buffer.alloc(30);
      readSync(fd, lfh, 0, 30, lfhOffset);
      if (lfh.readUInt32LE(0) !== 0x04034b50) throw new Error(`local header corrupt for ${name}`);
      const lNameLen = lfh.readUInt16LE(26);
      const lExtraLen = lfh.readUInt16LE(28);
      const dataOffset = lfhOffset + 30 + lNameLen + lExtraLen;
      entries.set(name, { name, method, compSize, dataOffset });
      off += 46 + nameLen + extraLen + commentLen;
    }
    return { entries, size, centralDirectoryOffset: cdOffset };
  } finally {
    closeSync(fd);
  }
}

export function extractEntryToBuffer(path, entry) {
  const fd = openSync(path, 'r');
  try {
    const raw = Buffer.alloc(entry.compSize);
    readSync(fd, raw, 0, entry.compSize, entry.dataOffset);
    if (entry.method === 0) return raw; // stored
    if (entry.method === 8) return inflateRawSync(raw); // deflate
    throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
  } finally {
    closeSync(fd);
  }
}

// --- ELF64 PT_LOAD alignment ----------------------------------------------------
/** Returns the minimum PT_LOAD alignment (p_align) of an ELF64 image, or null
 *  for non-ELF64 input. Throws on truncated/malformed headers. */
export function minElfLoadAlignment(bytes) {
  // e_ident: \x7f 'E' 'L' 'F' | EI_CLASS(4) | EI_DATA(5) | EI_VERSION(6) ...
  if (bytes.length < 64 || bytes[0] !== 0x7f || bytes[1] !== 0x45
    || bytes[2] !== 0x4c || bytes[3] !== 0x46) return null; // not ELF magic
  if (bytes[4] === 1) return null; // ELF32 -> informational, not certified here
  if (bytes[4] !== 2) throw new Error('unknown ELF class');
  if (bytes[5] !== 1 && bytes[5] !== 2) throw new Error('ELF with unknown data encoding');
  const le = bytes[5] === 1; // 1 = little-endian, 2 = big-endian
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const phOff = Number(le ? dv.getBigUint64(32, true) : dv.getBigUint64(32, false));
  const phEntSize = le ? dv.getUint16(54, true) : dv.getUint16(54, false);
  const phCount = le ? dv.getUint16(56, true) : dv.getUint16(56, false);
  if (phCount === 0 || phOff + phCount * phEntSize > bytes.length) {
    throw new Error('program header table out of bounds');
  }
  let min = Infinity;
  for (let i = 0; i < phCount; i += 1) {
    const base = phOff + i * phEntSize;
    const pType = le ? dv.getUint32(base, true) : dv.getUint32(base, false);
    if (pType !== 1) continue; // PT_LOAD
    const align = Number(le ? dv.getBigUint64(base + 48, true) : dv.getBigUint64(base + 48, false));
    if (align > 0 && align < min) min = align;
  }
  if (!Number.isFinite(min)) throw new Error('no PT_LOAD segments found');
  return min;
}

// --- APK Signing Block ----------------------------------------------------------
const SCHEME_IDS = { 0x7109871a: 'v2', 0xf05368c0: 'v3', 0x1b93ad61: 'v4' };

/** Reads the APK Signing Block ("APK Sig Block 42") that sits immediately before
 *  the central directory. Returns the id->payload pairs, or null when absent. */
function readSigningBlock(path) {
  const { size, centralDirectoryOffset: cdOffset } = readZipEntries(path);
  if (cdOffset < 40) return null;
  const fd = openSync(path, 'r');
  try {
    const footer = Buffer.alloc(24);
    readSync(fd, footer, 0, 24, cdOffset - 24);
    if (footer.toString('ascii', 8, 24) !== 'APK Sig Block 42') return null;
    const blockSize = Number(footer.readBigUint64LE(0));
    const start = cdOffset - blockSize - 8;
    if (start < 0 || start > size) throw new Error('signature block size corrupt');
    // `blockSize` counts the id-value pairs PLUS the trailing size field (8) and
    // the magic (16). The pairs region is therefore blockSize - 24 bytes, read
    // from just past the LEADING size field. (The previous arithmetic subtracted
    // an extra 8 and silently truncated the last pair.)
    const body = Buffer.alloc(Math.max(0, blockSize - 24));
    readSync(fd, body, 0, body.length, start + 8);
    const pairs = [];
    let off = 0;
    while (off + 12 <= body.length) {
      const pairLen = Number(body.readBigUint64LE(off));
      if (pairLen < 4 || off + 8 + pairLen > body.length) break;
      const id = body.readUint32LE(off + 8);
      pairs.push({ id, payload: body.subarray(off + 12, off + 8 + pairLen) });
      off += 8 + pairLen;
    }
    return { pairs };
  } finally {
    closeSync(fd);
  }
}

/** Which signing schemes the APK carries. */
export function signingSchemes(path) {
  const block = readSigningBlock(path);
  if (!block) return { present: false, schemes: [] };
  const schemes = block.pairs.map((p) => SCHEME_IDS[p.id]).filter(Boolean);
  return { present: true, schemes };
}

// --- DER / X.509 ----------------------------------------------------------------
/** Read one DER TLV at `off`. */
export function derRead(buf, off) {
  if (off + 2 > buf.length) throw new Error('DER truncated at tag');
  const tag = buf[off];
  let p = off + 1;
  let len = buf[p];
  p += 1;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('unsupported DER length form');
    if (p + n > buf.length) throw new Error('DER truncated in length');
    len = 0;
    for (let i = 0; i < n; i += 1) { len = len * 256 + buf[p]; p += 1; }
  }
  if (p + len > buf.length) throw new Error('DER length exceeds buffer');
  return { tag, contentStart: p, contentEnd: p + len, end: p + len, length: len };
}

function* derChildren(buf, start, end) {
  let p = start;
  while (p < end) {
    const node = derRead(buf, p);
    yield node;
    p = node.end;
  }
}

/** Attribute-type OIDs that appear in a distinguished name, by DER body bytes. */
const DN_OIDS = new Map([
  ['550403', 'CN'], ['550406', 'C'], ['550407', 'L'],
  ['550408', 'ST'], ['55040a', 'O'], ['55040b', 'OU'],
]);

/**
 * Parse an X.501 Name (RDNSequence) into its attributes. Real structural
 * parsing — the check this replaces merely asserted the certificate's byte
 * length fell in a 512..2048 window, which any certificate can satisfy.
 */
export function parseDerName(buf, nameStart, nameEnd) {
  const attrs = [];
  for (const rdn of derChildren(buf, nameStart, nameEnd)) {
    if (rdn.tag !== 0x31) continue; // SET OF
    for (const atv of derChildren(buf, rdn.contentStart, rdn.contentEnd)) {
      if (atv.tag !== 0x30) continue; // SEQUENCE
      const kids = [...derChildren(buf, atv.contentStart, atv.contentEnd)];
      if (kids.length < 2 || kids[0].tag !== 0x06) continue; // OID
      const oid = buf.toString('hex', kids[0].contentStart, kids[0].contentEnd);
      const key = DN_OIDS.get(oid) ?? oid;
      const value = buf.toString('utf8', kids[1].contentStart, kids[1].contentEnd);
      attrs.push([key, value]);
    }
  }
  const map = Object.fromEntries(attrs);
  return {
    attrs,
    ...map,
    dn: attrs.map(([k, v]) => `${k}=${v}`).join(', '),
    canonical: [...attrs].map(([k, v]) => `${k}=${v}`).sort().join(','),
  };
}

/** Extract issuer and subject from a DER X.509 certificate. */
export function parseX509SubjectIssuer(der) {
  const cert = derRead(der, 0);
  if (cert.tag !== 0x30) throw new Error('certificate is not a DER SEQUENCE');
  const tbs = derRead(der, cert.contentStart);
  if (tbs.tag !== 0x30) throw new Error('tbsCertificate is not a DER SEQUENCE');
  const kids = [...derChildren(der, tbs.contentStart, tbs.contentEnd)];
  // TBSCertificate: [0] version (optional), serial, signature alg, ISSUER,
  // validity, SUBJECT, subjectPublicKeyInfo, ...
  let i = 0;
  if (kids[i] && kids[i].tag === 0xa0) i += 1; // explicit version
  i += 1; // serialNumber INTEGER
  i += 1; // signature AlgorithmIdentifier
  const issuerNode = kids[i]; i += 1;
  i += 1; // validity
  const subjectNode = kids[i];
  if (!issuerNode || !subjectNode) throw new Error('certificate missing issuer/subject');
  return {
    issuer: parseDerName(der, issuerNode.contentStart, issuerNode.contentEnd),
    subject: parseDerName(der, subjectNode.contentStart, subjectNode.contentEnd),
  };
}

/** First certificate DER from the v2/v3 signing block, or null. */
export function extractSigningCertificate(path) {
  const block = readSigningBlock(path);
  if (!block) return null;
  for (const pair of block.pairs) {
    if (pair.id !== 0x7109871a && pair.id !== 0xf05368c0) continue;
    const b = pair.payload;
    // signers-seq len | signer len | signed-data len | digests len | digests |
    // certificates len | cert len | cert DER ...
    let p = 0;
    if (b.length < 24) continue;
    p += 4; // signers sequence length
    p += 4; // first signer length
    p += 4; // signed data length
    const digestsLen = b.readUInt32LE(p); p += 4;
    if (p + digestsLen + 8 > b.length) continue;
    p += digestsLen;
    const certsLen = b.readUInt32LE(p); p += 4;
    if (certsLen < 4 || p + certsLen > b.length) continue;
    const certLen = b.readUInt32LE(p); p += 4;
    if (certLen < 1 || p + certLen > b.length) continue;
    return b.subarray(p, p + certLen);
  }
  return null;
}

/**
 * Classify the signing certificate by SUBJECT/ISSUER, not by size.
 * Debug class == self-signed (subject === issuer) with the Android SDK debug DN.
 */
export function classifySigningCertificate(path) {
  const der = extractSigningCertificate(path);
  if (!der) return { ok: false, reason: 'no v2/v3 signing certificate found', subject: null, issuer: null };
  let parsed;
  try {
    parsed = parseX509SubjectIssuer(der);
  } catch (e) {
    return { ok: false, reason: `certificate parse failed: ${e.message}`, subject: null, issuer: null };
  }
  const { subject, issuer } = parsed;
  const selfSigned = subject.canonical === issuer.canonical && subject.canonical.length > 0;
  const matches = isAndroidDebugClass(subject);
  const reasons = [];
  if (!selfSigned) reasons.push('certificate is not self-signed (subject != issuer)');
  if (!matches) {
    reasons.push(`subject is not the Android Debug signing class (expected ${DEBUG_CLASS_DESCRIPTION})`);
  }
  return {
    ok: selfSigned && matches,
    reason: reasons.join('; ') || null,
    subject: subject.dn,
    issuer: issuer.dn,
    selfSigned,
    certificateBytes: der.length,
  };
}

// --- deterministic Android SDK tool discovery -----------------------------------
const EXE = process.platform === 'win32';
const TOOL_FILES = {
  aapt: EXE ? ['aapt2.exe', 'aapt.exe'] : ['aapt2', 'aapt'],
  apksigner: EXE ? ['apksigner.bat'] : ['apksigner'],
  zipalign: EXE ? ['zipalign.exe'] : ['zipalign'],
};
const TOOL_ENV = { aapt: 'AAPT_PATH', apksigner: 'APKSIGNER_PATH', zipalign: 'ZIPALIGN_PATH' };

/** Compare build-tools directory names as version tuples so "36.0.0" beats
 *  "9.0.0" and the choice is deterministic rather than lexicographic. */
function compareVersionDesc(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d !== 0) return d;
  }
  return a < b ? 1 : -1;
}

/**
 * Locate aapt/apksigner/zipalign. Explicit env vars win; otherwise the highest
 * build-tools version under ANDROID_HOME/ANDROID_SDK_ROOT is used. Never falls
 * back to "not found means fine".
 */
export function discoverAndroidTools(env = process.env) {
  const found = {};
  const notes = [];
  for (const tool of Object.keys(TOOL_FILES)) {
    const explicit = env[TOOL_ENV[tool]];
    if (explicit && existsSync(explicit)) {
      found[tool] = { path: explicit, source: TOOL_ENV[tool] };
    }
  }
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || null;
  let buildToolsDir = null;
  if (sdk && existsSync(join(sdk, 'build-tools'))) {
    const versions = readdirSync(join(sdk, 'build-tools'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => /^\d+(\.\d+)*$/.test(n))
      .sort(compareVersionDesc);
    if (versions.length > 0) {
      buildToolsDir = join(sdk, 'build-tools', versions[0]);
      notes.push(`build-tools ${versions[0]} selected from ${versions.length} installed`);
    }
  }
  for (const [tool, candidates] of Object.entries(TOOL_FILES)) {
    if (found[tool]) continue;
    if (!buildToolsDir) continue;
    for (const file of candidates) {
      const p = join(buildToolsDir, file);
      if (existsSync(p)) { found[tool] = { path: p, source: buildToolsDir }; break; }
    }
  }
  const missing = Object.keys(TOOL_FILES).filter((t) => !found[t]);
  return { tools: found, missing, sdk, buildToolsDir, notes };
}

/**
 * `apksigner verify --print-certs` — the authoritative signing verdict.
 *
 * On Windows the SDK ships apksigner as a .bat shim, and Node refuses to
 * execFile .bat/.cmd directly (command-injection hardening). That surfaced as a
 * bare EINVAL: a MISSING verdict masquerading as a failed one. The shim is only
 * a `java -jar apksigner.jar` wrapper, so invoke the jar directly and keep the
 * shim as a last resort. A spawn failure is reported distinctly from a genuine
 * verification failure — and neither one is ever allowed to pass the check.
 */
export function apksignerVerify(apksignerPath, apkPath) {
  const jar = join(dirname(apksignerPath), 'lib', 'apksigner.jar');
  const javaHome = process.env.JAVA_HOME;
  const attempts = [];
  if (existsSync(jar)) {
    const javaExe = javaHome ? join(javaHome, 'bin', EXE ? 'java.exe' : 'java') : null;
    if (javaExe && existsSync(javaExe)) attempts.push({ file: javaExe, args: ['-jar', jar] });
    attempts.push({ file: EXE ? 'java.exe' : 'java', args: ['-jar', jar] });
  }
  if (!EXE || !/\.(bat|cmd)$/i.test(apksignerPath)) attempts.push({ file: apksignerPath, args: [] });

  const verifyArgs = ['verify', '--verbose', '--print-certs', apkPath];
  const spawnErrors = [];
  for (const a of attempts) {
    try {
      const out = execFileSync(a.file, [...a.args, ...verifyArgs],
        { encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
      const dnLine = out.split(/\r?\n/).find((l) => /certificate DN:/i.test(l)) ?? '';
      const dn = dnLine.split(/certificate DN:\s*/i)[1]?.trim() ?? null;
      return { ok: true, raw: out, dn, verified: /Verifies/i.test(out), invoked: a.file, spawnFailed: false };
    } catch (e) {
      if (e.code === 'EINVAL' || e.code === 'ENOENT' || e.code === 'EACCES') {
        spawnErrors.push(`${a.file}: ${e.code}`);
        continue; // could not START the tool - try the next invocation form
      }
      // apksigner ran and returned non-zero: that IS the verdict.
      const raw = `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message);
      return { ok: false, raw, dn: null, verified: false, invoked: a.file, spawnFailed: false };
    }
  }
  return {
    ok: false,
    raw: `apksigner could not be invoked (${spawnErrors.join('; ') || 'no invocation form available'})`,
    dn: null,
    verified: false,
    invoked: null,
    spawnFailed: true,
  };
}

/**
 * PROVENANCE: recompute the candidate's identity from the LIVE worktree and
 * compare it to what the APK carries (Sol finding 4).
 *
 * Validating that `trackedDiffFingerprint.value` is 64 hex characters proves
 * only that the manifest is well-formed. A STALE APK is perfectly
 * self-consistent: its fingerprint matches its own newFiles hashes, its schema
 * and label are right, and every format check passes — while describing a
 * source tree that no longer exists. The only way to know the artifact belongs
 * to the code in front of you is to recompute the fingerprint and the staged
 * file hashes and compare.
 *
 * Fails CLOSED: if git cannot be run, provenance is UNVERIFIED, which is a
 * failure in real-candidate mode, never a pass.
 */
export function verifyProvenance(manifest, { repoRoot, gitBin = 'git' } = {}) {
  const problems = [];
  const observed = { head: null, branch: null, fingerprint: null };
  const git = (args, encoding) => execFileSync(gitBin, args, {
    cwd: repoRoot, encoding, timeout: 300000, maxBuffer: 512 * 1024 * 1024,
  });

  try {
    observed.head = git(['rev-parse', 'HEAD'], 'utf8').trim();
    observed.branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], 'utf8').trim();
  } catch (e) {
    return {
      ok: false,
      status: 'UNVERIFIED',
      observed,
      problems: [`git identity unavailable: ${String(e.message).slice(0, 120)}`],
    };
  }

  try {
    // Buffer, not string: the diff is binary-safe and the fingerprint is taken
    // over its exact bytes.
    const diff = git(['diff', '--full-index', '--binary', 'HEAD'], 'buffer');
    observed.fingerprint = createHash('sha256').update(diff).digest('hex');
  } catch (e) {
    problems.push(`could not recompute the tracked diff: ${String(e.message).slice(0, 120)}`);
  }

  if (manifest.head !== observed.head) {
    problems.push(`HEAD mismatch: APK says ${String(manifest.head).slice(0, 12)}, worktree is ${String(observed.head).slice(0, 12)}`);
  }
  if (manifest.branch !== observed.branch) {
    problems.push(`branch mismatch: APK says ${manifest.branch}, worktree is ${observed.branch}`);
  }
  if (observed.fingerprint && manifest.trackedDiffFingerprint?.value !== observed.fingerprint) {
    problems.push(
      `tracked-diff fingerprint mismatch: APK says ${String(manifest.trackedDiffFingerprint?.value).slice(0, 12)}..., `
      + `worktree recomputes ${observed.fingerprint.slice(0, 12)}... — this artifact is STALE`,
    );
  }

  // Every staged/new file the manifest names must still hash to the recorded value.
  let filesChecked = 0;
  for (const f of manifest.newFiles ?? []) {
    const abs = join(repoRoot, f.path);
    if (!existsSync(abs)) { problems.push(`newFiles path missing from the worktree: ${f.path}`); continue; }
    const actual = createHash('sha256').update(readFileSync(abs)).digest('hex');
    filesChecked += 1;
    if (actual !== f.sha256) {
      problems.push(`newFiles hash mismatch for ${f.path}: APK ${f.sha256.slice(0, 12)}..., worktree ${actual.slice(0, 12)}...`);
    }
  }

  return {
    ok: problems.length === 0,
    status: problems.length === 0 ? 'VERIFIED' : 'MISMATCH',
    observed,
    filesChecked,
    problems,
  };
}

// --- manifest field validation --------------------------------------------------
/** A staged/new-file entry must be repository-relative, unique, and SHA-256'd. */
export function validateNewFiles(newFiles) {
  const problems = [];
  if (!Array.isArray(newFiles)) return { ok: false, problems: ['newFiles is not an array'] };
  if (newFiles.length === 0) problems.push('newFiles is empty');
  const seen = new Set();
  for (const [i, f] of newFiles.entries()) {
    const where = `newFiles[${i}]`;
    if (!f || typeof f.path !== 'string' || f.path.length === 0) {
      problems.push(`${where}: missing path`);
      continue;
    }
    const p = f.path;
    if (p.includes('\\')) problems.push(`${where}: path uses backslashes (${p})`);
    if (/^[A-Za-z]:/.test(p) || p.startsWith('/')) problems.push(`${where}: path is absolute (${p})`);
    if (p.split('/').includes('..')) problems.push(`${where}: path escapes the repository (${p})`);
    if (seen.has(p)) problems.push(`${where}: duplicate path (${p})`);
    seen.add(p);
    if (typeof f.sha256 !== 'string' || !SHA256_RE.test(f.sha256)) {
      problems.push(`${where}: sha256 is not 64 lowercase hex characters`);
    }
  }
  return { ok: problems.length === 0, problems, uniqueCount: seen.size };
}

/** The fingerprint must name the exact byte-preserving method AND carry a
 *  well-formed value. A free-form string was previously accepted. */
export function validateFingerprint(fp) {
  const problems = [];
  if (!fp || typeof fp !== 'object') return { ok: false, problems: ['trackedDiffFingerprint missing'] };
  if (fp.method !== FINGERPRINT_METHOD) {
    problems.push(`method is not the ratified byte-preserving method (got ${JSON.stringify(fp.method)})`);
  }
  if (typeof fp.value !== 'string' || !SHA256_RE.test(fp.value)) {
    problems.push('value is not 64 lowercase hex characters');
  }
  return { ok: problems.length === 0, problems };
}

// --- main verification ------------------------------------------------------------
/**
 * Verify one APK. Returns { ok, failures, checks } — failure state lives ENTIRELY
 * in this call, so a rejected artifact cannot poison a later verification in the
 * same process.
 */
export async function verifyQaArtifact(apkPath, options = {}) {
  const {
    fixtureMode = false,
    skipZipalign = fixtureMode,
    skipSignature = fixtureMode,
    requireModelHash = !fixtureMode,
    requireProvenance = !fixtureMode,
    repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..'),
    env = process.env,
  } = options;
  const realCandidate = !fixtureMode;

  const checks = [];
  const failures = [];
  const check = (label, ok, detail = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    checks.push({ label, ok, detail });
    if (!ok) failures.push(label);
  };
  const result = () => ({ ok: failures.length === 0, failures, checks });

  console.log(`=== [qa-artifact] verifying ${apkPath}${fixtureMode ? ' (FIXTURE MODE)' : ''} ===`);
  if (!existsSync(apkPath)) {
    check('artifact exists', false, apkPath);
    throw new QaRejectionError(`artifact does not exist: ${apkPath}`);
  }
  check('artifact exists', true);

  // Real-candidate mode fails CLOSED on missing external tools. Self-declared
  // manifest values may never stand in for aapt/apksigner/zipalign.
  let tools = { tools: {}, missing: [], sdk: null, buildToolsDir: null, notes: [] };
  if (realCandidate) {
    tools = discoverAndroidTools(env);
    for (const note of tools.notes) console.log(`  NOTE  ${note}`);
    check('Android SDK build tools discovered (aapt, apksigner, zipalign)',
      tools.missing.length === 0,
      tools.missing.length ? `missing: ${tools.missing.join(', ')}` : tools.buildToolsDir ?? 'from env');
    if (tools.missing.length > 0) {
      throw new QaRejectionError(
        `real-candidate verification requires ${tools.missing.join(', ')}; set `
        + `${tools.missing.map((t) => TOOL_ENV[t]).join('/')} or ANDROID_HOME. Failing closed.`,
      );
    }
  } else {
    console.log('  NOTE  fixture mode: external SDK tools and the ratified model hash are bypassed');
  }

  let zip;
  try {
    zip = readZipEntries(apkPath);
    check('archive structurally valid', true, `${zip.entries.size} entries, ${zip.size} bytes`);
  } catch (e) {
    check('archive structurally valid', false, String(e.message));
    throw new QaRejectionError(`corrupt archive: ${e.message}`);
  }

  // 1. JS/Hermes application bundle — the QA artifact is self-contained by
  // contract; absence or emptiness of the application is a rejection.
  const bundleNames = [...zip.entries.keys()].filter((n) =>
    n.startsWith('assets/') && n.endsWith('.bundle'));
  const bundleEntry = bundleNames.map((n) => zip.entries.get(n)).find((e) => e.compSize > 1024);
  check('non-empty JS/Hermes application bundle packaged',
    bundleEntry !== undefined,
    bundleEntry ? `${bundleEntry.name} (${bundleEntry.compSize} B compressed)` : 'none found');
  if (!bundleEntry) throw new QaRejectionError('missing or empty JS/Hermes application bundle');

  // 2. candidate manifest
  const manifestEntry = zip.entries.get(MANIFEST_ASSET);
  if (!manifestEntry) {
    check('generated candidate manifest packaged', false, `${MANIFEST_ASSET} missing`);
    throw new QaRejectionError('missing candidate manifest');
  }
  let manifest;
  try {
    manifest = JSON.parse(extractEntryToBuffer(apkPath, manifestEntry).toString('utf8'));
  } catch (e) {
    check('candidate manifest parses', false, String(e.message));
    throw new QaRejectionError(`malformed candidate manifest: ${e.message}`);
  }
  check('manifest schema/label valid',
    manifest.schema === MANIFEST_SCHEMA && manifest.label === MANIFEST_LABEL,
    `${manifest.schema} / ${manifest.label}`);
  if (!(manifest.schema === MANIFEST_SCHEMA && manifest.label === MANIFEST_LABEL)) {
    throw new QaRejectionError('manifest schema or label mismatch');
  }

  const headOk = /^[0-9a-f]{40}$/.test(manifest.head ?? '');
  check('manifest identity complete',
    typeof manifest.branch === 'string' && headOk && typeof manifest.sourceDirty === 'boolean',
    `head=${String(manifest.head ?? '').slice(0, 12)} dirty=${manifest.sourceDirty}`);
  if (typeof manifest.branch !== 'string' || !headOk || typeof manifest.sourceDirty !== 'boolean') {
    throw new QaRejectionError('manifest identity incomplete or malformed');
  }

  const fp = validateFingerprint(manifest.trackedDiffFingerprint);
  check('tracked-diff fingerprint method and value are exact',
    fp.ok, fp.ok ? `${manifest.trackedDiffFingerprint.value.slice(0, 12)}...` : fp.problems.join('; '));
  if (!fp.ok) throw new QaRejectionError(`fingerprint invalid: ${fp.problems.join('; ')}`);

  const nf = validateNewFiles(manifest.newFiles);
  check('staged/new paths unique, repository-relative, SHA-256-shaped',
    nf.ok, nf.ok ? `${nf.uniqueCount} paths` : nf.problems.slice(0, 3).join('; '));
  if (!nf.ok) throw new QaRejectionError(`newFiles invalid: ${nf.problems.slice(0, 3).join('; ')}`);

  // PROVENANCE — recomputed from the live worktree, not self-declared.
  if (requireProvenance) {
    const prov = verifyProvenance(manifest, { repoRoot });
    check('APK provenance matches the live worktree (HEAD, branch, fingerprint, staged hashes)',
      prov.ok,
      prov.ok
        ? `${prov.observed.branch}@${String(prov.observed.head).slice(0, 12)}, ${prov.filesChecked} staged files re-hashed`
        : prov.problems.slice(0, 2).join('; '));
    if (!prov.ok) {
      throw new QaRejectionError(`provenance ${prov.status}: ${prov.problems.slice(0, 2).join('; ')}`);
    }
  } else {
    console.log('  NOTE  provenance recomputation skipped (fixture mode)');
  }

  check('manifest carries no absolute paths or usernames',
    !JSON.stringify(manifest).includes('C:\\') && !JSON.stringify(manifest).includes('/Users/')
    && !JSON.stringify(manifest).toLowerCase().includes('fpike'));

  // 3. package/variant identity.
  // Real-candidate: read the BINARY AndroidManifest through aapt. The generated
  // manifest describes itself and cannot be its own witness.
  if (realCandidate) {
    let dump = '';
    let aaptOk = true;
    try {
      dump = execFileSync(tools.tools.aapt.path, ['dump', 'badging', apkPath],
        { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) {
      aaptOk = false;
      dump = String(e.message);
    }
    const pkgLine = dump.split('\n').find((l) => l.startsWith('package:')) ?? '';
    check('binary AndroidManifest package id is com.athletekinetics.qa (aapt)',
      aaptOk && pkgLine.includes(`name='${PACKAGE_ID}'`), pkgLine.slice(0, 90) || 'aapt failed');
    if (!aaptOk || !pkgLine.includes(`name='${PACKAGE_ID}'`)) {
      throw new QaRejectionError('binary AndroidManifest package identity is not the QA id');
    }
    check('generated manifest agrees with the binary manifest',
      manifest.packageId === PACKAGE_ID && manifest.buildVariant === 'qa',
      `${manifest.packageId} / ${manifest.buildVariant}`);
    if (manifest.packageId !== PACKAGE_ID || manifest.buildVariant !== 'qa') {
      throw new QaRejectionError('generated manifest disagrees with the binary manifest');
    }
  } else {
    check('manifest-declared package id is the QA id',
      manifest.packageId === PACKAGE_ID, String(manifest.packageId));
    check('manifest-declared variant is qa', manifest.buildVariant === 'qa');
    if (manifest.packageId !== PACKAGE_ID || manifest.buildVariant !== 'qa') {
      throw new QaRejectionError('wrong build variant/package identity');
    }
  }

  // 4. model asset
  const modelEntry = zip.entries.get('assets/minilm.onnx');
  if (!modelEntry) {
    check('assets/minilm.onnx packaged', false);
    throw new QaRejectionError('model asset missing');
  } else {
    const modelBytes = extractEntryToBuffer(apkPath, modelEntry);
    const actualSha = createHash('sha256').update(modelBytes).digest('hex');
    check('model asset exact size', modelBytes.length === MODEL_SIZE, `${modelBytes.length} B`);
    if (requireModelHash) {
      check('model asset sha256 matches ratified pin', actualSha === MODEL_SHA256, actualSha);
    }
  }

  // 5. ONNX base/JSI pairing per ABI — zero native libraries is a rejection.
  const libPrefixes = new Set([...zip.entries.keys()]
    .filter((n) => n.startsWith('lib/') && n.includes('/libonnxruntime.so'))
    .map((n) => n.split('/')[1]));
  check('at least one ABI packaged', libPrefixes.size > 0, [...libPrefixes].join(','));
  if (libPrefixes.size === 0) throw new QaRejectionError('zero native libraries packaged');
  for (const abi of libPrefixes) {
    const jsi = zip.entries.has(`lib/${abi}/libonnxruntimejsi.so`);
    const base = zip.entries.has(`lib/${abi}/libonnxruntime.so`);
    check(`${abi}: libonnxruntimejsi.so paired with libonnxruntime.so`, jsi && base);
    if (!(jsi && base)) throw new QaRejectionError(`ONNX pairing broken for ${abi}`);
  }

  // 6. signing class — apksigner is authoritative; the X.509 parse corroborates.
  if (!skipSignature) {
    const sig = (() => { try { return signingSchemes(apkPath); } catch { return { present: false, schemes: [] }; } })();
    check('v2-or-v3 signature scheme present',
      sig.present && (sig.schemes.includes('v2') || sig.schemes.includes('v3')),
      sig.schemes.join(','));

    if (realCandidate) {
      const av = apksignerVerify(tools.tools.apksigner.path, apkPath);
      check('apksigner verify succeeds', av.ok && av.verified,
        av.ok ? `via ${av.invoked}` : av.raw.split('\n')[0].slice(0, 100));
      check('apksigner certificate DN is the Android Debug signing class',
        isAndroidDebugClass(parseDnString(av.dn)), String(av.dn ?? 'no DN reported'));
    }

    const cls = classifySigningCertificate(apkPath);
    check('certificate subject/issuer prove the Android Debug signing class',
      cls.ok, cls.ok ? `${cls.subject} (self-signed, ${cls.certificateBytes} B)` : String(cls.reason));
  } else {
    console.log('  NOTE  signature checks skipped (fixture mode)');
  }

  // 7. zip alignment — mandatory for a real candidate.
  if (!skipZipalign) {
    const zipalignPath = realCandidate ? tools.tools.zipalign.path : env.ZIPALIGN_PATH;
    if (!zipalignPath || !existsSync(zipalignPath)) {
      check('zipalign -c -P 16 4 passes', false, 'zipalign not available');
      if (realCandidate) throw new QaRejectionError('zipalign unavailable for a real candidate');
    } else {
      let aligned = true;
      let detail = '';
      try {
        execFileSync(zipalignPath, ['-c', '-P', '16', '4', apkPath],
          { stdio: 'pipe', timeout: 120000 });
      } catch (e) {
        aligned = false;
        detail = String(`${e.stdout ?? ''}${e.stderr ?? ''}` || e.message).split('\n')[0].slice(0, 90);
      }
      check('zipalign -c -P 16 4 passes', aligned, detail);
    }
  } else {
    console.log('  NOTE  zipalign skipped (fixture mode)');
  }

  // 8. ELF64 inspection over every packaged .so
  let inspected = 0;
  for (const [name, entry] of zip.entries) {
    if (!name.startsWith('lib/') || !name.endsWith('.so')) continue;
    const bytes = extractEntryToBuffer(apkPath, entry);
    if (bytes.length < 64 || bytes[0] !== 0x7f) continue; // not ELF
    try {
      const minAlign = minElfLoadAlignment(bytes);
      if (minAlign === null) continue; // ELF32 informational
      inspected += 1;
      check(`${name}: every PT_LOAD >= 0x4000`, minAlign >= MIN_ELF_LOAD_ALIGN,
        `min=0x${minAlign.toString(16)}`);
    } catch (e) {
      inspected += 1;
      check(`${name}: every PT_LOAD >= 0x4000`, false, String(e.message));
    }
  }
  check('inspected at least one ELF64 library', inspected > 0, `${inspected} inspected`);

  const r = result();
  console.log(r.ok ? '\nQA ARTIFACT VERIFIED' : `\n${r.failures.length} QA ARTIFACT CHECK(S) FAILED`);
  return r;
}

// CLI entry: only when executed DIRECTLY (`node tools/verify_qa_artifact.mjs`),
// not when imported as a module by the test suite or other gates. Uses
// fileURLToPath so %-encoded worktree paths (e.g. "Claude%20Coding") compare
// correctly on Windows; bare .pathname leaves the encoding in place and the
// comparison silently fails, making the documented CLI a no-op that exits 0.
// test_verify_qa_artifact.mjs runs this path in a real subprocess from a
// space-bearing directory to keep that regression closed.
const modulePath = fileURLToPath(import.meta.url);
const isMainModule = argv[1]
  && (() => { try { return realpathSync(argv[1]).replace(/\\/g, '/') === realpathSync(modulePath).replace(/\\/g, '/'); } catch { return false; } })();
if (isMainModule) {
  const apkPath = process.argv[2];
  if (!apkPath || apkPath.startsWith('--')) {
    console.error('usage: node tools/verify_qa_artifact.mjs <apk-path> [--fixture-mode]');
    process.exit(2);
  }
  const fixtureMode = process.argv.includes('--fixture-mode');
  verifyQaArtifact(apkPath, { fixtureMode })
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e) => {
      console.error(`\nQA ARTIFACT REJECTED: ${e.message}`);
      process.exit(1);
    });
}
