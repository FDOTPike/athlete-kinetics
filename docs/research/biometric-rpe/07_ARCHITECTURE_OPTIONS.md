# 07 — Architecture Options (Smallest Hypothetical Architecture per Viable Option)

Constraint frame: this is analysis only — no code changes are proposed or permitted by this discovery [R01–R06 are described, not edited]. Every option below is sized against the existing seams so the owner can see the true cost of each path. The 4 GB device contract (dirty RAM < 450 MB [R06]) and the offline-first, graceful-degradation posture [R01] bound every design.

## 1. The value-separation law (applies to every option)

Six value classes must remain distinct at the type, persistence, and UI levels — the design goal is that no code path can silently convert one into another:

1. **Observed biometric** — raw-ish compacted daily values as ingested (`DailyBiometrics`, one row/day [R01]).
2. **Derived biometric feature** — computed descriptors (e.g. `ln_rmssd`, `hrv_z`, sleep efficiency) produced by the materialization layer [R01b].
3. **Readiness** — the ratified HRV+sleep composite score [R01b]; **corrected per audit: it is a prescription input**, not a merely descriptive metric — the policy engine (`policyReference.ts:36-55` [R07]) maps it to planned load/set/rpe_cap modifiers. The separation law therefore distinguishes planned-side prescription authority (readiness → plan) from athlete-authored actual RPE, which no biometric path may touch.
4. **Advisory effort estimate** (future, hypothetical) — a model output with explicit uncertainty; would live in its own type with its own provenance, never in `state_vector`.
5. **Athlete-confirmed actual RPE** — `set_record.rpe` / `session_rpe`, nullable, athlete-authored only [R03, R04].
6. **Planned target RPE** — prescription-side `target_rpe` [R04], untouched by all biometric paths.

