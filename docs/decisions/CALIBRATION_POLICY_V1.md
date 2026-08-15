# Calibration Policy v1 Decision Record

Date: 2026-08-14  
Status: owner-ratified and implemented  
Owner: Francis Pike  
Public release: **NOT AUTHORIZED**

## 1. ACWR is Descriptive Only

The application calculates, persists, displays, and graphs:
- Acute recorded external load (tonnage);
- Chronic recorded external load (tonnage); and
- Acute:chronic workload ratio (ACWR).

ACWR possesses no direct or indirect authority over prescription or execution decisions. For identical non-ACWR inputs, changing, omitting, or poisoning ACWR produces identical:
- Readiness classification used to prescribe training;
- Load, set, or RPE adjustments;
- Block phase, deload placement, peak placement, session selection, or warning severity;
- Movement availability, safety routing, substitution, or session start; and
- Fail-closed gates.

User-facing ACWR copy is strictly observational and bounded to recorded data:
> "Recent recorded external load compared with the preceding four-week average. Bodyweight, conditioning, grappling, and unlogged training may be incomplete."

The app makes no claim of an optimal/safe band, no claim that an athlete is adapted or overreached from ACWR alone, no injury prediction, and no claim that altering the ratio prevents injury. Neutral trend indicators are permitted; they never command an automatic dose change.

### Architectural & Implementation Seams
- **Readiness Materialization (`004_state_vector_materialize.sql`):** The `0.30 * load_component` term is removed from the numerator and denominator of `readiness_score`. `load_component`, `acwr`, `acute_load_kg`, and `chronic_load_kg` continue to be calculated and stored as descriptive metrics. All-missing biometrics continue to yield the neutral fallback score `50.0`.
- **Bounded Boot Rematerialization (`useStore.ts`):** The boot-time rematerialization loop is widened from 7 to 14 days so the entire displayed 14-day trend (`date >= date(?, '-13 days')`) reflects the unified policy revision rather than mixing policies across dates.
- **Daily Policy Reference (`policyReference.ts`):** Removed direct `acwr > 1.5` load reduction branch, `acwr <= 1.3` conjunct on the readiness boost, and ACWR-based set reduction (`sets = -2` fires on `r < 40` only). Coaching cues omit all ACWR numbers and the "0.8-1.30 band" phrase while preserving the 12..140 character set contract. Note: with `acwr <= 1.3` removed, the 1.05 boost is reachable on `readiness >= 85 && hrv_z >= 0` alone, preserving the ratified non-ACWR recovery inputs.
- **Block Generator (`blockGenerator.ts`):** Removed `recentAcwr`, `OVERREACH_ACWR`, and ACWR-driven schedule peak-shifting. Newly generated blocks always use `PHASE_BY_WEEK`. The returned plan structure retains `peakShifted: false` to ensure seamless backwards compatibility with persisted blocks and UI consumers. Historical `peak_shifted = 1` rows and frozen blocks are never rewritten.

## 2. Hybrid Planned-Dose Model

The deterministic planned-dose architecture remains the prospective planning heuristic:
- Sets, reps, and target RPE;
- Lift family and reviewed movement coefficient;
- Stress purpose and contextual assistance stress;
- Session duration; and
- Training-age and profile ceilings.

Selection remains uncapped while dose remains non-increasing and bounded. Support and accessory work yield before an executable selected major is reduced. This model is a conservative planning heuristic; it does not constitute a claim of physiological safety, injury prediction, or medical efficacy. Numerical coefficients and family budgets are deferred and remain unchanged.

## 3. Retrospective Signals (Hard Sets and Session RPE)

- Logged per-set RPE produces the `hard_sets` aggregate; session RPE remains an observed whole-session internal-load signal.
- Missing set RPE or session RPE remains `NULL`/unavailable—never 0, and never imputed from population data, planned RPE, or another athlete.
- Retrospective signals are displayed in athlete/coach history and redacted aggregates.
- Retrospective signals do NOT prospectively cap, expand, block, or auto-rewrite a session in Calibration v1.
- Future adaptation rules based on retrospective signals require independent owner approval, versioning, minimum evidence definitions, and migration specifications.

## 4. Optional 21-Day Return Check-In

- **Trigger:** At least 21 complete calendar days elapsed since the most recent qualifying training evidence (local session with >=1 logged set, or eligible imported session history).
- **Brand New Athletes:** An athlete with no qualifying history never receives a return prompt.
- **Non-Blocking & Non-Destructive:** The prompt is athlete-local and dismissible. It does not reset history, downgrade training age, revoke prior-experience confirmations, alter equipment/niggles/attestations/role gates, or apply automatic numeric dose modifications.
- **Actions:**
  1. *Continue current plan:* Records acknowledgment only; preserves existing plan.
  2. *Review first session:* Records acknowledgment and routes to the existing `BlockScreen` review path so the athlete may adjust their session using existing controls without pretending an automated reduction was applied.
- **Trigger implementation:** `refreshReturnCheckin` measures the gap from `MAX(session_date)` over sessions that carry at least one `set_record` row. A bare session shell is not qualifying evidence, and an athlete with no qualifying session is never prompted.
- **Persistence (`055_return_checkin_ack.sql`):** Uses table `return_checkin_ack` (`last_qualifying_date PRIMARY KEY`, `acknowledged_action`, `acknowledged_at_ms`) with `INSERT OR IGNORE` semantics. Keying on the qualifying date is what suppresses duplicate prompts for the same detected gap; a later gap prompts again. The table carries no applied-dose column by design. Cleared on `resetTrainingData`.
- **No dose authority:** `confirmReturnCheckin` writes the acknowledgement row and nothing else. It never calls `generateNewBlock` and never writes a plan or dose table. `review_first_session` routes to the existing `BlockScreen` session-review path (`openNextSession`); the athlete adjusts the session with existing controls. This is pinned by negative invariants in `verify_policy.mjs` [9] and `verify_store_sql.mjs`.

