/**
 * inspect_ios_app.mjs — fail-closed inspection of a BUILT iOS .app (macOS CI).
 *
 *   node tools/inspect_ios_app.mjs <path/to/AthleteKinetics.app> <xcodebuild.log> <out.json>
 *
 * Checks the artifact itself, not the sources:
 *   - Release JS bundle (main.jsbundle) present and non-trivial;
 *   - minilm.onnx present with the ratified SHA-256 (embedder-integrity.mjs);
 *   - Archivo font present with the Android-pinned SHA-256, registered in UIAppFonts;
 *   - PrivacyInfo.xcprivacy present in the app bundle (React Native's pod
 *     post-install adds it to Copy Bundle Resources — inspected, not assumed);
 *   - Info.plist: bundle id, display name, Health READ usage text, no Health
 *     write usage, no empty usage strings;
 *   - op-sqlite compiled with -DSQLITE_ENABLE_MATH_FUNCTIONS=1 (from the build log).
 * Writes a JSON report (artifact identity + every check) and exits non-zero on
 * any failure. Requires macOS `plutil`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_SHA256 } from '../scripts/embedder-integrity.mjs';

const [app, buildLog, out] = process.argv.slice(2);
if (!app || !buildLog || !out) {
  console.error('usage: node tools/inspect_ios_app.mjs <App.app> <xcodebuild.log> <out.json>');
  process.exit(2);
}
const ROOT = join(import.meta.dirname, '..');
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: Boolean(ok), detail: String(detail) }); };

const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
const bundle = join(app, 'main.jsbundle');
check('Release JS bundle embedded', existsSync(bundle) && statSync(bundle).size > 1_000_000, existsSync(bundle) ? statSync(bundle).size : 'missing');
const model = join(app, 'minilm.onnx');
check('embedder model embedded with the ratified hash', existsSync(model) && sha(model) === KNOWN_SHA256['onnx/model_quantized.onnx'],
  existsSync(model) ? sha(model) : 'missing');
const gradle = readFileSync(join(ROOT, 'apps/mobile/android/app/build.gradle'), 'utf8');
const fontPin = gradle.match(/ARCHIVO_SHA256 = '([0-9a-f]{64})'/)?.[1];
const font = join(app, 'Archivo-VariableFont_wdth,wght.ttf');
check('Archivo font embedded with the pinned hash', existsSync(font) && sha(font) === fontPin, existsSync(font) ? sha(font) : 'missing');
check('UIAppFonts registers it', (plist.UIAppFonts ?? []).includes('Archivo-VariableFont_wdth,wght.ttf'));
check('privacy manifest present in the app bundle', existsSync(join(app, 'PrivacyInfo.xcprivacy')));
check('bundle identifier is not a template value', typeof plist.CFBundleIdentifier === 'string'
  && !plist.CFBundleIdentifier.startsWith('org.reactjs.native.example'), plist.CFBundleIdentifier);
check('display name', plist.CFBundleDisplayName === 'pikeMethods', plist.CFBundleDisplayName);
check('Health read usage text present', typeof plist.NSHealthShareUsageDescription === 'string' && plist.NSHealthShareUsageDescription.length > 40);
check('no Health write usage (read-only)', plist.NSHealthUpdateUsageDescription === undefined);
const empty = Object.entries(plist).filter(([k, v]) => k.endsWith('UsageDescription') && (typeof v !== 'string' || v.trim() === '')).map(([k]) => k);
check('no empty usage strings', empty.length === 0, empty.join(','));
const log = readFileSync(buildLog, 'utf8');
check('op-sqlite compiled with SQLITE_ENABLE_MATH_FUNCTIONS', /op-sqlite[\s\S]{0,4000}-DSQLITE_ENABLE_MATH_FUNCTIONS=1|-DSQLITE_ENABLE_MATH_FUNCTIONS=1[\s\S]{0,4000}op-sqlite/.test(log));

const report = {
  schema: 'ak.ios-artifact-inspection/1',
  bundleId: plist.CFBundleIdentifier,
  version: plist.CFBundleShortVersionString,
  build: plist.CFBundleVersion,
  minimumOS: plist.MinimumOSVersion,
  sdk: plist.DTSDKName,
  xcode: plist.DTXcode,
  ok: checks.every((c) => c.ok),
  checks,
};
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(report.ok ? 'iOS ARTIFACT INSPECTED' : 'iOS ARTIFACT INSPECTION FAILED');
process.exit(report.ok ? 0 : 1);
