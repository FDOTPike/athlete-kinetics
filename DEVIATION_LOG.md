# Deviation Log

Architectural deviations from product mandates, with rationale. Newest first.

## 2026-08-11 - Phase 2a pre-release content correction (migration 049)

1. **The five high-risk records ship on OWNER APPROVAL, with independent
   professional technique review deferred to a non-blocking pre-release
   recommendation.** Board Press (151), Kettlebell Turkish Get-Up (Lunge style)
   (231), Floor Glute-Ham Raise (202), Natural Glute Ham Raise (244) and Seated
   Good Mornings (271) carry loaded-overhead, board-retention or eccentric
   hamstring demands. Their coaching copy and equipment sets were approved
   together by Francis Saga Pike as owner. The approval records state
   `approver_role: "owner"` and `approval_basis: "owner_release_decision"`:
   **they assert owner authority, not a clinical or coaching credential, and no
   reviewer is invented.** If professional review is later obtained it is
   appended as a second, additive `professional_review` entry under the same
   hash-binding rule; it never replaces the owner approval.

2. **The corrected coaching copy derives from a community dataset whose
   revision is unknown.** `yuhonas/free-exercise-db` is recorded in
   `library_target_v1.json` with `upstreamRevision:
   "unknown-preexisting-import"`, so the current upstream is **corroborating
   evidence, not authority for the frozen bytes**. Each correction cites its
   upstream `id` and carries `standing: "corroborating; frozen import revision
   unknown"`. Every proposal was re-validated against the shipped dataset rather
   than accepted on the audit's word; the rejected ones are recorded per record
   in `movement_content_correction_v1.json` (`notes`).

3. **The approval binds the hash, and that check is live.** Each record's
   approval stores the `correction_sha256` it was granted against, so editing
   one character of approved copy — or one item of an approved equipment set —
   invalidates the approval and `generate-library-correction.mjs` refuses to
   emit 049 until the record is re-approved. Machine-checked in
   `scripts/test-library-correction-generator.mjs` and `verify_library.py [7]`.

4. **O2: two records ship byte-identical coaching copy by design.** "Hammer Grip
   Incline DB Bench Press" and "Incline Dumbbell Bench With Palms Facing In" are
   genuine aliases whose upstream instructions are identical. Rather than
   inventing a spurious difference or collapsing a shipped name, both retain
   their names, media keys and the exact-300 corpus, and both carry the same
   correct payload written out in full — no prose cross-reference leaks into
   athlete-facing copy. The alias relationship is recorded here.

5. **Accepted availability regression: Floor Glute-Ham Raise now requires a
   `nordic_bench`.** It moves from bodyweight-anywhere to requiring a
   purpose-built ankle anchor, because the partner/generic-anchor alternative
   cannot be enforced by the equipment filter. This is the intended fail-closed
   trade, not an oversight.

6. **The `glutes` entry in the Turkish Get-Up (Lunge style) `target_muscles` is
   owner-directed, not source-derived.** Upstream lists abdominals, hamstrings,
   quadriceps and triceps only. Recorded in the correction record's `notes`.

7. **Coaching text enforces nothing; only the equipment filter does.** Board
   Press names bands as the board-retention method because that is the
   executable configuration the strict subset filter can enforce
   (`boards, bands, barbell, bench, squat_rack`). Its spotter sentence is
   phrased "Use a spotter when available" and is **advisory only — the app does
   not enforce, detect, or require a spotter, and no part of this change claims
   otherwise.** A training partner is deliberately NOT offered as an alternative
   retention method.

8. **Out of scope, deliberately:** the corpus-wide P2 that all 176 v2 coaching
   intents share one generated template remains a P2 against the v2 generator
   and is not rewritten here. 049 writes no media of any kind — asset keys,
   statuses, revisions and the 124 legacy YouTube fallbacks are byte-identical,
   and Phase 2b video generation stays paused.

## 2026-08-10 - Accepted pre-release scope for bodyweight and alternative volume

1. **The current raw-tonnage limitation is accepted for internal pre-release
   testing.** Readiness continues to use `reps * load_kg`; no unreviewed
   coefficient or bodyweight estimate is introduced into the shipped history.
   Product copy must not represent this value as total mechanical work for
   bodyweight movements.

