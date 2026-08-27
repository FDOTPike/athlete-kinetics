# Handover — 2026-08-27 — Opus → Sol

**Branch:** `codex/progression-evidence-remediation`
**Worktree:** `.worktrees/progression-evidence-remediation`
**HEAD:** `5c727f6` — 11 commits this session, **none pushed**
**Base:** `368e82d` (ledger backfill), itself 51 commits ahead of `master`

---

## 1. State in one paragraph

All six progression-measurement owner decisions are now ratified and recorded, the LINEAR
bodyweight-progression defect is fixed and machine-guarded, RR-04 is implemented, the capability
ladder has been reconciled with what blocks actually prescribe, and Migration 058 gives the app a
real suspending state. **15 of 15 runnable gates exit 0** and all six source tripwires pass. A QA
build (`1.0.0-beta.1-QA`, `com.pikemethods.training.qa`) is installed on the owner's Pixel 9 Pro from
`5c727f6`. Push remains gated on the owner's on-device verification.

---

## 2. What landed

### 2.1 Ratifications — all six decisions closed

| # | Decision | Ruling |
|---|---|---|
| 1 | Dormant e1RM series | **(a) dormant**, with an advanced-athlete disclosure rider recorded as **NOT ratified** by that ruling |
| 2 | Hard-set count | **(b)** descriptive display in a later work order; `RPE >= 8` stays an unvalidated proxy |
| 3 | Own-data repeatability protocol | **(b)** future phase, may run concurrently with KineStrike — **method, not data** |
| 4 | Descriptive/prescriptive boundary | **(b) PLAN ONLY, deferred until further notice**; brief written, implementation unauthorized |
| 5 | Push-up force values | **(a)** do not pursue; ordinal ladder preserved; `41/49/64/74%` quarantined |
| 6 | Evidence archive | **(b)** preserved in-repo, unscrubbed, indefinite and immutable |

Decision 4's framing was **corrected after an owner challenge**: the app *is* prescriptive
(`completionAction.ts`, `kinematicAutopilot.ts`), but it prescribes from readiness, completion and
tolerance — never from progression measurement. That distinction is now written into §5 of the
docket from source.

### 2.2 Engine changes

**Option C — implement-routed bodyweight progression** (`8b4e75b`). `GeneratorMovement` gains
optional `primaryImplement`, threaded from `supportedPrefixes[0]` at both `generateBlock` call sites.
`isPurelyBodyweight` matches exactly `'Bodyweight'`; absent or non-canonical fails toward
external-load behaviour (P2-2). Bodyweight LINEAR slots take `SCHEMA_WEEKS_BODYWEIGHT_SETS_DELTA`
`[0,1,1]`; every other schema mirrors its own row. Week 4 is untouched by the pre-existing
`deload ? 0 : setsDelta` guard.

**RR-04 + ladder reconciliation** (`1f934bb`). `workingSetsFor` now takes `phaseSets`, and the slot
loop passes `primarySlot ? phaseMod.sets : 0` — the volume phase's `+1` reaches primaries only.
Separately, bodyweight reps are floored at `DEFAULT_ADVANCEMENT_POLICY.requiredReps`, **imported from
`progressionEngine.ts` and never restated**, so the prescription and the criterion cannot drift.

**Migration 058 — suspension episodes** (`5c727f6`). An episode table, not a boolean; `is_suspended`
is derived (`ended_at_ms IS NULL`) and never stored. Closed reason domain `injury|illness|life`,
`frozen_macro_index` 1..8, a partial unique index enforcing one open episode, and two fail-closed
triggers (single-open, no-reopen) registered as SENTINELS with self-heal coverage.
`nextMacroPosition` consults the open episode before advancing.

### 2.3 The finding that mattered most

The capability ladder and the block generator disagreed about reps. `resolveActiveRung` **is** wired
(`useStore.ts:2568`) and needs `3x8`; the prescription reached 8 reps in **two of eight** macro
blocks — gpp 7, volume 5, peak **3**. An athlete following the plan literally could not level up
outside hypertrophy. Now **8 of 8**. This was missed by the external architecture review and is the
single largest defect closed this session.

### 2.4 Documents

`docs/BRIEF_progression_control_safety.md`, `docs/ANALYSIS_linear_scheme_progression_defect.md`,
`docs/AUDIT_architecture_review_8b4e75b.md`, `docs/PROPOSAL_suspended_state_trigger.md`,
`docs/PARKED_RR03_taper_and_microcycle_architecture.md`, plus the 25-file audit archive under
`docs/research/audits/` with a SHA-256 manifest.

---

## 3. Gate status

**15/15 runnable exit 0:** typecheck, policy, blocks, autopilot, autopilot-counterexamples,
progression, db, demo, migrations, runner, outcomes, pipeline, coach, library, store.

**All six source tripwires PASS**, including both that guard `blockGenerator.ts`.

**`verify:ci` cannot complete in this worktree.** It aborts in `scripts/verify-preflight.mjs` on the
missing `node_modules` / embedder assets, *before* typecheck and before any gate runs. That is an
environment condition, not a code failure. Both were resolved for the device build (see §6), so
`verify:ci` may now be runnable — **worth re-running once as the first act of the handover.**

---

## 4. Outstanding work, in priority order

