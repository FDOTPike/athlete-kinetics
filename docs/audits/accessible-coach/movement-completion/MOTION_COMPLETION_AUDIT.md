# Independent motion completion map

> [!NOTE]
> **SUPERSEDED BY OWNER DECISION (MOV-B001 — Neutral-Only Silhouette Standard):**
> Exactly ONE gender-neutral figure is rendered for every movement. Animation morphology must not vary by gender. Historical male/female multi-body profiles, tests, and matrices mentioned in this document are superseded; all animation pipelines, derivation rules, test suites, and evidence tooling now target the single canonical neutral morphology (`CANONICAL_BODY_PARAMETERS`). Historical text below is retained intact for audit lineage.

Source snapshot: `12a1fb15aff5611b771348a53e2e04f4079e0e34` on `origin/claude/coaching-wo4-coaching-content`. Local overlay: 129 records. This is an authoring backlog, not technique approval.

All 300 stable IDs are bound to exact replayed instructions, cues, equipment, implements, media keys and source path:line. Missing 171 consist of 169 not excluded by the old catalogue plus 27/291 previously excluded for locomotion. The 169 map to 106 physically bounded families; 52 belong to the old 174-ID Beginner scope. No motion is approved by this audit.

## Authoring order

| Batch | IDs | Acceptance focus |
|---|---|---|
| R0-head-supported-raise | 143 | Independent fixed-elbow lateral arc and real forehead contact; regression110. |
| R1-scapular-shrug | 82 | Straight arms, quiet legs/pelvis and >=1000ms top hold; regression53/138/163. |
| R2-preacher-return | 92, 158, 253 | Full long-arm return, supported upper arms, correct implement/grip and slower controlled lowering;253 source setup confirmation before final signoff. |
| B1-high-pulley-pushdown | 80, 262, 292 | Three grip/rope variants with identical supported-upper-arm principle and distinct equipment details. |
| B1b-straight-arm-pulldown | 264 | Separate shoulder arc with straight elbows and actual high-cable rope, not an elbow pushdown alias. |
| B2-bench-flyes | 49, 178, 220 | Three support angles, fixed elbow arcs and correct leg/head/feet contacts. |
| B3a-lunge-and-kickback | 52, 84 | Reverse step/return and low-cuff hip extension are reviewed individually with distinct floor/anchor contacts. |
| B3b-fixed-bar-body-motion | 66, 152 | Chest-to-bar row versus elbow-only body triceps press: same fixed bar principle, distinct source arm/trunk paths. |
| B4-shoulder-raise | 50, 87, 206, 207, 236 | Front versus lateral, cable/band/DB and reclined support; preserve50 three-second return and207 locked elbows. |
| B5-supported-rear-raise | 131, 162, 261 | Standing band anchor, seated crossed cable and chest-supported incline are distinct physical variants. |
| B6-triceps-support | 155, 156, 179, 180, 237 | Five exact support/anchor/grip cases; isolate elbow action from shoulder arc. |
| B7-supported-curls | 171, 219, 221, 276 | Thigh, reclined bench and preacher pad contacts; grips visibly distinct. |
| B8-foot-floor-trunk | 37, 89, 150, 182 | Bench dip, low prone extension, pelvic raise and feet-elevated push-up each retain actual contact. |
| B9-articulated-trunk | 72, 95, 99, 124, 181, 183, 232, 248, 285 | Spinal/pelvic flexion and rotation must be physically shown; arm/leg-only or rigid-torso aliases fail. |
| B10-wrist-detail | 164, 268, 269 | Requires real wrist articulation and grip close-up; not full forearm movement. |
| B11-rotation-and-upright | 139, 160, 272, 295, 297 | Lateral load shift/ball rotation and shoulder elevation paths need front/oblique evidence; source tilt and high upright endpoints independently reviewed. |
| B12-source-resolution | 154, 200, 279 | Resolve contradictory/underspecified source, then author, with no approval from name inference. |

The first three batches repair five known source/geometry failures before expanding coverage. Batches B1–B12 contain all 52 missing Beginner IDs exactly once; B12 requires source clarification first. All other missing IDs and their per-ID source details are in ORDERED_BACKLOG.json. Hold 135/187 for the unresolved owner I-versus-Y endpoint.

## Source and representability decisions

Thirty source holds are explicitly recorded, including existing drafted IDs. This is semantic review: 93 Renegade Row and 244 band-assisted Nordic are specific despite starting “Set up”, so neither is held by a string detector. Generic253 can receive the requested draft geometry repair, but final technique signoff requires preacher-pad/grip/return setup confirmation.

No blanket exclusions were added. 68/70/231 require complete staged multi-view sequences. 27 can be a clearly labelled in-place running-stride demonstration.291 needs selected or separately labelled walking/running cycles. 7 has no single source-defined sparring rep and should retain a truthful sport/timer fallback.

Some motions need finer representation than the current rigid-trunk/arm rig: wrist/finger articulation, shoulder axial rotation, segmental spinal curl and thoracic twist. Preserve source semantics, use extra joints/views/stages where needed, and leave unfinished drafts unapproved. A fallback explains an actual missing action; it does not pretend a generic hip hinge illustrates the named movement.

## Independent technique acceptance

For each exact batch revision: compare actual source to both body variants and every frame/interpolated segment; inspect source-appropriate front/side/oblique views; prove load-bearing head/chest/hand/foot/bench/bar/pad/band contacts, anchored equipment and uninterrupted hand grip; verify joint action, source ROM, tempo, complete controlled return and side order. Test that fixed joints remain fixed and equipment never teleports or penetrates supports. Names/captions/schema checks are not geometry proof.

Review rendered full cycles at ordinary speed and slow/scrubbed motion, including setup/exit and loop boundary. Dynamic catch, rotation and finger/spine mechanics require direct rendered evidence. Author cannot approve own movement. The separate runtime auditor owns smoothness/lifecycle/native timing checks. Neither schema validity nor headless runtime success establishes physical technique.

## Evidence limits

This map uses source inspection and the prior independent seven-sample production-rig audit. It does not inspect root’s new implementation revision. Current 12a content corrections (115 records) remain pending owner review. The local legacy global technique status is pending, so zero previews are visible-approved. The legacy counts describe baseline content, not root’s newly integrated dirty checkout.

Pinned primary references already reviewed in the preceding audit: ACE Shoulder Study protocol and source import records. They distinguish rear lateral raise from row and historical supine shoulder-protraction import from the owner’s prone correction. They do not resolve the owner I/Y choice or certify individual animation biomechanics.

## Files and reproduction

- `ALL_300_MOTION_MAP.json`: complete 300-ID source, preview baseline, proposed physical family, per-ID cautions/holds and review view.
- `ORDERED_BACKLOG.json`: five repairs, all 52 Beginner missing, remaining 117 missing, family membership and exclusion reassessment.
- `build_motion_map.py`: standard-library exporter, reads frozen Git sources and legacy overlay; writes only these audit files. Run `python build_motion_map.py` to reproduce assertions and outputs.

See `FIRST_BATCH_GEOMETRY_PLAN.md` for the concrete camera, contact, joint-path, tempo and source bindings for IDs 143, 82, 92, 158 and 253. The 106 missing physical contracts do not require 106 asset files; reuse shared rig/equipment only when the per-ID constraints remain true.
