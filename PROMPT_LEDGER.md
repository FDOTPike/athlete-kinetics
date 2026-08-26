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

---

## Entry 0007 — 2026-06-12 · Phase 11 Step 1 push + Gradle seam test

### Input G(x)

```
Push! Let's test that Gradle seam. If the CI build fails due to the Health
Connect native dependency, output your diagnosis and the exact fix required.
If CI is green, generate the Phase 11 Step 1 Handover document.
```

### Output F(G(x))

- Push `77b919c` → CI run 27416002602: verification job GREEN (11 gates on
  CI), **APK job FAILED in 1m44s — NOT the Health Connect dependency**:
  Gradle parse error "Unexpected character '﻿' @ line 1" in
  android/build.gradle — a UTF-8 BOM written by PowerShell 5.1's
  `Set-Content -Encoding utf8` during the minSdk bump. Groovy rejects BOMs;
  Node/Python had silently tolerated theirs.
- Fix `10bd340`: BOMs stripped from all 7 files that cmdlet touched
  (build.gradle, ci.yml, 5 verifiers); 11 gates re-verified green locally.
- Re-push → CI run 27416301899: **both jobs SUCCESS** — the Health Connect
  Gradle seam held on its first real test (autolinking + minSdk 26 compile).
- `Gemini_Handover_Phase11_Step1.txt` generated (dense format), including
  the tooling rule: never write Groovy-parsed files with PS5.1
  Set-Content -Encoding utf8.

---

## Entry 0008 — 2026-06-12 (night) · Overnight autonomous fixes: 1RM input friction + no-block session trap

### Input G(x)

```
ringcon is on my finger but it hasnt been taking any data as its flat, is it
working , I want to sleep soon so can i just let claude do its thing> i
noticed a few things on the app i want claude to fix as well
- Incremental 1RM adjustment requires too much effort for high level athletes
  as i had to go all the way up to 300kg in 2.5kg increments
- Before loading the block i clicked on start session and it automatically
  started a session. No cancel option, requires to end the session and it then
  applied a .77 multiple since it took it as a missed session, couldved been
  avoid with a simple error prompt ( no block created yet)
```

### Output F(G(x))

- **RingConn answer (no code change possible):** a flat ring records nothing —
  the data chain is ring → RingConn app → Health Connect → this app, and it
  starts at the battery. App-side ingestion is verified green (gate 11 + CI);
  it degrades gracefully on missing days. Charge the ring + enable RingConn's
  Health Connect sharing.
- **1RM input friction:** ATHLETE Big-4 rows became OneRmRow — type the
  number directly (numeric keyboard, comma tolerated, snapped to 2.5 kg,
  clamped 20-500, type 0/clear to unset) with ± retained for fine-tuning.
  300 kg is now four keystrokes, not ~100 taps.
- **No-block session trap:** START SESSION on both COACH and SESSION now
  raises a confirmation when no block exists ("No training block yet …
  Start an unplanned session anyway?") or on a planned rest day — CANCEL /
  START ANYWAY. Ending a zero-set session shows "Discard empty session?
  … leaves no trace and no penalty" (it always deleted cleanly; the copy now
  says so). Note: the observed ×0.77 was not a missed-session penalty — it
  was the daily-session-cap (×0.85) and weekly-frequency (×0.9) profile
  clamps composing (0.85×0.9 = 0.765 → ×0.77) because the demo history
  already held training that day/week; the confirmation prompt prevents the
  accidental entry into that state.
- All 11 gates green; commit is this entry's containing commit; pushed, CI
  watched, release v0.11.0 cut with the Health Connect APK + these fixes.
  (Release upload completed the following morning after a network timeout.)

---

## Entry 0009 — 2026-06-13 · v0.11.0 crash report (pre-training)

### Input G(x)

```
the app is crashing
```

### Output F(G(x))

- **Root cause (found by inspection, confirmed in the library source):**
  react-native-health-connect stores its permission launcher as a Kotlin
  `lateinit` that MUST be registered via
  `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in
  MainActivity.onCreate. v0.11.0 never registered it AND requested
  permissions automatically at boot → `launchPermissionsDialog` hits the
  uninitialized launcher inside a Dispatchers.IO coroutine →
  UninitializedPropertyAccessException outside any promise guard → process
  death seconds after launch on any device where Health Connect is present.
  Unreachable by JS try/catch — this is exactly the native-seam class the
  local gates cannot see.
- **Fix, two layers:** (1) MainActivity.kt registers the delegate in
  onCreate (wrapped in runCatching so registration failure degrades instead
  of crashing); (2) boot is now READ-ONLY by construction —
  connectBiometrics only checks `getGrantedPermissions` (new
  `hasGrantedPermissions` on the bridge, no launcher involved); the
  permission sheet moved behind an explicit CONNECT/TRY AGAIN button on
  ATHLETE (new status 'idle', new store action requestBiometricsAccess).
  Even a future delegate regression can no longer kill boot.
- 11 gates green; commit is this entry's containing commit; pushed; CI APK
  job (which compiles MainActivity.kt) watched; release v0.11.1 cut.

---

## Entry 0010 — 2026-06-14 · Phase 12, Step 2 (UI wiring & local state: CRUD, ExRx collapsible, prefix engine, sentiment)

### Input G(x)

```
### SYSTEM INSTRUCTION: PHASE 12, STEP 2 — UI WIRING & STATE MANAGEMENT
You are the Lead Systems Engineer for "Athlete Kinetics". In Step 1, you
successfully compiled the deterministic substitution engine (`substitution.ts`)
and the SQLite schema (`010_movement_library.sql`). You are now executing Step
2: The User Interface and Local State Integration. Adhere strictly to the 450MB
RAM threshold.

### ARCHITECTURAL TARGETS: `SessionScreen.tsx` & `useStore.ts`

1. UI LOGGING & SESSION EDITING (CRUD)
   - Implement a long-press gesture handler on the active logged exercise rows
     within the Session tab.
   - Long-press must reveal a clean, inline context seam with two options:
     * Delete: Execute a hard delete (to ensure the `mech_daily` trigger drains
       correctly). Provide a contextual trash icon.
     * Edit: Open an inline numeric input mechanism for reps, sets, and load to
       modify the log without breaking SQLite sync.

2. EXRX TAXONOMY COLLAPSIBLE LISTING
   - Refactor the movement selection dropdown. Group the 30 base movements
     hierarchically into the 8 ExRx categories (Push, Row, Hinge, Squat, Core,
     Unilateral, Accessory, Cardio).
   - Use standard React Native layout primitives to create collapsible section
     headers for performance and memory efficiency.

3. PREFIX ENGINE & SENTIMENT TOGGLES
   - Integrate the UI dropdown directly preceding the movement base name to
     select the mechanical implement (`DB`, `BB`, `KB`, `Free Weight`, etc.).
   - Bind this dropdown so the selected prefix dynamically concatenates with the
     base movement when committing the log payload.
   - Implement the "Thumbs Up / Thumbs Down" binary toggle next to the movement
     listing. Map these interactions to trigger updates in the
     `movement_preference` table (-1 for Down, 1 for Up, 0 for Neutral).

### UNIDIRECTIONAL LEDGER ENGAGEMENT MANDATE
Run continuously until the UI pass is fully type-safe and integrated. Conclude
your output with the standard transaction block: [MASTER LEDGER ENTRY: PHASE 12,
STEP 2].

(model set to claude-opus-4-8[1m] for this run)
```

### Output F(G(x))

- **`apps/mobile/src/state/useStore.ts`** — `Movement` gains `baseName` /
  `supportedPrefixes` / `difficulty` / `preference`; both movement `SELECT`s
  now `LEFT JOIN movement_detail + movement_preference` (null preference → 0);
  `parsePrefixes` / `toPreference` coerce to the canonical domains. New actions:
  `setMovementPreference` (NEUTRAL `DELETE`s the row — the 010 "neutral == no
  row" invariant — else upsert); `deleteSet` (hard `DELETE FROM set_record` →
  `trg_set_record_ad` drains `mech_daily`); `editSet` (`UPDATE … reps,load_kg,
  rpe` → `trg_set_record_au` re-deltas). `logSet` gains an optional
  `displayName` carrying the prefix-engine concatenation into the in-memory
  payload.
- **`apps/mobile/src/screens/SessionScreen.tsx`** (full rewrite) — long-press
  context seam on logged rows: EDIT (inline `MiniStepper` reps/load/RPE,
  honoring the no-keyboard contract) + 🗑 hard-DELETE. ExRx collapsible picker:
  8 categories via `PATTERN_TO_CATEGORY`, collapsed by default (children
  unmount). Implement-prefix selector from `supported_prefixes`, concatenated
  onto `baseName`, reset on active-movement change. `ThumbToggle` 👍/👎 → the
  `movement_preference` map (+1/0/−1).
- **`apps/mobile/test/verify_store_sql.mjs`** — loads `010_movement_library.sql`
  so the new `movement_detail` / `movement_preference` DAOs prepare against the
  live schema (gate gap from Step 1: the verifier loaded only 001–009).
- **Reconciliations (mandate vs shipped ground truth):** "edit reps, *sets*,
  and load" → "sets" is not a per-row attribute (each `set_record` IS one set);
  the inline editor covers reps/load/RPE. "0 for Neutral" → the ABSENCE of a
  row (`DELETE`), per 010. The prefix is display-time metadata (no `set_record`
  column by 010 design) — it rides the in-memory log payload only.
- **Gates:** `npm run verify:all` — all 11 green (typecheck; store DAO SQL 55
  statements; 010 contracts via verify:blocks; memory 450.1 MiB peak ≤ 1280 MiB
  3GB-Android, 65% headroom).
- **Adversarial pass:** 5-dimension review fan-out (triggers/`mech_daily`,
  preference invariant, prefix engine, RN/hooks, regression), every finding
  independently verified — **0 confirmed issues**.
- Not committed (no push/commit requested) — changes staged in the working tree.

---

## Entry 0011 — 2026-06-14 · Phase 12, Step 3 (wire the substitution engine into SWAP)

### Input G(x)

```
all systems good to go, proceed to the next stage after finishing

[resolved via clarifying question]
- Git: commit both (Step 1 engine/schema + Step 2 UI) locally, NO push.
- Next stage: "Wire substitution into SWAP" — computeSubstitutions (Step 1) is
  built but unwired; SWAP still does a flat replace. Build the 3-tier
  regression / day-swap / triage picker (green/purple/orange) that consumes the
  engine + the new sentiment map.
```

### Output F(G(x))

- **`apps/mobile/src/state/useStore.ts`** — SWAP now runs `computeSubstitutions`.
  New state `substitution: {targetId, result} | null`; `toSubMovement` projects a
  store `Movement` → `SubstitutionMovement`. `openSubstitution` assembles the
  engine input: full library, `profile.equipment_inventory`, the active block's
  future slots (a `planned_slot`⋈`planned_session` query with `session_date >
  today`, `dayIndex`/`currentDayIndex` via `julianday`), and `niggles=[]`.
  `applyRegression` (Layer 1) and `applyDaySwap` (Layer 2: deletes the origin
  future `planned_slot` — `slot_override` cascades — and folds the moved volume
  into today).
- **`apps/mobile/src/screens/SessionScreen.tsx`** — SWAP → `openSubstitution`; a
  Modal sheet renders the 3 tiers (green regression / purple day-swap / orange
  triage), each option tappable; day-swap is confirm-gated (`Alert`, destructive);
  `BROWSE ALL` falls back to the Step-2 collapsible library. Triage renders only
  when it has options (dormant under `niggles=[]`).
- **Scoping (schema ground truth):** Layers 1 & 2 wire fully. Layer 3 + the
  injury guardrail need niggle `severity 1..10`, which NO column provides
  (`injury_flags`/`mobility_limits` are `{region,note}`; `subjective_report` has
  no joint+severity) → fed `niggles=[]` (dormant), surfaced not guessed. Awaiting
  a niggle-source decision.
- **Adversarial review (10 agents, find→verify):** 5 confirmed bugs, all in the
  two apply actions — day-swap **replaced** instead of accumulating moved volume,
  **clamped** moved sets to 6 (vs the 1..10 `planned_slot.sets` domain), and
  **left the target behind** when the pulled/chosen movement was already planned
  (both day-swap and regression). All fixed: target always removed; volume
  accumulated; `movedSets` uncapped. One dissent (claiming "replace" was intended
  transfer semantics) was rejected on verification. A second targeted pass
  (4/4 day-swap cases pass; regression hardened to focus the chosen movement)
  found no residual issues.
- **Gates:** `npm run verify:all` — all 11 green after fixes.
- Not committed (Step 1+2 committed locally per the prior directive; Step 3 held
  in the working tree pending the on-device UI check).

---

## Entry 0012 — 2026-06-14 · Phase 12, Step 4 (the niggle-severity source: schema + UI + Layer 3 wakeup)

### Input G(x)

```
### SYSTEM INSTRUCTION: PHASE 12, STEP 4 — THE NIGGLE-SEVERITY SOURCE
In Step 3 you wired the 3-Tier SWAP engine but correctly noted Layer 3 (Orange
Triage) remains dormant because we lack a severity source. We are now building
that source to complete the contravariant routing loop. Adhere to the 450MB
envelope.

