# Work Order — Beginner Learning UX: RPE/RIR Familiarisation and Terminology Glossary

## 0. Control Record

- **Status:** READY FOR ANTIGRAVITY TEAM PREVIEW DISPATCH.
- **Executor role:** Team Preview lead orchestrator coordinating bounded implementers, a mechanical sentinel, and two fresh read-only reviewers.
- **Required model:** use the owner's available **Gemini 3.8** option at **High** effort for the lead, both implementers, and both substantive reviewers. The mechanical sentinel may use Medium if Team Preview requires a resource trade-off. Do not silently substitute another model; stop and report if Gemini 3.8 is unavailable.
- **Working directory:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`
- **Branch:** `codex/rpe-familiarisation`
- **Required product ancestor:** `e15bbe9301fe756ecda9d8296877b19e425ac112`
- **Integrity mode:** development.
- **Team Preview audit:** required before handback, with SHA-bound verdicts and remediation/re-review as specified in W7.
- **Final independent audit:** reserved for Codex/Sol after Team Preview. Team approval is not owner, merge, push, or release authority.
- **Release boundary:** local implementation, verification, commits, and an audit handover only.
- **Forbidden actions:** no merge, rebase, push, force-push, tag, signing, release, APK distribution, store action, or biometric pilot execution.

## 1. Objective

Improve the usefulness of beginner effort reporting by treating RPE/RIR judgment as a skill learned through repeated, low-burden practice, and make unfamiliar strength-and-conditioning terminology explainable at the point of use and discoverable later in an offline glossary.

Replace the current target-anchored actual-RPE confirmation flow with an athlete-initiated post-set question:

> How many more clean reps could you have completed?

The primary answer is repetitions in reserve (RIR), expressed in plain language. The app may translate an explicit athlete answer into the existing nullable numeric actual-RPE field, but it must never preselect, confirm, grade, or infer the answer from the planned target, biometrics, or prior history.

This is a focused learning-UX correction, not a biometric feature, questionnaire expansion, research pilot, or progression rewrite.

## 2. Product Decision

### 2.1 Effort remains athlete-reported

- Planned target RPE remains visible as a prescription and stays separate from actual effort.
- Actual effort begins unanswered for every set.
- No actual RPE exists until the athlete actively selects an RIR answer or explicitly enters a numeric RPE.
- `Not sure` is a valid answer and persists the existing `NULL` actual-RPE semantics.
- The app must not tell the athlete that their answer is correct or incorrect.
- The app must not calculate an accuracy, calibration, reliability, or body-awareness score.

### 2.2 Beginner-first RIR interaction

For rep-based resistance work, make this the primary post-set effort interaction:

| Athlete choice | Plain-language meaning | Stored actual RPE after explicit selection |
|---|---|---:|
| `0` | No more clean reps | `10.0` |
| `1` | About one clean rep left | `9.0` |
| `2` | About two clean reps left | `8.0` |
| `3` | About three clean reps left | `7.0` |
| `4+` | At least four clean reps left | `6.0` |
| `Not sure` | Athlete cannot give a reliable answer | `NULL` |

“Clean rep” means another repetition completed with acceptable technique and control. Pain, dizziness, or loss of control is a stop signal, not an RPE value.

The mapping is an interpretation of the existing owner-ratified cue bands. It is not a sensor estimate and must not be described as precise ground truth.

### 2.3 Optional direct numeric entry

Preserve an explicit path for an athlete who prefers the existing half-step RPE scale:

- place it behind a compact `Enter RPE directly` or equivalent affordance;
- allow values from `5.0` through `10.0` in `0.5` steps;
- opening the control must not silently select or persist a value;
- the value must not initialize from the planned target;
- choosing or adjusting a value is the athlete action that makes it non-null; and
- returning to `Not sure` clears the answer back to null.

The executor may choose the smallest accessible implementation consistent with these rules. Do not introduce a new shared design system or dependency.

### 2.4 Burden limit

- Add no onboarding screen and no mandatory profile question.
- Add no modal tutorial that blocks starting or completing a session.
- Keep the post-set interaction completable with one tap for an RIR answer or `Not sure`.
- Put longer explanation behind an optional disclosure or existing information affordance.
- Do not require an answer to log or complete a set.
- Do not add a separate confidence questionnaire; `Not sure` is the uncertainty mechanism for this pass.

### 2.5 Scope across session types

- Use RIR entry for rep-based resistance sets.
- Do not pretend RIR applies cleanly to timed conditioning, holds, carries, or distance work.
- For a non-rep target, retain optional actual RPE entry without an RIR-to-RPE conversion, using concise existing effort cues.
- Breathing/talk cues remain secondary context for conditioning and must not replace resistance-set RIR.

### 2.6 Information signs and in-app glossary

The repository already has an `InfoTip` component and a glossary object. Complete and harden that pattern instead of creating a second explanation system.

- Put a small, accessible information sign beside genuinely unfamiliar terminology when the explanation is not already visible.
- A tip must use the same athlete-facing term as its nearby label. For example, a control labelled `Undulating` must open an explanation titled `Undulating`, not `WAVE`.
- Every rendered information sign must resolve to a non-empty glossary entry. Unknown keys must fail during development/tests rather than opening a blank card.
- Add an offline `Glossary` sub-view reachable from the Athlete/Profile area. Do not add a sixth root tab.
- The glossary must be viewable later without entering onboarding, creating a program, or starting a session.
- Provide case-insensitive local search across term names, aliases, categories, and definition text.
- Sort results predictably and show an honest empty-search result.
- Use one canonical glossary source for both inline signs and the full glossary; duplicated definitions are forbidden.
- Keep definitions short, plain, neutral, and suitable for a beginner. Define one unfamiliar term without introducing several undefined terms in its explanation.

The first release must cover at least:

- RPE; RIR / reps in reserve; target RPE; actual RPE; RPE cap;
- 1RM / one-rep max; load; sets; reps; tonnage;
- linear; undulating; step loading; autoregulated / APRE; deload;
- block; microcycle; macrocycle;
- strength; hypertrophy; power; endurance; GPP; hybrid; return to training;
- major; supplementary; accessory; conditional;
- readiness; HRV; and
- the movement-pattern terms already present in the existing glossary.

Do not place an information sign beside ordinary words merely to maximize coverage. Do not turn the glossary into coaching, diagnosis, or a promise that a training method is universally best.

## 3. Scientific Boundary

This implementation is justified as familiarisation, not validated coaching or measurement:

- Wiedenmann et al. 2026 reported improvement in RIR estimation over six sessions in a small younger/older adult sample: <https://pubmed.ncbi.nlm.nih.gov/42632893/>.
- Lovegrove et al. 2022 reported reliable RIR-based load prescription in 15 novice-trained young men after familiarisation: <https://pubmed.ncbi.nlm.nih.gov/36135029/>.
- Remmert et al. 2023 found no significant improvement in absolute RIR error over six weeks in nine trained men, so learning must not be promised as guaranteed: <https://pubmed.ncbi.nlm.nih.gov/37436724/>.
- Hackett et al. 2017 found estimation was generally more accurate nearer failure and differed by exercise: <https://pubmed.ncbi.nlm.nih.gov/27787474/>.

Permitted claim: repeated use of clear RIR anchors may help an athlete become more familiar with reporting effort.

Forbidden claims include:

- the app measures true RPE;
- six sessions guarantees accuracy;
- a selected RIR value proves actual remaining capacity;
- heart rate, HRV, sleep, SpO2, stress, respiration, or a wearable validates the answer; and
- the athlete should routinely train to failure to calibrate the scale.

## 4. Verified Starting State to Reproduce at W0

Treat these as claims to verify against the checked-out code:

- `apps/mobile/src/screens/SessionScreen.tsx` initializes the actual-RPE state from `currentSlot.targetRpe`.
- The same screen offers a one-tap `Confirm target RPE ...` action.
- Untouched RPE currently reaches `logSet` as null.
- `packages/inference/src/effortCues.ts` contains the owner-ratified RPE/RIR cue bands and no biometric inference.
- `apps/mobile/src/components/InfoTip.tsx` already contains the reusable information sign and its current glossary definitions.
- `SessionScreen.tsx` currently requests `tip="RIR"` beside `Actual reps`, but the glossary contains no `RIR` entry; the resulting card is empty and the placement does not explain an RIR question.
- `RoutineTemplateBuilder.tsx` displays `Undulating` while passing the internal key `WAVE` to the tip, so the visible term and explanation title disagree.
- No full glossary sub-view is currently reachable from Athlete/Profile.
- `set_record.rpe` is nullable and the existing Coach/autopilot observer uses non-null actual RPE separately from the frozen target.
- `apps/mobile/test/components/SessionScreen.test.js` explicitly protects null semantics but also protects exact-target confirmation; the latter test must be superseded by the unanchored contract.
- Migration `060_program_goal_tier_alignment.sql` is the newest migration at the required ancestor.

If the actual starting state materially differs, stop before product edits and report the mismatch. Do not adapt the contract silently.

## 5. Non-Negotiable Invariants

- Unanswered and `Not sure` actual effort remain `NULL`.
- Planned target RPE is never copied into actual RPE without a distinct athlete answer.
- Planned and actual effort remain separate persisted concepts.
- Only an explicit athlete choice contributes RPE evidence to Coach/autopilot calculations.
- Existing actual reps, load-entry modes, bodyweight behavior, time/distance/band metrics, rest timers, substitution, safety, and session navigation remain intact.
- Existing RPE safety bounds remain `5.0–10.0` in half steps.
- The planned target remains visible before the set because it guides the prescription; the post-set answer must nevertheless start unselected and must never be labelled as confirmation of the target.
- No failure set, AMRAP, maximal test, or other calibration workout is introduced.
- No migration, schema field, Health Connect change, permission, dependency, native change, readiness change, prescription change, or biometric computation is authorized.
- No new onboarding or recurring questionnaire is authorized.
- Inline tips and the glossary use one offline canonical data source and perform no network request.
- Every information sign opens a non-empty definition whose title matches the nearby athlete-facing label.
- Glossary navigation must preserve existing Android hardware-back and iOS back-swipe behavior through the repository's sub-view contract.
- No existing shipped migration may be edited.

## 6. Authorized Write Set

### 6.1 Coordination and evidence

- `PROMPT_LEDGER.md` — append-only next sequential entry.
- `docs/audits/rpe-familiarisation/**` — new execution handover and test evidence only.

### 6.2 Product

- `apps/mobile/src/screens/SessionScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/components/InfoTip.tsx`
- `apps/mobile/src/components/RoutineTemplateBuilder.tsx`
- one new glossary screen/component under `apps/mobile/src/screens/` or `apps/mobile/src/components/`
- one new canonical glossary-data module under `apps/mobile/src/` if separating data from presentation improves typing and reuse
- `packages/inference/src/effortCues.ts`
- `packages/inference/src/index.ts`
- one new pure helper under `packages/inference/src/` only if it makes the answer-to-RPE mapping independently testable.

### 6.3 Tests and verification wiring

- `apps/mobile/test/components/SessionScreen.test.js`
- `apps/mobile/test/components/ProfileScreens.test.js`
- `apps/mobile/test/components/ProgramQualityRound2.test.js` only if the loading-method tip contract belongs beside its existing builder assertions
- one new focused glossary component/content test if that is clearer than extending the existing files
- `packages/inference/test/verify_effort_cues.mjs`
- one new focused inference test only if a new helper is added.
- `package.json` only if a new focused verifier must be added to an existing aggregate gate.

Any path outside this set requires a written stop report before modification. In particular, `useStore.ts`, database schema, migration files, onboarding screens, navigation root/tab definitions, biometrics, readiness, progression/autopilot algorithms, shared UI primitives other than `InfoTip`, Android/iOS files, dependencies, release configuration, and the biometric research branch are outside scope.

## 7. Execution Plan

### 7.1 W0 — Identity and baseline

1. Verify the worktree, branch, HEAD, clean status, and required ancestor.
2. Confirm the root checkout is not being used.
3. Confirm no unknown untracked files are present.
4. Record Node and npm versions.
5. Reproduce the starting-state claims in section 4 with exact file and line citations.
6. Run the focused effort-cue and SessionScreen component tests before editing.
7. Append the next sequential `PROMPT_LEDGER.md` entry as the first tracked write. Store the complete received execution prompt verbatim under one Input section and leave one Output section open.

### 7.2 W1 — Red tests before product changes

Add failing tests that prove the current target-anchored behavior violates this order:

1. A new rep-based set starts with no actual-effort answer selected.
2. No `Confirm target RPE` action exists.
3. Logging without an answer persists null.
4. `Not sure` persists null.
5. Each RIR choice maps exactly to the table in section 2.2.
6. Selecting an answer, rerendering the same set, and then logging preserves that answer.
7. Advancing to the next set resets actual effort to unanswered.
8. Changing the planned target does not silently change a selected actual answer.
9. Optional direct RPE entry supports the half-step boundaries without initializing from target RPE.
10. Timed/non-rep work does not present an RIR conversion as though it were valid.
11. Existing bodyweight actual-reps behavior remains unchanged.
12. Every currently rendered `InfoTip` resolves to a non-empty canonical entry.
13. The tip beside `Undulating` opens an explanation titled `Undulating`, not `WAVE`.
14. The existing Session `RIR` information sign opens a real definition.
15. Athlete/Profile opens the glossary; hardware/sub-view back returns to Athlete/Profile without changing the selected root tab.
16. Glossary search matches a term and an alias case-insensitively, and a no-match query shows an empty state.
17. No test may pass only by searching source text or restating an implementation boolean.

Record the pre-fix failures. Identify genuinely pre-existing passing coverage rather than presenting it as red proof.

### 7.3 W2 — Pure effort interpretation

Implement or refactor a pure, deterministic answer-to-RPE boundary:

- accept only the five RIR choices and `Not sure`;
- return the exact numeric/null mapping from section 2.2;
- reject or return null for malformed values without guessing;
- expose concise meaning text and the existing stop guidance;
- contain no store, UI, time, random, sensor, network, or biometric dependency; and
- retain the existing `effortCue(rpe)` behavior for direct numeric entry unless a test-backed copy correction is required.

### 7.4 W3 — Canonical glossary and information signs

1. Refactor the current glossary into one typed canonical data source suitable for both `InfoTip` and a list screen.
2. Give each entry a stable ID, athlete-facing title, concise definition, aliases, and category, or an equivalently typed shape.
3. Make invalid/unknown tip identifiers impossible at TypeScript call sites where practical and test the dynamic boundary explicitly.
4. Move the `RIR` explanation to the new RIR question, fix its empty content, and fix the `Undulating`/`WAVE` label mismatch.
5. Preserve the existing centered, non-clipping modal behavior and accessible dismiss action.
6. Add only the high-value information signs needed for the required vocabulary and visible complicated labels; reuse visible explanation text where adding a sign would be redundant.
7. Add the searchable offline Glossary sub-view under Athlete/Profile using the existing sub-view back contract.
8. Do not create a new root tab, navigation dependency, database table, preference, telemetry event, or network dependency.
9. Review existing definitions for beginner clarity and correct misleading absolutes. In particular, HRV/readiness copy must describe an input/context signal, not a diagnosis or proof of recovery.
10. Record the complete shipped term inventory in the handover so the auditor can compare it with the canonical source mechanically.

### 7.5 W4 — Unanchored Session interaction

Implement the UI contract:

1. Keep the prescribed target visible and clearly labelled `Target`.
2. Replace the prefilled actual-RPE confirmation with the unanswered RIR question for rep-based work.
3. Make every RIR choice and `Not sure` accessible by label and state.
4. Show the derived actual RPE only after an athlete selection, and make it clear that the athlete supplied the answer.
5. Provide optional direct half-step entry without a preselected target value.
6. Allow the athlete to clear a prior answer back to `Not sure`/null before logging.
7. Reset the response only when the active set identity changes, not on ordinary rerenders.
8. Preserve the current rest rule: athlete-entered actual RPE may select rest duration; null falls back to the planned target solely for the rest timer and must remain null in persisted evidence.
9. Do not compare the answer with the target or display praise, warnings, correctness judgments, or progression promises.
10. Keep the interaction visually usable in the existing phone-width vertical layout and with enlarged text.

### 7.6 W5 — Regression and negative proof

Prove by execution:

- target RPE `8.0` plus no answer logs null;
- target RPE `8.0` plus `2` RIR logs `8.0` because of the athlete's explicit RIR selection, not target copying;
- target RPE `6.5` plus `1` RIR logs `9.0` unchanged;
- target RPE `9.0` plus `4+` RIR logs `6.0` unchanged;
- selecting `2`, switching to `Not sure`, then logging produces null;
- direct `8.5` entry logs `8.5` only after explicit selection;
- a rerender cannot replace selected `9.0` with the target;
- next-set transition returns to unanswered;
- bodyweight actual reps still reach `logSet` unchanged;
- timed work records optional direct actual RPE without showing the RIR mapping;
- no product diff imports from `packages/biometrics`, Health Connect, or sensor APIs; and
- no migration/schema/permission/dependency/native/release file changed;
- every rendered information sign resolves to non-empty canonical content;
- glossary terms and inline tips use byte-identical definitions from the same source;
- searching `rir`, `reps in reserve`, and mixed-case `UnDuLaTiNg` returns the intended entries;
- an unmatched glossary search produces the explicit empty state; and
- opening/dismissing an information sign or entering/leaving the glossary changes no athlete, program, session, or navigation-root state.

### 7.7 W6 — Full verification and freeze

Run at minimum:

1. the focused inference effort-cue/helper verifier;
2. the focused `SessionScreen.test.js` component suite;
3. `npm run typecheck`;
4. `npm run verify:blocks`;
5. `npm run verify:components`;
6. `npm run verify:ci` using the repository-prescribed preflight/materialization sequence if required;
7. `git diff --check`; and
8. a changed-path check against the W0 starting commit.

Do not weaken, delete, skip, or rewrite unrelated tests to obtain a pass. Deliberate negative fixtures must remain distinguishable from real failures.

Create logically scoped local commits and an exact candidate-freeze commit. Record its commit and tree SHA before starting Team Preview review. Draft, but do not yet close, `docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md` containing:

- W0 identity and starting SHA;
- commit and tree SHAs;
- exact changed paths;
- red-first evidence;
- focused and full verification commands with exit codes;
- the final RIR mapping;
- the canonical glossary path, shipped term inventory, and inline-tip placements changed;
- proof that every rendered tip resolves and that glossary navigation/search work offline;
- confirmation that actual RPE starts unanswered and no target-confirmation action remains;
- confirmation that null semantics and existing progression inputs are preserved;
- confirmation of zero biometric, permission, schema, migration, dependency, onboarding, release, or push changes;
- known limitations and any stopped/deferred item; and
- a clear statement that final independent review and release authority remain pending Codex/Sol.

Do not close the ledger Output until W7 is complete.

### 7.8 W7 — Team Preview self-audit, remediation, and final freeze

Use Team Preview. If agent capacity prevents parallel execution, run the roles sequentially without collapsing executor and reviewer independence.

#### Team roles and write ownership

1. **Lead orchestrator — Gemini 3.8 High**
   - owns W0, the ledger, task decomposition, integration, candidate freezes, remediation routing, and final handover;
   - reads the entire work order before dispatching any agent;
   - defines the canonical glossary API/IDs before parallel edits begin;
   - ensures no two agents edit the same path concurrently; and
   - may integrate verified work but may not issue either reviewer verdict.
2. **Implementer E1, effort entry — Gemini 3.8 High**
   - owns `SessionScreen.tsx`, the pure RIR/RPE helper/cues and exports, and the focused Session/effort tests;
   - implements W1/W2/W4 only within those paths; and
   - reports exact tests and unresolved integration needs to the lead.
3. **Implementer E2, learning glossary — Gemini 3.8 High**
   - owns the canonical glossary data, `InfoTip`, the glossary view, Athlete/Profile entry point, loading-method tip correction, and their focused tests;
   - implements W1/W3 only within those paths; and
   - reports its exported glossary contract to E1 and the lead.
4. **Mechanical sentinel — Gemini 3.8 Medium or High, read-only after the candidate freeze**
   - verifies branch/HEAD/tree, clean status, authorized paths, forbidden-path absence, diff hygiene, test commands, glossary completeness, and test-evidence authenticity;
   - runs the full required verification rather than trusting the handover; and
   - writes only its report under `docs/audits/rpe-familiarisation/team-preview/round-N/` when authorized by the lead after all observations are captured.
5. **Reviewer A, product/data correctness — fresh Gemini 3.8 High context, read-only**
   - checks the complete work order and exact candidate diff;
   - verifies null semantics, absence of target copying, mapping correctness, set-identity resets, rest fallback separation, timed-work behavior, Coach/autopilot evidence boundaries, and regressions; and
   - reproduces relevant tests and counterexamples independently.
6. **Reviewer B, beginner UX/accessibility/glossary — fresh Gemini 3.8 High context, read-only**
   - checks the complete work order and exact candidate diff;
   - verifies burden, wording, accessibility roles/labels/states, phone-width behavior, glossary typing/content/search/empty state, inline-tip resolution, Athlete/Profile navigation and back behavior; and
   - reproduces relevant tests and counterexamples independently.

If Team Preview uses isolated worktrees, implementers commit on their assigned branches and the lead integrates them in a declared order. If it uses one shared worktree, serialize commits and never allow overlapping writes. Do not use destructive reset/checkout commands to resolve integration.

#### Review dispatch contract

- Dispatch the sentinel and both reviewers only after a clean candidate freeze exists.
- Give each reviewer the work order, base SHA, exact candidate commit/tree SHA, and its review charter.
- Do not give reviewers a desired verdict or ask them to confirm executor claims.
- Reviewers must inspect files and execute checks themselves; the executor handover is untrusted context.
- Each report must state the exact audited SHA and tree, commands run, evidence inspected, and one verdict: `APPROVE` or `REQUEST CHANGES`.
- Findings use `P0`, `P1`, `P2`, or `P3`, with an exact file/line or command reproduction and a bounded remediation.
- `APPROVE` is permitted only with zero open P0/P1/P2 findings. P3 observations may remain only when explicitly non-defective and recorded.
- Persist verbatim reports separately as:
  - `team-preview/round-N/sentinel.md`
  - `team-preview/round-N/reviewer-a.md`
  - `team-preview/round-N/reviewer-b.md`
  - `team-preview/round-N/reconciliation.md`
- The lead must disclose that all in-run agents used the Gemini 3.8 family; model/context isolation improves independence but does not provide model diversity. The later Codex/Sol audit supplies the external review boundary.

#### Remediation loop

1. If the sentinel fails any mechanical gate or either reviewer returns `REQUEST CHANGES`, the candidate is not approved.
2. The lead converts every finding into a numbered remediation item without weakening the original work order.
3. Add or strengthen a failing test for every behavioral defect before changing product code.
4. Route fixes to the appropriate original ownership lane, integrate them, run all focused and full gates, and create a new freeze SHA.
5. Dispatch a fresh Reviewer A and Reviewer B context against the new exact SHA. An earlier approval never carries forward to a changed tree.
6. Repeat for at most three review rounds. If a third round still has an open P0/P1/P2 or a failing mechanical gate, stop with `PARTIAL — OPEN FINDINGS LISTED`; do not spend an unbounded session or declare success.
7. Do not “fix” a finding by deleting coverage, loosening assertions, changing the work order, hiding a limitation, or editing a reviewer report.

#### Completion and final handback

Team Preview completion requires all of the following at one exact final freeze:

- sentinel mechanical result `PASS`;
- Reviewer A `APPROVE`;
- Reviewer B `APPROVE`;
- full `npm run verify:ci` exit `0` at the same tree;
- `git diff --check` clean;
- authorized-path check clean;
- all review and reconciliation records committed; and
- tracked worktree clean.

After those conditions hold, finalize `EXECUTOR_HANDOFF.md`, close the single ledger Output, and create a final documentation-only handover commit. Recompute HEAD/tree and rerun the documentation/scope checks. The handover commit may sit above the product freeze, but it must touch only `PROMPT_LEDGER.md` and `docs/audits/rpe-familiarisation/**`; record both SHAs distinctly.

Nothing in Team Preview may grant merge, push, release, signing, APK-distribution, or owner approval. Stop and return the complete package to Codex/Sol.

## 8. Acceptance Criteria

### 8.1 Product behavior

- [ ] Every new set begins with actual effort unanswered.
- [ ] Rep-based work asks for clean reps remaining using the five RIR choices plus `Not sure`.
- [ ] The exact mapping in section 2.2 is implemented by a pure tested boundary.
- [ ] Planned target RPE is visible but is never preselected or presented as the athlete's answer.
- [ ] `Confirm target RPE` and equivalent target-copy shortcuts are absent.
- [ ] No answer and `Not sure` both persist actual RPE as null.
- [ ] Direct numeric entry is optional, explicit, half-step bounded, and unanchored.
- [ ] Timed/non-rep work is not falsely converted through RIR.
- [ ] No new mandatory question, modal, onboarding screen, or confidence survey exists.
- [ ] No accuracy, grading, biometric, medical, or guaranteed-learning claim exists.
- [ ] A searchable offline glossary is reachable from Athlete/Profile without adding a root tab.
- [ ] Inline information signs and the glossary share one canonical definition source.
- [ ] `RIR` opens a non-empty definition and `Undulating` opens an explanation bearing the same title.
- [ ] The required initial vocabulary is present with beginner-readable definitions and useful aliases.
- [ ] Unknown/dangling tip identifiers fail closed in tests and never present an empty card.

### 8.2 Integrity and regression

- [ ] Only authorized paths changed.
- [ ] No migration or schema change exists.
- [ ] Existing bodyweight actual-reps behavior remains passing.
- [ ] Existing null semantics remain passing.
- [ ] Only athlete-confirmed non-null values reach Coach/autopilot RPE evidence.
- [ ] Full CI passes without weakening gates.
- [ ] Worktree is clean after the final local commit.
- [ ] The final exact product freeze has sentinel PASS plus independent Reviewer A and Reviewer B APPROVE verdicts.
- [ ] Every Team Preview report identifies the exact SHA/tree it reviewed and is preserved verbatim in a separate file.
- [ ] Any remediation was reviewed again at its new SHA; no stale approval was carried forward.
- [ ] Nothing was merged, rebased, pushed, tagged, released, signed, distributed, or run as a biometric pilot.

## 9. Explicit Non-Goals

- Biometric RPE estimation or validation.
- Health Connect, HR, HRV, sleep, stress, respiratory-rate, SpO2, or wearable work.
- Readiness-policy changes.
- Progression, load, set, or target-RPE algorithm changes.
- A calibration score or claim of measured body awareness.
- Routine training to failure.
- Additional onboarding or intake questions.
- A sixth root navigation tab.
- An exhaustive tooltip beside every label or ordinary word.
- Remote wiki hosting, web content, accounts, syncing, or glossary telemetry.
- Session-RPE redesign.
- Retrospective rewriting of existing logged RPE values.
- Merging or closing the biometric research pull request.

## 10. Required Final Token

Return exactly one implementation token:

- `IMPLEMENTATION COMPLETE — TEAM PREVIEW APPROVED — READY FOR CODEX/SOL AUDIT`
- `PARTIAL — OPEN FINDINGS LISTED`
- `BLOCKED — STARTING STATE OR SCOPE DECISION REQUIRED`

Never return a release, merge, or push approval.

## 11. Ready-to-Paste Antigravity Prompt

```text
Run this as an Antigravity Team Preview using the owner's available Gemini 3.8 model. Use High effort for the lead orchestrator, both implementation agents, and both substantive reviewers. The mechanical sentinel may use Medium or High. If Gemini 3.8 is unavailable, stop and report that rather than silently substituting another model.

Working directory:
C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation

Branch:
codex/rpe-familiarisation

Execute docs/WORKORDER_RPE_RIR_FAMILIARISATION.md exactly.

Read the entire work order first. At W0, verify the branch, clean state, exact starting HEAD, and required ancestor before changing anything. Append the next sequential PROMPT_LEDGER entry as the first tracked write and preserve exactly one Input and one Output section.

Create and coordinate these Team Preview roles exactly as W7 specifies:

- Lead orchestrator: identity, ledger, ownership, integration, freezes, reconciliation, and final handover.
- Implementer E1: unanchored RIR/RPE effort entry and focused tests.
- Implementer E2: canonical glossary, InfoTip, searchable Athlete/Profile glossary, and focused tests.
- Mechanical sentinel: independent read-only scope/test/evidence verification.
- Reviewer A: fresh read-only product/data-correctness review.
- Reviewer B: fresh read-only beginner-UX/accessibility/glossary review.

Do not let agents edit overlapping files concurrently. Use isolated contexts for both reviewers and do not tell them the desired verdict.

Add red tests before product changes. Remove the target-anchored actual-RPE confirmation flow, make clean-reps-left RIR choices the primary optional entry for rep-based work, preserve a deliberately unanchored direct half-step RPE path, and keep unanswered or Not sure actual RPE as null. Preserve all existing actual-reps, load, rest, session, safety, and progression behavior.

Harden the existing InfoTip/glossary pattern: fix the blank RIR tip and Undulating/WAVE mismatch, create one typed canonical glossary source, add a searchable offline Glossary sub-view reachable from Athlete/Profile, and cover the required beginner terminology. Do not add a sixth root tab or duplicate definitions.

Do not add a migration, schema field, onboarding question, confidence questionnaire, biometric input, sensor permission, dependency, remote wiki/network call, failure test, calibration score, or accuracy claim. Do not modify the biometric research branch.

Run the focused tests, typecheck, verify:blocks, verify:components, full verify:ci, git diff --check, and the authorized-path check. Create a clean candidate freeze, then complete the W7 Team Preview audit. If either reviewer requests changes or the sentinel fails, remediate with red tests, create a new freeze, and commission fresh SHA-bound reviews. Continue for up to three review rounds. Never carry an approval across a changed tree.

Finish only when the same final product freeze has sentinel PASS, Reviewer A APPROVE, Reviewer B APPROVE, full CI exit 0, clean scope/diff checks, and committed verbatim review records. Then close the ledger, finalize the executor handover, create the documentation-only handover commit, and stop for Codex/Sol.

Do not merge, rebase, push, force-push, tag, sign, release, build/distribute an APK, or execute a biometric pilot. Stop after the local handover for Codex/Sol audit.
```
