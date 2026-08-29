# Release-candidate C1 decision docket

**Date:** 2026-08-29
**Status:** **RATIFIED 2026-08-29** — `S1a S2a S3a S4a S5c S6b L1a(constrained) L2b M1a A1a`.
Recorded in §6. Implementation (C2 onward) is unblocked.
**Revision 2 (2026-08-29):** corrects the L1, L2 and accessibility framing per the root-ledger audit
at Entry 0026, and records the owner's rulings.
**Base:** `codex/progression-evidence-remediation` @ `48719b07988ad30d255b0fed37f45ed5db49c935`
**Working branch:** `claude/rc-48719b0` (worktree `.claude/worktrees/opus-hermes-closure-1ceb71`)
**Ledger:** entry 0055, Output section open.

Produced under the 2026-08-29 work order §4. Options are presented neutrally, with no
recommendation and no preselection. No numeric value is proposed anywhere in this document; the
figures quoted are **measurements of the shipped corpus**, not candidate coefficients.

---

## 1. C0 — execution environment (complete)

| Item | Result |
|---|---|
| `git rev-parse HEAD` | `48719b07988ad30d255b0fed37f45ed5db49c935` — matches the audited base |
| `git status --short` (before ledger) | empty |
| `node --version` | `v24.11.1` (satisfies `engines.node >=24.0.0`) |
| `npm --version` | `11.18.0` (satisfies `>=11.6.0`, so `.npmrc` `strict-allow-scripts` is enforced, not advisory) |
| `npm ci` | exit `0`, 787 packages, no install-script policy violation |
| `node_modules` is a junction? | **No** — real directory |
| `node scripts/verify-preflight.mjs` | exit `0`, 13/13 PASS, all four revision-cache artifacts sha256-verified |
| `npm run verify:ci` | **exit `0`** — every gate green; jest 17 suites / 218 tests |

**`@ak/*` resolution — all inside this worktree:**

```
node_modules/@ak/biometrics -> .claude/worktrees/opus-hermes-closure-1ceb71/packages/biometrics
node_modules/@ak/mobile     -> .claude/worktrees/opus-hermes-closure-1ceb71/apps/mobile
```

`@ak/core-db` and `@ak/inference` are not npm workspaces; they resolve through
`apps/mobile/tsconfig.json` `paths`, `apps/mobile/babel.config.js` (anchored to `__dirname`) and
`apps/mobile/jest.config.js` `moduleNameMapper` (`<rootDir>`-relative). All three are
location-independent at this base, so the wrong-source hazard is closed here.

**Asset provenance note.** `HANDOVER_2026-08-27_SOL.md` §8 says to copy embedder assets from the
main checkout. The main checkout is on `master`, which predates the supply-chain pinning commits
(`2f4e72e`, `4a95679`), so its `@xenova` cache is in the **pre-pin flat layout** and does not satisfy
this base's preflight. The assets were instead copied from
`.worktrees/antigravity-pre-release-acceptance` (`codex/pikemethods-closed-beta-r8` @ `368e82d`,
an ancestor of the audited base), which carries the revision-pinned layout. **Identity was
established by hash, not by path**: all four artifacts match `KNOWN_SHA256` and `tokenizer.min.json`
matches `TOKENIZER_MIN_SHA256`. No download was performed.

`verify:ci` reaching exit `0` appears to be its first full completion — handover U2 records it
aborting in preflight, and the audit recorded the same.

---

## 2. Defect state at the base, independently confirmed

Both P1s were re-derived from source rather than accepted from the audit narrative.

### 2.1 Suspension does not freeze all progression paths

`nextMacroPosition` **does** honour an open episode
([useStore.ts:1822](apps/mobile/src/state/useStore.ts:1822)–1840, via `openSuspension`
at [:1817](apps/mobile/src/state/useStore.ts:1817)). Two things defeat it:

- **Guided program bypass.** Both the preview
  ([useStore.ts:2968](apps/mobile/src/state/useStore.ts:2968)–2974) and committed generation
  ([useStore.ts:3056](apps/mobile/src/state/useStore.ts:3056)–3058) call `programMacroIndex(...)`
  when a program or continuation exists, and never reach `nextMacroPosition`, so the episode is not
  consulted at all on that path.