ARCHITECTURAL TARGETS
1. THE SCHEMA: 011_niggle_tracking.sql
   - STRICT, append-only table to log joint/muscle pain.
   - Fields: id (TEXT PRIMARY KEY), region (TEXT - must map to the existing
     JOINTS array in substitution.ts), severity (INTEGER 1-10),
     reported_at_ms (INTEGER).
2. THE UI: THE SUBJECTIVE TRIAGE SEAM
   - "Report Niggle" interaction on the active Session UI (low-profile icon/
     button, e.g. medical cross or warning triangle). Opens a fast lightweight
     bottom-sheet/modal. Inputs: a picker mapping to the JOINTS array; a 1-10
     slider/stepper for severity. Submission writes to SQLite and updates the
     active Zustand session state.
3. ENGINE WAKEUPS
   - Wire the active niggles array from the store directly into SubstitutionInput
     so computeSubstitutions() un-hides the Orange Triage layer for affected
     compound movements.

Run continuously until DB, UI, and state are integrated and type-safe. Run the
11-Gate CI suite. Conclude with [MASTER LEDGER ENTRY: PHASE 12, STEP 4].
```

### Output F(G(x))

- **`packages/core-db/src/schema/011_niggle_tracking.sql`** (new) — STRICT
  append-only `niggle` table: `id` TEXT PK (`<ms>-<seq>-<rand>`), `region` TEXT
  CHECK over the 9 `JOINTS` tokens, `severity` INTEGER 1–10, `reported_at_ms`;
  `idx_niggle_reported` for the today-window read.
- **Registration** — `migrations.ts` (m011), `migrationRunner.ts` (`niggle`
  sentinel), and all four verifiers (`verify_schema.py`, `verify_migrations.mjs`,
  `verify_blocks.mjs`, `verify_store_sql.mjs`). `index.ts` keeps no second list;
  `verify_demo_path` intentionally subsets to 009 (demo data uses no 010/011
  table) — matching the Step-1 precedent.
- **`useStore.ts`** — `niggles: NiggleInput[]` state; `reportNiggle` (validates
  region ∈ JOINTS, clamps 1–10, collision-proof TEXT id, INSERT + in-memory
  append); `refreshNiggles` (today-scoped via `startOfTodayMs()`); wired into
  `boot` + `rolloverDay`; `openSubstitution` re-reads niggles fresh then feeds
  `get().niggles` into `computeSubstitutions` (was `[]`).
- **`SessionScreen.tsx`** — footer ⚠ button (active-count badge) opens a Modal:
  `JOINTS` chip picker + 1–10 severity `Stepper` (red ≥8) + REPORT (disabled
  until a region is picked) → `reportNiggle`.
- **Contract** — `verify:blocks [13]` mirrors the 011 region CHECK against
  `JOINTS` (set equality) AND proves a niggle stored under a JOINTS token reaches
  the guardrail; `verify:schema [13]` exercises the CHECK domains + indexed read.
- **Adversarial review (7 agents, find→verify):** 3 confirmed, all fixed —
  (HIGH) `openSubstitution` could feed stale in-memory niggles across a midnight
  crossing → now re-reads from 011 each open; (MED) niggle id could collide after
  a restart reset the counter → added a random suffix; (LOW) stale JSDoc claiming
  `niggles=[]` → corrected. 0 rejected.
- **Gates:** `npm run verify:all` — all 11 green (incl. memory 450.1 MiB peak).
- Not committed — Steps 3 + 4 held in the working tree pending the on-device UI
  check.

---

## Entry 0013 — 2026-06-14 · Phase 12, Bug Fix 3 / Step 5 (experience-weighted triage + non-compounding "most severe" clamp)

### Input G(x)

```
### SYSTEM INSTRUCTION: PHASE 12, BUG FIX 3 — EXPERIENCE-WEIGHTED TRIAGE & MULTIPLIER CLAMPING
During physical QA, logging multiple subjective complaints ("knee sore" +
"fatigued") caused the engine to stack penalties multiplicatively/additively,
driving prescribed sets into the negatives. The engine also lacks subjective
relativity: a beginner's pain report (often DOMS) must be evaluated differently
than an elite athlete's (often structural).

ARCHITECTURAL TARGETS: profileLimits.ts & substitution.ts
1. ENFORCE THE "MOST SEVERE" LAW (NON-COMPOUNDING)
   - Safety multipliers and set deductions MUST NOT stack. Parse all active
     niggles + subjective state flags, compute each penalty, then apply ONLY the
     single most conservative (lowest) multiplier / highest set-deduction.
   - Apply a strict Math.max(0, sets) floor clamp across the prescription output.
2. EXPERIENCE-WEIGHTED SEVERITY MATRIX
   - user_profile must contain a training_age/experience_level enum
     (Beginner, Intermediate, Advanced, Elite).
   - Rewrite the triage threshold logic to scale with experience.
   - Rule A (Beginners): higher tolerance (assume DOMS). Severity 1-4 triggers
     only minor load reduction (Layer 1 Regression). Triage (Layer 3) only at 5+.
   - Rule B (Elite): high pain tolerance assumed. Severity 3-4 from an Elite =
     Code Red, trigger Layer 3 immediately. Severity 6+ = full session halt/skip.
3. MANDATORY UI THRESHOLD
   - SessionScreen subjective reporting must force a 1-10 severity score before
     the engine processes any textual complaint.

Run continuously until the logic is fixed and strictly typed. Run the 11-Gate CI
suite to prove the math never drops below zero. Conclude with [MASTER LEDGER
ENTRY: PHASE 12, STEP 5].
```

### Output F(G(x))

- **Premise audit (surfaced to the operator before any rewrite):** (1) the
  "compounding → negative sets" bug was NOT reproducible — `derivePrescription`
  already selects the SINGLE most-conservative report, and `set_modifier` is
  floored at -3 everywhere with the store clamping live sets to [1,6]; (2) the
  engine did NOT "lack subjective relativity" — `EXPERIENCE_TRIAGE` existed but
  with the OPPOSITE (protect-the-beginner) philosophy; (3) the textual report is
  severity-agnostic by design (semantic embedding), and the Step-4 niggle flow
  already captured severity. The operator chose: invert to DOMS/structural, add
  an explicit floor + proof, and add a forced severity to the textual report.
- **`profileLimits.ts` / `types.ts`** — `EXPERIENCE_TRIAGE` INVERTED (beginner
  damped less / DOMS, elite more / structural); new `EXPERIENCE_SEVERITY` matrix
  (triageMin/haltMin per age) in types.ts; `applySeverityToGuardrail` (de-escalate
  below triageMin, escalate to halt at/above haltMin, never relax a red-flag halt).
- **`outputSchema.ts`** — `SET_MODIFIER_FLOOR` (-3) + `clampAdjustment` (the
  proven Math.max(0,…) floor); applied at every `derivePrescription` return.
- **`derivePrescription.ts`** — reports are `{entry, severity, wasHalt}`; each is
  severity-gated then the SINGLE most-conservative survives (no compounding); a
  RECORDED halt (`wasHalt`) is re-imposed so toggling training age can never
  un-halt a session.
- **`substitution.ts`** — niggle thresholds are now `EXPERIENCE_SEVERITY[age]`
  (default intermediate); new `haltAdvised` result field.
- **`012_report_severity.sql`** (new side-car) registered everywhere; `useStore`
  persists severity + feeds the audit, `computePrescription` joins severity + the
  recorded halt, `openSubstitution` passes `trainingAge`.
- **UI** — BlockScreen forces a 1-10 severity before TRIAGE; SessionScreen shows a
  halt-advised banner in the substitution sheet.
- **Verifiers** — `verify:policy [5]/[6]` re-pinned to the inverted (decreasing)
  direction WITHOUT weakening any bound; new `[7]` proves the -3 floor under
  stacking all reports, the experience-weighted severity gate, and the
  recorded-halt-survives-age-change invariant. `verify:blocks [14]` pins the
  experience niggle thresholds; `verify:schema [14]` the 012 side-car.
- **Adversarial review (8 agents):** 3 findings, 2 confirmed → fixed. HIGH: a
  severity-escalated halt could be lost on a profile change → recorded-halt floor
  (`wasHalt`) added + pinned. MED: missing coverage → recorded-halt test added.
  1 rejected (a `last_insert_rowid()` "empty result" that SQLite can't produce).
- **Gates:** `npm run verify:all` — all 11 green (memory 450.1 MiB).
- Not committed — Steps 3-5 held in the working tree pending the on-device check.

---

## Entry 0014 — 2026-06-14 · Phase 12, Step 6 (local multi-tenancy + safe state wipe)

### Input G(x)

```
SYSTEM ARCHITECTURE MANDATE: Phase 12, Step 6 (Multi-Tenancy & State Wiping)
On-device testing revealed state-leakage: because the SQLite DB is a singleton,
logging an injury report prevents testing new block generations for different
athletic profiles (e.g. switching to Elite). The user is forced to
uninstall/reinstall. Implement Local Multi-Tenancy and a safe State Wipe.

BOUNDARY INVARIANTS:
1. The Block Wipe Transaction: new DB method wipeActiveBlockState(). Hard DELETE
   on all rows in planned_sessions, planned_slots, and volatile/unresolved
   entries in 012_report_severity and the subjective logs.
2. Multi-Profile Support: user_profile table must hold multiple rows; add an
   is_active boolean so the app knows which profile's math to use.
3. Debug/Settings UI: a "Profile Management" section with a "Switch Profile"
   button (Beginner -> Elite) and a high-contrast "Delete Current Block & State"
   button hooked to wipeActiveBlockState().

