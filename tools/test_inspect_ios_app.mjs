/**
 * test_inspect_ios_app.mjs — unit, repro, poisoning, and CLI subprocess suite
 * for tools/inspect_ios_app.mjs (specifically the fail-closed op-sqlite
 * -DSQLITE_ENABLE_MATH_FUNCTIONS=1 compile-evidence verifier).
 *
 * Run: node tools/test_inspect_ios_app.mjs
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KNOWN_SHA256 } from '../scripts/embedder-integrity.mjs';

const INSPECTOR = fileURLToPath(new URL('./inspect_ios_app.mjs', import.meta.url));
const REPO_ROOT = dirname(dirname(INSPECTOR));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

function makePaddingFlags(minChars = 15600) {
  const parts = ["'-std=gnu11'", '-fmodules'];
  let idx = 0;
  while (parts.join(' ').length < minChars) {
    parts.push(`-I/Users/example/Documents/AthleteX/athlete-kinetics/apps/mobile/ios/Pods/Headers/Public/PodHeader_${idx}`);
    idx += 1;
  }
  return parts.join(' ');
}

function runInspectorCli(cliPath, args) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8',
      timeout: 60000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: e.status ?? -1,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
    };
  }
}

/**
 * Create a minimal valid synthetic AthleteKinetics.app bundle in `dir` that
 * satisfies checks 1..12 of inspect_ios_app.mjs so the CLI exit code is
 * determined solely by check 13 (op-sqlite SQLITE_ENABLE_MATH_FUNCTIONS) when
 * macOS `plutil` and the staged model are present.
 */
function createSyntheticAppBundle(dir) {
  const appDir = join(dir, 'AthleteKinetics.app');
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, 'AthleteKinetics'), Buffer.alloc(150_000, 0x7f));
  writeFileSync(join(appDir, 'main.jsbundle'), Buffer.alloc(1_100_000, 0x61));
  const realModel = join(REPO_ROOT, 'packages/inference/assets/minilm/model_quantized.onnx');
  copyFileSync(realModel, join(appDir, 'minilm.onnx'));
  const realFont = join(REPO_ROOT, 'apps/mobile/assets/fonts/Archivo/Archivo-VariableFont_wdth,wght.ttf');
  copyFileSync(realFont, join(appDir, 'Archivo-VariableFont_wdth,wght.ttf'));
  writeFileSync(join(appDir, 'PrivacyInfo.xcprivacy'), '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict/></plist>\n');
  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>AthleteKinetics</string>
  <key>CFBundleIdentifier</key>
  <string>com.pikemethods.training</string>
  <key>CFBundleDisplayName</key>
  <string>pikeMethods</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>MinimumOSVersion</key>
  <string>15.1</string>
  <key>DTSDKName</key>
  <string>iphonesimulator27.2</string>
  <key>DTXcode</key>
  <string>2720</string>
  <key>UIAppFonts</key>
  <array>
    <string>Archivo-VariableFont_wdth,wght.ttf</string>
  </array>
  <key>NSHealthShareUsageDescription</key>
  <string>pikeMethods reads sleep and resting heart rate from Apple Health to tailor your session readiness.</string>
