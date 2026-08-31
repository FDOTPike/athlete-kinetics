# MASTER AUDIT SYNTHESIS

## 0. Document Control

### 0.1 Scope and Non-Claims

This report synthesizes the Athlete Kinetics audit corpus and compiles a strict outstanding-work
ledger for a downstream auditor agent. It is a documentation product. It ratifies nothing, approves
no release, and authorizes no code change.

- **Revision:** 4, rebuilt 2026-08-31 under `docs/WORKORDER_STATE_C_RELEASE_READINESS.md`
  (canonical `PROMPT_LEDGER.md` Entry 0058), closing `OW-036` with the code/test evidence of commit
  `88f5b5c`, closing `OW-024` through the ledger-lineage crosswalk, and superseding State-B-only
  `OW-025`. Revision 3 was the GLM-5.3-corrected candidate approved at Round 12; its review history
  is recorded in §6.2 and its approvals covered the carried revision-3 bytes only. This revision's
  status is `PENDING_EXTERNAL_REVIEW` until a fresh Reviewer A/B pair certifies the rebuilt
  candidate.
- **Review chronology (revision 3 history):** review rounds 1 through 4 each returned two `REQUEST_CHANGES` verdicts;
  Round 5 returned one `APPROVE` (Reviewer A) and one `REQUEST_CHANGES` (Reviewer B); Round 6
  returned two `APPROVE` verdicts for the 992-line candidate at SHA-256
  `85a192a62b15d6159391dccab296bd513eafa1d017aa020f46917bee56f5e490`. Administrative review-history
  edits then produced a 1007-line candidate, and the GLM-5.3 continuation made further substantive
  edits (encoding repair, chronology repair, manifest reconciliation, verifier repair). Round 7
  reviewed that candidate: Reviewer B returned `APPROVE`; Reviewer A returned `REQUEST_CHANGES` with
  two findings, both remediated. Round 8 reviewed the re-frozen candidate: Reviewer B returned
  `REQUEST_CHANGES` on one finding (a stale §0.1 chronology bullet — this one), now fixed; Reviewer
  A's run was truncated by an environment failure and produced no verdict. Round 9 returned two
  `REQUEST_CHANGES` with four minor findings (a stale manifest exclusion count, an `OW-036`
  citation-scope gap, an off-by-one §6.3 round count, and an unverifiable Round 8 Reviewer A
  attribution), all remediated. Round 10 returned two `APPROVE` verdicts, but with materially
  partial coverage (each handoff's own coverage limits exclude substantial charter scope), so those
  approvals are recorded with their limits attached rather than as a full-charter certification.
  The owner's orchestrator then returned `REQUEST_CHANGES` on the coverage gap and further
  verifier/ledger defects; this revision applied those corrections, and Round 11 returned two
  `APPROVE` verdicts whose handoffs state their own scope: Reviewer A resolved and bounds-checked
  all 84 citations across the 59 §4 rows, semantically read 28 origin spans, reproduced every
  corpus total, and completed a nine-row stale hunt — leaving 31 rows resolution-checked only and
  §5 supersession outside its charter; Reviewer B verified HEAD/state, progression substance at
  both states, the five-finding mirror with code spot-checks, and Entry 0064's disclosures. Because
  semantic entailment over all rows and §5 supersession are part of the mandated Reviewer A
  charter, the owner's orchestrator again returned `REQUEST_CHANGES` and a focused Round 12 pass
  was commissioned for exactly that remainder. Round 12 then returned **two `APPROVE` verdicts**:
  Reviewer A semantically read all 41 enumerated remainder rows (9 §4.1 + 8 §4.2 + 24 §4.3),
  bringing combined semantic coverage across Rounds 11–12 to 59 of 59 §4 rows, verified §5.1
  supersession in full against the named superseding sources, confirmed no §4 OPEN row is
  superseded by a newer source, and reproduced the 84-citation/59-row counts mechanically;
  Reviewer B verified Entry 0065's single-Input/single-Output structure with the complete verbatim
  execution prompt (full work-order body, no elision), the corrected count labels, heading schema,
  zero mojibake, and the chronology. Review status for revision 3: **`APPROVED` (Round 12,
  Reviewers A and B, focused completion of the full charter).** This revision 4 rebuild changes
  substantive ledger dispositions, so its status is **`PENDING_EXTERNAL_REVIEW`** until a fresh
  Reviewer A/B pair certifies the revision-4 candidate.
- **Author:** Claude Code Opus as `DOCUMENT_EXECUTOR`. Not the owner, ratifier, or release approver.
- **Supersedes:** revision 1 of this file — SHA-256
  `bf3f4961d62990b66cb32558964fb815ba17e9ff9cf510f2523e9cc5c556521b`, 397 lines, captured
  2026-08-30, immediately before this rebuild. **That hash deliberately does not match this file**;
  it identifies the superseded content, which was replaced in place because the work order mandates
  a heading schema incompatible with the old structure. A verifier must not treat it as a live
  working-tree citation. Revision 1 was assessed `REQUEST CHANGES`; §5.2 records every claim
  retracted from it, and `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` `S-T3-07` carries the same
  hash.
- **Companion documents:** `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` defines every `source_id`
  and the discovery rule; `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` carries the bounded
  five-finding audit of the State C branch.

**Explicit non-claims.** This report does not claim that the repository is green, complete,
authoritative, release-ready, or victorious. It does not claim that any gate result transfers across
the four states in §0.2. It does not claim that Task U3 is committed at `48719b0`, that Migration
059 exists in State A, or that C6 has passed. It does not claim the codebase is free of defects
beyond those its admissible sources name: no general debt scan was performed, and §2.3 of the
governing work order forbids one.

### 0.2 Repository State Matrix

Four distinct states are in play. No evidence crosses a boundary in this document without saying so.

| State | Identity | Migration head | Task U3 UI | Tracked | What it is |
|---|---|---|---|---|---|
| **A** | Commit `48719b07988ad30d255b0fed37f45ed5db49c935`, branch `codex/progression-evidence-remediation` | 058 | **Absent** | Yes | The audited base. Every historical citation resolves here. |
| **B** | State A plus an uncommitted working-tree overlay, captured 2026-08-30 | 058 | `SuspensionCard.tsx` + `SuspensionSheet.tsx` | No | A dated, mutable overlay. Not committed, not merged, not released. |
| **C** | Commit `34f91ffe548a0b9e51db863ffc6fad993619f940`, branch `claude/rc-48719b0` | **059** | Inline flow in `BlockScreen.tsx` | Yes, on that branch | State A plus four commits. A different, incompatible Task U3 implementation. |
| **D** | `C:\Users\fpike\Documents\Claude Coding\Athlete App\KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md` | n/a | n/a | No | A parent-checkout-root document outside the audit worktree. External context only. |

State A does not contain the Task U3 UI. `git cat-file -e 48719b0:<path>` returns `ABSENT` for all
three of `apps/mobile/src/components/SuspensionCard.tsx`,
`apps/mobile/src/components/SuspensionSheet.tsx` and
`apps/mobile/test/components/SuspensionUI.test.js`. Revision 1 of this document asserted the
opposite; see `RC-01` in §5.2.

States B and C are **not** the same feature at different maturities. They are divergent
implementations on divergent lineages, described separately in §3.2 and §3.3.

### 0.3 Source Authority Rules

Every source carries exactly one tier, assigned in the manifest.

| Tier | Class | May originate an outstanding-work item |
|---|---|---|
| T0 | Owner instructions, ledger entries, ratified decisions, governing mandate | Yes |
| T1 | Tracked historical audits and handovers at a named commit | Yes |
| T2 | Exact-revision branch **documents** between `a80f955` and `34f91ff`. Runtime code, tests and schemas are T4 regardless of branch. | Yes |
| T3 | Generated teamwork handoffs under `.agents/` | **No** — verification history only |
| T4 | Runtime code, tests, schemas, command output, Git metadata | **No** — verification of a documented claim only |
| T5 | Files outside the audit worktree | **No** — external context only, labelled and hashed |

An item enters §4 only when a T0, T1 or T2 source explicitly states it, the cited span semantically
entails the statement, the source is tied to an exact revision or snapshot hash, and no newer source
has closed or superseded it. Where sources conflict, the later owner-ratified T0 decision wins,
then the later exact-revision T2, then the later T1. Nothing is deleted: a superseded statement
moves to §5 with the source that superseded it named.

Citations use exactly three forms: `[Source: path@commit, lines a-b]` for immutable revisions,
`[Working-tree source: path; SHA-256 hash; lines a-b; captured date]` for mutable untracked files,
and `[External source: absolute-path; SHA-256 hash; lines a-b; captured date]` for State D.

## 1. Source Corpus

### 1.1 Admissible Historical Sources

The discovery rule, exclusion list and reproducible totals live in
`docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` §1. Summarised: the Corpus A pattern matches **62** of
the **117** tracked Markdown files at State A; **9** untracked Markdown files sit outside `.agents/`;
**213** sit inside it (the teamwork corpus is mutable and was re-counted at the GLM-5.3 remediation
freeze); the State C branch changes **2** Markdown documents — `docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md`
added and `PROMPT_LEDGER.md` modified — out of 16 changed files; and **1** external document sits
outside the worktree entirely. Total untracked Markdown is therefore **222**.

Two of those six untracked files are this task's own companions —
`docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` and
`docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`. They are counted rather than silently
omitted, because a corpus total that excludes the auditor's own output is not reproducible by a
third party running the stated command.

A sixth, `AGENTS.md`, appeared in the worktree after the round-3 candidate was frozen. It is the
Codex counterpart of `CLAUDE.md` — the same execution contract addressed to a different executor —
and it is outside this task's write boundary. It is counted here, and registered as `S-T0-09`,
solely so the corpus totals stay reproducible; it originates no ledger item and changes no finding.

Nine T0–T2 documents are synthesized substantively rather than listed, satisfying the work order's
five-document minimum: `S-T0-01` the ratified C1 docket, `S-T0-02` the orchestrator mandate,
`S-T0-03` the progression-measurement decisions, `S-T0-05` the training-progression layers,
`S-T1-01` the Sol handover, `S-T1-02` the external-architecture-review audit, `S-T1-03` the
deviation log, `S-T1-04` the release-readiness checklist, and `S-T1-06` the research audit.

This document makes no "complete repository inventory" claim. Revision 1 did; see `RC-03` in §5.2.

### 1.2 Generated Verification Artifacts

The `.agents/` corpus is T3 in full. It records what a launched multi-agent run reported about
itself on 2026-08-30, and it is untracked and mutable. It appears in this document only in §6.2,
never as authority for a substantive claim and never as the origin of a ledger item.

Two of revision 1's T3 citations do not survive inspection and are retracted in §5.2: a set of
claims about component filenames, design tokens and screen wiring attributed to
`.agents/sentinel/handoff.md` lines 7–10, where those lines actually describe agent routing and
review-pipeline mechanics; and a citation to lines 24–25 of the same 23-line file.

### 1.3 External References

`[External source: C:\Users\fpike\Documents\Claude Coding\Athlete App\KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md; SHA-256 6a7be0f8f6d0d1119765b7d3b100537c5aad2e4e47f0f37b39c0025fbabf17f8; lines 1-443; captured 2026-08-30]`

This is State D. It does not exist in the audit worktree at any revision — `git ls-tree -r
--name-only 48719b0 | grep -i kinestrike` returns nothing, and the file is untracked in the parent
checkout as well. Revision 1 reached it through parent-directory fallback resolution and presented
its contents as Athlete App release work. That is corrected in §5.3.

## 2. Historical Audit Synthesis

### 2.1 Verified Historical State

The following are recorded as historical findings at their source revisions. They are `REPORTED`
unless this task re-derived them, in which case they are marked.

**Codebase audit, 2026-07-16.** A full source sweep recorded zero TypeScript compilation errors and
16 of 16 verification gates green; a synchronous fail-fast self-healing migration runner; the
deliberate replacement of `user_profile` by `athlete_profile` in migration 007; eleven analytic
Kinematic Autopilot invariants; and parity between the pure-TypeScript BERT tokenizer and the ONNX
device model.
`[Source: AUDIT_REPORT.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 1-137]`

**Deviation register, 2026-06-11 to 2026-08-15.** 605 lines of architectural deviations spanning
Phases 8–18 and Autopilot R1/R2/C1–C6B, including the removal of the load term from the readiness
score under Calibration Policy v1, Migration 050's resolution of supplementary-eligibility
divergence under poison repair, the accepted bodyweight tonnage limitation, the +2.5 RPE authority
envelope, and the DB-per-athlete Coach Mode structure.
`[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 1-605]`

**Research audit, 2026-08-26.** Material claims were adjudicated against retrieved sources.
Auditor-derived e1RM minimal-detectable-change figures and persistence windows were quarantined;
unverified hard-set correlation statistics were quarantined; abstract-level findings that survived
retrieval were retained.
`[Source: docs/research/audits/progression-terra-2026-08-26/AUDIT_REPORT.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 1-30]`

The same audit recorded that `e1rm.ts` exports pure functions consumed by nothing, and that
`TRAINING_PROGRESSION_LAYERS.md` "still names a nonexistent `getMovementE1rmSeries`".
`[Source: docs/research/audits/progression-terra-2026-08-26/AUDIT_REPORT.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 51-52]`

**That second observation is stale at State A and must not be carried forward as current.** The
audit is pinned to baseline `368e82d`. At `48719b0`, `git grep -n "getMovementE1rmSeries"` returns
zero hits in `TRAINING_PROGRESSION_LAYERS.md`, which now carries corrected wording — "Stagnation
therefore remains non-authoritative and unimplemented".
`[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 206-212]`
The disposition is recorded in §5.1. This is the precise failure mode the `source_date` and
`as_of_revision` columns exist to catch: a citation that still resolves against a document whose
subject has already been fixed.

**Autopilot C6B audit, 2026-07-30 — a recommendation, not a ratification record.** An independent
reviewer caught this section re-committing the same conflation §3.1 exists to prevent, so it is
stated carefully. The C6B document is titled a "Claude/Opus ratification pass", its verdict is
"GO. Ratify and land" and it closes by *recommending* ratification; it contains no owner decision
and no owner date.
`[Source: docs/AUDIT_C6B_2026-07-30.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 1-3]`
`[Source: docs/AUDIT_C6B_2026-07-30.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 80-82]`
It also does **not** contain the authority figures previously attributed to it: `git grep` for
`2,385` and `MAX_MACROCYCLE_RPE_RAISE` over that file returns nothing.

The owner decision is recorded in the deviation log, which names the owner and the rejected
alternative: the deterministic 2,385-case family was re-run at `1.0`, `2.5`, `3.0` and unbounded
authority; the owner preferred `3.0`, C6B rejected it under the predeclared early-warning rule
because its applied-block `mixed` population rose from 401 to 463, and the authorized next-lower
`2.5` was selected with zero upward saturation and zero limit cycles.
`[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 170-178]`

Separately, the C6B audit records that C3's headline aggregate counts were computed under a
classifier one boundary late and require restatement where quoted, while noting the *findings* do
not depend on those aggregates because the counterexamples are pinned individually. That
restatement was subsequently completed; see §5.1.
`[Source: docs/AUDIT_C6B_2026-07-30.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 55-77]`

**Orchestrator handover, 2026-08-27.** Work was decomposed into units U1–U8; U1 is an owner-only
on-device verification that blocks the push; U2 records that `verify:ci` had never completed,
aborting in `scripts/verify-preflight.mjs` on missing `node_modules` and embedder assets *before*
typecheck and before any gate — an environment condition, not a code failure.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 78-100]`

**External-architecture-review audit, 2026-08-27.** This document **recommended**; it did not
ratify. Its verdict table records "A stands" for RR-01, "A, with three corrections" for RR-02,
"Defer both" for RR-03, and "A — the strongest of the three" for RR-04.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 14-21]`
It states plainly that "no ruling was signed on the owner's behalf".
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 209-211]`
Its §6 discovered the capability-ladder rep mismatch.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 134-170]`
Its §7 found that WO-04 contradicts a ratified decision while citing it as authority, and that WO-02
is factually wrong about the progression engine being unwired.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 173-188]`
The owner's ratification is recorded separately; see §3.1.

### 2.2 Architectural Rulings and Invariants

**The five non-negotiable invariants.** Zero-cloud and fully offline runtime; a bounded peak
dirty-RAM envelope on 4 GB devices under Jetsam pressure; determinism as a verified property, with
no clock read, randomness, float-order dependence or LLM in the math; strict typing end to end with
STRICT SQLite, append-only idempotent migrations and sentinel-backed self-heal for every new
stateful object; and architectural boundaries that hold, so pure engines stay pure, the
raw-versus-effective tonnage bifurcation is never conflated, and forward-looking prescription never
rewrites backward-looking history.
`[Source: CHIEF_ORCHESTRATOR_MANDATE_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 50-63]`

The mandate states the memory envelope in shorthand as "450 MB". The authoritative numeric contract
is the pair in §3.4; the shorthand is not the contract.

**The ratification firewall.** No numeric value enters the engine without explicit owner
ratification recorded against a source — not as a default, example, fixture, placeholder or
reasonable starting point. Reopening a ratified decision, the push itself, and anything on the
quarantine list are owner-only. When work genuinely needs a number that does not exist, the correct
output is a docket entry with options and no preselection.
`[Source: CHIEF_ORCHESTRATOR_MANDATE_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 67-81]`

**Calibration Policy v1, ratified 2026-08-15.** ACWR holds zero prescriptive authority and is
retained for historical graphing only. The 21-day return check-in is non-blocking and applies zero
automatic dose reductions. The autopilot coefficient registry and readiness weights are pinned by
equality gates.
`[Source: docs/decisions/CALIBRATION_POLICY_V1.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 1-109]`

**The C1 owner rulings, ratified 2026-08-29.** Ten rulings were adopted as the package
`S1a S2a S3a S4a S5c S6b L1a(constrained) L2b M1a A1a`:

| ID | Ruling | Binding content |
|---|---|---|
| S1 | (a) retain / resume | An in-flight block survives suspension untouched. |
| S2 | (a) freeze the sequence start | With no prior block, the existing sequence start is frozen. |
| S3 | (a) out of scope | Competition and taper interaction stays out of this release, recorded as a disclosed exception, not code. |
| S4 | (a) freeze at entry | The snapshot persisted at entry is authoritative on exit. |
| S5 | (c) freeze both | Freeze the global macro position **and, when a guided program is active,** its program-owned next sequence state. Couples to M1. |
| S6 | (b) train, but do not consume | Training and block generation may continue while suspended, but blocks generated during an episode consume neither frozen progression state. **Resume returns to exactly the recorded position.** |
| L1 | (a) constrained | Persist explicit prospective per-slot load intent at generation. **Ambiguous mixed movements require athlete selection.** Missing **legacy** state fails closed toward the conservative loaded path. Intent may not be derived from dropdown order, taxonomy, equipment ownership, or retrospective set data. |
| L2 | (b) chain-scoped | Scope the ladder floor to capability-chain movements and honour a per-chain `progression_policy`. Future plans only — never rewrite history. |
| M1 | (a) authorize 059 | Additive Migration 059 for immutable suspension history plus the state S5 and L1 require. Do not edit 058, invent constants, or block explicit whole-athlete erasure. |
| A1 | (a) adopt none | No optional dirty-worktree feature enters this release. |

`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 444-455]`

**A retraction inside the ratified record.** The same docket withdraws its own revision-1 claim that
the broad bodyweight rep floor was a settled owner ruling. The ledger shows the owner authorized a
capability-ladder reconciliation; the implementer's own handback disclosed the broadening to all
bodyweight movements as unratified; and the "Settled" row recording it was written by that same
implementer. An agent cannot ratify its own scope expansion. L2 was therefore always an open owner
ruling, and the follow-on correction to `TRAINING_PROGRESSION_LAYERS.md` §8 is tracked as `OW-020`.
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 298-313]`
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 419-425]`

**A measurement that closed a proposed remedy.** Across the shipped 300-movement corpus,
`supported_prefixes[0]` and `movement_taxonomy.implement` agree on all 300 movements, and both
classify Weighted Pull-up as bodyweight. Switching from one to the other would therefore change
nothing. Loading is not a property of a movement; it is a per-slot, per-athlete choice that the
schema did not record.
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 246-262]`

