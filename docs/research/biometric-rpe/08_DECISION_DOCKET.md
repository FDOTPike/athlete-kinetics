# 08 — Decision Docket

A bounded record of what this discovery decided, what it deliberately left open, and who owns each open item. Companion to `00` (the decision) and `07` (the options).

## 1. Decisions made by this discovery (within WO authority)

| ID | Decision | Basis | Where |
|---|---|---|---|
| D-MADE-1 | Decision token: RESEARCH PILOT ONLY (no prescription, no athlete-facing estimate) | evidence synthesis 02; WO §8 tokens | 00 §1 |
| D-MADE-2 | SpO2: do not collect, any configuration, any purpose | no effort evidence [S13/S18/S21 context]; policy burden [D01/D02/D04]; prior ruling [R02] | 00 §3; 05 §8; 04 §6 |
| D-MADE-3 | Constructs: six-class separation law (observed biometric / derived feature / readiness / advisory / actual RPE / target RPE) | Calibration Policy v1 [R01, R01b]; WO §7 | 01; 07 §1 |
| D-MADE-4 | No biometric quantity may fill, grade, or sit inside the RPE entry flow | WO §3 boundaries; null law [R03] | 00 §4; 07 §9 |
| D-MADE-5 | Manual/subjective constructs (cues, optional cue entry, post-session session-RPE) are the only forward product candidates | [S01–S03, S07, S08, S10, R05] | 07 O1–O3 |
| D-MADE-6 | Biometric context display (O4), if ever built, lives on the readiness surface with provenance + dates — never beside set entry | anchoring-contamination risk; 05 §5 | 07 O4 |
| D-MADE-7 | The validation pilot (06) is the only authorized forward artifact and requires separate owner ratification before execution | WO §5; decision token | 00 §1; 06 §0/§11 |
| D-MADE-8 | No new Health Connect record type, no new permission, no schema change proposed by this discovery | minimization [D02]; 04 feasibility | 04 §1/§10 |
| D-MADE-9 | Pilot thresholds in 06 §8 are unratified placeholders — explicitly owner/domain-expert decisions | WO §5 ("do not invent acceptance thresholds") | 06 §8/§11 |

## 2. Unresolved decisions requiring an owner (or owner-delegated domain expert)

| ID | Unresolved decision | Why it is open | Suggested owner |
|---|---|---|---|
| UD-1 | Ratify or reject the pilot protocol itself (06): execute, amend, or shelve | owner gate per 06 §11 | Francis Pike + domain expert |
| UD-2 | Adopt/reject/move candidate validation thresholds (MAE ≤ 0.5, high-effort miss ≤ 10%, band-superiority, no-harmful-subgroup) | WO forbids executor-invented thresholds | Owner + domain expert |
| UD-3 | Option ranking among O2 (cue entry), O3 (session-RPE prompt), O4 (biometric context) for any future product cycle | product judgment; friction trade-offs; not evidence-resolvable here | Francis Pike |
| UD-4 | Whether session RPE should become a direct athlete global rating (Foster-aligned) instead of / alongside the current mean-of-rated-sets derivation [R03] | touches existing behavior; WO scope excludes behavior change this run | Francis Pike |
| UD-5 | iOS bridge path (HealthKit) — out of scope here; interacts with O4/O5 device support | separate platform work order | Francis Pike |
| UD-6 | Whether the `spo2_component` column should be formally deprecated in a future migration vs left neutral-excluded | schema change is outside this discovery's authority | Francis Pike |
| UD-7 | Pilot data governance sign-off (retention limit, export mechanics, ethics/consent text) if UD-1 = execute | 06 §9/§11 | Owner + ethics-literate reviewer |
| UD-8 | Disposition of this docket after Codex/Sol audit (accept token, re-open decisions, commission deeper evidence review) | audit outcome pending | Francis Pike |

## 3. Scientific disagreements the evidence leaves open (recorded, not resolved)

- **Perceptual noise floor vs advisory resolution:** the ~1-RIR near-failure error [S03] suggests any advisory must be coarser than intuitive appeal; a domain expert may reasonably disagree about where the honesty floor sits.
- **Individual HRV reactivity:** group-level stress associations [S15] with wide individual variability — whether *any* per-athlete HRV-based feature can beat simple baselines is exactly what the pilot tests; the evidence does not settle it.
- **Session-RPE framing:** Foster-method global rating [S07] vs the app's mean-of-rated-sets [R03] measure related-but-different things; which the product wants is a construct decision, not an evidence one.
- **Wearable HRV provenance heterogeneity** [04 S2]: whether vendor-normalization is required before any per-athlete feature work — an open engineering-science question the pilot design isolates but does not answer.

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
| **both independent reviews attached** | **PENDING — OWNER ASSIGNED TO CODEX/SOL** (owner override for this run; not claimed) | 09 |
| owner receives bounded go/no-go | DONE | 00 |

## 5. Reviewer instructions (for tomorrow)

The two review lenses the WO describes (evidence review; engineering/privacy review) are handed over un-started in `09_INDEPENDENT_REVIEW_HANDOVER.md`. Neither has been commissioned, run, or fabricated by this executor.
