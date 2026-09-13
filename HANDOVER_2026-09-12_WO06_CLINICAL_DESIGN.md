# WO-06 clinical design checkpoint handover

Date: 2026-09-12, Australia/Sydney. Branch: `codex/ac-wo06-clinical-design`. Frozen base: `2af3adc398bd959a3fef8bfaa8f5003785867470`.

Delivered design only: [WO06_CLINICAL_CONTRACT_REVIEW.md](docs/audits/accessible-coach/WO06_CLINICAL_CONTRACT_REVIEW.md). No app behavior, schema, migrations, tests, packages, decision dockets or ledger changed. No push, merge, release or network activity.

## Verified source facts

The current prescription boundary includes daily derivation; program preview/generation/continuation; routine preview/defaults/save/freeze; substitutions; progression and load advisories; APRE next-week writes; free-form/start/repeat/resume; rest-to-work transitions and direct `logSet`. The review supplies exact source/line ranges and later guard placement for each. Existing profile notes are region/text only and have no inference consumers under the reproduced search. Athlete state uses separate database files, not saved profile slots as person identity. The backup envelope currently declares plaintext.

P1 copy finding: onboarding implies stored injury/mobility notes are respected by coaching, although those arrays are not consumed by inference. Recommend a separately owned immediate copy correction. Existing substitution guards do operate; their wording can be narrowed but is not proof of absent guards or a clinician-verification claim. Neutral outcome labels already have a recorded project ruling and are not reclassified here as an engine defect.

## Proposed owner rulings, not approvals

Recommend optional display-only functional preferences/notes and user-reported clinician transcriptions; mechanical explicit hold/review state with all call-site guards before claiming recommendations are held; no automatic prose interpretation or disability-only exclusion. Provide exact first-slice 064 entities/fields and applicability referencing WO-05's definition/series/occurrence IDs. Integration owns the sole `accessibleCoachContract.ts`, sole Migration 064 and shared store/UI files. WO-06 creates no parallel activity contract. Database-bound athlete ownership is recommended over a `profile_slot` FK.

SC-04/05/06 and D07/08/09/10 have concrete recommended dispositions. Francis still needs to ratify schema, hold/continuation/deletion/privacy/backup choices. No decision was silently accepted. The architecture skill structured the options, consequences and ownership; it did not supply clinical authority.

## Clinical-review blockers

Exact screening questions/transitions; executable metric/operator/unit/validation ranges; medical applicability and conflict composition; clearance/supersession/expiry interpretation; symptom worsening and return rules; live-monitoring freshness, boundaries and actions; legacy experience-based symptom assumptions. No default POTS dose, HR value, weekly escalation, fluid or salt advice is supplied. Candidate clinical extension fields are expressly excluded from the recommended first 064.

## Verification

- Baseline `npm run typecheck`: PASS (exit 0).
- Final `npm run typecheck`: PASS (exit 0).
- Citation path/range and proposed-path ownership validation: PASS, 72 source ranges, 31 ownership/source paths including 11 explicitly proposed new paths; zero failures after correcting one out-of-range endpoint.
- `git diff --cached --check`: PASS (exit 0); staged diff is exactly two new files, 279 insertions. Normal staging initially hit the shared Git metadata permission boundary; narrowly scoped escalation succeeded.
- New clinical acceptance fixtures: documented only, NOT EXECUTED.
- Product/native/SQL/backup/clinical/wearable/release tests: NOT RUN; no implementation is included.

## Francis/integration checklist

1. Disposition the P1 onboarding copy and the proposed F schema/product decisions.
2. Assign one Migration 064/contract owner and accept the same IDs in WO-05/06.
3. Decide hold withdrawal/deletion-marker/privacy/protected-backup behavior explicitly.
4. Obtain qualified clinical and WO-07 capability review before any executable clinical extension.
5. Implement and verify a newly bounded checkpoint; retain completed history and non-prescriptive access when advice is held.

Only two new files belong to this commit. The full review distinguishes source observations, proposals, clinical blockers and unexecuted acceptance oracles. Work stops after one bounded round.

## MASTER LEDGER ENTRY (handover only; PROMPT_LEDGER unchanged)

Input: clean isolated frozen base `2af3adc`, WO-06 owner/clinical design request. Constraints: offline deterministic architecture, no medical ratification inferred, exactly two documentation files, one proposed shared 064 owner. Actions: source audit, storage/API/fixture and ownership proposal, copy review, local validation and commit. Runtime/RAM/latency deltas: none; not measured because no product changed. Clinical capability delta: none; design remains non-authorizing.
