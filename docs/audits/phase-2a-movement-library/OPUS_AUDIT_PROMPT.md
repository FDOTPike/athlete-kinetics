# Phase 2a Movement Content Audit — Opus Work Order

## Role and authority

Act as the independent, read-only content auditor for the 176 movements added in
Phase 2a. Audit every target record; sampling is not acceptable.

Your findings are correction proposals, not permission to edit the repository.
Do not modify the four inputs, the shipped migrations, their manifests, or any
fingerprint. Do not generate movement videos or approve media spend.

## Frozen audit baseline

- Repository commit: `1fcac308c7d58ac370c02501663dfe18f5f02c3e`
- Branch used to prepare this packet: `codex/pre-release-content-correction`
- Expected target: exactly 176 unique names in migrations `037`–`048`
- Expected live library after those migrations: exactly 300 movements
- The hashes and byte sizes below must match before starting.

| Input | Bytes | SHA-256 |
|---|---:|---|
| `library_target_v1.json` | 8,776 | `3cd61e7c8576369a0c51c57f2ba735da7fcec022c3d2d525207a029f73cf535b` |
| `movement_coaching_intent_v2.json` | 140,989 | `fd1d866fac351e6e5690c22d5a9b99dc3759e3c90023fb6c7531dfa4f04d7895` |
| `movement_coaching_intent_v2_manifest.json` | 27,517 | `875f18ef5808ade63bf167c53366c0ffa37268577d8360842ede2e379a76463a` |
| `movement_import.json` | 465,431 | `64bb31e29390a5a3c64aea17e855b1338b5762780d5259667b2cc4e39633313c` |

Stop and report `INPUT_INTEGRITY_FAILURE` if a file is missing, a hash differs,
the target does not contain exactly 176 unique names, or the v2 manifest does
not cover exactly those names.

## How the inputs relate

- `library_target_v1.json` is the authority for the 176 names and batch slots.
- `movement_import.json` supplies the staged taxonomy, equipment, muscles,
  difficulty, compound flag, instructions, and cues. Audit only target names.
- `movement_coaching_intent_v2.json` supplies the staged intent, setup steps,
  cues, and declared content hash for the same 176 names.
- `movement_coaching_intent_v2_manifest.json` freezes each shipped text
  fingerprint. It is evidence, not an editable correction destination.

When repository and general exercise terminology disagree, flag the ambiguity;
do not silently reinterpret a movement. When external research is needed, use
recognised coaching or governing-body sources, cite them, and clearly separate
source-backed facts from your inference. Do not treat the imported dataset as a
technique authority merely because it is the source dataset.

## Mandatory full-corpus checks

For each of the 176 names, independently assess:

1. Identity and duplication: the name identifies a coherent movement and is
   not a semantic duplicate or misleading variant.
2. Taxonomy: `pattern`, primary and secondary muscles, supported equipment,
   difficulty, and compound/isolation status are plausible and mutually
   consistent.
3. Coaching specificity: the intent, 2–4 setup/execution steps, and 1–3 cues
   actually distinguish this movement from a generic pattern template.
4. Technical sequence: the described start, movement path, finish, and reset
   match the named movement; unilateral or alternating behaviour is explicit
   where material.
5. Safety and claims: wording is practical, positive, non-diagnostic, and free
   of guarantees or invented injury-prevention claims.
6. Internal consistency: the two content files agree, and the declared content
   hash maps to the same name and text identity.

Do not fail a record merely because concise coaching copy is shared with a
closely related variation. Do fail or flag it when shared copy erases a
material technical distinction, describes a different exercise, uses the wrong
equipment, or assigns a materially wrong pattern.

## Known findings that must be reproduced

- `Kettlebell Turkish Get-Up (Lunge style)` is currently described as a simple
  split-stance lunge. Its staged movement pattern is `unilateral`, while the
  shipped `movement.pattern` is `lunge`. Treat the coaching mismatch as a
  release-blocking correction candidate and audit all related taxonomy fields.
- `Janda Sit-Up` uses generic trunk-training copy that may omit the defining
  hamstring/glute activation constraint. Determine whether it needs specific
  correction and explain the evidence.
- The collection contains extensive shared templates. Audit all 176 records for
  semantic mismatches; do not report template reuse alone as proof of error.

If the first known finding is not reproduced, return `AUDIT_INVALID` rather than
a passing verdict.

## Severity and disposition

Use exactly these severities:

- `P0`: unsafe or unusable release state.
- `P1`: materially wrong movement identity, coaching, taxonomy, or equipment;
  must be corrected before wider beta.
- `P2`: meaningful quality or specificity problem; correction recommended.
- `P3`: editorial improvement only.

Use exactly these dispositions:

- `approve`
- `correct`
- `remove_or_replace`
- `needs_human_technique_decision`

Do not assign `approve` when a P0–P2 finding remains open.

## Required outputs

Return these three files and no repository edits:

### 1. `AUDIT_SUMMARY.md`

Include:

- verdict: `PASS`, `PASS_WITH_NONBLOCKING_FINDINGS`, or `FAIL`;
- input-integrity result and the four observed hashes;
- audited count, which must be 176;
- counts by severity and disposition;
- release-blocking names;
- taxonomy-wide or template-wide themes;
- an explicit statement that all 176 names were examined.

### 2. `movement_content_audit_result_v1.json`

Produce one entry for every target name, in target batch and name order:

```json
{
  "schemaVersion": 1,
  "baselineCommit": "1fcac308c7d58ac370c02501663dfe18f5f02c3e",
  "auditedCount": 176,
  "records": [
    {
      "slot": "037",
      "name": "Example",
      "disposition": "approve",
      "highestSeverity": null,
      "confidence": "high",
      "findingCodes": [],
      "rationale": "No material issue found.",
      "evidence": []
    }
  ]
}
```

`confidence` must be `high`, `medium`, or `low`. `evidence` must contain direct
links or precise attached-file references. The set and order of names must
exactly match `library_target_v1.json`; no omissions or extra records.

### 3. `movement_content_correction_candidates_v1.json`

Include only records whose disposition is not `approve`:

```json
{
  "schemaVersion": 1,
  "baselineCommit": "1fcac308c7d58ac370c02501663dfe18f5f02c3e",
  "records": [
    {
      "slot": "044",
      "name": "Example",
      "severity": "P1",
      "findingCodes": ["COACHING_DESCRIBES_DIFFERENT_MOVEMENT"],
      "current": {
        "pattern": "lunge",
        "coachingIntent": "...",
        "setupSteps": ["..."],
        "cues": ["..."]
      },
      "proposed": {
        "pattern": "rotation",
        "coachingIntent": "...",
        "setupSteps": ["..."],
        "cues": ["..."]
      },
      "rationale": "...",
      "evidence": ["..."] ,
      "requiresHumanDecision": true
    }
  ]
}
```

Include every field that needs correction and omit unchanged fields. Proposed
coaching must retain 2–4 concise steps and 1–3 distinct, positive cues. Do not
change a name or recommend removal without a separate rationale and evidence.

## Final validity checks

Before returning the files, verify:

- every target name appears exactly once in the full result;
- every non-approved result appears exactly once in the correction file;
- every proposed field is valid under the existing vocabulary in the inputs;
- the known Turkish Get-Up mismatch is present as a release blocker;
- no input, migration, manifest, hash, or repository file was changed.
