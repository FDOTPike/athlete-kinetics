# Movement completion handoff for Francis's Dot

Francis has authorized autonomous completion of the remaining Athlete App movement animations, with one separate technique auditor and one separate runtime/smoothness auditor. Francis will task their Dot to read this chat and this order. This document is the execution handoff; it does not assert that the Dot has received the task, connected GitHub, or begun work.

## Start from the published work

- Repository: https://github.com/FDOTPike/athlete-kinetics
- Motion branch: `codex/movement-release-integration-2026-10-05`.
- Latest motion implementation: **0ad4be821ef1220112476dbb69410be4b7a50041**. The later handoff commit changes documentation/evidence only. Confirm ancestry and preserve both.
- Existing draft motion PR28: https://github.com/FDOTPike/athlete-kinetics/pull/28, targeting `claude/release-integration`. Keep it reviewable and unmerged. Use a separate Dot implementation branch based on this motion branch; do not have two builders push to the same branch.
- Integrated app base: **cf4c221ef3993341f903a1d228e94d4893002081**. That exact app revision has independent product/data review and an independently verified unsigned iOS build/core smoke. Whole-app native flows, signing and motion playback are not accepted by that milestone.
- Reference packet: branch `codex/release-audit-opus-cloud-2026-10-04`, pinned **303d980c555947e20724818183f48c39d975222b**, path `docs/release-audit/2026-10-04`. It contains the original app/technique/runtime audits, movement order, V7 reports, independent cf4 product/iOS reports and SHA manifests. These are reference files, not app modules to overwrite.

On a fresh computer, connect GitHub with access to this repository, including permission to push a working branch and open/update PRs. Clone the motion branch, fetch the reference branch, read repo instructions including `AGENT_WORKFLOW.md`, and verify source identity before edits. Node>=24 and npm>=11.6 are declared by the repo. Use its lockfile with `npm ci`; fetch the embedder with `npm run fetch:embedder` before full CI. Use the existing Python bootstrap when required. No Windows-local directory is required to retrieve the order or source.

```sh
git clone --branch codex/movement-release-integration-2026-10-05 https://github.com/FDOTPike/athlete-kinetics.git
cd athlete-kinetics
git fetch origin codex/release-audit-opus-cloud-2026-10-04
git merge-base --is-ancestor 0ad4be821ef1220112476dbb69410be4b7a50041 HEAD
git show 303d980c555947e20724818183f48c39d975222b:docs/release-audit/2026-10-04/README.md
```

Inspect live branches, PRs and ownership before choosing the Dot branch. Acknowledge the exact source SHA, branch and implementation ownership in your first progress report. This chat remains the app/Opus follow-up lane. No direct Dot dispatch was made here; Francis is providing the assignment.

## What exists and what remains

Read these committed files beside this order:

- `ALL_300_MOTION_MAP.json`: all300 IDs, source contracts, physical families, cautions, exclusions and source holds.
- `ORDERED_BACKLOG.json`: original169 nonexcluded missing-ID backlog and repair/family order. It is a historical source inventory, not current completion counts.
- `MOTION_COMPLETION_AUDIT.md`, `FIRST_BATCH_GEOMETRY_PLAN.md`, `IMPLEMENTATION_STATUS.md`, source bindings and `ASSET_BUDGET_DECISION.md`.
- `handoff/MOVEMENT_COMPLETION_WORK_ORDER.md`: original R0–R5 requirements. Its old checkout/branch baseline is superseded by the exact published motion/app identities above; the acceptance requirements remain.
- `handoff/*V8_REVIEW.md` and companion evidence: independent reviews of exact **1185f0d0d6eb91b482afe60af4a0bf8173ba8c06**. They do not approve its subsequently repaired source.

Current data: **138 records =132 pending +3 legacy source-covered +3 unsuitable**;135 non-unsuitable records. **160 of the original169 nonexcluded missing records remain to author**. Global technique review is pending, so zero previews are enabled. Covered prototype labels and forced-status test fixtures are not approval. Recompute the current all300 ledger from the actual candidate, including already drafted movements and reassessed exclusions. Do not blindly rerun the historical map builder against absent Windows-local inputs or overwrite updated source contracts.

