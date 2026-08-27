# Handover — 2026-08-27 — Opus → Sol (orchestrator)

**Branch:** `codex/progression-evidence-remediation` · **Worktree:**
`.worktrees/progression-evidence-remediation` · **HEAD:** `0c6d164`
**12 commits this session, none pushed.** Base `368e82d`, itself 51 commits ahead of `master`.

Written for your role: you orchestrate, you do not write the code. Everything below is shaped as
**assignable units** — who to give it to, why that agent, what verifies it, and what it depends on.
§9 carries the questions I need answered before you can dispatch cleanly.

---

## 1. Read this before you dispatch anything

**`tools/hermes_executor.py` does not exist.** Not in this worktree, not in `master`, not anywhere
in the repository. Your Conjugation Loop step 3 has no script behind it.
`tools/antigravity/run_project_agent.py` **is** present and takes `argparse` flags.
`tools/temp_hermes_output.ts` and `docs/CURRENT_AUDIT.md` are absent, but those are outputs — they
appear on first use, which is expected. The missing executor is the real blocker. See §9 Q1.

**Naming hazard:** "Hermes" means two different things here. It is your precision-coding agent, and
it is also React Native's JavaScript engine (`hermesEnabled=true`, and hundreds of
`hermes-engine*.cmake` build artifacts). A grep for "hermes" will drown you in the second kind.

---

## 2. State, compressed

All six progression-measurement owner decisions are ratified. The LINEAR bodyweight-progression
defect is fixed and machine-guarded. RR-04 is implemented. The capability ladder now agrees with what
blocks prescribe. Migration 058 gives the app a real suspending state.

**15 of 15 runnable gates exit 0. All six source tripwires pass.** A QA build
(`1.0.0-beta.1-QA`, `com.pikemethods.training.qa`) from `5c727f6` is installed on the owner's Pixel 9
Pro. **Nothing pushes until the owner verifies on-device.**

Detail on any ruling lives in `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` and
`docs/decisions/TRAINING_PROGRESSION_LAYERS.md` §8. Ledger entries 0042–0053 carry verbatim prompts
and full outputs.

---

## 3. The single most important thing to know about your sub-agents

**Antigravity's prior output on this exact domain was materially unreliable, and it is on record.**
An independent audit of its progression-measurement review dispositioned 51 material claims:
**3 retained, 17 rewritten, 17 quarantined, 14 requiring full text.** The failure modes were
specific and are likely to recur:

- auditor-derived values presented as published findings (MDC tables, persistence windows);
- exact statistics with no source locator;
- tier inflation — a medRxiv preprint tiered as A;
- a paper mischaracterised (Baumel: *Mental* Health Apps, cited as *Mobile* Health Apps).

The audit's own verdict: *"Antigravity is not safe as an evidence basis or decision input."* Hermes
was judged *"not adoption-ready either, but materially more disciplined."*

**What this means for your loop:** Antigravity is fine for what it is good at — large log analysis,
sprint decomposition, reading things too big for one context. But **any number it derives is a
candidate, never a finding.** If you route a kinematic derivation to it, the output must land in a
docket for owner ratification, not into code. The whole quarantine list in §7 exists because that
boundary was crossed once already.

The audit itself is preserved in-repo at `docs/research/audits/progression-terra-2026-08-26/` —
25 files, SHA-256 manifest alongside. Read `AUDIT_REPORT.md` before assigning Antigravity anything
evidential.

---

## 4. Work decomposed into assignable units

Ordered by dependency. "Owner only" means no agent may decide it.

### U1 — Owner's on-device verification · **owner only** · blocks everything

Nothing pushes until this is done. What to check on the installed QA build:

| Case | Expected |
|---|---|
| Bodyweight push-up block | 8 reps; sets **4 → 5 → 5** across weeks 1-3; week 4 drops to 2 |
| Loaded block | sets flat at 4; RPE **7 → 7.5 → 8**; reps **not** forced to 8 |
| Volume-phase block | primaries carry strictly more sets than accessories |
| Weighted calisthenics | behaves as **loaded**, not bodyweight |

The last one is the sharpest test that routing keys on implement rather than movement name.

### U2 — Re-run `verify:ci` · **you, directly** · 5 minutes

It never completed during my session: it aborts in `scripts/verify-preflight.mjs` on missing
`node_modules` and embedder assets, **before typecheck and before any gate**. Both were resolved for
the device build, so it may now run for the first time. Do not assume the 15/15 individual-gate
result transfers — report what it actually says.

```
npm run verify:ci
```

### U3 — Suspension UI · **Hermes (precision coder)** · depends on U1

Migration 058, the store actions (`beginSuspension`, `endSuspension`, `activeSuspension`) and 26
gate assertions all exist. **Nothing calls them**, so the athlete cannot declare an episode. This is
the gap between a correct mechanism and a working feature.

