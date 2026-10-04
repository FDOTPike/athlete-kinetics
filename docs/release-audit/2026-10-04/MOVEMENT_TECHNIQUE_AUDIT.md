# Independent movement technique audit — 2026-10-04

**Verdict: HOLD for animation release.** The cloud-accessible feature branch contains 300 movements but contains no movement-preview implementation or WO-09 evidence. The local animation candidate has 126 drawable drafts, with zero athlete-visible approved previews. Its independent technique checks find contradictions in setup, action, implement/grip, return range and tempo. This report makes no physical technique-certification claim and does not assess native playback smoothness; the separate runtime auditor owns that lane.

## Reviewed identities and limits

- **M — GitHub master:** `1da218d8b1886040dcf89e0d630581f7b33824d9`, clean checkout `C:/Users/fpike/.codex/worktrees/release-cloud-audit-2026-10-04/Athlete App`.
- **F — GitHub feature branch:** `origin/claude/coaching-wo4-coaching-content`, `12a1fb15aff5611b771348a53e2e04f4079e0e34`, clean checkout `C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App`.
- **L — local animation candidate:** `C:/Users/fpike/.codex/worktrees/wo09-health-connect-ordering/Athlete App`, HEAD `01023cf04eeb85b73004b92de11f64efa7350a1c` plus its existing working-tree overlay. HEAD alone does not reproduce this candidate. Split preview digest observed: `d8e2332e4a1e64c1a1d8e262c0f3a6410d22f4989b68c666e3a37ba1443a6244`.
- **R — separate incline repair candidate:** `C:/Users/fpike/.codex/worktrees/wo09-incline-scapular-repair/Athlete App`, same historical HEAD plus different existing overlay.
- Historical source/content review worktrees `movement-animation-source-review` and `movement-content-review` were read as references. Their 2026-09-30 judgments are not fresh approval of F's later 115 content corrections.

Paths below use these root aliases followed by repository path and exact line. Compact JSON files are one line; the movement ID and field identify the cited record on that line.

The audit replayed each source's SQL into an in-memory SQLite database, inspected all preview statuses/coverage, reviewed seven existing headless sheets, and executed a read-only diagnostic against the actual production `canonicalFigure.ts` via Node 24's TypeScript support. No repository source, migration, animation, evidence file or status was changed. Owner phone-memory acceptance is deferred as requested; memory limits are not a technique verdict here.

## Exact inventory

| Snapshot | Effective movements | Applicable SQL files replayed, excluding 004 | Preview records | Drawable drafts | Athlete-visible approved previews |
|---|---:|---:|---:|---:|---:|
| M / 1da218d8 | 124, IDs 1–124 | 34 | 0 | 0 | 0 |
| F / 12a1fb15 | 300, IDs 1–300 | 67 | 0 | 0 | 0 |
| L / local WO-09 overlay | 300, IDs 1–300 | 63 | 129 | 126 | 0 |

Absence was checked using `rg --files apps/mobile/src/components` on M and `git ls-tree -r --name-only origin/claude/coaching-wo4-coaching-content` on F: both have **zero** `movementPreview`/`MovementPreview` paths, and F has **zero** `acceptance-evidence/wo09` paths. `git show 12a1fb15:apps/mobile/src/components/movementPreview/previewIndex.json` fails because the path does not exist. F does include the newer movement library/content migrations, so the entire 300-movement library is not local-only.

L's 129 records comprise **3 covered, 123 pending and 3 intentionally unsuitable**. There are 123 records with their own frames, plus three derivations: 20→19, 186→62 and 247→12. Those derivations are authored variants, not absent animations. The three intentionally unsuitable legacy entries are 7 BJJ Sparring Round, 68 Kettlebell Turkish Get-Up and 70 Power Clean.

The 174-row Beginner catalogue has 120 preview IDs and 54 absent IDs. Two absent IDs, 27 Road Run and 291 Trail Running/Walking, are explicitly unsuitable in its classifier; **52 other Beginner movements lack entries**. Nine preview IDs sit outside this Beginner catalogue: 7, 9, 10, 11, 15, 39, 54, 68, 70. They are legacy records from the full library, not orphan IDs.

Across the whole 300-movement library, **171 IDs have no preview record**, including those two explicitly unsuitable locomotion IDs. Therefore **169 other movements still lack entries** if the existing five exclusions are retained. Their individual suitability still needs review; “169” is an inventory, not a claim that all can be depicted honestly in the current 2D rig. Completing only the 52 missing Beginner entries does not finish the whole movement library.

