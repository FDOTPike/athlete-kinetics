# Athlete App — Codebase Audit Report

**Repository:** `C:\Users\fpike\Documents\Claude Coding\Athlete App`
**Audit date:** 2026-07-15
**Method:** Source read-phase sweep (TypeScript, SQL migrations, test harnesses, scripts, config) + full `verify:all` execution.
**Verdict:** ✅ **HEALTHY — no critical defects.** All verification gates green; schema and code internally consistent; architecture disciplined.

---

## 1. Executive Summary

| Signal | Result |
|---|---|
| TypeScript compile (`tsc -p apps/mobile/tsconfig.json`) | 0 errors |
| `npm run verify:all` | exit 0 — **16 gate suites, all PASS** |
| Source files examined (TS/TSX) | 43 across 4 packages |
| SQL migrations cross-checked | 23 (`001`–`023`) + runner |
| Secrets / TODO / FIXME in source | none found |
| Circular deps / broken alias paths | none found |

The codebase is production-shaped. The most subtle risk surface — the migration runner's async-boot race and the `user_profile → athlete_profile` evolution — was explicitly engineered against and is demonstrably correct. The semantic/embedder layer is machine-verified for tokenizer + vector parity against the device model.

**One apparent contradiction was investigated and resolved as intentional design (not a defect):** `migrationRunner.ts` comments that `user_profile` "is intentionally NOT a sentinel: 007 supersedes it." This is accurate — `007_program_engine.sql:107` executes `DROP TABLE IF EXISTS user_profile;` after copying the legacy row into `athlete_profile`, and the store writes to `athlete_profile` (`useStore.ts:754`). No stale comment, no orphan table.

---

## 2. Coverage & Structure

| Package | TS/TSX | package.json | Role |
|---|---|---|---|
| `apps/mobile` | 12 | ✅ | RN shell, zustand store, 3 screens + 1 onboarding |
| `packages/inference` | 21 | ❌ (root hoists) | Prescription engine, autopilot, semantic layer |
| `packages/core-db` | 29 (ts+sql) | ❌ (root hoists) | 23 SQL migrations, runner, demo-data |
| `packages/biometrics` | 3 | ✅ | HRV/sleep/SpO₂ aggregation + Health-Connect bridge |

- Total source SLOC ≈ **12.3k** (excl. `.build`, vendor, fixtures).
- `packages/inference` and `packages/core-db` have **no `package.json`** — by design: the root workspace (`workspaces: ["apps/*","packages/*"]`) hoists deps. Not a gap.
- **No root `tsconfig.json`** — by design: RN/Metro consume `apps/mobile/tsconfig.json` as the typecheck target.
- Test harnesses: ~15 `verify_*.mjs` / `verify_*.py` gate scripts + 1 Jest component test (`SessionScreen.test.js`, wired via `apps/mobile/jest.config.js`).

---

## 3. Findings by Domain

### 3.1 Architecture & Data Flow — LOW RISK
- Clean package boundaries; no circular imports. Alias paths (`@ak/inference`, `@ak/core-db`, `@ak/biometrics`) resolve in both `tsc` and Metro.
- Deterministic dataflow: raw session → `state_vector` materialization → readiness → policy/profile clamps → triage guardrails, each layer **monotone-conservative**.
- `useStore.ts` (2,890 lines) is sliced into well-factored domains (`profile`, `profileSlots`, `runnerCheckpoint`, `dailyBiometric`); all profile writes target `athlete_profile` and are validated against the `007` CHECKs before UPDATE.

### 3.2 SQL Schema & Migration Runner — LOW RISK
- 23 migrations, all `STRICT`, idempotent (`IF NOT EXISTS` / `INSERT OR IGNORE` / `DROP … IF EXISTS`), additive-only by contract.
- `migrationRunner.ts`: **synchronous** (no async tail), **fail-fast** (first failure rolls back + rethrows, leaving `user_version` pointed at itself), **self-healing** (re-applies all migrations if a sentinel object is missing — guards the historical async-boot race where `user_version` advanced ahead of actual table creation).
- `SENTINELS` array in the runner matches every core `CREATE TABLE` across `001`–`023` (verified); `user_profile` is correctly excluded because `007` drops it after migration.
- `user_profile → athlete_profile` (006→007): legacy row copied once via `INSERT OR IGNORE … SELECT FROM user_profile`, then `DROP TABLE`. Re-apply-safe.
- Two SQLite drivers reconciled: **op-sqlite** on device (build flag `-DSQLITE_ENABLE_MATH_FUNCTIONS=1` in `apps/mobile/package.json` → `ln`/`sqrt` available) and **node:sqlite** in CLI/test (`scripts/seed-db.ts` shims `ln`/`sqrt` if the build lacks them). Same `Math` functions used in `001`/`004` materialization on both.

