# Work order - completion-versus-prescription observer

Date: 2026-07-31
Status: **DRAFT FOR FRANCIS/OPUS RATIFICATION. NO CODE AUTHORITY.**
Assignee: Sol (Codex)
Depends on: `1ec16e0` (explicit actual-RPE evidence)

---

## 1. Authority and problem

Amendment 1 to `PROPOSAL_experience_tiered_load_selection.md` ratifies
completion versus prescription as the beginner control signal and requires a
separate observer work order.

The device audit attached to `1ec16e0` found:

- 1,175 logged sets;
- only four sets eligible for the current RPE observer;
- all four were exact pre-seeded target values and therefore possibly
  fabricated;
- the other 1,171 sets had no frozen RPE target.

The RPE observer has therefore never had genuine evidence on this device.
Beginners also cannot yet be assumed to report RPE accurately. Their observer
must use the objective fact already captured by the runner: work completed
against work prescribed.

## 2. Existing durable evidence

No schema migration is proposed.

- `session_plan_slot` freezes movement, planned set count, and provenance at
  session start.
- `session_slot_target` freezes the reps-or-time target for the session slot.
- `set_record` stores actual reps.
- `set_target` maps a logged set to its frozen session-plan slot.
- `set_dose_target` freezes the dose displayed when each set was logged.
- `session_outcome` proves that a session was finalized and freezes its
  training age, origin, terminal state, and aggregate missing/adapted evidence.

Migration 026 deliberately performs no historical backfill. Missing side-cars
remain missing evidence; they must never be converted to successful completion
or failure.

## 3. Proposed observation contract

This section is proposed for ratification.

### 3.1 Scope

The first observer is:

- beginner only;
- planned sessions only;
- finalized sessions only;
- repetition targets only;
- grouped by local calendar date and movement pattern;
- read from immutable session-start/log-time evidence.

Free-form and added work are not prescription evidence. Time targets remain
out of scope until separately ratified; seconds and reps must not be mixed into
one unexplained score.

### 3.2 Per-set shortfall

For a logged repetition set with an honest frozen target:

```text
shortfall = clamp((target_reps - actual_reps) / target_reps, 0, 1)
```

Meaning:

- all prescribed reps completed: `0`;
- fewer reps completed: a proportional value in `(0, 1]`;
- more reps completed: `0`, not headroom;
- missing target or slot mapping: `null`, not zero.

An unskipped missing planned set contributes `1`. A deliberately skipped set
does not contribute completion evidence. This prevents a safety or coaching
decision from being relabelled as physical incapacity.

The daily pattern observation is the mean shortfall across eligible prescribed
sets. A day with no eligible evidence is `null` and does not count toward a
confidence threshold.

### 3.3 One-sided action authority

Completion can demonstrate that prescribed work was not completed. Completion
alone cannot demonstrate latent headroom: a beginner who completes the plan may
have selected an easier load, stopped exactly at the target, or worked near
failure.

Therefore the action derived from this evidence may produce only:

- `capacity_deficit`; or
- `neutral`.

It must never produce `latent_headroom` and must never grant an upward
adjustment. Later RPE education and agreement can earn that authority under the
separate teaching-ladder work.

## 4. Integration boundary

Do not encode completion shortfall as synthetic `deltaRPE`, map it to `phi`, or
feed it through `detectFlaws`. The units and measurement meaning differ, and a
second `phi` input would invalidate the C2 derivation and C3 sweep.

Keep the current path byte-for-byte:

```text
explicit RPE -> detectFlaws -> deriveControlAction -> rpeAction
```

Add a separate pure path:

```text
completion evidence -> deriveCompletionAction -> completionAction
```

Compose only at the action boundary:

```text
finalAction = min(rpeAction, completionAction)
```

The minimum is taken independently for each pattern and correction field:
load modifier, set delta, RPE delta, and preference bias. Recompute
`blockAddedSets` and `blockAddedRpe` from the composed corrections. Because the
completion action is never positive, composition can only preserve or reduce
RPE-derived authority.

At block generation:

- beginner composes the RPE action with the completion action;
- intermediate, advanced, and elite retain the current RPE action only;
- absent/thin completion evidence produces a neutral completion action;
- halt/recovery supremacy remains outside and above both actions.

The current RPE observer, `phi`, its constants, R2 trend rule, analytic pins,
macro grant budget, deload policy, and safety overrides are not to be modified
or recalibrated by this work.

## 5. Numeric authority gate