</dict>
</plist>
`;
  writeFileSync(join(appDir, 'Info.plist'), infoPlist);
  return appDir;
}

async function loadHelper() {
  try {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const m = await import(${JSON.stringify(pathToFileURL(INSPECTOR).href)}); if (typeof m.hasOpSqliteMathFunctions !== 'function') process.exit(3);`],
      { stdio: 'ignore', timeout: 10000 },
    );
    const mod = await import(pathToFileURL(INSPECTOR).href);
    return typeof mod.hasOpSqliteMathFunctions === 'function' ? mod.hasOpSqliteMathFunctions : null;
  } catch {
    return null;
  }
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'inspect-ios-app-test-'));
  try {
    const hasOpSqliteMathFunctions = await loadHelper();
    check(
      'inspect_ios_app.mjs is importable without exiting and exports hasOpSqliteMathFunctions',
      typeof hasOpSqliteMathFunctions === 'function',
      typeof hasOpSqliteMathFunctions,
    );

    const callHelper = (logText) => (typeof hasOpSqliteMathFunctions === 'function' ? hasOpSqliteMathFunctions(logText) : null);

    // =========================================================================
    console.log('\n[1] Repro cases (valid Xcode 26 / 27 op-sqlite compile evidence)');

    // Repro 1: Using response file on disk (no inline WriteAuxiliaryFile content).
    const respDir = join(
      scratch,
      'build/Build/Intermediates.noindex/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64',
    );
    mkdirSync(respDir, { recursive: true });
    const sqliteRespPath = join(respDir, '7187679823f38a2a940e0043cdf9d637-common-args.resp');
    const cppRespPath = join(respDir, '82b82416624d2658e5098eb0a28c15c5-common-args.resp');
    const longFlagsWithMath = `${makePaddingFlags(15550)} '-DSQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION=1' '-DHAVE_USLEEP=1' '-DSQLITE_ENABLE_LOCKING_STYLE=0' '-DSQLITE_ENABLE_MATH_FUNCTIONS=1' -DNDEBUG`;
    writeFileSync(sqliteRespPath, longFlagsWithMath);
    writeFileSync(cppRespPath, `${longFlagsWithMath} -DNDEBUG`);

    const repro1Log = [
      `CompileC ${join(respDir, 'bridge.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp normal arm64 c++ com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      '    ',
      `    Using response file: ${cppRespPath}`,
      '    ',
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c++ -target arm64-apple-ios15.1-simulator @${cppRespPath} -DRCT_NEW_ARCH_ENABLED\\=1 -c /repo/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp -o ${join(respDir, 'bridge.o')}`,
      '',
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      '    ',
      `    Using response file: ${sqliteRespPath}`,
      '    ',
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c -target arm64-apple-ios15.1-simulator @${sqliteRespPath} -DRCT_NEW_ARCH_ENABLED\\=1 -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Repro 1: Using response file on disk (no inline WriteAuxiliaryFile content) is accepted',
      callHelper(repro1Log) === true,
      `len(resp)=${longFlagsWithMath.length}`,
    );

    // Repro 1b: @.../op-sqlite.build/...-common-args.resp on the clang line without "Using response file:" line.
    const repro1bLog = [
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c -target arm64-apple-ios15.1-simulator @${sqliteRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Repro 1b: @.../op-sqlite.build/...-common-args.resp on clang command line is accepted from disk',
      callHelper(repro1bLog) === true,
    );

    // Repro 2: Single-arch WriteAuxiliaryFile for op-sqlite.build/...-common-args.resp > 15,500 chars long
    // (where the path does NOT exist on disk, proving the inline WriteAuxiliaryFile line itself is parsed without a 4,000-char limit).
    const nonDiskRespPath = '/ci/runner/work/athlete-kinetics/apps/mobile/ios/build/Build/Intermediates.noindex/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64/7187679823f38a2a940e0043cdf9d637-common-args.resp';
    const repro2Log = [
      `WriteAuxiliaryFile ${nonDiskRespPath} (in target 'op-sqlite' from project 'Pods')`,
      '    cd /ci/runner/work/athlete-kinetics/apps/mobile/ios/Pods',
      `    write-file ${nonDiskRespPath}`,
      longFlagsWithMath,
      '',
      "WriteAuxiliaryFile /ci/runner/work/athlete-kinetics/apps/mobile/ios/build/Build/Intermediates.noindex/Pods.build/Release-iphonesimulator/onnxruntime-react-native.build/onnxruntime-react-native.hmap (in target 'onnxruntime-react-native' from project 'Pods')",
      '',
    ].join('\n');
    check(
      'Repro 2: single-arch WriteAuxiliaryFile for op-sqlite.build/...-common-args.resp > 15,500 chars long is accepted',
      longFlagsWithMath.length > 15500 && callHelper(repro2Log) === true,
      `contentLen=${longFlagsWithMath.length}`,
    );

    // Repro 3: Direct inline CompileC invocation for op-sqlite carrying -DSQLITE_ENABLE_MATH_FUNCTIONS=1 on clang line.
    const repro3Log = [
      "CompileC /build/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64/sqlite3.o /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')",
      '    cd /repo/apps/mobile/ios/Pods',
      '    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c -target arm64-apple-ios15.1-simulator -DSQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION=1 -DSQLITE_ENABLE_MATH_FUNCTIONS=1 -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o /build/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64/sqlite3.o',
      '',
    ].join('\n');
    check(
      'Repro 3: inline CompileC for op-sqlite with standalone -DSQLITE_ENABLE_MATH_FUNCTIONS=1 on clang command line is accepted',
      callHelper(repro3Log) === true,
    );

    // =========================================================================
    console.log('\n[2] Poisoning cases (must all fail closed)');

    // Poisoning 1: Another pod (other-pod.build/...-common-args.resp) has -DSQLITE_ENABLE_MATH_FUNCTIONS=1,
    // while op-sqlite.build/...-common-args.resp omits it (even when within 4,000 chars of op-sqlite).
    const otherPodRespDir = join(
      scratch,
      'build/Build/Intermediates.noindex/Pods.build/Release-iphonesimulator/other-pod.build/Objects-normal/arm64',
    );
    mkdirSync(otherPodRespDir, { recursive: true });
    const otherPodRespPath = join(otherPodRespDir, '11111111111111111111111111111111-common-args.resp');
    const opSqliteNoMathRespPath = join(respDir, 'no-math-common-args.resp');
    const flagsWithoutMath = `${makePaddingFlags(15550)} '-DSQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION=1' '-DHAVE_USLEEP=1' -DNDEBUG`;
    writeFileSync(otherPodRespPath, longFlagsWithMath);
    writeFileSync(opSqliteNoMathRespPath, flagsWithoutMath);

    const poisoning1Log = [
      `WriteAuxiliaryFile ${otherPodRespPath} (in target 'other-pod' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    write-file ${otherPodRespPath}`,
      "'-std=gnu11' '-DSQLITE_ENABLE_MATH_FUNCTIONS=1' -DNDEBUG",
      '',
      `WriteAuxiliaryFile ${opSqliteNoMathRespPath} (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    write-file ${opSqliteNoMathRespPath}`,
      flagsWithoutMath,
      '',
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    Using response file: ${opSqliteNoMathRespPath}`,
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c @${opSqliteNoMathRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Poisoning 1: other-pod.build carries -DSQLITE_ENABLE_MATH_FUNCTIONS=1 while op-sqlite.build omits it -> rejected',
      callHelper(poisoning1Log) === false,
    );

    // Poisoning 2a: op-sqlite .resp has -DSQLITE_ENABLE_MATH_FUNCTIONS=0
    const opSqliteZeroMathRespPath = join(respDir, 'zero-math-common-args.resp');
    const flagsWithZeroMath = `${ flagsWithoutMath } '-DSQLITE_ENABLE_MATH_FUNCTIONS=0'`;
    writeFileSync(opSqliteZeroMathRespPath, flagsWithZeroMath);
    const poisoning2aLog = [
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    Using response file: ${opSqliteZeroMathRespPath}`,
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c @${opSqliteZeroMathRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Poisoning 2a: op-sqlite .resp has -DSQLITE_ENABLE_MATH_FUNCTIONS=0 -> rejected',
      callHelper(poisoning2aLog) === false,
    );

    // Poisoning 2b: bridge.cpp .resp has -DSQLITE_ENABLE_MATH_FUNCTIONS=1, but sqlite3.c .resp omits it!
    const poisoning2bLog = [
      `CompileC ${join(respDir, 'bridge.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp normal arm64 c++ com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    Using response file: ${cppRespPath}`,
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c++ @${cppRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp -o ${join(respDir, 'bridge.o')}`,
      '',
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    Using response file: ${opSqliteNoMathRespPath}`,
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c @${opSqliteNoMathRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Poisoning 2b: bridge.cpp .resp has the flag but sqlite3.c .resp omits it -> rejected',
      callHelper(poisoning2bLog) === false,
    );

    // Poisoning 2c: substring token -DSQLITE_ENABLE_MATH_FUNCTIONS=10 (not =1 standalone flag)
    const poisoning2cLog = [
      "CompileC /build/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64/sqlite3.o /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')",
      '    cd /repo/apps/mobile/ios/Pods',
      '    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c -DSQLITE_ENABLE_MATH_FUNCTIONS=10 -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o /build/Pods.build/Release-iphonesimulator/op-sqlite.build/Objects-normal/arm64/sqlite3.o',
      '',
    ].join('\n');
    check(
      'Poisoning 2c: non-standalone flag -DSQLITE_ENABLE_MATH_FUNCTIONS=10 -> rejected',
      callHelper(poisoning2cLog) === false,
    );

    // Poisoning 3: Referenced op-sqlite .resp file does not exist on disk and has no logged WriteAuxiliaryFile content.
    const missingDiskRespPath = join(respDir, 'missing-from-disk-common-args.resp');
    const poisoning3Log = [
      `CompileC ${join(respDir, 'sqlite3.o')} /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c normal arm64 c com.apple.compilers.llvm.clang.1_0.compiler (in target 'op-sqlite' from project 'Pods')`,
      '    cd /repo/apps/mobile/ios/Pods',
      `    Using response file: ${missingDiskRespPath}`,
      `    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang -x c @${missingDiskRespPath} -c /repo/node_modules/@op-engineering/op-sqlite/cpp/sqlite3.c -o ${join(respDir, 'sqlite3.o')}`,
      '',
    ].join('\n');
    check(
      'Poisoning 3: referenced op-sqlite .resp file missing on disk and no WriteAuxiliaryFile content -> rejected',
      callHelper(poisoning3Log) === false,
    );

    // Poisoning 4: Only "[OP-SQLITE] Detected custom SQLite flags: -DSQLITE_ENABLE_MATH_FUNCTIONS=1" (pod install notice, no compile/resp evidence).
    const poisoning4Log = [
      'Analyzing dependencies',
      '[OP-SQLITE] Configuration found at /repo/package.json',
      '[OP-SQLITE] using pure SQLite',
      '[OP-SQLITE] Detected custom SQLite flags: -DSQLITE_ENABLE_MATH_FUNCTIONS=1',
      'Generating Pods project',
      '[Codegen] Found @op-engineering/op-sqlite',
      '',
    ].join('\n');
    check(
      'Poisoning 4: pod install notice [OP-SQLITE] Detected custom SQLite flags without CompileC/WriteAuxiliaryFile -> rejected',
      callHelper(poisoning4Log) === false,
    );

    // =========================================================================
    console.log('\n[3] CLI subprocess verification (including path with spaces)');

    let hasPlutil = false;
    try {
      execFileSync('plutil', ['-help'], { stdio: 'ignore' });
      hasPlutil = true;
    } catch {
      hasPlutil = false;
    }
    const realModelPath = join(REPO_ROOT, 'packages/inference/assets/minilm/model_quantized.onnx');
    let hasModel = false;
    try {
      hasModel = readFileSync(realModelPath).length > 1_000_000 && Boolean(KNOWN_SHA256['onnx/model_quantized.onnx']);
    } catch {
      hasModel = false;
    }

    if (hasPlutil && hasModel) {
      const spacedDir = join(scratch, 'dir with spaces', 'inspector cli');
      mkdirSync(spacedDir, { recursive: true });
      const appDir = createSyntheticAppBundle(spacedDir);
      const repro1LogFile = join(spacedDir, 'repro1-xcodebuild.log');
      const repro2LogFile = join(spacedDir, 'repro2-xcodebuild.log');
      const poisoning1LogFile = join(spacedDir, 'poisoning1-xcodebuild.log');
      const poisoning4LogFile = join(spacedDir, 'poisoning4-xcodebuild.log');
      const outRepro1Json = join(spacedDir, 'out-repro1.json');
      const outRepro2Json = join(spacedDir, 'out-repro2.json');
      const outFail1Json = join(spacedDir, 'out-fail1.json');
      const outFail4Json = join(spacedDir, 'out-fail4.json');
      writeFileSync(repro1LogFile, repro1Log);
      writeFileSync(repro2LogFile, repro2Log);
      writeFileSync(poisoning1LogFile, poisoning1Log);
      writeFileSync(poisoning4LogFile, poisoning4Log);

      const okRun1 = runInspectorCli(INSPECTOR, [appDir, repro1LogFile, outRepro1Json]);
      const okReport1 = (() => { try { return JSON.parse(readFileSync(outRepro1Json, 'utf8')); } catch { return null; } })();
      check(
        'CLI subprocess accepts Repro 1 (Using response file on disk) and writes ok:true report',
        okRun1.code === 0 && okReport1?.ok === true && okRun1.stdout.includes('iOS ARTIFACT INSPECTED'),
        `exit=${okRun1.code}`,
      );

      const okRun2 = runInspectorCli(INSPECTOR, [appDir, repro2LogFile, outRepro2Json]);
      const okReport2 = (() => { try { return JSON.parse(readFileSync(outRepro2Json, 'utf8')); } catch { return null; } })();
      check(
        'CLI subprocess accepts Repro 2 (single-arch WriteAuxiliaryFile > 15,500 chars) and writes ok:true report',
        okRun2.code === 0 && okReport2?.ok === true && okRun2.stdout.includes('iOS ARTIFACT INSPECTED'),
        `exit=${okRun2.code}`,
      );

      const badRun1 = runInspectorCli(INSPECTOR, [appDir, poisoning1LogFile, outFail1Json]);
      const badReport1 = (() => { try { return JSON.parse(readFileSync(outFail1Json, 'utf8')); } catch { return null; } })();
      const mathCheck1 = badReport1?.checks?.find((c) => c.name === 'op-sqlite compiled with SQLITE_ENABLE_MATH_FUNCTIONS');
      check(
        'CLI subprocess rejects Poisoning 1 (other-pod has flag, op-sqlite omits it) with exit=1',
        badRun1.code === 1 && badReport1?.ok === false && mathCheck1?.ok === false,
        `exit=${badRun1.code} mathCheck=${JSON.stringify(mathCheck1)}`,
      );

      const badRun4 = runInspectorCli(INSPECTOR, [appDir, poisoning4LogFile, outFail4Json]);
      const badReport4 = (() => { try { return JSON.parse(readFileSync(outFail4Json, 'utf8')); } catch { return null; } })();
      const mathCheck4 = badReport4?.checks?.find((c) => c.name === 'op-sqlite compiled with SQLITE_ENABLE_MATH_FUNCTIONS');
      check(
        'CLI subprocess rejects Poisoning 4 (pod install notice only, no compile/resp evidence) with exit=1',
        badRun4.code === 1 && badReport4?.ok === false && mathCheck4?.ok === false,
        `exit=${badRun4.code} mathCheck=${JSON.stringify(mathCheck4)}`,
      );
    } else {
      console.log(`  NOTE  skipping macOS plutil/model CLI subprocess check (hasPlutil=${hasPlutil} hasModel=${hasModel})`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`\n${fail === 0 ? 'INSPECT_IOS_APP TESTS VERIFIED' : `${fail} INSPECT_IOS_APP TEST(S) FAILED`}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
