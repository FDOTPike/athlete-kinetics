# Phase 9 Design — Hybrid Profile, Equipment Filters, 4-Week Block Engine

Mandate (autonomous sprint): (1) `objective` supports a `hybrid` class balancing
simultaneous styles (powerlifting + BJJ); (2) customizable equipment list acting
as STRICT boolean filters on the movement pool during workout generation;
(3) remove the single-session prescription view, build a deterministic template
engine mapping a full 4-week block into local SQLite. No generative LLM.
Invariants: append-only idempotent migrations; monotone-conservative
prescription chain; verify:all green per step; zero cloud.

## Constraint analysis (existing system)

- Migrations are ordered SQL strings, **append-only, idempotent by contract**
  (self-heal re-applies ALL when a sentinel is missing). SQLite cannot widen a
  CHECK in place → table rebuild required. A rebuild-in-place
  (`CREATE v2 → copy → DROP → RENAME`) is NOT idempotent-and-data-preserving:
  on self-heal re-apply, the copy column list cannot include new columns when
  the source is the old shape (compile error) and resets them when the source
  is the new shape (silent data loss).
- `movement` has incoming FKs (`set_record` RESTRICT) — rebuilding it is worse;
  `ALTER TABLE ADD COLUMN` is not idempotent.
- `macro_cycle.goal` CHECK is shipped and lacks 'hybrid'; `micro_cycle` is the
  demo's historical periodization record. Do not overload them.
- `computePrescription(_patterns)` ignores its argument — the COACH pattern
  picker is vestigial; daily policy reads only `state_vector`. Removing the
  single-session view does not touch the safety chain.
- Movement library today is seeded ONLY by the demo loader (`INSERT` with
  explicit ids 1..7). A real install has an empty movement table — the block
  engine would generate nothing.
- `verify_schema.py` inserts movement_id=1 manually; `verify_demo_path.mjs`
  asserts movement count == 7. Both must track new seeds.

## Decisions

### D1 — `athlete_profile` v2 table (new name), migration 007
007 creates `athlete_profile` (same 10 categories) with:
- `objective` CHECK gains `'hybrid'`;
- `equipment_access` column REPLACED by
  `equipment_inventory TEXT NOT NULL DEFAULT '<full list JSON>' CHECK (json_valid(...))`;
- copy row from legacy `user_profile` via `INSERT OR IGNORE ... SELECT`, mapping
  legacy `equipment_access` → an inventory bundle (`full_gym`→all,
  `home_basic`→home bundle, `minimal`→minimal bundle) with CASE;
- `INSERT OR IGNORE (profile_id) VALUES (1)` safety seed;
- `DROP TABLE IF EXISTS user_profile`.
Idempotent AND data-preserving in every path: on self-heal re-apply, 006
recreates the (now-empty-defaults) legacy table, the copy is ignored (row
exists), legacy is dropped again — customized hybrid objective + inventory
survive. SENTINELS: replace `user_profile` with `athlete_profile`, add
`training_block`. Store/verifier SQL renames to match.

### D2 — Equipment: join table + curated movement seed in 007
- `EQUIPMENT_ITEMS` (TS const + SQL CHECK): barbell, squat_rack, bench,
  dumbbells, kettlebell, pullup_bar, nordic_bench, bands, cable_machine, mats.
- `movement_equipment (movement_id FK CASCADE, item CHECK, PK(movement_id,
  item)) STRICT, WITHOUT ROWID`. A movement with no rows = bodyweight.
  Availability = required ⊆ inventory (STRICT boolean — no soft fallback).
- 007 seeds ~20 movements with `INSERT OR IGNORE`, ids 1..7 IDENTICAL to the
  demo's (Competition Squat … BJJ Sparring Round) so the demo loader (changed
  to `INSERT OR IGNORE`) coexists; ids 8+ add equipment-diverse variants
  (Front Squat, RDL, DB Bench, Goblet Squat, KB Swing, Push-up, Walking Lunge,
  Bulgarian Split Squat, Farmer Carry, Nordic Curl, Band Pull-Apart, Pallof
  Press, Chin-up, DB Shoulder Press, Single-Arm DB Row, Road Run). Equipment
  rows seeded by name subquery (`SELECT movement_id FROM movement WHERE name=…`).
- Presets in UI only: FULL GYM / HOME GYM / MINIMAL buttons write inventory
  arrays; individual chips toggle items.

### D3 — Block tables (new, self-contained; macro/micro_cycle untouched)
```
training_block(block_id PK, start_date GLOB, objective CHECK incl hybrid,
               weeks=4 CHECK, status active|archived, created_at_ms) STRICT
planned_session(id PK, block_id FK CASCADE, week_index 1..4, day_index 1..7,
                focus TEXT, phase CHECK acc|int|real|deload,
                session_date GLOB, UNIQUE(block,week,day)) STRICT
planned_slot(id PK, planned_session_id FK CASCADE, slot_index>=1,
             movement_id FK RESTRICT, sets 1..10, reps 1..30,
             target_rpe 5..10, UNIQUE(session,slot)) STRICT
```
At most one `status='active'` block (enforced app-side; generate archives prior).

