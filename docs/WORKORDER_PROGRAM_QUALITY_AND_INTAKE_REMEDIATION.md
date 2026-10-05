# Work Order — Program Quality and Intake Remediation

## 0. Control Record

- **Status:** READY FOR OWNER DISPATCH.
- **Executor role:** bounded product and test executor.
- **Working directory:** C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation
- **Branch:** codex/program-quality-remediation
- **Required product ancestor:** 965492e02184e07ddab20391740f10a694bd9149
- **Required effort:** High.
- **Release boundary:** local implementation, verification, commits, and audit handover only.
- **Forbidden release actions:** no merge, rebase, push, tag, signing, release approval, store action, or APK distribution.

## 1. Objective

Turn the owner's physical-device feedback into a coherent first-run and programming contract:

1. shorten first-run setup without hiding safety-critical or program-shaping choices;
2. make the selected goal visibly and deterministically affect the program;
3. give an intermediate-or-higher athlete loaded, goal-appropriate movements when safely available;
4. provide a genuine big-lift/powerlifting path and a distinct bodybuilding path;
5. remove the confusing bodyweight prescription case where reps fall while RPE rises without a load channel;
6. prove that athletes can record actual bodyweight reps;
7. explain RPE with plain-language, reps-in-reserve, form, and breathing cues while leaving it optional; and
8. produce a frozen candidate and a complete independent-audit handover.

## 2. Owner-Ratified Product Decisions

### 2.1 First-Run Intake

The current 9-step beginner and 11-step non-beginner questionnaire is too long. Replace it with a maximum seven-screen flow:

1. Welcome and optional name.
2. Goal.
3. Experience.
4. Weekly logistics: days per week and session duration together.
5. Equipment: three presets first, optional customization second.
6. Current limitations: one explicit no/yes choice; reveal the existing injury and mobility note fields only for yes.
7. Review and finish.

Only five screens ask for decisions. Welcome and review do not count as questions.

The following remain valid profile settings but are not separate mandatory screens:

- maximum sessions per day;
- effort/RPE ceiling;
- load-selection preference;
- energy-system focus; and
- progression methodology.

Their defaults must be disclosed honestly at review and remain editable later. Non-beginners must still see and be able to change the auto/manual load preference during onboarding, as required by docs/WO_FOUR_MODE_LOAD.md. Put that preselected choice in an optional fine-tuning area on the review screen instead of restoring a separate page. Beginners remain forced to auto and receive the existing explanation.

### 2.2 Goal-to-Style Mapping

Do not create a new persisted program-style enum in this pass. Use the existing objective domain honestly:

| Persisted objective | Athlete-facing style | Required program meaning |
|---|---|---|
| strength | Big-lift strength / powerlifting | Squat, bench press, and deadlift anchors when capacity and access allow |
| hypertrophy | Bodybuilding / build muscle | Balanced loaded hypertrophy work; no forced competition-lift obligation |
| power | Athletic power | Explosive-force emphasis, not a renamed bodybuilding template |
| endurance | Endurance | Repeatable engine work with supporting strength |
| gpp | General athlete | Broad strength, movement, and conditioning |
| hybrid | Strength + grappling | Keep the current BJJ-specific behavior and label it honestly |
| rehab | Return to training | Conservative training support; no medical diagnosis or rehabilitation claim |
| weight_loss | Fat-loss support | Strength-preserving activity support; no guaranteed weight-loss claim |

The UI must not label the current BJJ-specific hybrid split as a generic strength-and-engine plan.

### 2.3 Intermediate Main-Lift Eligibility

Competition Squat, Competition Bench, and Deadlift are authored as Advanced in migration 010, while the onboarding definition of intermediate says the basic lifts feel familiar. Correct this mismatch through a new append-only migration:

- use migration 060 if it is still the next free slot at W0; otherwise stop and report the collision;
- update only those three movement_detail rows from Advanced to Intermediate;
- never edit migration 010 or any other shipped migration;
- verify exact row count and exact before/after values;
- make the migration idempotent and fail closed if the expected named rows are absent; and
- do not treat reclassification as capability evidence.

