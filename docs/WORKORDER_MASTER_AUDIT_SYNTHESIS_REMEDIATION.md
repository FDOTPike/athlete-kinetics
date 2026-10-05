# Work order — Opus execution: master audit synthesis remediation and release-state reconciliation

## 0. Control Record

### 0.1 Status

- **Execution status:** READY FOR A SEPARATE TASK; NOT EXECUTED BY THIS WORK ORDER.
- **Prepared:** 2026-08-30, Australia/Sydney.
- **Executor:** Claude Code Opus in a new task, acting as the bounded document executioner defined
  by repository-level `CLAUDE.md`.
- **Working directory:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\progression-evidence-remediation`.
- **Integrity mode:** development.
- **Primary deliverable:** `MASTER_AUDIT_SYNTHESIS.md`.
- **Decision on the launched synthesis:** **REQUEST CHANGES**. It is useful source material, but it is not yet an authoritative statement of the current release state.
- **Release decision:** **NO-GO / PUSH BLOCKED** until the exact release candidate passes the owner-assisted C6 checkpoint on an owner-authorized physical 4 GB device and the code-review findings in Section 3.5 are resolved or explicitly dispositioned.
- **Device timing:** C6 may be run later. Lack of a 4 GB device does not block this documentation-remediation work.

### 0.2 Governing Instructions

The executor must read these files before taking any task action:

- `CLAUDE.md`;
- `CHIEF_ORCHESTRATOR_MANDATE_SOL.md`;
- this work order in full;
- `MASTER_AUDIT_SYNTHESIS.md`;
- `.agents/ORIGINAL_REQUEST.md`;
- `.agents/AUDIT_REPORT.md`;
- `.agents/orchestrator/GATE_STATUS.md`; and
- the exact owner-ratified C1 docket at `claude/rc-48719b0` commit `a80f955`.

The prompt-ledger protocol remains binding. The first successful repository write in the new task must append the user's prompt verbatim to `PROMPT_LEDGER.md`. The output is completed only after the work is verified.

### 0.3 Authorized Outcome

Produce a corrected, machine-readable audit synthesis that:

- distinguishes committed state, dirty working-tree state, and parallel-branch state;
- synthesizes the historical audit corpus without treating generated reviewer prose as primary authority;
- represents Task U3, Option C, Migration 059, and the Claude C1–C5 closeout at their exact revisions;
- contains a strict outstanding-work ledger made only from admissible source statements;
- separates open work from closed, superseded, parked, owner-only, release-gate, and external-roadmap material;
- records C6 as deferred and blocking push approval without fabricating device evidence; and
- receives two independent, evidence-backed review verdicts.

This is a documentation and audit task. It does not authorize product-code remediation, migration changes, APK rebuilding, device testing, committing, merging, or pushing.

### 0.4 Opus Execution Role

Opus executes this work order directly. It does not inherit Sol's orchestrator authority and may not
act as the owner, ratifier, release approver, or its own independent reviewer.

- **Primary role:** `DOCUMENT_EXECUTOR` under `CLAUDE.md`.
- **Allowed judgment:** source classification, mechanical citation checks, evidence reconciliation,
  and drafting within this work order's explicit rules.
- **Forbidden judgment:** inventing policy, widening scope, resolving owner conflicts, weakening C6,
  or converting an unresolved finding into an approval.
- **Review delegation:** W5 authorizes exactly two independent read-only document-review subagents.
  Opus owns the correction loop but may not pre-write their verdicts or edit their handoffs.
- **Capability fallback:** if the Claude Code environment cannot provide two genuinely independent
  reviewers, Opus must finish W0–W4, return `PENDING_EXTERNAL_REVIEW`, and stop. It may not simulate
  independence by reviewing its own draft twice.

## 1. Starting-State Matrix

### 1.1 State A — Audited Base Commit

- **Branch:** `codex/progression-evidence-remediation`.
- **Commit:** `48719b07988ad30d255b0fed37f45ed5db49c935`.
- **Commit subject:** `docs(mandate): Sol becomes Chief Orchestrator; supersede the auditor mandate`.
- **Canonical migration head at this commit:** Migration 058.
- **Task U3 status at this commit:** the new `SuspensionCard.tsx`, `SuspensionSheet.tsx`, and `SuspensionUI.test.js` files are absent from the commit.

The current synthesis incorrectly says commit `48719b0` contains Task U3 UI at `MASTER_AUDIT_SYNTHESIS.md:367`. Correct this. A claim about committed HEAD may cite only content reachable from that commit.

### 1.2 State B — Dirty Task U3 Overlay

At work-order preparation time, the target worktree contained pre-existing, uncommitted Task U3 changes:

- modified `apps/mobile/src/screens/BlockScreen.tsx`;
- modified `apps/mobile/src/screens/ProfileScreen.tsx`;
- modified `apps/mobile/src/state/useStore.ts`;
- untracked `apps/mobile/src/components/SuspensionCard.tsx`;
- untracked `apps/mobile/src/components/SuspensionSheet.tsx`;
- untracked `apps/mobile/test/components/SuspensionUI.test.js`;
- untracked empirical challenge scripts; and
- untracked `.agents/` teamwork artifacts and `MASTER_AUDIT_SYNTHESIS.md`.

These files may be described as a dated working-tree overlay only. They must not be described as committed, merged, released, or contained in `48719b0`. Capture a fresh `git status --short`, content hashes, and line counts before citing them because they are mutable.

### 1.3 State C — Claude C1–C5 Closeout Commit

- **Branch:** `claude/rc-48719b0`.
- **Audited closeout commit:** `34f91ffe548a0b9e51db863ffc6fad993619f940`.
- **Relevant local commits:**
  - `a80f955` — C1 decision docket and owner rulings;
  - `f3ebab3` — Migration 059, suspension state, load intent, and audit immutability;
  - `0cd8db9` — suspension progression freeze and planned-load routing;
  - `34f91ff` — ledger record for the claimed C0–C5 result.
- **Claimed result in `PROMPT_LEDGER.md` at `34f91ff`:** C1–C5 complete; C6/C7 open and owner-gated.

Use the immutable commit `34f91ff`, not the current filesystem contents of the Claude worktree. At work-order preparation time that worktree had additional uncommitted Migration 060/KineStrike changes. Those later dirty changes are outside this audit unless the owner explicitly expands scope.

### 1.4 State D — External Parent-Root Document

`KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md` exists in the parent checkout, not inside the target worktree. It must not be counted as an in-worktree repository document. Either:

- exclude it from the repository inventory and list it in an external-reference appendix; or
- include it only as an explicitly external source with absolute path, SHA-256, line count, and snapshot date.

Do not use a parent-root document silently through fallback path resolution.

## 2. Source-Admissibility Contract

### 2.1 Authority Tiers

Assign every source exactly one tier in the source manifest:

| Tier | Source class | Permitted use |
|---|---|---|
| **T0** | Owner instructions, prompt-ledger entries, ratified decision records, governing mandate | Binding rulings, scope, release gates, and owner-only decisions |
| **T1** | Tracked historical audit reports and handovers at a named commit | Historical findings, invariants, and explicitly recorded open work |
| **T2** | Exact-revision branch documents, including `a80f955`–`34f91ff` | Latest Claude execution claims and branch-specific decisions/findings |
| **T3** | Generated teamwork handoffs and reviewer reports under `.agents/` | Verification evidence and review history only |
| **T4** | Runtime code, tests, schemas, command output, and Git metadata | Verification of an already documented claim; never a source of newly invented ledger work |
| **T5** | Files outside the target worktree, including the parent-root KineStrike report | External context only, clearly labelled and hashed |

### 2.2 Outstanding-Work Admission Rule

An item may enter the strict outstanding-work ledger only when all of the following are true:

1. A T0, T1, or T2 source explicitly states the work, defect, unresolved decision, exception, or next step.
2. The cited line span semantically entails the ledger statement, not merely shares keywords.
3. The source is tied to an exact path and revision or snapshot hash.
4. A newer source has not closed, retracted, or superseded the item.
5. The item is classified `OPEN`, `PARKED`, `OWNER_ONLY`, or `RELEASE_GATE`.

T3–T5 material may corroborate an item but may not originate it. A generated reviewer saying that an item is open does not make it open unless the reviewer cites an admissible underlying source.

### 2.3 Prohibited Inference

Do not scan the codebase to create a general technical-debt list. Code inspection is allowed only to:

- verify claims already present in admissible documents;
- reconcile the exact five pre-documented closeout findings in Section 3.5; and
- prove whether a feature exists at a named revision.

If code inspection reveals a different possible defect, record it as `OUTSIDE_SCOPE_OBSERVATION` in the task handback and omit it from `MASTER_AUDIT_SYNTHESIS.md` unless the owner authorizes a separate audit.

### 2.4 Supersession Rule

Where sources conflict, use this order:

1. later owner-ratified T0 decision;
2. later exact-revision T2 audit or handback;
3. later tracked T1 audit or handover;
4. older source retained as history; and
5. T3–T5 corroboration only.

Never silently delete an older statement. Move it to the closed/superseded section and name the source that superseded it.

## 3. Remediation Ledger

### 3.1 WR-01 — Separate Repository States

- **Observed defect:** `MASTER_AUDIT_SYNTHESIS.md:9` calls the “current repository state” 100% green, while its evidence includes untracked Task U3 files and untracked challenge scripts. Line 367 says committed `48719b0` contains Task U3 UI, which it does not.
- **Required remediation:** replace the single-state narrative with a state matrix for State A, State B, State C, and State D from Section 1.
- **Done when:** every implementation, migration, test-count, and gate claim names its exact commit or working-tree snapshot; no evidence crosses state boundaries.

### 3.2 WR-02 — Replace the “Complete 60-Document Repository Inventory” Claim

- **Observed defect:** the inventory combines tracked historical files, newly generated `.agents/` artifacts, the untracked synthesis itself, and an external parent-root document, then calls the result a complete repository inventory.
- **Required remediation:** create `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` with stable IDs and these fields: `source_id`, `path`, `tier`, `boundary`, `tracked_status`, `revision_or_sha256`, `line_count`, `source_date`, `included_sections`, and `admissible_for_open_work`.
- **Done when:** totals are reproducible by tier and boundary; “complete” is used only with an explicit search rule and exclusion list.

### 3.3 WR-03 — Demote Generated Teamwork Handoffs to Verification Evidence

- **Observed defect:** the synthesis cites `.agents/sentinel/handoff.md` and victory/reviewer handoffs as authority for Task U3 completion and open work. Those handoffs were generated during the same launched run and are untracked.
- **Required remediation:** cite pre-existing specifications, decisions, exact source snapshots, and exact test snapshots for substantive claims. Retain teamwork handoffs only in a verification-history section.
- **Done when:** no outstanding-work item depends solely on a T3 source, and no circular “agent certified the report because another agent said it was certified” chain remains.

### 3.4 WR-04 — Include the Latest Claude Closeout as a Separate Branch State

- **Observed defect:** the synthesis mentions that `claude/rc-48719b0` exists but does not synthesize the four requested commits, owner rulings, Migration 059, or the C6/C7 owner gate.
- **Required remediation:** add a dedicated latest-execution subsection covering `a80f955`, `f3ebab3`, `0cd8db9`, and `34f91ff`, based on `git show` at exact revisions.
- **Done when:** S1–S6, L1, L2, M1, and A1 are summarized accurately; Migration 058 remains the State A head while Migration 059 is correctly scoped to State C; C6/C7 are explicitly open.

### 3.5 WR-05 — Reconcile Five Pre-Documented Closeout Findings

The next task is not authorized to discover additional debt. It must independently confirm or refute only these five findings against commit `34f91ff` and record the result in `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` before using them in the synthesis:

1. **L1 athlete-choice gap.** The ratified docket requires prospective per-slot intent and athlete selection for ambiguous mixed movements. At `34f91ff`, `plannedImplementFor` declares only a singleton `supportedPrefixes` value and leaves multi-implement movements undeclared; generation persists this derived result. Confirm against `apps/mobile/src/state/useStore.ts:1821-1834`, `:3040-3055`, and `:3335-3354`, plus `apps/mobile/test/components/SuspensionLifecycle.test.js:335-392` at `34f91ff`. Determine whether any reachable UI or program input actually captures an athlete's ambiguous per-slot selection.
2. **Reset lifecycle gap.** `PER_ATHLETE_RESET` omits suspension state, while `resetTrainingData` neither deletes `suspension_episode` nor refreshes suspension after the wipe. Confirm against `apps/mobile/src/state/useStore.ts:2049-2060` and `:6071-6157` at `34f91ff`. Test the whole-athlete reset and Coach Mode file-swap lifecycle before accepting or rejecting this finding.
3. **Migration 059 immutability gap and missing behavior coverage.** Migration 059 protects selected updates and deletion of a closed base episode, but it does not visibly prohibit all update/delete mutations of the new sidecars. Confirm the exact allowed mutations against `packages/core-db/src/schema/059_suspension_state_and_load_intent.sql:92-160` and verify whether dedicated 059 behavior tests exist. Do not equate sentinel existence with behavioral immutability.
4. **Bodyweight-fatigue reachability gap.** `bodyweightDominant` is computed by requiring every member of `input.movements` to be bodyweight. Confirm whether production callers pass the entire mixed catalogue, making the branch false in real generation, against `packages/inference/src/blockGenerator.ts:665-682` and the store's generator input construction at `apps/mobile/src/state/useStore.ts:3040-3070` at `34f91ff`.
5. **Resume error-handling gap.** Suspension entry catches and renders action-scoped errors, but resume directly invokes `endSuspension(Date.now())`. Confirm against `apps/mobile/src/screens/BlockScreen.tsx:471-514` at `34f91ff` and decide whether a database error can escape without an accessible, action-scoped message.

For each finding, the audit addendum must record `CONFIRMED`, `REFUTED`, or `PARTIALLY_CONFIRMED`, the exact evidence, impact, and the narrowest remediation. A finding may enter the strict outstanding ledger only if the completed addendum explicitly records it as open. Do not edit product code under this work order.

### 3.6 WR-06 — Correct Task U3 Status

- **Observed defect:** the synthesis represents Task U3 as complete without distinguishing its uncommitted target-worktree overlay from the Claude branch's different UI implementation.
- **Required remediation:** document each Task U3 implementation separately. State B uses `SuspensionCard.tsx`/`SuspensionSheet.tsx`; State C uses the `BlockScreen.tsx` inline flow at exact commit `34f91ff` unless exact revision evidence proves otherwise.
- **Done when:** component names, screen wiring, tests, and design-token claims are tied to the state where they actually exist.

### 3.7 WR-07 — Reclassify the Existing 29-Item Ledger

- **Observed defect:** the current “outstanding work” section mixes open defects, parked roadmaps, ratified constraints, completed withdrawals, historical restatements, release gates, and external hardware work.
- **Required remediation:** assess every existing item using exactly one status: `OPEN`, `PARKED`, `OWNER_ONLY`, `RELEASE_GATE`, `CLOSED`, `SUPERSEDED`, `RETRACTED`, or `EXTERNAL`.
- **Done when:** only the first four statuses remain in the strict outstanding-work ledger. The other statuses move to a separate closed/superseded/external register with source citations preserved.

At minimum, explicitly re-evaluate:

- item 6, which describes quarantined push-up force values rather than executable work;
- item 8, which describes a completed withdrawal;
- item 12, whose Migration 057 maintenance wording may be stale at newer revisions;
- item 24, whose Pixel 9 Pro functional check does not satisfy C6;
- item 25, whose memory language must use the current exact contract and owner-review state; and
- item 29, which is an external KineStrike roadmap item rather than Athlete App release work.

### 3.8 WR-08 — Enforce Source Dates and Supersession

- **Observed defect:** older next steps are presented as current even where later owner rulings or branch work may have completed, changed, or superseded them.
- **Required remediation:** add `source_date`, `as_of_revision`, and `superseded_by` to every ledger record.
- **Done when:** an old open item cannot remain current merely because its citation still resolves.

### 3.9 WR-09 — Upgrade Citation Verification from Bounds to Entailment

- **Observed defect:** the launched verifiers primarily prove path existence, line bounds, heading shape, and selected keyword/text matches. That is necessary but not sufficient to certify zero hallucination.
- **Required remediation:** for every ledger item, create a claim-to-evidence row containing the ledger claim, exact source text span, status inference, and reviewer verdict.
- **Done when:** Reviewer A independently reads each cited span and certifies semantic entailment and current status, not merely that the line numbers exist.

### 3.10 WR-10 — Correct Gate and Test Evidence

- **Observed defect:** “100% green” claims do not identify the tree fingerprint from which the commands ran, and some commands rely on untracked scripts.
- **Required remediation:** every gate row must include `state_id`, `commit`, `dirty_fingerprint`, `command`, `executed_at`, `exit_code`, `observed_count`, and `evidence_locator`. Historical handback claims must be labelled `REPORTED`, while commands rerun by the next task may be labelled `OBSERVED`.
- **Done when:** a passing command cannot be used to certify a different commit or overlay. Do not rerun the full product suite unless needed to verify a report claim; this is not a release-gate execution task.

### 3.11 WR-11 — Record the Memory Contract and C6 Honestly

- **Observed defect:** the current synthesis uses the older shorthand “450 MB / 512 MiB ceiling” and treats physical-device work as a generic future check.
- **Required remediation:** quote the current exact thresholds from the authoritative release-candidate source and distinguish the preferred `450,000,000 B` target from the hard `536,870,912 B` limit. Record that the current envelope is in the review band if that remains the authoritative state.
- **Done when:** C6 is `RELEASE_GATE — DEFERRED`, the exact APK/device/evidence requirements are named, Pixel 9 Pro evidence is not accepted as a 4 GB substitute, and no release/push approval is inferred.

### 3.12 WR-12 — Normalize the Machine-Readable Schema

- **Observed defect:** the current report is readable but does not provide stable record IDs, source authority, supersession, or state provenance for downstream parsing.
- **Required remediation:** use the schema in Section 5 and stable IDs throughout.
- **Done when:** headings pass strict H1 → H2 → H3 validation, no H4+ headings exist, every table has a fixed column contract, and every ledger record has a unique ID.

### 3.13 WR-13 — Obtain Two Truly Independent Reviews

- **Reviewer A — ledger provenance:** reads the admissible sources independently, verifies every ledger claim and status, and returns `APPROVE` only with zero unsupported or stale-current items.
- **Reviewer B — progression/UI and state provenance:** independently verifies Option C, RR-04, Task U3 State B, Claude State C, Migration 058/059 separation, owner rulings, and C6 status.
- **Independence rule:** neither reviewer may use another agent's handoff as the sole evidence for a verdict. Neither reviewer edits the synthesis.
- **Done when:** both handoffs contain a discrepancy table, commands or source locators, and an unambiguous `APPROVE` or `REQUEST_CHANGES` verdict. Any `REQUEST_CHANGES` returns the synthesis to remediation and requires a fresh review.
- **Opus fallback:** absent independent-subagent capability, record both reviews as
  `PENDING_EXTERNAL_REVIEW`; do not issue `AUDIT SYNTHESIS: APPROVED`.

## 4. Execution Phases

### 4.1 W0 — Establish and Record the Exact State

1. Append the new task prompt verbatim to `PROMPT_LEDGER.md` before any other write.
2. Record `git status --short --branch`, `git rev-parse HEAD`, `git worktree list --porcelain`, and the four Claude commit identities.
3. Confirm that `MASTER_AUDIT_SYNTHESIS.md` and `.agents/` are tracked or untracked.
4. Hash all mutable inputs that will be cited.
5. Preserve every pre-existing dirty file. Do not normalize or stage unrelated work.

**W0 handback:** exact state matrix and a list of files the task is permitted to edit.

### 4.2 W1 — Build the Source Manifest

1. Define the audit/handover discovery pattern and exclusions before counting files.
2. Inventory T0–T5 sources separately.
3. Record line counts and hashes/revisions.
4. Mark whether each source is admissible for the open-work ledger.
5. Identify at least five distinct historical audit or handover documents that will be substantively synthesized.

**W1 handback:** `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` and reproducible totals by tier.

### 4.3 W2 — Produce the Claude Closeout Audit Addendum

1. Read the C1 docket at `a80f955` and the claimed result at `34f91ff`.
2. Confirm or refute only the five findings in Section 3.5.
3. Use `git show <revision>:<path>` or another immutable-revision read. Do not rely on the dirty Claude worktree.
4. Record what the existing C1–C5 gates did and did not prove.
5. Keep C6/C7 open; do not attempt a hardware run.

**W2 handback:** `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` with a bounded verdict and no product-code changes.

### 4.4 W3 — Rebuild the Synthesis

1. Preserve valid historical content and citations where their state and status remain correct.
2. Replace the executive “100% green current repository” claim with the state matrix.
3. Rebuild the source catalog from W1.
4. Add the exact-revision Claude closeout section from W2.
5. Reclassify the 29-item ledger under Section 3.7.
6. Separate C6 and other release gates from code defects and parked roadmaps.
7. Move generated teamwork findings to verification history.
8. Add limitations and explicit non-claims.

**W3 handback:** corrected `MASTER_AUDIT_SYNTHESIS.md` conforming to Section 5.

### 4.5 W4 — Mechanical Verification

Verify at minimum:

- exactly one H1;
- only H1, H2, and H3 headings;
- no heading-level jumps;
- unique document, state, and ledger IDs;
- every ledger item has at least one admissible exact citation;
- every cited path/revision exists;
- every line range is within bounds at the cited snapshot;
- no T3-only or T5-only ledger item;
- no `OPEN` item superseded by a newer source;
- no claim that Task U3 is committed in `48719b0`;
- no claim that Migration 059 exists in State A;
- no claim that C6 passed; and
- `git diff --check` limited to authorized documentation files, with any prompt-ledger verbatim whitespace reported separately rather than concealed.

**W4 handback:** a verification matrix with commands, outputs, and failures.

### 4.6 W5 — Independent Reviews

Run Reviewer A and Reviewer B from Section 3.13 in parallel after W4 is green. Use two separate,
read-only Claude subagents if that capability exists. Provide each reviewer the governing request,
source manifest, corrected synthesis, and exact revision locators; do not provide the other
reviewer's conclusion or Opus's desired verdict. If independent subagents are unavailable, record
`PENDING_EXTERNAL_REVIEW` and stop at W5 without self-approval.

**W5 handback:** two independent handoffs. Both must approve; otherwise return to W3 and repeat W4–W5.

### 4.7 W6 — Final Handback and Ledger Completion

1. Re-run W4 after the final review-driven edit.
2. Complete the prompt-ledger output with exact changed files, commands, verdicts, and limitations.
3. Return one line of audit status and one separate line of release/push status.
4. Do not commit or push.

Required status form:

```text
AUDIT SYNTHESIS: APPROVED | REQUEST CHANGES
RELEASE/PUSH: NO-GO — C6 DEFERRED | NO-GO — CODE FINDINGS OPEN | ELIGIBLE FOR OWNER PUSH AUTHORIZATION
```

The last form is permitted only after separate evidence proves C6 and all other release gates for the exact candidate. This work order alone cannot produce it.

## 5. Required Synthesis Schema

### 5.1 Heading Order

The final report must use this deterministic hierarchy and no H4+ headings:

```text
# MASTER AUDIT SYNTHESIS
## 0. Document Control
### 0.1 Scope and Non-Claims
### 0.2 Repository State Matrix
### 0.3 Source Authority Rules
## 1. Source Corpus
### 1.1 Admissible Historical Sources
### 1.2 Generated Verification Artifacts
### 1.3 External References
## 2. Historical Audit Synthesis
### 2.1 Verified Historical State
### 2.2 Architectural Rulings and Invariants
### 2.3 Science Quarantine
## 3. Latest Progression and Suspension Execution
### 3.1 Option C and RR-04
### 3.2 Task U3 Working-Tree Overlay
### 3.3 Claude C1–C5 Branch at 34f91ff
### 3.4 C6 and C7 Release Status
## 4. Strict Outstanding Work Ledger
### 4.1 Open Defects and Tasks
### 4.2 Parked and Owner-Only Decisions
### 4.3 Release Gates
## 5. Closed, Superseded, Retracted, and External Register
### 5.1 Closed and Superseded
### 5.2 Retracted Claims
### 5.3 External Roadmaps
## 6. Verification Record
### 6.1 Mechanical Verification
### 6.2 Independent Review Verdicts
### 6.3 Limitations and Reproduction
```

### 5.2 Source Citation Format

Use one of these exact formats:

```text
[Source: <relative-path>@<full-commit>, lines <start>-<end>]
[Working-tree source: <relative-path>; SHA-256 <hash>; lines <start>-<end>; captured <ISO-8601>]
[External source: <absolute-path>; SHA-256 <hash>; lines <start>-<end>; captured <ISO-8601>]
```

Do not cite a branch name without a commit. Do not cite a mutable untracked file without a hash and capture time.

### 5.3 Outstanding-Work Record Format

Every outstanding-work item must use a table row with these columns:

| Field | Requirement |
|---|---|
| `work_id` | Stable ID such as `OW-001` |
| `status` | `OPEN`, `PARKED`, `OWNER_ONLY`, or `RELEASE_GATE` |
| `statement` | Narrow source-entailing action, defect, decision, or gate |
| `state_scope` | State A, B, C, or cross-state |
| `source_date` | Date of the source statement |
| `citation` | Exact admissible citation |
| `supersedes` | Older ID/citation or `NONE` |
| `verification` | `DOCUMENT_ONLY`, `CODE_CONFIRMED`, `TEST_CONFIRMED`, or `OWNER_EVIDENCE_REQUIRED` |
| `release_effect` | `BLOCKING`, `NON_BLOCKING`, or `OUTSIDE_RELEASE` |

No multi-action bundle may hide several independent tasks in one row. Split independently closable actions.

### 5.4 Claim Language

Use these terms consistently:

- `VERIFIED AT <revision>` for evidence directly checked at an immutable revision;
- `OBSERVED IN WORKING-TREE SNAPSHOT` for hashed dirty-state evidence;
- `REPORTED` for a historical handback claim not rerun by the current task;
- `RATIFIED` only for an owner decision;
- `DEFERRED` for a required checkpoint intentionally not run; and
- `UNKNOWN` where evidence is missing.

Do not use “complete,” “authoritative,” “100% green,” “release ready,” or “victory confirmed” without naming the exact state, evidence boundary, and unresolved gates.

## 6. Write Boundary

### 6.1 Authorized Files

The new task may edit only:

- `PROMPT_LEDGER.md` by append-only entry/output completion;
- `MASTER_AUDIT_SYNTHESIS.md`;
- `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md`;
- `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`; and
- new reviewer handoffs under a dedicated `.agents/audit-synthesis-remediation/` directory if the orchestration system requires files.

### 6.2 Forbidden Writes

Do not modify:

- `apps/`, `packages/`, `tools/`, `scripts/`, `package.json`, lockfiles, migrations, or tests;
- any historical audit, handover, decision, or research artifact used as a source;
- the Claude worktree or its branch;
- the Task U3 overlay except to read and hash it;
- Android/iOS build outputs, memory evidence, or device records; or
- Git branches, commits, tags, remotes, indexes, or stashes.

If a correct synthesis would require changing a source document, record the source defect and stop. Do not repair history under this work order.

## 7. Acceptance Gates

### 7.1 Content Gates

- At least five distinct T0–T2 historical audit or handover documents are substantively synthesized.
- Every outstanding item has an exact admissible citation and an explicit current-status derivation.
- All major Option C, RR-04, Task U3, S1–S6, L1, L2, M1, and A1 rulings are accurately represented at their exact states.
- The Claude four-commit closeout is included with the bounded W2 audit verdict.
- C6 is shown as deferred and release-blocking; the absence of a 4 GB device is not misreported as a failed product test.
- No external KineStrike item is presented as in-worktree Athlete App release work.

### 7.2 Integrity Gates

- Zero unsupported ledger items.
- Zero stale items misclassified as current.
- Zero state-provenance conflation.
- Zero invalid paths, revisions, hashes, or line bounds.
- Zero T3-only/T5-only outstanding-work sources.
- Zero product-code or historical-source changes.

### 7.3 Review Gates

- Reviewer A: `APPROVE` with zero ledger-provenance discrepancies.
- Reviewer B: `APPROVE` with zero progression/UI/state discrepancies.
- Final mechanical verification: all checks pass after the last edit.
- Any failed gate means `AUDIT SYNTHESIS: REQUEST CHANGES`.

## 8. Stop Conditions

### 8.1 Mandatory Stops

Stop and report rather than assume if:

- the prompt-ledger first-write protocol cannot be honored;
- a pre-existing dirty file would need to be overwritten or normalized;
- a source's revision, snapshot hash, or repository boundary cannot be established;
- two owner-ratified sources conflict and priority cannot be resolved mechanically;
- the outstanding ledger would require a new codebase debt scan;
- product code, a migration, a test, a build, or a historical source would need editing;
- a reviewer returns `REQUEST_CHANGES` and the discrepancy cannot be fixed within the authorized files;
- a required physical device, owner review, signing/sealing authority, or C6 evidence is unavailable; or
- commit, merge, push, release approval, or store submission would be required.

### 8.2 Honest Deferred Outcome

The correct handback while no authorized 4 GB device is available is:

```text
AUDIT SYNTHESIS: APPROVED
RELEASE/PUSH: NO-GO — C6 DEFERRED
```

This is a successful documentation-remediation outcome. Do not weaken C6, substitute a higher-memory device, or fabricate an evidence packet to produce a green release verdict.

## 9. Paste-Ready Prompt for the Separate Task

### 9.1 New-Task Prompt

```text
Work in C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\progression-evidence-remediation.

