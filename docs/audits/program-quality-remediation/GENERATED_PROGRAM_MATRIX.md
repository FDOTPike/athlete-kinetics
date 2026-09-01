# Generated-Program Acceptance Matrix (W7)

Produced by `matrix_harness.mjs` from the candidate code: the real 001-060
migration chain, the real capabilityResolver/tierPolicy/movementRanking/
blockGenerator modules, and the store's documented input mapping. Run:

    PROBE_CWD=<repo path> node matrix_harness.mjs

## Results: 14/14 PASS

- **PQ-01: PASS** — anchors in week 1: Competition Squat, Competition Bench, Deadlift
- **PQ-02: PASS** — no false anchors (0); loaded substitutes: Box Squat, Kettlebell Swing; disclosures: 3 (lower: Competition Squat unavailable for squat (capability); Box Squat planned instead)
- **PQ-03: PASS** — no confirmation: loaded default is Double Kettlebell Front Squat, Bodyweight 0; goblet prior experience confirmed: Goblet Squat 8x (the minimum loaded squat), Bodyweight 0
- **PQ-04: PASS** — capacity law: 2 anchor slots (<3); week carries 0/3 anchors (each absent anchor gate-disclosed, 2 warning(s), none silently dropped); setup UI discloses the conflict BEFORE create
- **PQ-05: PASS** — big-three occurrences: 0; balanced exposure: squat+push_h+pull_h across 2 lower / 2 upper days; dose roles distinct: primary 4 sets vs accessory 3 sets; accessory slots non-compound share: 50%; overload path: week-2 change named by the progression summary
- **PQ-06: PASS** — label: Athletic power; speed rungs used: Speed Box Squat, Double Kettlebell Push Press; Power Clean for intermediate: 0 (tier ceiling held); power slot 5x5@6.5 vs strength 4x8@7; explanation: "Power training builds explosive force: the same big lifts, moved fast, with full recovery between sets. The coach plans the speed-focused versions of the lifts and keeps the reps low so every rep stays sharp. All safety, equipment and experience gates still apply — olympic-lift competition movements are Advanced-tier and appear only when your training history supports them."
- **PQ-07: PASS** — week-1 focuses: lower, upper, full, conditioning (General athlete label)
- **PQ-08: PASS** — bjj sessions in block: 8; label: Strength + grappling (honest, not generic strength+engine)
- **PQ-09: PASS** — max target RPE across block: 6.5 (rehab cap 7.0); label: Return to training — no medical claim
- **PQ-10: PASS** — Bodyweight Squat occurrences: 8; equipment reason disclosed in 2 warning(s)
- **PQ-11: PASS** — squat-pattern slots selected after knee restriction: 0 (drop with warning, never re-admitted)
- **PQ-12: PASS** — actual bodyweight reps edited from target and logged exactly — SessionScreen.test.js "bodyweight actual reps initialize from the plan, edit, and reach logSet unchanged (PQ-12)"
- **PQ-13: PASS** — untouched RPE stored as null with informational cue — SessionScreen.test.js "untouched RPE stays null and shows its plain-language cue (PQ-13)" + verify_effort_cues.mjs
- **PQ-14: PASS** — anchors: Competition Squat, Competition Bench, Deadlift; Bodyweight Squat occurrences: 0

### PQ-01 — strength, intermediate, full gym, big-three prior experience confirmed

