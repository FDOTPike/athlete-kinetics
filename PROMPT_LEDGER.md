# PROMPT_LEDGER.md — intent → output isomorphism log

Continuous dataset mapping each execution prompt (the input, G(x)) to the
codebase delta it produced (the output, F(G(x))). Feeds the NotebookLM
architecture documentation.

**Standing protocol (from 2026-06-12):** on receipt of ANY execution prompt,
the FIRST file operation of the run appends a new entry here carrying the
timestamp and the verbatim input; the Output section of that same entry is
completed when the work lands (files changed, gates passed, commit hash).
Entries are append-only; never rewrite history. Retroactive entries below
were reconstructed on 2026-06-12 at ledger initialization — their timestamps
are date-accurate, not minute-accurate.

---

## Entry 0001 — 2026-06-12 · Pre-Phase-10 Polish ("UX Polish & ExRx Taxonomy Prep") — RETROACTIVE

### Input G(x)

```
CONTEXT SYNC: UX POLISH & SCHEMA PREPARATION
The APK is physically running on-device and the 4-week deterministic engine is
green. However, physical testing revealed UX friction and a false-positive in
the triage heuristic. We are executing a Pre-Phase 10 Polish. We are NOT
generating a massive movement library yet; we are building the abstract schema
to support external mathematical training laws later.

THE OBJECTIVES:
1. Fix the positive-sentiment triage bug.
2. Remove UI logging friction.
3. Scaffold a Biomechanical Taxonomy Schema (Minimal Viable Skeleton).

THE BOUNDARY INVARIANTS:
1. Triage Identity Pass-Through: a report of "it felt good" or pure positive
   sentiment must NOT trigger a safety guardrail. It must result in a 1.0
   (no-op) multiplier and return silently (or display a minimal positive UI
   state). Update the heuristic/semantic scanner to handle positive vectors
   correctly.
2. UI Friction Removal: bypass the forced chat/message step prior to
   completing an exercise — logging must be instantaneous. Fix the injury
   input text box: if a user clicks off the box after viewing the example
   text, the description text MUST reinstate itself instead of vanishing.
   Truncate long movement names in the active session header.
3. The Abstract Taxonomy (Schema Only): update the movement database schema to
   support a strict classification system matching the ExRx taxonomy: Push,
   Row, Hinge, Squat, Core, Unilateral, Accessory, Cardio. Add structural
   support for equipment/implement variations (e.g., DB vs. BB vs. KB).
4. Minimal Viable Skeleton: do NOT generate an extensive exercise list. Seed
   exactly ONE generic exercise per category so the blockGenerator tests pass.

EXECUTION MANDATE (ANTI-LOOP PROTOCOL): implement, run npm run verify:all
EXACTLY ONCE; on pass commit as "UX Polish & ExRx Taxonomy Prep" and stop; on
fail do not auto-fix — output the error and await directive.
```

### Output F(G(x))

- **Commit `53af9e8`** ("UX Polish & ExRx Taxonomy Prep"), 20 files, +261/−144.
- Positive identity pass-through: `isNoOpGuardrail` (semantic/codebase.ts)
  skipped inside `derivePrescription`'s operative selection; new
  `TriageOutcome 'positive'` + minimal "NOTED — ALL SYSTEMS GO" card; a
  positive report never masks a same-day restrictive one. Pinned in
  verify:policy [6] (+2 checks).
- Friction: forced pre-session check-in gate REMOVED (instant start on COACH
  + SESSION; operative halts still block inside the store action and both
  UIs — supersedes Phase 9 deviation 3); injury/mobility notes save on every
  keystroke with permanent example hints; session nav names truncate
  (maxWidth + numberOfLines).
- Migration **008_taxonomy.sql**: `movement_taxonomy(category, implement,
  family)` side-car (shipped `movement.pattern` CHECK cannot be widened);
  exactly one EXISTING canonical movement per category (no placeholder
  names); CHECK lists byte-equal to new `TAXONOMY_*` TS consts
  (verify:blocks [5]); verify:db [10]. blockGenerator untouched.
- Gates: all 10 green on the single permitted run. CI labels corrected.
- DEVIATION_LOG: +5 entries.

---

## Entry 0002 — 2026-06-12 · Release approval (v0.9.1) — RETROACTIVE

### Input G(x)

```
"Approved. Push to CI, cut the APK, and confirm when the release is active.
Do not start the next phase yet."
```

### Output F(G(x))

- Push `53af9e8` → CI run 27407372063, both jobs success (sha verified before
  artifact download).
- **Release v0.9.1** published with `athlete-kinetics-v0.9.1.apk` (186 MB):
  https://github.com/FDOTPike/athlete-kinetics/releases/tag/v0.9.1
- On-device checklist issued. Phase 10 not started.

---

## Entry 0003 — 2026-06-12 · Phase 10 mandate (multi-schema generator, absolute loads, cost matrix) — RETROACTIVE

### Input G(x)

