# Work order — four-mode load selection

Date: 2026-08-07
Status: **RATIFIED BY FRANCIS. UI SPECIFICATION AUTHORIZED. IMPLEMENTATION WAITS FOR THE REVIEWED KIMI SPEC.**
Authority: Francis
Design-spec agent: Kimi (read-only, orchestrated by Hermes)
Single implementation owner after spec approval: Hermes or GLM-5.2-class executor

Depends on:

- `1ec16e0` — untouched RPE is persisted as absent evidence;
- `4f064ac` — accepted WO-UI-3/4 close-out;
- `ab42b0e` — migration 034 and autopilot attribution.

This work order converts `PROPOSAL_experience_tiered_load_selection.md`,
including Amendment 1 and Francis's A6 rulings, into code authority. Where the
proposal remained ambiguous, the decisions below are binding for this phase.

---

## 1. Product outcome

An athlete must always be able to tell where the load-entry value came from.
The system has four effective sources:

| Source | Meaning | Operative value |
|---|---|---|
| `seeded` | First exposure without usable load evidence | External-load entry starts blank; the athlete must make an explicit choice |
| `history` | The movement has honest logged-load history but no operative derived target | Exact most recently logged load for that movement |
| `derived` | Coach can calculate or has already prescribed an absolute target | APRE `overrideLoadKg`, otherwise `targetLoadKg(oneRm, reps, targetRpe)` |
| `manual` | The athlete chooses the session load | Athlete entry is authoritative; any calculated/history value is advisory only |

The four sources are not four onboarding buttons. The durable athlete choice is
the two-way preference `auto | manual`; evidence and tier determine the effective
source for each movement. The UI may use friendlier copy, but code and tests use
these exact domain values.

## 2. Ratified tier defaults and choice

| Training age | Durable default | Athlete choice |
|---|---|---|
| Beginner | `auto` | Not asked. Beginner load selection is restricted to `seeded -> history` |
| Intermediate | `auto` | May choose `manual` during onboarding or later |
| Advanced | `manual` | May choose `auto` during onboarding or later |
| Elite | `manual` | May choose `auto` during onboarding or later |

Training-age transitions obey these rules:

- entering `beginner` forces `auto` because manual beginner prescription is not
  authorized;
- leaving `beginner` applies the destination tier's default because the prior
  beginner value was forced, not an explicit preference;
- moving between non-beginner tiers preserves the athlete's explicit choice;
- load preference cannot change during an active session.

The choice appears in onboarding for non-beginners and remains editable in the
ATHLETE/Profile surface. This corrects the earlier plan, which named
OnboardingScreen but omitted the required later-edit surface.

## 3. Effective-source resolver

Implement one pure, deterministic resolver in a focused inference module (for
example `packages/inference/src/loadSelection.ts`). Do not put UI state in the
block generator. Inputs must be explicit; no clock, database, Zustand, or React
access is allowed.

Resolution order:

1. **Beginner**
   - honest `lastLoggedLoadKg` exists -> `history`;
   - otherwise -> `seeded`;
   - one-rep-max and APRE-derived absolute targets do not become operative
     beginner loads.
2. **Non-beginner with `manual` preference**
   - effective source is always `manual`;
   - APRE override, 1RM-derived target, or history may be returned separately as
     one advisory suggestion, in that precedence order;
   - an advisory suggestion must never populate or overwrite the authoritative
     first-set entry.
3. **Non-beginner with `auto` preference**
   - valid APRE `overrideLoadKg` -> `derived`;
   - otherwise a repetition target plus movement-specific 1RM -> `derived`
     through the existing `targetLoadKg` function;
   - otherwise honest last logged load -> `history`;
   - otherwise -> `seeded`.

Additional laws:

- timed targets cannot use the repetition/1RM derivation;
- missing evidence is not zero;
- an explicit zero is valid evidence and must survive round-trip (notably
  bodyweight/added-load work);