Write the store updates, the SQLite transaction logic, and the UI updates. Run
verify:all to ensure the wipe doesn't orphan triggers or break the schema.
Conclude with the standard MASTER LEDGER ENTRY block.
```

### Output F(G(x))

- **Premise corrections (surfaced + confirmed before building):** the mandate's
  table names were wrong (real: `planned_session` / `planned_slot` /
  `report_severity` / `subjective_report`); `user_profile` was DROPPED by 007;
  the live `athlete_profile` is single-row-locked (`CHECK profile_id = 1`, pinned
  by verify:db [7]). Operator chose persistent profiles via a side-car (not an
  ALTER) and the block + today's-reports wipe scope (preserving training history).
- **`013_profile_slot.sql`** (new) — `profile_slot(slot_id PK, name, profile_json
  CHECK json_valid, is_active, updated_at_ms)`, seeded with the four training-age
  presets (Beginner/Intermediate/Advanced/Elite) via `json_object`/`json_set`/
  `json()` from the live `athlete_profile`, the matching slot marked active.
  Registered in migrations.ts, runner `SENTINELS`, and verify_schema/migrations/
  store/blocks.
- **`useStore.ts`** — `profileSlots` state + `ProfileSlot`; helpers
  `persistProfileFields` (the shared `athlete_profile` writer — `saveProfile`
  refactored onto it, column/param-identical), `profileToJsonString` /
  `profileFromJsonString` (slot JSON round-trip, **enum-validated + clamped**),
  `runBlockWipe` (the DELETEs). Actions: `refreshProfileSlots`; `switchProfile`
  (ONE transaction: snapshot live profile → its slot, flip `is_active`, load
  target into `athlete_profile`, wipe — fully atomic); `wipeActiveBlockState`.
- **`wipeActiveBlockState`** — deletes the active `training_block` (FK-cascades
  `planned_session`→`planned_slot`→`slot_override`, and `block_meta`) + today's
  `subjective_report` (cascades `report_severity`) + today's niggles. `set_record`
  + the `mech_daily` triggers are untouched (history preserved).
- **`ProfileScreen.tsx`** — a PROFILE MANAGEMENT section: Alert-confirmed slot
  switcher + a high-contrast "DELETE CURRENT BLOCK & STATE" button; a slot-keyed
  `useEffect` resyncs the free-text fields on switch.
- **`verify:db [15]`** — *executes* the wipe and asserts ZERO orphans across
  session/slot/override/meta/severity AND that `set_record` is preserved; plus
  the 4-slot seed (one active), the CHECK, and 013 idempotency.
- **Adversarial review (8 agents):** 3 confirmed HIGH, all fixed — (1) switch
  atomicity gap → the `athlete_profile` load moved INTO the transaction; (2)
  `profileFromJsonString` accepted out-of-domain enums → now validated against
  the enum tables; (3) ProfileScreen injury/mobility text went stale after a
  switch (would write the old profile's notes into the new one) → slot-keyed
  resync. 0 rejected.
- **Gates:** `npm run verify:all` — all 11 green (memory 450.1 MiB).
- Not committed — Steps 3-6 held in the working tree pending the on-device check.
  (Committed `c355b79`, merged to master via PR #2 after the on-device check.)

## Entry 0015 — 2026-06-15 · Phase 13, Step 1 (condition multipliers & schema)

> Note: a provisional Phase 12 Step 7 (hard wipe) was committed on `phase-12-step-7`
> with working ledger entries 0015/0016, then ROLLED BACK (PR #3 closed, never merged).
> master's stable boundary is Step 6 (`c355b79`), so this Phase 13 entry reuses 0015.

### Input G(x)

```
SYSTEM ARCHITECTURE MANDATE: PHASE 13, STEP 1 (Condition Multipliers & Schema)
Opus, we are officially initiating Phase 13: The Movement Directory & Condition Weights. The Lead Architect has identified that the physical implement used (e.g., Kettlebells, Earthquake bars, Bands) mathematically alters the difficulty curve, stability requirement, and CNS load of a base movement.
We must build the data and inference layer for this before touching the UI.
THE BOUNDARY INVARIANTS:
1. Additive Schema (Migration 014): Create a new SQLite migration `014_movement_prefixes.sql`. Define a strict `movement_prefix` table. It must include fields for `prefix_name` (e.g., "Kettlebell", "Banded", "Bottom-Up"), `cns_load_modifier` (REAL, e.g., 1.2 for higher CNS tax), and `stability_requirement_modifier` (REAL).
2. Seed the Table: Include a SQL seed script within the migration to populate 4-5 baseline prefixes based on the Architect's examples (Kettlebell, Banded, Earthquake Bar, Chains).
3. The Pure Math Engine: In the `inference` package, create a pure TypeScript utility (e.g., `conditionEngine.ts`). Write a deterministic function `calculateEffectiveLoad(baseLoad, prefixModifiers)` that takes a base movement's metrics and multiplies them by the applied prefix constraints.
4. Type Definitions: Update `types.ts` to include the `MovementPrefix` interface and ensure `PlannedSession` movement slots can optionally accept an array of `applied_prefixes`.

EXECUTION:
Write the SQL migration, update the TS schemas, and build the inference utility. Do NOT build the React Native UI for this yet. Run the 11-Gate CI `verify:all` suite to ensure the new schema and types do not break existing block generation. Conclude with the MASTER LEDGER ENTRY.
```

### Output F(G(x))

- **Premise corrections (surfaced + confirmed before building):**
  - `MovementPrefix` already exists as a string-union TYPE (`types.ts`, the implement
    tokens). The mandate's "`MovementPrefix` interface" would be a duplicate identifier
    → the new interface is **`MovementPrefixCondition`** (prefixName + the 3 modifiers).
  - The codebase already has a prefix/implement model (`MOVEMENT_PREFIXES`,
    `PREFIX_TO_IMPLEMENT`, `movement_detail.supported_prefixes`) with an explicit
    "one source of truth, not a third vocabulary" rule (010). Operator chose
    (AskUserQuestion) the **unified** model: `MOVEMENT_PREFIXES` EXTENDED with
    `'Earthquake Bar'`,`'Chains'`,`'Bottom-Up'`; `movement_prefix.prefix_name` ∈ that
    one vocabulary (machine-checked). KB(=Kettlebell)/Banded gain weights too.
  - The slot type is `PlannedSlotPlan` (not `PlannedSession`) — got an OPTIONAL,
    TS-only, non-persisted `applied_prefixes?: readonly MovementPrefix[]`.
  - Added a third `difficulty_modifier` beyond the two named modifiers, because the
    mandate prose calls out the "difficulty curve" as a third amplified dimension.
- **`014_movement_prefixes.sql`** (new) — STRICT `movement_prefix(prefix_name PK,
  cns_load_modifier, stability_requirement_modifier, difficulty_modifier)`, each
  `REAL NOT NULL DEFAULT 1.0 CHECK (> 0)`; seeds 5 conditions (KB, Banded, Earthquake
  Bar, Chains, Bottom-Up). Additive + idempotent. Registered in `migrations.ts`,
  runner `SENTINELS`, and the load lists of verify_schema/store/migrations/blocks.
- **`conditionEngine.ts`** (new, inference) — pure deterministic
  `calculateEffectiveLoad(baseLoad, prefixModifiers)` → `{baseLoad, effectiveLoad =
  base × Πdifficulty, cnsLoad = base × Πcns, stabilityDemand = Πstability,
  appliedPrefixes}`. Total/safe (empty → identity; non-finite/negative base → 0;
  modifier ≤ 0 guarded). Fixed rounding (load 2dp, stability 4dp). **Standalone — NOT
  wired into block generation**, so existing generation is untouched. Exported in
  `index.ts`.
- **`types.ts`** — `MOVEMENT_PREFIXES` + `PREFIX_TO_IMPLEMENT` extended (Earthquake
  Bar→barbell, Chains→barbell, Bottom-Up→kettlebell); `MovementPrefixCondition` added.
- **Verifiers** — `verify:db [16]` (seed=5, all 3 CHECK(>0) exercised, PK rejects dup,
  014 idempotent) and `verify:blocks [15]` (5 seeded, every prefix_name ∈
  MOVEMENT_PREFIXES, conditionEngine identity / single-prefix fold / 2-prefix
  order-independent compound pinned to seeds / negative+NaN clamp). `conditionEngine.ts`
  added to `build:inference-test`.
- **Adversarial review** (`p13s1-condition-engine-review`, 7 agents / 4 dimensions):
  3 findings, **all confirmed (1 MEDIUM, 2 LOW), 0 in production code** — all
  verifier-completeness gaps, all fixed: (MED) [16] only exercised the cns CHECK →
  now all 3; (LOW) compound difficulty not pinned to seeds → pinned; (LOW) duplicate
  `[13]` section label → renumbered `[15]`.
- **Gates:** `npm run verify:all` — all 11 green on the first run; still green after the
  verifier hardening. Existing block generation unaffected (conditionEngine standalone).
- Not committed / not pushed — no UI yet (Step 2), and the push gate stands.
  (Update: committed `91a1eef` on branch `phase-13` at the start of Step 2.)

## Entry 0016 — 2026-06-15 · Phase 13, Step 2 (prefix UI & dynamic execution)

### Input G(x)

```
SYSTEM ARCHITECTURE MANDATE: PHASE 13, STEP 2 (Prefix UI & Dynamic Execution)

Opus, excellent work on Step 1. The structural invariants and premise corrections (MovementPrefixCondition, PlannedSlotPlan, and the difficulty_modifier) are approved.

First, commit Step 1 locally to seal the foundation. Then, execute Step 2: wiring the mathematical condition engine into the Active Session UI.

THE BOUNDARY INVARIANTS:

State Hydration: Update the Zustand store to load the movement_prefix table into memory at boot, storing them strictly as MovementPrefixCondition objects.

Session UI Integration: In the Active Session screen, add a lightweight, high-contrast selector to the active movement slot (working off PlannedSlotPlan). It must allow the user to toggle prefixes (e.g., KB, Banded).

Dynamic Math Execution: When a prefix is toggled, instantly pass the base movement data through calculateEffectiveLoad() in conditionEngine.ts. The UI must dynamically display the three altered vectors: Effective Load, CNS Load, and Stability Demand.

Historical Persistence: Update the set_record schema/insert logic. When a set is logged, the applied_prefixes array AND the resulting mathematical multipliers MUST be persisted to the historical record to ensure Conservation of Volume is accurately tracked over time.

EXECUTION:
Write the pure TypeScript React Native component updates, Zustand store actions, and set_record insertion logic. Rely exclusively on the types established in Step 1. Run the 11-Gate CI verify:all suite to ensure no strict type bounds are violated. Conclude with the MASTER LEDGER ENTRY.
```

### Output F(G(x))

- Committed Step 1 first (`91a1eef`, branch `phase-13`) as instructed, then built Step 2.
- **Premise corrections (surfaced):** (1) `set_record` (001) is shipped + append-only
  with a GENERATED `tonnage_kg` + the `mech_daily` rollup triggers feeding readiness;
  `ALTER ADD COLUMN` breaks self-heal — so "update the set_record schema" became a 1:1
  **side-car** (the 009/010 precedent), not new columns. (2) **`mech_daily` /
  readiness left untouched** — "Conservation of Volume" is satisfied by persisting
  `effective_load_kg` (+ compound multipliers) per set (recoverable); baking effective
  volume into the readiness rollup would be a separate, higher-risk change, not made.
- **`015_set_prefix.sql`** (new) — STRICT `set_prefix(set_id PK REFERENCES set_record
  ON DELETE CASCADE, applied_prefixes TEXT CHECK json_valid, cns/stability/difficulty
  modifiers REAL CHECK > 0, effective_load_kg REAL CHECK >= 0)`. Additive + idempotent.
  Registered in `migrations.ts`, runner `SENTINELS`, and all four verifier loaders.
- **`useStore.ts`** — `movementPrefixes: MovementPrefixCondition[]` hydrated at boot
  (validated against `PREFIX_SET`, mirroring the other row mappers); `logSet` gained
  `appliedPrefixes?` → routes the base load through `calculateEffectiveLoad` and writes
  the compound multipliers + effective load to `set_prefix`; **`editSet` re-syncs the
  side-car** from the persisted token list so effective volume stays accurate after an
  edit (raw `mech_daily` already corrected by `trg_set_record_au`).
- **`SessionScreen.tsx`** — a high-contrast **CONDITIONS** multi-toggle row (separate
  from the existing single-select IMPLEMENT row) over the hydrated prefixes; a live
  **Effective Load / CNS Load / Stability** vector readout via `calculateEffectiveLoad`;
  LOG passes the toggled conditions to `logSet` then clears them; reset on movement
  switch. Design-system primitives only, no new libs.
- **`verify:db [17]`** — side-car persistence, all 3 modifier `CHECK(>0)` + the
  `effective_load_kg >= 0` floor + `json_valid`, and the FK `ON DELETE CASCADE`.
- **Adversarial review** (`p13s2-prefix-ui-review`, 8 agents / 4 dimensions): 4 findings,
  **all confirmed (1 MEDIUM production, 1 LOW, 2 verifier), all fixed** — (MED) `editSet`
  left the side-car stale → re-sync added; (LOW) hydration cast unvalidated → `PREFIX_SET`
  filter; (verifier) `[17]` only probed the cns CHECK and never the `effective_load_kg`
  floor → now all four CHECKs exercised.
- **Gates:** `npm run verify:all` — all 11 green on the first run; still green after fixes.
- **Lock & Build (Phase 13 Step 2 deploy mandate):** Step 2 committed to `phase-13`
  and pushed; PR opened to trigger CI + the `athlete-kinetics-apk` build for the
  on-device check. **ACWR/volume bifurcation ratified** — Raw Tonnage = Structural
  Load (`mech_daily`, untouched), Effective Tonnage = CNS/Stability Load (`set_prefix`).
  Do NOT alter the ACWR/readiness math yet; Readiness integration is **Phase 13 Step 3**.


## Entry 0017 — 2026-06-15 · Phase 13, Step 3 (Kinematic Autopilot Implementation)

### Input G(x)

```
SYSTEM ARCHITECTURE MANDATE: PHASE 13, STEP 3 (Kinematic Autopilot Implementation)

