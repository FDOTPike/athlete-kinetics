# Technical Analysis & Design: iOS Biometrics Gap & Apple Health Strategy

**Author:** Antigravity / Gemini  
**Date:** July 28, 2026  
**Status:** COMPLETE (Analysis & Design Investigation)

---

## 1. Live Readiness Inputs: Android vs. iOS

### Ground Truth Readiness Formula (`004_state_vector_materialize.sql:57-69`)
The readiness score in Athlete Kinetics is calculated as a **renormalized weighted mean of available inputs only**:

$$\text{readiness\_score} = \frac{w_{\text{hrv}} \cdot \text{hrv\_component} + w_{\text{load}} \cdot \text{load\_component} + w_{\text{sleep}} \cdot \text{sleep\_component}}{w_{\text{hrv}} + w_{\text{load}} + w_{\text{sleep}}}$$

Where:
- $w_{\text{hrv}} = 0.35$ if `hrv_z` is non-null, else $0$
- $w_{\text{load}} = 0.30$ if `acwr` is non-null, else $0$
- $w_{\text{sleep}} = 0.25$ if `sleep_efficiency_pct` is non-null, else $0$
- If all inputs are absent (denominator $= 0$), $\text{readiness\_score} = 50.0$ (neutral baseline).
- **SpO2 Exception:** `spo2_component` is computed and materialized (`004_state_vector_materialize.sql:45,51`), but **is NOT a term in `readiness_score`**.

---

### Platform Comparison & Arithmetic

#### Android Behavior
- Native bridge (`packages/biometrics/src/healthConnect.ts`) queries Android Health Connect for `HeartRateVariabilityRmssd`, `RestingHeartRate`, and `SleepSession`.
- Ingested metrics populate `hrv_daily` and `sleep_daily`.
- Workload logging populates `set_record` $\rightarrow$ `mech_daily` $\rightarrow$ `acwr`.
- **Resulting Formula (all 3 telemetry inputs present):**
  $$\text{readiness\_score} = \frac{0.35 \cdot \text{hrv\_component} + 0.30 \cdot \text{load\_component} + 0.25 \cdot \text{sleep\_component}}{0.35 + 0.30 + 0.25} = \frac{0.35 \cdot \text{hrv} + 0.30 \cdot \text{load} + 0.25 \cdot \text{sleep}}{0.90}$$

#### iOS Behavior
- Native bridge (`packages/biometrics/src/healthConnect.ts:77`) explicitly returns `null` for `Platform.OS !== 'android'`.
- No HealthKit bridge exists; no HealthKit permissions or `Info.plist` usage strings are configured.
- `hrv_z` and `sleep_efficiency_pct` are **always NULL** on iOS devices.
- **Resulting Formula (iOS with logged workload history):**
  Since $w_{\text{hrv}} = 0$ and $w_{\text{sleep}} = 0$, the formula collapses to:
  $$\text{readiness\_score} = \frac{0.30 \cdot \text{load\_component}}{0.30} = \text{load\_component}$$
- **Resulting Formula (iOS on fresh install / no ACWR yet):**
  Since $w_{\text{hrv}} = 0$, $w_{\text{sleep}} = 0$, and $w_{\text{load}} = 0$:
  $$\text{readiness\_score} = 50.0$$

---

## 2. Options Analysis

### Option A: Add Native Apple HealthKit Integration
- **Mechanism:** Integrate `react-native-health` (or `@kingstinct/react-native-healthkit`) into `packages/biometrics/src/appleHealth.ts`.
- **Costs & Overhead:**
  - Additional native dependency in bundle.
  - Required `Info.plist` key: `NSHealthShareUsageDescription` ("pikeMethods reads HRV, resting heart rate, and sleep data to compute daily readiness.").
  - iOS HealthKit entitlement (`com.apple.developer.healthkit`).
  - Mandatory Apple App Store HealthKit privacy review.
- **Benefit:** Restores full 3-variable biometrics parity on iOS ($w_{\text{hrv}} + w_{\text{load}} + w_{\text{sleep}}$).

### Option B: Manual-Entry Path for Sleep and/or HRV on iOS
- **Mechanism:** Surface a simple morning subjective check-in sheet or numeric input card for sleep duration/quality and/or RHR.
- **Costs & Overhead:**
  - Requires UI work and unratified copy for manual entry dialogs.
  - Manual HRV estimation is error-prone without wearable hardware.
- **Benefit:** Allows non-wearable or iOS athletes to supply sleep telemetry manually without native SDK dependencies.

### Option C: Ship iOS Honestly on `load_component` Alone
- **Mechanism:** Maintain zero native HealthKit dependencies. Rely on deterministic ACWR workload tracking (`load_component`).
- **Costs & Overhead:** Zero technical overhead; zero App Store review hurdles.
- **In-App Disclosure:** Display a clear statement on the ATHLETE profile / readiness screen: *"On iOS, readiness is derived from your training workload history (ACWR)."*
- **Benefit:** Completely transparent and honest to the athlete without false biometrics claims.

