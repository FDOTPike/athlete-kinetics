# MOV-S3-R3 Evidence Report (`movement-57-stream3-r3`)

- **Batch:** `MOV-S3-R3` (stream 3's audits of A13, A14 and A10-R1)
- **Branch:** `movement/57-stream3-r3-2026-10-18`
- **Base Commit:** `30d91220bc37d31ddfb2b72cde51cc4216177839`
- **Source Commit:** `5f639fafce0a806a3a24e4c78ad2d9e145a96996`
- **Allowed Changed Movement IDs (16):** `194, 239, 96, 231, 121, 18, 36, 136, 67, 33, 137, 149, 289, 148, 201, 217`
- **Signed:** builder

---

## 1. Gates on the source commit

| Gate | Result |
| :--- | :--- |
| `npm run typecheck` | exit code 0 |
| `jest --testPathPattern MovementPreview` (run in band, no cache) | 65 suites, 3870 tests passed, exit code 0 |
| `verify_preview_storage.mjs` | exit code 0 |
| `test_verify_movement_evidence.mjs` | exit code 0 |
| Rendered-output probe vs `probe-75c79380...json` | added: none; removed: none; changed, NOT expected: none; overflow above 1e-6 dp: none; exit code 0 |

The probe's "changed, expected" list is exactly the 16 allowed movements. Renders for all 16 are in `movement-<id>/neutral-cycle.png`.

## 2. Major findings

1. **`194` Elevated Back Lunge: the knee through the platform.** The platform now starts just behind the heels (`box a: [6, 0.5], b: [22, 6.0]`). The stepping foot is lifted off its edge (`ankleArc: 6`) and lands 33.63 behind it (`ankle: [-33.63, 5.21]`). At every 33 ms tick the thighs and knees stay clear of the platform's painted outline by the thigh half-width. Once the ankle is behind the platform, the shin and foot clear the outline by their painted half-widths. The held bottom and its captions are gone.

2. **`239` Lunge Pass Through: the bell through the thighs.**
   - **Step:** the lunge is now a forward step. The front ankle travels 29.65 and is lifted, not slid. The rear toe stays within 0.40 of where it stood at every tick.
   - **Pass:** the carrying hand brings the bell between the legs, where the other hand meets it on the handle. The bell changes hands only inside a short window at that meeting (`bellPass: [0, 0.02]`). The taking hand then swings it down under the front thigh (`farWristArc: -2`) and carries it out around the leg on the way up (`farWristArc: [0, 0, -6]`).
   - **Reach:** to put the bell under the thigh, the trunk leans toward the front leg (`sideCurl: 25`) with that shoulder packed down (`shrug: -3`). The trunk stays at 76 degrees.
   - **Measured over the whole cycle:** bell to thighs at least 7.586 (bound 7.432). Bell to shins at least 10.675 (bound 6.76). The handle is always exactly at a hand. Arms within reach (at most 24.32 of 24.5). Knees at least 60 degrees, elbows at least 110 degrees.
   - **Test change, at the orchestrator's instruction:** the uncommitted arm-against-thigh loop (former lines 616-624 of `MovementPreview.movA13SingleLeg.test.js`) was removed, and the "no arm is drawn through a leg" clause was dropped from that test's title. That loop came from an earlier interrupted draft, not from the order. The bell-outline, handle-in-hand, under-the-thigh, forward-step and planted-rear-toe checks are unchanged. The far forearm comes close to the front thigh as it reaches under it; the orchestrator has audited the render.

3. **`96` Standing Barbell Calf Raise: the figure toppling backward.**
   - **Block and lean:** the block now runs from x = 3.8, with the ball of the foot 1.6 in from its rear edge. The body leans just far enough from the ankles (shin -97.1 / -96.9 / -95.8) that the centre of mass stays over the block, between its rear edge and the ball of the foot, at every tick. That holds with the bar at 0.40 of body mass and without it (3.98 to 5.17, inside [3.8, 5.4]). The heels stay free: ankles are behind the rear edge by more than the heel's painted radius at every tick (max x 1.39 < 1.64).
   - **Readability:** a new `footCloseUp` panel magnifies the figure's own foot 2 times in a circle beside the figure. It shows the block's rear corner and a thin block-top line drawn over the foot. At the stretch the heel's lowest painted point is 5.07 page units below that line; at the top it is above it. The source's bottom and top pauses are kept.
   - **For the reviewer:** at the stretch, the forward lean adds to the dropped heel. The ankle is then about 35 degrees past neutral, against 28 before.

4. **`231` Kettlebell Turkish Get-Up: the body floating.** Nine keyframes `[0, 1, 2, 3, 4, 3, 2, 1, 0]`, five poses:
   - **Lying:** back and pelvis on the floor, the far leg long on it.
   - **Seated:** on the pelvis, side-bent onto the free hand (trunk raised 48.6 degrees). The far knee is up with its foot down.
   - **One knee, hand down:** the trunk is hinged slightly forward (80 degrees) and tipped sideways over the hand, never leaning back past 95 degrees.
   - **One knee, upright.**
   - **Standing.**

   The near foot never moves. The free hand stays planted from lying until the trunk lifts off it.

   **Contact:** whatever bears weight (back and pelvis, hand, near foot, far foot or far knee) is in painted contact with the floor, within 0.5, at every tick, and nothing is painted below the floor. The bell arm stays locked and vertical, and both knees stay at 35 degrees or more. Ankles stay within 70 to 150 degrees, so the rear foot is relaxed. The pause caption is gone.

   **Rig additions:** to keep contact through the in-between ticks, the rig gained `atArc` (root path lift: hips bridging during the leg sweep) and `trunkArc` (the trunk hinging toward the hand mid-sweep).

5. **`121` Kettlebell Dead Clean: the caption teaching the fault.** The spiral caption and the rack hold are gone. The rack caption is now "Finish the hips and guide the bell close into the rack, receiving it softly with the elbow tucked." The summary, reason and rig comment were updated to match.

## 3. Minor findings

- **Hold captions (`18, 36, 136, 67, 194, 33, 137`):** removed, and the held segments are cut to at most 150 ms or dropped.
- **`136` Barbell Lunge:** the front foot is lifted and steps forward; the rear toe stays planted.
- **`33` Barbell Ab Rollout:**
  - Rolls back to 6.0 in front of the knees with the hips sat back.
  - Nine poses, solved so the plates stay on the floor between them (wrist height within 0.032 of 5.45). Spec phases are now `[0, 4, 8, 4, 0]`.
  - The grip is shoulder width.
- **`137` Barbell Rollout from Bench:** shoulder-width grip, with the five poses re-solved to keep the bar on the floor.
- **`149`, `289` pullovers:** the bench's front edge is under the shoulder blades (`chainFlatBench(-29, -15, 18)`), and the trunk is lifted 1.4 so it rests on that edge instead of sinking into it. `149` starts over the chest (5.13 down the trunk). I also moved `289`'s start over the chest (5.09), which the order did not ask for; its text says the same.
- **`148` Bent-Arm Barbell Pullover:** shoulder-width grip, starting over the chest (5.61 down the trunk).
- **`201` Flat Bench Cable Flyes:** the pulleys are on the chest line (6.0 down the trunk from the shoulders). The hands meet above the chest, 2.71 down the trunk and 22.09 above the neck.
- **`217` Incline Cable Flye:** "30 to 45 degrees" and "upper chest" are removed from the captions and summary.

## 4. Rig additions in `canonicalFigure.ts`

- `footCloseUp(figure)` and the `footCloseUp` movement option (exported; drawn in `layoutChainExtras`).
- Pose path arcs, each a lift at half-way to the next pose:
  - `ankleArc` / `farAnkleArc`: a stepping foot lifted.
  - `atArc`: hips bridging.
  - `trunkArc`: the trunk swinging past its straight blend.
  - `wristArc` / `farWristArc`: a number lifts or dips the hand's path; a `[forward, up, across]` offset bows it, so a hand is carried around a leg rather than through it.
- `bellPass`: the stretch of the way to the next pose in which a single kettlebell changes hands.
- `PULLOVER_BENCH_LIFT` for the cross-bench pullovers.

## 5. Notes

- When the challenger suite (`MovementPreview.challenger_m7_1.test.js`) is run on its own with `--no-cache`, one test ("survives circular references") can exceed its 5 s timeout, because that run starts by compiling the enlarged rig file. It passes in 1.1 s with a warm cache and passed in this gate run.
- `quotes.json` binds two catalogue quotations per movement (32 in all) to their tests, plus 19 lines quoted from the source commit, each checked word for word before writing.