```
CONTEXT SYNC: PHASE 10 - MULTI-SCHEMA GENERATOR, ABSOLUTE LOADS & SCHEMA COST
MATRIX

We are expanding the deterministic engine. The core 4-week block generator
works, but we are upgrading it to support absolute 1RMs, a 32-week
periodization macro-cycle, and a Weighted Multi-Schema Architecture. We remain
strictly offline, deterministic, and within our 424 MiB memory envelope.

THE MANDATE (Execute sequentially and verify:all at every step):

STEP 1: Schema Expansion (Absolute Load & Schema Type)
Update the database schema (create Migration 008). Add a one_rep_maxes table
(or expand profile state) to store absolute loads for the Big 4 (Squat, Bench,
Deadlift, Overhead Press). Add a schema_type ENUM to training_block (values:
'LINEAR', 'WAVE', 'STEP', 'APRE').

STEP 2: The Multi-Schema Engine & Fatigue Cost Matrix (blockGenerator.ts)
Expand the generator to map out a 32-week sequence (GPP -> Hypertrophy ->
Volume -> Intensity/Peak), materializing planned_session rows 4 weeks at a
time. The Strategy Pattern: refactor the core generation loop to accept the
schema_type. The Schema Cost Matrix: create a pure TS constant matrix
assigning a fatigue_weight to each schema based on the macro phase and the
user's objective. The Hybrid Tax: if profile.objective === 'hybrid' and the
block is 'APRE', the generator MUST read the higher fatigue_weight and
deterministically "pay" for it by stripping 1-2 working sets from all
accessory/secondary movements to prevent CNS overload. Auto-Regulated
Deadlift Rule: deterministic conditional gate for the deadlift peaking phase —
if rolling fatigue (ACWR) crosses the overreaching threshold as the peak block
approaches, shift the peak back by +1 week and insert a deload.

STEP 3: The UI Functor & APRE State Mutation
1RM Input UI (ATHLETE tab, Big 4). Session Translation: if a 1RM exists,
translate the generated RPE/Percentage into a physical Target Weight. APRE
Reactive Mutation: store action — if the current block is 'APRE', logging a
session with reps exceeding the target mathematically increases the target
load for that movement in the next week's planned_slot. Allow post-session
subjective text notes.

INVARIANTS: update verify_blocks.mjs to assert the translation matrix outputs
correct target weights from dummy 1RMs, that different schema_types yield
mathematically distinct load progressions, and that an 'APRE' block for a
'hybrid' objective outputs fewer total accessory sets than a 'LINEAR' block.
Run npm run verify:all to confirm. Do not loop if it fails. Output the single
error log.

Engineering note: the SessionScreen UI must be very clear about WHY a weight
changes (e.g., a badge like "Load adjusted +5kg due to previous AMRAP
performance").
```

### Output F(G(x))

