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
import { measuredDayDetail } from './measuredDayDetail';
import { buildSessionSummary } from '../state/sessionSummary';

const OUTCOME_LABELS: Record<string, string> = {
  followed_plan: 'Plan followed',
  adapted_session: 'Session adapted',
  stopped_safely: 'Session stopped safely',
  session_recorded: 'Session recorded',
};

// D5: dates include the year — a January session read in December must not
// masquerade as recent.
const formatFinalizedDate = (ms: number): string => {
  if (ms <= 0) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

// Two sessions on one day were identical rows; the time tells them apart.
const formatFinalizedTime = (ms: number): string => (ms <= 0 ? '' : ` · ${new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);

/** The logged facts of one past session: no plan context, no completion
 *  actions, only what was recorded. */
function PastSessionSummary({ sessionId, load }: {
  sessionId: number;
  load: (sessionId: number) => ReturnType<ReturnType<typeof useStore.getState>['loadSessionSummaryFacts']>;
}): React.JSX.Element {
  let lines: string[] = [];
  // Review (PR 194): a failed read is not an empty session. Only a summary
  // that was read and holds nothing says that no sets were logged.
  let readFailed = false;
  try {
    const facts = load(sessionId);
    const view = buildSessionSummary({
      exercises: facts.exercises, previousSets: facts.previousSets, durationMin: facts.durationMin,
      blockSessions: [], today: '', skippedExercises: facts.skippedExercises,
    });
    lines = [
      ...view.exerciseLines.map((line) => line.text),
      ...view.skippedLines.map((line) => line.text),
      ...(view.durationLine === null ? [] : [view.durationLine]),
    ];
  } catch {
    lines = [];
    readFailed = true;
  }
  return (
    <View style={styles.pastSummary} testID={`progress-session-${sessionId}-summary`}>
      {readFailed
        ? <Text style={styles.caption}>This session's summary could not be read.</Text>
        : lines.length === 0
        ? <Text style={styles.caption}>No sets were logged in this session.</Text>
        : lines.map((text, index) => <Text key={`${index}-${text}`} style={styles.caption}>{text}</Text>)}
    </View>
  );
}

export default function ProgressScreen(): React.JSX.Element {
  const loadRecentOutcomes = useStore((s) => s.loadRecentOutcomes);
  const loadMeasuredHistory = useStore((s) => s.loadMeasuredHistory);
  const loadSessionSummaryFacts = useStore((s) => s.loadSessionSummaryFacts);
  const session = useStore((s) => s.session);

  const [recentOutcomes, setRecentOutcomes] = useState<{ sessionId: number; outcomeKind: string; finalizedAtMs: number }[]>([]);
  // Walk 2 (W2-9): a recent session opens in place to its own summary.
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);
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
          recentOutcomes.map((row, i) => {
            const label = OUTCOME_LABELS[row.outcomeKind] ?? 'Outcome unavailable';
            const when = `${formatFinalizedDate(row.finalizedAtMs)}${formatFinalizedTime(row.finalizedAtMs)}`;
            const open = openSessionId === row.sessionId;
            return (
              <View key={`${row.sessionId}-${row.finalizedAtMs}-${i}`}>
                <ListRow
                  label={label}
                  detail={when}
                  testID={`progress-session-${row.sessionId}`}
                  accessibilityLabel={`${label}, ${when}. ${open ? 'Hide' : 'Show'} what was logged.`}
                  onPress={() => setOpenSessionId(open ? null : row.sessionId)}
                />
                {open && <PastSessionSummary sessionId={row.sessionId} load={loadSessionSummaryFacts} />}
              </View>
            );
          })
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
              detail={measuredDayDetail(row)}
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
  pastSummary: { paddingLeft: theme.space[4], paddingBottom: theme.space[2], gap: theme.space[1] },
});