### 3.3 Core Business Logic — LOW RISK
- **Block engine** (`blockGenerator.ts`): deterministic 4-week macro-cycles; 66 cases pass `verify_blocks.mjs`.
- **Kinematic Autopilot** (`kinematicAutopilot.ts` + `autopilotProjection.ts`): closed-form operators hand-translated from the derivation doc; `verify_autopilot.mjs` pins 11 analytic invariants — determinism/input-purity, closed-form φ (S_max cancels), control-law table incl. inclusive boundaries, monotone-conservative under flags, **halt supremacy**, bounded authority / anti-windup, domain closure, volume bifurcation (no SQL access — confirms engine/storage seam), edge/fail-safe (NaN/Infinity/steep-trend all finite & fail-safe), constant contract.
- **Policy** (`policyReference.ts`): 43 live rules parsed and cross-checked; `verify_policy.mjs` green.
- **Substitution / condition engine**: joint-aware, niggle-gated; conservative under thin data.
- **Session runner** (`sessionRunner.ts`): serializable checkpoint (`version`ed), deterministic replay; `verify_runner.mjs` 14 checks green.

### 3.4 Semantic / Embedder Layer — LOW RISK
- `wordpiece.ts`: pure-TS BERT tokenizer, no native deps; parity machine-verified per phrase.
- `onnxEmbedder.ts`: runtime-agnostic — constructor injection of `session`/`Tensor` keeps **zero native imports** in source; mean-pool + L2 normalize mirrors build-time codebase embeddings.
- `cosine.ts`: `packVectors`/`topK`/`normalize`; `verify_semantic.mjs` asserts routing 15/15, monotone guardrail application, halts-are-halts.
- `deviceEmbedder.ts`: **deferred native `require` inside try/catch** — avoids RN-0.81 bridgeless JSI install crash at module eval; any failure → `null` → policy-only mode (never a crash). Model copied once from APK assets to DocumentDir.
- `verify:embedder`: 70/70 tokenizer parity, cosine 1.000000, 9.2 ms/query against the **same int8 ONNX** the APK ships.

### 3.5 Frontend — LOW RISK
- `App.tsx`: no nav library; 4-tab `useState` shell (64pt targets), `RootErrorBoundary` converts render throws into a readable screen (release builds otherwise die silently).
- `ReadinessScreen.tsx`: decision surface, not a dashboard; `classifyReadiness` mirrors LOADCTL bands without becoming an engine; halts surface the safety cue.
- `ProfileScreen.tsx` (931 lines): chip/stepper keyboard-light questionnaire; writes every change immediately via `saveProfile` → `athlete_profile`; equipment inventory as boolean filters; coach-mode multi-DB athlete management.
- Graceful degradation: Health-Connect and embedder both optional by contract; a null bridge/model costs only telemetry / policy-only mode.

### 3.6 Tests / Tooling — MEDIUM (coverage breadth, not correctness)
- Strong: 15 deterministic `.mjs` / `.py` gate verifiers exercising real schema + engine code; `seed-db.ts` asserts the dataset *exhibits* the physiology it models (ACWR camp spikes, inverse load↔HRV coupling, determinism via SHA-256).
- Thin: only **1 Jest component test** (`SessionScreen`). UI logic is largely validated indirectly through `verify:store` (SQL-level), not through component rendering.

---

## 4. Verification Harness Results (`verify:all` → exit 0)

```
typecheck            PASS   (tsc -p apps/mobile/tsconfig.json, 0 errors)
verify:db            PASS
verify:demo          PASS   (180-day determinism + physiology)
verify:migrations    PASS   (runner self-heal path)
verify:policy        PASS   (43 rules)
verify:blocks        PASS   (66 cases)
verify:autopilot     PASS   (11 analytic pins)
verify:biometrics    PASS
verify:semantic      PASS   (routing 15/15)
verify:embedder      PASS   (cosine 1.000000)
verify:store         PASS
verify:coach         PASS   (11 checks)
verify:memory        PASS
verify:progression   PASS   (17 checks)
verify:runner        PASS   (14 checks)
verify:library       PASS
```

---

## 5. Risk Assessment

| Area | Risk | Justification |
|---|---|---|
| Architecture | Low | Clean seams, no cycles, consistent aliases. |
| Type correctness | Low | Strict `tsc` clean; manual reads confirm types. |
| Schema stability | Low | Idempotent migrations + sentinel self-heal. |
| Semantic accuracy | Low | Tokenizer + vector parity verified. |
| UI test coverage | Medium | 1/12 screens has a Jest test; engine covered, components not. |
| Dependency pinning | Low–Med | `op-sqlite` pinned `"*"`; could drift on a native bump. |

---

## 6. Recommendations (optional, non-blocking)

1. **Expand Jest coverage** for `ReadinessScreen` / `ProfileScreen` / `BlockScreen` — engine is well-tested; the React layer is not.
2. **Pin `op-sqlite`** to a concrete version range (currently `"*"`) to avoid a silent native-API shift.
3. **No action required** on the `user_profile`/`athlete_profile` evolution, the migration runner, or the dual SQLite-driver math-function shim — all correct as written.

---

## 7. Audit Boundary (not examined)

For transparency: the following were **not** opened in this pass. None are on the critical path (all are exercised green by the harnesses above, or are non-code assets):
- `scripts/fetch-embedder.mjs`, `scripts/embed-codebase.mjs`, `scripts/bench-cosine.mjs` (tooling wrappers)
- `tools/memory-audit/audit.mjs` (invoked by `verify:memory`, passes)
- `docs/`, `Project Overview/`, `gpt and opus audit reviews/` (external review artifacts)
- Android/iOS native project files (`apps/mobile/android`, `apps/mobile/ios`)

---

*Compiled from direct file reads and the full `verify:all` log. No defect required code changes.*