Opus, we have cleanly merged the Phase 13 Step 2 branch into master. The 015_set_prefix side-car infrastructure is locked down and verified. We are now executing Step 3: compiling the discrete-time Kinematic Autopilot engine into our inference core.

The 33-page mathematical derivation and algorithm blueprint derived by our pure math functor (DeepSeek-R1) is located locally in the workspace at: ./docs/Kinematic_Autopilot_Derivation.pdf. Read it token-for-token.

THE BOUNDARY INVARIANTS:

Implement Trailing Flaw Detection (F): Build the pure TypeScript logic in the inference package to process a 3-week trailing window of logged sets exactly as defined in Section 2 of the PDF. It must calculate the target-vs-actual RPE Error Delta (deltaE) over our compiled pattern matrices, utilizing the effective_load_kg tracked in the 015_set_prefix side-car.

Implement the Bounded Control Action (u_{t+1}): Write the localized code for deriveControlAction(report, profile, macroPhase). You MUST enforce the strict Proportional-Integral (PI) anti-windup bounds from the paper: snap all prescription modifications cleanly to LOAD_MODIFIER_LITERALS, clamp set adjustments to +/-1 per pattern (max +2 sets accumulated overall across the block), and respect Halt Supremacy (dLoad_p = 1.0 if halt === true).

Preserve Database Rollups: You are explicitly prohibited from editing the backward-looking mech_daily database rollup triggers. This autopilot calculates adjustments for the forward-looking prescription layer only. Volume history must remain completely pure.

Edge-Safe Execution: No external libraries or high-overhead array wrappers. It must compile down to raw, lightning-fast JS arithmetic arrays running well within our 450MB Hermes memory ceiling.

EXECUTION:
Hand-translate the calculus and anti-windup algorithms from the local PDF into conditionEngine.ts and blockGenerator.ts (or the appropriate new isolated modules within /inference). Run the 11-Gate CI verify:all suite to validate type-safety and structural invariance. Output the standard MASTER LEDGER ENTRY block upon successful execution.
```

### Output F(G(x))

- **Source handling / premise corrections (surfaced):** (1) the cited path
  `./docs/Kinematic_Autopilot_Derivation.pdf` (33 pages) does not exist — the
  real file is `docs/Kinematic Autopilot Math Derivation - DeepSeek.pdf` (31
  pages). (2) This environment can't render PDFs; `pypdf` text-extraction
  **dropped the reciprocal** in the attenuation weight. The operator supplied a
  clean mirror `docs/Kinematic_Autopilot_Derivation.md.txt`, used as the source
  of truth: `w_p = mean( 1 / max(1, eff/base) ) ∈ (0,1]` — a hard condition
  ATTENUATES (not amplifies) the deficit reading, matching §4.1 intent. (3)
  **Scope:** this mandate redefines "Step 3" as the forward-looking PRESCRIPTION
  autopilot that explicitly PRESERVES `mech_daily`/ACWR — NOT the
  effective→readiness integration (that stays deferred; see DEVIATION_LOG).
- **`kinematicAutopilot.ts`** (new, isolated inference module — mandate permitted
  "new isolated modules"; keeps the verified Step-6 boundary untouched, mirrors
  how `conditionEngine` landed standalone in Step 1). Pure hand-translation of
  the derivation: **`F` = `detectFlaws`** — per-pattern φ ∈ [−1,1] from an
  EMA-recency-weighted (`ω_i=λ^(20-i)`, λ=0.88) deficit/headroom accumulation
  (`P` carries condition-attenuation × capped-ΔE × injury-attenuation
  `max(0,1−j/10)`; `N` is headroom magnitude with NO injury term), a `D_norm`
  deadband, a `tanh` trend over disjoint old/recent windows, the 0.7/0.3 blend,
  and a thin-data/injury classification. **`u_{t+1}` = `deriveControlAction`**
  (φ-band table → bounded `{dLoad,dSet,dRpe,prefBias}`; 4-trigger monotone
  override; halt → fully neutral; anti-windup budget ≤ +2 sets to the
  most-headroom patterns) + **`deriveDailyAdjustment`** (min-composition →
  `AdjustmentVector`, snapped into the shipped literal domains). Constants
  (`FLAW_DETECTION_CONSTANTS`, `CONTROL_AUTHORITY`) + `snapToLiteral` exported.
  Standalone — NOT yet wired into `generateBlock` (deferred, like Step 1).
  Added to `index.ts` and `build:inference-test`.
- **`verify:autopilot` (the 12th gate)** — ~60 checks proving all six derivation
  invariants with analytic φ pins (S_max cancels: constant ΔE=+3→0.7, w=0.5→0.35,
  injury→0.42/caution, recency-only→0.7009), control-law table incl. inclusive
  ±0.4/±0.15 boundaries, anti-windup ranking, domain closure, and edge/fail-safe.
- **Adversarial review** (`p13s3-autopilot-review`, 13 agents / 4 dimensions):
  the run was **truncated by an Anthropic session limit** (the per-finding
  verify agents died), so the workflow's `confirmed:[]` was NOT trustworthy —
  I retrieved the completed reviewers' **17 findings** from the transcripts and
  self-adjudicated each against code + derivation. **3 genuine PRODUCTION
  defects, all fixed:** (HIGH, real invariant-2 violation) a severe niggle on
  `<5` logged days collapsed to flawClass `'neutral'` (thin-data gate precedes
  the injury gate) and the φ-ladder then RAISED load into the injury → fixed by
  surfacing `maxJointSev` and applying the §u injury override + confidence
  pre-gate independently of the class; (HIGH, fail-danger) a non-finite φ fell
  through the φ-ladder's terminal `else` into the RAISE row → leading
  `Number.isFinite` fail-safe; (MED) daily `rpe_cap` clamped to `[5,10]` not
  `base_rpe_cap`, letting headroom push the session ceiling +0.5 over the
  athlete's configured max → clamped to `base_rpe_cap` (resolves the
  derivation's §2-vs-§4 inconsistency conservatively). Plus NaN/Inf/negative-w
  input sanitization in `F`, `tanh` arg-clamp (exp-overflow safe), disjoint
  trend windows, and ~8 verifier false-confidence gaps closed (tautological
  subset checks replaced with produced-value assertions; recency direction,
  deadband, inclusive boundaries, N-asymmetry, and anti-windup ranking now
  pinned; a behavioural invariant-6 tripwire proving `F` ignores acwr/acute/
  chronic). The LOW signature-divergence finding was already documented in
  DEVIATION_LOG.
- **Gates:** `npm run verify:all` — all **12 green** on the first full run; still
  12 green after the review-driven hardening. `typecheck` (app strict tsconfig,
  which compiles the module) and `verify:memory` (450 MB) included.
- Not committed / not pushed — the on-device-check push gate stands; no UI/block
  wiring yet (autopilot is standalone, exactly as `conditionEngine` shipped in
  Step 1).


## Entry 0018 — 2026-06-15 · Phase 13, Step 4 (Autopilot Integration & Block Wiring)

### Input G(x)

```
SYSTEM ARCHITECTURE MANDATE: PHASE 13, STEP 4 (Autopilot Integration & Block Wiring)

Opus, Ledger Entry 0017 is locked, verified, and accepted. Your logic adjudication on the non-finite phi and the thin-data niggle bypass was exceptional defensive engineering.

We are now executing Step 4: Wiring the isolated kinematicAutopilot.ts into our forward-looking block generation engine.

THE BOUNDARY INVARIANTS:

The Block Generator Intercept: Import deriveControlAction into blockGenerator.ts (or the exact module responsible for generating the 4-week JSON plan).

State Hydration: Ensure the detectFlaws (F) trailing 3-week window correctly pulls its history from the mech_daily and 015_set_prefix data stores without triggering a heavy n+1 SQLite query cascade. Use an optimized, flat-array projection if possible to respect the Hermes 450MB limit.

Immutability of History: The wiring MUST NOT alter past completed sessions. The deriveDailyAdjustment modifications must map strictly to the forward-facing AdjustmentVector for future days.

Halt Supremacy Flow: If the autopilot outputs halt === true (from severe joint load or safety overrides), the block generator must instantly snap to the neutral recovery template and drop the athlete's working volume down, bypassing any standard progressive overload loops.

