# Frozen evidence archives

Immutable copies of completed external audit runs whose conclusions are cited by decision records
under `docs/decisions/`. Preserved here so that a cited verdict can be inspected and re-checked,
not merely re-read.

## Governing ruling

Owner decision 6 of `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`, ratified
2026-08-26: preserve an immutable copy in a durable archive, with this repository as the
authoritative location.

## Retention rule

**Indefinite and immutable.** Files in a run directory are never edited in place and never deleted.
A later audit covering the same claims is added as a **new dated run directory alongside** this
one; it does not replace it. The record of what the project believed at ratification time must
remain recoverable.

Correcting an archived run is not permitted. If a run is later found to be flawed, the finding is
recorded in the citing decision record — the archive keeps what was actually relied upon.

## Byte preservation

`.gitattributes` disables end-of-line conversion for `docs/research/audits/**`. This is load-bearing,
not cosmetic: 17 of the 25 files in the 2026-08-26 run contain CRLF, including all six binding
artifacts. Under the repository's default `* text=auto eol=lf` rule those bytes would be rewritten
on commit and checkout, and every recorded SHA-256 would fail to verify. **Do not remove that
rule.**

## Verifying a run

From this directory:

```
sha256sum -c progression-terra-2026-08-26.sha256
```

All 25 lines must report `OK`. The manifest covers the complete run; the six binding artifacts
named in `docs/research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md` are a subset of it and carry
the same hashes there.

## Runs

### `progression-terra-2026-08-26/`

Independent audit of the progression-measurement evidence review. 25 files, 777 KB, all plain text.
Verdict ACCEPT; 51 material claims dispositioned 3 retain / 17 rewrite / 17 quarantine / 14
full-text-required.

Six binding artifacts — `AUDIT_REPORT.md`, `OPUS_RECONCILIATION.md`, `CLAIM_LEDGER.csv`,
`SOURCE_LOG.csv`, `RUN_MANIFEST.json`, `PROCESS_ASSURANCE_APPENDIX.md`. The remaining nineteen are
the derivation trail: `checkpoints/` (eight per-question locked records), `calculations/` (three
reproducibility scripts and a derivations note), `inputs/` (the commissioning brief, the handover,
and both agent outputs), `VERDICT_LOCK.json`, `source_metadata.json`, and `workorder.md`.

Copied unscrubbed, by ruling, so that the archived bytes hash-match the artifacts the audit
produced. The files therefore contain sixteen author-local absolute paths. They carry no
credential or personal data; a scan for keys, tokens, and account identifiers found none.

**Nothing in this run is ratified by its presence here.** The archive records what an audit
concluded. Which of those conclusions carry authority is settled only in `docs/decisions/`.
