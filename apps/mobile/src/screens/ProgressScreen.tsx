/**
 * ProgressScreen.tsx — the Progress primary destination (Astra UX Phase 1, W4).
 *
 * WHAT THIS SCREEN IS
 * -------------------
 * A read-only composition of facts the app already measures and persists:
 * - recent finalized outcomes (`loadRecentOutcomes`, the same rows the
 *   Profile's TRAINING-DECISIONS disclosure shows);
 * - the daily measured rollups (`loadMeasuredHistory`, the same rows the
 *   Profile's history section shows).
 * No new analytics, no derived trends, no invented summaries — §2 forbids
 * inventing progress analytics and §3.1 forbids manufacturing numbers. Every
 * line here is either a persisted row or an explicit statement of absence.
 *
 * WHERE THE REST WENT
 * -------------------
 * Profile/settings (the editable athlete surface) stays reachable from the
 * shell header and renders the full ProfileScreen unchanged.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import { ListRow } from '../components/ui';

const OUTCOME_LABELS: Record<string, string> = {
  followed_plan: 'Plan followed',
  adapted_session: 'Session adapted',
  stopped_safely: 'Session stopped safely',
  session_recorded: 'Session recorded',
};

const formatFinalizedDate = (ms: number): string => {
  if (ms <= 0) return '—';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

export default function ProgressScreen(): React.JSX.Element {
  const loadRecentOutcomes = useStore((s) => s.loadRecentOutcomes);
  const loadMeasuredHistory = useStore((s) => s.loadMeasuredHistory);
  const session = useStore((s) => s.session);

  const [recentOutcomes, setRecentOutcomes] = useState<{ outcomeKind: string; finalizedAtMs: number }[]>([]);
  const [recentMeasures, setRecentMeasures] = useState<ReturnType<typeof loadMeasuredHistory>>([]);

  useEffect(() => {
    setRecentOutcomes(loadRecentOutcomes(20));
    setRecentMeasures(loadMeasuredHistory(14));
    // Re-read when a session ends: the ended session's outcome becomes a fact.
  }, [session, loadRecentOutcomes, loadMeasuredHistory]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="progress-screen">
      <Text style={styles.heading}>PROGRESS</Text>
      <Text style={styles.caption}>
        What your sessions and measurements say — read straight from your log.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        {recentOutcomes.length === 0 ? (
          <Text style={styles.caption} testID="progress-outcomes-none">
            No finalized session outcomes recorded yet.
          </Text>
        ) : (
          recentOutcomes.map((row, i) => (
            <ListRow
              key={`${row.finalizedAtMs}-${i}`}
              label={OUTCOME_LABELS[row.outcomeKind] ?? 'Session recorded'}
              detail={formatFinalizedDate(row.finalizedAtMs)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MEASURED DAYS</Text>
        {recentMeasures.length === 0 ? (
          <Text style={styles.caption} testID="progress-measures-none">
            No measured days yet. Logged sessions and synced telemetry appear here.
          </Text>
        ) : (
          recentMeasures.slice(0, 14).map((row) => (
            <ListRow
              key={row.date}
              label={row.date}
              detail={`${Math.round(row.tonnageKg)} kg load · ${row.setCount} sets${row.bodyweightKg === null ? '' : ` · ${row.bodyweightKg.toFixed(1)} kg BW`}`}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[6] },
  heading: { ...theme.font.eyebrow, color: theme.color.textLow },
  caption: { ...theme.font.label, color: theme.color.textMid, marginTop: theme.space[1] },
  section: { marginTop: theme.space[5], gap: theme.space[2] },
  sectionTitle: { ...theme.font.eyebrow, color: theme.color.textLow },
});
