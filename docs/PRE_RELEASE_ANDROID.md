# Android pre-release build runbook

This runbook creates Play-ready Android artifacts without placing upload-key
material in the repository. Debug CI artifacts are for sideload QA only.

## 1. One-time setup on the trusted home PC

Install Node.js, Java 17, Android Studio/SDK, CMake 3.30.5, NDK
28.2.13676358, and the repository dependencies. The Gradle build pins this
CMake/NDK pair for both the app and autolinked native-library modules.
Generate the Play upload key on that PC and back it up offline:

```powershell
keytool -genkeypair -v -keystore D:\secure\athlete-kinetics-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Do not put the key, passwords, or a credentials file inside the repository or
Google Drive. Google Drive may carry replaceable video assets later; it must not
be the only backup or transport for the signing key.

Set secrets for the current PowerShell session (or use the home PC's secret
manager/CI secret store):

```powershell
$env:AK_UPLOAD_STORE_FILE='D:\secure\athlete-kinetics-upload.jks'
$env:AK_UPLOAD_STORE_PASSWORD='<store password>'
$env:AK_UPLOAD_KEY_ALIAS='upload'
$env:AK_UPLOAD_KEY_PASSWORD='<key password>'
$env:AK_VERSION_CODE='1'
$env:AK_VERSION_NAME='1.0.0-beta.1'
```

Release Gradle tasks fail closed when any required signing value is absent.

## 2. Verify and stage the embedded model

From the repository root:

```powershell
npm.cmd ci
npm.cmd run fetch:embedder
npm.cmd run verify:ci
New-Item -ItemType Directory -Force apps\mobile\android\app\src\main\assets | Out-Null
Copy-Item packages\inference\assets\minilm\model_quantized.onnx apps\mobile\android\app\src\main\assets\minilm.onnx
```

The embedder supply chain is pinned to an immutable Hugging Face revision — no
mutable `main`:

- Model: `Xenova/all-MiniLM-L6-v2`
- Revision: `751bff37182d3f1213fa05d7196b954e230abad9`
  (https://huggingface.co/Xenova/all-MiniLM-L6-v2/commit/751bff37182d3f1213fa05d7196b954e230abad9)
- `config.json` sha256 `7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7`
- `onnx/model_quantized.onnx` sha256 `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
- `tokenizer.json` sha256 `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`
- `tokenizer_config.json` sha256 `9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3`
- distilled `tokenizer.min.json` sha256 `ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6`

`fetch:embedder` is the only network-enabled model materializer. Run it before
`verify:ci`: it stages all four remote artifacts, verifies their pinned byte
hashes, and populates the exact revision-scoped Transformers cache plus the
device output directory. All verification and codebase-embedding consumers use
that cache with the immutable revision and `local_files_only=true`; a missing
cache therefore fails locally without a network fallback. Existing output and
legacy-cache candidates are never accepted unseen. `tokenizer.min.json` is
also staged and hash-checked before replacement, so any mismatch preserves the
previous trusted file. The single source of truth is
`scripts/embedder-integrity.mjs`; `npm run verify:embedder` includes the
deterministic offline integrity gate.

## 3. Verification and build sequence (one unambiguous clean checkout path)

```powershell
npm.cmd ci                      # npm >= 11.6; enforces the install-script policy
npm.cmd run fetch:embedder
npm.cmd run verify:ci           # MERGE gate: must exit 0
npm.cmd run verify:release      # RELEASE gate: adds [A], [D] and the real QA APK
```

`npm ci` enforces a pinned install-script policy. `package.json` carries an
`allowScripts` map naming the exact `name@version` of every dependency allowed
to run a lifecycle script at install time, and `.npmrc` sets
`strict-allow-scripts=true`, so a dependency that GAINS an install script — or
whose approved version drifts — fails `npm ci` with `ESTRICTALLOWSCRIPTS`
instead of executing unreviewed code. `engine-strict=true` plus the `engines`
floor stops an npm older than 11.6 (which ignores the policy entirely) from
producing a silent false green. Approve a genuinely required new script with
`npm install-scripts approve`; never with `--dangerously-allow-all-scripts`.

`verify:ci` is the MERGE gate and is required to be green. `verify:release`
adds the checks that cannot be made honestly on a CI runner: the ratified
memory contract `[A]`, measured physical device evidence `[D]`, and evidence
provenance `[G]`. Point it at the evidence packet:

