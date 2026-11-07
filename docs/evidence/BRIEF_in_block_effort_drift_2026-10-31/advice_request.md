# Advice request: in-block effort drift ("hall effect")

You are an adviser. READ ONLY: do not edit, create, commit or push anything in the repo. Write your whole answer as your final message (under 600 words). Repo worktree: the -C directory you were started in (branch based on `claude/beta-question-box-2026-10-28`). Check any claim below against the files before relying on it; tell me if one is wrong.

## Owner's request (2026-10-31, verbatim)
"For now dont prompt the athlete , there needs to be a way for the app to tell if the user is off track their goals such as rpe goal or other stats if they are being met or not (allow for some error in variation but if the trend is climbing to fast in terms of intensity perception rating (we can call this the hall effect for analogy)  the engine keeps track on the athletes state vector and realigns its accommodating program to help the athlete adjust"

## Verified facts (mine)
- `packages/inference/src/kinematicAutopilot.ts`: `detectFlaws` per pattern, ΔE = logged RPE − frozen target; LAMBDA 0.88, DELTA 0.15, W_BASE 0.7, W_TREND 0.3 (trend = mean of last−first ΔE inside each 7-day segment, tanh), MIN_OBSERVATIONS 5 valid-ΔE days, THETA 0.3. `deriveControlAction`: |φ|<0.15 nothing; φ≥0.15 → dRpe −0.5, dSet −1; φ≥0.4 also dLoad 0.95; mirror raises; caution/restrictive guardrail/niggle ≥ triageMin clamp to ≤0; halt → neutral; +2 set cap; +0.5 RPE grant only in macro blocks 1–5 (`rpeRaisePermitted` false during suspension).
- Only caller with effect: `generateNewBlock` (`apps/mobile/src/state/useStore.ts` ~4407-4495), trailing 21 calendar days ending today. Next block only. `blockGenerator.ts` ~1357-1425 applies dRpe and dSet (not deload weeks, not locomotion); dLoad is never applied. `deriveDailyAdjustment` is only called by `apps/mobile/src/diagnostics/coachVerificationLab.ts` and the verifier.
- `sessionFeel.ts:33` SESSION_FEEL_RPE_DRIFT_THRESHOLD = 1: only decides whether the completion screen asks how the session went.
- `focusGoals.ts:542` goalProgress: athlete-entered observations only. `review_due` set at continuation when currentSequenceIndex ≥ plannedBlockCount (useStore ~4906).

## Rulings (binding)
- CALIBRATION_POLICY_V1.md:25 "Neutral trend indicators are permitted; they never command an automatic dose change." (ACWR section). :49 "Retrospective signals do NOT prospectively cap, expand, block, or auto-rewrite a session in Calibration v1." :50 future rules "require independent owner approval, versioning, minimum evidence definitions, and migration specifications." §5 rows 74-89: every autopilot coefficient frozen.
- PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md:92-95 no plateau detector / smoother / noise floor authorized; :156-170 progression measurement as prescription input = PLAN ONLY, deferred, no implementation.
- BRIEF_progression_control_safety.md:108-112 fatigue-correlated RPE bias → "self-confirming ratchet"; :156-160 reduction-only = worst failure an unnecessary deload; :224-226 suggested shape if ever executed: reduction-only, subordinate to guard layer.
- SWEEP_completion_action_2026-07-31.md:121-124 (2026-10-13) completion action authority dormant until real completion history accumulates.
- DEVIATION_LOG.md:156-190 authority envelope (+2.5 cap, unknown position fails closed); :192-194 "Controller stability is not demonstrated ... must not claim stability".

## Draft options (critique these)
A. Neutral indicator. Run frozen detectFlaws read-only on the same 21-day window at Plan-tab refresh; show per pattern a plain sentence ("Squat: recent sets have felt about 1 RPE harder than planned") and what the next block will do (a read-only deriveControlAction preview). No dose change, no prompt. New coefficients: none. Tests: dose invariance (indicator on/off/poisoned → identical plan, like ACWR invariance), no-write negative invariant, copy test.
B. Athlete-applied ease. Same indicator plus a quiet "Ease my remaining <pattern> sessions" control (no modal). Applies min(0, correction) to un-started slots of that pattern this block. Athlete action, not automatic.
C. Automatic reduction-only mid-block realignment. Weekly checkpoint at the start of non-deload weeks 2 and 3: frozen detectFlaws + deriveControlAction, keep only negative parts (dRpe −0.5, dSet −1; dLoad still not applied), apply to not-started, not-logged slots of that pattern in the current block; at most one mid-block ease per pattern per block; halt/guards still supreme; attribution row with a source column (migration). Concern I found: eased targets make later ΔE negative → next block boundary reads headroom → raises → possible new limit cycle. Mitigation idea: block after a mid-block ease gets `rpeRaisePermitted` false for that pattern (or exclude eased slots from the N term), plus re-run the C6B deterministic family with mid-block cadence and require zero new limit cycles.

Tentative recommendation: A now, plus record C's would-be decision in shadow (logged, not applied) during beta; owner rules on C's authority now, activation only after a replay on real beta logs.

## Side finding to sanity-check
`getPendingAutopilotAdjustments` (useStore ~5994-6028) selects planned_slot_autopilot rows `WHERE tb.status = 'active'`, i.e. the CURRENT block's already-applied deltas, but BlockScreen ~945-965 heads them "What changes next block ... These adjustments apply when the next one is built" and renders `{adj.movementName}: {adj.reason}` raw (e.g. "held_safety"), one row per planned slot. `apps/mobile/test/components/NextBlockPanel.test.js` seeds free-text reasons the schema CHECK would reject. Confirm or refute.

## Questions
1. Is any fact or ruling citation wrong?
2. Which option would you recommend for a closed beta, and why (one paragraph)?
3. For C: is the limit-cycle concern real, and is the mitigation adequate? Any other failure mode (ratchet, sparse logging, substitution, deload straddle, first block thin data)?
4. Does A breach any ruling? Is a read-only next-block preview a "neutral indicator" or something more?
5. The exact ruling text you would put to the owner for C.
