/**
 * BlockScreen.tsx - the COACH surface (§1j).
 *
 * Coaching information is arranged around one immediate decision, a compact
 * four-week trajectory (liquid calendar), and inline disclosures for management and context.
 */
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SCHEMA_TYPES, addDaysIso, targetLoadKg, type BlockPlan, type SchemaType } from '@ak/inference';
import {
  useStore,
  type BlockSessionSummary,
  type TodaySlot,
  type RoutineTemplate,
} from '../state/useStore';
import { RoutineTemplateBuilder } from '../components/RoutineTemplateBuilder';
import { useSubViewBack } from '../navigation/navigation';
import ProgramSetupScreen from './ProgramSetupScreen';
import { theme } from '../theme/theme';
import {
  PrimaryButton,
  SecondaryButton,
  Chip,
  Disclosure,
} from '../components/ui';

const SCHEMA_LABEL: Record<SchemaType, string> = {
  LINEAR: 'Linear',
  WAVE: 'Undulating',
  STEP: 'Step Loading',
  APRE: 'Autoregulated',
};

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

const AUTOPILOT_BUDGET_NOTE = 'Held steady — effort only rises early in a cycle.';

function autopilotExplanation(slot: TodaySlot): string | null {
  switch (slot.autopilot?.reason) {
    case 'eased': return 'Eased off — your recent sets felt harder than planned.';
    case 'raised': return 'Nudged up — your recent sets felt easier than planned.';
    case 'held_safety': return 'Eased for safety — a recent safety signal lowered this target.';
    default: return null;
  }
}

