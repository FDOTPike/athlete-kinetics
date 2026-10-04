# Independent runtime review: V8 release integration and reverse lunge

**Movement 52 fails actual React Native rear-toe contact at frozen commit 1185f0d0d6eb91b482afe60af4a0bf8173ba8c06.** The rounded rear-foot View remains 3.300 / 3.575 / 3.025 dp above the native floor for neutral / male / female after landing. Three direct component contact probes fail, and a separate dense phase sweep confirms the same defect. The planted front foot, continuous leg lengths, load attachment, closed return, controls, lifecycle, captions and crops have passing evidence.

The focused control/geometry lane has **21 parameterized cases with passing evidence across two runs**. Fresh source reproduces 51 cycles and 270 deterministic cards, including the existing source defect. The raw generic math verifier still fails two stale ignored cache comparisons. Native Android/iOS jobs were running at the final CI snapshot; no artifacts or animation FPS acceptance were available.

This auditor edited only external harnesses, measurements and reports. No app, assets, source statuses or approval flags were changed. The source freeze was released after stable before/after capture.

## Exact inputs and receipts

The reviewed checkout was `C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App`, clean detached at **1185f0d0d6eb91b482afe60af4a0bf8173ba8c06**. The captured 811 source files and 762 generated artifacts were unchanged throughout the review.

| Input | SHA-256 |
| --- | --- |
| Source inventory, before and after | c0109942ebeda437cfb9d5c06bb7357b512c6ad3aa7d3a0ab09c1ff2706d9a20 |
| Artifact inventory, before and after | 449a766edbe7ce56077f83a250942baca4b8dfb3b918084f376d2654b8371d3c |
| Preview source digest | 8ea9465b0d869cf5f5358f42ad5c8e7e165cca14d1ccb4b02784faeca94b8027 |
| canonicalFigure.ts | 8b2627a4421e39d2e5c4f66abbf87c682f089d66ea5799d304605d1b73c35d45 |
| MovementPreview.tsx | 828033dcdb8cd4f62770584b7b0019bfeaca0822bb37ea099b92e40d5f923173 |
| canonicalSvg.mjs | 0c6a0d6a0c51a1f4fa49633082ae77f8b4b6bb2330bceb280e6a73471eb974ff |
| lunge__reverse.json | 94d1b96239d8b96c0713fbd793c6ff8714b8e79787cd83c9db378d162234fa4e |
| manifest.ts | eb0c03bfa345262357fea319923379d328bd9b0db9f69b4427d70f4c57bbc468 |
| familyLoaders.ts | 7fabec6b351ec48946676ec7d70d346c6e3a39f32e000df21f83a6b3d75437a3 |
| package-lock.json | 9e02ca7f8c0f95ccbf0860d8ebeadaac64d016bcda3f978d7f39ff56d507f5cf |
| cycle_evidence.json | 4f35e47b0082dfc67822eadf5cc4bb1a5b6bea05d4c9f1261a6b9a541557b5aa |

The cycle metadata records exact 1185, committed render inputs and every production source hash. Those hashes matched files and Git blobs during the freeze. [Freeze receipt](runtime-release-integration-v8/freeze-results.json), [source capture](runtime-release-integration-v8/source-before.json), [artifact capture](runtime-release-integration-v8/assets-before.json) and [cycle metadata](evidence-release-integration-v8/cycle_evidence.json) retain the full identities.

The bounded render set is **143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84,52**. Cycles cover all three bodies. Card indexes are **neutral only**, at 240/320/390 pixels and font scale 1.30.

## Confirmed contact blocker and smallest correction

The actual component probe identifies the native floor View and extracts each foot's flattened View style. For a rotated rounded rectangle with center y, length L, thickness 2r and angle theta, its painted bottom is:

`centerY + (L/2-r)*abs(sin(theta)) + r`

Movement 52's source instead effectively expects the endpoint plus r to reach the floor. The finite cap centers are inset from the endpoints, so this proxy overstates the tilted foot's bottom by **r*sin(theta)**. The front foot is horizontal and contacts the actual floor at 96.9. The landed rear foot has sin(theta)=3.3/5.4 and floats above it.

| Body | Actual component gap at rl=1 | Dense production phase gap for rl=1..3 |
| --- | --- | --- |
| neutral | 3.300 dp | 1.320 box units / 3.300 dp |
| male | 3.575 dp | 1.430 box units / 3.575 dp |
| female | 3.025 dp | 1.210 box units / 3.025 dp |