```powershell
$env:AK_MEM_EVIDENCE_SESSION = "C:\evidence-root\run-r4-A\session.json"
```

That is the only variable you need. `[G]` locates the sealed manifest itself by
looking beside the packet (`EVIDENCE_MANIFEST.json` at the evidence root);
`AK_MEM_EVIDENCE_MANIFEST` exists only to override that when the manifest lives
somewhere else.

`[G]` re-derives every scalar the gate relies on (correlated request count,
disposal integrity, sampled maximum, cadence) from the packet's OWN raw bytes —
the raw `logcat-epoch.txt` and `sample-NNN-*.txt` dumps — and rejects any packet
whose claims are not reproducible from them. It ALSO requires, mandatorily, that
the packet and its raw inputs be members of the two-layer-sealed evidence
manifest, and that the manifest match its detached `.sha256`. A packet that is
internally perfect but UNSEALED fails: internal consistency proves arithmetic,
not provenance, and a consistent corpus can simply be authored.

Two findings are burned into this design. Without `[G]`, a hand-written
`session.json` satisfied `[D]` and — because the review band makes `[A]` depend
on `[D]` — turned the whole memory gate green with no device data (Hermes r3,
B-1). Then, with `[G]` present but its seal check OPT-IN behind an environment
variable that nothing set, a fabricated corpus reached the same review band
through this very command (Hermes r4, R4-1). An opt-in control that the shipping
path never opts into is not a control, which is why the seal check is now
mandatory and self-locating.

`verify:all` is an alias for `verify:release`.

`verify:ci` begins with a deterministic prerequisites preflight
(`scripts/verify-preflight.mjs`) that fails within seconds — with the exact
remediation command — when the checkout is not prepared: missing
`node_modules`, a broken native `sharp` binding, absent or hash-mismatched
pinned revision-cache artifacts, missing device outputs, or a distilled
tokenizer off its pin. It never downloads; `fetch:embedder` remains the only
network-capable materializer. An unprepared checkout is an operator error, not
a candidate failure.

The copied ONNX file and all Android build output are ignored and must not be
staged.

## 3. Build and verify artifacts

```powershell
Push-Location apps\mobile\android
.\gradlew.bat :app:verifyOnnxRuntimePackagingContract bundleRelease assembleRelease --no-daemon
Pop-Location
jarsigner -verify -verbose -certs apps\mobile\android\app\build\outputs\bundle\release\app-release.aab
Get-FileHash apps\mobile\android\app\build\outputs\bundle\release\app-release.aab -Algorithm SHA256
```

The APK and AAB producer tasks verify that every packaged
`libonnxruntimejsi.so` has a same-ABI `libonnxruntime.so`. A failed check removes
the rejected artifact before failing the build. This protection also runs for
`installDebug` / `react-native run-android`, because those paths depend on
`packageDebug` rather than the `assembleDebug` lifecycle task.

Expected outputs:

- Play upload: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
- Device QA: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

Install the APK on a connected test device with `adb install -r` and record the
AAB SHA-256 alongside the version code/name used for the build.

## 4. Required device acceptance pass

- Confirm Archivo renders on onboarding, READY, BLOCK, SESSION, LIBRARY, and ATHLETE.
- Complete onboarding and create a guided program from a fresh install.
- Complete guided and self-directed sessions, including all four load sources.
- Background and cold-resume an unfinished session, including an active rest timer.
- Exercise Health Connect connected, denied, and unavailable paths.
- Confirm the app remains functional without Health Connect data.
- Exercise beginner and advanced profiles without tier or database-state bleed.
- Test OS text scaling and screen-reader labels on primary actions.
- Measure dirty RAM on a 4 GB target device and retain evidence that it stays below 450 MB.
- Verify arm64-v8a native libraries meet the repository's 16 KB ELF-alignment gate.

## 5. Decisions required before the first store candidate

- Confirm public app name (`AthleteKinetics` Android label versus `pikeMethods` in-app brand).
- Confirm the permanent Play application ID (`com.athletekinetics`).
- Supply final icon, launch screen, support URL, privacy-policy URL, and store copy.
- Complete Play Data Safety and Health Apps/Health Connect declarations.
- Have the training/medical disclaimer and privacy wording professionally reviewed.
