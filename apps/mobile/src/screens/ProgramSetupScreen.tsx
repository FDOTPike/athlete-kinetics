import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  accessContextForBlockFocus,
  ANCHOR_MOVEMENT_NAMES,
  objectiveStyleLabel,
  powerObjectiveExplanation,
  SELECTABLE_SCHEMA_TYPES,
  defaultProgramDayIndices,
  programFocuses,
  splitExplainer,
  SPLIT_EXPLAINER_FOOTER,
  BLOCK_FOCUS_LIST,
  strengthAnchorCapacity,
  weeklyProgressionSummary,
  type BlockFocus,
  type SchemaType,
} from '@ak/inference';
import { Chip, PrimaryButton, SecondaryButton } from '../components/ui';
import { theme } from '../theme/theme';
import {
  useStore,
  type TrainingProgramDay,
  type TrainingProgramInput,
  type TrainingProgramMovementPreference,
} from '../state/useStore';

const SCHEMA_LABEL: Record<SchemaType, string> = {
  LINEAR: 'Linear', WAVE: 'Undulating', STEP: 'Step loading', APRE: 'Autoregulated',
};

const DAY_NAME = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

interface ProgramSetupScreenProps {
  editing?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function ProgramSetupScreen({
  editing = false, onComplete, onCancel,
}: ProgramSetupScreenProps): React.JSX.Element {
  const profile = useStore((s) => s.profile);
  const today = useStore((s) => s.today);
  const program = useStore((s) => s.program);
  const movements = useStore((s) => s.movements);
  const niggles = useStore((s) => s.niggles);
  const previewTrainingProgram = useStore((s) => s.previewTrainingProgram);
  const createTrainingProgram = useStore((s) => s.createTrainingProgram);
  const updateProgramPreferences = useStore((s) => s.updateProgramPreferences);
  const getVerdicts = useStore((s) => s.getMovementAvailabilityVerdicts);
  const movementAvailabilityRevision = useStore((s) => s.movementAvailabilityRevision);
  const confirmMovementPriorExperience = useStore((s) => s.confirmMovementPriorExperience);
  const activePriorExperienceMovementIds = useStore((s) => s.activePriorExperienceMovementIds);
  const storeError = useStore((s) => s.error);

  const initialFrequency = program?.days.length ?? profile.weekly_frequency;
  const [buildMode, setBuildMode] = useState<'coach' | 'custom' | null>(
    editing && (program?.movementPreferences.length ?? 0) > 0 ? 'custom' : editing ? 'coach' : null,
  );
  const [horizonKind, setHorizonKind] = useState<'weeks' | 'date' | null>(
    editing ? (program?.horizonKind ?? null) : null,
  );
  const [blockCount, setBlockCount] = useState<number | null>(
    editing ? (program?.plannedBlockCount ?? null) : null,
  );
  const [reviewDate, setReviewDate] = useState(program?.requestedReviewDate ?? '');
  const [schemaType, setSchemaType] = useState<SchemaType | null>(
    editing ? (program?.schemaType ?? null) : profile.training_age === 'beginner' ? 'LINEAR' : null,
  );
  const [dayIndices, setDayIndices] = useState<number[]>(() =>
    program?.days.map((day) => day.dayIndex) ?? [...defaultProgramDayIndices(initialFrequency)],
  );
  const [dayFocuses, setDayFocuses] = useState<Record<number, BlockFocus>>(() => {
    const initial: Record<number, BlockFocus> = {};
    if (program?.days && program.days.length > 0) {
      for (const d of program.days) {
        initial[d.dayIndex] = d.focus as BlockFocus;
      }
    } else {
      const defaultFocuses = programFocuses(profile.objective, initialFrequency);
      const defaults = defaultProgramDayIndices(initialFrequency);
      defaults.forEach((day, idx) => {
        initial[day] = defaultFocuses[idx] ?? 'full';
      });
    }
    return initial;
  });
  const [preferences, setPreferences] = useState<TrainingProgramMovementPreference[]>(() =>
    program?.movementPreferences ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const input = useMemo<TrainingProgramInput | null>(() => {
    if (horizonKind === null || schemaType === null || buildMode === null) return null;
    if (horizonKind === 'weeks' && blockCount === null) return null;
    if (horizonKind === 'date' && reviewDate.trim() === '') return null;
    const defaultFocuses = programFocuses(profile.objective, dayIndices.length);
    const days: TrainingProgramDay[] = dayIndices.map((dayIndex, i) => ({
      dayIndex,
      focus: dayFocuses[dayIndex] ?? defaultFocuses[i] ?? 'full',
    }));
    return {
      horizon: horizonKind === 'weeks'
        ? { kind: 'weeks', blockCount: blockCount! }
        : { kind: 'date', requestedReviewDate: reviewDate.trim() },
      schemaType,
      dayIndices,
      days,
      movementPreferences: buildMode === 'custom' ? preferences : [],
    };
  }, [horizonKind, schemaType, buildMode, blockCount, reviewDate, dayIndices, preferences, dayFocuses, profile.objective]);

  const previewResult = useMemo(() => {
    if (input === null) return { preview: null, error: null };
    try {
      return { preview: previewTrainingProgram(input), error: null };
    } catch (error) {
      return { preview: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [input, previewTrainingProgram]);

  const availableIdsByContext = useMemo(() => ({
    weight_room: new Set(getVerdicts('weight_room')
      .filter((verdict) => verdict.state === 'available').map((v) => v.movementId)),
    sport_conditioning: new Set(getVerdicts('sport_conditioning')
      .filter((verdict) => verdict.state === 'available').map((v) => v.movementId)),
  }), [getVerdicts, movementAvailabilityRevision, profile, movements, niggles]);

  const toggleDay = (day: number): void => {
    const nextDays = dayIndices.includes(day)
      ? (dayIndices.length === 1 ? dayIndices : dayIndices.filter((value) => value !== day))
      : [...dayIndices, day].sort((a, b) => a - b);
    setDayIndices(nextDays);
    setPreferences((current) => current.filter((preference) => preference.dayIndex !== day));
    setDayFocuses((current) => {
      const updated = { ...current };
      const defaultFocuses = programFocuses(profile.objective, nextDays.length);
      nextDays.forEach((d, idx) => {
        if (!updated[d]) {
          updated[d] = defaultFocuses[idx] ?? 'full';
        }
      });
      return updated;
    });
  };

  const setDayFocus = (dayIndex: number, focus: BlockFocus): void => {
    setDayFocuses((current) => ({
      ...current,
      [dayIndex]: focus,
    }));
  };

  const chooseMovement = (dayIndex: number, slotIndex: number, pattern: TrainingProgramMovementPreference['pattern'], movementId: number): void => {
    setPreferences((current) => [
      ...current.filter((item) => !(item.dayIndex === dayIndex && item.slotIndex === slotIndex)),
      { dayIndex, slotIndex, pattern, movementId },
    ]);
  };

  const confirm = (): void => {
    if (input === null || previewResult.preview === null) {
      setLocalError(previewResult.error ?? 'Finish each choice before continuing.');
      return;
    }
    setLocalError(null);
    const saved = editing ? updateProgramPreferences(input) : createTrainingProgram(input);
    if (saved) onComplete?.();
  };

  const weekOne = previewResult.preview?.plan.sessions.filter((session) => session.week_index === 1) ?? [];

  // --- W3 disclosures: honest style, capacity, anchor coverage -------------
  // The athlete-facing style is the goal's honest meaning (WO §2.2), shown
  // beside the raw persisted objective so the label can never silently
  // misrepresent the split actually scheduled.
  const styleLabel = objectiveStyleLabel(profile.objective);
  // R1 (Round 2, ledger 0060): the POWER explanation. Athletic power is
  // explosive-force work — the coach plans fast, speed-purpose rungs of the
  // big lifts (the curated 'speed' rows) and keeps every gate intact. The
  // copy states the tier law plainly: olympic-lift competition movements are
  // Advanced-tier and appear only for athletes whose tier admits them.
  const powerExplanation = profile.objective === 'power';
  // Strength anchor capacity (WO §2.5), Round 2 R4: the disclosed number is
  // the PURE shaped-slot calculation (squat / horizontal-push / hinge slots
  // after the duration and focus shaping), not a raw day-count heuristic.
  // Fewer than three anchor-capable slots cannot carry the big three.
  const anchorCapacity = useMemo(() => strengthAnchorCapacity(
    profile, programFocuses, defaultProgramDayIndices,
  ), [profile.objective, profile.weekly_frequency, profile.session_duration_cap_min]);
  const strengthCapacityShort = profile.objective === 'strength' && anchorCapacity < 3;
  // Anchor coverage for strength: which of the big three are gated-available
  // this week, which are blocked (with reasons), and whether a local
  // prior-experience declaration would clear an ordinary capability gap
  // (shared verdict: capability is the ONLY blocker and confirmationWouldClear).
  const anchorCoverage = useMemo(() => {
    if (profile.objective !== 'strength') return [];
    return ANCHOR_MOVEMENT_NAMES.map((name) => {
      const movement = movements.find((m) => m.name === name);
      if (movement === undefined) {
        return { name, state: 'missing_from_library' as const, confirmWouldClear: false, reasons: [] as string[], movementId: -1, confirmed: false };
      }
      const verdict = getVerdicts('weight_room').find((v) => v.movementId === movement.movement_id);
      const reasons = verdict?.reasons ?? [];
      const confirmWouldClear = (verdict?.state === 'teaching_only'
        && verdict.confirmationWouldClear
        && !verdict.separateAttestationRequired
        && verdict.reasons.length === 1
        && verdict.reasons[0] === 'capability');
      const confirmed = activePriorExperienceMovementIds.includes(movement.movement_id);
      return {
        name,
        movementId: movement.movement_id,
        state: verdict?.state === 'available' || confirmed ? ('available' as const) : ('blocked' as const),
        confirmWouldClear: confirmWouldClear && !confirmed,
        reasons,
        confirmed,
      };
    });
  }, [profile.objective, profile, movements, getVerdicts, movementAvailabilityRevision, activePriorExperienceMovementIds, niggles]);

  // Ranking decisions from the generated preview: anchor substitutions and
  // reasoned bodyweight fallbacks surface verbatim in the preview card.
  const rankingNotes = previewResult.preview?.plan.warnings.filter((w) =>
    w.includes('unavailable for') || w.includes('no loaded')) ?? [];

  // R3 (Round 2, ledger 0060): the weekly progression summary rendered in the
  // ACTUAL preview. The pure classifier explains the week-1 -> 2 and
  // week-3 -> 4 (deload) changes for every representative slot of the
  // generated plan — the same function the evidence harness prints.
  const progressionSummary = useMemo(() => {
    if (previewResult.preview === null) return [];
    const bodyweightNames = new Set((movements ?? [])
      .filter((m) => (m.supportedPrefixes ?? []).length === 1 && m.supportedPrefixes[0] === 'Bodyweight')
      .map((m) => m.movement_id));
    return weeklyProgressionSummary(
      previewResult.preview.plan,
      (movementId) => {
        const m = (movements ?? []).find((item) => item.movement_id === movementId);
        return m ? { name: m.name, bodyweight: bodyweightNames.has(m.movement_id) } : undefined;
      },
    );
  }, [previewResult.preview, movements]);

  // First unmet requirement for enabling Create program, in the order the form
  // asks for them. Rendered next to the disabled button so the rule is never
  // enforced invisibly.
  const missingRequirement = useMemo<string | null>(() => {
    if (buildMode === null) return 'Choose who selects movements.';
    if (horizonKind === null) return 'Choose when you want to review the program.';
    if (horizonKind === 'weeks' && blockCount === null) return 'Choose a program duration.';
    if (horizonKind === 'date' && reviewDate.trim() === '') return 'Enter a review date.';
    if (schemaType === null) return 'Choose a progression method.';
    return null;
  }, [buildMode, horizonKind, blockCount, reviewDate, schemaType]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{editing ? 'MANAGE PROGRAM' : 'BUILD YOUR PROGRAM'}</Text>
      <Text style={styles.title}>{styleLabel}</Text>
      <Text style={styles.body}>
        Goal: {profile.objective.replace('_', ' ')} — {styleLabel}. Four-week blocks stay intact. You choose when to review the goal.
      </Text>

      {powerExplanation && (
        <View style={styles.card} testID="power-explanation-card">
          <Text style={styles.sectionTitle}>How athletic power works here</Text>
          <Text style={styles.notice}>
            {powerObjectiveExplanation('power', profile.training_age)}
          </Text>
          {profile.training_age !== 'beginner' && (
            <Text style={styles.caption}>
              Fast barbell, kettlebell and jump-style alternatives are planned until your training
              history supports the competition olympic lifts.
            </Text>
          )}
        </View>
      )}

      {strengthCapacityShort && (
        <View style={styles.card} testID="strength-capacity-warning">
          <Text style={styles.sectionTitle}>Not enough training days for the big three</Text>
          <Text style={styles.notice}>
            Big-lift strength needs three squat, push and hinge slots a week to carry the big three.
            Your plan shapes to {anchorCapacity} anchor slot{anchorCapacity === 1 ? '' : 's'} — with{' '}
            {dayIndices.length} session{dayIndices.length === 1 ? '' : 's'} at up to{' '}
            {profile.session_duration_cap_min} minutes, the plan cannot include every main lift.
            It will not silently promise powerlifting and skip one.
          </Text>
          <Text style={styles.caption}>Add training days or session time above, or continue with a reduced-anchor plan.</Text>
        </View>
      )}

      {anchorCoverage.length > 0 && (
        <View style={styles.card} testID="anchor-coverage-card">
          <Text style={styles.sectionTitle}>Big-lift availability</Text>
          {anchorCoverage.map((anchor) => (
            <View key={anchor.name} style={styles.anchorRow}>
              <Text style={styles.anchorName}>
                {anchor.name}: {anchor.state === 'available' ? 'ready' : anchor.state === 'missing_from_library' ? 'not in your library' : 'blocked'}
              </Text>
              {anchor.state === 'blocked' && anchor.reasons.length > 0 && (
                <Text style={styles.caption}>{anchor.reasons.join(', ')}</Text>
              )}
              {anchor.confirmWouldClear && (
                <>
                  <Text style={styles.caption}>
                    You can declare you have trained this lift before — a local statement about your own
                    history, not a coaching assessment.
                  </Text>
                  <Chip
                    label={`I have trained ${anchor.name} before`}
                    selected={false}
                    onPress={() => confirmMovementPriorExperience(anchor.movementId, 'weight_room')}
                    testID={`anchor-confirm-${anchor.movementId}`}
                  />
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Who chooses movements?</Text>
        <View style={styles.row}>
          <Chip label="Coach build" selected={buildMode === 'coach'} onPress={() => setBuildMode('coach')} />
          <Chip label="Customize" selected={buildMode === 'custom'} onPress={() => setBuildMode('custom')} />
        </View>
        <Text style={styles.caption}>Customize changes movements only. Sets, reps and RPE stay coach-controlled.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Review horizon</Text>
        <View style={styles.row}>
          <Chip label="Duration" selected={horizonKind === 'weeks'} onPress={() => setHorizonKind('weeks')} />
          <Chip label="Date" selected={horizonKind === 'date'} onPress={() => setHorizonKind('date')} />
        </View>
        {horizonKind === 'weeks' && (
          <View style={styles.wrap}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <Chip key={count} label={`${count * 4} wk`} selected={blockCount === count} onPress={() => setBlockCount(count)} />
            ))}
          </View>
        )}
        {horizonKind === 'date' && (
          <TextInput value={reviewDate} onChangeText={setReviewDate} placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textLow} style={styles.input} autoCapitalize="none" />
        )}
        {previewResult.preview !== null && (
          <>
            <Text style={styles.notice}>
              Normalized review boundary: {previewResult.preview.plannedEndDate}
              {' '}({previewResult.preview.plannedBlockCount} × 4-week block
              {previewResult.preview.plannedBlockCount === 1 ? '' : 's'})
            </Text>
            {/* R3 (REVIEW_BOUNDARY, ratified 2026-08-22): blocks are whole
                4-week units, so the boundary rounds UP to the next whole block
                and can sit up to 27 days after the date entered. The date is a
                planning checkpoint only — it does not schedule a peak or a
                competition, and nothing about the training phases is derived
                from it. Disclosing both is required by the ratified contract. */}
            {horizonKind === 'date' && (
              <Text style={styles.caption}>
                Blocks are whole 4-week units, so this rounds up to the next full block and can fall
                up to 27 days after the date you chose. It is a review checkpoint, not a competition
                date — your training phases are not scheduled around it.
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Training days</Text>
        <Text style={styles.caption}>Day 1 is today. These days repeat every week.</Text>
        <View style={styles.wrap}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip key={day} label={DAY_NAME[day - 1]} selected={dayIndices.includes(day)} onPress={() => toggleDay(day)} />
          ))}
        </View>

        {/* Split explainer */}
        <View style={styles.explainerBox}>
          <Text style={styles.explainerText}>
            {splitExplainer(profile.objective, dayIndices.length)}
          </Text>
          <Text style={styles.explainerFooter}>{SPLIT_EXPLAINER_FOOTER}</Text>
        </View>

        {/* Day rows with focus chips */}
        <View style={styles.dayRowsContainer}>
          {dayIndices.map((dayIndex) => {
            const currentFocus = dayFocuses[dayIndex] ?? programFocuses(profile.objective, dayIndices.length)[dayIndices.indexOf(dayIndex)] ?? 'full';
            return (
              <View key={dayIndex} style={styles.dayRow}>
                <Text style={styles.dayRowTitle}>{DAY_NAME[dayIndex - 1]}</Text>
                <View style={styles.focusChipRow}>
                  {BLOCK_FOCUS_LIST.map((focus) => (
                    <Chip
                      key={focus}
                      label={focus}
                      selected={currentFocus === focus}
                      onPress={() => setDayFocus(dayIndex, focus)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Training method</Text>
        {profile.training_age === 'beginner' && (
          <Text style={styles.notice}>Linear is recommended: one clear progression is easiest to learn and review. You can change it.</Text>
        )}
        <View style={styles.wrap}>
          {SELECTABLE_SCHEMA_TYPES.map((method) => (
            <Chip key={method} label={SCHEMA_LABEL[method]} selected={schemaType === method} onPress={() => setSchemaType(method)} />
          ))}
        </View>
      </View>

      {buildMode === 'custom' && weekOne.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Customize generated week</Text>
          {weekOne.map((session) => (
            <View key={session.day_index} style={styles.session}>
              <Text style={styles.sessionTitle}>Day {session.day_index} · {session.focus}</Text>
              {session.slots.map((slot) => {
                const movement = movements.find((item) => item.movement_id === slot.movement_id);
                if (movement === undefined) return null;
                const selectedId = preferences.find((item) =>
                  item.dayIndex === session.day_index && item.slotIndex === slot.slot_index)?.movementId ?? slot.movement_id;
                const accessContext = accessContextForBlockFocus(session.focus as BlockFocus);
                const choices = movements.filter((item) => item.pattern === movement.pattern
                  && availableIdsByContext[accessContext].has(item.movement_id));
                return (
                  <View key={slot.slot_index} style={styles.slot}>
                    <Text style={styles.slotTitle}>{movement.pattern.replace('_', ' ')}</Text>
                    <View style={styles.wrap}>
                      {choices.map((choice) => (
                        <Chip key={choice.movement_id} label={choice.name} selected={selectedId === choice.movement_id}
                          onPress={() => chooseMovement(session.day_index, slot.slot_index, movement.pattern as TrainingProgramMovementPreference['pattern'], choice.movement_id)} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {(localError ?? previewResult.error ?? storeError) !== null && (
        <Text style={styles.error}>{localError ?? previewResult.error ?? storeError}</Text>
      )}
      {progressionSummary.length > 0 && (
        <View style={styles.card} testID="weekly-progression-summary">
          <Text style={styles.sectionTitle}>How the weeks progress</Text>
          {progressionSummary.map((line, index) => (
            <Text key={`${index}:${line}`} style={styles.caption}>{line}</Text>
          ))}
        </View>
      )}
      {rankingNotes.length > 0 && (
        <View style={styles.card} testID="ranking-notes-card">
          <Text style={styles.sectionTitle}>Coach decisions in this plan</Text>
          {rankingNotes.map((note) => (
            <Text key={note} style={styles.caption}>{note}</Text>
          ))}
        </View>
      )}
      {missingRequirement !== null && (
        <Text style={styles.caption} accessibilityLiveRegion="polite">
          {missingRequirement}
        </Text>
      )}
      <PrimaryButton label={editing ? 'Save future preferences' : 'Create program'} onPress={confirm}
        disabled={input === null || previewResult.preview === null} />
      {onCancel !== undefined && <SecondaryButton label="Cancel" onPress={onCancel} />}
      <Text style={styles.caption}>Program starts {today}. Future blocks require confirmation.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[5], paddingBottom: 56, gap: theme.space[4] },
  eyebrow: { color: theme.color.textLow, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.color.textHi, fontSize: 30, fontWeight: '800', textTransform: 'capitalize' },
  body: { color: theme.color.textMid, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, padding: theme.space[4], gap: theme.space[3] },
  sectionTitle: { color: theme.color.textHi, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caption: { color: theme.color.textLow, fontSize: 12, lineHeight: 18 },
  notice: { color: theme.color.textMid, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.color.line, color: theme.color.textHi, paddingHorizontal: 12, fontSize: 16 },
  session: { borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: 12, gap: 10 },
  sessionTitle: { color: theme.color.textHi, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  slot: { gap: 6 },
  slotTitle: { color: theme.color.textMid, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  error: { color: theme.color.textHi, borderLeftWidth: 3, borderLeftColor: theme.color.textHi, paddingLeft: 10 },
  explainerBox: {
    marginTop: theme.space[2],
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    gap: 4,
  },
  explainerText: {
    color: theme.color.textHi,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  explainerFooter: {
    color: theme.color.textLow,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  dayRowsContainer: {
    marginTop: theme.space[2],
    gap: theme.space[3],
  },
  dayRow: {
    paddingTop: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    gap: 6,
  },
  dayRowTitle: {
    color: theme.color.textHi,
    fontSize: 14,
    fontWeight: '700',
  },
  focusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  anchorRow: {
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  anchorName: {
    color: theme.color.textHi,
    fontSize: 13,
    fontWeight: '700',
  },
});