```
lower d1: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d2: Competition Bench 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
lower d4: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d6: Competition Bench 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-02 — strength, intermediate, full gym, no prior-experience confirmation

```
lower d1: Box Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d2: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
lower d4: Box Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d6: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
lower: Competition Squat unavailable for squat (capability); Box Squat planned instead
lower: Deadlift unavailable for hinge (capability); Kettlebell Swing planned instead
upper: Competition Bench unavailable for push_h (capability); Push-up planned instead
```


### PQ-03 — strength, intermediate, dumbbell/kettlebell only

```
lower d1: Double Kettlebell Front Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Dumbbell Lateral Raise 4x7@7
upper d2: Push-up 4x8@7 | One-Arm Kettlebell Row 4x7@7 | Dumbbell Shoulder Press 4x8@7
lower d4: Double Kettlebell Front Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Dumbbell Lateral Raise 4x7@7
upper d6: Push-up 4x8@7 | One-Arm Kettlebell Row 4x7@7 | Dumbbell Shoulder Press 4x8@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Double Kettlebell Front Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Lateral Raise: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
One-Arm Kettlebell Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Double Kettlebell Front Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Lateral Raise: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
One-Arm Kettlebell Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Double Kettlebell Front Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Lateral Raise: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
One-Arm Kettlebell Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Double Kettlebell Front Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Lateral Raise: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
One-Arm Kettlebell Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
lower: Competition Squat unavailable for squat (equipment/capability); Double Kettlebell Front Squat planned instead
lower: Deadlift unavailable for hinge (equipment/capability); Kettlebell Swing planned instead
upper: Competition Bench unavailable for push_h (equipment/capability); Push-up planned instead
upper: no equipment-available movement for pull_v
```


### PQ-05 — hypertrophy, intermediate, full gym

```
lower d1: Box Squat 4x12@7 | Kettlebell Swing 4x12@7 | Walking Lunge 3x12@7 | Band Pull-Apart 3x12@7
upper d2: Push-up 4x12@7 | Cable Row 4x12@7 | Dumbbell Shoulder Press 3x12@7 | Straight-Arm Pulldown 3x12@7
lower d4: Box Squat 4x12@7 | Kettlebell Swing 4x12@7 | Walking Lunge 3x12@7 | Band Pull-Apart 3x12@7
upper d6: Push-up 4x12@7 | Cable Row 4x12@7 | Dumbbell Shoulder Press 3x12@7 | Straight-Arm Pulldown 3x12@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-08 — hybrid, intermediate, full gym

