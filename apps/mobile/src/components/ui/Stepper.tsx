/**
 * Stepper — §1b value editor.
 *
 * 88pt hit zones on ± buttons (per design spec).
 * Value rendered at theme.font.title scale (value-hero).
 * Label at theme.font.eyebrow.
 *
 * Law: zero hex literals. No chalk.
 */
import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';
import InfoTip, { type GLOSSARY } from '../InfoTip';

export interface StepperProps {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  repeatOnHold?: boolean;
  tip?: keyof typeof GLOSSARY & string;
}

export function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  style,
  testID,
  repeatOnHold = false,
  tip,
}: StepperProps): React.JSX.Element {
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const didRepeat = useRef(false);

  const stopRepeating = (): void => {
    if (holdTimeout.current !== null) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (repeatInterval.current !== null) {
      clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  };

  useEffect(() => stopRepeating, []);

  const startRepeating = (action: () => void): void => {
    if (!repeatOnHold) return;
    stopRepeating();
    didRepeat.current = false;
    holdTimeout.current = setTimeout(() => {
      didRepeat.current = true;
      action();
      repeatInterval.current = setInterval(action, 100);
    }, 300);
  };

  const finishPress = (action: () => void): void => {
    if (!repeatOnHold || !didRepeat.current) action();
    didRepeat.current = false;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {tip !== undefined && <InfoTip term={tip} />}
      </View>
      <View style={styles.row}>
        <Pressable
          onPress={() => finishPress(onDecrement)}
          onPressIn={repeatOnHold ? () => startRepeating(onDecrement) : undefined}
          onPressOut={repeatOnHold ? stopRepeating : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.symbol}>−</Text>
        </Pressable>
        <Text
          style={styles.value}
          accessibilityLabel={`${label} ${value}`}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => finishPress(onIncrement)}
          onPressIn={repeatOnHold ? () => startRepeating(onIncrement) : undefined}
          onPressOut={repeatOnHold ? stopRepeating : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.symbol}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[2], // 8
  },
  label: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  button: {
    // 88pt hit zone per design spec
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink0,
    flexShrink: 0,
  },
  buttonPressed: {
    backgroundColor: theme.color.ink1,
  },
  symbol: {
    ...theme.font.title,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontWeight: '300',
  },
  value: {
    flex: 1,
    minWidth: 56,
    textAlign: 'center',
    ...theme.font.title,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontVariant: ['tabular-nums'],
  },
});
