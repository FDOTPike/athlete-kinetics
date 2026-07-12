# Athlete Kinetics — Phase Plan rev 4 (FORGE era)
Fable 5 · 2026-07-06 · Supersedes "Fables Phase's generation.txt" (rev 3, 2026-06-11).
Companion system: `~/Desktop/FORGE_blueprint/` (FORGE_blueprint.md · forge_dispatcher_extensions.md · cleanroom_gate.sh).

## 0. Mission and locked decisions

Ship Athlete Kinetics as a downloadable app that works as a beginner's gym coach:
guided sessions, an extensive tier-gated movement library (YouTube how-to links,
execution notes, tool variations), a clear customizable UI, and a consistency
reward system — while keeping every standing invariant.

**Decisions locked 2026-07-06 (Francis):**

| Decision | Ruling |
|---|---|
| Beginner positioning | ONE app, experience tiers (Beginner/Intermediate/Advanced) gate variation visibility, info density, and coaching detail. `movement_detail.difficulty_rating` already carries the key. |
| Library content | Bulk-import an open-licensed exercise dataset, then FORGE curation loops rewrite every entry to house standard. |
| Distribution | Google Play first (personal account, $25 one-time). F-Droid + GitHub Releases after. iOS deferred (Mac + $99/yr). |
| Rewards | No flavor preference — stage all three: streaks/adherence → milestones/PRs → progression unlocks. Local, deterministic, no dark patterns. |
| Onboarding | First run = questionnaire wizard that builds the athlete profile from the existing profile variables. |
| Coach/dev mode | Francis can create several profiles and run them as different people simultaneously (manual multi-athlete testing). Rides on 013_profile_slot local multi-tenancy — already shipped. |

**Standing invariants (unchanged, non-negotiable):**
1. No cloud, no account, no subscription, no telemetry. Local SQLite only.
2. No generative LLM. `verify:memory` fails the build if llama.rn reappears.
3. `npm run verify:all` green before anything lands (12 gates today; new phases add gates, never remove).
4. Subjective input only ever makes a session MORE conservative; halts end it.
5. PROMPT_LEDGER protocol: first file operation of any execution run appends the entry. DEVIATION_LOG records architectural deviations.
6. Migration numbers are assigned at implementation time, next free slot, append-only (the 010 renumbering lesson).

## 1. Where the codebase actually is (audit basis: ledger 0018, commit b59502e)

DONE through Phase 13: on-device APK via CI · triage + red-flag hard override ·
ExRx taxonomy (008) · program/block engine (007/009) · movement library schema
(010, 30 movements) · niggle tracking (011) · severity (012) · profile slots /
multi-tenancy + safe wipe (013) · prefix engine (014/015) · Kinematic Autopilot
wired into block generation · 12 green gates.

KNOWN GAPS vs the mission:
- `movement_detail.instructions`, `cues`, `video_placeholder_uri` are empty strings for all 30 rows. Library content does not exist yet.
- No onboarding questionnaire; profile entry is bare ProfileScreen fields.
- No multi-profile management UI (schema supports it; nothing surfaces it).
- No guided-session coach flow; SessionScreen assumes a self-directed athlete.
- No reward/consistency system anywhere in schema or UI.
- Distribution = sideloaded debug-keystore APK from CI artifacts only.
- UNAUDITED: how much of the `update.txt` mandate (10-category profile expansion, SessionScreen horizontal-sidebar redesign) landed in Phase 12/13. Phase 14 resolves this with evidence, not memory.

## 2. FORGE, retargeted at this repo

FORGE was live-fired on the thesis repo (ProjectDawnBreaker) and its queue holds
two CANDIDATE tickets today. Retargeting rules:

1. **Finish or park the thesis queue first.** The two CANDIDATEs are at CERT-WAIT distance — certify them in one checkpoint batch (they're the blueprint's own critical path) or explicitly park the queue. Never interleave: **one writer per working tree, one active repo per FORGE run** (blueprint invariant F.4).
2. **Point the machinery here:** `FORGE_REPO=C:\Users\fpike\Documents\Claude Coding\Athlete App` (env var read by the knife runner and cleanroom hook). Knives execute from `test/knives/`; add that dir to this repo with a `.gitignore` for transients, and keep gate logs in `test/results/` (no log, no commit).
3. **Clean-room gate caveat:** `verify:db` shells out to Python (`verify_schema.py`). The clean-room environment (local worktree or gcloud VM) must have python3 on PATH or the gate false-fails. Verify once in Phase 14 before trusting any red.
4. **Ticket format** (dept: code, this repo):

