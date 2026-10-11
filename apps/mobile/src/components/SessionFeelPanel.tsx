/**
 * SessionFeelPanel — how a finished session went, and why (070).
 *
 * A record, not a decision. Saving changes no prescription, block or
 * progression. The athlete answers by tapping: one answer for how the session
 * went and, unless it went as planned, at least one reason from a closed list.
 * The typed note is optional, is stored word for word, and is never
 * interpreted by this component or by anything it calls. The note starters
 * only put a few words into the note for the athlete to finish: they are a
 * prompt for what is worth writing down, and they record nothing themselves.
 *
 * Because nothing here acts, one sentence says so and names the two places
 * in the app that do act on a report about the athlete's body. It is always
 * on the panel, so it is there for pain that is typed with no tap as well,
 * and it stands out once a reason about the body is chosen or a "Body" line
 * is started: larger and brighter for the eye, and read out once for a screen
 * reader. It follows the taps only, never the typed words.
 *
 * The rules for a valid answer live in the pure module (sessionFeel.ts) and
 * are applied by the store; this component only reports what the store said.
 *
 * Law: zero hex literals — theme tokens only.
 * Law: touch targets >= 56pt (Chip and the buttons carry it).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';
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

/** Reasons that are about the athlete's body rather than the session. */
const BODY_REASONS: readonly SessionFeelReason[] = ['pain', 'unwell'];

/**
 * Always shown. This panel only records, so the athlete is told where a report
 * does change training: first the place they can use now, after a session, and
 * then the one for next time. The two names are the labels of those controls
 * (BlockScreen, SessionScreen) and "Plan" is that tab's name; a test keeps
 * them in step.
 */
export const SESSION_FEEL_RECORD_ONLY_TEXT =
  'This is a record only. It does not adjust your training. If something hurts or you feel unwell, '
  + 'report it under "Something feels off" on the Plan screen. '
  + 'During a session, use "Report discomfort" on the lift.';

/**
 * Note starters: six kinds of line worth writing, each with the words a tap
 * puts into the note and one example of a finished line. Order is display order.
 */
export const SESSION_NOTE_STARTERS = [
  { id: 'effort', label: 'Effort', example: 'felt heavy from set 3, RPE 9 not 8' },
  { id: 'body', label: 'Body', example: 'left knee, sharp, 4/10, on the way down, since set 2' },
  { id: 'recovery', label: 'Recovery', example: 'slept 5 h, night shift' },
  { id: 'changed', label: 'Changed', example: 'did 60 kg instead of 70, bar path off' },
  { id: 'went_well', label: 'Went well', example: 'squat moved fast, could add 2.5 kg' },
  { id: 'question', label: 'Question', example: 'is the split squat 8 each leg or 8 total' },
] as const;
export type SessionNoteStarterId = (typeof SESSION_NOTE_STARTERS)[number]['id'];

/**
 * The note after a starter is tapped: the starter's label and a colon on a
 * line of its own, after whatever is already there. Returns the note unchanged
 * when the result would not fit.
 */
export function withNoteStarter(note: string, label: string): string {
  const lead = note.length === 0 || note.endsWith('\n') ? '' : '\n';
  const next = `${note}${lead}${label}: `;
  return next.length > SESSION_FEEL_NOTE_MAX_LENGTH ? note : next;
}

/** One line for the completion screen: "Harder than planned: unwell, short on time." */
export function describeSessionFeel(record: SessionFeelRecord): string {
  const answer = SESSION_FEEL_LABEL[record.feel];
  if (record.reasons.length === 0) return `${answer}.`;
  return `${answer}: ${record.reasons.map((reason) => SESSION_FEEL_REASON_LABEL[reason].toLowerCase()).join(', ')}.`;
}

/** 'nothing_to_save': the answer was optional and neither an answer nor a note was given. */
export type SessionFeelSaveResult = SessionFeelProblem | 'not_saved' | 'nothing_to_save' | null;

const PROBLEM_TEXT: Record<Exclude<SessionFeelSaveResult, null>, string> = {
  feel_required: 'Choose how the session went.',
  reason_required: 'Choose at least one reason.',
  unknown_value: 'This could not be saved. Your session is still recorded.',
  not_saved: 'This could not be saved. Your session is still recorded.',
  nothing_to_save: 'Type a note, or choose how the session went.',
};

