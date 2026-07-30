# AGENT_WORKFLOW.md — operating protocol for every agent on this repo
Owner: Francis (ratifier). Applies to ALL agents — builders, auditors, curators.
If an instruction here conflicts with your own judgment, flag it; never silently deviate.

---

## 0. Roles (CURRENT ASSIGNMENT — flipped 2026-07-14)
- **Francis** — product owner and ratifier. Schema shape, training policy,
  movement identity, whitelists, brand/UI: HIS calls. He also couriers
  checkpoint bundles between agents.
- **GPT 5.6 Sol (medium reasoning) — BUILDER.** Executes the Work Orders in
  §11, in order, inside the constraints of §§1–8. Stops dead at every
  CHECKPOINT and produces the checkpoint bundle. Does not self-approve, does
  not skip ahead, does not touch files outside a WO's allowed list.
- **Fable (chief engineer / architect / manager) — reviews at checkpoints.**
  Owns architecture decisions within Francis's rulings, audits checkpoint
  bundles, extends/blocks Work Orders. Fable's audit verdicts use the same
  evidence standard demanded of any auditor (§9).
- Budget discipline: checkpoints are LEAN. Sol self-verifies with gates
  (cheap, local); Fable's audits target judgment surfaces — voice, data
  truth, policy conformance — not re-running what a gate already proved.

### 0.1 Environment note (write paths differ by agent)
The §2 shell-only write rule exists because the COWORK bridge corrupts
file-tool writes. Sol runs via Codex on Francis's machine (native FS) — its
normal write path is acceptable. The UNIVERSAL rules for every agent remain:
`npm run typecheck` green before ANY commit; verify by running, never by
re-reading; `GIT_OPTIONAL_LOCKS=0` for scripted git; never edit a shipped
migration.

## 1. Inviolable architecture (never relitigate)
1. **Zero-Cloud**: 100% offline runtime. No API calls, no telemetry, no
   embedded web views. Video links are inert text opened via the OS handler.
2. **Determinism**: prescriptions, blocks, progression, substitution = pure
   TS functions. No RNG, no clock reads inside engines, no LLMs at runtime.
3. **Memory**: 450 MB peak dirty RAM ceiling (4 GB Jetsam devices). GC-friendly
   code; reference data loads once.
4. **Strict typing**: TS `--strict`, no `any`. SQLite tables STRICT.
5. **Append-only migration chain**: shipped migrations are FROZEN. New work =
   new slot. Everything idempotent (IF NOT EXISTS / INSERT OR IGNORE /
   constant UPDATE) because self-heal re-applies the whole chain.

## 2. THE WRITE RULE (learned the hard way — 3 corruption incidents)
The Cowork↔Windows file bridge corrupts agent file-tool writes (truncation,
partial application, late replay) — including files created in the same
session. Therefore:
- **ALL repo writes go through the shell** (heredoc `cat > file <<'EOF'` or a
  python patch script with `assert count(anchor) == 1` before every replace).
- **Never verify a write by reading it back** — verify by RUNNING it
  (typecheck, gate, `node --check`, `python3 -c "import ..."`).
- **Francis runs `npm run typecheck` BEFORE every commit of agent work.**
  Truncation always fails typecheck. No green typecheck, no commit.
- If corruption is found post-commit: `git show HEAD~1:file > file`, rebuild
  the intent via shell writes, prove with gates, commit the recovery.
- Sandbox git: always `GIT_OPTIONAL_LOCKS=0` (a stale index.lock from plain
  `git status` blocks Windows commits; delete `.git/index.lock` only when no
  git process is live).

## 3. The verification loop (nothing ships around it)
```
npm run typecheck        # first, always
npm run verify:all       # 20 gates + typecheck; semantic+embedder need network
```
Gates: db, demo, migrations, policy, blocks, autopilot,
autopilot-counterexamples, biometrics, semantic, embedder, store, coach, memory,
progression, pipeline, runner, outcomes, library,
coaching-content-generator, components (+ typecheck).
- A new invariant is not real until a gate asserts it. Prefer extending the
  owning gate over prose promises. Behavior contracts (source-grep checks in
  verify_store/verify_blocks) are acceptable until RN component tests exist.