- **Standalone consumption.** `beginSuspension` freezes the *next* index
  ([useStore.ts:2610](apps/mobile/src/state/useStore.ts:2610)). A block generated during the episode
  is minted at that frozen index and writes a `block_meta` row
  ([useStore.ts:3208](apps/mobile/src/state/useStore.ts:3208),
  [:3903](apps/mobile/src/state/useStore.ts:3903)). After closure, `nextMacroPosition` falls through
  to the `block_meta` branch and advances past it.

**Reproduced** against the real 001–058 chain, transcribing the algorithm at `useStore.ts:1817-1840`:

```
history: last generated block sat at macro index 5   (volume)
beginSuspension() froze                        = 6   (volume)
block generated DURING suspension got index    = 6
endSuspension(); next position                 = 7   (peak)
RESULT: froze 6, resumed at 7 — position 6 was CONSUMED
control (no block generated during the episode) = 6 — preserved
```

This is the exact failure `TRAINING_PROGRESSION_LAYERS.md` §4.1 ratified against: *"Entering rehab
does not advance `macro_block_index`. The athlete's place in the performance sequence is **held, not
consumed**."* The athlete was in `volume` and returns to `peak`.

The defect is **conditional on a block being generated during the episode** — which is precisely
what S6 must rule.

### 2.2 Dropdown ordering is used as loading state

[useStore.ts:2962](apps/mobile/src/state/useStore.ts:2962) and
[:3087](apps/mobile/src/state/useStore.ts:3087) pass `m.supportedPrefixes[0]` as `primaryImplement`;
[blockGenerator.ts:100](packages/inference/src/blockGenerator.ts:100) routes on
`primaryImplement === 'Bodyweight'`. `010_movement_library.sql:41-43` defines `supported_prefixes`
as "a JSON array of MOVEMENT_PREFIXES tokens (**the UI dropdown**)" — a domain, not a selection.

### 2.3 Reachability

- **No UI calls the suspension actions.** `beginSuspension` / `endSuspension` / `activeSuspension`
  are declared ([useStore.ts:766](apps/mobile/src/state/useStore.ts:766)–773) and implemented
  ([:2603](apps/mobile/src/state/useStore.ts:2603)–2633); the only other references in the repository
  are `verify_store_sql.mjs` and the handover. The athlete cannot open an episode.
- **The existing suspension coverage is source-text matching**, not behaviour:
  `verify_store_sql.mjs:442-454` asserts with `src.includes(...)` and a regex over the store's own
  source. It would stay green against any refactor that preserved the text.
- `beginSuspension` / `endSuspension` are **not wrapped in a transaction**, unlike `attestEdge`
  immediately below them ([:2637](apps/mobile/src/state/useStore.ts:2637)). Single statements are
  atomic, so this is currently sound — but it stops being sound the moment S1 requires entry to also
  touch an in-flight block.

---

## 3. Blocking rulings

### S1 — an in-flight block when suspension begins

**Today:** nothing happens. `beginSuspension` touches only `suspension_episode`; the active block,
its planned sessions and slots are untouched and remain live.

| Option | Consequence |
|---|---|
| (a) Retain / resume mid-block | Matches today's de-facto behaviour; no history is altered. The athlete keeps training a plan written before the event that caused the suspension. |
| (b) Archive at entry | `training_block.status` moves to archived. The athlete loses the remainder of a plan they may still be able to train around; the block stays in history. |
| (c) Regenerate on resume | Requires deciding what happens to the partially completed block, which re-raises (a) or (b) anyway, plus a generation trigger at exit. |

**Constraint:** whichever is chosen, §7.1 forbids rewriting a generated block, completed session,
set record, target, or historical progression row. (b) and (c) must be expressed as new rows or a
status transition, never as an edit to existing plan history.

---

### S2 — macro position when suspension begins with no prior block