export interface SessionFeelPanelProps {
  /** The answer already saved for this session, or null. */
  saved: SessionFeelRecord | null;
  /** The note already saved for this session, or null. */
  note: string | null;
  /** True when the session went to plan, so nothing is being asked and a note
   *  may be saved on its own. Only changes the wording; the caller decides
   *  what a save with no answer does. */
  answerOptional?: boolean;
  /** Asks the store to save. Returns null when saved, otherwise why not. */
  onSave: (draft: SessionFeelDraft, note: string) => SessionFeelSaveResult;
  /** Leave without saving, or after a save. */
  onClose: () => void;
}

/**
 * The sub-view that asks how a finished session went. Starts from the saved
 * answer when there is one, so it doubles as the way to correct it.
 */
export function SessionFeelPanel({ saved, note, answerOptional = false, onSave, onClose }: SessionFeelPanelProps): React.JSX.Element {
  const [feel, setFeel] = useState<SessionFeelKind | null>(saved?.feel ?? null);
  const [reasons, setReasons] = useState<readonly SessionFeelReason[]>(saved?.reasons ?? []);
  const [noteText, setNoteText] = useState(note ?? '');
  const [problem, setProblem] = useState<Exclude<SessionFeelSaveResult, null> | null>(null);
  const [starter, setStarter] = useState<SessionNoteStarterId | null>(null);
  // Stays true once a "Body" line was started in this visit, whatever is tapped next.
  const [bodyLineStarted, setBodyLineStarted] = useState(false);

  /** Tap a reason on or off. Any earlier "could not save" message is cleared. */
  const toggleReason = (reason: SessionFeelReason): void => {
    setProblem(null);
    setReasons((current) => (current.includes(reason)
      ? current.filter((entry) => entry !== reason)
      : [...current, reason]));
  };

  /** Tap a note starter: its words go into the note, and its example is shown. */
  const startLine = (id: SessionNoteStarterId, label: string): void => {
    setStarter(id);
    if (id === 'body') setBodyLineStarted(true);
    setNoteText((current) => withNoteStarter(current, label));
  };

  /** Ask the store to save. Close on success; otherwise stay open and say why. */
  const save = (): void => {
    const result = onSave({ feel, reasons }, noteText);
    if (result === null) onClose();
    else setProblem(result);
  };

  const reasonsShown = feel !== null && feel !== 'as_planned';
  const bodyReasonChosen = reasonsShown && reasons.some((reason) => BODY_REASONS.includes(reason));
  // The sentence is always there; this only decides whether it stands out.
  const aboutTheBody = bodyReasonChosen || bodyLineStarted;
  // A screen reader hears it at the moment a sighted athlete sees it change.
  // Not on opening a saved answer: nothing was tapped then.
  const stoodOut = useRef(aboutTheBody);
  useEffect(() => {
    if (aboutTheBody && !stoodOut.current) {
      AccessibilityInfo.announceForAccessibility(SESSION_FEEL_RECORD_ONLY_TEXT);
    }
    stoodOut.current = aboutTheBody;
  }, [aboutTheBody]);

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="session-feel-panel"
    >
      <Text style={styles.title} accessibilityRole="header">How did this session go?</Text>
      {answerOptional && (
        <Text style={styles.caption} testID="session-feel-optional">
          This session went to plan, so an answer is optional. You can save a note on its own.
        </Text>
      )}
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

      {reasonsShown && (
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

      <Text
        style={aboutTheBody ? styles.notice : styles.standing}
        testID="session-feel-record-only"
      >
        {SESSION_FEEL_RECORD_ONLY_TEXT}
      </Text>

      <View style={styles.group}>
        <Text style={styles.label}>Note (optional)</Text>
        <Text style={styles.caption}>
          Say what, where, when and how much. A number says more than a word. Tap to start a line:
        </Text>
        <View style={styles.chipRow} testID="session-note-starters">
          {SESSION_NOTE_STARTERS.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              selected={false}
              onPress={() => startLine(entry.id, entry.label)}
              accessibilityLabel={`Start a note line about: ${entry.label}`}
              testID={`session-note-starter-${entry.id}`}
            />
          ))}
        </View>
        {starter !== null && (
          <Text style={styles.caption} testID="session-note-example">
            {`For example: ${SESSION_NOTE_STARTERS.find((entry) => entry.id === starter)?.example ?? ''}`}
          </Text>
        )}
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
          Saved in your training log exactly as you typed it.
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
  standing: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  // Larger as well as brighter, so the change does not rest on colour alone.
  notice: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  problem: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  actions: {
    gap: theme.space[2],
  },
});
