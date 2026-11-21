# MOV-A02 Report — The Other Squats (8 Movements)

- **Batch ID:** `MOV-A02`
- **Branch:** `movement/31-other-squats-2026-10-17`
- **Base Commit:** `62add4bc79011f8a118f661c9ec89d9d79912736`
- **Source Commit:** `f6a16914161cdd00d44301b01702e2929f18e99b`
- **Movement IDs:** `140, 192, 81, 98, 120, 235, 105, 48`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Turned Views & Yaw Chosen Per Family

All eight movements in `MOV-A02` use a turned 3D view (`view: 'oblique'` with `yawDeg` in `CHAIN_MOVEMENTS`, `view: 'side'` in `tools/rendering/chain_motion_specs.mjs` upgraded to `'oblique'` by `tools/rendering/author_chain_motion.mjs`, and `"turned <deg> degrees"` in `reason`), with a single yaw angle shared across each family so sibling movements can be compared side by side:

1. **`bench-squat` (`140` Barbell Squat To A Bench, `192` Dumbbell Squat To A Bench) — `yawDeg: 30`:**
   - At `30°`, the flat bench behind the athlete (`slab` at `y = 20.6` with legs to the floor) and the backward hip path (`hip[0] = -15.5` at the bottom touch) retain `86.6%` of sagittal depth (`cos(30°)`), while the `50%` lateral Z projection (`sin(30°)`) separates the shoulder-width stance (`footSpread: 4.6`, world ankle span `23.60`), outward knee tracking (`kneeOut: 22`), and the two dumbbells hanging beside the hips and behind the shins in `192` without colliding with the thigh or shin bones.
2. **`zercher-squat` (`81` Zercher Squat) — `yawDeg: 32`:**
   - At `32°`, the bar cradled inside the elbow crooks (`barAt: 'elbows'`), the forearms angled up and inward to the clasped hands in front of the chest, and the elbows riding inside the abducted knees (`elbowSpanBottomZ = 16.29 < kneeSpanBottomZ = 33.59`) at the bottom are simultaneously legible.
3. **`barbell-hack-squat` (`98` Barbell Hack Squat) — `yawDeg: 30`:**
   - At `30°`, the bar starting near the floor behind the calves (`bar Y = 14.61`, `bar[0] < ankle[0] - 1.5`), the long straight arms reaching down behind the thighs, and the close vertical path skimming up behind the legs to lockout (`bar Y = 39.27`, `bar[0] < hip[0] - 1.5`) read clearly, while `barAt: 'behind'` routes the far bar shaft and plate into `groups.behind` so the legs stand cleanly in front of the bar.
4. **`jefferson-squat` (`120` Jefferson Squats) — `yawDeg: 38`:**
   - At `38°`, the straddle stance across the bar (`ankle: [-5, 2.42, +15.5], farAnkle: [+5, 2.42, -15.5]`) and the alternating grip (`wrist: [+5.4, y, +3.6]` in front of the body, `farWrist: [-5.4, y, -3.6]` at an equal distance behind) project the barbell along its length running longitudinally between the legs while keeping the bar midpoint centred at `(X = 0, Z = 0)` as it travels straight up between the legs.
5. **`kneeling-squat` (`235` Kneeling Squat) — `yawDeg: 30`:**
   - At `30°`, both shins and knees planted flat on the floor (`knee Y = 2.65`, `ankle Y = 2.50`) inside the rack, the stacked tall-kneeling start (`hip X = -1.50`, `knee X = -2.25`, `shoulder X = -0.43`), and the backward hip hinge toward the heels (`hip X = -17.0` at `ph = 1` while the trunk stays braced at `68°`) are immediately readable.
6. **`kettlebell-squat` (`105` One-Arm Overhead Kettlebell Squat, `48` Double Kettlebell Front Squat) — `yawDeg: 32`:**
   - Sharing `32°` across both kettlebell squats separates the unilateral overhead lockout (`near wrist Y > head Y + 10` stacked over the near shoulder) from the forward-reaching counterbalance arm (`far wrist X > far shoulder X + 15`) on `105`, and separates the two racked kettlebells (`implement: 'kettlebells'`) resting on the forearms at the chest with the elbows tucked in (`elbowSpanZ = 15.83 < shoulderSpanZ = 20.98`) and knees pushed out (`kneeOut: 28`) on `48`.

