# MOV-A06-R2: rack elbows, the overhead press bar, and the Arnold palm

- Order: `MOV-A06-R2`, evidence folder `movement-35-overhead-presses-r2`
- Branch: `movement/54-overhead-presses-repairs-r2-2026-10-18`
- Base: `5372aab29417d09540fa8ff9ff4f53dc9a6c8bcd`
- Source commit: `57946c15bebd138fbb39e8468caf5cabfb4fbce2`
- Movements changed (`allowedChanged`): 4, 31, 41, 129, 189, 228, 230. No others (probe: "changed, NOT expected: none").
- Signed: builder

## What was inherited

A previous builder left uncommitted changes. I read them and discarded the
drawing changes and the test edits, keeping only the shape of the new
joint-limits test file:

- Its rack poses reached 31 to 36 degrees by flaring the elbows out to the side
  (wrists 6.75 to 7.17 units outboard of the shoulders), against "Elbows tight"
  for 31; with them 31 and 41 also failed their own shoulder-height bound
  (hold 2.22 and 2.80 above the shoulder against the 2.0 allowed).
- For 4 it tilted the head back 42 to 50 degrees and cut the bar's drawn
  sleeves to 1.4 units so the drawn bar would miss the head. A sleeve that
  short is not a barbell; at a 6.5 degree turn a real sleeve projects about
  4.2 units, and the drawn bar then crosses the head again.
- It loosened the "bar across the front shoulders" bound from 4.0 to 4.5.

## The rack elbows (major, all seven)

Smallest internal elbow angle at any 33 ms tick, and the smallest distance
from the wrist to the upper-arm centreline (painted radii sum 3.84):

| id | before | now | wrist clearance now |
| --- | --- | --- | --- |
| 4 | 22.4 | 33.9 both arms | 6.69 |
| 31 | 8.5 | 35.4 both arms | 6.95 |
| 41 | 22.8 | 40.4 (free arm 158.5) | 7.78 |
| 129 | 14.3 | 35.9 both arms | 7.03 |
| 189 | 22.0 | 41.0 (free arm 158.5) | 7.87 |
| 228 | 14.3 | 35.9 (free arm 158.5) | 7.03 |
| 230 | 14.3 | 35.9 both arms | 7.03 |

What each text sets is kept:

- Shoulder height (hold within 2.0 of the shoulder): 31 +0.71, 41 +1.34,
  129, 228 and 230 +0.96, 189 +1.40; for 4 the bar is within 1.5 of the neck (+1.30).
- 31 "Elbows tight": elbows 5.66 in front of the shoulders and 0.87 inside
  them; forearms 10 degrees forward of vertical, dumbbells 7.74 in front of
  the shoulders at chin level.
- 129, 228, 230: elbows 4.65 in front of and 3.86 outside the shoulder joint,
  forearms within 6 degrees of vertical, palm in (yaw 90); the bell sits at
  the front of the shoulder. A rack with the elbow inside the shoulder line
  measured at most 33 degrees and drew the near bell over the chest, under
  the head, at this 34 degree turn, so I chose this one.
- 189 and 41: the upper arm 33 degrees out from the side, forearm 8 degrees
  out from vertical, so 189's press stays straight up (start and top hold x
  equal).
- 230 equal counts, 129 waiting bell, palms, timings, captions: unchanged.

### A bound I replaced, and why

The old universal test held each hand's load within 2.0 of mid-foot at every
tick. With the shoulders over mid-foot, that allows a hand at most 2.0 in
front of the shoulder, and a rack at shoulder height then cannot open past
about 25 degrees without flaring the wrists out sideways. That bound was the
reason the elbows were folded. The physics rule is that the centre of mass of
body and load stays over the base, so the test now computes it: Winter's
segment mass fractions on the world joints, plus 0 or 0.25 body mass in each
hand (the two ends of that range bound every load in it), inside the painted
feet (ankle to toe, out to the sole's rounded ends: x from -2.16 to 7.56).
Measured range with the heavy load: 4 1.15 to 2.58, 31 2.83 to 5.70,
129 3.47 to 4.63, 189 2.87, 228 2.73 to 3.89, 230 2.61 to 4.63; 41 (cable,
body only) 2.53 to 2.58. The barbell (4) also keeps its bar-path bound (within
2.0 of mid-foot, between ankle and toe, at every tick). I checked the new bound
bites: with 3.0 body masses per hand, 31 fails it at 9.66 against 7.56.

## Overhead Press (4), the bar and the head (minor)

No honest drawing in a turned view keeps the drawn bar off the head when it
passes the face: the bar runs across the body, so at any turn above about half
a degree its near half projects across the head while it is at face height
(as a camera would see it). So the view is turned to 3 degrees, nearly side
on, where the grip span projects to 1.5 units and the bar is drawn end on, as
its plate. A new optional field, `endOnPlateTone`, draws that plate grey with
a light sleeve end, because the default white end-on disc looked like a
second head beside the head ring. Every other movement draws as before.

- The test now measures the closest point of the drawn bar segment (between
  its painted ends) to the head ring's painted outer edge (radius plus half
  its 2.5 stroke): smallest 1.38 at 2310 ms, bound 0.8. The painted sleeve end
  clears the ring by at least 0.18. The bar is end on at all 80 ticks and its
  plate is painted after the head, so it passes in front of the face.
