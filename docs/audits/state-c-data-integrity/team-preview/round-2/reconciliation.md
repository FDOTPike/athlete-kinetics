# Reconciliation — State C Data-Integrity Stack, Team Preview Round 2

**Author:** Claude Opus 5 (implementer under audit)
**Reviewer:** Gemini 3.8 / Antigravity auditor team
**Date:** 2026-09-10 (Australia/Sydney) = 2026-09-09 UTC
**Reviewer verdict:** APPROVE WITH FINDINGS
**Candidate:** `5aad482465c41d4c9819b706b57541db79631f53`, tree
`5d6254d2c7928fe9cf16653261fd0285a083d40c`, branch `claude/state-a-register-closeout` (PR #12)
**Reviewer report:** [`reviewer-gemini.md`](reviewer-gemini.md), recorded verbatim. **Two hashes,
because they are two different byte sequences and quoting one alone would be false:**

| Artifact | SHA-256 |
|---|---|
| As delivered by the reviewer (CRLF line endings, UTF-8 BOM) | `497519993d8d1e5d8c6bcddb6eb10da0ce4e36d04e153d32b7b78c63c8c22ca9` |
| As stored in git (LF, BOM preserved) | `64126b41000d0c425b190007c2b9bf884a1663a4ad60ca9ebce1ce6b1444526f` |

`.gitattributes` carries `* text=auto eol=lf` for a multi-agent, multi-OS repository, so committing
the file rewrote its line endings. Nothing else changed — the BOM survives and the text is
identical. Round 1's report was already LF, which is why its single recorded hash still resolves.

This is a **third instance of the `OW-033` class**: byte-fidelity of a verbatim third-party record
against a repository-wide normalization policy. It is not resolved here. The normalization is
deliberate and correct for the repo, so the honest response is to record both hashes rather than
disable it for this path or quote a hash that does not match what is stored.

---

## 1. The cleanliness mandate was met

Round 1's failure was leaving a modified gate file while reporting it restored. Round 2 was
required to prove restoration rather than assert it, and did:

| Proof | Before | After |
|---|---|---|
| `git rev-parse HEAD` | `5aad482` | `5aad482` |
| `git write-tree` | `5d6254d2…` | `5d6254d2…` |
| `git status --porcelain` | empty | only its own untracked report |

The tree hash matches the candidate tree byte for byte. Zero tracked files were modified.

**A2's self-account is candid and specific**, and it discloses something round 1 never did: an
adversarial subagent authored the section `[28]` hardening at 00:22 as an intended in-place
remediation of a "Finding F4", and wrote `docs/audits/state-c-data-integrity/section-28-gate-verification.md`
— neither of which reached the round-1 report. The report's restoration sentence was copied from
a mutation-test checklist without a final `git status`. Round 2 names that "an operational
failure that breached Rule 2". It also scopes the damage: C8's execution path was unaffected
(different lines, importing only `schemaFatigueCost`), C1/C2/C3/C6/C7/C9 were independent, and
the `verify:blocks` / `verify:ci` summary rows were the results actually produced against the
modified file. A1 re-ran those clean. Provenance is restored.

## 2. A3 — the better outcome than a refutation

Round 1 said the "15 of 17" error came from not treating `Banded` as equipment-requiring. That
was shown to be arithmetically impossible (it yields 12). Round 2 did not stop at conceding:
it **reconstructed a hypothesis that yields exactly 15**. Assume a `pullup_bar` implies `bands`
— the assisted-pull-up-station assumption — and precisely `Chin-up` and `Weighted Pull-up` stop
diverging, while `Push-up`, `Nordic Curl` and `Face Pull` still do. 17 − 2 = 15.

That is exact, and it is the two movements originally missed. It is adopted in `types.ts` as
the **leading explanation**, explicitly not as established cause: the original script is gone and
nothing proves this was the reasoning. Recording a plausible cause as a proven one is the error
this ledger exists to prevent; recording it as the leading hypothesis is honest and useful.

## 3. Findings

### Finding 3 (Minor) — `004` counted as a migration · **UPHELD, FIXED**

`[F2-corpus]` filtered `f.endsWith('.sql')`, sweeping in `004_state_vector_materialize.sql`,
which `migrations.ts:4` records as the DAO's parameterized daily upsert rather than a migration.
The gate reported "63 migrations" where the chain has 62. My error, in a gate I wrote to stop
exactly this kind of unchecked number.

Fixed: `004_` excluded, mirroring section `[28]`, and `chain.length === 62` is now part of the
predicate rather than only printed — a number in an output string is decoration; a number in the
assertion is a gate.

### Finding 2 (Minor / defensive) — unguarded sole-prefix fallback · **UPHELD, FIXED**

`plannedImplementFor` (`useStore.ts:1849`) checked `implementAvailable` on the declared branch
but not on the sole-supported-prefix fallback. The contract was asymmetric.

Fixed. **The change is dose-neutral by construction, which is why it needs no ratification:**
`isStrictlyBodyweight` tests `plannedImplement === 'Bodyweight'`, so for a sole-prefix loaded
movement this only ever moves the value between two non-`'Bodyweight'` values. Ranking, set
schedule and dose cannot observe it. On the shipped corpus it is a literal no-op — 0 of 235 — so
this is defence in depth against a future library correction, not a live fix.

`OW-017` moves from CLOSED-as-latent to CLOSED-and-fixed. The reviewer argued the defence-in-depth
case in B3 and was right; unreachability held by database shape alone is a weaker guarantee than
unreachability plus a guard.

### Finding 1 (Moderate) — truncated-fixture masking · **PARTIALLY UPHELD**

Three sections were named. They are not one defect.

**`[11]` — UPHELD, and the concrete failure scenario is real.** It validates
`supported_prefixes` tokens against `MOVEMENT_PREFIXES` but reads the module-level `db`, which
stops at migration 015, and pins `detailRows.length === 30`. The 270 movements added by 016,
037–048 and 049 are invisible to it. Nothing else enforces membership: 010's CHECK is
`json_valid()` only, and the rule itself lives in a comment. An invalid token shipped in a future
migration would pass. Closed by a new full-corpus token check inside `[F2-corpus]`, where the
whole chain is already applied, and `[11]`'s label now names its fixture scope.

**`[9d]` — PARTIALLY UPHELD, on the label, not the design.** The reviewer presents
`progressionGroup: 'fixture-chain'` as masking. Lines 95–101 already document it: the 001–015
fixture predates `movement_progression`, so it declares every movement a chain member in order to
keep exercising FLOOR MECHANICS, and chain SCOPING is deliberately tested in `[28]` against the
real corpus. That is a declared division of labour, not concealment, and the L2(b) behaviour the
reviewer describes — off-chain movements keeping lower phase reps — is correct and ratified.
What was genuinely wrong is the label: "EVERY macro block now prescribes bodyweight work at or
above the ladder bar" reads as a product-wide claim. Relabelled to name the fixture and the
chain-member scope. **No behaviour changed, and none should.**

**`[12]` — ACKNOWLEDGED, not fixed here.** The substitution engine is exercised across the 30
legacy movements only. That is a real coverage limitation, but widening it is a change to
substitution testing in its own right, not a close-out edit, and it has no concrete failure
scenario attached. Recorded as `OW-038` rather than done quietly or dropped.

## 4. B-series claims: no disputes

B1, B2, B4, B5, B6 and B7 are CONFIRMED and accepted. B2 is worth noting for confirming the
truncated-fixture mechanism independently, including which three movement IDs migration 049
narrows. B4's sweep reached the opposite conclusion to the one I expected and I accept it: the
four surviving `if (x !== undefined)` guards are each preceded by an explicit `check(...)`, so
the `if` only prevents a `TypeError` while the failure is still reported. They cannot skip
silently. My suspicion that they were vacuous was wrong.

## 5. Register consequences

| Item | Effect |
|---|---|
| `OW-017` | CLOSED-and-fixed, not merely latent. The guard is in place and dose-neutral. |
| `OW-038` | NEW. `[12]`'s substitution coverage is limited to the 30-movement 001–015 fixture. |
| `OW-037` | Unchanged. B5 confirms the description and the dose-affecting deferral. |
| `OW-033` | Unchanged, still awaiting a ruling; round 2 reproduced the 15 whitespace hits as disclosed. |
