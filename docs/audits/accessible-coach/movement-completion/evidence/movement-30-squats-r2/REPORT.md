# MOV-A01-R2 Report — Front Squat (`8`) Caption & Reason Wording Repair

- **Batch ID:** `MOV-A01-R2`
- **Branch:** `movement/30-squats-2026-10-17`
- **Base Commit:** `614f7326fab8a2c08d9c4f4c00a2e3399580ac48`
- **Prior Source Commit (`MOV-A01-R1`):** `2a80c201ab2b042ac037ab1dd0ce46f2881e3447`
- **New Source Commit (`MOV-A01-R2`):** `fc22d196e2b9d3a0a601089f68f169486b43f275`
- **Movement IDs:** `1, 123, 277, 299, 8, 208, 38, 256, 275` (`8` caption & reason updated; all 9 `drawnSha256` hashes byte-identical to `MOV-A01-R1`)
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Captions, Summaries, and Reasons Changed (`tools/rendering/chain_motion_specs.mjs`)

### 1.1 Movement `8` (`Front Squat`, `slug: 'front-squat'`)

1. **Third caption (`captions[2]`, line `1750`):**
   - **Old text:**
     `'Squat between the hips while holding the rack.'`
   - **New text:**
     `'Squat between the hips with the elbows kept high.'`

2. **Reason (`reason`, line `1754`):**
   - **Old text:**
     `'Source-bound draft, drawn from a 3D model turned 10 degrees so the horizontal upper arms pointing forward, the bar resting on the front of the shoulders, and the upright torso read clearly without an end-on plate covering the shoulder: barbell set across the front of the shoulders with a secure grip slightly wider than shoulder width and the elbows pointing forward, squatting between the hips while holding the rack shelf horizontal, and driving back to standing with the bar over mid-foot.'`
   - **New text:**
     `'Source-bound draft, drawn from a 3D model turned 10 degrees so the horizontal upper arms pointing forward, the bar resting on the front of the shoulders, and the upright torso read clearly without an end-on plate covering the shoulder: barbell set across the front of the shoulders with a secure grip slightly wider than shoulder width and the elbows pointing forward, squatting between the hips with the upper arms kept horizontal and the elbows high, and driving back to standing with the bar over mid-foot.'`

---

## 2. Audit of All Other Captions, Summaries, and Reasons in the Batch

Every other caption, summary, and reason across the nine movements (`1, 123, 277, 299, 8, 208, 38, 256, 275`) in `tools/rendering/chain_motion_specs.mjs` (lines `1672–1825`) was checked for any confusion between the physical squat rack and the front-rack arm position:

- **`1` (`Competition Squat`):** `captions` and `summary` do not mention `"rack"`; `reason` (`line 1686`) says `"standing in front of a squat rack"`, referring to the physical squat rack.
- **`123` (`Narrow Stance Squats`):** `captions` and `summary` do not mention `"rack"`; `reason` (`line 1703`) refers to `"the other back-rack squats"` (the family name).
- **`277` (`Squat with Bands`):** `captions` and `summary` do not mention `"rack"`; `reason` (`line 1720`) says `"standing in a squat rack"`, referring to the physical squat rack.
- **`299` (`Wide Stance Barbell Squat`):** `captions[0]` (`line 1731`) says `"Take the bar from the rack across the upper back..."` (physical squat rack, verbatim from the catalogue text); `reason` (`line 1737`) refers to `"the standard and narrow back-rack squats"` (family name); `summary` does not mention `"rack"`.
- **`8` (`Front Squat`):** `captions[0, 1, 3, 4]` and `summary` (`line 1755`) do not mention `"rack"`; `captions[2]` and `reason` were updated as listed in Section 1.1 above.
- **`208` (`Front Squat (Clean Grip)`):** `captions[0]` (`line 1765`, `"Set the bar in a rack just below shoulder height..."`), `reason` (`line 1771`, `"rack J-hooks set visibly below standing shoulder height..."`), and `summary` (`line 1772`, `"With the bar set in a rack just below shoulder height..."`) all refer unambiguously to the physical squat rack and its J-hooks.
- **`38` (`Box Squat`):** `captions`, `reason`, and `summary` do not mention `"rack"`.
- **`256` (`Reverse Band Box Squat`):** `captions[0]` (`line 1799`, `"Inside a rack, hang bands from the top..."`), `reason` (`line 1805`, `"the power rack overhead frame, the bands hanging from the top of the rack..."`), and `summary` (`line 1806`, `"Inside a rack with bands hung from the top..."`) all refer unambiguously to the physical four-post power rack.
- **`275` (`Speed Box Squat`):** `captions`, `reason`, and `summary` do not mention `"rack"`.

