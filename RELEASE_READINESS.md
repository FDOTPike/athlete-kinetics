# Release Readiness — Athlete Kinetics / pikeMethods (iOS App Store + Google Play)

Prepared 2026-07-21. Scope: what's needed to ship this specific app to both
stores, grounded in the repo (RN 0.81.6 / React 19.1, `ios/` + `android/`,
`react-native-health-connect`, offline-first, no cloud) and current 2026 store
requirements.

## Short answer
Yes — nothing in the architecture blocks store distribution. Offline-first, no
account, no cloud, no telemetry, no runtime LLM is an **asset**: your Apple App
Privacy label and Google Data Safety form can be close to "no data collected,"
which removes a large class of review friction. But based on the current state
it is **not release-ready yet** — the gaps are completeness, on-device
validation, and store paperwork (one health gate in particular), not the design.

---

## A. Finish & prove the product (engineering gates)
- [ ] Close the open UI work orders (WO-UI-2..5 are all "conditional GO," none
      committed). No screen has a confirmed device build yet.
- [ ] Produce the device build + screenshots with **Archivo confirmed rendering**
      (the outstanding checkpoint bundle).
- [ ] Full native `verify:all` green on a real machine (today it caught a real
      Law-6 regression — treat it as a required gate, not a formality).
- [ ] **Validate the 512 MiB (536,870,912 B) dirty-RAM ceiling on a real 4GB legacy
      device** — the preferred operating target remains 450,000,000 B — under
      Jetsam pressure. This is *your own* hard release criterion and has only
      been reasoned about statically — it must be measured (Instruments /
      Android Profiler) before you can claim it.
- [ ] Crash-free QA on real devices, both platforms, including a full workout
      session, backgrounding, and cold-start resume (crash recovery path exists —
      test it on device).
- [ ] Confirm the app is fully functional with **no** Health Connect data (iOS
      has no HealthKit lib wired, so the iOS value prop must stand on manual/
      entered data — the UI already claims "the coach works fully without it";
      verify that end-to-end).

## B. Store accounts & build config
- [ ] Apple Developer Program ($99/yr) + App Store Connect app record.
- [ ] Google Play Developer account ($25 one-time) + Play Console app.
- [ ] Unique bundle IDs / package names, signing (iOS certs+provisioning, Android
      Play App Signing / upload key).
- [ ] **iOS: build with the iOS 26 SDK** — mandatory for new submissions from
      **28 Apr 2026** (RN 0.81 supports it; confirm your Xcode toolchain).
- [ ] **Android: target API 35 now; API 36 (Android 16) required for new apps &
      updates from 31 Aug 2026.** Set `targetSdkVersion` accordingly.
- [ ] App icons, launch screen, version/build numbers, store listing metadata,
      screenshots per store spec.

## C. Compliance paperwork
- [ ] **Privacy policy URL** (required by both stores once health data / permissions
      are involved; Apple also wants one broadly). Host it publicly.
- [ ] **Apple App Privacy labels** — declare data handling. If truly no
      collection, label it so; it must match actual behavior (any crash/analytics
      SDK that phones home breaks this).
- [ ] **Google Data Safety form** — same, and it must be consistent with actual
      behavior or you get removed.
- [ ] ⚠️ **Google Play Health Apps Declaration + Health Connect justification —
      the biggest gate.** Since you use `react-native-health-connect`, Google's
      **January 2026 enforcement** requires a mandatory Health Apps Declaration,
      a written justification for **each** Health Connect data type you read
      (HRV, resting HR, sleep, SpO2), and navigation of the new Medical-Device
      labeling. Budget review time; this can block/delay publishing independent
      of your code. Request only the data types you actually use.
- [ ] Health permission strings / rationale UI on Android (Health Connect
      permission screen) — user-facing, plain-language.
- [ ] iOS: if/when you add HealthKit, you'll need `NSHealthShareUsageDescription`
      etc. and Apple's HealthKit review (no iCloud storage of health data, no
      ads/data-mining on health data). Currently N/A — no HealthKit lib present.

## D. Health-claims positioning (review + liability risk)
- [x] **Kinematic Autopilot remediation ratified:** R1/R1a, R2, and the C6B
      `2.5` authority policy convert the six pinned stationary decision
      counterexamples and nominal gain-3 saturation, with zero upward
      saturation and zero limit cycles in the remediated 2,385-case family.
      This is tested-family evidence, not a universal stability proof; avoid an
      unqualified controller-stability claim.
- [ ] The app issues readiness/recovery/training prescriptions derived from
      biometric signals. Both stores (Apple 1.4.1; Google's Medical-Device
      labeling) scrutinize this. Add clear, visible disclaimers: **not medical
      advice, not a medical device, not a substitute for professional judgment.**
- [ ] Declare regulatory status where prompted (Apple's spring-2026 Health/Fitness
      regulatory-status field; Google's Medical-Device labeling).
- [ ] Because this touches health data + recommendations, a one-time review of
      your privacy policy and disclaimer language by a professional is worth it —
      I can draft, but I'm not a lawyer.

## E. Listing, legal, age rating
- [ ] Support URL / contact, marketing name, description, keywords (avoid
      misleading metadata — a common rejection).
- [ ] Age rating questionnaires (both stores).
- [ ] Terms of Use if you have any account/coach-mode sharing (you don't cloud-
      share, which keeps this light).

## F. Beta before public
- [ ] iOS: TestFlight internal/external beta.
- [ ] Android: Play internal testing → closed → open/production.
- [ ] Use beta to confirm the memory ceiling and crash-free rate on the actual
      device matrix (especially the 4GB legacy target).

---

## Biggest surprises to plan around
1. **Google Play Health Connect declaration (Jan 2026)** — the most likely thing
   to delay you; start it early, justify each data type narrowly.
2. **On-device 512 MiB/Jetsam validation** — your own gate. The component envelope
   (471,936,000 B) sits in the ratified review band, so release requires a device
   evidence packet; `verify:release` fails without one.
3. **iOS 26 SDK / Android API 36 deadlines** — toolchain, not code, but hard
   dates.
4. **Health-claims disclaimers** — cheap to add, expensive to get flagged on.

## Recommended path
Finish + commit the UI, run native `verify:all` green, produce the device build
and validate memory on a 4GB device → stand up privacy policy + store records →
complete Data Safety / App Privacy + the Health Connect declaration → TestFlight
/ Play internal beta → submit. The offline posture means once the product and the
health-declaration paperwork are done, review itself should be relatively smooth.
