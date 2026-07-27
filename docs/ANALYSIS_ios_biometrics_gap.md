# Technical Analysis: iOS Biometrics Gap & Readiness Telemetry Strategy

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

## 3. SpO2 Component Disposition

- **Current Status:** `spo2_component` is computed and stored in `state_vector` (`004_state_vector_materialize.sql:45,51`), but is **omitted from the readiness score calculation**.
- **Google Policy Context:** Google Health Connect's Jan-2026 Policy Enforcement requires explicit written developer justification per data type. Ingesting background SpO2 data without consuming it in the readiness score exposes the app to rejection during Health Connect data audit.
- **Recommendation:** Do NOT read or request SpO2 permissions in `healthConnect.ts` or future `appleHealth.ts`. Keep `spo2_component` column as neutral `50.0` in `004` or deprecate in a future migration, avoiding unnecessary regulatory scrutiny.

---

## 4. Final Recommendation

1. **Short Term (Current Release):** Implement **Option C** — ship iOS on `load_component` alone, displaying an honest disclosure.
2. **Next Telemetry Cycle:** Build **Option A** (`appleHealth.ts`) cleanly matching the dynamic `require()` graceful degradation pattern of `healthConnect.ts`.