- Sandbox quirks: verify:db can fail on libsqlite < 3.41 (STRICT/REAL) —
  environmental, expect green on CI/modern machines. semantic/embedder are
  CI/network-only.
- Every gate you add: wire it into `verify:all` and the CI expectations.

## 4. Migration protocol
- Next slot = `max(seeded_manifest slots, files on disk in src/schema) + 1`.
- Curation batches: `node scripts/generate-batch-migration.mjs` — reads
  `packages/core-db/staging/movement_import.json`, seeds ONLY curated records
  not in `staging/seeded_manifest.json`, appends its slot to the manifest.
  Every new movement needs PATTERN_11 + EQUIPMENT entries in that script
  (abort otherwise). Wire the import in `packages/core-db/src/migrations.ts`,
  update gate counts (verify_migrations chain + heal count, verify_store
  reset count).
- Any table a migration creates becomes a SENTINEL in migrationRunner.ts, and
  verify_migrations gets a poison case for it.
- A migration may be regenerated ONLY while uncommitted/unshipped. After that:
  new slot, no exceptions (AK_REGEN_016-style guards exist for a reason).

## 5. Curation contract (movement library, S3 batches ~15/ticket)
Structure (machine-checked by verify:library):
- instructions: 2–4 plain-language steps; cues: 1–3; one real YouTube URL
  (`https://www.youtube.com/watch?v=<11 chars>`) sourced from SEARCH RESULTS,
  never fabricated; tier in {Beginner, Intermediate, Advanced}; no
  medical/performance claims (lint regex: cure/heal/guarantee/insurance/
  pays out/bulletproof/prevent injury/pain-free/burns fat/...).