---

## 2. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

Two small, optional additions were made to the chain kit so all 185 pre-existing movements remain byte-identical when these options are omitted:

1. **Bar Placement & Behind-Leg Layering (`barAt?: 'hands' | 'elbows' | 'behind'` on `ChainMovement`, lines `1295–1296`, `4293–4305`, `4363–4364`, `4496–4497`, `4514`):**
   ```ts
     implement?: 'none' | 'bells' | 'bell' | 'hammer' | 'bar' | 'ez' | 'cableBar' | 'handle' | 'handles' | 'rope' | 'longBar' | 'kettlebell' | 'kettlebells';
     /** Where a held bar rests on the figure: across the hands by default, cradled in the elbow crooks ('elbows'), or held in the hands with its far half behind the legs ('behind'). */
     barAt?: 'hands' | 'elbows' | 'behind';
   ```
   ```ts
     const crookOf = (arm: { root: ChainVec; mid: ChainVec; end: ChainVec }): ChainVec => {
       const u1 = chainNormal([arm.root[0] - arm.mid[0], arm.root[1] - arm.mid[1], arm.root[2] - arm.mid[2]]);
       const u2 = chainNormal([arm.end[0] - arm.mid[0], arm.end[1] - arm.mid[1], arm.end[2] - arm.mid[2]]);
       return chainAdd(arm.mid, chainNormal([u1[0] + u2[0], u1[1] + u2[1], u1[2] + u2[2]]), 2.2);
     };
     const nearCrook = crookOf(nearArm), farCrook = crookOf(farArm);
     // What a bent hand holds sits on the palm's side of the knuckles; a Zercher bar rests in the elbow crooks.
     const holdOf = (grip: ChainVec, side: number): ChainVec => {
       if (hand === undefined || movement.palm === undefined) return grip;
       return chainAdd(grip, chainUnit([hand[0] + (movement.palm === 'up' ? 90 : -90), hand[1]], side), CHAIN_PALM);
     };
     const nearHold = movement.barAt === 'elbows' ? nearCrook : holdOf(nearGrip, 1);
     const farHold = movement.barAt === 'elbows' ? farCrook : holdOf(farGrip, -1);
   ```
   When `barAt === 'elbows'`, the barbell sits at `nearCrook` and `farCrook` (`2.2` units inside the bisector of upper arm and forearm at each elbow), allowing the forearms and hands to angle up and inward to clasp in front of the chest (`81 Zercher Squat`). When `barAt === 'behind'`, `layoutChainExtras` routes `farGroup` to `groups.behind` (`line 4514`) so the far half of the bar shaft and far plate paint behind both legs (`98 Barbell Hack Squat`).

2. **Double Kettlebell Implement (`'kettlebells'` on `ChainMovement['implement']`, lines `1294`, `4538–4548`):**
   ```ts
       if (kind === 'kettlebells') {
         const fa = figure.projectFar(chainAdd(w.far.hold, [0, 0, 1], -2.6));
         const fb = figure.projectFar(chainAdd(w.far.hold, [0, 0, 1], 2.6));
         const fc = figure.projectFar(chainAdd(w.far.hold, [KETTLEBELL_REST[0], KETTLEBELL_REST[1], -KETTLEBELL_REST[2]], 1));
         far.push({ kind: 'circle', cx: fc[0], cy: fc[1], r: KETTLEBELL_RADIUS, fill: farColor, stroke: 'ink1', strokeWidth: 1, opacity: farOpacity });
         far.push(line(fa, fb, 2.2, farColor, farOpacity));
       }
   ```
   Draws a far-hand kettlebell (`far` layer, mirrored laterally across Z via `-KETTLEBELL_REST[2]`) in addition to the near-hand kettlebell (`near` layer) so `48 Double Kettlebell Front Squat` renders both racked bells on the forearms.

