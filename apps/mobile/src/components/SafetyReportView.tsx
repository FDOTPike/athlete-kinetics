/**
 * SafetyReportView — a read-only view of today's saved "Something feels off"
 * reports (#185): the words as typed, the severity, the time, the entry it
 * matched and what it changed today.
 *
 * Read-only by rule: a saved report cannot be withdrawn or corrected the same
 * day (withdrawing a halt would loosen a hard stop), so this view has no edit,
 * delete or withdraw control. The follow-up question is shown and takes no
 * answer for now. The only control closes the view.
 *
 * Law: zero hex literals — theme tokens only.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore, type TodaySafetyReport } from '../state/useStore';
import { reportEffectText, reportEntryName } from '../state/reportCopy';
import { theme } from '../theme/theme';
import { SecondaryButton } from './ui';

const timeOfDay = (ms: number): string => {
  const at = new Date(ms);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

function ReportRow({ report }: { report: TodaySafetyReport }): React.JSX.Element {
  return (
    <View style={styles.row} testID={`safety-report-${report.reportId}`}>
      <Text style={styles.body}>{`“${report.text}”`}</Text>
      <Text style={styles.caption}>
        {`Saved at ${timeOfDay(report.reportedAtMs)} · Severity ${report.severity === null ? 'not recorded' : `${report.severity} of 10`}`}
      </Text>
      <Text style={styles.caption}>{`Matched: ${reportEntryName(report.entryId)}`}</Text>
      <Text style={styles.body}>
        {report.effect === null ? 'It matched no entry, so it changed nothing today.' : reportEffectText(report.effect)}
      </Text>
      {report.followUp !== null && (
        <>
          <Text style={styles.caption}>{`Follow-up question: ${report.followUp}`}</Text>
          <Text style={styles.caption}>This question takes no answer for now.</Text>
        </>
      )}
    </View>
  );
}

export interface SafetyReportViewProps {
  onClose: () => void;
  testID?: string;
}

export function SafetyReportView({ onClose, testID = 'safety-report-view' }: SafetyReportViewProps): React.JSX.Element {
  const loadTodaySafetyReports = useStore((s) => s.loadTodaySafetyReports);
  // Read once per opening: the view is a snapshot, and nothing on it writes.
  const reports = useMemo<TodaySafetyReport[]>(() => {
    if (typeof loadTodaySafetyReports !== 'function') return [];
    try {
      return loadTodaySafetyReports();
    } catch {
      return [];
    }
  }, [loadTodaySafetyReports]);

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.eyebrow}>TODAY'S SAFETY REPORTS</Text>
      {reports.length === 0 ? (
        <Text style={styles.body}>No report could be read for today.</Text>
      ) : (
        reports.map((report) => <ReportRow key={report.reportId} report={report} />)
      )}
      <Text style={styles.caption}>
        A saved report stays in place for today. It cannot be withdrawn or changed.
      </Text>
      <SecondaryButton label="Close" onPress={onClose} accessibilityLabel="Close today's safety reports" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[4],
    gap: theme.space[3],
  },
  row: {
    gap: theme.space[1],
    paddingBottom: theme.space[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  eyebrow: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  body: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  caption: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
});
