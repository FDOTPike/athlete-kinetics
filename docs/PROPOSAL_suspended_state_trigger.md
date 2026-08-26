# Proposal — how an athlete enters and exits the suspended state

**Date:** 2026-08-27
**Status:** proposal only. **No migration, column, or code is authorized by this document.**
Written before RR-02 / Migration 058 so the column is not built against a ghost trigger.

---

## 1. The problem this has to solve first

`TRAINING_PROGRESSION_LAYERS.md` §4.1 ratified that **rehab is a suspending state, not an L3 phase**:
an athlete who was in `volume` before an injury should return to `volume`, not have that position
consumed while injured.

Nothing implements it. `nextMacroPosition` (`useStore.ts:1802`) is four lines that read the last
`block_meta` row and advance modulo `MACRO_BLOCKS`. There is no state to consult.

**But adding `is_suspended` does not make the feature work.** A column no code writes is inert. The
prior question is: *what event sets it, and what event clears it?* Today there is no candidate:

| Candidate signal | Why it cannot serve as the trigger |
|---|---|
| `objective = 'rehab'` | An athlete-chosen **goal**, not an injury event. It has no start or end, does not know what objective preceded it, and is equally the setting for someone who simply trains rehabilitatively. |
| `niggle` rows | `011_niggle_tracking` is a **rolling daily complaint channel** — queried on recency (`reported_at_ms >= ?`), with **no resolved flag and no lifecycle**. A niggle never "ends"; it just stops being recent. Inferring suspension from it means suspension silently expires by timeout. |
| Autopilot `globalGuardrail.halt` | Real and durable, but it is a **block-level dose event**, not an injury record. A halt already snaps the block to recovery. Treating it as suspension would suspend athletes for fatigue, not injury. |

So the trigger has to be **new and explicit**. That is the actual content of RR-02, and it is larger
than the column.

---

## 2. Proposal: an explicit, athlete-owned suspension episode

### 2.1 Shape

Not a boolean on `training_program`, but an **episode row** — the same reasoning that made niggles
inadequate applies to a bare flag:

```
suspension_episode
  episode_id         INTEGER PRIMARY KEY
  started_at_ms      INTEGER NOT NULL
  ended_at_ms        INTEGER            -- NULL = currently suspended
  reason             TEXT NOT NULL      -- CHECK domain, see 2.3
  resumed_macro_index INTEGER           -- the position frozen at entry
```

`is_suspended` is then **derived** (`EXISTS (SELECT 1 … WHERE ended_at_ms IS NULL)`), not stored.
A stored boolean and a stored history will drift; a derived boolean cannot.

**Why an episode rather than a column:** the ratified requirement is that the athlete *returns to
where they were*. That needs the frozen position recorded at entry, and a bare boolean has nowhere
to put it. It also gives an audit trail — how often, how long, and what for — which a flag destroys
on every toggle.

### 2.2 Entry — athlete-initiated only

**The athlete declares it.** One explicit action, one confirmation, in their own words. No inference
from niggles, RPE, missed sessions, or halts.

The reason this is not a limitation: **an automatic injury detector is a diagnostic claim**, and this
project has no ratified authority to make one. The evidence baseline records that no such detector
is supported by anything the audit located. An explicit declaration needs no evidence — the athlete
is the authority on whether they are injured.

**What the app may do** is *prompt*: after a recorded halt, or after N sessions with a niggle above
`triageMin`, surface "are you injured? do you want to pause your programme?" — a suggestion the
athlete accepts or dismisses. That is the same posture §8 already ratified for halts ("an autopilot
halt prompts rather than auto-suspends"), applied consistently.

### 2.3 Reason vocabulary

A closed CHECK domain, because free text cannot be reasoned about and will not stay clean:

- `injury` — the case §4.1 was written for.
- `illness` — same suspension semantics, different cause.
- `life` — travel, work, bereavement. Suspension is not a medical concept; an athlete who cannot
  train for three weeks should not burn three macro positions either.

`life` is proposed deliberately. Restricting suspension to injury would leave the most common reason
for a training gap consuming the athlete's progression track — the exact bug RR-02 exists to fix.

### 2.4 Exit — athlete-initiated, with a floor and no ceiling

**The athlete ends it.** `ended_at_ms` is set, and the macro position resumes from
`resumed_macro_index`.

Three properties worth ratifying explicitly:

- **No auto-expiry.** A suspension that times out re-introduces exactly the silent-expiry problem
  that disqualified niggles. If the athlete never resumes, they stay suspended — which is correct,
  because they are not training.
- **No maximum duration.** Detraining is real, but the app has **no ratified return-to-training dose
  modifier** (Calibration Policy v1 says so explicitly), so it has nothing correct to do with a long
  gap. Inventing a decay curve here would be a new coefficient with no source.
- **A minimum of one session.** Resuming immediately re-enters at the frozen position. That is the
  intent, and needs no special handling.

### 2.5 What suspension changes while active

Deliberately narrow. It **freezes macro position** and nothing else:

- `nextMacroPosition` returns the frozen index instead of advancing.
- Existing rehab behaviour is untouched — RPE ≤ 7.0 and rehab splits already work off
  `objective = 'rehab'`, which the athlete sets separately. Suspension does not force an objective,
  and objective does not force suspension.

**Keeping these two orthogonal is the whole point.** Coupling them would mean an athlete who chooses
rehab as a goal can never advance a macro position, which is a different and worse bug.

---

## 3. Open questions the work order must answer

1. **Does an in-flight block survive suspension?** Suspending mid-block leaves a partially completed
   plan. Options: archive it, keep it and resume mid-block, or regenerate on resume. This proposal
   does not choose.
2. **What does `nextMacroPosition` return if suspension began before any block existed?** Edge case,
   needs a defined answer rather than a fallback.
3. **Does suspension interact with a dated competition horizon?** A suspension that crosses the
   competition date leaves the countdown incoherent. Probably out of scope until the taper
   architecture exists (see the RR-03 parking record), but it should be named, not discovered.
4. **Is `resumed_macro_index` frozen at entry or recomputed at exit?** This proposal freezes at entry
   — it is the only reading that honours "return to where they were" — but it is a ruling.

---

## 4. What this proposal deliberately does not contain

- **No numeric value.** No maximum duration, no decay, no session threshold for the optional prompt,
  no detraining modifier. Every one of those would be a new engine coefficient requiring ratification
  against a source, and none is needed for the mechanism to work.
- **No automatic injury detection**, and no inference from niggle severity, RPE, or missed sessions.
- **No migration number.** For the record, the chain head is `057_block_meta_phase_invariant.sql`, so
  the next free slot is **058** — the review's "059" is off by one, and
  `TRAINING_PROGRESSION_LAYERS.md` §8 item 1 still says "057", which is stale and should be corrected
  in the same work order.
- **No schema change.** The table sketch in §2.1 is illustrative and is not authorized.
