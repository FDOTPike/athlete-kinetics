# Health Connect permissions ? draft

Checked the release branch and `origin/master`: both declare and read the same three types. These are optional read permissions; the app works without health access. No oxygen saturation permission is declared and no oxygen saturation record is read by the Health Connect adapter. Historical database tables alone do not establish a Health Connect read.

| Manifest permission | Record actually read | Evidence |
| --- | --- | --- |
| `android.permission.health.READ_SLEEP` | `SleepSession` | `apps/mobile/android/app/src/main/AndroidManifest.xml:17`; `packages/biometrics/src/healthConnect.ts:127` |
| `android.permission.health.READ_HEART_RATE_VARIABILITY` | `HeartRateVariabilityRmssd` | `apps/mobile/android/app/src/main/AndroidManifest.xml:15`; `packages/biometrics/src/healthConnect.ts:125` |
| `android.permission.health.READ_RESTING_HEART_RATE` | `RestingHeartRate` | `apps/mobile/android/app/src/main/AndroidManifest.xml:16`; `packages/biometrics/src/healthConnect.ts:126` |

**Sleep:** The readiness feature uses daily sleep summaries to inform training readiness. Reading sleep sessions lets the app calculate those summaries when the athlete chooses to connect Health Connect; the app continues without them. `apps/mobile/src/state/biometricsCopy.ts:63`

**Heart rate variability:** The readiness feature uses overnight RMSSD summaries to inform training readiness. Reading these records supplies that optional signal when the athlete connects Health Connect; the app continues without it. `apps/mobile/src/state/biometricsCopy.ts:63`

**Resting heart rate:** The measured-days history retains the athlete's daily resting heart rate alongside other recorded measurements. The read supplies that optional history; it does not feed readiness. `apps/mobile/src/state/biometricsCopy.ts:13`; `apps/mobile/src/state/useStore.ts:5700`

**Mismatch check:** No declared-but-unused or used-but-undeclared permission found in these adapters and source manifests. Resting heart rate is actually read and stored, but its necessity for Google's minimum-scope approval is a review risk: the code does not establish that it is essential to a user-facing feature. Confirm the feature and Play approval or remove the permission in a separate engineering change. Inspect the final merged manifest as well. `apps/mobile/src/state/useStore.ts:5548`
