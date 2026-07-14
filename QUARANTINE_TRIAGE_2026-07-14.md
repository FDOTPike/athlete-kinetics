# Quarantine triage - 2026-07-14

**Work order:** WO-4  
**Checkpoint:** C - APPROVED; Fable sanity check passed and Francis RATIFIED ALL  
**Release status:** unchanged NO-GO; this report makes no shipped-app or schema change

## Executive disposition

- Exact scope reconciled: 61 no-pattern-only + 65 machine-only + 40 other-only = 166 records.
- No-pattern-only: 61/61 can use an existing eight-pattern category; 0 exclusions proposed.
- Machine-only: extend vocabulary for 37 `Machine` and 19 `Smith` strength records; keep 9 cardio-machine modalities out.
- Other-only: 19 vocabulary-extension cases, 9 corrections to existing tokens, and 12 keep-out decisions.
- Staging audit: 20 high-confidence category corrections found. Two are already seeded and therefore cannot be fixed by rewriting a shipped migration.

The upstream source metadata was used only to disambiguate misleading names (notably `Air Bike`, which is a bicycle crunch, and `Cable Incline Pushdown`, whose primary target is lats). The source remains the [free-exercise-db dataset](https://github.com/yuhonas/free-exercise-db).

## Decision rules

1. Use the dominant training action, not a stray word in the name.
2. Keep one identity for weighted/attachment variants when the base movement already owns history.
3. Never invent an implement. A vocabulary extension must name equipment the athlete can actually select.
4. `Machine` means selectorized or plate-loaded fixed-path strength equipment. `Smith` remains distinct because it changes substitution and equipment availability.
5. Cardio machines remain out until cardio modality names and time logging are ratified together.
6. An extension below is a Checkpoint C proposal, not authorization to edit the append-only chain.

## 1. No-pattern-only cohort (61)

| Movement | Proposed 8-pattern category | Basis |
|---|---|---|
| Advanced Kettlebell Windmill | core | Trunk flexion, rotation, or stability is the dominant job. |
| Air Bike | core | This source name is a bicycle crunch, not an air-bike ergometer. |
| Alternate Heel Touchers | core | Trunk flexion, rotation, or stability is the dominant job. |
| Barbell Side Bend | core | Trunk flexion, rotation, or stability is the dominant job. |
| Bottoms Up | core | Trunk flexion, rotation, or stability is the dominant job. |
| Butt-Ups | core | Trunk flexion, rotation, or stability is the dominant job. |
| Cable Judo Flip | core | Trunk flexion, rotation, or stability is the dominant job. |
| Cocoons | core | Trunk flexion, rotation, or stability is the dominant job. |
| Double Kettlebell Windmill | core | Trunk flexion, rotation, or stability is the dominant job. |
| Dumbbell Side Bend | core | Trunk flexion, rotation, or stability is the dominant job. |
| Elbow to Knee | core | Trunk flexion, rotation, or stability is the dominant job. |
| Flutter Kicks | core | Trunk flexion, rotation, or stability is the dominant job. |
| Hanging Pike | core | Trunk flexion, rotation, or stability is the dominant job. |
| Isometric Wipers | core | Trunk flexion, rotation, or stability is the dominant job. |
| Kettlebell Figure 8 | core | The source assigns abdominals primary; the hip hinge is setup. |
| Kettlebell Pass Between The Legs | core | The source assigns abdominals primary; the pass is rotational trunk work. |
| Kettlebell Windmill | core | Trunk flexion, rotation, or stability is the dominant job. |
| Landmine 180's | core | Trunk flexion, rotation, or stability is the dominant job. |
| Leg Lift | core | Trunk flexion, rotation, or stability is the dominant job. |
| Leg Pull-In | core | Trunk flexion, rotation, or stability is the dominant job. |
| Seated Barbell Twist | core | Trunk flexion, rotation, or stability is the dominant job. |
| Seated Leg Tucks | core | Trunk flexion, rotation, or stability is the dominant job. |
| Side Bridge | core | Trunk flexion, rotation, or stability is the dominant job. |
| Side Jackknife | core | Trunk flexion, rotation, or stability is the dominant job. |
| Spell Caster | core | Trunk flexion, rotation, or stability is the dominant job. |
| Spider Crawl | core | Trunk flexion, rotation, or stability is the dominant job. |
| Standing Cable Lift | core | Trunk flexion, rotation, or stability is the dominant job. |
| Standing Cable Wood Chop | core | Trunk flexion, rotation, or stability is the dominant job. |
| Around The Worlds | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Body-Up | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Cable Crossover | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Cable Iron Cross | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Cross Over - With Bands | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Double Kettlebell Jerk | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Iron Cross | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Kettlebell Pirate Ships | push | Shoulder-driven rotational swing; source force is push and shoulders are primary. |
| Kettlebell Thruster | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Landmine Linear Jammer | push | Leg drive feeds a forward press; classify by the loaded upper-body projection. |
| Low Cable Crossover | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Two-Arm Kettlebell Jerk | push | Press, fly, jerk, or shoulder-driven projection is dominant. |
| Butt Lift (Bridge) | hinge | Hip extension/posterior-chain action is dominant. |
| Hip Lift with Band | hinge | Hip extension/posterior-chain action is dominant. |
| Kettlebell Sumo High Pull | hinge | Hip and knee extension initiate the pull, so hinge is the dominant engine pattern. |
| Rack Pull with Bands | hinge | Hip extension/posterior-chain action is dominant. |
| Rack Pulls | hinge | Hip extension/posterior-chain action is dominant. |
| Band Hip Adductions | accessory | Single-joint or small-muscle assistance work. |
| Band Skull Crusher | accessory | Single-joint or small-muscle assistance work. |
| Bent Over Low-Pulley Side Lateral | accessory | Single-joint or small-muscle assistance work. |
| Cable Hip Adduction | accessory | Single-joint or small-muscle assistance work. |
| Car Drivers | accessory | Single-joint or small-muscle assistance work. |
| Dumbbell Lying Pronation | accessory | Single-joint or small-muscle assistance work. |
| Dumbbell Lying Supination | accessory | Single-joint or small-muscle assistance work. |
| Dumbbell Scaption | accessory | Single-joint or small-muscle assistance work. |
| EZ-Bar Skullcrusher | accessory | Single-joint or small-muscle assistance work. |
| Glute Kickback | accessory | Single-joint or small-muscle assistance work. |
| Hip Flexion with Band | accessory | Single-joint or small-muscle assistance work. |
| Monster Walk | accessory | Single-joint or small-muscle assistance work. |
| Power Partials | accessory | Single-joint or small-muscle assistance work. |
| Prone Manual Hamstring | accessory | Manual-resistance hamstring isolation, not a stretching record. |
| Tricep Dumbbell Kickback | accessory | Single-joint or small-muscle assistance work. |
| Wind Sprints | cardio | Running interval; no strength pattern is more honest. |

Distribution: core 28; push 12; accessory 15; hinge 5; cardio 1; row/squat/unilateral 0. Total 61.

## 2. Machine-only cohort (65)

Recommendation: add exactly two strength-equipment tokens (`Machine`, `Smith`) if Francis accepts machine scope. Do not use either token as a generic bucket for treadmills, bikes, rowers, ellipticals, or stair machines.

| Movement | Disposition | 8-pattern category |
|---|---|---|
| Ab Crunch Machine | EXTEND: Machine | core |
| Bicycling, Stationary | KEEP OUT: cardio modality | cardio |
| Butterfly | EXTEND: Machine | push |
| Calf Press | EXTEND: Machine | accessory |
| Calf Press On The Leg Press Machine | EXTEND: Machine | accessory |
| Calf-Machine Shoulder Shrug | EXTEND: Machine | row |
| Chair Squat | EXTEND: Machine | squat |
| Decline Smith Press | EXTEND: Smith | push |
| Dip Machine | EXTEND: Machine | push |
| Elliptical Trainer | KEEP OUT: cardio modality | cardio |
| Glute Ham Raise | EXTEND: Machine | hinge |
| Hack Squat | EXTEND: Machine | squat |
| Jogging, Treadmill | KEEP OUT: cardio modality | cardio |
| Leg Extensions | EXTEND: Machine | accessory |
| Leg Press | EXTEND: Machine | squat |
| Leverage Chest Press | EXTEND: Machine | push |
| Leverage Deadlift | EXTEND: Machine | hinge |
| Leverage Decline Chest Press | EXTEND: Machine | push |
| Leverage High Row | EXTEND: Machine | row |
| Leverage Incline Chest Press | EXTEND: Machine | push |
| Leverage Iso Row | EXTEND: Machine | row |
| Leverage Shoulder Press | EXTEND: Machine | push |
| Leverage Shrug | EXTEND: Machine | row |
| Lunge Sprint | EXTEND: Machine | unilateral |
| Lying Leg Curls | EXTEND: Machine | accessory |
| Lying Machine Squat | EXTEND: Machine | squat |
| Lying T-Bar Row | EXTEND: Machine | row |
| Machine Bench Press | EXTEND: Machine | push |
| Machine Bicep Curl | EXTEND: Machine | accessory |
| Machine Preacher Curls | EXTEND: Machine | accessory |
| Machine Shoulder (Military) Press | EXTEND: Machine | push |
| Machine Triceps Extension | EXTEND: Machine | accessory |
| Narrow Stance Hack Squats | EXTEND: Machine | squat |
| Narrow Stance Leg Press | EXTEND: Machine | squat |
| Recumbent Bike | KEEP OUT: cardio modality | cardio |
| Reverse Hyperextension | EXTEND: Machine | hinge |
| Reverse Machine Flyes | EXTEND: Machine | accessory |
| Rowing, Stationary | KEEP OUT: cardio modality | cardio |
| Running, Treadmill | KEEP OUT: cardio modality | cardio |
| Seated Calf Raise | EXTEND: Machine | accessory |
| Seated Leg Curl | EXTEND: Machine | accessory |
| Single-Leg Leg Extension | EXTEND: Machine | unilateral |
| Smith Machine Behind the Back Shrug | EXTEND: Smith | row |
| Smith Machine Bench Press | EXTEND: Smith | push |
| Smith Machine Bent Over Row | EXTEND: Smith | row |
| Smith Machine Calf Raise | EXTEND: Smith | accessory |
| Smith Machine Close-Grip Bench Press | EXTEND: Smith | push |
| Smith Machine Decline Press | EXTEND: Smith | push |
| Smith Machine Hang Power Clean | EXTEND: Smith | hinge |
| Smith Machine Hip Raise | EXTEND: Smith | hinge |
| Smith Machine Incline Bench Press | EXTEND: Smith | push |
| Smith Machine Leg Press | EXTEND: Smith | squat |
| Smith Machine One-Arm Upright Row | EXTEND: Smith | unilateral |
| Smith Machine Overhead Shoulder Press | EXTEND: Smith | push |
| Smith Machine Pistol Squat | EXTEND: Smith | unilateral |
| Smith Machine Reverse Calf Raises | EXTEND: Smith | accessory |
| Smith Machine Squat | EXTEND: Smith | squat |
| Smith Machine Stiff-Legged Deadlift | EXTEND: Smith | hinge |
| Smith Machine Upright Row | EXTEND: Smith | row |
| Smith Single-Leg Split Squat | EXTEND: Smith | unilateral |
| Stairmaster | KEEP OUT: cardio modality | cardio |
| Standing Calf Raises | EXTEND: Machine | accessory |
| Standing Leg Curl | EXTEND: Machine | accessory |
| Step Mill | KEEP OUT: cardio modality | cardio |
| Walking, Treadmill | KEEP OUT: cardio modality | cardio |

Reconciliation: Machine extension 37; Smith extension 19; cardio keep-out 9. Total 65.

## 3. Other-equipment-only cohort (40)

Recommendation: the strongest reusable extension case is six tokens: `Ab Wheel`, `Jump Rope`, `Plate`, `Sled`, `Suspension`, and `Trap Bar`. Do not add a generic `Other` token; it would make equipment filtering and substitutions dishonest.

| Movement | Disposition | 8-pattern category | Reason |
|---|---|---|---|
| Ab Roller | EXTEND: Ab Wheel | core | Distinct, honest implement; one useful staple. |
| Band Assisted Pull-Up | REMAP: Banded | row | Existing token is sufficient. |
| Bicycling | KEEP OUT | cardio | A modality, not an implement; wait for cardio scope. |
| Bodyweight Mid Row | REMAP: Bodyweight | row | Existing token is sufficient. |
| Chain Handle Extension | KEEP OUT | accessory | Do not conflate a chain implement with the existing Chains condition. |
| Chain Press | KEEP OUT | push | Do not conflate a chain implement with the existing Chains condition. |
| Dips - Chest Version | KEEP OUT: duplicate | push | Would split history from the shipped Dip identity. |
| Donkey Calf Raises | REMAP: Bodyweight | accessory | Existing token is sufficient. |
| Front Plate Raise | EXTEND: Plate | accessory | Plate is the actual implement. |
| Hyperextensions (Back Extensions) | REMAP: Bodyweight | hinge | Existing token is sufficient; apparatus can be an equipment requirement. |
| Inverted Row with Straps | EXTEND: Suspension | row | Reusable token for rings/straps/suspension trainers. |
| Knee/Hip Raise On Parallel Bars | REMAP: Bodyweight | core | Existing token is sufficient; bars are an equipment requirement. |
| Lying Face Down Plate Neck Resistance | EXTEND: Plate | accessory | Plate is the actual implement. |
| Lying Face Up Plate Neck Resistance | EXTEND: Plate | accessory | Plate is the actual implement. |
| One Arm Chin-Up | REMAP: Bodyweight | unilateral | Existing token is sufficient. |
| Parallel Bar Dip | KEEP OUT: duplicate | push | Would split history from the shipped Dip identity. |
| Prowler Sprint | EXTEND: Sled | cardio | Reusable token for loaded sled locomotion. |
| Reverse Plate Curls | EXTEND: Plate | accessory | Plate is the actual implement. |
| Ring Dips | EXTEND: Suspension | push | Rings materially change stability and equipment. |
| Rocky Pull-Ups/Pulldowns | KEEP OUT: duplicate | row | Pull-up identity is already shipped; this name is not a clean new identity. |
| Rope Jumping | EXTEND: Jump Rope | cardio | Honest implement and distinct time-based modality. |
| Seated Band Hamstring Curl | REMAP: Banded | accessory | Existing token is sufficient. |
| Seated Head Harness Neck Resistance | KEEP OUT | accessory | One-off token cost is not justified in this pass. |
| Single-Leg High Box Squat | REMAP: Bodyweight | unilateral | Existing token plus box/bench equipment requirement is sufficient. |
| Skating | KEEP OUT | cardio | A modality, not an implement; wait for cardio scope. |
| Sled Overhead Backward Walk | EXTEND: Sled | cardio | Reusable token for loaded sled locomotion. |
| Sled Overhead Triceps Extension | EXTEND: Sled | accessory | Sled is the resistance implement. |
| Sled Reverse Flye | EXTEND: Sled | accessory | Sled is the resistance implement. |
| Sled Row | EXTEND: Sled | row | Sled is the resistance implement. |
| Suspended Push-Up | EXTEND: Suspension | push | Reusable token for rings/straps/suspension trainers. |
| Suspended Reverse Crunch | EXTEND: Suspension | core | Reusable token for rings/straps/suspension trainers. |
| Suspended Row | EXTEND: Suspension | row | Reusable token for rings/straps/suspension trainers. |
| Suspended Split Squat | EXTEND: Suspension | unilateral | Reusable token for rings/straps/suspension trainers. |
| Svend Press | EXTEND: Plate | push | Plate is the actual implement. |
| Trap Bar Deadlift | EXTEND: Trap Bar | hinge | Material equipment distinction from a straight barbell. |
| Weighted Bench Dip | KEEP OUT: duplicate | push | The shipped Bench Dip should own weighted progression. |
| Weighted Pull Ups | KEEP OUT: duplicate | row | The shipped Pull-Up should own weighted progression. |
| Weighted Sit-Ups - With Bands | REMAP: Banded | core | The name identifies bands; existing token is sufficient. |
| Weighted Squat | KEEP OUT | squat | Load implement is unspecified, so a prefix would be invented. |
| Wrist Roller | KEEP OUT | accessory | One-off token cost is not justified in this pass. |

Reconciliation: extension case 19; remap to existing vocabulary 9; keep-out 12. Total 40.

## 4. Staged category corrections observed during curation

These are high-confidence classifier collisions, not a request to rewrite the import algorithm in WO-4. `Unilateral` remains valid where one-sided loading is the browse intent; it is changed below only when the primary movement is unambiguously trunk work.

| Movement | Current | Proposed | State | Reason / required handling |
|---|---|---|---|---|
| Back Flyes - With Bands | push | accessory | Uncurated | Rear-delt isolation; fly keyword caused a false chest-push match. |
| Barbell Rollout from Bench | push | core | Uncurated | Rollout is trunk anti-extension; bench keyword caused the collision. |
| Bent Over Dumbbell Rear Delt Raise With Head On Bench | push | accessory | Uncurated | Rear-delt isolation; bench keyword caused the collision. |
| Cable Incline Pushdown | push | row | Uncurated | Source primary muscle is lats; this is a straight-arm pull, not a triceps press. |
| Cable Rear Delt Fly | push | accessory | Uncurated | Rear-delt isolation, not a chest fly. |
| Cable Rope Overhead Triceps Extension | push | accessory | Curated + seeded | Single-joint elbow extension; requires an append-only corrective migration after ratification. |
| Crunch - Hands Overhead | push | core | Uncurated | Crunch is trunk flexion; overhead keyword caused the collision. |
| Front Squat (Clean Grip) | hinge | squat | Uncurated | The exercise is a squat; clean describes the grip. |
| Lying Triceps Press | push | accessory | Uncurated | Single-joint elbow extension. |
| One-Arm High-Pulley Cable Side Bends | unilateral | core | Uncurated | Primary action is loaded lateral trunk flexion. |
| Reverse Flyes | push | accessory | Uncurated | Rear-delt isolation, not a chest fly. |
| Reverse Flyes With External Rotation | push | accessory | Uncurated | Rear-delt/rotator-cuff isolation, not a chest fly. |
| Reverse Grip Triceps Pushdown | push | accessory | Uncurated | Single-joint elbow extension. |
| Seated Triceps Press | push | accessory | Uncurated | Single-joint elbow extension. |
| Speed Band Overhead Triceps | push | accessory | Uncurated | Single-joint elbow extension. |
| Standing Overhead Barbell Triceps Extension | push | accessory | Uncurated | Single-joint elbow extension. |
| Triceps Overhead Extension with Rope | push | accessory | Uncurated | Single-joint elbow extension. |
| Triceps Pushdown | push | accessory | Curated + seeded | Single-joint elbow extension; requires an append-only corrective migration after ratification. |
| Triceps Pushdown - Rope Attachment | push | accessory | Uncurated | Single-joint elbow extension. |
| Triceps Pushdown - V-Bar Attachment | push | accessory | Uncurated | Single-joint elbow extension. |

The 18 unseeded fixes can be applied in a later staging WO after Checkpoint C. The two seeded fixes (`Cable Rope Overhead Triceps Extension`, `Triceps Pushdown`) require a new additive corrective migration plus verifier updates; editing their shipped slots is prohibited.

## 5. Checkpoint C decisions - RATIFIED ALL

Fable completed the taxonomy sanity check and Francis ratified all five decisions:

1. The 61 existing-pattern calls, including the composite calls noted above.
2. The `Machine` + `Smith` vocabulary extension and continued exclusion of nine cardio-machine records.
3. The six-token other-equipment extension bundle (`Ab Wheel`, `Jump Rope`, `Plate`, `Sled`, `Suspension`, `Trap Bar`).
4. The nine existing-token remaps and twelve keep-out decisions.
5. The 20 staging corrections, with separate additive handling for the two already seeded records.

Ratification authorizes these proposals as future implementation scope; it does not silently mutate staging or the append-only migration chain. The 18 unseeded category fixes belong in the next approved staging pass. The two seeded category fixes require a new additive corrective migration. Equipment-token extensions require their own implementation work order with migration, store, UI, substitution, and verifier coverage.

Stretching, plyometrics, Olympic weightlifting, strongman, medicine-ball, exercise-ball, and foam-roll scope remain outside this WO and retain their prior open/keep-out status.

## Stop condition

WO-4 is complete at approved Checkpoint C. No staging edit, migration, verifier edit, WO-5 work, or release-readiness claim is included.
