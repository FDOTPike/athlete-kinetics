/**
 * WarmupPresetsPanel — athlete-authored GPP, weakness prehab, and physio/rehab
 * warm-up preset builder and session-type default assignment panel (WO-WARMUP-02).
 *
 * UI Laws:
 *   - Zero hex literals (theme tokens only).
 *   - Selected chips = inverted white fill (Chip primitive).
 *   - Zero traffic-light semantics.
 *   - Touch targets >= 56pt, Dynamic Type wrap-friendly flex layout.
 *   - Copy strictly from WARMUP_COPY (WP-01..WP-20) and ratified @ak/inference exports.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  CUE_NOTE_MAX_LEN,
  CUSTOM_DRILL_TITLE_MAX_LEN,
  DEFAULT_INCLUDE_RAMP_SETS,
  DEFAULT_PRESET_DOSE_REPS,
  DEFAULT_PRESET_DOSE_SECONDS,
  DEFAULT_PRESET_ITEM_SETS,
  MAX_WARMUP_PRESET_ITEMS,
  PREHAB_DISCLAIMER,
  PREHAB_STOP_RULE,
  PREHAB_TARGETS,
  PREHAB_TARGET_LABEL,
  PREPARATION_CATALOG_DRILLS,
  PREPARATION_HELD_MOVEMENT_IDS,
  PRESET_DOSE_REPS_MAX,
  PRESET_DOSE_REPS_MIN,
  PRESET_DOSE_SECONDS_MAX,
  PRESET_DOSE_SECONDS_MIN,
  PRESET_ITEM_SETS_MAX,
  PRESET_ITEM_SETS_MIN,
  PRESET_NAME_MAX_LEN,
  WARMUP_COPY,
  WARMUP_PURPOSES,
  WARMUP_PURPOSE_LABEL,
  WARMUP_SESSION_TYPES,
  WARMUP_WEAKNESS_TARGETS,
  formatPresetItemDose,
  validateWarmupPresetDraft,
  weaknessTargetLabel,
  type PrehabTarget,
  type WarmupDoseKind,
  type WarmupPreset,
  type WarmupPresetDraft,
  type WarmupPresetItemDraft,
  type WarmupPurpose,
  type WarmupWeaknessTarget,
} from '@ak/inference';
import { useSubViewBack } from '../navigation/navigation';
import { useStore, type Movement } from '../state/useStore';
import { theme } from '../theme/theme';
import { Chip, PrimaryButton, SecondaryButton, Stepper } from './ui';

const PATTERN_LABELS: Record<string, string> = {
  push_h: 'Horizontal Press',
  pull_h: 'Horizontal Pull',
  push_v: 'Vertical Press',
  pull_v: 'Vertical Pull',
  squat: 'Squat Pattern',
  hinge: 'Hinge Pattern',
  lunge: 'Lunge / Single Leg',
  carry: 'Carry & Conditioning',
  isolation: 'Isolation & Arms',
  rotation: 'Core & Trunk Stability',
  locomotion: 'Locomotion & Conditioning',
};

type SourceTab = 'built_in' | 'library' | 'custom';

function resolvePrehabMovementId(target: PrehabTarget, movements: readonly Movement[]): number | null {
  for (const candidate of target.movements) {
    const lowerName = candidate.name.trim().toLowerCase();
    const matched = movements.find((m) => m.name.trim().toLowerCase() === lowerName);
    if (matched !== undefined) return matched.movement_id;
  }
  return null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function WarmupPresetsPanel(): React.JSX.Element | null {
  const ready = useStore((s) => s.status === 'ready');
  const warmupPresets = useStore((s) => s.warmupPresets);
  const warmupSessionTypeAssignments = useStore((s) => s.warmupSessionTypeAssignments) ?? {};
  const movements = useStore((s) => s.movements) ?? [];
  const getMovementAvailabilityVerdicts = useStore((s) => s.getMovementAvailabilityVerdicts);
  const saveWarmupPreset = useStore((s) => s.saveWarmupPreset);
  const deleteWarmupPreset = useStore((s) => s.deleteWarmupPreset);
  const setWarmupSessionTypeAssignment = useStore((s) => s.setWarmupSessionTypeAssignment);

  const [expanded, setExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [presetName, setPresetName] = useState('');
  const [purpose, setPurpose] = useState<WarmupPurpose>('gpp');
  const [weaknessTarget, setWeaknessTarget] = useState<WarmupWeaknessTarget | null>(null);
  const [includeRampSets, setIncludeRampSets] = useState<boolean>(DEFAULT_INCLUDE_RAMP_SETS);
  const [draftItems, setDraftItems] = useState<WarmupPresetItemDraft[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [sourceTab, setSourceTab] = useState<SourceTab>('built_in');
  const [selectedBuiltIn, setSelectedBuiltIn] = useState<
    | { kind: 'drill'; drillId: string }
    | { kind: 'prehab'; targetId: PrehabTarget['id'] }
    | null
  >({ kind: 'drill', drillId: PREPARATION_CATALOG_DRILLS[0]!.itemId });
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');

  const [itemSets, setItemSets] = useState<number>(DEFAULT_PRESET_ITEM_SETS);
  const [itemDoseKind, setItemDoseKind] = useState<WarmupDoseKind>('reps');
  const [itemDoseAmount, setItemDoseAmount] = useState<number>(DEFAULT_PRESET_DOSE_REPS);
  const [itemPerSide, setItemPerSide] = useState<boolean>(false);
  const [itemCueNote, setItemCueNote] = useState<string>('');

  const cancelEditor = (): void => {
    setEditorOpen(false);
    setEditingPresetId(null);
    setEditorError(null);
  };

  useSubViewBack(editorOpen, cancelEditor);

  const eligibleMovements = useMemo(() => {
    let availableIds: Set<number> | null = null;
    if (typeof getMovementAvailabilityVerdicts === 'function') {
      try {
        const verdicts = getMovementAvailabilityVerdicts('weight_room');
        if (Array.isArray(verdicts) && verdicts.length > 0) {
          availableIds = new Set(
            verdicts.filter((v) => v.state === 'available').map((v) => v.movementId),
          );
        }
      } catch {
        availableIds = null;
      }
    }
    return movements.filter(
      (m) => !PREPARATION_HELD_MOVEMENT_IDS.has(m.movement_id)
        && (availableIds === null || availableIds.has(m.movement_id)),
    );
  }, [movements, getMovementAvailabilityVerdicts]);

  const availablePatterns = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const m of eligibleMovements) {
      if (!seen.has(m.pattern)) {
        seen.add(m.pattern);
        list.push(m.pattern);
      }
    }
    return list;
  }, [eligibleMovements]);

  const filteredMovements = useMemo(
    () => (selectedPattern === null
      ? eligibleMovements
      : eligibleMovements.filter((m) => m.pattern === selectedPattern)),
    [eligibleMovements, selectedPattern],
  );

  // Guard for partial store states in component tests.
  if (!ready || typeof saveWarmupPreset !== 'function' || !Array.isArray(warmupPresets)) {
    return null;
  }

  const resetItemBuilder = (): void => {
    setItemSets(DEFAULT_PRESET_ITEM_SETS);
    setItemDoseKind('reps');
    setItemDoseAmount(DEFAULT_PRESET_DOSE_REPS);
    setItemPerSide(false);
    setItemCueNote('');
    setCustomName('');
  };

  const applyDrillDoseDefaults = (drillId: string): void => {
    const drill = PREPARATION_CATALOG_DRILLS.find((d) => d.itemId === drillId);
    if (drill === undefined) return;
    setItemSets(DEFAULT_PRESET_ITEM_SETS);
    if (drill.dose.kind === 'time') {
      setItemDoseKind('time');
      setItemDoseAmount(clampInt(drill.dose.seconds, PRESET_DOSE_SECONDS_MIN, PRESET_DOSE_SECONDS_MAX));
      setItemPerSide(drill.dose.perSide);
    } else if (drill.dose.kind === 'reps') {
      setItemDoseKind('reps');
      setItemDoseAmount(clampInt(drill.dose.reps, PRESET_DOSE_REPS_MIN, PRESET_DOSE_REPS_MAX));
      setItemPerSide(drill.dose.perSide);
    }
  };

  const openNewPreset = (): void => {
    setConfirmDeleteId(null);
    setEditingPresetId(null);
    setPresetName('');
    setPurpose('gpp');
    setWeaknessTarget(null);
    setIncludeRampSets(DEFAULT_INCLUDE_RAMP_SETS);
    setDraftItems([]);
    setEditorError(null);
    setSourceTab('built_in');
    const firstDrill = PREPARATION_CATALOG_DRILLS[0]!;
    setSelectedBuiltIn({ kind: 'drill', drillId: firstDrill.itemId });
    setSelectedPattern(null);
    setSelectedMovementId(null);
    resetItemBuilder();
    applyDrillDoseDefaults(firstDrill.itemId);
    setEditorOpen(true);
  };

  const openEditPreset = (preset: WarmupPreset): void => {
    setConfirmDeleteId(null);
    setEditingPresetId(preset.presetId);
    setPresetName(preset.name);
    setPurpose(preset.purpose);
    setWeaknessTarget(preset.weaknessTarget);
    setIncludeRampSets(preset.includeRampSets);
    setDraftItems(preset.items.map((it, index) => ({ ...it, itemOrder: index })));
    setEditorError(null);
    setSourceTab('built_in');
    const firstDrill = PREPARATION_CATALOG_DRILLS[0]!;
    setSelectedBuiltIn({ kind: 'drill', drillId: firstDrill.itemId });
    setSelectedPattern(null);
    setSelectedMovementId(null);
    resetItemBuilder();
    applyDrillDoseDefaults(firstDrill.itemId);
    setEditorOpen(true);
  };

  const handleDoseKindChange = (kind: WarmupDoseKind): void => {
    if (kind === itemDoseKind) return;
    setItemDoseKind(kind);
    setItemDoseAmount(kind === 'time' ? DEFAULT_PRESET_DOSE_SECONDS : DEFAULT_PRESET_DOSE_REPS);
  };

  const stepDoseAmount = (direction: -1 | 1): void => {
    if (itemDoseKind === 'reps') {
      setItemDoseAmount((prev) => clampInt(prev + direction, PRESET_DOSE_REPS_MIN, PRESET_DOSE_REPS_MAX));
      return;
    }
    setItemDoseAmount((prev) => {
      const step = direction > 0 ? (prev >= 120 ? 30 : 5) : (prev > 120 ? 30 : 5);
      return clampInt(prev + direction * step, PRESET_DOSE_SECONDS_MIN, PRESET_DOSE_SECONDS_MAX);
    });
  };

  const handleAddItem = (): void => {
    setEditorError(null);
    if (draftItems.length >= MAX_WARMUP_PRESET_ITEMS) {
      setEditorError(WARMUP_COPY['WP-17'].itemCap);
      return;
    }
    const cueTrimmed = itemCueNote.trim();
    const cueNote = cueTrimmed.length > 0 ? cueTrimmed.slice(0, CUE_NOTE_MAX_LEN) : null;

    let newItem: WarmupPresetItemDraft | null = null;
    if (sourceTab === 'built_in') {
      if (selectedBuiltIn === null) return;
      if (selectedBuiltIn.kind === 'drill') {
        const drill = PREPARATION_CATALOG_DRILLS.find((d) => d.itemId === selectedBuiltIn.drillId);
        if (drill === undefined) return;
        newItem = {
          itemOrder: draftItems.length,
          sourceKind: 'catalog_drill',
          catalogDrillId: drill.itemId,
          prehabTargetId: null,
          movementId: null,
          title: drill.title,
          sets: itemSets,
          doseKind: itemDoseKind,
          doseAmount: itemDoseAmount,
          perSide: itemPerSide,
          cueNote,
        };
      } else {
        const target = PREHAB_TARGETS.find((t) => t.id === selectedBuiltIn.targetId);
        if (target === undefined) return;
        newItem = {
          itemOrder: draftItems.length,
          sourceKind: 'prehab_target',
          catalogDrillId: null,
          prehabTargetId: target.id,
          movementId: resolvePrehabMovementId(target, movements),
          title: PREHAB_TARGET_LABEL[target.id],
          sets: itemSets,
          doseKind: itemDoseKind,
          doseAmount: itemDoseAmount,
          perSide: itemPerSide,
          cueNote,
        };
      }
    } else if (sourceTab === 'library') {
      const movement = eligibleMovements.find((m) => m.movement_id === selectedMovementId);
      if (movement === undefined) return;
      newItem = {
        itemOrder: draftItems.length,
        sourceKind: 'library_movement',
        catalogDrillId: null,
        prehabTargetId: null,
        movementId: movement.movement_id,
        title: movement.name,
        sets: itemSets,
        doseKind: itemDoseKind,
        doseAmount: itemDoseAmount,
        perSide: itemPerSide,
        cueNote,
      };
    } else {
      const title = customName.trim();
      if (title.length === 0) {
        setEditorError(WARMUP_COPY['WP-17'].missingCustomTitle);
        return;
      }
      newItem = {
        itemOrder: draftItems.length,
        sourceKind: 'custom_physio',
        catalogDrillId: null,
        prehabTargetId: null,
        movementId: null,
        title,
        sets: itemSets,
        doseKind: itemDoseKind,
        doseAmount: itemDoseAmount,
        perSide: itemPerSide,
        cueNote,
      };
    }

    setDraftItems((prev) => [...prev, newItem!].map((entry, idx) => ({ ...entry, itemOrder: idx })));
    setItemCueNote('');
    if (sourceTab === 'custom') setCustomName('');
  };

  const moveDraftItem = (index: number, delta: -1 | 1): void => {
    const target = index + delta;
    if (target < 0 || target >= draftItems.length) return;
    setDraftItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved!);
      return copy.map((entry, idx) => ({ ...entry, itemOrder: idx }));
    });
  };

  const removeDraftItem = (index: number): void => {
    setDraftItems((prev) =>
      prev.filter((_, idx) => idx !== index).map((entry, idx) => ({ ...entry, itemOrder: idx })),
    );
  };

  const handleSavePreset = (): void => {
    const draft: WarmupPresetDraft = {
      name: presetName,
      purpose,
      weaknessTarget,
      includeRampSets,
      items: draftItems,
    };
    const validation = validateWarmupPresetDraft(draft, warmupPresets.length, editingPresetId !== null);
    if (!validation.ok) {
      setEditorError(validation.error);
      return;
    }
    const ok = saveWarmupPreset(validation.value, editingPresetId);
    if (!ok) {
      setEditorError(useStore.getState().error ?? WARMUP_COPY['WP-17'].presetCap);
      return;
    }
    cancelEditor();
  };

  const selectedPrehabTarget = sourceTab === 'built_in' && selectedBuiltIn?.kind === 'prehab'
    ? PREHAB_TARGETS.find((t) => t.id === selectedBuiltIn.targetId) ?? null
    : null;

  return (
    <View style={styles.panel} testID="warmup-presets-panel">
      <Text style={styles.heading} accessibilityRole="header">{WARMUP_COPY['WP-01']}</Text>
      <Text style={styles.dim}>{WARMUP_COPY['WP-02']}</Text>
      <SecondaryButton
        fullWidth
        label={expanded ? WARMUP_COPY['WP-03'].hide : WARMUP_COPY['WP-03'].manage}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityLabel={expanded ? WARMUP_COPY['WP-03'].hide : WARMUP_COPY['WP-03'].manage}
        testID="warmup-presets-toggle"
      />

      {expanded && (
        <View style={styles.section}>
          {warmupPresets.length === 0 ? (
            <Text style={styles.dim} testID="warmup-presets-empty">{WARMUP_COPY['WP-04']}</Text>
          ) : (
            <View style={styles.list}>
              {warmupPresets.map((preset) => (
                <View key={preset.presetId} style={styles.card} testID={`warmup-preset-row-${preset.presetId}`}>
                  <Text style={styles.cardTitle}>{preset.name}</Text>
                  <Text style={styles.dim}>{WARMUP_PURPOSE_LABEL[preset.purpose]}</Text>
                  {preset.weaknessTarget !== null && (
                    <Text style={styles.dim}>{weaknessTargetLabel(preset.weaknessTarget)}</Text>
                  )}
                  <Text style={styles.meta}>{WARMUP_COPY['WP-11'](preset.items.length)}</Text>
                  {preset.items.map((it) => (
                    <Text key={`${preset.presetId}-${it.itemOrder}`} style={styles.dim}>
                      {`${it.title} · ${formatPresetItemDose(it)}`}
                    </Text>
                  ))}
                  {confirmDeleteId === preset.presetId ? (
                    <View style={styles.actions}>
                      <PrimaryButton
                        label={WARMUP_COPY['WP-05'].confirmDelete}
                        onPress={() => {
                          deleteWarmupPreset(preset.presetId);
                          if (editingPresetId === preset.presetId) cancelEditor();
                          setConfirmDeleteId(null);
                        }}
                        accessibilityLabel={`${WARMUP_COPY['WP-05'].confirmDelete} ${preset.name}`}
                        testID={`warmup-preset-confirm-delete-${preset.presetId}`}
                      />
                      <SecondaryButton
                        fullWidth
                        label={WARMUP_COPY['WP-05'].keepPreset}
                        onPress={() => setConfirmDeleteId(null)}
                        accessibilityLabel={`${WARMUP_COPY['WP-05'].keepPreset} ${preset.name}`}
                        testID={`warmup-preset-keep-${preset.presetId}`}
                      />
                    </View>
                  ) : (
                    <View style={styles.actionsRow}>
                      <SecondaryButton
                        label={WARMUP_COPY['WP-05'].edit}
                        onPress={() => openEditPreset(preset)}
                        accessibilityLabel={`${WARMUP_COPY['WP-05'].edit} ${preset.name}`}
                        testID={`warmup-preset-edit-${preset.presetId}`}
                      />
                      <SecondaryButton
                        label={WARMUP_COPY['WP-05'].delete}
                        onPress={() => setConfirmDeleteId(preset.presetId)}
                        accessibilityLabel={`${WARMUP_COPY['WP-05'].delete} ${preset.name}`}
                        testID={`warmup-preset-delete-${preset.presetId}`}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {!editorOpen && (
            <PrimaryButton
              label={WARMUP_COPY['WP-05'].newPreset}
              onPress={openNewPreset}
              accessibilityLabel={WARMUP_COPY['WP-05'].newPreset}
              testID="warmup-preset-new"
            />
          )}

          {editorOpen && (
            <View style={styles.editor} testID="warmup-preset-editor">
              <Text style={styles.label}>{WARMUP_COPY['WP-06'].label}</Text>
              <TextInput
                disableFullscreenUI
                style={styles.input}
                value={presetName}
                onChangeText={setPresetName}
                maxLength={PRESET_NAME_MAX_LEN}
                placeholder={WARMUP_COPY['WP-06'].placeholder}
                placeholderTextColor={theme.color.textLow}
                accessibilityLabel={WARMUP_COPY['WP-06'].label}
                testID="warmup-preset-name-input"
              />

              <Text style={styles.label}>{WARMUP_COPY['WP-07'].label}</Text>
              <View style={styles.chipWrap}>
                {WARMUP_PURPOSES.map((p) => (
                  <Chip
                    key={p}
                    wrap
                    label={WARMUP_PURPOSE_LABEL[p]}
                    selected={purpose === p}
                    onPress={() => setPurpose(p)}
                    testID={`warmup-purpose-${p}`}
                  />
                ))}
              </View>

              <Text style={styles.label}>{WARMUP_COPY['WP-08'].label}</Text>
              <View style={styles.chipWrap}>
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-08'].none}
                  selected={weaknessTarget === null}
                  onPress={() => setWeaknessTarget(null)}
                  testID="warmup-weakness-none"
                />
                {WARMUP_WEAKNESS_TARGETS.map((target) => (
                  <Chip
                    key={target}
                    wrap
                    label={weaknessTargetLabel(target)}
                    selected={weaknessTarget === target}
                    onPress={() => setWeaknessTarget(target)}
                    testID={`warmup-weakness-${target}`}
                  />
                ))}
              </View>

              <Chip
                wrap
                label={WARMUP_COPY['WP-10'].label}
                selected={includeRampSets}
                onPress={() => setIncludeRampSets((prev) => !prev)}
                testID="warmup-include-ramp-toggle"
              />
              <Text style={styles.dim}>{WARMUP_COPY['WP-10'].caption}</Text>

              <Text style={styles.heading} testID="warmup-items-heading">
                {WARMUP_COPY['WP-11'](draftItems.length)}
              </Text>
              {draftItems.map((draftItem, index) => (
                <View key={`${draftItem.sourceKind}-${index}`} style={styles.itemCard} testID={`warmup-draft-item-${index}`}>
                  <Text style={styles.body}>{draftItem.title}</Text>
                  <Text style={styles.dim}>{formatPresetItemDose(draftItem)}</Text>
                  {draftItem.cueNote !== null && <Text style={styles.dim}>{draftItem.cueNote}</Text>}
                  <View style={styles.actionsRow}>
                    <SecondaryButton
                      label={WARMUP_COPY['WP-15'].moveUp}
                      disabled={index === 0}
                      onPress={() => moveDraftItem(index, -1)}
                      accessibilityLabel={`${WARMUP_COPY['WP-15'].moveUp} ${draftItem.title}`}
                      testID={`warmup-item-up-${index}`}
                    />
                    <SecondaryButton
                      label={WARMUP_COPY['WP-15'].moveDown}
                      disabled={index === draftItems.length - 1}
                      onPress={() => moveDraftItem(index, 1)}
                      accessibilityLabel={`${WARMUP_COPY['WP-15'].moveDown} ${draftItem.title}`}
                      testID={`warmup-item-down-${index}`}
                    />
                    <SecondaryButton
                      label={WARMUP_COPY['WP-15'].remove}
                      onPress={() => removeDraftItem(index)}
                      accessibilityLabel={`${WARMUP_COPY['WP-15'].remove} ${draftItem.title}`}
                      testID={`warmup-item-remove-${index}`}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.chipWrap}>
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-12'].builtInAndPrehab}
                  selected={sourceTab === 'built_in'}
                  onPress={() => {
                    setSourceTab('built_in');
                    setEditorError(null);
                    if (selectedBuiltIn?.kind === 'drill') applyDrillDoseDefaults(selectedBuiltIn.drillId);
                  }}
                  testID="warmup-tab-built-in"
                />
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-12'].exerciseLibrary}
                  selected={sourceTab === 'library'}
                  onPress={() => {
                    setSourceTab('library');
                    setEditorError(null);
                    setItemSets(DEFAULT_PRESET_ITEM_SETS);
                    setItemDoseKind('reps');
                    setItemDoseAmount(DEFAULT_PRESET_DOSE_REPS);
                    setItemPerSide(false);
                  }}
                  testID="warmup-tab-library"
                />
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-12'].physioOrCustom}
                  selected={sourceTab === 'custom'}
                  onPress={() => {
                    setSourceTab('custom');
                    setEditorError(null);
                    setItemSets(DEFAULT_PRESET_ITEM_SETS);
                    setItemDoseKind('reps');
                    setItemDoseAmount(DEFAULT_PRESET_DOSE_REPS);
                    setItemPerSide(false);
                  }}
                  testID="warmup-tab-custom"
                />
              </View>

              {sourceTab === 'built_in' && (
                <View style={styles.section}>
                  <View style={styles.chipWrap}>
                    {PREPARATION_CATALOG_DRILLS.map((drill) => (
                      <Chip
                        key={drill.itemId}
                        wrap
                        label={drill.title}
                        selected={selectedBuiltIn?.kind === 'drill' && selectedBuiltIn.drillId === drill.itemId}
                        onPress={() => {
                          setSelectedBuiltIn({ kind: 'drill', drillId: drill.itemId });
                          applyDrillDoseDefaults(drill.itemId);
                        }}
                        testID={`warmup-source-drill-${drill.itemId}`}
                      />
                    ))}
                  </View>
                  <View style={styles.chipWrap}>
                    {PREHAB_TARGETS.map((target) => (
                      <Chip
                        key={target.id}
                        wrap
                        label={PREHAB_TARGET_LABEL[target.id]}
                        selected={selectedBuiltIn?.kind === 'prehab' && selectedBuiltIn.targetId === target.id}
                        onPress={() => {
                          setSelectedBuiltIn({ kind: 'prehab', targetId: target.id });
                          setItemSets(DEFAULT_PRESET_ITEM_SETS);
                          setItemDoseKind('reps');
                          setItemDoseAmount(DEFAULT_PRESET_DOSE_REPS);
                          setItemPerSide(false);
                        }}
                        testID={`warmup-source-prehab-${target.id}`}
                      />
                    ))}
                  </View>
                  {selectedPrehabTarget !== null && (
                    <View style={styles.section}>
                      <Text style={styles.dim}>{PREHAB_DISCLAIMER}</Text>
                      <Text style={styles.dim}>{PREHAB_STOP_RULE}</Text>
                    </View>
                  )}
                </View>
              )}

              {sourceTab === 'library' && (
                <View style={styles.section}>
                  <View style={styles.chipWrap}>
                    {availablePatterns.map((pattern) => (
                      <Chip
                        key={pattern}
                        wrap
                        label={PATTERN_LABELS[pattern] ?? pattern}
                        selected={selectedPattern === pattern}
                        onPress={() => setSelectedPattern((prev) => (prev === pattern ? null : pattern))}
                        testID={`warmup-library-pattern-${pattern}`}
                      />
                    ))}
                  </View>
                  <ScrollView nestedScrollEnabled style={styles.libraryScroll}>
                    <View style={styles.chipWrap}>
                      {filteredMovements.map((movement) => (
                        <Chip
                          key={movement.movement_id}
                          wrap
                          label={movement.name}
                          selected={selectedMovementId === movement.movement_id}
                          onPress={() => setSelectedMovementId(movement.movement_id)}
                          testID={`warmup-source-movement-${movement.movement_id}`}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {sourceTab === 'custom' && (
                <View style={styles.section}>
                  <Text style={styles.label}>{WARMUP_COPY['WP-13'].nameLabel}</Text>
                  <TextInput
                    disableFullscreenUI
                    style={styles.input}
                    value={customName}
                    onChangeText={setCustomName}
                    maxLength={CUSTOM_DRILL_TITLE_MAX_LEN}
                    placeholder={WARMUP_COPY['WP-13'].namePlaceholder}
                    placeholderTextColor={theme.color.textLow}
                    accessibilityLabel={WARMUP_COPY['WP-13'].nameLabel}
                    testID="warmup-custom-name-input"
                  />
                </View>
              )}

              <Stepper
                label={WARMUP_COPY['WP-14'].setsStepper}
                value={String(itemSets)}
                onDecrement={() => setItemSets((prev) => clampInt(prev - 1, PRESET_ITEM_SETS_MIN, PRESET_ITEM_SETS_MAX))}
                onIncrement={() => setItemSets((prev) => clampInt(prev + 1, PRESET_ITEM_SETS_MIN, PRESET_ITEM_SETS_MAX))}
                testID="warmup-item-sets"
              />

              <View style={styles.chipWrap}>
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-14'].kindReps}
                  selected={itemDoseKind === 'reps'}
                  onPress={() => handleDoseKindChange('reps')}
                  testID="warmup-dose-reps"
                />
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-14'].kindSeconds}
                  selected={itemDoseKind === 'time'}
                  onPress={() => handleDoseKindChange('time')}
                  testID="warmup-dose-seconds"
                />
                <Chip
                  wrap
                  label={WARMUP_COPY['WP-14'].eachSide}
                  selected={itemPerSide}
                  onPress={() => setItemPerSide((prev) => !prev)}
                  testID="warmup-item-perside"
                />
              </View>

              <Stepper
                label={itemDoseKind === 'reps' ? WARMUP_COPY['WP-14'].repsPerSet : WARMUP_COPY['WP-14'].secondsPerSet}
                value={String(itemDoseAmount)}
                onDecrement={() => stepDoseAmount(-1)}
                onIncrement={() => stepDoseAmount(1)}
                testID="warmup-item-amount"
              />

              <Text style={styles.label}>{WARMUP_COPY['WP-13'].cueLabel}</Text>
              <TextInput
                disableFullscreenUI
                style={styles.input}
                value={itemCueNote}
                onChangeText={setItemCueNote}
                maxLength={CUE_NOTE_MAX_LEN}
                placeholder={WARMUP_COPY['WP-13'].cuePlaceholder}
                placeholderTextColor={theme.color.textLow}
                accessibilityLabel={WARMUP_COPY['WP-13'].cueLabel}
                testID="warmup-item-cue-input"
              />

              <SecondaryButton
                fullWidth
                label={WARMUP_COPY['WP-15'].addItem}
                onPress={handleAddItem}
                accessibilityLabel={WARMUP_COPY['WP-15'].addItem}
                testID="warmup-item-add"
              />

              {editorError !== null && (
                <Text style={styles.error} accessibilityRole="alert" testID="warmup-editor-error">
                  {editorError}
                </Text>
              )}

              <View style={styles.actions}>
                <PrimaryButton
                  label={WARMUP_COPY['WP-16'].savePreset}
                  onPress={handleSavePreset}
                  accessibilityLabel={WARMUP_COPY['WP-16'].savePreset}
                  testID="warmup-preset-save"
                />
                <SecondaryButton
                  fullWidth
                  label={WARMUP_COPY['WP-16'].cancel}
                  onPress={cancelEditor}
                  accessibilityLabel={WARMUP_COPY['WP-16'].cancel}
                  testID="warmup-preset-cancel"
                />
              </View>
            </View>
          )}

          {warmupPresets.length > 0 && (
            <View style={styles.section} testID="warmup-session-defaults">
              <Text style={styles.heading} accessibilityRole="header">{WARMUP_COPY['WP-18'].heading}</Text>
              <Text style={styles.dim}>{WARMUP_COPY['WP-18'].hint}</Text>
              {WARMUP_SESSION_TYPES.map((sessionType) => {
                const assignedId = warmupSessionTypeAssignments[sessionType];
                return (
                  <View key={sessionType} style={styles.assignmentRow}>
                    <Text style={styles.body}>{WARMUP_COPY['WP-20'][sessionType]}</Text>
                    <View style={styles.chipWrap}>
                      <Chip
                        wrap
                        label={WARMUP_COPY['WP-19']}
                        selected={assignedId === undefined}
                        onPress={() => setWarmupSessionTypeAssignment(sessionType, null)}
                        accessibilityLabel={`${WARMUP_COPY['WP-20'][sessionType]}: ${WARMUP_COPY['WP-19']}`}
                        testID={`warmup-assign-${sessionType}-auto`}
                      />
                      {warmupPresets.map((preset) => (
                        <Chip
                          key={preset.presetId}
                          wrap
                          label={preset.name}
                          selected={assignedId === preset.presetId}
                          onPress={() => setWarmupSessionTypeAssignment(sessionType, preset.presetId)}
                          accessibilityLabel={`${WARMUP_COPY['WP-20'][sessionType]}: ${preset.name}`}
                          testID={`warmup-assign-${sessionType}-${preset.presetId}`}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: theme.space[4],
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    gap: theme.space[2],
  },
  heading: { ...theme.font.eyebrow, color: theme.color.textHi },
  cardTitle: { ...theme.font.cue, color: theme.color.textHi },
  body: { ...theme.font.body, color: theme.color.textHi, flexShrink: 1 },
  dim: { ...theme.font.body, color: theme.color.textMid, flexShrink: 1 },
  meta: { ...theme.font.label, color: theme.color.textLow },
  label: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[2] },
  error: { ...theme.font.label, color: theme.color.textHi, marginTop: theme.space[2] },
  section: { gap: theme.space[3], marginTop: theme.space[2] },
  list: { gap: theme.space[3] },
  card: {
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink0,
    gap: theme.space[2],
  },
  editor: {
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    gap: theme.space[3],
  },
  itemCard: {
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink0,
    gap: theme.space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  libraryScroll: {
    maxHeight: 260,
  },
  input: {
    backgroundColor: theme.color.ink0,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    color: theme.color.textHi,
    ...theme.font.body,
    minHeight: theme.touch.min,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  actions: { gap: theme.space[2], marginTop: theme.space[2] },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], marginTop: theme.space[1] },
  assignmentRow: { gap: theme.space[2], paddingTop: theme.space[2], borderTopWidth: 1, borderTopColor: theme.color.line },
});

export default WarmupPresetsPanel;
