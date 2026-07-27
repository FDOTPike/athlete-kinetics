# Technical Analysis: Training History File Ingestion (`AK_HISTORY_V1`)

**Author:** Antigravity / Gemini  
**Date:** July 28, 2026  
**Status:** COMPLETE (Analysis Only — Zero Code Changes, Zero Dependencies Added)

---

## 1. Friction & Cost of Current Paste Flow for Long History

The `AK_HISTORY_V1` importer enables Athletes to import historical training logs into Athlete Kinetics. However, the current implementation relies exclusively on pasting raw text into a single React Native multiline `<TextInput>`.

### Impact for a Year of Training (~150–200 Sessions, ~800 Sets)
- **Data Volume:** 1 year of training generates approximately 800–1,200 lines of formatted `AK_HISTORY_V1` text (~35–70 KB).
- **Mobile Clipboard Constraints:**
  - On iOS and Android, selecting 1,000+ lines of text inside external notes apps (Apple Notes, Google Keep, text editors) suffers from imprecise selection handles and clipboard truncation limits on certain OEM Android IMEs.
- **React Native Controlled `TextInput` Performance:**
  - A controlled `<TextInput value={historyText} onChangeText={...} />` in React Native passes string state across the JS-Native bridge. Holding 70 KB in controlled state causes noticeable input latency and frame drops on mid-range devices.
- **Accidental Edit Risk:**
  - Pasting a large block of text into an editable `TextInput` makes accidental inline edits or cursor placement bugs easy, which invalidates the strict `SESSION|date|duration|rpe` syntax and triggers preview errors.

---

## 2. Technical Options & Concrete Implementation Costs

### Option A: `react-native-document-picker`
- **Mechanism:** Integrates native file pickers (`UIDocumentPickerViewController` on iOS; `Storage Access Framework` / `ACTION_OPEN_DOCUMENT` on Android).
- **Package & Ecosystem:** `react-native-document-picker` (v9+).
- **Native Config:** Requires iOS UTI declarations (`CFBundleDocumentTypes` / `UTImportedTypeDeclarations`) in `Info.plist`.
- **RN 0.81 / New Architecture Compatibility:** Compatible, but requires maintaining native build linkages, CocoaPods podspecs, and Android Gradle dependencies.
- **Maintenance Cost:** Moderate native dependency overhead. Requires periodic updates for iOS/Android SDK target upgrades.

### Option B: Android `ACTION_SEND` / iOS Share Sheet Extension
- **Mechanism:** Registers the app as a target in the OS share menu when sharing a `.txt` or `.ak` file.
- **Android Cost:** Low. Requires adding an `<intent-filter>` for `ACTION_SEND` with `text/plain` in `AndroidManifest.xml`.
- **iOS Cost:** High. Requires creating a separate iOS Share Extension target, App Group container configuration, and native Swift/Obj-C bridging code to pass file data from the extension to the main app container.

### Option C: Leveraged `react-native-blob-util` (Existing Dependency)
- **Existing Footprint:** `react-native-blob-util` is **already installed and linked** in Athlete Kinetics (used for athlete registry operations and ONNX embedder asset copying).
- **Capability Analysis:**
  - `react-native-blob-util` contains robust file system APIs (`ReactNativeBlobUtil.fs.readFile(path, 'utf8')`).
  - **Limitation:** `react-native-blob-util` cannot *launch* a native file picker modal by itself. It requires a valid file path or `content://` URI.
  - **Synergy:** If combined with a lightweight native intent call or document picker, `blob-util` can asynchronously stream and read the file without holding large string buffers in React Native component state.

### Option D: Zero-Dependency Paste-Chunking Flow
- **Mechanism:** Enhance the UI to support progressive multi-chunk imports without changing native code.
- **Parser Alignment:** The `importHistory` engine already deduplicates identical session timestamps. An athlete can paste Month 1–3, preview/commit, then paste Month 4–6.
- **Cost:** **Zero native code, zero new dependencies, zero store review risk.**

---

## 3. Store-Review & Privacy Permissions

| Platform | Permission Requirement | App Store / Play Store Review Impact |
| :--- | :--- | :--- |
| **System Document Picker (SAF / UIDocumentPicker)** | None (User-initiated file selection) | **Zero Risk.** System pickers grant temporary read URI access for the selected file only. No broad storage permissions required. |
| **Broad File Access (`READ_EXTERNAL_STORAGE` / `MANAGE_EXTERNAL_STORAGE`)** | Broad Storage Access | **High Risk / Rejection.** Google Play strictly bans `MANAGE_EXTERNAL_STORAGE` for non-file-manager apps. |
| **Paste / Clipboard (Current)** | None | **Zero Risk.** Fully private, offline-first. |

---

## 4. Memory & Heap Footprint Analysis (450 MB Ceiling)

Athlete Kinetics operates under a strict **450 MB RAM ceiling**.

### 5 MB History Import File (~100,000 Lines / ~10 Years of Daily Training)
- **V8 / Hermes Memory Overhead:**
  - A 5 MB UTF-8 text string loaded into JS memory consumes ~10 MB of heap space.
  - `parseHistoryImport` processes lines iteratively using regex splits.
  - Parsing 100,000 lines yields ~10,000 session objects and ~40,000 set objects.
  - Total transient heap allocation during parsing: **~25 MB–35 MB** (well within the 450 MB ceiling).
- **Garbage Collection Safety:**
  - Because `parseHistoryImport` is pure and synchronous, intermediate line arrays are eligible for immediate GC once execution finishes.
- **UI Thread Safety:**
  - Processing a 5 MB string in standard JS blocks the main thread for ~150 ms. Parsing should be wrapped in `requestAnimationFrame` or chunked timeouts if file sizes exceed 2 MB to prevent UI freezes.

---

## 5. Strategic Recommendation

1. **Short-Term (Immediate / Phase 19B):**
   - Retain the offline-first, zero-dependency architecture.
   - Emphasize the **Paste-Chunking Flow** in athlete guidance: explain that history can be pasted month-by-month because `importHistory` automatically ignores duplicate sessions.

2. **Long-Term (Future Enhancement):**
   - If direct file upload is prioritized, pair `react-native-document-picker` with the existing `react-native-blob-util` dependency. Use `ReactNativeBlobUtil.fs.readFile(uri, 'utf8')` to read the selected file without adding extra file-system utility libraries.