The exact mapping from mean shortfall to a neutral-or-reductive completion
action, its confidence threshold, and its deficit threshold are not ratified
here. Completion does not produce `phi`. Reusing the RPE observer's `E_MAX`,
deadband, or `MIN_OBSERVATIONS` would claim calibration that does not exist.

Implementation must therefore begin with a finite sweep, not a chosen constant:

1. Enumerate the exact shortfall values generated by realistic planned sets.
2. Sweep repeated exact, partial, missing, mixed, and improving histories over
   the fixed 21-day calendar.
3. Include sparse-frequency patterns and deload-week boundaries.
4. Show candidate confidence/deficit thresholds side by side.
5. Present false-cut and missed-cut counterexamples.
6. Prove every candidate action is neutral or reductive.
7. Stop for Francis/Opus ratification before any candidate gains production
   control authority.

This work order authorizes the measurement and sweep design after ratification;
it does not pre-authorize a winning numeric policy.

## 6. Eligibility decisions for ratification

Recommended:

- include normal planned sessions;
- include substituted/day-swapped slots under the movement pattern actually
  performed, because their dose was freshly frozen;
- exclude all halted sessions from completion control evidence; niggle and
  safety already have direct channels;
- include completed adapted sessions only when `skipped_slot_count = 0` and
  their sets are honestly mapped;
- `session_outcome` stores only the total skipped-slot count, not the skipped
  slot identities. The first version therefore excludes an entire session
  containing any skipped slot; attributing those skips per pattern would need
  new durable evidence;
- when `skipped_slot_count = 0`, treat missing work in a completed session as
  full shortfall attributed through its frozen session-plan slot;
- cap over-completion at neutral.

## 7. Required gates

### Pure projection

- exact completion -> zero shortfall;
- under-completion -> exact proportional shortfall;
- over-completion -> zero, never negative;
- unskipped missing set -> one;
- skipped set -> absent;
- missing dose target -> absent;
- missing set-to-slot mapping -> absent;
- free-form/added work -> absent;
- time target -> absent in this version;
- adapted slot is attributed to the movement actually performed;
- daily pattern aggregate is order-independent.

### Completion-action invariants

- increasing actual reps cannot increase deficit;
- adding missing unskipped work cannot reduce deficit;
- no completion history can produce latent headroom;
- absent evidence does not count toward confidence;
- all outputs are finite, bounded, and correction-literal valid;
- one pattern cannot affect another;
- safety/niggle precedence remains unchanged.
- conservative action composition is commutative, associative, and idempotent;
- composition never makes any correction less conservative than either input;
- existing `detectFlaws` and `deriveControlAction` pins remain byte-for-byte.

### Store and end-to-end

- one bounded grouped read over the 21-day window; no per-day/per-pattern query
  cascade;
- exact production-SQL fixture with frozen targets and final outcomes;
- no duplicate set counting across joins;
- no historical backfill;
- beginner block generation composes the completion action at the action
  boundary;
- all other tiers retain the existing RPE action without completion
  composition;
- current autopilot, store, outcome, block, migration, and full verification
  gates remain green.

## 8. Device baseline before control authority

Read-only audit:

- finalized beginner planned sessions;
- repetition sets with both frozen target and slot mapping;
- exact, under, over, missing-unskipped, skipped, and ineligible counts;
- counts by movement pattern and calendar day.

Report zero honestly if migration-026 evidence has not yet accumulated. Do not
use the 1,171 pre-provenance demo sets as calibration data.

### 2026-07-31 connected-device result

- `session_outcome` rows: **0**;
- finalized beginner planned sessions: **0**;
- finalized beginner planned complete/no-skip sessions: **0**;
- `set_dose_target` rows: **4**;
- `session_plan_slot` rows: **4**;
- `session_slot_target` rows: **4**.

The four new sets have frozen dose evidence but no finalized session outcome.
There is therefore **zero eligible real completion history** for threshold
calibration. Production numeric authority remains blocked as designed.


## 9. Out of scope

- four-mode load selection;
- starting-load tables;
- RPE teaching UI and graduation threshold;
- 1RM/start-screen redesign;
- time-based completion authority;
- historical rewriting or inferred backfill;
- changes to non-beginner observer policy;
- changes to the RPE observer, `phi`, or its analytic derivation.

## 10. Stop points

1. Francis/Opus ratify this work order's signal and eligibility rules.
2. Sol performs the baseline audit and finite sweep.
3. Francis/Opus ratify numeric action authority.
4. Only then may Sol compose the completion action into production block
   generation.
