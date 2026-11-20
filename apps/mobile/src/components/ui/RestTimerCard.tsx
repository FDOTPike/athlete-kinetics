/**
 * RestTimerCard — §1b rest-between-sets timer.
 *
 * 3pt chalk top-edge drain bar: ONE Animated.timing scaleX from 1→0 over the
 * full rest duration. The bar scales from the left edge (transformOrigin workaround
 * via negative translateX + scaleX on inner View).
 *
 * Numerals update every 1 second via setInterval — this is SEPARATE from the
 * animation. The animation runs at native FPS; the digits tick at 1Hz.
 *
 * Law 2: chalk is ONLY on the drain bar top edge. Nowhere else in this component.
 * Law: zero hex literals.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';
import { motionDuration } from './motionDuration';

export interface RestTimerCardProps {
  /** Total rest duration in seconds */
  totalSeconds: number;
  /** Time elapsed in seconds since rest started */
  elapsedSeconds?: number;
  /** Optional wall-clock start time so the countdown ticks inside RestTimerCard without re-rendering the parent screen */
  startedAtMs?: number;
  /** Optional callback fired once when the countdown reaches 0 */
  onComplete?: () => void;
  /** Name of the upcoming movement (shown as context) */
  upcomingLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const secondsText = (n: number): string => {
  const value = Math.max(0, Math.round(n));
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${value}s`;
};

const accessibleRemainingSeconds = (remaining: number, totalSeconds: number): number => {
  if (remaining <= 0) return 0;
  if (remaining <= 5) return 5;
  if (remaining <= 10) return 10;
  return Math.min(totalSeconds, Math.ceil(remaining / 15) * 15);
};

export function RestTimerCard({
  totalSeconds,
  elapsedSeconds,
  startedAtMs,
  onComplete,
  upcomingLabel,
  style,
  testID,
}: RestTimerCardProps): React.JSX.Element {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const completedKeyRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (startedAtMs === undefined) return;
    setNowMs(Date.now());
  }, [startedAtMs, totalSeconds]);

  const elapsed = startedAtMs !== undefined
    ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
    : (elapsedSeconds ?? 0);
  const remaining = Math.max(0, totalSeconds - elapsed);
  const a11yRemaining = accessibleRemainingSeconds(remaining, totalSeconds);

  useEffect(() => {
    if (startedAtMs === undefined || remaining <= 0) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAtMs, remaining > 0]);

  useEffect(() => {
    if (startedAtMs === undefined || remaining > 0) return;
    const key = `${startedAtMs}:${totalSeconds}`;
    if (completedKeyRef.current === key) return;
    completedKeyRef.current = key;
    onCompleteRef.current?.();
  }, [startedAtMs, totalSeconds, remaining]);

  // ONE Animated.timing for scaleX over the full duration.
  // We start a new animation only when a new rest period begins (totalSeconds changes).
  const scaleX = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animRef.current?.stop();
    const remainingMs = Math.max(0, (totalSeconds - elapsed) * 1000);
    const startValue = totalSeconds > 0 ? (totalSeconds - elapsed) / totalSeconds : 0;
    const dur = motionDuration(remainingMs);

    scaleX.setValue(startValue);

    if (dur > 0) {
      animRef.current = Animated.timing(scaleX, {
        toValue: 0,
        duration: dur,
        useNativeDriver: false,
      });
      animRef.current.start();
    } else {
      scaleX.setValue(0);
    }

    return () => {
      animRef.current?.stop();
    };
  // Only restart animation when a new rest period starts (totalSeconds + initial elapsed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds, startedAtMs]);

  return (
    <View style={[styles.card, style]} testID={testID}>
      {/* 3pt chalk drain bar — top edge only. ONE scaleX animation. */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { transform: [{ scaleX }] }]}
          accessibilityElementsHidden
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>REST</Text>
        <Text
          style={styles.numerals}
          accessibilityLabel={`Rest timer: ${secondsText(a11yRemaining)} remaining`}
        >
          {secondsText(remaining)}
        </Text>
        {upcomingLabel !== undefined && (
          <Text style={styles.upcoming}>
            Next up: {upcomingLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    overflow: 'hidden',
  },
  barTrack: {
    height: 3,
    backgroundColor: theme.color.line,
    // The animated fill covers this track
  },
  barFill: {
    // scaleX from 1→0, transform-origin is left edge.
    // RN transforms from center, so we translate left by 50% of width
    // This approach: the fill starts full-width and collapses leftward.
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: theme.color.chalk,
    transformOrigin: 'left',
  },
  content: {
    padding: theme.space[5], // 24
    gap: theme.space[2],     // 8
    alignItems: 'center',
  },
  eyebrow: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  numerals: {
    ...theme.font.metric,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontVariant: ['tabular-nums'],
  },
  upcoming: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
    textAlign: 'center',
  },
});