Enforcement shape (already the repo's idiom): pure functions in `packages/inference` for any derived value; store actions as the only writers; SQL CHECKs and STRICT tables at rest [R04]; screens never re-derive. The separation law would extend this idiom: one value class, one source module, one writer path.

## 2. Option O1 — Plain-language RPE/RIR cues only (STATUS QUO, recommended baseline)

- **Architecture:** exists today — pure cue formatter `effortCues.ts` beside the RPE stepper [R05]; zero new modules.
- **Benefit:** validated-instrument-anchored subjective effort [S01–S03] with owner-ratified language; zero privacy, permission, validation, or memory burden.
- **Risk:** none new; the honest risk is that subjective scales have known noise floors (02 §1) — accepted and disclosed.
- **Data requirements / validation burden / privacy burden:** none / none / none.
- **Offline:** full. **Accessibility:** full (text cues, existing components).
- **Device support:** all devices. **Failure-safe:** unchanged (nulls stay null [R03]).
- **Memory (4 GB):** zero delta.

## 3. Option O2 — Optional user-entered breathing/talk/form cues

- **Architecture (smallest):** one optional string/enum field per set (or per session) collected in the existing set-edit flow; a new column via the append-only migration protocol [R04 chain]; pure validation in inference; display beside RPE with the existing "rough guides, not targets" framing [R05].
- **Benefit:** enriches subjective context; lets athletes with no wearable contribute observation; stays construct-pure (subjective beside subjective).
- **Risk:** friction and prompt fatigue (the owner's program-quality feedback historically penalizes extra questions); cue misuse as an RPE proxy must be copy-guarded.
- **Data:** manual only. **Validation burden:** copy comprehension testing only. **Privacy:** minimal (subjective text is still personal data — deletion path must cover it, 05 §4).
- **Offline:** full. **Accessibility:** text-entry hit zones per the sanctioned composition pattern (skill: screen UI laws).
- **Device support:** all. **Failure-safe:** unset cue = no cue, never inferred.
- **Memory:** negligible (one nullable field).

## 4. Option O3 — Post-session session-RPE prompt

- **Architecture (smallest):** a post-close prompt writing the existing nullable `session.session_rpe` [R04] via the single-validated-save-action law (store edit only); no new tables (column exists).
- **Evidence note:** today the store *derives* session RPE as the mean of rated sets [R03]; a direct athlete global rating is the Foster-method-aligned variant [S07, S08]. This discovery does not change the existing derivation; the option records the alternative for owner decision (08, UD-4).
- **Benefit:** evidence-aligned whole-session internal-load signal; complements per-set data; cheap.
- **Risk:** one more prompt at the moment of fatigue; must be dismissible-and-null-preserving (unanswered stays NULL [R03]).
- **Data:** manual. **Validation burden:** none beyond copy. **Privacy:** none beyond existing.
- **Offline:** full. **Accessibility:** full. **Device support:** all. **Failure-safe:** skip = NULL.
- **Memory:** zero.

## 5. Option O4 — Biometric context displayed beside, never converted into, athlete RPE

- **Architecture (smallest):** a read-only disclosure surface drawing from existing `state_vector`/`hrv_daily`/`sleep_daily` reads [R01, R01b] — e.g. on the Readiness surface, not the Session screen; no new ingestion, no new types, no new permission (already-held types only [R01]); pure formatter in inference for any derived display value; provenance + date shown (05 §4). Prerequisite: the RHR declaration gap (UD-9, `05` §1b) must be resolved by the owner before any Play filing touches the current permission set.
- **Benefit:** gives the already-connected athlete visible value from data the app already holds; zero new collection.
- **Risk:** the *anchor-contamination* risk — a number near the RPE stepper can nudge self-reports; hence the boundary: context lives on the readiness surface, never beside the set-entry UI; copy states what each number is and is not (05 §5).
- **Data:** existing three types. **Validation burden:** comprehension/usability only. **Privacy:** consent copy update + Health declaration consistency check [D02, D04]; no new permission.
- **Offline:** full (local reads). **Accessibility:** theme-token components, screen-reader labels mandatory.
- **Device support:** Android+HC only today; iOS lacks the bridge [R02] — the surface must show "not available" without implying failure.
- **Failure-safe:** absent/stale/denied → explicit "not available" states [05 §9].
- **Memory:** zero delta (rows already in DB).

## 6. Option O5 — Individually calibrated advisory estimate with explicit uncertainty (GATED; NOT RECOMMENDED NOW)

- **Prerequisite chain (all mandatory, in order):** pilot per `06` executed and reported → owner/domain-expert threshold ratification → privacy review refresh (05) → fresh independent audit → owner implementation authorization. Any unmet step = this option stays hypothetical.
- **Architecture if ever:** pure per-athlete calibration module in `packages/inference` (closed-form, deterministic — e.g. per-athlete regression on day-scale features; no runtime ML per the project's closed-form-only posture [R01b]); per-athlete parameters in a new profile-scoped table (append-only migration, STRICT, provenance columns); output type carries `{estimate, interval, basis, staleness}`; UI renders interval + disclosure, never a bare point; hard runtime guard that it cannot write or display within the RPE entry flow; feature-flagged off-by-default with rollback = flag flip (no migration rollback).
- **Benefit (conditional on validation):** the only candidate with any scientific pathway to usefulness.
- **Risk (unconditional):** false reassurance at high effort; construct confusion; per-athlete data sparsity (needs ≥10 rated sessions per athlete per 06 §2); copy burden of expressing uncertainty honestly [S12's ceiling makes this hard].
- **Data:** existing three types + pilot capture. **Validation burden:** the entire 06 protocol. **Privacy:** per-athlete stored parameters are new personal data — deletion, export, and transparency duties (05 §4–5).
- **Offline:** must be (on-device compute, no cloud inference).
- **Accessibility:** interval + plain-language disclosure doubles as accessibility.
- **Device support:** Android+HC owners with sufficient history only — a privileged subset that must not become a two-tier product experience.
- **Failure-safe:** low-confidence or sparse-data → no estimate displayed (never a guess); athlete disagreement path (05 §9).
- **Memory:** parameter rows are tiny; the pilot's capture features must not enter the shipped app (research build or offline analysis, 04 §9).

## 7. Option O6 — No biometric effort feature (the null option)

Identical to O1 plus nothing: the app ships today's honest subjective instrumentation, biometrics remain what they are (readiness inputs), and the research record (02, 03) documents why. This option is what RESEARCH PILOT ONLY collapses to for product purposes: the pilot is research, not a feature. Benefit: zero risk, zero burden. Cost: none beyond opportunity.

## 8. Comparative matrix

| Criterion | O1 cues | O2 cue entry | O3 session prompt | O4 biometric context | O5 advisory | O6 none |
|---|---|---|---|---|---|---|
| Code surface | 0 | tiny | tiny | small | large | 0 |
| New permission | no | no | no | no | no | no |
| New schema | no | 1 column | none | none | 1 table | no |
| Validation burden | none | copy | copy | comprehension | full 06 | none |
| Privacy burden | none | minimal | none | declaration update | per-athlete params | none |
| Offline | full | full | full | full | must | full |
| 4 GB risk | none | none | none | none | contained | none |
| Failure-safe | existing | null-stays-null | null-stays-null | not-available states | no-show rule | existing |
| Evidence support | S01–S03, R05 | S10 (subjective only) | S07–S08 | R01b display | none yet | — |
| Construct risk | none | low | low | medium (anchoring) | high unless gated | none |

## 9. Boundary statements (what no option may do)

No option writes or displays anything inside the RPE entry flow except the athlete's own input and the ratified cues [R05]. No option adds biometric inputs to the readiness formula beyond the ratified HRV+sleep composition [R01b] — noting readiness already carries planned-prescription authority via the policy engine [R07], which is exactly why its inputs stay frozen. No option backfills NULLs [R03]. No option adds a permission or record type without a consuming feature, declaration, and owner ratification [D02, D04]; the existing RHR gap (UD-9) must be resolved before any filing. No option speaks medically (05 §7). O5 additionally: never ships without the full 06 chain.
