/**
 * TertiaryButton — §1b small chip-shape button.
 *
 * Used for substitution badges, filter chips that behave like actions.
 * borderRadius: theme.radius.chip (2pt — square-ish).
 * minHeight: theme.touch.min (56pt) for touch compliance.
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

export interface TertiaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TertiaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: TertiaryButtonProps): React.JSX.Element {
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
    paddingHorizontal: theme.space[4], // 16
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.line,
    alignSelf: 'flex-start',
  },
  pressed: {
    backgroundColor: theme.color.ink1,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  labelDisabled: {
    color: theme.color.textLow,
  },
});
