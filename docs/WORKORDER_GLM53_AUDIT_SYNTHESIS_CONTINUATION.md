# Work order — GLM-5.3 continuation: audit-synthesis truth repair and final certification

## 0. Control Record

### 0.1 Executor and Runtime

- **Executor:** GLM-5.3 through Hermes Agent, acting as `DOCUMENT_EXECUTOR`.
- **Hermes version verified when issued:** `0.20.6` (`2026.8.27`, upstream `cd2bd160`).
- **Provider/model:** `nous` / `z-ai/glm-5.3`.
- **Required reasoning effort:** `max`.
- **Recommended turn allowance:** `90`; do not lower the reasoning level to prolong a weak run.
- **Working directory:**
  `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\progression-evidence-remediation`.
- **Branch:** `codex/progression-evidence-remediation`.
- **Expected HEAD:** `48719b07988ad30d255b0fed37f45ed5db49c935`.
- **Integrity mode:** benchmark.
- **Open ledger record:** `PROMPT_LEDGER.md` Entry `0063`. Adopt it; do not duplicate it.

GLM-5.3 keeps reasoning enabled and recognizes `low`, `high`, and `max`; `max` is its default and is
required here because this task combines long-horizon editing, cross-document provenance, and
adversarial verification. Hermes accepts `max` through `agent.reasoning_effort` or the session
`--reasoning max` override.

### 0.2 Isolated Hermes Profile Setup

Do not overwrite the existing `temufable` profile or its SOUL. Create an isolated profile if one has
not already been prepared:

```powershell
hermes profile create auditglm53 --clone-from temufable --description "Forensic documentation executor for repository audit closeout"
hermes -p auditglm53 config set model.provider nous
hermes -p auditglm53 config set model.default z-ai/glm-5.3
hermes -p auditglm53 config set agent.reasoning_effort max
hermes -p auditglm53 config set agent.max_turns 90
Copy-Item -LiteralPath "docs\hermes-glm53-audit-closeout\SOUL.md" -Destination "$env:HERMES_HOME\profiles\auditglm53\SOUL.md"
```

Start a new session after installing the SOUL because Hermes snapshots identity and project context
at session start:

```powershell
hermes -p auditglm53 --in "C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\progression-evidence-remediation" --reasoning max
```

The repository-root `AGENTS.override.md` is the Hermes project context for this run. It intentionally
contains the task envelope, while `SOUL.md` contains identity and communication posture only.

### 0.3 Current Candidate Fingerprint

Verify these before changing content:

| Artifact | Logical lines | SHA-256 |
|---|---:|---|
| `MASTER_AUDIT_SYNTHESIS.md` | 1007 | `e1a93745784588970ff82aff22a838112668f06dcd21b01452c6285d1cdbf9b9` |
| `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` | 322 | `d57d04667aa379064dd92ca4725f0e17bcca644417eeaaeab0215110199239e6` |
| `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` | 456 | `2e347231e16281ea5123111dc507d6d6ca63166dc9c72839250e93577531d90c` |

The candidate is useful and substantially remediated, but its final `APPROVED — COMPLETE` claim is
not currently supportable. This continuation begins at `REQUEST CHANGES`; it must earn a new verdict.

### 0.4 Outcome Boundary

This task may certify the documentation package. It cannot make the release push-ready. At minimum,
`OW-036` remains a blocking code finding at State C, and physical Gate C6 remains deferred. The
strongest truthful release handback while that remains true is:

```text
AUDIT SYNTHESIS: APPROVED | REQUEST CHANGES
RELEASE/PUSH: NO-GO — CODE FINDINGS OPEN; C6 DEFERRED
```

Do not reduce the release reason to C6 alone while a ledger row still has `release_effect=BLOCKING`.

## 1. Governing Sources and Read Order

### 1.1 Required Read Packet

Read these files in order and in full before editing:

1. `AGENTS.override.md`;
2. root `AGENTS.md`;
3. `CHIEF_ORCHESTRATOR_MANDATE_SOL.md`;
4. `docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md`;
5. this work order;
6. `MASTER_AUDIT_SYNTHESIS.md`;
7. `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md`;
8. `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`;
9. `.agents/audit-synthesis-remediation/round-5-reviewer-a.txt` and
   `.agents/audit-synthesis-remediation/round-5-reviewer-b.txt`;
10. `.agents/audit-synthesis-remediation/round-6-reviewer-a.txt` and
    `.agents/audit-synthesis-remediation/round-6-reviewer-b.txt`; and
11. `PROMPT_LEDGER.md` Entries 0061–0063.

Open older historical sources only at the exact spans needed to verify a changed claim. Do not start
a new general technical-debt scan.

