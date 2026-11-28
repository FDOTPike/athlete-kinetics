/**
 * warmupPresets.ts — personalised warm-up presets, resolution precedence,
 * draft validation, and preparation protocol builder (WO-WARMUP-01).
 *
 * Pure: no clock, no storage, no randomness. All user-facing strings and
 * numeric bounds are pinned to docs/audits/warmup-presets/RATIFIED_WARMUP_PRESETS_MANIFEST.md
 * and pre-existing ratified constants (PREHAB_STOP_RULE, STOP_GENERAL,
 * STOP_JOINT, MUSCLE_GROUP_INFO).
 */
import type { MovementPattern } from './types';
import type { Joint } from './substitution';
import { MUSCLE_GROUP_INFO } from './focusGoals';
import {
  PREHAB_STOP_RULE,
  PREHAB_TARGET_IDS,
  isPrehabTargetId,
  prehabTargetFor,
  type PrehabTargetId,
} from './prehabCatalog';
import {
  PREPARATION_CATALOG_DRILLS,
  PREPARATION_HELD_MOVEMENT_IDS,
  PREPARATION_PROTOCOL_VERSION,
  STOP_GENERAL,
  STOP_JOINT,
  buildFirstMovementRehearsalAndRamp,
  buildPreparationProtocol,
  describePreparationDose,
  preparationDoseSeconds,
  type PreparationCatalogDrill,
  type PreparationDose,
  type PreparationInput,
  type PreparationItem,
  type PreparationOmission,
  type PreparationProtocol,
} from './preparationPolicy';

// ---------------------------------------------------------------------------
// Ratified bounds (083_warmup_presets.sql)
// ---------------------------------------------------------------------------

export const MAX_WARMUP_PRESETS = 24 as const;
export const MAX_WARMUP_PRESET_ITEMS = 12 as const;
export const PRESET_NAME_MIN_LEN = 1 as const;
export const PRESET_NAME_MAX_LEN = 60 as const;
export const CUSTOM_DRILL_TITLE_MIN_LEN = 1 as const;
export const CUSTOM_DRILL_TITLE_MAX_LEN = 120 as const;
export const CUE_NOTE_MAX_LEN = 240 as const;
export const PRESET_ITEM_SETS_MIN = 1 as const;
export const PRESET_ITEM_SETS_MAX = 5 as const;
export const DEFAULT_PRESET_ITEM_SETS = 1 as const;
export const PRESET_DOSE_REPS_MIN = 1 as const;
export const PRESET_DOSE_REPS_MAX = 100 as const;
export const DEFAULT_PRESET_DOSE_REPS = 10 as const;
export const PRESET_DOSE_SECONDS_MIN = 5 as const;
export const PRESET_DOSE_SECONDS_MAX = 1800 as const;
export const DEFAULT_PRESET_DOSE_SECONDS = 30 as const;
export const DEFAULT_INCLUDE_RAMP_SETS = true as const;

export const WARMUP_POLICY_ID = 'athlete-warmup-preset' as const;
export const WARMUP_POLICY_REVISION = 1 as const;

export const WARMUP_PURPOSES = ['gpp', 'prehab', 'rehab'] as const;
export type WarmupPurpose = (typeof WARMUP_PURPOSES)[number];

export const WARMUP_SESSION_TYPES = [
  'default',
  'upper',
  'lower',
  'full',
  'push',
  'pull',
  'legs',
  'accessories',
  'conditioning',
  'bjj',
  'free_form',
] as const;
export type WarmupSessionType = (typeof WARMUP_SESSION_TYPES)[number];

export const WARMUP_ITEM_SOURCE_KINDS = [
  'catalog_drill',
  'prehab_target',
  'library_movement',
  'custom_physio',
] as const;
export type WarmupItemSourceKind = (typeof WARMUP_ITEM_SOURCE_KINDS)[number];

export type WarmupDoseKind = 'reps' | 'time';

export const WARMUP_WEAKNESS_TARGETS = [
  ...PREHAB_TARGET_IDS,
  'upper_chest',
  'mid_lower_chest',
  'front_shoulders',
  'side_shoulders',
  'rear_shoulders',
  'lats',
  'upper_back',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'lower_back',
] as const;
export type WarmupWeaknessTarget = (typeof WARMUP_WEAKNESS_TARGETS)[number];

// ---------------------------------------------------------------------------
// Ratified Copy (WP-01 .. WP-29)
// ---------------------------------------------------------------------------