**Today:** `nextMacroPosition` returns `1` when `block_meta` is empty
([useStore.ts:1836](apps/mobile/src/state/useStore.ts:1836)–1838), so `beginSuspension` would freeze
`1`. `058`'s CHECK permits it (`frozen_macro_index BETWEEN 1 AND 8`). This is a **fallback, not a
ruling** — exactly what the work order says must not stand.

| Option | Consequence |
|---|---|
| (a) Freeze the sequence start | Ratifies today's behaviour explicitly. |
| (b) Refuse to open an episode before any block exists | Athlete-visible refusal; needs an accessible, action-scoped message. |
| (c) Some other explicitly named position | Must be named by the owner; code may not choose it. |

---

### S3 — suspension crossing a dated competition horizon

**Today:** no interaction exists. `R3 / REVIEW_BOUNDARY` (ratified 2026-08-22) already states that a
selected date sets the review horizon and block **count** only and confers no peak authority
([useStore.ts:2970](apps/mobile/src/state/useStore.ts:2970)–2974), so a dated program takes the
rotation position exactly as an undated one does.

`TRAINING_PROGRESSION_LAYERS.md` §8 open questions 2 and 3 (taper duration; how far out preparation
begins) are **unratified and PARKED**, and the RR-03 figures are on the `HANDOVER_2026-08-27_SOL.md`
§7 quarantine list.

| Option | Consequence |
|---|---|
| (a) Name it out of scope for this release; record the incoherent countdown as a disclosed exception | No code. Consistent with RR-03 being parked. |
| (b) Define behaviour now | Would require taper/horizon semantics that do not exist and whose figures are quarantined. This is a §13 stop condition. |

---

### S4 — freeze at entry, or recompute at exit

**Today:** frozen at entry ([useStore.ts:2610](apps/mobile/src/state/useStore.ts:2610)), stored in
`suspension_episode.frozen_macro_index`. `PROPOSAL_suspended_state_trigger.md:123-124` freezes at
entry but explicitly flags it as a ruling, not a settled matter.

| Option | Consequence |
|---|---|
| (a) Freeze at entry | The persisted column is the contract; resume is a read. Matches the shipped column. |
| (b) Recompute at exit | `frozen_macro_index` becomes advisory, and "recompute from what?" must then be answered — the same question S6 raises. |

**Note:** entry currently freezes the position the athlete *would next occupy*, not the one they
were in. With no block generated during the episode these coincide; with one, they do not (§2.1).
If the owner's intent is the §4.1 wording — the athlete "returns to where they were" — then which of
those two the column holds is part of this ruling.

---

### S5 — what guided-program state is frozen

This is the structural one.

A guided program's position is **not** the global macro index. It is
`programMacroIndex(starting_macro_block_index, sequenceIndex)` =
`((starting-1) + (sequence-1)) mod 8 + 1`
([blockGenerator.ts:380](packages/inference/src/blockGenerator.ts:380)-383), where
`starting_macro_block_index` is immutable per program (`033_goal_program.sql:17`) and the sequence
index is derived as `COALESCE(MAX(training_block_program.sequence_index), 0)`
([useStore.ts:3381](apps/mobile/src/state/useStore.ts:3381)) — i.e. it advances **only when a block
is generated and linked** ([:3205](apps/mobile/src/state/useStore.ts:3205)).

**Consequence:** `suspension_episode.frozen_macro_index` is a global index in 1..8. It **cannot
express** "sequence index 3 of a 5-block program". Freezing it does nothing for the guided path.

| Option | Consequence |
|---|---|
| (a) Freeze the global macro index only | Guided programs remain unprotected. The 058 column suffices; no migration. |
| (b) Freeze the program sequence index | Requires somewhere to persist it — `058` has no column for it, so this couples S5 to **M1** and a Migration 059. |
| (c) Freeze both | Same schema consequence as (b). |
| (d) Name another explicit state | Owner to name. |

**If S6 forbids generating a block while suspended, the guided sequence cannot advance at all**,
because it is derived from generated blocks. That combination may make (a) sufficient — but it is
the owner's call whether to rely on that coupling or persist the state explicitly.

---

### S6 — may a block be generated while suspended

