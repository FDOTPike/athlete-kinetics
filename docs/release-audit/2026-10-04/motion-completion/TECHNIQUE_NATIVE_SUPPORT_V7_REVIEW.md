# Independent technique review: support repair and kickback V7

**Result: the previous head-support geometry/bounds defect is repaired at the source level, and ID84 meets this bounded source/action review. No new material technique defect was established.** ID220's neutral-versus-imported-rotation source choice remains held. All sixteen previews remain pending; this review grants no technique status change, native animation, smoothness, iOS or memory approval.

Reviewed clean detached commit **510127dd54798ad7963139908a2207e73531d119** in `C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App`. The mutable main checkout was not inspected. All **65 captured inputs** match their stable capture checks. [Machine-readable evidence](TECHNIQUE_NATIVE_SUPPORT_V7_EVIDENCE.json) contains full measurements, source hashes, preserved-production comparisons and artifact checks. The freeze is released after completion of this report and evidence.

Scope: prior IDs 143, 53, 82, 138, 163, 92, 158, 253, 80, 262, 292, 264, 49, 178, 220 and new ID84, each neutral/male/female. Measured **6,297 production poses** across 48 complete cycles sampled every 33 ms with the terminal pose included. Visually inspected fifteen new cycle PNG sheets for ID84 and the four repaired support movements, plus fifteen neutral card sheets at app240, 320px, 390px. Cycle sheets sample twelve positions; this is not observed animated playback.

## Previous V6-1: finite head support and renderer bounds repaired

`tools/rendering/lib/canonicalSvg.mjs:137` now insets centered SVG strokes by half their width. The circle path at `canonicalSvg.mjs:156` therefore paints to the primitive's original outer radius, matching the native View border box in `apps/mobile/src/components/movementPreview/MovementPreview.tsx:289`. The corresponding rounded bone/rect paths also inset their outlines; bounds accounting no longer adds an external stroke allowance at `canonicalSvg.mjs:182`.

The source-level native/SVG outer-bound discrepancy identified in V6 is resolved. This conclusion comes from the frozen primitive mappings and independent geometry. It is not a claim that native device pixels or an animation were observed.

ID143's head target now uses `body.hr + 2` at `apps/mobile/src/components/movementPreview/canonicalFigure.ts:829`, rather than the former SVG-specific extra 1.25 allowance. Flye heads use the same native outer-radius convention at `canonicalFigure.ts:714`, and the flye pad extends to `padAt(44/24)` at `canonicalFigure.ts:710`.

The independent contact calculation accounts for the **finite rounded pad**, trimming its centerline by the pad radius at both ends. It measures the distance from the head center to that finite inner axis, then subtracts the actual native circle radius and pad radius. It does not substitute an infinite support line.

| Support movement | All-body finite gap | Smallest margin inside rounded pad's supported axis |
| --- | --- | --- |
|143, forehead-supported lateral raise | Within 2e-14 units | 10.0000 units |
|49, flat flye | Within 2e-14 units | 4.0543 units |
|178, decline flye | Within 2e-14 units | 4.3162 units |
|220, incline flye | Within 2e-14 units | 5.0119 units |

All twelve support/body cases remain tangent through their complete working cycles, with the head projection inside the pad's supported span. Head/body/support anchors remain quiet. The rendered cycle/card sheets also show continuous head/pad contact; the flye pad no longer ends before the supported head.

The existing back contact, decline ankle restraint, lateral arm action and flye arm/load geometry remain as previously reviewed. This repair removes the prior geometric/parity blocker. Native animation evidence is still unavailable, so native compositor behavior, device pixels and smoothness require the separate runtime gate.

## ID84: source, hip action and equipment

The binding `docs/audits/accessible-coach/movement-completion/KICKBACK_SOURCE_BINDING.json:1` matches `packages/core-db/src/schema/017_movement_batch.sql:32` exactly, including its source-file SHA, instructions and cues. Later coaching entries at `025_movement_coaching_content.sql:33` and `:167` retain the same instruction and cue text.

That source calls for an ankle strap on a low cable, facing/holding the stack for balance, a slight forward lean, a short backward-and-upward glute-driven leg action, and controlled return before the lower back starts arching. The authored record is `apps/mobile/src/components/movementPreview/families/glute-kickback__standing.json:1`.

`canonicalFigure.ts:651` implements a hip-centered working-leg arc with a fixed soft knee. Its solved joints are adopted at `canonicalFigure.ts:1138`. The low pulley and cable to the actual working ankle are drawn at `canonicalFigure.ts:1155`; the moving cuff is drawn across that ankle at `canonicalFigure.ts:1342`. Both balance hands stay on the crossbar connected to the stack.

