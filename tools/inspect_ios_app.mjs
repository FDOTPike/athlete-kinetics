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
 *   - Info.plist: bundle id, marketing version (1.0.0), display name, Health READ usage text, no Health
 *     write usage, no empty usage strings;
 *   - op-sqlite compiled with -DSQLITE_ENABLE_MATH_FUNCTIONS=1 (from the build log
 *     or its referenced op-sqlite.build/*.resp compiler response files).
 * Writes a JSON report (artifact identity + every check) and exits non-zero on
 * any failure. Requires macOS `plutil`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_SHA256 } from '../scripts/embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..');

const HAS_MATH_FLAG_RE = /(?:^|[\s'"])-DSQLITE_ENABLE_MATH_FUNCTIONS\\?=1(?=$|[\s'"])/;
const HAS_DISABLED_OR_UNSET_MATH_FLAG_RE = /(?:^|[\s'"])(?:-DSQLITE_ENABLE_MATH_FUNCTIONS\\?=(?!1(?=$|[\s'"]))|-USQLITE_ENABLE_MATH_FUNCTIONS(?=$|[\s'"]))/;

export function hasStandaloneMathFlag(text) {
  return typeof text === 'string'
    && HAS_MATH_FLAG_RE.test(text)
    && !HAS_DISABLED_OR_UNSET_MATH_FLAG_RE.test(text);
}

const isOpSqliteRespPath = (respPath) => {
  if (typeof respPath !== 'string') return false;
  const norm = respPath.trim().replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/op-sqlite.build/');
  if (idx === -1 || !norm.endsWith('.resp')) return false;
  const rel = norm.slice(idx + '/op-sqlite.build/'.length);
  const parts = rel.split('/');
  return parts.length >= 1 && parts.every((p) => p.length > 0 && p !== '.' && p !== '..');
};

/**
 * Verify fail-closed that `op-sqlite` was compiled with
 * `-DSQLITE_ENABLE_MATH_FUNCTIONS=1` across all three valid Xcode log forms:
 *   1. Direct `CompileC` clang command line for `op-sqlite` carrying the flag;
 *   2. `WriteAuxiliaryFile .../op-sqlite.build/...-common-args.resp` whose logged
 *      content line carries the flag (even when > 15,500 chars);
 *   3. `Using response file: .../op-sqlite.build/...-common-args.resp` or
 *      `@.../op-sqlite.build/...-common-args.resp` in an `op-sqlite` `CompileC`
 *      block, verified from the logged `WriteAuxiliaryFile` content or read from
 *      disk. If `sqlite3.c` is compiled in the log, `sqlite3.c`'s own compile
 *      step / `.resp` file must carry the flag.
 */
export function hasOpSqliteMathFunctions(logText) {
  if (typeof logText !== 'string' || logText.length === 0) return false;
  const lines = logText.split(/\r?\n/);
  const loggedRespStatus = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('WriteAuxiliaryFile ')) continue;
    const m = line.match(/^WriteAuxiliaryFile\s+(.+?\.resp)(?:\s+\(in target '([^']+)'[^)]*\))?\s*$/);
    if (!m) continue;
    const respPath = m[1].trim();
    const target = m[2];
    if (!isOpSqliteRespPath(respPath)) continue;
    if (target !== undefined && target !== 'op-sqlite') return false;

    const contentLines = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (next.trim() === '') break;
      if (!/^\s/.test(next) && /^(?:WriteAuxiliaryFile|CompileC|CompileSwift|Ld|Libtool|CreateUniversalBinary|PhaseScriptExecution|CpResource|CopyStringsFile|ProcessInfoPlistFile|CodeSign)\b/.test(next)) {
        break;
      }
      if (/^\s*cd\s+/.test(next) || /^\s*write-file\s+/.test(next)) continue;
      contentLines.push(next);
    }

    if (contentLines.length > 0) {
      const ok = hasStandaloneMathFlag(contentLines.join('\n'));
      if (!ok) return false;
      loggedRespStatus.set(respPath, true);
    }
  }

  const verifyRespFile = (rawPath) => {
    const respPath = typeof rawPath === 'string' ? rawPath.trim() : '';
    if (!isOpSqliteRespPath(respPath)) return false;
    const loggedOk = loggedRespStatus.get(respPath);
    if (loggedRespStatus.has(respPath) && !loggedOk) return false;
    if (existsSync(respPath)) {
      try {
        if (!statSync(respPath).isFile()) return false;
        if (!hasStandaloneMathFlag(readFileSync(respPath, 'utf8'))) return false;
        return true;
      } catch {
        return false;
      }
    }
    return loggedOk === true;
  };

  let opSqliteCompileBlocksTotal = 0;
  let opSqliteCompileBlocksVerified = 0;
  let sqlite3CompileBlocksTotal = 0;
  let sqlite3CompileBlocksVerified = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('CompileC ')) continue;
    const targetMatch = line.match(/\(in target '([^']+)'[^)]*\)\s*$/);
    const isOpSqliteTarget = targetMatch
      ? targetMatch[1] === 'op-sqlite'
      : /[/\\]op-sqlite\.build[/\\]/.test(line);
    if (!isOpSqliteTarget) continue;
    if (!/[/\\]op-sqlite\.build[/\\]/.test(line)) return false;

    opSqliteCompileBlocksTotal += 1;
    const isSqlite3C = /[/\\]sqlite3\.c(?:\s|$)/.test(line) || /[/\\]sqlite3\.o(?:\s|$)/.test(line);
    if (isSqlite3C) sqlite3CompileBlocksTotal += 1;

    const respPaths = new Set();
    const clangLines = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (next.trim() !== '' && !/^\s/.test(next)) break;
      const usingMatch = next.match(/^\s*Using response file:\s+(.+?\.resp)\s*$/);
      if (usingMatch) {
        respPaths.add(usingMatch[1].trim());
        continue;
      }
      if (/^\s+\S.*clang(?:\+\+)?\s/.test(next) && /\s-c\s/.test(next)) {
        clangLines.push(next);
        for (const rm of next.matchAll(/(?:^|\s)@(?:"([^"]+?\.resp)"|'([^']+?\.resp)'|(\S+?\.resp))(?=$|\s)/g)) {
          respPaths.add((rm[1] ?? rm[2] ?? rm[3]).trim());
        }
      }
    }

    if (clangLines.some((cl) => HAS_DISABLED_OR_UNSET_MATH_FLAG_RE.test(cl))) {
      return false;
    }

    let blockVerified = false;
    if (respPaths.size > 0) {
      for (const rp of respPaths) {
        if (!verifyRespFile(rp)) return false;
      }
      blockVerified = true;
    } else if (clangLines.length > 0 && clangLines.every((cl) => hasStandaloneMathFlag(cl))) {
      blockVerified = true;
    }

    if (!blockVerified) return false;
    opSqliteCompileBlocksVerified += 1;
    if (isSqlite3C) sqlite3CompileBlocksVerified += 1;
  }

  if (sqlite3CompileBlocksTotal > 0) {
    return sqlite3CompileBlocksVerified === sqlite3CompileBlocksTotal
      && opSqliteCompileBlocksVerified === opSqliteCompileBlocksTotal;
  }
  if (opSqliteCompileBlocksTotal > 0) {
    return opSqliteCompileBlocksVerified === opSqliteCompileBlocksTotal;
  }
  return loggedRespStatus.size > 0;
}