2. **Later remediation is limited to Squat, Bench, Deadlift, and OHP anchor
   volume.** Alternatives require explicit movement-to-anchor mappings and
   owner-reviewed coefficients. A reviewed bodyweight alternative uses entered
   added load plus the most recent valid bodyweight measurement on or before the
   session date. Missing bodyweight fails closed. The complete decision and
   non-decisions are recorded in
   `docs/decisions/FOUR_LIFT_EQUIVALENT_VOLUME.md`.

3. **No coefficient is inferred from existing capability or prefix data.** The
   capability graph encodes progression families, while condition-prefix
   multipliers encode a different model. Neither is evidence for leverage or
   stability equivalence, so this checkpoint does not alter readiness math.

## 2026-07-31 - Completion-action evidence limits

1. **A mean-only completion signal is direction-blind.** Equal-average
   improving and worsening shortfall histories produce the same candidate
   action. This is an accepted measurement limit, not a tuning defect.
   Completion authority remains dormant while the connected device has zero
   eligible finalized outcomes. If real data later shows that direction must
   affect control, a separately ratified slope/recency term and finite sweep
   will be required; it must not be smuggled into the threshold.

2. **Skipped-slot identity is not durable.** `session_outcome` persists only
   `skipped_slot_count`, not the identities or movement patterns of skipped
   slots. The migration-free observer therefore excludes an entire session
   whenever `skipped_slot_count > 0`, rather than fabricating pattern
   attribution. This further shrinks the evidence pool. Before completion
   becomes the live beginner control signal, real usage may justify a migration
   that freezes per-slot skip identity.

## 2026-07-31 - Open defect: bodyweight work is invisible to readiness load

1. **Status: open; coefficient remediation deferred pending evidence.** A
   bodyweight set records only added external load and correctly defaults that
   input to `0 kg`. However, `set_record.tonnage_kg` is generated as
   `reps * load_kg` (`001_mechanical_input.sql:84`). A bodyweight-only set
   therefore contributes zero tonnage to `mech_daily`, the acute/chronic load
   ratio, and `state_vector.load_component`, regardless of the athlete's body
   mass or completed reps.

2. **Impact is concentrated in the beginner path.** Beginners are deliberately
   eligible for bodyweight and dumbbell work, so the profiles most likely to
   rely on bodyweight training have the least complete readiness-load signal.
   No bodyweight coefficient will be invented without data. Remediation needs
   a separately ratified effective-load model and recalibration evidence.

## 2026-07-30 - Kinematic Autopilot R1/R1a authority envelope

1. **The final +2.5 macro-cycle RPE-raise budget is a corrective-overlay bound.**
   R1/R1a first established a +1.0 fail-closed bound; C6B then ratified the
   finite relaxation to `0.5,0.5,0.5,0.5,0.5,0,0,0`. Planned progression still
   comes from `progressionEngine` and the `SCHEMES`/`PHASE_MODS` tables. The
   final schedule disables only additional upward autopilot correction after
   macro block 5; it does not stop athletes progressing on plan.

2. **Unknown macro position fails closed.** `deriveControlAction` requires the
   persisted `macroBlockIndex`, and its runtime guard gives absent or
   non-finite values no positive RPE allowance. Corrupt state cannot reopen
   upward authority.

3. **R2 authority obligation discharged by C6B.** After correcting the
   deload/window observer straddle, the deterministic 2,385-case family was
   re-run at `1.0`, `2.5`, `3.0`, and unbounded authority. Francis preferred
   `3.0` for a six-block, roughly 24-week coaching-learning window, but its
   applied-block `mixed` population rose from 401 to 463 toward the unbounded
   control, so C6B rejected it under the predeclared early-warning rule. The
   authorized next-lower `2.5` value was selected: it preserves the baseline
   historical and applied classification assignments, with zero upward
   saturation, zero limit cycles, and green historical counterexamples.
   Unbounded authority remains a NO-GO because it introduces one deterministic
   decision-boundary limit cycle and raises historical `mixed` from 389 to 562;
   R2 did not make the finite R1 authority envelope redundant.