export const WARMUP_PURPOSE_LABEL: Readonly<Record<WarmupPurpose, string>> = {
  gpp: 'General preparedness (GPP)',
  prehab: 'Prehab & weaknesses',
  rehab: 'Rehab or physio',
};

export const WARMUP_SESSION_TYPE_LABEL: Readonly<Record<WarmupSessionType, string>> = {
  default: 'Default (all sessions)',
  upper: 'Upper body',
  lower: 'Lower body',
  full: 'Full body',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  accessories: 'Accessories',
  conditioning: 'Conditioning',
  bjj: 'Sport & grappling',
  free_form: 'Unplanned session',
};

export const PREHAB_TARGET_LABEL: Readonly<Record<PrehabTargetId, string>> = {
  elbow_tendon: 'Elbow tendon',
  shoulder_cuff: 'Shoulder rotator cuff',
  knee_patellar: 'Knee & patellar tendon',
  achilles_calf: 'Achilles & calf',
  hip_groin: 'Hip & groin',
  low_back_core: 'Lower back & trunk',
  wrist_forearm: 'Wrist & forearm',
};

export const WARMUP_COPY = {
  'WP-01': 'WARM-UP PRESETS',
  'WP-02': 'Build saved warm-up routines for general preparedness (GPP), weakness prehab, or physio exercises, and assign them by session type.',
  'WP-03': {
    manage: 'Manage warm-up presets',
    hide: 'Hide warm-up presets',
  },
  'WP-04': 'No warm-up presets saved yet. Sessions use the automatic warm-up until you assign a preset.',
  'WP-05': {
    newPreset: 'New warm-up preset',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Confirm delete',
    keepPreset: 'Keep preset',
  },
  'WP-06': {
    label: 'Preset name',
    placeholder: 'For example: Lower body prehab or Physio shoulder',
  },
  'WP-07': {
    label: 'Purpose',
    gpp: WARMUP_PURPOSE_LABEL.gpp,
    prehab: WARMUP_PURPOSE_LABEL.prehab,
    rehab: WARMUP_PURPOSE_LABEL.rehab,
  },
  'WP-08': {
    label: 'Weakness or target area (optional)',
    none: 'None',
  },
  'WP-09': PREHAB_TARGET_LABEL,
  'WP-10': {
    label: 'Include first-lift warm-up sets',
    caption: 'Adds an unloaded rehearsal and 40% / 80% preparation sets for your first loaded exercise.',
  },
  'WP-11': (itemCount: number): string => `WARM-UP ITEMS (${itemCount} of 12)`,
  'WP-12': {
    builtInAndPrehab: 'Built-in & prehab',
    exerciseLibrary: 'Exercise library',
    physioOrCustom: 'Physio or custom',
  },
  'WP-13': {
    nameLabel: 'Exercise name',
    namePlaceholder: 'For example: Banded wall slide',
    cueLabel: 'Cue or physio note (optional)',
    cuePlaceholder: 'For example: 3 second lowering, stay pain-free',
  },
  'WP-14': {
    kindReps: 'Reps',
    kindSeconds: 'Seconds',
    setsStepper: 'Sets',
    repsPerSet: 'Reps per set',
    secondsPerSet: 'Seconds per set',
    eachSide: 'Each side',
  },
  'WP-15': {
    addItem: 'Add item',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
  },
  'WP-16': {
    savePreset: 'Save preset',
    cancel: 'Cancel',
  },
  'WP-17': {
    missingName: 'Enter a name for this warm-up preset.',
    emptyItems: 'Add at least one warm-up item before saving.',
    missingCustomTitle: 'Enter an exercise name for this item.',
    presetCap: 'Up to 24 warm-up presets can be saved. Delete one to add another.',
    itemCap: 'Each preset holds up to 12 items.',
  },
  'WP-18': {
    heading: 'SESSION WARM-UP DEFAULTS',
    hint: 'Choose which preset runs for each session type. Specific session types override Default.',
  },
  'WP-19': 'Automatic warm-up',
  'WP-20': WARMUP_SESSION_TYPE_LABEL,
  'WP-21': (activePresetName: string | null): string => `Warm-up: ${activePresetName ?? 'Automatic warm-up'}`,
  'WP-22': 'Change warm-up',
  'WP-23': (presetName: string, purposeLabel: string): string => `Warm-up preset: ${presetName} (${purposeLabel}).`,
  'WP-24': (targetLabel: string): string => `Target area: ${targetLabel}.`,
  'WP-25': (sets: number, doseText: string): string => `${sets} sets · ${doseText}`,
  'WP-26': 'Move smoothly and stay within a comfortable range.',
  'WP-27': (sets: number, movementName: string): string =>
    `${sets > 1 ? `Complete ${sets} easy preparation sets` : 'Complete 1 easy preparation set'} of ${movementName} with light or bodyweight resistance.`,
  'WP-28': (sets: number, cueNote: string | null): string =>
    `${sets > 1 ? `Complete ${sets} sets.` : 'Complete as prescribed.'}${cueNote ? ` ${cueNote}` : ''}`,
  'WP-29': (totalMin: number, prepMin: number, capMin: number): string =>
    `This session is estimated at about ${totalMin} minutes including your ${prepMin}-minute warm-up preset, which is over your ${capMin}-minute session limit. Your saved warm-up items were kept as written.`,
} as const;

