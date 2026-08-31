# Ledger Lineage Crosswalk — State C Release Readiness

## 0. Lineages

| Lineage ID | Role | Source identity | Treatment |
|---|---|---|---|
| `CANON` | Canonical live State C ledger | `PROMPT_LEDGER.md` at `34f91ffe548a0b9e51db863ffc6fad993619f940`, Entries 0001–0057; committed bytes SHA-256 `00f3d78475d4192a0bcbe03db2432301ab23fdabb5bb6a994b5835cb4f8f9c68`; 3,139 lines | Authoritative; preserved byte-for-byte; Entry 0058 appended for this execution |
| `AUD` | Divergent audit-synthesis lineage | `PROMPT_LEDGER_AUDIT_LINEAGE_1A878602.md`; source worktree `progression-evidence-remediation`; 3,942 lines; SHA-256 `1a8786020be1eef107a1b3c8b6e1d02ff7826b688e67789adaf1414bc8e5c3b0` | Immutable external lineage artifact; never used as the canonical ledger |

The two ledgers share older ancestry but diverge before Entry 0055 and reuse the same numeric labels for unrelated events. Numeric equality does not imply entry identity.

## 1. Overlapping Number Crosswalk

| Numeric label | Canonical State C identity | Archived audit identity | Reconciliation |
|---|---|---|---|
| 0055 | `CANON-0055` — Release-candidate completion after the worktree audit (2026-08-29) | `AUD-0055` — Request a separate-task audit-synthesis remediation workorder (2026-08-30) | Distinct events; no merge or renumber |
| 0056 | `CANON-0056` — Owner ratification of the C1 package; docket revision 2 (2026-08-29) | `AUD-0056` — Retarget audit-synthesis workorder to Opus and add Claude execution contract (2026-08-30) | Distinct events; no merge or renumber |
| 0057 | `CANON-0057` — Execute C1–C5 locally; produce final QA APK (2026-08-29) | `AUD-0057` — Execute WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION (2026-08-30) | Distinct events; no merge or renumber |
| 0058 | `CANON-0058` — State C push-ready remediation and certification (2026-08-31; current execution) | `AUD-0058` — Audit executor output and prepare an Opus continuation task (2026-08-31) | Distinct events; `CANON-0058` is live, `AUD-0058` historical only |
| 0059 | No canonical entry at the State C base | `AUD-0059` — Execute WORKORDER_OPUS_AUDIT_SYNTHESIS_CONTINUATION | Archived only as `AUD-0059` |
| 0060 | No canonical entry at the State C base | `AUD-0060` — Repair W4 verification and prepare Round 5 prompts | Archived only as `AUD-0060` |
| 0061 | No canonical entry at the State C base | `AUD-0061` — Audit Gemini continuation and complete remaining closeout | Archived only as `AUD-0061` |
| 0062 | No canonical entry at the State C base | `AUD-0062` — W6 administrative closeout and review certification | Archived only as `AUD-0062` |
| 0063 | No canonical entry at the State C base | `AUD-0063` — Prepare GLM-5.3 Hermes continuation package | Archived only as `AUD-0063` |
| 0064 | No canonical entry at the State C base | `AUD-0064` — Corrective continuation: ledger pairing/verifier/chronology | Archived only as `AUD-0064` |
| 0065 | No canonical entry at the State C base | `AUD-0065` — Corrective ledger repair and focused review; historical two-Output defect | Archived only as `AUD-0065`; never a canonical execution record |

## 2. Closure of `OW-024`

`OW-024` required reconciliation of the two divergent `PROMPT_LEDGER.md` lineages before merge. This candidate does not merge the lineages. It closes the release-blocking ambiguity through three controls:

1. the exact audit lineage is archived byte-for-byte under its own SHA-256;
2. all overlapping labels are namespaced in this crosswalk (`CANON-*` versus `AUD-*`); and
3. canonical State C history remains the live ledger, with Entry 0058 appended after byte-identity proof of Entries 0001–0057.

A future reader cannot mistake archived Entry 0065, including its historical two-Output defect, for the canonical Entry 0058 execution record.

## 3. Reproduction

From the clean State C worktree:

```bash
git show 34f91ff:PROMPT_LEDGER.md | sha256sum
# 00f3d78475d4192a0bcbe03db2432301ab23fdabb5bb6a994b5835cb4f8f9c68

sha256sum docs/audits/state-c-release-readiness/lineage/PROMPT_LEDGER_AUDIT_LINEAGE_1A878602.md
# 1a8786020be1eef107a1b3c8b6e1d02ff7826b688e67789adaf1414bc8e5c3b0
```
