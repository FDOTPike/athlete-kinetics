# Owner Decisions and Limitations — Program Quality and Intake Remediation

Frozen candidate `cfbcf67e6b810bfb2e7793cf92980bff3f04d3d6` · 2026-09-01

## Owner-ratified decisions applied (all from the work order, none invented)

1. Seven-screen first-run flow with five decision screens; effort ceiling, max sessions/day, energy focus, and load preference become disclosed, later-editable defaults instead of mandatory screens (WO §2.1). Non-beginner auto/manual load choice remains available during onboarding on the review screen's fine-tuning area; beginners stay auto (WO_FOUR_MODE_LOAD preserved, atomic commit preserved).
2. Migration 060 realigns exactly Competition Squat, Competition Bench, Deadlift from Advanced to Intermediate (WO §2.3), with an append-only provenance table. Reclassification is explicitly NOT capability evidence; equipment, safety, capability, prior-experience, and attestation gates are untouched.
3. Loaded-default law for non-rehab intermediate+ (WO §2.4): a strictly bodyweight movement is never the default while a compatible loaded candidate survives the gates; bodyweight fallbacks carry the exact gate reasons. Beginner and rehab keep the previous selection behavior byte-stable — the WO scopes the new law to non-rehab intermediate+, and no unreviewed beginner/rehab change was introduced.
4. Strength anchor contract (WO §2.5): anchors are the authored big-three names; they are selected when gated-available; blocked anchors are disclosed with the exact gate and the loaded substitute (e.g. "Competition Squat unavailable for squat (capability); Box Squat planned instead"). Capacity shortfalls (<3 sessions/week) are disclosed before creation.
5. Bodybuilding contract (WO §2.6): hypertrophy carries no anchor obligation AND no competition-lift default (legacy id-order would have handed it the big three); the competition lifts remain preference-selectable.
6. Bodyweight rep monotonicity (WO §6.5): working-week reps on a no-load-channel slot never fall while target RPE rises; the deload cut stays a sets/volume cut. Loaded slots keep the WAVE rep shrink because their load channel is real.
7. Effort cues exactly per the WO §2.7 band table; pain is not effort; breathing/talk cues are explicitly secondary and variable; no biometric inference anywhere.
8. Historical rule conflicts: the pre-060 "competition lifts stay Advanced" pins and the ContentCorrection049 "standard grid always visible" pin were superseded by the owner's explicit new rulings, per the handover's governing-requirements instruction. Each re-base is disclosed in EXECUTOR_HANDOFF.md.

## Judgment calls the owner may wish to review

- **Goblet Squat capability path (PQ-03):** Goblet Squat sits below Front Squat on the squat capability chain, so a fresh intermediate is capability-blocked from it too; the loaded default under dumbbell/kettlebell is Double Kettlebell Front Squat (id 48) or Dumbbell Squat (55) depending on inventory, and Goblet becomes the default once its prior-experience confirmation is given. "Goblet Squat is the minimum default loaded squat" is therefore implemented as "the minimum loaded rung the gates admit", which is the reading consistent with §2.3's own gate language. If the owner intended Goblet to bypass the chain, that is a one-line policy change in movementRanking.
- **Sport/conditioning context:** the ranking policy applies the same access context as the generator (tier ceiling removed on BJJ/conditioning days, everything else gated). The autopilot's non-vacuous sport-relief probe enforces this.
- **Onboarding "coach defaults" disclosure** names effort ceiling, sessions/day, and energy focus on the review screen; progression methodology remains a pure store default (never had a screen in the old flow either) and stays editable in Profile.

## Limitations of this candidate

- Development-candidate only: no C6 physical-device memory certification, no release/signing work, no APK. `verify:release` intentionally not run.
- PQ-04 is proven via the setup screen's exact disclosure rule mirrored in the harness, not by driving UI; PQ-11's niggle→exclusion mapping is approximated at pattern level in the harness (the store path remains the authority).
- The matrix harness and its outputs are executor evidence — untrusted input for the audit until independently reproduced (the harness is committed precisely so reproduction is one command).
- The hybrid energy focus and suspension/deload/release-baseline behaviors were in scope only as preservation targets; they were not redesigned.