Brief for Hermes: `docs/PROPOSAL_suspended_state_trigger.md`. **Answer its §3 open questions first** —
four of them, and they are design rulings, not code:

1. Does an in-flight block survive suspension — archive, resume mid-block, or regenerate?
2. What does `nextMacroPosition` return if suspension began before any block existed?
3. How does suspension interact with a dated competition horizon?
4. Is `frozen_macro_index` fixed at entry or recomputed at exit? (The proposal freezes at entry.)

Hard constraints for whoever codes it: entry and exit are **athlete-owned**; the app may *prompt*
after a halt or persistent niggle but must **never infer** — an automatic injury detector is a
diagnostic claim this project has no ratified authority to make. No auto-expiry, no maximum duration,
no severity threshold. Those are all new coefficients.

**Verify:** `npm run verify:store && npm run verify:migrations && npm run typecheck`

### U4 — Withdraw WO-04 · **you, directly** · 10 minutes

WO-04 proposes persisting e1RM to a new SQLite table and cites *Decision 1* as its authority.
Decision 1 was ratified **(a) dormant**, explicitly forbidding persistence, and
`apps/mobile/test/verify_store_sql.mjs:649` is a live removal guard asserting the surface stays
absent. Withdraw it, or re-scope it as a proposal to revisit Decision 1 — which is the owner's call,
not a work order's.

### U5 — Re-scope WO-02 · **you, directly** · 10 minutes

WO-02 states at HIGH confidence that the progression engine "is not wired into `useStore.ts`". It is
wired — imported at `:138`, called at `:2568` and `:2570`. A narrower session-completion UI gap may
survive; the priority should drop accordingly.

### U6 — WO-01, the dead `progression_methodology` column · **Hermes** · small, self-contained

Stored in `006_user_profile.sql`, typed, validated, hydrated — and read by **no planner**. It is a
second vocabulary competing with `schemaType`. One of the two should go. Genuine finding, cheap fix.

**Verify:** `npm run verify:store && npm run typecheck`

### U7 — Non-7-Day Micro-Cycle architecture · **owner-assigned to YOU** · the large one

Owner's title, verbatim:

> *Non-7-Day Micro-Cycle architecture implementation — 9-day, 12-day and 14-day micro-cycles
> implemented into the block generator, coaching engine and app.*

Scope as a **phase**, not a work order. `docs/PARKED_RR03_taper_and_microcycle_architecture.md`
carries the blast radius from source and the owner's periodization intent
(intensity block ~4 wk → peak 1-2 wk → taper → competition).

Natural decomposition for your loop:
- **Antigravity** — sprint planning and the cross-cutting impact map. This is genuinely what it is
  good at: `BLOCK_WEEKS = 4`, week-indexed `SCHEMA_WEEKS`, `week_index` CHECK domains, the autopilot's
  21-day window, session runner, calendar, and the gate asserting "exactly 4 weeks ending in deload"
  all move together.
- **Hermes** — the implementation, once the plan is ratified.
- **Owner** — every duration and percentage. None is ratified.

**Prerequisite for any taper work.** RR-03 stays parked; its figures stay quarantined (§7).

### U8 — Deferred maintenance · **Hermes**, low priority

- `verify_store_sql.mjs` `SCHEMA_FILES` was missing **057** before this session and still is. I added
  058 alone because it does not depend on 057; closing that gap has its own blast radius.
- The **P3-1 ledger capture-at-issue-time convention** is drafted and belongs in `AGENT_WORKFLOW.md`.
  Never applied.
- **RR-01's rationale** — Option A was signed on the basis that calisthenics "inherently produce
  lower systemic CNS fatigue", with **no source locator**. The ruling stands; the reason should not
  sit in a decision record as though it were evidence.

---

## 5. What must never be delegated

- **Any numeric value entering the engine.** Calibration Policy v1: owner ratification recorded
  against a source, every time. No agent may propose a number into code.
- **Any of the six ratified decisions**, or reopening one.
- **The push.** Not you, not a sub-agent. See §6.
- **Anything on the quarantine list** (§7).

---

## 6. Standing constraints

- **Push gate.** Never push until the owner has verified on-device. "Proceed" is not "push."
  Ruling 6(b) added a second edge: pushing publishes the audit archive's sixteen author-local paths
  to a **public** repository. The owner accepted that knowingly — but it makes the push irreversible
  in a way it was not before.
- **Prompt ledger protocol.** Every execution prompt's FIRST file operation appends a
  `PROMPT_LEDGER.md` entry carrying the **verbatim** input. Currently at **0053**, strictly
  append-only. This applies to your sub-agents' work too — the executor does not get to skip it.
