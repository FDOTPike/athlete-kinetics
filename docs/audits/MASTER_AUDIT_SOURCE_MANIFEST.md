# Master audit source manifest

## 0. Manifest Control

### 0.1 Purpose and Binding Scope

This manifest is the source-authority register for `MASTER_AUDIT_SYNTHESIS.md`. **Every source path
cited in that report maps to a source record here.** The report cites paths, revisions and hashes in
the three citation forms the governing work order §5.2 permits; it does not print `source_id`
tokens, and this manifest does not claim it does. A source's tier fixes what it may be used for;
§2.2 of `docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md` forbids a T3, T4 or T5 source from
originating an outstanding-work item.

- **Compiled:** 2026-08-30, Australia/Sydney.
- **Compiled by:** Claude Code Opus as `DOCUMENT_EXECUTOR`, under work order W1.
- **Audit worktree:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\progression-evidence-remediation`.
- **State A commit:** `48719b07988ad30d255b0fed37f45ed5db49c935`.
- **State C commit:** `34f91ffe548a0b9e51db863ffc6fad993619f940` on branch `claude/rc-48719b0`.

### 0.2 Line-Count Convention

Every `line_count` in this manifest is the count of lines including a final line that lacks a
trailing newline, computed as `awk 'END{print NR}'` over the exact blob or working-tree file named
in the same row. This convention is stated because the superseded synthesis used a different,
undeclared convention and consequently cited nine whole-document spans one line beyond the end of
the file (see `MASTER_AUDIT_SYNTHESIS.md` §6.1 and §5.2 record `RC-02`).

Where a source is a Git blob, `revision_or_sha256` is the abbreviated blob object name at the stated
commit, which is stable and content-addressed. Where a source is an untracked working-tree file, it
is the SHA-256 of the file's bytes at the capture time recorded in §0.3.

### 0.3 Mutable-Input Capture

Untracked files are mutable. Every untracked source in this manifest was hashed in a single capture
pass at **2026-08-30**, with sources added later — `S-T0-09` and the two `S-OUT-*` outputs — hashed
on **2026-08-31**, both from the worktree named in §0.1, with `git status --short --branch`
reporting branch `codex/progression-evidence-remediation` and no staged changes. A later edit to any
untracked source invalidates its row and every synthesis claim that cites it.

## 1. Discovery Rule and Totals

### 1.1 Discovery Commands

The corpus was enumerated by these exact commands. No file entered the manifest by any other means,
and no directory was traversed outside the audit worktree except the single external source in §5.

```text
# Corpus A - tracked documentary sources at State A
git ls-tree -r --name-only 48719b07988ad30d255b0fed37f45ed5db49c935 \
  | grep -E '(^|/)(AUDIT_|HANDOVER_|DEVIATION_LOG|QUARANTINE_|RELEASE_READINESS|PROPOSAL_|PARKED_|BRIEF_|CHIEF_)|/decisions/|/audits/' \
  | grep -E '\.md$'

# Corpus B - untracked working-tree Markdown outside .agents/
git ls-files --others --exclude-standard | grep -E '\.md$' | grep -v '^\.agents/'

# Corpus C - untracked generated teamwork artifacts
git ls-files --others --exclude-standard | grep -E '^\.agents/.*\.md$'

# Corpus D - DOCUMENTS changed on the State C branch. The unfiltered diff returns 16
# changed files of every kind; the Markdown filter is what yields the declared count of 2.
git diff --name-only 48719b07988ad30d255b0fed37f45ed5db49c935..34f91ffe548a0b9e51db863ffc6fad993619f940   | grep -E '\.md$'