No other movement in the batch required any wording change.

---

## 3. Probe Comparison Against `probe-2a80c201ab2b042ac037ab1dd0ce46f2881e3447.json`

Comparing `docs/audits/accessible-coach/movement-completion/evidence/movement-30-squats-r2/rendered-output-probe.log` (`fc22d196e2b9d3a0a601089f68f169486b43f275`) against `docs/audits/accessible-coach/movement-completion/evidence/movement-30-squats-r1/rendered-output-probe.log` (`2a80c201ab2b042ac037ab1dd0ce46f2881e3447`):

- **All 9 `drawnSha256` hashes are byte-for-byte identical:**
  - `1 Competition Squat`: `drawn 36239389856a68c3adc4a39689c2f7ca988726094b9ecd7e3aad3156fb108007`
  - `123 Narrow Stance Squats`: `drawn 0f917b23be9b162f709a599746846bc15c745187af42288f2e6b2618191393b7`
  - `277 Squat with Bands`: `drawn ddf81b58e63f0d77b7b82ea29413047d5854efc1aec8d6e1df511fcb05096d82`
  - `299 Wide Stance Barbell Squat`: `drawn 390d9ca996247a61fada784bc874c8bd156ffd2886bc66f149375a91ce811de7`
  - `8 Front Squat`: `drawn 9c485ccf51d1ad4467018b446f00dd7d4e4551742868c01ff550699a4c91f02b`
  - `208 Front Squat (Clean Grip)`: `drawn b5f50d98cb11499533f0c42d1d4ce541b5a7d89e15b947f2a9258c4a8b656806`
  - `38 Box Squat`: `drawn a20f6231456d97fcf47993dc9c13c2789e6fc83df1f20ad60c4a08c30503ae04`
  - `256 Reverse Band Box Squat`: `drawn 1953e222334ac3e9790f5bc3d3ec9394a9ce111f6fb99ec1b56394eb7f6ec16c`
  - `275 Speed Box Squat`: `drawn 17b5d517cc1897e163f3599a853b44930c4403103eb1f9433e810150cdb24c50`
- **Only `8 Front Squat`'s `captionSha256` changed (`allowedChanged: [8]`):**
  - `MOV-A01-R1` (`2a80c201`): `40f3e61950f7254d23119a7ca097830adcd5ef2290afe21867b3b0de2191d8df`
  - `MOV-A01-R2` (`fc22d196`): `c0dd819aa41874dbbbd0054978b7a0399b00b80afaaf5062e3987ac5dd2b7514`
  - All other 8 movements in the batch and all 176 baseline movements have unchanged `captionSha256` hashes.

---

## 4. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `fc22d196e2b9d3a0a601089f68f169486b43f275` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-30-squats-r2/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA01Squats.test.js (7.279 s)`
   - `Test Suites: 57 passed, 57 total`
   - `Tests:       2699 passed, 2699 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 191, "families": 75, "rawBytes": 557286, "gzipBytes": 93234`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with baseline-614f7326.json`):**
   - `movements measured: 185 (baseline 176)`
   - `added: 1 Competition Squat; 123 Narrow Stance Squats; 277 Squat with Bands; 299 Wide Stance Barbell Squat; 8 Front Squat; 208 Front Squat (Clean Grip); 38 Box Squat; 256 Reverse Band Box Squat; 275 Speed Box Squat`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`
