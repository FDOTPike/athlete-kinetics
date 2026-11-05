/**
 * Issue #225: in Plan > Routine templates > "+ Build new routine template",
 * Android Back closed the builder and lost a typed draft without asking, and a
 * save returned to the top of Plan with no message.
 *
 * Back (and Cancel) with unsaved changes now asks "Discard this routine?";
 * with no changes Back closes the builder as before. A save returns to the
 * Routine templates section and says "Saved: <name>".
 */
import React from 'react';
import { Alert, BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';
import { NavigationProvider } from '../../src/navigation/navigation';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
  formatTeachingOnlyReason: () => 'Teaching only.',
}));

const TODAY = '2026-12-01';

const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};

const movements = [
  { movement_id: 1, name: 'Competition Bench', baseName: 'Bench', pattern: 'push_h', cues: 'Brace', targetMuscles: ['chest'], difficulty: 'Advanced' },
  { movement_id: 2, name: 'Barbell Row', baseName: 'Row', pattern: 'pull_h', cues: 'Pull', targetMuscles: ['lats'], difficulty: 'Intermediate' },
];

const available = (movementId) => ({
  movementId, state: 'available', reasons: [], effectiveContext: 'weight_room',
  capabilitySource: 'not_required', blockingPrerequisiteMovementIds: [],
  confirmationWouldClear: false, separateAttestationRequired: false,
});

const planningContract = () => ({
  liftFamilies: movements.map((movement) => ({
    movementId: movement.movement_id,
    family: movement.name.includes('Row') ? 'horizontal_pull' : 'overhead_press',
    stressCoefficient: 1,
    preferredPurpose: null,
  })),
  assistance: movements.flatMap((movement) => ['horizontal_pull', 'overhead_press'].map((family) => ({
    family, movementId: movement.movement_id, distance: 1, stressFactor: 0.4, fatigueCost: 2,
    reason: 'Test fixture direct assistance.',
  }))),
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength', training_age: 'advanced', weekly_frequency: 3,
    equipment_inventory: ['barbell'], base_rpe_cap: 9, session_duration_cap_min: 60,
  },
  vector,
  prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5 } },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  block: null,
  blockMeta: null,
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  niggles: [],
  // Routine builder
  movements,
  saveRoutineTemplate: jest.fn((input) => ({
    routineTemplateId: 10, name: input.name, schemaType: input.schemaType, createdAtMs: 1, updatedAtMs: 1,
    slots: input.slots.map((slot, index) => ({ routineTemplateSlotId: index + 1, routineTemplateId: 10, ...slot })),
  })),
  getMovementAvailabilityVerdicts: () => [available(1), available(2)],
  getRoutineRoleEligibleMovementIds: () => ({ major: [1], supplementary: [1, 2], accessory: [], conditional: [] }),
  getRoutinePlanningContract: planningContract,
  movementAvailabilityRevision: 0,
  activePriorExperienceMovementIds: [],
  confirmMovementPriorExperience: jest.fn(() => true),
  revokeMovementPriorExperience: jest.fn(() => true),
  ...overrides,
});

// Capture the hardwareBackPress listener NavigationProvider registers, then
// press it the way Android does (newest listener first).
function captureHardwareBack() {
  const listeners = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((eventName, listener) => {
    if (eventName === 'hardwareBackPress') listeners.push(listener);
    return { remove: () => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } };
  });
  return {
    press: () => {
      let handled = false;
      act(() => {
        for (let index = listeners.length - 1; index >= 0 && !handled; index -= 1) handled = listeners[index]() === true;
      });
      return handled;
    },
    restore: () => spy.mockRestore(),
  };
}

let back;
let alertSpy;

beforeEach(() => {
  mockState = baseState();
  back = captureHardwareBack();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  back.restore();
  alertSpy.mockRestore();
});

const renderPlan = () => render(
  <NavigationProvider initialTab="coach">
    <BlockScreen />
  </NavigationProvider>,
);

const openBuilder = () => {
  fireEvent.press(screen.getByText('Routine templates'));
  fireEvent.press(screen.getByLabelText('Build new routine template'));
  expect(screen.getByText('Build Routine Template')).toBeOnTheScreen();
};

const pressAlertButton = (text) => {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];
  const button = buttons.find((candidate) => candidate.text === text);
  act(() => { button.onPress?.(); });
};

test('#225: Back with a typed name asks before discarding, and "Keep editing" keeps the name', () => {
  renderPlan();
  openBuilder();
  fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Heavy Upper');

  expect(back.press()).toBe(true);
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(alertSpy.mock.calls[0][0]).toBe('Discard this routine?');
  expect(alertSpy.mock.calls[0][2].map((button) => button.text)).toEqual(['Keep editing', 'Discard']);
  // Still in the builder while the question is open.
  expect(screen.getByText('Build Routine Template')).toBeOnTheScreen();

  pressAlertButton('Keep editing');
  expect(screen.getByText('Build Routine Template')).toBeOnTheScreen();
  expect(screen.getByLabelText('Routine template name').props.value).toBe('Heavy Upper');
});

test('#225: "Discard" closes the builder and drops the draft', () => {
  renderPlan();
  openBuilder();
  fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Heavy Upper');
  back.press();
  pressAlertButton('Discard');

  expect(screen.queryByText('Build Routine Template')).toBeNull();
  expect(mockState.saveRoutineTemplate).not.toHaveBeenCalled();
});

test('#225: Cancel with unsaved changes asks the same question', () => {
  renderPlan();
  openBuilder();
  fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Heavy Upper');
  fireEvent.press(screen.getByLabelText('Cancel editing'));

  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(alertSpy.mock.calls[0][0]).toBe('Discard this routine?');
  expect(screen.getByText('Build Routine Template')).toBeOnTheScreen();
});

test('#225: Back with no changes closes the builder without asking', () => {
  renderPlan();
  openBuilder();

  expect(back.press()).toBe(true);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(screen.queryByText('Build Routine Template')).toBeNull();
  expect(screen.getByText('Routine templates')).toBeOnTheScreen();
});

test('#225: a save returns to Routine templates and shows "Saved: Heavy Upper"', () => {
  renderPlan();
  openBuilder();
  fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Heavy Upper');
  fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
  fireEvent.press(screen.getByText('Competition Bench'));
  fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));
  fireEvent.press(screen.getByText('Barbell Row'));
  fireEvent.press(screen.getByLabelText('Remove day 1 slot 3'));
  fireEvent.press(screen.getByLabelText('Save routine template'));

  expect(mockState.saveRoutineTemplate).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Build Routine Template')).toBeNull();
  expect(alertSpy).not.toHaveBeenCalled();
  // The Routine templates section is open with the confirmation in it.
  expect(screen.getByRole('button', { name: 'Routine templates' }).props.accessibilityState).toMatchObject({ expanded: true });
  expect(screen.getByText('Saved: Heavy Upper')).toBeOnTheScreen();
});
