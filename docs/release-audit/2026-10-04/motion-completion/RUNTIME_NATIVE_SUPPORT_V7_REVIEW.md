# Independent runtime review: V7 support repair and cable glute kickback

The V6 finite head-support gap is resolved in the actual React Native component styles at frozen commit **510127dd54798ad7963139908a2207e73531d119**. The focused component probes have passing evidence for **87 distinct cases across two runs**, and three separate SVG paint-bound probes pass. Fresh source reproduces the 48 cycle streams and 252 deterministic cards. The raw math verifier still reports **FAIL for two stale ignored build caches**; its result is preserved.

This is host component, mathematical and headless rendering evidence. The report title does not imply native compositor or device approval. Technique review, the source ambiguity for movement 220, signed iOS/Android device acceptance and native smoothness remain pending. No app, assets, source statuses or approval flags were edited by this auditor.

## Frozen inputs and evidence identities

The reviewed checkout was `C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App`, clean detached at 510127dd54798ad7963139908a2207e73531d119. The before/after capture covered 81 source files and 713 generated artifacts. Both inventories were unchanged and all enumerated artifact hashes matched their files. The freeze was released after capture; subsequent source work is outside this review.

| Input or receipt | SHA-256 |
| --- | --- |
| Source inventory, before and after | 3b9492dad584dad26f3c1c6cae42ac5dcf9bec036d56dfd59b4bc5f3fce723b7 |
| Artifact inventory, before and after | e9261f4710e04bad35a5825e6031bfdfbaa9dc0b914604181e289e97724f95a6 |
| Preview source digest | f89df47e6753659fbd89063c8e50efff31c2debb057eed60abba32fac1a6ae8c |
| canonicalFigure.ts | 83831045a8eb6d984c140b7416d999932ba8db2ce3543de4142681197daf0637 |
| MovementPreview.tsx | 828033dcdb8cd4f62770584b7b0019bfeaca0822bb37ea099b92e40d5f923173 |
| derivation.ts | 10689809b038fbdac8d327f98eb9462409467c869c7daffcaa1e207a7d5b2f02 |
| canonicalSvg.mjs | 0c6a0d6a0c51a1f4fa49633082ae77f8b4b6bb2330bceb280e6a73471eb974ff |
| glute-kickback__standing.json | 505e9b914ec3d576787f88564b17602315032990cdcf9d9d82e8a3bec7f10afc |
| manifest.ts | a0bd079aa0d89948f252699f4ff5e9c8ffcd36a02f4087d98997d77bbd6a79c6 |
| familyLoaders.ts | 45de338232b712332c4555cad3748dd7f03ff6426a29e518828bb97eeb58ecfa |
| cycle_evidence.json | a80ab50f3f4fad15f22bc8c10ed43c592764aa6322ccbbb4f7980494b81a82f6 |

The cycle metadata records this exact commit and `sourcesCommittedAtRender: true`. Its source hashes were checked against files and Git blobs during the freeze. Complete individual source/artifact identities are in [the source capture](runtime-native-support-v7/source-before.json), [artifact capture](runtime-native-support-v7/assets-before.json), [freeze receipt](runtime-native-support-v7/freeze-results.json) and [cycle metadata](evidence-native-support-v7/cycle_evidence.json).

The bounded movement set is **143, 53, 82, 138, 163, 92, 158, 253, 80, 262, 292, 264, 49, 178, 220, 84**. Cycle evidence and component probes cover neutral, male and female. The per-ID deterministic card indexes contain **neutral only**, at 240, 320 and 390 pixels, font scale 1.30.

## Results and retained failures

| Independent check | Observed result | Scope |
| --- | --- | --- |
| Initial six-suite component run | 84 pass, 3 fail, 87 total; zero skipped | Frozen production component imports with in-memory covered fixtures |
| Targeted corrected-fixture rerun | 3 pass; seven previously passing kickback cases filtered | Three reduced-motion cases only |
| Distinct component cases with passing evidence | 87 across the two runs | No single clean aggregate run is claimed |
| Actual head circle versus finite rounded pad | 12/12 pass | Initial pose, four movements × three bodies |
| Actual torso/girdle connectivity | 9/9 pass | Three flyes × three bodies, every authored reduced-motion position |
| Full-cycle crop and captions | 48/48 pass | Every 33 ms tick, exact end and authored reduced-motion positions |
| Original runtime control regressions | 5/5 pass | Pause, identity, claim cleanup, boundary and idle behavior |
| Kickback geometry/lifecycle/scalar checks | 10 distinct cases pass across two runs | Full playback, reduced motion, lifecycle and validation |
| Actual lazy loader and gate checks | 3/3 pass | Real pending source plus isolated hypothetical covered fixtures |
| SVG paint outer-bound probes | 3/3 pass | Sharp raster against native View outer-box geometry |
| Source-bound cycle reproduction | 48 cycles, 6,297 draws reproduced | Fresh external production compilation |
| Card verifier | 252 cards and 48 sheets pass | Sixteen movements, neutral body |
| Raw math verifier | FAIL: two cache comparisons | Other recorded assertions/reproductions have no errors |