You are Claude Code Opus acting as this repository's bounded DOCUMENT_EXECUTOR. Read CLAUDE.md,
CHIEF_ORCHESTRATOR_MANDATE_SOL.md, and
docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md in full, then execute that work order from W0
through W6. Do not assume Sol's orchestrator authority. Follow the work order over generic initiative.

At W5, use exactly two independent read-only document-review subagents: Reviewer A for strict
outstanding-ledger provenance and Reviewer B for Option C, Task U3, Claude commit 34f91ff, and
repository-state accuracy. Do not prime either reviewer with a desired verdict and do not edit their
handoffs. If independent subagents are unavailable, return PENDING_EXTERNAL_REVIEW rather than
self-certifying.

Preserve every pre-existing dirty file. The first successful repository write must append this
prompt verbatim to PROMPT_LEDGER.md. Restrict writes to the work order's authorized documentation
files. Do not edit product code, migrations, tests, historical sources, or the Claude worktree. Do
not commit or push.

The physical owner-authorized 4 GB device is unavailable today. Do not attempt, substitute for, or
weaken C6. Complete the documentation remediation now and report release/push as NO-GO — C6
DEFERRED unless another unresolved code finding is the stronger blocker.
```

### 9.2 Expected Handback

The Opus task must return:

1. the audit-synthesis verdict;
2. the distinct release/push verdict;
3. changed documentation files;
4. source-manifest totals by authority tier and boundary;
5. the disposition of each Section 3.5 closeout finding;
6. Reviewer A and Reviewer B verdicts;
7. mechanical-verification results; and
8. explicit limitations, including deferred C6.
