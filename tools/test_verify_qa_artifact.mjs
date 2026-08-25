/**
 * test_verify_qa_artifact.mjs — negative/fixture suite for the QA artifact
 * verifier (WO remediation B3, hardened at P2). Every controlled fixture must be
 * REJECTED (verifyQaArtifact throws QaRejectionError or returns ok:false) while
 * the REAL candidate APK is never mutated: fixtures live in a scratch dir.
 *
 * P2 additions:
 *   - per-invocation failure state (bad-then-good reentrancy);
 *   - real X.509 subject/issuer signing-class proof, not a certificate size range;
 *   - real-candidate mode fails CLOSED when SDK tools are missing;
 *   - exact fingerprint method/value validation;
 *   - staged/new path uniqueness, relativeness and SHA-256 shape;
 *   - a real SUBPROCESS run of the CLI from a path containing spaces, so the
 *     "documented CLI silently no-ops" regression cannot come back.
 *
 * Run: node tools/test_verify_qa_artifact.mjs [path-to-real-qa-apk]
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ANDROID_DEBUG_CN,
  DEBUG_CLASS_DESCRIPTION,
  QaRejectionError,
  classifySigningCertificate,
  discoverAndroidTools,
  extractSigningCertificate,
  isAndroidDebugClass,
  minElfLoadAlignment,
  parseDnString,
  parseX509SubjectIssuer,
  readZipEntries,
  validateFingerprint,
  validateNewFiles,
  verifyProvenance,
  verifyQaArtifact,
} from './verify_qa_artifact.mjs';

const REAL_APK = process.argv[2];
const VERIFIER = fileURLToPath(new URL('./verify_qa_artifact.mjs', import.meta.url));
let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const FINGERPRINT_METHOD = 'sha256(git diff --full-index --binary HEAD)';

const VALID_MANIFEST = {
  schema: 'ak.candidate-manifest/1',
  label: 'NON_PRODUCTION_QA_DEBUG_SIGNED',
  branch: 'feat/custom-block-builder',
  head: 'a'.repeat(40),
  sourceDirty: true,
  trackedDiffFingerprint: { method: FINGERPRINT_METHOD, value: 'b'.repeat(64) },
  newFiles: [{ path: 'packages/inference/test/verify_lazy_lifecycle.mjs', sha256: 'c'.repeat(64) }],
  qaLifecycleTelemetry: true,
  model: {
    id: 'Xenova/all-MiniLM-L6-v2',
    revision: 'd'.repeat(40),
    assetPath: 'assets/minilm.onnx',
    sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
    sizeBytes: 22972370,
  },
  packageId: 'com.athletekinetics.qa',
  versionCode: 1,
  versionName: '1.0-QA',
  buildVariant: 'qa',
  builtAtUtc: '2026-08-22T00:00:00.000Z',
};

// --- tiny zip writer (STORE method) for synthetic fixtures ----------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(entries, { signingBlock = null } = {}) {
  // entries: [{ name, data }]
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 8); // STORE
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    local.push(lfh, nameBuf, data);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(data.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);
    central.push(cdh, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const block = signingBlock ?? Buffer.alloc(0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset + block.length, 16); // CD sits after the signing block
  return Buffer.concat([...local, block, centralBuf, eocd]);
}

// --- minimal DER encoders, for building genuine X.509 names ---------------------
const derLen = (n) => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v = Math.floor(v / 256); }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};
const tlv = (tag, content) => Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
const derOid = (hex) => tlv(0x06, Buffer.from(hex, 'hex'));
const derStr = (s) => tlv(0x13, Buffer.from(s, 'utf8')); // PrintableString
const OID = { CN: '550403', O: '55040a', C: '550406', OU: '55040b', L: '550407', ST: '550408' };
const derName = (pairs) => tlv(0x30, Buffer.concat(
  pairs.map(([k, v]) => tlv(0x31, tlv(0x30, Buffer.concat([derOid(OID[k]), derStr(v)])))),
));

/** A structurally real X.509 certificate carrying the given subject/issuer. */
function makeCert(subjectPairs, issuerPairs = subjectPairs) {
  const version = tlv(0xa0, tlv(0x02, Buffer.from([2])));
  const serial = tlv(0x02, Buffer.from([0x01, 0x23, 0x45]));
  const sigAlg = tlv(0x30, derOid('2a864886f70d01010b')); // sha256WithRSAEncryption
  const validity = tlv(0x30, Buffer.concat([
    tlv(0x17, Buffer.from('260101000000Z')), tlv(0x17, Buffer.from('360101000000Z')),
  ]));
  const spki = tlv(0x30, Buffer.concat([
    tlv(0x30, derOid('2a864886f70d010101')), tlv(0x03, Buffer.alloc(260, 0x11)),
  ]));
  const tbs = tlv(0x30, Buffer.concat([
    version, serial, sigAlg, derName(issuerPairs), validity, derName(subjectPairs), spki,
  ]));
  return tlv(0x30, Buffer.concat([tbs, sigAlg, tlv(0x03, Buffer.alloc(260, 0x22))]));
}