- first-exposure external-load fields are blank, not silently coerced to zero;
- logging an external-load set requires an explicit finite, non-negative entry;
- bodyweight added load may initialize to `0`; this is the identity load, not a
  fiat starting-weight table;
- **bodyweight 1RM carve-out (D1-A, ratified by Francis 2026-08-08):** a stored
  movement 1RM does not distinguish total system load from added load for
  bodyweight movements. Therefore reps + 1RM must not derive an operative or
  advisory added load when `bodyweightMode` is true. A valid absolute APRE
  override may still prescribe added load. Exact logged added-load history
  remains valid. This is an intentional safety/domain rule, not an accidental
  resolver omission;
- after the athlete logs the first manual set for a movement in the active
  session, that actual current-session load may carry to the next set;
- rerenders, preference hydration, and evidence refreshes must not overwrite a
  load the athlete has already entered.

## 4. Completion evidence is not load authority in this phase

Amendment A3 described history as last load "adjusted by completion versus
prescription." That adjustment is **deferred** here.

`completionAction.ts` deliberately has no default numeric policy and no
production caller. The device baseline contains no eligible real completion
history for calibration. Therefore:

- `history` means the exact latest logged load only;
- do not call `deriveCompletionAction`;
- do not select a candidate completion policy;
- do not translate completion into kilograms;
- do not modify the RPE observer, `phi`, autopilot constants, or migration 034.

A later ratified observer/control work order may adjust history. This phase must
remain behaviorally neutral on that question.

## 5. Durable persistence

The preference is per profile and must survive restart and profile switching.
It does not belong in transient React state or in `athlete_profile` without a
migration.

Create the next available append-only migration slot at implementation time
(currently 035) with a STRICT side-car equivalent to:

```sql
profile_load_preference (
  profile_slot_id INTEGER PRIMARY KEY REFERENCES profile_slot ON DELETE CASCADE,
  preference TEXT NOT NULL CHECK (preference IN ('auto','manual'))
)
```

Migration requirements:

- `CREATE TABLE IF NOT EXISTS`; no destructive DDL and no historical rewrite;
- `INSERT OR IGNORE ... SELECT` seeds every existing profile slot;
- the active slot default uses the live `athlete_profile.training_age`; inactive
  slots use validated `profile_json.training_age`;
- beginner/intermediate seed `auto`; advanced/elite seed `manual`;
- register the table in `migrationRunner.ts` sentinels;
- prove fresh install, 034->new-slot upgrade, replay, poison/self-heal, CHECK
  rejection, and profile-slot cascade;
- if another migration lands first, use the then-next slot. The blocked Drive
  video-URI work order does not reserve number 035 and must be renumbered when
  it eventually becomes executable.

Store requirements:

- hydrate and expose the preference for the active profile;
- provide one validated save action that rejects changes during active sessions;
- onboarding persists profile fields and load preference in one SQLite
  transaction—no committed state may contain a completed onboarding profile
  with the wrong tier default;
- switching profiles snapshots/hydrates the corresponding preference without
  leaking another profile's value;
- reset-training-data preserves the preference because profile settings survive;
- malformed or missing rows fail safely to the tier default.

## 6. UI specification assignment (Kimi, read-only)

Kimi must inspect, but not modify:

- `apps/mobile/src/screens/OnboardingScreen.tsx`;
- `apps/mobile/src/screens/ProfileScreen.tsx`;
- `apps/mobile/src/screens/SessionScreen.tsx`;
- `apps/mobile/src/components/ui/` and `apps/mobile/src/theme/theme.ts`;
- the relevant component tests;
- this work order and `WO_UI_SKIN.md`.

Kimi's specification must provide:

1. exact athlete-facing labels, hints, empty states, and accessibility labels;
2. onboarding placement and default/selection behavior for intermediate,
   advanced, and elite; beginner omission plus summary copy;
3. the ATHLETE/Profile edit affordance and active-session disabled/error state;
4. Session UI states for seeded, history, derived, and manual, including APRE
   advisory behavior, timed targets, bodyweight zero, blank-vs-zero validation,
   and current-session carry-forward;
