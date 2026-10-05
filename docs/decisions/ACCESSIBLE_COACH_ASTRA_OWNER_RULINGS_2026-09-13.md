# Accessible Coach — Astra Product-Owner Rulings

## 1. Authority and boundary

- Date: 2026-09-13.
- Product authority: Francis explicitly delegated the open product decisions to Astra.
- Decision-maker: GPT-6 Astra at high effort, acting as product owner.
- Clinical authority: not delegated and not obtained.
- Architecture: offline, deterministic, athlete-local, with no runtime LLM dependency.

```text
PRODUCT OWNER AUTHORITY: FRANCIS-DELEGATED TO ASTRA
PRODUCT DECISIONS: RATIFIED WITH EXPLICIT CLINICAL EXCLUSIONS
CLINICAL APPROVAL: NOT OBTAINED
MIGRATION 064: PRODUCT-AUTHORIZED FOR BOUNDED CAPTURE/ACCOUNTING/HOLD SLICE
WO-05: AUTHORIZED WITHIN RATIFIED PRODUCT SCOPE
WO-06: CAPTURE AND MECHANICAL REVIEW-HOLD BOUNDARY AUTHORIZED
WO-07: CAPABILITY ASSESSMENT AUTHORIZED; LIVE ALERTS NOT AUTHORIZED
PUSH / MERGE / RELEASE: NOT AUTHORIZED BY THIS RECORD
```

Migration 064 remains conditional on rechecking that 064 is still the next free slot, finalizing one shared contract, and passing schema, self-heal, backup-inventory and integration verification. This record does not authorize an excluded clinical field or behavior.

## 2. Policy rulings

| ID | Ratified product ruling | Required invariant |
|---|---|---|
| D01 | Option A: prefill only explicitly confirmed familiar activity and user-selected available time. Unknown dose stays unknown. | Setup never fabricates activity, dose or additional exercise. |
| D02 | Option A is the target; Option B is the explicit interim boundary. Remove experience-only workload uplift in a separately reviewed programming change. | Tier alone must not add minutes, sessions, sets, effort or fatigue budget in the conforming flow. Existing eligibility and beginner protections remain until separately ruled. |
| D03 | Option A: show the preceding 28 completed local calendar days and a separately dated typical-week report. | Missing logs never mean rest or inactivity; the typical week is not counted as completed work. |
| D04 | Amended A: store whole-session elapsed minutes and nullable expected/actual Effort separately, with scale ID/version, report time and provenance. Use an optional custom whole-session Effort 1–10 scale with plain-language anchors. | Duration-only logging works. No RIR conversion, aerobic classification, cross-sport equivalence, safety score or computed duration-times-effort score in this slice. |
| D05 | Option A: stable definition, series and occurrence identities with explicit completion/coached-session links. | Rename/reschedule preserves identity; a real session contributes once; fuzzy matching never auto-merges. |
| D06 | Option A: fixed commitments are calendar facts; flexible work may use only confirmed remaining time. | Duration caps are ceilings, conflicts are visible, and a cancelled activity never silently creates harder work. |
| D07 | Option A, capture-only: use `not_assessed | pending_review | review_required`; commission APSS-first/ACSM-comparator review. | No screening questionnaire, clearance transition, diagnosis or factual-use exclusion is authorized. |
| D08 | Option A, transcription-only: explicit instruction records, revisions, scopes, confirmation, provenance, dates and identity. | Free text is non-executable; confirmation neither verifies a clinician source nor activates/releases a medical limit. |
| D09 | Option A: represent capability, connection, source kind and timestamp truthfully, defaulting to unavailable/unknown. | Historical imports cannot become live streams by relabelling and unavailable monitoring cannot yield a safe/monitored state. |
| D10 | Option A: commission independent clinical review of legacy experience-dependent symptom assumptions. | Preserve existing hard stops pending review; legacy passing tests are not clinical validation. |

## 3. Shared-contract rulings

