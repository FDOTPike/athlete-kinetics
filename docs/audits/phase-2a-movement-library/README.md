# Opus audit attachment set

Send `OPUS_AUDIT_PROMPT.md` as the instruction and attach these four frozen
inputs from this worktree:

1. `packages/core-db/staging/library_target_v1.json`
2. `packages/core-db/staging/movement_coaching_intent_v2.json`
3. `packages/core-db/staging/movement_coaching_intent_v2_manifest.json`
4. `packages/core-db/staging/movement_import.json`

The prompt contains byte sizes, SHA-256 values, the complete audit rubric, the
known defects that must be reproduced, and strict output schemas. Do not attach
or ask Opus to edit migrations `037`–`048`; those migrations are shipped and
append-only.

Expected return files:

- `AUDIT_SUMMARY.md`
- `movement_content_audit_result_v1.json`
- `movement_content_correction_candidates_v1.json`

No correction is ratified merely because it appears in the Opus output. The
result is an independent audit input for owner/technique review and a later
additive correction migration.
