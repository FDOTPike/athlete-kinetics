# Work order 4 — coaching descriptions and cues

Audit, fix and validation record. 2026-10-02, Claude Opus 5.5 in Claude Code
Desktop. Baseline and prerequisite strategy: [BASELINE.md](BASELINE.md).
Input: the movement content review of 2026-09-30 (`REVIEW.md`, `review.json`,
`coverage.json`, read from the `movement-content-review` checkout and not
modified). Row-level record: [evidence/WO4_DISPOSITIONS.json](evidence/WO4_DISPOSITIONS.json).

## What the review found, and what was missing to act on it

The review flagged 146 records as generic. 144 of them carry the same
three-sentence template — "Set up <name> with <equipment> and choose a load
or range you can control. <pattern-level action>. <pattern-level fault>." —
which tells an athlete nothing about the start position, the path, the end
point or the return. (The other two, Renegade Row and Natural Glute Ham
Raise, already have specific text and were matched by the review's pattern
only because they begin "Set up"; they are left alone.)

The review rightly refused to rewrite from a title: "names, aliases, taxonomy
and frame captions cannot establish intended kinematics when the authored
source does not." What it did not have was the authored source.

**That source is in this repository's own history.** Every one of these rows
was imported by exact name from free-exercise-db (public domain, The
Unlicense; licence text vendored in `packages/core-db/staging/`). The first
import commit, `05e87108`, still holds each row's original instructions. The
Phase 2a curation later overwrote them with the template. Recovering that
text gives, for each row, the setup and action of the exact record the row
was created from — an identity source, not a guess from the name.

The recovered text is committed as reference evidence
(`packages/core-db/staging/movement_upstream_instructions.json`, 141 records,
each with its SHA-256). It is never shown to an athlete. The new coaching
text was written from it in the app's own words and house format; nothing is
copied through.

## What was changed

**115 movements** now have concrete coaching text: where to start, what moves
and how far, how to return under control, and up to three short cues. One
new append-only migration, `068_movement_content_correction_v2.sql`, generated
from `movement_content_correction_v2.json` by
`scripts/generate-content-correction-v2.mjs`.

It writes three columns and nothing else: `movement_detail.instructions`,
`movement_detail.cues`, `movement_coaching_intent.coaching_intent`. Every
movement id, name, alias (`base_name`, supported prefixes), pattern,
difficulty, target-muscle list, taxonomy row, equipment row, asset key, media
status, revision and fallback URL is byte-identical — asserted for all 300
movements by the library gate against a correction-free baseline. Provenance
is appended to `movement_content_correction` at version 2 beside the
untouched version 1 rows. Historical sessions reference movement ids, which
do not change.

An example (id 171, Concentration Curls):

> **Before.** Set up Concentration Curls with bench, dumbbells and choose a
> load or range you can control. Hold the upper arms still, curl the load
> through the forearms, and squeeze without lifting the shoulders. When the
> shoulders roll forward or the elbows travel, the load is ahead of the curl;
> reset lighter.
>
> **After.** Sit on a flat bench with the feet wide, hold one dumbbell and
> rest the back of that upper arm against the inner thigh with the arm
> straight and the palm facing forward. Keeping the upper arm still, curl the
> dumbbell up toward the shoulder. Squeeze, then lower slowly until the arm
> is straight. Complete the repetitions, then change arms.

### Rules the new text follows

- The house content law, enforced by the generator and again by the library
  gate on the text an athlete actually reads: 2–4 one-sentence steps, 1–3
  distinct cues, cues phrased as what to do (no "don't / never / avoid"), an
  intent of at most 160 characters, no medical or outcome claim.
- Only what the source supports. Where the upstream text was internally
  inconsistent on a detail (the wrist rotation in Incline Dumbbell Flyes),
  the detail is left out rather than chosen.
- Breathing counts, tempo ratios and "repeat for the recommended repetitions"
  are not carried over; the session screen owns sets, reps and effort.

## What was deliberately not changed

| Disposition | Count |
| --- | --- |
| held_codex_animation_dependency | 15 |
| corrected | 115 |
| codex_exclusive | 2 |
| held_owner_question | 11 |
| held_no_source | 1 |
| **template rows in total** | **144** |

### Movements 135 and 187

Barbell and Dumbbell Incline Shoulder Raise belong exclusively to the
animation lane (the pending incline-raise correction). They are not in the
correction, not in the evidence file, and the library gate asserts they are
byte-identical to the baseline. The generator refuses to build if either
name is added.