// ---------------------------------------------------------------------------
// Data contracts
// ---------------------------------------------------------------------------

export interface WarmupPresetItemDraft {
  readonly itemOrder: number;
  readonly sourceKind: WarmupItemSourceKind;
  readonly catalogDrillId: string | null;
  readonly prehabTargetId: PrehabTargetId | null;
  readonly movementId: number | null;
  readonly title: string;
  readonly sets: number;
  readonly doseKind: WarmupDoseKind;
  readonly doseAmount: number;
  readonly perSide: boolean;
  readonly cueNote: string | null;
}

export interface WarmupPresetItem extends WarmupPresetItemDraft {}

export interface WarmupPresetDraft {
  readonly name: string;
  readonly purpose: WarmupPurpose;
  readonly weaknessTarget: WarmupWeaknessTarget | null;
  readonly includeRampSets: boolean;
  readonly items: readonly WarmupPresetItemDraft[];
}

export interface WarmupPreset extends WarmupPresetDraft {
  readonly presetId: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly items: readonly WarmupPresetItem[];
}

export type WarmupSessionOverride =
  | { readonly mode: 'preset'; readonly presetId: number }
  | { readonly mode: 'standard_auto'; readonly presetId: null };

export type WarmupPresetValidationResult =
  | { readonly ok: true; readonly value: WarmupPresetDraft }
  | { readonly ok: false; readonly error: string };

export interface PersonalisedPreparationInput extends PreparationInput {
  readonly preset: WarmupPreset | null;
  readonly movementCatalog?: ReadonlyMap<number, { readonly name: string; readonly pattern: MovementPattern }>;
  readonly mainWorkMin?: number;
  readonly capMin?: number;
}

// ---------------------------------------------------------------------------
// Lookup & formatting helpers
// ---------------------------------------------------------------------------

const PURPOSE_SET: ReadonlySet<string> = new Set(WARMUP_PURPOSES);
const SESSION_TYPE_SET: ReadonlySet<string> = new Set(WARMUP_SESSION_TYPES);
const SOURCE_KIND_SET: ReadonlySet<string> = new Set(WARMUP_ITEM_SOURCE_KINDS);
const WEAKNESS_TARGET_SET: ReadonlySet<string> = new Set(WARMUP_WEAKNESS_TARGETS);
const CATALOG_DRILL_BY_ID: ReadonlyMap<string, PreparationCatalogDrill> = new Map(
  PREPARATION_CATALOG_DRILLS.map((drill) => [drill.itemId, drill]),
);

const WEAKNESS_TARGET_TO_MUSCLE_LABEL: Readonly<Record<Exclude<WarmupWeaknessTarget, PrehabTargetId>, string>> = {
  upper_chest: MUSCLE_GROUP_INFO.upper_chest.label,
  mid_lower_chest: MUSCLE_GROUP_INFO.chest.label,
  front_shoulders: MUSCLE_GROUP_INFO.shoulders.label,
  side_shoulders: MUSCLE_GROUP_INFO.shoulders.label,
  rear_shoulders: MUSCLE_GROUP_INFO.rear_shoulders.label,
  lats: MUSCLE_GROUP_INFO.lats.label,
  upper_back: MUSCLE_GROUP_INFO.upper_back.label,
  traps: MUSCLE_GROUP_INFO.upper_back.label,
  biceps: MUSCLE_GROUP_INFO.biceps.label,
  triceps: MUSCLE_GROUP_INFO.triceps.label,
  forearms: MUSCLE_GROUP_INFO.forearms.label,
  quadriceps: MUSCLE_GROUP_INFO.quadriceps.label,
  hamstrings: MUSCLE_GROUP_INFO.hamstrings.label,
  glutes: MUSCLE_GROUP_INFO.glutes.label,
  calves: MUSCLE_GROUP_INFO.calves.label,
  abs: MUSCLE_GROUP_INFO.core.label,
  lower_back: MUSCLE_GROUP_INFO.lower_back.label,
};

