# Auditor-derived calculation register

These calculations audit arithmetic only. They are not published evidence and are not recommendations.

| ID | Inputs and formula | Recalculation | Audit outcome |
|---|---|---:|---|
| CAL-01 | Antigravity Q2 example: `100 × (1 + (8 + 2)/30)` | 133.333 kg | Arithmetic correct. The assumed 2 RIR and assertion of a distinct “true e1RM” are not source-validated. |
| CAL-02 | Antigravity Q2 example: `100 × (1 + (8 + 5)/30)` | 143.333 kg | Arithmetic correct. Difference is 10.000 kg; 10/143.333 = 6.977%. This is conditional algebra, not a published error estimate. |
| CAL-03 | Antigravity Q5: `1.96 × √2 × 4.2%` | 11.642% | Arithmetic approximately correct. It misuses the review’s median CV as a SEM and transfers direct supervised 1RM reliability to RPE-adjusted e1RM without a validated error model. |
| CAL-04 | Antigravity Q5: `(11.642% / 3.5%)²` | 11.064 sessions | Arithmetic approximately correct under the stated IID/normal, fixed-effect assumptions. Those assumptions are neither tested nor appropriate grounds for a persistence window. |
| CAL-05 | Antigravity Q4 force span: `(74/41 − 1) × 100` | 80.488% | Arithmetic correct if the underlying values are first confirmed from the full source tables. It is a between-condition relative span, not a participant-specific calibration or movement coefficient. |

Reproducible expression set: `calculations/recalculate.py`.