// The classic Studio/AGP debug DN...
const DEBUG_DN_PAIRS = [['C', 'US'], ['O', 'Android'], ['CN', 'Android Debug']];
// ...and the shape the CURRENT SDK's keytool actually generates, which the real
// QA candidate carries. Both must be accepted; neither may be widened into
// "any self-signed certificate".
const AGP_DEBUG_DN_PAIRS = [
  ['C', 'US'], ['ST', 'Unknown'], ['L', 'Unknown'],
  ['O', 'Unknown'], ['OU', 'Android'], ['CN', 'Android Debug'],
];
const RELEASE_DN_PAIRS = [['C', 'AU'], ['O', 'Acme Pty Ltd'], ['CN', 'Acme Release Key']];

/** A real APK Signing Block carrying a v2 scheme pair with `certDer`. */
function makeSigningBlock(certDer) {
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; };
  const digests = Buffer.alloc(24, 0x33);
  const certs = Buffer.concat([u32(certDer.length), certDer]);
  const attrs = Buffer.alloc(0);
  const signedData = Buffer.concat([
    u32(digests.length), digests, u32(certs.length), certs, u32(attrs.length), attrs,
  ]);
  const signatures = Buffer.alloc(64, 0x44);
  const publicKey = Buffer.alloc(160, 0x55);
  const signer = Buffer.concat([
    u32(signedData.length), signedData,
    u32(signatures.length), signatures,
    u32(publicKey.length), publicKey,
  ]);
  const signers = Buffer.concat([u32(signer.length), signer]);
  const payload = Buffer.concat([u32(signers.length), signers]);

  const idBuf = Buffer.alloc(4);
  idBuf.writeUInt32LE(0x7109871a, 0);
  const pairBody = Buffer.concat([idBuf, payload]);
  const pairLen = Buffer.alloc(8);
  pairLen.writeBigUInt64LE(BigInt(pairBody.length), 0);
  const pairs = Buffer.concat([pairLen, pairBody]);

  const magic = Buffer.from('APK Sig Block 42', 'ascii');
  const blockSize = pairs.length + 8 + magic.length; // trailing size + magic
  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigUInt64LE(BigInt(blockSize), 0);
  return Buffer.concat([sizeBuf, pairs, sizeBuf, magic]);
}

const MODEL_BYTES = Buffer.alloc(22972370, 0x51);
const BUNDLE_BYTES = Buffer.alloc(4096, 0x41);
const ELF_OK = (() => {
  // Minimal ELF64 with one PT_LOAD aligned 0x4000.
  const b = Buffer.alloc(0x100);
  b[0] = 0x7f; b[1] = 0x45; b[2] = 0x4c; b[3] = 0x46; // \x7fELF
  b[4] = 2; b[5] = 1; b[6] = 1;
  const PHOFF = 64;
  b.writeBigUint64LE(BigInt(PHOFF), 32); // e_phoff
  b.writeUInt16LE(56, 54); // e_phentsize
  b.writeUInt16LE(1, 56); // e_phnum
  b.writeUInt32LE(1, PHOFF); // p_type = PT_LOAD
  b.writeBigUint64LE(0x4000n, PHOFF + 48); // p_align
  return b;
})();
const ELF_BAD = (() => {
  const b = Buffer.from(ELF_OK);
  b.writeBigUInt64LE(0x1000n, 64 + 48); // 4 KB aligned
  return b;
})();

