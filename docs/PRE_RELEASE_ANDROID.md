# Android pre-release build runbook

This runbook creates Play-ready Android artifacts without placing upload-key
material in the repository. Debug CI artifacts are for sideload QA only.

## 1. One-time setup on the trusted home PC

Install Node.js, Java 17, Android Studio/SDK, and the repository dependencies.
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
npm.cmd run verify:all
npm.cmd run fetch:embedder
New-Item -ItemType Directory -Force apps\mobile\android\app\src\main\assets | Out-Null
Copy-Item packages\inference\assets\minilm\model_quantized.onnx apps\mobile\android\app\src\main\assets\minilm.onnx
```

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
