# WO-06 implementation evidence

This is software-routing and persistence evidence, not clinical validation or a release approval.

## Starting identity and authority

- Worktree: `C:/Users/fpike/.codex/worktrees/3057/Athlete App`.
- Base and live `origin/codex/rpe-familiarisation`: `b94053b4d63fb0ffd3b933aa1890d80f7313a87b`.
- Base tree: `99759f7be3af360a17037f3b18dd0f817cfd6704`; divergence `0 / 0`; clean working tree.
- Codex initially supplied a detached worktree with no upstream. After the required first-write prompt append, Codex created `codex/ac-wo06-training-support` at that exact commit. No other checkout was changed.
- There is no repository AGENTS.md. The ancestor `C:/Users/fpike/.codex/AGENTS.md` was empty. Read AGENT_WORKFLOW.md, the accessible-coach work orders, the ratified Astra owner rulings, the full WO-06 contract review, Migration 064 and the merged activity adapter.
- No worktree/common Git lock was found. An elevated read-only process-command-line check found no process targeting this worktree other than the check itself. This is a bounded observation, not proof about all possible file handles.
- The first repository write appended the supplied execution prompt to PROMPT_LEDGER.md. The previous ledger prefix was subsequently checked unchanged.

## Contract and behavior

Migration 064 is unchanged. Its normalized LF SHA-256 is `b141b149717fb2f26f585a67239fea05ab03220ab040d5d86500cf8c38022a8a`. No migration slot was allocated and no schema upgrade is required beyond the installed, merged 064 contract.

The adapter verifies both athlete identity and the exact active database handle on reads and writes. Savepoints compose with the owning transaction. Mutations check the expected support revision; instruction confirmation checks the exact current transcription revision. Editing creates a draft and a new review hold without withdrawing earlier instruction holds. Deletion uses 064's existing trigger and removes sensitive scope text while retaining content-free hold identities. Withdrawal is exposed only for the athlete's own requested pause.

Preferences and typed notes remain non-executable. Transcriptions always carry user-reported/not-verified provenance. The UI uses the required disclosure exactly: “Clinician instruction, entered by you — not independently verified.” Detail is collapsed on mount and athlete changes; hiding/deleting clears editor caches. No note, issuer, preference or transcription prose is read by the decision path or copied into recommendation evidence.

The decision path reads scopes one hold at a time instead of hydrating every historical revision's scopes. A missing contract, orphan current instruction, unresolved scope or unscoped active hold fails closed. Withdrawn holds and explicit disjoint identities pass to the existing guards. A known activity-definition scope follows a target's supplied activity identity; an unknown parent cannot establish disjointness. ID ordering is independent of device locale.

## Current source map

Line references below were derived from the implemented files, not copied from the dated design review. Store paths are in `apps/mobile/src/state/useStore.ts`.

| Entry point | Current source anchor | Enforcement |
|---|---|---|
| Shared binding and decision boundary | store:997, store:2304 | Read current persisted support; transactional attempts retain content-free decision/hold revision evidence. |
| Daily publication | store:6380 | Withhold the operative prescription even with favorable readiness; legacy subjective hard stops still persist independently. |
| Program preview/create | store:3349, store:3435 | Check generated movement identities before returning the preview. Creation uses this preview and guarded block generation. |
| Block generation/commit | store:3479, store:3625 | Check before SQL and again inside the commit transaction. |
| Preferences/continuation | store:3904, store:3959, store:3973 | Preferences and next-block preview use the guarded preview; continuation commits through guarded generation. |
| Routine defaults/ranking | `apps/mobile/src/components/RoutineTemplateBuilder.tsx:96` | Parent boundary removes the composing child and cached defaults while held. |
| Routine save/freeze | store:4137, store:4300 | Independently recheck selected movement identities. |
| Free-form/add-slot | store:4984, store:5483 | Historical repeats remain prospective defaults and cannot bypass support. |
| Substitution candidates, all layers | store:5653 | Check source; filter library and future-slot candidates through the shared evaluator. |
| Substitution commits | store:5553, store:5773, store:5778 | Recheck both source and cached destination on tap. |
| Skill chain | store:2955 | Withhold the operative rung result; achieved evidence remains in history. |
| Absolute load/advisory | store:2829 | Return no initial or advisory load under a hold. Read/render paths do not write audit rows. |
| APRE | store:2076, store:2094, store:6337 | Check each affected movement before future slot overrides; finalization still saves actual work and outcomes. |
| Session start/repeat | store:4984, store:5194 | Recheck assembled slot identities before and inside session creation. |
| Resume and cached UI | `apps/mobile/src/screens/SessionScreen.tsx:585` | Restored checkpoint stays factual; the screen reads current support before exposing work. |
| Rest-to-work/selection | store:5288, store:5340, store:5359, store:5378, store:5427, store:5446 | Recheck before selecting/advancing work, skipping rest/slots or changing rest targets. Staying at rest remains possible. |
| Set logging | store:5941; `apps/mobile/src/screens/SessionScreen.tsx:695` | Store and UI independently recheck. Held set entry cannot advance the runner. |
| Stop/finalization/factual activities | store:5465, store:6256; existing activity adapter | Manual stop, truthful finalization and retrospective actual activity logging remain usable. |
| Cached Today/Plan displays | `apps/mobile/src/screens/TodayScreen.tsx:76`; `apps/mobile/src/screens/BlockScreen.tsx:177` | Replace prospective guidance with a current hold notice; current-session navigation remains available for resting/finishing. |
| Diagnostics | `apps/mobile/src/diagnostics/coachVerificationLab.ts:1` | Existing in-memory diagnostic/fixture surface has no database/store mutator; no operative medical plan is introduced. |

