# Work Order — State C Push-Ready Remediation and Certification

## 0. Control Record

- **Status:** EXECUTION AUTHORIZED by `PROMPT_LEDGER.md` Entry 0058.
- **Executor:** GPT-5.6 Sol acting as bounded State C code/document executor.
- **Working directory:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\state-c-release-readiness`.
- **Branch:** `codex/state-c-release-readiness`.
- **Required base:** `34f91ffe548a0b9e51db863ffc6fad993619f940`.
- **Authoritative history:** canonical State C `PROMPT_LEDGER.md` Entries 0001–0057.
- **External source lineage:** the immutable 3,942-line audit-ledger archive registered in the lineage crosswalk.
- **Release boundary:** local push-ready evidence only. No C6, C7, signing, push, release or store action.

## 1. Objective

Produce a clean local State C candidate that closes the locally actionable release blockers without merging another repository lineage:

1. decouple the capability-chain rep floor from per-slot load routing (`OW-036`);
2. reconcile the canonical and audit ledger lineages without blending their entry numbers (`OW-024`);
3. rebuild and certify the audit package around the post-fix candidate;
4. produce exactly two implementation/documentation commits followed, after dual independent approval, by one administrative certification commit; and
5. leave the local branch clean, committed, without an upstream and still release-blocked on C6/C7/owner/device/store work.

## 2. Invariants

- State C `34f91ff` is the only code ancestry. Do not merge or cherry-pick `master`, the `progression-evidence-remediation` branch, or the State B overlay.
- Preserve the existing dirty `progression-evidence-remediation` worktree byte-for-byte as source evidence.
- Preserve canonical ledger Entries 0001–0057 byte-for-byte. Entry 0058 is append-only and carries the exact execution prompt.
- No migration, schema, dependency, exported TypeScript interface or persisted-data rewrite.
- The only product behavior change is future-plan rep-floor routing for capability-chain movements.
- `isPurelyBodyweight` controls Option C set routing only.
- `progressionGroup !== undefined` controls whether L2(b) may floor reps; `chainAdvancementReps` controls a custom bar; the imported default remains the fallback.
- Deload behavior, off-chain phase reps, fatigue classification, persisted history and load-intent fail-closed behavior stay unchanged.
- No fabricated physical-device, memory or release evidence.

## 3. Authorized Write Set

### 3.1 Product and focused test

- `packages/inference/src/blockGenerator.ts`
- `packages/inference/test/verify_blocks.mjs`

### 3.2 Canonical coordination and documentation

- `PROMPT_LEDGER.md` — append-only Entry 0058 only
- `docs/WORKORDER_STATE_C_RELEASE_READINESS.md`
- `MASTER_AUDIT_SYNTHESIS.md`
- `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md`
- `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`
- `docs/audits/state-c-release-readiness/**`
- `tools/audit/verify_state_c_release_evidence.mjs`

### 3.3 Review evidence

Only exact, curated handoffs copied or produced for this release package under:

- `docs/audits/state-c-release-readiness/reviews/**`

No unrelated `.agents/**`, Hermes profiles, SOUL files, challenge scripts, State B UI files or generic scratch output may be staged.

## 4. Forbidden Writes and Actions

- No files outside §3.
- No shipped migration or schema edits.
- No product UI/store/persistence edits.
- No dependency or lockfile edits.
- No merge, rebase, cherry-pick, tag, upstream, push, signing, C6, C7 or release action.
- No use of the dirty audit worktree as a build/test working directory.
- No `verify:release` claim.

## 5. Dependency Preparation

In the clean worktree only:

1. run `npm ci` under `.npmrc` `strict-allow-scripts=true` and the pinned `allowScripts` policy;
2. materialize embedder artifacts through `npm run fetch:embedder` (or verified local cache as that command implements); and
3. run `node scripts/verify-preflight.mjs` before full verification.

`node_modules` and model artifacts remain ignored and are never staged.

## 6. TDD Packet — `OW-036`

### 6.1 RED

Extend State C section `[28]` in `verify_blocks.mjs` before production code changes. The tests must prove:

- a capability-chain movement with explicit `Bodyweight` intent receives the chain floor and the bodyweight set route;
- the same chain movement with explicit external-load intent retains the chain floor while keeping the conservative loaded set route;
- the same chain movement with undeclared intent retains the chain floor while keeping the same loaded set route as the explicitly loaded case;
- a custom per-chain bar applies to bodyweight, loaded and undeclared chain members;
- an off-chain movement keeps phase reps regardless of intent;
- deload reps are unchanged regardless of chain membership or intent; and
- loaded-set routing remains distinguishable from the bodyweight set route.

Run `npm run verify:blocks` against the unmodified engine and record the expected failure caused by `bodyweightSlot ? bodyweightRepsFor(m) : reps`.

### 6.2 GREEN

Make the minimal engine change: retain `bodyweightSlot` for `slotWorkingSets`; derive `slotReps` from chain membership independently. No other behavior change.

Run `npm run verify:blocks` and `npm run typecheck` green.

### 6.3 Mutation Proof

After GREEN, temporarily restore the old coupling, run `npm run verify:blocks`, record the expected regression failure, restore the correct source bytes, and rerun green. No mutant bytes may be committed.

## 7. Documentation and Ledger Reconciliation

### 7.1 Lineage archive

- Copy the dirty audit ledger byte-for-byte into the hash-qualified archive path.
- Record source path, 3,942 line count and SHA-256.
- Build a crosswalk for canonical Entries 0055–0058 and archived `AUD-0055`–`AUD-0065`.
- Never copy archived entry numbers into the canonical ledger as though they were the same history.
- Treat archived Entry 0065's two-Output defect as historical evidence only.

### 7.2 Post-fix audit dispositions

Rebuild the synthesis, manifest and closeout addendum against the new committed candidate:

- close `OW-036` with exact code/test commit evidence;
- close `OW-024` with the canonical/archive crosswalk;
- move State-B-only `OW-025` to the superseded register because this candidate is State C with S5(c)/S6(b) and excludes the State B overlay;
- keep `OW-001` and other non-blocking backlog items documented;
- keep `OW-035`, C6, C7, functional device QA, store paperwork and signing open;
- qualify supersession claims where Revision 1 is unavailable; and
- treat only canonical Entry 0058 as the live execution record.

### 7.3 Curated evidence only

The docs commit may include only paths in the tracked evidence allowlist. The allowlist must exclude unrelated `.agents`, State B UI files, profile/SOUL files, challenge scripts and scratch artifacts.

## 8. Tracked Audit Verifier

Create `tools/audit/verify_state_c_release_evidence.mjs` and a JSON fingerprint file. It must support:

- normal verification mode;
- `--self-test` negative probes on temporary copies outside the repository;
- exact candidate hashes/line counts from JSON;
- State C ancestry and clean-candidate status checks;
- canonical/archive ledger identity, line-count, hash and crosswalk checks;
- heading, UTF-8/mojibake and status checks;
- manifest record, tier and duplicate-ID checks;
- all cited immutable/mutable paths, hashes and line bounds;
- outstanding-work origin admissibility; and
- curated allowlist / forbidden artifact checks.

Self-tests must mutate at least: one candidate hash, one duplicate record ID, one citation hash, one lineage hash, one contradictory status, one mojibake sequence and one forbidden curated path. Each must fail its owning check.

## 9. Required Gates

Run in this order and record exact exit codes:

1. `npm run typecheck`
2. `npm run verify:blocks`
3. `npm run verify:migrations`
4. `npm run verify:store`
5. `npm run verify:components`
6. `npm run verify:ci`
7. `node tools/audit/verify_state_c_release_evidence.mjs`
8. `node tools/audit/verify_state_c_release_evidence.mjs --self-test`
9. `npm run verify:memory-contract` as an expected closed-gate check only
10. `git diff --check`

Do not run or claim `verify:release`.

## 10. Commit Structure

### Commit 1

Message exactly:

```text
fix(progression): decouple chain rep floor from load routing
```

Stage only:

- `packages/inference/src/blockGenerator.ts`
- `packages/inference/test/verify_blocks.mjs`

### Commit 2

Message exactly:

```text
docs(audit): reconcile State C release evidence
```

Stage only the curated documentation/evidence paths from §3.2–§3.3, including the append-only ledger Entry 0058 and tracked verifier/fingerprint. Do not stage product files from Commit 1 again.

Freeze this commit and record its full SHA-256 candidate fingerprint before review.

### Commit 3 — administrative certification only

After two independent full-scope `APPROVE` verdicts, add only:

- verbatim reviewer handoffs under the curated review directory;
- manifest/fingerprint records for those handoffs;
- synthesis/ledger administrative verdict metadata; and
- any verifier fingerprint re-pin required solely by those administrative bytes.

Message exactly:

```text
docs(audit): record independent State C certification
```

No substantive claim or code change is allowed after the reviewed freeze without a new reviewer pair.

## 11. Independent Review

Dispatch exactly two fresh read-only reviewers in parallel without sharing conclusions or a desired verdict.

- **Reviewer A:** reconstruct both ledger lineages; verify every manifest record, citation, supersession/status disposition and zero-hallucination claim; confirm `OW-024`, `OW-025`, `OW-035` and every remaining ledger status.
- **Reviewer B:** verify HEAD/ancestry, `OW-036` behavior and mutation proof, tests/gates, migration/schema boundaries, C6/C7 wording and curated-diff safety.

Any `REQUEST_CHANGES` returns to remediation, all required gates, a new freeze and an entirely fresh reviewer pair.

## 12. Final Acceptance

The branch is accepted only when:

- the three required local commits exist in order;
- the branch is clean and has no upstream;
- all locally actionable gates are green;
- audit verifier normal/self-test modes are green;
- dual independent approvals cover the exact reviewed freeze;
- no forbidden artifact is tracked;
- C6/C7 and all owner/device/store/signing/push actions remain open; and
- the final handback is exactly truthful:

```text
IMPLEMENTATION AND DOCUMENTATION: COMPLETE
AUDIT SYNTHESIS: APPROVED
RELEASE/PUSH: NO-GO — C6 DEFERRED; C7/OWNER AND DEVICE GATES OPEN
```
