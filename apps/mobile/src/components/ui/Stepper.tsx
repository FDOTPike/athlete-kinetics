/**
 * Stepper — §1b value editor.
 *
 * 88pt hit zones on ± buttons (per design spec).
 * Value rendered at theme.font.title scale (value-hero).
 * Label at theme.font.eyebrow.
 *
 * Law: zero hex literals. No chalk.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';

export interface StepperProps {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  style,
  testID,
}: StepperProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={onDecrement}
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
          onPress={onIncrement}
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
  label: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
    marginBottom: theme.space[2], // 8
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
