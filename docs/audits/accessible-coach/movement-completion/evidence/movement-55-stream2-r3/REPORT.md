# MOV-S2-R3: stream 2's audits of A12, A09-R1 and A15

- Order: `MOV-S2-R3`, evidence folder `movement-55-stream2-r3`
- Branch: `movement/55-stream2-r3-2026-10-18`
- Base: `921bbe14fddcc0065cd741cd86278ecc08d481df`
- Source commit: `ab6f3877ce75ebba62719d3f0a166b148f536008`
- Movements changed (`allowedChanged`): 233, 47, 188, 241, 205, 242, 215, 250, 166, 195, 296, 145, 153. No others (probe: "changed, NOT expected: none"; all 13 listed as changed, expected).
- Signed: builder

## What was inherited

The worktree held uncommitted test updates for this order (A09, A12, A15) and
partial drawing edits: 47 (dip balance), 195 (feet forward), 145 (hips
higher), the 188/241 dumbbell close-up drawn along its projected handle, a
hanging-kettlebell close-up branch, an upright bar close-up branch, close-up
panels on 242, 215, 233 and 250, and the 233 head raised onto the pad. At that
point 32 of 41 focused tests passed. I kept those edits, checked them against
the tests and the renders, and finished the rest. No test bound was loosened.

## Majors

**233 Kneeling Cable Triceps Extension: the head rests on the pad.** The
painted underside of the head ring (centre y less r + strokeWidth / 2) is
0.14 above the pad top at every 33 ms tick (bound: 0 to 0.5), the head centre
(70.38, 32.09) over the pad. With the head up there, the bar at the bent-elbow
start sat 6.49 from the head centre and the cable from the pulley passed
inside the head at full extension. Two changes, both physical:

- The bar now sits in the hand, 4 units beyond the wrist along the forearm
  (pose `hand` = the forearm direction), as a bar held in the palm does. The
  bar-to-head clearance on screen is now 9.87 at its closest (bound 7.0); the
  start elbow is still 77 degrees (bound 85 or less).
- The pulley is raised from y = 78 to 86 (frame to 92) so the cable passes
  over the head: closest 7.77 to the head centre (bound more than 6.9).

**47 Dip: balanced over the hands.** The centre of mass of head, trunk, arms
and legs (Winter fractions) stays within 1.10 of the hands fore and aft at
every tick (bound 2.0): at the bottom the trunk leans to 71 degrees and the
hips and bent legs swing back to match.

**188 and 241: the close-up draws the handle where it points.** With the
palms toward the torso the projected handle direction is 0.31 across, so the
drawn shaft is 5.4 x 0.31 = 1.67 each side, nearly end on, horizontal, with
both plates drawn face on (wider than 5.5). The test checks the drawn shaft,
not only the palm number.

**205 Front Barbell Squat To A Bench: balanced over the feet at the touch.**
The bottom hip is moved from 10.8 to 6.8 behind the ankle with the trunk at 71
degrees; the knees travel 12.9 ahead of the ankles (knee 60.7 degrees at the
touch). At every tick the bar is within 0.49 of the mid-foot and the centre of
mass of body and bar (a quarter body mass in each hand) within 1.39 (bounds
2.0 each). The bench is moved up so its edge (x = -5) is under the glutes at
the light touch; the hip still meets its top (glutes on the bench at y 20.2).

## Minors

- **Grip close-ups.** 242, 215 and 233 show palm yaw 0, palm toward the
  viewer: a light palm behind a bar more than 6 across with four fingers
  wrapped over it, at every tick. When the hand turns down (242 at the
  forehead, 215 behind the head) a new branch draws the same grip turned over,
  only when the palm faces the viewer, so 296's palm-from-back close-up is
  unchanged. 250's close-up stays on the working hand (new `closeUp.hand:
  'near'`; before, the higher free hand took the panel): palm yaw 180, back of
  the hand toward the viewer, handle across with the bell under it.
- **166 Clock Push-Up: one way round.** One hop: start, lower, flight, land
  16 degrees round, reset. The loop then returns to the start on the floor
  through a pose with the elbows a little soft (at least 130 degrees), so the
  hands are never stretched past the arm's length on the way back; exactly one
  flight per loop. The flight now lifts the wrists 9.05 above the floor
  position (bound 7.5; was 6.05). The caption "travel back" is gone; the
  return frame reads "Repeat the hop a step further round each time, working
  around the circle until you are back where you started." Seven frames.
- **195 Elevated Cable Rows:** knees 164.9 degrees (bound 158 to 172).
- **296 Upright Cable Row:** at the top the hands are 0.80 below the chin
  (bound 0 to 2.5) with the elbows open to 36.2 degrees (bound 35) and 6.45
  above the wrists.
- **145 Bent Over Two-Arm Long Bar Row:** knees 154.1 degrees, about 26 of
  bend (bound 148 to 162).
- **153 Box Squat with Bands:** stance 20.8 against a shoulder span of 18.77,
  1.11 times (bound 0.95 to 1.25). The narrower stance needed the standing hip
  raised to 46.43 to keep the standing knee straight (174.7, bound 172) without
  stretching the leg past its length.
- **250 One-Arm Kettlebell Swings:** hike knee 156.0 degrees (bound 148 to
  162); the hip is raised to 44.7 and the arm swung to -135 degrees so the bell
  stays between the thighs.

## One test outside the three files

`MovementPreview.fingerCurls.test.js` lists every movement allowed a
close-up. The four new panels (242, 215, 233, 250) are added to that list;
the list still rejects any other.

## Gates on the source commit

- typecheck 0; MovementPreview jest 65 of 65 suites, 3728 of 3728 tests;
  storage guard 0; evidence gate 0; rendered-output probe 0, nothing outside
  the 13 changed, no overflow.
- `MovementPreview.test.js` "the push-up drawing sits in the middle of its
  box" timed out (5 s) in one earlier gate run on a loaded machine. It is the
  file's first real render (about 6 s cold); it times out the same way on the
  base commit `921bbe14`, so it is not from this change, and it passed in this
  gate run. That file is outside the batch's allowed paths and is unchanged.
- An earlier gate run lost its probe because the shell had path conversion
  turned off; this run was started with it on.
- 166 and 153 were adjusted after the first set of preview renders (the
  return pose, the flight height and the standing hip); the renders in this
  folder are from the source commit.

## Files

`typecheck.log`, `jest-movement-preview.log`, `storage-guard.log`,
`evidence-gate.log`, `rendered-output-probe.log`, `cycle_evidence.json`,
`movement-<id>/neutral-cycle.png` for the 13 movements, `quotes.json`
(27 bounds quoted word for word from the catalogue text, 38 file quotes from
the source commit), `SHA256SUMS`.