- **Append-only migrations.** Shipped migrations are frozen. Head is **058**; next free slot is
  **059**.
- **The one pending coefficient.** `SCHEMA_FATIGUE_COST_BODYWEIGHT` is a deliberate **alias** of the
  loaded table, not a real table, because no bodyweight fatigue row is ratified. Docketed as open
  item 5 of `TRAINING_PROGRESSION_LAYERS.md` §8, with the exposure disclosed: a hybrid athlete on
  bodyweight LINEAR receives the week 2-3 set with no accessory-tax adjustment.

---

## 7. Quarantine list — may not enter code or any work order

e1RM MDC 11.1–33%; persistence windows 3-5 / 6-9 / 15-30 sessions; hard-set vs tonnage R² .68/.09;
Hackett 3.5±1.2; Pareja-Blanco −1.2% (contradicted: the abstract reports CMJ 9.5% vs 3.5%);
push-up 41/49/64/74%; Silva MDC values; Baumel mislabelled as "Mobile Health Apps"; the Davidson &
Barillas preprint tiered A; and the RR-03 taper figures — 50%, 30%, 60%, 40–60%, 41–60% — with their
unlocatable Bosquet/Mujika attributions.

---

## 8. Traps that will bite your sub-agents

- **Never junction a worktree's `node_modules` to the main checkout.** Main's `node_modules/@ak/*`
  symlink back to **master's** source, so a junction silently builds master's code and **reports
  success**. `npm ci` inside the worktree links `@ak/*` correctly. `babel.config.js` already anchors
  its aliases to `__dirname` for exactly this class of reason and says so in a comment — someone hit
  this before, at the Babel layer. The `node_modules` layer can still bite.
- **Embedder assets** are gitignored and absent from a fresh worktree. Copy `model_quantized.onnx`
  and `tokenizer.full.json` from the main checkout rather than re-fetching.
- **Two pinned migration counts** fire on every new migration — `verify_migrations.mjs` and
  `verify_pipeline.mjs`. They exist so adding one is a conscious act. **Re-pin, never loosen.**
- **Gradle needs JDK 21**, not the system Java 26:
  `JAVA_HOME="C:/Program Files/Android/openjdk/jdk-21.0.8"`.
- **Device build that works:** `cd apps/mobile/android && JAVA_HOME=<jdk21> ./gradlew installQa`.
  6m15s warm. The QA variant is non-debuggable with JS bundled — no Metro, no adb tunnel, no cable.
- **A gate failing after a change is not automatically a gate to fix.** Three times this session a
  pre-existing gate correctly caught my change, and twice my own new assertion was the thing that was
  wrong. Default to fixing the assertion or the code — not to loosening the gate.

---

## 9. Questions I need answered

1. **Where is `tools/hermes_executor.py`?** It is absent from this worktree and from `master`. Your
   loop's step 3 cannot run without it. Does it live outside the repository, is it yet to be written,
   or has the invocation changed?
2. **Which tree do you work in?** I am on `codex/progression-evidence-remediation` with 12 unpushed
   commits; `master` is 62 behind. Do you continue in this worktree, or is the branch merged first?
   If a sub-agent runs in the wrong tree, §8's first trap applies at full force.
3. **Does the ledger protocol bind your sub-agents?** I have assumed yes — that a Hermes-authored
   change still needs its `PROMPT_LEDGER.md` entry with the verbatim prompt. If the executor writes
   into `tools/temp_hermes_output.ts` and you overwrite the main file, **who owns the ledger entry:
   you as dispatcher, or the executor?** The protocol is silent on delegated work.
4. **Antigravity's numeric output — do you want it firewalled by default?** Given §3, my
   recommendation is that any figure it derives lands in a docket for ratification and never in a
   diff. Confirm that is your posture, or tell me the rule you would rather apply.
5. **Can you run the device build, or is that owner-only?** I built and installed with the owner
   present and asking. If verification builds are yours to run, U1 becomes a much shorter loop.
6. **U3's four open questions (§4) — who answers them?** They are design rulings, not code. If they
   go to the owner, that is a blocking dependency for the suspension UI and should be raised before
   you dispatch it.

---

## 10. Where my judgement is recorded

Every ruling, its reasoning, and what it deliberately does **not** assert is in the two decision
documents. Ledger entries 0042–0053 carry the verbatim prompts and full outputs, including the
corrections — three of my own test assertions were wrong and were fixed rather than the code, my
initial scoping of the LINEAR fix was wrong on two counts, and my "the engine can only reduce" claim
was wrong and is corrected in `docs/BRIEF_progression_control_safety.md` §2.1. Those are recorded
rather than tidied away, deliberately: an orchestrator inheriting this needs to know which of my
conclusions were revised and why.