```
TICKET_hephaestus_ak-p<phase>s<step>_<slug>.md
---
dept: code
repo: athlete-kinetics
status: DERIVING            # → CODE-LANDED → KNIVES-OUT → KNIVES-RUN → CLEANROOM → TRIAGED → CANDIDATE → CERT-WAIT
rounds: 0                   # loop budget: bounce to Zeus review at 4 red-knife rounds
---
SPEC: single-outcome statement + acceptance list
GATES: verify:all + the phase's named gate(s)
LEDGER: append PROMPT_LEDGER entry per standing protocol; deviations → DEVIATION_LOG
BOUNDS: files the ticket may touch; everything else read-only
```

5. **Loop-suitability legend** used below:
   - **AUTO-LOOP** — high-iteration, objectively gated; knives and verify gates catch failure without human eyes. Run unattended, monitor via Hermes.
   - **HYBRID** — loop builds it, but exit requires Francis's eyes on a device (knives cannot see jank, layout, or feel).
   - **COCKPIT** — human-led (design decisions, Play Console, on-device smoke tests); FORGE only records outcomes.
6. **Hermes desktop app** = your loop console: queue state (`logs/QUEUE_CHECKPOINT.md`), per-ticket round counts, cert batches at CERT-WAIT. The inbox's `TICKET_forge-02_hermes-explainer` (plain-language loop digests) directly upgrades this — schedule it as Phase 14 warm-up work alongside forge-01/forge-03 if wanted.

---

## Phase 14 — Retarget FORGE + evidence audit (COCKPIT, ~1-2 sessions)

Step 1. Certify or park the thesis CANDIDATEs. Record the choice in QUEUE_CHECKPOINT.
Step 2. FORGE_REPO switch + `test/knives/` + `test/results/` dirs + python3-in-cleanroom check.
Step 3. **Pilot ticket** (small, real, load-bearing): `ak-p15s1_profile-schema` (below) end-to-end through knives → cleanroom → cert. This is the §5-style first milestone: it shakes out the retarget before anything heavy runs.
Step 4. **Athena audit ticket:** reconcile `update.txt` mandate vs code — which of the 10 profile categories exist in the store/schema, and did the SessionScreen sidebar redesign land? Output: a state table that Phase 15/17 specs cite. No guessing from memory.

EXIT: pilot ticket committed with gate logs; audit table in `Project Overview/Phase manager/`.

## Phase 15 — Onboarding questionnaire + Coach Mode (HYBRID)

Goal: first run feels like being interviewed by a coach; Francis can run a stable of test athletes.

