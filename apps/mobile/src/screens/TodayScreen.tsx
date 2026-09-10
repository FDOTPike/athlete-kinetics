/**
 * TodayScreen.tsx — the athlete-first landing surface (Astra UX Phase 1, W1).
 *
 * The promise: open the app, know today's work, do it, and understand what
 * comes next. Everything on this screen serves that sentence, in that order.
 *
 * THE TWO THINGS THIS SCREEN EXISTS TO FIX
 * ----------------------------------------
 * 1. Starting a workout used to require a detour through Coach. The old
 *    landing screen's primary action was `onOpenCoach` unless a session was
 *    already live (ReadinessScreen.tsx:230) — it navigated, it never started.
 *    Here the primary action calls the SAME production entry point the Coach
 *    screen calls, `startSession()`, with no arguments and no new arguments
 *    invented. Coach keeps its own start button; this screen does not replace
 *    it, it stops being a mandatory waypoint.
 * 2. Every missing plan used to be called a rest day. The state shown here
 *    comes from `deriveTodayState`, a pure total function, so a scheduled
 *    recovery day, a missed session, an ended block and an athlete with no
 *    program are four different screens with four different honest actions.
 *
 * WHAT STAYS SUBORDINATE
 * ----------------------
 * §4 requires the workout and its action to stay visually dominant over
 * readiness explanation and coaching metadata. The workout card uses the title
 * scale and owns the only primary button; readiness sits below it behind a
 * Disclosure at label scale. Readiness explains, it does not compete.
 *
 * WHAT IS NEVER MANUFACTURED
 * --------------------------
 * The adjustment section renders only when `pendingAutopilotAdjustments` is
 * genuinely non-empty. There is no "no changes today" reassurance line,
 * because §3.1 forbids manufacturing an adjustment message when nothing
 * changed, and a sentence asserting stability is still a claim.
 */
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import {
  deriveTodayState,
  describeAdjustments,
  durationCopy,
  durationEstimate,
  type SessionRef,
  type TodayState,
} from '../state/todayState';
import { classifyReadiness } from './ReadinessScreen';
import { PrimaryButton, QuietAction, Disclosure, ListRow } from '../components/ui';

export interface TodayScreenProps {
  /** Shell-supplied: go to the live session surface. */
  onOpenSession?: () => void;
  /** Shell-supplied: go to Plan (the block/trajectory surface). */
  onOpenPlan?: () => void;
}

const focusName = (focus: string): string =>
  focus.length === 0 ? 'Session' : focus.charAt(0).toUpperCase() + focus.slice(1).toLowerCase();

/** "Lower session · Fri 12 Sep" without pulling in a date library. */
const shortDate = (iso: string): string => iso;

const READINESS_LABEL: Record<'OPTIMAL' | 'RECOVERY' | 'OVERREACHED', string> = {
  OPTIMAL: 'Ready to train',
  RECOVERY: 'Train steadily',
  OVERREACHED: 'Recovery is the work',
};