Voice (Francis-ratified; the differentiator):
- Experienced coach, not gym-handout copy. Every record carries ≥1 thing only
  experience teaches: the common fault + its giveaway ("if the bottom foot
  springs, you stole the rep"), load honesty ("lighter than your ego wants"),
  or where the rep is won (stretch/pause/lockout).
- **Cues are positive-intention commands** — cue what TO do. Prohibitions
  live in the description; the cue gives the fix ("core tension", "elbows
  tight"), never "don't arch".
- **No wasted cues**: each of the ≤3 owns a distinct job (pelvis/hips-core ·
  upper back/elbows/chest · tempo/position). "Tuck pelvis" + "squeeze glutes"
  is one cue wearing two hats.
- Specifics: lat work cues through the ELBOW ("pull with the elbows, not the
  hands"); "ribs down" is for hinges, never presses (it closes the chest);
  shrug path is "up and back behind the ears, with intention"; curl bottom =
  natural REST position, not forced-straight.
- Prefix/equipment truth: a movement's `supported_prefixes[0]` implement MUST
  appear in its movement_equipment rows. Implement variants become their own
  row ONLY when their equipment differs from the base row (F4 ruling);
  true duplicates stay uncurated (they can never seed).
- Data decisions that need Francis: beginner-whitelist membership, new
  progression chains, quarantined categories, anything touching the shipped 30.

## 6. Tier law (plan P16 S4 — machine-checked, do not weaken)
Beginner sees/receives ONLY: difficulty = Beginner, OR the ratified
`movement_beginner_whitelist` (8 dumbbell/cable staples — NO barbell for
beginners). Enforced in blockGenerator (hard drop + warning, never an upward
fill), substitution layers 1/2/3 (via `trainingAge`), and the picker.
Untagged rows stay eligible (legacy back-compat, byte-identity is gated).

## 7. UI freeze (until Francis's pikeMethods template lands)
Brand: **pikeMethods** (lowercase p, uppercase M), white strong text, sleek
black, minimalist. Until his design drops:
- **Allowed**: functional fixes in UI files (gating, wrong-schema inputs,
  honest labels, bug fixes).
- **Forbidden**: aesthetic changes — colors, typography, layout redesigns,
  new screens beyond functional necessity. The S5 library browser/detail
  card, band picker, timed-set display, and the guided-runner screen all land
  WITH the redesign.

## 8. Reporting conventions
- Session end = a `HANDOVER_<date>_*.md` in repo root: what shipped, gate
  status, judgment calls flagged FOR REVIEW, honest debt list, Francis's
  checklist. Overstating status is the cardinal sin — auditors will find it.
- Architectural deviations go in `DEVIATION_LOG.md` (append-only) the moment
  they ship, not just in comments/handovers.
- Builder responses end with a MASTER LEDGER ENTRY block (see PROMPT_LEDGER
  conventions): input state, constraints enforced, actions, RAM/latency/
  constraint deltas.

## 9. Audit protocol (for auditor agents)
- Verify claims by RUNNING gates, not reading prose. `verify:all` may exceed
  a 60s shell limit — run gates individually.
- Cite file:line for every finding. Severity: P1 = safety/data-loss/claim
  contradicted by code; P2 = material gap with workaround.
- **Valid baselines only**: a commit that does not typecheck (e.g. a bridge-
  corrupted commit) is not a behavior baseline — compare against the last
  green commit.
- Distinguish "engine shipped, UI deferred by the freeze" (legitimate if the
  handover says so) from "claimed end-to-end but isn't" (P1).
- Expect pushback: findings that contradict Francis's RATIFIED decisions
  (e.g. Banded on bodyweight core work; time-only carries) are
  works-as-ruled, not defects. Check DEVIATION_LOG + handovers first.
- Never edit files during an audit unless explicitly asked; if you do fix
  something, say so and run typecheck + affected gates BEFORE reporting.

## 10. Current state + queue (as of 2026-07-17)
- Library: 96 movements (30 shipped + 016's 51 + 017's 15); 68/434 staged
  curated; 366 remain (~15/ticket via the batch generator → next slot 019).
- Chains: handstand-push-up + pull-up complete (ranks 0–4); progression
  engine + store resolver live; per-chain policy table ready (time chains
  qualify on seconds).
- 018: logging modes (time), set_metric, band_ladder, progression_policy.
- Phase 17 utility-first runner, guided/self-directed session UI, persistence,
  timed targets, and accessibility foundations are wired. Visual Checkpoint C
  remains parked until Francis supplies the pikeMethods template.
- Phase 18 Training Decision Record: pure classifier, migration 026, store wiring,
  and transaction gates are complete. Visual Checkpoint C remains template-blocked.
- P19 release blockers (Francis's machine): Android release keystore, iOS
  bundle id, embedder revision+hash pins (script prints sha256 to pin).
- Open Francis decisions: DB Romanian Deadlift → whitelist?; quarantined
  categories (stretching/plyo/olympic/strongman) in or out; shipped prefix
  arrays that overlap variant rows (trim in a future migration?).
- Queue: batch 05+ curation → P17 S2 guided UI + S5 library browser (with
  the pikeMethods template) → P18 Training Decision Record → P19 Play Store (open closed
  testing EARLY: 12 testers × 14 continuous days).

---

## 11. WORK ORDERS for Sol (execute in order; STOP at every checkpoint)

**Checkpoint bundle format** (what Sol hands Francis at each CP):
1. `git diff --stat` + list of new files; 2. output of the WO's named gates;
3. a ≤20-line self-report: what was done, judgment calls made, anything
   uncertain — flagged, not buried. No prose claims a gate can't back.
4. **For curation WOs (MANDATORY):** write the batch's new records to a FRESH
   file `packages/core-db/staging/batchNN_cp_bundle.json` (a JSON array of
   exactly the new curated records). Reason: the Cowork bridge shows Fable a
   length-capped view of REWRITTEN files (in-place edits to
   movement_import.json can appear truncated on the audit side), but NEW
   files sync intact. The bundle file is the audit source of truth; it is
   deleted after the checkpoint verdict (never committed).

**Fable's checkpoint verdicts**: APPROVE (Francis commits), REVISE (itemized,
Sol re-runs the WO on the same slot), or ESCALATE (needs Francis's ruling).

**Sol reasoning setting per WO** (cost discipline — the gates carry
correctness, so depth is bought only where judgment is open-ended):
- WO-1 / WO-3 batches: **medium** (rigid structure; voice quality is caught
  at CP-A regardless of setting; link honesty is compliance, not reasoning).
- WO-2 migrations: **medium** (scripted + three deterministic gates).
- WO-4 quarantine triage: **HIGH** (100+ open-ended taxonomy judgments —
  the one WO where reasoning depth genuinely pays).
- WO-5 test harness: **HIGH** (toolchain debugging; medium thrashes in retry
  loops that cost more than the setting saves).
- Extra-high: not required anywhere in §11 — the engine files where it would
  matter are in Sol's prohibited list.

---

### WO-1 — S3 Batch 05: curate 15 movements (STAGING ONLY)
Scope: `packages/core-db/staging/movement_import.json` — nothing else.
- Pick 15 UNCURATED staged records: additive staples first (no semantic
  duplicates of shipped movements, no names already in seeded_manifest.json),
  spread across patterns and tiers.
- Apply the full §5 contract: 2–4 steps, 1–3 positive-intention cues (one
  job per cue), coach voice with ≥1 experience marker per record, tier check,
  prefix[0]-vs-equipment truth, ONE real YouTube link per movement taken from
  actual search results — a fabricated video ID is an instant WO failure.
- Do NOT run the migration generator. Do NOT touch the whitelist, chains, or
  the import script.
Self-verify: staging JSON parses; counts hold (434 records, curated = 68+15);
name-sorted; unique names; per-record structure bounds (steps/cues/URL shape).
**CHECKPOINT A (Fable)** — audits: voice against the calibration records
(Barbell Ab Rollout, Dumbbell Shrug cues), link plausibility, tier sanity,
equipment truth, dupe screen vs shipped 30. THEN the generator may run.

### WO-2 — Migration for approved Batch 05 (only after CP-A approval)
Scope: run `node scripts/generate-batch-migration.mjs` (expect slot 019);
wire the import in `packages/core-db/src/migrations.ts`; update the THREE
gate expectations (verify_migrations chain list + heal count 96→111;
verify_store schema list + reset count 96→111).
Self-verify: `npm run typecheck`, `verify:migrations`, `verify:store`,
`verify:library`, `verify:demo`, `verify:coach` all green.
**CHECKPOINT B (Fable)** — audits: migration file diff (INSERT OR IGNORE
only, no schema objects beyond expectation), manifest slot integrity,
gate-count edits minimal. THEN Francis commits WO-1+WO-2 together.

### WO-3 — S3 Batch 06: same contract as WO-1 → CHECKPOINT A′ → migration
(slot 020) → CHECKPOINT B′ → commit. Repeat this WO pattern for every
subsequent batch until the staged pool is exhausted (~24 more tickets).
Never batch more than 2 tickets between commits.

### WO-4 — Quarantine triage report (REPORT ONLY, zero writes)
Scope: read `packages/core-db/staging/movement_quarantine.json`; produce
`QUARANTINE_TRIAGE_<date>.md` in repo root.
- The 61 no-pattern-only entries: propose an 8-pattern category each, or
  argue exclusion. The ~65 'machine' + 40 'other' equipment entries: propose
  keep-out (equipment vocabulary has no tokens) or a vocabulary extension
  case for Francis.
- Also list staged-but-miscategorized records observed during curation
  (e.g. anything push that is really core) with per-record fixes.
**CHECKPOINT C (Fable → Francis)** — Fable sanity-checks the taxonomy logic,
Francis ratifies scope calls (his open decision on stretching/plyo/oly/
strongman). Approved fixes become a staging pass in the next batch WO.

### WO-5 — RN component test harness (P17 debt, stretch goal)
Scope: new files only (`apps/mobile/test/components/` + jest config
extension). Two component tests: (1) beginner picker shows only Beginner +
whitelisted movements; (2) condition chips vanish when the implement can't
carry them; plus one snapshotless render smoke of SessionScreen.
Constraint: zero changes to app source. If the harness needs app changes —
STOP and escalate; do not adapt the app to the tests.
Self-verify: tests run green locally; wire a `verify:components` npm script
but do NOT add it to verify:all yet (CI cost unknown).
**CHECKPOINT D (Fable)** — audits: tests assert the LAW (whitelist rule),
not the implementation details; no app-source drift; runtime cost.

### Standing prohibitions for Sol (any WO)
- Never edit: shipped migrations (001–018), DEVIATION_LOG entries,
  progressionEngine/sessionRunner/blockGenerator/substitution engines,
  the whitelist, or anything in §7's frozen-aesthetics zone.
- Never create a new migration slot except through the batch generator.
- A blocked/ambiguous step = STOP + flag in the checkpoint bundle. An
  invented workaround that crosses a §1 constraint is a failed WO.
