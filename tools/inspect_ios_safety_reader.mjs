/**
 * inspect_ios_safety_reader.mjs — fail-closed inspection of the bundled
 * safety_reader.onnx inside a built iOS .app bundle (macOS CI).
 *
 *   node tools/inspect_ios_safety_reader.mjs <path/to/AthleteKinetics.app> <out.json>
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_BYTES,
  KNOWN_SHA256,
  SAFETY_READER_ARTIFACT,
  SAFETY_READER_MODEL_ID,
  SAFETY_READER_POLICY_ID,
} from '../scripts/safety-reader-integrity.mjs';

export const IOS_SAFETY_READER_BUNDLE_FILE = 'safety_reader.onnx';

export function inspectIosSafetyReader(appPath, outPath = null) {
  const expectedBytes = KNOWN_BYTES[SAFETY_READER_ARTIFACT];
  const expectedSha = KNOWN_SHA256[SAFETY_READER_ARTIFACT];
  const target = join(appPath, IOS_SAFETY_READER_BUNDLE_FILE);
  const checks = [];
  const record = (name, ok, detail = '') => {
    checks.push({ name, ok: Boolean(ok), detail: String(detail) });
  };

  let present = false;
  let actualBytes = null;
  let actualSha = null;
  let absentDetail = 'missing';

  // lstat (never stat): a symlinked .app bundle or a symlinked
  // safety_reader.onnx fails closed instead of following the link.
  let appSt = null;
  try { appSt = lstatSync(appPath); } catch { appSt = null; }
  if (appSt !== null && appSt.isSymbolicLink()) {
    absentDetail = 'symlink rejected (app bundle)';
  } else if (existsSync(target)) {
    const st = lstatSync(target);
    if (st.isSymbolicLink()) {
      absentDetail = 'symlink rejected';
    } else if (st.isFile()) {
      present = true;
      actualBytes = st.size;
    } else {
      absentDetail = 'not a regular file';
    }
  }
  record(
    'safety_reader.onnx present as regular file in app bundle',
    present,
    present ? `${actualBytes} B` : absentDetail,
  );
  record(
    'safety_reader.onnx exact ratified byte length',
    present && actualBytes === expectedBytes,
    present ? `${actualBytes} B (expected ${expectedBytes} B)` : absentDetail,
  );
  if (present && actualBytes === expectedBytes) {
    actualSha = createHash('sha256').update(readFileSync(target)).digest('hex');
  }
  record(
    'safety_reader.onnx sha256 matches ratified pin',
    actualSha === expectedSha,
    actualSha ?? 'skipped (missing or size mismatch)',
  );

  const report = {
    schema: 'ak.ios-safety-reader-inspection/1',
    modelId: SAFETY_READER_MODEL_ID,
    policyId: SAFETY_READER_POLICY_ID,
    bundleFile: IOS_SAFETY_READER_BUNDLE_FILE,
    expectedBytes,
    expectedSha256: expectedSha,
    actualBytes,
    actualSha256: actualSha,
    ok: checks.every((c) => c.ok),
    checks,
  };
  if (outPath !== null) {
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

const modulePath = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1]
  && (() => {
    try {
      return (
        realpathSync(process.argv[1]).replace(/\\/g, '/')
        === realpathSync(modulePath).replace(/\\/g, '/')
      );
    } catch {
      return false;
    }
  })();

if (isMainModule) {
  const [appPath, outPath] = process.argv.slice(2);
  if (!appPath || !outPath) {
    console.error('usage: node tools/inspect_ios_safety_reader.mjs <App.app> <out.json>');
    process.exit(2);
  }
  const report = inspectIosSafetyReader(appPath, outPath);
  for (const c of report.checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  }
  console.log(
    report.ok ? 'iOS SAFETY READER INSPECTED' : 'iOS SAFETY READER INSPECTION FAILED',
  );
  process.exit(report.ok ? 0 : 1);
}
