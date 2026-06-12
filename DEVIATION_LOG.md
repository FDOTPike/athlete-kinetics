# Deviation Log

Architectural deviations from product mandates, with rationale. Newest first.

## 2026-06-12 — Phase 11 step 1 (Health Connect telemetry)

1. **RHR lands in the EXISTING `hrv_daily.resting_hr` column** — no new
   table; 002 already modeled it. Consequence: a day with an RHR reading but
   no HRV sample can only update an existing row (rmssd_ms is NOT NULL by
   CHECK); RHR-only days are dropped by design rather than fabricating an
   HRV value.

2. **Unstaged sleep is estimated at 92% efficiency, not 100%**
   (`UNSTAGED_SLEEP_EFFICIENCY = 0.92`, population median). A session with
   no stage data treated as fully asleep would flatter the sleep component
   of readiness — against the conservative house posture. Staged sessions
   use real stage math (awake/out-of-bed/awake-in-bed excluded).

3. **Android minSdkVersion 24 → 26**: the Health Connect client library's
   floor. Drops support for Android 7.x devices (≈2016-era); Health Connect
   itself needs Android 9+ anyway, and 26 keeps 8.x users on the
   subjective-only path rather than excluding them.

4. **Read-only health scopes.** The manifest declares only READ permissions
   for HRV / resting HR / sleep; the app never writes health data. The
   aggregation layer is pure TS exercised by gate 11 (verify:biometrics) —
   the native adapter is a thin wrapper whose every failure path returns
   null/false/[] (graceful degradation by construction).

## 2026-06-12 — Phase 10 (multi-schema generator, absolute loads, cost matrix)

1. **"Migration 008" landed as 009** — 008 shipped as the taxonomy scaffold
   in v0.9.1 before this mandate arrived; the chain is append-only.

2. **`schema_type` lives in a `block_meta` side-car, not on `training_block`.**
   ALTER TABLE ADD COLUMN is not idempotent under the runner's self-heal
   re-apply, and rebuilding training_block would cascade-drop every planned
   session. block_meta also carries the 32-week macro position
   (macro_block_index/macro_phase) and the peak_shifted flag.

3. **1RMs are movement-keyed, not a fixed Big-4 enum.** `one_rep_max` keys on
   movement_id (any movement can carry a max — APRE needs that); the ATHLETE
   UI exposes exactly the Big 4. RPE/reps → %1RM is pure TS (Epley:
   pct = 1/(1 + totalReps/30), 2.5 kg rounding) — no percentage column on
   planned_slot; absolute APRE adjustments persist in `slot_override` with a
   mandatory human-readable reason the UI shows verbatim.

4. **APRE reactive mutation requires a 1RM for the movement.** Without an
   absolute base the "increase the target load" instruction has no defined
   arithmetic; movements without a max are skipped (the athlete sees targets
   only where maxes exist). +2.5 kg per 2 surplus reps, capped +7.5/week,
   never fires from week 4 (the next block re-derives from scratch).

5. **The deadlift auto-regulation gate shifts the whole peak block** (deload
   inserted week 1, peak realization week 4), not a deadlift-only lane —
   peaking the hinge on an overreached athlete while squatting heavy in the
   same week would be incoherent. Gate: ACWR > 1.5 at PEAK-phase generation
   time only; null telemetry never shifts.

6. **The hybrid tax generalizes beyond the mandated hybrid+APRE pair**: any
   schema whose fatigue cost reaches the threshold (WAVE/STEP in their hot
   phases) pays the same 1-set accessory tax; APRE pays 1-2 everywhere.
   Machine-pinned: hybrid APRE < hybrid LINEAR accessory sets, strength
   unaffected.

## 2026-06-12 — Pre-Phase-10 polish (positive triage, gate removal, taxonomy)

1. **The forced pre-session check-in gate is REMOVED (supersedes Phase 9
   entry 3).** Field testing showed it as logging friction. START SESSION is
   instant again on both COACH and SESSION. The safety floor is preserved at
   a deeper layer than the old gate ever was: an operative halt blocks
   starting inside the STORE ACTION itself (plus both UIs), and the ad-hoc
   subjective report remains one tap away on COACH.

