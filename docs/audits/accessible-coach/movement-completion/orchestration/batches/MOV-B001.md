**Batch:** MOV-B001  **Type:** REPAIR (neutral-only reconciliation)

**Baseline:** `a1a073f6a08ce0c1f9921ba385579856348b3923` on `gemini/movement-animation-completion-2026-10-05`. Stop and report if your HEAD differs or the tree is dirty.

**Owner decision being implemented:** ONE gender-neutral figure for every movement. Animation morphology must not be able to vary by gender. A neutral default is not enough.

**Defect, with locations at the baseline:**
- `apps/mobile/src/components/movementPreview/canonicalFigure.ts:39-42` keeps three parameter sets (neutral, male, female).
- `MovementPreview.tsx:335`, `:350`, `:547` accept `bodyType` and index those sets.
- `derivation.ts:234` and `:304` loop over three body names.
- `manifest.ts:119-120` exports the legacy body types.
- 24 files under `apps/mobile/test/components/` and 8 under `tools/rendering/` iterate or name male/female bodies.
- No caller outside `movementPreview/` passes `bodyType`.

**Owned files:** `apps/mobile/src/components/movementPreview/{canonicalFigure.ts,MovementPreview.tsx,derivation.ts,manifest.ts,index.ts}`; the `MovementPreview.*.test.js` files and fixtures that name bodies; `tools/rendering/**` files that name bodies; the current governing movement docs under `docs/audits/accessible-coach/movement-completion/` (add a superseded note, do not rewrite history).

**Excluded:** family JSON data and view boxes (that is MOV-B002); every existing file under `acceptance-evidence/` (keep bytes and hashes); migrations, backup, store, platform and native files; user profile, health and training data; `docs/audits/accessible-coach/movement-completion/orchestration/`.

**Required change, smallest correct form:**
1. One neutral parameter set is the only geometry the renderer, derivation checks and evidence tools can draw.
2. If a legacy `male`/`female` input name must still be accepted anywhere, it resolves to the SAME neutral geometry at the animation boundary, with one small compatibility test proving identical output. Remove unused variant paths only after checking their callers.
3. Tests and tools stop producing three-profile matrices, galleries and contact sheets. Technique and runtime assertions stay, run once on the neutral figure. Do not delete an assertion to make a suite pass; if a test only existed to compare bodies, say so in the reply.
4. Joint coordinates, captions, timing and every movement's technique are unchanged. The neutral figure's drawn output must be byte-identical before and after for all current movements; prove it.

**Acceptance criteria:**
- `npm run typecheck` exit 0.
- `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview` exit 0, with the skipped count stated and explained.
- A search of the owned source and tools for `male`/`female` body selection returns only the compatibility mapping and its test.
- Neutral identity proof: primitives for every canonical and derived movement at every keyframe, hashed at the baseline and at your commit, equal.
- One scoped commit (or a short series), nothing pushed.

**Evidence path:** `acceptance-evidence/gemini/neutral-only/` — logs taken from the committed tree, each naming the commit it ran on. No logs from an uncommitted tree.

**Required reply** to `claude`, subject starting `MOV-B001`: acknowledgement first (before you start); then on completion the actual source SHA, changed paths, each command with its real exit code, artifact SHA-256 hashes, anything unresolved, and your next checkpoint. Then freeze: no further commits to these files until I reply.