### 2.3 Science Quarantine

The following may not enter production code, database schemas, fixtures, comments, or any work
order without separate owner ratification.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 205-211]`

1. e1RM minimal detectable change, 11.1–33 percent — auditor-derived, treating direct-1RM CV as
   e1RM SEM with assumed adaptation rates.
2. e1RM persistence windows of 3–5, 6–9 and 15–30 sessions — derived duration heuristics with no
   trial validation.
3. Hard-set versus tonnage correlation values 0.68 and 0.09 — attributed to Baz-Valle with no
   accessible source locator.
4. Push-up force-variation percentages 41, 49, 64 and 74 — continuous force fractions with no
   verified table locator. Push-up variations remain strictly ordinal via
   `movement_progression.progression_rank`.
5. The Hackett RIR accuracy constant 3.5 ± 1.2.
6. The Pareja-Blanco −1.2 percent velocity deficit — contradicted by the retrieved abstract, which
   reports countermovement-jump values of 9.5 versus 3.5 percent.
7. Silva minimal-detectable-change values.
8. RR-03 competition taper percentages — 50, 30, 60, 40–60 and 41–60 — with unlocatable
   Bosquet/Mujika attributions.
9. Automated return-to-training dose modifiers.

**Bibliographic corrections on record.** The Baumel citation is *Mental Health Apps*, not "Mobile
Health Apps"; the Davidson and Barillas medRxiv preprint is `posted-content`, not a Tier-A
systematic review.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 205-211]`

Quarantine status is a **ratified constraint**, not outstanding work. It is stated here and does not
appear in §4. Revision 1 listed the push-up figures as ledger item 6; see §5.1.

## 3. Latest Progression and Suspension Execution

### 3.1 Option C and RR-04

Verified at State A. **A distinction the previous revision blurred: the architecture-review audit
*recommended*; the owner *ratified*.** That audit's verdict table records "A stands" for RR-01,
"A, with three corrections" for RR-02, "Defer both" for RR-03, and "A — the strongest of
the three" for RR-04.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 14-21]`
That table records the panel's RR-02 proposal as "A (Migration 059)"; the correction to slot **058**
is made in the audit body, not in the table.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 54-56]`
That document explicitly disclaims ratifying anything: "The review's work orders were read but not
executed, and no ruling was signed on the owner's behalf."
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 209-211]`

**Where the ratification is actually recorded is worth stating precisely, because an independent
reviewer showed the obvious citation does not support it.** The orchestrator handover reports
*implementation* status — "RR-04 is implemented. The capability ladder now agrees with what blocks
prescribe" — not a ratification, and it is an agent-authored handover.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 31-33]`
The decision register is the ratification record: the §8 Settled table carries a 2026-08-27 row for
RR-04's primary-slot bias.
`[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 280-280]`
That register is not unimpeachable — the C1 docket retracted the adjacent row 281 as agent-authored
(§2.2) — so the honest position is that RR-04's ratification rests on the decision register plus the
engine's own dated markers, and no cleaner owner artifact exists in this worktree.
The engine carries the same ratification date at each affected site — T4 corroboration, not an
origin: Option C routing and the RR-04 primary-slot restriction
`[Source: packages/inference/src/blockGenerator.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 804-817]`,
and the ladder reconciliation
`[Source: packages/inference/src/blockGenerator.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 720-720]`.

The capability-ladder rep mismatch discovered in §6 of that audit — the ladder requiring 8 reps
while the LINEAR schedule prescribed 8 in only 2 of 8 blocks — is the defect the bodyweight rep
floor was authorized to fix.
`[Source: docs/AUDIT_architecture_review_8b4e75b.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 134-170]`

**The State C routing change reaches further than load class alone.** At State C a single predicate,
`isPurelyBodyweight`, gates three separate behaviours: the Option C set ramp and the L2(b) chain rep
floor, both selected in the slot loop, and the fatigue-class accessor `bodyweightDominant`, which
sits apart from it
`[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 671-682]`.
A slot that is not classified bodyweight receives the loaded set schedule *and* the raw phase reps,
bypassing `bodyweightRepsFor` entirely.
`[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 844-862]`
`[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 765-771]`

Because `plannedImplementFor` leaves every multi-prefix movement undeclared, Push-up — rung 0, the
entry rung of the `handstand-push-up` capability chain — is not bodyweight at State C. It therefore
loses both the Option C ramp and the ladder floor, and is prescribed raw phase reps against an
advancement bar it cannot meet. That is the same class of defect §6 of the architecture review
identified and the ladder reconciliation was authorized to close. It was tracked as `OW-036`; the
State C push-ready remediation closed it by decoupling the two policies — commit `88f5b5c` renamed
`bodyweightRepsFor` to `chainScopedRepsFor`, keyed it on chain membership
(`m.progressionGroup !== undefined`), and applied it to every slot while `isPurelyBodyweight`
retained sole control of Option C set routing. `OW-001` continues to carry the athlete-selection
residue at `NON_BLOCKING`. The two were separate rows because either could be closed without the
other.

At State A the floor applies to every strictly bodyweight slot regardless of chain membership. The
docket measured that scope: of 55 dropdown-bodyweight movements, **15 are in a capability chain and
40 are not**, and `progression_policy` has **zero seeded rows**, so no athlete's current dose is
affected by the per-chain question today.
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 284-296]`

Ruling L2(b) narrows the floor to chain movements for future plans only. That narrowing exists at
State C and does not exist at State A.

### 3.2 Task U3 Working-Tree Overlay

**This is State B. It is uncommitted, mutable, and not contained in any commit.** It was captured on
2026-08-30 and every claim below is `OBSERVED IN WORKING-TREE SNAPSHOT`.

| File | Status | SHA-256 | Lines |
|---|---|---|---|
| `apps/mobile/src/components/SuspensionCard.tsx` | Untracked, new | `77d798e6c9631df1f8f5fcf44004237f02a348df479adb83a14ac0c98473e999` | 148 |
| `apps/mobile/src/components/SuspensionSheet.tsx` | Untracked, new | `cb65064b7d73fb1b794b24818c54e6181755f7a729944631cf4497c9218e7b4d` | 138 |
| `apps/mobile/test/components/SuspensionUI.test.js` | Untracked, new | `d6635e3ce7444ddd2bad678b36a9683969bb03ab60660681173e082af4eff991` | 414 |
| `apps/mobile/src/screens/BlockScreen.tsx` | Modified | `eb5cf5faff463ad198a02a0b7176eb0e42492bfbd8d2b2727355e0b0773e970b` | 1596 |
| `apps/mobile/src/screens/ProfileScreen.tsx` | Modified | `acd799d54d84eaa7cc6f676ae6f59551ad5c10b3aecf9eef33c2ef4d4e65c6c3` | 1345 |
| `apps/mobile/src/state/useStore.ts` | Modified | `fa5616973d75de7d150d3e97843e27eb7f6b6797a23fbd131603f4a9e244ee5c` | 6216 |

**What the overlay contains.** A sheet component offering the closed-domain reasons
`injury | illness | life` through selection chips, and a status card showing the reason and frozen
macro position with a single resume action. The visual system adheres strictly to the canonical theme:
the active marker token `#EFC94C` (`theme.color.chalk`)
`[Source: apps/mobile/src/theme/theme.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 22-22]`
is used for the FROZEN badge text
`[Working-tree source: apps/mobile/src/components/SuspensionCard.tsx; SHA-256 77d798e6c9631df1f8f5fcf44004237f02a348df479adb83a14ac0c98473e999; lines 108-111; captured 2026-08-30]`,
and interactive controls enforce generous `56pt` minimum touch targets (`theme.touch.min`)
`[Source: apps/mobile/src/theme/theme.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 42-42]`
across actions
`[Working-tree source: apps/mobile/src/components/SuspensionSheet.tsx; SHA-256 cb65064b7d73fb1b794b24818c54e6181755f7a729944631cf4497c9218e7b4d; lines 7-8; captured 2026-08-30]`.
The sheet is wired into both `BlockScreen.tsx` and `ProfileScreen.tsx` with sub-view back handling.
**The card is not**: `ProfileScreen.tsx` imports `SuspensionCard` at line 36 and never renders it,
hand-rolling an equivalent block instead, so the only `<SuspensionCard` element in the overlay is at
`BlockScreen.tsx` line 413.
`[Working-tree source: apps/mobile/src/components/SuspensionSheet.tsx; SHA-256 cb65064b7d73fb1b794b24818c54e6181755f7a729944631cf4497c9218e7b4d; lines 1-25; captured 2026-08-30]`
`[Working-tree source: apps/mobile/src/components/SuspensionCard.tsx; SHA-256 77d798e6c9631df1f8f5fcf44004237f02a348df479adb83a14ac0c98473e999; lines 1-21; captured 2026-08-30]`