Inventory sources: L/`apps/mobile/src/components/movementPreview/previewIndex.json:1`, L/`apps/mobile/src/components/movementPreview/movementPreviewManifest.json:1`, L/`docs/audits/accessible-coach/WO09_MOVEMENT_CATALOGUE.json:1`, L/`docs/audits/accessible-coach/WO09_MOTION_FAMILIES.json:1`; F/`packages/core-db/test/verify_library.py` asserts the 300-name corpus. M's ordered migration list is `packages/core-db/src/migrations.ts:66`.

L's global technique review is `pending`. `resolveMovementPreview` returns null before loading a family unless review is `complete`, and later requires a covered entry, exact movement/asset-key identity and media status `ready`: L/`apps/mobile/src/components/movementPreview/manifest.ts:784`, `:793`, `:798`, `:810`, `:811`. Thus the existing three “covered” prototypes do not imply three approved or visible animations. No audit should flip that switch merely because geometry/schema tests pass.

## Blocking technique findings

### T1 — IDs 135/187 are still the wrong action/setup in both local candidates (P1 before enablement)

The latest recorded owner correction says these are **prone, chest-supported forward raises with lower-trap emphasis**, superseding the prior supine shoulder-blade interpretation: R/`docs/audits/incline-scapular-repair/CORRECTED_PRONE_DRAFT.md:3`, `:5`; R/`IMPLEMENTATION_HANDBACK.md:3`, `:7`. The I-versus-Y endpoint, thumb orientation and bench angle remain unspecified: `CORRECTED_PRONE_DRAFT.md:9`. Lower-trap emphasis is recorded as owner intention, not independently established by this audit.

L currently depicts the earlier elbow-led reclined incline arm arc: `apps/mobile/src/components/movementPreview/families/front-raise__incline.json:1`, records 135/187; its first sheet shows an unsupported forward-leaning figure next to the bench, followed by bent-arm raising. R changes this to a supported **supine** straight-arm shoulder-blade reach: `families/scapular-raise__incline.json:1`, first caption “Lie back”; R/`tools/rendering/wo09_repair_incline_scapular.mjs:15` and `:29`. I directly inspected both barbell sheets. Neither candidate implements the latest prone correction.

F retains the generic arm-arc coaching for both rows; its correction source explicitly excludes them: `packages/core-db/staging/movement_content_correction_v2.json:23`. The original imported exact-name [barbell](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Barbell_Incline_Shoulder_Raise.json) and [dumbbell](https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Dumbbell_Incline_Shoulder_Raise.json) records describe a reclined straight-arm shoulder lift. They establish the imported source conflict; they do not override the owner's different intended movement or supply its missing endpoint.

**Acceptance:** resolve the intended arm endpoint and source; preserve IDs/asset keys; append a new content correction using the actual chosen release chain; author matching prone setup, forward action, return, equipment and captions; regenerate classifier/prompt/split files; independently inspect the whole interpolated path. R's historical “migration 065” plan cannot be copied onto F, where 065–068 already exist. Do not publish the supine repair as the final movement.

### T2 — ID 143 rear-delt raise is authored as ID 110 rear-delt row and never contacts the bench (P1 before enablement)

L/`apps/mobile/src/components/movementPreview/families/rear-delt__bent-over.json:1`, records 110 and 143, uses **identical joint arrays in every frame**. ID 143's source asks for a forehead-supported lateral arm raise with slight elbow bend and a quiet torso. Its fourth caption instead says to pull to the upper chest; the sequence begins standing and changes torso position.

Production layout draws the support at x=66..92, y=40..44: L/`canonicalFigure.ts:1741`, `:1743`. Calling the actual `resolveFigureJoints` and comparing the neutral head circle to that pad gives a **minimum surface gap of 4.14 drawing units** across every frame. The observed sheet corroborates an unsupported head and a row-like arm path. The support is drawn but does not support the head.

This is a source/drawing contradiction, not a judgment inferred from the display name. F retains the detailed ID 143 source. ACE's own [shoulder-study protocol](https://contentcdn.eacefitness.com/certifiednews/images/article/pdfs/ACEShoulderStudy.pdf), page 3, separately describes rear lateral raising with a fixed elbow position and incline rowing; it provides independent support for treating those as different actions, not interchangeable frames.