**Today:** yes, nothing prevents it, and doing so is what consumes the frozen position (§2.1). This
is the single lever that decides whether the standalone defect exists at all.

| Option | Consequence |
|---|---|
| (a) Forbid generation while an episode is open | Removes the standalone defect and (via S5) the guided one, at the cost of an athlete who *is* still training — which `058`'s own header calls out: suspension "does NOT stop training, and it must not". A refusal path and accessible message are needed. |
| (b) Allow it, and have repeated blocks reuse the frozen position | The frozen index is never consumed; N blocks during an episode all sit at it. Requires `nextMacroPosition` to keep returning the frozen value after resume until the episode's blocks are accounted for. |
| (c) Allow it, and let it consume | Ratifies today's behaviour and closes P1-1 as intended rather than a defect. This would need reconciling with §4.1's "held, not consumed". |

---

### L1 — the authoritative planned implement / load class

**Data-flow trace.** The five things the work order requires be kept distinct:

| # | Thing | Where it actually lives | What it is |
|---|---|---|---|
| 1 | Implements a movement **supports** | `movement_detail.supported_prefixes` (`010_movement_library.sql:51`; documented as the UI dropdown at `:41-43`) | ordered JSON **domain** |
| 1b | Per-movement canonical implement | `movement_taxonomy.implement` (`008_taxonomy.sql:23-24`), vocabulary `TAXONOMY_IMPLEMENTS`, bridged by `PREFIX_TO_IMPLEMENT` (`types.ts:154`) | per-**movement** classification |
| 2 | Implement **selected for the planned slot** | **does not exist** — `planned_slot` is `planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe` (`007_program_engine.sql:224-233`); `planned_slot_target` (023) adds only reps/time | **missing** |
| 3 | Equipment **availability** | `movement_equipment (movement_id, item)` ∩ `athlete_profile.equipment_inventory` | availability, not selection |
| 4 | Actual load used **in a session** | `set_record.load_kg` (`001_mechanical_input.sql:79`), `set_prefix.applied_prefixes` (`015:25`); resolved at log time by `implement ?? movement.supportedPrefixes[0] ?? 'Bodyweight'` ([useStore.ts:5438](apps/mobile/src/state/useStore.ts:5438)) | **retrospective** |
| 5 | External load for weighted calisthenics | only `set_record.load_kg > 0`, retrospectively | **retrospective only** |

**Measured against the shipped 001–058 corpus** (300 movements; 300 `movement_detail` rows; 300
`movement_taxonomy` rows; no gaps):

- 55 movements have `supported_prefixes[0] === 'Bodyweight'` and therefore take the bodyweight dose.
- `supported_prefixes[0]` and `movement_taxonomy.implement` **agree on all 300 movements** —
  0 disagreements in either direction. **Switching source 1 → 1b changes nothing today and is not a
  fix.**
- 283 movements have a single-element prefix list; 14 have two; 3 have three.
- 7 movements list `Bodyweight` first *and* support an external-load prefix — these are where the
  athlete may plan load and still receive the pure-bodyweight prescription:
  Bulgarian Split Squat `["Bodyweight","DB","BB"]`, Walking Lunge `["Bodyweight","DB","BB"]`,
  **Weighted Pull-up** `["Bodyweight","Banded"]`, Chin-up, Glute Bridge, Nordic Curl, Push-up.

**The sharp point:** `movement_taxonomy.implement` for **Weighted Pull-up** is `bodyweight`. Both
candidate per-movement sources classify a movement named for its external load as unloaded, because
loading is **not a property of the movement** — it is a per-slot, per-athlete choice, and there is
nowhere in the schema that records it prospectively.

| Option | Consequence |
|---|---|
| (a) Record a prospective per-slot load intent at block generation time | Preserves Option C's routing while representing the choice the other options cannot. Requires added state (couples to **M1**), a selection rule for ambiguous movements, and a fail-closed default. The exact schema shape is not preselected here. |
| (b) Derive it from equipment availability ∩ supported prefixes at generation time | No migration. Availability is not intent: an athlete who owns dumbbells does not thereby load every movement. Fails closed only if the owner says an ambiguous intersection is "loaded". |
| (c) Keep a per-movement classification, switching to `movement_taxonomy.implement` | No migration, single vocabulary — but **provably no behaviour change today** (0/300 disagreements), so it does not close the defect. |
| (d) Roll back Option C's bodyweight routing until an authoritative source exists | Removes the defect by removing the feature. Release-safe: it returns bodyweight slots to the prescription they had before 2026-08-27 and needs no added state. |

