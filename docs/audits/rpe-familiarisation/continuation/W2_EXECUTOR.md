# W2 Executor Handback: QA Candidate Build & Isolated Synthetic Emulator Layout Observation (Path A Recaptured)

## 0. Handback Status & Verdict Request

```text
W2 EXECUTION COMPLETE — READY FOR OPUS W2 AUDIT AND VERDICT
```

This handback reports complete execution of Requirements **R1 through R5** for W2 continuation in accordance with `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md` and Opus W2 audit findings in `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT.md` and `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R2.md`.

All audit findings are completely addressed:
- **CR-W2-01 (Blocking — Final-Artifact Capture Lineage): RESOLVED via Path A Recapture.** Candidate APK `3777054f…` (194,450,340 B) was directly installed on isolated synthetic emulator `emulator-5554` at 11:52:18 UTC, and all 18 PNG screenshots and 4 UI XML dumps were recaptured directly from that installed instance between 11:53:32 UTC and 11:55:31 UTC. Direct chronological and cryptographic lineage is established.
- **F4 (Blocking — Label Truncation/Clipping): RESOLVED.** The loading-method selector layout in `RoutineTemplateBuilder.tsx` was adjusted per §5.1 to use vertical stacking (`flexDirection: 'column'` with `gap: theme.space[2]`), expanding chip width from ~80–97 dp to ~296–347 dp. Under enlarged font scale (`font_scale 1.30` at 420 dpi), all three options (`LINEAR`, `UNDULATING`, `AUTOREGULATED`) render completely on a single line with zero horizontal truncation, zero vertical clipping, and zero ellipsis (`13_font13_linear.png`, `14_font13_undulating.png`, `15_font13_autoregulated.png`).
- **F5 (Blocking — UI Hierarchy Dump Fidelity): RESOLVED.** `ui_font13_builder.xml` is a genuine, distinct dump (`29,433` bytes, distinct from `ui_builder.xml`'s `35,002` bytes), captured after cleanly restarting the application process under active `font_scale 1.30`. Text line height is scaled to 50 px (vs 37 px standard), proving the capture reflects the font scale it is attributed to.
- **F6 (Minor — Baseline Mid-Word Wrapping): RESOLVED.** At standard width (411.4 dp), `AUTOREGULATED` fits on a single line (287×37 px text node) without mid-word break.
- **F7 (Minor — Touch-Target Contract): DOCUMENTATION CORRECTED; SHARED CONTROL FIX/WAIVER NOT AUTHORIZED.** Touch-target contract is cited as `theme.touch.min = 56` (Law 3). Chips measure `56.00 dp` height. The shared InfoTip 41.9–42.0 dp effective touch target (`18 dp + hitSlop={12}`) is explicitly documented against the 56 dp contract for owner disposition.
- **F8 (Trivial — Logcat Line Count Convention): ADDRESSED.** App logcat documented: 116 lines / 115 newlines, 1 benign ART JDWP notice, 0 application exceptions.
- **O1 (Observation — Raw Enum Identifiers): OWNER DISPOSITION PENDING.** Tooltip titles render `LINEAR` and `APRE` beside title-cased `Undulating`; retained for owner disposition per §8 scope.
- **O2 (Observation — Explanation Content): CONFIRMED.** Distinct and correct explanation definitions verified across all three popovers.
- **O3 (Observation — Role-Chip Row font_scale 1.30 Clipping): OWNER DISPOSITION PENDING.** Role-chip row (`Up / Down / MAJ / SUP / CON / ACC`) clipping `ACC` at screen edge under `font_scale 1.30` documented for owner disposition / W3 aggregate review.

---

## 1. Resolution of CR-W2-01: Final-Artifact Lineage (Path A Recapture)

### 1.1 Chronological Build & Capture Sequence

To eliminate the provenance gap identified in Round 2 (§4, CR-W2-01), Gemini executed **Path A** (§7) by capturing fresh emulator evidence directly from the preserved candidate APK:

| Timestamp (UTC) | Action | Artifact / Target | Identity / Hashes |
| :--- | :--- | :--- | :--- |
| **10:27:40Z** | Final Product Code Write | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | SHA-256: `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` (68,692 B) |
| **10:31:00Z** | Preliminary QA Build | Intermediate build for initial exploration | `adcc6cdb19778e18ac52eeeb0bc713e600b9aaff0584f6a2749d41eda595503f` (194,450,436 B) — *overwritten, not retained* |
| **10:36–10:37Z** | Preliminary Capture | Initial emulator run | Provided early evidence for initial Round 2 draft |
| **10:52:48Z** | **Frozen QA Candidate Build** | Documented repository build: `gradlew.bat assembleQa --no-daemon` | **Built QA APK:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`<br>**Size:** `194,450,340` bytes<br>**SHA-256:** `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` |
| **10:53:03Z** | Pre-Doc Provenance Gate | `npm.cmd run verify:qa-candidate` | **PASS (exit 0, QA ARTIFACT VERIFIED)**. All 31 validation checks passed against live worktree. |
| **11:51:26Z** | Emulator Launch | Host `emulator-5554` (`rpe_isolated_qa_avd`) | Dedicated isolated AVD booted with `-no-window -gpu swiftshader_indirect`. Physical Pixel strictly untouched. |
| **11:52:18Z** | **Candidate APK Install** | `adb -s emulator-5554 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` | **Exit 0, `Success`**. Installed hash-verified APK `3777054f…` (194,450,340 B). App launched at PID 11242. |
| **11:53:32–11:55:31Z** | **Path A Evidence Recapture** | All 18 PNG screenshots and 4 UI XML dumps | Recaptured live from running instance of `3777054f…` on `emulator-5554`. |
| **11:57:31Z** | Emulator Clean Shutdown | `adb -s emulator-5554 emu kill` | Snapshot `default_boot` saved cleanly (667 ms). Host AVD data preserved intact. |

### 1.2 Recaptured Layout Geometry Recomputation

Geometry independently re-derived from the newly captured XML dumps:

| Dump File | Viewport / Density | Control / Text Node | Pixels (w × h) | Calculated dp (w × h) | Touch Contract & Fit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ui_builder.xml`<br>(35,002 B) | Standard Width<br>411.4 dp<br>(420 dpi / 2.625) | **Chip Button** (all 3)<br>LINEAR<br>UNDULATING<br>AUTOREGULATED<br>InfoTip Button (all 3) | 912 × 147<br>119 × 37<br>215 × 37<br>287 × 37<br>47 × 47 | **347.43 × 56.00 dp**<br>45.33 × 14.10 dp<br>81.90 × 14.10 dp<br>109.33 × 14.10 dp<br>17.90 × 17.90 dp | **Meets `theme.touch.min = 56`**<br>Fits inside chip (793 px slack)<br>Fits inside chip (697 px slack)<br>Fits inside chip (625 px slack)<br>Nominal 41.9 dp area (`+hitSlop={12}`) |
| `ui_narrow_builder.xml`<br>(27,679 B) | Narrow Width<br>360.0 dp<br>(480 dpi / 3.0) | **Chip Button** (all 3)<br>LINEAR<br>UNDULATING<br>AUTOREGULATED<br>InfoTip Button (all 3) | 888 × 168<br>138 × 42<br>246 × 42<br>328 × 42<br>54 × 54 | **296.00 × 56.00 dp**<br>46.00 × 14.00 dp<br>82.00 × 14.00 dp<br>109.33 × 14.00 dp<br>18.00 × 18.00 dp | **Meets `theme.touch.min = 56`**<br>Fits inside chip (750 px slack)<br>Fits inside chip (642 px slack)<br>Fits inside chip (560 px slack)<br>Nominal 42.0 dp area (`+hitSlop={12}`) |
| `ui_font13_builder.xml`<br>(29,433 B) | Enlarged Font Scale<br>font_scale 1.30<br>(420 dpi / 2.625) | **Chip Button** (all 3)<br>LINEAR<br>UNDULATING<br>AUTOREGULATED<br>InfoTip Button (all 3) | 912 × 147<br>158 × 50<br>285 × 50<br>377 × 50<br>47 × 47 | **347.43 × 56.00 dp**<br>60.19 × 19.05 dp<br>108.57 × 19.05 dp<br>143.62 × 19.05 dp<br>17.90 × 17.90 dp | **Meets `theme.touch.min = 56`**<br>Fits inside chip (754 px slack)<br>Fits inside chip (627 px slack)<br>Fits inside chip (535 px slack)<br>Nominal 41.9 dp area (`+hitSlop={12}`) |

**Observations Confirmed on Recaptured Evidence:**
1. In all three viewports, positive clearance is preserved between chip right border and InfoTip left border (14.10 dp standard/font13, 14.00 dp narrow). Zero overlap.
2. In `ui_font13_builder.xml`, line height is scaled to 50 px (vs 37 px standard). `AUTOREGULATED` text node width is 377 px (143.62 dp), fitting inside the 912 px (347.43 dp) chip with 535 px (203.81 dp) of horizontal slack. Zero horizontal truncation, zero vertical clipping, and zero ellipsis.
3. Screenshots `13_font13_linear.png`, `14_font13_undulating.png`, and `15_font13_autoregulated.png` confirm full-word rendering across all options.

---

## 2. Re-Verification Gate Results

| Command | Exit Code | Result | Scope / Notes |
| :--- | :--- | :--- | :--- |
| `npm.cmd run typecheck` | `0` | **PASS** | TypeScript compilation clean across all packages. |
| `npx.cmd jest apps/mobile/test/components/RoutineTemplateBuilder.test.js` | `0` | **PASS** | 17/17 tests passed (fail-closed probe integrity verified). |
| `npm.cmd run verify:components` | `0` | **PASS** | 20/20 test suites, 282/282 tests passed. |
| `npm.cmd run verify:ci` | `0` | **PASS** | All 21 gates + preflight + typecheck passed. |
| `npm.cmd run verify:qa-candidate` (pre-doc snapshot) | `0` | **PASS** | **QA ARTIFACT VERIFIED** (all 31 checks passed). Independently reproduced by Codex. |
| `git diff --check` | `0` | **PASS** | Clean, zero whitespace issues across worktree. |
| Machine inventory self-check | `0` | **PASS** | 45/45 inventory items verified against disk bytes with 0 mismatches. |

---

## 3. Product Scope & Modifications

Adjustments were strictly confined to the schema selector layout in `RoutineTemplateBuilder.tsx` per §5.1:

| File | Status | Description |
| :--- | :--- | :--- |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | MODIFIED (§5.1 layout fix) | Switched `schemaRow` from `row` to `column` with `gap: theme.space[2]`; added chip padding; maintained single-line text rendering without premature ellipsis. SHA-256: `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` (unmodified since 10:27:40Z). |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | UNMODIFIED (from W1) | Preserved fail-closed selector tests (17/17 passed). SHA-256: `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343`. |
| `PROMPT_LEDGER.md` | MODIFIED (governance) | Closed Entry 0078, Entry 0079 (Codex review), Entry 0080 (Opus W2 R2 audit), and appended Entry 0081 (Path A recapture). |

---

## 4. W2 Freeze Identity & Fingerprint Transitions

- **Branch:** `codex/rpe-familiarisation`
- **Dispatch HEAD:** `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
- **QA Candidate APK:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
  - Size: `194,450,340` bytes
  - SHA-256: `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d`
  - Embedded Candidate Manifest:
    - schema: `ak.candidate-manifest/1`
    - label: `NON_PRODUCTION_QA_DEBUG_SIGNED`
    - head: `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
    - branch: `codex/rpe-familiarisation`
    - dirty: `true`
    - trackedDiffFingerprint: `0de694091f75b89541c3c8b1c290a8e0919bd0bddbaeafd732fe00b289717203`
    - packageId: `com.pikemethods.training.qa`
    - buildVariant: `qa`
- **Tracked Diff Transitions (§5.1 Step 8):**
  - At candidate build time (10:52:48Z) & pre-doc snapshot: `0de694091f75b89541c3c8b1c290a8e0919bd0bddbaeafd732fe00b289717203` (73,357 diff bytes via `sha256(git diff --full-index --binary HEAD)`).
  - At Opus W2 R2 review boundary (before Entry 0080): `39be999eb20501ba0a91c8d635dd1e76a8502f87c4528b40d563a25d41d66d93` (76,924 diff bytes).
  - Current post-recapture ledger boundary (after Entry 0081): `ad34457816be94342228adb8109fa43fbf0e8904511353218c6449ca6a07728c` (88,149 diff bytes).
- **Archived Baselines:**
  - Clean baseline APK: `scratch/continuation/baseline_apk/app-qa.apk` (`194,449,552` bytes | `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`).
  - Round 1 APK: `scratch/continuation/w2_round1_apk/app-qa.apk` (`194,450,148` bytes | `7d7f8846891e8be15771ed63f08cf519d4fcd9f66cd2272dc88fe72f97136aeb`).
- **Machine Freeze Inventory:** [`docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json`](./FREEZE_INVENTORY_W2.json)
- **Superseded Round 1 Handback:** Preserved at [`docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR_R1_SUPERSEDED.md`](./W2_EXECUTOR_R1_SUPERSEDED.md).

---

## 5. Safety & Authority Boundaries

- **Physical Pixel `49241FDAP001C7`:** Remained attached throughout. **Zero commands and zero writes** targeted `49241FDAP001C7`. Every adb command explicitly used `-s emulator-5554`.
- **Git Authority Boundaries:** Zero commits, zero stages, zero pushes, zero PRs, zero merges.
- **Emulator Lifecycle:** Isolated synthetic emulator cleanly shut down via `adb -s emulator-5554 emu kill`, snapshot `default_boot` saved, host AVD preserved.

---

## 6. Next Authorized Step

With Path A recapture complete and CR-W2-01 resolved directly against the frozen candidate APK `3777054f…`, Opus is invited to inspect the updated evidence and confirm `W2 APPROVE`.
