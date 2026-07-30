# Amendment R1a — required before C5 ratification

**Assignee:** Sol. **Effort: high** (small, well-specified change).
Ratification decisions from Francis, 2026-07-30, on
`AUDIT_C5_R1_2026-07-30.md`.

**C5 is held pending R1a.** R2 stays blocked.

---

## 1. Ratified

**The product behaviour is confirmed as intended.** A `+1.0` cumulative raise
budget per macro-cycle, with no upward autopilot correction after macro block 2,
is accepted. Rationale to record in the source: the autopilot is a **corrective
overlay**, not the progression mechanism. Planned progression comes from
`progressionEngine` and the `SCHEMES`/`PHASE_MODS` tables; R1 disables only the
autopilot's upward *addition* to that plan. Athletes still progress on plan.

## 2. R1a — close the fail-open default

`deriveControlAction`'s `macroBlockIndex` currently defaults to `1`, and its
non-finite fallback also resolves to `1`. Since `1 <= macroGrantSlots`, both
paths **grant a raise**. Unknown state opens upward authority.

This contradicts the module's own rule at `kinematicAutopilot.ts:371`, where
thin or non-finite φ emits neutral precisely so it can *"never fall through the
φ-ladder into the authority-RAISING terminal branch."*

Required:

1. Absent or non-finite `macroBlockIndex` resolves to **no allowance** — e.g.
   fall back to `macroGrantSlots + 1`, or make the parameter required. Your
   call which; required is cleaner if no caller is inconvenienced.
2. New pin in `verify_autopilot.mjs`: **non-finite `macroBlockIndex` grants zero
   RPE.** Cover `undefined`, `NaN`, and the omitted-argument case.
3. Confirm `blockGenerator.ts:362` remains the only shipped caller.

Motivation is not hypothetical: `macroBlockIndex` comes from persisted DB state,
and a NaN read would currently release a grant every block.

## 3. Constant rationale — record it

Neither `MAX_MACROCYCLE_RPE_RAISE: 1.0` nor the `0.5,0.5,0,0,0,0,0,0` schedule
carries a stated rationale in `CONTROL_AUTHORITY`. Add one, in the style of the
surrounding entries, stating both the corrective-overlay reasoning from §1 and
the fact that the value is currently **compensating for a known observer bias**.

## 4. Standing R2 obligation — record now, act later

`MAX_MACROCYCLE_RPE_RAISE` and its block schedule are calibrated against a
**broken observer**. The deload straddle makes the observer systematically
over-report headroom; R1 counteracts that by suppressing raises.

Once R2 corrects the observer, this budget will be limiting *correct* headroom
signals, leaving the controller permanently over-conservative for a reason that
no longer exists.

Record in `DEVIATION_LOG.md` as an explicit R2 obligation: **revisit
`MAX_MACROCYCLE_RPE_RAISE` and the grant schedule after the observer fix, and
re-run the full family to confirm upward saturation does not return at whatever
value replaces it.** This must not be discovered later — it is the predictable
way R1 becomes permanent by accident.

## 5. Then

Re-run `verify:all` and the full 2,385-case family; confirm the transition table
is unchanged apart from the new pin. Hand back for C5 ratification.

R2 begins only after C5, and must first settle whether the deload/window
straddle is universal across macro phases or template-specific
(`AUDIT_C3_2026-07-30.md` §5, `SWEEP_C3.md` §8) — that answer determines the
design.

## 6. Unchanged from prior orders

Evidence standard from `WORKORDER_Sol_autopilot_stability.md` §7. No migrations.
No new runtime dependency. Shell writes per `AGENT_WORKFLOW.md` §2.

Still open, still separate, and now more pressing given C3 and R1:
`BlockPlan.autopilotAdjusted` has no UI consumer, so an athlete's target RPE and
set counts change — and, after R1, conspicuously stop changing upward — with no
attribution anywhere in the interface.
