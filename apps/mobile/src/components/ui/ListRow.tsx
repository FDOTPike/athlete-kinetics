/**
 * ListRow — §1b list row.
 *
 * minHeight: 64pt.
 * chalkSpine: 3pt left border in theme.color.chalk — TODAY/CURRENT ONLY.
 *             Chalk marks WHERE YOU ARE, never a reward or warning.
 * trailing: 'now' renders "NOW" eyebrow, 'check' renders "✓".
 * Pressed: ink1 background, 160 ms opacity.
 *
 * Law 2: chalkSpine is the ONLY chalk usage on this component.
 * Law: zero hex literals.
 */
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';
import { motionDuration } from './motionDuration';

export interface ListRowProps {
  /** Primary label */
  label: string;
  /** Secondary detail, rendered as textMid body */
  detail?: string;
  /** 3pt chalk left spine — TODAY / CURRENT marker only */
  chalkSpine?: boolean;
  /** Trailing element: 'now' = "NOW" eyebrow, 'check' = "✓" */
  trailing?: 'now' | 'check';
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Additional content rendered below label+detail */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ListRow({
  label,
  detail,
  chalkSpine = false,
  trailing,
  onPress,
  accessibilityLabel,
  children,
  style,
  testID,
}: ListRowProps): React.JSX.Element {
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

  const content = (
    <View style={[styles.row, chalkSpine && styles.chalkSpine, style]} testID={testID}>
      <View style={styles.copy}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {detail !== undefined && (
          <Text style={styles.detail}>{detail}</Text>
        )}
        {children}
      </View>
      {trailing === 'now' && (
        <Text style={styles.trailingNow}>NOW</Text>
      )}
      {trailing === 'check' && (
        <Text style={styles.trailingCheck}>✓</Text>
      )}
    </View>
  );

  if (onPress === undefined) {
    return content;
  }

  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5], // 24
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
    gap: theme.space[4], // 16
  },
  chalkSpine: {
    borderLeftWidth: 3,
    borderLeftColor: theme.color.chalk,
    paddingLeft: theme.space[4], // 16 — compensate for spine width
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space[1], // 4
  },
  label: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontWeight: '600',
  },
  detail: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  trailingNow: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.chalk,
  },
  trailingCheck: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
});