**Acceptance:** give 143 its own supported lateral-raise path and matching captions/view; demonstrate continuous forehead/pad contact during the working rep, quiet trunk and stated elbow configuration. Re-audit 110's actual bar-to-upper-chest endpoint separately; sharing an action family must not erase the action distinction.

### T3 — preacher variants stop before their full return, and copied text contradicts equipment/grip (P1 before enablement)

L/`apps/mobile/src/components/movementPreview/families/elbow-flexion__preacher.json:1`, records 92/158/253. The final frame is a partly flexed intermediate pose, despite its long-position/three-count caption. Actual production `resolveFigureJoints` gives these near-elbow angles:

| ID | Start | Final | Intended endpoint in source/caption |
|---|---:|---:|---|
| 92 Preacher Curl | 170.62° | 100.34° | return to natural long position |
| 158 Cable Preacher Curl | 176.94° | 109.56° | arms extended/long return |
| 253 Preacher Hammer Dumbbell Curl | 149.07° | 78.57° | long-position return caption |

These are drawing angles, not prescribed human ROM. The last pose fails to return even to its own authored start. The component defaults movements with more than three frames to a **single cycle**, ending there: L/`MovementPreview.tsx:386`, `:429`. Therefore this does not become a completed return on the next loop.

The actual segment array for these five-frame entries is `[420,380,460,420]` ms; `segmentDurations` truncates to count−1: L/`canonicalFigure.ts:138`. Ascent is 800 ms, the top holds 460 ms, and the shown return takes 420 ms. That contradicts ID 92's slower lowering and all three copied “three-count” captions.

ID 253 also begins with the copied **bar/underhand-grip** instruction while its equipment is dumbbells and the layout draws hammer bells: L/`canonicalFigure.ts:2139`. I inspected both 92 and 253 sheets; 253 visibly presents dumbbells under a barbell caption. F still has unresolved generic coaching for 253; F's corrected 158 source explicitly requires the arms extended on return. Old L caption/source copies therefore need reconciliation with F before authoring continues.

**Acceptance:** complete the return, preserve intended natural end range without forcing hyperextension, keep upper arms supported, match timing to the displayed cue or remove a numerical timing claim after source review, and give each implement/grip its own matching caption. Check the actual generated prims and the whole interpolation path.

### T4 — shrug draft raises the whole body with bent arms and underholds its stated top pause (P1 before enablement)

L/`apps/mobile/src/components/movementPreview/families/shrug__standing.json:1`, ID 82. The source says straight arms and a one-second top hold. Calling production `resolveFigureJoints` gives an elbow interior angle of **135.35° in all six frames**. Head, pelvis and shoulder anchor all rise by **4.5 units together**; shoulder-to-pelvis offset remains constant. The sheet shows knee extension and a whole-body rise, rather than distinct shoulder-blade motion against a stable trunk. Its repeated top poses hold for only **460 ms**.

The hanging-arm re-solve is configured at L/`canonicalFigure.ts:1378`; source text remains in F/`packages/core-db/src/schema/025_movement_coaching_content.sql:22`. The owner-ratified up-and-back shrug wording is not challenged by this finding; its own drawing fails to depict the specified straight-arm action.

**Acceptance:** stable lower body/trunk, action at the shoulder anchors, arms depicted straight within the agreed rendering tolerance, and a real one-second top pause if that cue remains. Audit the other three shrug variants 53/138/163 for the same shared failure.

### T5 — current content is substantially improved, but unresolved identities and review metadata remain (P2/content hold)

Fresh F SQL replay finds **31** instructions beginning with the generic “Set up …” template, reduced from **146** in L's older content. Do not describe the 146 historical rows as the current GitHub defect count. The exact remaining 31 IDs are listed below.

F's 115-record v2 correction source has **115 null per-record ratifications**, and its top-level state is `pending_owner_review`: `packages/core-db/staging/movement_content_correction_v2.json:17`, `:21`. That file explicitly calls the outstanding per-record approval a release blocker. This audit checks the state; it has not invented approval records. Autonomous implementation authorization does not turn missing source review into performed review.

Still-present examples requiring action-specific source resolution are 135/187 (owner correction above), 200 Finger Curls (wrist-focused cue), 247 One-Arm Dumbbell Row (support unspecified), and the same-source neutral incline presses 212/218 with no distinct action documented. Names and aliases alone do not resolve those differences. 154's authored lat action under a pushdown name and 243's chest-supported scapular-retraction action need clear mapping before frames are chosen. These are preserved identities, not a mandate to merge/rekey or rename them automatically.

