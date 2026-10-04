/**
 * verify_native_config.mjs — static, host-side contract for the native iOS
 * project and the cross-platform native configuration it depends on.
 *
 * This is NOT native build evidence (the macOS CI job builds, archives and
 * smoke-launches the app). It pins, on every platform, the source facts the
 * native build relies on, so a Linux/Windows change cannot silently undo them:
 *
 *   [N1] op-sqlite math flags reach BOTH platforms: the hoisted iOS podspec
 *        reads the ROOT package.json, Android gradle reads apps/mobile's.
 *   [N2] the pinned embedder model is staged into the iOS bundle by a build
 *        phase (Release requires it) and the device code's pin prefix matches
 *        the ratified hash.
 *   [N3] Info.plist privacy: Health read usage text present, no write usage,
 *        no empty usage strings, display name, fonts.
 *   [N4] HealthKit entitlement wired on both configurations; read-only.
 *   [N5] identity: no React Native template bundle identifier; the iOS bundle
 *        identifier equals the permanent Android application id; iOS and
 *        Android launch the component the JS bundle registers (app.json name).
 *   [N6] Apple Health / Nitro autolink on iOS only; Health Connect Android only.
 *   [N7] the Archivo font shipped on iOS is the same hash-pinned file Android ships.
 *   [N8] privacy manifest present; Android device backup stays disabled.
 *   [N9] Xcode 26 toolchain: the Podfile disables fmt's consteval for Apple
 *        clang (fmtlib/fmt#4740) while React Native pins fmt 11.0.2, and makes
 *        glog's namespace-included headers textual for Swift/C++ interop.
 *
 * Run: npm run verify:native-config
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_SHA256 } from '../scripts/embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const plistKeys = (xml) => {
  const out = new Map();
  for (const m of xml.matchAll(/<key>([^<]+)<\/key>\s*(<string>([^<]*)<\/string>|<true\/>|<false\/>|<array>([\s\S]*?)<\/array>|<array\/>|<dict>)/g)) {
    out.set(m[1], m[3] ?? (m[2] === '<true/>' ? true : m[2] === '<false/>' ? false : m[4] ?? m[2]));
  }
  return out;
};

console.log('[N1] op-sqlite SQLite math functions on both platforms');
{
  const root = JSON.parse(read('package.json'))['op-sqlite'];
  const app = JSON.parse(read('apps/mobile/package.json'))['op-sqlite'];
  check('root package.json carries the op-sqlite config the hoisted iOS podspec reads', root !== undefined);
  check('root and apps/mobile op-sqlite configs are identical', JSON.stringify(root) === JSON.stringify(app));
  check('the config enables SQLITE_ENABLE_MATH_FUNCTIONS (003 uses ln/sqrt)', /-DSQLITE_ENABLE_MATH_FUNCTIONS=1\b/.test(root?.sqliteFlags ?? ''));
  const podspec = join(ROOT, 'node_modules', '@op-engineering', 'op-sqlite', 'op-sqlite.podspec');
  if (existsSync(podspec)) {
    const text = readFileSync(podspec, 'utf8');
    check('installed podspec still resolves the app package.json by walking up from the hoisted module',
      /File\.dirname\(current_dir\)/.test(text) && /op_sqlite_config\s*=\s*app_package\["op-sqlite"\]/.test(text));
  }
}

const pbx = read('apps/mobile/ios/AthleteKinetics.xcodeproj/project.pbxproj');
console.log('[N2] pinned embedder model staged into the iOS bundle');
{
  const phases = pbx.match(/buildPhases = \(([\s\S]*?)\);/)?.[1] ?? '';
  const order = [...phases.matchAll(/\/\* ([^*]+) \*\//g)].map((m) => m[1].trim());
  const iRes = order.indexOf('Resources');
  const iStage = order.indexOf('Stage embedder model');
  check('the target runs "Stage embedder model" after Resources', iStage > iRes && iRes !== -1, order.join(' > '));
  const phase = pbx.match(/\/\* Stage embedder model \*\/ = \{([\s\S]*?)\n\t\t\};/)?.[1] ?? '';
  check('the phase runs scripts/stage-native-embedder.mjs into the app bundle as minilm.onnx',
    phase.includes('scripts/stage-native-embedder.mjs') && phase.includes('$UNLOCALIZED_RESOURCES_FOLDER_PATH/minilm.onnx'));
  check('Release builds require the model (--required)', /CONFIGURATION\\?"? = \\?"Release\\?"[\s\S]*--required/.test(phase));
  check('script sandboxing is off on both target configurations (the phase reads outside SRCROOT)',
    (pbx.match(/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g) ?? []).length >= 2);
  const embedder = read('apps/mobile/src/inference/deviceEmbedder.ts');
  const prefix = embedder.match(/MODEL_PIN_PREFIX = '([0-9a-f]+)'/)?.[1];
  check('deviceEmbedder pin prefix matches the ratified model SHA-256',
    prefix !== undefined && prefix.length >= 16 && KNOWN_SHA256['onnx/model_quantized.onnx'].startsWith(prefix), prefix);
  const smoke = read('apps/mobile/src/diagnostics/nativeSmoke.ts');
  check('the native smoke exercises the production backup CSPRNG, not a global polyfill',
    /mobileBackupCrypto\.randomBytes\(/.test(smoke) && !/globalThis[^;\n]*crypto/.test(smoke));
  check('iOS opens the bundled model in place (no Documents copy)', /Platform\.OS === 'ios'[\s\S]{0,200}MainBundleDir/.test(embedder));
  const stage = read('scripts/stage-native-embedder.mjs');
  check('the staging script verifies against KNOWN_SHA256 and never downloads',
    stage.includes("KNOWN_SHA256['onnx/model_quantized.onnx']") && !/fetch\(|https?:\/\//.test(stage));
}

const plistXml = read('apps/mobile/ios/AthleteKinetics/Info.plist');
const plist = plistKeys(plistXml);
console.log('[N3] Info.plist privacy and presentation');
{
  const share = plist.get('NSHealthShareUsageDescription');
  check('Health read usage description present and names both read types', typeof share === 'string' && share.length >= 40
    && /sleep/i.test(share) && /resting heart rate/i.test(share));
  check('no Health write usage description (the app never writes to Health)', !plist.has('NSHealthUpdateUsageDescription'));
  const emptyUsage = [...plist.entries()].filter(([k, v]) => /UsageDescription$/.test(k) && (typeof v !== 'string' || v.trim() === '')).map(([k]) => k);
  check('no empty usage-description strings', emptyUsage.length === 0, emptyUsage.join(','));
  check('display name is the product name, not the scaffold', plist.get('CFBundleDisplayName') === 'pikeMethods');
  const fonts = String(plist.get('UIAppFonts') ?? '');
  check('UIAppFonts registers the Archivo variable font', fonts.includes('Archivo-VariableFont_wdth,wght.ttf'));
  const launch = read('apps/mobile/ios/AthleteKinetics/LaunchScreen.storyboard');
  check('launch screen carries no scaffold text', !/AthleteKinetics|Powered by React Native/.test(launch));
}

console.log('[N4] HealthKit entitlement, read-only');
{
  const ent = read('apps/mobile/ios/AthleteKinetics/AthleteKinetics.entitlements');
  check('entitlements enable HealthKit', /<key>com\.apple\.developer\.healthkit<\/key>\s*<true\/>/.test(ent));
  check('no clinical-records or background-delivery entitlement is requested',
    !/health-records|healthkit\.background-delivery/.test(ent));
  check('both target configurations sign with the entitlements file',
    (pbx.match(/CODE_SIGN_ENTITLEMENTS = AthleteKinetics\/AthleteKinetics\.entitlements;/g) ?? []).length === 2);
  const apple = read('packages/biometrics/src/appleHealth.ts');
  check('the adapter requests only sleep and resting HR, and shares nothing',
    /const READ_TYPES = \[SLEEP, RESTING_HR\] as const;/.test(apple)
      && /const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate';/.test(apple)
      && !/toShare/.test(apple.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
  check('the adapter never requests an HRV type (HealthKit HRV is SDNN, not RMSSD)', !/HeartRateVariability/.test(apple));
}

console.log('[N5] identity');
{
  check('no React Native template bundle identifier', !pbx.includes('org.reactjs.native.example'));
  // App-target configurations only; the UI-test runner (TEST_TARGET_NAME) has
  // its own derived identifier, pinned in [N10].
  const configs = [...pbx.matchAll(/isa = XCBuildConfiguration;[\s\S]*?\n\t\t\};/g)].map((m) => m[0]);
  const bundleIds = (blocks) => [...new Set(blocks.flatMap((b) => [...b.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1])))];
  const ids = bundleIds(configs.filter((b) => !b.includes('TEST_TARGET_NAME')));
  check('one bundle identifier across configurations', ids.length === 1, ids.join(','));
  const androidId = read('apps/mobile/android/app/build.gradle').match(/applicationId "([^"]+)"/)?.[1];
  check('the iOS bundle identifier is the permanent Android application id', ids.length === 1 && ids[0] === androidId,
    `${ids[0]} vs ${androidId}`);
  const registered = JSON.parse(read('apps/mobile/app.json')).name;
  const iosModule = read('apps/mobile/ios/AthleteKinetics/AppDelegate.swift').match(/withModuleName:\s*"([^"]+)"/)?.[1];
  const androidModule = read('apps/mobile/android/app/src/main/java/com/athletekinetics/MainActivity.kt')
    .match(/getMainComponentName\(\)[^=]*=\s*"([^"]+)"/)?.[1];
  check('iOS and Android launch the component the JS bundle registers (app.json name)',
    typeof registered === 'string' && iosModule === registered && androidModule === registered,
    `registered=${registered} ios=${iosModule} android=${androidModule}`);
  check('no development team is committed (owner-supplied at signing time)', !/DEVELOPMENT_TEAM = [A-Z0-9]{10};/.test(pbx));
}

console.log('[N6] platform-scoped native health modules');
{
  const cfg = read('apps/mobile/react-native.config.js');
  for (const name of ['@kingstinct/react-native-healthkit', '@react-native-healthkit/core', 'react-native-nitro-modules']) {
    check(`${name} is not autolinked on Android`, new RegExp(`'${name.replace(/[/.@-]/g, '\\$&')}': \\{ platforms: \\{ android: null \\} \\}`).test(cfg));
  }
  const appPkg = JSON.parse(read('apps/mobile/package.json'));
  check('Apple Health binding is pinned exactly', /^\d+\.\d+\.\d+$/.test(appPkg.dependencies['@kingstinct/react-native-healthkit'] ?? ''));
}

console.log('[N7] font parity');
{
  const gradle = read('apps/mobile/android/app/build.gradle');
  const pin = gradle.match(/ARCHIVO_SHA256 = '([0-9a-f]{64})'/)?.[1];
  const font = join(ROOT, 'apps/mobile/assets/fonts/Archivo/Archivo-VariableFont_wdth,wght.ttf');
  const sha = existsSync(font) ? createHash('sha256').update(readFileSync(font)).digest('hex') : null;
  check('iOS bundles the Android hash-pinned Archivo file', pin !== undefined && sha === pin && pbx.includes('Archivo-VariableFont_wdth,wght.ttf in Resources'), sha ?? 'missing');
}

console.log('[N8] privacy manifest and device backup');
{
  const manifest = read('apps/mobile/ios/AthleteKinetics/PrivacyInfo.xcprivacy');
  check('privacy manifest declares no tracking', /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(manifest));
  check('Android device backup stays disabled', /android:allowBackup="false"/.test(read('apps/mobile/android/app/src/main/AndroidManifest.xml')));
  check('iOS excludes app data directories from device backup at startup and keeps the outcome',
    read('apps/mobile/src/App.tsx').includes('startDeviceBackupExclusion()'));
  check('the native smoke requires the startup exclusion result and CI reads the real resource values',
    read('apps/mobile/src/diagnostics/nativeSmoke.ts').includes('startupDeviceBackupExclusion()')
      && /isExcludedFromBackup/.test(read('tools/ios_simulator_smoke.sh')));
}

console.log('[N9] Xcode 26 / fmt consteval compatibility');
{
  const podfile = read('apps/mobile/ios/Podfile');
  const fmtSpec = join(ROOT, 'node_modules', 'react-native', 'third-party-podspecs', 'fmt.podspec');
  const fmtVersion = existsSync(fmtSpec) ? readFileSync(fmtSpec, 'utf8').match(/spec\.version = "([^"]+)"/)?.[1] : undefined;
  const patched = /patch_fmt_consteval_for_apple_clang!\(installer\)/.test(podfile)
    && podfile.includes("__apple_build_version__ < 14000029L'") && podfile.includes("version == '11.0.2'");
  check('the Podfile post_install applies the fmt Apple clang consteval patch', patched);
  check('the Podfile post_install makes glog\'s namespace-included headers textual (Swift/C++ interop)',
    /make_glog_namespace_headers_textual!\(installer\)/.test(podfile)
      && /textual = %w\[log_severity\.h vlog_is_on\.h\]/.test(podfile));
  if (fmtVersion !== undefined) {
    check('the installed React Native still pins the fmt version the patch is written for', fmtVersion === '11.0.2', fmtVersion);
  }
}

console.log('[N10] CI user-interaction tests (XCUITest)');
{
  const configs = [...pbx.matchAll(/isa = XCBuildConfiguration;[\s\S]*?\n\t\t\};/g)].map((m) => m[0]);
  const testConfigs = configs.filter((b) => b.includes('TEST_TARGET_NAME = AthleteKinetics;'));
  const testIds = [...new Set(testConfigs.flatMap((b) => [...b.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1])))];
  check('the UI-test target tests the app and has the app-derived runner identifier',
    testConfigs.length === 2 && testIds.length === 1 && testIds[0] === 'com.pikemethods.training.uitests', testIds.join(','));
  check('the UI-test target is a ui-testing bundle that compiles the suite',
    pbx.includes('productType = "com.apple.product-type.bundle.ui-testing";')
      && pbx.includes('AthleteKineticsUITests.swift in Sources'));
  const scheme = read('apps/mobile/ios/AthleteKinetics.xcodeproj/xcshareddata/xcschemes/AthleteKinetics.xcscheme');
  check('the shared scheme tests the UI-test target, not a missing template target',
    scheme.includes('BlueprintName = "AthleteKineticsUITests"') && !scheme.includes('"AthleteKineticsTests"'));
  const suite = read('apps/mobile/ios/AthleteKineticsUITests/AthleteKineticsUITests.swift');
  const runner = read('tools/ios_ui_tests.sh');
  const tests = [...suite.matchAll(/func (test\w+)\(\)/g)].map((m) => m[1]);
  check('every UI test in the suite is run by CI, none skipped',
    tests.length >= 4 && tests.every((t) => runner.includes(`  ${t}\n`)) && !/XCTSkip|skipped = "YES"/.test(suite + scheme), tests.join(','));
  check('the suite covers the audit, Dynamic Type, Health denial + switching and Files backup/restore',
    suite.includes('performAccessibilityAudit(for: .all)') && suite.includes('UICTContentSizeCategoryAccessibilityXXXL')
      && suite.includes('Don’t Allow') && suite.includes('Athlete UITest B, active')
      && suite.includes('confirm-restore-button') && suite.includes('Restore complete.'));
  const ci = read('.github/workflows/ci.yml');
  check('CI builds the tests ad-hoc for the simulator only (no team, no profile) and runs them fail-closed',
    /CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER=/.test(ci) && /-sdk iphonesimulator[\s\S]*build-for-testing/.test(ci)
      && ci.includes('tools/ios_ui_tests.sh') && runner.includes('exit "$FAILED"') && runner.includes('lsof -nP -a -i -p'));
}

console.log(`\n${fail === 0 ? 'NATIVE CONFIG VERIFIED (static contract; native build evidence comes from the macOS CI job)' : `${fail} NATIVE CONFIG CHECK(S) FAILED`}`);
process.exit(fail === 0 ? 0 : 1);
