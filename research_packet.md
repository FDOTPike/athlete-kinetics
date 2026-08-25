# Executive recommendation

The current 450,000,000-byte (450 decimal MB) exact-byte cap is mathematically incompatible with the independently verified 471,936,000-byte transient component envelope. The 450 MB cap is too strict and guarantees constant CI failure without reflecting true physical device limits. Conversely, a 1 GB (1,073,741,824 bytes) cap is far too loose for a 3GB device, entirely violating the project's established 50% headroom rule against Android's Low Memory Killer Daemon (LMKD).

**Recommendation:** Replace the 450,000,000-byte cap with a **536,870,912-byte (512 MiB)** exact-byte cap for the lowest-tier mobile platforms. This cap accommodates the modeled 471.9 MB worst-case transient peak with ~64.9 MB of true physical headroom, whilst remaining safely below the ~640 MiB (50%) threshold of a 3GB Android device's pressure tier.

# Platform and metric matrix

*Note: There is **no desktop runtime product** in the repository. The application is strictly a React Native iOS and Android mobile app. Desktop workstation limits are entirely excluded from this production matrix.*

| Platform / Tier | Exact-Byte Cap | Target | Headroom | Primary Metric | Secondary / Diagnostic | Measurement Tool / Acceptance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lowest Android (3GB RAM)** | 536,870,912 B (512 MiB) | < 475 MB | 64.9 MB over transient model, 50% below 1.25 GB LMKD | Private Dirty | PSS, RSS | `adb shell dumpsys meminfo` against `.qa` release-configured build. Profilers **cannot** be used for acceptance. |
| **Mid-tier Android (6GB+)** | 805,306,368 B (768 MiB) | < 475 MB | 333 MB over transient | Private Dirty | PSS, RSS | `dumpsys meminfo`, acceptable for release builds. |
| **Lowest iPhone (3GB/4GB)** | 536,870,912 B (512 MiB) | < 475 MB | Leaves ~1.5 GB for OS before Jetsam (2098 MB limit on 4GB) | `phys_footprint` | os_proc_available_memory | Xcode Instruments / Jetsam Event Logs. Must use release build. |

# Current budget reconciliation

The current modeled component envelope resolves as follows, based on `budget.json` and a recomputed check of the `phrase-codebase.vectors.json` (50 vectors × 384 dim × 4 bytes = 76,800 bytes):

*   **Hermes/RN/UI budget:** 314,572,800 B
*   **SQLite budget:** 52,428,800 B
*   **Matrix (phrase-codebase):** 76,800 B
*   **Modeled steady peak:** 367,078,400 B
*   **Embedder transient budget:** 104,857,600 B
*   **Modeled transient peak:** 471,936,000 B

**Comparison against candidate caps:**

| Candidate cap | Exact bytes | Current headroom/deficit | % of a 3 GB device | % of a 4 GB device |
| :--- | ---: | ---: | ---: | ---: |
| **450 MB** | 450,000,000 B | **-21,936,000 B (DEFICIT)** | 14.0% | 10.5% |
| **450 MiB** | 471,859,200 B | **-76,800 B (DEFICIT)** | 14.6% | 11.0% |
| **512 MiB (Rec.)**| 536,870,912 B | 64,934,912 B (Headroom) | 16.7% | 12.5% |
| **1 GB** | 1,073,741,824 B | 601,805,824 B (Headroom) | 33.3% | 25.0% |

# 450 MB vs 450 MiB vs 1 GB

*   **The difference between 450 MB and 450 MiB:** 450 MB is exactly 450,000,000 bytes. 450 MiB is 450 × 1024 × 1024 = 471,859,200 bytes. The difference is 21,859,200 bytes (~21.8 MB). The distinction is critical because the modeled peak of 471,936,000 bytes technically exceeds *both* caps (breaching 450 MB by ~22 MB and 450 MiB by ~76 KB).
*   **1 GB is not defensible:** A 1 GB limit on a 3 GB Android device consumes 33% of the *total* physical RAM. The OS reserves significant memory for the kernel, radio, background services, and launcher. Android LMKD typically caps user-space apps to ~1.25 GB on 3GB devices. A 1 GB limit consumes 80% of that ceiling, completely violating the project's 50% device-headroom safety rule (`1342177280 * 0.5 = ~640 MiB`).
*   **Consequence:** Changing the cap to 512 MiB does not inherently change user-visible functionality today, but it unblocks CI (making the static gate "honest" and passable) while retaining a strict, enforceable boundary against memory leaks or the silent re-introduction of un-quantized generative LLMs.

# Measurement protocol

To establish the **Measured M (authorized-device evidence)**, you must use a physical device running a non-debuggable, signed build (the `qa` variant, `com.athletekinetics.qa`).

