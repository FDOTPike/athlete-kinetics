# Brief: in-block effort drift (the "hall effect")

**Status:** design brief, 2026-10-31. No code. Ratifies nothing. Every claim about the app is cited so it can be checked. Sol and Astra advised (read-only) before the recommendation; where they corrected the draft, the correction is kept.

## 1. The request

The owner, on pull request 92, 2026-10-31 (noted in `DEVIATION_LOG.md` on branch `claude/plan-card-fixes-2026-10-31`; verbatim in the main checkout's `PROMPT_LEDGER.md`, Entry 0271, not yet committed):

> "For now dont prompt the athlete , there needs to be a way for the app to tell if the user is off track their goals such as rpe goal or other stats if they are being met or not (allow for some error in variation but if the trend is climbing to fast in terms of intensity perception rating (we can call this the hall effect for analogy)  the engine keeps track on the athletes state vector and realigns its accommodating program to help the athlete adjust"

Read plainly: notice, partway through a block, when logged effort runs above plan or rises too fast; ignore ordinary noise; adjust the rest of the program; do not ask the athlete.

## 2. What exists, and the gap

**The detector exists.** `detectFlaws` (`packages/inference/src/kinematicAutopilot.ts:199`) scores each movement pattern from ΔE = logged RPE − the target frozen with the set. Constants (`:48-65`): recency decay `LAMBDA` 0.88, deadband `DELTA` 0.15, `W_BASE` 0.7, trend weight `W_TREND` 0.3, `MIN_OBSERVATIONS` 5 days with a valid ΔE, class thresholds ±0.3. The trend term (`:232-292`) is the mean rise of ΔE *inside* each 7-day segment, through `tanh`: the owner's "climbing too fast", already weighted. The score φ is dimensionless. It reads only the *length* of the state-vector window, not readiness or biometrics, so it is not whole-athlete or goal tracking.

**The response exists, but only at block boundaries.** `deriveControlAction` (`:375`) acts from |φ| ≥ 0.15 (below the ±0.3 class line): −0.5 RPE and −1 set per pattern (load 0.95 when strong), or the mirror raise. Caution, restrictive guardrails and niggles at the athlete's threshold clamp it to reductions; a halt makes it neutral (`:398-449`). Raises are rationed to one +0.5 RPE grant per block across all patterns, in macro blocks 1–5 (`:471-510`). Its only caller with effect is `generateNewBlock` (`apps/mobile/src/state/useStore.ts:4407-4476`), over the trailing 21 days, for the *next* block. `blockGenerator.ts:1357-1385` applies the RPE and set parts outside deload weeks; the load part (`dLoad_p`) is never applied. `deriveDailyAdjustment` (`kinematicAutopilot.ts:548`) is called only by `apps/mobile/src/diagnostics/coachVerificationLab.ts:208` and the verifier.

**Nearby, but not this.** `SESSION_FEEL_RPE_DRIFT_THRESHOLD` = 1 (`packages/inference/src/sessionFeel.ts:33`) only decides whether the completion screen asks how the session went (`:61-66`). Goal progress uses athlete-entered measurements only (`packages/inference/src/focusGoals.ts:537-542`). `review_due` is set by block count (`useStore.ts:4906-4910`).

**The gap.** Drift is measured, but nothing happens for up to four weeks and the athlete never sees it.

**Defect, confirmed (Sol and Astra agree).** `getPendingAutopilotAdjustments` (`useStore.ts:5994-6028`) reads `planned_slot_autopilot` rows `WHERE tb.status = 'active'` (`:6016`): changes already applied to the *current* block. `BlockScreen.tsx:949-951` heads them "What changes next block … These adjustments apply when the next one is built", and `:962` prints `{adj.movementName}: {adj.reason}`, so the athlete sees the stored token ("Squat: held_safety"), once per planned slot. The plain wording already exists in `apps/mobile/src/state/autopilotCopy.ts`. `apps/mobile/test/components/NextBlockPanel.test.js:116,124` seeds free-text reasons the schema rejects (`packages/core-db/src/schema/061_autopilot_attribution_convergence.sql:90` allows only `eased`, `raised`, `held_safety`), and `apps/mobile/test/verify_store_sql.mjs:740-762` pins the same query. Fix: relabel the panel as what changed *in this block*, one line per movement, in `autopilotCopy` wording. This is needed under every option, since each shows its result there.

## 3. Rulings this touches

| Ruling | Text | Effect here |
|---|---|---|
| `docs/decisions/CALIBRATION_POLICY_V1.md:48` | "Retrospective signals are displayed in athlete/coach history and redacted aggregates." | Supports option A. (The "neutral trend indicators" sentence at `:25` is in the ACWR section; both advisers warned against stretching it.) |
| `CALIBRATION_POLICY_V1.md:49-50` | "Retrospective signals do NOT prospectively cap, expand, block, or auto-rewrite a session in Calibration v1." Future rules "require independent owner approval, versioning, minimum evidence definitions, and migration specifications." | Read narrowly, §3 names hard sets and session RPE, not per-set ΔE. Either way, a mid-block rewrite is new authority and needs the ruling in §7. **Option C would reopen this; nothing is reopened unless the owner grants it.** |
| `CALIBRATION_POLICY_V1.md:74-89` | Every autopilot coefficient frozen. | No option adds or changes a constant. |
| `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md:92-95, 118-122, 156-170` | No plateau detector or smoother; the autopilot prescribes from "execution and tolerance, not progression"; progression as a prescription input is "PLAN ONLY and deferred". | ΔE is a tolerance signal. Not reopened; nothing here detects plateaus or strength. |
| `docs/BRIEF_progression_control_safety.md:108-112, 156-160, 224-226` | RPE inflation can produce "a self-confirming ratchet"; suggested shape "reduction-only, subordinate to the existing guard layer". | Shapes C. Recommends; ratifies nothing. |
| `docs/SWEEP_completion_action_2026-07-31.md:121-124` | 2026-10-13: completion action authority "stays dormant until real completion history accumulates". | Different signal, same principle. |
| `DEVIATION_LOG.md:156-190, 192-194`; `tools/autopilot-sim/CHECKPOINT_C6B.md` | The +2.5 raise envelope; "must not claim stability". C6B found zero cycles in its tested family, at block cadence only. | A weekly checkpoint is an untested cadence. |

## 4–5. Options

### A. Effort-against-plan indicator (no new authority)

On the Plan tab, per pattern with enough data: dated, plain sentences from the *measured* mean of logged minus target RPE, never from φ. For example: "Squat, last 3 weeks: sets averaged about 1 RPE above target (6 of 9 sets rated). Rising within the week." Below five valid days: "Not enough rated sets yet." No forecast of the next block: both advisers judged a controller preview more than an indicator, and `deriveControlAction` alone cannot promise what the generator will do. Includes the panel fix.

- **Athlete sees:** a description with dates and coverage. No prompt, no session change.
- **Safety direction:** none; dose identical by construction.
- **Build:** small. One read-only getter, copy, panel fix.
- **Tests:** dose invariance (indicator present, absent or poisoned → byte-identical plan); no-write negative invariant in `verify_store_sql.mjs`; copy and coverage tests; panel test reseeded with real reason tokens and a check that it shows current-block changes once per movement.

### B. Athlete-applied ease

A plus a quiet "Ease my remaining squat sessions" control applying the reduction part to that pattern's unstarted sessions.

- **Athlete sees:** an optional button. Still a suggestion, which the owner said not to use for now; and he asked for the engine to adjust.
- **Safety direction:** down only, athlete-chosen. Still a new bulk rewrite needing its own authority.
- **Build:** medium (slot rewrite, attribution, undo).
- **Tests:** A's, plus frozen targets on logged sets, deload untouched, one ease per pattern per block.

### C. Automatic reduction-only realignment

At the start of non-deload weeks 2 and 3, run the frozen detector and controller; keep only reductions (−0.5 RPE, −1 set; load not applied); apply them to that pattern's unstarted, unlogged, non-locomotion slots in this block. At most one mid-block ease per pattern per block. Halt and guards supreme. Versioned attribution with its source (migration).

- **Athlete sees:** "Eased off: your recent squat sets felt harder than planned. Remaining squat targets this block: RPE 7 → 6.5." No prompt.
- **Safety direction:** down only. Worst failure: an unneeded ease to block end.
- **Build:** large. Checkpoint, idempotent transactional rewrite, migration, attribution composed with boundary rows (today one row per slot), copy.
- **Main failure mode (advisers' correction).** Lowering a target while effort stays the same makes ΔE *more* positive, so the next boundary eases again: a repeated-easing ratchet, worst under persistent high reporting (`BRIEF_progression_control_safety.md:108-112`). Rebound raises happen only if effort falls further than the target did. Withholding `rpeRaisePermitted` (`kinematicAutopilot.ts:380`) does not fix either: it is block-wide, covers RPE only, and leaves set raises open. Cumulative reduction across mid-block and boundary actions must be capped and ratified first.
- **Other risks:** selective rating, sparse early-block data, substitutions inside a pattern, segments straddling a deload, retries and session-start races.
- **Tests:** A's; frozen targets kept; deload, locomotion, halt untouched; thin data does nothing; idempotent retries; the `tools/autopilot-sim/` family re-run at weekly cadence against C6B's gates (cycles, saturation including downward, `mixed` drift, safety, counterexamples) plus cumulative reduction; `verify:autopilot-counterexamples` green. A replay on real logs cannot show how athletes respond to an applied ease.

## 6. Recommendation

**Build A now; keep B and C unbuilt; ask for a shadow-only ruling on C.** Sol and Astra both recommend A as observation only, without a next-block forecast, and both say C's live authority is not ready.

A answers "tell if the user is off track" with no prompt and no new authority; it does not yet "realign". C's ratchet and cumulative-reduction questions need answers and real beta shadow data first. Shadow logging is a write, so it needs its own versioned record, apart from A's no-write invariant.

## 7. The ruling needed

For A: none beyond a go-ahead, under `CALIBRATION_POLICY_V1.md:48`.

For C, proposed text (combining Sol and Astra):

> "I authorize a versioned shadow evaluation of reduction-only mid-block effort adjustment, and no live dose change. The candidate checks at the start of non-deload weeks 2 and 3, uses the frozen autopilot constants and five valid observation days, and would ease at most 0.5 target RPE and one set, once per pattern per block, on unstarted, unlogged, non-locomotion slots, under the existing guards, floors and frozen set targets. Shadow results are recorded, never applied or shown as changes. Before any activation I will separately rule on: the cap on cumulative reduction across mid-block and block-boundary actions; how repeated easing and rebound are handled; minimum evidence; idempotency; the attribution migration and rollback; and replay gates declared in advance and run on real beta logs. This is an exception to Calibration v1 §3 for shadow evaluation only. It grants no prompt, no raise, no goal or progression-measurement authority, and no claim of controller stability."