**Underlying schema and what the overlay does not contain.** The UI operates against Migration 058's
`suspension_episode` table, structured with a partial unique index (`ux_suspension_episode_single_open`)
enforcing at most one open episode, and double fail-closed triggers (`trg_suspension_episode_single_open_bi`
and `trg_suspension_episode_no_reopen_bu`)
`[Source: packages/core-db/src/schema/058_suspension_episode.sql@48719b07988ad30d255b0fed37f45ed5db49c935, lines 49-88]`.
The store diff adds reactive state plumbing over this table — a `suspensionEpisode` field declared at `:775`,
initialised at `:2066`, cleared in `PER_ATHLETE_RESET` at `:2013`, a `refreshSuspension` action, and a
`boot()` call to it at `:2151`. Searching the overlay for the three Migration 059 objects returns **zero**
occurrences of `block_suspension_origin`, `suspension_episode_program` or `planned_slot_load_intent`. State B
carries no Migration 059, no S5(c) program freeze, no S6(b) attribution and no L1(a) load intent.
`[Working-tree source: apps/mobile/src/state/useStore.ts; SHA-256 fa5616973d75de7d150d3e97843e27eb7f6b6797a23fbd131603f4a9e244ee5c; lines 2610-2652; captured 2026-08-30]`

**The consequence, entailed by two admissible sources plus this snapshot.** The C1 docket records
that at State A no UI calls the suspension actions, so the athlete cannot open an episode, and that
the position-consumption defect is *conditional on a block being generated during the episode*.
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 105-118]`
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 61-95]`
State B makes the actions athlete-reachable without the S5(c)/S6(b) state that closes the defect.
Adopting State B as-is would therefore expose the documented defect to athletes for the first time.
This is recorded as `OW-025`.

**One thing State B gets right that State C does not.** The overlay adds `suspensionEpisode: null`
to `PER_ATHLETE_RESET`, which is precisely the omission confirmed against State C as `OW-003`.
Neither implementation is a superset of the other.

### 3.3 Claude C1–C5 Branch at 34f91ff

State C is State A plus exactly four commits: `a80f955` the ratified C1 docket, `f3ebab3` Migration
059, `0cd8db9` the suspension freeze and planned-load routing, and `34f91ff` the ledger record.

**Migration 059, verified at `f3ebab3`.** Three side-car tables — `suspension_episode_program`
for S5(c), `block_suspension_origin` for S6(b), and `planned_slot_load_intent` for L1(a)
`[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 35-99]`
— plus four immutability triggers
`[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 116-160]`.
The header states the side-car rationale and the no-numeric guarantee. Side-cars rather than `ALTER TABLE ADD COLUMN`, because the self-heal path
re-applies every migration and `ADD COLUMN` throws on re-apply; 058 is shipped in a QA build and is
not editable. No numeric value is introduced; every CHECK bound mirrors an existing ratified domain.
`[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 1-33]`

Seven sentinels are registered — three tables and four triggers — and both pinned migration counts
were re-pinned from 57 to 58 files, never loosened — the `verify:migrations` pin
`[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1719-1726]`
and the `verify:pipeline` pin
`[Source: packages/inference/test/verify_pipeline.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 511-520]`.
`[Source: packages/core-db/src/migrationRunner.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 190-196]`
`[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1719-1726]`

**Migration 059 exists only at State C.** State A's head is 058, and slot 059 is unallocated there.

**The claimed C0–C5 result.** The State C ledger reports `verify:ci` exit `0` with 231 tests across
18 suites; five deliberate mutation reversions with five caught, one of which escaped on the first
run and was closed by two store-side assertions; three defects found in the executor's own work by
the gates; and a QA artifact rebuilt after `verify:qa-candidate` correctly rejected the first build
for a missing gitignored model asset. C6 and C7 are recorded as open and owner-gated.
`[Source: PROMPT_LEDGER.md@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3074-3139]`

These are `REPORTED`. This task did not re-run them.

**The bounded five-finding audit.** `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` confirms
or refutes exactly the five pre-documented findings, at the immutable revision, with an
empirical database probe for two of them. Nothing was refuted:

| Finding | Verdict | Ledger item |
|---|---|---|
| L1(a) athlete-choice gap | `PARTIALLY_CONFIRMED` — persistence, fail-closed and no-dropdown-order all landed; athlete selection did not | `OW-001`, `OW-036` |
| Reset lifecycle gap | `CONFIRMED` — part (a) mitigated by `boot()`, part (b) unmitigated and empirically demonstrated | `OW-002`, `OW-003` |
| Migration 059 immutability surface and behaviour coverage | `CONFIRMED` — base table fully closed, side-cars not; zero behavioural tests | `OW-004`, `OW-005` |
| Bodyweight-fatigue branch reachability | `CONFIRMED` — unreachable in production, dose-neutral today | `OW-006` |
| Resume error-handling gap | `CONFIRMED` — resume calls `endSuspension` bare, and the error surface is not mounted in the suspended branch | `OW-007` |

The empirical probe established that 059 refuses **six** mutation classes on `suspension_episode`
and permits **two**, both deliberate: the athlete's own `ended_at_ms` NULL-to-non-NULL resume, and
deletion of a still-**open** episode — the delete trigger fires only `WHEN OLD.ended_at_ms IS NOT
NULL`, and that permission is exactly what `OW-002`'s narrowest remediation depends on.
`[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 142-152]`
A seventh refusal covers a side-car, `suspension_episode_program`'s frozen sequence index. The asymmetry is that the
side-cars are otherwise unprotected: `suspension_episode_program` can be deleted outright, and
`block_suspension_origin` accepts both update and deletion.
`[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 116-160]`

### 3.4 C6 and C7 Release Status

**C6 is `RELEASE_GATE — DEFERRED`. It has not passed, has not failed, and has not been run.**

The memory contract is a **pair** of numbers, not one:

- Preferred operating target: **450,000,000 B** (decimal MB).
- Hard ceiling, ratified 2026-08-24: **536,870,912 B**, that is 512 MiB. Exceeding it blocks release.
- An envelope **between** them is permitted only with physical-device evidence and an explicit
  review record naming it. This is the review band.

`[Source: tools/memory-audit/memory_gate.mjs@48719b07988ad30d255b0fed37f45ed5db49c935, lines 56-61]`
`[Source: tools/memory-audit/audit.mjs@48719b07988ad30d255b0fed37f45ed5db49c935, lines 173-175]`
`[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 25-29]`

The shorthand "450 MB / 512 MiB ceiling" used in revision 1 collapses a target and a limit into one
figure and loses the review band entirely. It is retracted as `RC-05`.

**The current envelope is a known value, and it is inside the review band.** The modelled component
envelope is **471,936,000 B**. That is above the 450,000,000 B preferred target and below the
536,870,912 B hard ceiling, so it sits in the ratified review band and release therefore requires a
device evidence packet; `verify:release` fails without one.
`[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 106-108]`

The owner ratification that created the band records the same figure, and states that the envelope
"exceeded [the old single 450,000,000 B ceiling] by 21,936,000 B, so the gate was honestly RED …
This record IS that ratification."
`[Source: tools/memory-audit/budget.json@48719b07988ad30d255b0fed37f45ed5db49c935, lines 40-43]`

**What is `UNKNOWN` is the device measurement, not the envelope.** The 471,936,000 B figure is a
conservative modelled envelope computed from the budget and vector files; it is not a measurement of
the candidate on hardware. Recording it as `UNKNOWN`, as the previous revision of this section did,
was wrong in the opposite direction from overclaiming: it erased the one quantity that locates the
candidate inside the band the same section describes.

**What C6 requires.** The exact release-candidate APK, a physical owner-authorized **4 GB** device,
measurement under Jetsam pressure with Android Profiler or Instruments, and an owner-signed evidence
packet. `verify:memory-contract` gates on that packet, and `verify:release` runs
`verify:ci && verify:memory-contract && verify:qa-candidate`, so `verify:release` cannot pass
without it.
`[Source: package.json@48719b07988ad30d255b0fed37f45ed5db49c935, lines 37-48]`

**A Pixel 9 Pro result does not satisfy C6.** U1's on-device checks are *functional* — bodyweight
push-up set progression, loaded-block RPE ramp, volume-phase set bias, and weighted-calisthenics
routing. They test prescription behaviour, not memory.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 78-89]`
The device they were specified against is a Pixel 9 Pro, which is not the 4 GB target.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 35-37]`
U1 and C6 are two distinct gates and are tracked separately as `RG-03` and `RG-01`.

**The absence of a 4 GB device is not a failed product test.** No memory measurement has been taken
against the candidate. `UNKNOWN` is the correct status for the *device measurement*; `REVIEW_BAND at
471,936,000 B` is the correct status for the *modelled envelope*; and `DEFERRED` is the correct
status for the gate. None of the three is a failure.

**C7 — release and push approval — is owner-only and remains open.** Nothing reaches the remote
until the owner has verified on device, and the push additionally publishes the audit archive's
author-local paths to a public repository, which the owner accepted knowingly but which makes the
push irreversible in a way it was not before.
`[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 189-192]`

**Release posture of this documentation package.** Documentation approval and release eligibility
are separate. With `OW-036` closed by the chain-floor decoupling (commit `88f5b5c`), `OW-024` closed
by the ledger-lineage crosswalk, and State-B-only `OW-025` superseded, the code-finding blockers
recorded at revision 3 are discharged. The remaining `BLOCKING` release effect in §4 is `OW-035`
(an owner-only C7 disclosure decision), and every release gate in §4.3 is owner/device/store-gated.
Gate C6 (`RELEASE_GATE — DEFERRED`) and C7 are therefore the operative blockers, not stale code
findings. The strongest truthful release handback is `NO-GO — C6 DEFERRED; C7/OWNER AND DEVICE GATES
OPEN`, never a claim that a code finding remains open when it does not.

## 4. Strict Outstanding Work Ledger

Every row cites a T0, T1 or T2 source whose span entails the statement. Independently closable
actions are split into separate rows.

**On admissibility of the State C code rows.** `OW-001`–`OW-007` concern runtime code, a
schema and a test harness. **All of these are T4 regardless of which branch they sit on** — branch location
does not raise an artifact's tier — and T4 may never originate a ledger item. A previous revision
classified the same artifact class as T4 at State A and T2 at State C; that was wrong and the
manifest §4.1 now records the correction. `OW-036` was of the same class and is now closed (§5.1);
its historical admissibility is recorded in the disposition row rather than as an open item.

These rows are admissible because their origin is not the code. Work-order §3.5 is a T0 source that
names these exact five findings and requires each to be confirmed or refuted, and
`docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` is the completed W2 admission gate that
records each disposition. That addendum does not invent findings — §3.5 forbids discovering others —
so a finding enters this ledger only when the T0 work order named it **and** the gate recorded it
open. Each row therefore cites a T0 or T1 origin, the addendum span as admission gate, and the State C
code as explicitly labelled T4 corroboration. `OW-036` additionally cites the T1 architecture-review
audit that first identified the ladder rep mismatch and the T0 docket ruling that scoped the floor,
because work-order §3.5's Finding 1 text describes the athlete-selection gap and does not by itself
state the predicate fan-out.

**On `release_effect` values.** The `release_effect` column carries the document executor's
conservative status inference, not an owner ruling and not a verdict of the W2 audit. The addendum
establishes facts and expressly reserves blocking decisions to the owner. `OW-036` was marked
`BLOCKING` because its consequence was an unratified dose change to a shipped progression path; the
State C push-ready remediation closed it (commit `88f5b5c`, disposition in §5.1), so no BLOCKING
inference attaches to it in this revision. `OW-001` remains `NON_BLOCKING` on dose grounds: with the
rep-floor consequence carved out into the now-closed `OW-036`, its residual effect is that an
undeclared slot takes the flat loaded set schedule instead of the bodyweight 4→5→5 ramp — fewer
sets, violating no ratified constraint. It is **not** justified by
"failing closed as L1(a) mandates": that clause is scoped to missing *legacy* state, and L1(a)
separately requires athlete selection, so a permanently undeclarable movement is the defect rather
than the remedy. Two independent reviewers adjudicated that split in round 3 and affirmed both
values. Either answer would leave the release posture unchanged, because C6 is independently
deferred.

**ID gaps are deliberate.** `OW-015`, `OW-016`, `OW-021`, `OW-024`, `OW-025` and `OW-036` are all
absent from §4.1: `OW-015`, `OW-016` and `OW-021` were closed during remediation after an
independent reviewer proved each condition no longer held at its own `as_of_revision`; `OW-024` was
closed by the ledger-lineage crosswalk and `OW-025` superseded as State-B-only in revision 4; and
`OW-036` was closed by the chain-floor decoupling at commit `88f5b5c`. All six dispositions are in
§5.1. IDs are never reused.

### 4.1 Open Defects and Tasks