const fixtureEntries = (overrides = {},
  { includeBundle = true, includeModel = true, includeLibs = true, elf = ELF_OK, rawManifest = null } = {}) => {
  const manifest = { ...VALID_MANIFEST, ...overrides };
  const entries = [{
    name: 'assets/candidate_manifest.json',
    data: rawManifest ?? Buffer.from(JSON.stringify(manifest)),
  }];
  if (includeBundle) entries.push({ name: 'assets/index.android.bundle', data: BUNDLE_BYTES });
  if (includeModel) entries.push({ name: 'assets/minilm.onnx', data: MODEL_BYTES });
  if (includeLibs) {
    entries.push({ name: 'lib/arm64-v8a/libonnxruntime.so', data: elf });
    entries.push({ name: 'lib/arm64-v8a/libonnxruntimejsi.so', data: elf });
  }
  return entries;
};
const fixtureApk = (overrides, opts) => buildZip(fixtureEntries(overrides, opts));

const FIXTURE_OPTS = { fixtureMode: true };

/** Run the verifier and report how it ended: 'threw' | 'failed' | 'ok'. */
async function runVerify(path, opts = FIXTURE_OPTS) {
  try {
    const r = await verifyQaArtifact(path, opts);
    return { outcome: r.ok ? 'ok' : 'failed', result: r };
  } catch (e) {
    return { outcome: e instanceof QaRejectionError ? 'threw' : 'error', error: e };
  }
}

async function withScratch(fn) {
  const scratch = mkdtempSync(join(tmpdir(), 'qa-fixture-'));
  try { return await fn(scratch); } finally { rmSync(scratch, { recursive: true, force: true }); }
}

