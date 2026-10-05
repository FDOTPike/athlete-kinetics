# WO-08 activity and movement coverage inventory

Date: 2026-09-12 (Australia/Sydney). Branch: `codex/ac-wo08-inventory`. Frozen base: `cc39b15`. Status: **current-state inventory and implementation-ready curation design only**. No product code, SQL, migration, generator output, movement eligibility, whitelist, store, profile, UI, package or native change is included.

## Bottom line

The current database is a complete 300-row **coached movement** corpus, but it is not a general activity catalogue. Only `BJJ Sparring Round`, `Road Run`, and `Trail Running/Walking` are marked as sport-tracking movements. Generic walking, swimming, cycling, existing gym sessions, common team sports, wheelchair/adaptive activities and a custom-activity fallback are not represented by a distinct persisted activity/occurrence contract at this base.

The first implementation batch should therefore be log-only activity kinds, not more coached movement rows. It must preserve the difference between an activity occurrence (duration, whole-session effort if reported, scheduling and completion identity) and a coached exercise record (movement instructions, sets/reps/time target, equipment and movement eligibility). Any numerical dose, sport-specific progression, medical adaptation or cross-sport equivalence remains unsupported pending the WO-04 owner/clinical checkpoints.

## Evidence boundary and terminology

- **Supported** means the current schema and seeded data directly represent the named capability. It does not mean clinically validated, exhaustive or device-tested.
- **Missing** means no current persisted/source representation was found in the inspected scope.
- **Duplicated** means the source catalogue or manifest deliberately represents more than one label for one identity. Shared family/base names alone are not called duplicates.
- **Needs adaptation** means a nearby current representation exists, but its identity, units or semantics are unsuitable for the requested activity contract without reviewed change.
- **Unsupported prescription** means descriptive logging may be possible later, but the evidence/policy does not authorize the app to prescribe dose, progression, suitability or clinical safety.

`movement.pattern` is an 11-value strength/movement domain (`packages/core-db/src/schema/001_mechanical_input.sql:48-55`), while `movement_taxonomy` is an eight-category biomechanical side-car (`packages/core-db/src/schema/008_taxonomy.sql:19-26`). The current sport marker is only a one-column membership table (`packages/core-db/src/schema/051_routine_access_context.sql:18-20`). These are not substitutes for an athlete-owned activity definition and occurrence identity.

