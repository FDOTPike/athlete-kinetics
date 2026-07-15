A free, offline, on-device training intelligence app for strength + grappling athletes. It tracks mechanical load (sets / reps / tonnage / RPE) and passive biometrics (HRV, sleep, SpO2), computes a daily System Readiness Score, and prescribes today's load/sets/RPE adjustment — entirely on your phone.

Cost principles (non-negotiable):

No cloud, no account, no subscription. Every byte stays in a local SQLite file. There is no server to pay for and nothing to leak.
No required downloads, no LLM. The prescription engine is a deterministic policy table (packages/inference/src/policyReference.ts) that runs in microseconds on any device. Subjective reports ("knee feels 3/10 sore") are handled by a Vector-Heuristic pipeline: a ~23 MB sentence-embedding model routes free text to a curated Phrase Codebase by cosine similarity, and pure TypeScript guardrails apply hardcoded, human-reviewed consequences. Peak RAM for the entire intelligence layer is ~100 MB transient — the former 1 GB+ generative SLM (and its Jetsam risk) is gone.
Accessible interaction. Dark, high-contrast, 56–88 pt touch targets, keyboard-free logging (built for chalked/sweaty hands), accessibility roles and labels on every control, no animations.
