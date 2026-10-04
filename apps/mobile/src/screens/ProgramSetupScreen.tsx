import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SCHEMA_TYPES, defaultProgramDayIndices, type SchemaType } from '@ak/inference';
import { Chip, PrimaryButton, SecondaryButton } from '../components/ui';
import { theme } from '../theme/theme';
import {
  useStore,
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
  const previewTrainingProgram = useStore((s) => s.previewTrainingProgram);
  const createTrainingProgram = useStore((s) => s.createTrainingProgram);
  const updateProgramPreferences = useStore((s) => s.updateProgramPreferences);
  const getVerdicts = useStore((s) => s.getMovementAvailabilityVerdicts);
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
  const [preferences, setPreferences] = useState<TrainingProgramMovementPreference[]>(() =>
    program?.movementPreferences ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const input = useMemo<TrainingProgramInput | null>(() => {
    if (horizonKind === null || schemaType === null || buildMode === null) return null;
    if (horizonKind === 'weeks' && blockCount === null) return null;
    if (horizonKind === 'date' && reviewDate.trim() === '') return null;
    return {
      horizon: horizonKind === 'weeks'
        ? { kind: 'weeks', blockCount: blockCount! }
        : { kind: 'date', requestedReviewDate: reviewDate.trim() },
      schemaType, dayIndices,
      movementPreferences: buildMode === 'custom' ? preferences : [],
    };
  }, [horizonKind, schemaType, buildMode, blockCount, reviewDate, dayIndices, preferences]);

  const previewResult = useMemo(() => {
    if (input === null) return { preview: null, error: null };
    try {
      return { preview: previewTrainingProgram(input), error: null };
    } catch (error) {
      return { preview: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [input, previewTrainingProgram]);

  const availableIds = useMemo(
    () => new Set(getVerdicts().filter((verdict) => verdict.state === 'available').map((v) => v.movementId)),
    [getVerdicts, profile, movements],
  );

  const toggleDay = (day: number): void => {
    setDayIndices((current) => current.includes(day)
      ? current.length === 1 ? current : current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b));
    setPreferences((current) => current.filter((preference) => preference.dayIndex !== day));
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{editing ? 'MANAGE PROGRAM' : 'BUILD YOUR PROGRAM'}</Text>
      <Text style={styles.title}>{profile.objective.replace('_', ' ')}</Text>
      <Text style={styles.body}>Four-week blocks stay intact. You choose when to review the goal.</Text>

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
          <Text style={styles.notice}>Normalized review boundary: {previewResult.preview.plannedEndDate}</Text>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Training method</Text>
        {profile.training_age === 'beginner' && (
          <Text style={styles.notice}>Linear is recommended: one clear progression is easiest to learn and review. You can change it.</Text>
        )}
        <View style={styles.wrap}>
          {SCHEMA_TYPES.map((method) => (
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
                const choices = movements.filter((item) => item.pattern === movement.pattern && availableIds.has(item.movement_id));
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
});