2. **Positive sentiment is an identity pass-through by construction.**
   No-op guardrails (load ≥ 1, sets ≥ 0, cap ≥ 10, no halt) are skipped when
   selecting the operative report inside `derivePrescription` — "it felt
   good" can never present as GUARDRAIL APPLIED. The UI acknowledges with a
   minimal positive card, and only when no restrictive report from earlier
   the same day still governs (a positive afternoon report must not mask a
   morning DOMS damping). Machine-pinned in verify:policy [6].

3. **ExRx taxonomy is a side-car table (008), not a movement.pattern
   rewrite.** The shipped pattern CHECK cannot be widened (append-only
   chain). `movement_taxonomy(category, implement, family)` scaffolds
   Phase 10's external training laws; the block generator intentionally does
   not read it yet.

4. **"One generic exercise per category" = taxonomy rows mapped onto EIGHT
   EXISTING canonical movements** (Competition Bench→push, Barbell Row→row,
   Deadlift→hinge, Competition Squat→squat, Plank→core, Walking
   Lunge→unilateral, Band Pull-Apart→accessory, Road Run→cardio) — no
   placeholder "Generic Push" names polluting the user-facing library.

5. **Injury/mobility notes now persist on every keystroke** (field-tested:
   blur/tab-switch ordering could drop input committed only on end-editing),
   with the example text rendered as a permanent hint below each box.

## 2026-06-12 — Phase 9 mandate (hybrid profile, equipment filters, block engine)

1. **`user_profile` superseded by a NEW `athlete_profile` table, not widened
   in place.** SQLite cannot alter a CHECK constraint and shipped migrations
   are append-only by contract. Every in-place rebuild pattern
   (CREATE v2 → copy → DROP → RENAME) is either non-idempotent under the
   runner's self-heal re-apply or silently resets new columns. Migration 007
   creates `athlete_profile` (objective CHECK gains `'hybrid'`,
   `equipment_access` enum replaced by an `equipment_inventory` JSON list),
   copies the legacy row once via INSERT OR IGNORE (legacy enum mapped to an
   inventory bundle), and drops `user_profile`. Machine-verified: upgrade
   carries customized data; a forced self-heal preserves a hybrid objective
   and custom inventory byte-identical (verify:migrations [4]).

2. **Hard halts never scale with experience.** The Step-4 mandate ordered
   triage severity scaled by training_age ("milder reduction" for advanced/
   elite). Implemented for DAMPING guardrails only: halt guardrails (sharp
   pain, dizziness, chest symptoms) pass through `scaleGuardrailForExperience`
   unchanged at every age — a hard stop is a medical posture, not a tunable.
   Also beyond the mandate's letter: positive no-op guardrails are identity
   (an elite's "feeling great" must not be tightened by the 8.0 ceiling), and
   any flagged report ceilings at RPE 8.0 regardless of age. All pinned in
   verify:policy [5], including composition never exceeding the base.

3. **The SessionScreen "side door" is closed.** The mandate gated only the
   BlockScreen's Start Session behind the pre-session check-in. Leaving
   SessionScreen's empty-state START as a direct path would have made the
   gate decorative; that button now routes to COACH (the gate), with the
   direct call kept only as a no-router fallback. One start path, one gate.

4. **Block engine lives in new tables; `macro_cycle`/`micro_cycle` are
   untouched.** Their CHECK enums are shipped (goal lacks 'hybrid' et al.)
   and they are the demo athlete's historical periodization record. The
   4-week macro-cycle maps to `training_block`/`planned_session`/
   `planned_slot` (STRICT, FK cascade, CHECK-pinned domains).

5. **Strictness over substitution in generation.** When the inventory cannot
   support a pattern, the slot is dropped and a warning recorded — the
   generator never substitutes a movement whose equipment the athlete lacks.
   Swept across all 1024 inventory subsets × 8 objectives (8,192 plans,
   0 violations; verify:blocks [3]).

6. **Movement library is seeded by migration 007 (30 movements), ids 1–7
   byte-identical to the demo loader's list** (the loader now uses INSERT OR
   IGNORE). Without this a real (non-demo) install had an empty movement
   table and the block engine would generate nothing.

7. **Hybrid at weekly_frequency 1 is sport-only (`['bjj']`).** Concurrent
   training needs at least two days; the strength side returns at frequency
   2+. Keeps the machine-verified law "every hybrid block contains bjj
   sessions" true at every frequency.