| ID | Ratified product ruling | Required invariant |
|---|---|---|
| SC-01 | Normalize definitions, recurrence series, occurrences/actuals, instruction envelopes/revisions, scopes, preferences/notes, holds and recommendation provenance in one shared contract. | Use athlete-database isolation plus verified athlete-ID adapter binding; do not use `profile_slot` as athlete identity. Backup covers every durable entity. |
| SC-02 | Store local civil recurrence plus IANA zone; materialized instances store resolved instants and resolver/rule version. | DST gaps/overlaps require a visible explicit choice; travel does not silently move the home zone; date-only is not midnight; split known minutes without duplicating session counts. |
| SC-03 | Use `low | moderate | high | unknown` as broad non-medical demand with source/missingness. | Custom names create no demand inference; unanswered is unknown, not low. |
| SC-04 | Authorize the capture schema with an empty executable-limit set. | Migration 064 contains no numeric medical metric/operator/unit/value table, screening answers, verified-source state or clinical-policy claim. |
| SC-05 | Athlete-entered guidance is `user_reported` and `not_verified`. | UI states: “Clinician instruction, entered by you — not independently verified.” |
| SC-06 | Use deterministic mechanical review holds for unresolved scopes, reported conflict and revision/date uncertainty. Unknown scope holds all personalized advice for that athlete. | Every prospective-advice entry point is guarded; history, stop, editing and retrospective logging remain available. Proven-disjoint work may continue without a clearance claim. |
| SC-07 | Full replacement restore only. Validate and preview first, then create a confirmed usable recovery backup before atomic replacement. | Cancel, error or low storage leaves current data intact; no merge restore or silent omission of support rows. |
| SC-08 | No new experience-only uplift and no new less-conservative beginner symptom policy. | New accessible paths cannot bypass review holds through legacy planners. |
| SC-09 | Missing relevant onboarding facts produce `setup_required` before new personalized recommendations. | Storage defaults remain compatibility data and are never advertised as athlete-specific advice. |

## 4. Supplemental product rulings

### 4.1 Privacy and deletion

- `PO-PRIVACY-01`: keep sensitive details athlete-local and collapsed. Do not put health prose in previews, notifications, telemetry, errors, diagnostics or durable recommendation evidence. Persist decisive IDs, revisions and reason codes instead. Coach Mode is not authentication; app-lock design is deferred.
- `PO-DELETE-01`: deleting an instruction atomically removes sensitive revisions, scope text and derived caches. If an unresolved review protection depended on it, retain only a content-free `deleted_support_review` / `support_deleted` hold marker and the minimum identity scope needed to avoid silently releasing advice. If scope is unavailable, hold athlete-wide. Explain this before deletion. Do not retain a deleted-prose hash or manufacture clearance.
- `PO-BOUNDS-01`: technical resource bounds are 16,000 Unicode code points per instruction revision; 4,000 per note/detail/scope; 160 for issuer; and per athlete 256 notes, 64 instruction envelopes, 64 revisions per instruction, and 256 scope rows per revision or hold. Reject excess clearly; never truncate or auto-delete. These are storage bounds, not medical ranges.

### 4.2 Backup and taxonomy

- `PO-BACKUP-01`: full backups, including recovery snapshots, must use reviewed password-protected authenticated encryption. No plaintext fallback and no app password recovery. Explain that loss of the password loses access and a same-phone copy does not protect against phone loss. Library, KDF and format selection remain an owned technical design; do not invent cryptography. CSV is not a restorable backup.
- `PO-TAXONOMY-01`: ratify WO-08 `P1-ACTIVITY-01` unchanged as log-only taxonomy, including its 15 kind IDs and supporting facility/equipment/requirement/modality/purpose vocabularies. `custom` is required in the first slice. This creates no coached movement, whitelist, technique, dose or suitability rule.
- `PO-COPY-01`: approve the WO-06 wording “Passes the app’s current reported-joint checks”, “No replacement is available under the current app checks”, “Session adjusted”, and “Session stopped”, without changing persisted outcome IDs.

## 5. Authorized sequence

1. Verify and close Opus F1/F2 accessibility findings.
2. Land one shared contract and the bounded Migration 064 capture/accounting/mechanical-hold slice.
3. Implement WO-05 factual activities and the WO-06 capture/review-hold boundary.
4. Implement encrypted backup/replace-only restore against the final schema.
5. Run persona, schema-upgrade, backup round-trip and native accessibility acceptance.
6. Assess native monitoring independently; do not ship live alerts without the missing clinical and native evidence.

Animations remain optional and last.

## 6. Clinical review still required

This record does not decide or authorize screening instruments/questions/transitions; medical numeric ranges, units or operators; symptom thresholds or experience-dependent symptom semantics; instruction compatibility/supersession authority; positive exercise permission; expiry-based clinical interpretation; live-sample freshness/warning/recovery timing; POTS treatment/progression; hydration/salt advice; or condition-specific exercise suitability.

The mechanical review hold is product-authorized. Interpreting an instruction or declaring it clinically satisfied is not.

## 7. Deferred implementation/research

Deferred: automatic starter dose; the reviewed replacement for legacy tier-based budgets; computed duration-times-effort presentation; executable clinical limits and screening; live alerts; merge restore; authentication/app lock; detailed activity metrics; adaptive movement curation; exhaustive catalogue; and movement animations.