| work_id | status | statement | state_scope | source_date | as_of_revision | citation | supersedes | superseded_by | verification | release_effect |
|---|---|---|---|---|---|---|---|---|---|---|
| `OW-001` | OPEN | Provide an athlete-facing per-slot implement selection for multi-prefix movements, writing to the existing `planned_slot_load_intent`. L1(a)'s "ambiguous mixed movements require athlete selection" clause has no implementation; ambiguous slots are permanently undeclared and permanently loaded. Scoped to the athlete-selection surface only; the chain-floor regression it causes at State C is independently closable and is tracked as `OW-036`. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 191-191; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 63-157; captured 2026-08-31]`; T0 ruling `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 452-452]`; T4 corroboration `[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 844-862]` | NONE | NONE | CODE_CONFIRMED | NON_BLOCKING |
| `OW-002` | OPEN | `resetTrainingData` leaves the athlete suspended at a frozen index whose block history was wiped, and does not refresh suspension state. Deleting only the open episode is required; a blanket delete is refused by 059 and rolls back the whole reset. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 192-192; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 158-226; captured 2026-08-31]`; T4 corroboration `[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 6078-6156]` and `[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 147-152]` | NONE | NONE | TEST_CONFIRMED | NON_BLOCKING |
| `OW-003` | OPEN | Add `suspension: null` to `PER_ATHLETE_RESET`. Every other per-athlete field is cleared; suspension is not, leaving the previous athlete's episode resident during the boot window and after a boot failure. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 192-192; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 158-226; captured 2026-08-31]`; T4 corroboration `[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2053-2060]` | NONE | NONE | CODE_CONFIRMED | NON_BLOCKING |
| `OW-005` | OPEN | Add a `[059]` behavioural section to `verify_migrations.mjs` asserting each trigger refusal, the one permitted transition, and 059 self-heal restoration. Sentinel registration exists; no test exercises any of the four triggers. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 193-193; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 229-295; captured 2026-08-31]`; T4 corroboration `[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1932-1997]` | NONE | NONE | TEST_CONFIRMED | NON_BLOCKING |
| `OW-006` | OPEN | Compute `bodyweightDominant` from the movements placed into the block's slots rather than the whole available pool, or delete the branch. As written it requires every catalogue movement to be planned bodyweight, so it is unreachable in production and a ratified bodyweight coefficient would still not take effect. Dose-neutral today. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 194-194; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 296-332; captured 2026-08-31]`; T4 corroboration `[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 671-682]` and `[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3041-3056]` | NONE | NONE | CODE_CONFIRMED | NON_BLOCKING |
| `OW-007` | OPEN | Wrap the suspension resume action in the same action-scoped `try/catch` the entry action uses, and mount an error node inside the suspended branch. A database error on resume currently escapes with no athlete-visible message. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 195-195; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 335-367; captured 2026-08-31]`; T4 corroboration `[Source: apps/mobile/src/screens/BlockScreen.tsx@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 471-517]` | NONE | NONE | CODE_CONFIRMED | NON_BLOCKING |
| `OW-008` | OPEN | Resolve the dead `athlete_profile.progression_methodology` column (U6/WO-01): stored, typed, validated and hydrated, but read by no planner, and a second vocabulary competing with `schemaType`. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 137-142]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-009` | OPEN | Re-scope WO-02 (U5). Its HIGH-confidence claim that the progression engine is unwired is false — at State A `resolveActiveRung` is imported at `useStore.ts:140` and called at `:2598` and `:2600`; the handover's own locators `:138`, `:2568` and `:2570` do not resolve there and are not reproduced as current. A narrower session-completion UI gap may survive at reduced priority. | State A | 2026-08-27 | `48719b0` | Origin `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 131-135]`; T4 corroboration for the corrected locators `[Source: apps/mobile/src/state/useStore.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 136-143]`, `[Source: apps/mobile/src/state/useStore.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 2565-2570]`, and `[Source: apps/mobile/src/state/useStore.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 2595-2601]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-010` | OPEN | Withdraw or re-scope WO-04 (U4). It proposes persisting e1RM while citing Decision 1 — which ratified option (a), explicitly forbidding persistence — as its authority. The product risk is already held closed by a live removal guard; the residue is the paperwork. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 123-129]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-011` | OPEN | Close the `verify_store_sql.mjs` `SCHEMA_FILES` gap for migration 057 (U8). The omission is deliberate and documented in the file itself, and closing it has its own blast radius — so this is scoped work, not an oversight to be silently patched. | State A and C | 2026-08-27 | `48719b0`, still open at `34f91ff` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 167-168]` | NONE | NONE | CODE_CONFIRMED | NON_BLOCKING |
| `OW-012` | OPEN | Add the drafted P3-1 prompt-ledger capture-at-issue-time convention to `AGENT_WORKFLOW.md` (U8). Drafted, never applied. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 169-170]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-013` | OPEN | Correct RR-01's recorded rationale (U8). Option A was signed on the basis that calisthenics "inherently produce lower systemic CNS fatigue" with no source locator. The ruling stands; the unsourced reason should not sit in a decision record as though it were evidence. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 171-173]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-014` | OPEN | Bodyweight work contributes zero tonnage to `mech_daily`, ACWR and `state_vector.load_component`, because `set_record.tonnage_kg` is generated as `reps * load_kg`. Impact concentrates in the beginner path. Remediation needs a separately ratified effective-load model; no coefficient may be invented. | State A | 2026-07-31 | `48719b0` | `[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 142-154]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-017` | OPEN | Prefix-encoded variants such as Barbell Glute Bridge and Barbell Walking Lunge carry a barbell demand invisible to the equipment filter. Inherited from the 010 model and scoped for a future per-prefix-equipment design. | State A | 2026-07-13 | `48719b0` | `[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 593-598]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-018` | OPEN | All 176 Phase 2a v2 coaching intents share one generated template. Recorded as a corpus-wide P2 against the v2 generator and deliberately not rewritten in 049. | State A | 2026-08-11 | `48719b0` | `[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 95-98]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-019` | OPEN | Composition of `deriveDailyAdjustment` into the live prescription path is deferred as a separate, higher-risk integration warranting its own step and safety review. | State A | 2026-06-15 | `48719b0` | `[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 298-307]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-020` | OPEN | Correct the `TRAINING_PROGRESSION_LAYERS.md` §8 Settled row dated 2026-08-27 to reflect the L2(b) ruling. The row records an agent-authored scope broadening as settled; the C1 docket retracts that framing and flags the correction as outside its own write boundary. | State A, ruled at State C | 2026-08-29 | `a80f955` | `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 419-425]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |
| `OW-022` | OPEN | Correct `docs/PROPOSAL_suspended_state_trigger.md` §2.1, whose table sketch names `resumed_macro_index` where the shipped 058 column is `frozen_macro_index` — same role, different name. | State A | 2026-08-29 | `a80f955` | `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 416-417]` | NONE — re-scoped onto a different defect; see §5.1 | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-023` | OPEN | A Duration-horizon program converts weeks to a concrete date and is visually indistinguishable from a Date-horizon program. Decide whether to display relative duration instead, or whether the uniform date presentation is intentional. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 325-331]` | NONE | NONE | DOCUMENT_ONLY | NON_BLOCKING |

### 4.2 Parked and Owner-Only Decisions

| work_id | status | statement | state_scope | source_date | as_of_revision | citation | supersedes | superseded_by | verification | release_effect |
|---|---|---|---|---|---|---|---|---|---|---|
| `OW-004` | OWNER_ONLY | Decide and implement mutation protection for the 059 side-cars. `block_suspension_origin` accepts both update and delete, and `suspension_episode_program` accepts delete, so the S6(b) attribution that closes P1-1 can be silently removed or re-pointed. Requires a Migration 060, therefore owner authorization. | State C | 2026-08-29 | `34f91ff` | Origin `[Working-tree source: docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md; SHA-256 687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec; lines 193-193; captured 2026-08-31]`; admission gate `[Working-tree source: docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md; SHA-256 9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155; lines 229-295; captured 2026-08-31]`; T4 corroboration `[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 116-160]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | NON_BLOCKING |
| `OW-026` | OWNER_ONLY | Ratify or decline a bodyweight CNS fatigue coefficient. `SCHEMA_FATIGUE_COST_BODYWEIGHT` is a deliberate alias of the loaded table. Disclosed exposure: a hybrid athlete on bodyweight LINEAR receives the week 2–3 set with no accessory-tax adjustment, bounded to hybrid athletes, bodyweight slots, weeks 2–3, one set. | State A and C | 2026-08-27 | `48719b0` | `[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 309-319]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | NON_BLOCKING |
| `OW-027` | PARKED | RR-03 competition taper and non-7-day micro-cycle architecture (9-, 12- and 14-day), scoped as a phase, not a work order. Blast radius covers `BLOCK_WEEKS`, `SCHEMA_WEEKS`, `week_index` CHECK domains, the autopilot 21-day window, session runner and calendar. Its figures stay quarantined. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 144-163]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-028` | PARKED | The owner-directed e1RM disclosure path gated to advanced athletes is unratified and must not be built without an honest precision statement or separate ratification. Decision 1 ratified the series dormant. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 30-44]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-029` | PARKED | Hard-set count stays internal until a later work order exists for descriptive display (Decision 2, option b). Any future display must present it as an effort count, not a validated measure of effective volume. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 61-75]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-030` | PARKED | A future phase designs an own-data repeatability measurement protocol for later ratification (Decision 3, option b). Stagnation detection stays out of scope until it lands. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 92-104]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-031` | PARKED | The progression-control safety brief is authorized as plan only and deferred until further notice (Decision 4, option b). No control design, code, schema, migration or work order is authorized. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 156-171]` | NONE | NONE | DOCUMENT_ONLY | OUTSIDE_RELEASE |
| `OW-032` | OWNER_ONLY | Decide whether removing a competition date should return a program to the standard rotation. Switching from Date to Duration retains the date-derived `starting_macro_block_index`, so an athlete keeps a competition-shaped phase sequence with nothing on screen explaining why. | State A | 2026-08-27 | `48719b0` | `[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 332-338]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | NON_BLOCKING |
| `OW-033` | OWNER_ONLY | Rule on the prompt-ledger whitespace conflict: keep prompt bytes verbatim and record a standing `git diff --check` exception for ledger entries, or normalize trailing whitespace on paste and note the normalization inside the entry. Held at the first option pending a ruling. | Cross-state | 2026-08-29 | `a80f955` | `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 427-435]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | NON_BLOCKING |
| `OW-034` | OWNER_ONLY | Rule on whether a whole-athlete training-data reset should preserve closed suspension episodes. M1(a) forbids blocking explicit whole-athlete erasure, and 059 records that such erasure deletes the database file rather than rows — so the reset's correct treatment of history is an owner question, not an executor's. | State C | 2026-08-29 | `a80f955` | `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 454-454]` and `[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 142-146]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | NON_BLOCKING |
| `OW-035` | OWNER_ONLY | Record the S3(a) competition-horizon behaviour as a disclosed release exception in the C7 handback, alongside any M1 residue. Ratified as an exception rather than code. | State C | 2026-08-29 | `a80f955` | `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 467-468]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |

### 4.3 Release Gates

| work_id | status | statement | state_scope | source_date | as_of_revision | citation | supersedes | superseded_by | verification | release_effect |
|---|---|---|---|---|---|---|---|---|---|---|
| `RG-01` | RELEASE_GATE | **C6 — DEFERRED.** Validate the 536,870,912 B hard ceiling, against a 450,000,000 B preferred target, on a physical owner-authorized 4 GB device under Jetsam pressure, with Android Profiler or Instruments, for the exact candidate. Not run. The modelled component envelope is 471,936,000 B, inside the ratified review band, so a device evidence packet is required and `verify:release` fails without one; the device measurement itself is `UNKNOWN`. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 25-29]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-02` | RELEASE_GATE | **C7 — owner push and release approval.** Nothing reaches the remote until the owner has verified on device; the push also publishes author-local archive paths to a public repository and is irreversible. | Cross-state | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 189-192]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-03` | RELEASE_GATE | **U1 — owner functional on-device verification**, distinct from C6: bodyweight push-up **8 reps** with sets 4→5→5 across weeks 1–3 and week 4 dropping to 2; loaded blocks flat at 4 sets with RPE ramp [7.5, 8.0, 8.5] (noting historical handover checklist expected 7→7.5→8) and reps not forced to 8; volume-phase primaries carrying strictly more sets than accessories; weighted calisthenics behaving as loaded. **These expectations were written against State A routing and the checklist must be re-derived against whichever candidate is actually built.** Two rows change at State C. The push-up row's ramp and its 8-rep floor both lapse, because Push-up is no longer classified bodyweight. The weighted-calisthenics row moves the other way and **improves**: it fails at State A, where `primaryImplement = supportedPrefixes[0]` routes Weighted Pull-up as bodyweight, and passes at State C. State C is not uniformly regressive against U1. | State A | 2026-08-27 | `48719b0` | `[Source: HANDOVER_2026-08-27_SOL.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 78-89]` and `[Source: packages/inference/src/blockGenerator.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 346-355]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-04` | RELEASE_GATE | Crash-free QA on real devices on both platforms, including a full workout session, backgrounding, and cold-start resume against the existing crash-recovery path. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 30-32]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-05` | RELEASE_GATE | Produce the device build and screenshots with Archivo confirmed rendering — the outstanding checkpoint bundle. No screen has a confirmed device build. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 20-22]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-06` | RELEASE_GATE | Confirm the app is fully functional with no Health Connect data, end to end, since iOS has no HealthKit library wired and the UI already claims the coach works fully without it. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 33-36]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-07` | RELEASE_GATE | Google Play Health Apps Declaration plus a written justification for **each** Health Connect data type read — HRV, resting heart rate, sleep, SpO2 — under the January 2026 enforcement, including Medical-Device labeling navigation. Can block publishing independently of code. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 58-64]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-08` | RELEASE_GATE | Publish a privacy policy at a public URL, required by both stores once health data is involved. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 51-52]` | Split from revision-3 `RG-08` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-19` | RELEASE_GATE | Complete Apple App Privacy labels declaring data handling, matching actual runtime behaviour. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 53-55]` | Split from revision-3 `RG-08` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-20` | RELEASE_GATE | Complete the Google Data Safety form, consistent with actual runtime behaviour. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 56-57]` | Split from revision-3 `RG-08` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-09` | RELEASE_GATE | Build iOS with the iOS 26 SDK, mandatory for new submissions from 28 April 2026. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 43-44]` | Split from revision-3 `RG-09` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-21` | RELEASE_GATE | Target Android API 35 now; API 36 is required for new apps and updates from 31 August 2026. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 45-46]` | Split from revision-3 `RG-09` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-10` | RELEASE_GATE | Apple Developer Program membership and an App Store Connect app record. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 39-39]` | Split from revision-3 `RG-10` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-22` | RELEASE_GATE | Google Play Developer account and a Play Console app record. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 40-40]` | Split from revision-3 `RG-10` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-23` | RELEASE_GATE | Unique bundle identifiers and package names, plus signing material: iOS certificates and provisioning, Android Play App Signing and upload key. Owner-only credentials. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 41-42]` | Split from revision-3 `RG-10` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-11` | RELEASE_GATE | Full native `verify:all` green on a real machine. The checklist marks this a required gate, not a formality, noting it has already caught a real Law-6 regression. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 23-24]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-12` | RELEASE_GATE | Close the open UI work orders WO-UI-2..5, all recorded as "conditional GO" with none committed. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 19-20]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-13` | RELEASE_GATE | Add clear, visible disclaimers: not medical advice, not a medical device, not a substitute for professional judgment. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 78-81]` | Split from revision-3 `RG-13` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-24` | RELEASE_GATE | Declare regulatory status where prompted: Apple's Health/Fitness regulatory-status field and Google's Medical-Device labeling. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 82-83]` | Split from revision-3 `RG-13` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-14` | RELEASE_GATE | Obtain a one-time professional review of the privacy policy and disclaimer language, since the app touches health data and issues recommendations. Owner-only; explicitly outside agent competence. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 84-86]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-15` | RELEASE_GATE | Support URL and contact, marketing name, description and keywords, avoiding misleading metadata. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 89-90]` | Split from revision-3 `RG-15` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-25` | RELEASE_GATE | Complete the age-rating questionnaires for both stores. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 91-91]` | Split from revision-3 `RG-15` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-26` | RELEASE_GATE | Terms of Use if any account or Coach Mode sharing exists; the app does not cloud-share, which keeps this light. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 92-93]` | Split from revision-3 `RG-15` | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-16` | RELEASE_GATE | Beta before public: iOS TestFlight and Play internal-to-open testing, used to confirm the memory ceiling and crash-free rate on the actual device matrix, especially the 4 GB legacy target. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 96-99]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-17` | RELEASE_GATE | App icons, launch screen, version and build numbers, store listing metadata and per-store screenshots. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 47-48]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |
| `RG-18` | RELEASE_GATE | Health permission strings and plain-language rationale UI on the Android Health Connect permission screen. | Cross-state | 2026-08-25 | `48719b0` | `[Source: RELEASE_READINESS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 65-66]` | NONE | NONE | OWNER_EVIDENCE_REQUIRED | BLOCKING |