4. **C3 aggregates restated under the corrected applied-block classifier.** The
   isolated pre-R1/pre-R2 replay reproduced the historical labels exactly, then
   changed the primary headlines from 14 to 7 limit cycles and from 1,711 to
   1,687 saturated cases: 1,445 upward and 242 downward. The explicit
   stationary action tables, zero-noise examples, and pinned counterexamples
   are unchanged, so the C3 NO-GO finding and both remediations still stand.

## 2026-07-30 — Kinematic Autopilot C4 expected-failure gate

1. **Controller stability is not demonstrated.** C3 found six
   stationary-template limit cycles and nominal gain-3 upward saturation. The
   product must not claim stability while this defect remains open.

2. **The C4 gate intentionally reports seven XFAIL cases.** These are temporary
   evidence pins, not desired behavior contracts. An unexpected pass makes the
   gate red so the remediation must deliberately convert the affected case to
   an expected pass. The healthy/niggle override and two low-frequency
   thin-data cases remain ordinary expected-pass assertions.

3. **No shipped controller behavior changes at C4.** Remediation is sequenced:
   first a cumulative RPE authority budget (option 3), then a phase-aware trend
   reference (option 4), each behind its own checkpoint.

## 2026-07-17 — Phase 18 (Training Decision Record)

1. **The rewards roadmap is superseded by neutral, immutable session outcomes.**
   Phase 18 records one of followed_plan, adapted_session, stopped_safely, or
   session_recorded; it does not award points, badges, streaks, levels, ratios,
   or adherence scores. Classification uses only athlete-controlled dose
   (sets, reps, or seconds). RPE, load, band choice, rest behaviour, training
   age, and session mode remain evidence/context and are never judged.

2. **Recognition is prescription-inert by construction.** The outcome engine is
   pure and the store writes its decision only during atomic session
   finalization. APRE and state-vector updates remain independent existing
   paths, driven from the session's persisted planned origin and logged work;
   neither reads nor branches on session_outcome.

3. **Empty manual stops are disposable.** A zero-set outcome is durable only
   when a persisted niggle, pain, or safety directive halted the session.
   Empty completions and accidental zero-set manual stops delete the session
   shell and create no outcome row.


## 2026-07-12 — Phase 15 (Onboarding + Coach Mode)

1. **Coach Mode multi-athlete support is DB-FILE-per-athlete, not a migration.**
   The mandate ("several profiles running different people at the same time")
   requires isolated training HISTORY, which 013's profile_slot (profile-only
   snapshots) cannot provide. Implemented as `openKineticsDb(dbName)` + a
   document-dir JSON registry (`coach_athletes.json`). The registry selects
   which database to open, so by construction it cannot live inside one —
   the same bootstrap reasoning as the embedder MODEL_PATH. profile_slot keeps
   its shipped semantics (per-athlete profile PRESETS; the debug workflow).
   Registry invariants are machine-checked by the new `verify:coach` gate
   (13th gate): default athlete pinned to the legacy file forever, total
   parse (corrupt registry can never brick boot), no path escapes, active/
   default/last undeletable.

2. **Onboarding trigger is `athlete_profile.updated_at_ms = 0`, not a new
   column.** The stamp is set by the FIRST saveProfile and by nothing else, so
   "never saved a profile" ≡ "never onboarded" — no migration, correct for
   fresh installs AND brand-new Coach Mode athlete files; existing installs
   (stamp > 0) never see the wizard. Wizard answers commit in ONE
   completeOnboarding() save: an abandoned wizard can never persist a partial
   profile.


## 2026-06-15 — Phase 13 Step 4 (Autopilot Integration & Block Wiring)

