/**
 * BlockScreen.tsx - the COACH surface.
 *
 * Coaching information is arranged around one immediate decision, a compact
 * four-week trajectory, and inline disclosures for management and context.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SCHEMA_TYPES, targetLoadKg, type SchemaType } from '@ak/inference';
import {
  palette,
  useStore,
  type BlockSessionSummary,
  type TodaySlot,
} from '../state/useStore';
import {
  Body,
  Caption,
  Disclosure,
  FocusCard,
  PrimaryAction,
  ProgressRow,
  Screen,
  SecondaryAction,
  Section,
  StatusMark,
  type FocusTone,
} from '../components/FocusPrimitives';

const FOCUS_ABBREV: Record<string, string> = {
  lower: 'LWR',
  upper: 'UPR',
  full: 'FUL',
  conditioning: 'CND',
  bjj: 'BJJ',
};

const PHASE_LABEL: Record<string, string> = {
  accumulation: 'Build',
  intensification: 'Build strength',
  realization: 'Realise',
  deload: 'Deload',
};

interface BlockScreenProps {
  /** Called after a session starts here so the shell can switch tabs. */
  onSessionStarted?: () => void;
}

interface SessionDetail {
  summary: BlockSessionSummary;
  slots: TodaySlot[];
}

interface WeekRow {
  week: number;
  phase: string;
  cells: (BlockSessionSummary | null)[];
}

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

const focusLabel = (focus: string): string => FOCUS_ABBREV[focus] ?? focus.slice(0, 3).toUpperCase();

const focusName = (focus: string): string => focus
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const phaseLabel = (phase: string): string => PHASE_LABEL[phase] ?? phase;

function targetLabel(slot: TodaySlot): string {
  return slot.target.kind === 'time'
    ? `${slot.sets} x ${slot.target.seconds}s`
    : `${slot.sets} x ${slot.target.reps}`;
}

function slotTarget(slot: TodaySlot, oneRepMaxes: Record<number, number>): string {
  if (slot.target.kind === 'time') {
    return `${targetLabel(slot)} at RPE ${slot.targetRpe.toFixed(1)}`;
  }
  const oneRepMax = oneRepMaxes[slot.movementId];
  const load = slot.overrideLoadKg ?? (
    oneRepMax !== undefined ? targetLoadKg(oneRepMax, slot.target.reps, slot.targetRpe) : null
  );
  return `${targetLabel(slot)} at RPE ${slot.targetRpe.toFixed(1)}${
    load === null ? '' : `, ${load.toFixed(1)} kg`
  }`;
}
function weekRowsFor(sessions: readonly BlockSessionSummary[]): WeekRow[] {
  return [1, 2, 3, 4].map((week) => {
    const inWeek = sessions.filter((session) => session.weekIndex === week);
    return {
      week,
      phase: inWeek[0]?.phase ?? 'accumulation',
      cells: [1, 2, 3, 4, 5, 6, 7].map(
        (day) => inWeek.find((session) => session.dayIndex === day) ?? null,
      ),
    };
  });
}