### D4 — Generator: pure deterministic TS (`packages/inference/src/blocks/blockGenerator.ts`)
`generateBlock({profile, movements, startDate}) → BlockPlan` (no I/O, no
randomness, no Date.now):
- Pool = movements where required ⊆ profile.equipment_inventory.
- Pattern pick = sort (is_compound DESC, movement_id ASC), first match.
- Weekly split table by objective × weekly_frequency; foci = lower / upper /
  full / conditioning / bjj, each an ordered pattern list trimmed to a slot
  budget derived from session_duration_cap_min (≈1 slot per 22 min, clamp 2..5).
- Scheme table by objective: reps, base sets, RPE wave w1<w2<w3; week 4 =
  deload (sets ceil(×0.5), RPE −1.5). training_age: beginner −1 set, elite +1.
- HYBRID = alternating strength foci and bjj/conditioning days; strength days
  carry sets−1 vs the pure-strength scheme (concurrent-training interference
  damping — this is the "balance the volume" requirement, machine-verified:
  total hybrid strength sets < pure strength plan sets, bjj sessions present).
- Monotone with profile: every target_rpe ≤ base_rpe_cap; rehab ≤ 7.0.
- Pattern slot with empty pool → slot dropped (strictness over substitution),
  noted in plan warnings.
- Dates: start_date = generation day; session_date = start + (week−1)*7 +
  (spread[day]−1) via pure ISO date math. DAY_SPREAD per frequency constant.

### D5 — Store + UI
- Store: `athlete_profile` reads/writes; movements query gains `is_compound` +
  `required` (json_group_array subquery); block slice (`activeBlock`,
  `blockSessions` grid, `todayPlan`); `generateNewBlock()` = BEGIN, archive
  active, insert block/sessions/slots (static SQL literals), COMMIT;
  loaded on boot. Session seeding: if todayPlan exists, seed sessionPlan from
  its slots (plannedSets = clamp(slot.sets + set_modifier, 1, 6)); else legacy
  last-session fallback. SessionScreen add/swap pickers filter by inventory.
- UI: `PrescriptionScreen` → `BlockScreen` (COACH tab): TODAY adjustment strip
  (source badge + load/sets/RPE + profile notes + halt card — the safety chain
  STAYS), block grid (4 weeks × sessions, today highlighted, tap → detail with
  today's numbers shown post-adjustment), GENERATE/REGENERATE (Alert confirm).
  SUBJECTIVE REPORT section retained verbatim. Pattern picker + PRESCRIBE
  button removed (the "single-session prescription view").
- ProfileScreen: objective chips gain HYBRID automatically; equipment_access
  chips → inventory checklist + presets.

### D6 — Verification additions
- `verify_schema.py`: [7] → athlete_profile (hybrid accepted, legacy dropped,
  CHECKs); new [8] movement_equipment + seeds; [9] block tables CHECK/cascade.
  Manual movement insert moves to id 999.
- `verify_migrations.mjs`: FILES += 007; new scenario [4]: upgrade path — chain
  to 006, customize user_profile row, run full chain → data lands in
  athlete_profile, legacy gone; then set objective='hybrid' + custom inventory,
  force self-heal → row survives byte-identical.
- NEW `verify_blocks.mjs` (gate 10 in verify:all): determinism (double-run
  deep-equal); structure (4 weeks, deload, counts, CHECK domains, RPE ≤ caps);
  equipment strictness (ALL 1024 inventory subsets × objectives: no emitted
  movement violates required ⊆ inventory); hybrid balance (bjj present,
  strength sets < pure-strength); SQL default inventory in 007 == TS
  EQUIPMENT_ITEMS; SQLite round-trip with the store's literal INSERTs +
  cascade check.
- `verify_demo_path.mjs` movement count updated; `verify_store_sql.mjs` schema
  list += 007 (statements auto-extracted).
- `build:inference-test` += blocks/blockGenerator.ts.

## Step checklist (verify:all green between every step)
1. **007 schema** + sentinels + demoData INSERT OR IGNORE + schema/migration/
   demo verifier updates.
2. **Inference**: types (OBJECTIVES+hybrid, EQUIPMENT_ITEMS, profile shape),
   blockGenerator.ts, index exports, build list, verify_blocks.mjs + wiring.
3. **Store**: athlete_profile DAO, movement equipment, block slice, seeding.
4. **UI**: ProfileScreen inventory, BlockScreen, SessionScreen filtering,
   App.tsx import; typecheck + Metro bundle.
5. **Ship**: DEVIATION_LOG, handover, commit/push, CI watch, release APK.
