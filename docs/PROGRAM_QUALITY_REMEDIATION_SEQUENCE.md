# Program Quality Remediation — Execution Sequence

## 1. Status

- **Status:** READY FOR OWNER DISPATCH.
- **Working directory:** C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation
- **Branch:** codex/program-quality-remediation
- **Required product ancestor:** 965492e02184e07ddab20391740f10a694bd9149
- **Remote state at preparation:** origin/codex/program-quality-remediation and origin/codex/state-c-release-readiness both point to the required product ancestor.
- **Merge decision:** do not merge Opus again. Its release work is already present byte-for-byte at the required product ancestor.
- **Protected checkout:** do not modify the dirty root master checkout.

## 2. Owner Decisions Applied

This sequence treats the owner's device feedback as product authority:

1. First-run questions are too burdensome and must be reduced.
2. The selected goal must visibly control the generated program.
3. The existing strength goal becomes an honest big-lift/powerlifting path.
4. The existing hypertrophy goal becomes an honest bodybuilding path.
5. Intermediate and higher athletes must not receive Bodyweight Squat by default when a compatible loaded squat is safely available.
6. Bodyweight work remains valid for beginners, rehab/return-to-training, minimal equipment, explicit athlete choice, or a recorded safety/capability restriction.
7. Athletes must be able to enter actual reps for bodyweight sets.
8. RPE must be explained through simpler subjective cues while remaining optional evidence.
9. Heart rate, SpO2, HRV, stress, or other biometrics must not be converted into RPE in this implementation.

## 3. Order of Work

### 3.1 Phase A — Integrated Product Remediation

Execute:

- docs/WORKORDER_PROGRAM_QUALITY_AND_INTAKE_REMEDIATION.md

Use one implementation agent in the existing program-quality-remediation worktree. The executor may create local commits but must stop before push, tag, release, signing, or a new APK claim.

### 3.2 Phase B — Freeze and Independent Team Preview Audit

After Phase A is green and committed:

- replace every placeholder in docs/HANDOVER_TEAM_PREVIEW_PROGRAM_QUALITY_AUDIT.md;
- freeze the candidate commit;
- give the completed handover to a fresh audit coordinator;
- require independent semantic and implementation reviewers; and
- do not let the implementation agent grade its own work.

Any material finding invalidates the freeze. Return it to the executor, rerun every required gate, freeze a new commit, and commission fresh reviewers.

### 3.3 Phase C — Advanced Biometric RPE Discovery

Only after Phase A has frozen, separately execute:

- docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md

This phase produces research, architecture, validation, privacy, and go/no-go documents only. It must not add a biometric RPE feature or modify prescriptions.

## 4. Recommended Models and Effort

### 4.1 Implementation

- **Model:** Gemini 3.7 Flash.
- **Thinking/effort:** High.
- **Reason:** use the current general agentic coding model for the bounded implementation, tests, and repository verification.

### 4.2 Independent Audit

- **Audit coordinator and semantic reviewer:** Gemini 3.1 Pro, High.
- **Mechanical/code reviewer:** Gemini 3.7 Flash, High.
- **Reason:** use a separate, reasoning-focused model for product semantics and a current coding model for reproduction, diff, migration, and test checks. Independence matters more than having both reviewers use the same model.

If mixed models are unavailable, use Gemini 3.7 Flash at High for both roles in separate fresh contexts. Never reuse the executor context as a reviewer.

### 4.3 Biometric Discovery

- **Lead:** Gemini 3.1 Pro, High.
- **Technical feasibility checker:** Gemini 3.7 Flash, High.
- **Reason:** the task is primarily evidence synthesis, risk analysis, and architecture rather than code production.

## 5. Ready-to-Paste Executor Prompt

    You are the bounded implementation executor for Athlete App program-quality remediation.

    Work only in:
    C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation

    Execute docs/WORKORDER_PROGRAM_QUALITY_AND_INTAKE_REMEDIATION.md in full at High effort.
    Start at W0, verify the branch and required product ancestor, and make the exact prompt in this message your first append-only PROMPT_LEDGER.md write. Do not merge, rebase, or touch the root master checkout. Use tests first, preserve every safety/capability/equipment/attestation boundary, and stop before push, tag, signing, release, or APK distribution.

    At completion, give me:
    1. the frozen commit SHA;
    2. exact files changed;
    3. exact test commands and exit codes;
    4. the generated-program acceptance matrix;
    5. every remaining limitation or owner decision;
    6. the completed auditor handover from docs/HANDOVER_TEAM_PREVIEW_PROGRAM_QUALITY_AUDIT.md; and
    7. a truthful READY_FOR_INDEPENDENT_AUDIT or NOT_READY verdict.

## 6. Stop Conditions

Stop and report rather than guessing if:

- the worktree contains unknown changes at W0;
- 965492e02184e07ddab20391740f10a694bd9149 is not an ancestor;
- the next migration slot is ambiguous;
- a requested behavior would weaken equipment, injury/niggle, capability, prior-experience, or attestation gates;
- the proposed program cannot meet the strength anchor contract within the selected days/time;
- a new numerical training coefficient lacks an explicit decision record and tests;
- verification fails after bounded remediation; or
- the audit reports a material unresolved finding.

## 7. Definition of Done

The sequence is complete only when:

1. the implementation candidate satisfies its full acceptance matrix;
2. all required local gates pass;
3. two independent reviewers approve the same frozen commit;
4. no material audit finding remains open;
5. the root master checkout remains untouched; and
6. the owner returns the frozen, audited candidate for final push/build authorization.