---

## 3. Per-Movement Authoring, Strip-Legibility Verification & Source Bindings

All eight movements are authored on the single neutral figure (`CANONICAL_BODY_PARAMETERS`) with `status: 'pending'`, visually verified in their 8-frame `neutral-cycle.png` strips so an athlete who has never seen the movement can tell from the strip alone where the load is, what touches what, and what moves, and verified at every `33 ms` tick in `apps/mobile/test/components/MovementPreview.movA02OtherSquats.test.js`.

### 3.1 ID `140` — `Barbell Squat To A Bench` (`barbell-squat-to-a-bench`, `bench-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:10798–10799`):**
  > `"instructions": "Place a flat bench behind you, take the bar from the rack across the upper back and stand with the feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Drive through the feet to stand back up without resting on the bench.",`
  > `"cues": "Sit the hips back to the bench. Touch lightly, stay tight. Chest up, knees in line with the toes.",`
- **What was drawn:** Standing in front of a rack (`x = -14`) and a flat bench (`slab` at `y = 20.6`, `x ∈ [-26, -12]` with front and rear support legs), barbell across the upper back (`upperArm: [-102, 22], forearm: [88, 12]`), shoulder-width stance (`footSpread: 4.6`, world ankle Z span `23.60 > shoulderSpanZ 20.98`). The hips sit back and down (`hip: [-15.5, 23.6]` at `ph = 1`) so the underside of the hips/thighs (`23.6 - 3.07 = 20.53`) lightly touches the `y = 20.6` bench top (`|Δy| = 0.07 <= 0.5`) at a single bottom keyframe (`frames.filter(f => f.joints.ph === 1).length === 1`, no seated rest pause) and immediately drives back up through the planted feet.

### 3.2 ID `192` — `Dumbbell Squat To A Bench` (`dumbbell-squat-to-a-bench`, `bench-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:14306–14307`):**
  > `"instructions": "Stand in front of a flat bench with a dumbbell in each hand at your sides, feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Push through the feet to stand back up without resting on the bench.",`
  > `"cues": "Sit back to the bench. Touch lightly, stay tight. Chest up, eyes forward.",`
- **What was drawn:** Same `30°` oblique view and flat bench (`slab` at `y = 20.6`) as `140`, holding a dumbbell in each hand at the sides (`implement: 'bells', bellAxis: [1, 0, 0]`) with long arms hanging beside the hips (`upperArm: [-88, -12], forearm: [-86, -8]` at standing; `upperArm: [-82, -14], forearm: [-76, -10]` at the bottom touch so the dumbbells hang cleanly in the open space below the thigh and behind the shin). The hips lightly touch the bench at a single `ph = 1` keyframe (`|23.6 - 3.07 - 20.6| = 0.07 <= 0.5`) and push straight back to standing without resting.

### 3.3 ID `81` — `Zercher Squat` (`zercher-squat`, `zercher-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:6811–6812`):**
  > `"instructions": "Cradle the bar in the crooks of the elbows, clasp the hands, and stand from the rack. Squat between the knees while the torso stays as tall as the front load allows. Drive up without letting the bar roll down the forearms. Use a wrap or pad as needed; if arm pressure becomes painful or changes the position, end the set and adjust.",`
  > `"cues": "Elbows ride inside the knees at the bottom. Brace tall like a front squat. Wrap the bar, then give it full effort.",`
- **What was drawn:** Turned `32°` in front of a rack with J-hooks at elbow-crook height (`y = 48.5`), barbell cradled in the elbow crooks (`implement: 'bar', barAt: 'elbows'`), upper arms angled down and slightly inward (`[-52, 8]` to `[-48, 6]`) and forearms angled up and inward (`[55, 22]` to `[58, 22]`) so the hands clasp together in front of the chest (`wrist[1] > elbow[1] + 8`). At the bottom (`hip[1] = 18.80`), the knees push wide (`kneeOut: 32`, `kneeSpanBottomZ = 33.59`) so the elbows and cradled bar ride cleanly inside the knees (`elbowSpanBottomZ = 16.29`).

