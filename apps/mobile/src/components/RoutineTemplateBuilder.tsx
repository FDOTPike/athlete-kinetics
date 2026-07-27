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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  composeRoutine,
  type MovementAvailability,
  type RoutineRole,
  type SchemaType,
} from '@ak/inference';
import { useStore, type RoutineTemplate } from '../state/useStore';
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
  role: RoutineRole;
  movementId: number | null;
  sets?: number;
  reps?: number;
  targetRpe?: number;
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
  const saveRoutineTemplate = useStore((s) => s.saveRoutineTemplate);
  const getMovementAvailabilityVerdicts = useStore(
    (s) => s.getMovementAvailabilityVerdicts,
  );
  const getRoutineRoleEligibleMovementIds = useStore(
    (s) => s.getRoutineRoleEligibleMovementIds,
  );

  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [schemaType, setSchemaType] = useState<SchemaType>(
    initialTemplate?.schemaType ?? 'LINEAR',
  );

  // Default slots: 1 major, 2 supplementary, 0 conditional
  const [slots, setSlots] = useState<SlotItem[]>(() => {
    if (initialTemplate && initialTemplate.slots.length > 0) {
      return initialTemplate.slots.map((s, idx) => ({
        id: `slot-${idx}-${s.movementId}`,
        role: s.role,
        movementId: s.movementId,
        sets: s.sets,
        reps: s.reps,
        targetRpe: s.targetRpe,
      }));
    }
    return [
      { id: 'slot-0', role: 'major', movementId: null },
      { id: 'slot-1', role: 'supplementary', movementId: null },
      { id: 'slot-2', role: 'supplementary', movementId: null },
    ];
  });

  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const verdicts: readonly MovementAvailability[] = useMemo(
    () => getMovementAvailabilityVerdicts(),
    [getMovementAvailabilityVerdicts, movements, profile, niggles],
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
    conditional: new Set(roleEligibleIds.conditional),
  }), [roleEligibleIds]);
  const availableSet = useMemo(
    () => new Set(verdicts.filter((verdict) => verdict.state === 'available').map((verdict) => verdict.movementId)),
    [verdicts],
  );

  // Live routine composition preview
  const validSelections = slots.filter(
    (slot): slot is SlotItem & { movementId: number } => slot.movementId !== null,
  );

  const composed = composeRoutine({
    selections: validSelections,
    schemaType,
    objective: profile.objective,
    trainingAge: profile.training_age,
    durationCapMin: profile.session_duration_cap_min,
    baseRpeCap: profile.base_rpe_cap,
    availableMovementIds: availableSet,
  });
  const defaultComposition = composeRoutine({
    selections: validSelections,
    schemaType,
    objective: profile.objective,
    trainingAge: profile.training_age,
    durationCapMin: Math.max(profile.session_duration_cap_min, 66),
    baseRpeCap: profile.base_rpe_cap,
    availableMovementIds: availableSet,
  });

  const roleMaxima: Record<RoutineRole, number> = { major: 1, supplementary: 2, conditional: 3 };
  const roleCount = (role: RoutineRole): number => slots.filter((slot) => slot.role === role).length;

  const addSlot = (role: RoutineRole): void => {
    if (slots.length >= 6 || roleCount(role) >= roleMaxima[role]) return;
    setSlots([
      ...slots,
      { id: `slot-${Date.now()}-${Math.random()}`, role, movementId: null },
    ]);
  };

  const removeSlot = (index: number): void => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  const moveSlot = (index: number, direction: -1 | 1): void => {
    const destination = index + direction;
    if (destination < 0 || destination >= slots.length) return;
    const updated = [...slots];
    [updated[index], updated[destination]] = [updated[destination], updated[index]];
    setSlots(updated);
  };

  const updateRole = (index: number, role: RoutineRole): void => {
    if (slots[index].role !== role && roleCount(role) >= roleMaxima[role]) {
      setErrorText(`A routine supports at most ${roleMaxima[role]} ${role} movement${roleMaxima[role] === 1 ? '' : 's'}.`);
      return;
    }
    const updated = [...slots];
    const movementId = updated[index].movementId;
    updated[index] = {
      ...updated[index],
      role,
      movementId: movementId !== null && roleEligibleSets[role].has(movementId) ? movementId : null,
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
    if (validSelections.filter((selection) => selection.role === 'major').length !== 1) {
      setErrorText('Choose exactly one major movement.');
      return;
    }

    try {
      const saved = saveRoutineTemplate({
        routineTemplateId: initialTemplate?.routineTemplateId,
        name: trimmed,
        schemaType,
        slots: validSelections.map((s, idx) => ({
          dayIndex: 1,
          slotIndex: idx + 1,
          role: s.role,
          movementId: s.movementId,
          sets: s.sets,
          reps: s.reps,
          targetRpe: s.targetRpe,
        })),
      });
      onSaved?.(saved);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  };

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

      {/* Session Slots Manager */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ordered Movements ({slots.length}/6)</Text>

        {slots.map((slot, index) => {
          const m = movements.find((item) => item.movement_id === slot.movementId);
          return (
            <View key={slot.id} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotIndexLabel}>Slot {index + 1}</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    disabled={index === 0}
                    onPress={() => moveSlot(index, -1)}
                    style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move slot ${index + 1} up`}
                  >
                    <Text style={styles.orderButtonText}>Up</Text>
                  </Pressable>
                  <Pressable
                    disabled={index === slots.length - 1}
                    onPress={() => moveSlot(index, 1)}
                    style={[styles.orderButton, index === slots.length - 1 && styles.orderButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`Move slot ${index + 1} down`}
                  >
                    <Text style={styles.orderButtonText}>Down</Text>
                  </Pressable>
                  {(['major', 'supplementary', 'conditional'] as const).map((r) => (
                    <Pressable
                      key={r}
                      disabled={slot.role !== r && roleCount(r) >= roleMaxima[r]}
                      onPress={() => updateRole(index, r)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: slot.role === r, disabled: slot.role !== r && roleCount(r) >= roleMaxima[r] }}
                      accessibilityLabel={`Set slot ${index + 1} role to ${r}`}
                      style={[
                        styles.roleChip,
                        slot.role === r && styles.roleChipSelected,
                        slot.role !== r && roleCount(r) >= roleMaxima[r] && styles.orderButtonDisabled,
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
                    accessibilityLabel={`Remove slot ${index + 1}`}
                  >
                    <Text style={styles.removeText}>X</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={() => setPickerSlotIndex(index)}
                style={styles.pickerButton}
                accessibilityRole="button"
                accessibilityLabel={`Select movement for slot ${index + 1}`}
              >
                <Text style={styles.pickerButtonText}>
                  {m ? m.name : 'Select movement...'}
                </Text>
              </Pressable>
              {m !== undefined && (() => {
                const defaults = defaultComposition.slots.find((candidate) => candidate.movementId === m.movement_id);
                return (
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
                    <View style={styles.doseField}>
                      <Text style={styles.captionText}>RPE</Text>
                      <TextInput
                        style={styles.doseInput}
                        value={String(slot.targetRpe ?? defaults?.targetRpe ?? '')}
                        onChangeText={(value) => updateDose(index, 'targetRpe', value)}
                        keyboardType="decimal-pad"
                        accessibilityLabel={`Target RPE for slot ${index + 1}`}
                      />
                    </View>
                  </View>
                );
              })()}
            </View>
          );
        })}

        {/* Add Slot Actions */}
        {slots.length < 6 && (
          <View style={styles.addSlotRow}>
            <Text style={styles.captionText}>Add slot:</Text>
            <Chip label="+ Major" selected={false} disabled={roleCount('major') >= roleMaxima.major} onPress={() => addSlot('major')} />
            <Chip label="+ Supp" selected={false} disabled={roleCount('supplementary') >= roleMaxima.supplementary} onPress={() => addSlot('supplementary')} />
            <Chip label="+ Cond" selected={false} disabled={roleCount('conditional') >= roleMaxima.conditional} onPress={() => addSlot('conditional')} />
          </View>
        )}
      </View>

      {/* Composition Preview */}
      {composed.slots.length > 0 && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Prescription Preview</Text>
          {composed.warnings.map((warn, i) => (
            <Text key={i} style={styles.warningText}>
              Warning: {warn}
            </Text>
          ))}
          {composed.slots.map((s) => {
            const m = movements.find((item) => item.movement_id === s.movementId);
            const authored = slots.find((slot) => slot.movementId === s.movementId);
            const sets = authored?.sets ?? s.sets;
            const reps = authored?.reps ?? s.reps;
            const targetRpe = authored?.targetRpe ?? s.targetRpe;
            return (
              <View key={s.slotIndex} style={styles.previewSlotRow}>
                <Text style={styles.previewSlotName}>{m?.name ?? `Movement ${s.movementId}`}</Text>
                <Text style={styles.previewSlotDose}>
                  {sets} sets x {reps} reps @ RPE {targetRpe.toFixed(1)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Movement Picker Overlay */}
      {pickerSlotIndex !== null && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose Movement</Text>
            <ScrollView style={styles.pickerList}>
              {movements.map((m) => {
                const verdict = verdictMap.get(m.movement_id);
                const pickerRole = slots[pickerSlotIndex]?.role ?? 'supplementary';
                const roleEligible = roleEligibleSets[pickerRole].has(m.movement_id);
                const selectedElsewhere = slots.some((slot, index) =>
                  index !== pickerSlotIndex && slot.movementId === m.movement_id);
                const isAvailable = verdict?.state === 'available' && roleEligible && !selectedElsewhere;
                const reasons = [
                  ...(verdict?.reasons ?? []),
                  ...(!roleEligible ? [`not ratified for ${pickerRole}`] : []),
                  ...(selectedElsewhere ? ['already selected'] : []),
                ];
                return (
                  <Pressable
                    key={m.movement_id}
                    disabled={!isAvailable}
                    onPress={() => selectMovementForSlot(m.movement_id)}
                    style={[
                      styles.pickerItem,
                      !isAvailable && styles.pickerItemDisabled,
                    ]}
                  >
                    <View style={styles.pickerItemMain}>
                      <Text
                        style={[
                          styles.pickerItemName,
                          !isAvailable && styles.pickerItemNameDisabled,
                        ]}
                      >
                        {m.name}
                      </Text>
                      {!isAvailable && (
                        <Text style={styles.reasonText}>
                          Teaching only ({reasons.join(', ')})
                        </Text>
                      )}
                    </View>
                    <Text style={styles.badgeText}>
                      {isAvailable ? 'Available' : 'Teaching Only'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <SecondaryButton
              label="Close"
              onPress={() => setPickerSlotIndex(null)}
              accessibilityLabel="Close movement picker"
            />
          </View>
        </View>
      )}

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
  addSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginTop: theme.space[1],
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.space[1],
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
    maxHeight: '80%',
    gap: theme.space[3],
  },
  pickerTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
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
  },
  pickerItemDisabled: {
    opacity: 0.5,
  },
  pickerItemMain: {
    flex: 1,
    gap: 2,
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
  actionRow: {
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
});
