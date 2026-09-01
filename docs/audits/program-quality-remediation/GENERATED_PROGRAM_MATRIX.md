# Generated-Program Acceptance Matrix (W7)

Produced by `matrix_harness.mjs` from the candidate code: the real 001-060
migration chain, the real capabilityResolver/tierPolicy/movementRanking/
blockGenerator modules, and the store's documented input mapping. Run:

    PROBE_CWD=<repo path> node matrix_harness.mjs

## Results: 14/14 PASS

- **PQ-01: PASS** — anchors in week 1: Competition Squat, Competition Bench, Deadlift
- **PQ-02: PASS** — no false anchors (0); loaded substitutes: Box Squat, Kettlebell Swing; disclosures: 3 (lower: Competition Squat unavailable for squat (capability); Box Squat planned instead)
- **PQ-03: PASS** — no confirmation: loaded default is Double Kettlebell Front Squat, Bodyweight 0; goblet prior experience confirmed: Goblet Squat 8x (the minimum loaded squat), Bodyweight 0
- **PQ-04: PASS** — 1 session/week => capacity conflict disclosed BEFORE create (strengthCapacityShort=true), reduced-anchor choice offered
- **PQ-05: PASS** — big-three occurrences: 0; lower days: 8, upper days: 8 (Bodybuilding label)
- **PQ-06: PASS** — power 5x5@6.5 vs strength 4x8@7 (macro gpp +2 reps; strength hits the ratified chain rep floor of 8 on Competition Squat); label: Athletic power
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
lower d1: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d2: Competition Bench 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
lower d4: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d6: Competition Bench 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-02 — strength, intermediate, full gym, no prior-experience confirmation

```
lower d1: Box Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d2: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
lower d4: Box Squat 4x7@7 | Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d6: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
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
lower d1: Box Squat 4x12@7 | Kettlebell Swing 4x12@7 | Walking Lunge 4x12@7 | Band External Rotation 4x12@7
upper d2: Push-up 4x12@7 | Cable Row 4x12@7 | Dumbbell Shoulder Press 4x12@7 | Chin-up 4x12@7
lower d4: Box Squat 4x12@7 | Kettlebell Swing 4x12@7 | Walking Lunge 4x12@7 | Band External Rotation 4x12@7
upper d6: Push-up 4x12@7 | Cable Row 4x12@7 | Dumbbell Shoulder Press 4x12@7 | Chin-up 4x12@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-08 — hybrid, intermediate, full gym

```
lower d1: Box Squat 3x7@7 | Kettlebell Swing 3x7@7 | Walking Lunge 3x7@7 | Band External Rotation 3x7@7
bjj d2: Road Run 5x1@7 | Barbell Rollout from Bench 4x7@7 | Band External Rotation 4x7@7
upper d4: Push-up 3x8@7 | Cable Row 3x7@7 | Dumbbell Shoulder Press 3x8@7 | Chin-up 3x7@7
bjj d6: Road Run 5x1@7 | Barbell Rollout from Bench 4x7@7 | Band External Rotation 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Box Squat: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Road Run: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Rollout from Bench: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Road Run: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Rollout from Bench: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Box Squat: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Road Run: deload — reduced effort (RPE 8 -> 6.5).
Barbell Rollout from Bench: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
Road Run: deload — reduced effort (RPE 8 -> 6.5).
Barbell Rollout from Bench: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


### PQ-10 — strength, intermediate, minimal equipment

```
lower d1: Bodyweight Squat 4x8@7 | Band Good Morning 4x7@7 | Walking Lunge 4x7@7
upper d3: Push-up 4x8@7 | Band Row 4x7@7 | Shoulder Press - With Bands 4x7@7
full d5: Bodyweight Squat 4x8@7 | Push-up 4x8@7 | Band Good Morning 4x7@7
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
Band Good Morning: same work at a higher target effort (RPE 7 -> 7.5).
Bodyweight Squat: deload — reduced effort (RPE 8 -> 6.5).
Band Good Morning: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Band Row: deload — reduced effort (RPE 8 -> 6.5).
Shoulder Press - With Bands: deload — reduced effort (RPE 8 -> 6.5).
Bodyweight Squat: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Band Good Morning: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
full: Bodyweight Squat planned — no loaded squat is available (blocked: equipment/tier/capability)
full: Competition Bench unavailable for push_h (equipment/capability); Push-up planned instead
full: Deadlift unavailable for hinge (equipment/capability); Band Good Morning planned instead
lower: Bodyweight Squat planned — no loaded squat is available (blocked: equipment/tier/capability)
lower: Deadlift unavailable for hinge (equipment/capability); Band Good Morning planned instead
upper: Competition Bench unavailable for push_h (equipment/capability); Push-up planned instead
```