## 5. Coefficient Governance

### Frozen Coefficient Registry

| Parameter / Coefficient | Frozen Value | Provenance / Location | Invariant & Status |
| :--- | :--- | :--- | :--- |
| **Readiness: HRV Weight** | `0.35` | `004_state_vector_materialize.sql` | Active, normalized to `/ 0.60` |
| **Readiness: Sleep Weight** | `0.25` | `004_state_vector_materialize.sql` | Active, normalized to `/ 0.60` |
| **Readiness: Load Weight** | `0.00` (Removed) | `004_state_vector_materialize.sql` | Removed per Calibration Policy v1 |
| **Readiness: SpO2 Weight** | `0.00` | `004_state_vector_materialize.sql` | Descriptive only |
| **Autopilot: Decay Factor (λ)** | `0.88` | `kinematicAutopilot.ts:LAMBDA` | Frozen flaw-detector decay factor |
| **Autopilot: Max RPE Error ($E_{max}$)** | `3.0` | `kinematicAutopilot.ts:E_MAX` | Frozen RPE error bound |
| **Autopilot: Max Joint Severity ($J_{max}$)** | `10` | `kinematicAutopilot.ts:J_MAX` | Frozen joint severity scale cap |
| **Autopilot: Deadband ($\delta$)** | `0.15` | `kinematicAutopilot.ts:DELTA` | Frozen deadband threshold |
| **Autopilot: Weight Base ($W_{base}$)** | `0.7` | `kinematicAutopilot.ts:W_BASE` | Frozen base accumulation weight |
| **Autopilot: Weight Trend ($W_{trend}$)** | `0.3` | `kinematicAutopilot.ts:W_TREND` | Frozen trend weight |
| **Autopilot: Min Observations** | `5` | `kinematicAutopilot.ts:MIN_OBSERVATIONS` | Frozen confidence threshold |
| **Autopilot: Deficit Threshold ($\theta_{deficit}$)** | `0.3` | `kinematicAutopilot.ts:THETA_DEFICIT` | Frozen capacity deficit threshold |
| **Autopilot: Headroom Threshold ($\theta_{headroom}$)** | `0.3` | `kinematicAutopilot.ts:THETA_HEADROOM` | Frozen latent headroom threshold |
| **Autopilot: Max Added Sets** | `2` | `kinematicAutopilot.ts:MAX_ADDED_SETS` | Frozen block-wide added set cap |
| **Autopilot: Load Step** | `0.05` | `kinematicAutopilot.ts:LOAD_STEP` | Frozen load modifier step |
| **Autopilot: RPE Step** | `0.5` | `kinematicAutopilot.ts:RPE_STEP` | Frozen RPE step |
| **Autopilot: Max Macrocycle RPE Raise** | `2.5` | `kinematicAutopilot.ts:MAX_MACROCYCLE_RPE_RAISE` | Frozen 8-block macrocycle RPE ceiling |
| **Autopilot: Set Step** | `1` | `kinematicAutopilot.ts:SET_STEP` | Frozen set increment |
| **Autopilot: Deadband** | `0.15` | `kinematicAutopilot.ts:DEADBAND` | Frozen control deadband |
| **Autopilot: Strong Threshold** | `0.4` | `kinematicAutopilot.ts:STRONG_THRESHOLD` | Frozen strong-signal threshold |
| **Layoff: Gap Trigger Threshold** | `21 days` | `returnFromLayoff.ts:LAYOFF_GAP_DAYS` | Frozen check-in trigger; NOT a dose value |
| **Lift Anchor Coefficients** | `1.0` | `011_lift_anchor.sql` / `movement_family` | Frozen anchor values (Squat, Bench, DL, OHP) |

**Return-to-training dose modifiers: NONE.** Ratification §5 forbids any executor from
inventing a return-to-training dose modifier, and §4 forbids the check-in from changing
dose automatically. `LAYOFF_GAP_DAYS` is a detection threshold, not a prescription value.
No load multiplier or RPE cap exists for the return path, and `verify_policy.mjs` [9]
asserts the engine's export surface is exactly `{ LAYOFF_GAP_DAYS, RETURN_OPTIONS,
evaluateReturn }` so one cannot be reintroduced quietly.

Every row above except the lift anchors is pinned by an equality assertion in
`verify_policy.mjs` [10]. The anchor row is enforced by the `011` seed content rather
than that gate.

- All mappings and movement coefficients are explicit, movement-specific, versioned, and reviewable.
- The four anchor-family coefficients ratified at `1.0` (Squat, Bench Press, Deadlift, Overhead Press) remain the only approved anchor values.
- No coefficient is inferred from a movement name, equipment label, pattern, capability edge, assistance distance, or other movement.
- Bodyweight contribution requires a reviewed mapping and an athlete-local bodyweight measurement on or before the session date. Missing mapping or missing bodyweight yields unavailable equivalent volume, not zero or a population estimate.
- Assistance distance and fatigue values are planning heuristics, not physiological equivalence or injury-risk values.
- Numerical calibration of alternative coefficients, family budgets, and automatic return modifiers remains deferred.
