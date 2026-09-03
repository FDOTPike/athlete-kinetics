# 08 — Decision Docket

A bounded record of what this discovery decided, what it deliberately left open, and who owns each open item. Companion to `00` (the decision) and `07` (the options).

## 1. Decisions made by this discovery (within WO authority)

| ID | Decision | Basis | Where |
|---|---|---|---|
| D-MADE-1 | Decision token: RESEARCH PILOT ONLY (no prescription, no athlete-facing estimate) | evidence synthesis 02; WO §8 tokens | 00 §1 |
| D-MADE-2 | SpO2: do not collect, any configuration, any purpose | no effort evidence [S13/S18/S24 context]; policy burden [D01/D02/D04]; prior ruling [R02] | 00 §3; 05 §8; 04 §6 |
| D-MADE-3 | Constructs: six-class separation law (observed biometric / derived feature / readiness / advisory / actual RPE / target RPE) | Calibration Policy v1 [R01, R01b]; WO §7 | 01; 07 §1 |
| D-MADE-4 | No biometric quantity may fill, grade, or sit inside the RPE entry flow | WO §3 boundaries; null law [R03] | 00 §4; 07 §9 |
| D-MADE-5 | Manual/subjective constructs (cues, optional cue entry, post-session session-RPE) are the only forward product candidates | [S01–S03, S07, S08, S10, R05] | 07 O1–O3 |
| D-MADE-6 | Biometric context display (O4) is a **hypothetical readiness-surface option only, never an effort-entry candidate** (consistency with D-MADE-5 clarified per Round 4 review); if ever built it lives on the readiness surface with whatever provenance the schema actually supports (`07` O4) — never beside set entry | anchoring-contamination risk; 05 §5 | 07 O4 |
| D-MADE-7 | The validation pilot (06) is the only authorized forward artifact and requires separate owner ratification before execution | WO §5; decision token | 00 §1; 06 §0/§11 |
| D-MADE-8 | No new Health Connect record type, no new permission, no schema change proposed by this discovery | minimization [D02]; 04 feasibility | 04 §1/§10 |
| D-MADE-9 | Pilot thresholds in 06 §8 are unratified placeholders — explicitly owner/domain-expert decisions | WO §5 ("do not invent acceptance thresholds") | 06 §8/§11 |
| D-MADE-10 | Audit remediation (REQUEST CHANGES, 5×P1): S12 corrected to two-class/n=10/85.7% KNN; three-band "ceiling" justification withdrawn; direct resistance-training literature added ([S25] PERSIST, [S26] BSPC, [S27] Sensors) with bounded conclusions; `06` redesigned into Arm P (population, athlete-disjoint) and Arm I (individualisation, chronological) with contemporaneous-RIR leakage rules; readiness re-attributed as a prescription input [R07]; RHR no-consumer gap disclosed (UD-9); memory claim bounded; retention stated as-built; partial-grant model documented; citation repairs (S16/S18/S19/S20/S21, S24 split out, D05 replaced by page-dated publishing row) | independent audit of the first freeze; remediated at high effort on the same branch | `09` §11; per-document correction notes |

## 2. Unresolved decisions requiring an owner (or owner-delegated domain expert)

