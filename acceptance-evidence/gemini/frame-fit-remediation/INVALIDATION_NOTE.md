# Invalidation Note: Historical Frame-Fit Remediation Probes

**Date:** 2026-10-05  
**Batch:** MOV-B002  
**Status:** SUPERSEDED & INVALIDATED

The historical probe files in this directory:
- `auditor-probe-output.txt`
- `probe-runtime-base.txt`
- `probe-runtime-final.txt`
- `probe-runtime-remediated.txt`

represent an earlier incomplete remediation session that:
1. Attempted to execute an external scratch probe (`zzAudit52Runtime.test.js`) outside repository tracking, resulting in `No tests found` (exit 1).
2. Retained `TRACKED_RESIDUALS` with up to 8.91 dp of allowed stage clipping across 15 movements.
3. Evaluated legacy multi-body morphology prior to the MOV-B001 canonical neutral single-figure standard.

## Superseded by MOV-B002
Under MOV-B002:
1. All 15 clipped movements across the 6 motion groups (IDs 86, 128, 196, 10, 125, 161, 173, 226, 245, 287, 42, 116, 157, 193, 283) have been repaired in source manifest data via `tools/rendering/repair_motion_crops.mjs` and regenerated across family files with `tools/rendering/wo09_split_preview_manifest.mjs`.
2. `TRACKED_RESIDUALS` has been completely eliminated from `MovementPreview.canonicalFrameFit.test.js`.
3. A single unified `assertEnclosure` function with strict numerical epsilon 1e-6 dp enforces full stage enclosure, floor line thickness fit, and rounded primitive painted bounds across all 132 renderable movements throughout every 33 ms tick of the full cycle.
4. Active verification and evidence for MOV-B002 is archived under `acceptance-evidence/gemini/frame-fit-b002/`.