Across all 405 sampled ID84 poses:

| Contract | Independent result |
| --- | --- |
| Working-leg sweep | 25 degrees about a fixed hip |
| Upper/lower leg lengths | 22.25 / 22.25 units; maximum error below 1.1e-14 |
| Knee bend | 5 degrees throughout, variation below 5e-13 degrees |
| Torso hinge | 14.0362 degrees, unchanged |
| Quiet anchors | Head, trunk, hip, waist, balance arms/hands and support knee/ankle have zero drift |
| Heel direction | Ankle moves 18.7886 units backward and 4.1653 units upward |
| Support | Planted ankle remains at screen Y96 |
| Cable/cuff | Cable endpoint and cuff midpoint track the working ankle with zero gap |
| Cuff orientation | Perpendicular to the actual shin, error below 2.9e-15 |
| Tempo/return | 1,400 ms outward action, 800 ms hold, 2,200 ms return; closed 4,400 ms cycle |

The 25 degrees is the working-leg sweep relative to the quiet pelvis, not an assertion that anatomical hip extension reaches an absolute 25 degrees. The slight torso lean means the arc starts with some hip flexion and finishes with a small extension. The chosen range and 5-degree knee bend are schematic choices, not targets for every person.

The three body cycles show a source-specific cable kickback with a moving ankle attachment. The hands provide balance and do not pull the cable. The small cards preserve the cuff, low pulley, support stance and stationary grips. Captions describe the short owned range, quiet torso/pelvis, squeeze and slow same-path return.

Side view establishes a quiet hip anchor and sagittal trunk/leg action. It cannot independently expose frontal-plane pelvic leveling or complete cuff/body volume. The cue to keep hips level is appropriate, but this rig does not certify an individual's pelvic control, safe load, strap fastening or exercise setup/dismounting.

## Prior fifteen movements preserved

Compared exact V6 source **522f9f1c32d7ae6771c21856cd3291c499e7fbfc** with this V7 production source and each version's own committed family records. All fifteen previous IDs retain their segment timing and all non-head joint coordinates throughout all 45 prior body cycles.

For eleven IDs, the complete production primitive arrays are exactly identical to V6 across all three bodies: 33 body cycles. ID143 differs only in the head/neck primitives needed for the support correction. Each flye differs in the intended pad/support and head/neck primitives; arm, load and leg mechanics are unchanged. The SVG files are expected to differ because their outline mapping was repaired. An identical-image claim is therefore not made.

ID292's rope action, ID264's shoulder sweep, ID253's wrist/load alignment, the earlier shrugs and preacher curls retain their previous bounded action results. No new mechanical failure was established in this preservation review.

## Retained holds and evidence boundary

**V6-2 / ID220 remains held:** current curated SQL omits grip rotation, while the preserved imported source specifies rotating wrists. The fixed-neutral incline fly remains an explicit engineering choice pending source/owner ratification. See [V6 source distinction](TECHNIQUE_FLYES_V6_REVIEW.md); V7 makes no guess or ratification. **IDs 135/187 remain held** for the owner-corrected prone I/Y endpoint.

All 48 cycle PNG/HTML/encoded-frame/timestamp checks pass. All 600 indexed card PNG/SVG files match their exact commit, preview digest and file hashes. No tests were rerun by this technique auditor and no implementation-wide pass is claimed. Implementer-reported RN-style and Sharp probes belong to the independent runtime evidence, not observed native animation in this review.

Selected immutable hashes:

| Source/artifact | SHA-256 |
| --- | --- |
|`canonicalFigure.ts` |`83831045a8eb6d984c140b7416d999932ba8db2ce3543de4142681197daf0637` |
|`MovementPreview.tsx` |`828033dcdb8cd4f62770584b7b0019bfeaca0822bb37ea099b92e40d5f923173` |
|`canonicalSvg.mjs` |`0c6a0d6a0c51a1f4fa49633082ae77f8b4b6bb2330bceb280e6a73471eb974ff` |
| V7 cycle index |`a80ab50f3f4fad15f22bc8c10ed43c592764aa6322ccbbb4f7980494b81a82f6` |
| Preview-data digest |`f89df47e6753659fbd89063c8e50efff31c2debb057eed60abba32fac1a6ae8c` |

The complete source/artifact hashes are in the evidence JSON. The all 300 storage decision and host measurements do not establish physical technique or phone memory behavior. No 4GB criterion was imposed by this auditor.

Automatic browser approval previously rejected local HTML playback because the protocol was disallowed. No alternate browser/server workaround was used. This review does not claim observed animated browser playback, native FPS, iOS execution or device technique approval.
