/**
 * FocusPrimitives.tsx - small RN-core building blocks for the utility-first
 * surfaces.  They deliberately keep secondary information behind an explicit
 * disclosure rather than introducing cards, charts, or modal dependencies.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { palette, useStore } from '../state/useStore';

export type FocusTone = 'default' | 'active' | 'success' | 'caution' | 'danger';

const toneColor: Record<FocusTone, string> = {
  default: palette.line,
  active: palette.green,
  success: palette.green,
  caution: palette.amber,
  danger: palette.red,
};

/** Add the profile preference on top of React Native's native OS font scaling.
 * Nothing disables allowFontScaling or constrains an accessibility multiplier. */
function useAppTextScale(): number {
  const textScale = useStore((state) => state.uiPreferences.textScale);
  return textScale === 'extra_large' ? 1.28 : textScale === 'large' ? 1.14 : 1;
}

interface TextProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

/** Short metadata only. Keep primary instructions in sentence case. */
export function Eyebrow({ children, style }: TextProps): React.JSX.Element {
  const scale = useAppTextScale();
  return <Text style={[styles.eyebrow, { fontSize: 12 * scale }, style]}>{children}</Text>;
}

export function Heading({ children, style }: TextProps): React.JSX.Element {
  const scale = useAppTextScale();
  return <Text style={[styles.heading, { fontSize: 26 * scale }, style]}>{children}</Text>;
}

export function Body({ children, style }: TextProps): React.JSX.Element {
  const scale = useAppTextScale();
  return <Text style={[styles.body, { fontSize: 16 * scale, lineHeight: 23 * scale }, style]}>{children}</Text>;
}

export function Caption({ children, style }: TextProps): React.JSX.Element {
  const scale = useAppTextScale();
  return <Text style={[styles.caption, { fontSize: 14 * scale, lineHeight: 20 * scale }, style]}>{children}</Text>;
}

interface ScreenProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Screen({ children, contentStyle, testID }: ScreenProps): React.JSX.Element {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, contentStyle]}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