```
lower d1: Box Squat 3x7@7 | Kettlebell Swing 3x7@7 | Walking Lunge 3x7@7 | Band Pull-Apart 3x7@7
bjj d2: BJJ Sparring Round 5x1@7 | Kettlebell Turkish Get-Up 4x7@7 | Nordic Curl 4x7@7
upper d4: Push-up 3x8@7 | Cable Row 3x7@7 | Dumbbell Shoulder Press 3x8@7 | Straight-Arm Pulldown 3x7@7
bjj d6: BJJ Sparring Round 5x1@7 | Kettlebell Turkish Get-Up 4x7@7 | Nordic Curl 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
BJJ Sparring Round: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Turkish Get-Up: same work at a higher target effort (RPE 7 -> 7.5).
Nordic Curl: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
BJJ Sparring Round: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Turkish Get-Up: same work at a higher target effort (RPE 7 -> 7.5).
Nordic Curl: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
BJJ Sparring Round: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Turkish Get-Up: deload — reduced effort (RPE 8 -> 6.5).
Nordic Curl: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
BJJ Sparring Round: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Turkish Get-Up: deload — reduced effort (RPE 8 -> 6.5).
Nordic Curl: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-10 — strength, intermediate, minimal equipment

```
lower d1: Bodyweight Squat 4x8@7 | Band Good Morning 4x7@7 | Walking Lunge 4x7@7
upper d3: Push-up 4x8@7 | Band Row 4x7@7 | Shoulder Press - With Bands 4x7@7
full d5: Bodyweight Squat 4x8@7 | Push-up 4x8@7 | Glute Bridge 4x8@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Bodyweight Squat: same reps plus a set (4x8 -> 5x8).
Band Good Morning: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Band Row: same work at a higher target effort (RPE 7 -> 7.5).
Shoulder Press - With Bands: same work at a higher target effort (RPE 7 -> 7.5).
Bodyweight Squat: same reps plus a set (4x8 -> 5x8).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Glute Bridge: same work at a higher target effort (RPE 7 -> 7.5).
Bodyweight Squat: deload — reduced effort (RPE 8 -> 6.5).
Band Good Morning: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Band Row: deload — reduced effort (RPE 8 -> 6.5).
Shoulder Press - With Bands: deload — reduced effort (RPE 8 -> 6.5).
Bodyweight Squat: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Glute Bridge: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
full: Bodyweight Squat planned — no loaded squat is available (blocked: equipment/tier/capability)
full: Competition Bench unavailable for push_h (equipment/capability); Push-up planned instead
full: Deadlift unavailable for hinge (equipment/capability); Glute Bridge planned instead
lower: Bodyweight Squat planned — no loaded squat is available (blocked: equipment/tier/capability)
lower: Deadlift unavailable for hinge (equipment/capability); Band Good Morning planned instead
upper: Competition Bench unavailable for push_h (equipment/capability); Push-up planned instead
```


### PQ-11 — strength, intermediate, full gym + active squat restriction

```
lower d1: Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d2: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
lower d4: Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band Pull-Apart 4x7@7
upper d6: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Straight-Arm Pulldown 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band Pull-Apart: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band Pull-Apart: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
lower: Deadlift unavailable for hinge (capability); Kettlebell Swing planned instead
lower: no capability-available movement for squat
upper: Competition Bench unavailable for push_h (capability); Push-up planned instead
```


### PQ-14 — strength, advanced, full gym

```
lower d1: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Nordic Curl 4x7@7
upper d2: Competition Bench 4x8@7 | Barbell Row 4x8@7 | Overhead Press 4x8@7 | Straight-Arm Pulldown 4x7@7
lower d4: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Nordic Curl 4x7@7
upper d6: Competition Bench 4x8@7 | Barbell Row 4x8@7 | Overhead Press 4x8@7 | Straight-Arm Pulldown 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Nordic Curl: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Row: same work at a higher target effort (RPE 7 -> 7.5).
Overhead Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Nordic Curl: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Row: same work at a higher target effort (RPE 7 -> 7.5).
Overhead Press: same work at a higher target effort (RPE 7 -> 7.5).
Straight-Arm Pulldown: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Nordic Curl: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Barbell Row: deload — reduced effort (RPE 8 -> 6.5).
Overhead Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Nordic Curl: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Barbell Row: deload — reduced effort (RPE 8 -> 6.5).
Overhead Press: deload — reduced effort (RPE 8 -> 6.5).
Straight-Arm Pulldown: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


## Notes and approximations

- Round 2 PQ-04: the case runs the REAL capacity law (strengthAnchorCapacity
  over squat/push_h/hinge slots after duration+focus shaping) AND the real
  generator at the shaped schedule, requiring capacity < 3, fewer than three
  anchors carried, and every absent anchor gate-disclosed. The setup UI
  warning (ProgramSetupScreen) is component-proven in
  ProgramQualityRound2.test.js against the same imported function.
- Round 2 PQ-05: semantic bodybuilding contract — zero big-three, balanced
  pattern exposure, primary>accessory dose-role separation (the named
  ROUND2_HYPERTROPHY_ROLE_SET_DELTA), and a named overload path via
  weeklyProgressionSummary.
- Round 2 PQ-06: semantic power contract — honest label, curated speed rungs
  preferred where gates admit them, Power Clean never prescribed to an
  intermediate (tier ceiling held), power-shaped reps vs the strength block,
  and the pure powerObjectiveExplanation copy rendered by the setup UI.
- PQ-11 approximates the store's niggle-to-exclusion law by excluding the
  squat PATTERN (a knee niggle maps to the knee joint, which squat-pattern
  movements stress); Reviewer B should reproduce via the store path.
- PQ-12/13 are component-proven in the jest suite; this harness does not
  duplicate UI behavior.
- Prior-experience confirmations (PQ-01) are injected as the athlete action
  the row names; no other evidence or attestation is granted.
