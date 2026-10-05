# Migration lineage contract

`PRAGMA user_version` is the number of migration **entries** applied — an ordinal
into `MIGRATIONS` in `src/migrations.ts` — not a migration file number.

## Two shipped lineages (integrated 2026-10-04)

| Lineage | Commit | Entries | Ordinal 34 | Notes |
|---|---|---|---|---|
| master | `1da218d8b1886040dcf89e0d630581f7b33824d9` | 34 | `058_suspension_episode` | strict 034 CHECKs; 058 without inline comments |
| feature | `12a1fb15aff5611b771348a53e2e04f4079e0e34` | 67 | `035_profile_load_preference` | relaxed 034 (converged by 061); 058 at ordinal 57 |

Ordinals 1–33 (`001`…`034`) name the same migrations in both lineages, and
files `001`–`033` are byte-identical. Only ordinal 34 diverges.

## The unified chain

The feature order **is** the unified chain (67 entries at integration; every later
migration is appended after `068`). It was not reordered, and no shipped SQL file
was edited. The first later append is `069_resting_heart_rate` (ordinal 68): a new
`resting_hr_daily` table only, recorded in the manifest like every other entry.
`MIGRATION_LINEAGE.json` records the SHA-256 of every shipped file and its
ordinal, and of master's 34-entry chain. Master's exact `034`/`058` bytes and its
registry live under `test/fixtures/lineage/master-1da218d/`.
`verify:migrations` fails on any byte or ordinal drift.

## Reconciliation (`reconcileMigrationLineage`, before every migration run)

| State at boot | Meaning | Action |
|---|---|---|
| `user_version` ≠ 34 | shared prefix (<34) or unambiguous feature state (>34) | none |
| 34, `suspension_episode` present, `profile_load_preference` absent | master install | rewind to 33 in one transaction; the chain then applies 035…068 normally (058 re-applies as an `IF NOT EXISTS` no-op) |
| 34, `profile_load_preference` present (with or without `suspension_episode`) | 035 applied — a feature install, or a master install interrupted right after 035 | none; continue at 036 |
| 34, neither table | unidentifiable | **fail closed** before any write with `MigrationLineageError` (`migration_lineage_ambiguous`): nothing changed, recovery guidance in the message |

The reconciliation only engages when the supplied chain really is the unified chain
(035's table at index 33 and 058's at index 56).

## Known schema-text equivalence (backup contract)

`CREATE TABLE IF NOT EXISTS` never rewrites stored SQL, so an upgraded master install keeps
master's `suspension_episode` text (same columns, CHECKs, indexes and triggers; no inline
comments). `KNOWN_LINEAGE_SQL_EQUIVALENTS` in `src/backup/schemaContract.ts` maps that **one
exact string** to the canonical text before fingerprinting. Any other text, including a
whitespace reflow or a changed CHECK, still fails the contract. Backup contract fingerprints
were not edited.

## Evidence

- `test/verify_migration_lineage.mjs` ([L1]–[L7]): frozen bytes and registry parity, populated
  master v34 upgrade without replay, master v20/v33 and every feature state 32–67, ambiguous
  states failing closed, interruption at six points, repeat application, self-heal, and the
  backup-contract equivalence. The same gate run against the pre-integration feature runner
  fails (master v34 upgrades only through a 101-write full replay).
- `apps/mobile/test/components/BackupLineageCompat.test.js`: the real backup store, production
  `migrate` and AES-GCM round-trip a populated master-upgraded athlete, a mixed master + feature
  pair, and a coached athlete still at master v34; tampered schemas are refused with live data
  byte-identical.

## Not covered

- Downgrade: installing an older build over a newer database is unsupported on both lineages.
- These are host proofs over real SQLite files, not device acceptance.