export default function TodayScreen({
  onOpenSession,
  onOpenPlan,
}: TodayScreenProps): React.JSX.Element {
  const status = useStore((s) => s.status);
  const today = useStore((s) => s.today);
  const session = useStore((s) => s.session);
  const todayPlan = useStore((s) => s.todayPlan);
  const blockSessions = useStore((s) => s.blockSessions);
  const block = useStore((s) => s.block);
  const hasArchivedBlock = useStore((s) => s.hasArchivedBlock);
  const lastTriage = useStore((s) => s.lastTriage);
  const vector = useStore((s) => s.vector);
  const profile = useStore((s) => s.profile);
  const pendingAutopilotAdjustments = useStore((s) => s.pendingAutopilotAdjustments);
  const startSession = useStore((s) => s.startSession);
  const refreshVector = useStore((s) => s.refreshVector);
  const recordedDurationsForFocus = useStore((s) => s.recordedDurationsForFocus);
  const error = useStore((s) => s.error);

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    try {
      refreshVector();
    } finally {
      setRefreshing(false);
    }
  }, [refreshVector]);

  const halted = lastTriage !== null
    && lastTriage.kind === 'matched'
    && lastTriage.directive.halt;

  const state: TodayState = useMemo(() => deriveTodayState({
    today,
    hasActiveSession: session !== null,
    halted,
    todayPlan: todayPlan === null ? null : {
      plannedSessionId: todayPlan.plannedSessionId,
      focus: todayPlan.focus,
      slotCount: todayPlan.slots.length,
    },
    blockSessions,
    hasActiveBlock: block !== null,
    hasArchivedBlock,
  }), [today, session, halted, todayPlan, blockSessions, block, hasArchivedBlock]);

  /**
   * Start, then hand the athlete to the session surface — the SAME two calls
   * BlockScreen makes (`startSession(); onSessionStarted?.()`). The store
   * refuses the start itself when a halt stands or a session is already open,
   * so this handler adds no guard of its own and cannot drift from the rule.
   */
  const startAndOpen = React.useCallback(() => {
    startSession();
    onOpenSession?.();
  }, [startSession, onOpenSession]);

  const adjustmentLines = useMemo(
    () => describeAdjustments(pendingAutopilotAdjustments),
    [pendingAutopilotAdjustments],
  );

  if (status === 'booting') {
    return (
      <View style={styles.center} testID="today-screen">
        <Text style={styles.body}>Preparing your training data.</Text>
      </View>
    );
  }

  const renderNext = (next: SessionRef | null, emptyCopy: string): React.JSX.Element => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WHAT COMES NEXT</Text>
      {next === null ? (
        <Text style={styles.caption} testID="today-next-none">{emptyCopy}</Text>
      ) : (
        <Text style={styles.body} testID="today-next">
          {focusName(next.focus)} on {shortDate(next.sessionDate)} — {next.slotCount} movement
          {next.slotCount === 1 ? '' : 's'}.
        </Text>
      )}
    </View>
  );

  const workoutCard = (): React.JSX.Element => {
    switch (state.kind) {
      case 'halted':
        return (
          <View style={[styles.card, styles.cardActive]} testID="today-card-halted">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>Training is paused</Text>
            <Text style={styles.body}>
              A safety report paused training for today. Review it before doing more work.
            </Text>
            <QuietAction
              label="Open your plan"
              onPress={() => onOpenPlan?.()}
              accessibilityLabel="Open your plan to review the safety report"
            />
          </View>
        );

      case 'active_session':
        return (
          <View style={[styles.card, styles.cardActive]} testID="today-card-active">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>Workout in progress</Text>
            <Text style={styles.body}>
              Your session is saved exactly where you left it.
            </Text>
            <PrimaryButton
              label="Resume workout"
              onPress={() => onOpenSession?.()}
              accessibilityLabel="Resume your workout in progress"
              testID="today-primary-resume"
            />
          </View>
        );

      case 'planned': {
        const estimate = durationEstimate(
          recordedDurationsForFocus(state.focus),
          profile.session_duration_cap_min,
        );
        const preview = (todayPlan?.slots ?? []).slice(0, 4);
        const remaining = (todayPlan?.slots.length ?? 0) - preview.length;
        return (
          <View style={[styles.card, styles.cardActive]} testID="today-card-planned">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>{focusName(state.focus)}</Text>
            <Text style={styles.caption} testID="today-duration">{durationCopy(estimate)}</Text>
            <View style={styles.preview}>
              {preview.map((slot) => (
                <Text key={slot.plannedSlotId} style={styles.previewRow}>
                  {slot.movementName} · {slot.sets}×{slot.target.kind === 'time'
                    ? `${slot.target.seconds}s`
                    : slot.target.reps}
                </Text>
              ))}
              {remaining > 0 && (
                <Text style={styles.caption}>+{remaining} more</Text>
              )}
            </View>
            <PrimaryButton
              label="Start workout"
              onPress={startAndOpen}
              accessibilityLabel={`Start today's ${focusName(state.focus)} workout`}
              testID="today-primary-start"
            />
            {state.overdue.length > 0 && (
              <Text style={styles.caption} testID="today-overdue-note">
                {state.overdue.length} earlier session{state.overdue.length === 1 ? '' : 's'} in this
                block {state.overdue.length === 1 ? 'was' : 'were'} never finished. Today&apos;s work
                comes first; your plan is unchanged.
              </Text>
            )}
          </View>
        );
      }

      case 'completed_today':
        return (
          <View style={styles.card} testID="today-card-completed">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>{focusName(state.focus)} — done</Text>
            <Text style={styles.body}>
              Today&apos;s session is recorded. Recover well.
            </Text>
            {/* No primary start here. Offering one after a finalized session
                invites a duplicate of work already banked. The extra session
                below is the SAME ad-hoc path Coach already offers, and it is
                deliberately quiet. */}
            <QuietAction
              label="Start an extra session"
              onPress={startAndOpen}
              accessibilityLabel="Start an extra unplanned session today"
              testID="today-extra-session"
            />
          </View>
        );

      case 'overdue':
        return (
          <View style={styles.card} testID="today-card-overdue">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>Nothing scheduled today</Text>
            <Text style={styles.body}>
              You have {state.missedCount} unfinished session
              {state.missedCount === 1 ? '' : 's'} in this block, the earliest from{' '}
              {shortDate(state.earliest.sessionDate)} ({focusName(state.earliest.focus)}).
            </Text>
            {/* Deliberately NOT offering "move it to today". Rescheduling is a
                §2 Phase 2 item and would be a new schedule mutation rule. The
                plan is left exactly as generated. */}
            <Text style={styles.caption}>
              Your plan has not been changed. Open it to see where you are, or train now
              off-plan.
            </Text>
            <PrimaryButton
              label="Open your plan"
              onPress={() => onOpenPlan?.()}
              accessibilityLabel="Open your plan to see unfinished sessions"
              testID="today-primary-plan"
            />
            <QuietAction
              label="Start a session now"
              onPress={startAndOpen}
              accessibilityLabel="Start an unplanned session now"
              testID="today-adhoc-session"
            />
          </View>
        );

      case 'scheduled_rest':
        return (
          <View style={styles.card} testID="today-card-rest">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>Rest day</Text>
            <Text style={styles.body}>
              Your plan schedules recovery today. That is the work.
            </Text>
            <QuietAction
              label="Start a session anyway"
              onPress={startAndOpen}
              accessibilityLabel="Start an unplanned session on a scheduled rest day"
              testID="today-adhoc-session"
            />
          </View>
        );

      case 'unscheduled': {
        const copy: Record<typeof state.reason, { title: string; body: string }> = {
          no_program: {
            title: 'No plan yet',
            body: 'Build a plan and today gets a workout with it.',
          },
          between_blocks: {
            title: 'Between blocks',
            body: 'Your last block finished. Starting the next one gives today a session.',
          },
          block_ended: {
            title: 'This block has ended',
            body: 'Every session in the current block is in the past. Start the next block to keep going.',
          },
          not_started_yet: {
            title: 'Your plan starts soon',
            body: 'Nothing is scheduled today because your block has not begun yet.',
          },
        };
        const { title, body } = copy[state.reason];
        return (
          <View style={styles.card} testID="today-card-unscheduled">
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <PrimaryButton
              label="Open your plan"
              onPress={() => onOpenPlan?.()}
              accessibilityLabel="Open your plan"
              testID="today-primary-plan"
            />
            <QuietAction
              label="Start a session now"
              onPress={startAndOpen}
              accessibilityLabel="Start an unplanned session now"
              testID="today-adhoc-session"
            />
          </View>
        );
      }
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="today-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.color.textMid}
          colors={[theme.color.textMid]}
        />
      }
    >
      {workoutCard()}

      {error !== null && (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="today-error">
          {error}
        </Text>
      )}

      {/* Only real, persisted adjustments. Nothing renders when nothing moved. */}
      {adjustmentLines.length > 0 && (
        <View style={styles.section} testID="today-adjustments">
          <Text style={styles.sectionTitle}>WHAT CHANGED TODAY</Text>
          {adjustmentLines.map((line, index) => (
            <Text key={`${index}:${line}`} style={styles.body}>{line}</Text>
          ))}
          {pendingAutopilotAdjustments.map((adjustment, index) => (
            <Text key={`why:${index}:${adjustment.plannedSlotId}`} style={styles.caption}>
              {adjustment.reason}
            </Text>
          ))}
        </View>
      )}

      {/* Readiness sits BELOW the workout and stays at label scale (§4). */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>READINESS</Text>
        {vector === null ? (
          <Text style={styles.caption} testID="today-readiness-none">
            No readiness estimate yet. It builds from logged sessions and any synced telemetry.
          </Text>
        ) : (
          <Disclosure label={READINESS_LABEL[classifyReadiness(vector)]} hint="The short explanation first">
            <ListRow
              label="Readiness estimate"
              detail={`${Math.round(vector.readiness_score)} / 100`}
            />
            <Text style={styles.caption}>
              Full metrics and recent history stay on Progress.
            </Text>
          </Disclosure>
        )}
      </View>

      {state.kind !== 'planned' && state.kind !== 'active_session' && state.kind !== 'halted' && (
        renderNext(
          'next' in state ? state.next : null,
          'No further sessions are scheduled in this block.',
        )
      )}

      <Text style={styles.date}>{today}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ink0 },
  content: {
    paddingHorizontal: theme.space[4],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[6],
  },
  center: {
    flex: 1,
    backgroundColor: theme.color.ink0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space[5],
  },
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[5],
    gap: theme.space[4],
  },
  cardActive: {
    borderLeftWidth: 3,
    borderLeftColor: theme.color.chalk,
  },
  eyebrow: { ...theme.font.eyebrow, color: theme.color.textLow },
  title: { ...theme.font.title, color: theme.color.textHi },
  body: { ...theme.font.body, color: theme.color.textHi },
  caption: { ...theme.font.label, color: theme.color.textMid },
  preview: { gap: theme.space[1] },
  previewRow: { ...theme.font.body, color: theme.color.textMid },
  section: { marginTop: theme.space[5], gap: theme.space[3] },
  sectionTitle: { ...theme.font.eyebrow, color: theme.color.textLow },
  error: {
    ...theme.font.body,
    color: theme.color.textHi,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.textHi,
    paddingLeft: theme.space[3],
    marginTop: theme.space[4],
  },
  date: {
    textAlign: 'center',
    marginTop: theme.space[5],
    ...theme.font.label,
    color: theme.color.textLow,
  },
});
