/**
 * SessionFeelPanel — how a finished session went, and why (070).
 *
 * A record, not a decision. Saving changes no prescription, block or
 * progression. The athlete answers by tapping: one answer for how the session
 * went and, unless it went as planned, at least one reason from a closed list.
 * The typed note is optional, is stored word for word, and is never
 * interpreted by this component or by anything it calls.
 *
 * The rules for a valid answer live in the pure module (sessionFeel.ts) and
 * are applied by the store; this component only reports what the store said.
 *
 * Law: zero hex literals — theme tokens only.
 * Law: touch targets >= 56pt (Chip and the buttons carry it).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SESSION_FEEL_KINDS,
  SESSION_FEEL_REASONS,
  type SessionFeelDraft,
  type SessionFeelKind,
  type SessionFeelProblem,
  type SessionFeelReason,
  type SessionFeelRecord,
} from '@ak/inference';
import { theme } from '../theme/theme';
import { Chip, PrimaryButton, SecondaryButton } from './ui';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';

export const SESSION_FEEL_LABEL: Record<SessionFeelKind, string> = {
  as_planned: 'As planned',
  harder: 'Harder than planned',
  easier: 'Easier than planned',
  stopped_early: 'Stopped early',
};

export const SESSION_FEEL_REASON_LABEL: Record<SessionFeelReason, string> = {
  pain: 'Pain or a niggle',
  tired: 'Tired or slept badly',
  unwell: 'Unwell',
  technique: 'Technique felt off',
  equipment: 'Equipment or gym',
  time: 'Short on time',
  felt_good: 'Felt good',
  other: 'Something else',
};

export const SESSION_FEEL_NOTE_MAX_LENGTH = 1000;

/** One line for the completion screen: "Harder than planned: unwell, short on time." */
export function describeSessionFeel(record: SessionFeelRecord): string {
  const answer = SESSION_FEEL_LABEL[record.feel];
  if (record.reasons.length === 0) return `${answer}.`;
  return `${answer}: ${record.reasons.map((reason) => SESSION_FEEL_REASON_LABEL[reason].toLowerCase()).join(', ')}.`;
}

export type SessionFeelSaveResult = SessionFeelProblem | 'not_saved' | null;

const PROBLEM_TEXT: Record<Exclude<SessionFeelSaveResult, null>, string> = {
  feel_required: 'Choose how the session went.',
  reason_required: 'Choose at least one reason.',
  unknown_value: 'This could not be saved. Your session is still recorded.',
  not_saved: 'This could not be saved. Your session is still recorded.',
};

export interface SessionFeelPanelProps {
  /** The answer already saved for this session, or null. */
  saved: SessionFeelRecord | null;
  /** The note already saved for this session, or null. */
  note: string | null;
  /** Asks the store to save. Returns null when saved, otherwise why not. */
  onSave: (draft: SessionFeelDraft, note: string) => SessionFeelSaveResult;
  /** Leave without saving, or after a save. */
  onClose: () => void;
}

/**
 * The sub-view that asks how a finished session went. Starts from the saved
 * answer when there is one, so it doubles as the way to correct it.
 */
export function SessionFeelPanel({ saved, note, onSave, onClose }: SessionFeelPanelProps): React.JSX.Element {
  const [feel, setFeel] = useState<SessionFeelKind | null>(saved?.feel ?? null);
  const [reasons, setReasons] = useState<readonly SessionFeelReason[]>(saved?.reasons ?? []);
  const [noteText, setNoteText] = useState(note ?? '');
  const [problem, setProblem] = useState<Exclude<SessionFeelSaveResult, null> | null>(null);

  /** Tap a reason on or off. Any earlier "could not save" message is cleared. */
  const toggleReason = (reason: SessionFeelReason): void => {
    setProblem(null);
    setReasons((current) => (current.includes(reason)
      ? current.filter((entry) => entry !== reason)
      : [...current, reason]));
  };

  /** Ask the store to save. Close on success; otherwise stay open and say why. */
  const save = (): void => {
    const result = onSave({ feel, reasons }, noteText);
    if (result === null) onClose();
    else setProblem(result);
  };

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="session-feel-panel"
    >
      <Text style={styles.title} accessibilityRole="header">How did this session go?</Text>
      <View style={styles.chipRow}>
        {SESSION_FEEL_KINDS.map((kind) => (
          <Chip
            key={kind}
            label={SESSION_FEEL_LABEL[kind]}
            selected={feel === kind}
            onPress={() => { setProblem(null); setFeel(kind); }}
            testID={`session-feel-${kind}`}
          />
        ))}
      </View>

      {feel !== null && feel !== 'as_planned' && (
        <View style={styles.group} testID="session-feel-reasons">
          <Text style={styles.label}>Why? Choose any that apply.</Text>
          <View style={styles.chipRow}>
            {SESSION_FEEL_REASONS.map((reason) => (
              <Chip
                key={reason}
                label={SESSION_FEEL_REASON_LABEL[reason]}
                selected={reasons.includes(reason)}
                onPress={() => toggleReason(reason)}
                testID={`session-feel-reason-${reason}`}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          disableFullscreenUI
          style={styles.input}
          value={noteText}
          onChangeText={setNoteText}
          maxLength={SESSION_FEEL_NOTE_MAX_LENGTH}
          multiline
          placeholder="Anything you want to remember about this session"
          placeholderTextColor={theme.color.textLow}
          accessibilityLabel="Note about this session, optional"
          testID="session-feel-note"
        />
        <Text style={styles.caption}>
          Saved in your training log exactly as you typed it. Nothing here changes your plan.
        </Text>
      </View>

      {problem !== null && (
        <Text style={styles.problem} accessibilityRole="alert" testID="session-feel-problem">
          {PROBLEM_TEXT[problem]}
        </Text>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Save" onPress={save} accessibilityLabel="Save how this session went" testID="session-feel-save" />
        <SecondaryButton label="Cancel" onPress={onClose} accessibilityLabel="Cancel without saving" testID="session-feel-cancel" />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  content: {
    padding: theme.space[4],
    gap: theme.space[4],
  },
  title: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  group: {
    gap: theme.space[2],
  },
  label: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  input: {
    minHeight: 82,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.ink0,
    color: theme.color.textHi,
    fontSize: theme.font.body.fontSize,
    lineHeight: theme.font.body.lineHeight,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[3],
    textAlignVertical: 'top',
  },
  caption: {
    ...theme.font.label,
    color: theme.color.textLow,
  },
  problem: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  actions: {
    gap: theme.space[2],
  },
});
