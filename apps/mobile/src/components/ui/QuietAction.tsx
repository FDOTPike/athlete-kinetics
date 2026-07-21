/**
 * QuietAction — §1b text-only destructive/tertiary affordance.
 *
 * Text-only pressable. Used for destructive confirms (e.g. "Delete athlete").
 * Must be rendered with ≥ 16pt (theme.touch.destructiveGap) margin above any
 * destructive action — the caller is responsible for that spacing.
 *
 * Color: textMid with underline. NOT red. NOT chalk.
 * minHeight: theme.touch.min (56pt).
 *
 * Law: zero hex literals.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';

export interface QuietActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function QuietAction({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: QuietActionProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[3], // 12
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.38,
  },
  label: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
    textDecorationLine: 'underline',
  },
  labelDisabled: {
    color: theme.color.textLow,
  },
});