export function inspectIosApp(app, buildLog, out) {
  const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok: Boolean(ok), detail: String(detail) }); };

  const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
  const executable = join(app, String(plist.CFBundleExecutable ?? ''));
  check('app executable present (not an empty bundle)', typeof plist.CFBundleExecutable === 'string'
    && existsSync(executable) && statSync(executable).isFile() && statSync(executable).size > 100_000,
    existsSync(executable) ? statSync(executable).size : 'missing');
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
  check('marketing version is 1.0.0', plist.CFBundleShortVersionString === '1.0.0', plist.CFBundleShortVersionString);
  check('Health read usage text present', typeof plist.NSHealthShareUsageDescription === 'string' && plist.NSHealthShareUsageDescription.length > 40);
  check('no Health write usage (read-only)', plist.NSHealthUpdateUsageDescription === undefined);
  const empty = Object.entries(plist).filter(([k, v]) => k.endsWith('UsageDescription') && (typeof v !== 'string' || v.trim() === '')).map(([k]) => k);
  check('no empty usage strings', empty.length === 0, empty.join(','));
  const log = readFileSync(buildLog, 'utf8');
  check('op-sqlite compiled with SQLITE_ENABLE_MATH_FUNCTIONS', hasOpSqliteMathFunctions(log));

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
  return report;
}

const modulePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1]
  && (() => { try { return realpathSync(process.argv[1]).replace(/\\/g, '/') === realpathSync(modulePath).replace(/\\/g, '/'); } catch { return false; } })();

if (isMainModule) {
  const [app, buildLog, out] = process.argv.slice(2);
  if (!app || !buildLog || !out) {
    console.error('usage: node tools/inspect_ios_app.mjs <App.app> <xcodebuild.log> <out.json>');
    process.exit(2);
  }
  const report = inspectIosApp(app, buildLog, out);
  process.exit(report.ok ? 0 : 1);
}