export default function BlockScreen({ onSessionStarted }: BlockScreenProps): React.JSX.Element {
  const vector = useStore((s) => s.vector);
  const today = useStore((s) => s.today);
  const prescription = useStore((s) => s.prescription);
  const profileNotes = useStore((s) => s.profileNotes);
  const triageReady = useStore((s) => s.triageReady);
  const triaging = useStore((s) => s.triaging);
  const lastTriage = useStore((s) => s.lastTriage);
  const block = useStore((s) => s.block);
  const blockMeta = useStore((s) => s.blockMeta);
  const oneRepMaxes = useStore((s) => s.oneRepMaxes);
  const blockSessions = useStore((s) => s.blockSessions);
  const todayPlan = useStore((s) => s.todayPlan);
  const session = useStore((s) => s.session);
  const generateNewBlock = useStore((s) => s.generateNewBlock);
  const loadSessionSlots = useStore((s) => s.loadSessionSlots);
  const reportSubjective = useStore((s) => s.reportSubjective);
  const startSession = useStore((s) => s.startSession);

  const [reportText, setReportText] = useState('');
  const [reportSeverity, setReportSeverity] = useState<number | null>(null);
  const [schema, setSchema] = useState<SchemaType>('LINEAR');
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [manageOpen, setManageOpen] = useState(block === null);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmUnplannedStart, setConfirmUnplannedStart] = useState(false);

  if (vector === null) {
    return (
      <View style={styles.center}>
        <FocusCard eyebrow="COACH" title="Readiness is needed first" tone="caution">
          <Body>Sync telemetry or load the demo athlete before asking Coach to adjust today\'s plan.</Body>
        </FocusCard>
      </View>
    );
  }

  const current = prescription !== null && prescription.forDate === today ? prescription : null;
  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
  const rows = weekRowsFor(blockSessions);
  const nextPlanned = blockSessions.find((planned) => planned.sessionDate > today);

  const openDetail = (summary: BlockSessionSummary): void => {
    if (detail?.summary.plannedSessionId === summary.plannedSessionId) {
      setDetail(null);
      return;
    }
    setDetail({ summary, slots: loadSessionSlots(summary.plannedSessionId) });
  };

  const openNextSession = (): void => {
    if (nextPlanned === undefined) {
      setManageOpen(true);
      return;
    }
    setDetail({ summary: nextPlanned, slots: loadSessionSlots(nextPlanned.plannedSessionId) });
  };

  const startPlannedSession = (): void => {
    startSession();
    onSessionStarted?.();
  };

  const startUnplannedSession = (): void => {
    startSession();
    onSessionStarted?.();
  };

  let todayTitle = 'Recovery day';
  let todayMessage = nextPlanned === undefined
    ? 'There is no session to complete today. Use the day to recover.'
    : `There is no session to complete today. Your next session is ${focusName(nextPlanned.focus)}.`;
  let todayTone: FocusTone = 'default';

  if (halted) {
    todayTitle = 'Training is paused';
    todayMessage = 'Today\'s safety report paused training. Review it before doing more work.';
    todayTone = 'danger';
  } else if (session !== null) {
    todayTitle = 'Session in progress';
    todayMessage = 'Your active workout is ready to resume.';
    todayTone = 'active';
  } else if (todayPlan !== null) {
    todayTitle = `Today: ${focusName(todayPlan.focus)}`;
    todayMessage = `${todayPlan.slots.length} movements are planned. Start when you are ready.`;
    todayTone = 'active';
  } else if (block === null) {
    todayTitle = 'Build your first block';
    todayMessage = 'A short four-week block gives Coach a clear trajectory to follow.';
    todayTone = 'default';
  }

  return (
    <Screen testID="coach-screen">
      {halted && lastTriage !== null && lastTriage.kind === 'matched' && (
        <FocusCard eyebrow="SAFETY" title="Stop training today" tone="danger" style={styles.haltCard}>
          <Body>{lastTriage.directive.vector.coaching_cue}</Body>
          {lastTriage.directive.followUp !== null && (
            <Caption style={styles.followUp}>{lastTriage.directive.followUp}</Caption>
          )}
        </FocusCard>
      )}

      <FocusCard eyebrow="TODAY" title={todayTitle} tone={todayTone}>
        <StatusMark
          label={
            halted
              ? 'Training paused'
              : session !== null
                ? 'Active session'
                : todayPlan !== null
                  ? 'Planned session'
                  : block === null
                    ? 'Plan needed'
                    : 'Recovery day'
          }
          tone={todayTone}
        />
        <Body>{todayMessage}</Body>
        {current !== null && !halted && <Caption style={styles.adjusted}>Coach adjusted today\'s plan.</Caption>}

        {halted ? (
          <PrimaryAction label="Review safety report" onPress={() => setReportOpen(true)} />
        ) : session !== null ? (
          <PrimaryAction label="Open active session" onPress={() => onSessionStarted?.()} />
        ) : todayPlan !== null ? (
          <PrimaryAction label="Start session" onPress={startPlannedSession} />
        ) : block === null ? (
          <PrimaryAction label="Set up a four-week block" onPress={() => setManageOpen(true)} />
        ) : (
          <PrimaryAction
            label={nextPlanned === undefined ? 'Plan the next block' : 'Preview next session'}
            onPress={openNextSession}
          />
        )}
      </FocusCard>

      <Section title="Four-week trajectory">
        {block === null ? (
          <View style={styles.emptyTrajectory}>
            <Body>No block is active yet.</Body>
            <Caption>Set one up below when you are ready to train with a trajectory.</Caption>
          </View>
        ) : (
          <>
            {rows.map((row) => (
              <View key={row.week}>
                <View style={styles.weekRow}>
                  <View style={styles.weekMeta}>
                    <Text style={styles.weekTitle}>Week {row.week}</Text>
                    <Text style={styles.weekPhase}>{phaseLabel(row.phase)}</Text>
                  </View>
                  <View style={styles.dayRail}>
                    {row.cells.map((cell, dayIndex) => {
                      if (cell === null) {
                        return (
                          <View key={`rest-${dayIndex}`} style={[styles.dayMark, styles.dayMarkRest]}>
                            <Text style={styles.dayMarkRestText}>-</Text>
                          </View>
                        );
                      }
                      const isToday = cell.sessionDate === today;
                      const isExpanded = detail?.summary.plannedSessionId === cell.plannedSessionId;
                      return (
                        <Pressable
                          key={cell.plannedSessionId}
                          onPress={() => openDetail(cell)}
                          accessibilityRole="button"
                          accessibilityLabel={`Week ${cell.weekIndex}, ${cell.focus} session on ${cell.sessionDate}${cell.trained ? ', completed' : ''}`}
                          accessibilityState={{ expanded: isExpanded, selected: isToday }}
                          style={({ pressed }) => [
                            styles.dayMark,
                            cell.trained && styles.dayMarkTrained,
                            isToday && styles.dayMarkToday,
                            isExpanded && styles.dayMarkExpanded,
                            pressed && styles.dayMarkPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayMarkText,
                              cell.trained && styles.dayMarkTextTrained,
                              isToday && styles.dayMarkTextToday,
                            ]}
                          >
                            {cell.trained ? 'Done' : isToday ? 'Today' : focusLabel(cell.focus)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {detail !== null && detail.summary.weekIndex === row.week && (
                  <View style={styles.sessionDetail}>
                    <Text style={styles.sessionDetailTitle}>
                      {detail.summary.sessionDate} - {focusName(detail.summary.focus)}
                      {detail.summary.trained ? ' - completed' : ''}
                    </Text>
                    {detail.slots.map((slot) => (
                      <ProgressRow
                        key={slot.slotIndex}
                        label={slot.movementName}
                        value={targetLabel(slot)}
                        detail={`RPE ${slot.targetRpe.toFixed(1)}`}
                      />
                    ))}
                    <SecondaryAction label="Close session preview" onPress={() => setDetail(null)} />
                  </View>
                )}
              </View>
            ))}
            <Caption style={styles.trajectoryHint}>Tap a planned day to see its movements.</Caption>
          </>
        )}
      </Section>

      <Section title="Optional details">
        <Disclosure label="Why today changed" hint="Adjustment source and limits">
          {current === null ? (
            <Caption>No extra adjustment is active for today.</Caption>
          ) : (
            <>
              <ProgressRow label="Source" value={current.source} />
              <ProgressRow label="Load" value={`x${current.vector.load_modifier.toFixed(2)}`} />
              <ProgressRow label="Sets" value={signed(current.vector.set_modifier)} />
              <ProgressRow label="RPE cap" value={current.vector.rpe_cap.toFixed(1)} />
              {profileNotes.map((note) => (
                <Caption key={note} style={styles.profileNote}>{note}</Caption>
              ))}
            </>
          )}
        </Disclosure>

        {todayPlan !== null && (
          <Disclosure label="Preview today\'s session" hint="Movement targets before you start">
            <Caption>
              {focusName(todayPlan.focus)} - {phaseLabel(todayPlan.phase)}
            </Caption>
            {todayPlan.slots.map((slot) => (
              <ProgressRow
                key={slot.slotIndex}
                label={slot.movementName}
                value={targetLabel(slot)}
                detail={slotTarget(slot, oneRepMaxes)}
              />
            ))}
          </Disclosure>
        )}

        <Disclosure
          label="Manage block"
          hint={block === null ? 'Choose a structure for your first block' : 'Block settings and regeneration'}
          open={manageOpen}
          onOpenChange={setManageOpen}
        >
          {block !== null ? (
            <Caption>
              {block.objective.replace(/_/g, ' ')} block, started {block.startDate}
              {blockMeta !== null
                ? ` - ${blockMeta.schemaType} - macro block ${blockMeta.macroBlockIndex} of 8`
                : ''}
            </Caption>
          ) : (
            <Caption>
              Coach will build from your objective, equipment, and weekly frequency.
            </Caption>
          )}
          {blockMeta?.peakShifted === true && (
            <Caption style={styles.peakShift}>
              Coach inserted a deload week before the peak because fatigue was high.
            </Caption>
          )}
          <Text style={styles.schemaLabel}>Choose a loading structure</Text>
          <View style={styles.schemaRow}>
            {SCHEMA_TYPES.map((type) => {
              const selected = type === schema;
              return (
                <Pressable
                  key={type}
                  onPress={() => setSchema(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${type} loading structure`}
                  style={[styles.schemaChip, selected && styles.schemaChipSelected]}
                >
                  <Text style={[styles.schemaChipText, selected && styles.schemaChipTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!confirmRegenerate ? (
            <PrimaryAction
              label={block === null ? 'Create four-week block' : 'Generate next block'}
              onPress={() => {
                if (block === null) {
                  generateNewBlock(schema);
                  setManageOpen(false);
                } else {
                  setConfirmRegenerate(true);
                }
              }}
            />
          ) : (
            <View style={styles.confirmation}>
              <Body>This archives the current block and starts the next one today.</Body>
              <PrimaryAction
                label="Generate next block now"
                onPress={() => {
                  setDetail(null);
                  generateNewBlock(schema);
                  setConfirmRegenerate(false);
                  setManageOpen(false);
                }}
              />
              <SecondaryAction label="Keep current block" onPress={() => setConfirmRegenerate(false)} />
            </View>
          )}

          {(block === null || todayPlan === null) && !halted && session === null && (
            <Disclosure label="Start without a planned session" tone="caution">
              {!confirmUnplannedStart ? (
                <>
                  <Caption>
                    This starts a session without the day\'s planned exercise order.
                  </Caption>
                  <SecondaryAction
                    label="Start an unplanned session"
                    onPress={() => setConfirmUnplannedStart(true)}
                  />
                </>
              ) : (
                <>
                  <Body>Start a session without a planned workout?</Body>
                  <PrimaryAction label="Start unplanned session" onPress={startUnplannedSession} />
                  <SecondaryAction label="Cancel" onPress={() => setConfirmUnplannedStart(false)} />
                </>
              )}
            </Disclosure>
          )}
        </Disclosure>

        <Disclosure
          label="Something feels off"
          hint="Add a subjective report only when you need Coach to adapt"
          tone={halted ? 'danger' : 'caution'}
          open={reportOpen}
          onOpenChange={setReportOpen}
        >
          {!triageReady && (
            <Caption>
              Semantic matching is unavailable in this build. Injury-language safety checks still apply.
            </Caption>
          )}
          <TextInput
            style={styles.reportInput}
            value={reportText}
            onChangeText={setReportText}
            placeholder="For example: my knee feels sore when I squat"
            placeholderTextColor={palette.dim}
            maxLength={500}
            multiline
            accessibilityLabel="Describe how your body feels today"
          />
          <Text style={styles.severityLabel}>Severity from 1 to 10</Text>
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((severity) => {
              const selected = reportSeverity === severity;
              const high = severity >= 7;
              return (
                <Pressable
                  key={severity}
                  onPress={() => setReportSeverity(severity)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Severity ${severity} of 10`}
                  style={[
                    styles.severityChip,
                    selected && (high ? styles.severityChipHigh : styles.severityChipSelected),
                  ]}
                >
                  <Text style={[styles.severityText, selected && styles.severityTextSelected]}>{severity}</Text>
                </Pressable>
              );
            })}
          </View>
          <PrimaryAction
            label={triaging ? 'Checking report' : 'Apply report'}
            disabled={reportText.trim().length === 0 || reportSeverity === null || triaging}
            onPress={() => {
              if (reportSeverity === null) return;
              void reportSubjective(reportText, reportSeverity).then(() => {
                setReportText('');
                setReportSeverity(null);
              });
            }}
          />

          {lastTriage !== null && lastTriage.kind === 'positive' && (
            <View style={styles.reportResult}>
              <StatusMark label="Noted" tone="success" />
              <Body>{lastTriage.cue}</Body>
            </View>
          )}
          {lastTriage !== null && lastTriage.kind === 'rejected' && (
            <View style={styles.reportResult}>
              <StatusMark label="No change" tone="default" />
              <Caption>
                Coach did not match this to a known scenario, so today\'s plan is unchanged.
              </Caption>
            </View>
          )}
          {lastTriage !== null && lastTriage.kind === 'matched' && !lastTriage.directive.halt && (
            <View style={styles.reportResult}>
              <StatusMark label="Plan adjusted" tone="caution" />
              <Body>{lastTriage.directive.vector.coaching_cue}</Body>
              {lastTriage.directive.followUp !== null && (
                <Caption>{lastTriage.directive.followUp}</Caption>
              )}
            </View>
          )}
        </Disclosure>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: palette.bg,
    justifyContent: 'center',
    padding: 24,
  },
  haltCard: { marginBottom: 14 },
  followUp: { color: palette.text },
  adjusted: { color: palette.amber },
  emptyTrajectory: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 8,
  },
  weekRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 5,
  },
  weekMeta: { width: 78, justifyContent: 'center' },
  weekTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  weekPhase: { color: palette.dim, fontSize: 11, marginTop: 2 },
  dayRail: { flex: 1, flexDirection: 'row', gap: 4 },
  dayMark: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dayMarkPressed: { backgroundColor: '#1A1A20' },
  dayMarkRest: { backgroundColor: 'transparent' },
  dayMarkTrained: { borderColor: palette.green, backgroundColor: '#10241D' },
  dayMarkToday: { borderColor: palette.amber, borderWidth: 2 },
  dayMarkExpanded: { borderColor: palette.text },
  dayMarkText: { color: palette.text, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  dayMarkTextTrained: { color: palette.green },
  dayMarkTextToday: { color: palette.amber },
  dayMarkRestText: { color: palette.line, fontSize: 16 },
  trajectoryHint: { marginTop: 6 },
  sessionDetail: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    marginBottom: 12,
    padding: 14,
    gap: 8,
  },
  sessionDetailTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  profileNote: { color: palette.amber },
  peakShift: { color: palette.amber },
  schemaLabel: { color: palette.dim, fontSize: 13, fontWeight: '700' },
  schemaRow: { flexDirection: 'row', gap: 8 },
  schemaChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemaChipSelected: { borderColor: palette.green, backgroundColor: '#10241D' },
  schemaChipText: { color: palette.dim, fontSize: 12, fontWeight: '800' },
  schemaChipTextSelected: { color: palette.green },
  confirmation: {
    borderWidth: 1,
    borderColor: palette.amber,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  reportInput: {
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.bg,
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  severityLabel: { color: palette.text, fontSize: 14, fontWeight: '700' },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  severityChip: {
    width: 42,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipSelected: { borderColor: palette.amber, backgroundColor: '#2A210F' },
  severityChipHigh: { borderColor: palette.red, backgroundColor: '#2A1416' },
  severityText: { color: palette.dim, fontSize: 15, fontWeight: '800' },
  severityTextSelected: { color: palette.text },
  reportResult: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 12,
    gap: 8,
  },
});