The three initial independent failures were an auditor fixture defect: the copied movement-84 reduced-motion expected-coordinate calculation read `fo` instead of its new `ke` scalar. Expected coordinates became NaN while actual production component coordinates were finite. Only the expected scalar key was corrected. All geometry, caption, control and timer assertions remained. The initial fixture, original failure output and targeted rerun are preserved in [initial fixture](runtime-native-support-v7/kickback-runtime.initial.test.js.txt), [initial results](runtime-native-support-v7/component-initial-results.json) and [targeted results](runtime-native-support-v7/component-targeted-results.json).

The main implementer separately reported three original aggregate failures at 510 in the owning torso selector: it selected the new shoulder-girdle bridge as the first transverse torso slice. My independent probes identified the real slices and bridge separately and passed. Root subsequently changed that test selector and status documentation, reporting the owning 391-test suite and typecheck passing, followed by **30 suites / 846 tests passing at b8cf9570a0364314d55a4c745090bfdc203a3205**. Root reports product/render inputs unchanged between these revisions. That result is parent-reported verification at b8, not an independent 846-test run at 510. Root retains `V7_MOVEMENT_PREVIEW_AGGREGATE.log` and `V7_MOVEMENT_PREVIEW_AGGREGATE_RECHECK.log`.

## Support and renderer findings

The direct component probe flattens the actual View styles, identifies the head's unchanged outer circle and rotated finite pad, and measures distance to the pad's capsule rather than an infinite line. All four movements × all three bodies now have a maximum absolute gap of **4.44e−14 dp**, within the 0.05 dp acceptance tolerance. The head projection remains inside the finite core, with maximum tip overrun zero. Cycle math separately confirms stationary body anchors. This resolves the V6 responsible-layer finding without enlarging the figure anatomy.

The SVG converter now paints circle, rounded bone and rounded rectangle strokes inside their native View outer bounds. Three independent transparent Sharp raster probes agree with those theoretical outer bounds within 1.1 pixels; circle and rectangle differences are zero, rotated bone maximum difference is 0.428 pixels. This demonstrates the headless converter's outer-bound correction. It does not measure native border rasterization or anti-aliasing on a device.

For 49/178/220, the actual drawn torso has 33 contiguous tapered slices, centered on the analytical neck-to-hip path, perpendicular to that path and using the body's intended taper widths. The shoulder bridge is checked separately at the neck, with its projected span and horizontal orientation. Every authored position passes across all bodies. The previous aggregate failure is consistent with selecting the bridge instead of a transverse slice; I found no actual component-style trunk disconnect in this snapshot.

## Kickback and playback findings

Movement 84's `ke` validation and eased interpolation reach actual component geometry. Independent expected math checks working thigh/shin lengths of 22.25, the fixed five-degree soft knee, ankle cuff center and perpendicular orientation, and the low-pulley-to-ankle cable. The cable is behind the leg and the cuff above it. Supporting hands, torso and far leg stay fixed; working knee/ankle are intentionally excluded from the stationary-anchor invariant.

Across 405 fresh draws for all bodies, working-leg length error is at most 1.07e−14, knee-angle error 4.46e−13 degrees, and ankle attachment error zero. The maximum working-leg bearing change is 1.150 degrees per sampled 33 ms tick. These are deterministic interpolation properties, not measured frame pacing.

Actual component probes preserve single-cycle playback, exact return and idle after an additional 30 seconds, reduced-motion step labels and wrap without timers, paused interpolation, background suspension, resumed held pose, dynamic reduced motion, identity change, uncovered replacement, unmount and listener/claim cleanup. The five original control regressions also pass. Fake timers verify bounded control behavior; they do not establish native scheduling or scrolling performance.