**Selection time** is a second axis the owner must name: at block generation (prospective, frozen
into the plan) or at session start (which would make the plan's dose depend on later state, which
§7.2 forbids).

---

### L2 — scope of the bodyweight repetition floor

**Today:** [blockGenerator.ts:734](packages/inference/src/blockGenerator.ts:734)-736 floors
non-deload bodyweight reps at `DEFAULT_ADVANCEMENT_POLICY.requiredReps`, imported from
`progressionEngine.ts:52-53`, and applies it to every `isPurelyBodyweight` slot
([:827](packages/inference/src/blockGenerator.ts:827)) regardless of chain membership.

**Measured:** of the 55 dropdown-bodyweight movements, **15 are in a capability chain and 40 are
not**. `movement_progression` holds 35 rows across 10 groups (`pull-up`, `handstand-push-up`,
`squat-competition`, `hinge-deadlift`, `press-bench`, `lunge-split`, `row-barbell`,
`core-antiextension`, `press-overhead`, `carry-loaded`). The 40 non-chain movements — crunches,
sit-ups, dips, Road Run, BJJ Sparring Round, Russian Twist, Walking Lunge and similar — receive a
floor derived from a ladder they are not on.

**Per-chain policy is not consulted by the generator.** `progression_policy`
(`progression_group TEXT, required_sets INTEGER, required_value REAL`) is read only by
`resolveGoalRung` ([useStore.ts:2594](apps/mobile/src/state/useStore.ts:2594)-2598), never by
`blockGenerator`. A chain with a custom `required_value` therefore advances on one bar while being
prescribed against another. **The table currently has zero seeded rows**, so no athlete is affected
today — but the schema supports it and the §6.3 fixture must insert one.

> **Correction (revision 2).** Revision 1 of this docket asserted that the broad floor was an
> owner-ratified decision and that narrowing it would be a re-ruling. **That was wrong**, and the
> root-ledger audit (Entry 0026 P1-5) is upheld. The record:
>
> - The owner's instruction (branch `PROMPT_LEDGER.md:2223`) was *"Fix the Ladder Bug: reconcile the
>   `resolveActiveRung` requirement (3x8) with the `LINEAR` phase prescriptions **so athletes can
>   actually level up to harder variations**"* — an authorization scoped to the capability ladder.
> - The implementer's own handback (`PROMPT_LEDGER.md:2248-2252`) records a **"Disclosed dose change
>   requiring the owner's eye: the floor applies to *all* strictly bodyweight movements, not only
>   those on a ladder chain, because chain membership is not available in the generator's input."**
> - The *Settled* row in `TRAINING_PROGRESSION_LAYERS.md` §8 dated 2026-08-27 was therefore
>   **agent-authored, and it recorded as settled the very broadening its own handback had flagged as
>   unratified.** An agent cannot ratify its own scope expansion.
>
> **L2 has always been an open owner ruling**, and no option below is a re-ruling. Once L2 is ruled,
> the §8 *Settled* row must be corrected to match — see §5.6.

| Option | Consequence |
|---|---|
| (a) Retain the broad floor | No dose change from today. The 40 non-chain movements keep a floor derived from a ladder they are not on. |
| (b) Restrict the floor to movements in a capability chain | Returns the fix to the scope the owner's instruction described. Changes prescription for the 40 non-chain movements relative to today. §7.3 requires chain membership and policy arrive as a **typed planning input**, not a DB read inside the engine. |
| (c) Roll the floor back entirely | Restores the pre-2026-08-27 prescription and re-opens the defect the fix targeted: bodyweight slots prescribed below the level at which their own capability is measured. |

