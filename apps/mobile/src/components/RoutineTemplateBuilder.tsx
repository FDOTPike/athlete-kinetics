/**
 * RoutineTemplateBuilder.tsx — Athlete-facing routine template builder.
 *
 * Supports creating and editing durable routine templates, ordering slots,
 * choosing loading methods (Linear, Undulating, Step Loading, Autoregulated),
 * resolving movement availability via capabilityResolver verdicts, and
 * composing/freezing sessions into planned_session/planned_slot.
 */
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  composeRoutine,
  composeRoutineMicrocycle,
  contextualRoutineRoles,
  projectRoutineMajorRpe,
  rankRoutineAccessoryRecommendations,
  rankRoutineSupplementaryRecommendations,
  type MovementAvailability,
  type RoutineAccessoryRecommendation,
  type RoutineMicrocyclePrescription,
  type RoutineSupplementaryRecommendation,
  type RoutineRole,
  type SchemaType,
} from '@ak/inference';
import { formatTeachingOnlyReason, useStore, type Movement, type RoutineTemplate } from '../state/useStore';
import { theme } from '../theme/theme';
import {
  PrimaryButton,
  SecondaryButton,
  Chip,
} from './ui';

const SCHEMA_LABELS: Record<SchemaType, string> = {
  LINEAR: 'Linear',
  WAVE: 'Undulating',
  STEP: 'Step Loading',
  APRE: 'Autoregulated',
};

const SCHEMAS: SchemaType[] = ['LINEAR', 'WAVE', 'STEP', 'APRE'];

interface SlotItem {
  id: string;
  dayIndex: number;
  role: RoutineRole;
  movementId: number | null;
  sets?: number;
  reps?: number;
  targetRpe?: number;
}

interface PickerRow {
  movement: Movement;
  verdict: MovementAvailability | undefined;
  selectedElsewhere: boolean;
  executable: boolean;
  recommendation: (RoutineSupplementaryRecommendation | RoutineAccessoryRecommendation) | undefined;
}

interface RoutineTemplateBuilderProps {
  initialTemplate?: RoutineTemplate | null;
  onSaved?: (template: RoutineTemplate) => void;
  onCancel?: () => void;
}