The Sep30 300-row content coverage check ran again and passed for its historical source worktree: `python docs/audits/movement-content-review/check_review.py` exited 0. Its 131 checked / 3 proposed / 166 owner-identification states describe L-era content only. They do not approve F's later corrections.

### T6 — existing evidence and source citations cannot stand in for independent technique review (P2/evidence hold)

Of L's 123 raw entries carrying frames, **89 have no technique citations**; 34 carry citation strings. A string is not a verified source/action match. All entries still inherit the pending global review. Numeric checks for bone lengths, clipping and moving joints cannot decide whether a row versus a raise, supine versus prone, or wrist versus finger movement was selected correctly.

I inspected these existing headless sheets: L IDs 135, 92, 253, 82, 143; R IDs 135 and 187. They say they are librsvg approximations, not native-device evidence. L's 135/187 index hashes match its current split digest. The sampled 82/92/253 indexes instead cite split hash `f35f25ae…`, and 143 cites `139011fc…`; all sampled indexes report `sourcesCommittedAtRender:false`. Those sheets are historical visual observations whose captions/joints corroborate the current contradictions; they are not exact-current native proof or reproduction from the named commit alone. See each movement's `evidence_index.json:2`, `:4`, `:5`, `:8`.

**Acceptance:** freeze the actual code/data source and hashes, render from that exact state, retain the independent source-to-action mapping and reviewer verdict, and have the separate runtime auditor verify native output/interaction. Do not relabel old screenshots as newly observed states.

## Ordered implementation backlog and independent acceptance

1. **Select the release source.** Integrate the remote 300-movement feature work and the intended local animation implementation in a reviewable candidate. Reconcile append-only migration order and revised content. Cloud Opus cannot continue animations from F alone because the preview source/evidence is absent there.
2. **Repair the action/caption/geometry defects above first.** IDs 135/187, 143/110, 92/158/253 and 82/53/138/163. These have observed contradictions, so approving or rendering more variants from their current bases would spread the faults.
3. **Reconcile F's updated source into the animation catalogue, family classifier, prompts and pending entries.** Do not let obsolete L generic instructions drive the remaining work. Keep the 31 unresolved rows explicit; resolve source, equipment, setup, grip/laterality, action, endpoint, return and caption together.
4. **Independently audit all 126 existing drawable drafts**, including the three covered prototypes and three derivations. The seven checks here are targeted counterexamples, not a pass for unexamined movements. A per-movement checklist must include support contact, implement/anchor truth, working joints, body stability, start/end range, both sides where applicable, tempo/pause agreement, full return and readable cues. Inspect interpolated frames, not just keyframes.
5. **Author the 52 missing Beginner entries** after resolving their source. Use the missing-family inventory below, prioritizing role-eligible movements according to the reconciled batch plan. Keep each base and its physically different variants reviewable. Do not infer all variants from a title or mechanically reuse a base with a different action.
6. **Address the other 117 absent records** outside the Beginner queue (169 non-excluded absent −52). Decide whether a complete multi-stage storyboard, animation or honest fallback represents each movement. The user requested the entire app/library; the existing Beginner plan is a smaller scope.
7. **Separate approvals.** The technique auditor reviews frozen source/action/kinematics/cues and returns a movement-specific verdict. A different runtime auditor checks native smoothness, lifecycle, controls, reduced motion, accessibility and platform parity on the same candidate. Any changed content or geometry returns to the relevant independent reviewer. Enable only the accepted subset under the approval contract; do not blanket-mark 300 movements complete.

A passing technique verdict requires the intended identity and source to be settled; declared equipment/anchors and supports must exist and contact the correct body points; start, working path and return must agree with copy; tempo claims must agree with durations; and every frame/intermediate pose must represent the same movement without implausible changes in support or limb geometry. Library/schema gates and the separate runtime verdict remain additional checks. This AI content/geometry audit is not an observation of a person performing the exercise or a professional credential.

## Observed read-only probe result

Node 24 imported L's actual `apps/mobile/src/components/movementPreview/canonicalFigure.ts`; the diagnostic called `resolveFigureJoints` and `segmentDurations`, checked the 82 elbow/relative-trunk motion, the three preacher endpoints, 143 head/pad gap and 110 equality, and 253 implement/caption. **Seven targeted assertions failed; command exit 1 was expected for the failing candidate.** No gate or checker was relaxed. The values in T2–T4 come from that execution, not source-grep estimates. No Android/iOS app was run by this technique auditor.