async function expectRejected(label, buffer, opts = FIXTURE_OPTS) {
  await withScratch(async (scratch) => {
    const p = join(scratch, 'fixture.apk');
    writeFileSync(p, buffer);
    const { outcome } = await runVerify(p, opts);
    check(label, outcome === 'threw' || outcome === 'failed', outcome);
  });
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'qa-fixture-root-'));
  try {
    // =====================================================================
    console.log('[1] positive control and per-invocation failure state');

    const validPath = join(scratch, 'valid.apk');
    writeFileSync(validPath, fixtureApk());
    {
      const { outcome, result } = await runVerify(validPath);
      check('positive control: well-formed synthetic QA artifact accepted',
        outcome === 'ok', `${outcome}${result?.failures?.length ? ` (${result.failures.join('; ')})` : ''}`);
    }

    const badAlignPath = join(scratch, 'bad-align.apk');
    writeFileSync(badAlignPath, fixtureApk({}, { elf: ELF_BAD }));
    {
      // REGRESSION (P2.1): failure state used to be module-global, so any earlier
      // rejection permanently poisoned every later verification in the process.
      const bad = await runVerify(badAlignPath);
      check('bad artifact reports failure without throwing',
        bad.outcome === 'failed' && bad.result.failures.some((f) => f.includes('PT_LOAD')),
        bad.result?.failures?.join('; ').slice(0, 70) ?? bad.outcome);
      const good = await runVerify(validPath);
      check('REENTRANCY: a good artifact still passes AFTER a bad one in the same process',
        good.outcome === 'ok',
        good.result ? `failures: ${JSON.stringify(good.result.failures)}` : good.outcome);
      check('failure lists are independent between invocations',
        bad.result.failures.length > 0 && good.result.failures.length === 0);
    }

    // =====================================================================
    console.log('\n[2] structural rejections');

    await expectRejected('missing JS bundle rejected', fixtureApk({}, { includeBundle: false }));
    await expectRejected('empty JS bundle rejected', buildZip([
      { name: 'assets/candidate_manifest.json', data: Buffer.from(JSON.stringify(VALID_MANIFEST)) },
      { name: 'assets/index.android.bundle', data: Buffer.alloc(0) },
      { name: 'assets/minilm.onnx', data: MODEL_BYTES },
      { name: 'lib/arm64-v8a/libonnxruntime.so', data: ELF_OK },
      { name: 'lib/arm64-v8a/libonnxruntimejsi.so', data: ELF_OK },
    ]));
    await expectRejected('malformed manifest JSON rejected',
      buildZip(fixtureEntries({}, { rawManifest: Buffer.from('{not json') })));
    await expectRejected('mismatched manifest label rejected', fixtureApk({ label: 'SOMETHING_ELSE' }));
    await expectRejected('missing model rejected', fixtureApk({}, { includeModel: false }));
    await expectRejected('missing ONNX base/JSI pairing rejected', fixtureApk({}, { includeLibs: false }));
    await expectRejected('4 KB-aligned ELF64 input rejected', fixtureApk({}, { elf: ELF_BAD }));
    await expectRejected('corrupt archive rejected',
      Buffer.concat([Buffer.alloc(64, 0), Buffer.from('PK'), Buffer.alloc(128)]));
    await expectRejected('wrong build variant identity rejected',
      fixtureApk({ buildVariant: 'debug', packageId: 'com.athletekinetics' }));
    await expectRejected('malformed HEAD rejected', fixtureApk({ head: 'not-a-sha' }));
    {
      const corrupt = Buffer.from(MODEL_BYTES);
      corrupt[1000] ^= 0xff;
      const entries = fixtureEntries({}, { includeModel: false });
      entries.push({ name: 'assets/minilm.onnx', data: corrupt.subarray(0, MODEL_BYTES.length - 1) });
      await expectRejected('wrong-size model rejected', buildZip(entries));
    }
    check('ELF parser: 4 KB fixture reports min alignment 0x1000',
      minElfLoadAlignment(ELF_BAD) === 0x1000);
    check('ELF parser: 16 KB fixture reports min alignment 0x4000',
      minElfLoadAlignment(ELF_OK) === 0x4000);

    // =====================================================================
    console.log('\n[3] P2.4 — fingerprint method and value are validated exactly');

    check('valid fingerprint accepted',
      validateFingerprint({ method: FINGERPRINT_METHOD, value: 'a'.repeat(64) }).ok);
    check('a DIFFERENT method is rejected (not just any string)',
      !validateFingerprint({ method: 'sha256(git diff HEAD)', value: 'a'.repeat(64) }).ok);
    check('a missing method is rejected', !validateFingerprint({ value: 'a'.repeat(64) }).ok);
    check('a short hex value is rejected',
      !validateFingerprint({ method: FINGERPRINT_METHOD, value: 'abc' }).ok);
    check('an uppercase hex value is rejected',
      !validateFingerprint({ method: FINGERPRINT_METHOD, value: 'A'.repeat(64) }).ok);
    check('a non-hex value is rejected',
      !validateFingerprint({ method: FINGERPRINT_METHOD, value: 'z'.repeat(64) }).ok);
    check('an absent fingerprint object is rejected', !validateFingerprint(undefined).ok);
    await expectRejected('APK whose manifest names the wrong fingerprint method is rejected',
      fixtureApk({ trackedDiffFingerprint: { method: 'sha256(git diff)', value: 'b'.repeat(64) } }));
    await expectRejected('APK whose fingerprint value is malformed is rejected',
      fixtureApk({ trackedDiffFingerprint: { method: FINGERPRINT_METHOD, value: 'nope' } }));

    // =====================================================================
    console.log('\n[4] P2.5 — staged/new paths unique, repository-relative, SHA-256-shaped');

    const okFiles = [{ path: 'a/b.mjs', sha256: 'a'.repeat(64) }, { path: 'c/d.mjs', sha256: 'b'.repeat(64) }];
    check('valid newFiles accepted', validateNewFiles(okFiles).ok);
    check('duplicate paths rejected',
      !validateNewFiles([okFiles[0], { ...okFiles[0] }]).ok);
    check('absolute POSIX path rejected',
      !validateNewFiles([{ path: '/etc/passwd', sha256: 'a'.repeat(64) }]).ok);
    check('absolute Windows path rejected',
      !validateNewFiles([{ path: 'C:/tmp/x.mjs', sha256: 'a'.repeat(64) }]).ok);
    check('backslash path rejected',
      !validateNewFiles([{ path: 'tools\\x.mjs', sha256: 'a'.repeat(64) }]).ok);
    check('parent-escaping path rejected',
      !validateNewFiles([{ path: '../outside.mjs', sha256: 'a'.repeat(64) }]).ok);
    check('malformed sha256 rejected',
      !validateNewFiles([{ path: 'ok.mjs', sha256: 'short' }]).ok);
    check('empty newFiles rejected', !validateNewFiles([]).ok);
    check('non-array newFiles rejected', !validateNewFiles(null).ok);
    await expectRejected('APK with duplicate staged paths is rejected',
      fixtureApk({ newFiles: [okFiles[0], { ...okFiles[0] }] }));
    await expectRejected('APK with an absolute staged path is rejected',
      fixtureApk({ newFiles: [{ path: '/abs/path.mjs', sha256: 'a'.repeat(64) }] }));

    // =====================================================================
    console.log('\n[5] P2.2 — signing class from real X.509 subject/issuer, not a size window');

    {
      const debugCert = makeCert(DEBUG_DN_PAIRS);
      const parsed = parseX509SubjectIssuer(debugCert);
      check('X.509 parser extracts the debug subject attributes',
        parsed.subject.CN === ANDROID_DEBUG_CN && parsed.subject.O === 'Android'
        && parsed.subject.C === 'US', parsed.subject.dn);
      check('X.509 parser extracts the issuer independently',
        parsed.issuer.CN === ANDROID_DEBUG_CN, parsed.issuer.dn);

      const debugApk = join(scratch, 'debug-signed.apk');
      writeFileSync(debugApk, buildZip(fixtureEntries(), { signingBlock: makeSigningBlock(debugCert) }));
      const extracted = extractSigningCertificate(debugApk);
      check('signing certificate is recovered from a real v2 signing block',
        extracted !== null && extracted.equals(debugCert), `${extracted?.length ?? 0} B`);
      const cls = classifySigningCertificate(debugApk);
      check('classic O=Android debug certificate is ACCEPTED as the debug class',
        cls.ok, `${cls.subject}`);
    }
    {
      // The DN the CURRENT SDK generates and the real QA candidate carries.
      const agpCert = makeCert(AGP_DEBUG_DN_PAIRS);
      const agpApk = join(scratch, 'agp-debug-signed.apk');
      writeFileSync(agpApk, buildZip(fixtureEntries(), { signingBlock: makeSigningBlock(agpCert) }));
      const cls = classifySigningCertificate(agpApk);
      check('current OU=Android/O=Unknown debug certificate is ACCEPTED as the debug class',
        cls.ok, `${cls.subject}`);
      const parsed = parseX509SubjectIssuer(agpCert);
      check('the OU/ST/L attributes of the current debug DN all parse',
        parsed.subject.OU === 'Android' && parsed.subject.O === 'Unknown'
        && parsed.subject.ST === 'Unknown' && parsed.subject.L === 'Unknown',
        parsed.subject.dn);
    }
    {
      // The predicate itself, exercised directly on both the DER path's shape
      // and apksigner's printed DN, so the two can never drift apart.
      check('predicate accepts the classic debug DN',
        isAndroidDebugClass({ CN: 'Android Debug', O: 'Android', C: 'US' }));
      check('predicate accepts the current debug DN',
        isAndroidDebugClass({ CN: 'Android Debug', OU: 'Android', O: 'Unknown', C: 'US' }));
      check('predicate rejects a wrong CN',
        !isAndroidDebugClass({ CN: 'Android Release', O: 'Android', C: 'US' }));
      check('predicate rejects a wrong country',
        !isAndroidDebugClass({ CN: 'Android Debug', O: 'Android', C: 'AU' }));
      check('predicate rejects a near-miss organisation',
        !isAndroidDebugClass({ CN: 'Android Debug', O: 'Androids', OU: 'Androidz', C: 'US' }));
      check('predicate rejects an empty/absent DN', !isAndroidDebugClass(null)
        && !isAndroidDebugClass({}));
      check('apksigner DN string parses into the same attribute shape',
        isAndroidDebugClass(parseDnString(
          'CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US')),
        DEBUG_CLASS_DESCRIPTION);
      check('apksigner DN for a release key is rejected',
        !isAndroidDebugClass(parseDnString('CN=Acme Release Key, O=Acme Pty Ltd, C=AU')));
      check('a missing apksigner DN is rejected, never treated as absent-therefore-fine',
        !isAndroidDebugClass(parseDnString(null)) && !isAndroidDebugClass(parseDnString(undefined)));
    }
    {
      // A release-key certificate of the SAME byte length class the old check
      // accepted (512..2048 B) must now be rejected on subject/issuer.
      const releaseCert = makeCert(RELEASE_DN_PAIRS);
      const releaseApk = join(scratch, 'release-signed.apk');
      writeFileSync(releaseApk, buildZip(fixtureEntries(), { signingBlock: makeSigningBlock(releaseCert) }));
      const cls = classifySigningCertificate(releaseApk);
      check('a NON-debug certificate in the old accepted size range is REJECTED',
        !cls.ok && releaseCert.length > 512 && releaseCert.length < 2048,
        `${releaseCert.length} B, subject=${cls.subject}`);
      check('rejection names the signing-class mismatch',
        String(cls.reason).includes('Android Debug signing class'), String(cls.reason));
    }
    {
      // Correct DN but issued by someone else: not self-signed, not debug class.
      const crossCert = makeCert(DEBUG_DN_PAIRS, RELEASE_DN_PAIRS);
      const crossApk = join(scratch, 'cross-signed.apk');
      writeFileSync(crossApk, buildZip(fixtureEntries(), { signingBlock: makeSigningBlock(crossCert) }));
      const cls = classifySigningCertificate(crossApk);
      check('a debug-DN certificate signed by a DIFFERENT issuer is REJECTED',
        !cls.ok && cls.selfSigned === false, String(cls.reason));
    }
    {
      const unsigned = join(scratch, 'unsigned.apk');
      writeFileSync(unsigned, fixtureApk());
      const cls = classifySigningCertificate(unsigned);
      check('an unsigned APK yields no certificate and is rejected',
        !cls.ok && String(cls.reason).includes('no v2/v3 signing certificate'), String(cls.reason));
    }

    // =====================================================================
    console.log('\n[6] P2.3 — real-candidate mode fails CLOSED without SDK tools');

    {
      const r = await runVerify(validPath, { fixtureMode: false, env: {} });
      check('real-candidate verification with NO SDK tools is REJECTED, not passed',
        r.outcome === 'threw' && /requires .*apksigner|requires .*aapt|requires .*zipalign/.test(r.error.message),
        r.error?.message?.slice(0, 100) ?? r.outcome);
    }
    {
      const r = await runVerify(validPath, {
        fixtureMode: false,
        env: { AAPT_PATH: 'C:/nope/aapt.exe', APKSIGNER_PATH: 'C:/nope/apksigner.bat' },
      });
      check('non-existent explicit tool paths do not satisfy real-candidate mode',
        r.outcome === 'threw', r.error?.message?.slice(0, 100) ?? r.outcome);
    }
    {
      const d = discoverAndroidTools({ ANDROID_HOME: join(scratch, 'no-sdk-here') });
      check('discovery reports all three tools missing when the SDK is absent',
        d.missing.length === 3, d.missing.join(','));
      const live = discoverAndroidTools();
      check('discovery on this workstation reports its selection deterministically',
        typeof live.buildToolsDir === 'string' || live.missing.length === 3,
        live.buildToolsDir ?? `missing: ${live.missing.join(',')}`);
    }

    // =====================================================================
    console.log('\n[7] P2 — the documented CLI really runs from a path containing spaces');

    {
      // THE REGRESSION: on Windows, using `fileURLToPath` instead of a raw
      // `.pathname` is what decides whether the documented CLI runs at all from
      // a path containing spaces (a %-encoded "Claude%20Coding" never matches
      // argv[1], so `isMainModule` is false and the CLI silently exits 0).
      //
      // Do NOT rely on the repository happening to live under a spaced path --
      // it does here, but not in a clean-room clone, which made this check fail
      // for the wrong reason. The verifier imports only node: builtins, so copy
      // it into a deliberately spaced directory and drive THAT. Now the
      // regression is exercised in every checkout location.
      const spacedDir = join(scratch, 'dir with spaces', 'a b c');
      mkdirSync(spacedDir, { recursive: true });
      const spacedVerifier = join(spacedDir, 'verify_qa_artifact.mjs');
      copyFileSync(VERIFIER, spacedVerifier);
      check('a space-bearing copy of the CLI exists to drive the regression',
        spacedVerifier.includes(' '), spacedVerifier);
      console.log(`  NOTE  the repository path itself `
        + `${VERIFIER.includes(' ') ? 'also contains' : 'does not contain'} a space: ${VERIFIER}`);

      const runFrom = (file, args) => {
        try {
          const stdout = execFileSync(process.execPath, [file, ...args],
            { encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
          return { code: 0, stdout, stderr: '' };
        } catch (e) {
          return { code: e.status ?? -1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
        }
      };
      const run = (args) => runFrom(spacedVerifier, args);

      const okRun = run([validPath, '--fixture-mode']);
      check('SUBPROCESS: CLI on a good fixture exits 0 AND produces verification output',
        okRun.code === 0 && okRun.stdout.includes('QA ARTIFACT VERIFIED'),
        `exit=${okRun.code} bytes=${okRun.stdout.length}`);
      check('SUBPROCESS: CLI is not a silent no-op (it printed the checks it ran)',
        okRun.stdout.includes('[qa-artifact] verifying') && okRun.stdout.includes('PASS'),
        `${okRun.stdout.split('\n').length} output lines`);

      const badRun = run([badAlignPath, '--fixture-mode']);
      check('SUBPROCESS: CLI on a failing fixture exits NON-ZERO',
        badRun.code === 1, `exit=${badRun.code}`);

      const missingRun = run([join(scratch, 'does-not-exist.apk'), '--fixture-mode']);
      check('SUBPROCESS: CLI on a missing artifact exits non-zero with a reason',
        missingRun.code === 1 && /does not exist/.test(missingRun.stdout + missingRun.stderr),
        `exit=${missingRun.code}`);

      const usageRun = run([]);
      check('SUBPROCESS: CLI with no arguments exits 2 with usage',
        usageRun.code === 2 && usageRun.stderr.includes('usage:'), `exit=${usageRun.code}`);

      // ...and the CLI at its real in-repo location behaves identically.
      const inRepo = runFrom(VERIFIER, [validPath, '--fixture-mode']);
      check('SUBPROCESS: the in-repo CLI path also runs and verifies',
        inRepo.code === 0 && inRepo.stdout.includes('QA ARTIFACT VERIFIED'),
        `exit=${inRepo.code}`);
    }

    // =====================================================================
    // =====================================================================
    console.log('\n[9] SOL FINDING 4 - provenance is RECOMPUTED, not self-declared');

    const REPO_ROOT = dirname(dirname(VERIFIER));
    const gitOut = (args, enc) => execFileSync('git', args,
      { cwd: REPO_ROOT, encoding: enc, timeout: 300000, maxBuffer: 512 * 1024 * 1024 });

    let liveHead = null; let liveBranch = null; let liveFp = null;
    try {
      liveHead = gitOut(['rev-parse', 'HEAD'], 'utf8').trim();
      liveBranch = gitOut(['rev-parse', '--abbrev-ref', 'HEAD'], 'utf8').trim();
      liveFp = createHash('sha256')
        .update(gitOut(['diff', '--full-index', '--binary', 'HEAD'], 'buffer')).digest('hex');
    } catch { /* reported below */ }

    check('the live worktree identity is readable for provenance tests',
      typeof liveHead === 'string' && liveHead.length === 40,
      liveHead ? `${liveBranch}@${liveHead.slice(0, 12)}` : 'git unavailable');

    if (liveHead) {
      const liveManifest = {
        head: liveHead,
        branch: liveBranch,
        trackedDiffFingerprint: { method: FINGERPRINT_METHOD, value: liveFp },
        newFiles: [{
          path: 'tools/verify_qa_artifact.mjs',
          sha256: createHash('sha256').update(readFileSync(VERIFIER)).digest('hex'),
        }],
      };
      const good = verifyProvenance(liveManifest, { repoRoot: REPO_ROOT });
      check('a manifest describing THIS worktree verifies',
        good.ok && good.status === 'VERIFIED' && good.filesChecked === 1,
        good.problems.join('; ') || `${good.filesChecked} file(s) re-hashed`);

      // THE DEFECT SOL FOUND: a stale artifact is perfectly self-consistent.
      const stale = {
        ...liveManifest,
        trackedDiffFingerprint: { method: FINGERPRINT_METHOD, value: 'd'.repeat(64) },
      };
      check('format validation ALONE still accepts the stale fingerprint',
        validateFingerprint(stale.trackedDiffFingerprint).ok === true,
        'well-formed but wrong - which is exactly why format checks are insufficient');
      const staleProv = verifyProvenance(stale, { repoRoot: REPO_ROOT });
      check('provenance REJECTS a stale-but-well-formed fingerprint',
        !staleProv.ok && staleProv.problems.some((x) => x.includes('STALE')),
        staleProv.problems.join('; ').slice(0, 90));

      check('provenance REJECTS a manifest naming a different HEAD',
        !verifyProvenance({ ...liveManifest, head: 'a'.repeat(40) }, { repoRoot: REPO_ROOT }).ok);
      check('provenance REJECTS a manifest naming a different branch',
        !verifyProvenance({ ...liveManifest, branch: 'some-other-branch' }, { repoRoot: REPO_ROOT }).ok);

      const wf = verifyProvenance({
        ...liveManifest,
        newFiles: [{ path: 'tools/verify_qa_artifact.mjs', sha256: 'e'.repeat(64) }],
      }, { repoRoot: REPO_ROOT });
      check('provenance REJECTS a staged file whose worktree hash has moved',
        !wf.ok && wf.problems.some((x) => x.includes('hash mismatch')),
        wf.problems.join('; ').slice(0, 80));

      check('provenance REJECTS a staged path absent from the worktree',
        !verifyProvenance({
          ...liveManifest,
          newFiles: [{ path: 'tools/this_file_does_not_exist.mjs', sha256: 'f'.repeat(64) }],
        }, { repoRoot: REPO_ROOT }).ok);

      const noGit = verifyProvenance(liveManifest,
        { repoRoot: REPO_ROOT, gitBin: 'definitely-not-git' });
      check('provenance FAILS CLOSED when git cannot be run (UNVERIFIED, never a pass)',
        !noGit.ok && noGit.status === 'UNVERIFIED', noGit.problems.join('; ').slice(0, 70));
    }

    {
      // The synthetic fixture APK names a fabricated HEAD, so real-candidate
      // mode must reject it rather than accept a self-consistent stranger.
      const r = await runVerify(validPath, { fixtureMode: false, env: process.env });
      check('real-candidate mode rejects a fixture APK (provenance or tooling)',
        r.outcome === 'threw', r.error?.message?.slice(0, 90) ?? r.outcome);
    }

    console.log('\n[8] real-candidate read-only sanity');

    if (REAL_APK) {
      const before = readZipEntries(REAL_APK).size;
      check('real candidate provided and readable', before > 0, `${before} bytes`);
      // Read-only proof: structural reader only; the full real-candidate run is
      // executed by the direct CLI at rebuild time.
    } else {
      console.log('  NOTE  no real APK passed; real-candidate sanity skipped');
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`\n${fail === 0 ? 'ALL FIXTURE CHECKS PASSED' : `${fail} FIXTURE CHECK(S) FAILED`}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