# Corpus E - external reference, parent checkout root only
ls "C:/Users/fpike/Documents/Claude Coding/Athlete App/KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md"
```

### 1.2 Reproducible Totals

| Corpus | Rule | Boundary | Count | Notes |
|---|---|---|---|---|
| A | Corpus A command | Worktree, tracked at State A | 62 | Of 117 total tracked `.md` files at State A |
| B | Corpus B command | Worktree, untracked | 9 | Re-counted 2026-08-31 at the GLM-5.3 remediation freeze. The 6 original files — `AGENTS.md`, `CLAUDE.md`, `MASTER_AUDIT_SYNTHESIS.md`, `docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md`, and this task's own two outputs — plus 3 files the continuation package created before the manifest's final edit: `AGENTS.override.md`, `docs/WORKORDER_GLM53_AUDIT_SYNTHESIS_CONTINUATION.md`, `docs/hermes-glm53-audit-closeout/SOUL.md` |
| C | Corpus C command | Worktree, untracked | 213 | Re-counted 2026-08-31 at the GLM-5.3 remediation freeze. Grew from 115 (2026-08-30 capture, 29 agent directories) because the teamwork system re-ran and generated further `.agents/` Markdown. All Corpus C content remains T3, admissible as verification history only |
| D | Corpus D command | Branch `claude/rc-48719b0` | 2 | 16 files changed in total across the four commits; **2** are Markdown documents: `PROMPT_LEDGER.md`, `docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md`. The other 14 are code, tests and schema, registered at T4 in §4.2. |
| E | Corpus E command | Parent checkout root, outside audit boundary | 1 | Untracked in the parent checkout as well |

### 1.3 Declared Exclusions

The word "complete" is used in this manifest only against the §1.1 rules and this exclusion list. It
is not a claim that the repository contains nothing else.

- `find .agents -type f -name '*.md'` returns **214** files, one more than Corpus C (213 at the
  GLM-5.3 freeze). The difference
  is `.agents/rules/coding-rules-general.md`, which `--exclude-standard` filters as gitignored. It
  is excluded from the manifest and from every total above.
- Tracked `.md` files that do not match the Corpus A pattern (55 of 117 at State A) are excluded:
  READMEs, phase notes, work orders, and research inputs that no synthesis claim cites.
- Non-Markdown sources — SQL migrations, TypeScript, `.mjs` gates, `package.json` — are T4 and are
  enumerated per-claim in §4 rather than swept, because §2.3 of the work order forbids a general
  codebase scan.
- Build outputs, `node_modules`, Android intermediates and gitignored model assets are excluded
  entirely. `git ls-files --others --ignored` emits path-length warnings on this Windows checkout and
  was not used as a discovery mechanism.
- Every other Git worktree listed by `git worktree list` is out of boundary. Only State C is read,
  and only at commit `34f91ff` via `git show`, never from that worktree's filesystem.

## 2. Tier T0 — Owner Instructions, Ratified Decisions, Governing Mandate

| source_id | path | tier | boundary | tracked_status | revision_or_sha256 | line_count | source_date | included_sections | admissible_for_open_work |
|---|---|---|---|---|---|---|---|---|---|
| `S-T0-01` | `docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md` | T0 | Branch `claude/rc-48719b0` | Tracked at `a80f955` | blob `af83e8560b66` @ `a80f955b0d76625587023536bcc260f6d80bc2a2` | 479 | 2026-08-29 | §3 blocking rulings; §5 corrections; §6 owner ruling record; §7 close state | Yes |
| `S-T0-02` | `CHIEF_ORCHESTRATOR_MANDATE_SOL.md` | T0 | Worktree, State A | Tracked | blob `e149ade84496` @ `48719b0` | 197 | 2026-08-27 | §2 invariants; §3 ratification firewall; §4 loop; §5 gate discipline; §8 stop conditions | Yes |
| `S-T0-03` | `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` | T0 | Worktree, State A | Tracked | blob `991adf46d545` @ `48719b0` | 275 | 2026-08-27 | Decisions 1–6 and their ratification records | Yes |
| `S-T0-04` | `docs/decisions/CALIBRATION_POLICY_V1.md` | T0 | Worktree, State A | Tracked | blob `e6373ff9f5fe` @ `48719b0` | 109 | 2026-08-15 | ACWR authority; 21-day return check-in; frozen coefficient registry | Yes |
| `S-T0-05` | `docs/decisions/TRAINING_PROGRESSION_LAYERS.md` | T0 | Worktree, State A | Tracked | blob `40a79bba1de3` @ `48719b0` | 342 | 2026-08-27 | §7 unratified list; §8 Settled and Open registers | Yes |
| `S-T0-06` | `PROMPT_LEDGER.md` | T0 | Branch `claude/rc-48719b0` | Tracked at `34f91ff` | blob `3fd1e236fb51` @ `34f91ffe548a0b9e51db863ffc6fad993619f940` | 3139 | 2026-08-29 | Entry 0057, the claimed C0–C5 result | Yes |
| `S-T0-07` | `CLAUDE.md` | T0 | Worktree, untracked | Untracked | SHA-256 `d1b7cdd54e2efb5746f247ed95209d6f7120c0993e796623217452be10e9c8ce` | 183 | 2026-08-30 | §5 product invariants; §6 ratification and release firewall | Yes, for execution rules only |
| `S-T0-08` | `docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md` | T0 | Worktree, untracked | Untracked | SHA-256 `687617d9e6dfa7222d6cfd85fc25978caa92303109031ac0ed771bec2d20f2ec` | 550 | 2026-08-31, re-hashed unchanged from the 2026-08-30 capture; §4 citations use the later date | Whole document; governs this task | Yes, for scope only |
| `S-T0-09` | `AGENTS.md` | T0 | Worktree, untracked | Untracked | SHA-256 `1fa93413922a454e7b4ddd23a8dbb39c3f49460422b3ca545d5faf5cc5773063` | 183 | 2026-08-31 | Codex execution contract; the counterpart of `CLAUDE.md`. Registered for corpus completeness; outside this task's write boundary and cited by no ledger row | Yes, for execution rules only |

## 3. Tier T1 — Tracked Historical Audits and Handovers at State A

Every row is read at commit `48719b07988ad30d255b0fed37f45ed5db49c935`.

| source_id | path | tier | boundary | tracked_status | revision_or_sha256 | line_count | source_date | included_sections | admissible_for_open_work |
|---|---|---|---|---|---|---|---|---|---|
| `S-T1-01` | `HANDOVER_2026-08-27_SOL.md` | T1 | Worktree, State A | Tracked | blob `0b40508c3d18` | 268 | 2026-08-27 | §4 units U1–U8; §5 non-delegable; §6 standing constraints; §7 quarantine; §8 traps | Yes |
| `S-T1-02` | `docs/AUDIT_architecture_review_8b4e75b.md` | T1 | Worktree, State A | Tracked | blob `486724f1d340` | 218 | 2026-08-27 | RR-01…RR-04 rulings; §6 ladder defect; §7 WO-02/WO-04 findings | Yes |
| `S-T1-03` | `DEVIATION_LOG.md` | T1 | Worktree, State A | Tracked | blob `4cdbd3fc45a0` | 605 | 2026-08-15 | Whole deviation register, Phases 8–18 and Autopilot R1/R2/C1–C6B | Yes |
| `S-T1-04` | `RELEASE_READINESS.md` | T1 | Worktree, State A | Tracked | blob `3367feaa1b3b` | 118 | 2026-08-25 | §A device readiness; §B store accounts; §C compliance paperwork | Yes |
| `S-T1-05` | `AUDIT_REPORT.md` | T1 | Worktree, State A | Tracked | blob `4a3ca29f94bd` | 137 | 2026-07-16 | Source sweep; migration self-heal; autopilot invariants; tokenizer parity | Yes |
| `S-T1-06` | `docs/research/audits/progression-terra-2026-08-26/AUDIT_REPORT.md` | T1 | Worktree, State A | Tracked | blob `5e4e33dddbfc` | 55 | 2026-08-26 | Claim adjudication; quarantine determinations | Yes |
| `S-T1-07` | `docs/AUDIT_C6B_2026-07-30.md` | T1 | Worktree, State A | Tracked | blob `896dc146c6ca` | 82 | 2026-07-31 | C6B ratification and the classifier-boundary restatement | Yes |
| `S-T1-08` | `docs/PROPOSAL_suspended_state_trigger.md` | T1 | Worktree, State A | Tracked | blob `b02804bf65f0` | 138 | 2026-08-27 | §2 model sketch; §3 open questions | Yes |
| `S-T1-09` | `docs/PARKED_RR03_taper_and_microcycle_architecture.md` | T1 | Worktree, State A | Tracked | blob `19e30817830d` | 130 | 2026-08-27 | Parked status; discarded figures; blast radius | Yes |
| `S-T1-10` | `docs/BRIEF_progression_control_safety.md` | T1 | Worktree, State A | Tracked | blob `bdf5cf5fc66a` | 248 | 2026-08-27 | Plan-only status under Decision 4 | Yes |
| `S-T1-11` | `HANDOVER_2026-08-14_FINAL_AUDIT_RPE_CORRECTION.md` | T1 | Worktree, State A | Tracked | blob `589bb2054385` | 71 | 2026-08-14 | Authored-peak RPE capping correction | Yes |
| `S-T1-12` | `HANDOVER_2026-08-13_BOUNDED_MICROCYCLE_AUDIT_REMEDIATION.md` | T1 | Worktree, State A | Tracked | blob `765958fe97fe` | 239 | 2026-08-14 | Dose-neutral purpose assignment; Migration 053 | Yes |
| `S-T1-13` | `HANDOVER_2026-08-13_ROUTINE_CONTRACT_CUTOFF.md` | T1 | Worktree, State A | Tracked | blob `b16c6ec8dc51` | 159 | 2026-08-13 | Migration 054 singleton cutoff and sentinel repair | Yes |
| `S-T1-14` | `QUARANTINE_TRIAGE_2026-07-14.md` | T1 | Worktree, State A | Tracked | blob `e7b1c579e6c6` | 264 | 2026-07-14 | Quarantine triage record | Yes |
| `S-T1-15` | `docs/AUDIT_C5_R1_2026-07-30.md` | T1 | Worktree, State A | Tracked | blob `7145ab0fadf9` | 146 | 2026-07-31 | R1 authority budget | Yes |
| `S-T1-16` | `docs/AUDIT_C6_R2_2026-07-30.md` | T1 | Worktree, State A | Tracked | blob `3c462bb672fc` | 141 | 2026-07-31 | R2 phase-local observer | Yes |

## 4. Tiers T2 and T4 — Branch Documents and Verification Sources

### 4.1 T2 — Exact-Revision Branch Documents

T2 covers **branch documents only**. Runtime code, tests and schemas are T4 wherever they live —
branch location does not raise an artifact's tier. A previous revision of this manifest placed seven
State C code, test and schema blobs in T2 and marked them eligible to originate outstanding work.
That was wrong, it contradicted work-order §2.1, and it is corrected here: all seven now appear in
§4.2 as T4 corroboration.

**This tier currently has no rows.** The two documents introduced on branch `claude/rc-48719b0` —
`docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md` and `PROMPT_LEDGER.md` — are both listed at T0
(`S-T0-01`, `S-T0-06`) because a ratified owner decision record and a prompt-ledger entry carry the
higher authority, and each source takes exactly one tier. T2 is retained as a defined tier so that a
future branch document with no T0 authority has a correct home.

### 4.2 T4 — Runtime, Test, Schema and Metadata Sources

Every row below may **verify or corroborate** a claim that an admissible T0/T1/T2 source already
states. **No T4 row may originate an outstanding-work item.** The State C rows are the corroboration for
`OW-001`–`OW-007` and `OW-036`, whose origin is work-order §3.5 (T0) — or, for `OW-036`, the T1
architecture-review audit and the T0 docket ruling that state the ladder floor — plus the completed
W2 admission gate in `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`.

| source_id | path | tier | boundary | revision | line_count | included_sections |
|---|---|---|---|---|---|---|
| `S-T4-01` | `tools/memory-audit/memory_gate.mjs` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 56–61, the ratified memory constants |
| `S-T4-02` | `tools/memory-audit/audit.mjs` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 173–175, the gate's own contract text |
| `S-T4-03` | `apps/mobile/test/verify_store_sql.mjs` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 20–51 `SCHEMA_FILES`; line 689 e1RM removal guard |
| `S-T4-04` | `package.json` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 37–48, the gate topology |
| `S-T4-05` | Git metadata | T4 | Repository | n/a | n/a | `rev-parse`, `ls-tree`, `cat-file`, `show`, `diff`, `worktree list` |
| `S-T4-06` | `tools/memory-audit/budget.json` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 40–43, the ratification creating the review band and the 471,936,000 B modelled envelope |
| `S-T4-07` | `packages/inference/src/blockGenerator.ts` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Lines 804–817, owner-ratified 2026-08-27 markers for Option C routing and RR-04 |
| `S-T4-08` | `packages/core-db/src/schema/016_movement_library_seed.sql` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | Line 281, `('Push-up', 'handstand-push-up', 0)` — the chain entry rung. A previous revision registered this against `032_capability_content.sql:281`, which is a different file whose line 281 is a recursive-CTE projection; corrected after two independent reviewers found it. |
| `S-T4-16` | `packages/inference/test/verify_pipeline.mjs` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | — | Lines 511–520, the second pinned migration count re-pinned 57 to 58 |
| `S-T4-17` | `packages/inference/src/progressionEngine.ts` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | — | `DEFAULT_ADVANCEMENT_POLICY.requiredReps`, the imported bar `bodyweightRepsFor` falls back to |
| `S-T4-09` | `packages/core-db/src/schema/059_suspension_state_and_load_intent.sql` | T4 | Branch `claude/rc-48719b0` | `f3ebab38c703c549ca20b9bd972be915eb6dd84b` | 160 | Whole migration; three tables and four triggers |
| `S-T4-10` | `apps/mobile/src/state/useStore.ts` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 6322 | `plannedImplementFor`; suspension lifecycle; `PER_ATHLETE_RESET`; `resetTrainingData` |
| `S-T4-11` | `packages/inference/src/blockGenerator.ts` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 953 | `isPurelyBodyweight`; `schemaFatigueCost`; `bodyweightDominant`; the set ramp and chain rep floor |
| `S-T4-12` | `apps/mobile/src/screens/BlockScreen.tsx` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 1619 | Inline suspension entry and resume flow |
| `S-T4-13` | `apps/mobile/test/components/SuspensionLifecycle.test.js` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 393 | L1(a) store assertions |
| `S-T4-14` | `packages/core-db/test/verify_migrations.mjs` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 1997 | Pinned count; `[058]` section; absence of a `[059]` section |
| `S-T4-15` | `packages/core-db/src/migrationRunner.ts` | T4 | Branch `claude/rc-48719b0` | `34f91ffe548a0b9e51db863ffc6fad993619f940` | 283 | Sentinel registrations, lines 183–196 |
| `S-T4-18` | `apps/mobile/src/components/SuspensionSheet.tsx` | T4 | Worktree, State B snapshot | `cb65064b7d73fb1b794b24818c54e6181755f7a729944631cf4497c9218e7b4d` | 138 | Lines 1–25, sheet header, sub-view back handler, and reason chips |
| `S-T4-19` | `apps/mobile/src/components/SuspensionCard.tsx` | T4 | Worktree, State B snapshot | `77d798e6c9631df1f8f5fcf44004237f02a348df479adb83a14ac0c98473e999` | 148 | Lines 1–21, card header, resume callback, and status display |
| `S-T4-20` | `apps/mobile/src/state/useStore.ts` | T4 | Worktree, State B snapshot | `fa5616973d75de7d150d3e97843e27eb7f6b6797a23fbd131603f4a9e244ee5c` | 6216 | Lines 2610–2652, refreshSuspension, beginSuspension, and resumeTraining actions |
| `S-T4-21` | `apps/mobile/src/theme/theme.ts` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | 50 | Lines 22, 42, theme warning token `#EFC94C` and touch target minimum `56pt` |
| `S-T4-22` | `packages/core-db/src/schema/058_suspension_episode.sql` | T4 | Worktree, State A | `48719b07988ad30d255b0fed37f45ed5db49c935` | 94 | Lines 49–88, suspension episode schema, partial unique index, and fail-closed triggers |

