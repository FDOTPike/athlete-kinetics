/**
 * Disclosure — §1b inline disclosure.
 *
 * 56pt trigger row. Chevron rotates on open (Animated.timing, 160 ms).
 * Context is never presented in a modal — always inline.
 * Controlled and uncontrolled modes.
 *
 * Law: zero hex literals. No chalk.
 */
import React, { useRef, useState } from 'react';
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

export interface DisclosureProps {
  label: string;
  hint?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Disclosure({
  label,
  hint,
  defaultOpen = false,
  open,
  onOpenChange,
  accessibilityLabel,
  children,
  style,
  testID,
}: DisclosureProps): React.JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const expanded = open ?? uncontrolledOpen;

  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = (): void => {
    const next = !expanded;
    Animated.timing(rotation, {
      toValue: next ? 1 : 0,
      duration: motionDuration(theme.motion.state.duration),
      useNativeDriver: false,
    }).start();
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const chevronRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
        ]}
      >
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerLabel}>{label}</Text>
          {hint !== undefined && !expanded && (
            <Text style={styles.triggerHint}>{hint}</Text>
          )}
        </View>
        <Animated.Text
          style={[styles.chevron, { transform: [{ rotate: chevronRotation }] }]}
        >
          ⌄
        </Animated.Text>
      </Pressable>
      {expanded && (
        <View style={styles.body}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    overflow: 'hidden',
  },
  trigger: {
    minHeight: theme.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4], // 16
    paddingVertical: theme.space[3],   // 12
    gap: theme.space[3],               // 12
  },
  triggerPressed: {
    backgroundColor: theme.color.ink0,
  },
  triggerCopy: {
    flex: 1,
    gap: theme.space[1], // 4
  },
  triggerLabel: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontWeight: '700',
  },
  triggerHint: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  chevron: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
    fontSize: 20,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    padding: theme.space[4], // 16
    gap: theme.space[3],     // 12
  },
});