interface SectionProps {
  children: React.ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export function Section({ children, title, style }: SectionProps): React.JSX.Element {
  return (
    <View style={[styles.section, style]}>
      {title !== undefined && <Eyebrow style={styles.sectionTitle}>{title}</Eyebrow>}
      {children}
    </View>
  );
}

interface FocusCardProps {
  children?: React.ReactNode;
  eyebrow?: string;
  title: string;
  tone?: FocusTone;
  style?: StyleProp<ViewStyle>;
}

export function FocusCard({
  children,
  eyebrow,
  title,
  tone = 'default',
  style,
}: FocusCardProps): React.JSX.Element {
  return (
    <View style={[styles.focusCard, { borderColor: toneColor[tone] }, style]}>
      {eyebrow !== undefined && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading style={styles.focusTitle}>{title}</Heading>
      {children}
    </View>
  );
}

interface ActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryAction({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ActionProps): React.JSX.Element {
  const scale = useAppTextScale();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.primaryAction,
        pressed && !disabled && styles.primaryActionPressed,
        disabled && styles.primaryActionDisabled,
        style,
      ]}
    >
      <Text style={[styles.primaryActionText, { fontSize: 16 * scale }, disabled && styles.primaryActionTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SecondaryAction({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ActionProps): React.JSX.Element {
  const scale = useAppTextScale();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.secondaryAction,
        pressed && !disabled && styles.secondaryActionPressed,
        disabled && styles.secondaryActionDisabled,
        style,
      ]}
    >
      <Text style={[styles.secondaryActionText, { fontSize: 15 * scale }, disabled && styles.secondaryActionTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface StatusMarkProps {
  label: string;
  tone?: FocusTone;
  style?: StyleProp<ViewStyle>;
}

export function StatusMark({
  label,
  tone = 'default',
  style,
}: StatusMarkProps): React.JSX.Element {
  const scale = useAppTextScale();
  const color = toneColor[tone];
  return (
    <View style={[styles.statusMark, { borderColor: color }, style]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color, fontSize: 12 * scale }]}>{label}</Text>
    </View>
  );
}

interface DisclosureProps {
  children: React.ReactNode;
  label: string;
  hint?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tone?: FocusTone;
  accessibilityLabel?: string;
}

/** Inline disclosure: context is deliberately never presented in a modal. */
export function Disclosure({
  children,
  label,
  hint,
  defaultOpen = false,
  open,
  onOpenChange,
  tone = 'default',
  accessibilityLabel,
}: DisclosureProps): React.JSX.Element {
  const scale = useAppTextScale();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const expanded = open ?? uncontrolledOpen;
  const toggle = (): void => {
    const next = !expanded;
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const color = toneColor[tone];

  return (
    <View style={[styles.disclosure, expanded && { borderColor: color }]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.disclosureButton, pressed && styles.disclosurePressed]}
      >
        <View style={styles.disclosureCopy}>
          <Text style={[styles.disclosureLabel, { fontSize: 16 * scale }]}>{label}</Text>
          {hint !== undefined && !expanded && <Text style={[styles.disclosureHint, { fontSize: 13 * scale, lineHeight: 18 * scale }]}>{hint}</Text>}
        </View>
        <Text style={[styles.disclosureState, { color, fontSize: 13 * scale }]}>{expanded ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {expanded && <View style={styles.disclosureContent}>{children}</View>}
    </View>
  );
}

interface ProgressRowProps {
  label: string;
  value: string;
  detail?: string;
  tone?: FocusTone;
  style?: StyleProp<ViewStyle>;
}

/** A compact key/value row rather than a dashboard metric tile. */
export function ProgressRow({
  label,
  value,
  detail,
  tone = 'default',
  style,
}: ProgressRowProps): React.JSX.Element {
  const scale = useAppTextScale();
  return (
    <View style={[styles.progressRow, style]}>
      <View style={styles.progressCopy}>
        <Text style={[styles.progressLabel, { fontSize: 15 * scale }]}>{label}</Text>
        {detail !== undefined && <Text style={[styles.progressDetail, { fontSize: 12 * scale, lineHeight: 17 * scale }]}>{detail}</Text>}
      </View>
      <Text style={[styles.progressValue, { color: toneColor[tone], fontSize: 15 * scale }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  screenContent: { padding: 20, paddingBottom: 48 },
  section: { marginTop: 24 },
  sectionTitle: { marginBottom: 10 },
  eyebrow: { color: palette.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  heading: { color: palette.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: palette.text, fontSize: 16, lineHeight: 23 },
  caption: { color: palette.dim, fontSize: 14, lineHeight: 20 },
  focusCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  focusTitle: { marginTop: 1 },
  primaryAction: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryActionPressed: { backgroundColor: '#25C88F' },
  primaryActionDisabled: { backgroundColor: palette.line },
  primaryActionText: { color: '#06251B', fontSize: 16, fontWeight: '800', letterSpacing: 0.6 },
  primaryActionTextDisabled: { color: palette.dim },
  secondaryAction: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryActionPressed: { backgroundColor: palette.surface },
  secondaryActionDisabled: { opacity: 0.55 },
  secondaryActionText: { color: palette.text, fontSize: 15, fontWeight: '700' },
  secondaryActionTextDisabled: { color: palette.dim },
  statusMark: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  statusDot: { height: 7, width: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  disclosure: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    marginTop: 10,
  },
  disclosureButton: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  disclosurePressed: { backgroundColor: '#1A1A20' },
  disclosureCopy: { flex: 1 },
  disclosureLabel: { color: palette.text, fontSize: 16, fontWeight: '700' },
  disclosureHint: { color: palette.dim, fontSize: 13, lineHeight: 18, marginTop: 2 },
  disclosureState: { fontSize: 13, fontWeight: '800' },
  disclosureContent: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    padding: 16,
    gap: 12,
  },
  progressRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    gap: 16,
  },
  progressCopy: { flex: 1 },
  progressLabel: { color: palette.text, fontSize: 15, fontWeight: '600' },
  progressDetail: { color: palette.dim, fontSize: 12, lineHeight: 17, marginTop: 1 },
  progressValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