Independently of (a)/(b)/(c): **should the generator honour a per-chain `progression_policy` row
where one exists?** Falsifier §3 lists disagreement between a supported custom policy and the
generated prescription as disproving the release, which implies yes — but the mechanism (threading a
typed policy input into the generator) needs the owner's assent because it changes what the ratified
"imported, never restated" floor is imported *from*.

---

### M1 — Migration 059 for suspension-history immutability

**Empirically probed** against the real chain. `058` enforces exactly two invariants:

| Operation | Result |
|---|---|
| second **open** episode | **REFUSED** (`ux_suspension_episode_single_open` + trigger) |
| re-open a closed episode (`ended_at_ms → NULL`) | **REFUSED** (`trg_suspension_episode_no_reopen_bu`) |
| rewrite `frozen_macro_index` (open **or** closed) | ALLOWED |
| rewrite `started_at_ms` (open or closed) | ALLOWED |
| rewrite `reason` (open or closed) | ALLOWED |
| move `ended_at_ms` to a different non-null time | ALLOWED |
| **`DELETE` a closed episode** | ALLOWED — the audit trail can be erased entirely |

`058:81-82` claims the episode model exists to keep an audit trail. That claim is currently
unenforced beyond no-reopen.

| Option | Consequence |
|---|---|
| (a) Authorize Migration 059 | Adds immutability triggers. Requires re-pinning the migration count in **both** `verify_migrations.mjs` and `verify_pipeline.mjs` (never loosening), plus idempotency and sentinel/self-heal coverage. If S5 selects (b)/(c), 059 is needed anyway to persist program sequence state. |
| (b) Defer as an explicit P2 | Permitted, but §7.1 then requires recording the mutable-audit-history exposure as a **disclosed release exception**. The trail must not be described as immutable. |

`058` itself is frozen — it has reached an installed QA build and is not editable under either option.

---

### A1 — dirty-worktree features

None is on the audited head; none may be merged wholesale.

| Item | Where | Verified state |
|---|---|---|
| **Blocked-control UI** | `.claude/worktrees/blissful-curran-b33cea` (7 changed paths; `PrimaryButton.tsx`, `requirements.ts`, `BlockScreen`, `ProgramSetupScreen`) | The behaviour is **deliberate and documented** (`PrimaryButton.tsx:11-14, 42-43, 88-90`): a blocked button wears the disabled skin, announces `accessibilityState.disabled`, carries the reason as `accessibilityHint`, and **stays pressable on purpose** (`:101`, `:105`). **Deliberate is not the same as accessible.** A control announced as disabled but expected to be activated is contradictory to assistive technology regardless of intent — a screen-reader user is told the control is unavailable and has no reason to activate it, so the reason never reaches them. Work-order §7.4 prescribes the correction (semantically enabled + accessibility hint). Adoption requires either that correction, or an explicit owner exception **accompanied by screen-reader evidence** that the reason is actually reachable. |
| **Demo-loader extraction** | `.claude/worktrees/wonderful-gauss-010147` (9 changed paths) | Wall-clock dependency **confirmed**: `demoData.ts:344` runs `SPO2_TRIM_SQL` with `Date.now() - 14 * 86_400_000` inside `loadDemoAthleteHistory(db, today, days)`, which is handed `today`. Same `(db, today)` inputs give different results on different days. Bounded to the SpO2 trim. Also `ReadinessScreen.tsx:165` renders the global store `error` under the demo control. |
| **Movement-video factory** | `.worktrees/four-mode-load-selection` (12 changed paths; `tools/movement-video-factory/`) | Modifies `package.json`, `.github/workflows/ci.yml`, `AGENT_WORKFLOW.md`, `verify_store_sql.mjs`. Its `verify:all` rewrite targets an obsolete pre-release chain; the current topology is `verify:all → verify:release → verify:ci`. |

| Option | Consequence |
|---|---|
| (a) None — ship the candidate without them | Each dirty worktree is left untouched and explicitly excluded. Smallest release surface. |
| (b) Any subset, reimplemented on this lineage | Each selected item must be re-authored under §7.4's constraints, not copied. Widens the diff and the device checklist. |