### 1.2 Authority and State Rules

The authority tiers, State A/B/C/D boundaries, outstanding-work admission rule, source citation
syntax, and original no-C6 rule remain exactly as defined by the original remediation work order.
This work order supersedes only the continuation mechanics, write set, and known-defect ledger below.

## 2. Confirmed Starting Defects

### 2.1 Document-Control Contradictions

The final synthesis currently contradicts its claimed closeout:

- `MASTER_AUDIT_SYNTHESIS.md:13` says `PENDING_EXTERNAL_REVIEW` and `NOT approved`.
- `MASTER_AUDIT_SYNTHESIS.md:885-897` says the remediated corrections have not been independently
  checked and instructs a next reviewer, despite Round 6 approvals recorded immediately above.
- `MASTER_AUDIT_SYNTHESIS.md:965-970` says the document has not passed independent review and that
  only four request-change rounds exist.
- `MASTER_AUDIT_SYNTHESIS.md:880-883` says Round 6 approved. These statements cannot all be true.

Replace stale current-state prose with a precise chronology: earlier rounds requested changes;
Round 6 approved the 992-line candidate at hash `85a192a62b15d6159391dccab296bd513eafa1d017aa020f46917bee56f5e490`;
the executor then made administrative review-history edits, producing the 1007-line candidate; and
this continuation's substantive edits require a fresh independent review.

### 2.2 UTF-8 Mojibake

Only `MASTER_AUDIT_SYNTHESIS.md` contains the known double-encoding defect. At issue it contains:

| Broken sequence | Intended text | Required starting count |
|---|---|---:|
| `Â§` | `§` | 87 |
| `â€”` | `—` | 108 |
| `â€“` | `–` | 29 |
| `â†’` | `→` | 6 |
| `âˆ’` | `−` | 2 |
| `Â±` | `±` | 1 |
| `â€¦` | `…` | 5 |

Perform one bounded UTF-8 normalization pass using exactly this map. Before applying it, assert the
counts match the table. After applying it, assert every broken-sequence count is zero and each
intended-sequence count increased by the corresponding amount. Inspect the generated diff before
accepting it. Do not normalize arbitrary characters or rewrite prose during this pass.

This repair is required because the mandated heading currently renders as
`### 3.3 Claude C1â€“C5 Branch at 34f91ff`, and the required C6 status currently renders as
`RELEASE_GATE â€” DEFERRED`.

### 2.3 Source-Manifest Drift

The manifest no longer covers every T3 source named by the final synthesis:

- T3 stops at `S-T3-13` (Round 4), while the synthesis cites Round 5 A/B and Round 6 A/B.
- Add stable records for the four cited handoffs with full hashes and logical line counts.
- Recompute, rather than copy, source-record totals, distinct-path totals, and boundary totals.
- Reconcile `S-OUT-01`, whose recorded `236 at issue` line count is stale against the 322-line file.
- `§6.4` still points readers to ledger Entry 0059 for final hashes; the current administrative
  closeout is Entry 0062 and this continuation closes Entry 0063. Make the final locator exact.
- If this continuation cites new Round 7 handoffs, add them in the final administrative metadata
  phase and recompute totals again.

Do not assert that every cited source is manifested until an automated path join proves it.

### 2.4 False-Green Mechanical Verifier

`scratch/comprehensive_w4_verifier.mjs` reports 12/12 but does not prove several labels it prints:

1. Check 02 calculates hashes and line counts but compares them to no expected candidate fingerprint.
2. Check 04 uses minimum counts and set membership; it does not prove unique table-row IDs or reject
   duplicate records.
3. Check 05 checks `T2 == 0` and `T4 >= 17`; it does not prove exact tier assignment for every
   runtime, test, schema, and metadata source.
4. Check 06 uses a path-name regex instead of joining each open-work citation to a manifest tier.
5. Check 07 scans only the synthesis, does not compare working-tree SHA-256 values with disk bytes,
   and does not resolve or bounds-check external sources.
6. Check 09 proves only that several strings occur somewhere; contradictory current statuses can
   coexist and still pass.
7. Check 11 runs `git diff --check` only on the tracked ledger, leaving the three untracked candidate
   documents unchecked.
8. The script does not perform semantic entailment, so neither its title nor its handback may call
   it a semantic verifier.

The prior executor also changed this scratch verifier outside the original work order's write set.
Record that boundary breach honestly. This updated work order explicitly authorizes this one verifier
file so the continuation can replace the false-green assertions with checks that match their labels.

### 2.5 Release-Status Understatement