export function RoutineTemplateBuilder({
  initialTemplate,
  onSaved,
  onCancel,
}: RoutineTemplateBuilderProps): React.JSX.Element {
  const profile = useStore((s) => s.profile);
  const movements = useStore((s) => s.movements);
  const niggles = useStore((s) => s.niggles);
  const movementAvailabilityRevision = useStore((s) => s.movementAvailabilityRevision);
  const activePriorExperienceMovementIds = useStore((s) => s.activePriorExperienceMovementIds);
  const saveRoutineTemplate = useStore((s) => s.saveRoutineTemplate);
  const confirmMovementPriorExperience = useStore((s) => s.confirmMovementPriorExperience);
  const revokeMovementPriorExperience = useStore((s) => s.revokeMovementPriorExperience);
  const getMovementAvailabilityVerdicts = useStore(
    (s) => s.getMovementAvailabilityVerdicts,
  );
  const getRoutineRoleEligibleMovementIds = useStore(
    (s) => s.getRoutineRoleEligibleMovementIds,
  );
  const getRoutinePlanningContract = useStore((s) => s.getRoutinePlanningContract);

  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [schemaType, setSchemaType] = useState<SchemaType>(
    initialTemplate?.schemaType ?? 'LINEAR',
  );

  // Default slots: 1 major, 2 supplementary, 0 conditional
  const [slots, setSlots] = useState<SlotItem[]>(() => {
    if (initialTemplate && initialTemplate.slots.length > 0) {
      return initialTemplate.slots.map((s, idx) => ({
        id: `slot-${idx}-${s.movementId}`,
        dayIndex: s.dayIndex,
        role: s.role,
        movementId: s.movementId,
        sets: s.sets,
        reps: s.reps,
        targetRpe: s.targetRpe,
      }));
    }
    return [
      { id: 'slot-0', dayIndex: 1, role: 'major', movementId: null },
      { id: 'slot-1', dayIndex: 1, role: 'supplementary', movementId: null },
      { id: 'slot-2', dayIndex: 1, role: 'supplementary', movementId: null },
    ];
  });

  const [activeDay, setActiveDay] = useState(() => initialTemplate?.slots[0]?.dayIndex ?? 1);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerView, setPickerView] = useState<'available' | 'all'>('available');
  const [errorText, setErrorText] = useState<string | null>(null);

  const verdicts: readonly MovementAvailability[] = useMemo(
    () => getMovementAvailabilityVerdicts('weight_room'),
    [getMovementAvailabilityVerdicts, movements, profile, niggles, movementAvailabilityRevision],
  );
  const verdictMap = useMemo(
    () => new Map<number, MovementAvailability>(verdicts.map((verdict) => [verdict.movementId, verdict])),
    [verdicts],
  );
  const roleEligibleIds = useMemo(
    () => getRoutineRoleEligibleMovementIds(),
    [getRoutineRoleEligibleMovementIds, movements],
  );
  const roleEligibleSets = useMemo(() => ({
    major: new Set(roleEligibleIds.major),
    supplementary: new Set(roleEligibleIds.supplementary),
    accessory: new Set(roleEligibleIds.accessory),
    conditional: new Set(roleEligibleIds.conditional),
  }), [roleEligibleIds]);
  const planningContract = useMemo(
    () => getRoutinePlanningContract(),
    [getRoutinePlanningContract, movements],
  );
  const availableSet = useMemo(
    () => new Set(verdicts.filter((verdict) => verdict.state === 'available').map((verdict) => verdict.movementId)),
    [verdicts],
  );

  const activeSlots = useMemo(() => slots
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot.dayIndex === activeDay), [activeDay, slots]);
  const activeMajorIds = useMemo(() => activeSlots
    .filter((entry): entry is { slot: SlotItem & { movementId: number }; index: number } =>
      entry.slot.role === 'major' && entry.slot.movementId !== null)
    .map((entry) => entry.slot.movementId), [activeSlots]);
  const selectedMajor = useMemo(() => {
    const majorId = activeMajorIds[0];
    return majorId === undefined ? undefined : movements.find((movement) => movement.movement_id === majorId);
  }, [activeMajorIds, movements]);

  const contextualRolesFor = (movementId: number): ReadonlySet<RoutineRole> => contextualRoutineRoles(
    movementId,
    activeMajorIds,
    planningContract.liftFamilies,
    planningContract.assistance,
    roleEligibleSets,
  );

  const supplementaryRecommendationMap = useMemo(() => {
    if (pickerSlotIndex === null || slots[pickerSlotIndex]?.role !== 'supplementary'
        || selectedMajor === undefined) {
      return new Map<number, RoutineSupplementaryRecommendation>();
    }
    const candidates = movements.filter((movement) =>
      contextualRolesFor(movement.movement_id).has('supplementary')
      && availableSet.has(movement.movement_id)
      && !slots.some((slot, index) => slot.dayIndex === activeDay
        && index !== pickerSlotIndex && slot.movementId === movement.movement_id));
    const recommendations = rankRoutineSupplementaryRecommendations(
      {
        movementId: selectedMajor.movement_id,
        name: selectedMajor.name,
        pattern: selectedMajor.pattern,
        targetMuscles: selectedMajor.targetMuscles,
        isCompound: selectedMajor.is_compound,
      },
      candidates.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
    );
    return new Map(recommendations.map((recommendation) => [recommendation.movementId, recommendation]));
  }, [activeDay, activeMajorIds, availableSet, movements, pickerSlotIndex,
    planningContract, roleEligibleSets, selectedMajor, slots]);

  const accessoryRecommendationMap = useMemo(() => {
    if (pickerSlotIndex === null || slots[pickerSlotIndex]?.role !== 'accessory'
        || activeMajorIds.length === 0) {
      return new Map<number, RoutineAccessoryRecommendation>();
    }
    const selectedMovementIds = activeSlots
      .map((entry) => entry.slot.movementId)
      .filter((movementId): movementId is number => movementId !== null);
    const positions = new Map<number, number>();
    const stressPreview = composeRoutineMicrocycle({
      selections: slots.flatMap((slot) => {
        if (slot.movementId === null) return [];
        const slotIndex = (positions.get(slot.dayIndex) ?? 0) + 1;
        positions.set(slot.dayIndex, slotIndex);
        return [{
          dayIndex: slot.dayIndex,
          slotIndex,
          movementId: slot.movementId,
          role: slot.role,
          sets: slot.sets,
          reps: slot.reps,
          targetRpe: slot.targetRpe,
        }];
      }),
      movements: movements.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
      liftFamilies: planningContract.liftFamilies,
      assistance: planningContract.assistance,
      roleEligibility: roleEligibleSets,
      schemaType,
      objective: profile.objective,
      trainingAge: profile.training_age,
      durationCapMin: profile.session_duration_cap_min,
      baseRpeCap: profile.base_rpe_cap,
      availableMovementIds: availableSet,
    });
    const activePrescriptions = stressPreview.prescriptions.filter((row) => row.dayIndex === activeDay);
    const activeComposedMinutes = activePrescriptions.reduce((sum, row) => {
      if (!row.included) return sum;
      if (row.role === 'major') return sum + 3 + row.sets * 2.5;
      if (row.role === 'supplementary') return sum + 2 + row.sets * 1.5;
      if (row.role === 'conditional') return sum + 1.5 + row.sets * 1.25;
      return sum + 1 + row.sets;
    }, 0);
    const alreadyConstrained = stressPreview.blockers.length > 0
      || activePrescriptions.some((row) => !row.included
        || row.adaptations.some((adaptation) => adaptation.startsWith('Dose bounded from')));
    const activeHeadroom = stressPreview.familyDecisions.flatMap((decision) => {
      const session = decision.sessions.find((candidate) => candidate.dayIndex === activeDay);
      return session === undefined ? [] : [Math.max(0, (session.budget - session.finalStress) / 5)];
    });
    const remainingFatigue = alreadyConstrained || activeHeadroom.length === 0
      ? 0
      : Math.min(5, ...activeHeadroom);
    const candidates = movements.filter((movement) =>
      contextualRolesFor(movement.movement_id).has('accessory')
      && availableSet.has(movement.movement_id));
    const recommendations = rankRoutineAccessoryRecommendations({
      majorMovementIds: activeMajorIds,
      selectedMovementIds,
      candidates: candidates.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
      allMovements: movements.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
      liftFamilies: planningContract.liftFamilies,
      assistance: planningContract.assistance,
      objective: profile.objective,
      remainingMinutes: Math.max(0, profile.session_duration_cap_min - activeComposedMinutes),
      remainingFatigue,
    });
    return new Map(recommendations.map((recommendation) => [recommendation.movementId, recommendation]));
  }, [activeDay, activeMajorIds, activeSlots, availableSet, movements, pickerSlotIndex,
    planningContract, profile.base_rpe_cap, profile.objective, profile.session_duration_cap_min,
    profile.training_age, roleEligibleSets, schemaType, slots]);

  const pickerRows = useMemo((): PickerRow[] => {
    if (pickerSlotIndex === null) return [];
    const pickerRole = slots[pickerSlotIndex]?.role ?? 'supplementary';
    const query = pickerSearch.trim().toLocaleLowerCase();
    const rows = movements
      // Role eligibility is the first predicate: non-role rows never reach the
      // virtualized picker or its counts.
      .filter((movement) => contextualRolesFor(movement.movement_id).has(pickerRole))
      .filter((movement) => query.length === 0 || [
        movement.name,
        movement.baseName,
        movement.pattern,
        movement.cues,
        ...movement.targetMuscles,
      ].some((value) => value.toLocaleLowerCase().includes(query)))
      .map((movement): PickerRow => {
        const verdict = verdictMap.get(movement.movement_id);
        const selectedElsewhere = slots.some((slot, index) => slot.dayIndex === activeDay
          && index !== pickerSlotIndex && slot.movementId === movement.movement_id);
        return {
          movement,
          verdict,
          selectedElsewhere,
          executable: verdict?.state === 'available' && !selectedElsewhere,
          recommendation: pickerRole === 'accessory'
            ? accessoryRecommendationMap.get(movement.movement_id)
            : supplementaryRecommendationMap.get(movement.movement_id),
        };
      })
      .sort((a, b) => Number(b.executable) - Number(a.executable)
        || (a.recommendation?.rank ?? Number.MAX_SAFE_INTEGER)
          - (b.recommendation?.rank ?? Number.MAX_SAFE_INTEGER)
        || a.movement.name.localeCompare(b.movement.name));
    return pickerView === 'available' ? rows.filter((row) => row.executable) : rows;
  }, [accessoryRecommendationMap, activeDay, activeMajorIds, movements, pickerSearch,
    pickerSlotIndex, pickerView, planningContract, roleEligibleSets, slots,
    supplementaryRecommendationMap, verdictMap]);

  const pickerCounts = useMemo(() => {
    if (pickerSlotIndex === null) return { available: 0, teaching: 0, total: 0 };
    const role = slots[pickerSlotIndex]?.role ?? 'supplementary';
    const query = pickerSearch.trim().toLocaleLowerCase();
    const rows = movements
      .filter((movement) => contextualRolesFor(movement.movement_id).has(role))
      .filter((movement) => query.length === 0 || [movement.name, movement.baseName,
        movement.pattern, movement.cues, ...movement.targetMuscles]
        .some((value) => value.toLocaleLowerCase().includes(query)));
    const available = rows.filter((movement) => {
      const selectedElsewhere = slots.some((slot, index) => slot.dayIndex === activeDay
        && index !== pickerSlotIndex && slot.movementId === movement.movement_id);
      return verdictMap.get(movement.movement_id)?.state === 'available' && !selectedElsewhere;
    }).length;
    const teaching = rows.filter((movement) =>
      verdictMap.get(movement.movement_id)?.state !== 'available').length;
    return { available, teaching, total: rows.length };
  }, [activeDay, activeMajorIds, movements, pickerSearch, pickerSlotIndex,
    planningContract, roleEligibleSets, slots, verdictMap]);

  const validSelections = slots.filter(
    (slot): slot is SlotItem & { movementId: number } => slot.movementId !== null,
  );
  const dayPositions = new Map<number, number>();
  const microcycleSelections = validSelections.map((slot) => {
    const slotIndex = (dayPositions.get(slot.dayIndex) ?? 0) + 1;
    dayPositions.set(slot.dayIndex, slotIndex);
    return {
      dayIndex: slot.dayIndex,
      slotIndex,
      movementId: slot.movementId,
      role: slot.role,
      sets: slot.sets,
      reps: slot.reps,
      targetRpe: slot.targetRpe,
    };
  });
  const composed = composeRoutineMicrocycle({
    selections: microcycleSelections,
    movements: movements.map((movement) => ({
      movementId: movement.movement_id,
      name: movement.name,
      pattern: movement.pattern,
      targetMuscles: movement.targetMuscles,
      isCompound: movement.is_compound,
    })),
    liftFamilies: planningContract.liftFamilies,
    assistance: planningContract.assistance,
    roleEligibility: roleEligibleSets,
    schemaType,
    objective: profile.objective,
    trainingAge: profile.training_age,
    durationCapMin: profile.session_duration_cap_min,
    baseRpeCap: profile.base_rpe_cap,
    availableMovementIds: availableSet,
  });
  const defaultBySlotId = new Map<string, RoutineMicrocyclePrescription>();
  for (const slot of validSelections) {
    const fallback = composeRoutine({
      selections: [slot],
      schemaType,
      objective: profile.objective,
      trainingAge: profile.training_age,
      durationCapMin: Math.max(profile.session_duration_cap_min, 66),
      baseRpeCap: profile.base_rpe_cap,
      availableMovementIds: availableSet,
    }).slots[0];
    if (fallback !== undefined) {
      defaultBySlotId.set(slot.id, {
        dayIndex: slot.dayIndex,
        sourceSlotIndex: 1,
        executionSlotIndex: 1,
        movementId: fallback.movementId,
        role: fallback.role,
        authoredSets: fallback.sets,
        authoredReps: fallback.reps,
        authoredTargetRpe: fallback.targetRpe,
        sets: fallback.sets,
        reps: fallback.reps,
        targetRpe: fallback.targetRpe,
        included: true,
        family: null,
        stressCoefficient: 0,
        purpose: null,
        equivalentVolume: 0,
        stressDose: 0,
        adaptations: [],
      });
    }
  }

  const addSlot = (role: RoutineRole): void => {
    setSlots([
      ...slots,
      { id: `slot-${Date.now()}-${slots.length}`, dayIndex: activeDay, role, movementId: null },
    ]);
  };

  const addTrainingDay = (): void => {
    const populated = new Set(slots.map((slot) => slot.dayIndex));
    const nextDay = [1, 2, 3, 4, 5, 6, 7].find((day) => !populated.has(day));
    if (nextDay === undefined) return;
    setSlots([...slots, {
      id: `slot-day-${nextDay}-${Date.now()}`, dayIndex: nextDay, role: 'major', movementId: null,
    }]);
    setActiveDay(nextDay);
  };

  const removeSlot = (index: number): void => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  const moveSlot = (index: number, direction: -1 | 1): void => {
    const activeIndices = slots
      .map((slot, slotIndex) => ({ slot, slotIndex }))
      .filter((entry) => entry.slot.dayIndex === activeDay)
      .map((entry) => entry.slotIndex);
    const activeIndex = activeIndices.indexOf(index);
    const destination = activeIndices[activeIndex + direction];
    if (destination === undefined) return;
    const updated = [...slots];
    [updated[index], updated[destination]] = [updated[destination], updated[index]];
    setSlots(updated);
  };

  const updateRole = (index: number, role: RoutineRole): void => {
    const updated = [...slots];
    const movementId = updated[index].movementId;
    updated[index] = {
      ...updated[index],
      role,
      movementId: movementId !== null && contextualRolesFor(movementId).has(role) ? movementId : null,
      ...(updated[index].role === role ? {} : { sets: undefined, reps: undefined, targetRpe: undefined }),
    };
    setErrorText(null);
    setSlots(updated);
  };

  const selectMovementForSlot = (movementId: number): void => {
    if (pickerSlotIndex === null) return;
    const updated = [...slots];
    updated[pickerSlotIndex] = {
      ...updated[pickerSlotIndex],
      movementId,
      sets: undefined,
      reps: undefined,
      targetRpe: undefined,
    };
    setSlots(updated);
    setPickerSlotIndex(null);
    setPickerSearch('');
    setPickerView('available');
  };

  const closePicker = (): void => {
    setPickerSlotIndex(null);
    setPickerSearch('');
    setPickerView('available');
  };

  const openPicker = (index: number): void => {
    setPickerSearch('');
    setPickerView('available');
    setPickerSlotIndex(index);
  };

  const requestPriorExperienceConfirmation = (movement: Movement): void => {
    Alert.alert(
      'Confirm prior experience?',
      'This is a local declaration of prior experience. It cannot override movement tier, equipment, active injuries or niggles, routine role, or required attestation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (!confirmMovementPriorExperience(movement.movement_id, 'weight_room')) {
              setErrorText('Prior experience could not clear every current access requirement.');
            }
          },
        },
      ],
    );
  };

  const requestPriorExperienceRevocation = (movement: Movement): void => {
    Alert.alert(
      'Revoke prior experience?',
      `${movement.name} will require capability evidence again. Saved templates remain stored but cannot be used while blocked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMovementPriorExperience(movement.movement_id) },
      ],
    );
  };

  const updateDose = (index: number, field: 'sets' | 'reps' | 'targetRpe', value: string): void => {
    const parsed = value.trim() === '' ? undefined : Number(value);
    if (parsed !== undefined && !Number.isFinite(parsed)) return;
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: parsed };
    setSlots(updated);
  };

  const handleSave = (): void => {
    setErrorText(null);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setErrorText('Template name must be between 1 and 80 characters.');
      return;
    }
    if (validSelections.length === 0) {
      setErrorText('Please select at least one movement for your routine template.');
      return;
    }
    const populatedDays = [...new Set(validSelections.map((selection) => selection.dayIndex))];
    const missingMajorDay = populatedDays.find((dayIndex) => !validSelections.some(
      (selection) => selection.dayIndex === dayIndex && selection.role === 'major',
    ));
    if (missingMajorDay !== undefined) {
      setErrorText(`Choose at least one major movement for day ${missingMajorDay}.`);
      return;
    }

    try {
      const saved = saveRoutineTemplate({
        routineTemplateId: initialTemplate?.routineTemplateId,
        name: trimmed,
        schemaType,
        slots: microcycleSelections,
      });
      onSaved?.(saved);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  };

  if (profile.training_age === 'beginner') {
    return (
      <View style={[styles.container, styles.lockedContainer]} testID="routine-builder-beginner-lock">
        <Text style={styles.title}>Standalone routines are locked</Text>
        <Text style={styles.lockedBody}>
          Generated training is available now. Standalone routine building unlocks after the Beginner stage.
        </Text>
        {onCancel !== undefined && (
          <SecondaryButton label="Back" onPress={onCancel} accessibilityLabel="Back from routine builder" />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {initialTemplate ? 'Edit Routine Template' : 'Build Routine Template'}
      </Text>

      {errorText !== null && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      )}

      {/* Template Name Input */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Template Name</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Heavy Upper Body"
          placeholderTextColor={theme.color.textLow}
          maxLength={80}
          accessibilityLabel="Routine template name"
        />
      </View>

      {/* Loading Method Selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Loading Method</Text>
        <View style={styles.schemaRow}>
          {SCHEMAS.map((st) => {
            const selected = st === schemaType;
            return (
              <Pressable
                key={st}
                onPress={() => {
                  setSchemaType(st);
                  setSlots((current) => current.map((slot) => ({
                    ...slot, sets: undefined, reps: undefined, targetRpe: undefined,
                  })));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${SCHEMA_LABELS[st]} loading method`}
                style={[
                  styles.schemaChip,
                  selected && styles.schemaChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.schemaChipText,
                    selected && styles.schemaChipTextSelected,
                  ]}
                >
                  {SCHEMA_LABELS[st]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Microcycle Days</Text>
        <View style={styles.pickerViewRow}>
          {[1, 2, 3, 4, 5, 6, 7]
            .filter((dayIndex) => dayIndex === activeDay || slots.some((slot) => slot.dayIndex === dayIndex))
            .map((dayIndex) => (
              <Chip
                key={dayIndex}
                label={`Day ${dayIndex}`}
                selected={dayIndex === activeDay}
                onPress={() => setActiveDay(dayIndex)}
              />
            ))}
          <Chip
            label="+ Training day"
            selected={false}
            disabled={new Set(slots.map((slot) => slot.dayIndex)).size >= 7}
            onPress={addTrainingDay}
          />
        </View>
        <Text style={styles.reasonText}>
          Major selection and weekly exposure are uncapped within the seven-day microcycle; the engine bounds dose and recovery burden.
        </Text>
      </View>

      {/* Session Slots Manager */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Day {activeDay} Ordered Movements ({activeSlots.length})</Text>

        {activeSlots.map(({ slot, index }, activeSlotIndex) => {
          const m = movements.find((item) => item.movement_id === slot.movementId);
          return (
            <View key={slot.id} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotIndexLabel}>Slot {activeSlotIndex + 1}</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    disabled={activeSlotIndex === 0}
                    onPress={() => moveSlot(index, -1)}
                    style={[styles.orderButton, activeSlotIndex === 0 && styles.orderButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move day ${activeDay} slot ${activeSlotIndex + 1} up`}
                  >
                    <Text style={styles.orderButtonText}>Up</Text>
                  </Pressable>
                  <Pressable
                    disabled={activeSlotIndex === activeSlots.length - 1}
                    onPress={() => moveSlot(index, 1)}
                    style={[styles.orderButton, activeSlotIndex === activeSlots.length - 1 && styles.orderButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move day ${activeDay} slot ${activeSlotIndex + 1} down`}
                  >
                    <Text style={styles.orderButtonText}>Down</Text>
                  </Pressable>
                  {(['major', 'supplementary', 'conditional', 'accessory'] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => updateRole(index, r)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: slot.role === r }}
                      accessibilityLabel={`Set day ${activeDay} slot ${activeSlotIndex + 1} role to ${r}`}
                      style={[
                        styles.roleChip,
                        slot.role === r && styles.roleChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          slot.role === r && styles.roleChipTextSelected,
                        ]}
                      >
                        {r.slice(0, 3).toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => removeSlot(index)}
                    style={styles.removeButton}
                    accessibilityLabel={`Remove day ${activeDay} slot ${activeSlotIndex + 1}`}
                  >
                    <Text style={styles.removeText}>X</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={() => openPicker(index)}
                style={styles.pickerButton}
                accessibilityRole="button"
                accessibilityLabel={`Select movement for day ${activeDay} slot ${activeSlotIndex + 1}`}
              >
                <Text style={styles.pickerButtonText}>
                  {m ? m.name : 'Select movement...'}
                </Text>
              </Pressable>
              {m !== undefined && (() => {
                const defaults = defaultBySlotId.get(slot.id);
                const peakRpe = slot.targetRpe ?? defaults?.targetRpe;
                const majorProjection = slot.role === 'major' && peakRpe !== undefined
                  ? projectRoutineMajorRpe(peakRpe, schemaType, profile.base_rpe_cap)
                  : undefined;
                return (
                  <View style={styles.doseGroup}>
                    <View style={styles.doseRow}>
                      <View style={styles.doseField}>
                        <Text style={styles.captionText}>Sets</Text>
                        <TextInput
                          style={styles.doseInput}
                          value={String(slot.sets ?? defaults?.sets ?? '')}
                          onChangeText={(value) => updateDose(index, 'sets', value)}
                          keyboardType="number-pad"
                          accessibilityLabel={`Sets for slot ${index + 1}`}
                        />
                      </View>
                      <View style={styles.doseField}>
                        <Text style={styles.captionText}>Reps</Text>
                        <TextInput
                          style={styles.doseInput}
                          value={String(slot.reps ?? defaults?.reps ?? '')}
                          onChangeText={(value) => updateDose(index, 'reps', value)}
                          keyboardType="number-pad"
                          accessibilityLabel={`Reps for slot ${index + 1}`}
                        />
                      </View>
                      {majorProjection !== undefined && (
                        <View style={styles.doseField}>
                          <Text style={styles.captionText}>RPE START</Text>
                          <View
                            style={[styles.doseInput, styles.projectedDose]}
                            accessible
                            accessibilityRole="text"
                            accessibilityLabel={`Projected starting RPE for day ${activeDay} slot ${activeSlotIndex + 1}: ${majorProjection.startRpe.toFixed(1)}`}
                          >
                            <Text style={styles.projectedDoseText}>{majorProjection.startRpe.toFixed(1)}</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.doseField}>
                        <Text style={styles.captionText}>{majorProjection === undefined ? 'RPE' : 'RPE MAX'}</Text>
                        <TextInput
                          style={styles.doseInput}
                          value={String(peakRpe ?? '')}
                          onChangeText={(value) => updateDose(index, 'targetRpe', value)}
                          keyboardType="decimal-pad"
                          accessibilityLabel={majorProjection === undefined
                            ? `Target RPE for slot ${index + 1}`
                            : `Maximum RPE for slot ${index + 1}`}
                        />
                      </View>
                    </View>
                    {majorProjection !== undefined && (
                      <Text style={styles.projectionNote} testID={`major-rpe-projection-note-${activeSlotIndex + 1}`}>
                        Projected loading range: RPE {majorProjection.startRpe.toFixed(1)} start to {majorProjection.maxRpe.toFixed(1)} max. Week 4 deloads to RPE {majorProjection.weekTargets[3].toFixed(1)}; readiness and autoregulation can lower the live target.
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>
          );
        })}

        {/* Add Slot Actions: accessory remains last because it depends on all chosen work. */}
        <View style={styles.addSlotRow}>
          <Text style={styles.captionText}>Add slot:</Text>
          <Chip label="+ Major" selected={false} onPress={() => addSlot('major')} />
          <Chip label="+ Supp" selected={false} onPress={() => addSlot('supplementary')} />
          <Chip label="+ Cond" selected={false} disabled={roleEligibleSets.conditional.size === 0} onPress={() => addSlot('conditional')} />
          <Chip label="+ Accessory last" selected={false} disabled={activeMajorIds.length === 0} onPress={() => addSlot('accessory')} />
        </View>
      </View>

      {/* Composition Preview */}
      {validSelections.length > 0 && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Complete Microcycle Stress Review</Text>
          {composed.blockers.map((blocker, i) => (
            <Text key={`blocker-${i}`} style={styles.errorText}>Blocked: {blocker}</Text>
          ))}
          {composed.warnings.map((warn, i) => (
            <Text key={`warning-${i}`} style={styles.warningText}>
              Warning: {warn}
            </Text>
          ))}
          {composed.recommendations.map((recommendation, i) => (
            <Text key={`recommendation-${i}`} style={styles.reasonText}>
              Recommendation: {recommendation}
            </Text>
          ))}
          {composed.familyDecisions.map((decision) => {
            const session = decision.sessions.find((candidate) => candidate.dayIndex === activeDay);
            return (
              <View key={decision.family} style={styles.suggestionNote} testID={`family-stress-${decision.family}`}>
                <Text style={styles.suggestionTitle}>
                  {decision.family.replace('_', ' ')}: week {decision.initialStress.toFixed(1)} → {decision.finalStress.toFixed(1)}/{decision.weeklyBudget.toFixed(1)} ({decision.level})
                </Text>
                <Text style={styles.reasonText}>
                  {decision.exposureCount} weekly exposure{decision.exposureCount === 1 ? '' : 's'} · {decision.variationCount} distinct variation{decision.variationCount === 1 ? '' : 's'} · {decision.equivalentVolume.toFixed(1)} weighted equivalent reps
                </Text>
                {session !== undefined && (
                  <Text style={styles.reasonText}>
                    Day {activeDay}: {session.initialStress.toFixed(1)} → {session.finalStress.toFixed(1)}/{session.budget.toFixed(1)} · one family exposure across {session.variationCount} variation{session.variationCount === 1 ? '' : 's'}
                  </Text>
                )}
                {decision.adaptations.map((adaptation, index) => (
                  <Text key={index} style={styles.warningText}>Adaptation: {adaptation}</Text>
                ))}
              </View>
            );
          })}
          <Text style={styles.previewTitle}>Day {activeDay} Prescription</Text>
          {composed.prescriptions.filter((s) => s.dayIndex === activeDay).map((s) => {
            const m = movements.find((item) => item.movement_id === s.movementId);
            const majorProjection = s.role === 'major'
              ? projectRoutineMajorRpe(s.targetRpe, schemaType, profile.base_rpe_cap)
              : undefined;
            return (
              <View key={`${s.dayIndex}:${s.sourceSlotIndex}`} style={styles.previewSlotRow}>
                <Text style={styles.previewSlotName}>{m?.name ?? `Movement ${s.movementId}`}</Text>
                <Text style={styles.previewSlotDose}>
                  {s.included ? `${s.sets} sets x ${s.reps} reps @ ` : 'OMITTED · '}{majorProjection === undefined
                    ? `RPE ${s.targetRpe.toFixed(1)}`
                    : `RPE ${majorProjection.startRpe.toFixed(1)} start / ${majorProjection.maxRpe.toFixed(1)} max`}
                  {s.family === null ? '' : ` · ${s.stressCoefficient.toFixed(2)}x · ${s.purpose?.replace('_', '-')}`}
                </Text>
                {s.adaptations.map((adaptation, index) => (
                  <Text key={index} style={styles.reasonText}>{adaptation}</Text>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Movement Picker Overlay */}
      <Modal
        visible={pickerSlotIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
        statusBarTranslucent
      >
        <View style={styles.pickerOverlay}>
          <View testID="movement-picker-card" style={styles.pickerCard}>
            <View style={styles.pickerHeaderRow}>
              <View>
                <Text style={styles.pickerTitle}>Choose Movement</Text>
                <Text style={styles.reasonText} accessibilityLabel={`${pickerCounts.available} available and ${pickerCounts.teaching} teaching only`}>
                  {pickerCounts.available} available · {pickerCounts.teaching} teaching only
                </Text>
              </View>
              <SecondaryButton label="Close" onPress={closePicker} accessibilityLabel="Close movement picker" />
            </View>
            <TextInput
              testID="movement-picker-search"
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Search name, pattern, cues, muscles"
              placeholderTextColor={theme.color.textLow}
              style={styles.textInput}
              accessibilityLabel="Search routine movements"
            />
            <View style={styles.pickerViewRow}>
              <Chip label={`Available (${pickerCounts.available})`} selected={pickerView === 'available'} onPress={() => setPickerView('available')} />
              <Chip label={`All / Learn (${pickerCounts.total})`} selected={pickerView === 'all'} onPress={() => setPickerView('all')} />
            </View>
            {selectedMajor !== undefined && supplementaryRecommendationMap.size > 0
              && pickerSlotIndex !== null && slots[pickerSlotIndex]?.role === 'supplementary' && (
              <View style={styles.suggestionNote} testID="supplementary-recommendation-note">
                <Text style={styles.suggestionTitle}>Top 3 for {selectedMajor.name}</Text>
                <Text style={styles.reasonText}>
                  Ranked only from supplementary movements currently available to this athlete.
                </Text>
              </View>
            )}
            {accessoryRecommendationMap.size > 0
              && pickerSlotIndex !== null && slots[pickerSlotIndex]?.role === 'accessory' && (
              <View style={styles.suggestionNote} testID="accessory-recommendation-note">
                <Text style={styles.suggestionTitle}>Accessories offered last</Text>
                <Text style={styles.reasonText}>
                  Ranked from uncovered stimulus, goal, current availability, duplication, time and remaining fatigue. Zero recommendations is valid.
                </Text>
              </View>
            )}
            <FlatList
              key={`movement-picker-${pickerSlotIndex ?? 'closed'}-${activeMajorIds.join('-') || 'none'}`}
              testID="movement-picker-list"
              style={styles.pickerList}
              data={pickerRows}
              keyExtractor={(row) => String(row.movement.movement_id)}
              initialNumToRender={14}
              maxToRenderPerBatch={18}
              windowSize={7}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={(
                <Text style={styles.emptyPickerText} accessibilityRole="text">
                  {pickerView === 'available'
                    ? 'No currently available movements match this role and search.'
                    : 'No movements match this role and search.'}
                </Text>
              )}
              renderItem={({ item: row }) => {
                const { movement, verdict, selectedElsewhere, executable, recommendation } = row;
                const canConfirm = !selectedElsewhere
                  && verdict?.state === 'teaching_only'
                  && verdict.confirmationWouldClear
                  && !verdict.separateAttestationRequired
                  && verdict.reasons.length === 1
                  && verdict.reasons[0] === 'capability';
                const confirmed = activePriorExperienceMovementIds.includes(movement.movement_id);
                const reason = selectedElsewhere
                  ? 'Already selected in another slot.'
                  : formatTeachingOnlyReason(verdict);
                return (
                  <View
                    testID={`movement-picker-row-${movement.movement_id}`}
                    style={[styles.pickerItem, !executable && styles.pickerItemDisabled]}
                  >
                    <Pressable
                      disabled={!executable}
                      onPress={() => selectMovementForSlot(movement.movement_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${movement.name}`}
                      accessibilityHint={executable ? `Available ${movement.difficulty} movement` : reason}
                      accessibilityState={{ disabled: !executable }}
                      style={styles.pickerItemMain}
                    >
                      <Text style={[styles.pickerItemName, !executable && styles.pickerItemNameDisabled]}>
                        {movement.name}
                      </Text>
                      {recommendation !== undefined && (
                        <Text
                          style={styles.suggestionBadgeText}
                          accessibilityLabel={`Suggested ${slots[pickerSlotIndex ?? 0]?.role ?? 'movement'} rank ${recommendation.rank}: ${recommendation.reason}`}
                        >
                          #{recommendation.rank} SUGGESTED · {recommendation.reason}
                        </Text>
                      )}
                      <Text style={styles.reasonText}>
                        {executable ? `${movement.difficulty} · Available` : reason}
                      </Text>
                    </Pressable>
                    {canConfirm && (
                      <Pressable
                        testID={`confirm-prior-experience-${movement.movement_id}`}
                        onPress={() => requestPriorExperienceConfirmation(movement)}
                        accessibilityRole="button"
                        accessibilityLabel={`Confirm prior experience for ${movement.name}`}
                        style={styles.declarationButton}
                      >
                        <Text style={styles.declarationButtonText}>CONFIRM PRIOR EXPERIENCE</Text>
                      </Pressable>
                    )}
                    {pickerView === 'all' && confirmed && (
                      <Pressable
                        testID={`revoke-prior-experience-${movement.movement_id}`}
                        onPress={() => requestPriorExperienceRevocation(movement)}
                        accessibilityRole="button"
                        accessibilityLabel={`Revoke prior experience for ${movement.name}`}
                        style={styles.declarationButton}
                      >
                        <Text style={styles.declarationButtonText}>REVOKE EXPERIENCE</Text>
                      </Pressable>
                    )}
                  </View>
                );
              }}
            />
            <SecondaryButton
              label="Close"
              onPress={closePicker}
              accessibilityLabel="Close movement picker"
            />
          </View>
        </View>
      </Modal>

      {/* Actions */}
      <View style={styles.actionRow}>
        <PrimaryButton
          label={initialTemplate ? 'Save Changes' : 'Save Routine Template'}
          onPress={handleSave}
          accessibilityLabel="Save routine template"
        />
        {onCancel && (
          <SecondaryButton
            label="Cancel"
            onPress={onCancel}
            accessibilityLabel="Cancel editing"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  content: {
    padding: theme.space[4],
    gap: theme.space[4],
  },
  lockedContainer: {
    padding: theme.space[5],
    justifyContent: 'center',
    gap: theme.space[4],
  },
  lockedBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 22,
  },
  title: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  errorCard: {
    backgroundColor: theme.color.ink1,
    borderColor: theme.color.textHi,
    borderWidth: 1,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
  },
  errorText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  label: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  textInput: {
    minHeight: theme.touch.min,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    backgroundColor: theme.color.ink1,
    color: theme.color.textHi,
    fontSize: theme.font.body.fontSize,
    paddingHorizontal: theme.space[3],
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
  slotCard: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
    gap: theme.space[2],
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotIndexLabel: {
    ...theme.font.label,
    color: theme.color.textHi,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  orderButton: {
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: theme.space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
  },
  orderButtonDisabled: {
    opacity: 0.35,
  },
  orderButtonText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  roleChip: {
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  roleChipSelected: {
    backgroundColor: theme.color.textHi,
    borderColor: theme.color.textHi,
  },
  roleChipText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
    fontSize: 10,
  },
  roleChipTextSelected: {
    color: theme.color.ink0,
  },
  removeButton: {
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
  },
  removeText: {
    ...theme.font.label,
    color: theme.color.textLow,
  },
  pickerButton: {
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    justifyContent: 'center',
    paddingHorizontal: theme.space[3],
    backgroundColor: theme.color.ink0,
  },
  pickerButtonText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  doseRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  doseGroup: {
    gap: theme.space[2],
  },
  doseField: {
    flex: 1,
    gap: theme.space[1],
  },
  doseInput: {
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.ink0,
    color: theme.color.textHi,
    textAlign: 'center',
    paddingHorizontal: theme.space[2],
  },
  projectedDose: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectedDoseText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  projectionNote: {
    ...theme.font.label,
    color: theme.color.textMid,
    lineHeight: 17,
  },
  addSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginTop: theme.space[1],
    flexWrap: 'wrap',
  },
  captionText: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  previewCard: {
    backgroundColor: theme.color.ink1,
    borderColor: theme.color.line,
    borderWidth: 1,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
    gap: theme.space[2],
  },
  previewTitle: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  warningText: {
    ...theme.font.label,
    color: theme.color.chalk,
  },
  previewSlotRow: {
    paddingVertical: theme.space[1],
    gap: theme.space[1],
  },
  previewSlotName: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  previewSlotDose: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: theme.space[4],
    justifyContent: 'center',
  },
  pickerCard: {
    backgroundColor: theme.color.ink1,
    borderColor: theme.color.line,
    borderWidth: 1,
    borderRadius: theme.radius.control,
    padding: theme.space[4],
    height: '80%',
    gap: theme.space[3],
  },
  pickerTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  pickerViewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  suggestionNote: {
    borderLeftWidth: 2,
    borderLeftColor: theme.color.textHi,
    paddingLeft: theme.space[2],
    gap: theme.space[1],
  },
  suggestionTitle: {
    ...theme.font.eyebrow,
    color: theme.color.textHi,
  },
  suggestionBadgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textHi,
    fontSize: 10,
  },
  pickerList: {
    flex: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
    gap: theme.space[2],
  },
  pickerItemDisabled: {
    opacity: 0.5,
  },
  pickerItemMain: {
    flex: 1,
    gap: 2,
    minHeight: theme.touch.min,
    justifyContent: 'center',
  },
  pickerItemName: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  pickerItemNameDisabled: {
    color: theme.color.textLow,
  },
  reasonText: {
    ...theme.font.label,
    color: theme.color.textLow,
    fontSize: 12,
  },
  badgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  declarationButton: {
    minHeight: 36,
    maxWidth: 132,
    paddingHorizontal: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declarationButtonText: {
    ...theme.font.eyebrow,
    color: theme.color.textHi,
    fontSize: 9,
    textAlign: 'center',
  },
  emptyPickerText: {
    ...theme.font.body,
    color: theme.color.textMid,
    paddingVertical: theme.space[5],
    textAlign: 'center',
  },
  actionRow: {
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
});
