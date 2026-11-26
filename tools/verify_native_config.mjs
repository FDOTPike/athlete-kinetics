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
 *   [N11] beta orientation lock (#168): the Android main activity and iPhone
 *        are portrait only; iPad keeps its own orientation list.
 *
 * Run: npm run verify:native-config
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_SHA256 } from '../scripts/embedder-integrity.mjs';
import {
  KNOWN_BYTES as READER_KNOWN_BYTES,
  KNOWN_SHA256 as READER_KNOWN_SHA256,
  SAFETY_READER_ARTIFACT,
} from '../scripts/safety-reader-integrity.mjs';
import { splitJobs, splitSteps, stripYamlComments } from './verify_ci_structure.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
// XML comments are not active configuration: a commented-out key must read as
// absent, never as set (fail closed).
const stripXmlComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, '');
// Keys of the TOP-LEVEL plist dictionary only: a key nested in another
// dictionary (NSAppTransportSecurity, UIApplicationSceneManifest) is not an
// app-level setting and must read as absent (fail closed). Values: string
// text, true/false, an array's inner XML, or the opening tag of anything else.
const plistKeys = (xml) => {
  const out = new Map();
  const src = stripXmlComments(xml);
  const tags = /<key>([^<]+)<\/key>|<string>([^<]*)<\/string>|<(dict|array)>|<\/(dict|array)>|<(true|false)\/>|<(?:dict|array|string)\/>|<(integer|real|date|data)>[^<]*<\/\6>/g;
  let depth = 0; // 1 = inside the root dictionary
  let pendingKey = null;
  let arrayKey = null;
  let arrayStart = 0;
  for (const m of src.matchAll(tags)) {
    const [whole, key, text, open, close, bool] = m;
    if (key !== undefined) {
      if (depth === 1) pendingKey = key;
      continue;
    }
    const valueKey = depth === 1 ? pendingKey : null;
    if (depth === 1) pendingKey = null;
    if (open !== undefined) {
      if (valueKey !== null && open === 'array') { arrayKey = valueKey; arrayStart = m.index + whole.length; }
      else if (valueKey !== null) out.set(valueKey, whole);
      depth += 1;
    } else if (close !== undefined) {
      depth -= 1;
      if (depth === 1 && close === 'array' && arrayKey !== null) {
        out.set(arrayKey, src.slice(arrayStart, m.index));
        arrayKey = null;
      }
    } else if (valueKey !== null) {
      out.set(valueKey, text ?? (bool === 'true' ? true : bool === 'false' ? false : whole === '<string/>' ? '' : whole));
    }
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
  const backupSrc = read('apps/mobile/src/state/backupStore.ts');
  check('restore hands the iOS Files sheet a type identifier (the picker maps UTType(identifier)), not a MIME string',
    /return os === 'ios' \? \[allFilesType\] : \[MIME\];/.test(backupSrc)
      && /type: backupImportTypes\(Platform\.OS, picker\.types\.allFiles\)/.test(backupSrc)
      && !/pick\(\{[^}]*type: MIME/.test(backupSrc));
  check('the native smoke resolves those exact import types natively and CI requires every smoke check',
    smoke.includes("'Files import types resolve natively'") && smoke.includes('backupImportTypes(Platform.OS, picker.types.allFiles)')
      && read('tools/ios_simulator_smoke.sh').includes('"Files import types resolve natively"')
      && read('tools/ios_simulator_smoke.sh').includes('missing check:'));
  const stripJsComments = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const smokeRequiredChecks = (scriptSrc) => {
    const m = scriptSrc.match(/\bconst\s+required\s*=\s*\[([\s\S]*?)\];/);
    if (m === null) return [];
    return [...stripJsComments(m[1]).matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  };
  const hasQuestionBoxSmoke = (smokeSrc, smokeScriptSrc) => {
    const code = stripJsComments(smokeSrc);
    const stepStart = code.indexOf("step(checks, 'question box inference + routing'");
    if (stepStart === -1) return false;
    const stepTail = code.slice(stepStart);
    const nextStep = stepTail.indexOf('\n  await step(');
    const stepBody = nextStep === -1 ? stepTail : stepTail.slice(0, nextStep);
    const shapeGuard = /if\s*\(\s*asset\.dim\s*!==\s*384\s*\|\|\s*asset\.entryIds\.length\s*!==\s*1111\s*\|\|\s*asset\.vectors\.length\s*!==\s*1111\s*\)\s*(?:\{\s*)?throw\s+new\s+Error\b/;
    const vectorGuard = /if\s*\(\s*vector\.length\s*!==\s*384\s*\|\|\s*!\(Math\.abs\(norm\s*-\s*1\)\s*<=\s*1e-3\)\s*\)\s*(?:\{\s*)?throw\s+new\s+Error\b/;
    const routeGuard = /if\s*\(\s*(?:routed\.outcome\s*!==\s*['"]DELOAD['"]\s*\|\|\s*routed\.shown\[0\]\s*!==\s*['"]DELOAD['"]|routed\.shown\[0\]\s*!==\s*['"]DELOAD['"]\s*\|\|\s*routed\.outcome\s*!==\s*['"]DELOAD['"])\s*\)\s*(?:\{\s*)?throw\s+new\s+Error\b/;
    const separateOutcomeGuard = /if\s*\(\s*routed\.outcome\s*!==\s*['"]DELOAD['"]\s*\)\s*(?:\{\s*)?throw\s+new\s+Error\b/;
    const separateShownGuard = /if\s*\(\s*routed\.shown\[0\]\s*!==\s*['"]DELOAD['"]\s*\)\s*(?:\{\s*)?throw\s+new\s+Error\b/;
    return stepBody.includes('tryCreateDeviceEmbedder()')
      && stepBody.includes('question-vectors.json')
      && shapeGuard.test(stepBody)
      && /packVectors\([^,]+,\s*asset\.dim\)/.test(stepBody)
      && vectorGuard.test(stepBody)
      && /(?:routeQuestion\(\s*['"]what is a deload week['"]|const\s+question\s*=\s*['"]what is a deload week['"][\s\S]*routeQuestion\(\s*question\b)/.test(stepBody)
      && (routeGuard.test(stepBody) || (separateOutcomeGuard.test(stepBody) && separateShownGuard.test(stepBody)))
      && smokeRequiredChecks(smokeScriptSrc).includes('question box inference + routing');
  };
  const smokeScriptSrc = read('tools/ios_simulator_smoke.sh');
  check(
    'the native smoke verifies question-vectors.json (1111 x 384) routing via ONNX and CI requires it',
    hasQuestionBoxSmoke(smoke, smokeScriptSrc),
  );
  check(
    'falsifier: dropping "question box inference + routing" from ios_simulator_smoke.sh required list fails closed',
    !hasQuestionBoxSmoke(smoke, smokeScriptSrc.replace('"question box inference + routing"', '')),
  );
  const weakNormSmoke = smoke.replaceAll('!(Math.abs(norm - 1) <= 1e-3)', 'Math.abs(norm - 1) > 1e-3');
  const droppedStepSmoke = smoke.replace("'question box inference + routing'", "'dropped'");
  const noShapeGuardSmoke = smoke.replace(
    /\n\s*if\s*\(\s*asset\.dim\s*!==\s*384\s*\|\|\s*asset\.entryIds\.length\s*!==\s*1111\s*\|\|\s*asset\.vectors\.length\s*!==\s*1111\s*\)\s*\{[\s\S]*?\n\s*\}/,
    '',
  );
  const noVectorDimSmoke = smoke.replaceAll('vector.length !== 384 || !(Math.abs(norm - 1) <= 1e-3)', '!(Math.abs(norm - 1) <= 1e-3)');
  const warnOnlyRouteSmoke = smoke.replace(
    /if\s*\(\s*routed\.outcome\s*!==\s*['"]DELOAD['"]\s*\|\|\s*routed\.shown\[0\]\s*!==\s*['"]DELOAD['"]\s*\)\s*\{\s*throw\s+new\s+Error\b/,
    "if (routed.outcome !== 'DELOAD' || routed.shown[0] !== 'DELOAD') {\n      console.warn",
  );
  check(
    'falsifier: dropping the question box smoke step, removing the 1111x384 shape guard, dropping vector.length !== 384, weakening the NaN-safe norm guard, or downgrading route mismatch throw to warn fails closed',
    weakNormSmoke !== smoke
      && droppedStepSmoke !== smoke
      && noShapeGuardSmoke !== smoke
      && noVectorDimSmoke !== smoke
      && warnOnlyRouteSmoke !== smoke
      && !hasQuestionBoxSmoke(droppedStepSmoke, smokeScriptSrc)
      && !hasQuestionBoxSmoke(noShapeGuardSmoke, smokeScriptSrc)
      && !hasQuestionBoxSmoke(noVectorDimSmoke, smokeScriptSrc)
      && !hasQuestionBoxSmoke(weakNormSmoke, smokeScriptSrc)
      && !hasQuestionBoxSmoke(warnOnlyRouteSmoke, smokeScriptSrc),
  );
  const stripCComments = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const hasAppDelegateOrtTelemetryDisable = (src) => {
    const code = stripCComments(src);
    const appStart = code.search(/func\s+application\s*\(/);
    if (appStart === -1) return false;
    const body = code.slice(appStart);
    const rnStart = body.indexOf('RCTReactNativeFactory');
    if (rnStart === -1) return false;
    const beforeRn = body.slice(0, rnStart);
    return /setenv\(\s*"ORT_DISABLE_TELEMETRY"\s*,\s*"1"\s*,\s*1\s*\)/.test(beforeRn);
  };
  const hasShellOrtTelemetryDisable = (src, launchAnchor) => {
    const clean = stripYamlComments(src);
    const launchIdx = clean.indexOf(launchAnchor);
    if (launchIdx === -1) return false;
    const beforeLaunch = clean.slice(0, launchIdx);
    return /^\s*export\s+ORT_DISABLE_TELEMETRY=1\b/m.test(beforeLaunch)
      && /^\s*export\s+SIMCTL_CHILD_ORT_DISABLE_TELEMETRY=1\b/m.test(beforeLaunch);
  };
  const hasUITestLaunchOrtTelemetryDisable = (src) => {
    const code = stripCComments(src);
    const launchStart = code.search(/private\s+func\s+launch\s*\(/);
    if (launchStart === -1) return false;
    const launchEnd = code.indexOf('\n  }', launchStart);
    const body = launchEnd === -1 ? code.slice(launchStart) : code.slice(launchStart, launchEnd);
    const setIdx = body.search(/app\.launchEnvironment\[\s*"ORT_DISABLE_TELEMETRY"\s*\]\s*=\s*"1"/);
    const callIdx = body.indexOf('app.launch()');
    return setIdx !== -1 && callIdx !== -1 && setIdx < callIdx;
  };
  const appDelegateForOrt = read('apps/mobile/ios/AthleteKinetics/AppDelegate.swift');
  const uiRunnerForOrt = read('tools/ios_ui_tests.sh');
  const uiSuiteForOrt = read('apps/mobile/ios/AthleteKineticsUITests/AthleteKineticsUITests.swift');
  check(
    'iOS disables ONNX Runtime telemetry in AppDelegate, UITest launchEnvironment, and simulator runner scripts',
    hasAppDelegateOrtTelemetryDisable(appDelegateForOrt)
      && hasUITestLaunchOrtTelemetryDisable(uiSuiteForOrt)
      && hasShellOrtTelemetryDisable(smokeScriptSrc, 'xcrun simctl launch')
      && hasShellOrtTelemetryDisable(uiRunnerForOrt, 'xcodebuild test-without-building'),
  );
  const missingOrtDelegate = appDelegateForOrt.replace(/setenv\(\s*"ORT_DISABLE_TELEMETRY"[^\n]*\n?/g, '');
  const zeroedOrtDelegate = appDelegateForOrt.replace('"ORT_DISABLE_TELEMETRY", "1", 1', '"ORT_DISABLE_TELEMETRY", "0", 1');
  const lateOrtDelegate = missingOrtDelegate.replace(
    'let factory = RCTReactNativeFactory(delegate: delegate)',
    'let factory = RCTReactNativeFactory(delegate: delegate)\n    setenv("ORT_DISABLE_TELEMETRY", "1", 1)',
  );
  const missingOrtUiLaunch = uiSuiteForOrt.replace(/.*launchEnvironment\[\s*"ORT_DISABLE_TELEMETRY"[^\n]*\n?/g, '');
  const missingOrtSmoke = smokeScriptSrc.replace(/.*ORT_DISABLE_TELEMETRY[^\n]*\n?/g, '');
  const missingOrtUi = uiRunnerForOrt.replace(/.*SIMCTL_CHILD_ORT_DISABLE_TELEMETRY[^\n]*\n?/g, '');
  check(
    'falsifier: missing, mis-ordered, or zeroed ORT_DISABLE_TELEMETRY fails closed',
    missingOrtDelegate !== appDelegateForOrt
      && zeroedOrtDelegate !== appDelegateForOrt
      && lateOrtDelegate !== missingOrtDelegate
      && missingOrtUiLaunch !== uiSuiteForOrt
      && missingOrtSmoke !== smokeScriptSrc
      && missingOrtUi !== uiRunnerForOrt
      && !hasAppDelegateOrtTelemetryDisable(missingOrtDelegate)
      && !hasAppDelegateOrtTelemetryDisable(zeroedOrtDelegate)
      && !hasAppDelegateOrtTelemetryDisable(lateOrtDelegate)
      && !hasUITestLaunchOrtTelemetryDisable(missingOrtUiLaunch)
      && !hasShellOrtTelemetryDisable(missingOrtSmoke, 'xcrun simctl launch')
      && !hasShellOrtTelemetryDisable(missingOrtUi, 'xcodebuild test-without-building'),
  );
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
  // The iOS 27 SDK stops an app at launch unless it uses the UIScene life
  // cycle: the manifest names the scene delegate, and the window is made for
  // the scene there, not for the screen in the app delegate.
  const appDelegate = read('apps/mobile/ios/AthleteKinetics/AppDelegate.swift');
  const sceneBody = appDelegate.match(/^class SceneDelegate: UIResponder, UIWindowSceneDelegate \{\n([\s\S]*?)\n^\}$/m)?.[1] ?? '';
  check('the app adopts the UIScene life cycle: one scene, its delegate named in Info.plist',
    /<key>UIApplicationSceneManifest<\/key>\s*<dict>\s*<key>UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/.test(plistXml)
      && /<key>UIWindowSceneSessionRoleApplication<\/key>\s*<array>\s*<dict>\s*<key>UISceneConfigurationName<\/key>\s*<string>[^<]+<\/string>\s*<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>\s*<\/dict>\s*<\/array>/.test(plistXml));
  check('React Native starts in a window made for the scene, and no window is made for the screen',
    sceneBody.includes('UIWindow(windowScene: windowScene)') && /factory\.startReactNative\(\s*withModuleName:/.test(sceneBody)
      && sceneBody.includes('appDelegate.window = window') && !appDelegate.includes('UIWindow(frame:'));
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
  const inspectAppVersionConfigs = (pbxSrc) => {
    const blocks = [...pbxSrc.matchAll(/isa = XCBuildConfiguration;[\s\S]*?\n\t\t\};/g)].map((m) => m[0]);
    const appBlocks = blocks.filter(
      (b) => b.includes('PRODUCT_BUNDLE_IDENTIFIER = com.pikemethods.training;') && !b.includes('TEST_TARGET_NAME'),
    );
    const byName = new Map();
    for (const block of appBlocks) {
      const name = block.match(/\bname = ([^;]+);/)?.[1]?.trim();
      if (!name || byName.has(name)) return { ok: false, detail: `duplicate-or-unnamed:${appBlocks.length}` };
      const marketing = [...block.matchAll(/\bMARKETING_VERSION\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
      const build = [...block.matchAll(/\bCURRENT_PROJECT_VERSION\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
      byName.set(name, {
        marketing: marketing.length === 1 ? marketing[0] : marketing.join(','),
        build: build.length === 1 ? build[0] : build.join(','),
      });
    }
    const dbg = byName.get('Debug');
    const rel = byName.get('Release');
    const ok = byName.size === 2
      && dbg !== undefined && rel !== undefined
      && dbg.marketing === '1.0.0' && rel.marketing === '1.0.0'
      && dbg.build === '1' && rel.build === '1';
    return {
      ok,
      detail: `Debug=${dbg?.marketing ?? 'missing'}(${dbg?.build ?? 'missing'}) Release=${rel?.marketing ?? 'missing'}(${rel?.build ?? 'missing'})`,
    };
  };
  const versionState = inspectAppVersionConfigs(pbx);
  check(
    'AthleteKinetics Debug and Release configs set MARKETING_VERSION = 1.0.0 and CURRENT_PROJECT_VERSION = 1 (with Info.plist placeholders)',
    versionState.ok
      && plist.get('CFBundleShortVersionString') === '$(MARKETING_VERSION)'
      && plist.get('CFBundleVersion') === '$(CURRENT_PROJECT_VERSION)',
    versionState.detail,
  );
  const shortMarketingPbx = pbx.replace(/\bMARKETING_VERSION\s*=\s*[^;]+;/g, 'MARKETING_VERSION = 1.0;');
  const prereleaseMarketingPbx = pbx.replace(/\bMARKETING_VERSION\s*=\s*[^;]+;/g, 'MARKETING_VERSION = 1.0.0-beta.1;');
  const shortState = inspectAppVersionConfigs(shortMarketingPbx);
  const prereleaseState = inspectAppVersionConfigs(prereleaseMarketingPbx);
  check(
    'falsifier: MARKETING_VERSION = 1.0 or 1.0.0-beta.1 fails the app marketing-version contract',
    (pbx.match(/\bMARKETING_VERSION\s*=\s*[^;]+;/g) ?? []).length === 2
      && !shortState.ok && shortState.detail.includes('1.0(1)')
      && !prereleaseState.ok && prereleaseState.detail.includes('1.0.0-beta.1(1)'),
  );
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
  // Xcode 27 refuses a pod target below iOS 15.0 (issue #38).
  check('the Podfile post_install raises pod deployment targets below the app minimum, and lowers none',
    /^\s+raise_pod_deployment_targets!\(installer\)$/m.test(podfile)
      && /Gem::Version\.new\(current\) < minimum/.test(podfile)
      && podfile.includes("config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_version_supported"));
  // Xcode 27 builds with explicit modules; the pinned Apple Health binding
  // (16.0.0) needs its core's private module on the dependents' include path.
  // Read from the helper's own body, in order: the version guard returns
  // before the dependents are selected and before any include path is set.
  const exposeBody = podfile.match(/^def expose_healthkit_core_private_module!\(installer\)\n([\s\S]*?)\n^end$/m)?.[1] ?? '';
  const exposeGuard = exposeBody.search(/unless version == '16\.0\.0'\n[^\n]*\n\s+return\n\s+end\n/);
  const exposeSelect = exposeBody.indexOf("dependency.pod_name == 'ReactNativeHealthkitCore'");
  const exposeSet = exposeBody.indexOf("config.build_settings['SWIFT_INCLUDE_PATHS'] = \"#{current} #{include_path}\"");
  check('the Podfile post_install makes the Apple Health core\'s private module resolvable for its dependents (16.0.0 only)',
    /^\s+expose_healthkit_core_private_module!\(installer\)$/m.test(podfile)
      && exposeGuard !== -1 && exposeGuard < exposeSelect && exposeSelect < exposeSet,
    `guard@${exposeGuard} select@${exposeSelect} set@${exposeSet}`);
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
  // A test is either run (TESTS) or on hold by an owner decision (HELD_TESTS,
  // each entry "<test>:<tracking issue>", and the CI notice prints that issue).
  // Never both, never neither, and never skipped inside the suite or scheme.
  // null = the array is not declared (the runner reads both under set -u, so a
  // missing declaration fails the check rather than counting as empty).
  const runnerArray = (name) => {
    const m = runner.match(new RegExp(`^${name}=\\((?:\\n([\\s\\S]*?))?\\n?\\)`, 'm'));
    if (m === null) return null;
    return m[1] === undefined ? [] : m[1].split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));
  };
  const runTests = runnerArray('TESTS') ?? [];
  const heldEntries = runnerArray('HELD_TESTS');
  const held = (heldEntries ?? []).map((entry) => entry.match(/^(test\w+):(\d+)$/));
  const heldTests = held.map((m, i) => (m === null ? heldEntries[i] : m[1]));
  const heldNoticeNamesIssue = runner.includes('on hold::not run in CI (owner decision, issue #${held##*:})')
    && runner.includes('if [ "${#HELD_TESTS[@]}" -gt 0 ]; then');
  check('every UI test in the suite is run by CI or on hold with its own tracking issue, none skipped',
    tests.length >= 4 && new Set(runTests).size >= 4 && heldEntries !== null
      // No name listed twice, in one list or across both.
      && new Set([...runTests, ...heldTests]).size === runTests.length + heldTests.length
      && tests.every((t) => runTests.includes(t) !== heldTests.includes(t))
      && [...runTests, ...heldTests].every((t) => tests.includes(t))
      && held.every((m) => m !== null)
      && heldNoticeNamesIssue
      && !/XCTSkip|skipped = "YES"/.test(suite + scheme),
    `run=${runTests.join(',')} held=${heldEntries === null ? 'NOT DECLARED' : (heldEntries.join(',') || 'none')}`);
  check('the suite covers the audit, Dynamic Type, Health denial + switching and Files backup/restore',
    suite.includes('performAccessibilityAudit(for: .all)') && suite.includes('UICTContentSizeCategoryAccessibilityXXXL')
      && suite.includes('Don’t Allow') && suite.includes('Athlete UITest B, active')
      && suite.includes('confirm-restore-button') && suite.includes('Restore complete.'));
  const classified = [...suite.matchAll(/return true\s*\n\s*\}/g)].length;
  check('the audit classifies only Dynamic Type on text fields, and only because test2 measures a text field scaling',
    /if issue\.auditType == \.dynamicType, let el = issue\.element, fieldTypes\.contains\(el\.elementType\)/.test(suite)
      && /let fieldTypes: \[XCUIElement\.ElementType\] = \[\.textField, \.secureTextField, \.searchField\]/.test(suite)
      && suite.includes('a text field did not scale with the accessibility text size')
      && (suite.match(/A11Y-MEASURED/g) ?? []).length === 1, `early returns: ${classified}`);
  check('an unanswered HealthKit sheet is accepted only when the app trace proves no answer arrived',
    suite.includes('HEALTH-UNANSWERED') && runner.includes("grep -q 'AKUI HEALTH-UNANSWERED'")
      && runner.includes("request settled") && /code=1\n\s+FAILED=1/.test(runner));
  check('a skipped Health denial tap requires a later tapped and answered attempt before either simulator fallback',
    /var denialTapSkipped = false\s+for attempt in 1\.\.\.2 where !answered \{\s+var denialTapped = false/.test(suite)
      && /\.tap\(\)\s+denialTapped = true\s+log\("health sheet: tapped Don't Allow/.test(suite)
      && /if !denialTapped \{\s+denialTapSkipped = true\s+log\("health sheet disappeared/.test(suite)
      && /if now\.hasPrefix\("Apple Health access requested"\) \{ answered = denialTapped; break \}/.test(suite)
      && /\} else if denialTapSkipped \{\s+XCTFail\("the Health denial tap was skipped and no later attempt completed the denial"\)\s+\} else if healthHint\.exists/.test(suite));
  const denial = suite.slice(suite.indexOf('if var dontAllow = findHealthSheetButton'), suite.indexOf('// Every change of the wording'));
  const lookup = suite
    .slice(suite.indexOf('private func findHealthSheetButton('), suite.indexOf('/// A system alert with an OK button'))
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  check('Health denial waits within the original sheet deadline, scrolls its own table and taps the element with one re-resolution',
    denial.includes('let deadline = started.addingTimeInterval(150)')
      && denial.includes('while Date() < deadline')
      && denial.includes('dontAllow.exists && dontAllow.isHittable')
      && denial.includes('timeout: min(5, max(0, deadline.timeIntervalSinceNow))')
      && /if result == \.completed \{\s+if dontAllow\.exists \{\s+dontAllow\.tap\(\)/.test(denial)
      && /if resolvedAgain \{ break \}\s+resolvedAgain = true\s+guard let fresh = findHealthSheetButton\("Don’t Allow", timeout: max\(0, deadline.timeIntervalSinceNow\)\) else \{ break \}\s+dontAllow = fresh/.test(denial)
      && denial.includes('else if scrolls < 3') && denial.includes('app.tables.containing(named).firstMatch')
      && denial.includes('springboard.tables.containing(named).firstMatch')
      && /if table\.exists && table\.isHittable \{\s+table\.swipeUp\(velocity: \.slow\)\s+scrolls \+= 1/.test(denial)
      && !/coordinate\(|snapshot\(/.test(denial)
      && lookup.includes('(try? inApp.snapshot()) != nil || (try? app.staticTexts.matching(named).firstMatch.snapshot()) != nil')
      && lookup.includes('(try? inSpringboard.snapshot()) != nil || (try? springboard.staticTexts.matching(named).firstMatch.snapshot()) != nil'));
  const reveal = suite.slice(suite.indexOf('private func reveal('), suite.indexOf('private func tap('));
  check('general reveal keeps the passing master app gestures without extra ScrollView queries',
    reveal.includes('app.swipeUp(velocity: .slow)') && reveal.includes('app.swipeDown(velocity: .slow)')
      && !reveal.includes('scrollViews'));
  const workout = suite.slice(suite.indexOf('func test5_workoutLogBackgroundAndRelaunch()'), suite.indexOf('// MARK: - Files'));
  check('workout load entry requires keyboard dismissal after at most two blur targets and requires selected RIR evidence',
    /for key in \["Your next step", "session-load-label"\]/.test(workout)
      && /reveal\(target,[\s\S]*bringClear\(target,[\s\S]*target\.tap\(\)/.test(workout)
      && workout.includes('predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch')
      && workout.includes('XCTWaiter.wait(for: [hidden], timeout: 5) == .completed')
      && workout.includes('XCTAssertFalse(app.keyboards.firstMatch.exists, "the load number pad did not dismiss after both non-input blur taps")')
      && /reveal\(reps, "2 clean reps left"\)\s+bringClear\(reps, "2 clean reps left"\)\s+reps\.tap\(\)/.test(workout)
      && workout.includes('reps.isSelected') && workout.includes('XCTWaiter.wait(for: [selected], timeout: 10)')
      && !workout.includes('scrollViews.firstMatch.swipeDown'));
  const checkTimeBasedEffortFallback = (src) =>
    src.includes('label == %@", "Decrease Seconds"')
      && src.includes('XCTAssertTrue(secondsStepper.exists, "2 clean reps left did not appear for a non-time-based set")')
      && /reveal\(directToggle, "Enter Effort directly"\)\s+bringClear\(directToggle, "Enter Effort directly"\)\s+directToggle\.tap\(\)/.test(src)
      && /reveal\(effort, "Effort 7\.0"\)\s+bringClear\(effort, "Effort 7\.0"\)\s+effort\.tap\(\)/.test(src)
      && src.includes('effort.isSelected');
  check('workout effort fallback is gated on time-based sets (Decrease Seconds) and requires selected direct Effort evidence',
    checkTimeBasedEffortFallback(workout));
  check('falsifier: dropping the Decrease Seconds guard or effort.isSelected check from test5 fails closed',
    !checkTimeBasedEffortFallback(workout.replace('XCTAssertTrue(secondsStepper.exists, "2 clean reps left did not appear for a non-time-based set")', ''))
      && !checkTimeBasedEffortFallback(workout.replaceAll('effort.isSelected', 'true')));
  check('a timed-out HealthKit request is accepted only when healthd logged the session timeout',
    suite.includes('HEALTH-TIMEOUT-SHOWN') && runner.includes("grep -q 'AKUI HEALTH-TIMEOUT-SHOWN'")
      && runner.includes("grep -q 'Authorization session timed out'")
      && (runner.match(/code=1\n\s+FAILED=1/g) ?? []).length >= 2);
  const ci = read('.github/workflows/ci.yml');
  check('CI builds the tests ad-hoc for the simulator only (no team, no profile) and runs them fail-closed',
    /CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER=/.test(ci) && /-sdk iphonesimulator[\s\S]*build-for-testing/.test(ci)
      && ci.includes('tools/ios_ui_tests.sh') && runner.includes('exit "$FAILED"') && runner.includes('lsof -nP -a -i -p'));
  const checkIosBetaBuildSplit = (ciYaml) => {
    const clean = stripYamlComments(ciYaml);
    const jobsAt = clean.indexOf('\njobs:');
    if (jobsAt === -1) return { ok: false, nonBetaClean: false, uiTestBetaEnabled: false };
    const workflowHeader = clean.slice(0, jobsAt);
    const jobs = splitJobs(clean);
    const verifyJob = jobs.get('verify') ?? '';
    const androidJob = jobs.get('android-apk') ?? '';
    const iosJob = jobs.get('ios-simulator') ?? '';
    if (!iosJob) return { ok: false, nonBetaClean: false, uiTestBetaEnabled: false };
    const stepsIdx = iosJob.indexOf('\n    steps:');
    if (stepsIdx === -1) return { ok: false, nonBetaClean: false, uiTestBetaEnabled: false };
    const iosJobHeader = iosJob.slice(0, stepsIdx);
    const steps = splitSteps(iosJob);
    const unsignedStep = steps.find((s) => s.includes('Build unsigned Release for the simulator')) ?? '';
    const uiTestStep = steps.find((s) => s.includes('Build the UI tests')) ?? '';
    const otherJobsClean = [...jobs.entries()]
      .filter(([name]) => name !== 'ios-simulator')
      .every(([, body]) => !body.includes('AK_BETA_BUILD'));
    const nonUiTestStepsClean = steps.every((s) => s === uiTestStep || !s.includes('AK_BETA_BUILD'));
    const nonBetaClean = !workflowHeader.includes('AK_BETA_BUILD')
      && !verifyJob.includes('AK_BETA_BUILD')
      && !androidJob.includes('AK_BETA_BUILD')
      && otherJobsClean
      && !iosJobHeader.includes('AK_BETA_BUILD')
      && unsignedStep !== '' && nonUiTestStepsClean;
    const stepTopKeys = (stepYaml) => {
      const keys = [];
      for (const rawLine of stepYaml.split('\n')) {
        const m = rawLine.match(/^(?: {8}| {6}- )(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:\s][^:]*?))\s*:/);
        if (m === null) continue;
        let k = m[1].trim();
        if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
          k = k.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
        }
        keys.push(k);
      }
      return keys;
    };
    const uiTestKeys = stepTopKeys(uiTestStep);
    const uiTestBetaEnabled = uiTestStep !== ''
      && /\n {8}env:\s*\n(?: {10}[^\n]+\n)*? {10}AK_BETA_BUILD:\s*['"]?on['"]?\b/.test(uiTestStep)
      && /xcodebuild[\s\S]*\bAK_BETA_BUILD=on\s+build-for-testing\b/.test(uiTestStep)
      && !uiTestKeys.includes('continue-on-error')
      && !uiTestKeys.includes('if');
    return {
      ok: nonBetaClean && uiTestBetaEnabled,
      nonBetaClean,
      uiTestBetaEnabled,
    };
  };
  const betaSplit = checkIosBetaBuildSplit(ci);
  check(
    'CI enables AK_BETA_BUILD=on only on the iOS UI-test build step and leaves unsigned Release/Android/verify non-beta',
    betaSplit.ok,
    `nonBetaClean=${betaSplit.nonBetaClean} uiTestBetaEnabled=${betaSplit.uiTestBetaEnabled}`,
  );
  check(
    'falsifier: removing AK_BETA_BUILD from Build the UI tests fails the CI beta-switch contract',
    !checkIosBetaBuildSplit(ci.replace(/AK_BETA_BUILD[^\n]*\n?/g, '')).ok,
  );
  const workflowBetaCi = ci.replace('\nenv:\n', "\nenv:\n  AK_BETA_BUILD: 'on'\n");
  const unsignedBetaCi = ci.replace(
    '- name: Build unsigned Release for the simulator\n',
    "- name: Build unsigned Release for the simulator\n        env:\n          AK_BETA_BUILD: 'on'\n",
  );
  const iosJobBetaCi = ci.replace('    env:\n      XCODE_MAJOR:', "    env:\n      AK_BETA_BUILD: 'on'\n      XCODE_MAJOR:");
  const quotedIfUiTestCi = ci.replace(
    /(- name: Build the UI tests[^\n]*\n)/,
    '$1        "if": ${{ false }}\n',
  );
  const quotedContinueUiTestCi = ci.replace(
    /(- name: Build the UI tests[^\n]*\n)/,
    "$1        'continue-on-error': true\n",
  );
  check(
    'falsifier: setting AK_BETA_BUILD at workflow env, ios-simulator job env, or Build unsigned Release fails non-beta isolation, and quoted if/continue-on-error keys on Build the UI tests fail closed',
    workflowBetaCi !== ci
      && unsignedBetaCi !== ci
      && iosJobBetaCi !== ci
      && quotedIfUiTestCi !== ci
      && quotedContinueUiTestCi !== ci
      && !checkIosBetaBuildSplit(workflowBetaCi).nonBetaClean
      && !checkIosBetaBuildSplit(unsignedBetaCi).nonBetaClean
      && !checkIosBetaBuildSplit(iosJobBetaCi).nonBetaClean
      && !checkIosBetaBuildSplit(quotedIfUiTestCi).uiTestBetaEnabled
      && !checkIosBetaBuildSplit(quotedContinueUiTestCi).uiTestBetaEnabled,
  );
  const typesSrc = read('packages/inference/src/types.ts');
  const onboardingSrc = read('apps/mobile/src/screens/OnboardingScreen.tsx');
  const parseBooleanStateInit = (src, varName) => {
    const raw = src.match(new RegExp(`const \\[${varName}\\b[^\\]]*\\]\\s*=\\s*useState\\((true|false)\\)`))?.[1];
    return raw === 'true' ? true : raw === 'false' ? false : null;
  };
  const parseDefaultSteps = (body, flags) => {
    if (!body || Object.values(flags).some((v) => v === null || v === undefined)) return null;
    const resolved = body.replace(
      /\.\.\.\(\s*(\w+)\s*\?\s*\[([^\]]*)\]\s*:\s*\[\s*\]\s*\)/g,
      (_, flag, inner) => (Object.hasOwn(flags, flag) ? (flags[flag] ? inner : '') : `...(${flag}?...)`),
    );
    if (resolved.includes('...') || resolved.includes('?')) return null;
    const entries = resolved.replace(/\s+as const\b/g, '');
    if (entries.replace(/'[a-z_]+'/g, '').replace(/[\s,]/g, '') !== '') return null;
    return [...resolved.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };
  const computeOnboardingContract = (typesSource, onboardingSource) => {
    const defaultProfileBody = typesSource.match(/export const DEFAULT_PROFILE:\s*UserProfile\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1] ?? '';
    const defaultTrainingAge = defaultProfileBody.match(/training_age:\s*'([^']+)'/)?.[1];
    const usesDefaultProfile = /useState<UserProfile>\(\{\s*\.\.\.DEFAULT_PROFILE\b/.test(onboardingSource);
    const asksMaxesMatch = onboardingSource.match(/const asksMaxes\s*=\s*draft\.training_age\s*(!==|===)\s*'([^']+)';/);
    const asksMaxes = asksMaxesMatch !== null && defaultTrainingAge !== undefined
      ? (asksMaxesMatch[1] === '!==' ? defaultTrainingAge !== asksMaxesMatch[2] : defaultTrainingAge === asksMaxesMatch[2])
      : null;
    const wantsSport = parseBooleanStateInit(onboardingSource, 'wantsSport');
    const wantsTarget = parseBooleanStateInit(onboardingSource, 'wantsTarget');
    const stepsBody = onboardingSource.match(/const steps:\s*StepKey\[\]\s*=\s*useMemo\(\s*\(\)\s*=>\s*\[([\s\S]*?)\],\s*\[[^\]]*\]\s*,?\s*\);/)?.[1] ?? '';
    const defaultSteps = parseDefaultSteps(stepsBody, { wantsSport, wantsTarget, asksMaxes });
    const limitsIdx = defaultSteps === null ? -1 : defaultSteps.indexOf('limits');
    const expectedOnboardingSteps = limitsIdx > 0 ? limitsIdx : null;
    return { defaultTrainingAge, usesDefaultProfile, asksMaxes, wantsSport, wantsTarget, defaultSteps, expectedOnboardingSteps };
  };
  const {
    defaultTrainingAge,
    usesDefaultProfile,
    asksMaxes,
    wantsSport,
    wantsTarget,
    defaultSteps,
    expectedOnboardingSteps,
  } = computeOnboardingContract(typesSrc, onboardingSrc);
  const onboardingBody = suite.match(/private func completeOnboarding\([\s\S]*?\n  \}/)?.[0] ?? '';
  const completeOnboardingStepCount = (swiftSrc) => {
    const codeOnly = swiftSrc.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    const fnBrace = codeOnly.indexOf('{');
    if (fnBrace === -1) return null;
    const matches = [...codeOnly.matchAll(/\bfor\s+step\s+in\s+1\.\.\.(\d+)\s*\{/g)];
    if (matches.length !== 1) return null;
    // Require the enclosing onboarding loop itself to sit on the function's
    // unconditional top-level path (brace depth 0 inside completeOnboarding),
    // with no preceding #if/guard/return (including nested conditional returns).
    const beforeLoop = codeOnly.slice(fnBrace + 1, matches[0].index);
    let prefixDepth = 0;
    let prefixNonString = '';
    let topLevelPrefix = '';
    for (let i = 0; i < beforeLoop.length; i += 1) {
      const ch = beforeLoop[i];
      if (ch === '"') {
        const strStart = i;
        i += 1;
        while (i < beforeLoop.length && beforeLoop[i] !== '"') {
          if (beforeLoop[i] === '\\' && i + 1 < beforeLoop.length) i += 2;
          else i += 1;
        }
        if (prefixDepth === 0) topLevelPrefix += beforeLoop.slice(strStart, i + 1);
        continue;
      }
      if (ch === '{') { prefixDepth += 1; prefixNonString += ch; continue; }
      if (ch === '}') { prefixDepth -= 1; if (prefixDepth < 0) return null; prefixNonString += ch; continue; }
      prefixNonString += ch;
      if (prefixDepth === 0) topLevelPrefix += ch;
    }
    if (prefixDepth !== 0) return null;
    if (/#if\b|\bguard\b|\breturn\b/.test(topLevelPrefix) || /#if\b|\breturn\b/.test(prefixNonString)) return null;
    const bodyStart = matches[0].index + matches[0][0].length;
    let depth = 1;
    let bodyEnd = -1;
    for (let i = bodyStart; i < codeOnly.length; i += 1) {
      const ch = codeOnly[i];
      if (ch === '"') {
        i += 1;
        while (i < codeOnly.length && codeOnly[i] !== '"') {
          if (codeOnly[i] === '\\' && i + 1 < codeOnly.length) i += 2;
          else i += 1;
        }
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    if (bodyEnd === -1) return null;
    const loopBody = codeOnly.slice(bodyStart, bodyEnd);
    const afterLoop = codeOnly.slice(bodyEnd + 1);
    // Require tap("Next", ...) on the loop's unconditional execution path
    // (brace depth 0 inside loopBody; reject #if/guard/return/continue/break
    // at depth 0 or nested inside blocks before tap("Next", ...)).
    let loopDepth = 0;
    let loopNonString = '';
    let topLevelLoop = '';
    for (let i = 0; i < loopBody.length; i += 1) {
      const ch = loopBody[i];
      if (ch === '"') {
        const strStart = i;
        i += 1;
        while (i < loopBody.length && loopBody[i] !== '"') {
          if (loopBody[i] === '\\' && i + 1 < loopBody.length) i += 2;
          else i += 1;
        }
        if (loopDepth === 0) topLevelLoop += loopBody.slice(strStart, i + 1);
        continue;
      }
      if (ch === '{') { loopDepth += 1; loopNonString += ch; continue; }
      if (ch === '}') { loopDepth -= 1; if (loopDepth < 0) return null; loopNonString += ch; continue; }
      loopNonString += ch;
      if (loopDepth === 0) topLevelLoop += ch;
    }
    if (loopDepth !== 0) return null;
    if (/#if\b|\bguard\b|\breturn\b|\bcontinue\b|\bbreak\b/.test(topLevelLoop)) return null;
    if (/#if\b|\breturn\b|\bcontinue\b|\bbreak\b/.test(loopNonString)) return null;
    if (!/\btap\(\s*"Next"/.test(topLevelLoop)) return null;
    if (!afterLoop.includes('tap("No, nothing to note")')) return null;
    return Number(matches[0][1]);
  };
  const actualOnboardingSteps = completeOnboardingStepCount(onboardingBody);
  check(
    `completeOnboarding loops for step in 1...${expectedOnboardingSteps ?? '?'} before "No, nothing to note" (default training_age=${defaultTrainingAge ?? 'unknown'})`,
    usesDefaultProfile
      && wantsSport !== null
      && wantsTarget !== null
      && expectedOnboardingSteps !== null
      && actualOnboardingSteps === expectedOnboardingSteps,
    `asksMaxes=${asksMaxes} wantsSport=${wantsSport} wantsTarget=${wantsTarget} steps=${defaultSteps?.length ?? 'unknown'} expected=${expectedOnboardingSteps ?? 'unknown'} actual=${actualOnboardingSteps ?? 'missing'}`,
  );
  const staleEightScreenOnboarding = onboardingBody.replace(/\bfor\s+step\s+in\s+1\.\.\.\d+/, 'for step in 1...6');
  const noNextTapOnboarding = onboardingBody.replace(/\btap\(\s*"Next"[^\n]*\)/, 'log("skipped next")');
  const unreachableNextTapOnboarding = onboardingBody.replace(/(\btap\(\s*"Next"[^\n]*\))/, 'if false { $1 }');
  const unreachableLoopOnboarding = onboardingBody.replace(
    /(\bfor\s+step\s+in\s+1\.\.\.\d+\s*\{[\s\S]*?\n    \})/,
    'if false {\n$1\n    }',
  );
  const conditionalReturnOnboarding = onboardingBody.replace(
    /(\bfor\s+step\s+in\s+1\.\.\.\d+)/,
    'if true { return }\n    $1',
  );
  const conditionalLoopContinueOnboarding = onboardingBody.replace(
    /(\btap\(\s*"Next"[^\n]*\))/,
    'if true { continue }\n      $1',
  );
  check(
    'falsifier: completeOnboarding with 1...6 Next taps, missing tap("Next"), unreachable conditional tap("Next"), unreachable enclosing loop, preceding conditional return, or nested loop continue fails against the 9-screen default onboarding',
    expectedOnboardingSteps === 7
      && noNextTapOnboarding !== onboardingBody
      && unreachableNextTapOnboarding !== onboardingBody
      && unreachableLoopOnboarding !== onboardingBody
      && conditionalReturnOnboarding !== onboardingBody
      && conditionalLoopContinueOnboarding !== onboardingBody
      && completeOnboardingStepCount(staleEightScreenOnboarding) === 6
      && completeOnboardingStepCount(staleEightScreenOnboarding) !== expectedOnboardingSteps
      && completeOnboardingStepCount(noNextTapOnboarding) === null
      && completeOnboardingStepCount(unreachableNextTapOnboarding) === null
      && completeOnboardingStepCount(unreachableLoopOnboarding) === null
      && completeOnboardingStepCount(conditionalReturnOnboarding) === null
      && completeOnboardingStepCount(conditionalLoopContinueOnboarding) === null,
  );
  const typedSportInit = onboardingSrc.replace(
    /const \[wantsSport\b[^\]]*\]\s*=\s*useState\((?:true|false)\)/,
    'const [wantsSport, setWantsSport] = useState<boolean>(true)',
  );
  const typedTargetInit = onboardingSrc.replace(
    /const \[wantsTarget\b[^\]]*\]\s*=\s*useState\((?:true|false)\)/,
    'const [wantsTarget, setWantsTarget] = useState<boolean>(true)',
  );
  const poisonedSportContract = computeOnboardingContract(typesSrc, typedSportInit);
  const poisonedTargetContract = computeOnboardingContract(typesSrc, typedTargetInit);
  check(
    'falsifier: typed optional-screen initializers (useState<boolean>(true)) parse as null and fail closed',
    typedSportInit !== onboardingSrc
      && typedTargetInit !== onboardingSrc
      && poisonedSportContract.wantsSport === null
      && poisonedSportContract.expectedOnboardingSteps === null
      && poisonedTargetContract.wantsTarget === null
      && poisonedTargetContract.expectedOnboardingSteps === null,
  );
  const bareSpreadOnboarding = onboardingSrc.replace(
    /const steps:\s*StepKey\[\]\s*=\s*useMemo\(\s*\(\)\s*=>\s*\[/,
    'const steps: StepKey[] = useMemo(() => [\n      ...extraSteps,',
  );
  const poisonedSpreadContract = computeOnboardingContract(typesSrc, bareSpreadOnboarding);
  check(
    'falsifier: unresolved spread (...extraSteps) in onboarding steps parses as null and fails closed',
    bareSpreadOnboarding !== onboardingSrc
      && parseDefaultSteps("'welcome', ...extraSteps, 'limits'", { wantsSport: true, wantsTarget: true, asksMaxes: true }) === null
      && poisonedSpreadContract.defaultSteps === null
      && poisonedSpreadContract.expectedOnboardingSteps === null,
  );
  const bareEntryOnboarding = onboardingSrc.replace(
    /const steps:\s*StepKey\[\]\s*=\s*useMemo\(\s*\(\)\s*=>\s*\[/,
    'const steps: StepKey[] = useMemo(() => [\n      extraStep,',
  );
  const poisonedEntryContract = computeOnboardingContract(typesSrc, bareEntryOnboarding);
  check(
    'falsifier: bare identifier entry (extraStep) in onboarding steps parses as null and fails closed',
    bareEntryOnboarding !== onboardingSrc
      && parseDefaultSteps("'welcome', extraStep, 'limits'", { wantsSport: true, wantsTarget: true, asksMaxes: true }) === null
      && poisonedEntryContract.defaultSteps === null
      && poisonedEntryContract.expectedOnboardingSteps === null,
  );
  const stripSwiftComments = (src) => src.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
  const currentLabelBody = suite.match(/private func currentLabel\([\s\S]*?\n  \}/)?.[0] ?? '';
  const settledLabelBody = suite.match(/private func settledLabel\([\s\S]*?\n  \}/)?.[0] ?? '';
  const isSnapshotPollingSettledLabel = (src, labelHelperSrc = currentLabelBody) => {
    const code = stripSwiftComments(src);
    const helperCode = stripSwiftComments(labelHelperSrc);
    return helperCode.includes('try? el.snapshot()')
      && !/\.exists\b/.test(helperCode)
      && code.includes('currentLabel(')
      && /usleep\(\s*500_000\s*\)/.test(code)
      && code.includes('Date() >= deadline')
      && code.includes('lastLabel ?? "<absent>"')
      && code.includes('XCTFail(')
      && !/XCTWaiter|XCTNSPredicateExpectation|\.exists\b/.test(code);
  };
  check(
    'settledLabel polls currentLabel via snapshot() instead of XCTWaiter/NSPredicate or blocking .exists',
    isSnapshotPollingSettledLabel(settledLabelBody),
  );
  const waiterSettledLabel = [
    'private func settledLabel(_ el: XCUIElement, beginsWith prefix: String, _ what: String, timeout: TimeInterval = 120) -> String {',
    '  let done = NSPredicate(format: "label BEGINSWITH %@", prefix)',
    '  let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: done, object: el)], timeout: timeout)',
    '  let label = el.exists ? el.label : "<absent>"',
    '  if result != .completed { XCTFail("\\(what)") }',
    '  return label',
    '}',
  ].join('\n');
  check(
    'falsifier: XCTWaiter-based settledLabel fails the snapshot-polling contract',
    !isSnapshotPollingSettledLabel(waiterSettledLabel),
  );
  const hasSafeOnboardingTransition = (src) => {
    const code = stripSwiftComments(src);
    const startIdx = code.indexOf('"START TRAINING"');
    if (startIdx === -1) return false;
    const tail = code.slice(startIdx);
    const firstTap = tail.indexOf('startBtn.tap()');
    if (firstTap === -1) return false;
    const preTap = tail.slice(0, firstTap);
    const postTap = tail.slice(firstTap + 'startBtn.tap()'.length);
    return !/\btap\("START TRAINING"\)/.test(tail)
      && /reveal\(\s*startBtn\s*,\s*"START TRAINING"\s*\)/.test(preTap)
      && /bringClear\(\s*startBtn\s*,\s*"START TRAINING"\s*\)/.test(preTap)
      && !/waitForExistence\(\s*timeout:\s*8\s*\)/.test(postTap)
      && /addingTimeInterval\(\s*60\s*\)/.test(postTap)
      && /while\s+Date\(\)\s*<\s*\w+/.test(postTap)
      && postTap.includes('(try? element("Create program").snapshot()) != nil')
      && postTap.includes('(try? element("Cancel").snapshot()) != nil')
      && postTap.includes('XCTAssertTrue(create.isEnabled')
      && postTap.includes('START-TRAINING-RETRY')
      && /startBtn\.isHittable/.test(postTap)
      && /Date\(\)\.timeIntervalSince\(\w+\)\s*>=\s*5/.test(postTap)
      && postTap.includes('(try? element("shell-primary-tabs").snapshot()) != nil')
      && /offerHandled\s*\|\|\s*Date\(\)\.timeIntervalSince\(\w+\)\s*>=\s*8/.test(postTap)
      && postTap.includes('XCTFail(');
  };
  check(
    'completeOnboarding brings START TRAINING clear, retries if unmounted transition stalls, and handles late BUILD YOUR PROGRAM offers up to 60 s',
    hasSafeOnboardingTransition(onboardingBody),
  );
  const staleStartOnboarding = [
    '  tap("START TRAINING")',
    '  let cancel = element("Cancel")',
    '  if cancel.waitForExistence(timeout: 8) { cancel.tap() }',
    '  wait(element("shell-primary-tabs"), "the primary tabs", timeout: 60)',
  ].join('\n');
  check(
    'falsifier: bare tap("START TRAINING") with 8 s Cancel wait fails the onboarding transition contract',
    !hasSafeOnboardingTransition(staleStartOnboarding),
  );
  const test4Body = suite.match(/func test4_backupToFilesAndRestore\([\s\S]*?\n  \}/)?.[0] ?? '';
  const hasPostRestoreOfferLoop = (src) => {
    const code = stripSwiftComments(src);
    const loop900 = code.indexOf('Date().timeIntervalSince(restoreStart) < 900');
    const settledCall = code.indexOf('settledLabel(restoreStatus, beginsWith: "Restore complete."');
    if (loop900 === -1 || settledCall === -1 || settledCall <= loop900) return false;
    const preLoop900 = code.slice(0, loop900);
    const between = code.slice(loop900, settledCall);
    const afterLoop900Start = between.indexOf('\n    }');
    if (afterLoop900Start === -1) return false;
    const insideLoop900 = between.slice(0, afterLoop900Start);
    const postLoop = between.slice(afterLoop900Start);
    const deadlineLoopIdx = postLoop.search(/while\s+Date\(\)\s*<\s*\w+/);
    if (deadlineLoopIdx === -1) return false;
    const afterDeadlineIdx = postLoop.indexOf('\n    }', deadlineLoopIdx);
    if (afterDeadlineIdx === -1) return false;
    const insidePostLoop = postLoop.slice(0, afterDeadlineIdx);
    const afterDeadline = postLoop.slice(afterDeadlineIdx);
    return /\bvar\s+restoreOfferHandled\s*=\s*false\b/.test(preLoop900)
      && /\brestoreOfferHandled\s*=\s*true\b/.test(insideLoop900)
      && /addingTimeInterval\(\s*60\s*\)/.test(insidePostLoop)
      && /while\s+Date\(\)\s*<\s*\w+/.test(insidePostLoop)
      && insidePostLoop.includes('(try? element("Create program").snapshot()) != nil')
      && insidePostLoop.includes('(try? element("Cancel").snapshot()) != nil')
      && insidePostLoop.includes('dismissSetUpOfferIfShown("after the restore")')
      && /\brestoreOfferHandled\s*=\s*true\b/.test(insidePostLoop)
      && insidePostLoop.includes('openProfile()')
      && /if\s+restoreOfferHandled\s*,\s*let\s+now\s*=\s*currentLabel\(restoreStatus\)\s*,\s*now\.hasPrefix\("Restore complete\."\)/.test(insidePostLoop)
      && !/\bif\s+let\s+now\s*=\s*currentLabel\(restoreStatus\)\s*,\s*now\.hasPrefix\("Restore complete\."\)/.test(insidePostLoop)
      && /\bXCTAssertTrue\(\s*restoreOfferHandled\b/.test(afterDeadline)
      && code.slice(settledCall).includes('Coach mode, 1 athlete')
      && code.slice(settledCall).includes('After Backup');
  };
  check(
    'test4_backupToFilesAndRestore keeps post-restore BUILD YOUR PROGRAM offer handling active until restoreOfferHandled && Restore complete. and fails closed at deadline',
    hasPostRestoreOfferLoop(test4Body),
  );
  const oneShotPostRestore = [
    '    while Date().timeIntervalSince(restoreStart) < 900 {',
    '      sleep(2)',
    '    }',
    '    dismissSetUpOfferIfShown("after the restore")',
    '    settledLabel(restoreStatus, beginsWith: "Restore complete.", "status after restore", timeout: 60)',
    '    Coach mode, 1 athlete',
    '    After Backup',
  ].join('\n');
  check(
    'falsifier: one-shot dismissSetUpOfferIfShown without a post-restore poll loop fails the restore race contract',
    !hasPostRestoreOfferLoop(oneShotPostRestore),
  );
  const ungatedPostRestoreBreak = [
    '    var restoreOfferHandled = false',
    '    while Date().timeIntervalSince(restoreStart) < 900 {',
    '      restoreOfferHandled = true',
    '      sleep(2)',
    '    }',
    '    let postRestoreDeadline = Date().addingTimeInterval(60)',
    '    while Date() < postRestoreDeadline {',
    '      if (try? element("Create program").snapshot()) != nil && (try? element("Cancel").snapshot()) != nil {',
    '        dismissSetUpOfferIfShown("after the restore")',
    '        restoreOfferHandled = true',
    '        openProfile()',
    '        continue',
    '      }',
    '      if let now = currentLabel(restoreStatus), now.hasPrefix("Restore complete.") { break }',
    '      usleep(500_000)',
    '    }',
    '    XCTAssertTrue(restoreOfferHandled, "the restored athlete\'s set-up offer was not handled before the 60 s post-restore deadline")',
    '    settledLabel(restoreStatus, beginsWith: "Restore complete.", "status after restore", timeout: 60)',
    '    Coach mode, 1 athlete',
    '    After Backup',
  ].join('\n');
  check(
    'falsifier: breaking post-restore offer polling on Restore complete. before restoreOfferHandled fails the restore race contract',
    !hasPostRestoreOfferLoop(ungatedPostRestoreBreak),
  );
  const silentDeadlineExitPostRestore = [
    '    var restoreOfferHandled = false',
    '    while Date().timeIntervalSince(restoreStart) < 900 {',
    '      restoreOfferHandled = true',
    '      sleep(2)',
    '    }',
    '    let postRestoreDeadline = Date().addingTimeInterval(60)',
    '    while Date() < postRestoreDeadline {',
    '      if (try? element("Create program").snapshot()) != nil && (try? element("Cancel").snapshot()) != nil {',
    '        dismissSetUpOfferIfShown("after the restore")',
    '        restoreOfferHandled = true',
    '        openProfile()',
    '        continue',
    '      }',
    '      if restoreOfferHandled, let now = currentLabel(restoreStatus), now.hasPrefix("Restore complete.") { break }',
    '      usleep(500_000)',
    '    }',
    '    settledLabel(restoreStatus, beginsWith: "Restore complete.", "status after restore", timeout: 60)',
    '    Coach mode, 1 athlete',
    '    After Backup',
  ].join('\n');
  check(
    'falsifier: silently exiting the 60 s post-restore loop with restoreOfferHandled == false fails the restore race contract',
    !hasPostRestoreOfferLoop(silentDeadlineExitPostRestore),
  );
  const unlockBody = suite.match(/private func unlockAdvancedTools\([\s\S]*?\n  \}/)?.[0] ?? '';
  const hasDecoupledBuildUnlock = (src) => {
    const code = stripSwiftComments(src);
    return /\blet\s+build\s*=\s*element\(\s*labelBeginsWith:\s*"Build "\s*\)/.test(code)
      && !src.includes('"Build 0.1.0"')
      && /\bfor\s+_\s+in\s+1\.\.\.7\s*\{[^}]*\.tap\(\)/.test(code)
      && /\bwait\(\s*element\(\s*"advanced-athlete-manager"\s*\)/.test(code);
  };
  check(
    'unlockAdvancedTools uses element(labelBeginsWith: "Build "), omits "Build 0.1.0", and preserves the 7-tap unlock wait',
    hasDecoupledBuildUnlock(unlockBody),
    unlockBody.match(/let\s+build\s*=\s*[^\n]+/)?.[0]?.trim() ?? 'missing',
  );
  const hardcodedBuildUnlock = unlockBody.replace(/let\s+build\s*=\s*element\([^)]+\)/, 'let build = element("Build 0.1.0")');
  check(
    'falsifier: unlockAdvancedTools using element("Build 0.1.0") fails the decoupled build-label contract',
    hardcodedBuildUnlock.includes('element("Build 0.1.0")') && !hasDecoupledBuildUnlock(hardcodedBuildUnlock),
  );
  // #362 (2026-11-16 owner ruling): keep UIDeviceFamily = [1] on the app target
  // and ensure XCUITest supports the 375 x 667 pt compatibility viewport.
  const appConfigs = configs.filter((b) => b.includes('PRODUCT_BUNDLE_IDENTIFIER = com.pikemethods.training;') && !b.includes('TEST_TARGET_NAME'));
  const isPhoneOnlyAppConfig = (block) => {
    const m = block.match(/TARGETED_DEVICE_FAMILY\s*=\s*"?([^";]+)"?\s*;/);
    return m === null || !/\b2\b/.test(m[1]);
  };
  check(
    'app target configurations omit iPad (2) from TARGETED_DEVICE_FAMILY (UIDeviceFamily=[1], #362)',
    appConfigs.length === 2 && appConfigs.every(isPhoneOnlyAppConfig),
    `configs=${appConfigs.length}`,
  );
  const universalAppConfig = appConfigs[0].replace(/buildSettings = \{/, 'buildSettings = {\n\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";');
  check(
    'falsifier: adding TARGETED_DEVICE_FAMILY = "1,2" to an app config fails the phone-only app check',
    universalAppConfig !== appConfigs[0] && !isPhoneOnlyAppConfig(universalAppConfig),
  );
  const hasCompatibilityViewportRevealReach = (src) => {
    const code = stripSwiftComments(src);
    const upMatch = code.match(/while\s+!el\.isHittable\s*&&\s*tries\s*<\s*(\d+)\s*\{\s*app\.swipeUp\(velocity:\s*\.slow\);\s*tries\s*\+=\s*1\s*\}/);
    const downMatch = code.match(/while\s+!el\.isHittable\s*&&\s*tries\s*<\s*(\d+)\s*\{\s*app\.swipeDown\(velocity:\s*\.slow\);\s*tries\s*\+=\s*1\s*\}/);
    const between = upMatch && downMatch && upMatch.index < downMatch.index
      ? code.slice(upMatch.index + upMatch[0].length, downMatch.index)
      : '';
    const hasResetBetweenLoops = /\btries\s*=\s*0\b/.test(between);
    return upMatch !== null
      && downMatch !== null
      && hasResetBetweenLoops
      && Number(upMatch[1]) >= 30
      && Number(downMatch[1]) >= 45
      && !code.includes('scrollViews');
  };
  check(
    'reveal() swipes at least 30 slow ups, resets tries = 0, then swipes at least 45 slow downs to reach controls in a 375x667 viewport (#362)',
    hasCompatibilityViewportRevealReach(reveal),
  );
  const shortReveal = [
    'while !el.isHittable && tries < 15 { app.swipeUp(velocity: .slow); tries += 1 }',
    'tries = 0',
    'while !el.isHittable && tries < 30 { app.swipeDown(velocity: .slow); tries += 1 }',
  ].join('\n');
  check(
    'falsifier: 15-swipe reveal() fails the 375x667 viewport reach contract',
    !hasCompatibilityViewportRevealReach(shortReveal),
  );
  const noResetReveal = [
    'while !el.isHittable && tries < 30 { app.swipeUp(velocity: .slow); tries += 1 }',
    'while !el.isHittable && tries < 45 { app.swipeDown(velocity: .slow); tries += 1 }',
  ].join('\n');
  check(
    'falsifier: omitting tries = 0 reset between reveal() swipe loops fails the 375x667 viewport reach contract',
    !hasCompatibilityViewportRevealReach(noResetReveal),
  );
  const dismissBody = suite.slice(suite.indexOf('private func dismissHealthAccessAlertIfShown('), suite.indexOf('// MARK: - tests'));
  const hasCompatibilityHealthAlertHandling = (src) => {
    const code = stripSwiftComments(src);
    return code.includes('found.place == "the app", !alertFrame.isNull, alertFrame.midY < targetFrame.midY')
      && code.includes('abs(nf.width - targetFrame.width) <= 2')
      && code.includes('findSheetContainer')
      && /\bif\s+offsetSource\s*==\s*"none",\s*let\s+container\s*=\s*findSheetContainer\(root\)/.test(code)
      && code.includes('targetFrame.width < sbFrame.width - 2 && targetFrame.height < sbFrame.height - 2')
      && code.includes('springboard.coordinate(withNormalizedOffset:')
      && /\blet\s+stillShownAfter1s\s*=\s*probeAlertOKStillShown\(\s*"after-1s"\s*\)/.test(code)
      && code.includes('still shown after 1 s: \\(stillShownAfter1s')
      && /\bif\s+stillShownAfter1s\s*\{[\s\S]*\bif\s+measuredOffset\s*>\s*0\b[\s\S]*\bfound\.ok\.tap\(\)/.test(code)
      && !code.includes('after-compat-offset-retry')
      && !/found\.frame\.height\s*\*/.test(code)
      && !/max\([^)]*,\s*30\b/.test(code)
      && code.includes('XCTAssertFalse(stillShownAfter3s, "the Health Access alert stayed open after the OK tap")');
  };
  check(
    'dismissHealthAccessAlertIfShown scales compatibility-window taps into SpringBoard screen coordinates, retries via found.ok.tap() without hard-coded offsets, and preserves immutable 1 s probe logging (#362)',
    hasCompatibilityHealthAlertHandling(dismissBody),
  );
  const legacyDismiss = [
    'if found.place == "the app", !alertFrame.isNull, alertFrame.midY < targetFrame.midY {',
    '  if nf.minY == 0 && abs(nf.width - targetFrame.width) <= 2 { measuredOffset = targetFrame.height - nf.height }',
    '}',
    'let stillShownAfter1s = probeAlertOKStillShown("after-1s")',
    'if stillShownAfter1s && measuredOffset > 0 { _ = probeAlertOKStillShown("after-unshifted-retry") }',
    'log("still shown after 1 s: \\(stillShownAfter1s ? \\"yes\\" : \\"no\\")")',
    'XCTAssertFalse(stillShownAfter3s, "the Health Access alert stayed open after the OK tap")',
  ].join('\n');
  check(
    'falsifier: measuredOffset-only retry in dismissHealthAccessAlertIfShown fails the compatibility-window contract',
    !hasCompatibilityHealthAlertHandling(legacyDismiss),
  );
  const unscaledCompatDismiss = [
    'let sbFrame = springboard.frame',
    'func findSheetContainer(_ root: XCUIElementSnapshot) -> XCUIElementSnapshot? { nil }',
    'if found.place == "the app", !alertFrame.isNull, alertFrame.midY < targetFrame.midY {',
    '  if nf.minY == 0 && abs(nf.width - targetFrame.width) <= 2 { measuredOffset = targetFrame.height - nf.height }',
    '}',
    'found.target.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: found.frame.midX, dy: initialOffsetY)).tap()',
    'let stillShownAfter1s = probeAlertOKStillShown("after-1s")',
    'if stillShownAfter1s { if measuredOffset > 0 { _ = probeAlertOKStillShown("after-unshifted-retry") } else { found.ok.tap() } }',
    'log("still shown after 1 s: \\(stillShownAfter1s ? \\"yes\\" : \\"no\\")")',
    'XCTAssertFalse(stillShownAfter3s, "the Health Access alert stayed open after the OK tap")',
  ].join('\n');
  check(
    'falsifier: unscaled found.target.coordinate without sbFrame compatibility scaling fails the contract',
    !hasCompatibilityHealthAlertHandling(unscaledCompatDismiss),
  );
  const hardcodedOffsetDismiss = [
    'let isCompatBox = targetFrame.width < sbFrame.width - 2 && targetFrame.height < sbFrame.height - 2',
    'func findSheetContainer(_ root: XCUIElementSnapshot) -> XCUIElementSnapshot? { nil }',
    'if found.place == "the app", !alertFrame.isNull, alertFrame.midY < targetFrame.midY {',
    '  if nf.minY == 0 && abs(nf.width - targetFrame.width) <= 2 { measuredOffset = targetFrame.height - nf.height }',
    '}',
    'springboard.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: 0, dy: 0)).tap()',
    'let stillShownAfter1s = probeAlertOKStillShown("after-1s")',
    'if stillShownAfter1s {',
    '  if measuredOffset > 0 {',
    '    _ = probeAlertOKStillShown("after-unshifted-retry")',
    '  } else {',
    '    let compatY = min(targetFrame.maxY - 8, found.frame.midY + max(found.frame.height * 0.625, 30))',
    '    found.ok.tap()',
    '    _ = probeAlertOKStillShown("after-compat-offset-retry")',
    '  }',
    '}',
    'log("still shown after 1 s: \\(stillShownAfter1s ? \\"yes\\" : \\"no\\")")',
    'XCTAssertFalse(stillShownAfter3s, "the Health Access alert stayed open after the OK tap")',
  ].join('\n');
  check(
    'falsifier: hard-coded hosting-sheet fallback offset fails the compatibility-window contract',
    !hasCompatibilityHealthAlertHandling(hardcodedOffsetDismiss),
  );
  const overwritten1sDismiss = [
    'let isCompatBox = targetFrame.width < sbFrame.width - 2 && targetFrame.height < sbFrame.height - 2',
    'func findSheetContainer(_ root: XCUIElementSnapshot) -> XCUIElementSnapshot? { nil }',
    'if found.place == "the app", !alertFrame.isNull, alertFrame.midY < targetFrame.midY {',
    '  if nf.minY == 0 && abs(nf.width - targetFrame.width) <= 2 { measuredOffset = targetFrame.height - nf.height }',
    '}',
    'springboard.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: 0, dy: 0)).tap()',
    'var stillShown = probeAlertOKStillShown("after-1s")',
    'if stillShown { if measuredOffset > 0 { stillShown = probeAlertOKStillShown("after-unshifted-retry") } else { found.ok.tap() } }',
    'log("still shown after 1 s: \\(stillShown ? \\"yes\\" : \\"no\\")")',
    'XCTAssertFalse(stillShownAfter3s, "the Health Access alert stayed open after the OK tap")',
  ].join('\n');
  check(
    'falsifier: overwriting the 1 s probe boolean before logging fails the immutable probe contract',
    !hasCompatibilityHealthAlertHandling(overwritten1sDismiss),
  );
  const elseIfSheetContainerDismiss = dismissBody.replace(
    /\}\s*\n\s*if\s+offsetSource\s*==\s*"none",\s*let\s+container\s*=\s*findSheetContainer\(root\)/,
    '} else if let container = findSheetContainer(root)',
  );
  check(
    'falsifier: tying findSheetContainer(root) to else-if after findAlertAncestors fails the fallback contract',
    elseIfSheetContainerDismiss !== dismissBody && !hasCompatibilityHealthAlertHandling(elseIfSheetContainerDismiss),
  );
  const expandCoachBody = suite.match(/private func expandCoachMode\([\s\S]*?\n  \}/)?.[0] ?? '';
  const isHardenedExpandCoachMode = (src) => {
    const code = stripSwiftComments(src);
    const unlockIdx = code.indexOf('unlockAdvancedTools()');
    const revealIdx = code.search(/reveal\(\s*coach\s*,\s*"Coach mode"\s*\)/);
    const bringClearIdx = code.search(/bringClear\(\s*coach\s*,\s*"Coach mode"\s*\)/);
    const tapIdx = code.indexOf('coach.tap()');
    const settledIdx = code.search(/settledLabel\(\s*coach\s*,\s*beginsWith:\s*"Coach mode,"\s*,\s*"Coach Mode"\s*,\s*timeout:\s*10\s*\)/);
    if (unlockIdx === -1 || revealIdx === -1 || bringClearIdx === -1 || tapIdx === -1 || settledIdx === -1) return false;
    if (!(unlockIdx < revealIdx && revealIdx < bringClearIdx && bringClearIdx < tapIdx && tapIdx < settledIdx)) return false;
    const preReveal = code.slice(unlockIdx, revealIdx);
    const preTap = code.slice(bringClearIdx, tapIdx);
    const tapBlock = code.slice(bringClearIdx, settledIdx);
    const postSettled = code.slice(settledIdx);
    return preReveal.includes('currentLabel(coach)')
      && preReveal.includes('"Coach mode,"')
      && /while\s+Date\(\)\s*</.test(preReveal)
      && preReveal.includes('pollCoachLabel(')
      && preTap.includes('pollCoachLabel(')
      && /\bif\s*\(?\s*(?!\s*!)[^!{}\n]*?\.hasSuffix\(\s*"collapsed"\s*\)\s*\)?\s*\{\s*coach\.tap\(\)/.test(tapBlock)
      && /XCTAssertFalse\(\s*label\.hasSuffix\("collapsed"\)/.test(postSettled)
      && !/\bcoach\.label\b|\.exists\b|waitForExistence|XCTWaiter|XCTNSPredicateExpectation/.test(code);
  };
  check(
    'expandCoachMode polls currentLabel(coach), brings header clear, taps only when collapsed, and asserts expansion',
    isHardenedExpandCoachMode(expandCoachBody),
  );
  const unhardenedExpandCoach = [
    'private func expandCoachMode() -> String {',
    '  unlockAdvancedTools()',
    '  let coach = element(labelBeginsWith: "Coach mode,")',
    '  reveal(coach, "Coach mode")',
    '  if coach.label.hasSuffix("collapsed") { coach.tap() }',
    '  let label = settledLabel(coach, beginsWith: "Coach mode,", "Coach Mode", timeout: 10)',
    '  return label',
    '}',
  ].join('\n');
  const negatedTapExpandCoach = expandCoachBody.replace(
    '(preTapLabel ?? "").hasSuffix("collapsed")',
    '!(preTapLabel ?? "").hasSuffix("collapsed")',
  );
  check(
    'falsifier: unhardened expandCoachMode reading coach.label without pre-reveal polling or bringClear fails',
    !isHardenedExpandCoachMode(unhardenedExpandCoach),
  );
  check(
    'falsifier: negated collapsed check gating coach.tap() fails the expandCoachMode contract',
    negatedTapExpandCoach !== expandCoachBody && !isHardenedExpandCoachMode(negatedTapExpandCoach),
  );

  const cancelFilesBody = suite.match(/private func cancelFilesSheet\([\s\S]*?\n  \}/)?.[0] ?? '';
  const inventoryBody = suite.match(/private func filesSheetInventory\([\s\S]*?\n  \}/)?.[0] ?? '';
  const isHardenedCancelFilesSheet = (cancelSrc, inventorySrc = inventoryBody) => {
    const cancelCode = stripSwiftComments(cancelSrc);
    const inventoryCode = stripSwiftComments(inventorySrc);
    if (/\.exists\b|waitForExistence/.test(cancelCode) || /\.exists\b/.test(inventoryCode)) return false;
    if (!inventoryCode.includes('(try? bar.snapshot()) == nil')) return false;
    const whileIdx = cancelCode.indexOf('while Date().timeIntervalSince(opened) < 30');
    const guardIdx = cancelCode.indexOf('guard let cancel = found else');
    if (whileIdx === -1 || guardIdx === -1 || guardIdx <= whileIdx) return false;
    const beforeLoop = cancelCode.slice(0, whileIdx);
    const rootButtonsIdx = beforeLoop.indexOf('root.buttons.matching(named)');
    const rootDescIdx = beforeLoop.indexOf('root.descendants(matching: .any).matching(named)');
    const barSnapIdx = beforeLoop.indexOf('(try? bar.snapshot()) != nil');
    const barCallIdx = beforeLoop.indexOf('if barPresent, let match = firstIn(bar, fromBar: true)');
    const wholeWaitIdx = beforeLoop.search(/if\s+Date\(\)\.timeIntervalSince\(\s*opened\s*\)\s*>=\s*10\s*,\s*\n?\s*let\s+match\s*=\s*firstIn\(\s*self\.app\s*,\s*fromBar:\s*false\s*\)/);
    const appCallIdx = beforeLoop.indexOf('firstIn(self.app, fromBar: false)');
    if ([rootButtonsIdx, rootDescIdx, barSnapIdx, barCallIdx, wholeWaitIdx, appCallIdx].some((i) => i === -1)) {
      return false;
    }
    if (!(rootButtonsIdx < rootDescIdx && barSnapIdx < barCallIdx && barCallIdx < wholeWaitIdx && wholeWaitIdx < appCallIdx)) {
      return false;
    }
    if (/self\.app\.(buttons|descendants)|firstIn\(\s*self\.app/.test(beforeLoop.slice(0, wholeWaitIdx))) return false;
    if (/fallback\s*==\s*nil[\s\S]{0,40}Date\(\)\.timeIntervalSince\(\s*opened\s*\)\s*>=\s*10/.test(beforeLoop)) return false;
    const afterLoop = cancelCode.slice(whileIdx, guardIdx);
    const loopCloseMatch = afterLoop.match(/usleep\(500_000\)\s*\n\s*\}/);
    if (!loopCloseMatch) return false;
    const inLoop = afterLoop.slice(0, loopCloseMatch.index);
    if (!/\(\s*candidate\.isHittable\s*\|\|\s*Date\(\)\.timeIntervalSince\(\s*opened\s*\)\s*>=\s*10\s*\)[\s\S]{0,80}frame\s*==\s*lastFrame\s*&&\s*identity\s*==\s*lastIdentity/.test(inLoop)) {
      return false;
    }
    const postLoop = afterLoop.slice(loopCloseMatch.index + loopCloseMatch[0].length);
    return postLoop.includes('found == nil')
      && postLoop.includes('!lastFrame.isNull')
      && postLoop.includes('!lastIdentity.isEmpty')
      && postLoop.includes('currentChoice()')
      && postLoop.includes('frame == lastFrame && identity == lastIdentity')
      && postLoop.includes('found = candidate');
  };
  check(
    'cancelFilesSheet gates bar/whole-app queries via bar.snapshot(), prioritizes hittable candidates before 10 s fallback, performs final 30s-boundary confirmation read, and filesSheetInventory uses bar.snapshot()',
    isHardenedCancelFilesSheet(cancelFilesBody),
  );
  const unhardenedCancelFiles = [
    '  func currentChoice() -> (XCUIElement, XCUIElementSnapshot, CGRect, String, Bool)? {',
    '    let bar = filesSheetBar()',
    '    let sources: [(() -> XCUIElement, Bool)] = [',
    '      ({ bar.buttons.matching(named).firstMatch }, true),',
    '      ({ bar.descendants(matching: .any).matching(named).firstMatch }, true),',
    '      ({ self.app.buttons.matching(named).firstMatch }, false),',
    '      ({ self.app.descendants(matching: .any).matching(named).firstMatch }, false),',
    '    ]',
    '    return nil',
    '  }',
    '  while Date().timeIntervalSince(opened) < 30 {',
    '    if let (candidate, snap, frame, identity, fromBar) = currentChoice() {',
    '      if frame == lastFrame && identity == lastIdentity { found = candidate; break }',
    '      lastFrame = frame; lastIdentity = identity',
    '    }',
    '    usleep(500_000)',
    '  }',
    '  guard let cancel = found else { return Date() }',
  ].join('\n');
  const unhardenedInventory = 'private func filesSheetInventory() -> String { return !bar.exists ? "absent" : "" }';
  const insideLoopConfirmationCancel = cancelFilesBody.replace(
    /usleep\(500_000\)\s*\n    \}\s*\n    (if\s+found\s*==\s*nil[\s\S]*?\n    \})/,
    'usleep(500_000)\n      $1\n    }',
  );
  const fallbackGatedWholeAppCancel = cancelFilesBody.replace(
    /if\s+Date\(\)\.timeIntervalSince\(opened\)\s*>=\s*10/,
    'if fallback == nil && Date().timeIntervalSince(opened) >= 10',
  );
  const earlyNonHittableAcceptCancel = cancelFilesBody.replace(
    /\(candidate\.isHittable\s*\|\|\s*Date\(\)\.timeIntervalSince\(opened\)\s*>=\s*10\),\s*\n\s*frame\s*==\s*lastFrame/,
    'frame == lastFrame',
  );
  check(
    'falsifier: unhardened cancelFilesSheet and .exists-based filesSheetInventory fail closed',
    !isHardenedCancelFilesSheet(unhardenedCancelFiles, inventoryBody)
      && !isHardenedCancelFilesSheet(cancelFilesBody, unhardenedInventory),
  );
  check(
    'falsifier: moving 30s confirmation block inside the while loop after usleep fails closed',
    insideLoopConfirmationCancel !== cancelFilesBody && !isHardenedCancelFilesSheet(insideLoopConfirmationCancel),
  );
  check(
    'falsifier: gating >= 10s whole-app lookup on fallback == nil or accepting non-hittable Cancel before 10s fails closed',
    fallbackGatedWholeAppCancel !== cancelFilesBody
      && earlyNonHittableAcceptCancel !== cancelFilesBody
      && !isHardenedCancelFilesSheet(fallbackGatedWholeAppCancel)
      && !isHardenedCancelFilesSheet(earlyNonHittableAcceptCancel),
  );

  const saveInFilesBody = suite.match(/private func saveInFiles\([\s\S]*?\n  \}/)?.[0] ?? '';
  const isHardenedSaveInFiles = (src) => {
    const code = stripSwiftComments(src);
    const whileIdx = code.indexOf('while Date() < deadline');
    const onMyIPhoneIdx = code.indexOf('onMyIPhone()');
    const failIdx = code.indexOf('XCTFail("the Files export sheet had no enabled Save/Move action")');
    if (whileIdx === -1 || onMyIPhoneIdx === -1 || failIdx === -1) return false;
    if (!(whileIdx < onMyIPhoneIdx && onMyIPhoneIdx < failIdx)) return false;
    const waitLoop = code.slice(whileIdx, onMyIPhoneIdx);
    const tailLog = code.slice(onMyIPhoneIdx, failIdx);
    return waitLoop.includes('(try? filesControl(["Save", "Move", "Done", "Open", "Cancel"]).snapshot()) != nil')
      && waitLoop.includes('currentLabel(status)')
      && tailLog.includes('currentLabel(status)')
      && !/\.exists\b|\.label\b/.test(code);
  };
  check(
    'saveInFiles uses snapshot() and currentLabel(status) instead of blocking .exists/.label in wait loop and failure log',
    isHardenedSaveInFiles(saveInFilesBody),
  );
  const unhardenedSaveInFiles = [
    'private func saveInFiles() {',
    '  let status = element("backup-status-message")',
    '  let deadline = Date().addingTimeInterval(300)',
    '  var lastStatus = ""',
    '  while Date() < deadline {',
    '    if filesControl(["Save", "Move", "Done", "Open", "Cancel"]).exists { break }',
    '    if status.exists && status.label != lastStatus {',
    '      lastStatus = status.label',
    '    }',
    '    sleep(2)',
    '  }',
    '  onMyIPhone()',
    '  log("status=\\(element("backup-status-message").exists ? element("backup-status-message").label : "-")")',
    '  XCTFail("the Files export sheet had no enabled Save/Move action")',
    '}',
  ].join('\n');
  check(
    'falsifier: unhardened saveInFiles using .exists and .label fails closed',
    !isHardenedSaveInFiles(unhardenedSaveInFiles),
  );
  const test1Body = suite.match(/func test1_onboardingNavigationAndAccessibility\([\s\S]*?\n  \}/)?.[0] ?? '';
  const extractUnconditionalSwift = (src) => {
    const chars = [...src];
    const n = chars.length;
    const blanked = new Array(n).fill(false);
    const noStrings = new Array(n).fill(' ');
    for (let i = 0; i < n; i += 1) {
      const ch = chars[i];
      const next = chars[i + 1];
      if (ch === '/' && next === '/') {
        while (i < n && chars[i] !== '\n') { blanked[i] = true; i += 1; }
        if (i < n && chars[i] === '\n') noStrings[i] = '\n';
        continue;
      }
      if (ch === '/' && next === '*') {
        blanked[i] = true; blanked[i + 1] = true; i += 2;
        while (i < n && !(chars[i] === '*' && chars[i + 1] === '/')) {
          if (chars[i] === '\n') noStrings[i] = '\n';
          blanked[i] = true; i += 1;
        }
        if (i + 1 < n) { blanked[i] = true; blanked[i + 1] = true; i += 1; }
        continue;
      }
      if (ch === '"') {
        i += 1;
        while (i < n && chars[i] !== '"') {
          if (chars[i] === '\\' && i + 1 < n) i += 2;
          else i += 1;
        }
        continue;
      }
      noStrings[i] = ch;
    }
    const codeOnly = noStrings.join('');
    if (/#if\b|\bguard\b|\breturn\b/.test(codeOnly)) return null;
    let braceDepth = 0;
    for (let i = 0; i < n; i += 1) {
      const ch = noStrings[i];
      if (ch === '{') {
        braceDepth += 1;
        blanked[i] = true;
      } else if (ch === '}') {
        if (braceDepth === 0) return null;
        blanked[i] = true;
        braceDepth -= 1;
      } else if (braceDepth > 0) {
        blanked[i] = true;
      }
    }
    if (braceDepth !== 0) return null;
    return chars.map((ch, idx) => (blanked[idx] ? ' ' : ch)).join('');
  };
  const hasGlossaryAndQuestionBoxInTest1 = (src) => {
    const code = stripSwiftComments(src);
    const loopEnd = code.indexOf('issues += audit(screen)');
    if (loopEnd === -1) return false;
    const loopClose = code.indexOf('}', loopEnd);
    const finalAssert = code.indexOf('XCTAssertTrue(issues.isEmpty');
    if (loopClose === -1 || finalAssert === -1 || finalAssert <= loopClose) return false;
    const unconditionalPostLoop = extractUnconditionalSwift(code.slice(loopClose + 1, finalAssert));
    if (unconditionalPostLoop === null) return false;
    const tokens = [
      /"Open terminology glossary"/,
      /wait\(\s*element\(\s*"glossary-screen"\s*\)/,
      /issues \+=\s*audit\(\s*"Glossary"\s*\)/,
      /"Question box"/,
      /wait\(\s*element\(\s*"question-box"\s*\)/,
      /issues \+=\s*audit\(\s*"QuestionBox"\s*\)/,
      /"Question"[\s\S]*?"what is a deload week"/,
      /"Ask"[\s\S]*?\.tap\(\)/,
      /wait\(\s*element\(\s*"question-answer-card"\s*\)[^\n]*timeout:\s*60\s*\)/,
      /wait\(\s*element\(\s*"DELOAD"\s*\)[^\n]*timeout:\s*60\s*\)/,
      /wait\(\s*element\(\s*labelBeginsWith:\s*"A planned easy week\."\s*\)[^\n]*timeout:\s*60\s*\)/,
      /"Back to Athlete Profile"/,
      /wait\(\s*element\(\s*"athlete-screen-shown"\s*\)/,
    ];
    let cursor = 0;
    for (const re of tokens) {
      const match = re.exec(unconditionalPostLoop.slice(cursor));
      if (match === null) return false;
      cursor += match.index + match[0].length;
    }
    return true;
  };
  check(
    'test1_onboardingNavigationAndAccessibility unconditionally audits Glossary and QuestionBoxPanel and verifies DELOAD routing before asserting issues.isEmpty',
    hasGlossaryAndQuestionBoxInTest1(test1Body),
  );
  const plainSevenScreenTest1 = [
    '  func test1_onboardingNavigationAndAccessibility() throws {',
    '    for (key, screen, marker) in destinations {',
    '      issues += audit(screen)',
    '    }',
    '    XCTAssertTrue(issues.isEmpty)',
    '  }',
  ].join('\n');
  const conditionalQuestionBoxTest1 = [
    '  func test1_onboardingNavigationAndAccessibility() throws {',
    '    for (key, screen, marker) in destinations {',
    '      issues += audit(screen)',
    '    }',
    '    tap("Open terminology glossary")',
    '    wait(element("glossary-screen"), "glossary")',
    '    issues += audit("Glossary")',
    '    if element("Question box").waitForExistence(timeout: 3) {',
    '      tap("Question box")',
    '      wait(element("question-box"), "question box")',
    '      issues += audit("QuestionBox")',
    '      enterText(into: "Question", "what is a deload week", submit: false)',
    '      element("Ask").tap()',
    '      wait(element("question-answer-card"), "answer", timeout: 60)',
    '      wait(element("DELOAD"), "deload", timeout: 60)',
    '      wait(element(labelBeginsWith: "A planned easy week."), "deload def", timeout: 60)',
    '    }',
    '    tap("Back to Athlete Profile")',
    '    wait(element("athlete-screen-shown"), "profile")',
    '    XCTAssertTrue(issues.isEmpty)',
    '  }',
  ].join('\n');
  const ifFalseWrappedTest1 = [
    '  func test1_onboardingNavigationAndAccessibility() throws {',
    '    for (key, screen, marker) in destinations {',
    '      issues += audit(screen)',
    '    }',
    '    if false {',
    '      tap("Open terminology glossary")',
    '      wait(element("glossary-screen"), "glossary")',
    '      issues += audit("Glossary")',
    '      tap("Question box")',
    '      wait(element("question-box"), "question box")',
    '      issues += audit("QuestionBox")',
    '      enterText(into: "Question", "what is a deload week", submit: false)',
    '      element("Ask").tap()',
    '      wait(element("question-answer-card"), "answer", timeout: 60)',
    '      wait(element("DELOAD"), "deload", timeout: 60)',
    '      wait(element(labelBeginsWith: "A planned easy week."), "deload def", timeout: 60)',
    '      tap("Back to Athlete Profile")',
    '      wait(element("athlete-screen-shown"), "profile")',
    '    }',
    '    XCTAssertTrue(issues.isEmpty)',
    '  }',
  ].join('\n');
  const earlyReturnTest1 = [
    '  func test1_onboardingNavigationAndAccessibility() throws {',
    '    for (key, screen, marker) in destinations {',
    '      issues += audit(screen)',
    '    }',
    '    if true { return }',
    '    tap("Open terminology glossary")',
    '    wait(element("glossary-screen"), "glossary")',
    '    issues += audit("Glossary")',
    '    tap("Question box")',
    '    wait(element("question-box"), "question box")',
    '    issues += audit("QuestionBox")',
    '    enterText(into: "Question", "what is a deload week", submit: false)',
    '    element("Ask").tap()',
    '    wait(element("question-answer-card"), "answer", timeout: 60)',
    '    wait(element("DELOAD"), "deload", timeout: 60)',
    '    wait(element(labelBeginsWith: "A planned easy week."), "deload def", timeout: 60)',
    '    tap("Back to Athlete Profile")',
    '    wait(element("athlete-screen-shown"), "profile")',
    '    XCTAssertTrue(issues.isEmpty)',
    '  }',
  ].join('\n');
  const earlyAssertTest1 = [
    '  func test1_onboardingNavigationAndAccessibility() throws {',
    '    for (key, screen, marker) in destinations {',
    '      issues += audit(screen)',
    '    }',
    '    XCTAssertTrue(issues.isEmpty)',
    '    tap("Open terminology glossary")',
    '    wait(element("glossary-screen"), "glossary")',
    '    issues += audit("Glossary")',
    '  }',
  ].join('\n');
  const deloadLogOnlyTest1 = test1Body.replace(
    /wait\(\s*element\(\s*"DELOAD"\s*\)[^\n]*\)\s*\n\s*wait\(\s*element\(\s*labelBeginsWith:\s*"A planned easy week\."[^\n]*\)/,
    'log("DELOAD")',
  );
  const missingDeloadDefTest1 = test1Body.replace(
    /\n\s*wait\(\s*element\(\s*labelBeginsWith:\s*"A planned easy week\."[^\n]*/,
    '',
  );
  const emptyLoopWrappedTest1 = ifFalseWrappedTest1.replace('if false {', 'for _ in [Int]() {');
  const uncalledClosureWrappedTest1 = ifFalseWrappedTest1.replace('if false {', 'let unusedAudit = {');
  check(
    'falsifier: plain 7-destination test1, conditional, if-false, empty-loop, or uncalled-closure QuestionBox wrappers, early return, early issues.isEmpty assertion, or log("DELOAD") without title+definition waits all fail closed',
    deloadLogOnlyTest1 !== test1Body
      && missingDeloadDefTest1 !== test1Body
      && emptyLoopWrappedTest1 !== ifFalseWrappedTest1
      && uncalledClosureWrappedTest1 !== ifFalseWrappedTest1
      && !hasGlossaryAndQuestionBoxInTest1(plainSevenScreenTest1)
      && !hasGlossaryAndQuestionBoxInTest1(conditionalQuestionBoxTest1)
      && !hasGlossaryAndQuestionBoxInTest1(ifFalseWrappedTest1)
      && !hasGlossaryAndQuestionBoxInTest1(emptyLoopWrappedTest1)
      && !hasGlossaryAndQuestionBoxInTest1(uncalledClosureWrappedTest1)
      && !hasGlossaryAndQuestionBoxInTest1(earlyReturnTest1)
      && !hasGlossaryAndQuestionBoxInTest1(earlyAssertTest1)
      && !hasGlossaryAndQuestionBoxInTest1(deloadLogOnlyTest1)
      && !hasGlossaryAndQuestionBoxInTest1(missingDeloadDefTest1),
  );
  const holdsFocusBody = suite.match(/private func holdsKeyboardFocus\([\s\S]*?\n  \}/)?.[0] ?? '';
  const enterTextBody = suite.match(/private func enterText\([\s\S]*?\n  \}/)?.[0] ?? '';
  const hasIsolatedQuestionBoxEntry = (focusSrc, enterSrc, test1Src) => {
    const f = stripSwiftComments(focusSrc);
    const e = stripSwiftComments(enterSrc);
    const t = stripSwiftComments(test1Src);
    const helpersClean = !/\.textView|textViews|app\.keyboards|\.isHittable/.test(f)
      && f.includes('value(forKey: "hasKeyboardFocus")')
      && !/\.textView|textViews|target:/.test(e)
      && e.includes('let el = element(key)');
    if (!helpersClean) return false;
    if (/enterText\(\s*into:\s*"Question"/.test(t)) return false;
    const firstTap = t.indexOf('questionInput.tap()');
    const dismissAssert = t.indexOf('XCTAssertNil(try? app.keyboards.firstMatch.snapshot()');
    if (firstTap === -1 || dismissAssert === -1 || dismissAssert <= firstTap) return false;
    const preTap = t.slice(0, firstTap);
    const focusedSpan = t.slice(firstTap + 'questionInput.tap()'.length, dismissAssert);
    const postDismiss = t.slice(dismissAssert);
    const preTapOk = /let\s+questionInput\s*=\s*app\.textViews\["Question"\]\.firstMatch[\s\S]*questionInput\.waitForExistence\(\s*timeout:\s*30\s*\)[\s\S]*reveal\(\s*questionInput\s*,\s*"Question"\s*\)[\s\S]*bringClear\(\s*questionInput\s*,\s*"Question"\s*\)/.test(preTap);
    const focusedOk = focusedSpan.includes('app.typeText("what is a deload week")')
      && focusedSpan.includes('app.staticTexts[targetName].firstMatch')
      && focusedSpan.includes('(try? app.keyboards.firstMatch.snapshot())')
      && !/(?:enterText|element|reveal|bringClear)\s*\(/.test(focusedSpan)
      && !/\bquestionInput\./.test(focusedSpan);
    const postDismissOk = /let\s+askButton\s*=\s*app\.buttons\["Ask"\]\.firstMatch[\s\S]*reveal\(\s*askButton\s*,\s*"Ask"\s*\)[\s\S]*bringClear\(\s*askButton\s*,\s*"Ask"\s*\)[\s\S]*askButton\.tap\(\)/.test(postDismiss);
    return preTapOk && focusedOk && postDismissOk;
  };
  check(
    'holdsKeyboardFocus/enterText keep single-line UITextField behavior and test1 isolates Question UITextView focus/type/blur without element()/reveal()/bringClear()/questionInput.* while focused',
    hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, test1Body),
  );
  const poisonedFocus = holdsFocusBody.replace('{', '{\n    if el.elementType == .textView { return app.keyboards.firstMatch.exists && el.isHittable }');
  const enterTextQuestionTest1 = test1Body.replace('questionInput.tap()', 'enterText(into: "Question", "what is a deload week", submit: false)\n      questionInput.tap()');
  const focusedElementTest1 = test1Body.replace('app.typeText("what is a deload week")', 'app.typeText("what is a deload week")\n      _ = element("Ask")');
  const focusedRevealTest1 = test1Body.replace('blurTarget.tap()', 'reveal(blurTarget, targetName)\n        blurTarget.tap()');
  const focusedBringClearTest1 = test1Body.replace('blurTarget.tap()', 'bringClear(blurTarget, targetName)\n        blurTarget.tap()');
  const focusedQuestionQueryTest1 = test1Body.replace('app.typeText("what is a deload week")', '_ = questionInput.isHittable\n    app.typeText("what is a deload week")');
  const droppedAppTypeTextTest1 = test1Body.replace('app.typeText("what is a deload week")', '');
  const poisonedEnter = enterTextBody.replace('{', '{\n    if el.elementType == .textView { return }');
  check(
    'falsifier: textView branches in helpers, enterText on Question, or element/reveal/bringClear/questionInput.* while focused all fail closed',
    poisonedFocus !== holdsFocusBody
      && poisonedEnter !== enterTextBody
      && enterTextQuestionTest1 !== test1Body
      && focusedElementTest1 !== test1Body
      && focusedRevealTest1 !== test1Body
      && focusedBringClearTest1 !== test1Body
      && focusedQuestionQueryTest1 !== test1Body
      && droppedAppTypeTextTest1 !== test1Body
      && !hasIsolatedQuestionBoxEntry(poisonedFocus, enterTextBody, test1Body)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, poisonedEnter, test1Body)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, enterTextQuestionTest1)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, focusedElementTest1)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, focusedRevealTest1)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, focusedBringClearTest1)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, focusedQuestionQueryTest1)
      && !hasIsolatedQuestionBoxEntry(holdsFocusBody, enterTextBody, droppedAppTypeTextTest1),
  );
}

console.log('[N11] beta orientation lock (#168)');
{
  // A beta decision to revisit: landscape left too little room on every
  // screen (the rest card's countdown never fit). Tablets are not in the beta,
  // so the iPad list is kept as it was.
  const rawManifest = read('apps/mobile/android/app/src/main/AndroidManifest.xml');
  const manifest = stripXmlComments(rawManifest);
  const mainActivity = manifest.match(/<activity\s[^>]*android:name="\.MainActivity"[^>]*>/)?.[0] ?? '';
  check('Android MainActivity is locked to portrait', /android:screenOrientation="portrait"/.test(mainActivity));
  // Android 16 (API 36) ignores the lock on >= 600dp screens; the scope note
  // sits directly above the activity (XML allows no comment inside a tag).
  check('Android MainActivity carries the large-screen scope note',
    /<!-- Locks portrait on phones \(< 600dp\); Android 16 \(API 36\) ignores portrait lock on >= 600dp tablets\/unfolded foldables, which are out of scope for the beta\. -->\s*<activity\s[^>]*android:name="\.MainActivity"/.test(rawManifest));
  const orientationsIn = (keys, key) => [...String(keys.get(key) ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  const orientations = (key) => orientationsIn(plist, key);
  // iOS reads the device-qualified key over the plain one, so an iPhone
  // override decides what an iPhone actually allows.
  const iphoneOrientations = (keys) => orientationsIn(keys,
    keys.has('UISupportedInterfaceOrientations~iphone') ? 'UISupportedInterfaceOrientations~iphone' : 'UISupportedInterfaceOrientations');
  const portraitOnly = (list) => list.length === 1 && list[0] === 'UIInterfaceOrientationPortrait';
  const iphone = iphoneOrientations(plist);
  check('iPhone supports portrait only', portraitOnly(iphone), iphone.join(','));
  // Falsifiers for the two ways the check above could pass on a plist that
  // does not lock iPhone to portrait.
  const fixture = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n`;
  const portraitArray = '<array>\n<string>UIInterfaceOrientationPortrait</string>\n</array>';
  const nestedOnly = plistKeys(fixture(
    `<key>NSAppTransportSecurity</key>\n<dict>\n<key>UISupportedInterfaceOrientations</key>\n${portraitArray}\n</dict>`));
  check('falsifier: an orientation key nested in another dictionary reads as absent, so the iPhone check fails',
    !nestedOnly.has('UISupportedInterfaceOrientations') && !portraitOnly(iphoneOrientations(nestedOnly)));
  const landscapeOverride = plistKeys(fixture(
    `<key>UISupportedInterfaceOrientations</key>\n${portraitArray}\n`
    + '<key>UISupportedInterfaceOrientations~iphone</key>\n<array>\n<string>UIInterfaceOrientationPortrait</string>\n<string>UIInterfaceOrientationLandscapeLeft</string>\n</array>'));
  check('falsifier: a UISupportedInterfaceOrientations~iphone override with landscape fails the iPhone check',
    !portraitOnly(iphoneOrientations(landscapeOverride)));
  const ipad = orientations('UISupportedInterfaceOrientations~ipad');
  check('iPad keeps portrait and both landscape orientations',
    ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
      .every((o) => ipad.includes(o)), ipad.join(','));
}

console.log('[N12] Stream 2 safety reader staging, shared scheduler & native smoke');
{
  const phases = pbx.match(/buildPhases = \(([\s\S]*?)\);/)?.[1] ?? '';
  const order = [...phases.matchAll(/\/\* ([^*]+) \*\//g)].map((m) => m[1].trim());
  const iRes = order.indexOf('Resources');
  const embedder = read('apps/mobile/src/inference/deviceEmbedder.ts');
  const smoke = read('apps/mobile/src/diagnostics/nativeSmoke.ts');
  const smokeScriptSrc = read('tools/ios_simulator_smoke.sh');
  const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const smokeRequiredChecks = (scriptSrc) => {
    const m = scriptSrc.match(/\bconst\s+required\s*=\s*\[([\s\S]*?)\];/);
    if (m === null) return [];
    return [...stripJsComments(m[1]).matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  };
  // Stream 2 PR 3: safety_reader.onnx iOS bundle staging, shared ORT scheduler,
  // native simulator smoke, and CI asset-staging provenance.
  const iStageReader = order.indexOf('Stage safety reader model');
  check('the target runs "Stage safety reader model" after Resources', iStageReader > iRes && iRes !== -1, order.join(' > '));
  const readerPhase = pbx.match(/\/\* Stage safety reader model \*\/ = \{([\s\S]*?)\n\t\t\};/)?.[1] ?? '';
  check('the safety-reader phase runs scripts/stage-native-safety-reader.mjs into the app bundle as safety_reader.onnx',
    readerPhase.includes('scripts/stage-native-safety-reader.mjs')
      && readerPhase.includes('$UNLOCALIZED_RESOURCES_FOLDER_PATH/safety_reader.onnx'));
  check('Release builds require safety_reader.onnx (--required)',
    /CONFIGURATION\\?"? = \\?"Release\\?"[\s\S]*--required/.test(readerPhase));

  const deviceReaderPath = join(ROOT, 'apps/mobile/src/inference/deviceSafetyReader.ts');
  const deviceSchedPath = join(ROOT, 'apps/mobile/src/inference/deviceOrtScheduler.ts');
  const inspectIosReaderPath = join(ROOT, 'tools/inspect_ios_safety_reader.mjs');
  const deviceReader = existsSync(deviceReaderPath) ? readFileSync(deviceReaderPath, 'utf8') : '';
  const deviceSched = existsSync(deviceSchedPath) ? readFileSync(deviceSchedPath, 'utf8') : '';
  const extractReaderPrefix = (src) => stripJsComments(src).match(/READER_PIN_PREFIX\s*=\s*'([0-9a-f]+)'/)?.[1];
  const readerPrefix = extractReaderPrefix(deviceReader);
  const validReaderPrefix = (p) =>
    p !== undefined
    && p.length >= 16
    && READER_KNOWN_SHA256[SAFETY_READER_ARTIFACT].startsWith(p);
  check('deviceSafetyReader pin prefix matches the ratified safety-reader SHA-256',
    validReaderPrefix(readerPrefix),
    readerPrefix ?? 'missing');
  check('falsifier: a commented-out old READER_PIN_PREFIX cannot mask a wrong active pin prefix (WO02-SOL-08)',
    !validReaderPrefix(extractReaderPrefix(
      `// const READER_PIN_PREFIX = '${readerPrefix ?? 'a0fa76e40e10246a'}';\n`
      + deviceReader.replace(/READER_PIN_PREFIX = '[0-9a-f]+'/, "READER_PIN_PREFIX = '0000000000000000'"),
    )));
  check('iOS opens the bundled safety_reader.onnx in place (no Documents copy)',
    /Platform\.OS === 'ios'[\s\S]{0,220}MainBundleDir/.test(deviceReader));
  const hasSharedOrtScheduler = (embSrc, rdrSrc, schedSrc) => {
    const e = stripJsComments(embSrc);
    const r = stripJsComments(rdrSrc);
    const s = stripJsComments(schedSrc);
    return s.includes('createSerializedOrtScheduler()')
      && e.includes("from './deviceOrtScheduler'")
      && r.includes("from './deviceOrtScheduler'")
      && /scheduler\s*:\s*getDeviceOrtScheduler\(\)/.test(e)
      && /scheduler\s*:\s*getDeviceOrtScheduler\(\)/.test(r);
  };
  check('deviceEmbedder and deviceSafetyReader share one process-wide SerializedOrtScheduler',
    hasSharedOrtScheduler(embedder, deviceReader, deviceSched));
  check('falsifier: omitting getDeviceOrtScheduler() on either wrapper fails the shared-scheduler check',
    !hasSharedOrtScheduler(embedder.replace('getDeviceOrtScheduler()', 'undefined'), deviceReader, deviceSched)
      && !hasSharedOrtScheduler(embedder, deviceReader.replace('getDeviceOrtScheduler()', 'undefined'), deviceSched));

  const hasSafetyReaderSmoke = (smokeSrc, smokeScript) => {
    const code = stripJsComments(smokeSrc);
    const stepStart = code.indexOf("step(checks, 'safety reader inference + denial floor'");
    if (stepStart === -1) return false;
    const stepTail = code.slice(stepStart);
    const nextStep = stepTail.indexOf('\n  await step(');
    const stepBody = nextStep === -1 ? stepTail : stepTail.slice(0, nextStep);
    return stepBody.includes('tryCreateDeviceSafetyReader()')
      && stepBody.includes('resolveReportWithSafetyReader(')
      && /actionableRouteId\s*!==\s*['"]dizzy['"]/.test(stepBody)
      && smokeRequiredChecks(smokeScript).includes('safety reader inference + denial floor');
  };
  check('the native smoke verifies safety_reader.onnx + denial-floor routing and CI requires it',
    hasSafetyReaderSmoke(smoke, smokeScriptSrc));
  check('falsifier: dropping "safety reader inference + denial floor" from nativeSmoke or ios_simulator_smoke.sh fails closed',
    deviceReader.length > 0
      && !hasSafetyReaderSmoke(smoke.replace("'safety reader inference + denial floor'", "'dropped'"), smokeScriptSrc)
      && !hasSafetyReaderSmoke(smoke, smokeScriptSrc.replace('"safety reader inference + denial floor"', '')));

  const ciForReader = read('.github/workflows/ci.yml');
  const checkCiReaderPackaging = (ciYaml) => {
    const jobs = splitJobs(stripYamlComments(ciYaml));
    const androidJob = jobs.get('android-apk') ?? '';
    const iosJob = jobs.get('ios-simulator') ?? '';
    const androidHasCache = androidJob.includes("hashFiles('scripts/safety-reader-integrity.mjs')");
    const androidStages = androidJob.indexOf('npm run fetch:safety-reader') !== -1
      && androidJob.indexOf('scripts/stage-native-safety-reader.mjs') !== -1
      && androidJob.indexOf('apps/mobile/android/app/src/main/assets/safety_reader.onnx --required') !== -1
      && androidJob.indexOf('scripts/stage-native-safety-reader.mjs') < androidJob.indexOf('assembleQa');
    const iosHasCache = iosJob.includes("hashFiles('scripts/safety-reader-integrity.mjs')");
    const iosFetches = iosJob.indexOf('npm run fetch:safety-reader') !== -1
      && iosJob.indexOf('npm run fetch:safety-reader') < iosJob.indexOf('Build unsigned Release for the simulator');
    const iosInspects = iosJob.includes('node tools/inspect_ios_safety_reader.mjs');
    const noRestoreKeys = !stripYamlComments(ciYaml).includes('restore-keys:');
    return androidHasCache && androidStages && iosHasCache && iosFetches && iosInspects && noRestoreKeys;
  };
  check('CI android-apk and ios-simulator cache, materialize, stage, and inspect safety_reader.onnx fail-closed',
     existsSync(inspectIosReaderPath)
      && checkCiReaderPackaging(ciForReader)
      && READER_KNOWN_BYTES[SAFETY_READER_ARTIFACT] === 22881187);
  check('falsifier: dropping inspect_ios_safety_reader.mjs or Android safety_reader.onnx staging from ci.yml fails closed',
    !checkCiReaderPackaging(ciForReader.replace('node tools/inspect_ios_safety_reader.mjs', 'echo skip'))
      && !checkCiReaderPackaging(ciForReader.replace('apps/mobile/android/app/src/main/assets/safety_reader.onnx --required', '')));

  // Android producer-task model enforcement (build.gradle). The Gradle pin
  // helper must parse the computed-key `[SAFETY_READER_ARTIFACT]` declarations
  // that scripts/safety-reader-integrity.mjs actually uses (the literal
  // 'reader_quantized.onnx' key form matches nothing in that file), and the
  // packageQa / packageRelease / signReleaseBundle producers must verify both
  // packaged models by exact size and SHA-256; debug producers must not.
  const appGradle = read('apps/mobile/android/app/build.gradle');
  const readerIntegritySrc = read('scripts/safety-reader-integrity.mjs');
  const gradleSlashyRegex = (gradleSrc, varName) => {
    const m = gradleSrc.match(new RegExp(`def ${varName}\\s*=\\s*~/((?:\\\\/|[^/\\n])+)/`));
    return m === null ? null : m[1];
  };
  const gradleReaderPinsMatchSource = (gradleSrc) => {
    const bytesRe = gradleSlashyRegex(gradleSrc, 'READER_BYTES_PIN_RE');
    const shaRe = gradleSlashyRegex(gradleSrc, 'READER_SHA_PIN_RE');
    const artifactRe = gradleSlashyRegex(gradleSrc, 'READER_ARTIFACT_PIN_RE');
    if (bytesRe === null || shaRe === null || artifactRe === null) return false;
    if (!bytesRe.includes('\\[SAFETY_READER_ARTIFACT\\]') || !shaRe.includes('\\[SAFETY_READER_ARTIFACT\\]')) return false;
    const bytes = readerIntegritySrc.match(new RegExp(bytesRe))?.[1];
    const sha = readerIntegritySrc.match(new RegExp(shaRe))?.[1];
    const artifactOk = new RegExp(artifactRe).test(readerIntegritySrc);
    return artifactOk
      && Number(bytes) === READER_KNOWN_BYTES[SAFETY_READER_ARTIFACT]
      && sha === READER_KNOWN_SHA256[SAFETY_READER_ARTIFACT];
  };
  check('build.gradle parses [SAFETY_READER_ARTIFACT] size + SHA-256 pins that match scripts/safety-reader-integrity.mjs',
    gradleReaderPinsMatchSource(appGradle));
  check('falsifier: the literal \'reader_quantized.onnx\': key regex matches nothing in safety-reader-integrity.mjs',
    !/'reader_quantized\.onnx':\s*(\d+)/.test(readerIntegritySrc)
      && !/'reader_quantized\.onnx':\s*\n\s*'([0-9a-f]{64})'/.test(readerIntegritySrc)
      && !gradleReaderPinsMatchSource(appGradle.replace(/\\\[SAFETY_READER_ARTIFACT\\\]/g, "'reader_quantized\\.onnx'")));
  const gradleProducerModelRoots = (gradleSrc) => {
    const block = gradleSrc.match(/def onnxArtifactTasks = \[([\s\S]*?)\n\]/)?.[1] ?? '';
    const roots = new Map();
    for (const m of block.matchAll(/(\w+):\s*\["[^"]+",\s*"[^"]+",\s*(null|"([^"]*)")\s*\]/g)) {
      roots.set(m[1], m[2] === 'null' ? null : m[3]);
    }
    return roots;
  };
  const gradleEnforcesProducerModels = (gradleSrc) => {
    const roots = gradleProducerModelRoots(gradleSrc);
    const verifier = gradleSrc.match(/def verifyOnnxRuntimeArchive = \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const pinnedAssets = gradleSrc.match(/def pinnedModelAssets = \{([\s\S]*?)\n\}/)?.[1] ?? '';
    return roots.get('packageQa') === 'assets/'
      && roots.get('packageRelease') === 'assets/'
      && roots.get('signReleaseBundle') === 'base/assets/'
      && roots.has('packageDebug') && roots.get('packageDebug') === null
      && roots.has('signDebugBundle') && roots.get('signDebugBundle') === null
      && /verifyOnnxRuntimeArchive\(artifact, artifactSpec\[1\], pinnedModelAssets\(artifactSpec\[2\]\)\)/.test(gradleSrc)
      && /'minilm\.onnx'[\s\S]*pins\.minilmBytes[\s\S]*pins\.minilmSha256/.test(pinnedAssets)
      && /'safety_reader\.onnx'[\s\S]*pins\.readerBytes[\s\S]*pins\.readerSha256/.test(pinnedAssets)
      && verifier.includes("MessageDigest.getInstance('SHA-256')")
      && /size mismatch/.test(verifier)
      && /SHA-256 mismatch/.test(verifier)
      && /artifact\.delete\(\)/.test(verifier);
  };
  check('build.gradle enforces model size + SHA-256 on packageQa, packageRelease, signReleaseBundle (not debug producers)',
    gradleEnforcesProducerModels(appGradle),
    JSON.stringify([...gradleProducerModelRoots(appGradle)]));
  check('falsifier: dropping the signReleaseBundle model root or requiring models on packageDebug fails the producer check',
    !gradleEnforcesProducerModels(appGradle.replace(/(signReleaseBundle:\s*\["[^"]+",\s*"base\/lib\/",\s*)"base\/assets\/"/, '$1null'))
      && !gradleEnforcesProducerModels(appGradle.replace(/(packageDebug:\s*\["[^"]+",\s*"lib\/",\s*)null/, '$1"assets/"'))
      && !gradleEnforcesProducerModels(appGradle.replaceAll("MessageDigest.getInstance('SHA-256')", "MessageDigest.getInstance('MD5')")));

  if (existsSync(inspectIosReaderPath)) {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { inspectIosSafetyReader } = await import('./inspect_ios_safety_reader.mjs');
    const sb = mkdtempSync(join(tmpdir(), 'ak-ios-reader-inspect-'));
    try {
      const emptyApp = join(sb, 'Empty.app');
      const { mkdirSync } = await import('node:fs');
      mkdirSync(emptyApp, { recursive: true });
      const missingRes = inspectIosSafetyReader(emptyApp);
      check('inspectIosSafetyReader rejects an .app bundle missing safety_reader.onnx',
        missingRes.ok === false && missingRes.checks.some((c) => !c.ok && c.name.includes('present')));

      const shortApp = join(sb, 'Short.app');
      mkdirSync(shortApp, { recursive: true });
      writeFileSync(join(shortApp, 'safety_reader.onnx'), Buffer.from('short'));
      const shortRes = inspectIosSafetyReader(shortApp);
      check('inspectIosSafetyReader rejects truncated safety_reader.onnx',
        shortRes.ok === false && shortRes.checks.some((c) => !c.ok && c.name.includes('byte length')));

      const realReaderPath = join(ROOT, 'packages/inference/assets/safety-reader/reader_quantized.onnx');
      // Never skip silently: the positive/corrupt/symlink inspector controls
      // below need the materialized reader (npm run fetch:safety-reader).
      check('materialized reader_quantized.onnx present for inspectIosSafetyReader verification',
        existsSync(realReaderPath), realReaderPath);
      if (existsSync(realReaderPath)) {
        const goodApp = join(sb, 'Good.app');
        mkdirSync(goodApp, { recursive: true });
        const realBytes = readFileSync(realReaderPath);
        writeFileSync(join(goodApp, 'safety_reader.onnx'), realBytes);
        const outJson = join(sb, 'report.json');
        const goodRes = inspectIosSafetyReader(goodApp, outJson);
        check('inspectIosSafetyReader accepts exact ratified safety_reader.onnx and writes JSON report',
          goodRes.ok === true && existsSync(outJson));

        const corruptBytes = Buffer.from(realBytes);
        corruptBytes[128] ^= 0xff;
        const badApp = join(sb, 'Corrupt.app');
        mkdirSync(badApp, { recursive: true });
        writeFileSync(join(badApp, 'safety_reader.onnx'), corruptBytes);
        const badRes = inspectIosSafetyReader(badApp);
        check('inspectIosSafetyReader rejects 1-byte corrupted safety_reader.onnx',
          badRes.ok === false && badRes.checks.some((c) => !c.ok && c.name.includes('sha256')));

        // Symlink rejection: a symlinked safety_reader.onnx (pointing at the
        // exact ratified bytes, so only the symlink is decisive) and a
        // symlinked .app bundle must both fail closed. If the platform cannot
        // create the link, the guard is unverifiable here and this FAILS.
        const { symlinkSync } = await import('node:fs');
        const tryLink = (target, linkPath, type) => {
          try { symlinkSync(target, linkPath, type); return null; } catch (e) { return e?.code ?? String(e); }
        };
        const linkApp = join(sb, 'LinkedFile.app');
        mkdirSync(linkApp, { recursive: true });
        const fileLinkErr = tryLink(join(goodApp, 'safety_reader.onnx'), join(linkApp, 'safety_reader.onnx'), 'file');
        const linkRes = fileLinkErr === null ? inspectIosSafetyReader(linkApp) : null;
        check('inspectIosSafetyReader rejects a symlinked safety_reader.onnx (symlink rejected)',
          linkRes !== null
            && linkRes.ok === false
            && linkRes.checks.some((c) => !c.ok && c.name.includes('present') && c.detail.includes('symlink rejected')),
          fileLinkErr === null ? JSON.stringify(linkRes?.checks?.[0] ?? null).slice(0, 120) : `symlink creation unavailable: ${fileLinkErr}`);
        const linkedAppPath = join(sb, 'Linked.app');
        const dirLinkErr = tryLink(goodApp, linkedAppPath, process.platform === 'win32' ? 'junction' : 'dir');
        const linkedAppRes = dirLinkErr === null ? inspectIosSafetyReader(linkedAppPath) : null;
        check('inspectIosSafetyReader rejects a symlinked .app bundle',
          linkedAppRes !== null
            && linkedAppRes.ok === false
            && linkedAppRes.checks.some((c) => !c.ok && c.detail.includes('symlink rejected')),
          dirLinkErr === null ? JSON.stringify(linkedAppRes?.checks?.[0] ?? null).slice(0, 120) : `symlink creation unavailable: ${dirLinkErr}`);
      }
    } finally {
      rmSync(sb, { recursive: true, force: true });
    }
  }
}

console.log(`\n${fail === 0 ? 'NATIVE CONFIG VERIFIED (static contract; native build evidence comes from the macOS CI job)' : `${fail} NATIVE CONFIG CHECK(S) FAILED`}`);
process.exit(fail === 0 ? 0 : 1);