### Codex animation dependencies (15)

These rows have drawn preview frames whose captions describe a different
action from the upstream source. Rewriting the text would make the words and
the pictures disagree, so the text is left as it is and the conflict is
recorded here for the animation lane. No frame, manifest, prompt or approval
state was read for editing or changed.

| Id | Movement | What differs |
| --- | --- | --- |
| 125 | 3/4 Sit-Up | Upstream: sit all the way up, then lower only three-quarters of the way. Frames: curl up to about 45 degrees and lower fully. |
| 132 | Band Good Morning (Pull Through) | Upstream: band looped around a post and around the neck, hinge to about 90 degrees. Frames: band held at the hips. |
| 141 | Bench Press - With Bands | Upstream: band anchored under the bench, handles pressed with no bar. Frames: a barbell with a band looped over it. |
| 157 | Cable One Arm Tricep Extension | Upstream: single-handle underhand pushdown from a high pulley to the side. Frames: an overhead extension lowered behind the head. |
| 163 | Cable Shrugs | Upstream: a bar on a low pulley held in front of the thighs. Frames: cable handles held at the sides. |
| 175 | Crunches | Upstream: lying on the floor, feet on the floor or resting on a bench. Frames: lying on the bench. |
| 196 | Extended Range One-Arm Kettlebell Floor Press | Upstream: same-side knee bent and crossed over the midline to extend the pressing range. Frames: an ordinary one-arm floor press. |
| 197 | External Rotation | Upstream: side-lying on a bench with a dumbbell, forearm rotating up to point at the ceiling. Frames: body position not side-lying; forearm rotating across the body with the elbow at the side. |
| 214 | Hip Extension with Bands | Upstream: band on one ankle, the straight leg moved back while holding a post (a standing kick-back). Frames: band around the hips and a two-leg hip hinge. |
| 216 | Incline Cable Chest Press | Upstream: seated, elbows bent, handles pressed together straight in front. Frames: handles start over the upper chest and are lowered and pressed like a lying press. |
| 234 | Kneeling High Pulley Row | Upstream: rope held in both hands, kneeling, pulled to the upper chest with the elbows out. Frames: half-kneeling single-arm row. |
| 245 | Oblique Crunches | Upstream: lying with the feet raised, one hand by the head, elbow to the opposite knee. Frames: knees rotated to one side. |
| 253 | Preacher Hammer Dumbbell Curl | Upstream: a dumbbell in each hand with the palms facing each other. Frames: a bar in an underhand grip. |
| 263 | Rope Crunch | Upstream: kneeling in front of the cable, rope held overhead. Frames: lying on the back holding the rope at the chest. |
| 273 | Shotgun Row | Upstream: single handle, one arm, split stance, palm turning up during the pull. Frames: two arms. |

Either the frames are redrawn to the source action, or the owner confirms
the drawn action is the intended movement (in which case the text should be
written to match the frames, and the name may need review).

### Caption wording on corrected movements that have pending frames (41)

