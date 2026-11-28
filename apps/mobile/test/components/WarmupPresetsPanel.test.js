/**
 * WarmupPresetsPanel.test.js — WO-WARMUP-02 store, SQLite, UI & UI-law contracts.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  MAX_WARMUP_PRESETS,
  MAX_WARMUP_PRESET_ITEMS,
  PREHAB_TARGET_LABEL,
  PREPARATION_CATALOG_DRILLS,
  WARMUP_COPY,
  WARMUP_PURPOSE_LABEL,
  WARMUP_SESSION_TYPE_LABEL,
} from '@ak/inference';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import ProfileScreen from '../../src/screens/ProfileScreen';
import { WarmupPresetsPanel } from '../../src/components/WarmupPresetsPanel';
import { PreparationPanel } from '../../src/components/PreparationPanel';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}

jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const state = () => useStore.getState();
const raw = (dbName = A) => mockDrivers.get(dbName).raw;
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });

const OWNED_EQUIPMENT = ['barbell', 'squat_rack', 'dumbbells', 'bench', 'bands', 'cable_machine', 'mats'];

const boot = async () => {
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], sport: null, goalMovements: {}, blockEmphasis: null,
    block: null, program: null, todayPlan: null, preparation: null,
    warmupPresets: [], warmupSessionTypeAssignments: {}, plannedSessionWarmupOverrides: {},
    freeFormWarmupOverride: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [
      { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
      { id: 'athlete-b', name: 'Athlete B', dbName: B, createdAtMs: 1 },
    ],
  };
  await boot();
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: OWNED_EQUIPMENT });
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

const item = (overrides = {}) => ({
  itemOrder: 0,
  sourceKind: 'catalog_drill',
  catalogDrillId: 'mobilise.leg_swings',
  prehabTargetId: null,
  movementId: null,
  title: 'Leg swings',
  sets: 1,
  doseKind: 'time',
  doseAmount: 30,
  perSide: true,
  cueNote: null,
  ...overrides,
});

const draft = (overrides = {}) => ({
  name: 'Lower body prep',
  purpose: 'gpp',
  weaknessTarget: null,
  includeRampSets: true,
  items: [item()],
  ...overrides,
});

describe('WarmupPresetsPanel UI CRUD & validation', () => {
  test('is collapsed by default in ProfileScreen, expands to empty copy, and supports GPP, Prehab, and Rehab/Physio CRUD', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('warmup-presets-panel')).toBeOnTheScreen();
    expect(screen.getByText(WARMUP_COPY['WP-01'])).toBeOnTheScreen();
    expect(screen.getByText(WARMUP_COPY['WP-02'])).toBeOnTheScreen();
    expect(screen.queryByTestId('warmup-presets-empty')).toBeNull();

    // Expand panel
    press('warmup-presets-toggle');
    expect(screen.getByTestId('warmup-presets-empty')).toHaveTextContent(WARMUP_COPY['WP-04']);

    // 1) Create GPP preset with built-in drill
    press('warmup-preset-new');
    type('warmup-preset-name-input', 'Morning GPP');
    press('warmup-purpose-gpp');
    press('warmup-tab-built-in');
    press(`warmup-source-drill-${PREPARATION_CATALOG_DRILLS[1].itemId}`);
    press('warmup-item-add');
    press('warmup-preset-save');

    expect(state().warmupPresets).toHaveLength(1);
    expect(state().warmupPresets[0]).toMatchObject({
      name: 'Morning GPP',
      purpose: 'gpp',
      weaknessTarget: null,
      includeRampSets: true,
    });
    const gppRow = raw().prepare('SELECT * FROM warmup_preset WHERE preset_id = ?').get(state().warmupPresets[0].presetId);
    expect(gppRow).toMatchObject({ name: 'Morning GPP', purpose: 'gpp', include_ramp_sets: 1 });

    // 2) Create Prehab preset with weakness target, prehab target, and library movement
    press('warmup-preset-new');
    type('warmup-preset-name-input', 'Shoulder Prehab');
    press('warmup-purpose-prehab');
    press('warmup-weakness-shoulder_cuff');
    press('warmup-tab-built-in');
    press('warmup-source-prehab-shoulder_cuff');
    press('warmup-item-add');
    press('warmup-tab-library');
    const facePull = state().movements.find((m) => m.name === 'Face Pull');
    expect(facePull).toBeDefined();
    press(`warmup-library-pattern-${facePull.pattern}`);
    press(`warmup-source-movement-${facePull.movement_id}`);
    press('warmup-item-add');
    press('warmup-preset-save');

    expect(state().warmupPresets).toHaveLength(2);
    const prehabPreset = state().warmupPresets[1];
    expect(prehabPreset.weaknessTarget).toBe('shoulder_cuff');
    expect(prehabPreset.items[0]).toMatchObject({
      sourceKind: 'prehab_target',
      prehabTargetId: 'shoulder_cuff',
    });
    expect(prehabPreset.items[0].movementId).not.toBeNull();
    expect(prehabPreset.items[1]).toMatchObject({
      sourceKind: 'library_movement',
      movementId: facePull.movement_id,
    });

    // 3) Create Rehab/Physio preset with custom_physio, sets=3, seconds, perSide, and cueNote
    press('warmup-preset-new');
    type('warmup-preset-name-input', 'Physio Wall Slides');
    press('warmup-purpose-rehab');
    press('warmup-include-ramp-toggle'); // toggle OFF
    press('warmup-tab-custom');
    type('warmup-custom-name-input', 'Banded wall slide');
    pressLabel('Increase Sets');
    pressLabel('Increase Sets'); // 1 -> 3
    press('warmup-dose-seconds'); // default 30s
    pressLabel('Increase Seconds per set'); // 30 -> 35
    pressLabel('Increase Seconds per set'); // 35 -> 40
    pressLabel('Increase Seconds per set'); // 40 -> 45
    press('warmup-item-perside');
    type('warmup-item-cue-input', '3 second lowering, stay pain-free');
    press('warmup-item-add');
    press('warmup-preset-save');

    expect(state().warmupPresets).toHaveLength(3);
    const rehabPreset = state().warmupPresets[2];
    expect(rehabPreset).toMatchObject({
      name: 'Physio Wall Slides',
      purpose: 'rehab',
      includeRampSets: false,
    });
    expect(rehabPreset.items[0]).toMatchObject({
      sourceKind: 'custom_physio',
      title: 'Banded wall slide',
      sets: 3,
      doseKind: 'time',
      doseAmount: 45,
      perSide: true,
      cueNote: '3 second lowering, stay pain-free',
    });

    // 4) Edit & reorder items in Prehab preset (2 items)
    press(`warmup-preset-edit-${prehabPreset.presetId}`);
    expect(screen.getByTestId('warmup-items-heading')).toHaveTextContent(WARMUP_COPY['WP-11'](2));
    press('warmup-item-down-0');
    press('warmup-preset-save');
    const updatedPrehab = state().warmupPresets.find((p) => p.presetId === prehabPreset.presetId);
    expect(updatedPrehab.items[0].sourceKind).toBe('library_movement');
    expect(updatedPrehab.items[1].sourceKind).toBe('prehab_target');

    // 5) Assign session-type default & verify persistence
    press(`warmup-assign-lower-${prehabPreset.presetId}`);
    expect(state().warmupSessionTypeAssignments.lower).toBe(prehabPreset.presetId);
    const assignRow = raw().prepare("SELECT preset_id FROM warmup_session_type_assignment WHERE session_type = 'lower'").get();
    expect(assignRow.preset_id).toBe(prehabPreset.presetId);

    // 6) Inline Delete: Keep preset vs Confirm delete
    press(`warmup-preset-delete-${gppRow.preset_id}`);
    expect(screen.getByTestId(`warmup-preset-confirm-delete-${gppRow.preset_id}`)).toBeOnTheScreen();
    press(`warmup-preset-keep-${gppRow.preset_id}`);
    expect(state().warmupPresets).toHaveLength(3);

    press(`warmup-preset-delete-${prehabPreset.presetId}`);
    press(`warmup-preset-confirm-delete-${prehabPreset.presetId}`);
    expect(state().warmupPresets.some((p) => p.presetId === prehabPreset.presetId)).toBe(false);
    expect(state().warmupSessionTypeAssignments.lower).toBeUndefined();
  });

  test('enforces WP-17 validation errors (missing name, empty items, missing custom title, 12-item cap, 24-preset cap)', () => {
    render(<WarmupPresetsPanel />);
    press('warmup-presets-toggle');
    press('warmup-preset-new');

    // Empty name
    press('warmup-preset-save');
    expect(screen.getByTestId('warmup-editor-error')).toHaveTextContent(WARMUP_COPY['WP-17'].missingName);

    // Name set, 0 items
    type('warmup-preset-name-input', 'Test Routine');
    press('warmup-preset-save');
    expect(screen.getByTestId('warmup-editor-error')).toHaveTextContent(WARMUP_COPY['WP-17'].emptyItems);

    // Missing custom title
    press('warmup-tab-custom');
    press('warmup-item-add');
    expect(screen.getByTestId('warmup-editor-error')).toHaveTextContent(WARMUP_COPY['WP-17'].missingCustomTitle);

    // 12-item cap
    press('warmup-tab-built-in');
    for (let i = 0; i < MAX_WARMUP_PRESET_ITEMS; i += 1) {
      press(`warmup-source-drill-${PREPARATION_CATALOG_DRILLS[0].itemId}`);
      press('warmup-item-add');
    }
    expect(screen.getByTestId('warmup-items-heading')).toHaveTextContent(WARMUP_COPY['WP-11'](12));
    press(`warmup-source-drill-${PREPARATION_CATALOG_DRILLS[0].itemId}`);
    press('warmup-item-add');
    expect(screen.getByTestId('warmup-editor-error')).toHaveTextContent(WARMUP_COPY['WP-17'].itemCap);
    press('warmup-preset-cancel');

    // 24-preset cap
    act(() => {
      for (let i = 0; i < MAX_WARMUP_PRESETS; i += 1) {
        expect(state().saveWarmupPreset(draft({ name: `Preset ${i + 1}` }))).toBe(true);
      }
    });
    press('warmup-preset-new');
    type('warmup-preset-name-input', 'Preset 25');
    press('warmup-tab-built-in');
    press(`warmup-source-drill-${PREPARATION_CATALOG_DRILLS[0].itemId}`);
    press('warmup-item-add');
    press('warmup-preset-save');
    expect(screen.getByTestId('warmup-editor-error')).toHaveTextContent(WARMUP_COPY['WP-17'].presetCap);
    expect(state().warmupPresets).toHaveLength(MAX_WARMUP_PRESETS);
  });
});

describe('Real SQLite + useStore session preparation integration', () => {
  test('assigned preset with includeRampSets=true freezes preset items + 40%/80% ramps and displays in PreparationPanel', () => {
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    expect(state().todayPlan).not.toBeNull();
    const todayFocus = state().todayPlan.focus;

    expect(state().saveWarmupPreset(draft({
      name: 'Session Prep',
      purpose: 'prehab',
      weaknessTarget: 'hip_groin',
      includeRampSets: true,
      items: [
        item({ sourceKind: 'custom_physio', catalogDrillId: null, title: '90-90 hip switch', sets: 2, doseKind: 'reps', doseAmount: 8, perSide: true, cueNote: 'Slow control' }),
      ],
    }))).toBe(true);
    const presetId = state().warmupPresets[0].presetId;
    expect(state().setWarmupSessionTypeAssignment(todayFocus, presetId)).toBe(true);

    state().startSession();
    expect(state().error).toBeNull();
    const prep = state().preparation;
    expect(prep).not.toBeNull();
    expect(prep.protocol.policyId).toBe('athlete-warmup-preset');
    const itemIds = prep.protocol.items.map((x) => x.itemId);
    expect(itemIds[0]).toBe('preset.custom_0');
    expect(itemIds.some((id) => id.startsWith('ramp.'))).toBe(true);

    render(
      <PreparationPanel
        preparation={prep}
        onBegin={jest.fn()}
        onRecordItem={jest.fn()}
        onFinish={jest.fn()}
        onStopSession={jest.fn()}
      />,
    );
    expect(screen.getByText(WARMUP_COPY['WP-23']('Session Prep', WARMUP_PURPOSE_LABEL.prehab))).toBeOnTheScreen();
    expect(screen.getByText(WARMUP_COPY['WP-24'](PREHAB_TARGET_LABEL.hip_groin))).toBeOnTheScreen();
    expect(screen.getByText(/90-90 hip switch/)).toBeOnTheScreen();
  });

  test('includeRampSets=false freezes preset items ONLY without rehearsal or ramp sets', () => {
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const todayFocus = state().todayPlan.focus;

    expect(state().saveWarmupPreset(draft({
      name: 'No Ramp Prep',
      purpose: 'rehab',
      includeRampSets: false,
      items: [
        item({ sourceKind: 'custom_physio', catalogDrillId: null, title: 'Physio hold', sets: 1, doseKind: 'time', doseAmount: 30, perSide: false, cueNote: null }),
      ],
    }))).toBe(true);
    const presetId = state().warmupPresets[0].presetId;
    expect(state().setWarmupSessionTypeAssignment(todayFocus, presetId)).toBe(true);

    state().startSession();
    const stages = state().preparation.protocol.items.map((x) => x.stage);
    expect(stages).toEqual(['activate']);
    expect(stages).not.toContain('rehearse');
    expect(stages).not.toContain('ramp');
  });

  test('planned session override (standard_auto or another preset) wins over session-type default, and free_form override resets after commit', () => {
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const plannedId = state().todayPlan.plannedSessionId;
    const todayFocus = state().todayPlan.focus;

    expect(state().saveWarmupPreset(draft({ name: 'Default Preset' }))).toBe(true);
    expect(state().saveWarmupPreset(draft({
      name: 'Override Preset',
      items: [item({ sourceKind: 'custom_physio', catalogDrillId: null, title: 'Override drill' })],
    }))).toBe(true);
    const [p1, p2] = state().warmupPresets;
    expect(state().setWarmupSessionTypeAssignment(todayFocus, p1.presetId)).toBe(true);

    // Override planned session to standard_auto
    expect(state().setPlannedSessionWarmupOverride(plannedId, { mode: 'standard_auto', presetId: null })).toBe(true);
    state().startSession();
    expect(state().preparation.protocol.policyId).toBe('ramp-general');
    state().finishPreparation('already_warm', state().preparation.revision);
    const firstSlot = state().sessionPlan[0];
    state().logSet(
      firstSlot.movementId,
      firstSlot.target.kind === 'reps' ? firstSlot.target.reps : 1,
      40,
      7,
      undefined,
      undefined,
      undefined,
      firstSlot.target.kind === 'time' ? { timeS: firstSlot.target.seconds } : undefined,
      firstSlot.sessionPlanSlotId,
    );
    expect(state().error).toBeNull();
    expect(state().session.sets).toHaveLength(1);
    state().runnerHalt();
    state().endSession();
    expect(state().error).toBeNull();
    expect(state().session).toBeNull();

    // Override free_form start to p2
    state().setFreeFormWarmupOverride({ mode: 'preset', presetId: p2.presetId });
    expect(state().freeFormWarmupOverride).toEqual({ mode: 'preset', presetId: p2.presetId });
    state().startSession();
    expect(state().preparation.protocol.policyId).toBe('athlete-warmup-preset');
    expect(state().preparation.protocol.basis.join(' ')).toContain('Override Preset');
    expect(state().freeFormWarmupOverride).toBeNull();
  });

  test('Coach Mode switchAthlete isolates presets & assignments, and resetTrainingData preserves presets while clearing planned overrides', async () => {
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const plannedId = state().todayPlan.plannedSessionId;

    expect(state().saveWarmupPreset(draft({ name: 'Athlete A Preset' }))).toBe(true);
    const presetAId = state().warmupPresets[0].presetId;
    expect(state().setWarmupSessionTypeAssignment('lower', presetAId)).toBe(true);
    expect(state().setPlannedSessionWarmupOverride(plannedId, { mode: 'preset', presetId: presetAId })).toBe(true);

    // Switch to Athlete B -> isolated empty presets
    expect(await state().switchAthlete('athlete-b')).toBe(true);
    await settle();
    expect(state().status).toBe('ready');
    expect(state().warmupPresets).toEqual([]);
    expect(state().warmupSessionTypeAssignments).toEqual({});
    expect(state().plannedSessionWarmupOverrides).toEqual({});

    // Switch back to Athlete A -> preserved
    expect(await state().switchAthlete('default')).toBe(true);
    await settle();
    expect(state().warmupPresets).toHaveLength(1);
    expect(state().warmupPresets[0].name).toBe('Athlete A Preset');
    expect(state().warmupSessionTypeAssignments.lower).toBe(presetAId);
    expect(state().plannedSessionWarmupOverrides[plannedId]).toEqual({ mode: 'preset', presetId: presetAId });

    // resetTrainingData preserves presets & assignments, clears planned override & freeForm override
    state().setFreeFormWarmupOverride({ mode: 'preset', presetId: presetAId });
    expect(state().resetTrainingData()).toBe(true);
    expect(state().warmupPresets).toHaveLength(1);
    expect(state().warmupSessionTypeAssignments.lower).toBe(presetAId);
    expect(state().plannedSessionWarmupOverrides).toEqual({});
    expect(state().freeFormWarmupOverride).toBeNull();
  });
});

describe('UI Laws: zero hex literals, >=56pt touch targets, Dynamic Type fontScale=2.0', () => {
  test('WarmupPresetsPanel.tsx and TodayScreen.tsx contain zero hex literals or traffic-light tokens', () => {
    const panelSrc = fs.readFileSync(path.resolve(__dirname, '../../src/components/WarmupPresetsPanel.tsx'), 'utf8');
    const todaySrc = fs.readFileSync(path.resolve(__dirname, '../../src/screens/TodayScreen.tsx'), 'utf8');
    for (const source of [panelSrc, todaySrc]) {
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      expect(codeOnly).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(codeOnly).not.toMatch(/\bpalette\.(red|amber|green)\b/);
    }
  });

  test('renders cleanly at fontScale=2.0 with minHeight >= 56 on interactive controls', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    expect(state().saveWarmupPreset(draft({ name: 'Dynamic Type Preset' }))).toBe(true);
    render(<WarmupPresetsPanel />);
    press('warmup-presets-toggle');
    press('warmup-preset-new');

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const flat = StyleSheet.flatten(btn.props.style) || {};
      const minH = Math.max(flat.minHeight ?? 0, flat.height ?? 0);
      expect(minH).toBeGreaterThanOrEqual(56);
    }
    expect(screen.getByText(WARMUP_COPY['WP-06'].label)).toBeOnTheScreen();
    expect(screen.getByText(WARMUP_COPY['WP-18'].heading)).toBeOnTheScreen();
    expect(screen.getByText(WARMUP_SESSION_TYPE_LABEL.bjj)).toBeOnTheScreen();
  });
});
