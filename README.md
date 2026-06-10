# Athlete Kinetics

[![CI](https://github.com/FDOTPike/athlete-kinetics/actions/workflows/ci.yml/badge.svg)](https://github.com/FDOTPike/athlete-kinetics/actions/workflows/ci.yml)

A **free, offline, on-device** training intelligence app for strength + grappling
athletes. It tracks mechanical load (sets / reps / tonnage / RPE) and passive
biometrics (HRV, sleep, SpO2), computes a daily **System Readiness Score**, and
prescribes today's load/sets/RPE adjustment — entirely on your phone.

**Cost principles (non-negotiable):**

- **No cloud, no account, no subscription.** Every byte stays in a local SQLite
  file. There is no server to pay for and nothing to leak.
- **No required downloads, no LLM.** The prescription engine is a deterministic
  policy table (`packages/inference/src/policyReference.ts`) that runs in
  microseconds on any device. Subjective reports ("knee feels 3/10 sore") are
  handled by a **Vector-Heuristic pipeline**: a ~23 MB sentence-embedding model
  routes free text to a curated Phrase Codebase by cosine similarity, and pure
  TypeScript guardrails apply hardcoded, human-reviewed consequences. Peak RAM
  for the entire intelligence layer is ~100 MB transient — the former 1 GB+
  generative SLM (and its Jetsam risk) is gone.
- **Accessible interaction.** Dark, high-contrast, 56–88 pt touch targets,
  keyboard-free logging (built for chalked/sweaty hands), accessibility roles
  and labels on every control, no animations.

## Repository layout

```
apps/mobile/            React Native app (Hermes) — screens, Zustand store
packages/core-db/       SQLite schema (3 domains), pragmas, migrations
packages/inference/     policy table, Vector-Heuristic semantic triage, contracts
  └── assets/           phrase-codebase.json + pre-embedded vectors
scripts/                seed-db.ts (180-day athlete), embed-codebase, benchmarks
tools/memory-audit/     budget gate: recomputes RAM footprint vs audited limits
```

Objective path: `set_record`/telemetry → trigger-maintained rollups → windowed
view (ACWR, HRV baselines) → **materialized `state_vector`** (one row per day)
→ deterministic policy table → `AdjustmentVector` (load ×, sets ±, RPE cap,
one blunt cue).

Subjective path: athlete free text → MiniLM embedding (one short string,
on-device) → cosine top-k over the pre-embedded Phrase Codebase (Path A:
JS-memory `Float32Array` scan — measured 0.8–8 ms on Hermes at codebase scale,
sqlite-vec escalation documented for ≥50k vectors) → confidence gate (reject
below 0.55) + ambiguity gate (ties resolve to the more conservative guardrail)
→ hardcoded TypeScript guardrail composed onto the policy vector. **Safety
invariant, machine-verified: a subjective report can only ever make a session
more conservative**; halts (sharp pain, dizziness, chest symptoms) end it.

## Quickstart (no device needed)

```powershell
npm install
npm run verify:all     # 80+ checks: schema, grammar, policy, store SQL, memory gate
npm run seed           # deterministic 180-day athlete -> athlete_kinetics.seed.db
```

## Running the app

**On a phone, no toolchain needed:** every push builds a sideloadable APK in
CI. Grab it from [Actions](https://github.com/FDOTPike/athlete-kinetics/actions)
→ latest green run → Artifacts → `athlete-kinetics-apk`, copy it to an
Android phone, and install (enable "install unknown apps" for your file
manager). It is signed with the public RN debug keystore — fine for testing,
re-signed properly for releases.

**Local development** (native projects live in `apps/mobile/{android,ios}`):

```powershell
npm install
npm run android   # needs a local JDK 17 + Android SDK
# iOS (on a Mac): cd apps/mobile/ios && pod install && npm run ios
```

After editing the Phrase Codebase, regenerate its vectors (free, local):

```powershell
npm run embed:codebase
```

## Verification suite

Every layer ships with a runnable verifier; all must pass before a change lands.

| Command                | Proves                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run typecheck`    | strict TS across app + packages against real library types          |
| `npm run verify:db`    | schema, triggers, ACWR/HRV window math, query plans (real SQLite)   |
| `npm run verify:policy`| 10k-row state-space sweep stays inside the output contract          |
| `npm run verify:semantic` | live routing with the real embedding model (15 query cases incl. off-topic rejection), asset alignment, guardrail conservativeness |
| `npm run verify:store` | every store SQL statement prepares against the live schema          |
| `npm run verify:memory`| RAM footprint vs jetsam limits; gates the generative stack out      |
| `npm run bench:cosine` | the Path A (JS cosine) vs sqlite-vec decision data                  |

## Why there is no LLM in this app

There was one. A live-fire evaluation ran real Qwen 0.5B/1.5B GGUF weights
through a GBNF-constrained prompt against the seeded athlete's history: the
grammar held 100% (malformed output was unsamplable), but **both models
emitted constant prescriptions regardless of input** — including "hold the
plan" on a readiness-20, ACWR-1.95 overreach morning — while correctly
echoing the input numbers into their prose. Grammar guarantees form, not
semantics; sub-3B quantized models cannot reliably execute chained numeric
comparisons. A generative model used as a rigid logic gate was pure
architectural liability (≥1 GB RAM against iOS Jetsam) with zero numeric
contribution, so it was removed. The replacement Vector-Heuristic pipeline
keeps the only thing embeddings are actually good at — meaning-matching free
text — and leaves every consequence to deterministic, reviewable TypeScript.
The coaching cue is mechanical-rationale only; the app gives no medical advice.
