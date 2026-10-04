# Independent technique review: release integration V8

Reviewed frozen commit **1185f0d0d6eb91b482afe60af4a0bf8173ba8c06** in `C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App`. Independent auditor: `/root/movement_technique_audit`. Product source was read only. The checkout remained clean and all 60 captured source inputs remained unchanged during review.

**Result: one new P2 technique depiction defect in movement 52; the previous sixteen movements are preserved exactly.** The reverse lunge has the intended backward step, planted front sole, controlled lowering/rise and return to its original stance, but its painted rear toe does not touch the floor during the portion described as supported by the rear toes. Movement52 remains pending. The existing 220 source/grip hold and 135/187 endpoint holds remain. This review grants no technique certification, native animation, performance, iOS, release or 4GB approval.

## V8-1 — P2: movement 52 rear toe floats during the supported portion

Locations: `apps/mobile/src/components/movementPreview/canonicalFigure.ts:657` (reverse-lunge geometry), `:691` (rear foot endpoints), `:1250` (painted rear foot), `apps/mobile/src/components/movementPreview/MovementPreview.tsx:249` (actual floor 96.9), `:260` (native rotated rounded bone View), and `apps/mobile/test/components/MovementPreview.reverseLunge.test.js:49` (landing assertion). Movement52's caption in `families/lunge__reverse.json:1` says the rear toes support balance.

The geometry assigns the rear distal endpoint to `soleY = 96.9 - footWidth/2`. At phases 1–3, the foot has length 5.4 and rises 3.3 from heel to toe. Its native View is a finite rotated rounded rectangle: width is endpoint distance, height is footWidth, and borderRadius is half that height. Its rounded end is inset along the foot's direction; the painted toe therefore reaches less far down than `endpointY + footWidth/2`.

For this foot, with lengthL and radiusr, the exact maximum paintedY is `max(endpointY) + r*(1 - abs(dy)/L)`. The corresponding gap to the actual floor is `r*3.3/5.4` throughout phases 1–3:

| Body | Canonical gap | Gap at the app240 stage scale 2.5 |
|---|---:|---:|
| neutral |1.32 |3.30px |
| male |1.43 |3.575px |
| female |1.21 |3.025px |

This was independently calculated from the production foot primitives and the native View bounds, and is consistent with the visible gap in the keyframe cards. The existing test checks `rearFoot[1].y + footWidth/2` against the floor; that assertion does not measure the rotated rounded View's painted contact. A passing endpoint assertion cannot clear this finding.

Repair acceptance: model the rear toe's actual painted contact with floor 96.9 throughout the supported descent, hold and rise for all three bodies. Preserve the lifted backward/return steps, the fixed whole front sole, both 22.25-unit leg chains, positive rear-knee clearance, quiet stacked trunk and full closure. Do not satisfy contact by stretching a leg, moving the entire ground/figure, or extending the foot below the floor. Recheck the complete sampled cycle, native View bounds and small cards after the responsible geometry changes.

## Source-grounded movement 52 checks

The current curated contract is `packages/core-db/src/schema/025_movement_coaching_content.sql:65`, repeated at`:199`: stand with one dumbbell in each hand, step one foot backward, lower with a hovering rear knee, drive through the whole planted front foot to stand, and shorten/reset if the front heel lifts. Its coaching cues call for a tall stacked torso and controlled backward placement. The binding is `docs/audits/accessible-coach/movement-completion/REVERSE_LUNGE_SOURCE_BINDING.json:1`; it preserves source provenance and explicitly leaves frontal alignment/native acceptance unreviewed. The sourceSQL SHA256 is `ef14633458e4702ede2994a3817873d072ed1041332bdf79b7df36e21a47752d`.

The authored entry is an independent reverse-lunge family with six phases0/1/2/2/3/4; it is not derived from the forward or walking lunge. Its durations are 900/900/500/1200/900ms, totaling 4400ms: backward placement, descent, bottom hold, controlled rise, then return of the rear foot. Numeric stride, depth and tempo are schematic engineering choices rather than source-prescribed individual targets.

Independent numeric review covered all 135 samples for each of neutral/male/female, including the terminal pose:

- The whole front-foot primitive remains exactly fixed; its horizontal painted lower boundary is tangent to floor 96.9. Front heel and forefoot do not lift or slide.
- Both legs retain22.25/22.25 segment lengths at every sample; maximum error is1.78e-14. The standing tangent solution is valid and both endpoint geometry and complete production primitives close exactly at 4400ms.
- The rear foot moves backward through a lifted step, holds its position during lowering/rise, and returns to the original stance. The contact defect above is distinct from its correct direction and closure.
- A conservative envelope around the rear-knee joint gives minimum floor clearance 3.418 neutral,3.182 male and 3.654 female canonical units. These are conservative local joint-envelope bounds, not a claim that a circular knee primitive exists. The knee remains visibly above the floor in the inspected sheets/cards.
- Trunk length 24, neck/head offset 9 and the shared vertical trunk/head axis remain exact as the body translates. No torso rocking or independent head lift is introduced. This does not establish frontal pelvic/knee alignment.
- Both hanging arms retain 12.5/12 lengths, maximum error 7.11e-15. Each dumbbell shaft is centered at its own wrist and perpendicular to its forearm; maximum center error 3.56e-15. The far dumbbell draws behind the torso, the near dumbbell after the head; no third generic dumbbell is emitted. Two bells remain readable in the inspected small cards. The schematic hands do not establish articulated finger or palm technique.
- Captions describe the correct backward step, whole front-foot drive, hovering knee and return to the original stance. The rear-toe support caption currently overstates the painted contact.

