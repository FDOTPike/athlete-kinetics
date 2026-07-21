/**
 * PrimaryButton — §1b primary action.
 *
 * Sizes:
 *   default  minHeight 56pt  (theme.touch.min)
 *   log      minHeight 72pt  (theme.touch.log)  — LOG SET button only
 *
 * States:
 *   default  textHi fill, ink0 label
 *   pressed  pressed fill, opacity 0.85, 160 ms
 *   disabled line fill, textLow label, 45% opacity
 *   focused  chalk border ring
 *
 * Motion: opacity/transform only. theme.motion.state.duration = 160 ms.
 * Reduced-motion: use motionDuration(reduced) = 0 via AccessibilityInfo async flag.
 *
 * Law: zero hex literals. Chalk is NOT used here — it marks position, not action.
 */
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';
import { motionDuration } from './motionDuration';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Use 'log' for the 72pt LOG SET action. Default is 56pt. */
  size?: 'default' | 'log';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  size = 'default',
  accessibilityLabel,
  style,
  testID,
}: PrimaryButtonProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(1)).current;

  const animateIn = (): void => {
    Animated.timing(opacity, {
      toValue: 0.82,
      duration: motionDuration(theme.motion.state.duration),
      useNativeDriver: false,
    }).start();
  };
  const animateOut = (): void => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: motionDuration(theme.motion.state.duration),
      useNativeDriver: false,
    }).start();
  };

  const minHeight = size === 'log' ? theme.touch.log : theme.touch.min;

  return (
    <Animated.View style={[{ opacity }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          { minHeight },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[5], // 24
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.textHi,
  },
  pressed: {
    backgroundColor: theme.color.pressed,
  },
  disabled: {
    backgroundColor: theme.color.line,
    opacity: 0.45,
  },
  label: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.ink0,
    letterSpacing: 0.4,
  },
  labelDisabled: {
    color: theme.color.textLow,
  },
});
