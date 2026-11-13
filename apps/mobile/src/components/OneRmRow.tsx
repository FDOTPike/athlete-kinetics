/**
 * OneRmRow.tsx — one one-rep-max field: type the number directly (a 300 kg
 * deadlifter must not tap +2.5 a hundred times); ± buttons remain for fine
 * adjustment. Shared by Profile and the optional onboarding maxes step
 * (issue #218), so both keep the same 20–500 kg clamp, the same 0.25 kg grid
 * and the same saved-as message.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme/theme';
import { useStore } from '../state/useStore';

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

/** A typed max as the field commits it: null for empty, garbage or under
 *  20 kg (which clears the max), otherwise the number as typed. */
export const parseOneRmText = (text: string): number | null => {
  const parsed = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 20 ? parsed : null;
};

export interface OneRmRowProps {
  label: string;
  valueKg: number | undefined;
  onChange: (kg: number | null) => boolean | void;
  /** Every keystroke, before it is committed. A screen that can remove the
   *  field while it still has focus (the onboarding step's NEXT) uses it to
   *  commit the typed text itself, since no end-of-editing event comes then. */
  onTextChange?: (text: string) => void;
  /** The athlete the row was drawn for: typed text is never saved to another. */
  athleteId?: string;
  /** Lets the screen save typed text before a Coach Mode switch. */
  registerCommit?: (commit: () => void) => () => void;
}

export function OneRmRow({ label, valueKg, onChange, onTextChange, athleteId, registerCommit }: OneRmRowProps): React.JSX.Element {
  const [text, setText] = useState(valueKg !== undefined ? formatMaxKg(valueKg) : '');
  const [clampNote, setClampNote] = useState<string | null>(null);
  const clampedSaveRef = useRef<{ valueKg: number; athleteId: string | undefined } | null>(null);
  useEffect(() => {
    setText(valueKg !== undefined ? formatMaxKg(valueKg) : '');
    const saved = clampedSaveRef.current;
    clampedSaveRef.current = null;
    if (saved === null || saved.valueKg !== valueKg || saved.athleteId !== athleteId) {
      setClampNote(null);
    }
  }, [valueKg, athleteId]);
  const saveText = (): void => {
    const parsed = parseOneRmText(text);
    if (parsed === null) {
      if (onChange(null) === false) {
        setText(valueKg !== undefined ? formatMaxKg(valueKg) : '');
        setClampNote(null);
        return;
      }
      setText('');
      setClampNote(null);
      return;
    }
    if (onChange(parsed) === false) {
      setText(valueKg !== undefined ? formatMaxKg(valueKg) : '');
      setClampNote(null);
      return;
    }
    const kept = oneRmKeptKg(parsed);
    const note = oneRmClampNote(parsed);
    clampedSaveRef.current = note !== null ? { valueKg: kept, athleteId } : null;
    setText(formatMaxKg(kept));
    // Walk W4-7: 999 became 500.0 with no word. Say what was saved.
    setClampNote(note);
  };
  // Walk A-12 (#224): Android Back hides the keyboard without ending editing,
  // and the typed text was lost when Profile closed. Typed text is now saved
  // on end of editing, blur, keyboard hide or unmount, whichever comes first.
  // It is saved once: text that matches the saved value is not saved again,
  // and neither is text already saved from this render (Enter fires end of
  // editing and blur before the row re-renders with the saved value).
  const savedThisRender = useRef(false);
  useEffect(() => { savedThisRender.current = false; });
  const commitText = (): void => {
    const shown = valueKg !== undefined ? formatMaxKg(valueKg) : '';
    if (text === shown || savedThisRender.current) return;
    // During or after a Coach Mode switch the store belongs to another athlete.
    if (athleteId !== undefined && useStore.getState().activeAthleteId !== athleteId) return;
    savedThisRender.current = true;
    saveText();
  };
  const commitLatest = useRef(commitText);
  commitLatest.current = commitText;
  useEffect(() => {
    if (registerCommit === undefined) return undefined;
    const hide = Keyboard.addListener('keyboardDidHide', () => commitLatest.current());
    const unregister = registerCommit(() => commitLatest.current());
    return () => {
      hide.remove();
      unregister();
      commitLatest.current();
    };
  }, [registerCommit]);
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
          onChangeText={(next) => { setText(next); setClampNote(null); onTextChange?.(next); }}
          onEndEditing={commitText}
          onBlur={commitText}
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
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
});