### 4.3 T3 — Generated Teamwork Artifacts

Corpus C in full is T3. It is admissible as verification history only. The rows below are the T3
files the synthesis names; the remainder are covered by the Corpus C total and are not cited.

| source_id | path | boundary | SHA-256 (first 16) | line_count | source_date | admissible_for_open_work |
|---|---|---|---|---|---|---|
| `S-T3-01` | `.agents/ORIGINAL_REQUEST.md` | Worktree, untracked | `beee942309851bf9` | 30 | 2026-08-30 | No |
| `S-T3-02` | `.agents/AUDIT_REPORT.md` | Worktree, untracked | `8ae6a34d05c25cd0` | 163 | 2026-08-30 | No |
| `S-T3-03` | `.agents/sentinel/handoff.md` | Worktree, untracked | `ce00b20479679916` | 23 | 2026-08-30 | No |
| `S-T3-04` | `.agents/teamwork_preview_victory_auditor_1/handoff.md` | Worktree, untracked | `1180df160beaddf9` | 80 | 2026-08-30 | No |
| `S-T3-05` | `.agents/orchestrator/GATE_STATUS.md` | Worktree, untracked | `9a3f2a58c729cf6c` | 25 | 2026-08-30 | No |
| `S-T3-06` | `.agents/teamwork_preview_auditor_1/handoff.md` | Worktree, untracked | `50d4f1ebce90517d` | 165 | 2026-08-30 | No |
| `S-T3-07` | `MASTER_AUDIT_SYNTHESIS.md`, superseded revision 1 — **an unavailable historical fingerprint, not a re-readable file** | Worktree, untracked at capture; since overwritten in place | `bf3f4961d62990b66cb32558964fb815ba17e9ff9cf510f2523e9cc5c556521b` | 397 | 2026-08-30 | No |
| `S-T3-08` | `.agents/audit-synthesis-remediation/round-2-reviewer-a.txt` | Worktree, untracked | `af4026fbd2150f6b` | 199 | 2026-08-31 | No |
| `S-T3-09` | `.agents/audit-synthesis-remediation/round-2-reviewer-b.txt` | Worktree, untracked | `ca790dc24d54725e` | 182 | 2026-08-31 | No |
| `S-T3-10` | `.agents/audit-synthesis-remediation/round-3-reviewer-a.txt` | Worktree, untracked | `38cbfaa73a6708ea` | 161 | 2026-08-31 | No |
| `S-T3-11` | `.agents/audit-synthesis-remediation/round-3-reviewer-b.txt` | Worktree, untracked | `cc9b90e70cf0f695` | 185 | 2026-08-31 | No |
| `S-T3-12` | `.agents/audit-synthesis-remediation/round-4-reviewer-a.txt` | Worktree, untracked | `06f48d477a2efed6` | 177 | 2026-08-31 | No |
| `S-T3-13` | `.agents/audit-synthesis-remediation/round-4-reviewer-b.txt` | Worktree, untracked | `c5a8251bf60caed9` | 110 | 2026-08-31 | No |
| `S-T3-14` | `.agents/audit-synthesis-remediation/round-5-reviewer-a.txt` | Worktree, untracked | `fe262ce07cd11b95` | 28 | 2026-08-31 | No |
| `S-T3-15` | `.agents/audit-synthesis-remediation/round-5-reviewer-b.txt` | Worktree, untracked | `1da4412e0fb4de39` | 24 | 2026-08-31 | No |
| `S-T3-16` | `.agents/audit-synthesis-remediation/round-6-reviewer-a.txt` | Worktree, untracked | `f1153942b5e431c9` | 115 | 2026-08-31 | No |
| `S-T3-17` | `.agents/audit-synthesis-remediation/round-6-reviewer-b.txt` | Worktree, untracked | `411b324d3f754672` | 104 | 2026-08-31 | No |
| `S-T3-18` | `.agents/audit-synthesis-remediation/round-7-reviewer-a.txt` | Worktree, untracked | `9c391b23aba025ed` | 47 | 2026-08-31 | No |
| `S-T3-19` | `.agents/audit-synthesis-remediation/round-7-reviewer-b.txt` | Worktree, untracked | `d52481ceb54b144c` | 58 | 2026-08-31 | No |
| `S-T3-20` | `.agents/audit-synthesis-remediation/round-8-reviewer-b.txt` | Worktree, untracked | `cd1a7ccce0aac52b` | 53 | 2026-08-31 | No |
| `S-T3-21` | `.agents/audit-synthesis-remediation/round-9-reviewer-a.txt` | Worktree, untracked | `e4f4793371a9caa0` | 53 | 2026-08-31 | No |
| `S-T3-22` | `.agents/audit-synthesis-remediation/round-9-reviewer-b.txt` | Worktree, untracked | `fd6f2de358d89f7d` | 56 | 2026-08-31 | No |
| `S-T3-23` | `.agents/audit-synthesis-remediation/round-10-reviewer-a.txt` | Worktree, untracked | `c963f95d7da9ea7e` | 67 | 2026-08-31 | No |
| `S-T3-24` | `.agents/audit-synthesis-remediation/round-10-reviewer-b.txt` | Worktree, untracked | `6062c4a2d968ca4e` | 56 | 2026-08-31 | No |
| `S-T3-25` | `.agents/audit-synthesis-remediation/round-11-reviewer-a.txt` | Worktree, untracked | `79c5772e14063388` | 51 | 2026-08-31 | No |
| `S-T3-26` | `.agents/audit-synthesis-remediation/round-11-reviewer-b.txt` | Worktree, untracked | `4764da7e294e83b1` | 55 | 2026-08-31 | No |
| `S-T3-27` | `.agents/audit-synthesis-remediation/round-12-reviewer-a.txt` | Worktree, untracked | `657e0cde6154c355` | 50 | 2026-08-31 | No |
| `S-T3-28` | `.agents/audit-synthesis-remediation/round-12-reviewer-b.txt` | Worktree, untracked | `22bc26befe469396` | 51 | 2026-08-31 | No |

