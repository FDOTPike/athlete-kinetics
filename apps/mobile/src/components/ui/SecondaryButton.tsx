/**
 * SecondaryButton — §1b outlined secondary action.
 *
 * Outlined: 1pt line border, transparent fill.
 * Pressed: ink1 fill, opacity 0.85, 160 ms.
 * Full-width: `fullWidth` prop — used for Halt. NOT styled as alarm/danger.
 * minHeight: theme.touch.min (56pt).
 *
 * Law: chalk is NEVER used here. No red/amber/green.
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

export interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Full-width layout for halt/stop affordances. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
  testID,
}: SecondaryButtonProps): React.JSX.Element {
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

  return (
    <Animated.View style={[{ opacity }, fullWidth && styles.fullWidthContainer, style]}>
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
          fullWidth && styles.fullWidth,
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
  fullWidthContainer: {
    alignSelf: 'stretch',
  },
  base: {
    minHeight: theme.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[5], // 24
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    backgroundColor: theme.color.ink1,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    letterSpacing: 0.4,
  },
  labelDisabled: {
    color: theme.color.textLow,
  },
});