## Executed regression evidence

The initial baseline typecheck passed, as did eight existing activity/demo real-store tests. The first 17 store regression tests failed before their store gates were implemented. Profile/session UI tests, scope inheritance, stale editor revision, cached Today/Plan display and locale ordering also have retained failing observations before their respective fixes.

An expanded replay replaced six tracked production files with the exact pinned-base blobs, ran the tests, and restored all six files byte-for-byte in a finally block: 28 genuine regression failures and one passing unheld APRE control. A subsequent pinned-base store replay independently demonstrated five more failures: continuation commit, routine freeze, slot selection, skip-slot and layer-two candidate publication. The failures were behavioral assertion failures, not missing modules or invalid fixture setup.

**Execution-order deviation:** several expanded APRE/routine/cached-commit/lifecycle cases were added after initial wiring, then replayed against the pinned base. This does not satisfy a literal claim that every final test was written before any implementation. The replay establishes the prior-code failures; it does not rewrite that chronology.

The real-store journey uses the actual Zustand store, full production migration chain and node:sqlite native-API seam. It captures, confirms, edits and deletes a transcription; checks the pre-deletion notice; verifies new revisions require confirmation; and proves the content-free hold survives deletion. Other adapter cases exercise exact prose round-trip/invariance, technical Unicode bounds, athlete/handle isolation, missing contract, orphan instructions, explicit withdrawal, FK failure and injected transaction rollback.

A final real-store UI regression first failed because saving an inert general note cleared an unsaved routine name. The composing screens now retain their athlete-bound component identity across non-executable note changes, while actual holds still unmount prospective guidance. The failing observation is `scratch/wo06/prose-ui-red.json`; the final focused run passed all 49 support tests.

An audit-evidence regression also first failed on actual block/slot/substitution entry points: all records were labelled `session`. The shared store now uses an enumerated operation-to-advice-kind mapping, so these records identify the applicable block, program, session, slot or movement-substitution operation. `scratch/wo06/advice-kind-red.json` retains the observed failure; the same real-store test passes after the correction.

Six targeted source mutations were detected and reverted byte-for-byte:

| Mutation | Observed failing assertions |
|---|---:|
| Shared evaluator always permits | 5 |
| Store log gate removed | 1 |
| APRE gate removed | 1 |
| Session display gate removed | 1 |
| Athlete/handle binding removed | 1 |
| Deletion silently withdraws remaining holds | 1 |

Raw observations and JSON results are retained locally under `scratch/wo06/`, including `wo06-base-replay.log`, `base-lifecycle.log`, `mutations.json`, the individual mutation logs, the scope/locale failing logs and `final-ci.log`. These are test-fixture observations, not captures of an athlete or a physical device. The root handover records final gate and candidate status.

## Limitations and deferred work

- No screening, diagnosis, clearance state, clinical compatibility interpretation, numeric clinician limit, live monitor, POTS progression, symptom rule or hydration/salt policy was implemented.
- Active instruction/deletion review holds have no clinical release workflow in this slice. Expiry dates never automatically release them.
- Unknown cross-entity applicability stays held; no name-based relationship inference was added.
- The UI follows existing keyboard-aware scrolling, 56-point controls and Android fullscreen-input suppression. Native keyboard, screen-reader, enlarged-text and rotation journeys were not run in this task.
- No physical-device memory/performance measurement, protected backup transfer or restore journey was performed. The existing 064 inventory is covered by the automated backup gate; encrypted backup implementation remains the separate WO-03 responsibility.
- A debug-signed QA APK is a candidate artifact, not native acceptance, clinical validation, release authority or C6.

MERGE / RELEASE / C6: NOT PERFORMED.
