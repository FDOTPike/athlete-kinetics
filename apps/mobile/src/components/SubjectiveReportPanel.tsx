/**
 * SubjectiveReportPanel — "Something feels off" on the completion screen (issue #180, step S5).
 *
 * The same form the Plan screen offers under "Something feels off" (BlockScreen),
 * opened from the completion view, with the same gate: without a readiness
 * vector no form is shown; the "Readiness is needed first" state is shown in its
 * place, with the words the Plan screen uses, so a report is never typed into a
 * form that cannot send it.
 *
 * This component only collects the text and severity and hands them to onApply,
 * which the completion view wires to the store action the Plan form calls
 * (reportSubjective). It routes, matches and decides nothing itself. When the
 * store call fails, the typed text stays on screen so the report does not vanish.
 *
 * Law: zero hex literals — theme tokens only.
 * Law: touch targets >= 56pt (Chip, PrimaryButton and SecondaryButton carry it).
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TriageOutcome } from '../state/useStore';
import { theme } from '../theme/theme';
import { Chip, PrimaryButton, SecondaryButton } from './ui';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';

/** Shown on both report forms (completion screen and Plan screen) when the store did not take the report. */
export const REPORT_NOT_SENT_TEXT = 'Your report was not sent. It is still here, so you can try again.';

export interface SubjectiveReportPanelProps {
  /** False when there is no readiness vector: the form is replaced by the gate. */
  hasVector: boolean;
  /** The store's latest answer to a report. Shown only after Apply in this view. */
  lastTriage: TriageOutcome | null;
  /** True while the store is checking a report. */
  triaging: boolean;
  /** False when semantic matching is unavailable in this build (the Plan form's caption). */
  triageReady: boolean;
  /** Hands the text and severity to the store action. Resolves true only when the report
   *  is stored; false or a rejection means it was not sent, and the text stays. */
  onApply: (text: string, severity: number) => Promise<boolean>;
  /** Back to the completion screen. */
  onClose: () => void;
}

const SEVERITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function SubjectiveReportPanel({
  hasVector,
  lastTriage,
  triaging,
  triageReady,
  onApply,
  onClose,
}: SubjectiveReportPanelProps): React.JSX.Element {
  const [reportText, setReportText] = useState('');
  const [reportSeverity, setReportSeverity] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const [notSent, setNotSent] = useState(false);
  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;

  // One Apply at a time: a second press before the first answer arrives sends
  // nothing (the store would refuse it, and its "not sent" would sit beside the
  // first report's result). The ref is synchronous; `pending` disables the button.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const apply = (): void => {
    if (reportSeverity === null || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setNotSent(false);
    // A new report starts without the previous report's result on screen.
    setApplied(false);
    const settled = (): void => { inFlight.current = false; setPending(false); };
    // The text is cleared only once the store has stored the report. Anything else
    // keeps it on screen and says so, so nothing typed is lost.
    onApply(reportText, reportSeverity).then((stored) => {
      settled();
      if (!stored) { setNotSent(true); return; }
      setReportText('');
      setReportSeverity(null);
      setApplied(true);
    }, () => { settled(); setNotSent(true); });
  };

  const haltCard = halted && lastTriage !== null && lastTriage.kind === 'matched' ? (
    <View style={[styles.card, styles.haltCard]} testID="completion-report-halt">
      <Text style={styles.eyebrow}>SAFETY</Text>
      <Text style={styles.cardTitle}>Stop training today</Text>
      <Text style={styles.bodyText}>{lastTriage.directive.vector.coaching_cue}</Text>
      {lastTriage.directive.followUp !== null && (
        <Text style={styles.bodyText}>{lastTriage.directive.followUp}</Text>
      )}
    </View>
  ) : null;

  if (!hasVector) {
    return (
      <KeyboardAwareScrollView style={styles.screen} contentContainerStyle={styles.content} testID="completion-report-panel">
        {haltCard}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>COACH</Text>
          <Text style={styles.cardTitle}>Readiness is needed first</Text>
          <Text style={styles.bodyText}>
            Sync telemetry or load the demo athlete before asking Coach to adjust today's plan.
          </Text>
        </View>
        <SecondaryButton label="Back" onPress={onClose} accessibilityLabel="Back to the summary" testID="completion-report-close" />
      </KeyboardAwareScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView style={styles.screen} contentContainerStyle={styles.content} testID="completion-report-panel">
      {haltCard}
      <Text style={styles.title} accessibilityRole="header">Something feels off</Text>
      <Text style={styles.caption}>Add a subjective report only when you need Coach to adapt</Text>
      {!triageReady && (
        <Text style={styles.caption}>
          Semantic matching is unavailable in this build. Injury-language safety checks still apply.
        </Text>
      )}
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={reportText}
        onChangeText={setReportText}
        placeholder="For example: my knee feels sore when I squat"
        placeholderTextColor={theme.color.textLow}
        maxLength={500}
        multiline
        accessibilityLabel="Describe how your body feels today"
        testID="completion-report-text"
      />
      <Text style={styles.label}>Severity from 1 to 10</Text>
      <View style={styles.chipRow}>
        {SEVERITIES.map((severity) => (
          <Chip
            key={severity}
            label={String(severity)}
            selected={reportSeverity === severity}
            onPress={() => setReportSeverity(severity)}
            accessibilityLabel={`Severity ${severity} of 10`}
            testID={`completion-report-severity-${severity}`}
          />
        ))}
      </View>
      <PrimaryButton
        label={triaging ? 'Checking report' : 'Apply report'}
        disabled={reportText.trim().length === 0 || reportSeverity === null || triaging || pending}
        onPress={apply}
        accessibilityLabel={triaging ? 'Checking report' : 'Apply report'}
        testID="completion-report-apply"
      />
      {notSent && (
        <Text style={styles.caption} accessibilityRole="alert" testID="completion-report-not-sent">
          {REPORT_NOT_SENT_TEXT}
        </Text>
      )}

      {applied && lastTriage !== null && lastTriage.kind === 'positive' && (
        <View style={styles.result}>
          <Text style={styles.badge}>Noted</Text>
          <Text style={styles.bodyText}>{lastTriage.cue}</Text>
        </View>
      )}
      {applied && lastTriage !== null && lastTriage.kind === 'rejected' && (
        <View style={styles.result}>
          <Text style={styles.badge}>No change</Text>
          <Text style={styles.caption}>
            Coach did not match this to a known scenario, so today's plan is unchanged.
          </Text>
        </View>
      )}
      {applied && lastTriage !== null && lastTriage.kind === 'matched' && !lastTriage.directive.halt && (
        <View style={styles.result}>
          <Text style={styles.badge}>{lastTriage.directive.halt ? 'Stop training today' : 'Plan adjusted'}</Text>
          <Text style={styles.bodyText}>{lastTriage.directive.vector.coaching_cue}</Text>
          {lastTriage.directive.followUp !== null && (
            <Text style={styles.caption}>{lastTriage.directive.followUp}</Text>
          )}
        </View>
      )}

      <SecondaryButton label="Back" onPress={onClose} accessibilityLabel="Back to the summary" testID="completion-report-close" />
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
    gap: theme.space[3],
  },
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  haltCard: {
    marginBottom: theme.space[3],
  },
  eyebrow: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  cardTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  title: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  label: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  caption: {
    ...theme.font.label,
    color: theme.color.textLow,
  },
  bodyText: {
    ...theme.font.body,
    color: theme.color.textHi,
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
  result: {
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    paddingTop: theme.space[3],
    gap: theme.space[2],
  },
  badge: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
});
