# Proposal — Kinematic Autopilot counterexample response

Date: 2026-07-30
Status: **R1/R1a/R2/C6B RATIFIED — `2.5` AUTHORITY POLICY SELECTED.**

## Decision basis

C3 supplies both failure modes named by the work order:

- six fixed-template limit-cycle counterexamples survive removal of macro-phase
  forcing;
- 1,711/2,385 primary cases saturate, including the nominal stable gain-3
  athlete raising at every boundary.

Those are the original decision-boundary aggregates. The C6B audit follow-up
restates the corrected applied-block view as 7 primary limit cycles and
1,687/2,385 saturated cases (1,445 upward, 242 downward). The explicit
counterexamples and the decision basis are unchanged.

A healthy adapting-archetype athlete requests an RPE raise at all eight observed
boundaries; seven requests enter the remaining simulated blocks and reach
`base_rpe_cap`. Positive set additions are rationed; positive RPE changes are
not.

The current controller therefore has no demonstrated stability bound over the
ratified plant family.

## Options

### 1. Widen the relay deadband

Increasing `CONTROL_AUTHORITY.DEADBAND` suppresses small alternating signals.
It does not address nominal `phi` near `-0.298` unless the new threshold is large
enough to disable much of the controller. A deadband-only change also leaves
same-direction trend artefacts conceptually intact.

Evidence required: re-derive both entry directions, repeat the full C3 family,
and show that the larger neutral region does not mask real deficits.

### 2. Add relay hysteresis

Separate enter, persist, and direction-reversal thresholds prevent a single
boundary crossing from flipping the relay. Direction memory directly targets
the six stationary alternating cases.

Hysteresis alone does not stop an upward ratchet that never reverses. It needs a
separate release or cumulative-authority bound.

Evidence required: state-machine transition table, halt/caution supremacy,
bounded-memory proof, and the same stationary counterexamples as regression
cases.

### 3. Rate-limit direction and cumulative RPE authority

A minimum hold period or reversal cooldown suppresses chatter. A cumulative
per-macro-cycle RPE budget gives the upward channel an analogue of
`MAX_ADDED_SETS`.

This option limits consequence but does not correct a phase-biased observer.

Evidence required: worst-case cumulative RPE movement, cap-release behavior,
and proof that real recovery still receives timely cuts.

### 4. Make the trend phase-aware

The observer currently compares corrected loading weeks against an uncorrected
deload slice. A phase-aware trend reference, or a trend calculation that
compares equivalent prescription phases, removes that structural mismatch.

This is a controller-model change rather than a constant tweak. It directly
addresses the dominant upward saturation mechanism and the C2 audit's alignment
finding.

Evidence required: an explicit phase-normalized formula, real-template
substitutions for normal and shifted deloads, low-frequency handling, and a
fresh full-family sweep.

### 5. Accept with a documented bound

Acceptance requires a defensible exposure bound and explicit product behavior.
The present evidence does not supply one: the nominal case raises every block,
the only healthy upward stop is `base_rpe_cap`, and stationary cycles exist at
zero noise.

On current evidence this option is **not recommended**.

## Recommended direction

Apply remediation sequentially:

1. first add a cumulative RPE authority budget symmetric in purpose with
   `MAX_ADDED_SETS` (option 3), establishing a cheap immediate exposure bound;
2. then make the trend reference phase-aware (option 4), addressing the
   observer mismatch as the underlying cure.

These are separate changes with separate checkpoints and evidence. Hysteresis
is not in the ratified sequence and must not be bundled into either change.

The proposal keeps halt and monotone-conservative overrides supreme. C3 confirms
the knee-niggle override blocks all eight otherwise-requested raises, so that
safety property remains an explicit invariant.

## C4 consequence

No green “absence of oscillation” gate follows from C3. The next accepted gate
either:

- preserves the counterexamples as expected-failure evidence while remediation
  is pending; or
- asserts a ratified remediation and demonstrates that the six stationary
  cycles, nominal upward saturation, deload alignments, low-frequency thin-data
  case, and safety override all resolve as specified.

Francis sets that pass condition at C3 ratification.

## C5 status

R1 implements option 3 as a +1.0 macro-cycle RPE authority envelope. Its
derivation and post-change sweep are in
`tools/autopilot-sim/REMEDIATION_R1_C5.md`. This is a consequence bound, not
acceptance of the observer. C5 subsequently ratified R1a and authorized R2.

## C6 status

C5 and R1a were ratified on 2026-07-30. R2 implements option 4 with the
phase-local trend described in `tools/autopilot-sim/R2_PHASE_ANALYSIS_C6.md`.
The implementation, recomputed pins, and full-family evidence are assembled in
`tools/autopilot-sim/CHECKPOINT_C6.md`. R2 and the final C6B `2.5` authority
policy are ratified.