Encoding note: `S-T3-14` and `S-T3-15` (the Round 5 handoffs) are cp1252-encoded files, not UTF-8;
their SHA-256 values are computed over the raw bytes, which is what the synthesis cites. They are
preserved byte-for-byte as verbatim artifacts and are not re-encoded.

This task's own two outputs are recorded for completeness of the Corpus B count.

`S-OUT-02` needs its role stated precisely, because it is the only output that participates in
admission. **It does not invent findings.** Work-order §3.5 (T0) pre-documents exactly five findings
and forbids discovering others; the addendum is the mandated confirmation gate that records each as
`CONFIRMED`, `PARTIALLY_CONFIRMED` or `REFUTED`. A finding may enter the ledger only if the T0 work
order named it **and** the addendum recorded it open. Origin is therefore T0; the addendum is the
gate, and the State C code at `S-T4-09`–`S-T4-15` is corroboration.

| source_id | path | tier | boundary | SHA-256 | line_count | source_date | admissible_for_open_work |
|---|---|---|---|---|---|---|---|
| `S-OUT-01` | `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` | n/a — output | Worktree, untracked | self-referential; see §6.4 | 343 after the State C release-readiness rebuild (342 after the GLM-5.3 Round-12 closeout edit; 340 at Round 12; 322 at the pre-continuation issue) | 2026-08-31 | No |
| `S-OUT-02` | `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` | n/a — output | Worktree, untracked | recorded in §6.4 after the final edit | recorded in §6.4 | 2026-08-31 | Gate only, not an origin |
| `S-OUT-03` | `docs/audits/state-c-release-readiness/LEDGER_LINEAGE_CROSSWALK.md` | n/a — output | Worktree, untracked | SHA-256 `c73354c8ef244abac72c6599da9c3ae954178ce4ad58f97a5b3ae5ba974fb959` | 48 | 2026-08-31 | Namespace map for the closed `OW-024`; a coordination artifact, not an origin |