8. **Step-5 adversarial audit (13 agents, 9 confirmed findings) drove a
   structural fix: the three-layer derivation is now a pure function.**
   Confirmed majors, all fixed pre-release: (a) the store's date froze at
   boot — an app left open/backgrounded past midnight kept yesterday's halt
   latched (lockout) AND persisted new reports under yesterday's date (a 7am
   red-flag halt silently vanished on the next restart). Fixed with
   `rolloverDay()` (AppState foreground listener + guards in
   startSession/reportSubjective) and `localToday()` at every persistence
   point; `lastTriage` now mirrors persistence exactly (cleared when no
   report is operative). (b) `moreConservative` ignored `rpe_cap_max`, so
   real codebase tie pairs (soreness-doms vs technique-breakdown,
   positive-strong vs equipment-improvised) resolved by insertion order —
   the restrictive report could be silently discarded; the comparator is now
   a total order and the store query is ORDER BY report_id. (c) The audit
   snapshot composed onto the CURRENT prescription (compounding two
   guardrails, or yesterday's vector); it now derives from the same pure
   function as the operative path. (d) Mutation testing proved the layer-3
   store wiring had zero machine coverage — `derivePrescription()` is
   extracted into packages/inference, exercised against the REAL phrase
   codebase in verify:policy [6] (tie ordering, restart stability, halt
   surviving training-age edits, scaling bounds), with wiring tripwires in
   verify:store. Coverage folds: deload law now swept across all 56 plans,
   determinism across all 7 frequencies, RPE 5.0 floor pinned, scaling
   monotonicity swept over real entries (weak — the 8.0 ceiling binds).

## 2026-06-11 — Phase 8 mandate (update.txt: profiles, triage override, session UI)

1. **Profile persisted in SQLite, not Zustand-only.** The mandate says "update
   the Zustand store"; a store-only profile dies with the process. The profile
   lives in the single-row `user_profile` table (migration 006, CHECK-
   constrained) with a Zustand slice over it. Offline-first invariant kept.

2. **Profile is a prescription layer, not just data.** "Actively prevents
   overtraining" is implemented as deterministic clamps
   (`packages/inference/src/profileLimits.ts`): policy → profile limits →
   triage guardrails, every layer monotone conservative (machine-verified
   sweep, 10,368 combinations). The default profile intentionally trims
   boost-day RPE 9.5 → 9.0; pushing past 9 requires an explicit profile edit.

3. **Red-flag override is a severity FLOOR with category-aware arbitration,
   not a blanket bypass.** A confident semantic match in a curated body-state
   category (pain/illness/fatigue) outranks the generic floor — "felt a sharp
   pop" must keep the curated HALT, and a calibrated pain-mild (0.7/RPE 7)
   must not degrade to the floor (0.6/RPE 6). Mixed reports misrouted to
   positive/technique/equipment ARE overridden. Two override tiers: systemic
   language (dizziness/faintness/chest bigrams) halts; pain language floors.

4. **Exact token sets instead of the mandate's substring keywords.** Naive
   matching flags "shoulder *stab*ility", "*chest* press", "feeling *sharp*".
   Tier-1 standalone tokens, Tier-2 tokens requiring body-region co-occurrence,
   chest as bigrams only, and a one-token negation lookbehind ("no pain")
   added beyond mandate. Documented residual conservative false positive:
   "snapped the bar off the floor" flags (fails toward safety).

5. **Similarity percentages removed from UI but kept in the database.** The
   mandate's "1.0 (100%)" is implemented as confidence semantics (override is
   treated as fully confident), not a stored fake score — `similarity` stays
   the true cosine (or NULL on the keyword-only path) for codebase curation.

6. **The keyword safety layer is embedder-independent.** The report input is
   no longer hidden when the ML runtime is unavailable; `resolveReport(text,
   null)` provides the full deterministic path. This exceeds the mandate but
   is the point of a lexical layer.

7. **"Remove the swipeable movement cards"** — no swipeable cards existed
   (the prior UI was a chip picker). Interpreted as: replace the picker with
   the workout-overview nav (plan slots + logged/planned badges + out-of-order
   select + swap). Planned sets per slot derive from the prescription's
   `set_modifier` (first UI consumer of that number).

8. **Halts now survive app restart** (beyond mandate, required for safety
   coherence): the operative prescription is a pure derivation from persisted
   state (profile + today's `subjective_report` rows), recomputed on boot —
   nothing safety-relevant lives only in memory.