This makes the lifts tier-eligible for an intermediate. Equipment, active injury/niggle exclusions, capability evidence, prior-experience confirmation, and separate attestation remain independent hard gates.

### 2.4 Loaded-Movement Default

For non-rehab intermediate, advanced, and elite profiles:

- never default to Bodyweight Squat when a compatible loaded squat is available;
- with dumbbells or kettlebells, Goblet Squat is the minimum default loaded squat;
- with a full gym, prefer the goal-appropriate safely available loaded rung;
- retain bodyweight when the athlete explicitly chose it or when equipment, safety, capability, attestation, or return-to-training constraints require it; and
- tell the athlete which constraint caused the fallback.

Do not implement this as a single movement-name special case. Add a pure, deterministic ranking policy that can be tested across patterns and objectives. A valid explicit athlete movement preference remains first priority.

### 2.5 Big-Lift Strength Contract

For a strength profile with at least three available weekly plan slots:

- the repeating week must contain squat, bench press, and deadlift anchor roles;
- when the exact competition movements are available, use Competition Squat, Competition Bench, and Deadlift;
- an intermediate may use the existing local prior-experience confirmation flow to clear ordinary missing capability evidence;
- never infer prior experience solely from the selected training-age label;
- never let prior-experience confirmation override tier, equipment, safety, or separate attestation; and
- when an exact anchor cannot be used, show the precise blocker and the loaded substitute.

If the chosen days and duration provide fewer than three plan slots, the setup UI must disclose the incompatibility before creation and offer a clear choice to increase capacity or accept a reduced-anchor plan. It must never silently promise powerlifting and omit a main lift.

### 2.6 Bodybuilding Contract

For hypertrophy:

- do not impose the big-three obligation;
- prefer safely available loaded compounds for primary slots for intermediate-or-higher athletes;
- provide balanced lower, upper push, upper pull, and accessory exposure across the repeating week;
- keep primary and accessory dose roles visibly distinct;
- retain a coherent overload path rather than giving every movement an unexplained identical template; and
- keep all existing caps, deloads, suspension behavior, and safety gates.

Do not invent unreviewed exercise-science coefficients. Reuse existing scheme values where they satisfy this contract. Any new numeric coefficient or rep band must be isolated, named, documented in the execution report, and covered by boundary tests.

### 2.7 Rep and RPE Contract

The current SessionScreen already has a reps Stepper and passes its value to logSet. Preserve that implementation. Improve and prove it:

- label the control Actual reps for rep-based work;
- for a bodyweight set, initialize from the planned target but allow 1–50 actual reps;
- log the athlete-entered number without changing the planned target;
- preserve the entered value through ordinary rerenders until the set is logged; and
- prove the stored/logged set uses actual reps.

Keep actual RPE optional:

- unanswered actual RPE remains null;
- target RPE is not fabricated as actual RPE;
- exact target confirmation remains an explicit action; and
- every visible RPE value has an adjacent plain-language cue.

Use reps-in-reserve and form quality as the primary lifting anchors. Breathing or talk cues are secondary and must say they vary by exercise and fitness. Suggested cue bands:

| RPE | Plain-language anchor |
|---|---|
| 5–6 | Easy; at least four good reps left |
| 6.5–7 | Moderate; about three good reps left |
| 7.5–8 | Hard but controlled; about two good reps left |
| 8.5–9 | Very hard; about one good rep left |
| 9.5–10 | Limit effort; no good reps left; never trade form for the number |

Pain is not RPE. Add concise stop guidance for pain, dizziness, or loss of control without making a medical diagnosis.

No implementation in this work order may read or infer effort from heart rate, SpO2, HRV, stress, respiratory rate, wearables, or Health Connect.

## 3. Verified Starting State

The executor must confirm these facts rather than rediscovering or accidentally duplicating them:

- apps/mobile/src/screens/OnboardingScreen.tsx currently contains 9/11 steps and commits through one completeOnboarding call.
- packages/inference/src/types.ts already contains the eight objectives, four training ages, equipment presets, BIG4_LIFTS, and DEFAULT_PROFILE.
- DEFAULT_PROFILE currently supplies max_sessions_per_day 1, base_rpe_cap 9, hybrid energy focus, and autoregulated progression.
- docs/WO_FOUR_MODE_LOAD.md requires non-beginner load preference to appear during onboarding and the onboarding profile/preference write to be atomic.
- apps/mobile/src/screens/ProfileScreen.tsx already exposes the profile settings that will leave the mandatory first-run path.
- packages/inference/src/blockGenerator.ts currently ranks equal compound candidates by movement_id, which can prefer an easy bodyweight row despite available loaded equipment.
- the generator currently shares strength splits with power and hypertrophy, but only the scheme values differ.
- Competition Squat, Competition Bench, and Deadlift are currently Advanced movement_detail rows.
- the hybrid split currently contains BJJ sessions.
- apps/mobile/src/screens/SessionScreen.tsx already lets the athlete change reps and keeps unanswered RPE out of Coach evidence.
- packages/inference/test/verify_blocks.mjs already protects Option C bodyweight set progression and the capability-chain rep floor.

## 4. Non-Negotiable Invariants

- Preserve deterministic generation: identical typed input produces deep-equal output.
- Preserve strict equipment subset filtering.
- Preserve injury/niggle, capability, prior-experience, attestation, and context gates.
- Preserve valid explicit movement preferences ahead of coach defaults.
- Preserve beginner ceilings and beginner load-selection restrictions.
- Preserve the single atomic onboarding profile/load-preference commit.
- Preserve demo-history refusal behavior.
- Preserve suspension freeze, load-intent routing, chain-scoped rep floors, deload behavior, and immutable audit state from the release baseline.
- Preserve unanswered actual RPE as null.
- Preserve planned targets separately from actual completed reps.
- Preserve shipped migrations byte-for-byte.
- Do not add dependencies, change signing/release configuration, or use sensor data.
- Do not claim clinical validation, injury treatment, or biometric RPE accuracy.

## 5. Authorized Write Set

### 5.1 Coordination

- PROMPT_LEDGER.md — append-only next sequential entry.

### 5.2 Product

- apps/mobile/src/screens/OnboardingScreen.tsx
- apps/mobile/src/screens/ProgramSetupScreen.tsx
- apps/mobile/src/screens/SessionScreen.tsx
- apps/mobile/src/screens/ProfileScreen.tsx — only if required to keep a removed onboarding setting discoverable
- apps/mobile/src/state/useStore.ts
- packages/inference/src/blockGenerator.ts
- packages/inference/src/tierPolicy.ts
- packages/inference/src/capabilityResolver.ts
- packages/inference/src/types.ts
- packages/inference/src/index.ts
- one new focused pure inference helper if it reduces coupling
- packages/core-db/src/schema/060_program_goal_tier_alignment.sql
- packages/core-db/src/migrations.ts
- packages/core-db/src/migrationRunner.ts — only if a migration sentinel or invariant genuinely requires it

### 5.3 Tests

- apps/mobile/test/components/ProfileScreens.test.js
- apps/mobile/test/components/ProgramSetupScreen.test.js
- apps/mobile/test/components/SessionScreen.test.js
- apps/mobile/test/verify_store_sql.mjs
- apps/mobile/test/verify_routine_templates.mjs
- packages/inference/test/verify_blocks.mjs
- packages/inference/test/verify_pipeline.mjs
- packages/core-db/test/verify_migrations.mjs
- packages/core-db/test/verify_schema.py
- one new focused test file when the pure ranking helper warrants it

### 5.4 Evidence