### 3.4 ID `98` — `Barbell Hack Squat` (`barbell-hack-squat`, `barbell-hack-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:7952–7953`):**
  > `"instructions": "Set a bar on the floor behind your calves, stand about hip width, then squat down and take a shoulder-width grip with long arms. Brace the trunk and drive the floor away, letting the bar skim up behind the legs as the hips and knees straighten together. Lower along the same close path; when the grip or torso position breaks before the legs tire, that is the load limit for the day.",`
  > `"cues": "Set the chest proud and the arms long. Push the floor away. Keep the bar close behind the legs.",`
- **What was drawn:** Turned `30°` with `implement: 'bar', barAt: 'behind'` and hip-width stance (`footSpread: 2.2`). Unlike rack squats, the rep starts at `ph = 0` in the bottom squat position (`hip: [-8.5, 20.5], trunk: 54`) with long straight arms (`upperArm: [-100, -10], forearm: [-100, -6]`, reach `24.48 / 24.50`) gripping the bar near the floor right behind the calves (`bar Y = 14.61`, `bar[0] = -4.23 < ankle[0] - 1.5`). Driving the floor away straightens the hips and knees together to `ph = 1` (`hip: [-1.5, 45.2], trunk: 88`), skimming the bar close behind the legs (`bar[0] < knee[0] - 3.0` on every phase) up to behind the hips/hamstrings (`bar Y = 39.27, bar[0] = -4.50 < hip[0] - 1.5`), then lowering along the same close path back to the floor.

### 3.5 ID `120` — `Jefferson Squats` (`jefferson-squats`, `jefferson-squat`, `yawDeg: 38`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:9435–9436`):**
  > `"instructions": "Straddle the bar with the feet angled comfortably, then squat down and take one hand in front of the body and one behind at equal distances. Brace a tall torso and push both feet through the floor to stand with the bar travelling between the legs. Lower along the same centred path and switch orientation between sets; if the bar twists away from the midline, reset the grip and stance before adding load.",`
  > `"cues": "Centre the torso over the bar. Push both feet through the floor. Keep the bar travelling straight between the legs.",`
- **What was drawn:** Turned `38°`, straddling the barbell with the near foot planted forward/near (`ankle: [-5, 2.42, 15.5]`) and the far foot planted back/far (`farAnkle: [5, 2.42, -15.5]`), torso twisted `32°` across the bar (`trunk: [64, 32]` at bottom, `[88, 32]` at standing), and one hand gripping in front of the body (`wrist: [5.4, y, 3.6]`) and the other at an equal distance behind (`farWrist: [-5.4, y, -3.6]`). Starting from the bottom at `ph = 0` (`hip: [0, 21.0], bar Y = 21.60`), the athlete pushes both feet through the floor to stand tall at `ph = 1` (`hip: [0, 44.2], bar Y = 42.60`) while the bar midpoint stays centred at `(X = 0, Z = 0)` travelling straight up and down between the legs.

### 3.6 ID `235` — `Kneeling Squat` (`kneeling-squat`, `kneeling-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:17179–17180`):**
  > `"instructions": "Kneel tall in a rack with the bar on the back and the hips, knees and shoulders stacked. Sit the hips back toward the heels only as far as the trunk stays braced. Drive the hips forward to return to tall kneeling; when the ribs flare, shorten the range.",`
  > `"cues": "Set the ribs down before you sit back. Move at the hips, not the low back. Finish tall through the glutes.",`
