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
import type { DB } from '@op-engineering/op-sqlite';
import {
  MUSCLE_GROUP_INFO,
  addDaysIso,
  describeFocus,
  goalProgress,
  resolveMuscleGroupAlias,
  type MuscleGroupId,
} from '@ak/inference';
import { useStore, type BlockSessionSummary, type RecentSessionOutcome } from '../state/useStore';
import { athleteDataBootAllowed } from '../state/dataMaintenanceLock';
import { theme } from '../theme/theme';
import { formatAthleteDate } from '../state/athleteDate';
import { CompactDescription, ListRow } from '../components/ui';
import { measuredDayDetail } from './measuredDayDetail';
import { buildSessionSummary, markPerDumbbell, sessionFocusName } from '../state/sessionSummary';

const OUTCOME_LABELS: Record<string, string> = {
  followed_plan: 'Plan followed',
  adapted_session: 'Session adapted',
  stopped_safely: 'Session stopped safely',
  session_recorded: 'Session recorded',
};

// D5: dates include the year — a January session read in December must not
// masquerade as recent. The shared athlete date format (issue #156).
const formatFinalizedDate = (ms: number): string => {
  if (ms <= 0) return '—';
  return formatAthleteDate(ms);
};

/** Issue #201: "Session recorded" on three rows told nothing apart. The row
 *  says what the session was (focus or extra), how many exercises and sets. */
const sessionDescriptor = (row: {
  focus?: string | null; originKind?: string | null; exerciseCount?: number | null; loggedSetCount?: number | null;
}): string => {
  const kind = row.focus ? sessionFocusName(row.focus) : row.originKind === 'free_form' ? 'Extra session' : 'Session';
  const counts = row.exerciseCount == null || row.loggedSetCount == null
    ? []
    : [
        `${row.exerciseCount} ${row.exerciseCount === 1 ? 'exercise' : 'exercises'}`,
        `${row.loggedSetCount} ${row.loggedSetCount === 1 ? 'set' : 'sets'}`,
      ];
  return [kind, ...counts].join(' · ');
};