Existing repaired/new families include143 forehead-supported rear raise;53/82/138/163 shrugs;92/158/253 preacher curls;80/262/292 distinct bar/rope pushdowns;264 straight-arm rope pulldown;49/178/220 supported flyes;84 ankle-cable kickback;52 dumbbell reverse lunge. Separate V7/V8 checks preserve the source-specific action, equipment, support and timing within their stated limits. They do not approve all135 drawable records or native playback.

## First task: independently recheck the committed52 repair

Both independent V8 auditors found a real painted rear-toe gap on1185: neutral3.300dp, male3.575dp and female3.025dp on the app240 stage. The old endpoint-plus-radius assertion missed rotated finite rounded View bounds. Source/pose preservation for the preceding16 movements passed independently.

Commit0ad4be82 fixes that responsible layer: foot length5.4 remains; schematic heel rise is2.2*step; toe rise solves finite native cap support; the existing leg solver re-solves the rear leg. The actual floor96.9, whole planted front sole, flight arc, quiet trunk/hanging loads and full loop are retained. Three actual-RN-style regression cases fail before and pass after; all five owning suites/153tests and TypeScript pass. Before/after logs are in `handoff/` and their hashes are sealed in `HANDOFF_EVIDENCE_MANIFEST.json`. This is a committed repair awaiting fresh independent review, not a completed technique/native milestone. Remeasure rear-knee clearance on the new geometry; old values belong to1185.

Freeze the Dot's exact initial candidate, generate fresh full cycles/cards, and have the two auditors separately re-audit the repair and previous16 preservation. Include ordinary-speed playback, slow/scrubbed motion and the terminal loop frame. Do not restore the invalid endpoint contact proxy or weaken the new actual-style test.

## Then execute the whole remaining order

Continue66 inverted row,152 fixed-bar body triceps press,50/87/206/207/236 source-specific raises, then all eligible ordered families. This is all300 coverage with supported exclusions and honest holds; a52-Beginner batch or name-to-generic-pose mapping is insufficient.

Reuse the established canonical primitive renderer, authoring scripts, derivation, literal lazy family loaders and evidence tools. Preserve each ID's actual source setup, grip, equipment/anchor, joint action, range, tempo, support/contact, controlled return, bilateral order, caption and loop. Add joints/views/stages only when the actual source requires them. Cable flyes201/217, dynamic catches, wrist articulation and segmental spine movements cannot be approved by unrelated dumbbell/rigid-trunk aliases. No new runtime service or wholesale asset system replacement is needed.

Repair demonstrated geometry/caption/renderer failures first. Keep all supported body inputs, still-first rendering, pause interpolation, identity reset, single playback ownership, coordinator cleanup on scroll/navigation/background/unmount, reduced-motion and accessible controls. Keep tests at the responsible layer and retain failing reproductions. Do not patch count fixtures merely to pretend coverage or remove a gate to obtain green.

Keep **135/187 held**: Francis's PRONE chest-supported lower-trap correction governs, but the I-versus-Y endpoint is unanswered. Do not ask the same question again or approve the stale supine draft. **145/154/250** have unresolved source support/action/instruction issues. **220** has a curated-versus-imported wrist-rotation ambiguity; the neutral-grip draft is not owner ratification. The map also records other holds, including existing drafts: reconcile every one, not only this named subset. Reassess historical exclusions7/27/68/70/291 explicitly; hard motions are not automatic exclusions. A truthful sport/timer fallback may be appropriate where no single source-defined rep exists. Resolve routine matters from authoritative sources; ask Francis only where an actual unresolved decision is needed.

## Independent review and acceptance

The implementing agent cannot self-approve. Use two distinct reviewers who did not implement the batch:

1. Technique auditor: inspect the exact final source and all body cycles/captions; check anatomical action, range, support/contact, grip/load path/anchor, actual setup/return, tempo and source truth. Use front/side/oblique supplemental views where the relevant alignment is invisible. Names, schema tests or tiny stills are insufficient.
2. Runtime/smoothness auditor: inspect that same exact source/assets; check interpolation/continuity/closure, actual RN primitive bounds/crop, equipment stability, lifecycle/controls, captions and accessibility. Inspect actual Android+iOS playback and measure native frame timing on available representative hardware/simulators with limits stated.