## 5. Closed, Superseded, Retracted, and External Register

Nothing here is deleted. Each entry names why it left the strict ledger and what superseded it.

### 5.1 Closed and Superseded

| Former item | Disposition | Reason and superseding source |
|---|---|---|
| Revision 1 item 6 — push-up force values quarantined | `CLOSED — RATIFIED` | Decision 5 was ratified 2026-08-26 as option (a), do not pursue. This is a standing constraint recorded in §2.3, not executable work. Option (b) remains available if the values later become product-critical. `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 189-199]` |
| Revision 1 item 7 — evidence archive durability | `CLOSED — RATIFIED` | Decision 6 ratified indefinite in-repo preservation. A maintained `-text` git attribute is an existing standing condition, not an open task. `[Source: docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 215-241]` |
| Revision 1 item 22 — background database replacement re-hydration | `SUPERSEDED, then INADMISSIBLE` | The boot half is closed at State C, where `boot()` calls `refreshSuspension()` `[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2195-2195]`, and independently at State B. The residual foregrounding half rests solely on a T3 handoff and may not originate a ledger item under §0.3. |
| Revision 1 item 23 — physical touch and screen-reader QA | `SPLIT` | The device-QA requirement is admissible and is retained as `RG-04`. The TalkBack-specific claim rests solely on T3 handoffs, one of which was cited out of bounds, and may not originate a ledger item. |
| Revision 1 item 12, second bullet | `RETAINED, SPLIT` | Revision 1 bundled two independent actions in one row and omitted a third from the same source unit. Split into `OW-011`, `OW-012` and `OW-013`. |
| Revision 1 item 20 | `SPLIT, THEN BOTH CLOSED` | Split into `OW-021` (the `getMovementE1rmSeries` half) and `OW-022` (the naming half). Both halves were subsequently found already fixed at State A and are dispositioned in the two rows below; `OW-022` was re-scoped onto a different, still-live defect in `docs/PROPOSAL_suspended_state_trigger.md` and no longer supersedes item 20. |
| Revision 1 item 25 — memory ceiling wording | `SUPERSEDED` | Restated with the exact ratified pair and the review band as `RG-01`; see §3.4. |
| Revision 1 item 24 — Pixel 9 Pro verification | `SUPERSEDED` | Split from C6 and restated as `RG-03`, a functional gate. A Pixel 9 Pro result does not satisfy the 4 GB memory criterion. |
| Revision 1 item 29 — KineStrike hardware | `EXTERNAL` | Moved to §5.3. |
| Revision 3 `OW-015` — mid-cycle regeneration target matching | `CLOSED` | The condition does not exist at its own `as_of_revision`. The trailing-window aggregate joins the per-set snapshot `LEFT JOIN set_target st ON st.set_id = sr.set_id`, not a `MIN(target_rpe)`-by-(date, movement) join `[Source: apps/mobile/src/state/useStore.ts@48719b07988ad30d255b0fed37f45ed5db49c935, lines 3114-3125]`, and State A carries a live regression gate asserting that an overlapping archived plan does not corrupt the delta `[Source: apps/mobile/test/verify_store_sql.mjs@48719b07988ad30d255b0fed37f45ed5db49c935, lines 539-548]`. Migration 022 replaced the old join. The `DEVIATION_LOG.md` citation still resolved because it is a 2026-06-15 Phase 13 accepted limitation that 022 superseded — the third stale-current row found by an independent reviewer, and the reason §4's preamble now warns the next one to hunt for a fourth. |
| Revision 2 `OW-016` — restate the Autopilot C3 aggregates | `CLOSED` | The demanded restatement is already recorded in the document the row named. `DEVIATION_LOG.md` carries "**C3 aggregates restated under the corrected applied-block classifier** … changed the primary headlines from 14 to 7 limit cycles and from 1,711 to 1,687 saturated cases: 1,445 upward and 242 downward" `[Source: DEVIATION_LOG.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 183-188]`. `1,505` appears in neither cited file at State A, and `RELEASE_READINESS.md` carries no C3 aggregate. The row survived only because its `AUDIT_C6B` citation still resolved — the same stale-current failure as `OW-021`. Caught by an independent reviewer in round 2. |
| Revision 1 item 20, `getMovementE1rmSeries` half; carried into revision 2 as `OW-021` | `CLOSED` | The condition no longer holds at its own `as_of_revision`. `git grep -n "getMovementE1rmSeries" 48719b0` returns zero hits in `TRAINING_PROGRESSION_LAYERS.md`; the file carries corrected wording at `[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 206-212]`. The research audit that reports it is pinned to baseline `368e82d` and is stale relative to State A. Removed from §4.1 during remediation after an independent reviewer caught it. |
| Revision 1 item 20, "migration 057" half | `CLOSED` | Already corrected at State A: `TRAINING_PROGRESSION_LAYERS.md` §8 item 1 says slot **058**, "since `057_block_meta_phase_invariant.sql` now occupies 057" `[Source: docs/decisions/TRAINING_PROGRESSION_LAYERS.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 293-294]`. The source that requested the correction is itself now stale `[Source: docs/PROPOSAL_suspended_state_trigger.md@48719b07988ad30d255b0fed37f45ed5db49c935, lines 134-137]`. `OW-022` was re-scoped onto the `resumed_macro_index` naming discrepancy, which is still live. |
| Revision 1 item 8 — WO-04 withdrawal | `RETAINED as OW-010` | Named by work-order §3.7 for explicit re-evaluation. It is not a completed withdrawal: no repository artifact records one, and WO-04 is not a repository file — it originates in the external review `8b4e75b`. The product risk is separately held closed by a live removal guard asserting `!src.includes('getMovementE1rmSeries')` `[Source: apps/mobile/test/verify_store_sql.mjs@48719b07988ad30d255b0fed37f45ed5db49c935, lines 689-689]`, still present at State C `[Source: apps/mobile/test/verify_store_sql.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 701-701]`, so only the administrative withdrawal remains open. |
| Revision 4 `OW-036` — one predicate gating three behaviours | `CLOSED` | The chain-floor regression is closed by commit `88f5b5c` (`fix(progression): decouple chain rep floor from load routing`). `bodyweightRepsFor` became `chainScopedRepsFor`, keyed on chain membership (`m.progressionGroup !== undefined`) and applied to every slot; `isPurelyBodyweight` now controls only Option C set routing `[Source: packages/inference/src/blockGenerator.ts@88f5b5c72271f34df04a88c9817f63a128e8bcdf, lines 765-775]`. The TDD packet extended §[28] of `verify_blocks.mjs` with bodyweight, explicit-loaded, undeclared, custom per-chain policy, off-chain and deload cases, all green with the fixed engine `[Source: packages/inference/test/verify_blocks.mjs@88f5b5c72271f34df04a88c9817f63a128e8bcdf, lines 2070-2085]`. The mutation proof (temporary restoration of the old `bodyweightSlot ? floor : reps` coupling) reproduced the four targeted failures, and restoring the correct bytes returned the gate to green; no mutant bytes are committed. |
| Revision 4 `OW-024` — reconcile the two divergent ledger lineages | `CLOSED` | The two lineages are reconciled without blending entry numbers. The divergent audit ledger is archived byte-for-byte at `docs/audits/state-c-release-readiness/lineage/PROMPT_LEDGER_AUDIT_LINEAGE_1A878602.md` (3,942 lines, SHA-256 `1a878602…`) `[Working-tree source: docs/audits/state-c-release-readiness/lineage/PROMPT_LEDGER_AUDIT_LINEAGE_1A878602.md; SHA-256 1a8786020be1eef107a1b3c8b6e1d02ff7826b688e67789adaf1414bc8e5c3b0; lines 1-3942; captured 2026-08-31]` and namespaced in `docs/audits/state-c-release-readiness/LEDGER_LINEAGE_CROSSWALK.md` as `CANON-0055…0058` versus `AUD-0055…0065` with no merge or renumber `[Working-tree source: docs/audits/state-c-release-readiness/LEDGER_LINEAGE_CROSSWALK.md; SHA-256 c73354c8ef244abac72c6599da9c3ae954178ce4ad58f97a5b3ae5ba974fb959; lines 1-48; captured 2026-08-31]`. Only canonical Entry 0058 is the live execution record; archived Entry 0065's two-Output defect is historical evidence only. |
| Revision 4 `OW-025` — do not adopt the State B overlay without S5(c)/S6(b) | `SUPERSEDED` | The chosen candidate is State C at `34f91ff` plus the push-ready commits, which carries S5(c)/S6(b) via Migration 059 and deliberately excludes the State B working-tree overlay (A1 "adopt none"). The overlay's position-consumption defect cannot be exposed because the overlay is not adopted; the docket's conditional exposure is thereby closed `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 61-95]` `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 105-118]`. The archived State B snapshot remains preserved as external evidence, not as a candidate. |

### 5.2 Retracted Claims

Revision 1 of this document made the following claims. Each is withdrawn, with the evidence that
withdraws it.

| ID | Retracted claim | Why |
|---|---|---|
| `RC-01` | "Working tree is on branch `codex/progression-evidence-remediation` at commit `48719b0` (containing Migration 058, Option C, RR-04, and Task U3 UI)" — revision 1 line 367. | `git cat-file -e 48719b0:<path>` returns `ABSENT` for `SuspensionCard.tsx`, `SuspensionSheet.tsx` and `SuspensionUI.test.js`. The Task U3 UI is not in that commit. |
| `RC-02` | Nine whole-document citations spanning lines 1–N where the file has N−1 lines — for example `AUDIT_REPORT.md, lines 1-138` against a 137-line file. | A mechanical bounds check of revision 1 found 11 citations out of bounds, 80 in bounds and 3 that resolved only outside the worktree. The count convention was undeclared; this document declares it in the manifest §0.2. |
| `RC-03` | "The repository houses 60 distinct historical audit documents… Complete 60-Document Repository Inventory" — revision 1 lines 34–36. | The list mixed tracked historical files, newly generated untracked `.agents/` artifacts, the untracked synthesis itself, and one document outside the worktree, with no stated discovery rule. §1.1 replaces it with a reproducible rule and declared exclusions. |
| `RC-04` | "The current repository state is verified 100% green across all automated verification suites" — revision 1 line 9. | No tree fingerprint was named, the evidence spanned three different states, and some cited commands rely on untracked scripts. §6.1 replaces the claim with per-state gate rows. |
| `RC-05` | "450 MB / 512 MiB ceiling" as a single invariant. | The contract is a pair — a 450,000,000 B preferred target and a 536,870,912 B hard ceiling — with a review band between them requiring device evidence and an explicit review record. See §3.4. |
| `RC-06` | Attribution of Task U3 design tokens (`#EFC94C`), touch targets (56pt), and screen wiring to `.agents/sentinel/handoff.md` lines 7, 8, and 9–10. | Those lines describe agent routing, exploratory-agent deployment, and the review pipeline, not UI properties. While the attribution was incorrect, the underlying UI claims are physically real and restored in §3.2 with valid source citations: `#EFC94C` in `theme.ts:22` and `SuspensionCard.tsx:110`, `56pt` min touch targets in `theme.ts:42` and `SuspensionSheet.tsx:7`, and the Migration 058 partial unique index and triggers in `058_suspension_episode.sql:49-88`. |
| `RC-07` | A citation to `.agents/sentinel/handoff.md` lines 24–25. | That file has 23 lines. |
| `RC-08` | `.agents/sentinel/handoff.md` recorded as 33 lines with content about 23/23 CI gates and 233/233 component tests. | The file is 23 lines and contains none of those figures. |
| `RC-09` | A citation to `.agents/AUDIT_REPORT.md` lines 163–164. | That file has 163 lines. |
| `RC-10` | Three citations resolving `KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md` as an in-worktree path. | The file exists only at the parent checkout root and is untracked there. Revision 1 reached it by fallback path resolution. |
| `RC-11` | The migration verifier described as "57 sequential migration files (`001`–`058`) … PASS (57/57 Migrations)". | The pinned count at State A is 57 files reaching `user_version 57`; at State C it is re-pinned to 58 files reaching `user_version 58`. The revision-1 row states a count from one state against a range from another. |
| `RC-12` | Task U3 represented as complete without distinguishing the two implementations. | States B and C carry different components, different store field names, different screens, and different underlying migrations. See §3.2 and §3.3. |