1. **Owner's on-device verification.** Nothing pushes until this happens. Check: bodyweight push-ups
   at 8 reps and 4→5→5 sets; loaded blocks flat at 4 sets with RPE 7→7.5→8 and reps NOT forced to 8;
   volume-phase primaries carrying more sets than accessories.
2. **Suspension has no UI.** Migration 058, the store actions (`beginSuspension`, `endSuspension`,
   `activeSuspension`) and the gates all exist, but nothing calls them, so the athlete cannot declare
   an episode. This is the gap between a correct mechanism and a working feature. The app should
   *prompt* after a halt or a persistent niggle and never infer — see
   `docs/PROPOSAL_suspended_state_trigger.md` §2.2, and the four open questions in its §3.
3. **Non-7-Day Micro-Cycle architecture — owner-assigned to Sol.** Title as specified:
   *Non-7-Day Micro-Cycle architecture implementation — 9-day, 12-day and 14-day micro-cycles into
   the block generator, coaching engine and app.* Prerequisite for any taper work. Blast radius and
   the owner's intensity-block → peak → taper intent are in
   `docs/PARKED_RR03_taper_and_microcycle_architecture.md`.
4. **WO-04 should be withdrawn.** It proposes e1RM persistence while citing Decision 1 as authority;
   Decision 1 ratified (a) dormant, explicitly forbidding persistence, and
   `verify_store_sql.mjs:649` is a live removal guard.
5. **WO-02 should be re-scoped and downgraded.** It claims the progression engine is unwired; it is
   wired at `useStore.ts:138, :2568, :2570`.
6. **WO-01 is genuine and cheap.** `athlete_profile.progression_methodology` is stored, validated and
   hydrated but read by no planner — a second vocabulary competing with `schemaType`. One should go.
7. **RR-01 rationale.** Option A was signed on the basis that calisthenics "inherently produce lower
   systemic CNS fatigue" — **no source locator**. The ruling stands; the reason should not be carried
   into a decision record as evidence.
8. **`verify_store_sql.mjs` SCHEMA_FILES was missing 057** before this session and still is. 058 was
   added alone because it does not depend on 057. Closing that gap has its own blast radius.
9. **P3-1 ledger capture-at-issue-time convention** — drafted, belongs in `AGENT_WORKFLOW.md`, still
   not applied.

---

## 5. Standing constraints — non-negotiable

- **Calibration Policy v1.** No numeric value enters the engine without explicit owner ratification
  recorded against a source. Every change this session honoured it: Option C reused `STEP`'s ratified
  row, RR-04 only moved an existing `+1`, and the ladder floor imports an existing constant. The one
  pending coefficient (`SCHEMA_FATIGUE_COST_BODYWEIGHT`) is a deliberate **alias**, docketed as open
  item 5 of `TRAINING_PROGRESSION_LAYERS.md` §8.
- **Prompt ledger protocol.** Every execution prompt's FIRST file operation appends a
  `PROMPT_LEDGER.md` entry with the verbatim input. Currently at entry **0052**, strictly append-only.
- **Push gate.** Never push until the owner has verified on-device. "Proceed" is not "push". Ruling
  6(b) added a second edge: pushing publishes the archive's sixteen author-local paths to a public
  repository.
- **Append-only migrations.** Shipped migrations are frozen; new work is a new slot. Head is **058**.
- **The quarantine list.** Nothing on it may enter code or a work order: e1RM MDC 11.1–33%, persistence
  windows, hard-set R² .68/.09, Hackett 3.5±1.2, Pareja-Blanco −1.2%, push-up 41/49/64/74%, and the
  RR-03 taper figures (50%, 30%, 60%, 40–60%, 41–60%) with their unlocatable Bosquet/Mujika
  attributions.

---

## 6. Traps that cost time here

- **Worktree `node_modules` must be a real install, never a junction to the main checkout.** Main's
  `node_modules/@ak/*` symlink back to *master's* source, so a junction silently builds master's code
  and reports success. `npm ci` in the worktree links `@ak/*` correctly; `babel.config.js` already
  anchors its aliases to `__dirname` for the same class of reason, and says so in a comment.
- **Embedder assets** are gitignored and absent from a fresh worktree. Copy
  `model_quantized.onnx` and `tokenizer.full.json` from the main checkout rather than re-fetching.
- **Two pinned migration counts** fire whenever a migration is added — `verify_migrations.mjs` and
  `verify_pipeline.mjs`. They exist so adding one is a conscious act. Re-pin, never loosen.
- **Gradle needs JDK 21**, not the system Java 26. `JAVA_HOME="C:/Program Files/Android/openjdk/jdk-21.0.8"`.
- **Build recipe that works:** `cd apps/mobile/android && JAVA_HOME=<jdk21> ./gradlew installQa`.
  6m15s warm. The QA variant is non-debuggable with the JS bundled — no Metro, no adb tunnel.

---

## 7. Where the judgement calls are recorded

Every ruling, its reasoning, and what it deliberately does **not** assert is in
`docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` and
`docs/decisions/TRAINING_PROGRESSION_LAYERS.md` §8. Ledger entries 0042–0052 carry the verbatim
prompts and full outputs, including the corrections made along the way — three of my own test
assertions were wrong and were fixed rather than the code, and my initial scoping of the LINEAR fix
was wrong on two counts. Those are recorded rather than tidied away, deliberately.