## 5. Tier T5 — External References

`S-T5-01` lies outside the audit worktree. It is recorded here so that no synthesis claim can reach
it silently through parent-directory fallback resolution, which the work order §1.4 prohibits.

| source_id | path | tier | boundary | tracked_status | SHA-256 | line_count | source_date | admissible_for_open_work |
|---|---|---|---|---|---|---|---|---|
| `S-T5-01` | `C:\Users\fpike\Documents\Claude Coding\Athlete App\KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md` | T5 | Parent checkout root, outside the audit worktree | Untracked in the parent checkout | `6a7be0f8f6d0d1119765b7d3b100537c5aad2e4e47f0f37b39c0025fbabf17f8` | 443 | Captured 2026-08-30 | No |

The superseded synthesis cited this file three times as though it were an in-worktree repository
document. It does not exist in the audit worktree at any revision:
`git ls-tree -r --name-only 48719b0 | grep -i kinestrike` returns nothing, and
`ls KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md` in the audit worktree returns
`No such file or directory`.

## 6. Admissibility Summary

### 6.1 Totals by Tier

Counted from the rows in this manifest, not restated from a previous revision. **79 source records**
name **76 distinct paths**: `packages/inference/src/blockGenerator.ts` is recorded twice, once at
State A (`S-T4-07`) and once at State C (`S-T4-11`); `apps/mobile/src/state/useStore.ts` is recorded
twice, once at State C (`S-T4-10`) and once at State B (`S-T4-20`); and `S-T4-05` is Git metadata,
which has no path at all. 79 records minus two duplicated paths minus one pathless record is 76.