### 5.3 External Roadmaps

The KineStrike mechatronic system is a separate project. Its audit report lives at the parent
checkout root, outside this repository's worktree, and is untracked there. It is recorded here so
that no reader mistakes it for Athlete App release work, and it originates no ledger item.

`[External source: C:\Users\fpike\Documents\Claude Coding\Athlete App\KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md; SHA-256 6a7be0f8f6d0d1119765b7d3b100537c5aad2e4e47f0f37b39c0025fbabf17f8; lines 428-441; captured 2026-08-30]`

Its Milestone 2 section schedules charge-amplifier bench testing and ATmega2560 firmware
verification. Two further corrections to revision 1's reading of it: the document states that
migration `060_gait_telemetry.sql` **"now provides"** bounded local storage and deterministic
rollups — a completed item, not outstanding work — and that a binary serial packet unpacker
**"may"** later write and visualize evidence subject to a constraint, which is a conditional
permission, not a scheduled task. Revision 1 presented both as outstanding Athlete App work.

That external document's use of migration slot `060` is its own project's numbering and has no
bearing on the Athlete App migration chain, whose head is 058 at State A and 059 at State C.

## 6. Verification Record

### 6.1 Mechanical Verification

Every row states the state it applies to. No row certifies a different state.

| Check | state_id | commit / fingerprint | command | executed_at | exit / result | observed | label |
|---|---|---|---|---|---|---|---|
| Task U3 files absent at State A | A | `48719b0` | `git cat-file -e 48719b0:<path>` | 2026-08-31 | **128** (non-zero = absent) | 3 of 3 `ABSENT` | OBSERVED |
| State C commit set | C | `48719b0..34f91ff` | `git log --oneline` | 2026-08-30 | 0 | exactly 4 commits | OBSERVED |
| 059 schema applies | C | `34f91ff` schema blobs | scratchpad `node:sqlite` probe | 2026-08-30 | 0 | 59/59 **schema files** applied; 3 tables + 4 triggers present | OBSERVED |
| 059 mutation surface | C | `34f91ff` schema blobs | scratchpad probe, sections A–D | 2026-08-30 | 0 | 7 refusals; 2 permitted on `suspension_episode` (resume, and delete of an open episode); 3 unprotected side-car mutation classes | OBSERVED |
| Reset cascade behaviour | C | `34f91ff` schema blobs | scratchpad probe, section C | 2026-08-30 | 0 | open episode survives; both side-cars cascade to 0 | OBSERVED |
| 059 behavioural coverage | C | `34f91ff` | `git grep` over 4 trigger names and 4 abort messages | 2026-08-30 | 0 | 0 test matches | OBSERVED |
| Revision 1 citation bounds | B | revision-1 SHA-256 `bf3f4961…` | scratchpad citation checker | 2026-08-30 | 0 | 80 in bounds, 11 out of bounds, 3 external-only | OBSERVED |
| Corpus totals | A, B | `48719b0` + worktree | `git ls-tree`, `git ls-files --others --exclude-standard`, `git diff --name-only` | 2026-08-31 | 0 | Corpus A 62 of 117 tracked; B 9; C 213 (re-counted at the GLM-5.3 freeze); D 16 changed files of which 2 Markdown; E 1; 222 untracked Markdown total | OBSERVED |
| `verify:ci` at State C | C | `34f91ff` | `npm run verify:ci` | 2026-08-29 | exit 0 | 231 tests, 18 suites | **REPORTED** |
| `verify:ci` at State A | A | `48719b0` | `npm run verify:ci` | 2026-08-29 | exit 0 | 17 suites / 218 tests, per `[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 29-29]` | **REPORTED** |
| Teamwork-run gate claims | B | untracked overlay, unfingerprinted | `npm run verify:ci` and others | 2026-08-30 | reported PASS | 23 gates, 233 tests | **REPORTED** |
| Augmented W4, continuation R3 | doc package | final candidate hashes below | scratchpad `w4aug.mjs` | 2026-08-31 | 0 | **36/36 checks pass**; 163 citations resolve, hash-match and are in bounds | OBSERVED |
| Tier contract (CR-01) | doc package | manifest final | `w4aug.mjs` code/test/schema tier scan | 2026-08-31 | 0 | 13 of 13 code/test/schema sources at T4; T2 has 0 rows | OBSERVED |
| Discovery reproducibility (CR-03) | A, B, C | `48719b0`, worktree, `48719b0..34f91ff` | the manifest's own printed commands | 2026-08-31 | 0 | A 62/117, B 9, C 213 (mutable T3 corpus re-counted at the GLM-5.3 freeze), D 16 changed / 2 Markdown, 222 untracked Markdown — every declared count reproduced at the freeze | OBSERVED |
| Write boundary | worktree | n/a | `git diff --check`, `sha256sum` | 2026-08-31 | 0 | `PROMPT_LEDGER.md` clean; all six dirty product files byte-identical to the R0 baseline | OBSERVED |
| State C push-ready chain-floor decoupling | C+ | `88f5b5c` | `npm run verify:blocks` (post-fix) | 2026-08-31 | 0 | ALL CHECKS PASSED — §[28] bodyweight/loaded/undeclared/custom/off-chain/deload cases green | OBSERVED |
| OW-036 mutation proof | C+ | `88f5b5c` (restored mutant) | `npm run verify:blocks` | 2026-08-31 | non-zero | 4 targeted failures on the restored `bodyweightSlot ? floor : reps` coupling; correct bytes restored and re-run green | OBSERVED |
| Push-ready gate suite | C+ | `88f5b5c` | `typecheck`, `verify:blocks`, `verify:migrations`, `verify:store`, `verify:components`, `verify:ci` | 2026-08-31 | 0 | typecheck, blocks, migrations, store, components and the full `verify:ci` aggregate all exit 0; 231 tests / 18 suites | OBSERVED |
| `verify:memory-contract` (closed gate) | C+ | `88f5b5c` | `npm run verify:memory-contract` | 2026-08-31 | 1 | 2 CHECK(S) FAILED — expected closed-gate outcome; C6 remains `RELEASE_GATE — DEFERRED` | OBSERVED |
| Tracked State C verifier | doc package | revision-4 fingerprint | `node tools/audit/verify_state_c_release_evidence.mjs` | 2026-08-31 | 0 | 18/18 checks green; `--self-test` 7/7 probes fail as intended | OBSERVED |

The three `REPORTED` rows were not re-run by this task. The last one in particular cannot be tied to
a fingerprint: it was executed against a mutable untracked overlay whose contents were not hashed at
execution time, and two of its cited harnesses are themselves untracked scripts. It is recorded as
history, not as certification of any state.

The original audit-synthesis task (revisions 1–3) did not run the product suite, per work-order §3.10.
The State C push-ready candidate (revision 4, commit `88f5b5c`) did: `typecheck`, `verify:blocks`,
`verify:migrations`, `verify:store`, `verify:components` and the full `verify:ci` aggregate all exited
0, `verify:memory-contract` exited 1 as the expected closed-gate check, and the tracked State C
verifier passed 18/18 with 7/7 self-test probes (see the revision-4 rows above).

**Schema conformance of this document:** exactly one H1; headings limited to H1, H2 and H3; no
heading-level jumps; unique `OW-*`, `RG-*`, `RC-*` and `S-*` identifiers; every §4 row carries an
admissible T0/T1/T2 citation; no §4 row rests on a T3, T4 or T5 source.

### 6.2 Independent Review Verdicts

Two independent read-only reviews are required by work-order §3.13 and §4.6.

| Round | Reviewer | Charter | Verdict |
|---|---|---|---|
| 1 | Reviewer A | Strict outstanding-ledger provenance: every §4 claim, status and citation, verified against primary sources with semantic entailment, not line bounds alone | **REQUEST_CHANGES** |
| 1 | Reviewer B | Option C, RR-04, Task U3 State B, Claude State C, Migration 058/059 separation, owner rulings, and C6 status | **REQUEST_CHANGES** |
| 2, aborted | Reviewer A | As above, against the then-current draft | **no verdict** - terminated on HTTP 429 |
| 2, aborted | Reviewer B | As above, against the then-current draft | **no verdict** - terminated on HTTP 429 |
| 2, operative | Reviewer A | Every §4 statement, status, release effect, tier, entailment, supersession, citation syntax, hash and line bound | **REQUEST_CHANGES** |
| 2, operative | Reviewer B | Option C, RR-04, S1-S6, L1, L2, M1, A1, Task U3 State B, all four State C commits, 058/059 separation, all five closeout findings, C6 wording | **REQUEST_CHANGES** |
| 3, aborted | Reviewer A | As round 2, against the remediated candidate | **no verdict** - terminated on HTTP 429 |
| 3, aborted | Reviewer B | As round 2, against the remediated candidate | **no verdict** - terminated on HTTP 429 |
| 3, operative | Reviewer A | Complete ledger-provenance charter, against the AGENTS.md-adjusted candidate | **REQUEST_CHANGES** |
| 3, operative | Reviewer B | Progression, UI and state-provenance charter, against the same candidate | **REQUEST_CHANGES** |
| 4 | Reviewer A | As round 3, against the round-3-remediated candidate | **REQUEST_CHANGES** |
| 4 | Reviewer B | As round 3, against the round-3-remediated candidate | **REQUEST_CHANGES** |
| 5 | Reviewer A | As round 4, against the round-4-remediated candidate | **APPROVE** |
| 5 | Reviewer B | As round 4, against the round-4-remediated candidate | **REQUEST_CHANGES** |
| 6 | Reviewer A | As round 5, against the round-5-remediated candidate | **APPROVE** |
| 6 | Reviewer B | As round 5, against the round-5-remediated candidate | **APPROVE** |
| 7 | Reviewer A | Full Reviewer A charter against the GLM-5.3 remediation candidate | **REQUEST_CHANGES** |
| 7 | Reviewer B | Full Reviewer B charter against the same candidate | **APPROVE** |
| 8 | Reviewer A | Full Reviewer A charter against the Round-7-remediated candidate | **no verdict** - run truncated on API timeout |
| 8 | Reviewer B | Full Reviewer B charter against the same candidate | **REQUEST_CHANGES** |
| 9 | Reviewer A | Round 7 remediation verification, chronology, ledger spot-check, release effects | **REQUEST_CHANGES** |
| 9 | Reviewer B | Chronology consistency, Round 8 narrative accuracy, progression/UI/state | **REQUEST_CHANGES** |
| 10, attempt 1 | Reviewer A | Full Reviewer A charter against the Round-9-remediated candidate | **no verdict** - terminated on API timeout |
| 10, attempt 1 | Reviewer B | Full Reviewer B charter against the same candidate | **no verdict** - terminated on API timeout |
| 10, attempt 2 | Reviewer A | Full Reviewer A charter against the same candidate | **no verdict** - terminated on API timeout |
| 10, attempt 2, completed | Reviewer A | Full Reviewer A charter against the same candidate | **APPROVE** |
| 10, attempt 3 | Reviewer B | Chronology sweep, Round 9 narrative accuracy, encoding (minimal charter) | **APPROVE** |
| 11, attempt 1 | Reviewer A | Full-scope charter against the Sol-remediated candidate | **no verdict** - terminated on upstream API outage |
| 11, attempt 1 | Reviewer B | Full-scope charter against the same candidate | **no verdict** - terminated on upstream API outage |
| 11, attempt 2 | Reviewer A | All 84 citations across 59 §4 rows resolved/bounds-checked; 28 entailment reads; corpus totals; nine-row stale hunt | **APPROVE** (31 rows + §5 supersession outstanding) |
| 11, attempt 2 | Reviewer B | HEAD/state, progression substance both states, five findings + code spot-checks, chronology, Entry 0064 | **APPROVE** |
| 12 | Reviewer A | Focused completion: semantic entailment for the remaining 41 enumerated §4 rows + §5 supersession | **APPROVE** |
| 12 | Reviewer B | Focused confirmation: corrected count labels, ledger 0065 structure, final bytes | **APPROVE** |

**Round 2 did not run.** Both round-2 reviewers were launched read-only with the same charters and
terminated early on an environment rate limit (HTTP 429, session limit) before producing any verdict.
That is an environment condition, not a substantive review outcome, and it must not be reported as
one. The operative round 2 reviewed a candidate identified by exact hash. **Both reviewers verified all
three hashes before reviewing, and both returned `REQUEST_CHANGES`.** Their verbatim handoffs are
persisted, unedited, as `.txt` so that creating them changes no Markdown corpus count:

`[Working-tree source: .agents/audit-synthesis-remediation/round-2-reviewer-a.txt; SHA-256 af4026fbd2150f6b91b4f732fc62279b8ca273d230130eabdcf14ebd404a332c; lines 1-199; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-2-reviewer-b.txt; SHA-256 ca790dc24d54725e2f577ecd2d3df6e10e33cc581039d4c1fe70126aa205a17f; lines 1-182; captured 2026-08-31]`

**What operative round 2 changed.** The two reviewers converged independently on one defect — the
`S-T4-08` source record pointed at `032_capability_content.sql:281` when the Push-up chain-rung
tuple is at `016_movement_library_seed.sql:281`, and that record was the sole registered provenance
for the fact carrying `OW-001`'s escalation. Each also found defects the other did not:

- **`OW-016` was stale-current**, the same failure class as `OW-021`. Its demanded restatement is
  already recorded in the very document it cited. Closed to §5.1.
- **`OW-009` reproduced three locators that do not resolve** at State A; re-derived to `:140`,
  `:2598`, `:2600`.
- **CR-01's correction had landed in the manifest but not here**: the §0.3 tier table still placed
  branch *code* in T2. Corrected.
- **`OW-001` was a bundle.** The athlete-selection residue and the predicate fan-out are
  independently closable and carry different release effects, so they are now `OW-001`
  (`NON_BLOCKING`) and `OW-036` (`BLOCKING`).
