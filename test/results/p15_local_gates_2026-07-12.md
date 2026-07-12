# P15 local gate run — 2026-07-12 (Cowork sandbox, Ubuntu 22 / Node 22.22)

Commit scope: Phase 15 (athlete registry, per-athlete DB files, onboarding
questionnaire, Coach Mode UI, verify:coach gate). No schema migrations.

| Gate | Result | Note |
|---|---|---|
| typecheck | PASS | strict TS, whole app + packages |
| verify:db | PASS* | *red on the sandbox's system libsqlite (pre-3.38 STRICT/REAL quirk, "cannot store REAL value in REAL column"); PASS under pysqlite3-binary (modern SQLite). Schema untouched this diff; CI's SQLite is authoritative. |
| verify:demo | PASS | |
| verify:migrations | PASS | athlete_profile + movement library survive reset |
| verify:policy | PASS | |
| verify:blocks | PASS | |
| verify:autopilot | PASS | |
| verify:biometrics | PASS | |
| verify:semantic | DEFERRED → CI | sandbox blocks the Hugging Face fetch (fetch:embedder TypeError: fetch failed); semantic layer has zero changes in this diff |
| verify:embedder | DEFERRED → CI | same cause |
| verify:store | PASS | includes the new onboarding-stamp SELECT |
| verify:coach | PASS | new gate, 11/11 registry-invariant checks |
| verify:memory | PASS | |

11/13 green locally; 2 deferred to CI with cause recorded. Push gate: CI must
run all 13 green before the APK artifact is trusted.