| Tier | Source records | May originate an outstanding-work item | May corroborate |
|---|---|---|---|
| T0 | 9 | Yes | Yes |
| T1 | 16 | Yes | Yes |
| T2 | 0 | Yes, if any existed | Yes |
| T3 | 28 named. **6** are Corpus C paths under `.agents/`; **21** are out-of-corpus `.txt` review handoffs under `.agents/audit-synthesis-remediation/` (Rounds 2–4, 5, 6, 7, 8-B, 9, 10, 11 and 12); `S-T3-07` is the superseded revision 1 of the synthesis, a Corpus B path at the repository root | No | Yes |
| T4 | 22 | **No** | Yes |
| T5 | 1 | **No** | Yes, labelled external |
| Outputs of this task (`S-OUT-*`) | 3 | **No** — `S-OUT-02` is an admission gate, not an origin; `S-OUT-03` is a coordination artifact | Yes |
| **Total** | **79** | — | — |

T2 has no rows: both State C branch documents carry higher T0 authority and each source takes exactly
one tier. See §4.1.

### 6.2 Totals by Boundary

| Boundary | Source records | Population under the §1.1 rule |
|---|---|---|
| Worktree, tracked at State A | 30 | 62 Markdown files match Corpus A, of 117 tracked Markdown |
| Worktree, untracked, outside `.agents/` | 10 | 6 Corpus B Markdown with records (`S-T0-07`, `S-T0-08`, `S-T0-09`, `S-T3-07`, `S-OUT-01`, `S-OUT-02`) + 3 State B code/components (`S-T4-18`, `S-T4-19`, `S-T4-20`) + 1 State C crosswalk output (`S-OUT-03`) |
| Worktree, untracked, under `.agents/` | 27 | 213 (Corpus C Markdown, re-counted; mutable T3 corpus) + 21 `.txt` review handoffs (Rounds 2–4, 5, 6, 7, 8-B, 9, 10, 11 and 12) |
| Branch `claude/rc-48719b0` at an exact commit | 10 | 16 files changed, of which 2 are Markdown documents (Corpus D) |
| Repository metadata, no single path | 1 | n/a — `S-T4-05` |
| Outside the audit worktree | 1 | 1 (Corpus E) |
| **Total** | **79** | — |

