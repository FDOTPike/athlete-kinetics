# Physical Pixel work-order restart

Capture filenames are relative to the original `pixel-workorder-restart-2026-11-25` evidence packet.

25 November 2026 · Pixel 9 Pro · Android 17 (API 37) · 960 × 2142 px · 427 dpi display override · 1.3× font scale

The Android app connected to Metro from `C:/codex-sol-compact` and reloaded on the physical Pixel. The worktree tip at capture was `4233e0b72c94f5132897e523078f7032381024a5`, with verified application code at `e30fafb2`. The workout and display actions used the existing Coach Mode scratch athlete `New Athlete (2)`.

| Check | Status | Evidence |
| --- | --- | --- |
| Box Squat action layout | EVIDENCE CAPTURED | The original physical Pixel baseline and the updated physical Pixel both show Box Squat at the same display settings. On the updated build, “Swap exercise” and “Report discomfort” fit on one line each, the “WORKOUT” label and live dot differ by 1 px vertically, and all three tab bounds end 85 px above the display bottom. The load-validation and effort-stop guidance are visible. The original and updated captures used different athletes. Physical before/after comparison (`visual-physical-box-squat-comparison.png`) · Original layout (`../baseline/workout-actions.json`) · Updated layout (`workout-box-squat.json`) |
| Preparation, swap picker and set logging | EVIDENCE CAPTURED | Preparation named Box Squat as the first exercise. The swap picker opened with “Equipment busy” available and was closed before logging one scratch set of 10 reps at 20 kg. Preparation (`preparation.json`) · Swap picker (`swap-picker.json`) · Log Set (`log-set-ready.json`) |
| Rest timer, summary and Session Feel | EVIDENCE CAPTURED | The set started a 90-second rest. The stopped-session summary records one Box Squat set and provides the Session Feel action. The action opened “How did this session go?”. Rest layout (`rest-timer.json`) · Summary layout (`session-summary.json`) · Session Feel layout (`session-feel.json`) |
| Today and Plan | EVIDENCE CAPTURED | The Today footer shows “Wed, Nov 25, 2026” and the off-plan caption and accessibility label use “Mon, Nov 23, 2026.” Both ends of the seven-day Plan strip are reachable and the swipe instruction is visible. Today layout (`today.json`) · Plan left (`plan-left.json`) · Plan right (`plan-right.json`) |
| Library and display | EVIDENCE CAPTURED | The Box Squat Library detail opened. On the scratch athlete, Show All revealed the Session & Display explanation, and Compact was restored afterward. The earlier physical rerun contains the dedicated Sport and Review onboarding evidence. Library layout (`library-box-squat.json`) · Compact (`profile-display-compact.json`) · Show All (`profile-display-show-all.json`) · Compact restored (`profile-display-restored.json`) · [Earlier onboarding evidence](./STAGE_3_RERUN.md) |

I visually inspected the 13 paired captures. Today and Plan screenshots (`visual-today-plan.png`) · Preparation and session screenshots (`visual-session.png`) · Workout and Library screenshots (`visual-workout-controls.png`) · Display screenshots (`visual-profile-display.png`) · Layout assertions (`layout-verification.txt`) · Capture hashes (`capture-sha256.txt`)

EVIDENCE CAPTURED — Francis was reactivated, advanced tools were relocked, and the Pixel was left on Francis’s Today screen. The QA package returned the same installed path before and after the run. Metro stopped and port 8081 was free. Francis active (`francis-reactivated.json`) · Tools relocked (`francis-relocked.json`) · Final Today layout (`phone-left-on-today.json`) · QA package (`qa-package-after.txt`) · Metro port (`metro-handback.txt`)

NOT VERIFIED — The original physical baseline stopped before the rest timer, summary and Session Feel. The reconstructed Android 15 baseline covers those before states. Android 16 remains unverified. [Android 15 comparison](./ANDROID15_COMPARISON.md)