---

## 4. What each ruling unlocks

| Ruling | Unlocks |
|---|---|
| **S6** | C2 §6.1 lifecycle tests and the standalone counterexample assertion; the whole shape of the C3 §7.1 resolver. Nothing in the suspension work can start without it. |
| **S4** | The persisted episode contract; whether `frozen_macro_index` is authoritative or advisory. |
| **S5** | Whether a Migration 059 is required for the guided path (→ **M1**); the single-resolver design in §7.1. |
| **S1** | Entry-time transaction shape (§7.1 atomicity); C2 in-flight test; device checklist row. |
| **S2** | C2 no-history entry test; device checklist row. |
| **S3** | Whether an exception is recorded or code is written; C2 horizon test. |
| **S1–S6 together** | The suspension UI (§7.1 explicitly bars building it before they are ratified) and every device-checklist suspension row. |
| **L1** | C2 §6.2 implement fixtures; C3 §7.2 routing; whether Migration 059 carries a planned-implement column (→ **M1**); the weighted-calisthenics device row. |
| **L2** | C2 §6.3 ladder tests and the per-chain policy fixture; C3 §7.3. |
| **M1** | Whether `packages/core-db/src/schema/059_*.sql` enters the write boundary at all, and whether both pinned migration counts get re-pinned. |
| **A1** | Whether `verify:demo` joins the C4 gate list; the final diff surface; extra device rows. |

Independent of every ruling: the `bodyweightDominant` plumbing
([blockGenerator.ts:661](packages/inference/src/blockGenerator.ts:661) passes a hardcoded `false`,
making the branch at [:492](packages/inference/src/blockGenerator.ts:492)-494 unreachable).
`SCHEMA_FATIGUE_COST_BODYWEIGHT` is an exact alias
([:485](packages/inference/src/blockGenerator.ts:485)), so wiring the real classification through is
provably dose-neutral today and introduces no number. This is authorized by §7.3 and needs no ruling.

---

## 5. Corrections to the work order and the audit

1. **§2.6 citation.** "Root `PROMPT_LEDGER.md`, Entry 0024" resolves only in the **main checkout**
   (`master`). The two lineages have **divergent ledgers**: master's has 25 entries and its 0024 is
   "2026-08-28 · Recent Worktree Audit"; the audited base's has 55 and its 0024 is
   "2026-07-15/16 · Phase 17 guided-session runner". This docket's ledger entry (0055) is in the
   audited-base lineage. The two ledgers will need reconciling before any merge.

2. **Audit P1-2's framing.** The three named movements do begin with `Bodyweight` — confirmed. But
   the audit's implicit remedy (an authoritative implement field) is not satisfied by
   `movement_taxonomy.implement`, which agrees with `supported_prefixes[0]` on **all 300** movements
   and likewise classifies Weighted Pull-up as `bodyweight`. L1 needs a new per-slot representation,
   not a different per-movement column.

3. **Audit P1-4 does not apply here.** This worktree has a real `node_modules` from `npm ci` and
   in-worktree `@ak/*` links, so its gate results are admissible.

4. **Handover §8's embedder instruction is stale for this base** — see §1 asset provenance note.

5. **Migration 058 is not the whole of `is_suspended`.** The proposal's §2.1 sketch names
   `resumed_macro_index`; the shipped column is `frozen_macro_index`. Same role, different name.

6. **Retracted — my own error (revision 1 → 2).** Revision 1 declared the broad bodyweight floor a
   settled owner ruling and labelled L2(b)/(c) re-rulings requiring a §13 stop. The ledger shows the
   opposite: the owner authorized a ladder reconciliation, the implementer disclosed the broadening
   as unratified, and the *Settled* row was written by that same implementer. The claim is
   withdrawn. **Follow-on:** `TRAINING_PROGRESSION_LAYERS.md` §8's 2026-08-27 *Settled* row now
   misstates the record and must be corrected to reflect the L2 ruling. That file is outside the
   work order §8 write boundary, so it is flagged here as a checkpoint item rather than edited.

