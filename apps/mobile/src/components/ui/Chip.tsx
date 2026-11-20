/**
 * Chip — §1b selection chip.
 *
 * Selected state: INVERTED — textHi fill, ink0 label. NOT chalk.
 * Unselected: line border, textMid label, transparent fill.
 * Disabled: 45% opacity, ink1 fill, textLow label.
 * borderRadius: theme.radius.chip (2pt).
 * minHeight and minWidth: theme.touch.min (56pt), so a one-character chip
 * is still a full-size target.
 *
 * Law 2: Selected chips = inverted white fill, not chalk.
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

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Let a long label wrap, centred, instead of cutting it at one line.
   *  For option chips whose label is a sentence (onboarding focus, sport and
   *  target choices); short chips keep the single line. */
  wrap?: boolean;
}

export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
  wrap = false,
}: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && !selected && styles.pressedUnselected,
        pressed && !disabled && selected && styles.pressedSelected,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          selected && styles.labelSelected,
          disabled && styles.labelDisabled,
          wrap && styles.labelWrap,
        ]}
        numberOfLines={wrap ? undefined : 1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.touch.min,
    minWidth: theme.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[4], // 16
    // Vertical padding keeps a wrapped label off the border at large text (issue 158).
    paddingVertical: theme.space[2],
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: 'transparent',
  },
  selected: {
    // INVERTED: white fill, dark label. NOT chalk.
    backgroundColor: theme.color.textHi,
    borderColor: theme.color.textHi,
  },
  disabled: {
    opacity: 0.45,
    backgroundColor: theme.color.ink1,
  },
  pressedUnselected: {
    backgroundColor: theme.color.ink1,
  },
  pressedSelected: {
    backgroundColor: theme.color.pressed,
    borderColor: theme.color.pressed,
  },
  label: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  labelWrap: {
    textAlign: 'center',
  },
  labelSelected: {
    // ink0 on the inverted textHi fill
    color: theme.color.ink0,
  },
  labelDisabled: {
    color: theme.color.textLow,
  },
});