// Two sessions on one day were identical rows; the time tells them apart.
const formatFinalizedTime = (ms: number): string => (ms <= 0 ? '' : ` · ${new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);

const localIsoDate = (ms: number): string | null => {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
};

function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = (res as { rows?: unknown } | null | undefined)?.rows;
  if (Array.isArray(r)) return r as T[];
  const arr = (r as { _array?: unknown } | null | undefined)?._array;
  return Array.isArray(arr) ? (arr as T[]) : [];
}

type WeekOutcome = Pick<RecentSessionOutcome, 'sessionId' | 'finalizedAtMs'>;
type WeekOutcomeCacheEntry = { readonly key: string; readonly outcomes: readonly WeekOutcome[] };
type WeekOutcomeRead = { readonly ok: boolean; readonly outcomes: readonly WeekOutcome[] };

const bootScopedWeekOutcomeCache = new WeakMap<object, WeekOutcomeCacheEntry>();
let nextObjectIdentityId = 1;
const objectIdentityIds = new WeakMap<object, number>();

const getObjectIdentityTag = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) return String(value);
  let id = objectIdentityIds.get(value);
  if (id === undefined) {
    id = nextObjectIdentityId;
    nextObjectIdentityId += 1;
    objectIdentityIds.set(value, id);
  }
  return `obj:${id}`;
};

/** A catch-up workout belongs to its stored plan, even when finalized in a later week. */
const readPersistedActiveWeekOutcomes = (
  dbName: string,
  planIds: readonly number[],
  blockCreatedAtMs: number,
): WeekOutcomeRead => {
  let readerDb: DB | null = null;
  try {
    const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
    readerDb = open({ name: dbName });
    const placeholders = planIds.map(() => '?').join(', ');
    // A block wipe can free a plan ID while preserving workouts that reference it.
    const rows = rowsOf<{ session_id: number; finalized_at_ms: number }>(
      readerDb.executeSync(
        `SELECT outcome.session_id, outcome.finalized_at_ms
           FROM session_origin origin
           JOIN session_outcome outcome ON outcome.session_id = origin.session_id
           JOIN session s ON s.session_id = origin.session_id
          WHERE origin.origin_kind = 'planned' AND outcome.origin_kind = 'planned'
            AND origin.source_planned_session_id IN (${placeholders})
            AND (? <= 0 OR (outcome.finalized_at_ms >= ? AND s.started_at_ms >= ?))`,
        [...planIds, blockCreatedAtMs, blockCreatedAtMs, blockCreatedAtMs],
      ),
    );
    return {
      ok: true,
      outcomes: rows.map((row) => ({ sessionId: row.session_id, finalizedAtMs: row.finalized_at_ms })),
    };
  } catch {
    return { ok: false, outcomes: [] };
  } finally {
    if (
      readerDb !== null
      && typeof (globalThis as { __OPSQLiteProxy?: unknown }).__OPSQLiteProxy !== 'undefined'
      && typeof readerDb.close === 'function'
    ) {
      try {
        readerDb.close();
      } catch {
        // Ignore secondary reader close errors.
      }
    }
  }
};

/** Mock stores without SQLite replay the bounded outcome list in plan order. */
function replayRecentPlannedOutcomes(
  outcomes: readonly (RecentSessionOutcome & { sourcePlannedSessionId?: number | null })[],
  finalizedBlockSessions: readonly BlockSessionSummary[],
  activeWeekIndex: number,
  blockCreatedAtMs: number,
): WeekOutcome[] {
  const finalizedPlanById = new Map(finalizedBlockSessions.map((bs) => [bs.plannedSessionId, bs]));
  const candidates = outcomes
    .filter((row) =>
      row.sessionId != null
      && (row.originKind == null || row.originKind === 'planned')
      && (!(blockCreatedAtMs > 0) || row.finalizedAtMs >= blockCreatedAtMs),
    )
    .sort((a, b) => b.sessionId - a.sessionId || b.finalizedAtMs - a.finalizedAtMs);
  const claimedPlanIds = new Set<number>();
  const activeWeekOutcomes: WeekOutcome[] = [];
  const unresolved: RecentSessionOutcome[] = [];
  for (const row of candidates) {
    if (row.sourcePlannedSessionId != null) {
      const matchedPlan = finalizedPlanById.get(row.sourcePlannedSessionId);
      if (matchedPlan === undefined) continue;
      claimedPlanIds.add(row.sourcePlannedSessionId);
      if (matchedPlan.weekIndex === activeWeekIndex) activeWeekOutcomes.push(row);
    } else {
      unresolved.push(row);
    }
  }

  const unclaimed = finalizedBlockSessions.filter((bs) => !claimedPlanIds.has(bs.plannedSessionId));
  for (const row of unresolved.slice(0, unclaimed.length).reverse()) {
    const rowDate = localIsoDate(row.finalizedAtMs);
    const focusPool = row.focus == null ? unclaimed : unclaimed.filter((bs) => bs.focus === row.focus);
    const plans = focusPool.length > 0 ? focusPool : unclaimed;
    const matchedPlan = rowDate === null
      ? plans[0]
      : plans.find((bs) => bs.sessionDate === rowDate)
        ?? plans.find((bs) => bs.sessionDate < rowDate)
        ?? plans.find((bs) => bs.sessionDate > rowDate);
    if (matchedPlan === undefined) continue;
    unclaimed.splice(unclaimed.indexOf(matchedPlan), 1);
    if (matchedPlan.weekIndex === activeWeekIndex) activeWeekOutcomes.push(row);
  }
  return activeWeekOutcomes;
}

/** The logged facts of one past session: no plan context, no completion
 *  actions, only what was recorded. */
function PastSessionSummary({ sessionId, load }: {
  sessionId: number;
  load: (sessionId: number) => ReturnType<ReturnType<typeof useStore.getState>['loadSessionSummaryFacts']>;
}): React.JSX.Element {
  // Issue #218: dumbbell loads read per dumbbell here too, by the same rule
  // as the completion summary. Tests may leave these out of the store.
  const movements = useStore((s) => s.movements);
  const loadIntents = useStore((s) => s.loadIntents);
  let lines: string[] = [];
  // Review (PR 194): a failed read is not an empty session. Only a summary
  // that was read and holds nothing says that no sets were logged.
  let readFailed = false;
  try {
    const facts = load(sessionId);
    const view = buildSessionSummary({
      exercises: markPerDumbbell(facts.exercises, movements, loadIntents),
      previousSets: facts.previousSets, durationMin: facts.durationMin,
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
  // #302 (194g, ratified 2026-11-07): progress summary fallback copy stays plain and accurate.
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
  const rawEarlierOpenSessions = useStore((s) => s.earlierOpenSessions);
  const focus = useStore((s) => s.focus) ?? null;
  const goals = useStore((s) => s.goals) ?? [];
  const rawBlock = useStore((s) => s.block);
  const block = rawBlock ?? null;
  const rawBlockSessions = useStore((s) => s.blockSessions);
  const blockSessions = rawBlockSessions ?? [];
  const today = useStore((s) => s.today) ?? '';
  const rawMovements = useStore((s) => s.movements);
  const movements = rawMovements ?? [];
  const loadSessionSlots = useStore((s) => s.loadSessionSlots);
  const storeStatus = useStore((s) => s.status) ?? null;
  const athletes = useStore((s) => s.athletes) ?? [];
  const activeAthleteId = useStore((s) => s.activeAthleteId) ?? null;
  const activeDbName = storeStatus === 'ready' && activeAthleteId !== null
    ? athletes.find((entry) => entry.id === activeAthleteId)?.dbName ?? null
    : null;
  const [recentOutcomes, setRecentOutcomes] = useState<RecentSessionOutcome[] | null>(null);
  // Walk 2 (W2-9): a recent session opens in place to its own summary.
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);
  const [recentMeasures, setRecentMeasures] = useState<ReturnType<typeof loadMeasuredHistory>>([]);

  useEffect(() => {
    setRecentOutcomes(loadRecentOutcomes(20)?.slice(0, 20) ?? []);
    setRecentMeasures(loadMeasuredHistory(14));
    // Re-read when a session ends, an earlier open workout resolves, or athlete/block state reloads.
  }, [
    session,
    rawEarlierOpenSessions,
    rawBlock,
    rawBlockSessions,
    activeAthleteId,
    activeDbName,
    storeStatus,
    rawMovements,
    loadRecentOutcomes,
    loadMeasuredHistory,
  ]);

  // Plan's calendar marks today in the seven-day row anchored to the block start,
  // including when the next workout is in a later week.
  const activeWeekIndex = block === null
    ? blockSessions.find((s) => s.sessionDate >= today)?.weekIndex
      ?? blockSessions[blockSessions.length - 1]?.weekIndex
      ?? 1
    : [1, 2, 3].find((week) => today < addDaysIso(block.startDate, week * 7)) ?? 4;
  let weeklyTotalsAvailable = recentOutcomes !== null;
  const focusMuscles: readonly MuscleGroupId[] = focus?.muscles ?? [];
  const weeklyMuscleCounts = new Map<MuscleGroupId, { plannedSets: number; completedSets: number }>();
  for (const muscle of focusMuscles) {
    weeklyMuscleCounts.set(muscle, { plannedSets: 0, completedSets: 0 });
  }
  const isFinalizedPlanSession = (bs: (typeof blockSessions)[number]): boolean =>
    bs.completionStatus === 'complete' || bs.completionStatus === 'halted';
  const activeWeekSessions = blockSessions.filter((s) => s.weekIndex === activeWeekIndex);
  if (weeklyTotalsAvailable && focusMuscles.length > 0 && typeof loadSessionSlots === 'function') {
    for (const bs of activeWeekSessions) {
      let slots: ReturnType<typeof loadSessionSlots>;
      try {
        slots = loadSessionSlots(bs.plannedSessionId) ?? [];
      } catch {
        weeklyTotalsAvailable = false;
        break;
      }
      for (const sl of slots) {
        const rawMuscles = movements.find((m) => m.movement_id === sl.movementId)?.targetMuscles ?? [];
        const matched = new Set<MuscleGroupId>();
        for (const raw of rawMuscles) {
          const resolved = resolveMuscleGroupAlias(raw);
          if (resolved !== null && weeklyMuscleCounts.has(resolved)) matched.add(resolved);
        }
        for (const muscle of matched) {
          weeklyMuscleCounts.get(muscle)!.plannedSets += sl.sets;
        }
      }
    }
    const finalizedInActiveWeek = activeWeekSessions.filter(isFinalizedPlanSession);
    if (
      weeklyTotalsAvailable
      && finalizedInActiveWeek.length > 0
      && recentOutcomes !== null
      && typeof loadSessionSummaryFacts === 'function'
    ) {
      const blockCreatedAtMs = block?.createdAtMs ?? 0;
      let activeWeekOutcomes: readonly WeekOutcome[] = [];
      if (activeDbName === null) {
        const finalizedBlockSessions = blockSessions.filter(isFinalizedPlanSession).sort((a, b) =>
          a.sessionDate.localeCompare(b.sessionDate) || a.plannedSessionId - b.plannedSessionId,
        );
        activeWeekOutcomes = replayRecentPlannedOutcomes(
          recentOutcomes, finalizedBlockSessions, activeWeekIndex, blockCreatedAtMs,
        );
      } else if (athleteDataBootAllowed()) {
        const planIds = finalizedInActiveWeek.map((bs) => bs.plannedSessionId);
        const outcomeSig = recentOutcomes
          .map((row) => [row.sessionId, row.outcomeKind, row.finalizedAtMs, row.loggedSetCount].join(':'))
          .join(',');
        const sliceIds = [rawMovements, rawBlock, rawBlockSessions].map(getObjectIdentityTag).join('|');
        const key = JSON.stringify([activeAthleteId, activeDbName, sliceIds, planIds, blockCreatedAtMs, outcomeSig]);
        const scope = rawMovements?.length ? rawMovements : rawBlock ?? blockSessions;
        const cached = bootScopedWeekOutcomeCache.get(scope);
        if (cached?.key === key) {
          activeWeekOutcomes = cached.outcomes;
        } else {
          const read = readPersistedActiveWeekOutcomes(activeDbName, planIds, blockCreatedAtMs);
          weeklyTotalsAvailable = read.ok;
          activeWeekOutcomes = read.outcomes;
          if (read.ok) bootScopedWeekOutcomeCache.set(scope, { key, outcomes: activeWeekOutcomes });
        }
      } else {
        weeklyTotalsAvailable = false;
      }

      if (block === null) {
        const dates = activeWeekSessions.map((s) => s.sessionDate).sort();
        const weekStart = dates[0];
        const lastPlannedDate = dates[dates.length - 1];
        const plusSix = addDaysIso(weekStart, 6);
        const weekEnd = lastPlannedDate > plusSix ? lastPlannedDate : plusSix;
        activeWeekOutcomes = activeWeekOutcomes.filter((row) => {
          const rowDate = localIsoDate(row.finalizedAtMs);
          return rowDate !== null && rowDate >= weekStart && rowDate <= weekEnd;
        });
      }
      for (const row of activeWeekOutcomes) {
        try {
          const facts = loadSessionSummaryFacts(row.sessionId);
          for (const ex of facts?.exercises ?? []) {
            const completedForSlot = ex.plannedSets !== null ? Math.min(ex.sets.length, ex.plannedSets) : 0;
            if (completedForSlot <= 0) continue;
            const rawMuscles = movements.find((m) => m.movement_id === ex.movementId)?.targetMuscles ?? [];
            const matched = new Set<MuscleGroupId>();
            for (const raw of rawMuscles) {
              const resolved = resolveMuscleGroupAlias(raw);
              if (resolved !== null && weeklyMuscleCounts.has(resolved)) matched.add(resolved);
            }
            for (const muscle of matched) {
              const entry = weeklyMuscleCounts.get(muscle)!;
              entry.completedSets = Math.min(entry.plannedSets, entry.completedSets + completedForSlot);
            }
          }
        } catch {
          weeklyTotalsAvailable = false;
          break;
        }
      }
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="progress-screen">
      <CompactDescription label="Progress" heading={<Text style={styles.heading}>PROGRESS</Text>}>
        <Text style={styles.caption}>
          From your training log.
        </Text>
      </CompactDescription>

      <View style={styles.section} testID="progress-focus-section">
        <Text style={styles.sectionTitle}>TRAINING FOCUS</Text>
        <Text style={styles.caption} testID="progress-focus-summary">
          {focus === null ? 'Not answered yet. Balanced whole body is used until you choose.' : describeFocus(focus)}
        </Text>
        {weeklyTotalsAvailable && focusMuscles.map((muscle) => {
          const counts = weeklyMuscleCounts.get(muscle) ?? { plannedSets: 0, completedSets: 0 };
          return (
            <Text key={muscle} style={styles.caption} testID={`progress-focus-muscle-${muscle}`}>
              {`${MUSCLE_GROUP_INFO[muscle].label} · ${counts.completedSets} of ${counts.plannedSets} planned sets completed this week`}
            </Text>
          );
        })}
      </View>

      <View style={styles.section} testID="progress-goals-section">
        <Text style={styles.sectionTitle}>GOALS</Text>
        {goals.length === 0 ? (
          <Text style={styles.caption} testID="progress-goals-none">
            No goals set. That is fine — you can train with the focus alone.
          </Text>
        ) : (
          goals.map((stored) => {
            const progress = goalProgress(stored.goal, stored.observations);
            const deadline = stored.goal.requestedDeadline === null ? 'no deadline' : `by ${stored.goal.requestedDeadline}`;
            const detail = `Target ${stored.goal.targetValue} ${stored.goal.unit}, ${deadline}${stored.status === 'active' ? '' : ` · ${stored.status}`} · ${progress.summary}`;
            return (
              <ListRow
                key={stored.goalId}
                label={stored.goal.specificOutcome}
                detail={detail}
                testID={`progress-goal-${stored.goalId}`}
              />
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
        {recentOutcomes === null || recentOutcomes.length === 0 ? (
          <Text style={styles.caption} testID="progress-outcomes-none">
            No finalized session outcomes recorded yet.
          </Text>
        ) : (
          recentOutcomes.map((row, i) => {
            const label = OUTCOME_LABELS[row.outcomeKind] ?? 'Outcome unavailable';
            const when = `${formatFinalizedDate(row.finalizedAtMs)}${formatFinalizedTime(row.finalizedAtMs)}`;
            const detail = `${sessionDescriptor(row)} · ${when}`;
            const open = openSessionId === row.sessionId;
            return (
              <View key={`${row.sessionId}-${row.finalizedAtMs}-${i}`}>
                <ListRow
                  label={label}
                  detail={detail}
                  testID={`progress-session-${row.sessionId}`}
                  accessibilityLabel={`${label}, ${detail}. ${open ? 'Hide' : 'Show'} what was logged.`}
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
