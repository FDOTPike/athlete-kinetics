# Stage 3 Pixel rerun and handback

Capture filenames are relative to the original `stage3-restart-2026-11-25` evidence packet.

25 November 2026 · Pixel 9 Pro · Android 17 (API 37) · 960 × 2142 px · 427 dpi display override (about 360 dp wide) · 1.3× font scale

Local branch `feat/sol-compact-ui-and-pixel-fixes` in `C:/codex-sol-compact`. The original Stage 3 fixes are in `4686f75c`. Follow-up `e30fafb2` formats the off-plan workout date in both the visible Today caption and its accessibility label, while preserving the existing session selection and start behavior.

## Physical checks

| Check | Status | Evidence |
| --- | --- | --- |
| Workout action labels | EVIDENCE CAPTURED | “Swap exercise” and “Report discomfort” each fit on one line in stacked buttons. [Screenshot and layout](#workout-captures) |
| Live workout indicator | EVIDENCE CAPTURED | The white dot is left of WORKOUT. Their vertical centers differ by 1 px. [Screenshot and layout](#workout-captures) |
| Gesture-bar clearance | EVIDENCE CAPTURED | On Today and Workout, the three tab bounds end at y=2057 of 2142 px. The gesture bar is visible below the unobstructed tabs in both captures. [Today captures](#today-captures) · [Workout captures](#workout-captures) |
| Plan week strip | EVIDENCE CAPTURED | Week 1 contains seven cells. The swipe instruction is visible, day 1 is fully visible at the left edge, and days 6–7 are fully visible at the right edge. [Plan captures](#plan-captures) |
| Sport gate | EVIDENCE CAPTURED | Step 4 names the next missing answer in turn. It asks for the sport, training outcome, and experience. [Sport captures](#sport-captures) |
| Review footer | EVIDENCE CAPTURED | Back and Start Training stayed at the same coordinates while the Review page scrolled. Tapping Start Training opened Program Setup. [Review captures](#review-captures) |
| Today dates | EVIDENCE CAPTURED | Today shows “Wed, Nov 25, 2026.” The off-plan caption and its accessibility label use “Tue, Nov 24, 2026” for the prior session. [Today captures](#today-captures) |
| Android 15 and 16 hardware | NOT VERIFIED — the physical rerun used Android 17. | |

All nine paired screenshots and layout dumps were captured on the physical Pixel and visually inspected. Layout assertions and file hashes (`layout-verification.txt`)

## Device handback

EVIDENCE CAPTURED — The workout used the existing `Stage 3 QA` scratch athlete and was closed without logging sets. A second scratch athlete, `New Athlete (2)`, completed fresh onboarding. Both scratch athletes remain available. Workout completion (`scratch-finished.json`) · Onboarding completion (`second-scratch-today.json`)

EVIDENCE CAPTURED — Francis was reactivated, the app’s advanced tools were relocked, and the phone was left on Francis’s Today screen. The QA package remained installed. The worktree’s Metro listener was stopped and port 8081 is free. Profile restored (`francis-reactivated.json`) · Tools relocked (`francis-relocked.json`) · Final Today layout (`phone-left-on-today.json`) · QA package (`qa-package.txt`) · Metro port (`metro-handback.txt`)

## Local verification

EVIDENCE CAPTURED — The two off-plan caption tests reproduced the raw dates before the fix. After the fix, nine focused suites and 391 tests passed. Typecheck and `git diff --check` passed. [Before-fix test log](./caption-red.log) · Focused suite log (`stage3-components-final.log`) · Typecheck log (`typecheck-final.log`)

EVIDENCE CAPTURED — The full npm run verify:ci gate ran verify:components and exited 0 after 256 suites and 6884 tests passed. [Verification log excerpt](./verify-ci-excerpt.md)

## Raw captures

### Workout captures

Workout screenshot (`workout-actions.png`) · Workout layout (`workout-actions.json`)

### Today captures

Today screenshot (`startup.png`) · Today layout (`startup.json`)

### Plan captures

Left edge screenshot (`plan-left.png`) · Left edge layout (`plan-left.json`) · Right edge screenshot (`plan-right.png`) · Right edge layout (`plan-right.json`)

### Sport captures

Sport screenshot (`sport-gate-empty.png`) · Sport layout (`sport-gate-empty.json`) · Training outcome screenshot (`sport-gate-outcome.png`) · Training outcome layout (`sport-gate-outcome.json`) · Experience screenshot (`sport-gate-experience.png`) · Experience layout (`sport-gate-experience.json`)

### Review captures

Review screenshot (`review-sticky-footer.png`) · Review layout (`review-sticky-footer.json`) · Scrolled screenshot (`review-after-scroll.png`) · Scrolled layout (`review-after-scroll.json`) · Program Setup layout (`program-setup.json`)