1. **`mech_daily` is NOT the per-pattern flaw source (the mandate said "pull from
   mech_daily and 015_set_prefix").** `mech_daily` is a DATE-keyed cross-movement
   rollup with a single weighted RPE — it has no pattern dimension and cannot
   yield per-pattern ΔE. Per the derivation's §1 read budget ("windowed
   set_record/niggle aggregates"), the per-pattern signal is sourced from
   `set_record ⋈ session(date) ⋈ movement(pattern) ⋈ planned_slot(target_rpe) ⋈
   set_prefix(effective_load_kg)` + `niggle`. `mech_daily`/`state_vector` provide
   the calendar + ACWR context only, and stay **read-only** (invariant 6 held).

2. **ΔE join is by `(session_date, movement_id)`** — there is no FK linking a
   logged `session` (001) to a prescribed `planned_session` (007). The store's
   derived table dedups multiple matching slots with `MIN(target_rpe)`
   (deterministic; the conservative pick). Attenuation base is
   `set_record.load_kg` (`set_prefix` stores only the effective load).
   **Accepted limitation (adversarial review):** if a block is REGENERATED
   mid-cycle, two blocks can hold plans on the same past window date, and
   `MIN(target_rpe)` may match a set against a stale block's target — bounded
   impact given the controller's ±0.5 RPE / ±1 set authority, the φ deadband,
   and the `MIN_OBSERVATIONS` gate; exact per-block targeting is a future
   refinement.

2b. **The flaw window is the FIXED 21-CALENDAR-day grid, not the sparse set of
   materialized `state_vector` dates** (adversarial-review fix). Using only
   days that have a `state_vector` row would (a) DROP a niggle reported on a
   pure rest day and (b) collapse the EMA recency grid to per-observed-day
   instead of per-calendar-day. The store now builds the window from
   `demoDates(today, 21)` and fills rest days with a neutral `state_vector`
   placeholder (F reads only the window length). Niggle days are bucketed in
   LOCAL JS (`localDateOf`, mirroring `startOfTodayMs`), never SQLite UTC
   `date()`, so they agree with session/state_vector dates and the halt gate.

3. **Halt → recovery = every week deloaded** (reuses the verified deload math:
   sets ≈ halved, RPE = wave[0]−1.0, schema heat ignored), `phase='deload'`,
   and ALL per-pattern corrections suppressed. This "snaps to the neutral
   recovery template, drops volume, bypasses progressive overload" without new
   untested code. The block-level halt fires on a severe ACTIVE niggle
   (`severity ≥ EXPERIENCE_SEVERITY[age].haltMin`).

4. **Per-pattern set deltas: −1 on every occurrence, +1 ONCE per pattern.** A
   capacity-deficit reduction applies to every non-deload slot of the pattern
   (conservative, floored at 1 set); a latent-headroom addition applies to the
   pattern's first occurrence only — so the controller's block-wide `+2` cap
   (`blockAddedSets`) is preserved even though a pattern recurs across sessions.
   Corrections never touch the deload week (it is sacred) or locomotion rounds.

5. **The daily-grain `deriveDailyAdjustment` composition into the LIVE
   prescription path is DEFERRED.** Step 4 wires the BLOCK-level corrections
   (the forward-facing `planned_slot` generation IS the forward write; immutable
   by construction — the autopilot path only SELECTs history and INSERTs future
   `planned_*`, never UPDATEs `session`/`set_record`). Folding the autopilot's
   daily `AdjustmentVector` (load_modifier) into `derivePrescription`'s verified
   three-layer chain is a separate, higher-risk integration that warrants its
   own step + safety review — not bundled here. `deriveDailyAdjustment` remains
   exported and available; today's daily vector still flows through the
   unchanged `derivePrescription`.

6. **No new CI gate.** Step 4 EXTENDED the existing verifiers (`verify:blocks`
   [16] block wiring, `verify:autopilot` [11] window projection, `verify:store`
   SQL + wiring tripwires) rather than adding a gate — `verify:all` stays at 12.

## 2026-06-15 — Phase 13 Step 3 (Kinematic Autopilot)

1. **The autopilot is a NEW isolated module (`packages/inference/src/
   kinematicAutopilot.ts`), not edits to `conditionEngine.ts` /
   `blockGenerator.ts`.** The mandate explicitly permitted "the appropriate
   new isolated modules within /inference." Isolation keeps the verified
   Step-6 boundary (blockGenerator) untouched and matches the per-engine
   module pattern (blockGenerator / substitution / conditionEngine /
   derivePrescription each stand alone). `F` and `u` are pure and standalone,
   exactly as `conditionEngine` landed in Step 1.

2. **`verify:all` is now 12 gates, not 11.** A new `verify:autopilot` gate
   was added (the project rule: every layer ships a runnable verifier — the
   same way `verify:biometrics` made it 11). It proves all six derivation
   invariants with analytic φ pins. The mandate's "11-Gate" refers to the
   pre-existing suite; the autopilot gate is additive.

3. **"Step 3" per THIS mandate is the forward-looking PRESCRIPTION autopilot,
   which explicitly PRESERVES `mech_daily` / ACWR — it is NOT the
   effective-tonnage→readiness integration.** The mandate forbids editing the
   backward-looking rollup triggers ("Volume history must remain completely
   pure"). So `F` reads `effective_load_kg` only as a per-set condition
   ATTENUATION weight inside the flaw signal; the raw tonnage / ACWR /
   readiness pipeline is never touched (invariant 6). Folding effective
   tonnage into readiness remains deferred — the bifurcation stands.

4. **The control action lands STANDALONE; live block-generation wiring is
   deferred.** `deriveControlAction` / `deriveDailyAdjustment` produce bounded
   corrections and a daily `AdjustmentVector`, fully verified, but
   `generateBlock` does not yet consume a `ControlAction` (mirrors Step 1,
   where `conditionEngine` shipped standalone before being wired). The
   PDF §2 block-level `target_rpe` clamp to `[5.0, base_rpe_cap]` is the
   downstream block consumer's job; `deriveControlAction` emits only bounded
   ±0.5 RPE deltas, and `deriveDailyAdjustment` already clamps the daily
   `rpe_cap` to `[5.0, 10.0]` — so every emitted delta is bounded today.
   `deriveControlAction(report, profile, macroPhase)` keeps the mandate's
   3-arg signature (the PDF folded `objective`/`macroPhase` into `profile`);
   `profile`/`macroPhase` are part of the operator contract for that future
   wiring (`void`-marked until then).

5. **Source discrepancies, resolved.** The mandate cited
   `./docs/Kinematic_Autopilot_Derivation.pdf` (33 pages); the actual file is
   `docs/Kinematic Autopilot Math Derivation - DeepSeek.pdf` (31 pages). The
   operator also supplied a clean text mirror
   (`docs/Kinematic_Autopilot_Derivation.md.txt`) — used as the source of
   truth, since PDF text-extraction had dropped the reciprocal in the
   attenuation weight `w_p = mean( 1 / max(1, eff/base) )`. The reciprocal is
   load-bearing (a hard condition ATTENUATES, not amplifies, the deficit
   reading) and is implemented per the clean mirror.

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

## 2026-07-13 — P16 S4: variant identity vs the 010 prepend model (audit F3/F4, ratified)

The 010 rule ("an implement variant is NOT a new row, it is a display-time
prepend") cannot carry per-implement equipment: movement_equipment attaches to
the base row, so a Cable variant of a barbell-demanding base is unreachable
for a cable-only athlete, and a BB prefix on a bodyweight base demands nothing.

Decision (Francis, 2026-07-13, after external audit): a curated variant becomes
its OWN row ONLY when its equipment differs from the base row's
(Cable Shoulder Press, Dumbbell Squat). Variants whose implement is already
representable AND whose equipment gap predates P16 stay prefix-encoded with no
new row (Barbell Glute Bridge, Barbell Walking Lunge) — their barbell demand
remains invisible to the equipment filter; this hole is inherited from the 010
model, documented here, and scoped for a future per-prefix-equipment design if
it ever bites on-device.

Also ratified same session: the plan's beginner whitelist ("Beginner +
whitelisted Intermediate staples") ships as movement_beginner_whitelist with 8
dumbbell/cable staples — Romanian Deadlift was proposed and DROPPED by the
rule's own "no barbell for beginners" clause (verify:library caught the
contradiction). Enforced in blockGenerator, substitution L1/L2/L3, and the
SessionScreen picker; machine-checked in verify:blocks + verify:library.