Entry 0062 and some handoffs reduce release NO-GO to C6 and owner gates. The synthesis itself carries
at least `OW-036` as `BLOCKING`, and also records other state-scoped blocking rows. Documentation
approval and release eligibility are separate. The final ledger output must use the stronger current
reason and list C6 as an additional deferred gate.

### 2.6 Review Boundary

Round 6 A/B reviewed the 992-line synthesis with SHA-256 `85a192...`; the current 1007-line synthesis
is `e1a937...`. Administrative edits after approval are allowed only for verdict metadata and final
mechanical records. This continuation changes substantive current-state prose, encoding, manifest
coverage, and verification logic, so the previous approvals cannot certify the new result. Obtain a
fresh pair after the substantive candidate is frozen.

## 3. Authorized Write Set

### 3.1 Files GLM-5.3 May Edit

- `PROMPT_LEDGER.md`, append-only and only by completing Entry 0063;
- `MASTER_AUDIT_SYNTHESIS.md`;
- `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md`;
- `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`, only if a verified cross-document
  inconsistency requires it;
- `scratch/comprehensive_w4_verifier.mjs`;
- new, verbatim reviewer handoffs under `.agents/audit-synthesis-remediation/`, using Round 7 names;
  and
- no other file.

The setup files `AGENTS.override.md`, this work order, and
`docs/hermes-glm53-audit-closeout/SOUL.md` are inputs. Do not edit them during execution.

### 3.2 Forbidden Writes and Actions

Do not modify product code, tests, migrations, package files, lockfiles, historical audits,
decisions, handovers, the Claude worktree, Git refs/index/remotes/stashes, build outputs, memory
evidence, or device records. Do not run C6. Do not stage, commit, push, tag, merge, rebase, or release.

## 4. Execution Phases

### 4.1 W0 — State and Ledger Adoption

1. Confirm exact path, branch, HEAD, status, worktree list, and current candidate fingerprints.
2. Confirm all six pre-existing dirty product-file hashes still match Entry 0062.
3. Confirm Entry 0063 contains the owner's exact prompt and an open Output section.
4. Record the allowed/forbidden write sets in the live handback; do not create another ledger entry.

Stop if HEAD, candidate hashes, or dirty product hashes differ without an attributable owner edit.

### 4.2 W1 — Truth and Encoding Repair

1. Apply the bounded mojibake replacement map from §2.2 and inspect the diff.
2. Correct §0.1, §6.2, and §6.3 so current review status has one meaning.
3. Preserve historical `REQUEST_CHANGES` records as history; remove only stale assertions that they
   are the current state.
4. State explicitly that previous Round 6 approval covered `85a192...`, while this substantive
   continuation is pending fresh review until W5.
5. Use exact required headings and exact `RELEASE_GATE — DEFERRED` spelling.
6. Correct the release-status narrative to distinguish documentation approval, blocking code work,
   and deferred C6.

### 4.3 W2 — Manifest Reconciliation

1. Add every cited Round 5/6 T3 handoff missing from the manifest.
2. Join every `[Working-tree source: ...]` and `[External source: ...]` path used by the synthesis to
   one manifest record or an explicitly justified output record.
3. Recompute source totals, distinct paths, tier totals, boundary totals, and current line counts.
4. Correct the final-ledger locator without embedding the manifest's own hash.
5. Preserve T3/T4/T5 non-origin rules for open work.

### 4.4 W3 — Make W4 Mean What It Says

Repair `scratch/comprehensive_w4_verifier.mjs` so it fails on each false-green class in §2.4. At
minimum, the revised verifier must:

- accept or contain an explicit candidate fingerprint and assert all three hashes and line counts;
- parse table rows and reject duplicate IDs, missing IDs, malformed column counts, and unexpected
  status vocabulary;
- join every open-work origin to the manifest and reject T3/T4/T5-only origins;
- scan all three candidate documents for every authorized citation form;
- verify Git blob existence, exact line bounds, working-tree/external file existence, SHA-256, and
  logical line bounds;
- prove every cited mutable path has a matching manifest record;
- reject contradictory current review/release/C6 statements while allowing historical verdicts;
- assert zero known mojibake sequences;
- inspect whitespace in untracked candidate files directly; and
- describe semantic entailment as reviewer coverage, never as a mechanical script result.

Add deliberate negative probes in memory or temporary copies outside the repository: mutate one
expected hash, duplicate one ID, alter one working-tree citation hash, insert one mojibake sequence,
and add one contradictory current status. Each mutation must make the owning check fail. Restore the
untouched candidate after every probe and verify its hash.

### 4.5 W4 — Freeze the Substantive Candidate

Run the repaired verifier and independent read-only spot checks. Record command, working directory,
exit code, observed count, and coverage limit. Required green conditions:

- exact heading schema and one H1 per candidate;
- zero mojibake sequences from §2.2;
- no current-status contradiction;
- exact manifest coverage and totals;
- all citations resolve with matching hashes and in-bounds spans;
- every open-work item has an admissible T0/T1/T2 origin;
- product overlay remains byte-identical;
- `git diff --check` and direct untracked-file whitespace checks are clean; and
- all negative probes fail for the intended reason.

Freeze and record the three candidate hashes. No substantive edit may occur after this point without
returning to W4.

### 4.6 W5 — Fresh Independent Review

Launch exactly two independent read-only reviewers in parallel after W4 is green:

- **Round 7 Reviewer A:** strict outstanding-ledger provenance, semantic entailment, supersession,
  authority tiers, manifest coverage, and release-effect consistency.
- **Round 7 Reviewer B:** Option C/RR-04, Task U3 State B, all four State C commits, Migration
  058/059 separation, five closeout findings, state boundaries, document-control chronology,
  encoding, and C6/release wording.

Each reviewer receives the frozen hashes and primary-source locators, not the other reviewer's
conclusion or a desired verdict. Each handoff must contain a verified-hashes table, discrepancy
table, commands/source locators, coverage limits, and an unambiguous final `APPROVE` or
`REQUEST_CHANGES` verdict. Persist handoffs verbatim; never edit them.

Any `REQUEST_CHANGES` returns to W1/W2/W3 as applicable, then W4, followed by a new independent pair.
Do not relabel a reviewer finding as administrative to avoid re-review.

### 4.7 W6 — Administrative Closeout

After both fresh reviewers approve:

1. Add only Round 7 review-history records/citations and final verdict metadata.
2. Recompute manifest totals if the new handoffs are manifested.
3. Rerun the full W4 verifier on the final bytes.
4. Complete Entry 0063 append-only with final hashes, line counts, exact changed files, verifier
   command/exit result, negative-probe results, reviewer hashes/verdicts, product byte identity,
   the prior scratch-boundary disclosure, and limitations.
5. Do not claim release eligibility.

If any post-review edit changes a substantive claim, obtain a fresh independent pair before closing.

## 5. Acceptance Criteria

### 5.1 Documentation and Integrity

- [ ] `MASTER_AUDIT_SYNTHESIS.md` has no stale current `PENDING_EXTERNAL_REVIEW` assertion after a
      valid approval, and no stale assertion that Round 6 never occurred.
- [ ] All seven known mojibake sequences have zero occurrences.
- [ ] Required headings and `RELEASE_GATE — DEFERRED` use valid UTF-8 punctuation.
- [ ] Historical request-change verdicts remain accurately preserved as history.
- [ ] Every current synthesis citation maps to the manifest or an explicit output record.
- [ ] Manifest totals are calculated from rows and match all boundary/tier summaries.
- [ ] No open-work item originates solely from T3, T4, or T5.
- [ ] Release status names the blocking code finding before the additional deferred C6 gate.
- [ ] All unauthorized product and historical files remain unchanged.

### 5.2 Verification and Review

- [ ] The repaired W4 verifier passes on final bytes and each required negative probe is observed to
      fail on its targeted mutation.
- [ ] Round 7 Reviewer A returns `APPROVE` with zero provenance discrepancies.
- [ ] Round 7 Reviewer B returns `APPROVE` with zero progression/UI/state/status discrepancies.
- [ ] The final candidate hashes are calculated after the last permitted administrative edit.
- [ ] Entry 0063 is closed and exact.

Any unchecked item means `AUDIT SYNTHESIS: REQUEST CHANGES`.

## 6. Stop Conditions

Stop with evidence instead of guessing if a mutable source hash has changed, a cited snapshot is
unavailable, a source conflict needs owner judgment, a reviewer cannot run independently, a correct
fix exceeds the write set, a product file would need editing, or a physical device/push/commit would
be required.

The absence of a 4 GB device is not a blocker for this documentation task and is not a failed test.
It remains `C6 DEFERRED`.

## 7. Required Final Handback

Return:

1. documentation verdict;
2. separate release/push verdict;
3. final candidate hashes and line counts;
4. exact files changed;
5. repaired-verifier results and negative probes;
6. Round 7 reviewer verdicts and handoff hashes;
7. preserved dirty-product hashes;
8. remaining blocking/open/owner-only work; and
9. confirmation that no Git or release action occurred.

Use exactly:

```text
IMPLEMENTATION OR DOCUMENTATION: COMPLETE | REQUEST CHANGES | BLOCKED
RELEASE/PUSH: NO-GO — CODE FINDINGS OPEN; C6 DEFERRED
```
