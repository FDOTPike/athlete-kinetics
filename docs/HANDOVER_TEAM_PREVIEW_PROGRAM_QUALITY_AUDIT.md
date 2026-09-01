# Team Preview Handover — Program Quality and Intake Candidate

## 0. Completion Rule

This file is a template until every angle-bracket placeholder is replaced by the implementation executor. Do not begin the audit against an incomplete template.

## 1. Audit Request

Start an independent Team Preview audit of the frozen program-quality candidate. Verify the candidate directly; treat the executor handoff, generated matrix, and claimed test results as untrusted leads rather than proof.

- **Repository:** C:\Users\fpike\Documents\Claude Coding\Athlete App
- **Worktree:** C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation
- **Branch:** codex/program-quality-remediation
- **Required product ancestor:** 965492e02184e07ddab20391740f10a694bd9149
- **Frozen candidate SHA:** <FROZEN_CANDIDATE_SHA>
- **Candidate tree SHA:** <FROZEN_TREE_SHA>
- **Base for review diff:** <REVIEW_BASE_SHA>
- **Executor:** <EXECUTOR_MODEL_AND_SESSION>
- **Executor effort:** <EXECUTOR_EFFORT>
- **Freeze timestamp/time zone:** <FREEZE_TIMESTAMP>

## 2. Candidate Evidence

- **Executor handoff:** docs/audits/program-quality-remediation/EXECUTOR_HANDOFF.md
- **Test evidence:** docs/audits/program-quality-remediation/TEST_EVIDENCE.md
- **Generated-program matrix:** docs/audits/program-quality-remediation/GENERATED_PROGRAM_MATRIX.md
- **Owner decisions and limitations:** docs/audits/program-quality-remediation/OWNER_DECISIONS_AND_LIMITATIONS.md
- **PROMPT_LEDGER entry:** <LEDGER_ENTRY_NUMBER_AND_LINE>
- **Changed files:** <EXACT_CHANGED_FILE_LIST_OR_MANIFEST_PATH>
- **Claimed targeted result:** <TARGETED_RESULT>
- **Claimed full verify result:** <FULL_VERIFY_RESULT>
- **Claimed matrix result:** <MATRIX_RESULT>

## 3. Governing Requirements

Read completely:

- docs/WORKORDER_PROGRAM_QUALITY_AND_INTAKE_REMEDIATION.md
- docs/PROGRAM_QUALITY_REMEDIATION_SEQUENCE.md
- docs/WO_FOUR_MODE_LOAD.md
- docs/decisions/CALIBRATION_POLICY_V1.md
- docs/decisions/TRAINING_PROGRESSION_LAYERS.md
- docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md
- docs/decisions/ROUTINE_MAJOR_SUPPORT_POLICY.md

Inspect the relevant source, migrations, tests, and exact diff. When a historical rule conflicts with the new work order, identify the conflict and determine whether the owner's new ruling is explicit and bounded. Do not silently choose one.

## 4. Audit Organization

Use one coordinator and at least two fresh reviewers. Do not share reviewer conclusions before both return.

### 4.1 Reviewer A — Program Semantics and Athlete Experience

Recommended model: Gemini 3.1 Pro at High effort.

Charter:

1. Reproduce every PQ-01 through PQ-14 matrix row from candidate code.
2. Inspect full generated four-week programs, not only unit-test assertions.
3. Verify that goal labels honestly match actual schedules and movement selections.
4. Verify the powerlifting/big-lift contract, including insufficient-capacity behavior.
5. Verify that bodybuilding is materially distinct and is not merely relabeled strength.
6. Verify intermediate, advanced, elite, beginner, rehab, minimal-equipment, and restricted cases.
7. Verify the exact Bodyweight Squat regression: no 3 × 10 at lower RPE becoming 3 × 8 at higher RPE without an external-load channel.
8. Verify plain-language RPE/RIR cues are understandable, do not equate pain with effort, and do not claim biometric measurement.
9. Verify the shortened intake still asks every decision needed to generate a safe and relevant plan.
10. Report any plan that is technically valid but implausible, misleading, trivial for the stated athlete, internally inconsistent, or unsupported by its explanation.

Reviewer A must list the exact generated movements, weekly sets/reps/RPE, load intent, warning/reason output, and input facts for every failed or questionable case.

### 4.2 Reviewer B — Code, Data, Safety, and Verification

Recommended model: Gemini 3.7 Flash at High effort.

Charter:

1. Verify branch, ancestry, frozen SHA, clean state, and exact diff.
2. Verify only a new append-only migration changes the three main-lift difficulty rows and all shipped migrations remain byte-identical.
3. Verify migration replay, upgrade, poison/self-heal expectations, and exact-row assertions.
4. Verify movement ranking runs after every equipment, tier, safety, capability, prior-experience, attestation, and context gate.
5. Mutation-test that a rejected movement cannot be re-admitted by goal ranking.
6. Verify explicit valid movement preferences retain precedence.
7. Verify onboarding persists nothing before Finish and still commits profile plus load preference atomically.
8. Verify demo-history preservation, beginner load restrictions, back navigation, and profile editability.
9. Verify actual bodyweight reps reach persistence separately from planned targets.
10. Verify unanswered actual RPE remains null and no new Health Connect/sensor access exists.
11. Re-run all required focused and full gates.
12. Inspect for unrelated edits, raw secrets, generated junk, release/signing changes, and root-master contamination.

Reviewer B must provide command lines, exit codes, and mutation outcomes.

### 4.3 Coordinator — Reconciliation

The coordinator must:

- keep the reviewers independent until both reports are final;
- reconcile disagreements against primary source and reproduced output;
- reject assertion-only evidence;
- distinguish defect, policy disagreement, improvement, and information;
- require a new freeze and fresh pair after any material code or claim change; and
- issue no push or release instruction.

## 5. Mandatory Adversarial Checks

At minimum attempt these counterexamples:

1. Intermediate plus full gym still receives Bodyweight Squat because of movement_id ordering.
2. Goal ranking bypasses an active safety exclusion.
3. A prior-experience declaration bypasses equipment, tier, or separate attestation.
4. A one-day short-session powerlifting plan silently drops a main lift.
5. A hypertrophy plan is identical to strength except for its title.
6. Hybrid still says generic strength plus engine while scheduling BJJ.
7. A bodyweight slot is routed as loaded because planned implement is missing or derived from supported-prefix order.
8. Working-week bodyweight reps fall while RPE rises.
9. Actual-reps edits reset during rerender or log the planned number.
10. Target RPE is stored as actual when untouched.
11. The shorter onboarding loses injury/mobility notes or commits partial state.
12. A hidden advanced default becomes uneditable.
13. The migration updates more than the exact three intended rows.
14. New copy implies medical advice or biometric RPE inference.

## 6. Verification Commands

Run from the frozen worktree:

1. git status --short --branch
2. git rev-parse HEAD
3. git rev-parse HEAD^{tree}
4. git merge-base --is-ancestor 965492e02184e07ddab20391740f10a694bd9149 HEAD
5. git diff --stat <REVIEW_BASE_SHA>..<FROZEN_CANDIDATE_SHA>
6. git diff --check <REVIEW_BASE_SHA>..<FROZEN_CANDIDATE_SHA>
7. npm run typecheck
8. npm run verify:migrations
9. npm run verify:db
10. npm run verify:blocks
11. npm run verify:store
12. npx jest --config apps/mobile/jest.config.js --runInBand --runTestsByPath apps/mobile/test/components/ProfileScreens.test.js apps/mobile/test/components/ProgramSetupScreen.test.js apps/mobile/test/components/SessionScreen.test.js
13. npm run verify:components
14. npm run verify:ci

Do not run verify:release. Do not treat the absence of physical C6 evidence as a defect in this development audit.

## 7. Audit Write Boundary

Reviewers are read-only. The coordinator may persist only:

- docs/audits/program-quality-remediation/team-preview/REVIEWER_A.md
- docs/audits/program-quality-remediation/team-preview/REVIEWER_B.md
- docs/audits/program-quality-remediation/team-preview/COORDINATOR_VERDICT.md
- docs/audits/program-quality-remediation/team-preview/REPRODUCTION_LOG.md

Do not edit product code, tests, migrations, ledger, work orders, executor evidence, package files, build files, or prior audit artifacts. Do not commit, push, tag, sign, build for distribution, or release.

## 8. Finding Format

Each finding must use:

### <ID> — <Severity> — <Title>

- **Class:** DEFECT | POLICY_CONFLICT | TEST_GAP | UX_RISK | INFO
- **File and line:** <PATH:LINE>
- **Matrix case:** <PQ-ID OR NONE>
- **Observed:** <DIRECTLY REPRODUCED FACT>
- **Expected:** <EXACT REQUIREMENT>
- **Impact:** <ATHLETE OR SYSTEM CONSEQUENCE>
- **Evidence:** <COMMAND, OUTPUT, OR GENERATED PLAN>
- **Minimal remediation:** <BOUNDED FIX>
- **Blocking:** YES | NO

Severity is Critical, Major, Minor, or Info. A preference is not a defect unless it violates a cited requirement or creates a concrete safety/correctness failure.

## 9. Verdict Rules

Each reviewer returns exactly one:

- APPROVE
- APPROVE_WITH_NON_BLOCKING_FINDINGS
- REQUEST_CHANGES
- UNABLE_TO_VERIFY

The coordinator returns exactly:

    AUDIT VERDICT: APPROVED | REQUEST_CHANGES | UNABLE_TO_VERIFY
    FROZEN SHA: <SHA>
    REVIEWER A: <VERDICT>
    REVIEWER B: <VERDICT>
    BLOCKING FINDINGS: <COUNT>
    NON-BLOCKING FINDINGS: <COUNT>
    FULL VERIFY REPRODUCED: YES | NO
    MATRIX REPRODUCED: YES | NO
    RELEASE / PUSH AUTHORITY: NOT GRANTED

Approval requires:

- both reviewers examined the same frozen SHA;
- no Critical or Major finding remains;
- every acceptance matrix case was reproduced;
- all required gates pass;
- no safety/access boundary weakened;
- no biometric RPE implementation exists; and
- all claims are bounded to the development candidate.

## 10. Ready-to-Paste Team Preview Prompt

    Start a fresh Team Preview audit in:
    C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation

    Read docs/HANDOVER_TEAM_PREVIEW_PROGRAM_QUALITY_AUDIT.md completely and verify that it has no unresolved angle-bracket placeholders. Audit the exact frozen SHA named there.

    Use two independent reviewers without sharing conclusions:
    - Reviewer A: program semantics and athlete experience, preferably Gemini 3.1 Pro at High.
    - Reviewer B: code, data, safety, and verification, preferably Gemini 3.7 Flash at High.

    Treat executor evidence as untrusted. Reproduce all PQ-01 through PQ-14 cases, run the required gates, perform the mandatory adversarial checks, and use the exact finding and verdict schemas. Reviewers are read-only; the coordinator may write only the four audit artifacts authorized in section 7. Do not modify the candidate, commit, push, tag, sign, build for distribution, or release. Do not aim for approval; report what the evidence supports.