Source records exceed the Markdown populations because Corpus A–E enumerate **documents**, while the
manifest also registers the non-Markdown code, test, schema and metadata sources used as T4
corroboration. The two counts measure different things and are not expected to match.


### 6.3 Substantively Synthesized Historical Documents

Work-order §7.1 requires at least five distinct T0–T2 historical audit or handover documents to be
synthesized substantively rather than listed. The synthesis meets this with nine: `S-T0-01`,
`S-T0-02`, `S-T0-03`, `S-T0-05`, `S-T1-01`, `S-T1-02`, `S-T1-03`, `S-T1-04`, and `S-T1-06`. Each is
quoted or paraphrased against a specific line span in `MASTER_AUDIT_SYNTHESIS.md` §2 or §3, not
merely enumerated in a catalog.

### 6.4 Final Candidate Hashes and Known Limitations

**Stable hashes of the audited package**, recorded after the final content edit to each file:

| Artifact | Lines | SHA-256 |
|---|---:|---|
| `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` | 484 | `9377394e9cb473cae76506a3e3ad12b6efbf015feed43dce5dcf0b35632fc155` |
| `MASTER_AUDIT_SYNTHESIS.md` | recorded in `PROMPT_LEDGER.md` Entry 0063 on completion of the GLM-5.3 continuation (Entries 0061 and 0062 hold the earlier 992-line `85a192a…` and 1007-line `e1a9374…` revisions) | recorded in `PROMPT_LEDGER.md` Entry 0063 |
| `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md` | recorded in `PROMPT_LEDGER.md` Entry 0063 on completion of the GLM-5.3 continuation (Entry 0059 holds the pre-continuation revision) | recorded in `PROMPT_LEDGER.md` Entry 0063 |