---

## 3. Technical Design: iOS Apple Health Integration (`@ak/biometrics`)

When Option A is executed, the following architecture must be followed:

### 1. Architectural Strategy & Bridge Selection
- **Recommended Library:** `react-native-health` or `@kingstinct/react-native-healthkit`.
- **Inviolable Degradation Contract:**
  1. **No Import Side-Effects:** Native HealthKit module MUST be dynamically `require()`d inside `tryCreateAppleHealthBridge()`, never imported at module root scope. This prevents app boot crashes on platforms without HealthKit support (e.g. iPad, simulator without HealthKit, missing entitlement).
  2. **Platform Guard:** Returns `null` immediately when `Platform.OS !== 'ios'`.
  3. **Unified `BiometricsBridge` Interface:** Both Android (`healthConnect.ts`) and iOS (`appleHealth.ts`) implement `BiometricsBridge`:
     ```typescript
     export interface BiometricsBridge {
       hasGrantedPermissions(): Promise<boolean>;
       requestPermissions(): Promise<boolean>;
       readDaily(days: number): Promise<DailyBiometrics[]>;
     }
     ```
  4. **Factory Pattern (`packages/biometrics/src/index.ts`):**
     ```typescript
     export async function createBiometricsBridge(): Promise<BiometricsBridge | null> {
       if (Platform.OS === 'android') return tryCreateHealthConnectBridge();
       if (Platform.OS === 'ios') return tryCreateAppleHealthBridge();
       return null;
     }
     ```

### 2. Apple HealthKit Metric Mapping to `state_vector`

| Biometrics Metric | HealthKit Sample Type | HealthKit Unit / Enum | Target Field in `DailyBiometrics` | `state_vector` Derivation |
| :--- | :--- | :--- | :--- | :--- |
| **HRV (Vagal Tone)** | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | `ms` | `rmssdMs` | `ln_rmssd = ln(rmssdMs)`; `hrv_z` score against 30-day baseline |
| **Resting Heart Rate** | `HKQuantityTypeIdentifierRestingHeartRate` | `count/min` | `restingHrBpm` | `rhr_z` score against 30-day baseline |
| **Sleep Duration & Stages** | `HKCategoryTypeIdentifierSleepAnalysis` | `HKCategoryValueSleepAnalysis*` | `asleepMin`, `deepMin`, `remMin`, `lightMin`, `inBedMin` | `sleep_efficiency_pct = (asleepMin / inBedMin) * 100`; `sleep_component` score |
| **Blood Oxygen** | `HKQuantityTypeIdentifierOxygenSaturation` | `%` | `spo2NightMean` | `spo2_component` score |

### 3. Sleep Stage Values Mapping
Apple HealthKit categorizes sleep samples into:
- `HKCategoryValueSleepAnalysisInBed` $\rightarrow$ `inBedMin`
- `HKCategoryValueSleepAnalysisAsleepCore` / `AsleepUnspecified` $\rightarrow$ `lightMin`
- `HKCategoryValueSleepAnalysisAsleepDeep` $\rightarrow$ `deepMin`
- `HKCategoryValueSleepAnalysisAsleepREM` $\rightarrow$ `remMin`
- `HKCategoryValueSleepAnalysisAwake` $\rightarrow$ Excluded from `asleepMin`

### 4. Privacy & Authorization Handling on iOS
- Requires `NSHealthShareUsageDescription` in `Info.plist`:
  `<string>pikeMethods reads HRV, resting heart rate, and sleep data to compute daily readiness and adjust workout volume.</string>`
- iOS authorization dialog is shown ONLY on explicit user tap of CONNECT button on ProfileScreen.

---

## 4. SpO2 Component Disposition

- **Current Status:** `spo2_component` is computed and stored in `state_vector` (`004_state_vector_materialize.sql:45,51`), but is **omitted from the readiness score calculation**.
- **Google Policy Context:** Google Health Connect's Jan-2026 Policy Enforcement requires explicit written developer justification per data type. Ingesting background SpO2 data without consuming it in the readiness score exposes the app to rejection during Health Connect data audit.
- **Recommendation:** Do NOT read or request SpO2 permissions in `healthConnect.ts` or future `appleHealth.ts`. Keep `spo2_component` column as neutral `50.0` in `004` or deprecate in a future migration, avoiding unnecessary regulatory scrutiny.

---

## 5. Final Recommendation

1. **Short Term (Current Release):** Implement **Option C** — ship iOS on `load_component` alone, displaying an honest disclosure.
2. **Next Telemetry Cycle:** Build **Option A** (`appleHealth.ts`) cleanly matching the dynamic `require()` graceful degradation pattern of `healthConnect.ts`.