function AutopilotAttribution({
  slot,
  expanded,
  onPress,
}: {
  slot: TodaySlot;
  expanded: boolean;
  onPress: () => void;
}): React.JSX.Element | null {
  const explanation = autopilotExplanation(slot);
  if (explanation === null) return null;
  return (
    <View style={styles.attribution}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Why ${slot.movementName} target changed`}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.attributionMarker}>·</Text>
      </Pressable>
      {expanded && <Text style={styles.attributionText}>{explanation}</Text>}
    </View>
  );
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
  const hasArchivedBlock = useStore((s) => s.hasArchivedBlock);
  const session = useStore((s) => s.session);
  const generateNewBlock = useStore((s) => s.generateNewBlock);
  const loadSessionSlots = useStore((s) => s.loadSessionSlots);
  const reportSubjective = useStore((s) => s.reportSubjective);
  const program = useStore((s) => s.program);
  const previewNextProgramBlock = useStore((s) => s.previewNextProgramBlock);
  const continueTrainingProgram = useStore((s) => s.continueTrainingProgram);
  const archiveTrainingProgram = useStore((s) => s.archiveTrainingProgram);
  const [editingProgram, setEditingProgram] = useState(false);
  const [nextProgramPreview, setNextProgramPreview] = useState<BlockPlan | null>(null);
  const startSession = useStore((s) => s.startSession);

  const routineTemplates = useStore((s) => s.routineTemplates) ?? [];
  const freezeRoutineTemplateToPlannedSession = useStore(
    (s) => s.freezeRoutineTemplateToPlannedSession,
  );
  const deleteRoutineTemplate = useStore((s) => s.deleteRoutineTemplate);

  const [reportText, setReportText] = useState('');
  const [reportSeverity, setReportSeverity] = useState<number | null>(null);
  const [schema, setSchema] = useState<SchemaType>('LINEAR');
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [attributionSlotId, setAttributionSlotId] = useState<number | null>(null);
  const [macroBudgetOpen, setMacroBudgetOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(block === null);
  const scrollRef = useRef<ScrollView>(null);
  const trajectorySectionY = useRef(0);
  const manageSectionOffsetY = useRef(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmUnplannedStart, setConfirmUnplannedStart] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    RoutineTemplate | 'new' | null
  >(null);
  const [confirmRoutineAction, setConfirmRoutineAction] = useState<{
    kind: 'use' | 'delete'; routineTemplateId: number;
  } | null>(null);
  const [routineActionMessage, setRoutineActionMessage] = useState<string | null>(null);
  const [blockArchivedNotice, setBlockArchivedNotice] = useState<string | null>(null);

  const hasSubView =
    editingProgram ||
    nextProgramPreview !== null ||
    detail !== null ||
    reportOpen ||
    confirmRegenerate ||
    confirmUnplannedStart ||
    editingTemplate !== null ||
    confirmRoutineAction !== null;

  useSubViewBack(hasSubView, () => {
    if (editingProgram) setEditingProgram(false);
    else if (nextProgramPreview !== null) setNextProgramPreview(null);
    else if (editingTemplate !== null) setEditingTemplate(null);
    else if (confirmRoutineAction !== null) setConfirmRoutineAction(null);
    else if (detail !== null) setDetail(null);
    else if (reportOpen) setReportOpen(false);
    else if (confirmRegenerate) setConfirmRegenerate(false);
    else if (confirmUnplannedStart) setConfirmUnplannedStart(false);
  });

  const requestRoutineAction = (kind: 'use' | 'delete', routineTemplateId: number): void => {
    setRoutineActionMessage(null);
    setBlockArchivedNotice(null);
    setConfirmRoutineAction({ kind, routineTemplateId });
  };

  const confirmSelectedRoutineAction = (template: RoutineTemplate): void => {
    const action = confirmRoutineAction;
    if (action === null || action.routineTemplateId !== template.routineTemplateId) return;
    try {
      if (action.kind === 'delete') {
        deleteRoutineTemplate(template.routineTemplateId);
        setRoutineActionMessage(`${template.name} was deleted.`);
        setBlockArchivedNotice(null);
      } else {
        const result = freezeRoutineTemplateToPlannedSession(template.routineTemplateId);
        setRoutineActionMessage(`${template.name} is frozen into today's plan.`);
        if (result.archivedPreviousBlock) {
          setBlockArchivedNotice('Your previous block had ended. A new block was started.');
        } else {
          setBlockArchivedNotice(null);
        }
      }
    } catch (error) {
      setRoutineActionMessage(error instanceof Error ? error.message : String(error));
      setBlockArchivedNotice(null);
    } finally {
      setConfirmRoutineAction(null);
    }
  };

  if (editingProgram) {
    return (
      <ProgramSetupScreen
        editing
        onComplete={() => setEditingProgram(false)}
        onCancel={() => setEditingProgram(false)}
      />
    );
  }

  if (editingTemplate !== null) {
    return (
      <RoutineTemplateBuilder
        initialTemplate={editingTemplate === 'new' ? null : editingTemplate}
        onSaved={() => setEditingTemplate(null)}
        onCancel={() => setEditingTemplate(null)}
      />
    );
  }

  if (vector === null) {
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>COACH</Text>
          <Text style={styles.cardTitle}>Readiness is needed first</Text>
          <Text style={styles.bodyText}>
            Sync telemetry or load the demo athlete before asking Coach to adjust today's plan.
          </Text>
          <SecondaryButton
            label="Build a standalone routine"
            onPress={() => setEditingTemplate('new')}
            accessibilityLabel="Build a standalone routine template"
          />
        </View>
      </View>
    );
  }

  const current = prescription !== null && prescription.forDate === today ? prescription : null;
  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
  const rows = weekRowsFor(blockSessions);
  const nextPlanned = blockSessions.find((planned) => planned.sessionDate > today);
  const programBlockExpired = program?.status === 'active' && block !== null
    && today > addDaysIso(block.startDate, 27);
  const continuationReviewDate = program?.status === 'active'
    ? addDaysIso(today, (program.plannedBlockCount - program.currentSequenceIndex) * 28) : null;

  const openDetail = (summary: BlockSessionSummary): void => {
    if (detail?.summary.plannedSessionId === summary.plannedSessionId) {
      setDetail(null);
      return;
    }
    setDetail({ summary, slots: loadSessionSlots(summary.plannedSessionId) });
  };

  const openManageBlock = (): void => {
    setManageOpen(true);
    scrollRef.current?.scrollTo({
      y: Math.max(0, trajectorySectionY.current + manageSectionOffsetY.current - theme.space[4]),
      animated: true,
    });
  };

  const openNextSession = (): void => {
    if (nextPlanned === undefined) {
      openManageBlock();
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

  if (halted) {
    todayTitle = 'Training is paused';
    todayMessage = 'Today\'s safety report paused training. Review it before doing more work.';
  } else if (session !== null) {
    todayTitle = 'Session in progress';
    todayMessage = 'Your active workout is ready to resume.';
  } else if (todayPlan !== null) {
    todayTitle = `Today: ${focusName(todayPlan.focus)}`;
    todayMessage = `${todayPlan.slots.length} movements are planned. Start when you are ready.`;
  } else if (block === null) {
    todayTitle = hasArchivedBlock ? 'Your previous block had ended.' : 'Build your first block';
    todayMessage = 'A short four-week block gives Coach a clear trajectory to follow.';
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" testID="coach-screen">
      {/* Header Wordmark */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>pikeMethods</Text>
      </View>

      {block === null && hasArchivedBlock && (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>PERIODIZATION</Text>
          <Text style={styles.cardTitle}>Your previous block had ended.</Text>
          <Text style={styles.bodyText}>
            A short four-week block gives Coach a clear trajectory to follow.
          </Text>
        </View>
      )}

      {blockArchivedNotice !== null && (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>PERIODIZATION</Text>
          <Text style={styles.cardTitle}>{blockArchivedNotice}</Text>
        </View>
      )}

      {/* Safety Halt Card if halted */}
      {halted && lastTriage !== null && lastTriage.kind === 'matched' && (
        <View style={[styles.card, styles.haltCard]}>
          <Text style={styles.eyebrow}>SAFETY</Text>
          <Text style={styles.cardTitle}>Stop training today</Text>
          <Text style={styles.bodyText}>{lastTriage.directive.vector.coaching_cue}</Text>
          {lastTriage.directive.followUp !== null && (
            <Text style={styles.followUpText}>{lastTriage.directive.followUp}</Text>
          )}
        </View>
      )}

      {program != null && (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>GOAL PROGRAM</Text>
          <Text style={styles.cardTitle}>Block {program.currentSequenceIndex} of {program.plannedBlockCount}</Text>
          <Text style={styles.bodyText}>Review boundary: {program.plannedEndDate}</Text>
          {program.status === 'review_due' && (
            <>
              <Text style={styles.adjustedText}>Goal reassessment is due before another program starts.</Text>
              <PrimaryButton label="Reassess goal" onPress={archiveTrainingProgram} accessibilityLabel="Archive completed program and reassess goal" />
            </>
          )}
        </View>
      )}

      {/* Today Focus Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.eyebrow}>TODAY</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {halted
                ? 'Training paused'
                : session !== null
                  ? 'Active session'
                  : todayPlan !== null
                    ? 'Planned session'
                    : block === null
                      ? 'Plan needed'
                      : 'Recovery day'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{todayTitle}</Text>
        <Text style={styles.bodyText}>{todayMessage}</Text>
        {current !== null && !halted && (
          <Text style={styles.adjustedText}>Coach adjusted today's plan.</Text>
        )}

        <View style={styles.cardActionRow}>
          {halted ? (
            <PrimaryButton label="Review safety report" onPress={() => setReportOpen(true)} accessibilityLabel="Review safety report" />
          ) : session !== null ? (
            <PrimaryButton label="Open active session" onPress={() => onSessionStarted?.()} accessibilityLabel="Open active session" />
          ) : programBlockExpired ? (
            <PrimaryButton
              label={program != null && program.currentSequenceIndex >= program.plannedBlockCount ? 'Review goal' : 'Review next block'}
              onPress={() => {
                const preview = previewNextProgramBlock();
                if (preview === null) continueTrainingProgram();
                else setNextProgramPreview(preview);
              }}
              accessibilityLabel="Review program continuation"
            />
          ) : todayPlan !== null ? (
            <PrimaryButton label="Start session" onPress={startPlannedSession} accessibilityLabel="Start session" />
          ) : block === null ? (
            <PrimaryButton label="Set up a four-week block" onPress={openManageBlock} accessibilityLabel="Set up a four-week block" />
          ) : (
            <PrimaryButton
              label={nextPlanned === undefined ? 'Plan the next block' : 'Preview next session'}
              onPress={openNextSession}
              accessibilityLabel={nextPlanned === undefined ? 'Plan the next block' : 'Preview next session'}
            />
          )}
          {block !== null && (
            <SecondaryButton
              label={program == null ? 'Manage block' : 'Manage program'}
              onPress={program == null ? openManageBlock : () => setEditingProgram(true)}
              accessibilityLabel={program == null ? 'Manage current block' : 'Manage future program preferences'}
            />
          )}
        </View>
      </View>

      {nextProgramPreview !== null && (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>NEXT BLOCK PREVIEW</Text>
          <Text style={styles.cardTitle}>{SCHEMA_LABEL[nextProgramPreview.schemaType]} - {nextProgramPreview.macroPhase}</Text>
          <Text style={styles.bodyText}>Starts today with {nextProgramPreview.sessions.filter((session) => session.week_index === 1).length} repeating training days.</Text>
          {nextProgramPreview.warnings.map((warning) => (
            <Text key={warning} style={styles.captionText}>{warning}</Text>
          ))}
          {program != null && continuationReviewDate !== null && continuationReviewDate !== program.plannedEndDate && (
            <Text style={styles.adjustedText}>
              Late confirmation moves the review boundary to {continuationReviewDate}, preserving four full weeks per remaining block.
            </Text>
          )}
          <PrimaryButton label="Confirm next block" onPress={() => {
            continueTrainingProgram();
            setNextProgramPreview(null);
          }} accessibilityLabel="Confirm and start next program block" />
          <SecondaryButton label="Not yet" onPress={() => setNextProgramPreview(null)} />
        </View>
      )}

      {/* Four-week trajectory Section */}
      <View
        style={styles.section}
        onLayout={(event) => { trajectorySectionY.current = event.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionTitle}>Four-week trajectory</Text>
        {blockMeta !== null && blockMeta.macroBlockIndex >= 6 && (
          <View style={styles.blockAttribution}>
            <Pressable
              onPress={() => setMacroBudgetOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel="Why effort is held steady"
              accessibilityState={{ expanded: macroBudgetOpen }}
            >
              <Text style={styles.attributionMarker}>·</Text>
            </Pressable>
            {macroBudgetOpen && <Text style={styles.attributionText}>{AUTOPILOT_BUDGET_NOTE}</Text>}
          </View>
        )}
        {block === null ? (
          <View style={styles.emptyTrajectory}>
            <Text style={styles.bodyText}>No block is active yet.</Text>
            <Text style={styles.captionText}>Set one up below when you are ready to train with a trajectory.</Text>
          </View>
        ) : (
          <>
            {rows.map((row) => (
              <View key={row.week} style={styles.weekContainer}>
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
                          accessibilityLabel={`Week ${cell.weekIndex}, ${cell.focus} session on ${cell.sessionDate}${
                            cell.completionStatus === 'complete'
                              ? ', completed'
                              : cell.completionStatus === 'halted'
                                ? ', stopped'
                                : ''
                          }`}
                          accessibilityState={{ expanded: isExpanded, selected: isToday }}
                          testID={isToday ? 'today-marker' : undefined}
                          style={({ pressed }) => [
                            styles.dayMark,
                            cell.completionStatus !== null && styles.dayMarkFinalized,
                            isToday && styles.dayMarkToday,
                            isExpanded && styles.dayMarkExpanded,
                            pressed && styles.dayMarkPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayMarkText,
                              cell.completionStatus !== null && styles.dayMarkTextFinalized,
                              isToday && styles.dayMarkTextToday,
                            ]}
                          >
                            {cell.completionStatus === 'complete'
                              ? 'Done'
                              : cell.completionStatus === 'halted'
                                ? 'Stopped'
                                : isToday
                                  ? 'Today'
                                  : focusLabel(cell.focus)}
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
                      {detail.summary.completionStatus === 'complete'
                        ? ' - completed'
                        : detail.summary.completionStatus === 'halted'
                          ? ' - stopped'
                          : ''}
                    </Text>
                    {detail.slots.map((slot) => (
                      <View key={slot.slotIndex} style={styles.slotRow}>
                        <View style={styles.slotMain}>
                          <Text style={styles.slotName}>{slot.movementName}</Text>
                          <View style={styles.slotDetails}>
                            <Text style={styles.slotValue}>{targetLabel(slot)}</Text>
                            <Text style={styles.slotTarget}>RPE {slot.targetRpe.toFixed(1)}</Text>
                          </View>
                          <AutopilotAttribution
                            slot={slot}
                            expanded={attributionSlotId === slot.plannedSlotId}
                            onPress={() => setAttributionSlotId((currentId) => currentId === slot.plannedSlotId ? null : slot.plannedSlotId)}
                          />
                        </View>
                        {slot.overrideLoadKg !== null && (
                          <View style={styles.substitutedBadge} accessibilityRole="text">
                            <Text style={styles.substitutedBadgeText}>SUBSTITUTED</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <SecondaryButton label="Close session preview" onPress={() => setDetail(null)} accessibilityLabel="Close session preview" />
                  </View>
                )}
              </View>
            ))}
            <Text style={styles.trajectoryHint}>Tap a planned day to see its movements.</Text>
          </>
        )}
      </View>

      {/* Disclosures Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Optional details</Text>
        <Disclosure label="Why today changed" hint="Adjustment source and limits">
          {current === null ? (
            <Text style={styles.captionText}>No extra adjustment is active for today.</Text>
          ) : (
            <View style={styles.disclosureContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Source</Text>
                <Text style={styles.infoValue}>{current.source}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Load</Text>
                <Text style={styles.infoValue}>x{current.vector.load_modifier.toFixed(2)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sets</Text>
                <Text style={styles.infoValue}>{signed(current.vector.set_modifier)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>RPE cap</Text>
                <Text style={styles.infoValue}>{current.vector.rpe_cap.toFixed(1)}</Text>
              </View>
              {profileNotes.map((note) => (
                <Text key={note} style={styles.profileNoteText}>{note}</Text>
              ))}
            </View>
          )}
        </Disclosure>

        {todayPlan !== null && (
          <Disclosure label="Preview today's session" hint="Movement targets before you start">
            <View style={styles.disclosureContent}>
              <Text style={styles.captionText}>
                {focusName(todayPlan.focus)} - {phaseLabel(todayPlan.phase)}
              </Text>
              {todayPlan.slots.map((slot) => (
                <View key={slot.slotIndex} style={styles.slotRow}>
                  <View style={styles.slotMain}>
                    <Text style={styles.slotName}>{slot.movementName}</Text>
                    <Text style={styles.slotTarget}>{slotTarget(slot, oneRepMaxes)}</Text>
                    <AutopilotAttribution
                      slot={slot}
                      expanded={attributionSlotId === slot.plannedSlotId}
                      onPress={() => setAttributionSlotId((currentId) => currentId === slot.plannedSlotId ? null : slot.plannedSlotId)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Disclosure>
        )}

        <Disclosure
          label="Routine templates"
          hint="Create, edit, and freeze custom routine templates"
        >
          <View style={styles.disclosureContent}>
            {routineTemplates.length === 0 ? (
              <Text style={styles.captionText}>No saved routine templates yet.</Text>
            ) : (
              routineTemplates.map((t) => (
                <View key={t.routineTemplateId} style={styles.slotRow}>
                  <View style={styles.slotMain}>
                    <Text style={styles.slotName}>{t.name}</Text>
                    <Text style={styles.slotTarget}>
                      {SCHEMA_LABEL[t.schemaType]} - {t.slots.length} movements
                    </Text>
                  </View>
                  <View style={styles.routineActions}>
                    {confirmRoutineAction?.routineTemplateId === t.routineTemplateId ? (
                      <>
                        <Chip
                          label={confirmRoutineAction.kind === 'delete' ? 'Confirm delete' : 'Confirm replace'}
                          selected={false}
                          onPress={() => confirmSelectedRoutineAction(t)}
                        />
                        <Chip label="Cancel" selected={false} onPress={() => setConfirmRoutineAction(null)} />
                      </>
                    ) : (
                      <>
                        <Chip label="Use today" selected={false} onPress={() => requestRoutineAction('use', t.routineTemplateId)} />
                        <Chip label="Edit" selected={false} onPress={() => setEditingTemplate(t)} />
                        <Chip label="Delete" selected={false} onPress={() => requestRoutineAction('delete', t.routineTemplateId)} />
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
            {routineActionMessage !== null && (
              <Text style={styles.captionText}>{routineActionMessage}</Text>
            )}
            <PrimaryButton
              label="+ Build new routine template"
              onPress={() => setEditingTemplate('new')}
              accessibilityLabel="Build new routine template"
            />
          </View>
        </Disclosure>

        {program == null && (
        <View
          testID="manage-block-section"
          onLayout={(event) => { manageSectionOffsetY.current = event.nativeEvent.layout.y; }}
        >
        <Disclosure
          label="Manage block"
          hint={block === null ? 'Choose a structure for your first block' : 'Block settings and regeneration'}
          open={manageOpen}
          onOpenChange={setManageOpen}
        >
          <View style={styles.disclosureContent}>
            {block !== null ? (
              <Text style={styles.captionText}>
                {block.objective.replace(/_/g, ' ')} block, started {block.startDate}
                {blockMeta !== null
                  ? ` - ${blockMeta.schemaType} - macro block ${blockMeta.macroBlockIndex} of 8`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.captionText}>
                Coach will build from your objective, equipment, and weekly frequency.
              </Text>
            )}
            {blockMeta?.peakShifted === true && (
              <Text style={styles.peakShiftText}>
                Coach inserted a deload week before the peak because fatigue was high.
              </Text>
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
                    accessibilityLabel={`${SCHEMA_LABEL[type]} loading structure`}
                    style={[styles.schemaChip, selected && styles.schemaChipSelected]}
                  >
                    <Text style={[styles.schemaChipText, selected && styles.schemaChipTextSelected]}>
                      {SCHEMA_LABEL[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!confirmRegenerate ? (
              <PrimaryButton
                label={block === null ? 'Create four-week block' : 'Generate next block'}
                onPress={() => {
                  if (block === null) {
                    generateNewBlock(schema);
                    setManageOpen(false);
                  } else {
                    setConfirmRegenerate(true);
                  }
                }}
                accessibilityLabel={block === null ? 'Create four-week block' : 'Generate next block'}
              />
            ) : (
              <View style={styles.confirmation}>
                <Text style={styles.bodyText}>This archives the current block and starts the next one today.</Text>
                <PrimaryButton
                  label="Generate next block now"
                  onPress={() => {
                    setDetail(null);
                    generateNewBlock(schema);
                    setConfirmRegenerate(false);
                    setManageOpen(false);
                  }}
                  accessibilityLabel="Generate next block now"
                />
                <SecondaryButton label="Keep current block" onPress={() => setConfirmRegenerate(false)} accessibilityLabel="Keep current block" />
              </View>
            )}

            {(block === null || todayPlan === null) && !halted && session === null && (
              <Disclosure label="Start without a planned session">
                <View style={styles.disclosureContent}>
                  {!confirmUnplannedStart ? (
                    <>
                      <Text style={styles.captionText}>
                        This starts a session without the day's planned exercise order.
                      </Text>
                      <SecondaryButton
                        label="Start an unplanned session"
                        onPress={() => setConfirmUnplannedStart(true)}
                        accessibilityLabel="Start an unplanned session"
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.bodyText}>Start a session without a planned workout?</Text>
                      <PrimaryButton label="Start unplanned session" onPress={startUnplannedSession} accessibilityLabel="Start unplanned session" />
                      <SecondaryButton label="Cancel" onPress={() => setConfirmUnplannedStart(false)} accessibilityLabel="Cancel" />
                    </>
                  )}
                </View>
              </Disclosure>
            )}
          </View>
        </Disclosure>
        </View>
        )}

        <Disclosure
          label="Something feels off"
          hint="Add a subjective report only when you need Coach to adapt"
          open={reportOpen}
          onOpenChange={setReportOpen}
        >
          <View style={styles.disclosureContent}>
            {!triageReady && (
              <Text style={styles.captionText}>
                Semantic matching is unavailable in this build. Injury-language safety checks still apply.
              </Text>
            )}
            <TextInput
              style={styles.reportInput}
              value={reportText}
              onChangeText={setReportText}
              placeholder="For example: my knee feels sore when I squat"
              placeholderTextColor={theme.color.textLow}
              maxLength={500}
              multiline
              accessibilityLabel="Describe how your body feels today"
            />
            <Text style={styles.severityLabel}>Severity from 1 to 10</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((severity) => {
                const selected = reportSeverity === severity;
                return (
                  <Pressable
                    key={severity}
                    onPress={() => setReportSeverity(severity)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Severity ${severity} of 10`}
                    style={[
                      styles.severityChip,
                      selected && styles.severityChipSelected,
                    ]}
                  >
                    <Text style={[styles.severityText, selected && styles.severityTextSelected]}>{severity}</Text>
                  </Pressable>
                );
              })}
            </View>
            <PrimaryButton
              label={triaging ? 'Checking report' : 'Apply report'}
              disabled={reportText.trim().length === 0 || reportSeverity === null || triaging}
              onPress={() => {
                if (reportSeverity === null) return;
                void reportSubjective(reportText, reportSeverity).then(() => {
                  setReportText('');
                  setReportSeverity(null);
                });
              }}
              accessibilityLabel={triaging ? 'Checking report' : 'Apply report'}
            />

            {lastTriage !== null && lastTriage.kind === 'positive' && (
              <View style={styles.reportResult}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Noted</Text>
                </View>
                <Text style={styles.bodyText}>{lastTriage.cue}</Text>
              </View>
            )}
            {lastTriage !== null && lastTriage.kind === 'rejected' && (
              <View style={styles.reportResult}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>No change</Text>
                </View>
                <Text style={styles.captionText}>
                  Coach did not match this to a known scenario, so today's plan is unchanged.
                </Text>
              </View>
            )}
            {lastTriage !== null && lastTriage.kind === 'matched' && !lastTriage.directive.halt && (
              <View style={styles.reportResult}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Plan adjusted</Text>
                </View>
                <Text style={styles.bodyText}>{lastTriage.directive.vector.coaching_cue}</Text>
                {lastTriage.directive.followUp !== null && (
                  <Text style={styles.captionText}>{lastTriage.directive.followUp}</Text>
                )}
              </View>
            )}
          </View>
        </Disclosure>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  screenContent: {
    padding: theme.space[4],
    gap: theme.space[4],
    paddingBottom: theme.space[6],
  },
  center: {
    flex: 1,
    backgroundColor: theme.color.ink0,
    justifyContent: 'center',
    padding: theme.space[6],
  },
  header: {
    marginBottom: theme.space[2],
  },
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  cardTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  bodyText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  routineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[1],
    justifyContent: 'flex-end',
  },
  captionText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  followUpText: {
    ...theme.font.body,
    color: theme.color.textMid,
  },
  adjustedText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
  },
  statusBadgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  cardActionRow: {
    marginTop: theme.space[2],
    gap: theme.space[2],
  },
  section: {
    gap: theme.space[3],
  },
  sectionTitle: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  emptyTrajectory: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  weekContainer: {
    gap: theme.space[2],
  },
  weekRow: {
    minHeight: theme.touch.min,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.space[2],
  },
  weekMeta: {
    width: 78,
    justifyContent: 'center',
  },
  weekTitle: {
    ...theme.font.label,
    color: theme.color.textHi,
  },
  weekPhase: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    marginTop: theme.space[1],
  },
  dayRail: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.space[1],
  },
  dayMark: {
    flex: 1,
    minWidth: 0,
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.ink1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[1],
  },
  dayMarkPressed: {
    backgroundColor: theme.color.pressed,
  },
  dayMarkRest: {
    backgroundColor: 'transparent',
    borderColor: theme.color.line,
  },
  dayMarkFinalized: {
    borderColor: theme.color.line,
    backgroundColor: theme.color.ink1,
  },
  dayMarkToday: {
    borderColor: theme.color.chalk,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.chalk,
    backgroundColor: theme.color.ink1,
  },
  dayMarkExpanded: {
    borderColor: theme.color.textHi,
  },
  dayMarkText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
    textAlign: 'center',
  },
  dayMarkTextFinalized: {
    color: theme.color.textHi,
  },
  dayMarkTextToday: {
    color: theme.color.chalk,
  },
  dayMarkRestText: {
    ...theme.font.body,
    color: theme.color.line,
  },
  trajectoryHint: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    marginTop: theme.space[1],
  },
  sessionDetail: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[4],
    gap: theme.space[3],
  },
  sessionDetailTitle: {
    ...theme.font.cue,
    color: theme.color.textHi,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  slotMain: {
    flex: 1,
    gap: theme.space[1],
  },
  slotName: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  slotDetails: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  slotValue: {
    ...theme.font.label,
    color: theme.color.textHi,
  },
  slotTarget: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  attributionMarker: {
    ...theme.font.label,
    color: theme.color.textMid,
    paddingHorizontal: theme.space[1],
  },
  attributionText: {
    ...theme.font.label,
    color: theme.color.textMid,
    flex: 1,
  },
  blockAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginTop: theme.space[1],
  },
  disclosureContent: {
    gap: theme.space[3],
    paddingTop: theme.space[2],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space[1],
  },
  infoLabel: {
    ...theme.font.body,
    color: theme.color.textMid,
  },
  infoValue: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  profileNoteText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  peakShiftText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  schemaLabel: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  schemaRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  schemaChip: {
    flex: 1,
    minHeight: theme.touch.min,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.ink1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemaChipSelected: {
    borderColor: theme.color.textHi,
    backgroundColor: theme.color.textHi,
  },
  schemaChipText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  schemaChipTextSelected: {
    color: theme.color.ink0,
  },
  confirmation: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
    gap: theme.space[3],
  },
  reportInput: {
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
  severityLabel: {
    ...theme.font.label,
    color: theme.color.textHi,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  severityChip: {
    width: 44,
    minHeight: theme.touch.min,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.ink1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityChipSelected: {
    borderColor: theme.color.textHi,
    backgroundColor: theme.color.textHi,
  },
  severityText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  severityTextSelected: {
    color: theme.color.ink0,
  },
  reportResult: {
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    paddingTop: theme.space[3],
    gap: theme.space[2],
  },
  substitutedBadge: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    backgroundColor: theme.color.ink1,
  },
  substitutedBadgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
});