- 3D clearance, bar to head centre: smallest 9.63 at 2310 ms (bound 7.0).
- The plate itself (radius 6.6) overlaps the painted head by up to 3.97 units
  as it passes, drawn in front of it, as a plate does in a side photograph.
- To make that room: a grip a little wider (wrists 15.2 out from the midline,
  5.82 outside the shoulder), which also opens the rack elbow to 33.9; hips
  0.7 behind mid-foot at the rack and 1.0 behind the ankle as the bar passes
  the face, then forward to a stacked lockout over mid-foot (bar x 2.70);
  head 122 degrees at the rack and 128 at the face, 90 at the top.
- Bar across the front shoulders: 3.95 in front of the neck (bound kept at
  4.0), 1.30 above it; forearms within 10 degrees of vertical; lockout elbows
  at least 172 degrees.

## Arnold Press (31), palm from back (minor)

In the dumbbell close-up the back of the hand (start, palms toward you) is
now a darker block painted over the middle of the handle, with a darker wrist
and four light knuckles above the handle. The palm (top, palms forward) is a
light palm behind the handle with four fingers wrapped over it toward the
viewer. The thumb is on opposite sides at the start and the top. The test
checks the tones, the paint order against the handle, the four knuckles, the
four wrapping fingers and the thumb side. 189 (palm forward throughout) now
shows the palm drawing. The kettlebell close-ups are unchanged.

## Joint-limits test

`MovementPreview.jointLimits.test.js` covers the 27 movements in the batch
files of A06, A09, A12 and A15: every knee at least 35 and every elbow at
least 30 degrees (3D internal angle), and the wrist at least 3.84 from the
upper-arm centreline, at every 33 ms tick. All 27 pass. Its helpers
(`deg3D`, `segDist3D`) have the same shape as in the A06 test.

Chain movements outside my batches that breach it at this base (smallest
elbow in degrees; no knee breaches); I did not touch them: 287 Stiff Leg
Barbell Good Morning 26.3, 118 Calf Raises - With Bands 25.0, 39 Cable Crunch
0.1, 161 Cable Seated Crunch 7.0, 132 Band Good Morning (Pull Through) 22.0,
234 Kneeling High Pulley Row 17.9, 171 Concentration Curls 29.0, 95 Sit-Up
18.0, 285 Standing Rope Crunch 22.0, 248 One-Arm High-Pulley Cable Side Bends
20.0, 295 Upright Barbell Row 29.9, 8 Front Squat 17.0, 208 Front Squat (Clean
Grip) 23.9, 81 Zercher Squat 27.6, 244 Natural Glute Ham Raise 0.0. Movements
drawn by the older non-chain geometry were not scanned.

## Tests first

On the base drawing the tightened tests failed: 16 failed, 23 passed, 39
total (all seven elbows in both files; the drawn bar at -6.07 against 0.8; the
Arnold close-up). With the drawing changed they all pass.

## Gates (on the source commit)

typecheck exit 0; MovementPreview suite 65 suites, 3725 tests passed, exit 0;
storage guard exit 0; evidence gate exit 0; rendered-output probe exit 0
(236 movements, none added or removed, only the seven changed, no overflow).
The gate script was run with empty ids, as for a repair round, so its render
step drew nothing; I rendered the seven strips into this folder afterwards
with `node tools/rendering/render_motion_cycle.mjs --ids 4,31,41,129,189,228,230`
(sources committed at render) and recomputed `SHA256SUMS` the same way.

## The strips

I looked at each one. 4: the plate rises in front of the face as the head goes
back, then the head comes through under the bar. 31: dumbbells in front of the
chin with the elbows in front and the palms toward you; the close-up goes from
a grey back of the hand with knuckles to a white palm with fingers over the
handle. 129, 228, 230: bells at the front of the shoulders, the arm visibly
bent around them. 41 and 189: the hand beside the shoulder with the elbow
below it.