EXECUTION:
Wire the module. Run the verify:all 12-Gate CI suite. If the determinism bound holds and all 12 gates remain green, output the final diffs and your standard MASTER LEDGER ENTRY for Phase 13, Step 4. Do not touch the React Native UI components yet; limit this strictly to the TS inference pipeline and DB state mapping. Let's prep this for an on-device APK test.
```

### Output F(G(x))

- **Premise corrections (surfaced):** (1) `mech_daily` is a DATE-keyed
  cross-movement rollup with no pattern dimension — it CANNOT source per-pattern
  ΔE. Per the derivation's §1 read budget, the per-pattern signal comes from
  `set_record ⋈ session(date) ⋈ movement(pattern) ⋈ planned_slot(target_rpe) ⋈
  set_prefix(effective_load_kg)` + `niggle`; `mech_daily`/`state_vector` are
  read-only calendar/ACWR context (invariant 6 held). (2) No FK links a logged
  `session` to a prescribed `planned_session` — ΔE matches by
  `(session_date, movement_id)`. (3) The daily-grain `deriveDailyAdjustment`
  composition into the live `derivePrescription` chain is DEFERRED (separate
  safety review); the BLOCK-level corrections are the forward write.
- **`blockGenerator.ts` — the Block Generator Intercept** (invariant 1). Imports
  `deriveControlAction`; `BlockInput` gains an optional `flawReport`. When
  present the generator derives a bounded `ControlAction` and applies per-pattern
  `dRpe` (added then re-clamped to `[5, base_rpe_cap]`/rehab≤7/0.5 grid) and
  `dSet` (−1 on every non-deload slot; +1 ONCE per pattern, so the block-wide
  `+2` cap holds) — NEVER on the deload week or locomotion. A `globalGuardrail.
  halt` snaps the block to a **recovery template** (every week deloaded, volume
  dropped, progressive overload bypassed, all corrections suppressed). New
  `BlockPlan.recovery` / `autopilotAdjusted`. Absent `flawReport` ⇒ byte-identical
  to the pre-Step-4 block.
- **`autopilotProjection.ts` (new) — State Hydration** (invariant 2). Pure
  `buildPatternWindow(windowDates, setRows, niggleRows)` pivots the flat grouped
  rows into `PatternDailyDelta` aligned to the calendar, gap-tolerant, O(window).
- **`useStore.ts` — DB state mapping.** `generateNewBlock` runs a bounded,
  n+1-free read (ONE grouped per-(date,pattern) set aggregate + ONE windowed
  niggle scan over the FIXED 21-calendar-day grid), builds the window, derives a
  niggle-halt guardrail (`severity ≥ haltMin`), `detectFlaws → generateBlock`.
  Immutability (invariant 3): the path only SELECTs history and INSERTs future
  `planned_*` — never `session`/`set_record`.
- **Verification (no new gate; `verify:all` stays 12):** `verify:blocks [16]`
  (halt recovery + FLAT no-overload, corrections, anti-windup total-set-delta,
  deload-sacred, backward-compat, thin-data safety), `verify:autopilot [11]`
  (projection pivot + end-to-end), `verify:store` (EXECUTES the ΔE/attenuation
  SQL on seeded rows + immutability/n+1/bounded source tripwires).
- **Adversarial review** (`p13s4-wiring-review`, 3 dims): block-wiring reviewer
  found **0** issues; the projection/verifier reviewers surfaced findings I
  adjudicated. **2 real production fixes:** (HIGH) the window was indexed by
  sparse `state_vector` dates → dropped rest-day niggles and distorted the EMA
  recency grid → now the FIXED 21-calendar-day grid with neutral placeholders;
  (HIGH) niggle day-bucketing used SQLite UTC `date()` while the whole pipeline
  is LOCAL → now `localDateOf`/`startOfTodayMs`, consistent with the
  active-niggle path. Plus ~5 verifier false-confidence gaps closed (the store
  ΔE/attenuation/niggle SQL is now EXECUTED against seeded rows, not just
  PREPARE-checked; immutability + n+1 + recovery-no-overload now machine-pinned).
  One MEDIUM (`MIN(target_rpe)` cross-block on mid-cycle regeneration) accepted
  as a bounded limitation (DEVIATION_LOG).
- **Gates:** `npm run verify:all` — all **12 green** (first full run had the two
  window bugs latent; green after the review fixes + verifier hardening).
- Not committed / not pushed — prepped for the on-device APK test; the push gate
  stands. UI untouched (mandate).

---

## Entry 0019 — 2026-07-12 · Phase 15 (Onboarding Questionnaire + Coach Mode) — Cowork session

### Input G(x)

```
New update on plan. Im leaving the forge blue print alone for now. Since ive got
my you until 5pm tomorrow could we start buliding in co work. I want to use
cowork and claude code via vscode like we had setup from the start and to push
from there.
[Scope answers: Max distance then prepare for handover, the goal is to get the
most out of your intelligent design. I want it to compete with other coaching
apps (please view juggernaut ai 2.5 to see our competition)]
[Governing doc: Project Overview/Phase manager/PHASE_PLAN_rev4_FORGE.md,
Phase 15 -> P16, FORGE retarget deferred]
```

### Output F(G(x))

- **Audit finding first:** the update.txt mandate had ALREADY landed (006/007
  athlete_profile IS the 10-category questionnaire; training_age IS the
  experience tier; 013 slots = profile presets). P15 S1 rescoped to zero
  migrations.
- **Coach Mode = one SQLite FILE per athlete** (true history isolation, the
  mandate's "different people at the same time"). New: `athleteRegistryCore.ts`
  (pure, invariant-checked) + `athleteRegistry.ts` (document-dir JSON IO) +
  `openKineticsDb(dbName)` param + store actions switchAthlete/createAthlete/
  renameAthleteEntry/deleteAthlete + PER_ATHLETE_RESET state hygiene.
  DEVIATION_LOG records why this is a side-file, not a migration.
- **Onboarding questionnaire** (`OnboardingScreen.tsx`): one decision per
  screen, plain-language copy, tier-aware path — a BEGINNER never sees the
  energy-system/periodization screens (safe defaults applied); single atomic
  completeOnboarding() commit; demo-athlete escape hatch. Routed in App.tsx by
  `updated_at_ms = 0` (never-saved profile). Competitive bar: JuggernautAI 2.5
  onboarding reviewed 2026-07-12.
- **Coach Mode UI** in ProfileScreen: collapsed section; per-athlete rows
  (switch/rename/delete with double-confirm), add-athlete → fresh DB → wizard.
- **Gates:** verify:all now 13 (new `verify:coach`, 11 registry-invariant
  checks). Local run: 11/13 green; verify:db green under modern sqlite
  (sandbox libsqlite pre-3.38 STRICT/REAL quirk documented); semantic/embedder
  deferred to CI (sandbox blocks the HF model fetch; zero semantic-layer
  changes in this diff). Log: test/results/p15_local_gates_2026-07-12.md.
- **Incident (tooling, not code):** the cowork file bridge replayed this
  session's edits to pre-existing files truncated/duplicated. Recovered
  deterministically: git restore of the 7 tracked files + idempotent scripted
  re-patch + full gate re-run. Session-created files were never affected.
- Committed locally in 4 scoped commits; push = Francis (VS Code), CI must
  show 13/13 + APK artifact before on-device test.

---

## Entry 0020 — 2026-07-15 · Autopilot Provenance Fix (verify:store target_rpe column mismatch)

### Input G(x)

```
Could you please explore the code base. The hand over attached gives a summary of what has been shipped. Currently weve just finished phase 16 (movement library). Please ignore the rest of phases 17,18,... we are working on fixing another problem. I would like to use you to code for me, what are you current capabilities? Could you show me by telling me what were currently working on
```

### Output F(G(x))

- Fix column mismatch in `apps/mobile/test/verify_store_sql.mjs` where `set_target` table inserts were using `planned_slot_id` instead of `source_planned_slot_id`, and missing the required `provenance_kind` column.
- Run `npm run verify:all` via cmd to confirm all 16 verification gates are green.

---

## Entry 0021 — 2026-07-15 · Phase 13 Step 5: Durable Prescribed-Target Provenance

### Input G(x)

```
You are now the implementation owner for Phase 13 Step 5: durable prescribed-target provenance for the Kinematic Autopilot.
```

### Output F(G(x))

- Modified `022_set_target.sql` to define `session_origin`, `session_plan_slot` (with `planned_reps` and overrides), and `planned_slot_disposition`.
- Updated `useStore.ts` store interfaces (`PlanSlot`, `KineticsStore`, `LoggedSet`) to support `sessionPlanSlotId`, original movement/date, reps, and overrides.
- Updated `startSession` to atomic-write `session_origin`, `session_plan_slot`, and `planned_slot_disposition` records, resolving consumption logic and duplicate same-day sessions.
- Updated `addPlanSlot`, `swapMovement`, `applyRegression`, and `applyDaySwap` to use the durable `session_plan_slot` table and handle duplicate movements and dispositions.
- Refactored `SessionScreen.tsx` active session tabs, target display, and logging triggers to query the durable `sessionPlan` (composed with the daily RPE safety cap) and pass `activeSessionPlanSlotId` to `logSet`.
- Verified all 16 verification gates (including the repaired `verify:store`) are fully green.

---

## Entry 0022 — 2026-07-15 · Phase 17 Utility-First Guided Sessions

### Input G(x)

```
Implement Phase 17: a deterministic guided-session runner, durable session/UI
preferences, curated coaching content, and a high-focus mobile UI that replaces
dashboard clutter with progressive disclosure and a vertical session timeline.
```

### Output F(G(x))

- Begin from the existing 022 provenance baseline without modifying shipped migrations.
- Preserve the user-owned dirty worktree and add only Phase 17-scoped files and edits.
- Deliver pure runner hardening, additive persistence, coaching/timed-set support,
  utility-first READY/COACH/SESSION surfaces, and verification coverage before the
  required physical-device visual checkpoint.

---

## Entry 0023 — 2026-08-26 · Commit the R8 mobile layout-fix phase

### Input G(x)

```
Could we commit the last phase before making any new workorders?
```

### Output F(G(x))

- Committed the previously uncommitted layout phase on `codex/pikemethods-closed-beta-r8`
  (working tree had been held uncommitted under the "Do not commit" instruction recorded in
  `HANDOFF_STATE.md`; the owner released that hold with this prompt):
  - `apps/mobile/src/layout/statusBarPadding.ts` (new) — `statusBarPaddingTop` keeps a 24 px
    minimum Android status-bar inset when an edge-to-edge runtime reports `StatusBar.currentHeight`
    as 0, instead of padding by the reported zero.
  - `apps/mobile/src/App.tsx` — root padding now calls that pure function.
  - `apps/mobile/src/components/ui/Chip.tsx` — chip label held to one line (`numberOfLines={1}`),
    no font shrinking, so an enlarged system font keeps its scaled size.
  - `apps/mobile/src/screens/BlockScreen.tsx` — COACH trajectory week row restructured from
    `row` to `column` with a full-width day rail; day tokens (`Done`, `Stopped`, `Today`, focus
    abbreviations) get `numberOfLines={1}` + `adjustsFontSizeToFit` at `minimumFontScale={0.7}`,
    eyebrow type and zero letter-spacing; `testID`s added for the week row and day rail.
  - `apps/mobile/test/components/FocusScreens.test.js`,
    `apps/mobile/test/components/UIComponents.test.js` — behavioural coverage pinning the
    one-line/shrink-to-fit contract, the column layout, and the four `statusBarPaddingTop` cases.
- Owner and audit artifacts deliberately left untracked and out of the commit, per the R8 work
  order Phase 1 rule that no audit-only file enters a commit: `TASK.md`,
  `STEVE_OX_ALPHA_PIKEMETHODS_R8_WORK_ORDER.md.txt`, `audit_task_b.mjs`.
- Gates: `npm run typecheck` exit 0. `npm run verify:ci` green — 21 gates + typecheck, with
  `verify:components` at 17 suites / 218 tests (up from the 14 / 197 recorded at the Work Order
  E & F acceptance point).
- `npm run verify:memory-contract` fails checks [A] and [D]. **Pre-existing and unrelated to this
  diff** — `tools/memory-audit/audit.mjs` reads only `tools/memory-audit/budget.json`,
  `packages/inference/assets/phrase-codebase.vectors.json` and the root `package.json`, none of
  which this phase touches. The component envelope (471,936,000 B) sits in the REVIEW_BAND between
  the 450,000,000 B target and the 536,870,912 B hard ceiling, which the 2026-08-24 ratification
  permits only with a physical-device evidence packet; `AK_MEM_EVIDENCE_SESSION` was not supplied.
  `.github/workflows/ci.yml` documents both checks as structurally excluded from CI and reserved
  for the owner's pre-release run.
- Not pushed. Push remains gated on the owner's on-device check.

---

# Retrospective Backfill — Entries 0024–0039

Appended 2026-08-26. Covers the 92 commits between Entry 0022 (2026-07-15) and
Entry 0023 (2026-08-26), a period during which the ledger was not maintained.

**Read this before using these entries as ledger data.** This ledger's contract is that
`Input G(x)` is the exact verbatim prompt. **None of the prompts for this period survive.**
The work ran through Codex/Sol, Antigravity, Gemini and Steve sessions whose transcripts are
not in this repository, and no prompt text was captured at the time. Paraphrasing a prompt into
the input slot would corrupt the intent→output correspondence the ledger exists to record, so
every entry below marks its input `NOT RECOVERABLE` and names whichever tracked mandate document
survives in its place.

`Output F(G(x))` in this section is reconstructed from commit metadata, commit bodies, and the
tracked handover / work-order / run-log documents. All of it is repository evidence; none of it
is inferred beyond what those sources state.

Entry numbers reflect the order these records were **written** (the ledger is append-only), not
the order the work happened. Each entry carries the true date of its commits.

---

## Entry 0024 — 2026-07-15/16 · Phase 17 guided-session runner, UI primitives, migration 023

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: none tracked. Closest record: HANDOVER_2026-07-14_OVERNIGHT.md.
```

### Output F(G(x))

- `98434e2` — session target provenance snapshot: migration 022 tables for frozen session, slot
  and set-target provenance; store/screen wired to slot-aware logging and substitution; autopilot
  confidence adjusted so target-less days do not count toward observations.
- `29e8e21` — Phase 17 runtime and UI surface: deterministic session runner (serialization,
  replay, checkpointing, validation), persistence hooks and runner-checkpoint wiring, migration
  023 (session targets, runner checkpoint, UI prefs, time policy, coaching intent),
  `FocusPrimitives`, Readiness/Coach/Session/Profile refactors for session modes, band ladder,
  rest timer and subject reports; coaching-content generator plus tests; verify gate count raised.
- `8e93041` — ledger updated with the audit P1–P2 fixes. **This is the last ledger maintenance
  before the present backfill.**

---

## Entry 0025 — 2026-07-17 · Phase 17 content and migration safeguards (024, 025)

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: none tracked.
```

### Output F(G(x))

- `ae17922` — migration 024 enforcing the ratified equipment-prefix fixes (DB bench / shoulder
  press, banded Pallof), wired into migration and store SQL verification. Coaching-content
  generation tightened with full-coverage checks, generic-intent rejection, and staging↔manifest
  fingerprint validation; cross-platform Python launcher added for verify scripts; runner
  regression tests for recovery, rest-day, runner-state and substitution behaviour.
- `8d18af4` — migration 025 seeding reviewed movement coaching intent plus movement-detail
  instructions, cues and video URLs, including the approved Feet-Elevated Push-Up video
  replacement. Attested content hashes recorded in the manifest; completeness asserted at
  124 records with idempotent re-application coverage.

---

## Entry 0026 — 2026-07-21 · pikeMethods UI skin system and Phase 18 session outcomes (026)

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: WO_UI_SKIN.md, DESIGN_BRIEF_pikeMethods.md (both tracked).
```

### Output F(G(x))

- `d69d8ef` — pikeMethods visual foundation: Archivo font assets, canonical theme tokens, shared
  UI primitives, a new Library screen and tab, broad screen refactors and test coverage. Landed
  Phase 18 training-decision recording end to end: migration 026 (immutable set dose and session
  outcome tables plus triggers), the pure outcome classifier in `packages/inference`, store
  finalization wiring, and new outcome/migration verification gates.
- `03c6938` — ProfileScreen bug fix.

---