5. a state matrix covering all four tiers, both preferences, 1RM present/absent,
   history present/absent, APRE override present/absent, timed work, and
   bodyweight work;
6. semantic test locators and component-test scenarios;
7. confirmation that all visuals use existing theme tokens and shared
   primitives, with zero raw hex and no primitive/theme edits.

Kimi may resolve presentation details, hierarchy, and copy. Kimi may not change
the resolver order, tier authority, persistence model, or safety laws above.
Questions that would change those laws must be returned as explicit blockers.

## 7. Serialized implementation ownership

After Francis/Codex accepts the Kimi specification, one executor owns the whole
integration. No concurrent writes are permitted.

Expected implementation scope:

- next migration SQL, `migrations.ts`, `migrationRunner.ts`, migration tests;
- new pure load-selection module and inference export/build-test wiring;
- `apps/mobile/src/state/useStore.ts` and store tests;
- `OnboardingScreen.tsx`, `ProfileScreen.tsx`, `SessionScreen.tsx`;
- their focused component tests;
- only the minimal package/test-list changes required to compile the new pure
  module. Keep `verify:all` at its documented gate count unless a separately
  reviewed new gate is genuinely necessary.

The executor must not modify:

- shipped migrations 001-034;
- `blockGenerator.ts`, unless a proven compile/interface dependency is reviewed
  first—the live source confirms it generates reps/RPE, not session load-entry
  state;
- `kinematicAutopilot.ts`, `completionAction.ts`, or their numeric policies;
- 1RM placement or READY-screen structure;
- shared UI primitives, theme tokens, dependencies, signing, or release config.

## 8. Required verification

### Pure resolver

- exhaustive table tests for every tier/preference/evidence branch;
- input-order independence and double-run determinism;
- beginner never resolves `derived` or `manual`;
- manual suggestion never becomes authoritative entry state;
- APRE precedence applies only on non-beginner auto;
- derived path calls the existing 2.5 kg-rounded `targetLoadKg`;
- timed targets fall back to history/seeded;
- absent and explicit-zero evidence remain distinct;
- invalid numeric inputs fail closed without NaN/Infinity.

### Store and migration

- all migration guarantees in section 5;
- per-profile preference isolation and restart hydration;
- onboarding tier defaults and explicit choices persist;
- training-age transition rules are pinned;
- active-session preference changes are rejected;
- reset preserves preference;
- latest-load query remains indexed/bounded and zero-preserving.

### Components

- all four source presentations render the reviewed Kimi copy;
- seeded external load cannot log until explicitly entered;
- explicit zero remains loggable where valid;
- manual first set is not prefilled from suggestion/history;
- manual subsequent set can carry current-session actual load;
- derived/history auto values populate correctly;
- athlete-entered values survive rerender;
- onboarding and Profile edit behavior match tier laws;
- accessibility labels identify source, suggestion, entry, and validation.

### Final gates

```text
git diff --check
npm run typecheck
npm run verify:migrations
npm run verify:blocks
npm run verify:store
npm run verify:components
npm run verify:all
```

Zero-hex grep must be clean for every touched screen. Existing React Native
animation `act(...)` warnings are known debt; no new warning class is allowed.

## 9. Stop conditions and handback

Stop immediately if implementation would require:

- a fiat starting-load table;
- completion-policy numbers;
- a fifth effective source;
- weakening the beginner tier law;
- silently treating blank as zero;
- changing shipped migrations or UI primitives;
- concurrent ownership of the store/session integration.

Handback is one clean feature commit based on `ab42b0e` (plus this ratification
commit), with exact changed-file list, gate evidence, and no push or merge unless
Francis explicitly requests it.

---

## Ratification record

Francis explicitly authorized Phase 2 ratification on 2026-08-07. This work
order preserves Amendment 1/A6, withdraws the rejected percentage-error model,
and resolves the remaining implementation ambiguities without granting new
autopilot or completion-control authority.
