/**
 * EmphasisReportCard — says, in plain language, what the athlete's focus,
 * goals, sport and sport workload changed in a plan and what they could not
 * change (work order 3).
 *
 * The lines come from the generator itself (EmphasisReport), so the screen
 * never describes a choice the engine did not make. Used on the program
 * preview (the plan about to be created) and on the coach screen (the frozen
 * record stored with the block).
 *
 * Law: zero hex literals.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EmphasisReport } from '@ak/inference';
import { theme } from '../theme/theme';

export interface EmphasisReportCardProps {
  report: EmphasisReport | null | undefined;
  /** Shown instead of the two lists when the plan has no emphasis at all. */
  emptyText?: string;
  testID?: string;
}

export function EmphasisReportCard({ report, emptyText, testID = 'emphasis-report' }: EmphasisReportCardProps): React.JSX.Element | null {
  if (report === null || report === undefined) {
    return emptyText === undefined ? null : (
      <View style={styles.card} testID={testID}>
        <Text style={styles.title} accessibilityRole="header">Your focus, goals and sport</Text>
        <Text style={styles.line} testID={`${testID}-empty`}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title} accessibilityRole="header">What your focus, goals and sport changed</Text>
      {report.applied.length === 0 && (
        <Text style={styles.line} testID={`${testID}-nothing-applied`}>Nothing in this plan was changed by them.</Text>
      )}
      {report.applied.map((line) => (
        <Text key={line} style={styles.line} testID={`${testID}-applied`}>{line}</Text>
      ))}
      {report.omitted.length > 0 && (
        <>
          <Text style={[styles.title, styles.gap]} accessibilityRole="header">What they could not change, and why</Text>
          {report.omitted.map((line) => (
            <Text key={line} style={styles.dim} testID={`${testID}-omitted`}>{line}</Text>
          ))}
        </>
      )}
      <Text style={styles.dim}>
        Safety, your equipment, your experience level and your session length always come first.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.space[4], padding: theme.space[4], borderWidth: 1, borderColor: theme.color.line,
    borderRadius: theme.radius.control, backgroundColor: theme.color.ink1, gap: theme.space[2],
  },
  title: { ...theme.font.eyebrow, color: theme.color.textHi },
  gap: { marginTop: theme.space[3] },
  line: { ...theme.font.body, color: theme.color.textHi },
  dim: { ...theme.font.body, color: theme.color.textMid },
});

export default EmphasisReportCard;
