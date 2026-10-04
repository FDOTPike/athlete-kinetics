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
 *
 * Components that do more than shorten a duration — a preview that must show
 * stills instead of motion — read the same flag through `useReduceMotion()`.
 * ONE module owns this preference so two features can never disagree about it.
 */
import { useEffect, useState } from 'react';
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

/** The current preference. Accessibility-first until the OS has answered. */
export function reduceMotionEnabled(): boolean {
  return _reduceMotion;
}

/**
 * Re-renders its component whenever the OS reduced-motion preference changes.
 * Mounting re-asks the OS as well: the module-level answer can predate a change
 * made while the app was backgrounded, and a mount is the cheapest place to
 * correct it. Each mount keeps its own OS subscription so the component stops
 * hearing about changes the moment it unmounts.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(reduceMotionEnabled);
  useEffect(() => {
    let alive = true;
    const apply = (value: boolean): void => {
      _reduceMotion = value;
      if (alive) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * Returns `requestedMs` if reduced-motion is OFF, or `0` if it is ON.
 * Pass this as the `duration` to every Animated.timing call.
 */
export function motionDuration(requestedMs: number): number {
  return _reduceMotion ? 0 : requestedMs;
}