Keep reports, findings, raw failing/passing repros and source/artifact hashes separate. Fix findings and have both re-audit the final revised candidate. A reviewer may preserve unchanged reviewed bytes with explicit identity proof; it must not silently apply an old approval to changed geometry. Headless PNG/SVG, RNTL styles, schema/count tests, simulator core smoke and green build CI do not independently establish native compositor smoothness. If native capture/device access is unavailable, complete independent engineering and record that acceptance requirement as pending.

Enable previews only after the existing approval/evidence contract is satisfied for the exact final source/assets/native candidate. Do not set global or per-entry review states simply because authoring or schema tests pass. Before enabling final accepted previews, integrate only independently accepted app updates and recheck source/build identity.

## Verification and evidence

Run TypeScript green before every commit. Set `GIT_OPTIONAL_LOCKS=0` for scripted Git. Preserve strict TS, offline deterministic runtime, security and append-only compatibility for shipped master34/feature67 migrations. Motion work does not own app stores, backups, native platform files, dependencies or shipped migrations; coordinate necessary app changes with the existing Opus lane.

The combined1185 host baseline passed31 MovementPreview suites/854tests,40 native-config assertions and all five storage/clone checks; its GitHub verification suite also passed. The52 repair has the separate five-suite153-test pass above; a final complete aggregate still must pass on the Dot's final exact candidate. The earlier feature aggregate stopped while CPU-active in BackupRecoveryRetention and is historical incomplete evidence, not a pass. Diagnose/completely run required gates; do not skip slow coverage or manufacture success.

Useful existing commands (read each tool's arguments and the repo workflow):

```sh
npm run typecheck
npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview
npm run verify:native-config
node --expose-gc tools/rendering/verify_preview_storage.mjs
node tools/rendering/render_motion_cycle.mjs --ids 52 --out acceptance-evidence/dot/recheck52-cycles
node tools/rendering/render_movement_evidence.mjs --movement 52 --out acceptance-evidence/dot/recheck52-cards
npm run fetch:embedder
npm run verify:ci
```

Render from a clean committed source and retain the resulting identities. The render tools are engineering evidence only. Run the existing identity/raster/negative evidence harness with its documented source-bound draft controls; never modify a pending entry into an approved one merely to obtain a positive control.

Current138 data is406094raw/61699gzip bytes,47 families, largest40322. The finite full300 asset decision is1MiBraw/192KiBgzip aggregate,64KiB/family; host retained-clone guards256KiB largest family/2MiB all families. Diagnose actual growth failures using the lazy asset design. These are host regression limits, not native peak-memory evidence. Francis explicitly defers the4GB phone acceptance to their own download/test; do not claim it passed, fabricate its release packet, or repeatedly seek it during independent engineering. Keep the repo's finite guards unless a demonstrated new scope decision warrants a reviewable change.

Bind the final commit/tree, catalogue/source hashes, asset/evidence hashes, toolchain, installed build identity and actual native artifacts. Use GitHub macOS CI for unsigned iOS build work if the Dot computer cannot run Xcode; record build versus playback evidence separately. Apple Developer access is not set up, so signing/TestFlight remains owner-only and does not block unsigned engineering.

## App lane and finish condition

Existing Opus cloud job: https://claude.ai/code/session_01DpTAicGC9rt7bPKRrJdjMX. App branch `claude/release-integration`, draftPR26 https://github.com/FDOTPike/athlete-kinetics/pull/26; review-onlyPR27 remains separate. Do not create a duplicate Opus job, substitute a model or take over unrelated app source. At handoff snapshot the app branch has advanced to53a216e0d1e2aaed55e86ba0222018702baeb21e; its host/Android checks passed but unsigned iOS CI failed. That newer revision has not been independently accepted here. Keep cf4 as the accepted bounded integration base until its successor is independently verified. Snapshot files are timestamped observations, not live status promises.

Deliver all300 ledger, completed eligible animations, explicit supported exclusions and residual source holds, two independent final reports, passing complete host/CI gates, actual native playback/accessibility/frame-timing evidence with honest limitations, and reviewable commits/PRs. Do not merge master or publish stores. Report concrete completed milestones or decisions Francis actually needs. Keep unfinished evidence requirements pending even if runtime or token limits expire.

The local follow-up was observed PAUSED while preparing this handoff; no automation was resumed. After the Dot acknowledges takeover, it owns new animation implementation on its own branch. This chat should monitor/review the app and handoff, not author competing movement batches. Francis is assigning the Dot by asking it to check this chat; this handoff alone is not an execution receipt.