| ID | Unresolved decision | Why it is open | Suggested owner |
|---|---|---|---|
| UD-1 | Ratify or reject the pilot protocol itself (06): execute, amend, or shelve | owner gate per 06 §11 | Francis Pike + domain expert |
| UD-2 | Adopt/reject/move candidate validation thresholds, **with the arm assignments from `06` §8 carried over so none is applied to the wrong arm** (per Round 4 review): within-athlete set-RPE **MAE ≤ 0.5 in Arm I**; high-effort miss rate **≤ 10% in either arm**; secondary-band superiority **within the same arm**; no harmful-direction subgroup bias | WO forbids executor-invented thresholds | Owner + domain expert |
| UD-3 | Option ranking among O2 (cue entry), O3 (session-RPE prompt), O4 (biometric context) for any future product cycle | product judgment; friction trade-offs; not evidence-resolvable here | Francis Pike |
| UD-4 | Whether session RPE should become a direct athlete global rating (Foster-aligned) instead of / alongside the current mean-of-rated-sets derivation [R03] | touches existing behavior; WO scope excludes behavior change this run | Francis Pike |
| UD-5 | iOS bridge path (HealthKit) — out of scope here; interacts with O4/O5 device support | separate platform work order | Francis Pike |
| UD-6 | Whether the `spo2_component` column should be formally deprecated in a future migration vs left neutral-excluded | schema change is outside this discovery's authority | Francis Pike |
| UD-7 | Pilot data governance sign-off (retention limit, export mechanics, ethics/consent text) if UD-1 = execute — **including the IRB/EC requirement** (`06` §11, added per second audit) | 06 §9/§11; `05` §1 bounded pilot retention | Owner + IRB/Ethics Committee |
| UD-8 | Disposition of this docket after the post-remediation Codex/Sol audit (accept token, re-open decisions, commission deeper evidence review) | audit outcome pending | Francis Pike |
| UD-9 | Resting-heart-rate consuming-feature gap: drop the RHR request, give it a real consuming feature, or document an explicit justification — before any Health apps declaration is filed. **Accurate and complete current handling (per Round 3 closure) [R09]:** RHR is requested and read; it is stored **alongside** an `hrv_daily` row when that day's rMSSD exists, while an RHR-only day merely updates an already-existing row and is **not persisted at all** where none exists (`useStore.ts:4232-4243`); it contributes nothing to readiness, planned load, planned sets or the RPE cap [R01b]; it **is** exposed through `loadMeasuredHistory` (`useStore.ts:4384-4405`); and it **is** counted toward the developer-facing `hrvDays` diagnostic availability window (`coachVerificationLab.ts:362-377`). Neither the history accessor nor the diagnostic count is an athlete-facing feature, so neither satisfies Google's user-facing-benefit test [D02, D05] and **UD-9 remains valid** | Play per-data-type justification requires a user-facing consuming feature [D02, D05]; none exists, and neither the internal history accessor nor the diagnostic count qualifies [R09] | Francis Pike |
| UD-10 | **Product-copy defect (added per second audit):** the ProfileScreen connected-state copy claims resting heart rate "feeds your readiness score" (`apps/mobile/src/screens/ProfileScreen.tsx:415`), contradicting the live materialization [R01b]. **Scope widened per Antigravity panel P2-9 — deleting the words "resting heart rate" is not a sufficient fix.** The same string is a *static bundle*: it names HRV, RHR and sleep together and renders whenever bridge status is `ready`, which the bridge sets when **any** requested permission is granted (`healthConnect.ts:83-98` [R08]). An athlete who grants sleep and denies HRV is therefore told all three feed readiness. The remediation must render **per-type granted/denied status dynamically** and describe only the types actually granted and actually consumed. Fix is a code change — outside this documentation-only work order — and must land before any consent/declaration copy repeats the claim | user-facing accuracy + Play policy accuracy requirement [D02] | Francis Pike (code remediation work order) |

## 3. Scientific disagreements the evidence leaves open (recorded, not resolved)

- **Perceptual noise floor vs advisory resolution:** the ~1-RIR near-failure error [S03] suggests any advisory must be coarser than intuitive appeal; a domain expert may reasonably disagree about where the honesty floor sits.
- **Individual HRV reactivity:** group-level stress associations [S15] with wide individual variability — whether *any* per-athlete HRV-based feature can beat simple baselines is exactly what the pilot tests; the evidence does not settle it.
- **Session-RPE framing:** Foster-method global rating [S07] vs the app's mean-of-rated-sets [R03] measure related-but-different things; which the product wants is a construct decision, not an evidence one.
- **Wearable HRV provenance heterogeneity** (`04` §3, Configuration S2): whether vendor-normalization is required before any per-athlete feature work — an open engineering-science question the pilot design isolates but does not answer.

## 4. Acceptance-criteria mapping (WO §10 → where satisfied)

| WO §10 criterion | Status | Where |
|---|---|---|
| every scientific claim has a source-manifest row | DONE | 03; cross-check run in verification |
| primary research + official documentation support material claims | DONE | 02; 03 types |
| set RPE / session RPE / readiness never conflated | DONE | 01 §13; 07 §1 |
| no code or permission changes | DONE | git verification; docs-only diff |
| uncertainty and missingness first-class | DONE | 05 §5/§9; 06 §5; 04 §10 |
| phone-only and wearable-assisted modes separated | DONE | 04 §2–§8 |
| SpO2 explicit ruling | DONE | 00 §3; 05 §8 |
| validation prospective and athlete-separated | DONE | 06 §2/§7 |
| privacy and deletion behavior specified | DONE | 05 §1–§4 |
| manual RPE remains authoritative and optional | DONE | 00 §4; 05 §9/§10; 07 §9 |
| **both independent reviews attached** | **BOTH COMPLETE — both returned REQUEST CHANGES** (Reviewer A vs `337778f1` + re-verification of `756b031`; Reviewer B vs `8c9c9a3`); all findings remediated, **no re-review run, no approval issued**. Whether that satisfies the criterion is the owner's call — not claimed here (swept per Reviewer B B-1) | 09 §§13–14 |
| owner receives bounded go/no-go | DONE | 00 |

## 5. Reviewer instructions (for tomorrow)

**Both review lenses have now been run** (swept per Reviewer B B-1; this section previously still said “un-started”). Reviewer A (evidence) returned **REQUEST CHANGES** against `337778f1`, with a targeted re-verification of the remediation `756b031` that opened one further finding; Reviewer B (engineering/privacy) returned **REQUEST CHANGES** against `8c9c9a3`. Both records are reproduced in `09` §§13–14. **Neither returned an approval, none was fabricated, and no reviewer has re-reviewed the post-remediation state.**
