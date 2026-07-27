# Technical Design: iOS Apple Health Integration (`@ak/biometrics`)

This document outlines the architectural plan for expanding `@ak/biometrics` to support iOS Apple Health (HealthKit), matching the deterministic, zero-crash contract established by Android Health Connect (`healthConnect.ts`).

---

## 1. Architectural Strategy & Bridge Selection

### Recommended Bridge Library
We recommend **`react-native-health`** (or a minimal native HealthKit bridge using `@kingstinct/react-native-healthkit`).

### Inviolable Degradation Contract
1. **No Import Side-Effects:** The native HealthKit module MUST be dynamically `require()`d inside `tryCreateAppleHealthBridge()`, never imported at module root scope. This prevents app boot crashes on platforms or devices without HealthKit support (e.g. iPad, simulator without HealthKit, or missing entitlement).
2. **Platform Guard:** Returns `null` immediately when `Platform.OS !== 'ios'`.
3. **Unified `BiometricsBridge` Interface:** Both Android (`healthConnect.ts`) and iOS (`appleHealth.ts`) implement a single, platform-agnostic interface:

```typescript
export interface BiometricsBridge {
  hasGrantedPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  readDaily(days: number): Promise<DailyBiometrics[]>;
}
```

### Factory Pattern
`packages/biometrics/src/index.ts` exposes a factory function:

```typescript
export async function createBiometricsBridge(): Promise<BiometricsBridge | null> {
  if (Platform.OS === 'android') return tryCreateHealthConnectBridge();
  if (Platform.OS === 'ios') return tryCreateAppleHealthBridge();
  return null;
}
```

---

## 2. Multi-Platform Telemetry Ingestion Architecture

```
                       ┌─────────────────────────┐
                       │   useStore.ts (State)   │
                       └────────────┬────────────┘
                                    │ (Platform Agnostic)
                       ┌────────────▼────────────┐
                       │     BiometricsBridge    │
                       └─────┬─────────────┬─────┘
                             │             │
              ┌──────────────┴──┐       ┌──┴──────────────┐
              │ healthConnect.ts│       │ appleHealth.ts  │
              │    (Android)    │       │     (iOS)       │
              └──────────────┬──┘       └──┬──────────────┘
                             │             │
                             │  Normalized │
                             │  Record     │
                             │  Streams    │
                             └──────┬──────┘
                                    │
                       ┌────────────▼────────────┐
                       │   aggregateDaily()      │
                       │   (Pure TypeScript)     │
                       └─────────────────────────┘
```

The core aggregation logic in `packages/biometrics/src/aggregate.ts` is **100% pure TypeScript** and remains untouched. Native platform adapters (`healthConnect.ts` and `appleHealth.ts`) are thin translators that fetch raw native records and normalize them into structural shapes:
- `HrvRecordLike { time: string; heartRateVariabilityMillis: number }`
- `RhrRecordLike { time: string; beatsPerMinute: number }`
- `SleepRecordLike { startTime: string; endTime: string; stages?: SleepStageLike[] }`

---

## 3. Apple HealthKit Metric Mapping to `state_vector`

| Biometrics Metric | HealthKit Sample Type | HealthKit Unit / Enum | Target Field in `DailyBiometrics` | `state_vector` Derivation |
| :--- | :--- | :--- | :--- | :--- |
| **HRV (Vagal Tone)** | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | `ms` (milliseconds) | `rmssdMs` | `ln_rmssd = ln(rmssdMs)`; `hrv_z` computed against 30-day rolling mean/SD |
| **Resting Heart Rate** | `HKQuantityTypeIdentifierRestingHeartRate` | `count/min` (bpm) | `restingHrBpm` | `rhr_z` score against 30-day baseline |
| **Sleep Duration & Stages** | `HKCategoryTypeIdentifierSleepAnalysis` | `HKCategoryValueSleepAnalysis*` | `asleepMin`, `deepMin`, `remMin`, `lightMin`, `inBedMin` | `sleep_efficiency_pct = (asleepMin / inBedMin) * 100`; `sleep_component` score |
| **Blood Oxygen** | `HKQuantityTypeIdentifierOxygenSaturation` | `%` (0.0 – 1.0 or 0 – 100) | `spo2NightMean` | `spo2_component` score |

### Sleep Stage Values Mapping
Apple HealthKit categorizes sleep samples into:
- `HKCategoryValueSleepAnalysisInBed` $\rightarrow$ `inBedMin`
- `HKCategoryValueSleepAnalysisAsleepCore` / `AsleepUnspecified` $\rightarrow$ `lightMin`
- `HKCategoryValueSleepAnalysisAsleepDeep` $\rightarrow$ `deepMin`
- `HKCategoryValueSleepAnalysisAsleepREM` $\rightarrow$ `remMin`
- `HKCategoryValueSleepAnalysisAwake` $\rightarrow$ Excluded from `asleepMin`

### Wake Morning Date Bucketing Rule
Matching `aggregate.ts` semantics: point samples (HRV/RHR) land on their local date; sleep sessions land on the local date their `endTime` falls on (the wake morning date).

---

## 4. Privacy & Authorization Handling on iOS

### 1. `Info.plist` Usage Descriptions
iOS requires clear, athlete-facing usage descriptions in `Info.plist`:
```xml
<key>NSHealthShareUsageDescription</key>
<string>pikeMethods reads HRV, resting heart rate, and sleep data to compute daily readiness and adjust workout volume.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>pikeMethods does not write health data.</string>
```

### 2. Privacy Manifest (`PrivacyInfo.xcprivacy`)
Apple requires explicit privacy category disclosures for HealthKit data:
- `NSPrivacyCollectedFieldTypeHealthData` marked as **Not linked to user identity** and **Not used for tracking**.

### 3. Apple HealthKit Privacy Safeguards
Apple HealthKit deliberately hides whether read permission was granted or denied to prevent app fingerprinting (`HKAuthorizationStatusSharingDenied` is masked as `NotDetermined` or returns empty queries).

**Impact on `@ak/biometrics` Contract:**
- `hasGrantedPermissions()` returns `true` if HealthKit is initialized and queries succeed without throwing native errors.
- If the athlete denies access in Apple Health, queries return empty arrays `[]`. The app degrades gracefully to **subjective triage-only mode** without throwing exceptions or showing error dialogs.
- `requestPermissions()` MUST only be called when triggered by an explicit user action (pressing `CONNECT` on the ATHLETE screen).

---

## 5. Verification Plan

1. **Unit Verification (`verify_biometrics.mjs`):** Add synthetic HealthKit record fixtures to `verify_biometrics.mjs` to prove that normalized Apple HealthKit records aggregate to `DailyBiometrics` with zero precision loss.
2. **Platform Fallback Test:** Execute `tryCreateAppleHealthBridge()` under Node.js / non-iOS environments to verify that it returns `null` safely without throwing native module errors.
