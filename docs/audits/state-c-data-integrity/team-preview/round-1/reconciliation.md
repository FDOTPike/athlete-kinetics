# Reconciliation — State C Data-Integrity Stack, Team Preview Round 1

**Author:** Claude Opus 5 (implementer under audit)
**Reviewer:** Gemini 3.8 / Antigravity auditor team
**Date:** 2026-09-09
**Reviewer verdict:** APPROVE WITH FINDINGS
**Candidate:** `1a790776f4efb50fc2d38a58b60997579c46f310`, tree
`dbca4aedfe75dcb82aaca21ff6ca7c84331316ee`, branch `codex/rpe-familiarisation`
**Reviewer report:** [`reviewer-gemini.md`](reviewer-gemini.md), SHA-256
`e07a01e68c59749f15959f8cdd5b12e00d2076c109ef0325e7c5b3759b769622`, recorded verbatim and
not edited.

---

## 1. Audit quality

The review is admissible and was conducted properly. The reviewer built its own worktree at the
correct candidate SHA with a real `npm ci`, reproduced every gate independently rather than
quoting the author's numbers, mutated five gates and confirmed all five bit, and probed SQLite's
cascade/trigger behaviour directly instead of taking the author's premise on trust. It also
located the 026 retraction more precisely than the author had: `fbbd9a3`, not `6e132db`, which
closed `OW-007` and `OW-011`.

Eight of nine claims CONFIRMED. One REFUTED — correctly.

---

## 2. Finding-by-finding disposition

### F2 — "15 of 17" is wrong · **UPHELD, count confirmed; root cause NOT confirmed**

**Count.** Re-derived independently from the shipped corpus: **17 of 17**. The reviewer is
right and the author was wrong.

The two the author missed are the ones the reviewer named: `Chin-up` and `Weighted Pull-up`,
which carry `supported_prefixes ["Bodyweight","Banded"]`
(`packages/core-db/src/schema/010_movement_library.sql:73,80`) against a `movement_equipment`
requirement of `pullup_bar` (`packages/core-db/src/schema/007_program_engine.sql:169,179`).
`Banded` requires `bands`; owning a pull-up bar does not imply owning bands.

**Root cause — the reviewer's explanation does not survive.** It proposed the author "overlooked
that `Banded` requires `bands`". Mutating `IMPLEMENT_REQUIREMENT.Banded` to `{ kind: 'none' }`
produces **12 of 17**, not 15 — five corpus movements depend on `Banded` being
equipment-requiring (`Chin-up`, `Weighted Pull-up`, `Push-up`, `Nordic Curl`, `Face Pull`), not
two. So that hypothesis cannot yield 15. The original measuring script no longer exists and the
figure is not reconstructible. **No cause is recorded**, because guessing one and writing it
into a decision record is the failure this ledger exists to prevent.

**Severity.** The reviewer graded F2 "Minor / Documentation". That understates it. The number
was not only in the ledger — it was a load-bearing comment in shipped source at
`packages/inference/src/types.ts`, and its whole function was to justify why
`IMPLEMENT_REQUIREMENT` exists. A justification nobody recomputes is a claim, not evidence.

**Remediation.** Commit `9ecc5a8`. The figure is now DERIVED from the live corpus by a
`[F2-corpus]` gate in `verify_blocks.mjs`, not asserted in prose. `PROMPT_LEDGER.md` Entry 0102
is corrected by an appended note, never an in-place edit — the ledger protocol is byte-fidelity
of the recorded output.

**A trap found while fixing it, worth recording.** The gate could not use `verify_blocks.mjs`'s
module-level `db`: that database applies migrations **001–015 only** and holds the old 010-era
library. Migration 049 narrows several `supported_prefixes` lists, so the truncated database
reports **19 multi-implement movements across 30 movements**, where the shipped corpus has **17
across 300**. The first version of this gate measured the wrong corpus and would have enshrined
19. The gate now builds its own full-chain database and pins `rows.length === 300` so the
substitution cannot recur silently.

### F1 — O1 is worse than the author recorded · **UPHELD. This is the finding of the round.**

Confirmed at `packages/inference/src/loadSelection.ts:123`:

```ts
const calculated = !bodyweightMode && validTargetReps && validTargetRpe && oneRm !== null
  ? targetLoadKg(oneRm, targetReps, targetRpe) : null;
```

`bodyweightMode` gates 1RM-derived target load. Because `SessionScreen.tsx:329` computes
`bodyweightMode` from `supportedPrefixes[0]`, an athlete who declares `DB` for a movement whose
element zero is `Bodyweight` receives **no computed target load at all**, on top of the wrong
input label. Neither the author nor the original O1 write-up had traced that consequence — the
author had characterised O1 as a presentation and attribution mismatch. The reviewer went one
layer deeper and was right to.

Accepted at **Moderate**. Deferred to the active session runner work order by owner direction,
carrying this consequence.

### F3 — "the audit prompt cited `packages/inference/src/seed/movementLibrary.ts`" · **REFUTED**

`grep -rn "seed/movementLibrary"` across the repository returns **zero hits** in any `.md`,
`.ts`, `.tsx` or `.mjs` file. The audit prompt does not name that path either; it cites
`types.ts`, `SessionScreen.tsx`, `useStore.ts` and `blockGenerator.ts`. The citation being
criticised does not exist in the prompt or in the repository.

**Not carried forward as a live finding.** Recorded here so a later round does not rediscover it
as open. The reviewer's underlying point — that the movement catalogue's source of truth is the
SQLite schema migrations — is correct and is not in dispute.

---

## 3. Claims: no disputes

C1–C4 and C6–C9 are CONFIRMED and the author accepts each disposition without qualification.
C5 is the F2 refutation, handled above.

Worth noting on C9: the reviewer mutated five gates and all five bit. Three further mutations
were applied while remediating F2, and all three bit — including one that specifically pins the
truncated-corpus trap described above.

---

## 4. Register consequences

| Item | Effect |
|---|---|
| `OW-017` | **Measured, and CLOSABLE as latent-not-live.** 0 of 235 sole-prefix loaded movements can be planned with an implement the athlete may not own. The code hole is real — `plannedImplementFor`'s sole-prefix fallback does not consult `implementAvailable` — but the shipped corpus does not reach it. Held closed by the `[OW-017]` gate, which fails if a library correction opens it. |
| O1 / F1 | New register row, deferred to the active session runner work order, carrying the `loadSelection.ts:123` consequence. |
| F3 | No register row. Refuted. |

## 5. Outstanding, unchanged by this round

`RG-01` (C6 device memory evidence) remains the sole release blocker; `verify:release` exits 1
via `verify:memory-contract`, as disclosed to the reviewer in advance. `OW-006` reachability
remains gated on the owner-only `OW-026` and is dose-neutral. `endSuspension` still carries an
unguarded `ROLLBACK`, low severity, unchanged.