The production global review gate rejects movement 84 before calling a family loader. Temporarily mocking global review complete still leaves its real pending source unavailable. In an isolated hypothetical covered fixture, only its family loader is called once, repeated identity is cached, malformed `ke` fails validation, and unrelated/wrong media or pending identities are rejected. No on-disk review or coverage status was changed.

## Fresh artifacts, preservation and cache diagnosis

The independent math run compiled production canonical and derivation inputs into auditor-owned fresh directories. All 48 embedded full primitive-frame sequences, recorded HTML and PNG hashes, and 12-sample cycle PNG sheets reproduced from that compilation.

Compared with preserved V6 compilation, all **15 prior pose-at-time streams** are unchanged. Eleven unaffected primitive streams are unchanged. Primitive differences for 143/49/178/220 are the intended support repairs. All 136 prior source entries retain their geometry, timing and options. Previous PNG byte identity is intentionally not required because the shared SVG border conversion changed; every current artifact was instead reproduced against current source.

The raw verifier remains `pass: false` solely for these ignored checkout caches:

- `tools/rendering/.build/canonicalFigure.js`
- `tools/rendering/.build-derivation/canonicalFigure.js`

Both have digest 241f45b7ff1548066fdf6fc3f79223240122dc776ae699ab350024e4739d0cc5, differ from fresh compilation and are older than current canonical source. Cached derivation.js matches fresh compilation. The evidence establishes stale files, not an incorrect apparently fresh cache being reused. The smallest maintenance action is regeneration through the existing invalidating loader before those cache bytes are used as evidence. This auditor deliberately left checkout caches untouched. [Cache diagnosis](runtime-native-support-v7/cache-diagnostic.json) and [raw math result](runtime-native-support-v7/supported-math-results.json) retain the failure.

The existing card verifier was copied externally with only production import paths and fresh compiler destinations redirected; its validation logic and thresholds were retained. It passed file hashes, source SVG reproduction, raster figure stage, full card-to-sheet agreement, complete coverage and inked text-band margins. Its glyph-spelling limitation remains: host `sans-serif` rendering agreement alone cannot prove that every raster glyph spells the intended string.

I visually inspected actual neutral 240-pixel sheets for 143,49,178,220,84 and all three body cycle sheets for84. Captions were legible and no crop or word cut was observed in that inspected subset. Heads appeared on their pads;84's ankle cable/cuff and full return were visible. Automated reproduction/crop checks cover the larger set. This is not human inspection of every artifact or native Text layout approval.

## Budgets and outstanding acceptance

Current preview source storage measures **402,455 raw bytes**, **61,082 gzip bytes**, and **40,322 bytes maximum family**. They fit the documented limits 1,048,576 / 196,608 / 65,536. Node clone limits of 262,144 for one family and 2,097,152 for all families are host regression guards; none proves native resident memory. The user's 4 GB phone acceptance is explicitly deferred and was not introduced as this audit's gate.

Exact source inventory is **137 entries in 46 family files: 131 pending, three legacy source-covered IDs 88/16/28, and three intentionally unsuitable**. Thus 134 records are non-unsuitable. Global `techniqueReview.status` remains pending, so normal resolution still exposes no preview even for those legacy covered labels. Engineering fixtures and render evidence do not approve the drafts.

Remaining acceptance is bounded:

1. The independent technique lane must resolve movement220's source ambiguity and the pending global/family review states from actual instruction and pose evidence. This report grants no technique approval.
2. After source and review decisions settle, capture signed iOS and Android evidence tied to the final commit: full-cycle/replay and reduced-motion controls, pause/background/foreground, identity replacement, list navigation and native caption/accessibility behavior.
3. Measure real frame pacing and dropped frames during playback and list scrolling, plus timer/listener/claim cleanup after repeated mount/unmount. Host fake timers, a 33 ms generated trace and Sharp output cannot substitute for native compositor evidence.
4. Treat the exact final revision as the acceptance input. Later families, test changes, review manifests or source edits are outside this frozen snapshot. The user's separate 4 GB download check remains theirs.

The compact machine-readable aggregation is [verification-summary.json](runtime-native-support-v7/verification-summary.json). All raw logs, harnesses, fresh compiler outputs and captures remain under `runtime-native-support-v7`; the separate digest receipt identifies the delivered report and its supporting files.