- **Three commits**, each green on its single verify:all run:
  - `41565e2` (Step 1): migration **009** (mandated "008" renumbered — 008 had
    shipped as taxonomy): `one_rep_max` (movement-keyed), `block_meta`
    (schema_type ENUM + macro_block_index 1-8 + macro_phase + peak_shifted —
    side-car because ALTER isn't idempotent under self-heal),
    `slot_override` (reactive loads + mandatory human-readable reason),
    `session_note`. verify:db [11]. One test-fixture fix mid-step (id
    collision with section [3]'s session 999 → 9999), disclosed.
  - `7c748c6` (Step 2): SCHEMA_WEEKS strategy tables (LINEAR/WAVE/STEP/APRE) ×
    PHASE_MODS over the 32-week macro (macroPhaseOf, 2 blocks/phase);
    SCHEMA_FATIGUE_COST matrix; hybrid tax (1-2 accessory sets, slot_index ≥
    3, strength sessions, never < 1, never on deload); ACWR > 1.5 peak-shift
    (deload week 1, realization week 4); Epley targetPct/targetLoadKg with
    2.5 kg rounding. verify:blocks [7]-[10]: pairwise-distinct progressions,
    pinned translations (100→80.0 / 140→122.5 / 60→40.0), hybrid APRE 48 <
    LINEAR 60 accessory sets (strength unaffected), peak-shift quadrant,
    32 schema×macro determinism plans.
  - `c9c7212` (Step 3): store oneRepMaxes/blockMeta/generateNewBlock(schema,
    macro continuation, recentAcwr)/APRE endSession mutation (+2.5 kg per 2
    surplus reps, cap +7.5, slot_override with verbatim reason)/session
    notes; ATHLETE Big-4 steppers; SESSION target line + amber "why" badge;
    COACH schema picker + BLOCK n/8 strip + peak-shift notice. 48 store
    statements prepared.
- DEVIATION_LOG: +6 entries. Not pushed until approval.

---

## Entry 0004 — 2026-06-12 · Release approval (v0.10.0) — RETROACTIVE

### Input G(x)

```
"push!"
```

### Output F(G(x))

- Push `c9c7212` → CI run 27412676306, both jobs success (sha verified).
- **Release v0.10.0** published with `athlete-kinetics-v0.10.0.apk` (186 MB):
  https://github.com/FDOTPike/athlete-kinetics/releases/tag/v0.10.0
- Six-item on-device checklist issued (1RM targets, WAVE undulation, APRE
  badge, hybrid tax, macro continuation, notes).

---

## Entry 0005 — 2026-06-12 · Phase 11 Step 1 (Health Connect telemetry) — RETROACTIVE
*(Executed immediately before the ledger mandate arrived; logged here so the
dataset has no gap.)*

### Input G(x)

```
CONTEXT SYNC: PHASE 11, STEP 1 (NATIVE TELEMETRY & HEALTH CONNECT)
On-device physical verification of Phase 10 is complete. We are now executing
Phase 11: Native Biometric Ingestion.

THE OBJECTIVE: build the packages/biometrics module using Android Health
Connect — passively ingest overnight HRV, Resting Heart Rate (RHR), and Sleep
duration into the existing 002_telemetry tables to feed ACWR and readiness.

BOUNDARY INVARIANTS:
1. Graceful Degradation: permission denied or Health Connect APK missing MUST
   NOT crash — silently catch and fall back to subjective-triage-only routing.
2. Data Compaction (Memory Guardrail): aggregate/roll up (overnight HRV
   average, total sleep duration) BEFORE inserting into SQLite. No
   minute-by-minute arrays in the database.
3. Lifecycle Sync: biometric polling only during safe app-foreground lifecycle
   events (boot / tab focus), updating store and DB synchronously.

EXECUTION MANDATE: write packages/biometrics/src/healthConnect.ts, wire
permissions + fetching into the RN UI/store lifecycle, update mocks/fixtures,
run verify:all (all 10 gates) EXACTLY ONCE; on pass commit as "Phase 11 Step
1: Health Connect Telemetry" and stop; on fail output the error and diagnosis.
```

### Output F(G(x))

- **Commits `9111b2b` + `5ef2b2b`** (hygiene: untrack compiled test artifact).
  18 files, +1189/−12. **NOT yet pushed.**
- `packages/biometrics`: pure `aggregateDaily` (one row per local date; sleep
  stage math excludes awake/out-of-bed; unstaged sleep at 0.92 efficiency,
  never 100%; wake-morning bucketing; physiology-bounds filtering; never
  throws) + thin `healthConnect.ts` adapter (deferred require — the Phase 7
  crash lesson; every failure path → null/false/[]).
- Store: `connectBiometrics` ('unavailable'/'denied'/'ready') +
  `syncBiometrics` (boot, AppState 'active', SYNC NOW on ATHLETE; HRV+RHR →
  hrv_daily — RHR uses the EXISTING resting_hr column, no new table — sleep →
  sleep_daily; trailing-week re-materialization; wholly fail-silent).
- Native: read-only health permissions + rationale intents, minSdkVersion
  24→26 (Health Connect floor), react-native-health-connect ^3.3.0 in app +
  root manifests, lockfile regenerated.
- **NEW GATE 11** verify:biometrics (compaction, stage math, bucketing,
  garbage tolerance, SQL round-trip through real 002 CHECKs + materializer
  consuming telemetry-only days). All 11 gates green on the single run.
- DEVIATION_LOG: +4 entries. Known risk flagged: first new native dep since
  the autolinking saga — CI's APK job is the only verifier for the Gradle
  seam.

---

## Entry 0006 — 2026-06-12 · Workflow automation & categorical logging (this mandate)

### Input G(x)

```
CONTEXT SYNC: WORKFLOW AUTOMATION & CATEGORICAL LOGGING
Before we begin Phase 11 (Native Biometrics), we are implementing a strict
meta-logging protocol. We need to mathematically track the isomorphism between
the human/Gemini intent (the prompt) and your generated output (the codebase).

THE OBJECTIVE: create and maintain a root-level PROMPT_LEDGER.md as the
continuous dataset for our NotebookLM architecture documentation.

THE LOGGING PROTOCOL:
1. Create the Ledger at the project root.
2. Standing Rule: from this moment forward, upon receiving ANY execution
   prompt, the FIRST file operation must append a new entry.
3. Format per entry: Timestamp / Phase Step; The Input (G(x)) — exact prompt
   text; The Output (F(G(x))) — dense summary of files changed, tests passed,
   commit hash.
4. Immediate Action: create the file now; log the previous Phase 10 Handover
   and the UX Polish steps retroactively as the first entries.

EXECUTION MANDATE: create PROMPT_LEDGER.md, write the historical Phase 10
entries, commit as "chore: initialize prompt ledger". Do not start Phase 11
yet. Wait for my next prompt.
```

### Output F(G(x))

- This file created with retroactive entries 0001-0005 (UX Polish, v0.9.1
  release, Phase 10 mandate, v0.10.0 release, Phase 11 Step 1) and this
  self-entry.
- Sequencing note surfaced to the operator: Phase 11 Step 1 was already
  executed and committed (unpushed) before this mandate arrived — "do not
  start Phase 11" is therefore moot for Step 1; no further Phase 11 work
  proceeds without a prompt.
- Standing rule persisted to agent memory (survives session compaction).
- Commit: "chore: initialize prompt ledger" (hash recorded in the git log;
  docs-only change — verification gates unaffected).
