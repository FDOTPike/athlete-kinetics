# Reviewer Gemini Audit Report — State C Data-Integrity Stack

**Reviewer Role:** Independent Reviewer (Gemini 3.8 Flash / Auditor Team)  
**Milestone:** Antigravity Team Preview — Round 1  
**Timestamp:** 2026-09-09T23:32:00Z  
**Verdict:** **APPROVE WITH FINDINGS**

---

## 1. Candidate Identification

The audit evaluated exactly the three merges comprising the State C data-integrity stack, executed in an isolated, dedicated worktree with clean `node_modules` materialized via fresh `npm ci`:

- **Repository:** Athlete Kinetics monorepo
- **Audited Branch:** `codex/rpe-familiarisation`
- **Ancestor Commit SHA:** `3ec532d6082e4ad96470c413a3365dc7f531a765` (Merge PR #8, migration 061 — NOT in scope)
- **Candidate Commit SHA:** `1a790776f4efb50fc2d38a58b60997579c46f310` (Merge PR #11)
- **Candidate Tree SHA:** `dbca4aedfe75dcb82aaca21ff6ca7c84331316ee`
- **In-Scope Range:** `3ec532d..1a79077` (exactly three merges):
  1. `5f1cb6ada8f162a729d32ce146acb480c7070c43` — Merge PR #9 (post-merge State C data integrity: suspension reset/switch + migration 062 side-car immutability)
  2. `200b75c859f00571a13285e6c6046567ded0a00c` — Merge PR #10 (State C close-out, replay-exposure rule corrected, register brought current)
  3. `1a790776f4efb50fc2d38a58b60997579c46f310` — Merge PR #11 (OW-001 athlete-facing prospective load-intent declaration, migration 063)
- **Reviewer Worktree Path:** `C:\Users\fpike\.gemini\antigravity\worktrees\Athlete App\audit_state_c_integrity`

---

## 2. Independent Verification Commands & Results

All verification commands were executed independently from a fresh `npm ci` install. Before running offline test gates, pinned embedder assets were verified and materialized via `npm run fetch:embedder` per repository preflight specification.

| Command | Exit Code | Decisive Output / Observations |
|---|:---:|---|
| `git diff --check` | `0` | Clean diff hygiene; zero whitespace or git formatting errors across worktree. |
| `git diff --check 3ec532d6082e4ad96470c413a3365dc7f531a765 1a790776f4efb50fc2d38a58b60997579c46f310` | `0` | Zero whitespace or formatting errors across entire in-scope merge range. |
| `npm.cmd run typecheck` | `0` | Clean compilation across `apps/mobile/tsconfig.json` (0 errors). |
| `npm.cmd run verify:migrations` | `0` | All migration tests pass (`ALL CHECKS PASSED`), including 062 sidecar immutability and 063 load intent. |
| `npm.cmd run verify:blocks` | `0` | All inference block checks pass (`ALL CHECKS PASSED`), including OW-006 tripwire and P1 equipment resolver. |
| `npm.cmd run verify:store` | `0` | Full store SQL and routine template verification pass: `verify:store SQL — 667/667 checks green`, `16 passed, 0 failed`. |
| `npm.cmd run verify:components` | `0` | Full mobile component test suite passes: `Test Suites: 22 passed, 22 total`, `Tests: 327 passed, 327 total`. |
| `npm.cmd run verify:ci` | `0` | Full CI gate pipeline passes cleanly: `22 suites passed, 327 tests passed`. |
| `npm.cmd run verify:release` | `1` | **DISCLOSED IN ADVANCE**: Fails because `verify:memory-contract` exits 1 (`FAIL [A] component envelope satisfies the ratified contract ... FAIL [D] measured physical evidence exists`). This is a known open release gate awaiting C6 device evidence, not a finding. |

---

## 3. Claim-by-Claim Disposition

### Claim C1: Chain-Position Rule and Uniqueness
**Disposition:** **CONFIRMED**  
**Locators:** 
- `packages/core-db/src/migrations.ts:48-62`
- `packages/core-db/src/migrationRunner.ts:335-345`
- `packages/core-db/src/schema/049_movement_content_correction_v1.sql:24`
- Commit `fbbd9a3`

#### Evidence & Analysis:
1. **The Replay-Blocking Rule**: In SQLite, executing `ALTER TABLE ... RENAME` triggers an internal re-parse of all schemas, views, and triggers across the database (`sqlite_master`). If any surviving trigger references a table that does not exist in `sqlite_master` when the rename executes, SQLite aborts with:
   `error in trigger <trigger_name>: no such table: main.<foreign_table>`
   A cross-table trigger is therefore replay-blocking if and only if the foreign table it references is created **after** the earliest `ALTER TABLE ... RENAME`.
2. **Earliest Rename Position**: Tracing all 62 migrations in `packages/core-db/src/migrations.ts`, the earliest rename occurs in Migration 049 (`049_movement_content_correction_v1.sql:24`), at 0-indexed array position 47 (1-based chain position 48):
   `ALTER TABLE movement_equipment_v049 RENAME TO movement_equipment;`
3. **Trigger Survey & Foreign References**: An audit of all 28 triggers in the schema revealed exactly 12 cross-table triggers. The unique foreign tables referenced across all triggers are:
   - `session` (001, pos 1) <= 48
   - `mech_daily` (001, pos 1) <= 48
   - `set_record` (001, pos 1) <= 48
   - `movement_role_eligibility` (028, pos 27) <= 48
   - `training_program` (033, pos 32) <= 48
   - `training_block` (007, pos 6) <= 48
   - `movement_detail` (010, pos 9) <= 48
   - `suspension_episode` (058, pos 57) > 48 (**EXPOSED**)
4. **Uniqueness**: `suspension_episode` (created at migration 058, chain position 57) is the **ONLY** foreign table created after position 48 referenced by any cross-table trigger in the chain.
5. **PR #10 Retraction**: PR #9 originally claimed migration 026 shared this exposure. PR #10 (commit `fbbd9a3`) retracted this claim. The retraction is **confirmed correct**: migration 026 triggers reference `set_record` and `session`, both created at migration 001 (position 1). When replaying from 0, both tables exist long before migration 049 executes.

---

### Claim C2: Self-Heal Actively Heals
**Disposition:** **CONFIRMED**  
**Locators:** 
- `packages/core-db/src/migrationRunner.ts:335-345`
- `packages/core-db/test/verify_migrations.mjs:1066-1188`

#### Evidence & Analysis:
1. **Execution Sequence**: In `packages/core-db/src/migrationRunner.ts`, lines 334–337:
   ```typescript
   dropReplayBlockingTriggers(db);
   db.executeSync('PRAGMA user_version = 0;');
   applyFrom(db, migrations, 0);
   ```
   `dropReplayBlockingTriggers` drops `trg_suspension_episode_program_no_delete_bd` and `trg_block_suspension_origin_no_delete_bd` **before** resetting `user_version` to 0.
2. **Counterfactual Proof**: Dropping `suspension_episode` on a fully migrated database and attempting naive replay without dropping 062's triggers aborts at migration 049 (index 47) with:
   `error in trigger trg_suspension_episode_program_no_delete_bd: no such table: main.suspension_episode`
3. **Behavioural Enforcement Post-Replay**: Under `runMigrations`, the database completes replay to `user_version = 62`. Afterwards, behavioral execution (not mere metadata inspection) confirms all four 062 mutation refusals are restored and actively enforced:
   - `DELETE FROM suspension_episode_program WHERE episode_id = ?` -> Refused (`suspension_episode_program: the frozen program state cannot be deleted`)
   - `UPDATE block_suspension_origin SET episode_id = ? WHERE block_id = ?` -> Refused (`block_suspension_origin: the suspension attribution is immutable`)
   - `DELETE FROM block_suspension_origin WHERE block_id = ?` -> Refused (`block_suspension_origin: the suspension attribution cannot be deleted`)
   - `UPDATE planned_slot_load_intent SET planned_slot_id = ? WHERE planned_slot_id = ?` -> Refused (`planned_slot_load_intent: a declared intent belongs to its own slot`)

---

### Claim C3: Cascade / Trigger Interaction
**Disposition:** **CONFIRMED**  
**Locators:**
- `packages/core-db/src/schema/062_suspension_sidecar_immutability.sql:26-34`
- Tested against `node:sqlite` (SQLite 3.50.4) and `@op-engineering/op-sqlite` (SQLite 3.51.3)

#### Evidence & Analysis:
1. **Direct SQLite Probe**: A standalone test verified the behavior of `FOREIGN KEY ... ON DELETE CASCADE` combined with child `BEFORE DELETE` triggers under both `PRAGMA recursive_triggers = OFF` and `PRAGMA recursive_triggers = ON`.
2. **Decisive Finding**:
   - In SQLite, an FK `ON DELETE CASCADE` **DOES fire** the child's `BEFORE DELETE` trigger, even when `recursive_triggers = OFF`.
   - If the child trigger contains an unconditional `SELECT RAISE(ABORT, ...)`, deleting the parent table row **aborts with that trigger's error**.
3. **Parent-Scoped Guard Validation**:
   - In SQLite, the parent row is deleted from the parent table *before* the child row is deleted by the cascading action.
   - When the child's `BEFORE DELETE` trigger runs during cascade, `EXISTS (SELECT 1 FROM parent WHERE id = OLD.parent_id)` evaluates to `FALSE`.
   - When a direct delete is attempted on the child table, the parent row still exists, so `EXISTS (...)` evaluates to `TRUE`.
   - Therefore, migration 062's guard shape (`WHEN EXISTS (SELECT 1 FROM suspension_episode ...) AND EXISTS (SELECT 1 FROM training_program ...)`) is structurally required to allow cascading cleanup on parent deletion (e.g. during training data reset) while preventing direct deletion of side-car rows. The author's premise is exact.

---

### Claim C4: The Equipment Resolver (`IMPLEMENT_REQUIREMENT` + `implementAvailable`)
**Disposition:** **CONFIRMED**  
**Locators:**
- `packages/inference/src/types.ts:137-168`, `204-210`
- `packages/inference/test/verify_blocks.mjs:2306-2345`
- `PROMPT_LEDGER.md:6842-6854` (Entry 0103)

#### Evidence & Analysis:
1. **Totality over `MOVEMENT_PREFIXES`**: `MOVEMENT_PREFIXES` contains exactly 10 members (`DB`, `BB`, `KB`, `Free Weight`, `Banded`, `Bodyweight`, `Cable`, `Earthquake Bar`, `Chains`, `Bottom-Up`). `IMPLEMENT_REQUIREMENT` maps all 10 members without gaps (`missing.length === 0`).
2. **Canonical Equipment Items**: All items referenced in `IMPLEMENT_REQUIREMENT` (`dumbbells`, `barbell`, `kettlebell`, `bands`, `cable_machine`) belong to `STANDARD_EQUIPMENT_ITEMS` and `EQUIPMENT_ITEMS`.
3. **Unverifiable Implements**: `'Earthquake Bar'` and `'Chains'` are explicitly mapped to `{ kind: 'unverifiable' }`. In `implementAvailable`, kind `unverifiable` immediately returns `false`. They fail closed on any inventory, including a full gym.
4. **'Free Weight' Owner Ruling**: Per owner ruling of 2026-09-09 (Entry 0103), `'Free Weight'` maps to `{ kind: 'anyOf', items: ['barbell', 'dumbbells', 'kettlebell'] }`. The mapping is applied consistently in `types.ts`, `ProfileScreen.tsx`, and migrations `059` and `063`.

---

### Claim C5: The Measured Corpus Claim
**Disposition:** **REFUTED / CLARIFIED** (Author undercounted; primary evidence confirms 17 of 17)  
**Locators:**
- `packages/inference/src/types.ts:117`
- `PROMPT_LEDGER.md` Entry 0102
- Shipped SQLite movement catalog (`packages/core-db/src/schema/*.sql`)

#### Evidence & Analysis:
1. **Author Claim**: The author stated: *"15 of the 17 multi-implement movements offer at least one implement their base requirement never implies."*
2. **Independent Re-derivation from Shipped Corpus**:
   - Total movements in shipped library: 300
   - Multi-implement movements (`supported_prefixes.length > 1`): **17**
   - Movements offering at least one unimplied implement: **17 of 17 (100%)**, not 15 of 17.
3. **The 17 Movements**:
   - ID 3: Competition Bench (Base: barbell, bench -> Offers DB)
   - ID 4: Overhead Press (Base: barbell -> Offers DB, KB)
   - ID 5: Barbell Row (Base: barbell -> Offers DB)
   - ID 6: Weighted Pull-up (Base: pullup_bar -> Offers Banded)
   - ID 8: Front Squat (Base: barbell, squat_rack -> Offers KB)
   - ID 9: Romanian Deadlift (Base: barbell -> Offers DB)
   - ID 12: Single-Arm Dumbbell Row (Base: bench, dumbbells -> Offers KB)
   - ID 13: Chin-up (Base: pullup_bar -> Offers Banded)
   - ID 14: Goblet Squat (Base: dumbbells -> Offers KB)
   - ID 16: Push-up (Base: none -> Offers Banded)
   - ID 17: Walking Lunge (Base: none -> Offers DB, BB)
   - ID 18: Bulgarian Split Squat (Base: bench -> Offers DB, BB)
   - ID 19: Farmer Carry (Base: dumbbells -> Offers KB)
   - ID 20: Suitcase Carry (Base: kettlebell -> Offers DB)
   - ID 23: Nordic Curl (Base: nordic_bench -> Offers Banded)
   - ID 29: Glute Bridge (Base: none -> Offers BB)
   - ID 59: Face Pull (Base: cable_machine -> Offers Banded)
4. **Divergence Root Cause**: The author overlooked that `Banded` requires `bands`. For ID 6 (Weighted Pull-up) and ID 13 (Chin-up), owning a `pullup_bar` does not imply owning `bands`. Every multi-implement movement without exception offers an implement requiring unimplied equipment.

---

### Claim C6: P1 Closed at All Three Boundaries
**Disposition:** **CONFIRMED**  
**Locators:**
- Boundary 1 (UI): `apps/mobile/src/screens/ProfileScreen.tsx:221-229`
- Boundary 2 (Store Guard): `apps/mobile/src/state/useStore.ts:2592-2598`
- Boundary 3 (Generation): `apps/mobile/src/state/useStore.ts:1849-1875` (`plannedImplementFor`)
- Tests: `apps/mobile/test/components/LoadIntentDeclaration.test.js:345-426`
- Tests: `apps/mobile/test/components/ProfileScreens.test.js:553-585`

#### Evidence & Analysis:
1. **Profile Options (Boundary 1)**: `ProfileScreen.tsx` filters `offerablePrefixes` by `implementAvailable(p, profile.equipment_inventory)` and suppresses any movement where fewer than two equippable options survive.
2. **Store Action (Boundary 2)**: `saveMovementLoadIntent` refuses declarations of unowned implements:
   `if (implement !== null && !implementAvailable(implement, get().profile.equipment_inventory)) return false;`
3. **Generation Engine (Boundary 3)**: `plannedImplementFor` drops a declared implement if `!implementAvailable(choice, inventory)`, failing closed to undeclared loaded dosing rather than planning unowned tools.
4. **Non-Vacuous Stale Declaration Pair**:
   - In `LoadIntentDeclaration.test.js:382-411`: Athlete declares `BB` for Walking Lunge with full gym, then sells barbell (switches to HOME inventory). At generation, `plannedImplementFor` drops `BB` to undeclared (`row.declared` is null).
   - In `LoadIntentDeclaration.test.js:413-426`: With barbell present (full gym), generation honours the declaration (`row.declared` is `'BB'`).
   Both tests pass independently, proving the boundary is active and non-vacuous.

---

### Claim C7: Reset and Athlete Switch Lifecycle
**Disposition:** **CONFIRMED**  
**Locators:**
- `apps/mobile/src/state/useStore.ts:2133-2147`, `3008-3013`, `6279-6347`, `6369-6379`
- `apps/mobile/test/components/SuspensionResetAndSwitch.test.js:1-217`

#### Evidence & Analysis:
1. **`resetTrainingData` Scope**:
   - Deletes only the open episode: `DELETE FROM suspension_episode WHERE ended_at_ms IS NULL` (`useStore.ts:6313`). Closed historical episodes are preserved, avoiding 059 trigger rollback.
   - Clears 059 side-cars parent-safely: `planned_slot_load_intent` is cleared before `planned_slot`; `suspension_episode_program` and `block_suspension_origin` are cleared after their parents.
   - Sets in-memory `suspension: null` (line 6369) and calls `refreshSuspension()` (line 6379).
2. **Athlete Switch Isolation (`PER_ATHLETE_RESET`)**:
   - `switchAthlete` and `createAthlete` apply `PER_ATHLETE_RESET` synchronously *before* `boot()` opens the incoming athlete's SQLite file (`useStore.ts:3012, 3042`).
   - At the exact moment `openKineticsDb` runs, `store.getState().suspension` is already `null`.
   - If `boot()` fails, the store transitions to `{ status: 'error' }` with `suspension: null`, preventing any previous athlete suspension state from leaking.

---

### Claim C8: The OW-006 Tripwire Bites
**Disposition:** **CONFIRMED**  
**Locators:**
- `packages/inference/src/blockGenerator.ts:513-523`
- `packages/inference/test/verify_blocks.mjs:2347-2362`

#### Evidence & Analysis:
1. **Tripwire Implementation**: `packages/inference/test/verify_blocks.mjs` asserts that `schemaFatigueCost(schema, phase, false) === schemaFatigueCost(schema, phase, true)` across all 4 schemas x 4 macro phases.
2. **Mutation Proof**:
   - Mutated `packages/inference/src/blockGenerator.ts:513` to introduce a divergent bodyweight coefficient (`LINEAR/volume: 1.5` vs loaded `1.2`).
   - Executed `verify:blocks`. The gate failed decisively with exit code 1:
     `FAIL  [OW-006] no bodyweight fatigue coefficient is ratified yet - if this FAILS, OW-026 landed and bodyweightDominant must be made reachable in the same change  [LINEAR/volume: 1.2 vs 1.5]`
   - Restored file cleanly; re-verified clean pass (`ALL CHECKS PASSED`).

---

### Claim C9: Gate Sensitivity Generally
**Disposition:** **CONFIRMED**  
**Locators:**
- `packages/core-db/src/schema/062_suspension_sidecar_immutability.sql`
- `packages/core-db/src/schema/063_movement_load_intent.sql`
- `apps/mobile/src/state/useStore.ts:2592-2598`, `1849-1875`
- `packages/core-db/src/migrationRunner.ts:38-42`

#### Evidence & Analysis:
Five distinct gates added in this stack were subjected to concrete code mutations:
1. **Migration 062 Immutability Trigger (`trg_block_suspension_origin_immutable_bu`)**: Mutated trigger body to no-op. `npm run verify:migrations` failed decisively:
   `FAIL  062 fresh install REFUSES 062 UPDATE block_suspension_origin.episode_id (re-point onto the other episode)`
2. **Migration 063 Supported Implement Trigger (`trg_movement_load_intent_supported_bi`)**: Mutated trigger body to no-op. `npm run verify:migrations` failed decisively:
   `FAIL  063 REFUSES an implement the movement does not support (DB)`
3. **Store Inventory Guard (`saveMovementLoadIntent`)**: Bypassed `implementAvailable` check in `useStore.ts`. `npm run verify:components` failed decisively:
   `FAIL test/components/LoadIntentDeclaration.test.js` (`expect(store().saveMovementLoadIntent(wl.movement_id, 'BB')).toBe(false)`)
4. **Generation Load Intent Filter (`plannedImplementFor`)**: Bypassed inventory check on declared intent at generation. `npm run verify:components` failed decisively:
   `FAIL test/components/LoadIntentDeclaration.test.js` (`for (const row of intentRowsFor(wl.movement_id)) expect(row.declared).toBeNull()`)
5. **Migration Runner Replay Registry (`REPLAY_BLOCKING_TRIGGERS`)**: Removed `trg_suspension_episode_program_no_delete_bd`. `npm run verify:migrations` failed decisively:
   `Error: error in trigger trg_suspension_episode_program_no_delete_bd: no such table: main.suspension_episode`

Every mutated gate bit with a decisive failure. Zero gates survived mutation. All files were cleanly restored and verified.

---

## 4. New Findings & Open Items Analysis

### Finding F1 (Severity: Moderate) — Runtime UI and Session Runner Implement Drop (Open Item O1)
- **Path & Locators:**
  - `apps/mobile/src/screens/SessionScreen.tsx:325-331`
  - `apps/mobile/src/state/useStore.ts:4597-4654` (`loadSessionSlots`)
  - `packages/core-db/src/schema/022_set_target.sql:39-58` (`session_plan_slot`)
  - `packages/inference/src/loadSelection.ts:123-125`
- **Failure Scenario:**
  1. *Inputs & State:* Athlete declares `DB` for Bulgarian Split Squat (an ambiguous movement with `supported_prefixes: ["Bodyweight", "DB", "BB"]`). Athlete owns dumbbells and has an established dumbbell Bulgarian Split Squat 1RM.
  2. *Generation:* Block generator correctly plans the block and writes `planned_slot_load_intent.planned_implement = 'DB'`.
  3. *Runtime Session Start:* `session_plan_slot` schema carries no implement column. `loadSessionSlots` does not join `planned_slot_load_intent`.
  4. *SessionScreen Execution:* Line 329 computes:
     `const primaryImplement = currentMovement?.supportedPrefixes[0];`
     `const bodyweightMode = primaryImplement === 'Bodyweight';`
  5. *Wrong Output:*
     - Because `supportedPrefixes[0]` is `'Bodyweight'`, `bodyweightMode` evaluates to `true`, completely ignoring the athlete's declared and planned `DB` intent.
     - Input field displays `'Added kg (0 = bodyweight)'` instead of `'Load kg'`.
     - In `loadSelection.ts:123-125`, automated 1RM target load derivation is skipped when `bodyweightMode` is true. The athlete receives no computed target load based on their dumbbell 1RM.
     - `resolveLoadSelection` seeds `initialLoadKg = 0`, bypassing the external-load safety gate and allowing immediate set logging without weight entry.
- **Audit Assessment:** The author correctly identified O1 as open. However, categorizing it as purely low severity because "generation dosing is sound" understates the runtime impact. It is a **Moderate** integrity gap between the generation engine and the live session UI.

### Finding F2 (Severity: Minor / Documentation) — Multi-Implement Corpus Count Under-Reported (Claim C5)
- **Path & Locators:**
  - `packages/inference/src/types.ts:117`
  - `PROMPT_LEDGER.md` Entry 0102
- **Description:** The author reported that 15 of 17 multi-implement movements offer unimplied implements. In the shipped corpus, all **17 of 17 (100%)** multi-implement movements offer at least one unimplied implement. ID 6 (Weighted Pull-up) and ID 13 (Chin-up) require `pullup_bar`, but offer `Banded` which requires `bands` (not implied by `pullup_bar`). This is an author calculation defect in documentation only; runtime behavior is strictly governed by the code resolver.

### Finding F3 (Severity: Minor / Hygiene) — Inadmissible File Citation in Handoff
- **Description:** The audit prompt and handoff documentation cited `packages/inference/src/seed/movementLibrary.ts`. This file does not exist on disk. The repository's single source of truth for the movement catalog is SQLite schema migrations (`010`, `014`, `016`, `017`, `019`, `020`, `037`–`048`, `049`). Documentation should cite the database schema migrations directly.

---

## 5. Audit Verdict

### Verdict: **APPROVE WITH FINDINGS**

**Justification:**
1. **Core Data Integrity Is Sound:** All database triggers in Migration 062 and 063 enforce intended immutability and pairing invariants without regression.
2. **Replay & Self-Heal Verified:** The migration runner self-heal mechanism reliably recovers corrupted databases across the 049 rename boundary, and all mutation refusals are actively enforced after recovery.
3. **Boundary Defenses Active:** Reviewer P1 requirements are rigorously closed across UI selection, store validation, and block generation. Stale inventory declarations are safely dropped at generation.
4. **All Gates Verified Sensitive:** All five tested gates bit decisively under mutation; zero vacuous assertions were found.
5. **Open Items Documented:** Open Item O1 is verified as an active limitation in the active session runner UI and should be scheduled for remediation in the next session runner sprint. Deferred C6 device-memory evidence remains the sole release blocker as expected.
