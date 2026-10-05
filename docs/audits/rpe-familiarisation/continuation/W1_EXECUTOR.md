# W1 Executor Handback: Selector Regression Hardening & Targeted Remediation

## 0. Handback Status & Verdict Request

```text
W1 REMEDIATION COMPLETE — READY FOR OPUS RE-VERIFICATION AND APPROVAL
```

This handback addresses Opus's audit findings **F1** and **F2** from [`docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT.md`](./W1_OPUS_AUDIT.md) via the single authorized remediation pass (§3.10).

Product code and tests remain strictly **byte-identical** to the reviewed W1 candidate. No product changes were requested or made.

---

## 1. Remediation of Audit Findings

### 1.1 Remediation of Finding F1 (Freeze Inventory Digest Tool Recomputation)
- **Defect Identified:** `FREEZE_INVENTORY_W1.json` previously carried `c88f34feebcc573752e259b1f09570c1dd3baae172692797e8838d7211bf7df0` for `HANDBACK_ISOLATED_QA.md`, which did not match disk.
- **Root Cause Established:** In the generator script `generate_w1_deliverables.py`, `untrackedAuditFiles` had an uncomputed hardcoded template placeholder string rather than dynamically executing `hashlib.sha256(f.read()).hexdigest()`.
- **Remediation Action:** All hashes in `FREEZE_INVENTORY_W1.json` are now computed strictly by tool directly from file bytes on disk using SHA-256.
- **Values Reconciled:**
  - Hardcoded/faulty entry: `c88f34feebcc573752e259b1f09570c1dd3baae172692797e8838d7211bf7df0`
  - Un-remediated pre-F2 file on disk: `182f06ae7a4c53c9db9201793a04d1bb5fb73e4fe320990267c97318977daad2` (25,212 bytes)
  - Current remediated file on disk (post-F2 correction): `96d9ff8c5cf22bb6196fa28f6ac5d184c151bfa03050c006cf0f102f90b39410` (25,963 bytes)

### 1.2 Remediation of Finding F2 (Evidence Document Logcat Correction)
- **Defect Identified:** `docs/audits/rpe-familiarisation/antigravity/HANDBACK_ISOLATED_QA.md:222` misattributed all 5 error-level lines to `E/FrameTracker` on PID `3764`.
- **Remediation Action:** Appended an explicit, additive correction note at lines 223–226 of `HANDBACK_ISOLATED_QA.md`:
  > **Correction (W1 continuation review, applied by Gemini):** The Sol/Opus note above misattributed all 5 error-level lines to `E/FrameTracker` on PID `3764`. The verified breakdown across raw log lines 3355, 14955, 19734, 33428, and 36941 is:
  > - **3 `E/FrameTracker` lines on PID 3764:** lines 14955, 19734, 33428 (`force finish cuj, time out:` on `IME_INSETS_SHOW_ANIMATION` / `IME_INSETS_HIDE_ANIMATION`).
  > - **2 `E/ods.training.qa` lines across PIDs 3764 and 6208:** line 3355 on PID 3764 and line 36941 on PID 6208 (`Not starting debugger since process cannot load the jdwp agent.`, standard ART runtime message for non-debuggable packages).
  > Neither category represents an application exception, crash, or ANR; stability PASS stands.

### 1.3 Inclusion of Self-Digests (Addressing F3)
- `FREEZE_INVENTORY_W1.json` now includes self-digests of all packet files (`W1_EXECUTOR.md`, `W1_OPUS_AUDIT.md`, and its own metadata).

### 1.4 Notes on Observations (O1, O2, O3)
- **O1 (Glossary Term Case):** Noted. `InfoTip` wiring in `RoutineTemplateBuilder.tsx` uses enum `st` directly (`LINEAR`, `APRE`), announcing "What does LINEAR mean?". Modifying glossary entries or introducing mapping is out of W1 scope (§8); deferred to W2 inspection / owner disposition.
- **O2 (Explanation Content Verification):** Noted. Unit tests verify the modal lifecycle (open/dismiss) and fail closed on broken wiring; visual / textual verification of the rendered definition is deferred to W2 on the emulator.
- **O3 (Jest Config Pattern):** Noted. Pre-existing regex artifact in `apps/mobile/jest.config.js` does not block tests; recorded for separate cleanup.

---

## 2. Unchanged Product and Test Baseline

Product code and test files are byte-for-byte identical to the reviewed W1 candidate:

| File | Size (Bytes) | SHA-256 Digest | Status |
| :--- | ---: | :--- | :--- |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | 68,588 | `4f6531bb899ea5a2297bf2b265d67e244a0a39a825b5117260c340afd987acb6` | BYTE-IDENTICAL |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | 29,219 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` | BYTE-IDENTICAL |

Hardening properties independently reproduced by Opus in `W1_OPUS_AUDIT.md`:
- Permissive `queryByTestId` / `if (container === null) continue` completely removed.
- Canonical contract binding to `SELECTABLE_SCHEMA_TYPES` from `@ak/inference` verified.
- Container and pressable `flex: 1` verified for all three selectable methods.
- Both negative fail-closed probes reproduced (Probe A missing testID fails with exit code 1; Probe B missing container `flex: 1` fails with exit code 1).

---

## 3. Re-Verification Gate Results

| Command | Exit Code | Result |
| :--- | :--- | :--- |
| `npm.cmd run typecheck` | `0` | Clean TypeScript check |
| `npx.cmd jest apps/mobile/test/components/RoutineTemplateBuilder.test.js` | `0` | 17/17 tests passed |
| `git diff --check` | `0` | Clean, zero whitespace issues |

---

## 4. Re-Freeze Identity

- **Branch:** `codex/rpe-familiarisation`
- **Dispatch HEAD:** `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
- **Tracked-Diff Fingerprint:** `41f19f2aa87b062cefd570a0bc7f1e45e949ec4a068ece6444e65d1e6416c440` (67,529 diff bytes via `sha256(git diff --full-index --binary HEAD)`)
- **Machine Freeze Inventory:** [`docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W1.json`](./FREEZE_INVENTORY_W1.json)

### Tracked Modified Files
| Path | Size (Bytes) | SHA-256 Digest |
| :--- | ---: | :--- |
| `PROMPT_LEDGER.md` | 337,147 | `a312b35f45dc2ae4678fd5eb0494e5f680730abae5a60f634634384eb47bc43a` |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | 68,588 | `4f6531bb899ea5a2297bf2b265d67e244a0a39a825b5117260c340afd987acb6` |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | 29,219 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |
| `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md` | 29,057 | `3bab3f48f8a4ece02cb88a310dc729060076b949d0e61341ee1cae08b31a6d79` |

---

## 5. Next Authorized Step

Gemini has stopped all execution. Opus is invited to re-verify items 1–3 and confirm `W1 APPROVE`. Upon Opus approval, Gemini will proceed to W2 (QA candidate build and visual verification on isolated emulator).
