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
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';
import {
  MUSCLE_GROUP_INFO,
  describeFocus,
  goalProgress,
  resolveMuscleGroupAlias,
  type MuscleGroupId,
} from '@ak/inference';
import { useStore, type RecentSessionOutcome } from '../state/useStore';
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

const addDaysIso = (iso: string, delta: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m === null) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
};

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

type OriginCacheEntry = {
  readonly key: string;
  readonly origins: ReadonlyMap<number, number>;
};

const EMPTY_ORIGINS: ReadonlyMap<number, number> = new Map<number, number>();
const bootScopedOriginCache = new WeakMap<object, OriginCacheEntry>();

/** Read persisted `session_origin` links (`session_id -> source_planned_session_id`)
 *  when booted against SQLite so earlier catch-up workouts finalized on a later day
 *  attribute to their true planned session rather than their finalization date. */
const readPersistedPlannedSessionOrigins = (dbName: string | null): ReadonlyMap<number, number> => {
  if (dbName === null || !athleteDataBootAllowed()) return EMPTY_ORIGINS;
  const map = new Map<number, number>();
  let readerDb: DB | null = null;
  try {
    const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
    readerDb = open({ name: dbName });
    const rows = rowsOf<{ session_id: number; source_planned_session_id: number }>(
      readerDb.executeSync(
        "SELECT session_id, source_planned_session_id FROM session_origin WHERE origin_kind = 'planned' AND source_planned_session_id IS NOT NULL",
      ),
    );
    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      const sessionId = Number(row.session_id);
      const planId = Number(row.source_planned_session_id);
      if (Number.isFinite(sessionId) && Number.isFinite(planId)) {
        map.set(sessionId, planId);
      }
    }
  } catch {
    // Mocked unit-test stores without an op-sqlite driver fall back to outcome replay.
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
  return map;
};

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
  const focus = useStore((s) => s.focus) ?? null;
  const goals = useStore((s) => s.goals) ?? [];
  const block = useStore((s) => s.block) ?? null;
  const blockSessions = useStore((s) => s.blockSessions) ?? [];
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
  const localOriginCacheRef = useRef<OriginCacheEntry | null>(null);

  const [allOutcomes, setAllOutcomes] = useState<RecentSessionOutcome[]>([]);
  const recentOutcomes = allOutcomes.slice(0, 20);
  // Walk 2 (W2-9): a recent session opens in place to its own summary.
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);
  const [recentMeasures, setRecentMeasures] = useState<ReturnType<typeof loadMeasuredHistory>>([]);

  useEffect(() => {
    setAllOutcomes(loadRecentOutcomes(Number.MAX_SAFE_INTEGER) ?? []);
    setRecentMeasures(loadMeasuredHistory(14));
    // Re-read when a session ends: the ended session's outcome becomes a fact.
  }, [session, loadRecentOutcomes, loadMeasuredHistory]);

  const activeWeekIndex = blockSessions.find((s) => s.sessionDate >= today)?.weekIndex
    ?? blockSessions[blockSessions.length - 1]?.weekIndex
    ?? 1;
  const focusMuscles: readonly MuscleGroupId[] = focus?.muscles ?? [];
  const weeklyMuscleCounts = new Map<MuscleGroupId, { plannedSets: number; completedSets: number }>();
  for (const muscle of focusMuscles) {
    weeklyMuscleCounts.set(muscle, { plannedSets: 0, completedSets: 0 });
  }
  const isFinalizedPlanSession = (bs: (typeof blockSessions)[number]): boolean =>
    bs.completionStatus === 'complete' || bs.completionStatus === 'halted';
  const activeWeekSessions = blockSessions.filter((s) => s.weekIndex === activeWeekIndex);
  if (focusMuscles.length > 0 && typeof loadSessionSlots === 'function') {
    for (const bs of activeWeekSessions) {
      const slots = loadSessionSlots(bs.plannedSessionId) ?? [];
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
    let weekStart: string | null = null;
    let weekEnd: string | null = null;
    if (block !== null) {
      weekStart = addDaysIso(block.startDate, (activeWeekIndex - 1) * 7);
      weekEnd = addDaysIso(block.startDate, activeWeekIndex * 7 - 1);
    } else if (activeWeekSessions.length > 0) {
      const sortedDates = activeWeekSessions.map((s) => s.sessionDate).sort();
      weekStart = sortedDates[0];
      const plusSix = addDaysIso(sortedDates[0], 6);
      weekEnd = sortedDates[sortedDates.length - 1] > plusSix ? sortedDates[sortedDates.length - 1] : plusSix;
    }
    const finalizedInActiveWeek = activeWeekSessions.filter(isFinalizedPlanSession);
    if (
      finalizedInActiveWeek.length > 0
      && weekStart !== null
      && weekEnd !== null
      && typeof loadSessionSummaryFacts === 'function'
    ) {
      const finalizedBlockSessions = [...blockSessions.filter(isFinalizedPlanSession)].sort((a, b) =>
        a.sessionDate === b.sessionDate
          ? a.plannedSessionId - b.plannedSessionId
          : a.sessionDate < b.sessionDate
            ? -1
            : 1,
      );
      const allBlockPlanIds = new Set(blockSessions.map((bs) => bs.plannedSessionId));
      const finalizedPlanById = new Map(finalizedBlockSessions.map((bs) => [bs.plannedSessionId, bs]));
      const plannedCandidatesNewestFirst = allOutcomes
        .filter((row) => row.sessionId != null && (row.originKind == null || row.originKind === 'planned'))
        .sort((a, b) => (b.sessionId ?? 0) - (a.sessionId ?? 0) || b.finalizedAtMs - a.finalizedAtMs);
      const needsPersistedOrigins = activeDbName !== null && plannedCandidatesNewestFirst.some(
        (row) => (row as { sourcePlannedSessionId?: number | null }).sourcePlannedSessionId == null,
      );
      let persistedOrigins: ReadonlyMap<number, number> = EMPTY_ORIGINS;
      if (needsPersistedOrigins && athleteDataBootAllowed()) {
        const outcomeSig = plannedCandidatesNewestFirst
          .map((row) => `${row.sessionId}:${row.outcomeKind}:${row.finalizedAtMs}:${row.loggedSetCount ?? ''}`)
          .join(',');
        const cacheKey = `${activeAthleteId ?? ''}|${activeDbName}|${outcomeSig}`;
        const scopeObj: object | null = (Array.isArray(rawMovements) && rawMovements.length > 0 ? rawMovements : null) ?? block;
        const cached = scopeObj !== null ? bootScopedOriginCache.get(scopeObj) : localOriginCacheRef.current;
        if (cached !== undefined && cached !== null && cached.key === cacheKey) {
          persistedOrigins = cached.origins;
        } else {
          persistedOrigins = readPersistedPlannedSessionOrigins(activeDbName);
          const nextEntry: OriginCacheEntry = { key: cacheKey, origins: persistedOrigins };
          if (scopeObj !== null) {
            bootScopedOriginCache.set(scopeObj, nextEntry);
          }
          localOriginCacheRef.current = nextEntry;
        }
      }

      const claimedPlanIds = new Set<number>();
      const activeWeekOutcomes: RecentSessionOutcome[] = [];
      const unresolvedBlockCandidatesNewestFirst: RecentSessionOutcome[] = [];
      for (const row of plannedCandidatesNewestFirst) {
        const explicitPlanId = (row as { sourcePlannedSessionId?: number | null }).sourcePlannedSessionId
          ?? persistedOrigins.get(row.sessionId)
          ?? null;
        if (explicitPlanId !== null) {
          // Session explicitly linked to an archived/other block's planned_session: skip.
          if (!allBlockPlanIds.has(explicitPlanId)) continue;
          claimedPlanIds.add(explicitPlanId);
          const matchedPlan = finalizedPlanById.get(explicitPlanId);
          if (matchedPlan !== undefined && matchedPlan.weekIndex === activeWeekIndex) {
            if (block === null) {
              const rowDate = localIsoDate(row.finalizedAtMs);
              if (rowDate === null || rowDate < weekStart || rowDate > weekEnd) continue;
            }
            activeWeekOutcomes.push(row);
          }
          continue;
        }
        if (block === null || !(block.createdAtMs > 0) || row.finalizedAtMs >= block.createdAtMs) {
          unresolvedBlockCandidatesNewestFirst.push(row);
        }
      }

      // Fallback (#228) for mocked unit-test stores without persisted `session_origin` rows:
      // attribute remaining finalized planned outcomes chronologically to unclaimed sessions.
      const unclaimed = finalizedBlockSessions.filter((bs) => !claimedPlanIds.has(bs.plannedSessionId));
      const unresolvedChronological = unresolvedBlockCandidatesNewestFirst
        .slice(0, unclaimed.length)
        .reverse();
      for (const row of unresolvedChronological) {
        let matchedPlan: (typeof finalizedBlockSessions)[number] | undefined;
        if (unclaimed.length > 0) {
          const rowDate = localIsoDate(row.finalizedAtMs);
          const focusPool = row.focus == null
            ? unclaimed
            : unclaimed.filter((bs) => bs.focus === row.focus);
          const candidates = focusPool.length > 0 ? focusPool : unclaimed;
          if (rowDate !== null) {
            matchedPlan = candidates.find((bs) => bs.sessionDate === rowDate)
              ?? candidates.find((bs) => bs.sessionDate < rowDate)
              ?? candidates.find((bs) => bs.sessionDate > rowDate);
          } else {
            matchedPlan = candidates[0];
          }
          if (matchedPlan !== undefined) {
            const removeIdx = unclaimed.indexOf(matchedPlan);
            if (removeIdx !== -1) unclaimed.splice(removeIdx, 1);
          }
        }
        if (matchedPlan !== undefined && matchedPlan.weekIndex === activeWeekIndex) {
          if (block === null) {
            const rowDate = localIsoDate(row.finalizedAtMs);
            if (rowDate === null || rowDate < weekStart || rowDate > weekEnd) continue;
          }
          activeWeekOutcomes.push(row);
        }
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
          // Unreadable session facts fail closed (0 completed sets credited).
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
        {focusMuscles.map((muscle) => {
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
        {recentOutcomes.length === 0 ? (
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