Side view cannot prove frontal knee tracking, hip/pelvic rotation, bilateral alignment, individual balance or load distribution. Supplemental frontal evidence remains required by the binding. The current side schematic can support a bounded source/action assessment after the contact repair; it cannot settle those missing dimensions.

## Exact preservation of the previous sixteen movements

Baseline: **510127dd54798ad7963139908a2207e73531d119** (V7). IDs 143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84 were evaluated using each revision's own committed entry and production module.

All sixteen entries are byte-equivalent after JSON parsing. Across all 48 body cycles  / 6297 poses, resolved joints, complete ordered production primitive arrays, durations and complete encoded SVG frame arrays/timelines are exactly identical to V7. This proves preservation of the reviewed shoulder/curl/rope/flye/kickback geometry and finite support drawing through integration; it does not upgrade V7's evidence limits. `MovementPreview.tsx` and the SVG primitive renderer retain the exact V7 hashes.

Fresh neutral cycle sheets and app240 cards were visually inspected for143,49,178,220,84,292 and253. Their support, load/depth, source cues and appearance preserve the previously reviewed behavior. The actual neutral/male/female full-cycle movement 52 sheets and its app240/320/390 keyframe card sheets were also inspected. That is 20 newly inspected PNG artifacts; it is not a claim that every one of the51 PNG cycle sheets was viewed anew. Exact preservation and artifact verification cover all 51 encoded cycles.

## Retained holds and gates

**220:** current curated low-incline flye text supports the bounded flye arc, while the frozen imported source specifies wrist rotation. The neutral grip remains an explicit unratified engineering/source choice. No inferred owner ratification, imported-text restoration or approval follows from this integration. Retain V6-2 P2 and the pending state.

**135/187:** the owner's prone correction governs, but the I/Y endpoint remains unresolved. Old reclined preview frames in `families/front-raise__incline.json:1` cannot be approved by a generic schema or source test. Keep both held.

Global `previewIndex.json:1` techniqueReview remains pending; all seventeen audited entries remain pending. Existing source-covered prototype labels and forced-status test fixtures do not bypass that gate. DraftPR28 and root-reported host checks are integration context, not independent native/technique approval from this audit.

## Evidence integrity and practical limits

The companion `TECHNIQUE_RELEASE_INTEGRATION_V8_EVIDENCE.json` records full source/artifact hashes, all sampled numeric results, preservation decisions and actually inspected PNGs. Verified 51 complete encoded cycles  / 6702 sampled poses, 102 cyclePNG/HTML files, 642 cardPNG/SVG files and 17 card indexes: no artifact binding or hash failures. Decoded HTML SVG arrays were read as data; no browser animation was observed.

- Commit before/after: `1185f0d0d6eb91b482afe60af4a0bf8173ba8c06`; Git status empty both times.
- `canonicalFigure.ts` SHA256: `8b2627a4421e39d2e5c4f66abbf87c682f089d66ea5799d304605d1b73c35d45`.
- Native `MovementPreview.tsx` SHA256: `828033dcdb8cd4f62770584b7b0019bfeaca0822bb37ea099b92e40d5f923173`.
- `canonicalSvg.mjs` SHA256: `0c6a0d6a0c51a1f4fa49633082ae77f8b4b6bb2330bceb280e6a73471eb974ff`.
- V8 cycle index SHA256: `4f35e47b0082dfc67822eadf5cc4bb1a5b6bea05d4c9f1261a6b9a541557b5aa`.
- Preview data digest: `8ea9465b0d869cf5f5358f42ad5c8e7e165cca14d1ccb4b02784faeca94b8027`.

Native View source establishes the predicted outer geometry; headless PNGs/host probes are not observed native device pixels or compositor behavior. No iOS animation, live playback, frame pacing, release signing or phone-memory measurement was available to this technique auditor. The owner's4GB phone verification remains separate.

Automatic browser approval rejected opening the localHTML evidence because the URL protocol was disallowed. No alternate surface, server or indirect workaround was used. This limits observed playback, not the static PNG inspection or encoded geometry audit.

The audit is complete with findings and the source freeze is released. Movement52 requires the narrow rear-toe contact repair and an exact-revision re-review; the three retained source/endpoint holds and global pending technique/native gates remain.
