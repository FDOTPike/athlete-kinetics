/**
 * motionDuration.ts — reduced-motion helper.
 *
 * AccessibilityInfo.isReduceMotionEnabled() is async. The cold-start race is
 * resolved ACCESSIBILITY-FIRST: until the OS answers, we assume reduced
 * motion is ON. The two possible wrong guesses are not symmetric —
 *   wrong "full motion":    a reduced-motion user SEES MOTION (a real
 *                           accessibility failure, the thing they opted out of)
 *   wrong "reduced motion": a normal user gets one instant transition in the
 *                           first frames after cold start (imperceptible)
 * — so the default errs on the side that can never harm anyone.
 *
 * The flag is corrected as soon as the OS responds (typically before the
 * first screen settles) and tracks live changes thereafter.
 *
 * Usage:
 *   Animated.timing(v, { duration: motionDuration(theme.motion.state.duration) })
 */
import { AccessibilityInfo } from 'react-native';

// Accessibility-first default: reduced until the OS says otherwise.
let _reduceMotion = true;

void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
  _reduceMotion = reduced;
});

// Track the user toggling the system setting while the app is open.
AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
  _reduceMotion = reduced;
});

/**
 * Returns `requestedMs` if reduced-motion is OFF, or `0` if it is ON.
 * Pass this as the `duration` to every Animated.timing call.
 */
export function motionDuration(requestedMs: number): number {
  return _reduceMotion ? 0 : requestedMs;
}
