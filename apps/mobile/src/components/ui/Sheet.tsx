/**
 * Sheet — §1b bottom sheet.
 *
 * borderRadius: theme.radius.sheet (10pt) on top corners only.
 * Slides in with opacity + translateY, theme.motion.sheet.duration (200 ms).
 * Background: theme.color.ink1.
 * Overlay darkens ink0 at 60% opacity behind the sheet.
 *
 * Law: zero hex literals.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../../theme/theme';
import { motionDuration } from './motionDuration';

export interface SheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Accessible description of the sheet's purpose */
  accessibilityLabel?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Sheet({
  visible,
  onDismiss,
  accessibilityLabel,
  children,
  style,
  testID,
}: SheetProps): React.JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    const duration = motionDuration(theme.motion.sheet.duration);

    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 80, duration, useNativeDriver: false }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID={testID}>
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <Animated.View
        style={[
          styles.sheet,
          { opacity, transform: [{ translateY }] },
          style,
        ]}
        accessibilityViewIsModal
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.color.ink0,
    opacity: 0.6,
  },
  sheet: {
    backgroundColor: theme.color.ink1,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    padding: theme.space[5], // 24
    gap: theme.space[4],     // 16
    // Ensure content above system nav bar
    paddingBottom: theme.space[7], // 48
  },
});