The direct contact assertion retains its 0.05 dp tolerance and remains failed. [Actual styles and measurements](runtime-release-integration-v8/reverse-native-contact-results.json), [failed Jest output](runtime-release-integration-v8/contact-jest-results.json) and [host raster of those actual View styles](runtime-release-integration-v8/actual-rn-foot-styles.png) make the defect reviewable. The raster is a host illustration of extracted native styles, not a device screenshot.

The smallest responsible correction is to derive rear ankle/foot height from the finite foot contact, then reuse the existing constrained leg solver. With current foot length/tilt, adding r*sin(theta) to rear ankle y supplies exactly the missing height. It is zero at standing and return. Keep the fixed front sole, native floor, leg lengths and closed return. A global floor shift or endpoint-radius assertion would not establish actual rounded-foot contact.

## Passed checks and preserved failure history

| Check | Result | Scope |
| --- | --- | --- |
| Initial focused component run | 18 pass, 3 fail, 21 total | Four external suites; no skipped cases |
| Targeted lazy-boundary rerun | 3/3 pass | Only previously failing auditor harness cases |
| Actual rear-toe contact | 0 pass, 3 fail | Real View outer geometry × three bodies |
| Independent phase sweep | FAIL: three rear-contact errors | 12,003 poses, 4,001 phases per body |
| Generic cycle reproduction | 51 cycles / 6,702 draws reproduced | Fresh external production compilation |
| Raw generic math result | FAIL: two stale cache comparisons | No other generic verifier errors |
| Deterministic card gate | 270 cards / 51 sheets pass | Seventeen neutral-body movement sets |

The initial focused run's three failures were auditor adaptation errors: broad replacement of `.ke` inside `Object.keys` produced `Object.rlys` in the copied lazy-family harness. Only that identifier and a stale scalar in its test title were corrected. The three lazy probes then passed. Initial source and results are preserved in [lazy52.initial.test.js.txt](runtime-release-integration-v8/lazy52.initial.test.js.txt), [initial component results](runtime-release-integration-v8/component-results.json) and [targeted results](runtime-release-integration-v8/component-targeted-results.json). No product change or assertion weakening occurred. The 21 count refers to instantiated parameterized cases, including body arguments; it does not deduplicate formatted test titles. No single clean 21-case aggregate run is claimed.

Movement 52's actual component checks cover all three bodies through full sampled cycles and authored reduced-motion positions: two 22.25 leg segments per leg, connected ankles/feet, fixed front sole, non-penetrating rear foot, vertical hanging arms, two rigid wrist-centered dumbbells, far load before the head and near load after it, and identical final drawing. The explicit contact lane separately requires the rear toe to touch; its failure is not hidden by the other passing geometry checks.

Single-cycle idle after another 30 seconds, reduced-motion captions/accessibility labels and timer-free wrap, paused interpolation, background/foreground behavior, dynamic reduced motion, movement identity replacement, uncovered replacement and unmount/listener cleanup pass. Five original runtime regression probes also pass. Three crop probes check exact rotated rounded View bounds at every 33 ms tick, exact end and authored positions.

The real default review gate invokes no family loader for pending movement 52. Overriding global review complete still rejects its real pending source. In an isolated in-memory covered fixture, one family loader is called once, identity is cached, incorrect/unready/external media is rejected, and malformed rl fails the covered-family boundary. Source review states remain unchanged.

The dense phase sweep finds maximum leg length error **2.14e−14**, zero front-contact/foot-connection errors, no rear-floor penetration, boundary jumps at most **1.22e−10 box units**, and exact closed drawing. Rear knee hover is 3.182–3.654 box units. These are source geometry measurements, not technique recommendations or native frame pacing. [Dense results](runtime-release-integration-v8/reverse-continuity-results.json) preserve the three contact errors.

## Preservation, artifacts and cache diagnosis

Compared with frozen V7, all **16 prior pose streams and primitive streams** are identical. All **48 prior body cycles** retain frame-stream, HTML and PNG hashes, total timing and tick counts. All **137 prior source entries** retain geometry/timing/options. The new movement adds one pending record.

Every current cycle stream, recorded file hash and twelve-sample PNG sheet reproduced from fresh production compilation. The production card verifier passed source SVG identity, file hashes, figure raster identity, whole-card versus sheet agreement, complete coverage and text-band margins. Passing identity means these artifacts faithfully reproduce their source; it does not correct the rear-foot defect. The verifier still does not automatically certify host raster glyph spelling or native Text layout.

I visually inspected the actual movement 52 neutral 240-pixel card sheet and all three body cycle sheets. The six captions were readable without observed truncation, the rear step and full return were visible, and no inspected crop was cut. The separate native-style foot raster exposes the contact gap. This subset review is not human review of every card or technique approval.

