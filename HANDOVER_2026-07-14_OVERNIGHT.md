# Handover — 2026-07-14 overnight · non-UI build-out (per your brief)
All UNCOMMITTED. Run `npm run typecheck` first (bridge rule), then `verify:all` (16 gates), then commit.

## Shipped tonight

1. **017 additive generator** (`scripts/generate-batch-migration.mjs`) + seeded
   manifest (`packages/core-db/staging/seeded_manifest.json`). 016 is frozen;
   every future curation wave auto-lands in the next slot. Batch 05+ is unblocked.
2. **S3 batch 04** (15 staples: Floor Press, Cable Chest Press, Incline Push-Up,
   Barbell Shrug, Renegade Row, DB RDL, Single-Leg RDL, Floor Back Extension,
   Sit-Up, Preacher Curl, DB Front Raise, BB Calf Raise, Lying DB Triceps
   Extension, Cable Glute Kickback, Double KB Push Press) → **migration 017**,
   library **96 rows**, 68/434 staged curated. Gates updated (migrations chain,
   poisoned-heal expects 96, store reset expects 96).
   NOTE: DB Romanian Deadlift is Beginner + dumbbell — a whitelist candidate
   if you want beginner hinge variety; your call, not added.
3. **T1 condition gating, live** — conditions follow the SELECTED implement
   (Earthquake Bar/Chains need BB, Bottom-Up/KB need KB, Banded universal);
   invalid conditions auto-clear on implement change; re-filtered at the
   logSet store boundary so bad chips can never reach set_prefix. Bodyweight
   movements: load stepper relabeled "ADDED KG (0 = bodyweight)" and defaults
   to 0. Rule lives in `conditionApplies` (inference/conditionEngine.ts).
4. **P17 S1 session runner** (`packages/inference/src/sessionRunner.ts`) —
   pure reducer: slots → sets → tier/RPE-aware rest (documented table) →
   next-up preview → thumbs-down substitution offer → swap/skip/complete.
   `verify:runner` = **16th gate** (14 checks). No UI — that waits for your
   pikeMethods design.
5. **Progression is store-live**: `resolveGoalRung(group)` reads the chain +
   per-session set history (same-session 3×8 semantics) and returns the rung
   to prescribe. UI consumer = P17.
6. **LOGGING_MODES_DESIGN.md** — reps/time/distance + band-level proposal
   answering your farmer-walk and dead-bug questions. 3 decisions wanted
   before I build 018.

## Your morning checklist
1. `npm run typecheck` → `npm run verify:all` (expect 16/16 incl. CI-only pair
   on your networked machine) → commit → push.
2. Read LOGGING_MODES_DESIGN.md, answer the 3 questions.
3. On-device after CI APK: dead bug offers ONLY Banded (banded dead bugs are
   ratified; EQ-Bar/Chains/Bottom-Up vanish on bodyweight)
   and an "ADDED KG" field; barbell movements keep Chains/EQ-Bar; library 96.
4. Whitelist candidate decision: DB Romanian Deadlift in or out?

## Queue after your answers
018 logging modes → batch 05+ curation (366 left) → P17 S2 guided UI + your
redesign + S5 library browser/detail card (blocked on your template, happily).

## ADDENDUM — your 3 answers, implemented same morning

Migration **018_logging_modes.sql**: `movement_logging_mode` ('reps'|'time';
Plank, Road Run, BJJ Round, Farmer Carry, Suitcase Carry seeded as time),
`set_metric` (composite key — a banded plank carries time AND band level),
`band_ladder` (your personal ordinals, defined in Profile when first needed).
Store: `Movement.loggingMode` exposed; `logSet(..., metrics)` persists
time_s/band_level; `resolveGoalRung` reads COALESCE(time_s, reps) so a
time-based chain progresses on seconds (per-chain policy = required seconds).
Sentinel + poisoned-heal + store gates updated; all green.
STILL UI-LESS by design: the time stepper and band picker are drawn when your
template lands. Distance never enters the schema — dropped per your call.

## ADDENDUM 2 — third audit (GPT 5.6) response, same morning

Fixed: reset now clears every derived in-memory surface (session/plan/
prescription/substitution/triage/niggles/block) and computePrescription nulls
the adjustment when no vector exists; time-mode is ENFORCED at logSet (reps=1,
seconds required) with a functional SECONDS stepper; per-chain
progression_policy table (time chains qualify on seconds); all four 018
tables are self-heal sentinels + partial-018 poison test; bodyweight load
initializes to 0 (magic-100 hack removed); boot resumes an unfinished session
from SQLite (kill mid-session = resume, not duplicate); batch generator slot
scan covers disk + manifest (018 collision fixed, batch renumbered to 017);
Renegade Row is DB-only (prefix/equipment consistency); embedder verifies
cached artifacts too; design doc rewritten to match implementation.
Pushed back (with reasons in chat): 8a5734c is not a valid baseline (it never
compiled); Banded-on-dead-bug is ratified behavior — the old handover sentence
was wrong, not the code. Still open & honestly labeled: signing/iOS id/pin
values (P19, your machine); band UI + timed-set display (redesign scope);
runner remains an engine, not app behavior, until P17 UI.