- **What was drawn:** Turned `30°` inside a rack (`x = -14`, low J-hooks at `y = 44`) with `feet: 'free'` and `foot: [180, 0]` so both knees (`knee Y = 2.65 <= 3.5`) and shins/ankles (`ankle: [-24.5, 2.5, ±9.2]`) rest flat on the floor throughout the cycle. At `ph = 0` (tall kneeling), the hips (`hip: [-1.5, 24.8]`), knees (`knee X = -2.25`), and shoulders (`neck X = -0.43`) are stacked vertically (`|hip[0] - knee[0]| = 0.75 <= 2.5`). At `ph = 1`, the hips hinge back toward the heels (`hip: [-17.0, 9.8]`, `15.5` units of backward travel, `|hip - ankle| = 8.49 < 9`) while the trunk stays braced (`trunk: 68°`), then drive forward through the glutes to return to tall kneeling.

### 3.7 ID `105` — `One-Arm Overhead Kettlebell Squat` (`one-arm-overhead-kettlebell-squat`, `kettlebell-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:8420–8421`):**
  > `"instructions": "Clean and press one kettlebell overhead, lock the elbow, and use the free arm forward as a counterbalance. Root the whole foot and sit between the hips while keeping the bell stacked over the shoulder and the eyes forward. Pause at the deepest owned position, then drive to standing; the rep ends where the bell drifts or the ribs flare, not where the hips wish to go.",`
  > `"cues": "Punch the bell toward the ceiling. Sit between the hips on a rooted foot. Drive up under the bell.",`
- **What was drawn:** Turned `32°` with `implement: 'kettlebell'` (single kettlebell in the near hand), shoulder-width stance (`footSpread: 4.8`), near arm locked vertically overhead (`upperArm: [88, 0], forearm: [90, 0]`, `wrist[1] > head[1] + 10` and `|wrist[0] - shoulder[0]| <= 3.5` across all ticks), and the far free arm reaching forward as a counterbalance (`farUpperArm: [-8, 10], farForearm: [2, 15]`, `far.wrist[0] > far.shoulder[0] + 15`). The athlete descends between the hips (`hip[1] = 19.20 < knee[1] - 1.0`, `kneeOut: 26`), holds a `450 ms` pause at the deepest position (`frames[1..2].joints.ph === 1`, `segmentDurationsMs: [1200, 450, 1100, 450]`), and drives up under the bell.

### 3.8 ID `48` — `Double Kettlebell Front Squat` (`double-kettlebell-front-squat`, `kettlebell-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:4581–4582`):**
  > `"instructions": "Clean two kettlebells into the rack position, resting on your forearms at your chest. Squat down as deep as you can control, keeping your elbows in and chest up. Drive back up to standing without letting the bells pull you forward.",`
  > `"cues": "Elbows in, bells resting on the forearms. Stay tall — chest proud against the load. Full foot planted, knees out.",`
- **What was drawn:** Turned `32°` with `implement: 'kettlebells'` (drawing both near and far kettlebells resting on the forearms at the chest), upper arms tucked in (`upperArm: [-52, 8]`, `elbowSpanZ = 15.83 < shoulderSpanZ = 20.98`) and forearms angled up to the chest (`forearm: [62, 22]`, `neck[1] - 10 < hold[1] < neck[1] + 2`). From a planted shoulder-width stance (`footSpread: 4.6`), the athlete squats deep (`hip[1] = 18.80 < knee[1] - 1.0`) with knees pushed out (`kneeOut: 28`, `kneeSpanBottomZ = 34.48 > ankleSpanZ + 8`) and chest proud (`trunk: 70°` at bottom), then drives back to standing.

---

## 4. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `f6a16914161cdd00d44301b01702e2929f18e99b` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-31-other-squats/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA02OtherSquats.test.js`
   - `Test Suites: 58 passed, 58 total`
   - `Tests:       2822 passed, 2822 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 199, "families": 75, "rawBytes": 579263, "gzipBytes": 96717`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-fc22d196e2b9d3a0a601089f68f169486b43f275.json`):**
   - `movements measured: 193 (baseline 185)`
   - `added: 140 Barbell Squat To A Bench; 192 Dumbbell Squat To A Bench; 81 Zercher Squat; 98 Barbell Hack Squat; 120 Jefferson Squats; 235 Kneeling Squat; 105 One-Arm Overhead Kettlebell Squat; 48 Double Kettlebell Front Squat`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 5. Unresolved Items

- None.