export const isWarmupPurpose = (value: unknown): value is WarmupPurpose =>
  typeof value === 'string' && PURPOSE_SET.has(value);

export const isWarmupSessionType = (value: unknown): value is WarmupSessionType =>
  typeof value === 'string' && SESSION_TYPE_SET.has(value);

export const isWarmupWeaknessTarget = (value: unknown): value is WarmupWeaknessTarget =>
  typeof value === 'string' && WEAKNESS_TARGET_SET.has(value);

export function weaknessTargetLabel(target: WarmupWeaknessTarget): string {
  if (isPrehabTargetId(target)) return PREHAB_TARGET_LABEL[target];
  return WEAKNESS_TARGET_TO_MUSCLE_LABEL[target];
}

function toSingleSetDose(
  item: Pick<WarmupPresetItemDraft, 'doseKind' | 'doseAmount' | 'perSide'>,
): PreparationDose {
  return item.doseKind === 'time'
    ? { kind: 'time', seconds: item.doseAmount, perSide: item.perSide }
    : { kind: 'reps', reps: item.doseAmount, perSide: item.perSide };
}

export function formatPresetItemDose(
  item: Pick<WarmupPresetItemDraft, 'sets' | 'doseKind' | 'doseAmount' | 'perSide'>,
): string {
  const doseText = describePreparationDose(toSingleSetDose(item));
  return item.sets > 1 ? WARMUP_COPY['WP-25'](item.sets, doseText) : doseText;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWarmupPresetDraft(
  draft: WarmupPresetDraft,
  existingPresetCount: number,
  isUpdate: boolean,
): WarmupPresetValidationResult {
  if (!isUpdate && existingPresetCount >= MAX_WARMUP_PRESETS) {
    return { ok: false, error: WARMUP_COPY['WP-17'].presetCap };
  }
  const name = typeof draft.name === 'string' ? draft.name.trim() : '';
  if (name.length < PRESET_NAME_MIN_LEN) {
    return { ok: false, error: WARMUP_COPY['WP-17'].missingName };
  }
  if (name.length > PRESET_NAME_MAX_LEN) {
    return { ok: false, error: `Preset name must be ${PRESET_NAME_MAX_LEN} characters or fewer.` };
  }
  if (!isWarmupPurpose(draft.purpose)) {
    return { ok: false, error: 'Warm-up purpose is not recognised.' };
  }
  if (draft.weaknessTarget !== null && !isWarmupWeaknessTarget(draft.weaknessTarget)) {
    return { ok: false, error: 'Target area is not recognised.' };
  }
  if (!Array.isArray(draft.items) || draft.items.length === 0) {
    return { ok: false, error: WARMUP_COPY['WP-17'].emptyItems };
  }
  if (draft.items.length > MAX_WARMUP_PRESET_ITEMS) {
    return { ok: false, error: WARMUP_COPY['WP-17'].itemCap };
  }

  const normalisedItems: WarmupPresetItemDraft[] = [];
  for (let index = 0; index < draft.items.length; index += 1) {
    const raw = draft.items[index]!;
    if (!SOURCE_KIND_SET.has(raw.sourceKind)) {
      return { ok: false, error: 'Warm-up item source kind is not recognised.' };
    }
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (title.length < CUSTOM_DRILL_TITLE_MIN_LEN) {
      return { ok: false, error: WARMUP_COPY['WP-17'].missingCustomTitle };
    }
    if (title.length > CUSTOM_DRILL_TITLE_MAX_LEN) {
      return { ok: false, error: `Item name must be ${CUSTOM_DRILL_TITLE_MAX_LEN} characters or fewer.` };
    }
    if (!Number.isInteger(raw.sets) || raw.sets < PRESET_ITEM_SETS_MIN || raw.sets > PRESET_ITEM_SETS_MAX) {
      return { ok: false, error: `Sets must be between ${PRESET_ITEM_SETS_MIN} and ${PRESET_ITEM_SETS_MAX}.` };
    }
    if (raw.doseKind === 'reps') {
      if (!Number.isInteger(raw.doseAmount) || raw.doseAmount < PRESET_DOSE_REPS_MIN || raw.doseAmount > PRESET_DOSE_REPS_MAX) {
        return { ok: false, error: `Reps must be between ${PRESET_DOSE_REPS_MIN} and ${PRESET_DOSE_REPS_MAX}.` };
      }
    } else if (raw.doseKind === 'time') {
      if (!Number.isInteger(raw.doseAmount) || raw.doseAmount < PRESET_DOSE_SECONDS_MIN || raw.doseAmount > PRESET_DOSE_SECONDS_MAX) {
        return { ok: false, error: `Seconds must be between ${PRESET_DOSE_SECONDS_MIN} and ${PRESET_DOSE_SECONDS_MAX}.` };
      }
    } else {
      return { ok: false, error: 'Dose kind must be reps or time.' };
    }

    const cueRaw = raw.cueNote === null || raw.cueNote === undefined ? '' : raw.cueNote.trim();
    if (cueRaw.length > CUE_NOTE_MAX_LEN) {
      return { ok: false, error: `Cue or physio note must be ${CUE_NOTE_MAX_LEN} characters or fewer.` };
    }
    const cueNote = cueRaw.length > 0 ? cueRaw : null;

    if (raw.sourceKind === 'catalog_drill') {
      const drillId = typeof raw.catalogDrillId === 'string' ? raw.catalogDrillId.trim() : '';
      if (!CATALOG_DRILL_BY_ID.has(drillId) || raw.prehabTargetId !== null || raw.movementId !== null) {
        return { ok: false, error: 'Built-in drill reference is invalid.' };
      }
      normalisedItems.push({
        itemOrder: index,
        sourceKind: 'catalog_drill',
        catalogDrillId: drillId,
        prehabTargetId: null,
        movementId: null,
        title,
        sets: raw.sets,
        doseKind: raw.doseKind,
        doseAmount: raw.doseAmount,
        perSide: Boolean(raw.perSide),
        cueNote,
      });
    } else if (raw.sourceKind === 'prehab_target') {
      if (!isPrehabTargetId(raw.prehabTargetId) || raw.catalogDrillId !== null) {
        return { ok: false, error: 'Prehab target reference is invalid.' };
      }
      if (raw.movementId !== null && (!Number.isInteger(raw.movementId) || raw.movementId <= 0)) {
        return { ok: false, error: 'Prehab movement reference is invalid.' };
      }
      normalisedItems.push({
        itemOrder: index,
        sourceKind: 'prehab_target',
        catalogDrillId: null,
        prehabTargetId: raw.prehabTargetId,
        movementId: raw.movementId,
        title,
        sets: raw.sets,
        doseKind: raw.doseKind,
        doseAmount: raw.doseAmount,
        perSide: Boolean(raw.perSide),
        cueNote,
      });
    } else if (raw.sourceKind === 'library_movement') {
      if (
        raw.movementId === null
        || !Number.isInteger(raw.movementId)
        || raw.movementId <= 0
        || raw.catalogDrillId !== null
        || raw.prehabTargetId !== null
      ) {
        return { ok: false, error: 'Exercise library reference is invalid.' };
      }
      normalisedItems.push({
        itemOrder: index,
        sourceKind: 'library_movement',
        catalogDrillId: null,
        prehabTargetId: null,
        movementId: raw.movementId,
        title,
        sets: raw.sets,
        doseKind: raw.doseKind,
        doseAmount: raw.doseAmount,
        perSide: Boolean(raw.perSide),
        cueNote,
      });
    } else {
      if (raw.catalogDrillId !== null || raw.prehabTargetId !== null || raw.movementId !== null) {
        return { ok: false, error: 'Custom physio item cannot reference a catalogue or library id.' };
      }
      normalisedItems.push({
        itemOrder: index,
        sourceKind: 'custom_physio',
        catalogDrillId: null,
        prehabTargetId: null,
        movementId: null,
        title,
        sets: raw.sets,
        doseKind: raw.doseKind,
        doseAmount: raw.doseAmount,
        perSide: Boolean(raw.perSide),
        cueNote,
      });
    }
  }

  return {
    ok: true,
    value: {
      name,
      purpose: draft.purpose,
      weaknessTarget: draft.weaknessTarget,
      includeRampSets: Boolean(draft.includeRampSets),
      items: normalisedItems,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolution precedence: sessionOverride > sessionType > default > automatic
// ---------------------------------------------------------------------------

export function resolveActiveWarmupPreset(input: {
  readonly presets: readonly WarmupPreset[];
  readonly sessionTypeAssignments: Readonly<Partial<Record<WarmupSessionType, number>>>;
  readonly sessionType: WarmupSessionType;
  readonly sessionOverride: WarmupSessionOverride | null | undefined;
}): WarmupPreset | null {
  if (input.sessionOverride?.mode === 'standard_auto') {
    return null;
  }
  const byId = new Map<number, WarmupPreset>(input.presets.map((preset) => [preset.presetId, preset]));
  if (input.sessionOverride?.mode === 'preset') {
    const matched = byId.get(input.sessionOverride.presetId);
    if (matched !== undefined) return matched;
  }
  const specificId = input.sessionTypeAssignments[input.sessionType];
  if (specificId !== undefined) {
    const matched = byId.get(specificId);
    if (matched !== undefined) return matched;
  }
  const defaultId = input.sessionTypeAssignments.default;
  if (defaultId !== undefined) {
    const matched = byId.get(defaultId);
    if (matched !== undefined) return matched;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Personalised preparation protocol builder
// ---------------------------------------------------------------------------

const ITEM_CHANGEOVER_SECONDS = 10;
const roundToHalfMinute = (seconds: number): number => Math.round(seconds / 30) * 30;

function formatPresetItemTitle(title: string, sets: number): string {
  const clean = title.trim();
  const formatted = sets > 1 ? `${clean} (${sets} sets)` : clean;
  return formatted.slice(0, 200);
}

function formatCue(cueNote: string | null, fallback: string): string {
  const clean = cueNote?.trim() ?? '';
  return (clean.length > 0 ? clean.slice(0, 120) : fallback).slice(0, 120);
}

function formatInstruction(text: string): string {
  return text.trim().slice(0, 600);
}

export function buildPersonalisedPreparationProtocol(
  input: PersonalisedPreparationInput,
): PreparationProtocol {
  if (input.preset === null) {
    return buildPreparationProtocol(input);
  }

  const preset = input.preset;
  const restricted = new Set<Joint>(input.restrictedJoints);
  const items: PreparationItem[] = [];
  const omitted: PreparationOmission[] = [];
  const basis: string[] = [];
  const notes: string[] = [];
  let rawEstimateTotalSeconds = 0;

  const checkMovementAccess = (
    itemId: string,
    movementId: number,
    displayName: string,
  ): boolean => {
    const held = PREPARATION_HELD_MOVEMENT_IDS.get(movementId);
    if (held !== undefined) {
      omitted.push({
        itemId,
        movementId,
        reasonCode: 'movement_hold',
        detail: `${displayName}: ${held}`,
      });
      return false;
    }
    const excluded = input.excludedMovements.get(movementId);
    if (excluded !== undefined) {
      omitted.push({
        itemId,
        movementId,
        reasonCode: excluded.reasonCode,
        detail: `${displayName}: ${excluded.detail}`,
      });
      return false;
    }
    return true;
  };

  const orderedItems = [...preset.items].sort((a, b) => a.itemOrder - b.itemOrder);
  for (const presetItem of orderedItems) {
    const dose = toSingleSetDose(presetItem);
    const rawSeconds = preparationDoseSeconds(dose) * presetItem.sets + ITEM_CHANGEOVER_SECONDS * presetItem.sets;
    const clampedSeconds = Math.min(3600, Math.max(1, rawSeconds));
    const trimmedCue = presetItem.cueNote !== null && presetItem.cueNote.trim().length > 0
      ? presetItem.cueNote.trim()
      : null;

    if (presetItem.sourceKind === 'catalog_drill') {
      const drill = presetItem.catalogDrillId !== null
        ? CATALOG_DRILL_BY_ID.get(presetItem.catalogDrillId)
        : undefined;
      if (drill === undefined) {
        omitted.push({
          itemId: presetItem.catalogDrillId ?? `preset.drill_${presetItem.itemOrder}`,
          movementId: null,
          reasonCode: 'not_applicable',
          detail: `${presetItem.title} is no longer in the built-in drill catalogue.`,
        });
        continue;
      }
      if (drill.joints.some((joint) => restricted.has(joint))) {
        omitted.push({
          itemId: drill.itemId,
          movementId: null,
          reasonCode: 'safety',
          detail: `${drill.title} is withheld because it loads an area with an active niggle.`,
        });
        continue;
      }
      rawEstimateTotalSeconds += rawSeconds;
      const instructionBase = trimmedCue !== null ? `${drill.instruction} ${trimmedCue}` : drill.instruction;
      items.push({
        itemId: drill.itemId,
        itemRevision: drill.itemRevision,
        stage: drill.stage,
        title: formatPresetItemTitle(presetItem.title || drill.title, presetItem.sets),
        instruction: formatInstruction(instructionBase),
        cue: formatCue(trimmedCue, drill.cue),
        stopInstruction: drill.stopInstruction,
        regression: drill.regression,
        dose,
        movementId: null,
        effort: drill.effort,
        sourceRefs: [...drill.sourceRefs],
        estimateSeconds: clampedSeconds,
      });
    } else if (presetItem.sourceKind === 'prehab_target') {
      const target = presetItem.prehabTargetId !== null && isPrehabTargetId(presetItem.prehabTargetId)
        ? prehabTargetFor(presetItem.prehabTargetId)
        : null;
      if (target === null) {
        omitted.push({
          itemId: `prehab.unknown_${presetItem.itemOrder}`,
          movementId: presetItem.movementId,
          reasonCode: 'not_applicable',
          detail: `${presetItem.title} references an unknown prehab target.`,
        });
        continue;
      }
      const itemId = `prehab.${target.id}`;
      if (presetItem.movementId !== null && !checkMovementAccess(itemId, presetItem.movementId, presetItem.title)) {
        continue;
      }
      rawEstimateTotalSeconds += rawSeconds;
      const baseInstruction = WARMUP_COPY['WP-28'](presetItem.sets, trimmedCue);
      const withGap = presetItem.movementId === null && target.catalogGap !== null
        ? `${baseInstruction} ${target.catalogGap}`
        : baseInstruction;
      items.push({
        itemId,
        itemRevision: 1,
        stage: 'activate',
        title: formatPresetItemTitle(presetItem.title, presetItem.sets),
        instruction: formatInstruction(withGap),
        cue: formatCue(trimmedCue, WARMUP_COPY['WP-26']),
        stopInstruction: PREHAB_STOP_RULE,
        regression: null,
        dose,
        movementId: presetItem.movementId,
        effort: 'easy',
        sourceRefs: ['prehab_catalog'],
        estimateSeconds: clampedSeconds,
      });
    } else if (presetItem.sourceKind === 'library_movement') {
      if (presetItem.movementId === null) {
        omitted.push({
          itemId: `preset.movement_${presetItem.itemOrder}`,
          movementId: null,
          reasonCode: 'not_applicable',
          detail: `${presetItem.title} has no movement identifier.`,
        });
        continue;
      }
      const itemId = `preset.movement_${presetItem.movementId}`;
      const movementName = input.movementCatalog?.get(presetItem.movementId)?.name ?? presetItem.title;
      if (!checkMovementAccess(itemId, presetItem.movementId, movementName)) {
        continue;
      }
      rawEstimateTotalSeconds += rawSeconds;
      const baseInstruction = WARMUP_COPY['WP-27'](presetItem.sets, movementName);
      const fullInstruction = trimmedCue !== null ? `${baseInstruction} ${trimmedCue}` : baseInstruction;
      items.push({
        itemId,
        itemRevision: 1,
        stage: 'mobilise',
        title: formatPresetItemTitle(presetItem.title, presetItem.sets),
        instruction: formatInstruction(fullInstruction),
        cue: formatCue(trimmedCue, WARMUP_COPY['WP-26']),
        stopInstruction: STOP_JOINT,
        regression: 'Use a shorter range or a supported version.',
        dose,
        movementId: presetItem.movementId,
        effort: 'easy',
        sourceRefs: ['athlete_preset'],
        estimateSeconds: clampedSeconds,
      });
    } else {
      rawEstimateTotalSeconds += rawSeconds;
      items.push({
        itemId: `preset.custom_${presetItem.itemOrder}`,
        itemRevision: 1,
        stage: 'activate',
        title: formatPresetItemTitle(presetItem.title, presetItem.sets),
        instruction: formatInstruction(WARMUP_COPY['WP-28'](presetItem.sets, trimmedCue)),
        cue: formatCue(trimmedCue, WARMUP_COPY['WP-26']),
        stopInstruction: PREHAB_STOP_RULE,
        regression: null,
        dose,
        movementId: null,
        effort: 'easy',
        sourceRefs: ['clinician_physio'],
        estimateSeconds: clampedSeconds,
      });
    }
  }

  let preparedAnchorName: string | null = null;
  if (preset.includeRampSets) {
    const { anchor, rehearse, ramp, omitted: anchorOmitted } = buildFirstMovementRehearsalAndRamp({
      slots: input.slots,
      excludedMovements: input.excludedMovements,
      includeFirstChoiceWhenEmpty: false,
    });
    omitted.push(...anchorOmitted);
    if (anchor !== null) {
      preparedAnchorName = anchor.movementName;
    }
    if (rehearse !== null) {
      rawEstimateTotalSeconds += rehearse.estimateSeconds;
      items.push(rehearse);
    }
    for (const rampItem of ramp) {
      rawEstimateTotalSeconds += rampItem.estimateSeconds;
      items.push(rampItem);
    }
  }

  // 065_session_preparation requires 1..20 items; fall back safely if every item was withheld.
  if (items.length === 0) {
    const raiseDrill = CATALOG_DRILL_BY_ID.get('raise.easy_movement');
    if (raiseDrill !== undefined) {
      const lowerLimbRestricted = (['knee', 'hip', 'ankle'] as const).some((joint) => restricted.has(joint));
      const fallbackSeconds = 180;
      const fallbackDose: PreparationDose = { kind: 'time', seconds: fallbackSeconds, perSide: false };
      const fallbackEst = fallbackSeconds + ITEM_CHANGEOVER_SECONDS;
      rawEstimateTotalSeconds += fallbackEst;
      items.push({
        itemId: raiseDrill.itemId,
        itemRevision: raiseDrill.itemRevision,
        stage: raiseDrill.stage,
        title: raiseDrill.title,
        instruction: lowerLimbRestricted
          ? 'Use an option that keeps weight off the sore area, such as easy seated arm cycling or seated marching with the comfortable leg. Keep a pace where you could hold a conversation.'
          : raiseDrill.instruction,
        cue: raiseDrill.cue,
        stopInstruction: STOP_GENERAL,
        regression: lowerLimbRestricted
          ? 'Slow, relaxed breathing while seated, with gentle arm swings.'
          : raiseDrill.regression,
        dose: fallbackDose,
        movementId: null,
        effort: 'easy',
        sourceRefs: [...raiseDrill.sourceRefs],
        estimateSeconds: fallbackEst,
      });
    }
  }

  basis.push(WARMUP_COPY['WP-23'](preset.name.trim(), WARMUP_PURPOSE_LABEL[preset.purpose]).slice(0, 300));
  if (preset.weaknessTarget !== null) {
    basis.push(WARMUP_COPY['WP-24'](weaknessTargetLabel(preset.weaknessTarget)).slice(0, 300));
  }
  if (preparedAnchorName !== null) {
    basis.push(`First movement prepared: ${preparedAnchorName}.`.slice(0, 300));
  }
  if (restricted.size > 0 && omitted.some((row) => row.reasonCode === 'safety')) {
    basis.push('Active niggles: drills that load those areas are withheld.');
  }

  const rawLow = Math.max(30, roundToHalfMinute(rawEstimateTotalSeconds * 0.85));
  const rawHigh = Math.max(60, roundToHalfMinute(rawEstimateTotalSeconds * 1.15));
  const prepMin = Math.max(1, Math.ceil(((rawLow + rawHigh) / 2) / 60));

  if (input.readinessReduced) {
    notes.push('Today\'s plan is eased. Keep every preparation item easy and base the preparation sets on today\'s reduced working load.');
  }
  if (
    input.mainWorkMin !== undefined
    && input.capMin !== undefined
    && Number.isFinite(input.mainWorkMin)
    && Number.isFinite(input.capMin)
    && input.capMin > 0
  ) {
    const capMin = Math.round(input.capMin);
    const totalMin = Math.ceil(input.mainWorkMin + prepMin);
    if (totalMin > capMin) {
      notes.push(WARMUP_COPY['WP-29'](totalMin, prepMin, capMin));
    }
  } else if (input.timeConflictNote !== undefined && input.timeConflictNote !== null && input.timeConflictNote.trim().length > 0) {
    notes.push(input.timeConflictNote.trim());
  }

  const clampedLow = Math.min(7200, rawLow);
  const clampedHigh = Math.min(7200, Math.max(clampedLow, rawHigh));

  return {
    version: PREPARATION_PROTOCOL_VERSION,
    policyId: WARMUP_POLICY_ID,
    policyRevision: WARMUP_POLICY_REVISION,
    variant: 'standard',
    basis,
    items,
    omitted,
    estimateSeconds: {
      low: clampedLow,
      high: clampedHigh,
    },
    notes,
  };
}