**Primary metrics:** Android `Private Dirty` (via `dumpsys meminfo`), iOS `phys_footprint`.
**Why not APK size or Java Heap?** APK size is storage, not RAM. Java Heap ignores native C++ allocations (which ONNX and SQLite heavily use). RSS includes shared libraries. Private Dirty represents RAM that this process *alone* owns and cannot be paged to disk.

**Reproducible Test Journey (Execute 3 times, take the max):**
1.  **Cold launch:** Force stop the app. Launch to the main screen. Wait 5 seconds. Capture memory.
2.  **Demo history:** Load a 12-month SQLite dataset. Verify readiness.
3.  **Active embed:** Navigate to a routine generation screen. Trigger an embedder initialization (which copies the ONNX model from assets to DocumentDir). Capture memory during the exact inference window.
4.  **Coach/block generation:** Generate a full routine to stress Hermes/JS arrays.
5.  **Movement library:** Open the movement library and scroll aggressively to trigger RN image/UI allocations.
6.  **Active session:** Log 3-4 sets in an active workout session to test SQLite WAL appending.
7.  **Background/foreground cycles:** Send the app to the background. Wait 10 seconds. Bring to foreground. Capture memory to measure recovery footprint.
8.  **Long-session observation:** Leave the app open on the session screen for 30 minutes. Capture memory to check for JS object churn/leaks.

**Pass/Fail:** The maximum sampled Private Dirty bytes across all steps must not exceed the 536,870,912-byte cap.

# Gaps and risks

1.  **Transient Peak Measurement:** `dumpsys meminfo` has a sampling interval of ~800-1500ms. The MiniLM embed call takes ~150ms. Capturing the true peak of the transient ONNX allocation during step 3 is highly non-deterministic without a continuous profiler, which alters the memory profile itself.
2.  **Hermes GC Churn:** We assume Hermes garbage collection will aggressively reclaim the 314 MB UI budget, but long-lived closures or React state arrays could cause unbounded scaling with athlete history size.
3.  **Absence of Physical iOS Device Data:** Without an explicit iOS JetSam audit using Instruments, the exact `phys_footprint` behaviour of the ONNX `ort-react-native` C++ bindings on Apple Silicon is unmeasured.

# Recommended repository gates

Do not implement these changes directly; they are recommendations for the CI pipeline:
*   Update `RATIFIED_CEILING_BYTES` in `tools/memory-audit/memory_gate.mjs` to `536870912`.
*   The CI script must fail immediately if the modeled envelope (Steady + Embedder) exceeds this exact-byte cap.
*   The CI script must fail if any model/embedder concurrency is detected (e.g., if the single-flight queue in `deviceEmbedder.ts` is removed).
*   The CI script must fail if `phrase-codebase.vectors.json` grows such that the computed matrix bytes push the envelope past the cap.
*   The DB payload (history queries) must be statically gated or integration-tested to prove it loads paginated/bounded arrays into Hermes, failing if it loads unbounded rows.

# Human decisions required

1.  **Adoption of the 512 MiB Cap**
    *   *Default:* Approve the exact-byte cap of 536,870,912 bytes.
    *   *Consequence of rejecting:* CI will remain broken under the 450 MB cap. Raising it to 1 GB destroys the protection against LMKD termination on 3GB Androids.
2.  **Acceptance of Lower Bound Sampling**
    *   *Default:* Accept that `dumpsys` only provides a *lower bound* of the transient ONNX peak, and rely on the modeled component envelope (`104,857,600 B`) as the true upper bound for CI.
    *   *Consequence of rejecting:* Engineering must build custom native C++ hooks to record peak heap allocations within the ONNX runtime, delaying release.

# Source ledger

*   **Android LMKD & Memory Management**
    *   *Source:* Android Developers (AOSP) - memory-management
    *   *URL:* https://developer.android.com/topic/performance/memory-management
    *   *Supports:* Definitions of Private Dirty, PSS, and why LMKD terminates background/foreground apps based on device RAM tiers.
*   **iOS Jetsam Limits**
    *   *Source:* Apple Developer Documentation - Memory Usage Performance Guidelines
    *   *URL:* https://developer.apple.com/documentation/metrickit/mxmemorymetric
    *   *Supports:* `phys_footprint` as the primary iOS memory metric, and Jetsam ActiveHard limits (~2098 MB for 4GB devices, ~1.4 GB for 3GB devices).
*   **ONNX Runtime Mobile Considerations**
    *   *Source:* ONNX Runtime GitHub Documentation
    *   *URL:* https://onnxruntime.ai/docs/execution-providers/
    *   *Supports:* Transient memory spikes during C++ model inference and quantization benefits (int8).
*   **SQLite WAL & Cache Budgets**
    *   *Source:* SQLite Documentation (Pragmas)
    *   *URL:* https://www.sqlite.org/pragma.html#pragma_cache_size
    *   *Supports:* Validation that `PRAGMA cache_size = -16000` hard-caps the page cache at ~16 MB.
