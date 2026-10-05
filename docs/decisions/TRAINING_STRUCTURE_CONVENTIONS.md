# Training Structure Conventions

Date: 2026-08-19
Status: recorded — owner ratification pending

## Purpose

The four Gemini Deep Research documents established that several shipped values and behaviours in the periodization engine are coaching conventions rather than empirically proven scientific truths. This document records each convention, its exact codebase location, and its operational context so that future work does not attempt to re-derive these values as empirical science or alter them without owner ratification.

None of the conventions documented below are proposed for modification; they are recorded as the baseline ground truth.

---

## 1. Four-week block length

- **Location:** `packages/inference/src/blockGenerator.ts:187` (`export const BLOCK_WEEKS = 4 as const;`) and `:189-191` (`PHASE_BY_WEEK`).
- **Classification:** Coaching convention.
- **Context:** All four research documents returned "not found" when searching the empirical literature for an evidence-based optimal mesocycle or block duration. The 4-week block structure is a widely accepted coaching heuristic in strength and conditioning, providing a predictable monthly cadence for programming and recovery.

---

## 2. Deload every fourth week

- **Location:** `packages/inference/src/blockGenerator.ts:189-191` (`PHASE_BY_WEEK = ['accumulation', 'intensification', 'realization', 'deload']`).
- **Classification:** Coaching convention (conservative).
- **Context:** Scheduling a scheduled deload on every fourth week sits at or below the bottom of every consensus range identified in the literature (e.g., Delphi expert consensus recommending 4–6 weeks; practitioner surveys reporting 5.6 ± 2.3 weeks between deloads). Deloading more frequently than the empirical consensus average is a defensible, fatigue-minimising coaching choice, but it reflects programming caution rather than an empirical mandate from cited sources.

---

## 3. What the deload actually does

- **Location:** `packages/inference/src/blockGenerator.ts:624-637`.
- **Classification:** Implementation convention.
- **Context:** When generating a deload session, working sets are halved (`max(1, ceil(baseSets / 2))`), repetitions per set remain **unchanged**, and target RPE is reduced by 1.0 from the scheme baseline (`rpe = scheme.rpeWave[0] - 1.0`), subject to `base_rpe_cap` and floored at 5.0. Target load is untouched. This specific set-halving and RPE-reduction formulation is derived from no cited external paper; it is an internal implementation convention designed to reduce volume and neural fatigue while maintaining movement pattern familiarity.

---

## 4. Week 4 is not unconditionally a deload

- **Location:** `packages/inference/src/blockGenerator.ts:591` (`const deload = recovery || phase === 'deload';`) and `blockGenerator.ts:510`.
- **Classification:** Engine invariant / safety override.
- **Context:** In a standard 4-week block following `PHASE_BY_WEEK`, only week 4 is designated as a deload phase. However, when the kinematic autopilot triggers `globalGuardrail.halt` (`blockGenerator.ts:510`), it sets `recovery = true`. In recovery blocks, `deload` evaluates to `true` across **every** week of the block (weeks 1–4). This safety mechanism is the single exception to week-4-only deloading and was previously undocumented.

---

## 5. LINEAR, WAVE and APRE are the selectable set; STEP is retired

- **Location:** `packages/inference/src/types.ts:214` (`SELECTABLE_SCHEMA_TYPES = ['LINEAR', 'WAVE', 'APRE']`), `packages/inference/src/blockGenerator.ts:381-407` (`SCHEMA_WEEKS`), and `packages/core-db/src/schema/009_periodization.sql:40-41`.
- **Classification:** Product simplification (STEP only).
- **Context:** `STEP` is retired from selection on product-simplification grounds. Unlike the other three it is not volume-equated — `SCHEMA_WEEKS` gives it `setsDelta: 1` in weeks 2 and 3, so it adds volume rather than redistributing a fixed dose. It was cut for simplicity, not because evidence ruled against it.
- **Persistence constraints:** No schema can be deleted from the TypeScript union or the database schema. Frozen SQLite `CHECK` constraints (`schema_type IN ('LINEAR','WAVE','STEP','APRE')`, `009_periodization.sql:40-41`) and existing persisted training blocks reference all four. Retirement is restricted to the selection surface; the engine retains full generation support for every type.

### Why WAVE is retained despite being dose-equated with LINEAR

The research finding is real and is recorded here so it is not rediscovered as a reason to cut WAVE: `SCHEMA_WEEKS` makes `WAVE` a volume- and intensity-equated permutation of `LINEAR` — both carry a 3-week rep-scale sum of 3.0 and use the same RPE wave indices in a different order. Over a whole block they deliver the same dose.

That is not a defect, because **it is not the schema's job to differentiate block-level dose.** A schema governs one layer only: how sets, reps and effort move *week to week inside* a 4-week block. Long-term progress belongs to the block-to-block layer above it. Judging a week-to-week texture by whether it drives long-term adaptation is a category error, and it was the basis of an earlier decision to retire WAVE — since reversed.

What the evidence does rule out is any **claim** that WAVE outperforms LINEAR. The pooled meta-analytic advantage for undulating periodization rests on *daily* undulation (21 daily comparisons against 3 weekly, one linear-vs-weekly study, no subgroup separating them). WAVE is weekly. So WAVE is retained as legitimate week-to-week texture and athlete preference, carrying **no evidential claim of superiority**.

See `docs/decisions/TRAINING_PROGRESSION_LAYERS.md` for the layer model this rests on.

---

## 6. `session.session_rpe` is the mean of per-set RPEs

- **Location:** `apps/mobile/src/state/useStore.ts:5654-5664`, `packages/core-db/src/schema/001_mechanical_input.sql:67` (`session.session_rpe`), and `packages/core-db/src/schema/029_routine_history_analytics.sql:47` (`history_import_session.session_rpe`).
- **Classification:** Provenance boundary and construct distinction.
- **Context:** In native session completion, `session.session_rpe` is computed as the arithmetic mean of logged per-set RPE values rounded to 0.5 (or `null` if no sets were rated). It is **not** a Foster session-RPE (which is calculated as whole-session RPE multiplied by session duration in minutes). Conversely, `history_import_session.session_rpe` stores an athlete-supplied whole-session effort rating from imported logs where per-set RPE was not captured.
- **Standing constraint:** These are two distinct constructs stored in separate tables with identical column names. `session.session_rpe` is currently write-only. Any future analysis, plateau detection, or trend query touching both tables must treat them with explicit provenance awareness and must never combine, average, or union them directly.

---

## 7. `peak_shifted` is vestigial

- **Location:** `packages/inference/src/blockGenerator.ts:573` (`const peakShifted = false;`) and `packages/core-db/src/schema/009_periodization.sql:42-44`.
- **Classification:** Deprecated schema field.
- **Context:** Newly generated blocks hardcode `peakShifted` to `false` (0). The schema comment at `009_periodization.sql:42-43` describing ACWR-driven schedule shifting is obsolete. Because migration 009 is part of the frozen historical migration chain, the SQL comment cannot be modified in place. Schedule peak-shifting was fully removed under Calibration Policy v1.

---

## 8. `mean_velocity_ms` is a dead column

- **Location:** `packages/core-db/src/schema/001_mechanical_input.sql:81` (`mean_velocity_ms REAL`).
- **Classification:** Unused schema column.
- **Context:** Defined in the initial mechanical input schema, `mean_velocity_ms` is written by no path in the codebase. No velocity-based autoregulation or metric calculation is possible without a telemetry data ingestion source.
