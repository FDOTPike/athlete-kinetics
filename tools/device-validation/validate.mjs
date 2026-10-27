// Existing harness contract: tools/memory-audit/meminfo_harness.mjs:4-36.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { RATIFIED_CEILING_BYTES, PREFERRED_TARGET_BYTES } from '../memory-audit/memory_gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const harness = join(root, 'tools/memory-audit/meminfo_harness.mjs');
const pkg = 'com.pikemethods.training.qa'; // apps/mobile/android/app/build.gradle:162-166.
export function memoryBand(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'NOT MEASURED';
  if (bytes > RATIFIED_CEILING_BYTES) return 'BLOCK RELEASE';
  return bytes > PREFERRED_TARGET_BYTES ? 'REVIEW REQUIRED' : 'WITHIN PREFERRED TARGET';
}
export function selectDevice(text) {
  const rows = text.trim().split(/\r?\n/).filter(s => s.trim() && !s.startsWith('List of devices'));
  if (rows.length !== 1 || !/^\S+\s+device$/.test(rows[0].trim())) {
    throw new Error('Connect exactly one authorized USB Android device; disconnect other devices/emulators.');
  }
  return rows[0].trim().split(/\s+/)[0];
}
export function parseArgs(args) {
  const options = { dryRun: false, aapt: 'aapt', outputRoot: tmpdir() };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') { options.dryRun = true; continue; }
    const key = { '--apk': 'apk', '--aapt': 'aapt', '--output-root': 'outputRoot' }[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${args[i]}`);
    options[key] = args[++i];
  }
  if (!options.dryRun && !options.apk) throw new Error('Usage: node tools/device-validation/validate.mjs --apk <app-qa.apk> [--aapt <aapt.exe>] [--output-root <local folder>] [--dry-run]');
  return options;
}
function run(exe, args, env = process.env) {
  return execFileSync(exe, args, { env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
}
async function main(options) {
  if (options.dryRun) {
    console.log(`DRY RUN - no adb, APK access, install, prompts, or device measurements.
1. Check adb and aapt; require exactly one authorized USB device.
2. Check APK package ${pkg}; record SHA-256, badging, device and installed metadata.
3. Install with adb install -r (no clear/uninstall); launch; pause for sandbox onboarding.
4. Capture continuous epoch logcat; harness start --package ${pkg}.
5. Repeat harness watch --interval-ms 250 --duration-s 30 (proposed chunk) while human logs a full session.
6. Pause at active rest; capture before/home/return observations and UI evidence.
7. Drain watch; force-stop and relaunch; restart watch; confirm same unfinished session/rest.
8. Finish all prescribed work and session feel; record completion evidence.
9. Drain watch; open Android settings; human denies Health Connect and confirms denial.
10. Watch throughout another manual session with Health Connect denied; record function and UI.
11. Drain watch and logcat; harness finish; retain failures, raw samples and summary.
12. Timestamped results outside repository; sampled Private Dirty compared with ${RATIFIED_CEILING_BYTES} B (512 MiB).
Preferred target ${PREFERRED_TARGET_BYTES} B; review above target; block above ceiling.
Dry run supplies no physical-device or release-gate evidence.`);
    return;
  }
  const apk = resolve(options.apk);
  if (!existsSync(apk) || !apk.toLowerCase().endsWith('.apk')) throw new Error('APK file not found or extension is not .apk.');
  const outRoot = resolve(options.outputRoot);
  const rel = relative(root, outRoot);
  if (!rel || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) throw new Error('Results must be outside the repository. Choose a private, unsynced local folder.');
  run('adb', ['version']);
  const serial = selectDevice(run('adb', ['devices']));
  const env = { ...process.env, ANDROID_SERIAL: serial };
  const adb = args => run('adb', args, env);
  if (!adb(['get-devpath']).trim().startsWith('usb:')) throw new Error('Use a USB connection, not wireless adb.');
  if (adb(['shell', 'getprop', 'ro.kernel.qemu']).trim() === '1') throw new Error('Use a physical phone, not an emulator.');
  const badging = run(options.aapt, ['dump', 'badging', apk]);
  if (badging.match(/^package: name='([^']+)'/m)?.[1] !== pkg) throw new Error(`Refusing APK: expected ${pkg}.`);
  const out = join(outRoot, `device-validation-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(out, { recursive: true });
  console.log(`Results: ${out}`);
  const save = (name, data) => writeFileSync(join(out, name), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
  const report = { startedAt: new Date().toISOString(), serial, apkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'), observations: [], errors: [] };
  save('apk-badging.txt', badging);
  save('device.txt', adb(['shell', 'getprop']));
  env.AK_MEM_EVIDENCE_DIR = out;
  env.AK_LOGCAT_FILE = join(out, 'continuous-logcat.txt');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let logcat, logFd, watchPromise, stopping = true, stage = 'setup';
  async function ask(text) {
    const answer = await rl.question(`\n${text}\nType your observation (or FAIL and the reason); Enter submits: `);
    if (!answer.trim()) throw new Error('An observation is required. Rerun and record the result.');
    report.observations.push({ at: new Date().toISOString(), stage, prompt: text, answer });
    if (/\bFAIL\b/i.test(answer)) report.errors.push(`${stage}: ${answer}`);
    save('observations.json', report);
  }
  async function child(args) {
    const fd = openSync(join(out, 'harness-output.txt'), 'a');
    try {
      await new Promise((resolveChild, reject) => {
        const p = spawn(process.execPath, [harness, ...args], { env, cwd: root, windowsHide: true, stdio: ['ignore', fd, fd] });
        p.once('error', reject);
        p.once('exit', code => code === 0 ? resolveChild() : reject(new Error(`Harness ${args[0]} exited ${code}; see harness-output.txt`)));
      });
    } finally { closeSync(fd); }
  }
  function startWatch() {
    stopping = false;
    watchPromise = (async () => {
      try {
        // Proposal: 30-second chunks allow clean shutdown without killing a session.json write.
        while (!stopping) await child(['watch', '--interval-ms', '250', '--duration-s', '30', '--label', stage]);
      } catch (e) { report.errors.push(e.message); stopping = true; console.error(e.message); }
    })();
  }
  async function stopWatch() {
    stopping = true;
    if (watchPromise) { console.log('Draining sampler (up to one 30-second chunk).'); await watchPromise; watchPromise = null; }
  }
  function capture(label) {
    save(`${label}-screen.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { env, timeout: 30000, windowsHide: true }));
    save(`${label}-ui.xml`, adb(['shell', 'uiautomator', 'dump', '/dev/tty']));
    save(`${label}-pid.txt`, adb(['shell', 'pidof', pkg]));
  }
  const launch = () => adb(['shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1']);
  try {
    await ask('Use a test-only QA installation and synthetic athlete data. Install updates any existing QA data. Confirm a saved backup exists if needed; no restore or data clear will run.');
    save('install.txt', adb(['install', '-r', apk]));
    const installed = adb(['shell', 'dumpsys', 'package', pkg]);
    if (!adb(['shell', 'pm', 'path', pkg]).includes('package:')) throw new Error('QA package not installed.');
    save('installed-package.txt', installed);
    launch();
    await ask('On the phone, finish onboarding in a sandbox athlete, use Coach Mode as appropriate, prepare a guided session but do not log work yet. Record phone RAM class and app version.');
    logFd = openSync(env.AK_LOGCAT_FILE, 'w');
    logcat = spawn('adb', ['logcat', '-v', 'epoch'], { env, windowsHide: true, stdio: ['ignore', logFd, logFd] });
    logcat.once('error', e => report.errors.push(`logcat: ${e.message}`));
    await child(['start', '--package', pkg]);
    stage = 'full-session'; startWatch();
    await ask('Start the workout. Log sets with reps/load/effort until an ACTIVE REST in an unfinished session. Record athlete, exercise, logged-set count and rest state; keep the phone on this screen.');
    capture('before-background');
    adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
    await ask('Phone is backgrounded. Leave it long enough to exercise rest expiry; record elapsed time, then submit to reopen.');
    launch();
    await ask('Check return to the SAME athlete/session, sets and exercise, with the correct elapsed rest. Record each; use FAIL for loss, duplication or wrong athlete.');
    capture('after-background');
    await stopWatch();
    capture('before-cold-start');
    adb(['shell', 'am', 'force-stop', pkg]);
    save('force-stop.txt', adb(['shell', 'dumpsys', 'activity', 'processes']));
    launch();
    stage = 'cold-resume'; startWatch();
    await ask('Cold relaunch: reopen/resume the unfinished workout. Compare athlete, exercise, sets and elapsed rest with before-cold-start. Record each and any FAIL.');
    capture('after-cold-start');
    await ask('Finish the FULL prescribed session, logging every remaining set and effort. Save session feel and a synthetic note. Record completion and exact visible text. During sampling, exercise a normal body-state report so the QA lifecycle path runs; never induce symptoms or override a halt.');
    capture('session-finished');
    await stopWatch();
    stage = 'health-denial';
    adb(['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DETAILS_SETTINGS', '-d', `package:${pkg}`]);
    await ask('On the phone, open Health Connect app permissions through Settings (navigation varies). Revoke ALL read permissions for the QA app; capture/describe the denied state. Do not clear app data. If Health Connect is unavailable, type FAIL: unavailable; this does not verify denial.');
    capture('health-permission-state');
    launch(); startWatch();
    await ask('In the app, try the Health Connect connection/sync path and decline any authorization sheet. Confirm it remains denied. Complete another manual workout with reps/load/effort and session feel, without health data. Record exact denied-state wording, completed sets and any FAIL.');
    capture('health-denied-session-finished');
  } catch (e) { report.errors.push(e.message); }
  finally {
    await stopWatch();
    if (logcat?.pid && logcat.exitCode === null) {
      await new Promise(resolveExit => { logcat.once('exit', resolveExit); logcat.kill(); });
    } else if (logcat) report.errors.push('Continuous logcat exited before collection ended.');
    if (logFd !== undefined) closeSync(logFd);
    if (existsSync(join(out, 'session.json'))) {
      try { await child(['finish']); } catch (e) { report.errors.push(e.message); }
    } else report.errors.push('No harness session captured.');
    rl.close();
    const packet = existsSync(join(out, 'session.json')) ? JSON.parse(readFileSync(join(out, 'session.json'), 'utf8')) : {};
    const values = (packet.samples ?? []).map(s => s.privateDirtyBytes).filter(Number.isFinite);
    const maximum = values.length ? Math.max(...values) : null;
    report.finishedAt = new Date().toISOString();
    report.maxSampledPrivateDirtyBytes = maximum;
    report.memoryBand = memoryBand(maximum);
    report.harnessSummaryAvailable = Boolean(packet.summary);
    if (!packet.summary) report.errors.push('No correlated harness summary; evidence incomplete.');
    if (packet.summary?.lifecycle?.disposalIntegrity?.clean === false) report.errors.push('Disposal failure observed.');
    report.status = report.errors.length || maximum === null ? 'NOT VERIFIED' : 'EVIDENCE CAPTURED - OWNER REVIEW REQUIRED';
    save('results.json', report);
    const summary = `${report.status}\nMaximum sampled Private Dirty: ${maximum ?? 'NOT MEASURED'} B\n${report.memoryBand}; ceiling ${RATIFIED_CEILING_BYTES} B (512 MiB), preferred ${PREFERRED_TARGET_BYTES} B.\nSampling is not proof of the transient peak. This packet is not a sealed release-gate packet.\n${report.errors.join('\n')}\n`;
    save('SUMMARY.txt', summary); console.log(summary);
    if (report.errors.length || maximum === null || maximum > RATIFIED_CEILING_BYTES) process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(parseArgs(process.argv.slice(2))); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