## Remaining generic instructions in current GitHub feature F

| ID | Movement |
|---:|---|
| 93 | Renegade Row |
| 125 | 3/4 Sit-Up |
| 132 | Band Good Morning (Pull Through) |
| 135 | Barbell Incline Shoulder Raise |
| 138 | Barbell Shrug Behind The Back |
| 141 | Bench Press - With Bands |
| 145 | Bent Over Two-Arm Long Bar Row |
| 153 | Box Squat with Bands |
| 157 | Cable One Arm Tricep Extension |
| 163 | Cable Shrugs |
| 165 | Calf Raise On A Dumbbell |
| 175 | Crunches |
| 187 | Dumbbell Incline Shoulder Raise |
| 193 | Dumbbell Tricep Extension -Pronated Grip |
| 196 | Extended Range One-Arm Kettlebell Floor Press |
| 197 | External Rotation |
| 198 | External Rotation with Cable |
| 200 | Finger Curls |
| 205 | Front Barbell Squat To A Bench |
| 214 | Hip Extension with Bands |
| 216 | Incline Cable Chest Press |
| 234 | Kneeling High Pulley Row |
| 244 | Natural Glute Ham Raise |
| 245 | Oblique Crunches |
| 247 | One-Arm Dumbbell Row |
| 250 | One-Arm Kettlebell Swings |
| 253 | Preacher Hammer Dumbbell Curl |
| 263 | Rope Crunch |
| 273 | Shotgun Row |
| 279 | Standing Cable Chest Press |
| 291 | Trail Running/Walking |

## Missing Beginner entries by current local family classification

These classifier labels describe existing authoring groups, not independent technique approval. The two unsuitable locomotion rows are shown separately.

| Family | Missing movement IDs and names |
|---|---|
| trunk-flex@supine | 72 Reverse Crunch; 95 Sit-Up; 99 Cable Reverse Crunch; 124 Tuck Crunch; 150 Bent-Knee Hip Raise |
| elbow-extension@standing-pushdown | 80 Triceps Pushdown; 237 Low Cable Triceps Extension; 262 Reverse Grip Triceps Pushdown; 292 Triceps Pushdown - Rope Attachment |
| elbow-extension@decline | 179 Decline Dumbbell Triceps Extension; 180 Decline EZ Bar Triceps Extension |
| elbow-extension@incline | 154 Cable Incline Pushdown; 155 Cable Incline Triceps Extension |
| elbow-flexion@incline | 219 Incline Dumbbell Curl; 221 Incline Hammer Curls |
| shoulder-raise@standing | 206 Front Cable Raise; 236 Lateral Raise - With Bands |
| upright-row@standing | 295 Upright Barbell Row; 297 Upright Row - With Bands |
| wrist-flexion@seated | 268 Seated Dumbbell Palms-Down Wrist Curl; 269 Seated Dumbbell Palms-Up Wrist Curl |
| wrist-flexion@standing | 164 Cable Wrist Curl; 200 Finger Curls |
| back-extension@prone | 89 Floor Back Extension |
| dip@seated-supported | 37 Bench Dip |
| elbow-extension@bodyweight-supported | 152 Body Tricep Press |
| elbow-extension@supine | 156 Cable Lying Triceps Extension |
| elbow-flexion@prone-supported | 276 Spider Curl |
| elbow-flexion@seated | 171 Concentration Curls |
| flye@decline | 178 Decline Dumbbell Flyes |
| flye@incline | 220 Incline Dumbbell Flyes |
| flye@supine | 49 Dumbbell Flye |
| front-raise@standing | 87 Dumbbell Front Raise |
| glute-kickback@standing | 84 Cable Glute Kickback |
| horizontal-press@standing | 279 Standing Cable Chest Press |
| horizontal-pull@supine | 66 Inverted Row |
| isolation-other@incline | 207 Front Incline Dumbbell Raise |
| lateral-raise@seated | 272 Seated Side Lateral Raise |
| lateral-raise@standing | 50 Dumbbell Lateral Raise |
| lunge@reverse | 52 Dumbbell Reverse Lunge |
| lunge@split-stance | 139 Barbell Side Split Squat |
| push-up@decline | 182 Decline Push-Up |
| rear-delt@supine | 261 Reverse Flyes |
| shoulder-raise@seated | 162 Cable Seated Lateral Raise |
| shoulder-raise@supine | 131 Back Flyes - With Bands |
| straight-arm-pulldown@standing | 264 Rope Straight-Arm Pulldown |
| trunk-flex@decline | 183 Decline Reverse Crunch |
| trunk-flex@kneeling | 232 Kneeling Cable Crunch With Alternating Oblique Twists |
| trunk-flex@standing | 285 Standing Rope Crunch |
| trunk-side-bend@standing | 248 One-Arm High-Pulley Cable Side Bends |
| trunk-twist@decline | 181 Decline Oblique Crunch |
| trunk-twist@seated | 160 Cable Russian Twists |