- **Five release gates were bundles**, split into `RG-19`–`RG-26`.
- **§2.1 re-committed the very attribution error §3.1 retracts**, citing the architecture review's
  §7 span for its RR verdicts. Corrected to the verdict table with the audit's own disclaimer that
  no ruling was signed on the owner's behalf.
- **The L1 ruling row dropped the word "legacy"**, which changes the meaning: fail-closed is scoped
  to legacy state, and athlete selection is required separately, so permanent fail-closed for an
  undeclarable movement is the defect rather than the remedy.
- Plus: the second migration re-pin was uncited, `SuspensionCard` is not actually rendered in
  `ProfileScreen`, `git cat-file -e` exits 128 rather than 1, `RG-03` dropped U1's 8-rep
  expectation, and the State C routing change actually *repairs* U1's weighted-calisthenics row —
  State C is not uniformly regressive.

**Operative round 3 verdicts.** Both reviewers verified all three candidate hashes and both returned
`REQUEST_CHANGES`. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-3-reviewer-a.txt; SHA-256 38cbfaa73a6708ea4fce16f817a3c296da9e1eaa5c6780b6381e056b595e5a46; lines 1-161; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-3-reviewer-b.txt; SHA-256 cc9b90e70cf0f6956ce54388a1c2d27a7248b2306f1ad8856b055d87234c4346; lines 1-185; captured 2026-08-31]`

**What operative round 3 changed.** A third stale-current row was found — `OW-015`, whose condition
Migration 022 removed before the row's own `as_of_revision`, with a live regression gate at State A
proving the defect cannot recur. That is one stale row per round, three rounds running, each missed
by the round before. Both reviewers independently affirmed the `OW-001`/`OW-036` split and both
release effects, Reviewer A re-deriving the seven-step causal chain and confirming that the bar of 8
is live now because `progression_policy` has no seeded rows. The remaining corrections were
consistency failures introduced by that very split: §3.1, the §4 preamble and the hash-cited
addendum all still asserted `OW-001` was `BLOCKING`; `OW-036`'s stated origin did not entail it and
now cites the T1 architecture review and the T0 docket instead; the §6.1 CR-03 evidence row still
carried the pre-`AGENTS.md` totals; §6.3 still said round 2 could not run; and §3.1 offered an
agent-authored implementation report as the owner's ratification record for RR-04, now corrected to
the decision register with its own limits stated.

**Round 4 verdicts.** Both reviewers verified all three candidate hashes; both returned
`REQUEST_CHANGES`. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-4-reviewer-a.txt; SHA-256 06f48d477a2efed6d85321b9e97054af98b3b1621827e089924abb4059b1e32c; lines 1-177; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-4-reviewer-b.txt; SHA-256 c5a8251bf60caed98abaa52b8f7c816102f3f98b90c5535da28f1ff3f8edfe21; lines 1-110; captured 2026-08-31]`

**The one genuinely good news in round 4: the stale-row streak broke.** Reviewer A attacked all 22
`OPEN` rows individually, trying to falsify each at its own `as_of_revision`, and found **no fourth
stale-current row** — it also independently re-derived and confirmed the `OW-015` closure rather
than inheriting it. Three rounds had each surfaced one; this round surfaced none.

**What round 4 changed.** Reviewer B found §2.1 asserting the C6B authority schedule "was ratified"
and citing a span that supports none of it: that file contains **zero** occurrences of `2,385` or
`MAX_MACROCYCLE_RPE_RAISE`, and it is a "Claude/Opus ratification pass" whose verdict is
"GO. Ratify and land" and which closes by *recommending* ratification. It recommends; it does not
ratify. That is the same conflation §3.1 exists to prevent, surviving in a section round 2 had
already touched. The genuine owner record is the deviation log, which names the owner and the
rejected alternative, and §2.1 now cites it.

Reviewer A found a fifth surviving instance of the `OW-001`-is-`BLOCKING` staleness, sitting in the
very sentence that tells the next reviewer what to attack — so it was misdirecting future rounds
while omitting `OW-036`, the row that actually carries `BLOCKING`. It also found that `OW-001`'s
`NON_BLOCKING` was justified on the "fails closed as L1(a) mandates" reading that round 2 had
corrected out; the value is right but the reason was not, and it is now restated on dose grounds —
an undeclared slot takes the flat loaded set schedule instead of the 4→5→5 bodyweight ramp, so it
receives fewer sets and violates no ratified constraint. Two adjacent ledger rows were also citing
the same docket file at the same commit under contradictory tiers, now both T0.

The remainder were citation-precision defects: the 059 side-car tables and triggers are not in the
header span, the State B store loci sit outside the cited diff range, the RR-02 verdict row says
"A (Migration 059)" so the slot-058 correction needed its own citation, S6's binding "Resume returns
to exactly the recorded position" had been abridged away, and the open-episode delete — a second
permitted mutation that `OW-002`'s remediation actually depends on — was missing from two summaries
of the 059 surface.

**Both reviewers independently affirmed the `OW-001`/`OW-036` split and both release effects**,
each re-deriving the seven-step chain from source. Reviewer A additionally confirmed the split is
closable in either order: `OW-036` closes by keying the floor on `progressionGroup`, already threaded
in as a typed generator input, without touching the selection gap.

**Reviewer A adjudicated the `BLOCKING` inference and affirmed it**, on reasoning it derived
independently: `bodyweightRepsFor` falls back to the imported `DEFAULT_ADVANCEMENT_POLICY.requiredReps`
when no `progression_policy` row exists, so the bar of 8 is live now for all 15 chain movements and
the regression is current rather than hypothetical.

**Round 5 verdicts.** Reviewer A verified all three candidate hashes and returned `APPROVE`. Reviewer B returned `REQUEST_CHANGES` on two items: line locator and RPE ramp values for RG-03 (`blockGenerator.ts:817` and `[7.5, 8.0, 8.5]`), and restoring citations for UI token/touch target realities (`#EFC94C`, `56pt`) alongside Migration 058 schema details rather than retracting them. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-5-reviewer-a.txt; SHA-256 fe262ce07cd11b95e13fe0709af63e92730caf4a2ced0b9681dc5e7fd73091d8; lines 1-28; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-5-reviewer-b.txt; SHA-256 1da4412e0fb4de399985c89847b68a8d13d9bdc50ab5169c2be203dc109a6809; lines 1-24; captured 2026-08-31]`

**What round 5 changed.** RG-03 locators and RPE ramps were corrected in §3.1 and §4.3; RC-06 in §5.2 was updated to cite the live UI implementation files (`theme.ts`, `SuspensionCard.tsx`, `SuspensionSheet.tsx`) and the 058 schema triggers/indices rather than retracting them; nine missing source records were added to the manifest; and the addendum was synchronized to separate `OW-001` and `OW-036`.

**Round 6 verdicts.** Both reviewers independently verified all three candidate SHA-256 hashes against disk bytes, re-audited all 33 open work items, 26 release gates, 12 retracted claims, authority tiers, and boundary conditions, and found zero discrepancies. Both reviewers returned `APPROVE`. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-6-reviewer-a.txt; SHA-256 f1153942b5e431c9f6a6e2c56ee79cd2540bdbf16096d5c792458877a0e761c1; lines 1-115; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-6-reviewer-b.txt; SHA-256 411b324d3f754672cb817a6bce7729e37a51269c3a55002442168f7296d7da98; lines 1-104; captured 2026-08-31]`

**Round 7 verdicts.** Both Round 7 reviewers verified the frozen GLM-5.3 candidate hashes against
disk bytes. Reviewer B returned `APPROVE` with two non-blocking observations. Reviewer A returned
`REQUEST_CHANGES` with two findings, both located in the continuation's own deliverables rather than
the substantive ledger: (1) the manifest §6.4 final-hash locator named an uncompleted ledger entry
and misattributed which entries hold the earlier revisions, and (2) the declared corpus totals
(6/115/121) no longer reproduced under the manifest's own discovery commands after the continuation
package created three new Markdown files and the teamwork system re-ran. Both were remediated in the
revision now frozen for Round 8. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-7-reviewer-a.txt; SHA-256 9c391b23aba025edb38c1e40cfe74336b043e25a54582a016526dee4c866ffdb; lines 1-47; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-7-reviewer-b.txt; SHA-256 d52481ceb54b144c451647117ec861bcd5e9ced0ed39f2866017aa7f1358a8d8; lines 1-58; captured 2026-08-31]`

**Round 8 verdicts.** Reviewer B verified the re-frozen candidate hashes against disk
bytes and confirmed the Round 7 remediation (manifest §6.4 attributions, corpus re-count) was
accurately described, then returned `REQUEST_CHANGES` on exactly one finding: the §0.1
review-chronology bullet had not been advanced after Round 7 ran and still presented the current
candidate as pending Round 7 — the same stale-current defect class this document exists to catch.
That bullet is now corrected, and the candidate was frozen for Round 9. Reviewer A's run was
truncated by an environment failure (API timeout after retries) before any verdict; consistent with
the Round 2/3 precedent, an environment truncation is not a substantive review outcome and no
verdict is recorded for it. What, if anything, that run verified before truncation cannot be
established from any persisted artifact. Verbatim handoff:

`[Working-tree source: .agents/audit-synthesis-remediation/round-8-reviewer-b.txt; SHA-256 cd1a7ccce0aac52bf05849d186f0a9b20e7c7cd1a919656c6954d783f3642bf5; lines 1-53; captured 2026-08-31]`

**Round 9 verdicts.** Both Round 9 reviewers verified the frozen candidate hashes against disk
bytes and returned `REQUEST_CHANGES` with four findings between them, all minor and all remediated
in the revision now frozen for Round 10: a stale exclusion-note count in the manifest §1.3 (the
`find` total still reflected the pre-remediation corpus), a one-conjunct citation-scope gap in
`OW-036` (the fatigue-class fact is entailed at `blockGenerator.ts:671-682`, now cited by the row),
an off-by-one round count in §6.3's chronology bullet, and an unverifiable attribution of
hash-verification to Round 8's truncated Reviewer A run (now withdrawn). Reviewer A additionally
executed the manifest's §1.1 discovery commands verbatim and confirmed every declared total
reproduces, re-parsed the manifest arithmetic, verified §6.4's ledger attributions against the
actual entries, spot-checked six OPEN rows at their own `as_of_revision` and found none stale, and
confirmed the four-row BLOCKING set and chronology consistency. Reviewer B independently confirmed
zero stale forward-references and verified the Round 8 narrative against its persisted handoff.
Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-9-reviewer-a.txt; SHA-256 e4f4793371a9caa0d5d4d4c90a52049dd762ff1218ff26344db42d3c38b10f1c; lines 1-53; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-9-reviewer-b.txt; SHA-256 fd6f2de358d89f7d580e15a489b9485f090656747660d99dd430d0e4e7ea9abd; lines 1-56; captured 2026-08-31]`

**Round 10 verdicts — APPROVE, with materially partial coverage attached.** The first complete
Round 10 pair returned two `APPROVE` verdicts against the frozen candidate bytes, and both handoffs
explicitly limit their own coverage: Reviewer A sampled 8 of 32 relevant rows, re-derived only
representative tier boundaries, and spot-checked 4 OPEN rows; Reviewer B ran a minimal charter that
excluded §4/§5 substance and HEAD verification. **Those verdicts therefore do not satisfy the full
W5 charters and are not recorded as a full-charter certification** — the owner's orchestrator
(Sol) correctly returned `REQUEST_CHANGES` on exactly this ground, alongside verifier and
ledger-pairing defects, and a full-coverage Round 11 pair is required before any approval claim.
Within their stated limits the Round 10 reviewers verified: manifest arithmetic (74 records, zero
duplicates), all four Round 9 remediations, the four BLOCKING rows' citations, four fresh
OPEN-row spot-checks (none stale), the chronology sweep, the Round 9 narrative against both
persisted handoffs, and the zero-mojibake state. Two earlier Round 10 attempts were aborted by
environment API timeouts before any verdict and are recorded as no-verdict attempts, not review
outcomes. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-10-reviewer-a.txt; SHA-256 c963f95d7da9ea7ed5fb6e15cf0048ed1fb63365f033e223af9c306df6b62918; lines 1-67; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-10-reviewer-b.txt; SHA-256 6062c4a2d968ca4e3d3d17e8bbf7bf7e08c76610f831edb14d8b7c1744842bf2; lines 1-56; captured 2026-08-31]`

**Round 11 verdicts — APPROVE, with a stated scope remainder.** The Round 11 pair reviewed the
corrective candidate (Sol's REQUEST_CHANGES applied: verifier integrity, chronology repair, ledger
pairing via Entry 0064). Reviewer A: all 84 citations across the 59 §4 rows resolved with zero
out-of-bounds spans; 28 origin spans semantically read with entailment confirmed in every case
(including OW-036, OW-001, OW-024, OW-025, OW-035, RG-01, RG-03); manifest arithmetic exact (76
records at the final count including this round's two handoff rows, zero duplicate IDs, 71 distinct
paths at review time); all five §1.1 corpus totals reproduced verbatim; a nine-row stale hunt at
each row's own `as_of_revision` found nothing stale; the OW-036 BLOCKING chain re-derived from
primary sources; 20/20 record hashes matched disk. Reviewer A's own coverage limits record that the
remaining 31 rows received resolution and bounds checks only, and that §5 supersession was outside
its charter — both parts of the mandated full charter, so the owner's orchestrator returned
`REQUEST_CHANGES` on that gap and commissioned the focused Round 12 pass (remaining 31 rows'
semantic entailment plus §5 supersession) rather than accepting the approval. Reviewer B: HEAD and the four State C commits verified
directly; progression substance confirmed at both states (primarySlot 817/852, SCHEMES ramps
347/349/352, isPurelyBodyweight gating at 846, HANDOVER expectation); the five closeout findings
mirror one-to-one with State C code spot-checks; overlay hashes byte-identical; chronology
consistent with ten rounds enumerated exactly and Round 11 pending at review time; Entry 0064
carries all three required disclosures; zero mojibake. Non-blocking observations: one Minor
locator note (RG-03's State A `supportedPrefixes[0]` fact is verified true but its locator is not
cited in the row) and two Info items (a commit-rev citation to `f3ebab38` for unchanged 059 SQL;
the 71-vs-72 distinct-path arithmetic reconciling exactly against the pathless record). One earlier
Round 11 attempt was aborted by an upstream API outage before any output and is recorded as a
no-verdict attempt. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-11-reviewer-a.txt; SHA-256 79c5772e140633880e8fd145e81a3bf9c5f3518e0d367edb2a28693ffd267441; lines 1-51; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-11-reviewer-b.txt; SHA-256 4764da7e294e83b1c3ceabd5e7ff00ecee0010bd5240f536c50f495cd9e2956e; lines 1-55; captured 2026-08-31]`