WO-04 proposes that activity identity, facilities and equipment remain separate, custom names remain valid, and unknown kind/demand remain unknown (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:40`, `docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:50`, `docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:80`). That contract and migration 064 are explicitly proposed/not ratified (`docs/decisions/ACCESSIBLE_COACH_SHARED_CONTRACT_DOCKET.md:5-6`).

## Mechanically reproduced current snapshot

The append-only SQL chain through migration 063 was applied to an in-memory SQLite database, excluding the non-executable `004` template exactly as the library gate does. The following counts were queried from the resulting database on 2026-09-12:

| Surface | Current count | Interpretation |
|---|---:|---|
| `movement` | 300 | Unique coached movement identities. The existing gate asserts the exact 300-name corpus (`packages/core-db/test/verify_library.py:144-153`). |
| `movement_detail` with non-empty instructions and cues | 300 | Every current movement has coached content; the gate also checks 2–4 steps and 1–3 distinct positive cues (`packages/core-db/test/verify_library.py:293-297`). |
| `movement_taxonomy` | 300 | One biomechanical taxonomy row per live movement after the 21-row backfill (`packages/core-db/src/schema/056_movement_taxonomy_backfill.sql:1-31`). |
| `movement_equipment` | 401 rows / 11 tokens | Strength-equipment requirements only. The 11-token SQL domain is gated (`packages/core-db/test/verify_library.py:586-597`). |
| `movement_logging_mode = time` | 6 | BJJ, road run, trail run/walk, plank and two carries. Time is the only non-rep movement mode (`packages/core-db/src/schema/018_logging_modes.sql:19-40`). |
| `movement_sport_tracking` | 3 | Exactly BJJ sparring, road run and trail running/walking (`packages/core-db/src/schema/051_routine_access_context.sql:22-36`; gate at `packages/core-db/test/verify_library.py:376-388`). |
| Facility vocabulary/table | 0 found | No facility/pool-access/activity-occurrence token was found in the scoped product/schema search recorded below. |

### Distribution of the 300 live movements

| Axis | Counts |
|---|---|
| Movement pattern | carry 2; hinge 30; isolation 81; locomotion 3; lunge 12; pull_h 27; pull_v 21; push_h 44; push_v 21; rotation 35; squat 24 |
| Taxonomy category | accessory 79; cardio 3; core 32; hinge 24; push 62; row 48; squat 22; unilateral 30 |
| Difficulty | Beginner 174; Intermediate 106; Advanced 20 |
| Required equipment rows | bands 25; barbell 77; bench 91; boards 1; cable machine 63; dumbbells 74; kettlebell 23; mats 1; Nordic bench 3; pull-up bar 8; squat rack 35 |

The persisted equipment union is strength-oriented: ten standard tokens plus specialist `boards` (`packages/inference/src/types.ts:86-108`). Presets never grant the specialist token (`packages/inference/src/types.ts:189-196`). Prefix availability fails closed where the equipment vocabulary cannot express an implement (`packages/inference/src/types.ts:144-186`). There is no corresponding facility vocabulary; pool access therefore cannot be represented honestly as equipment.

## Strict current-state coverage matrix

Each row has exactly one classification.

| Priority surface | Classification | Current evidence | Exact current-state meaning |
|---|---|---|---|
| Coached resistance/bodyweight movements | **Supported** | 300 movements, 300 detail/taxonomy/content rows; 174 Beginner rows | Broad coached exercise coverage exists, subject to current equipment, tier, safety and capability gates. This says nothing about sport/activity logging breadth. |
| Road running | **Supported** | `Road Run` is cardio, sport-tracking, time-mode, 1 × 1,200 s (`packages/core-db/src/schema/023_phase17_session_foundation.sql:26-39`) | A coached timed movement can be planned/logged. It is not a recurring external-activity occurrence. |
| BJJ sparring | **Supported** | `BJJ Sparring Round` is sport-tracking, time-mode, requires mats and has a 5 × 300 s policy (`packages/core-db/src/schema/007_program_engine.sql:120`, `packages/core-db/src/schema/007_program_engine.sql:170`; `packages/core-db/src/schema/023_phase17_session_foundation.sql:26-39`) | The existing hybrid-specific sport case is present. It does not establish generic combat-sport coverage. |
| Trail running versus trail walking | **Needs adaptation** | One combined `Trail Running/Walking` movement is time-mode with 1 × 1,200 s (`packages/core-db/src/schema/048_movement_library_v2_batch.sql:9-24`, `packages/core-db/src/schema/048_movement_library_v2_batch.sql:102-106`) | Two activities are fused into one movement identity. Keep the shipped row untouched here; future activity kinds should distinguish walking from running without rewriting history. |
| Generic everyday walking | **Missing** | The only walking activity text is the combined trail row. `Walking Lunge` is a lunge exercise, not walking. Prefix-encoded/bodyweight walking-lunge aliases are deliberately not separately seeded (`packages/core-db/staging/seeded_manifest.json:3-5`, `packages/core-db/staging/seeded_manifest.json:311-316`). | No general walking activity occurrence exists. A walking-lunge set must never count as a walk. |
| Swimming | **Missing** | No live movement, sport marker, facility token or activity kind represents swimming. | Pool access and swimming identity cannot currently be stored separately. |
| Outdoor cycling | **Missing** | `Bicycling` is quarantined because `other` has no prefix token (`packages/core-db/staging/movement_quarantine.json:223-227`). | No live cycling activity exists. It should be activity logging, not forced through a strength implement prefix. |
| Stationary/recumbent/air cycling catalogue labels | **Needs adaptation** | `Air Bike`, `Bicycling, Stationary`, and `Recumbent Bike` are separate quarantined names (`packages/core-db/staging/movement_quarantine.json:45-49`, `packages/core-db/staging/movement_quarantine.json:229-233`, `packages/core-db/staging/movement_quarantine.json:1884-1888`) | These are distinct modality/equipment contexts under a cycling activity family, not assumed-equivalent coached prescriptions. Preserve the modality instead of seeding generic strength movements. |
| Prefix/alias duplicates already blocked in staging | **Duplicated** | The manifest lists two `prefix_encoded` and six `do_not_seed` labels (`packages/core-db/staging/seeded_manifest.json:3-5`, `packages/core-db/staging/seeded_manifest.json:311-318`) | These labels deliberately do not become extra live movement identities. Maintain this guard before any new movement curation. |
| Existing gym/strength session as an external commitment | **Missing** | `session` stores date/duration/RPE and `set_record` stores movement sets (`packages/core-db/src/schema/001_mechanical_input.sql:61-85`), but there is no external activity identity/occurrence link. | The app can log its own coached session; it cannot yet schedule/reconcile a separate existing gym session without double-count risk. |
| Everyday recreation (hiking, dancing, gardening, horse riding, surfing, skiing, similar) | **Missing** | No persisted custom activity path in the inspected product/schema scope. WO-04 specifies the desired unknown-custom behavior only as a proposal (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:80`). | These activities cannot yet be saved as neutral athlete-owned occurrences at this base. |
| Basketball, soccer, netball, rugby, cricket, hockey, volleyball | **Missing** | None is a live movement or activity kind; WO-04 uses Friday basketball as an unimplemented acceptance fixture (`docs/research/accessible-coach/WO04_PERSONA_POLICY_AUDIT.md:40`). | No claim of common-team-sport coverage is valid. |
| Wheelchair mobility/activity | **Missing** | Scoped source/schema search found no wheelchair token. Existing seated strength movements are position variants, not wheelchair activity identities. | Do not infer wheelchair suitability from `Seated` in a movement name. |
| Adaptive sport | **Missing** | No adaptive-activity identity, demand provenance or occurrence model exists. | A neutral adaptive/custom label must be loggable before any technique or suitability claim is considered. |
| Custom-activity fallback | **Missing** | Current WO-04 shared contract proposes custom names, but is not ratified/implemented (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:3`, `docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:40`). | Unknown activities cannot currently be persisted through the requested fallback. This is the highest-leverage gap because it bounds the non-exhaustive catalogue. |
| Activity facility requirements | **Missing** | No facility table/vocabulary exists; strength `EQUIPMENT_ITEMS` has 11 tokens and no pool/field/court/route (`packages/inference/src/types.ts:90-108`). | Pool is a facility, not equipment. Logging may retain unknown facility; later prescriptions must not assume access. |
| Activity equipment requirements | **Needs adaptation** | Current equipment is a movement executability gate and includes strength implements/mats/boards (`packages/inference/src/types.ts:110-186`). | Bicycle, handcycle, wheelchair, ball, racquet and protective gear need an activity-specific contract or explicit mapping; silently widening the strength inventory would change movement eligibility. |
| Whole-session duration and effort | **Needs adaptation** | Strength `session` has `duration_min` and `session_rpe`; movement sets may carry time (`packages/core-db/src/schema/001_mechanical_input.sql:61-85`; `packages/core-db/src/schema/018_logging_modes.sql:35-42`). | The units exist nearby, but there is no planned/actual activity occurrence, scale identity, fixed/flexible schedule or reconciliation key. Activity effort must not be converted to RIR. |
| Prescribed swimming/cycling/team-sport dose or progression | **Unsupported prescription** | WO-04 forbids a new universal sport progression percentage or first-week dose (`docs/research/accessible-coach/WO04_SOURCE_TO_RULE_MATRIX.md:9`, `docs/research/accessible-coach/WO04_SOURCE_TO_RULE_MATRIX.md:25`). | Log duration/effort after the contract lands; do not generate frequency, duration, intensity, drill content or progression from the kind ID. |
| Cross-sport load equivalence | **Unsupported prescription** | Duration × whole-session effort is optional descriptive arbitrary units only, never strength-set equivalence or a safety zone (`docs/research/accessible-coach/WO04_SOURCE_TO_RULE_MATRIX.md:13-14`). | Equal products do not make swimming, walking, basketball and strength interchangeable. |
| Wheelchair/adaptive or condition-specific exercise prescription | **Unsupported prescription** | Optional demands remain source-labelled/unknown and are not clearance (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:50`); clinical entry points require later review (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:88`). | Disability does not exclude logging, but no activity/movement is declared medically suitable by this inventory. |

## Existing duplication controls and unresolved live-family review

The staging manifest already prevents two prefix-encoded identities (`Barbell Glute Bridge`, `Barbell Walking Lunge`) and six explicit `do_not_seed` labels from becoming new movements (`packages/core-db/staging/seeded_manifest.json:3-5`, `packages/core-db/staging/seeded_manifest.json:311-318`). This is the correct direction: implement-only aliases do not buy activity coverage.

Mechanical grouping of the live database found 21 multi-row taxonomy-family clusters containing 49 rows, and 20 repeated-base-name clusters containing 42 rows. These clusters overlap and are **not automatically duplicates**: a family can legitimately contain a regression, unilateral form or implement-specific setup. Before any additional movement batch, a curator should adjudicate candidates against equipment, mechanics and existing prefix semantics. This WO does not delete, merge, rename or reclassify any live movement.

The quarantine contains 441 entries. Mechanical reason counts include 244 with no matched pattern, 122 with `other` equipment, 67 with `machine`, 123 stretching, 61 plyometric, 35 Olympic-weightlifting and 21 strongman exclusions. Those source rows are not a substitute for the activity taxonomy: stationary cycling and recumbent cycling are obvious examples where a strength-movement import pipeline produces the wrong abstraction.

## Proposed first priority batch — pending shared-contract ratification

Everything in this section is **PROPOSED, NOT RATIFIED, NOT IMPLEMENTED**. IDs and vocabularies are deterministic curation candidates for the integration owner; they do not authorize migration 064, movement IDs, prescriptions or eligibility changes.

### Proposed batch `P1-ACTIVITY-01` (15 log-only kinds)

| Proposed activity-kind ID | User-facing label | Coverage intent | Facility/equipment semantics | Logging help; no coaching prescription |
|---|---|---|---|---|
| `walking` | Walking | Everyday walking, including deliberate walks | No universal requirement; optional route/treadmill context | Record actual duration; whole-session effort is optional and may remain unknown. |
| `running` | Running | Road, track and trail running | No universal requirement; optional route/treadmill context | Record actual duration and optional whole-session effort. Do not supply a default pace or weekly increase. |
| `swimming` | Swimming | Pool or open-water sessions | Modality identifies `pool` or `open_water`; unknown allowed | Record whole-session duration and optional effort. Stroke, distance and intensity are optional future fields, not inferred. |
| `cycling` | Cycling | Outdoor, stationary, recumbent and handcycle sessions | Modality identifies bicycle/stationary cycle/handcycle where known | Record duration and optional effort. Do not infer road, resistance, distance or power. |
| `strength_training` | Gym or strength training | Athlete-led/external gym sessions | Optional facility/equipment snapshot; no full-gym assumption | Record parent-session duration/effort once; linked set detail must not add the parent duration again. |
| `basketball` | Basketball | Practice, game or social play | Optional court/ball context; unknown allowed | Preserve practice/game display name and fixed/flexible time; no sport dose. |
| `soccer` | Soccer | Practice, match or social play | Optional field/ball context; unknown allowed | Record duration and optional effort; no invented running distance or impact score. |
| `netball` | Netball | Practice or match | Optional court/ball context; unknown allowed | Record duration and optional effort; fixed commitments remain fixed. |
| `rugby` | Rugby | Code-neutral first-pass logging | Optional field/ball/protective-gear context; exact code stays in display name/notes | Do not infer contact exposure or combine league/union demands. |
| `cricket` | Cricket | Training or match | Optional field/equipment context; unknown allowed | Record duration and optional effort; do not infer workload from match duration alone. |
| `field_hockey` | Field hockey | Training or match | Optional field/stick/protective-gear context; unknown allowed | Record duration and optional effort; no position-specific load. |
| `volleyball` | Volleyball | Indoor, beach, practice or match | Optional court context; modality retained if supplied | Record duration and optional effort; do not infer jump count or surface. |
| `wheelchair_mobility` | Wheelchair mobility | Deliberate mobility/conditioning sessions | Personal mobility equipment is context, not a strength-inventory entitlement | Record duration/effort if supplied; no distance, terrain or suitability inference. |
| `wheelchair_sport` | Wheelchair sport | Neutral umbrella until a specific kind is curated | Retain the athlete's neutral display name and known equipment/facility context | Unknown demand remains unknown; the ID does not imply medical or sport-specific coaching. |
| `custom` | Another activity | Required fallback for niche/unknown activities | All requirements may be unknown; neutral user-defined name required | Save known time/status and optional effort. Never infer demands from the name. |

`custom` is deliberately in the first batch. This makes the catalogue bounded and avoids pretending that fifteen kinds cover every sport. Tennis/racquet sports, Australian-rules football, ice hockey, martial arts beyond the existing BJJ row, dance, hiking, equestrian activity, surfing, skiing and other activities remain usable only through `custom` until a later evidence-backed synonym/kind batch is reviewed.

### Proposed supporting vocabulary — pending ratification

These values are activity-contract candidates only; none should be added to `EQUIPMENT_ITEMS` or movement eligibility by this WO.

- Proposed requirement-state IDs: `known_available`, `known_unavailable`, `unknown`, `not_applicable`.
- Proposed facility-kind IDs: `pool`, `open_water`, `road_path`, `trail`, `court`, `field_pitch`, `indoor_space`, `gym`, `other`, `unknown`.
- Proposed activity-equipment IDs: `bicycle`, `stationary_cycle`, `handcycle`, `wheelchair`, `ball`, `stick`, `protective_gear`, `other`, `unknown`.
- Proposed cycling modality IDs: `outdoor_bicycle`, `stationary_upright`, `stationary_recumbent`, `handcycle`, `other`, `unknown`.
- Proposed occurrence purpose IDs: `practice`, `match`, `recreation`, `conditioning`, `transport`, `other`, `unknown`.

The required common fields remain those in the proposed shared contract: stable activity/series/occurrence identity; planned versus actual state; local time/timezone; fixed/flexible timing; duration basis; optional separately scoped whole-session effort; and explicit unknowns (`docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md:40-50`). The same real-world activity must not be counted twice (`docs/decisions/ACCESSIBLE_COACH_SHARED_CONTRACT_DOCKET.md:22-25`).

## Movement-library curation disposition

1. **Do not seed the quarantined cycling labels as movement rows.** Route them to proposed `cycling` modalities after shared-contract ratification.
2. **Do not create swimming strokes or team sports as coached movements merely to enable logging.** Activity occurrence comes first; technique/drill libraries would be separate evidence and curation work.
3. **Retain shipped sport rows unchanged in this WO.** `movement_sport_tracking` bypasses the ordinary difficulty ceiling (`packages/inference/src/tierPolicy.ts:24-39`), so adding membership is an eligibility-policy change, not harmless metadata.
4. **Return `Chair Squat` to a later movement review.** It is quarantined as `machine` (`packages/core-db/staging/movement_quarantine.json:424-428`), but a chair/bench/bodyweight requirement and its relation to existing squat rows need movement-identity, equipment and adaptive-coaching review. No beginner-whitelist change is proposed.
5. **Adjudicate live family/base clusters before adding obscure variants.** Activity gaps have higher priority than another curl, press or row variant.

## Validation cases for the eventual implementation

These are deterministic acceptance cases, not tests run by this documentation-only WO.

| Case | Expected result |
|---|---|
| Beginner reports two familiar swims and asks for a starting week | Both swims remain activity occurrences; pool is a facility; no automatic WHO-minutes target, stroke prescription or RIR conversion; movement whitelist remains the ratified eight. |
| User logs a 35-minute walk | Counts as `walking`; it never resolves to `Walking Lunge` and creates no reps/set record. |
| Outdoor cycle and recumbent-bike session | Both use `cycling`, retain distinct modality/equipment context, and remain separate occurrences. No duplicate activity-kind rows. |
| Friday basketball at 17:00 Australia/Sydney | Fixed occurrence stays at local 17:00 through recurrence materialization; nearby coach work moves or reports conflict, never the sport. |
| Basketball completion appears in manual activity and a linked imported record | One canonical occurrence contributes duration/effort once; no fuzzy near-time merge. |
| Planned swim is cancelled | Completed totals do not increase; plan history remains; freed time is not silently replaced by harder work. |
| Hobby horsing entered through `custom` | Neutral name persists; duration may count; missing effort/facility/demands stay unknown; no muscle or injury score is invented. |
| Wheelchair athlete logs mobility work | Log succeeds without disability-based exclusion. No strength equipment is granted and no movement is declared suitable. |
| User selects a team sport with facility unknown | Logging succeeds with `unknown`; any future facility-dependent prescription is held, not assumed available. |
| BJJ coached session and external BJJ occurrence refer to the same real session | Explicit linking prevents parent duration from being counted twice while retaining coached round/set detail. |
| Same inputs replayed offline | Activity-kind resolution, occurrence accounting and explanation ordering are byte-stable/deterministic. |
| Beginner eligibility regression | `movement_beginner_whitelist` remains exactly the current eight and sport/activity curation does not add movement membership (`packages/core-db/test/verify_library.py:345-356`). |

## Deferred and honestly unsupported coverage

| Priority | Deferred row | Reason / unblock condition |
|---|---|---|
| P0 | Persisted custom activity and occurrence contract | Await Francis's D01–D06 decisions and integration-owner ownership of reserved migration 064. Without this, the batch above is design only. |
| P0 | Facility/equipment separation | Ratify activity-specific vocab/mapping; do not widen strength equipment as a shortcut. |
| P1 | Specific adaptive-sport kinds and wheelchair-sport modalities | Co-design terminology with users/adaptive-coaching reviewer; logging can use custom meanwhile. |
| P1 | Tennis/racquet sports, Australian-rules football, ice hockey, combat sports beyond BJJ | Later high-frequency kind/synonym batch based on product audience; custom fallback prevents a hard block. |
| P1 | Walking/running legacy-row reconciliation | Define explicit lineage from existing `Road Run` and `Trail Running/Walking` history to activity occurrences; no fuzzy conversion or destructive rename. |
| P2 | Distance, pace, laps, stroke, elevation, power and position-specific fields | Add only when unit, source, missingness and duplicate laws are specified and backed up/restored. Duration remains the bounded first slice. |
| P2 | Chair-squat and other adaptive movement candidates | Movement identity, equipment truth, instruction review and qualified adaptation review required; no automatic beginner whitelist expansion. |
| P3 | Sport-specific session prescriptions, return-to-play rules, injury thresholds, recovery intervals and adaptive medical suitability | Unsupported until population-specific evidence, Francis ratification, qualified review and deterministic entry-point tests exist. |
| P3 | Exhaustive sport catalogue | Explicitly out of scope. A functional neutral custom fallback is the completeness mechanism. |

## Reproduction and source-count checks

Read-only mechanical checks used for this inventory:

1. Applied every `packages/core-db/src/schema/0*.sql` file except the `004` template to in-memory SQLite and queried counts/groupings. Result: 300 movements/details/taxonomies; 401 equipment rows; 6 time-mode movements; 3 sport rows; 21 multi-row taxonomy-family clusters/49 rows; 20 repeated-base clusters/42 rows.
2. Parsed `movement_import.json`, `movement_quarantine.json`, and `seeded_manifest.json`. Result: 434 import rows; 441 quarantine rows; 2 prefix-encoded names; 6 `do_not_seed` names.
3. Counted WO-04 evidence headings and matrix rows. Result: 11 external evidence entries (`E01`–`E11`), 2 local heuristic entries (`H01`–`H02`), and 13 source-to-rule rows (`R01`–`R13`). The register itself describes the same boundary (`docs/research/accessible-coach/WO04_EVIDENCE_REGISTER.md:128-132`).
4. Scoped absence search:

```text
rg -n -i --glob '!**/node_modules/**' --glob '!packages/inference/assets/**' --glob '!docs/**' --glob '!*.md' '\bfacilit(y|ies)\b|\bpool access\b|wheelchair|adaptive activit|activity_kind|activity_type|recurringActivity|activityOccurrence' packages apps scripts
MATCHES 0
```

The absence result is limited to those product/schema/source paths and tokens. It does not claim the words never occur in documentation, Android framework comments or unrelated research assets.