Explicitly unsuitable absent Beginner rows: 27 Road Run; 291 Trail Running/Walking.

## All remaining full-library IDs without preview records

This is the exact 171-record difference between F's 300-row library and L's 129 preview IDs. Individual animation suitability has not been established for every absent record.

| ID | Movement | Existing disposition |
|---:|---|---|
| 1 | Competition Squat | No preview entry |
| 2 | Deadlift | No preview entry |
| 3 | Competition Bench | No preview entry |
| 4 | Overhead Press | No preview entry |
| 5 | Barbell Row | No preview entry |
| 6 | Weighted Pull-up | No preview entry |
| 8 | Front Squat | No preview entry |
| 13 | Chin-up | No preview entry |
| 18 | Bulgarian Split Squat | No preview entry |
| 23 | Nordic Curl | No preview entry |
| 27 | Road Run | Classified unsuitable for fixed 2D preview |
| 31 | Arnold Press | No preview entry |
| 33 | Barbell Ab Rollout | No preview entry |
| 35 | Barbell Hip Thrust | No preview entry |
| 36 | Barbell Step-Up | No preview entry |
| 37 | Bench Dip | No preview entry |
| 38 | Box Squat | No preview entry |
| 41 | Cable Shoulder Press | No preview entry |
| 43 | Close-Grip Bench Press | No preview entry |
| 45 | Decline Bench Press | No preview entry |
| 46 | Deficit Deadlift | No preview entry |
| 47 | Dip | No preview entry |
| 48 | Double Kettlebell Front Squat | No preview entry |
| 49 | Dumbbell Flye | No preview entry |
| 50 | Dumbbell Lateral Raise | No preview entry |
| 52 | Dumbbell Reverse Lunge | No preview entry |
| 56 | Dumbbell Step-Up | No preview entry |
| 58 | Eccentric Wall Handstand Push-Up | No preview entry |
| 61 | Good Morning | No preview entry |
| 63 | Handstand Push-Up | No preview entry |
| 64 | Hanging Leg Raise | No preview entry |
| 65 | Incline Dumbbell Press | No preview entry |
| 66 | Inverted Row | No preview entry |
| 67 | Kettlebell Pistol Squat | No preview entry |
| 69 | Pike Push-Up | No preview entry |
| 71 | Pull-Up | No preview entry |
| 72 | Reverse Crunch | No preview entry |
| 77 | Straight-Arm Pulldown | No preview entry |
| 78 | Sumo Deadlift | No preview entry |
| 79 | T-Bar Row | No preview entry |
| 80 | Triceps Pushdown | No preview entry |
| 81 | Zercher Squat | No preview entry |
| 83 | Cable Chest Press | No preview entry |
| 84 | Cable Glute Kickback | No preview entry |
| 85 | Double Kettlebell Push Press | No preview entry |
| 87 | Dumbbell Front Raise | No preview entry |
| 89 | Floor Back Extension | No preview entry |
| 91 | Lying Dumbbell Triceps Extension | No preview entry |
| 93 | Renegade Row | No preview entry |
| 94 | Single-Leg Romanian Deadlift | No preview entry |
| 95 | Sit-Up | No preview entry |
| 96 | Standing Barbell Calf Raise | No preview entry |
| 98 | Barbell Hack Squat | No preview entry |
| 99 | Cable Reverse Crunch | No preview entry |
| 101 | Cuban Press | No preview entry |
| 102 | Decline Dumbbell Bench Press | No preview entry |
| 104 | One-Arm Kettlebell Row | No preview entry |
| 105 | One-Arm Overhead Kettlebell Squat | No preview entry |
| 107 | Reverse Grip Bent-Over Rows | No preview entry |
| 108 | V-Bar Pulldown | No preview entry |
| 109 | Zottman Curl | No preview entry |
| 112 | Bent Press | No preview entry |
| 119 | Decline Crunch | No preview entry |
| 120 | Jefferson Squats | No preview entry |
| 121 | Kettlebell Dead Clean | No preview entry |
| 123 | Narrow Stance Squats | No preview entry |
| 124 | Tuck Crunch | No preview entry |
| 129 | Alternating Kettlebell Press | No preview entry |
| 130 | Alternating Kettlebell Row | No preview entry |
| 131 | Back Flyes - With Bands | No preview entry |
| 136 | Barbell Lunge | No preview entry |
| 137 | Barbell Rollout from Bench | No preview entry |
| 139 | Barbell Side Split Squat | No preview entry |
| 140 | Barbell Squat To A Bench | No preview entry |
| 145 | Bent Over Two-Arm Long Bar Row | No preview entry |
| 148 | Bent-Arm Barbell Pullover | No preview entry |
| 149 | Bent-Arm Dumbbell Pullover | No preview entry |
| 150 | Bent-Knee Hip Raise | No preview entry |
| 151 | Board Press | No preview entry |
| 152 | Body Tricep Press | No preview entry |
| 153 | Box Squat with Bands | No preview entry |
| 154 | Cable Incline Pushdown | No preview entry |
| 155 | Cable Incline Triceps Extension | No preview entry |
| 156 | Cable Lying Triceps Extension | No preview entry |
| 160 | Cable Russian Twists | No preview entry |
| 162 | Cable Seated Lateral Raise | No preview entry |
| 164 | Cable Wrist Curl | No preview entry |
| 165 | Calf Raise On A Dumbbell | No preview entry |
| 166 | Clock Push-Up | No preview entry |
| 170 | Close-Grip Push-Up off of a Dumbbell | No preview entry |
| 171 | Concentration Curls | No preview entry |
| 176 | Deadlift with Bands | No preview entry |
| 177 | Decline Close-Grip Bench To Skull Crusher | No preview entry |
| 178 | Decline Dumbbell Flyes | No preview entry |
| 179 | Decline Dumbbell Triceps Extension | No preview entry |
| 180 | Decline EZ Bar Triceps Extension | No preview entry |
| 181 | Decline Oblique Crunch | No preview entry |
| 182 | Decline Push-Up | No preview entry |
| 183 | Decline Reverse Crunch | No preview entry |
| 184 | Drag Curl | No preview entry |
| 188 | Dumbbell Lying Rear Lateral Raise | No preview entry |
| 189 | Dumbbell One-Arm Shoulder Press | No preview entry |
| 190 | Dumbbell Prone Incline Curl | No preview entry |
| 192 | Dumbbell Squat To A Bench | No preview entry |
| 194 | Elevated Back Lunge | No preview entry |
| 195 | Elevated Cable Rows | No preview entry |
| 200 | Finger Curls | No preview entry |
| 201 | Flat Bench Cable Flyes | No preview entry |
| 202 | Floor Glute-Ham Raise | No preview entry |
| 203 | Floor Press | No preview entry |
| 204 | Frog Sit-Ups | No preview entry |
| 205 | Front Barbell Squat To A Bench | No preview entry |
| 206 | Front Cable Raise | No preview entry |
| 207 | Front Incline Dumbbell Raise | No preview entry |
| 208 | Front Squat (Clean Grip) | No preview entry |
| 209 | Full Range-Of-Motion Lat Pulldown | No preview entry |
| 210 | Good Morning off Pins | No preview entry |
| 211 | Gorilla Chin/Crunch | No preview entry |
| 213 | High Cable Curls | No preview entry |
| 215 | Incline Barbell Triceps Extension | No preview entry |
| 217 | Incline Cable Flye | No preview entry |
| 219 | Incline Dumbbell Curl | No preview entry |
| 220 | Incline Dumbbell Flyes | No preview entry |
| 221 | Incline Hammer Curls | No preview entry |
| 228 | Kettlebell Arnold Press | No preview entry |
| 229 | Kettlebell Seated Press | No preview entry |
| 230 | Kettlebell Seesaw Press | No preview entry |
| 231 | Kettlebell Turkish Get-Up (Lunge style) | No preview entry |
| 232 | Kneeling Cable Crunch With Alternating Oblique Twists | No preview entry |
| 233 | Kneeling Cable Triceps Extension | No preview entry |
| 235 | Kneeling Squat | No preview entry |
| 236 | Lateral Raise - With Bands | No preview entry |
| 237 | Low Cable Triceps Extension | No preview entry |
| 239 | Lunge Pass Through | No preview entry |
| 240 | Lying Cable Curl | No preview entry |
| 241 | Lying Rear Delt Raise | No preview entry |
| 242 | Lying Triceps Press | No preview entry |
| 243 | Middle Back Shrug | No preview entry |
| 244 | Natural Glute Ham Raise | No preview entry |
| 248 | One-Arm High-Pulley Cable Side Bends | No preview entry |
| 249 | One-Arm Kettlebell Floor Press | No preview entry |
| 250 | One-Arm Kettlebell Swings | No preview entry |
| 252 | Pin Presses | No preview entry |
| 256 | Reverse Band Box Squat | No preview entry |
| 257 | Reverse Band Deadlift | No preview entry |
| 258 | Reverse Band Sumo Deadlift | No preview entry |
| 259 | Reverse Barbell Preacher Curls | No preview entry |
| 261 | Reverse Flyes | No preview entry |
| 262 | Reverse Grip Triceps Pushdown | No preview entry |
| 264 | Rope Straight-Arm Pulldown | No preview entry |
| 265 | Seated Bent-Over Rear Delt Raise | No preview entry |
| 268 | Seated Dumbbell Palms-Down Wrist Curl | No preview entry |
| 269 | Seated Dumbbell Palms-Up Wrist Curl | No preview entry |
| 271 | Seated Good Mornings | No preview entry |
| 272 | Seated Side Lateral Raise | No preview entry |
| 275 | Speed Box Squat | No preview entry |
| 276 | Spider Curl | No preview entry |
| 277 | Squat with Bands | No preview entry |
| 279 | Standing Cable Chest Press | No preview entry |
| 281 | Standing Dumbbell Reverse Curl | No preview entry |
| 285 | Standing Rope Crunch | No preview entry |
| 288 | Stiff-Legged Barbell Deadlift | No preview entry |
| 289 | Straight-Arm Dumbbell Pullover | No preview entry |
| 290 | Sumo Deadlift with Bands | No preview entry |
| 291 | Trail Running/Walking | Classified unsuitable for fixed 2D preview |
| 292 | Triceps Pushdown - Rope Attachment | No preview entry |
| 293 | Two-Arm Kettlebell Row | No preview entry |
| 295 | Upright Barbell Row | No preview entry |
| 296 | Upright Cable Row | No preview entry |
| 297 | Upright Row - With Bands | No preview entry |
| 299 | Wide Stance Barbell Squat | No preview entry |