**Why this manifest cannot embed its own hash.** A file's SHA-256 is computed over its bytes, so
writing that hash into the file changes the bytes and invalidates the value just written. There is
no fixed point. The manifest's own final hash, and the synthesis's, are therefore recorded in the
append-only ledger entry that closes this task, which is written after both files reach their final
state. The addendum's hash *can* appear here because this manifest is a different file from the
addendum, and the addendum was finalized first.

**Ordering that makes the citations stable.** The addendum was finalized before the synthesis, so the
synthesis can cite the addendum by exact hash. Nothing cites this manifest by hash, and this manifest
cites nothing by its own hash, so no cycle exists.

### 6.5 Known Manifest Limitations

- Line counts are recorded as `—` for the State A `S-T4-01`–`S-T4-08` rows, which are cited by named
  line span rather than as whole documents; their spans are bounds-checked at the revision in the
  row. The State C rows `S-T4-09`–`S-T4-15` carry whole-file line counts because the synthesis cites
  several spans in each.
- `S-T4-05` is repository metadata rather than a file, so it has no path, revision or line count.
  It is registered because Git command output is a T4 verification source under work-order §2.1.
- `S-T0-06` line count is the ledger's length on the State C branch, which diverges from the audit
  worktree's ledger. The two lineages have different ledgers; `S-T0-01` §5.1 records that divergence
  and states it must be reconciled before any merge.
- Every T3 row is mutable and unversioned. If the teamwork system re-runs, these hashes change and
  the corresponding verification-history entries in the synthesis become unverifiable.
- `S-T3-07` records a fingerprint of a file that no longer exists in that form. Superseded revision 1
  of the synthesis was overwritten in place, so its hash cannot be re-derived from this worktree and
  no third party can independently audit the revision-1 to revision-3 reclassification without it
  being restored from elsewhere.
- Reviewer handoffs produced under this task are persisted as `.txt` under
  `.agents/audit-synthesis-remediation/` precisely so that creating them does not change any Markdown
  corpus count in §1.2. They are out-of-corpus T3 review evidence, hashed and cited in the synthesis
  §6.2, and they originate nothing.