## Entry 0027 — 2026-07-27 · Capability pipeline and routine template builder checkpoints

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: none tracked.
```

### Output F(G(x))

- `4a471e7` — capability resolution, progression-aware selection, deterministic history import,
  routine foundations, readiness safeguards, measured analytics, and the mobile navigation
  baseline.
- `6ff5449` — durable routine template builder.
- `8935f60` — audit remediation against `6ff5449`: macro-cycle continuity, template delete
  transaction, conditional role gate.

---

## Entry 0028 — 2026-07-27/28 · Phase 19B overnight run (T1–T14, F1–F3)

### Input G(x)

```
NOT RECOVERABLE — the per-task mandates (T0–T14, F1–F3) were issued in an
overnight run and were not captured verbatim.
Surviving record: PHASE19_RUN_LOG.md (tracked) — per-task commit, files,
anchors, gates, negative test, decisions, and items flagged for Francis.
That log is an OUTPUT record, not the input prompts.
```

### Output F(G(x))

- Baseline `8935f60`; every task self-verified against `verify:all` with a named negative test.
- `ec48d31` T1 — stray CR removed from BlockScreen.
- `d07c537` T2 — `latestLoadMap` reworked to a per-movement index seek bound by library size
  rather than by history length.
- `25be55f` T3 — `resolveGoalRung` bounded by a 180-day capability evidence window;
  `CAPABILITY_EVIDENCE_WINDOW_DAYS` added and the signature changed to take a reference date.
  **Flagged at the time as an athlete-visible behaviour change awaiting ratification.**
- `26ff2fd` T4 — `chainProjection.ts`: pure derivation of progression chains from the capability
  graph, throwing on cycles, branching and disconnected components.
- `51b6eb9` T5 — store writer and gate for capability edge attestation.
- `f4d7183` T6 — capability verdicts and human-readable reasons surfaced in LibraryScreen,
  SessionScreen and store errors.
- `56091b1` T7 — `AK_HISTORY_V1` documentation, sample template, automated gate.
- `efc1284` T8 — archived training block state surfaced in BlockScreen, with component test;
  corrected by `3483c9f` to use a verbatim archived block copy.
- `b6a527b` T9 — gate count reconciled across verification scripts; corrected by `0c46898` to
  19 gates + typecheck in `AGENT_WORKFLOW.md` and `ci.yml`.
- `6baf2fc` T10 — iOS Apple Health technical design analysis; superseded by `004408e`
  (`ANALYSIS_ios_biometrics_gap.md`) and folded together by `a17c8b3`.
- `13669c3` F1 — false "block started" message suppressed when no active block exists.
- `ff5835a` F2 — history-import example and AI prompt made selectable on screen.
- `c32fd22` F3 — duplicate CI step removed; documentation gate drift check added to
  `verify:store`.
- `ed2c7d0` T11 — `_chain_projection.sql.tpl` added and SQL/TS equivalence proven in
  `verify:pipeline` and `verify:store`.
- `03e2fe4` T12 — capability content ingestion generator and test suite.
- `3128700` T13 — behavioural coverage for the template builder and freeze-refusal paths.
- `9f7279a` T14 — technical analysis of history-file input options and memory footprint.
- `5fcb11f`, `cd46b8a` — `PHASE19_RUN_LOG.md` finalized.

---

## Entry 0029 — 2026-07-28 · Phase 19B closeout: capability content (032), release readiness

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: none tracked.
```

### Output F(G(x))

- `a117772` — capability migration generator CLI wired (`T-A`).
- `3612c23` — migration 032: capability content — 8 chains, 4 major and 12 conditional roles.
- `62b5d32` — `RELEASE_READINESS.md` added.
- `5bf11ba` — agent scaffolding and local scratch gitignored.
- `84f3e7e` — Antigravity SDK project agent harness added.

---

## Entry 0030 — 2026-07-31 · Autopilot stability remediation and the completion observer

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (all tracked): docs/WORKORDER_Sol_autopilot_stability.md,
docs/WORKORDER_autopilot_stability_remediation.md,
docs/WORKORDER_Sol_completion_vs_prescription_observer.md,
docs/PROMPT_Sol_autopilot_stability.md, docs/SWEEP_completion_action_2026-07-31.md.
These are the work-order documents the phase was executed against; they are not
the chat prompt that commissioned them.
```

### Output F(G(x))

- `2a21ded` — kinematic autopilot control loop stabilized.
- `1ec16e0` — explicit actual-RPE evidence now required, so a missing rating cannot be read as
  agreement with the target.
- `af4546d` — dormant completion-action path added: `completionAction.ts`, an independently
  bounded, never-upward control action kept separate from the RPE observer, with no default
  numeric policy.
- `32a457b` — mobile session and coach UI defects fixed.
- `8744c80` — athlete blocks and session controls preloaded.

---

## Entry 0031 — 2026-08-03 · Guided goal programs

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: none tracked.
```

### Output F(G(x))

- `4c5056f` — planned completion derived from outcomes rather than tracked separately.
- `ff72694` — guided goal programs added (migration 033, `training_program` with
  `horizon_kind` / `requested_review_date`).

---

## Entry 0032 — 2026-08-06/07 · Guided-program merge readiness, alignment, WO-UI-3/4 closeout

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: WO_UI_3_4_punchlist.md (tracked),
HANDOVER_WO-UI-2_to_4_for_Fable.md (tracked).
```

### Output F(G(x))

- `0d97f50` — guided programs own their macro progression
  (`starting_macro_block_index + sequence - 1 mod 8`), with preview and committed generation
  sharing one derivation and boundary tests at starts 6/7/8 plus wrap; shared program
  transaction; jest path fix; 16 KB alignment.
- `0068a5b` — Android ELF alignment audit now fails closed.
- `4f064ac` — WO-UI-3/4 punchlist closeout.
- `ab42b0e` — autopilot target attribution persisted (migration 034).

---

## Entry 0033 — 2026-08-07/08 · Four-mode load selection

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (tracked): docs/WO_FOUR_MODE_LOAD.md,
docs/SPEC_FOUR_MODE_LOAD_KIMI.md, docs/PROPOSAL_experience_tiered_load_selection.md.
```

### Output F(G(x))

- `004d1ce` — four-mode load selection ratified in documentation before implementation.
- `617039f` — implemented (`loadSelection.ts`, migration 035 profile load preference).
- `5116ff7` — audit findings closed: production persistence seam used for durable SQLite
  evidence, resolver inputs passed through unchanged, direct-entry boundaries covered,
  active-session authority preserved, canonical Kimi provenance and scenario matrix reconciled.

---

## Entry 0034 — 2026-08-09 · Phase 2A movement library (batches 037–048) and Android boundary

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandate: HANDOVER_2026-08-09_PHASE_2A_MOVEMENT_LIBRARY.md (tracked),
AGENT_WORKFLOW.md section 5 curation contract and section 11 WO-1/WO-3 batch pattern.
```

### Output F(G(x))

- `578b0cd` — Android pre-release boundary hardened.
- `fc020b5`, `a342563`, `90858e0`, `4a9d323`, `ea3d1db`, `332e356` — movement library v2
  batches, migrations 037 through 048, two slots per commit via the batch generator.
- `1fcac30` — Phase 2A movement library completed.

---

## Entry 0035 — 2026-08-12 · Movement corrections, ONNX packaging, coach verification lab

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (tracked): docs/audits/phase-2a-movement-library/OPUS_AUDIT_PROMPT.md,
docs/audits/pre-release-coach-verification-lab/CLAUDE_CODE_AUDIT_HANDOVER.md,
docs/decisions/coach-verification-lab.md.
```

### Output F(G(x))

- `2e223fe` — pre-release movement corrections finalized (migration 049).
- `1854a8a` — ONNX APK and AAB packaging verified in the Gradle build.
- `2f67d56` — ONNX release hardening gaps closed.
- `37a06b8` — supplementary role eligibility converged (migration 050).
- `ebaf784` — hidden coach verification lab added.
- `ef825a7` — coach lab verification handed over.

---

## Entry 0036 — 2026-08-13 · Routine access control, bounded microcycle, embedder supply chain

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (all tracked): HANDOVER_2026-08-13_ROUTINE_CONTRACT_CUTOFF.md,
HANDOVER_2026-08-13_BOUNDED_MICROCYCLE.md,
HANDOVER_2026-08-13_BOUNDED_MICROCYCLE_AUDIT_REMEDIATION.md,
HANDOVER_2026-08-13_EMBEDDER_SUPPLY_CHAIN_PIN.md,
HANDOVER_2026-08-13_EMBEDDER_SUPPLY_CHAIN_PIN_AUDIT_CORRECTION.md,
docs/decisions/ROUTINE_MAJOR_SUPPORT_POLICY.md,
docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md.
```

### Output F(G(x))

- `3870825` — context-aware movement access enforced in routines.
- `046a165` — audit findings closed: SessionScreen's session-wide early blocker was firing on
  any non-available verdict, so an ordinary mid-session niggle blanked the entire active session.
- `6b233b6` — access enforced at the log boundary: `useStore.logSet` is a public action and a
  direct call could write a `set_record` without revalidating the movement.
- `6cfb990` — major RPE projected and support work ranked.
- `f41712d` — uncapped microcycle stress bounded; `d3cab60` closed its audit findings.
- `291183e` — routine legacy-role provenance sealed in migrations.
- `2f4e72e` — embedder model supply chain pinned; `4a95679` closed its audit findings.

---

## Entry 0037 — 2026-08-14/15 · Longitudinal bounds verification and Calibration Policy v1

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (tracked): HANDOVER_2026-08-14_FINAL_AUDIT_RPE_CORRECTION.md,
tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md,
docs/decisions/CALIBRATION_POLICY_V1.md,
docs/decisions/FOUR_LIFT_EQUIVALENT_VOLUME.md.
```

### Output F(G(x))

- `a38ab10` — authored projected RPE ceiling preserved.
- `12da513` — longitudinal bounds verification added; hardened per audit in `7002c24`;
  findings closed in `f6dce82`; P2 closeout and repair summary in `2ed9531`; final audit debt
  cleared in `d726a01`.
- `6727cba` — pre-release calibration acceptance, migration 055, and device evidence. This is
  the commit that lands **Calibration Policy v1**: ACWR made descriptive only and stripped from
  the readiness numerator; the frozen coefficient registry; the optional 21-day return check-in
  with no dose authority; and the ruling that no numeric value enters the engine without owner
  ratification against a source.

---

## Entry 0038 — 2026-08-17/20 · Three-mode builder, schema selection, e1RM series, dated anchor

### Input G(x)

```
NOT RECOVERABLE — no captured prompt.
Surviving mandates (untracked, present in .worktrees/three-mode-workorders/):
00_START_HERE.txt, 01_WORKORDER_A_CHOOSER_AND_SPLIT.txt,
02_WORKORDER_B_LEARNING_LAYER.txt, 03_WORKORDER_C_NEXT_BLOCK_PANEL.txt.
Related tracked decisions: docs/decisions/TRAINING_STRUCTURE_CONVENTIONS.md,
docs/decisions/TRAINING_PROGRESSION_LAYERS.md.
```

### Output F(G(x))

- `a6be1a2` — tiered movement picker (migration 056 + `pickerTiering.ts`), three-mode entry, and
  the learning layer. Backfilled the 21 movements missing a `movement_taxonomy` row so tier
  assignment is total.
- `4b8d8e5` — `SELECTABLE_SCHEMA_TYPES` added and `STEP` retired from selection on
  product-simplification grounds. Recorded reasoning: a loading schema governs one layer only —
  how sets, reps and effort move week to week inside a block — and judging it by long-term
  adaptation is a category error. `WAVE` was subsequently reinstated carrying no evidential claim
  of superiority.
- `a812cee` — `e1rm.ts`: estimated 1RM derived from logged sets by reading the ratified
  `targetPct` translation backwards. No second formula, no new coefficient, so Calibration Policy
  v1 §5 is not engaged. Deliberately observational — no minimal detectable change, no persistence
  window, no notion of a stall, and a set logged without an RPE yields null rather than a
  fallback. **It writes nothing and, as of this entry, is consumed by nothing.**
- `dc1d89a` — a dated goal program now anchors so its peak lands on the date. Previously the
  competition date decided only how many blocks the athlete received.

### Flagged during backfill