- docs/audits/program-quality-remediation/**

Any necessary path outside this set requires an explicit written justification in the ledger before it is changed. Shared UI primitives, theme tokens, dependencies, Android build files, release scripts, and old audit packages are outside scope.

## 6. Execution Plan

### 6.1 W0 — Establish Identity and Ledger

1. Run git status --short --branch.
2. Verify the current branch is codex/program-quality-remediation.
3. Verify 965492e02184e07ddab20391740f10a694bd9149 is an ancestor of HEAD.
4. Verify the root master checkout is not the working directory.
5. Verify the worktree contains no unknown edits. If it does, stop.
6. Verify 060 is the next unused migration slot. If it is not, stop.
7. Append the next sequential PROMPT_LEDGER.md entry, expected to be Entry 0059, with the executor's complete received prompt as Input and an open Output section. This is the first tracked write.
8. Record Node/npm versions and baseline targeted-test results.

### 6.2 W1 — Pin Failing Contracts First

Before production changes, add tests that fail for the current product behavior:

- first-run path is at most seven screens;
- schedule combines days and minutes;
- equipment presets accurately show the current selection and custom equipment stays collapsed;
- limitations fields appear only after yes;
- non-beginner load choice remains present in the review screen;
- intermediate full-gym coach build does not default to Bodyweight Squat;
- strength capacity and anchor coverage are visible before creation;
- strength with all gates open includes the exact three competition lifts;
- hypertrophy is not forced to include the competition big three;
- bodyweight actual reps differ from planned reps and reach logSet unchanged;
- unanswered actual RPE remains null; and
- plain-language effort cues render.

Record the expected failures. Tests that already pass must be identified as pre-existing coverage, not presented as new red proof.

### 6.3 W2 — Streamline Onboarding

Implement the seven-screen contract in section 2.1.

Acceptance details:

- progress indicator count and current position are correct;
- Android/back navigation never loses already-entered draft values;
- no profile, preference, or limitation data is persisted before Finish;
- full gym, home basic, and minimal presets show a truthful selected state;
- Customize reveals standard equipment without exposing it by default;
- specialist equipment remains a separate explicit opt-in and no preset grants it;
- current-limitations no clears both draft note lists;
- current-limitations yes reveals the existing injury and mobility fields;
- review distinguishes athlete choices from coach defaults;
- advanced defaults say they can be edited in Athlete/Profile;
- non-beginner auto/manual is visible and changeable without a separate step;
- beginner stays auto and cannot select manual; and
- demo loading still refuses to overwrite existing history.

### 6.4 W3 — Align Goal, Tier, and Movement Selection

1. Add and verify the append-only three-row difficulty correction.
2. Introduce a pure deterministic movement-ranking policy.
3. Apply the honest goal labels from section 2.2.
4. Enforce loaded defaults and reasoned bodyweight exceptions.
5. Enforce the big-lift strength contract.
6. Enforce the bodybuilding contract.
7. Expose anchor coverage, substitutions, and blocker reasons in program setup/preview.
8. Keep custom movement preferences authoritative when valid.

The ranking policy must operate only after equipment, tier, safety, capability, and attestation filtering. It must not re-admit a rejected candidate.

For intermediate competition lifts, program setup may offer the existing local prior-experience confirmation only when the shared verdict says confirmationWouldClear and capability is the sole blocker. The wording must say it is a local declaration of prior experience, not a coaching assessment.

### 6.5 W4 — Make Progression Legible

The preview must explain the weekly change for each representative slot:

- same reps plus a set;
- same reps at higher target effort/load;
- fewer reps with a genuinely higher external-load target; or
- deload.

A strictly bodyweight slot with no external-load channel must not prescribe fewer working-week reps at a higher RPE. Add the exact regression case reported by the owner:

- Bodyweight Squat;
- 3 × 10 around RPE 6.5;
- a later working week must not become 3 × 8 around RPE 7.5 merely as though invisible external load increased.

Do not weaken the existing Option C set-route and chain-floor tests. If the current engine already prevents the case when load intent is correct, fix the upstream intent/preview defect and prove the end-to-end route instead of rewriting working progression math.

### 6.6 W5 — Clarify Actual Reps and Effort

Implement section 2.7 with the smallest UI change:

- Actual reps label for rep-based sets;
- bodyweight-specific persistence proof;
- a pure cue formatter or equally centralized mapping;
- plain-language cue adjacent to target and actual RPE;
- RIR/form first, breathing/talk second;
- pain-is-not-effort copy; and
- no sensor access.

Do not replace the exact RPE input. The cues are an interpretation aid, not a second score and not an inferred value.

### 6.7 W6 — Full Verification

Run focused tests first, then full gates:

1. npm run typecheck
2. npm run verify:migrations
3. npm run verify:db
4. npm run verify:blocks
5. npm run verify:store
6. npx jest --config apps/mobile/jest.config.js --runInBand --runTestsByPath apps/mobile/test/components/ProfileScreens.test.js apps/mobile/test/components/ProgramSetupScreen.test.js apps/mobile/test/components/SessionScreen.test.js
7. npm run verify:components
8. npm run verify:ci
9. git diff --check

Record the exact command, exit code, and relevant totals. A failed gate may be repaired only within the authorized scope, then all gates from the earliest affected layer must be rerun.

Do not run verify:release and do not claim C6. This is a development candidate, and physical-device memory certification remains a separate release gate.

### 6.8 W7 — Generated-Program Acceptance Matrix

Generate and persist representative week-one and four-week summaries for at least:

| ID | Goal | Tier | Equipment/access | Required result |
|---|---|---|---|---|
| PQ-01 | strength | intermediate | full gym; big-three prior experience confirmed; no restriction; at least 3 slots | exact Competition Squat, Competition Bench, and Deadlift anchors |
| PQ-02 | strength | intermediate | full gym; no prior-experience confirmation | no false full-powerlifting claim; loaded safe substitutes plus exact capability prompts |
| PQ-03 | strength | intermediate | dumbbell/kettlebell only | no default Bodyweight Squat; at least Goblet Squat; equipment blocker for exact competition anchors |
| PQ-04 | strength | intermediate | fewer than 3 weekly slots | visible capacity conflict before create; no silent missing anchor |
| PQ-05 | hypertrophy | intermediate | full gym | bodybuilding-labeled plan, balanced loaded work, no mandatory big-three set |
| PQ-06 | power | intermediate | full gym | athletic-power label and power-specific explanation |
| PQ-07 | gpp | intermediate | full gym | broad general-athlete plan, not mislabeled powerlifting |
| PQ-08 | hybrid | intermediate | full gym plus BJJ access | honest strength-plus-grappling label and BJJ sessions |
| PQ-09 | rehab | any | constrained | conservative return-to-training copy; bodyweight allowed; no medical claim |
| PQ-10 | strength | intermediate | minimal equipment | bodyweight allowed with explicit equipment reason |
| PQ-11 | strength | intermediate | full gym plus active squat restriction | no unsafe squat re-admission; reasoned safe fallback/drop |
| PQ-12 | any rep plan | any | bodyweight slot | actual reps changed from target and logged exactly |
| PQ-13 | any | any | RPE untouched | stored actual RPE is null and cue remains informational |
| PQ-14 | strength | advanced/elite | full gym | loaded goal-appropriate anchors; no default Bodyweight Squat |

For each row record profile input, relevant gate facts, selected movements, sets/reps/RPE by week, warnings/reasons, and pass/fail. Do not hand-author expected-looking output; produce it from the candidate code.

### 6.9 W8 — Freeze and Handover

Create:

- docs/audits/program-quality-remediation/EXECUTOR_HANDOFF.md
- docs/audits/program-quality-remediation/TEST_EVIDENCE.md
- docs/audits/program-quality-remediation/GENERATED_PROGRAM_MATRIX.md
- docs/audits/program-quality-remediation/OWNER_DECISIONS_AND_LIMITATIONS.md

Close the ledger Output with:

- commits;
- files changed;
- tests and exit codes;
- generated matrix result;
- known limitations;
- confirmation that no sensor/biometric RPE work occurred;
- confirmation that no merge, rebase, push, tag, signing, release, or APK action occurred; and
- the frozen candidate SHA.

Complete every placeholder in docs/HANDOVER_TEAM_PREVIEW_PROGRAM_QUALITY_AUDIT.md without changing its charter. Leave the branch clean and report READY_FOR_INDEPENDENT_AUDIT or NOT_READY.

## 7. Required Test Coverage

### 7.1 Unit

- step list and count by training age;
- hidden-default derivation;
- RPE cue boundaries at every half-step from 5.0 to 10.0;
- deterministic movement ranking and stable tie-break;
- explicit preference precedence;
- loaded-vs-bodyweight classification;
- anchor-capacity calculation;
- objective/style label mapping; and
- migration exact-row correction.

### 7.2 Integration

- fresh onboarding persists one complete atomic profile/preference state;
- back navigation preserves draft only;
- profile settings remain editable after shorter onboarding;
- objective and tier reach preview/generator;
- prior-experience confirmation changes only capability-eligible state;
- generated program persists the reviewed schedule;
- actual bodyweight reps reach set_record while planned target remains unchanged; and
- actual RPE null semantics survive persistence.

### 7.3 Regression and Boundaries

- all four training ages;
- all eight objectives;
- full gym, home basic, minimal, and relevant custom equipment;
- active safety exclusion;
- missing capability;
- separate attestation;
- valid and invalid explicit movement preferences;
- one through seven training days and 15 through 240 minute caps;
- suspension/deload behavior;
- deterministic double run;
- strict equipment subset;
- no NaN/Infinity or out-of-domain set/rep/RPE value; and
- no sensor or Health Connect call from the new effort-cue path.

## 8. Commit Guidance

Keep commits reviewable and green. Recommended logical structure:

1. refactor(onboarding): reduce first-run decision burden
2. feat(programs): align goals tiers and movement selection
3. feat(session): clarify actual reps and effort
4. docs(audit): hand off program-quality candidate

Tests belong with the behavior they verify. The first tracked write is still the append-only ledger entry, even if the ledger closes in the final documentation commit.

Do not rewrite history, squash after review, or amend the frozen candidate.

## 9. Acceptance Criteria

### 9.1 Intake

- maximum seven screens;
- maximum five decision screens;
- one atomic finish write;
- non-beginner load preference still available in onboarding;
- advanced options disclosed and later editable;
- safety note route preserved;
- equipment customization progressively disclosed; and
- demo/history behavior unchanged.

### 9.2 Program Quality

- selected goal/style is visible in setup and preview;
- strength has a tested big-three contract;
- bodybuilding is distinct and does not inherit a mandatory big-three contract;
- intermediate loaded squat selection satisfies the minimum-loaded rule;
- bodyweight exceptions have exact reasons;
- all access and safety gates remain hard;
- insufficient capacity is disclosed before program creation; and
- generated outputs pass PQ-01 through PQ-14.

### 9.3 Logging and Effort

- bodyweight actual reps are editable and persisted;
- planned and actual reps remain distinct;
- RPE cues are plain-language and accessible;
- unanswered actual RPE remains null;
- pain is not described as effort; and
- no biometric inference exists.

### 9.4 Quality and Handover

- all W6 gates pass;
- git diff --check is clean;
- worktree is clean at handover;
- evidence reflects actual generated output;
- audit template is fully populated; and
- no release-boundary action occurred.

## 10. Required Final Handback

Use exactly this status block:

    IMPLEMENTATION: COMPLETE | INCOMPLETE
    TARGETED TESTS: PASS | FAIL
    FULL VERIFY: PASS | FAIL
    PROGRAM MATRIX: PASS | FAIL
    READY FOR INDEPENDENT AUDIT: YES | NO
    PUSH / RELEASE: NOT PERFORMED
    BIOMETRIC RPE: NOT IMPLEMENTED

Then provide the frozen SHA, commit list, file list, test table, matrix summary, open limitations, and the completed Team Preview audit prompt.
