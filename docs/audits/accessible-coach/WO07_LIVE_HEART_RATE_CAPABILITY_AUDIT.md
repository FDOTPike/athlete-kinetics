# WO-07 — Live Heart-Rate Capability Audit

**Audit date:** 2026-09-13
**Required base:** `origin/codex/rpe-familiarisation` / `b94053b4d63fb0ffd3b933aa1890d80f7313a87b`
**Scope:** factual feasibility only. This document neither implements monitoring nor authorizes clinical interpretation.

## Verdict

No genuinely live heart-rate source is verified in this repository. Do **not** present a monitored workout, live limit warning, wearable support, or a “safe” state. The only implemented biometric path is an Android-only, user-initiated historical Health Connect read of HRV, resting heart rate, and sleep, compacted to one row per calendar day.

The required unavailable state is: **“Live heart-rate monitoring is unavailable. This workout is not monitored by the app. Follow your individual plan; the app cannot confirm your heart rate is within any limit.”** It must remain visible whenever continuous monitoring is required by the individual plan. Missing, disconnected, or stale data must never be rendered as safe.

## Evidence boundary

This is source and configuration evidence at the required commit, not native hardware evidence. No paired wearable, Android device, iPhone, Apple Watch, Health Connect provider, background execution, lock-screen test, or sensor replay was available or performed. An installed dependency is treated only as dependency evidence, never as proof of an integration.

Primary repository evidence:

- `packages/biometrics/src/healthConnect.ts:42-46` requests read permission only for `HeartRateVariabilityRmssd`, `RestingHeartRate`, and `SleepSession`; it does not request `HeartRate`.
- `packages/biometrics/src/healthConnect.ts:59,99-123` exposes `readDaily(days)` and reads historical records over a start/end range; it has no subscription, callback, sample stream, or connection-state API.
- `packages/biometrics/src/healthConnect.ts:77` returns `null` unless the runtime OS is Android.
- `packages/biometrics/src/aggregate.ts:4-8,132-156` deliberately compacts records to one daily row; the retained shape has no live sample timestamp, freshness, source-device identity, or connection state.
- `apps/mobile/android/app/src/main/AndroidManifest.xml:15-17` declares only read HRV, resting-HR, and sleep scopes. It declares no Bluetooth permission, foreground service, receiver, or Health Connect heart-rate read scope.
- `apps/mobile/ios/AthleteKinetics/Info.plist` has no HealthKit usage description; the iOS project contains no entitlements file or native health/wearable adapter.
- `apps/mobile/package.json:12-21` contains `react-native-health-connect`, while the dependency/native scan found no BLE, Bluetooth, WatchConnectivity, HealthKit, workout-session, foreground-service, or live-heart-rate implementation.

The existing biometrics test (`packages/biometrics/test/verify_biometrics.mjs`) proves deterministic historical aggregation only. It cannot prove native permission behavior, device pairing, live delivery, reconnection, background execution, lock-screen behavior, freshness, or alerts.

## Capability matrix

| Platform / candidate source | Foreground | Background / lock screen | Permission | Pairing / reconnect | Timestamp / freshness | Connection state | Status |
|---|---|---|---|---|---|---|---|
| Android Health Connect historical import | Historical read can be initiated while the app is foregrounded; no live stream | No background or lock-screen collection/evidence | Read-only HRV, resting-HR, sleep scopes; Health Connect availability and grant are checked | Health Connect/provider pairing and reconnect are not exposed by the app | Source records have timestamps before daily aggregation; app retains a calendar-day summary only, with no freshness contract | No source connection state; bridge availability/permission are not wearable connection state | **Implemented historical import; not live monitoring** |
| Android direct BLE / wearable | No implementation or hardware evidence | No implementation or hardware evidence | No Bluetooth permission or pairing flow | No pairing/reconnect API | No live sample or freshness model | No connection model | **Unavailable / unverified** |
| Wear OS / Android companion | No implementation or hardware evidence | No implementation or hardware evidence | No companion/wearable permission or module | No pairing/reconnect API | No live sample or freshness model | No connection model | **Unavailable / unverified** |
| iOS HealthKit / Apple Watch | Android gate returns `null`; no iOS native adapter | No implementation or hardware evidence | No HealthKit entitlement or usage description in the tracked iOS target | No WatchConnectivity/pairing/reconnect API | No live sample or freshness model | No connection model | **Unavailable / unverified** |

## Safe design-only contract if a source is later verified

This is a proposal, not shipped behavior. A pure, offline evaluator may accept only explicit inputs: a clinician/user-entered ceiling in bpm, a received sample `{ bpm, sampledAt }`, an evaluated-at instant supplied by the caller, a configured freshness window, and an explicit source state (`connected`, `disconnected`, or `unavailable`). It must not derive a limit from diagnosis, profile data, or a missing value.

| Condition | Advisory result |
|---|---|
| Connected, finite fresh sample and `bpm < ceiling` | Advisory in-range; never a safety guarantee |
| Connected, finite fresh sample and `bpm === ceiling` | Immediate boundary warning (ceiling is inclusive); no silent grace period |
| Connected, finite fresh sample and `bpm > ceiling` | Immediate over-limit warning |
| Sample older than freshness window, malformed, absent, or future-dated | Stale/unavailable; no in-range or safe label |
| Disconnected or unavailable source | Unavailable; no in-range or safe label |
| No explicit ceiling | Limit not configured; do not infer one or imply monitoring |

Warnings would remain advisory: they can report received data and the applicable user/clinician instruction, prompt pause/recovery, and—only after platform-specific verification—offer supported sound/haptics. They cannot guarantee that a person remained below a limit or replace a medical monitor. Repeated-event suppression, artifact handling, sample ordering, and platform notification behavior require separately specified and tested rules before implementation.

## Required verification before any live-support claim

1. A primary platform/API implementation with declared permissions, source identity, pairing, reconnection, timestamp, freshness, and connection-state semantics.
2. Automated deterministic sample-replay tests for exact boundary, over-limit, stale, unavailable, disconnected, duplicate/out-of-order samples, artifacts, changed limits, and repeated warnings.
3. Reproducible native hardware evidence for every claimed platform/device integration: permission denial/grant, paired source, live foreground delivery, disconnect/reconnect, background and lock-screen behavior, and the rendered unavailable state.
4. A separate clinical/product review of warning copy, notification policy, and the individual's requirement for continuous monitoring. No default ceiling and no condition-specific limit are authorized.

## Scope status

- **Implemented:** Android historical Health Connect import for daily HRV/resting-HR/sleep only (pre-existing).
- **Verified by this audit:** source/configuration boundaries and absence of a tracked live-monitoring implementation at the required base.
- **Design-only:** deterministic advisory evaluator and state semantics above.
- **Deferred/unavailable:** all live heart-rate monitoring, wearable pairing, background/lock-screen monitoring, live alerts, iOS/Apple Watch integration, device evidence, and clinical-monitoring claims.

Migration 064, prescription/progression logic, and all release/C6 activity are outside this audit and unchanged.