## Reviewed input fingerprints

| Snapshot | File | SHA-256 |
|---|---|---|
| L | apps/mobile/src/components/movementPreview/movementPreviewManifest.json | `10ef1c176426cc8d50a2f1d83abef4b1baca57212b8afb84e8feb9ce0e723bdd` |
| L | apps/mobile/src/components/movementPreview/canonicalFigure.ts | `14c45475322f56daa246141e2712f8867f15ba129b4441f96463b4c7cce14a38` |
| L | apps/mobile/src/components/movementPreview/manifest.ts | `643bf1e7edd9435e47cb03204abe8b26a85d00c80e8517ab767902e01933b206` |
| L | apps/mobile/src/components/movementPreview/previewIndex.json | `314e9898ffd8d95deecc0c35c830388d2c0894f571a3c2d5b2ecd0ed755e6cf1` |
| R | apps/mobile/src/components/movementPreview/movementPreviewManifest.json | `de29b0338c4bf758fe11de254b45a45c673e86f15c7a373d04f60a4646ad5084` |
| R | apps/mobile/src/components/movementPreview/canonicalFigure.ts | `4bae72fd56257b46ff9ba3a730b0875ba9768354176831d92eafcdd6856cfeaf` |
| R | apps/mobile/src/components/movementPreview/manifest.ts | `92621456d6f745d16f0a0a483a590111b9432789549680b6708dd3fb27405b23` |
| R | apps/mobile/src/components/movementPreview/previewIndex.json | `3b9ddc525a737fcf6a5733b1dfa8c9d44a2ef4ad164a986f8f1a46d2eb4e9ee6` |
| F | packages/core-db/staging/movement_content_correction_v2.json | `6f3103ed7910584eac0b38a36651857e80a1e09625ca28c440fbaec854651b23` |