### PQ-11 — strength, intermediate, full gym + active squat restriction

```
lower d1: Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d2: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
lower d4: Kettlebell Swing 4x7@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d6: Push-up 4x8@7 | Cable Row 4x7@7 | Dumbbell Shoulder Press 4x8@7 | Chin-up 4x7@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Push-up: same work at a higher target effort (RPE 7 -> 7.5).
Cable Row: same work at a higher target effort (RPE 7 -> 7.5).
Dumbbell Shoulder Press: same work at a higher target effort (RPE 7 -> 7.5).
Chin-up: same work at a higher target effort (RPE 7 -> 7.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
Kettlebell Swing: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Push-up: deload — reduced effort (RPE 8 -> 6.5).
Cable Row: deload — reduced effort (RPE 8 -> 6.5).
Dumbbell Shoulder Press: deload — reduced effort (RPE 8 -> 6.5).
Chin-up: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
lower: Deadlift unavailable for hinge (capability); Kettlebell Swing planned instead
lower: no capability-available movement for squat
upper: Competition Bench unavailable for push_h (capability); Push-up planned instead
```


### PQ-14 — strength, advanced, full gym

```
lower d1: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d2: Competition Bench 4x8@7 | Barbell Row 4x8@7 | Overhead Press 4x8@7 | Weighted Pull-up 4x8@7
lower d4: Competition Squat 4x8@7 | Deadlift 4x8@7 | Walking Lunge 4x7@7 | Band External Rotation 4x7@7
upper d6: Competition Bench 4x8@7 | Barbell Row 4x8@7 | Overhead Press 4x8@7 | Weighted Pull-up 4x8@7
```

Weekly progression (weeks 1->2 and 3->4):

```
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Row: same work at a higher target effort (RPE 7 -> 7.5).
Overhead Press: same work at a higher target effort (RPE 7 -> 7.5).
Weighted Pull-up: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: same work at a higher target effort (RPE 7 -> 7.5).
Deadlift: same work at a higher target effort (RPE 7 -> 7.5).
Walking Lunge: same work at a higher target effort (RPE 7 -> 7.5).
Band External Rotation: same work at a higher target effort (RPE 7 -> 7.5).
Competition Bench: same work at a higher target effort (RPE 7 -> 7.5).
Barbell Row: same work at a higher target effort (RPE 7 -> 7.5).
Overhead Press: same work at a higher target effort (RPE 7 -> 7.5).
Weighted Pull-up: same work at a higher target effort (RPE 7 -> 7.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Barbell Row: deload — reduced effort (RPE 8 -> 6.5).
Overhead Press: deload — reduced effort (RPE 8 -> 6.5).
Weighted Pull-up: deload — reduced effort (RPE 8 -> 6.5).
Competition Squat: deload — reduced effort (RPE 8 -> 6.5).
Deadlift: deload — reduced effort (RPE 8 -> 6.5).
Walking Lunge: deload — reduced effort (RPE 8 -> 6.5).
Band External Rotation: deload — reduced effort (RPE 8 -> 6.5).
Competition Bench: deload — reduced effort (RPE 8 -> 6.5).
Barbell Row: deload — reduced effort (RPE 8 -> 6.5).
Overhead Press: deload — reduced effort (RPE 8 -> 6.5).
Weighted Pull-up: deload — reduced effort (RPE 8 -> 6.5).
```

Warnings:

```
(none)
```


## Notes and approximations

- PQ-04 is disclosed at the setup surface: the harness mirrors
  `ProgramSetupScreen.strengthCapacityShort` (days < 3) rather than driving UI.
- PQ-11 approximates the store's niggle-to-exclusion law by excluding the
  squat PATTERN (a knee niggle maps to the knee joint, which squat-pattern
  movements stress); Reviewer B should reproduce via the store path.
- PQ-12/13 are component-proven in the jest suite; this harness does not
  duplicate UI behavior.
- Prior-experience confirmations (PQ-01) are injected as the athlete action
  the row names; no other evidence or attestation is granted.