A second, softer dependency. These movements were corrected because their
drawn frames show the same action as the source. But the frame captions in
the animation lane were written from the old template wording ("Complete the
trunk action through a range you can own"), so the captions under the
pictures and the new instructions now use different words for the same
action. No caption was changed here. Whether to re-derive the captions from
the corrected text is a decision for the animation lane; the previews are all still
`pending` technique review.

126 Alternate Hammer Curl; 127 Alternating Cable Shoulder Press; 128 Alternating Floor Press; 133 Barbell Bench Press - Medium Grip; 134 Barbell Incline Bench Press - Medium Grip; 142 Bent Over Barbell Row; 144 Bent Over One-Arm Long Bar Row; 146 Bent Over Two-Dumbbell Row; 147 Bent Over Two-Dumbbell Row With Palms In; 158 Cable Preacher Curl; 161 Cable Seated Crunch; 167 Close-Grip EZ Bar Curl; 168 Close-Grip EZ-Bar Press; 169 Close-Grip Front Lat Pulldown; 172 Cross Body Hammer Curl; 173 Cross-Body Crunch; 174 Crunch - Hands Overhead; 186 Dumbbell Bicep Curl; 191 Dumbbell Seated One-Leg Calf Raise; 199 EZ-Bar Curl; 222 Incline Push-Up Close-Grip; 223 Incline Push-Up Wide; 224 Internal Rotation with Band; 225 Jackknife Sit-Up; 227 JM Press; 238 Low Pulley Row To Neck; 246 One Arm Dumbbell Bench Press; 251 Pallof Press With Rotation; 254 Push Up to Side Plank; 255 Push-Up Wide; 260 Reverse Cable Curl; 266 Seated Cable Rows; 267 Seated Cable Shoulder Press; 274 Shoulder Press - With Bands; 278 Standing Biceps Cable Curl; 282 Standing Dumbbell Triceps Extension; 283 Standing Overhead Barbell Triceps Extension; 287 Stiff Leg Barbell Good Morning; 294 Underhand Cable Pulldowns; 298 V-Bar Pullup; 300 Wide-Grip Lat Pulldown.

### Identity left unresolved (11 template rows)

The review raised a second, identity-level issue on these rows. They are not
rewritten: the question has to be answered first.

| Id | Movement | Issue | Question for the owner |
| --- | --- | --- | --- |
| 138 | Barbell Shrug Behind The Back | GENERIC_VARIANT_SETUP_MISSING | Confirm the exact bar start position and intended range; preserve its separate ID from ID 82. |
| 145 | Bent Over Two-Arm Long Bar Row | EQUIPMENT_AND_LATERALITY_AMBIGUITY | Confirm the long-bar anchor, resistance source and distinction from ID 144. |
| 153 | Box Squat with Bands | EQUIPMENT_LIST_CONFLICT | Confirm box support, load implement and band anchor/load direction; remove alternatives not part of this ID. |
| 165 | Calf Raise On A Dumbbell | DISPLAY_NAME_AND_EQUIPMENT_AMBIGUITY | Confirm load placement, heel support and single-leg/two-leg execution before renaming or revising. |
| 193 | Dumbbell Tricep Extension -Pronated Grip | DISPLAY_PUNCTUATION, GRIP_VARIANT_UNSPECIFIED | Confirm body position and pronated hand position; approve a name cleanup without changing ID 193. |
| 198 | External Rotation with Cable | EQUIPMENT_NAME_CONFLICT | Confirm whether bands are an intentional alternative on ID 198 or cable machine is the sole required implement. |
| 200 | Finger Curls | ACTION_CONTENT_MISMATCH | Confirm finger-curl setup and range; provide owner-approved instructions that distinguish finger flexion from wrist curl. |
| 205 | Front Barbell Squat To A Bench | FRONT_RACK_ACTION_NOT_CAPTURED | Confirm rack position, bar-to-bench interaction and intended range before authoring movement-specific steps. |
| 247 | One-Arm Dumbbell Row | SUPPORTED_ROW_VARIANT_UNSPECIFIED | Confirm whether ID 247 is unsupported or bench-supported and whether it differs from ID 12. Retain both IDs until decided. |
| 279 | Standing Cable Chest Press | POSSIBLE_DUPLICATE_NAME_IDENTITY | Is ID 279 distinct from ID 83? State the difference or confirm a display alias while retaining both IDs. |
| 291 | Trail Running/Walking | COMPOUND_CARDIO_NAME_AND_CONTENT_AMBIGUITY | Define supported activity/session structure (trail run, walk or run/walk intervals) and cue scope. Should these be separate identities? |

One further template row has no source to write from: id 250, One-Arm
Kettlebell Swings — no row with that exact name exists in the recovered
import.

### Identity left unresolved (23 other rows from the review)

These rows already have specific text. The review's three "proposed
corrections" are all conditional on owner confirmation, so none is applied.
In particular no display name is changed: each proposed rename (122, 154)
depends on the owner confirming which action the record is.

| Id | Movement | Review status | Issue | Question for the owner |
| --- | --- | --- | --- | --- |
| 3 | Competition Bench | requires_owner_identification | SUPPORTED_IMPLEMENT_VARIANT | Is the dumbbell prefix an intentional supported variant, or should it resolve to a separate movement identity? Keep the existing ID until decided. |
| 6 | Weighted Pull-up | requires_owner_identification | LOAD_AND_EQUIPMENT_CONFLICT | Confirm how the added load is attached and represented, and whether it belongs on this row or a separate variant. |
| 14 | Goblet Squat | requires_owner_identification | EQUIPMENT_TAXONOMY_CONFLICT | Which implement is canonical for ID 14, and is the other an allowed alternative or a separate row? |
| 20 | Suitcase Carry | requires_owner_identification | EQUIPMENT_TAXONOMY_CONFLICT | Confirm the canonical implement and whether the alternate should remain supported on this ID. |
| 25 | Pallof Press | requires_owner_identification | ANTI_ROTATION_VS_ROTATION_CLASSIFICATION | Is this an anti-rotation press or a rotational press? Confirm intended action and matching pattern/family. |
| 26 | Plank | requires_owner_identification | STATIC_BRACE_CLASSIFICATION | What exact plank variation and movement, if any, should this ID demonstrate? |
| 41 | Cable Shoulder Press | requires_owner_identification | LATERALITY_MISSING_FROM_NAME | Is ID 41 single-arm only or a general cable shoulder press? Confirm the display distinction and whether a bilateral sibling is intended. |
| 47 | Dip | requires_owner_identification | EQUIPMENT_SETUP_AMBIGUITY | Should parallel bars be represented as pullup_bar, or does equipment need a distinct dip-station value? |
| 50 | Dumbbell Lateral Raise | proposed_correction | CUE_WORDING | If a slight forward torso angle is intended, approve a positive cue describing it; otherwise remove this cue. |
| 51 | Dumbbell Lunge | requires_owner_identification | LUNGE_DIRECTION_UNSPECIFIED | Confirm stepping direction, whether the feet reset each rep, and the intended display name. |
| 58 | Eccentric Wall Handstand Push-Up | requires_owner_identification | REQUIRED_SETUP_EQUIPMENT_MISSING | Confirm the wall/head-target setup and whether either is represented in the equipment vocabulary. |
| 79 | T-Bar Row | requires_owner_identification | T_BAR_SETUP_UNSPECIFIED | Confirm the anchored-bar arrangement and grip/handle used for this ID. |
| 92 | Preacher Curl | requires_owner_identification | PREACHER_SUPPORT_EQUIPMENT_MISSING | Confirm whether this uses a preacher bench/pad and how the arm is supported. |
| 96 | Standing Barbell Calf Raise | requires_owner_identification | RANGE_SUPPORT_EQUIPMENT_MISSING | Confirm whether the elevated platform is required and how it should be represented in equipment. |
| 100 | Close-Grip Dumbbell Press | requires_owner_identification | DISPLAY_NAME_ACTION_MISMATCH | Confirm whether the authored action is a dumbbell crush press; if yes, approve a display-name proposal while retaining ID 100 and its asset key. |
| 111 | Barbell Seated Calf Raise | requires_owner_identification | CALF_RAISE_SUPPORT_SETUP | Confirm the seat, heel support and dumbbell placement, then align the equipment list. |
| 122 | Kneeling Single-Arm High Pulley Row | proposed_correction | NAME_SETUP_LATERALITY_MISMATCH | Confirm half-kneeling; if so, approve the display name and keep the current name as a searchable alias. |
| 154 | Cable Incline Pushdown | proposed_correction | DISPLAY_NAME_ACTION_MISMATCH | Confirm the authored action is an incline cable pullover; if so, approve a name proposal and keep the old name as an alias. If triceps pushdown was intended, replace content from an owner-approved source. |
| 202 | Floor Glute-Ham Raise | requires_owner_identification | NAME_SETUP_AND_VARIANT_COLLISION | Is this floor-based or a Nordic-bench glute-ham/Nordic curl? Confirm exact action and distinction from ID 23. |
| 212 | Hammer Grip Incline DB Bench Press | requires_owner_identification | DUPLICATE_CONTENT_IDENTITY_AMBIGUITY | Are IDs 212 and 218 the same action under two names, or is a distinguishing setup/press path missing? If aliases, choose a display name but keep both IDs and asset keys. |
| 218 | Incline Dumbbell Bench With Palms Facing In | requires_owner_identification | DUPLICATE_CONTENT_IDENTITY_AMBIGUITY | Are IDs 218 and 212 the same action under two names, or is a distinguishing setup/press path missing? If aliases, choose a display name but keep both IDs and asset keys. |
| 235 | Kneeling Squat | requires_owner_identification | NAME_PATTERN_FAMILY_MISMATCH | What exact movement does ID 235 represent? Confirm start, hip/knee action and family; do not reuse an existing identity without approval. |
| 243 | Middle Back Shrug | requires_owner_identification | NAME_ACTION_MISMATCH | Is the intended action chest-supported scapular retraction or a shoulder shrug? Confirm label and movement-specific path. |

### Equipment the corrected text needs but the catalogue cannot express (13)

These rows are corrected — the source is clear about the action — but the
accurate description mentions equipment the movement's equipment list does
not hold. The equipment tables are not changed here; each is a catalogue
question for the owner, because equipment decides eligibility.

| Id | Movement | Question |
| --- | --- | --- |
| 152 | Body Tricep Press | Text needs a bar fixed in a rack; the equipment list has squat_rack but no barbell. |
| 158 | Cable Preacher Curl | Text needs a preacher bench; the equipment vocabulary has only "bench". |
| 160 | Cable Russian Twists | Text needs a stability ball; the equipment vocabulary has no such item. |
| 191 | Dumbbell Seated One-Leg Calf Raise | Text needs a low block for the foot; the equipment vocabulary has no such item. |
| 194 | Elevated Back Lunge | Text needs a low platform to step back from; the equipment vocabulary has no such item. |
| 195 | Elevated Cable Rows | Text needs a low platform on the seat; the equipment vocabulary has no such item. |
| 222 | Incline Push-Up Close-Grip | Text needs a raised bar or platform for the hands; the equipment list is empty. |
| 223 | Incline Push-Up Wide | Text needs a raised bar or platform for the hands; the equipment list is empty. |
| 256 | Reverse Band Box Squat | Text needs a box to sit back onto; the equipment list has no box or bench. |
| 259 | Reverse Barbell Preacher Curls | Text needs a preacher bench; the equipment vocabulary has only "bench". |
| 275 | Speed Box Squat | Text needs a box and a rack; the equipment list has bands and barbell only. |
| 276 | Spider Curl | Text needs a preacher bench; the equipment vocabulary has only "bench". |
| 298 | V-Bar Pullup | Text needs a V-handle hung over the bar; the equipment vocabulary has only pullup_bar. |

## Approval status — a release blocker

Correction v1 (049) bound an owner approval to the hash of every record.
**This set has no owner approval.** It was written under the owner's
instruction in work order 4, and the files say so: the overlay's
`ratification.state` is `pending_owner_review` and no record carries an
approval. The library gate requires that statement to be truthful — it
fails if the set claims approval without an owner approval bound to each
record hash — and prints how many records are waiting.

Before this ships, the owner needs to read the 115 descriptions (the staging
file is the readable form) and either approve them per record or send
corrections. Any edit changes that record's hash and so cannot inherit an
approval.

## Licence

Source dataset: free-exercise-db, The Unlicense (public domain). The licence
text was already vendored at `packages/core-db/staging/DATASET_LICENSE.txt`
by the original import. No new asset, image, video or third-party text was
imported. Nothing was downloaded for this work order: the source text came
from the repository's git history.

## Validation

All on desktop, Windows 11, Node 24, 2026-10-02. No native-device acceptance
is claimed.

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run verify:library` (new section [7b]; [8] now merges both corrections; reports "pending_owner_review; 115 of 115 await owner approval") | exit 0 |
| `npm run verify:coaching-content-generator` (now also the v2 generator `--check` and its 31-check test) | exit 0 |
| `npm run verify:migrations` (67 entries; new [068] section: text-only proof, replay, self-heal, lost provenance restored) | exit 0 |
| `npm run verify:backup` (v63–v67 contract pins; v67 shares the v66 fingerprint because 068 changes no schema) | exit 0 |
| `npm run verify:blocks`, `verify:pipeline`, `verify:store`, `verify:demo`, `verify:db`, `verify:coach`, `verify:preparation` | exit 0 |
| `ContentCorrectionV2.test.js` (real store: the screens receive exactly the staged text; history, PRs and logged sets for a corrected movement are untouched) | 7 passed |
| `npm run verify:components` (78 suites, `--no-cache`) | 1710 of 1710 passed, exit 0 |
| Negative controls (`scripts/coaching/negative-controls-wo4.mjs`) | 17 of 17 detected, re-run in full with the stricter harness (a gate must pass unmutated and report a failure of its own) — `evidence/WO4_NEGATIVE_CONTROLS.md` |

Full integrated `npm run verify:ci`:

| Where | Result |
| --- | --- |
| Development lineage, final tip, separate clean checkout | exit 0 (25 gates there; 78 suites, 1710 tests) |
| Published branch at its first published tip, hosted CI on pull request 25 | "Verification suite (23 gates + typecheck)" passed |
| Published branch, local (this is the top of the stack) | exit 0 (23 gates; 55 suites, 877 tests) |