7. **`git diff --check` vs the verbatim ledger — a real protocol conflict, not a transient.** Four
   lines in ledger entry 0055 carry trailing double-spaces (Markdown hard breaks) because the
   protocol requires the prompt verbatim. Revision 1 said committing makes them vanish; that is true
   only of the working-tree form in work-order §9, and **false** for a base-to-HEAD check such as
   `git diff --check 48719b0..HEAD`, which the audit correctly points out. The committed ledger has
   zero pre-existing trailing-whitespace lines, so this is a new exception either way. Owner choice:
   **(i)** keep the bytes verbatim and record a standing exception for ledger entries, or
   **(ii)** normalize trailing whitespace on paste and note the normalization inside the entry.
   Held at (i) pending a ruling, since the protocol's stated purpose is byte-fidelity of the input.

---

## 6. Owner ruling record

**Ratified by the owner on 2026-08-29**, adopting the package recommended in root
`PROMPT_LEDGER.md` Entry 0027. Each ruling is binding on the sections above and on C2–C5.

| ID | Ruling | Binding content |
|---|---|---|
| **S1** | **(a)** retain / resume | An in-flight block survives suspension untouched. Suspension itself never archives or regenerates it. |
| **S2** | **(a)** freeze the sequence start | With no prior block, the already-existing sequence start is frozen. Ratifies the existing derivation rather than inventing a position. |
| **S3** | **(a)** out of scope | Competition/taper interaction stays out of this release. The existing dated review boundary is preserved and **no taper behaviour is invented**. Recorded as a disclosed exception, not code. |
| **S4** | **(a)** freeze at entry | The snapshot persisted at entry is authoritative on exit. `frozen_macro_index` is the contract, not an advisory value. |
| **S5** | **(c)** freeze both | Freeze the global macro position **and**, when a guided program is active, its program-owned next sequence state. Requires added state — couples to M1. |
| **S6** | **(b)** train, but do not consume | Training and block generation may continue while suspended, but **blocks generated during an episode consume neither frozen progression state**. Resume returns to exactly the recorded position. |
| **L1** | **(a) constrained** | Persist explicit **prospective per-slot load intent/implement at block generation**. Ambiguous mixed movements require athlete selection. Missing legacy state **fails closed toward the conservative loaded path**. Intent may **not** be derived from dropdown order, taxonomy, equipment ownership, or retrospective set data. |
| **L2** | **(b)** chain-scoped | Scope the ladder floor to actual capability-chain movements and honour an applicable per-chain `progression_policy`. Unrelated bodyweight movements retain their phase prescription. **Future plans only — never rewrite history.** |
| **M1** | **(a)** authorize 059 | Additive Migration 059 for immutable suspension history plus the state required by S5 and L1. **Do not edit 058**, invent constants, or block explicit whole-athlete data erasure. |
| **A1** | **(a)** adopt none | No optional dirty-worktree feature enters this release. Blocked-control UI, demo-loader extraction and movement-video factory are each re-authored later under separate work orders. |

### Consequences that follow directly

- **S6(b) + S5(c) together** are what close P1-1. Because the guided sequence index is derived from
  generated blocks (`useStore.ts:3381`), "does not consume" must hold for both the global index and
  the program sequence, which is why S5(c) rather than S5(a) is required.
- **L2(b) does not affect any athlete's existing data today** — `progression_policy` has zero seeded
  rows and the change is future-plan-only. It changes future prescription for the 40 measured
  non-chain bodyweight movements.
- **A1(a)** removes `verify:demo` from the C4 additions and keeps the release diff to the suspension,
  routing and ladder work.
- **S3(a)** means the competition-horizon behaviour is recorded as a disclosed release exception in
  the C7 handback, alongside any M1 residue.

---

## 7. State at the close of C1

At revision 2 the only repository changes are `PROMPT_LEDGER.md` (entry 0055, append-only) and this
document. No runtime, schema, or test file has been modified, no migration added, no gate altered,
no dirty worktree touched, no commit made, nothing pushed.

With §6 ratified, C2 (failing behavioural regression tests) is unblocked. Push remains owner-only
and gated on the C6 device acceptance.