Two ignored canonical caches remain stale:

- `tools/rendering/.build/canonicalFigure.js`
- `tools/rendering/.build-derivation/canonicalFigure.js`

Fresh compilation differs; cached derivation.js matches. The captured cache timestamps predate current canonical source, so no incorrect apparently fresh cache reuse is demonstrated. The raw result remains `pass:false`, with both mismatches retained. Existing loaders should regenerate those caches before their bytes are used as evidence. This auditor did not modify them. [Cache and dependency diagnosis](runtime-release-integration-v8/cache-and-dependency-diagnostic.json) records hashes/times and verifier adaptation.

## Integration boundaries and native CI snapshot

The integration was compared against full release base **cf4c221ef3993341f903a1d228e94d4893002081**. Android/iOS files, package manifests/lock, packages, state, service, storage/database directories and workflows have no differences from that base. The motion integration adds its renderer/data/tests/tools/docs and changes motionDuration plus LibraryScreenV2/SessionScreen seams. [Boundary receipt](runtime-release-integration-v8/integration-boundaries.json) records the full changed-file list.

All 795 installed lock metadata entries match project lock version/resolved/integrity/link fields; there are zero unknown or mismatched entries. Actual loaded package versions include React 19.1.4, React Native 0.81.6, Jest 29.7.0, TypeScript 5.9.3, Sharp 0.32.6 and RNTL 13.3.3. This is metadata and loaded-version proof, not a cryptographic audit of every installed package byte.

Parent reported 31 MovementPreview suites / 854 tests, typecheck, native configuration and storage checks passing on the combined source before commit. Those broad checks were not independently rerun in this bounded lane.

At approximately **2026-10-04 14:48 UTC**, [PR28](https://github.com/FDOTPike/athlete-kinetics/pull/28) run [37209472917](https://github.com/FDOTPike/athlete-kinetics/actions/runs/37209472917) is bound to exact 1185:

- Verification suite (24 gates + typecheck): completed, success.
- Android QA + debug APKs: in progress, job 111460069297.
- iOS unsigned simulator build + native smoke: in progress, job 111460069336.
- Artifact API: total_count: 0.

[Job snapshot](runtime-release-integration-v8/github-ci-jobs-final.json) and [artifact snapshot](runtime-release-integration-v8/github-ci-artifacts-final.json) preserve the actual observations. No native outcome, signing, physical-device behavior or animation FPS is inferred from these pending jobs. Earlier run-level observations lacked job detail; this final job-level snapshot is authoritative for this report.

## Handoff state and remaining acceptance

Exact 1185 coverage is **138 entries / 47 families: 132 pending, three source-covered legacy IDs 28 / 16 / 88 and three intentionally unsuitable**, leaving 135 non-unsuitable. Global technique review is pending, so normal resolution enables no preview even for the legacy source-covered labels. Engineering fixtures do not change this.

Current source storage is 406,094 raw bytes, 61,699 gzip bytes and 40,322 maximum family bytes, within documented 1,048,576 / 196,608 / 65,536 limits. Host clone limits are regression guards and do not establish native resident memory. The user's 4 GB phone download acceptance remains explicitly deferred to them.

After this independent freeze was released, root reported committing a rounded-foot repair at **0ad4be821ef1220112476dbb69410be4b7a50041**, with five owning suites / 153 tests passing, including three native-style contact tests. That later source was **not inspected or independently accepted here**. The V8 failed baseline remains valid for 1185; it must not be converted into a V9 pass.

The user's latest direction is a self-contained handoff to their Dot, followed by stopping this lane. Dot's bounded next steps are:

1. Re-audit exact repair source 0ad4be82 or its final successor: actual finite rear-foot contact across all bodies, constrained leg continuity, lifecycle/crop/caption behavior and fresh source-bound artifacts. Preserve this baseline failure.
2. Resolve pending technique decisions, including movement 220 source ambiguity and parent-reported 135 / 187 endpoint holds, through the separate technique lane. Do not grant approval from host runtime tests.
3. Inspect exact-revision native CI jobs/artifacts when complete, then capture signed iOS/Android physical-device playback, reduced motion, background/identity/navigation/accessibility and frame-pacing evidence. Unsigned core smoke alone cannot prove movement smoothness.
4. Continue remaining movement implementation under the user's handoff scope. Source/manifest changes after 1185 require their own identities and acceptance. The 4 GB device check remains the user's.

The compact machine-readable receipt is [verification-summary.json](runtime-release-integration-v8/verification-summary.json). All external raw outputs, initial harnesses, measurements, fresh compiler outputs and CI snapshots are included in the accompanying SHA-256 digest receipt.