`docs/decisions/TRAINING_PROGRESSION_LAYERS.md` §5C cites `getMovementE1rmSeries` at
`useStore.ts:4301`. No such function exists on this branch — `e1rm.ts` has no store wiring and no
UI. The document reads as though an e1RM series is available to the app; it is not.

---

## Entry 0039 — 2026-08-25 · pikeMethods revision-8 closed-test release candidate

### Input G(x)

```
NOT RECOVERABLE as a chat prompt.
Surviving mandate: STEVE_OX_ALPHA_PIKEMETHODS_R8_WORK_ORDER.md.txt — present in
the worktree as an UNTRACKED owner artifact, deliberately kept out of commits per
its own Phase 1 rule that no audit-only file enters a commit. It is the closest
thing to a verbatim input for this phase and is not preserved by git.
```

### Output F(G(x))

- `a276bf1` — audited revision 7 preserved byte-for-byte as an immutable checkpoint against the
  required tracked-diff fingerprint, on branch `codex/pikemethods-closed-beta-r8`.
- `75ef8ba` — revision-8 remediation, R8 sections 2.1–2.7: today-spine calendar derivation with
  recovery-day markers, the `DemoLoadResult` contract, Program Setup guidance messages, the
  Archivo packaging gate, permanent Play identity (`com.pikemethods.training`), and the offline
  manifest posture, with the full Phase 3 test matrix.
- `1edf390` — Gradle lint tasks given an explicit dependency on the Archivo packaging task, which
  Gradle 8.14 implicit-dependency validation was rejecting.
- `125fcf4` — candidate verification accepts an empty `newFiles` array, which is the expected
  shape for a genuinely clean candidate; model size gate hardened.
- `bff0a38` — `android.permission.INTERNET`, injected into production merges by
  `react-native-blob-util`, stripped explicitly.
- `62af2e5` — `MainActivity.getMainComponentName()` returned `AthleteKinetics` while JS registered
  `pikeMethods`, crashing the packaged QA artifact at cold launch. Registered natively.
- `ff6f137` — Kotlin daemon session markers gitignored; they were leaking into the candidate
  manifest's `newFiles` list.
- Phase ends at **HUMAN CHECKPOINT A**: ten owner decisions outstanding (launcher and Play icon
  assets, launch-screen decision, support contact email, privacy-policy and medical-disclaimer
  approval, Play Console account, fee and identity verification, upload-key permission,
  screenshot bundle approval, further QA data-reset permission, and personal on-device
  confirmation). Nothing merged, pushed, uploaded, or credentialed while it is open.

---

## Backfill coverage note

Entries 0024–0039 account for all 92 commits between `98434e2` (2026-07-15) and `ff6f137`
(2026-08-25). Entry 0023 covers `f686d7e` (2026-08-26). No commit in that range is unrecorded.

Sixteen entries carry `NOT RECOVERABLE` inputs. That is the honest state of the record and it is
the cost of the ledger having lapsed for six weeks: the outputs survive in git, the intents do
not. Restoring the isomorphism this ledger is for requires capturing prompts at the time they are
issued, which Entry 0023 onward resumes.

---

## Entry 0040 — 2026-08-26 · Progression evidence remediation and Opus audit corrections

### Input G(x)

```text
Please read Opus reply here , overall accept and please continue your work, but can we run the audits through Hermes using OX alpha, with your output please present a copy paste prompt ready to be sent to the auditor &#x20;

\~\~

Strong work on first read. Let me verify the specific claims rather than take them at face value.
Audited. Verified every claim independently rather than accepting the report.
Audit verdict: ACCEPT
Sol's work is good, and every claim in the completion report held under independent check — I verified rather than took them at face value:



Claim
How I checked
Result



Three doc files, no runtime files
git diff --stat + full untracked enumeration
✓

Audit hashes unchanged
Recomputed SHA-256 on all six artifacts
✓ all six match

51 claims: 3/17/17/14
Tallied the table mechanically
✓ exact

Gates passed
Re-ran verify:blocks + verify:policy myself
✓ both exit 0

No decisions preselected
Read both documents in full
✓ all five "Pending"

e1rm code facts
Grepped all consumers at the pinned baseline
✓ barrel export only



Sol corrected me on three things, and was right each time
This is the part worth your attention.

1. I overreached on "not buildable." My digest said the gaps were "absences confirmed twice" that "cannot be filled from literature at all", and I recommended rewriting §5C to say so. Sol refused, and reframed all four as search-bounded outcomes. Sol is right — two bounded searches failing to find something is not proof it cannot exist. My framing would have hard-coded a false certainty into a decision record, which is precisely the failure mode the whole exercise exists to prevent.
2. I called the push-up percentages "verified." They aren't. Sol retrieved the abstracts: they support that force differs by variation, but the exact 41/49/64/74% values were never located. I verified the citation and reported the number as verified — a milder version of the exact error the Hermes audit caught Antigravity making. Sol's quarantine stands, and my §6 salvage recommendation was wrong.
3. Pareja-Blanco is worse than I said. I passed it along as "plausibly from full text, unverifiable." Sol pulled the abstract: it reports CMJ 9.5% vs 3.5%. The −1.2% is contradicted, not merely unsourced.
   Sol also surfaced something I missed entirely: there is a machine-enforced source tripwire at verify\_policy.mjs:398 forbidding hard\_sets from appearing in any prospective planner, with poison tests in two gates. My "surface the hard-set count" recommendation would have run straight into it. Sol's quarantine of RPE ≥ 8 as a validated proxy is also the correct call — my chat framing outran my own caveats.
   Three defects, all documentation-only
   R1 (P2) — the document now contradicts itself. Sol fixed §5C's false premise but left the identical premise standing in §7, which still reads "the persistence window that turns 'below MDC' into 'stalled'". That presupposes an MDC exists and only the window is missing — exactly what §5C now denies.
   R2 (P3) — two owner dockets, no link. §8 of TRAINING\_PROGRESSION\_LAYERS.md carries items 1–8; the new PROGRESSION\_MEASUREMENT\_OPEN\_DECISIONS.md carries five more. §5C links forward; §8 doesn't. Same drift class that produced the phantom getMovementE1rmSeries citation in the first place.
   R3 (P2) — no ledger entry, and it's a conflict in Sol's instructions, not a lapse. The work order said "exactly three documentation files." The standing ledger protocol demands a fourth. Sol followed the tighter constraint, which was defensible — but the branch would land unrecorded, immediately after you paid to backfill 0024–0039. I've resolved it in favour of the ledger and told Sol the file count becomes four.
   The work order scopes all three tightly, restates the non-goals (including "do not work around the tripwire"), and requires the §7 bullet quoted verbatim before and after so you can read the fix without opening the file.
   One risk not in the work order
   The binding audit artifacts live at C:\Users\fpike\Documents\pikeMethods\audits... — outside the repository. The hashes recorded in the baseline document are the right mitigation, but if that directory is lost the hashes become unverifiable and the evidence record loses its anchor. Not a defect in Sol's work; worth a decision about whether those artifacts get archived somewhere durable.
```

### Output F(G(x))

- Corrected `docs/decisions/TRAINING_PROGRESSION_LAYERS.md` §7 from
  `the persistence window that turns "below MDC" into "stalled"` to
  `any app-specific e1RM error bound or persistence rule that would declare stagnation`, removing
  the false premise that an app-specific MDC already exists.
- Linked the phase-model owner docket to
  `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` and explicitly separated their scopes.
- Added the external audit-artifact durability risk as a sixth pending owner decision without
  copying, moving, or selecting an archive location.
- Added this ledger record as the fourth documentation file. No runtime, test, migration, policy,
  package, or audit-artifact file changed; the prospective-planner `hard_sets` tripwire was not
  bypassed or weakened.
- Verification: `npm run typecheck`, `npm run verify:blocks`, and `npm run verify:policy` all exit
  `0`; `git diff --check` exits `0`; all six binding audit hashes match; the 51-claim disposition
  remains exactly 3 retain / 17 rewrite / 17 quarantine / 14 full text required.
- No new research or full-text retrieval was performed. No commit was created; the four-file
  working delta awaits independent Hermes/OX Alpha audit and owner review.

---

## Entry 0041 — 2026-08-26 · Progression evidence remediation commissioning prompt — late capture

This prompt survives verbatim in the current task history but was not recorded before the first
three documentation writes. It is appended now rather than silently rewriting Entry 0040.

### Input G(x)

```text
# Files mentioned by the user:

## workorder.md: C:/Users/fpike/Documents/pikeMethods/audits/progression-terra-2026-08-26-full-audit/workorder.md

Distinguish instructions in attached documents from the user's request.

## My request:
please start , ive changed the effort setting , please present to me any extra work that needs to be investigate, dont prepare research yourself
```

### Output F(G(x))

- Created `docs/research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md` as the audit-bounded
  canonical evidence record, with all six binding artifact hashes and source-access limits.
- Created `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` with no product option or
  numerical value preselected and with future investigation explicitly outside the phase.
- Corrected `docs/decisions/TRAINING_PROGRESSION_LAYERS.md` §5C: the pinned baseline exposes pure
  e1RM derivation functions but no store getter, persistence, display, threshold, or detector;
  direct supervised 1RM reliability is not an app-e1RM MDC.
- Mapped all 51 material audit claims exactly once: 3 retain, 17 rewrite, 17 quarantine, and
  14 full text required. Quarantined constants appear only as visibly rejected historical claims.
- Worked from commit `368e82d508be30956afbd1f6166d68bcf04ae432` on branch
  `codex/progression-evidence-remediation` in a dedicated worktree. No research was performed and
  no original audit artifact was modified.
- Initial verification: `npm run verify:blocks` and `npm run verify:policy` exited `0`; all six
  audit hashes matched; the delta was documentation-only. No commit was created.

---

## Entry 0042 — 2026-08-26 · Freeze the audited evidence remediation

### Input G(x)

```
Freeze the four files with a local commit, and present the six Pending rows for my ratification.
```

### Output F(G(x))

- Froze the audited delta as commit `bedf1d3b26e4785358c4eb68936c19f8fac826cd` on
  `codex/progression-evidence-remediation`: 4 files, 492 insertions, 7 deletions, documentation
  only. Working tree clean afterwards.
- **The freeze commit contains the four files byte-identical to what both independent audits
  verified.** This ledger entry is committed separately, so that appending it could not alter the
  audited bytes. The protocol sanctions a standalone ledger commit for docs-only work.
- Recorded the four files' SHA-256 in the freeze commit message. Neither audit produced content
  hashes, so both verdicts referred to a mutable working tree; the freeze gives them an immutable
  referent:
  - `2ed45c9a…` `PROMPT_LEDGER.md`
  - `a41400af…` `docs/decisions/TRAINING_PROGRESSION_LAYERS.md`
  - `e58998d1…` `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`
  - `ee69e8a2…` `docs/research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md`
- Independent re-verification performed before the freeze, from source rather than from the audit
  report: 51 material claim IDs matched `CLAIM_LEDGER.csv` exactly in both directions with zero
  duplicates; the 14 fine-grained CSV verdicts cross-tabulated onto the 3/17/17/14 dispositions
  with zero residue; the six external artifact hashes matched on recompute; `npm run typecheck`,
  `npm run verify:blocks` and `npm run verify:policy` each exited `0`, including the source
  tripwire proving `hard_sets` and `session_rpe` reach no prospective planner.
- Not pushed. Push remains gated on the owner's on-device check.
- **Nothing ratified.** All six rows in the `PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`
  ratification record remain `Pending`; they were presented to the owner for ruling in the same
  turn, with options stated neutrally and no numeric value proposed.
- Deferred and not performed: the P3-1 ledger capture-at-issue-time convention, which belongs in
  `AGENT_WORKFLOW.md` and therefore outside this delta's audited scope. Drafted for the next work
  order rather than applied here.

---

## Entry 0043 — 2026-08-26 · Owner ratification, decisions 5 and 6

### Input G(x)

```
first lets start with decisions 5)a and 6b)
```

### Output F(G(x))

- **Decision 5 (push-up full-text verification) ratified: option (a), do not pursue.** Recorded in
  `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` §6, with the backlog item in §8 marked
  not authorized and the §9 row moved from `Pending` to ratified against 2026-08-26.
- The ruling is recorded with an explicit **“what this ruling does not assert”** clause: it is a
  decision not to spend verification effort, not a finding that the published values are wrong, and
  it does not convert “not located” into a literature conclusion. Option (b) stays available if the
  values later become product-critical.