Step 1 (AUTO-LOOP, the pilot). Profile schema completion: whatever the audit says is missing from the 10-category expansion (training frequency/routine, base RPE, target energy system enum, progression methodology enum, injury-history/mobility PT flags) + `experience_tier` as a first-class field + equipment inventory hookup (007's equipment_inventory). Migration in next free slot. Gate: extend `verify:db` + `verify:store`.
Step 2 (HYBRID). Questionnaire wizard UI: one question per screen, big targets, keyboard-free where possible (the chalked-hands rule), progress dots, sensible defaults. Writes the profile, creates the slot, lands on the dashboard. Replaces the bare empty state; LOAD DEMO ATHLETE moves into dev/coach mode.
Step 3 (HYBRID). **Coach Mode:** profile-slot manager surfaced in UI — create/name/switch/wipe athletes, each fully independent (own DB state per 013). A coach dashboard lists all profiles with at-a-glance readiness. Entry point deliberately quiet (e.g., long-press on the version string in Profile) so beginners never stumble into it.
Step 4 (COCKPIT). On-device pass: run 3+ profiles as different people for several days; confirm no state bleed (knife: cross-slot isolation test hammering two slots with interleaved writes).

Gate additions: `verify:profile` (questionnaire answers → profile object contract sweep, tier always resolvable). EXIT: fresh install → questionnaire → prescribed first session, and coach mode running ≥3 independent athletes.

## Phase 16 — Movement library at scale (AUTO-LOOP's home turf)

Goal: from 30 sparse rows to an extensive, tier-gated, beginner-safe library.

Step 1 (COCKPIT, one session). Source selection: pick the open dataset (candidate: free-exercise-db, ~800 movements; **check the license text at import time and vendor a copy of it** — attribution ships in the app's About screen). ExRx site content is copyrighted: taxonomy concept only, never its text.
Step 2 (AUTO-LOOP). Import pipeline `scripts/import-movements.mjs`: dataset → staging JSON → map onto movement + movement_detail + movement_taxonomy + supported_prefixes. Collisions with the existing 30 rows resolve to KEEP OURS (they have FK dependents). Anything unmappable to the 8-pattern taxonomy lands in a quarantine file for a human pass, not in the DB.
Step 3 (AUTO-LOOP, the flagship loop). **Curation batches:** each ticket rewrites ~15 movements to house standard — `instructions` (2-4 plain-language steps), `cues` (1-3, blunt), `difficulty_rating`, `target_muscles`, tool variants as prefixes, `video_placeholder_uri` = one YouTube link. Momus knives per batch: schema/contract validation, banned-claim lint (no medical advice, no "burns fat", cue length caps), tier sanity (a Beginner movement never requires Advanced-only equipment), dead-link format check (URI shape only — reachability is a COCKPIT spot check, the app must never phone home). ~40-55 batches; run unattended, certify in batches via Hermes.
Step 4 (AUTO-LOOP). Tier gating logic in inference: pickers/substitution/blockGenerator filter by `experience_tier` vs `difficulty_rating` (Beginner sees Beginner + whitelisted Intermediate staples; Advanced sees all). Info-density contract per tier — Beginner: base name, 3 cues max, 1 video link, which tool; Advanced: + variations, tempo, autopilot detail. **The information-overload principle is a machine-checked contract, not a style note** (`verify:library` counts what each tier is shown).
Step 5 (HYBRID). Library browser UI: search + pattern/equipment/tier filters, movement detail card, video link opens externally via OS handler (`Linking.openURL`) — never an embedded webview, no YouTube SDK, no tracking. App remains 100% functional offline; video is an optional link out.

Gate additions: `verify:library` (row completeness, contract mirrors, tier-visibility counts, banned-claim lint over the full table). EXIT: ≥300 curated movements green through the lint knife; beginner profile on-device sees a small, calm library; advanced sees the full one.

## Phase 17 — Guided sessions: the app becomes the coach (HYBRID)

Goal: a beginner is walked through the session — what, why, how, and when to rest — without information overload. UI clear and customizable.

Step 1 (AUTO-LOOP). Session-runner state machine in pure TS (`packages/inference`): ordered slots → current set → rest interval (tier/RPE-aware defaults) → next-up preview → substitution offer on thumbs-down/niggle. Deterministic, fully knife-testable before any UI exists.
Step 2 (HYBRID). Guided SessionScreen mode: one movement at center stage — name, tier-appropriate cues, video link, target sets×reps×load, oversized log buttons; rest timer between sets (silent, visual, no shame); "why this exercise" one-liner from the library. Builds on (or completes) the update.txt sidebar overview for the at-a-glance full workout. Self-directed mode (current flow) stays for higher tiers — the tier default picks the mode, the user can override.
Step 3 (HYBRID). UI customization, deterministic and slot-scoped: reorder/hide dashboard tiles, metric detail level (readiness number vs full vector), rest-timer on/off, text scale honoring OS accessibility settings. Stored per profile slot; coach mode makes per-athlete layouts trivially testable.
Step 4 (COCKPIT). Field test via Coach Mode: run a true-beginner profile and an advanced profile through identical calendar weeks; the beginner script must never surface an Advanced variation or >3 cues. Report jank/latency like the Phase 6 device protocol.

Gate additions: `verify:session-runner` (state-machine sweep: no dead ends, halts always reachable, rest intervals within contract). EXIT: a novice tester completes a full guided session on-device without asking a human what to do.

## Phase 18 — Rewards: the consistency engine (AUTO-LOOP)

Goal: keep people showing up, without dark patterns and without ever fighting the readiness engine.

Step 1 (AUTO-LOOP). Reward schema (next free migration): streak state, adherence ledger, milestone/badge table — all derived or derivable from existing session/set/telemetry rows; no new tracking surface.
Step 2 (AUTO-LOOP). Engine, staged in three sub-specs:
  a. **Streaks + weekly adherence %** — recovery-aware by construction: an engine-prescribed rest/deload day HONORED counts as adherence; a rest day never breaks a streak. Missing a day prompts nothing louder than a neutral note.
  b. **Milestones + PR celebrations** — e1RM PRs, tonnage/session-count milestones, first-time-movement badges, computed from data already logged.
  c. **Progression unlocks** — logged-session thresholds per pattern unlock Intermediate variations for Beginner profiles (ties rewards directly to the tier-gated library; unlock = visibility, never a prescription jump).
Step 3 (HYBRID). Reward surfaces: quiet dashboard strip + post-session summary card. No push-notification guilt loops, no red badges, no daily-streak countdown pressure. Celebration tone: brief, factual, warm.
Step 4 (AUTO-LOOP). **Safety composition knife:** rewards NEVER make a prescription more aggressive — the conservative-only invariant (4) extends to the reward layer. A halt or high-severity niggle suppresses celebration UI that session.

Gate additions: `verify:rewards` (derivation determinism, rest-day-streak invariant, conservative-composition sweep). EXIT: 180-day demo athlete replays with a correct, deterministic reward history; knives green.

## Phase 19 — Ship it: Google Play (COCKPIT with AUTO-LOOP support)

**Start the clock early:** Play requires new personal accounts to run a closed test with **12 testers opted in continuously for 14 days** before you can even APPLY for production (then ~7 days review). So Step 1-3 execute as soon as Phase 15 lands — the closed test runs UNDERNEATH Phases 16-18, and testers receive each phase as it ships.

Step 1 (COCKPIT). Play Console personal account ($25) + app record. Data-safety form is gloriously short: nothing collected, nothing shared. Privacy policy = one page on the repo's GitHub Pages stating exactly that.
Step 2 (AUTO-LOOP support). Release signing: generate an upload keystore (backed up offline, never committed), CI signs release AABs via GitHub Actions secrets, versionCode auto-increments. The debug-keystore CI artifact stays for sideload testing.
Step 3 (COCKPIT). Closed testing track live; recruit 12-15 testers (gym/BJJ circle — Play's own guidance suggests recruiting where target users exist; a coach recruiting from their gym is the textbook case). Keep them opted in ≥14 continuous days; collect feedback through Play + direct.
Step 4 (COCKPIT). Apply for production: answer the closed-test/app/readiness questionnaire citing tester engagement and the changes shipped during the test window (Phases 16-18 give you an unusually strong answer).
Step 5 (COCKPIT + AUTO-LOOP). Store listing (screenshots via Coach Mode profiles at multiple states), target-API compliance check, staged rollout. Then F-Droid submission (the all-local story is F-Droid catnip) + signed GitHub Releases.

EXIT: production live on Play; F-Droid metadata submitted; README install section updated.

## Phase 20 — Deferred / backlog (unchanged unless promoted)

iOS (Mac + $99/yr) · history/trends screen · per-movement e1RM curves · data export (CSV/SQLite copy) · voice input for reports · micro-cycle planner UI · localization · sqlite-vec escalation at ≥50k vectors · Antigravity SDK wiring into the dispatcher (after it earns trust).

---

## 3. Sequencing at a glance

```
P14 retarget+audit ─→ P15 questionnaire+coach mode ─→ P16 library ─→ P17 guided sessions ─→ P18 rewards ─→ P19 production apply
                                   │                                                                        ▲
                                   └── P19 Steps 1-3 (Play account, signing, closed test) start here ───────┘
                                       14-day tester clock runs under P16-P18
```
Dependencies that matter: tier gating (P16 S4) needs `experience_tier` (P15 S1). Guided sessions (P17) need library cues (P16 S3) — a beginner screen with empty cues is the old problem in new paint. Progression unlocks (P18 S2c) need tier gating. Ship steps 4-5 need everything testers should judge.

## 4. Risks and standing rules for the loop era

1. **One writer per tree.** FORGE runs and your cockpit/checkpoint sessions never overlap in this repo. The thesis queue keeps its own tree.
2. **Knives can't see jank.** Any UI-touching ticket exits through human eyes on a physical device (HYBRID rule). Budget: 4 red-knife rounds → automatic Zeus review instead of round 5.
3. **License hygiene.** The imported dataset's license file is vendored and its terms verified before the import commit lands; ExRx text never enters the repo; YouTube is linked, never embedded or scraped.
4. **Memory gate is king.** The library at ~800 rows is still trivial for SQLite, but `movement_detail` is load-once immutable reference data — keep it out of hot write paths; `verify:memory` budgets get a library-era row-count entry.
5. **Rewards are subordinate to readiness.** Any conflict resolves conservative (invariant 4 extended). No engagement mechanic ever overrides the coach.
6. **Ledger discipline survives automation.** Every FORGE ticket appends its PROMPT_LEDGER entry and carries gate logs in the commit — the OOS-commit lesson stays law.

## 5. First milestone (mirrors FORGE blueprint §5)

`TICKET_hephaestus_ak-p15s1_profile-schema` end-to-end: DERIVING → CODE-LANDED →
knives → clean-room (MODE=local) → Zeus → CANDIDATE → cert via Hermes → scoped
commit with gate logs. One small, real ticket proves the retargeted machine
before the ~50-batch library campaign leans on it.

