# Work Order — Claude Opus Independent Audit of Gemini RPE/RIR Familiarisation

## 0. Control

- **Status:** READY FOR OPUS DISPATCH.
- **Role:** independent auditor. Do not act as an implementer.
- **Required model:** the latest Claude Opus model available in Claude Code, at **High** effort. If Opus is unavailable, stop and report the unavailable model; do not silently substitute another model family.
- **Working directory:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`
- **Branch:** `codex/rpe-familiarisation`
- **Integrity mode:** development.
- **Dispatch wrapper HEAD:** supplied verbatim in the launch prompt. It must equal `git rev-parse HEAD` at W0.
- **Gemini execution base:** `f8a0033717962f3492ff38e54681b20d54f82868`.
- **Required product ancestor:** `e15bbe9301fe756ecda9d8296877b19e425ac112`.
- **Gemini final product freeze:** `71ccc027275b080a42fea0ad67aff1e38d913740`.
- **Gemini final product tree:** `7e12cfe16fae28135e940735b5292062c790480e`.
- **Gemini evidence-package HEAD:** `ea668efd11c2c363ff65eb7a3fb1047d3046cb3a`.
- **Gemini evidence-package tree:** `9c39ab563a0bdc3b599c93be258003b229667332`.
- **Audit report path:** `docs/audits/rpe-familiarisation/opus/OPUS_INDEPENDENT_AUDIT.md`.
- **Authority boundary:** this audit may approve the candidate for Codex/Sol final review. It may not approve or perform a merge, push, release, tag, signing operation, APK distribution, or biometric pilot.

The product target and evidence target above are immutable. The later dispatch-wrapper commit adds only this audit work order and its dispatch-ledger record; it is not part of Gemini's implementation or evidence package.

## 1. Mission

Independently audit Gemini's completed implementation of `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md`. Decide from the frozen code, tests, git history, and reproducible behavior whether the work satisfies the work order without regressions or prohibited scope.

Gemini's handoff, Team Preview reports, claimed test totals, and claimed approvals are untrusted inputs. They identify claims to verify; they are not evidence by themselves. Read the live sources and reproduce the relevant checks.

Do not optimize for an approval. The valid outcomes are `APPROVE`, `REQUEST CHANGES`, and `BLOCKED`.

## 2. Independence and Mutation Rules

### 2.1 Auditor independence

- Use one Claude Opus audit context for the substantive judgment.
- Do not ask Gemini or its Team Preview reviewers to interpret their own work.
- Do not inherit a prior verdict, severity, or claimed test result without verification.
- Do not tell any optional mechanical helper a desired verdict.
- Do not collapse an absence of a failing test into proof that a behavior is correct.

### 2.2 Product read-only rule

Do not edit product code, tests, configuration, scripts, dependencies, native projects, migrations, or Gemini's existing handoff and Team Preview reports. Do not amend, rebase, cherry-pick, reset, switch branches, clean the worktree, or rewrite history.

After W0 succeeds, the only authorized tracked writes are:

- append one new entry to `PROMPT_LEDGER.md` for the exact Opus execution prompt;
- create `docs/audits/rpe-familiarisation/opus/OPUS_INDEPENDENT_AUDIT.md`;
- update only that new ledger entry's single Output section when the audit closes.

The first tracked file operation must be the append-only ledger entry. Preserve exactly one `Input G(x)` and one `Output F(G(x))` in that entry, and reproduce the complete execution prompt verbatim in the Input section. Tests may create ignored caches or temporary files, but no tracked product path may change.

### 2.3 Audit-report commit

After the verdict is complete:

1. verify that the only diff from the dispatch-wrapper HEAD is the new ledger entry and the Opus audit report;
2. create one local documentation-only audit commit;
3. record its commit and tree SHA in the final console handback;
4. leave the tracked worktree clean;
5. do not push.

If any pre-existing tracked or untracked state appears at W0, do not delete, move, stage, or absorb it. Record the exact paths and return `BLOCKED`.

## 3. Source Hierarchy

Use this order when claims conflict:

1. `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md` — acceptance contract.
2. Frozen product source and tests at product freeze `71ccc027...` — implementation reality.
3. Git history from execution base `f8a0033...` through evidence HEAD `ea668ef...` — provenance and scope.
4. `docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md` — Gemini claims requiring verification.
5. `docs/audits/rpe-familiarisation/team-preview/round-1/**` and `round-2/**` — submitted review evidence requiring authenticity, SHA, and completeness checks.

Where a handoff or reviewer report conflicts with code, command output, or history, report the conflict. Do not repair the narrative.

## 4. W0 — Identity and Freeze Validation

Perform W0 read-only before writing the ledger:

1. Print the absolute working directory.
2. Verify branch `codex/rpe-familiarisation`.
3. Verify the clean state with `git status --short --branch`.
4. Verify `git rev-parse HEAD` equals the dispatch-wrapper SHA supplied in the launch prompt.
5. Verify the exact commit and tree pairs listed in §0 with `git show -s` and `git rev-parse <sha>^{tree}`.
6. Verify the required ancestry:
   - `e15bbe9...` is an ancestor of `f8a0033...`;
   - `f8a0033...` is an ancestor of `71ccc02...`;
   - `71ccc02...` is an ancestor of `ea668ef...`;
   - `ea668ef...` is an ancestor of the dispatch-wrapper HEAD.
7. Verify that product paths are byte-identical between product freeze `71ccc02...`, Gemini evidence HEAD `ea668ef...`, and dispatch-wrapper HEAD.
8. Verify the commits after `71ccc02...` through the dispatch wrapper contain only handoff, review, ledger, and work-order documentation.
9. Record Node and npm versions. Do not install or update anything.

Return `BLOCKED` immediately on an identity, ancestry, cleanliness, or product-byte-identity mismatch. Do not audit a moving or ambiguous target.

After W0 passes, append the audit execution prompt to the next sequential ledger entry as required by §2.2.

## 5. Audit Charter A — Scope, Provenance, and Evidence Integrity

### 5.1 Cumulative scope

Inspect both of these ranges:

- implementation range: `f8a0033717962f3492ff38e54681b20d54f82868..71ccc027275b080a42fea0ad67aff1e38d913740`;
- evidence range: `71ccc027275b080a42fea0ad67aff1e38d913740..ea668efd11c2c363ff65eb7a3fb1047d3046cb3a`.

Verify every changed path against the original work order's authorized write set. Confirm that the implementation introduced none of the following:

- database migrations or schema changes;
- package or lockfile changes;
- Android/iOS native project changes or permissions;
- biometric, Health Connect, HealthKit, HR, HRV collection, SpO2, wearable, or sensor code;
- remote glossary content, telemetry, network access, or cloud dependencies;
- new onboarding or mandatory intake questions;
- progression, load, sets, or target-RPE algorithm changes;
- a sixth root navigation tab;
- retrospective rewriting of logged RPE;
- modifications to the biometric research branch or its deliverables.

Verify `packages/inference/test/verify_blocks.mjs` at the final product freeze is byte-identical to the execution base. Do not accept the handoff statement without comparing the blobs.

### 5.2 Commit and report provenance

For every Round 1 and Round 2 Team Preview record, verify:

- the named reviewed commit/tree exists;
- it matches the round's actual candidate;
- each report is separate and internally complete;
- Round 1's sentinel failure was not erased or misreported;
- the remediation commit actually removes the unauthorized verification-script change;
- every Round 2 verdict was newly issued for the new product freeze;
- no Round 1 approval is carried forward as Round 2 evidence;
- the final reconciliation agrees with all three Round 2 source reports;
- the handoff does not claim stronger evidence than the reports or git history establish.

The assertion that tests were written and observed red before product edits requires durable evidence. Inspect history and records. If the sequence cannot be independently established, label it `UNVERIFIED` rather than repeating it as fact, and decide severity from the actual work-order requirement and available evidence.

## 6. Audit Charter B — Effort Entry and Data Semantics

Inspect the real component path from render through `logSet`; do not limit the review to the pure mapping helper. At minimum, falsify or verify all of the following:

1. A newly active set has no actual RPE or RIR answer selected.
2. Planned target RPE remains visible as guidance but never initializes, confirms, copies, or silently becomes actual RPE.
3. No `Confirm target RPE` or equivalent shortcut remains.
4. For a target of `8.0`, submitting without an effort answer persists actual RPE as `null`.
5. For a target of `8.0`, explicitly selecting `2` clean reps left persists `8.0` because of the athlete's selection, not because target and actual happen to match.
6. For a target of `6.5`, explicitly selecting `1` clean rep left persists `9.0`, proving the mapping is independent of target.
7. Exact mapping is `0 -> 10.0`, `1 -> 9.0`, `2 -> 8.0`, `3 -> 7.0`, `4+ -> 6.0`, and malformed/out-of-domain input fails to `null`.
8. `Not sure` persists `null`, including when chosen after a prior RIR or direct-RPE selection.
9. Direct RPE is optional, begins unselected, permits only `5.0` through `10.0` in `0.5` increments, and persists `8.5` only after an explicit athlete action.
10. Switching between RIR and direct RPE cannot leave two contradictory active answers or log a stale value.
11. Ordinary rerenders retain the athlete's current selection, while a change in set identity resets it to unanswered.
12. Advancing between exercises or sessions cannot leak the previous set's answer.
13. Rep-based work shows the clean-reps-left question and all five choices plus `Not sure`.
14. Timed/non-rep work does not show or apply an RIR conversion.
15. Actual reps, including bodyweight reps, and load reach `logSet` unchanged by the effort UI.
16. Rest timing may use actual RPE when supplied and planned target as a fallback when actual is null, but fallback never changes persisted actual RPE from null.
17. Coach/autopilot evidence receives only explicitly athlete-confirmed non-null actual RPE.
18. Pain, dizziness, or loss of control is presented as a stop signal, not converted into an effort score.

Trace values through state initialization, handlers, rerender/reset effects, submission, persistence, and downstream consumption. Identify stale-closure, falsy-value, set-key, and navigation edge cases explicitly.

## 7. Audit Charter C — Canonical Glossary and Info Signs

### 7.1 Single-source invariant

Verify that inline signs and the searchable glossary derive displayed definitions from one typed canonical source. A compatibility export is acceptable only if it is mechanically derived or otherwise cannot drift. A second hand-authored definition is a second source even when retained to satisfy a regex gate.

Use this falsifier: if the canonical `Undulating` definition changed, would every user-visible explanation update without editing another definition literal? Apply the same question to all rendered terms. Pay particular attention to the retained static `WAVE` compatibility entry and determine whether it violates the stated single-source contract.

### 7.2 Resolution and display

Verify:

- every `InfoTip` identifier rendered by the mobile app resolves to a non-empty canonical entry;
- the RIR sign is attached to the clean-reps-left question and opens a useful beginner definition;
- the visible `Undulating` control opens an explanation titled `Undulating`, not the internal key `WAVE`;
- unknown keys fail loudly in development/tests and never render a blank card in production;
- no raw internal key or implementation term leaks into athlete-facing copy;
- information signs expose appropriate button/accessibility roles, labels, and focus behavior;
- modal dismissal and back behavior work without trapping keyboard or screen-reader users.

### 7.3 Glossary content and navigation

Verify the required vocabulary from the implementation work order is present, unique, beginner-readable, and internally consistent. Specifically inspect RPE, RIR, target RPE, actual RPE, RPE cap, RPE start/max where exposed, 1RM, load, sets, reps, tonnage, loading methods, periodization structure, goals, slot roles, readiness, HRV, and movement patterns.

Verify:

- case-insensitive offline search covers term, aliases, category, and definition;
- aliases such as `APRE`, `step loading`, and `return to training` find the intended entries;
- empty and no-result states are honest and stable;
- duplicate terms or aliases cannot produce contradictory explanations;
- the glossary is reachable from Athlete/Profile and back navigation returns correctly;
- no sixth root tab, network call, persisted state, or telemetry was added;
- HRV/readiness wording stays educational and avoids medical or biometric-RPE accuracy claims;
- the phone-width layout remains usable with large text and long definitions.

Do not approve glossary presence alone; inspect the actual definitions for misleading simplification, contradictions, and unexplained circular terminology.

## 8. Audit Charter D — Regression and Integration Boundaries

Verify the implementation preserves:

- prior session logging and completion behavior;
- actual-reps entry for loaded and bodyweight movements;
- load entry and unit handling;
- rest-timer calculation and lifecycle;
- set advancement, exercise advancement, and session completion;
- safety-stop behavior;
- existing progression and program-generation behavior;
- offline determinism and no runtime generative model;
- the existing root navigation structure.

Inspect whether the new glossary import/export structure creates cycles, eager work, or avoidable per-render allocation. Evaluate the change proportionately against the 450 MB device constraint; do not invent a memory number. Confirm search and lookup are bounded by the fixed glossary inventory.

## 9. Audit Charter E — Test Authenticity and Independent Verification

### 9.1 Test review

Read the changed tests as critically as the product code. Verify that they:

- render or execute the real path rather than only scanning source text;
- assert values delivered to the real mocked persistence boundary;
- cover null, mismatch, rerender, set-reset, timed-work, bodyweight, and selection-switch cases;
- would fail if target RPE were copied into actual RPE;
- would fail if an unanswered or `Not sure` value became non-null;
- would fail if an InfoTip key rendered an empty card;
- do not use unconditional passes, swallowed exceptions, snapshots without semantic assertions, disabled tests, `.skip`, `.only`, or stale external JSON;
- do not weaken or replace pre-existing gate assertions.

Record material coverage gaps even when the suite is green. Do not edit tests to close them.

### 9.2 Commands to reproduce

Run from the worktree without checking out another commit. First prove product-file identity with the frozen product SHA, then execute:

```powershell
npm.cmd run build:inference-test
node packages/inference/test/verify_effort_cues.mjs
npm.cmd run verify:components -- apps/mobile/test/components/SessionScreen.test.js
npm.cmd run verify:components -- apps/mobile/test/components/Glossary.test.js
npm.cmd run verify:components -- apps/mobile/test/components/ProfileScreens.test.js
npm.cmd run typecheck
npm.cmd run verify:blocks
npm.cmd run verify:components
npm.cmd run verify:ci
git diff --check f8a0033717962f3492ff38e54681b20d54f82868 71ccc027275b080a42fea0ad67aff1e38d913740
```

Record each command, exit code, and meaningful count. Do not report a command as run if it was inferred from Gemini's report. If a prerequisite is missing, distinguish an environment block from a product failure. Do not download dependencies or fetch remote assets during the audit.

After the commands, verify no tracked product path changed. Report ignored artifacts only if material to reproducibility.

## 10. Findings and Verdict Rules

### 10.1 Severity

- **P0:** critical data loss, security/privacy breach, or unusable core flow.
- **P1:** release-blocking correctness, provenance, invariant, or major UX/accessibility defect.
- **P2:** concrete defect or unmet acceptance criterion that must be fixed before merge.
- **P3:** non-blocking observation or optional improvement; explicitly state why it is not a defect.

Every P0/P1/P2 finding must include:

- exact `path:line` anchor at the audited product freeze;
- violated work-order clause or invariant;
- minimal reproduction or value trace;
- expected behavior and observed behavior;
- user/data impact;
- the reason existing tests did not catch it;
- a bounded remediation condition, without editing the code.

Do not inflate preferences into findings. Do not downgrade an unmet explicit acceptance criterion to P3.

### 10.2 Verdict

- **APPROVE:** W0 valid; all required commands pass; scope and evidence are sound; every acceptance criterion is satisfied; no open P0, P1, or P2 finding exists.
- **REQUEST CHANGES:** target is inspectable, but any P0, P1, or P2 finding, failed attributable gate, false evidence claim, or unmet acceptance criterion remains.
- **BLOCKED:** target identity is ambiguous, worktree was dirty before the audit, required source is unavailable, or verification cannot be completed for an environment reason that prevents a defensible verdict.

An `APPROVE` verdict is readiness for Codex/Sol final review only. It is never push, merge, release, or device-safety authority.

## 11. Required Audit Report Schema

Write `docs/audits/rpe-familiarisation/opus/OPUS_INDEPENDENT_AUDIT.md` with exactly these H2 sections:

1. `## 1. Audit Target Identity`
2. `## 2. Verdict`
3. `## 3. Findings`
4. `## 4. Acceptance-Criteria Matrix`
5. `## 5. Executed Verification`
6. `## 6. Gemini Evidence and Review Provenance`
7. `## 7. Scope and Forbidden-Change Verification`
8. `## 8. Verified Correct Behavior`
9. `## 9. Residual Risks and Unverified Claims`
10. `## 10. Remediation Work Order`
11. `## 11. Authority Boundary and Final Token`

Requirements:

- Give each acceptance criterion a `PASS`, `FAIL`, or `BLOCKED` state plus exact evidence.
- Put `None` in Findings when there are no findings; do not omit the section.
- Separate command output reproduced by Opus from output merely reported by Gemini.
- Cite source with exact paths and one-based line numbers taken from the frozen product.
- State what the completed gates do not prove.
- Preserve prior failed review rounds as history rather than rewriting them.
- If the verdict is `REQUEST CHANGES`, §10 must contain a ready-to-paste, SHA-bound Gemini 3.8 remediation prompt with authorized paths, falsifying tests, gates, freeze rules, and return conditions.
- If the verdict is `APPROVE`, put `Not required` in §10.
- Never include a push command or grant push authority.

## 12. Required Final Token

Return exactly one of these tokens at the end of both the report and console handback:

- `OPUS INDEPENDENT AUDIT: APPROVE — READY FOR CODEX/SOL FINAL REVIEW`
- `OPUS INDEPENDENT AUDIT: REQUEST CHANGES — GEMINI REMEDIATION REQUIRED`
- `OPUS INDEPENDENT AUDIT: BLOCKED — TARGET OR ENVIRONMENT INVALID`

Stop after the local documentation-only audit commit. Do not implement a finding and do not push.