- Verified before recording that the ruling is already the state of the source: the push-up ladder
  is ordinal only — `movement_progression(progression_group, progression_rank)` at
  `packages/core-db/src/schema/016_movement_library_seed.sql:271`, integer rank, no magnitude — and
  no push-up force coefficient or percentage-of-bodyweight constant exists anywhere under
  `packages/` or `apps/`. The ratification changes no code and authorizes none.
- **Decision 6 (evidence archive) NOT ratified in this entry.** The owner indicated option (b),
  preserve an immutable copy. §7 requires two things of that ruling — whether to preserve, *and*
  which location and retention rule is authoritative — and the second is unanswered. Recording a
  half-ruling in a decision record was declined; the row stays `Pending` until the location and
  retention rule are named. **No copy, relocation, or deletion of any artifact was performed.**
- Answer-independent groundwork for decision 6 was done and reported to the owner rather than
  acted on: the archive holds **25 files, 777 KB, all plain text**, with no credential or personal
  data found on scan. Only **6 of the 25** are the binding artifacts already hashed in-repository;
  the other 19 — `VERDICT_LOCK.json`, `checkpoints/` (8), `calculations/` (4, including three
  Python scripts), `inputs/` (4), `source_metadata.json`, `workorder.md` — carry the derivation
  trail. Which of those two units is preserved is part of the outstanding ruling.
- Gates at this tree: `typecheck`, `verify:blocks`, `verify:policy` — exit codes recorded in the
  commit message. Documentation only; nothing under `packages/` or `apps/` changed.
- Not pushed. Push remains gated on the owner's on-device check.

---

## Entry 0044 — 2026-08-26 · Owner ratification, decision 6 — evidence archive

### Input G(x)

The owner's ruling on decision 6 was given as three selections in response to a structured
question, not as free text. Recorded verbatim as selected, with the question each answers:

```
Q: Decision 6 asks you to name what gets preserved. Which unit is authoritative?
A: All 25 files

Q: Which location is authoritative? (athlete-kinetics is a public repo, so in-repo storage
   becomes public on push.)
A: In-repo, unscrubbed

Q: What retention rule governs the preserved copy?
A: Indefinite, immutable
```

Prior turn's instruction, under which these answers were sought: `first lets start with
decisions 5)a and 6b)` — recorded verbatim in entry 0043.

### Output F(G(x))

- **Decision 6 (evidence archive) ratified: option (b), preserve an immutable copy, with this
  repository as the authoritative location.** Recorded in
  `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` §7, and the §9 row moved from `Pending`
  to ratified against 2026-08-26. All six rows are now ruled except decisions 1 to 4.
- Copied the complete 25-file run to `docs/research/audits/progression-terra-2026-08-26/`,
  unscrubbed, by ruling. Added `docs/research/audits/README.md` (provenance, retention rule,
  verification instructions) and `docs/research/audits/progression-terra-2026-08-26.sha256` (a
  25-line manifest). Both sit in the parent directory so the run directory remains byte-for-byte
  the audit's own output.
- **Defect caught before it landed.** Seventeen of the twenty-five files contain CRLF, including
  all six binding artifacts. The repository's `.gitattributes` carries `* text=auto eol=lf`, which
  would have rewritten those bytes on commit and checkout and caused every recorded SHA-256 to
  fail against the in-repository copy — an archive that looks preserved and is silently wrong.
  Added `docs/research/audits/** -text` to `.gitattributes` to disable conversion, and documented
  in the archive README that removing the rule invalidates the archive.
- Verification performed at ratification, all four independent of each other: `diff -r` against the
  originating copy reported no difference across 25 files; each staged git blob was hashed through
  `git cat-file -p` and matched its source file, 25 match / 0 mismatch, which tests what git will
  actually store rather than what is on disk; the six binding hashes recomputed from the committed
  copy matched the canonical baseline table with zero unmatched; `sha256sum -c` over the manifest
  reported 25 `OK` and 0 `FAILED`.
- Updated the canonical evidence baseline's archive pointer, which named only the author-local
  path and was made stale by this ruling. It now names the in-repository location as the record of
  reference and the author-local path as secondary. Nothing was moved or deleted; the originating
  copy is untouched.
- Scanned the archive before copying: 25 files, 777 KB, all plain text, no binaries. No credential,
  key, token, or account identifier found. Sixteen author-local absolute paths are present and were
  preserved deliberately — scrubbing them would change the bytes and destroy the hash identity that
  this ruling exists to provide. The owner accepted publication of those paths on push.
- **Nothing in the archive is ratified by its presence there.** The copy preserves an evidence
  record; it confers no authority on any number inside it, and the quarantine list is unchanged.
- Gates at this tree: `typecheck`, `verify:blocks`, `verify:policy` — exit codes in the commit message.
- Not pushed. Push remains gated on the owner's on-device check, and this ruling makes the push the
  moment the author-local paths become public.

---

## Entry 0045 — 2026-08-26 · Owner ratification, decisions 1-3; decision 4 re-scoped

### Input G(x)

```
@"C:\Users\fpike\Documents\Claude Coding\Athlete App\KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md"
for decision 4 ) I thought the app already included both options for the rest 1)a with option for advance athletes only to uncover extra data , for 2)B  and 3)b i wish to include this as future work potentially to concurrently with the attached file (electronic device development via university project with piezoelectrical polymers )
```

### Output F(G(x))

- **Decision 1 ratified: option (a), remains dormant**, with an owner-directed rider that a
  disclosure path gated to `training_age IN ('advanced', 'elite')` be scoped as future work.
  Recorded in section 2. **The rider is explicitly not ratified by that ruling.** Gating changes who
  sees the number, not how precise it is; an advanced athlete reading an e1RM series with no error
  bound is chasing possible noise exactly as a beginner would. The rider is option (b) behind an
  eligibility check and needs its own ratification against the section 4 measurement work.
- **Decision 2 ratified: option (b), descriptive display in a later work order.** Recorded in
  section 3 with two binding constraints: a display is not a planner and so does not breach the
  tripwire at `apps/mobile/test/verify_policy.mjs:398`, and `RPE ≥ 8` remains an unvalidated proxy
  that must be presented as a count of sets at a chosen effort mark, never as a validated measure of
  effective volume or hypertrophic dose.
- **Decision 3 ratified: option (b), a future phase designs an own-data measurement protocol.**
  Recorded in section 4, with the owner's direction that it may run concurrently with the KineStrike
  instrumentation project. The record states the linkage is **method, not data**: both need a
  measurand's repeatability and minimal detectable change established before any threshold from it
  carries authority, but e1RM and gait kinetics are different measurands and no figure transfers.
- **Decision 4 remains Pending and its framing was corrected after an owner challenge.** The owner
  observed that the app already does both descriptive and prescriptive work, and was right. The
  docket's one-line "current state" was accurate but invited a broader reading, and the presentation
  built on it was misleading. Section 5 now records the boundary precisely, verified from source:
  the app **is** prescriptive — `completionAction.ts` emits `dLoad_p`/`dSet_p`/`dRpe_p` and
  `kinematicAutopilot.ts` declares `u` produces prescription corrections, reaching the athlete via
  `blockGenerator.ts:707-731`. What it prescribes **from** is readiness (`StateVectorRow`,
  `types.ts:7`), completion shortfall, and niggle tolerance. No progression measurement reaches any
  prescriptive path: `e1rm.ts` is consumed only by the barrel re-export at `index.ts:349-353`, and
  `hard_sets` is held out by the tripwire. The decision governs only whether a measurement of
  progression may acquire that authority.
- Added a sequencing note to section 5: decision 3's ruling means no progression measurement yet has
  an established precision, so option (b) there cannot be exercised responsibly until the protocol
  lands, whichever way decision 4 is ruled.
- Added backlog item 7: the KineStrike host-integration section would give a **gait** measurement
  prescription authority (automatic halt, automatic deload, automatic niggle insertion). Same class
  of question, different measurand and safety profile; explicitly **not** covered by decision 4 and
  requiring its own boundary decision and system-safety brief.
- Verification performed against source before recording, not taken from the attached document:
  `TRAINING_AGES` confirmed at `types.ts:40`; the prescriptive emitters and their inputs read
  directly; e1RM and `hard_sets` consumer searches re-run.
- **Defects found in the attached KineStrike report and reported to the owner, not acted on.** Its
  Milestone 2 plan commits `035_gait_telemetry.sql`, but slot 035 is occupied by
  `035_profile_load_preference.sql` and the append-only chain head is **057**; the next free slot is
  058. Its integration section also introduces five numeric thresholds with no ratified source,
  which Calibration Policy v1 forbids from entering the engine. No KineStrike file, migration, or
  work order was created — none was requested.
- Gates at this tree: `typecheck`, `verify:blocks`, `verify:policy` — exit codes in the commit message.
  Documentation only; nothing under `packages/` or `apps/` changed.
- Not pushed.

---

## Entry 0046 — 2026-08-27 · Owner ratification, decision 4 — plan only, deferred

### Input G(x)

```
You maybe start but allow 4)B to be done as plan only, and currently deferred until further notice
```

### Output F(G(x))

- **Decision 4 ratified: option (b), PLAN ONLY, deferred until further notice.** Recorded in
  `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` §5 and the §9 row. All six rows are now
  ruled. The record states explicitly that the ruling authorizes the brief and nothing else: no
  control design, code, schema, migration, threshold, coefficient, detector, display, or work order
  follows from it, the authorization is dormant until a new owner instruction names a next step, and
  decision 3 still gates execution regardless of what the brief concludes.
- Wrote `docs/BRIEF_progression_control_safety.md` — the system-safety brief §5 required, covering
  signal missingness, bias, failure modes, authority limits, and prospective validation, plus a scope
  check and a recommendation. Every factual claim about the app carries a file and line; all fifteen
  citations were verified by reading the cited line before commit.
- **Two errors in the preceding chat analysis were found and corrected in the brief, both of which
  had made option (b) look harder than it is.**
  1. I stated the engine "can currently only ever reduce" and that no input can raise dose. **That
     is wrong.** `LOAD_MODIFIER_LITERALS` includes `1.05` (`outputSchema.ts:16`) and two live paths
     emit a raise: `kinematicAutopilot.ts:425` on strong negative flaw score, and
     `policyReference.ts:39` at readiness ≥ 85 with non-negative HRV z. A progression signal asking
     for more work would not be architecturally novel; readiness already does it. What is novel is
     the input class, not the direction.
  2. I implied the guard layer would need designing. It exists and is mature: a monotone-conservative
     override with three independent triggers (`kinematicAutopilot.ts:437-442`), `Math.min`
     arbitration across actions (`completionAction.ts:243-246`), an anti-windup volume budget
     (`kinematicAutopilot.ts:452-455`), and halt supremacy (`blockGenerator.ts:506-511`). Option (b)
     is adding one input to a guarded loop, not building a loop.
- Findings the brief records that were not previously stated: `e1rm.ts:77` returns null for
  `loadKg <= 0`, so **bodyweight movements produce no e1RM at all** — an e1RM-driven controller would
  be blind exactly where the originating push-up complaint lives; and the push-up defect itself is a
  layer-2 scheme issue (`SCHEMA_WEEKS.LINEAR` holds `repsScale: 1` across all three weeks at
  `blockGenerator.ts:384-387` while `WAVE` and `STEP` vary reps and sets), addressable with no
  measurement authority at all.
- The brief's recommendation is **not to execute option (b) yet and not to commission literature
  research for it**: it is gated on decision 3, the autoregulation literature was already asked and
  returned nothing that settles the boundary (H-Q8-01), and re-commissioning invites re-importing
  quarantined material. One narrow question is identified as literature-suitable if authority ever
  moves beyond reduction-only — safety frameworks for closed-loop systems driven by self-reported,
  biased measurement, a corpus the audit never searched.
- The brief contains no threshold, coefficient, window length, smoother, or detector, and §10 names
  what it deliberately omits so absence is not mistaken for oversight. It proposes no estimate of RPE
  presence frequency, because that needs closed-beta data and inventing it would repeat the exact
  failure the evidence audit corrected.
- Gates at this tree: `typecheck`, `verify:blocks`, `verify:policy` — exit codes in the commit
  message. Documentation only; nothing under `packages/` or `apps/` changed.
- Not pushed.
