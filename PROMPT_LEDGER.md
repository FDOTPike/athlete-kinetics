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

## Entry 0023 — 2026-09-01 · State C QA prerelease publication (release-lineage action, logged here to keep the release worktree pristine)

> Lineage note: the substantive work targets `codex/state-c-release-readiness`
> (release lineage, ledger Entry 0058 is its tail). This entry is recorded in the
> master-lineage ledger from the QA session worktree
> `claude/state-c-release-qa-d45df8` because the prompt requires the release
> worktree to remain clean at the exact expected HEAD `965492e`.

### Input G(x)

```
OWNER AUTHORIZATION: Proceed autonomously. You may commit and push strictly scoped fixes if required, publish the QA prerelease, and update the remediation branch. Do not merge master or publish a production release.

Repository:
C:\Users\fpike\Documents\Claude Coding\Athlete App

Release worktree:
C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\state-c-release-readiness

Release branch:
codex/state-c-release-readiness

Expected HEAD:
965492e02184e07ddab20391740f10a694bd9149

Successful GitHub CI:
https://github.com/FDOTPike/athlete-kinetics/actions/runs/33447738019

Continue from here only:

1. Confirm the release worktree is clean and at the exact expected HEAD.
2. Download artifact `athlete-kinetics-qa-candidate-apk` from run 33447738019.
3. Run:
   node tools/verify_qa_artifact.mjs <downloaded-app-qa.apk>
4. Require a complete PASS, including clean provenance at HEAD 965492e. Do not use the older artifact from run 33445783745; it recorded dirty provenance.
5. Compute and record the APK SHA-256 and size.
6. Publish it as a GitHub PRERELEASE tagged `qa-c6-965492e`, targeted at the exact HEAD. Clearly label it:
   - QA only
   - debug-key signed
   - not for Play/production
   - intended for physical 4 GB-device C6 testing
   - program-quality remediation remains open
7. Return the release page, direct APK link, SHA-256, size, package name, and installation instructions.
8. Fast-forward this existing worktree/branch to the final release HEAD and push it:
   C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation
   branch: codex/program-quality-remediation
9. Do not alter the dirty master worktree.
10. If local verification fails, do not publish. Diagnose, make the minimum fix, commit, push, rerun CI, and repeat verification.

Final verdict must distinguish:
QA DEVICE TEST: READY or BLOCKED
PRODUCTION RELEASE: NOT AUTHORIZED
```

### Output F(G(x))

- Confirmed release worktree `.worktrees/state-c-release-readiness` clean at 965492e02184e07ddab20391740f10a694bd9149 (branch codex/state-c-release-readiness); CI run 33447738019 conclusion=success, headSha identical.
- Downloaded artifact `athlete-kinetics-qa-candidate-apk` -> `app-qa.apk`, 194,404,420 bytes, SHA-256 98abdaf8c3e8edf2359042acae634b20a3c7a28c0de57b31a56ef116b53a5a87.
- `node tools/verify_qa_artifact.mjs` => QA ARTIFACT VERIFIED, exit 0, every check PASS, including clean provenance (head=965492e02184, sourceDirty=false, empty tracked-diff fingerprint e3b0c442...b855, 0 staged files). Run 33445783745 artifact was NOT used.
- Published GitHub PRERELEASE `qa-c6-965492e` targeting 965492e (prerelease=true, draft=false) with assets `app-qa.apk` and `app-qa.apk.sha256`; notes label it QA-only, debug-key signed, not for Play/production, 4 GB-device C6 testing, program-quality remediation open.
- Round-tripped the published asset from the release download URL: byte-identical SHA-256 and size, re-verified => QA ARTIFACT VERIFIED.
- Fast-forwarded `.worktrees/program-quality-remediation` (codex/program-quality-remediation) 1a7e80d -> 965492e and pushed; origin ref now 965492e.
- No repository code changes were required; no fix commits made. Master worktree left untouched (HEAD 3358be6, its pre-existing dirt preserved).
- Verdict: QA DEVICE TEST: READY. PRODUCTION RELEASE: NOT AUTHORIZED.
