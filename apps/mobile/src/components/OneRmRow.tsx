/**
 * OneRmRow.tsx — one one-rep-max field: type the number directly (a 300 kg
 * deadlifter must not tap +2.5 a hundred times); ± buttons remain for fine
 * adjustment. Shared by Profile and the optional onboarding maxes step
 * (issue #218), so both keep the same 20–500 kg clamp, the same 0.25 kg grid
 * and the same saved-as message.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme/theme';

/** A max as the field shows it: one decimal, or two for a quarter kilogram. */
export const formatMaxKg = (kg: number): string => {
  const hundredths = Math.round(kg * 100);
  return (hundredths / 100).toFixed(hundredths % 10 === 0 ? 1 : 2);
};

/** The max the store keeps for a typed number: on the 0.25 kg grid (issue
 *  #233), clamped to 20–500 kg. The store applies the same rule. */
export const oneRmKeptKg = (kg: number): number =>
  Math.min(500, Math.max(20, Math.round(kg / 0.25) * 0.25));

/** What to say when a typed one-rep max is outside what the field keeps. */
export const oneRmClampNote = (typedKg: number): string | null =>
  typedKg > 500 ? `Saved as 500.0 kg, the highest one-rep max this field accepts. Check the number you typed.` : null;

export interface OneRmRowProps {
  label: string;
  valueKg: number | undefined;
  onChange: (kg: number | null) => void;
}

export function OneRmRow({ label, valueKg, onChange }: OneRmRowProps): React.JSX.Element {
  const [text, setText] = useState(valueKg !== undefined ? formatMaxKg(valueKg) : '');
  const [clampNote, setClampNote] = useState<string | null>(null);
  useEffect(() => {
    setText(valueKg !== undefined ? formatMaxKg(valueKg) : '');
  }, [valueKg]);
  const commitText = (): void => {
    const parsed = Number.parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 20) {
      onChange(null); // empty/garbage/sub-20 clears the max
      setText('');
      setClampNote(null);
      return;
    }
    onChange(parsed); // store snaps to 0.25 and clamps 20..500
    setText(formatMaxKg(oneRmKeptKg(parsed)));
    // Walk W4-7: 999 became 500.0 with no word. Say what was saved.
    setClampNote(oneRmClampNote(parsed));
  };
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <Pressable
          onPress={() => { setClampNote(null); if (valueKg !== undefined) onChange(valueKg - 2.5 < 20 ? null : valueKg - 2.5); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label} one rep max`}
          style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
        >
          <Text style={styles.numBtnText}>−</Text>
        </Pressable>
        <TextInput
          disableFullscreenUI
          style={styles.oneRmInput}
          value={text}
          // Review (PR 194): the clamp notice describes one saved value; any
          // new edit, a + or −, or a cleared max makes it untrue, so it goes.
          onChangeText={(next) => { setText(next); setClampNote(null); }}
          onEndEditing={commitText}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={theme.color.textLow}
          maxLength={6}
          accessibilityLabel={`${label} one rep max in kilograms, type to set`}
        />
        <Pressable
          onPress={() => { setClampNote(null); onChange((valueKg ?? 57.5) + 2.5); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label} one rep max`}
          style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
        >
          <Text style={styles.numBtnText}>+</Text>
        </Pressable>
      </View>
      {clampNote !== null && <Text style={styles.fieldHint} accessibilityLiveRegion="polite">{clampNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: theme.space[4] },
  // flexShrink: a long heading wraps instead of pushing its info button off
  // screen at large font sizes (Android walk 2026-11-03, a11y-5).
  fieldLabel: { ...theme.font.eyebrow, color: theme.color.textLow, flexShrink: 1 },
  fieldHint: { ...theme.font.label, color: theme.color.textMid, marginBottom: theme.space[2] },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  numBtn: {
    width: theme.touch.min,
    height: theme.touch.min,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnPressed: { backgroundColor: theme.color.ink0 },
  numBtnText: { color: theme.color.textHi, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  oneRmInput: {
    flex: 1,
    minHeight: theme.touch.min,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textHi,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: theme.space[1],
  },
});