**Round 12 verdicts — APPROVE, completing the full charter.** The focused pair closed the Round 11
remainder. Reviewer A semantically read all 41 enumerated remainder rows (9 §4.1 + 8 §4.2 + 24
§4.3 — the brief's "31" label was lossy; the superset was covered), so combined semantic coverage
across Rounds 11–12 is 59 of 59 §4 rows; verified §5.1 supersession in full (Revision 1 items 6, 7,
22, 23, 24, 25, 29, the OW-015/OW-016/OW-021 closures, the SPLIT rows, and item 12's three-way
split) against the named superseding sources at their cited revisions; confirmed no §4 OPEN row is
superseded by a newer source; and reproduced the count labels mechanically (84 citations — 69
`[Source:` + 15 `[Working-tree source:` — across 59 rows). Three minor non-material observations:
OW-009's locator-correction facts are verified true but the correcting locators are not cited
in-row; OW-017's "strict-subset" phrasing is a contextual enrichment of the source's "equipment
filter"; the manifest digest quoted in the Round 12 brief was stale metadata, not a document
defect. Reviewer B verified Entry 0065's single-Input/single-Output structure, the complete
verbatim execution prompt (diff against the on-disk work order shows exactly one extra blank line,
consistent with the token-identity attestation), all five 0064/Round 11 defect disclosures
including the open reasoning-effort waiver request, the corrected count labels, heading schema,
zero mojibake, and the chronology. Verbatim handoffs:

`[Working-tree source: .agents/audit-synthesis-remediation/round-12-reviewer-a.txt; SHA-256 657e0cde6154c3552db0f3cc44b310b311ccc5b7d765b5621b2fbe9002d9a834; lines 1-50; captured 2026-08-31]`
`[Working-tree source: .agents/audit-synthesis-remediation/round-12-reviewer-b.txt; SHA-256 22bc26befe4693961d35acfb111b383a8d6298aeca810300a99e4f144fcdb2ac; lines 1-51; captured 2026-08-31]`

Under work-order §0.4 and §3.13, the executor may not simulate independence by reviewing its own
draft twice. The round-1 reviewers cannot be counted as approving the remediated document: they
reviewed the pre-remediation revision and both returned `REQUEST_CHANGES`.

**Approval scope of Round 6.** The two Round 6 `APPROVE` verdicts certify exactly the 992-line
candidate at SHA-256 `85a192a62b15d6159391dccab296bd513eafa1d017aa020f46917bee56f5e490`. They do not
certify this document as it now stands. After Round 6 the executor made administrative
review-history edits, and the GLM-5.3 continuation
(`docs/WORKORDER_GLM53_AUDIT_SYNTHESIS_CONTINUATION.md`) then made further substantive corrections:
a bounded encoding repair, the review-status chronology in §0.1, §6.2 and §6.3, manifest
reconciliation, and mechanical-verifier repair. A Round 7 pair then reviewed that candidate:
Reviewer B returned `APPROVE`; Reviewer A returned `REQUEST_CHANGES` with two findings, both in the
continuation's own deliverables and both remediated — the manifest's final-hash locator pointed at an
uncompleted ledger entry with wrong entry attributions, and the declared corpus totals no longer
reproduced under the manifest's own commands (they were restated to the re-counted values). The
candidate then before Round 8 carried review status `PENDING_EXTERNAL_REVIEW` until a fresh pair
reviewed the re-frozen bytes (see Round 8 below).

**Reviewer guidance historically issued to each round** (Rounds 7–10 were asked to attack, in this
priority order): whether `OW-036`'s `BLOCKING` inference is justified or overreaches, and whether
`OW-001`'s `NON_BLOCKING` understates the residue; whether the §4 preamble's origination rule for
`OW-001`–`OW-007` **and `OW-036`** is sound or is a rationalisation; whether closing `OW-015`,
`OW-016` and `OW-021` was correct or discarded live items; whether the 26 release gates are
genuinely distinct rather than re-bundled; and whether the 471,936,000 B envelope is correctly
characterised as modelled rather than measured. Three early rounds each found one stale `OPEN` row;
Rounds 8–10 found none. Every item in that list has now been attacked and answered by at least one
independent reviewer: the `BLOCKING`/`NON_BLOCKING` split was adjudicated in Rounds 3, 6 and 7, the
closure dispositions in Rounds 6, 9 and 10, the gate unbundling in Rounds 2 and 6, and the
modelled-versus-measured envelope in every round.

Neither reviewer received the other's conclusion, the other's charter, or a desired verdict. Neither
edits this document. Both ran read-only. Any `REQUEST_CHANGES` returns the synthesis to remediation
and requires a fresh review, which is why rounds 2 through 10 ran to this result.

**What round 1 changed.** Both reviewers independently converged on three defects, and each found
defects the other did not. The substantive corrections they forced:

- **The memory envelope was wrong, and wrong in the direction of saying too little.** Round 1
  recorded it as `UNKNOWN`. Both reviewers located the authoritative figure — a modelled component
  envelope of 471,936,000 B sitting inside the ratified review band — which work-order §3.11
  expressly required be recorded. §3.4 and `RG-01` are corrected.
- **`OW-021` was a stale item presented as current.** Reviewer A proved the condition was already
  fixed at State A by a commit that is an ancestor of State A. Closed to §5.1. This is exactly the
  defect the `as_of_revision` column exists to catch, and round 1 failed to catch it.
- **`OW-001`'s impact was understated.** Reviewer B proved that `isPurelyBodyweight` gates three
  behaviours, not one, so an undeclared movement also loses the L2(b) capability-chain rep floor.
  Push-up is rung 0 of its chain, so it is now prescribed below the bar its own capability is
  measured against — reinstating the class of defect the ladder reconciliation closed. The row moved
  from `NON_BLOCKING` to `BLOCKING`, and `RG-03` no longer carries a State A expectation across to
  State C.
- **`OW-022` rested on a span that did not entail it**, and its first conjunct was false at State A.
  Re-scoped and re-cited; the false half is dispositioned in §5.1.
- Eight further release gates were undispositioned in `RELEASE_READINESS.md` and are now `RG-11`
  through `RG-18`; five `source_date` values were the document date rather than the statement date;
  the ruling package was miscounted as nine rather than ten; the corpus totals omitted this task's
  own outputs; and three §6.1 evidence rows were imprecise.

One reviewer finding was **not** adopted as stated: Reviewer B attributed the "17 suites / 218 tests"
figure to ledger Entry 0023 and judged it fused across sources. The figure is in fact recorded in the
C1 docket's own C0 table against `verify:ci` at this base
`[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 29-29]`.
The reviewer's underlying complaint was still correct — the row carried no citation — so the
citation was added rather than the figure changed.

**Verification history, T3, non-authoritative.** A launched multi-agent run on 2026-08-30 produced
revision 1 of this document and reported its own gate outcome as PASS at iteration 2, after
iteration 1 failed on a line-bound discrepancy in the KineStrike item.
`[Working-tree source: .agents/orchestrator/GATE_STATUS.md; SHA-256 9a3f2a58c729cf6ccc1180dbe025c080534d5eb2fbe221b7e2deb57cc19d32ce; lines 13-25; captured 2026-08-30]`

That history is recorded because it is real, and bounded because it is circular: the run's
"zero hallucinations certified" conclusion rests on reviewer agents from the same run, and §5.2
lists twelve claims from its output that do not survive inspection — including one citation to lines
24–25 of a 23-line file, which a line-bounds check should have caught. It is evidence that the run
occurred. It is not evidence that its output was correct.

### 6.3 Limitations and Reproduction

**What this document does not establish.**

- **C6 is unmeasured on hardware.** No memory figure exists for any candidate on a physical 4 GB
  device, and neither this document nor any gate result can substitute for that measurement. The
  *modelled component envelope* is not unknown — it is 471,936,000 B, inside the ratified review
  band (§3.4). The unknown is the *physical-device measurement*. These are two different quantities
  and this document keeps them distinct everywhere.
- **State B is mutable.** Every State B hash was captured on 2026-08-30. Any edit invalidates the
  corresponding claim.
- **State C's worktree is not audited.** Only commit `34f91ff` was read. At work-order preparation
  time that worktree carried further uncommitted Migration 060 and KineStrike changes, which are
  outside scope.
- **The empirical probe tests SQL, not the app.** It proves what the database layer permits and
  refuses at the 001–059 chain. It does not exercise the production migration runner, the store, or
  any UI, so it cannot prove application behaviour.
- **No general debt scan was performed.** The ledger is a strict extraction. Three out-of-scope
  observations noticed during the bounded five-finding audit are recorded in
  `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` §4.3 and deliberately excluded here.
- **`REPORTED` gate rows are inherited claims.** They were not re-run.
- **Independent review status: `PENDING_EXTERNAL_REVIEW` for revision 4.** The revision-3 candidate
  was approved at Round 12 (Reviewers A and B, completing the full charter), but this revision-4
  rebuild changes substantive ledger dispositions (`OW-036`, `OW-024`, `OW-025`), so the revision-4
  candidate requires a fresh full-scope Reviewer A/B pair before any approval claim. Twelve review rounds ran to a verdict or documented truncation — round 1, operative round 2,
  operative round 3, and round 4 each returned two `REQUEST_CHANGES`; Round 5 returned one
  `APPROVE` (Reviewer A) and one `REQUEST_CHANGES` (Reviewer B); Round 6 returned two `APPROVE` for
  the 992-line candidate at SHA-256
  `85a192a62b15d6159391dccab296bd513eafa1d017aa020f46917bee56f5e490`; Round 7 returned one
  `APPROVE` (Reviewer B) and one `REQUEST_CHANGES` (Reviewer A) against the GLM-5.3 remediation
  candidate, with both findings remediated (§6.2); Round 8 returned one `REQUEST_CHANGES` (Reviewer
  B, a stale §0.1 chronology bullet, since fixed) and no Reviewer A verdict (run truncated on an
  environment failure); Round 9 returned two `REQUEST_CHANGES` with four minor findings, all
  remediated (§6.2); Round 10 returned two `APPROVE` verdicts, but with materially partial coverage —
  Reviewer A sampled 8 of 32 relevant rows and re-derived only representative tier boundaries, and
  Reviewer B explicitly excluded §4/§5 substance and HEAD verification — so those approvals certify
  only what each handoff's own coverage limits state, not the full W5 charter (§6.2). Each
  completed round before Round 10 found real defects — including a stale-current ledger row the
  previous round missed (`OW-021`, then `OW-016`, then `OW-015`), two manifest consistency defects
  in Round 7, one chronology defect in Round 8, and four minor citation/count defects in Round 9 —
  and each was remediated before the next review. After Round 10, the owner's orchestrator (Sol)
  returned `REQUEST_CHANGES` on the coverage gap and further verifier/ledger defects, and this
  revision applies those corrections plus a round-count fix in this very bullet. Round 11 returned
  two `APPROVE` verdicts with a stated scope remainder (31 rows resolution-checked only; §5
  supersession out of charter — §6.2), and the focused Round 12 pass closed exactly that remainder:
  semantic coverage across Rounds 11–12 is 59 of 59 §4 rows — 17 rows named by Round 11, 41
  enumerated by Round 12, plus `OW-026`, which sat outside the 41-row charter but whose origin span
  was incidentally read and entailed — §5 supersession was verified against every re-readable
  superseding source and current disposition (Revision 1 itself remains unrecoverable, so its
  item-number mappings cannot be checked against the original text), and no OPEN row is superseded
  by a newer source. The only edits made after the Round 12 approvals
  are administrative review-history records (this bullet, the §0.1 status, the §6.2 Round 12 block,
  and this round's manifest handoff rows), none of which touch a substantive claim; the final
  hashes are recorded in `PROMPT_LEDGER.md` Entry 0065.
- **Revision 1 is unrecoverable.** It was replaced in place, so no third party can independently
  check §5.1's "Revision 1 item N" mappings or §5.2's line references against the original text. Only
  its SHA-256 survives. A reviewer wanting to audit the reclassification would need that file
  restored from outside this worktree.

**Reproduction.** The commands are exact and read-only.

```bash
# State identity
git rev-parse HEAD                       # expect 48719b07988ad30d255b0fed37f45ed5db49c935
git log --oneline 48719b0..34f91ff       # expect exactly 4 commits

# Task U3 is absent from State A
git cat-file -e 48719b0:apps/mobile/src/components/SuspensionCard.tsx   # expect non-zero
git cat-file -e 48719b0:apps/mobile/src/components/SuspensionSheet.tsx  # expect non-zero

# Migration 059 exists only at State C
git cat-file -e 48719b0:packages/core-db/src/schema/059_suspension_state_and_load_intent.sql  # non-zero
git cat-file -e 34f91ff:packages/core-db/src/schema/059_suspension_state_and_load_intent.sql  # zero

# No behavioural coverage of 059's triggers
git grep -n "trg_suspension_episode_immutable_entry_bu" 34f91ff -- apps/ packages/

# Corpus totals
git ls-files --others --exclude-standard | grep -cE '\.md$'            # expect 222 at the freeze (mutable T3 corpus)

# The external document is not in this worktree
git ls-tree -r --name-only 48719b0 | grep -i kinestrike                # expect no output
```

**Invalidation conditions.** Any of the following falsifies part of this document and requires
re-derivation: a change to `48719b0` or `34f91ff` (impossible for commits, but the branch may move);
an edit to any untracked source whose hash is recorded here; a memory measurement that places the
candidate above 536,870,912 B; a `REQUEST_CHANGES` verdict from either independent reviewer; or the
appearance of an athlete-selection surface, a `[059]` test section, or a suspension-aware reset,
each of which would close a named ledger item.

