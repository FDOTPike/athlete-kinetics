import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  formatTeachingOnlyReason: () => '',
  useStore: (selector) => selector(mockState),
}));

const movement = {
  movement_id: 1,
  name: 'Barbell Back Squat',
  baseName: 'Back Squat',
  pattern: 'squat',
  is_compound: true,
  beginnerOk: true,
  loggingMode: 'reps',
  instructions: 'Brace and squat.',
  cues: 'Drive knees out.',
  media: null,
  targetMuscles: ['quads', 'glutes'],
  coachingIntent: null,
  timePolicy: null,
  required: ['barbell'],
  supportedPrefixes: ['BB'],
  difficulty: 'Intermediate',
  preference: 0,
  progressionGroup: null,
  progressionRank: null,
  scope: null,
  sportTracking: false,
  implement: 'barbell',
};

beforeEach(() => {
  mockState = {
    movements: [movement],
    profile: {
      objective: 'strength',
      training_age: 'intermediate',
      weekly_frequency: 3,
      session_duration_cap_min: 60,
      base_rpe_cap: 9.0,
      equipment_inventory: ['barbell'],
    },
    niggles: [],
    activePriorExperienceMovementIds: [],
    movementAvailabilityRevision: 0,
    saveRoutineTemplate: jest.fn(),
    getMovementAvailabilityVerdicts: jest.fn(() => [
      {
        movementId: 1,
        state: 'available',
        reasons: [],
        missingPrerequisites: [],
        priorExperienceConfirmed: false,
        confirmationWouldClear: false,
        separateAttestationRequired: false,
      },
    ]),
    getRoutineRoleEligibleMovementIds: jest.fn(() => ({
      major: [1],
      supplementary: [1],
      accessory: [1],
      conditional: [1],
    })),
    getRoutinePlanningContract: jest.fn(() => ({
      liftFamilies: [{ movementId: 1, family: 'squat', stressCoefficient: 1.0, preferredPurpose: 'heavy' }],
      assistance: [],
    })),
    confirmMovementPriorExperience: jest.fn(() => true),
    revokeMovementPriorExperience: jest.fn(() => true),
    getTrainingSupportDecision: jest.fn(() => ({ status: 'available', holdIds: [] })),
  };
});

const initialTemplate = {
  routineTemplateId: 10,
  name: 'Squat Day',
  schemaType: 'LINEAR',
  createdAtMs: 1,
  updatedAtMs: 1,
  slots: [
    {
      routineTemplateSlotId: 100,
      routineTemplateId: 10,
      dayIndex: 1,
      slotIndex: 1,
      role: 'major',
      movementId: 1,
      movementName: 'Barbell Back Squat',
      sets: 3,
      reps: 5,
      targetRpe: 8,
      legacyRoleAllowed: false,
    },
  ],
};

test('plan-3: RoutineTemplateBuilder dose inputs allow clearing the field without snapping back to schema default', () => {
  render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);

  const setsInput = screen.getByLabelText('Sets for day 1 slot 1');
  expect(setsInput.props.value).toBe('3');

  // Clearing the Sets input to type a new number should leave the field empty instead of snapping to default "4"
  fireEvent.changeText(setsInput, '');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('');

  // Blurring an empty draft drops the draft so the field shows the stored non-default value again
  fireEvent(screen.getByLabelText('Sets for day 1 slot 1'), 'blur');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('3');

  fireEvent.press(screen.getByLabelText('Save routine template'));
  expect(mockState.saveRoutineTemplate).toHaveBeenCalledWith(
    expect.objectContaining({
      slots: [expect.objectContaining({ sets: 3 })],
    }),
  );
});

test('plan-3: RoutineTemplateBuilder RPE decimal-pad input preserves trailing decimal point while typing', () => {
  render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);

  const rpeInput = screen.getByLabelText('Maximum RPE for day 1 slot 1');

  // Typing "7." on the decimal pad on the way to "7.5" should preserve the trailing decimal point
  fireEvent.changeText(rpeInput, '7.');
  expect(screen.getByLabelText('Maximum RPE for day 1 slot 1').props.value).toBe('7.');

  // Completing the decimal updates the dose, and blurring drops the draft while keeping the new value
  fireEvent.changeText(screen.getByLabelText('Maximum RPE for day 1 slot 1'), '7.5');
  expect(screen.getByLabelText('Maximum RPE for day 1 slot 1').props.value).toBe('7.5');
  fireEvent(screen.getByLabelText('Maximum RPE for day 1 slot 1'), 'blur');
  expect(screen.getByLabelText('Maximum RPE for day 1 slot 1').props.value).toBe('7.5');
});

test('RoutineTemplateBuilder handleSave resolves incomplete focused dose drafts without blur', () => {
  render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);

  const setsInput = screen.getByLabelText('Sets for day 1 slot 1');
  fireEvent.changeText(setsInput, '');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('');

  fireEvent.press(screen.getByLabelText('Save routine template'));

  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe(String(initialTemplate.slots[0].sets));
  expect(mockState.saveRoutineTemplate).toHaveBeenCalledWith(
    expect.objectContaining({
      slots: [expect.objectContaining({ sets: initialTemplate.slots[0].sets })],
    }),
  );
});

test('RoutineTemplateBuilder handleDoseChange normalizes comma decimal separators for RPE input', () => {
  render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);

  const rpeInput = screen.getByLabelText('Maximum RPE for day 1 slot 1');

  fireEvent.changeText(rpeInput, '7,');
  expect(screen.getByLabelText('Maximum RPE for day 1 slot 1').props.value).toBe('7,');

  fireEvent.changeText(screen.getByLabelText('Maximum RPE for day 1 slot 1'), '7,5');
  fireEvent(screen.getByLabelText('Maximum RPE for day 1 slot 1'), 'blur');
  expect(screen.getByLabelText('Maximum RPE for day 1 slot 1').props.value).toBe('7.5');

  fireEvent.press(screen.getByLabelText('Save routine template'));
  expect(mockState.saveRoutineTemplate).toHaveBeenCalledWith(
    expect.objectContaining({
      slots: [expect.objectContaining({ targetRpe: 7.5 })],
    }),
  );
});

test('RoutineTemplateBuilder clears affected dose drafts when loading method, role, or movement resets slot doses', () => {
  render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);

  // 1. Loading method change clears focused draft
  fireEvent.changeText(screen.getByLabelText('Sets for day 1 slot 1'), '9');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('9');
  fireEvent.press(screen.getByLabelText('Undulating loading method'));
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('5');

  // 2. Role change clears focused draft for that slot
  fireEvent.changeText(screen.getByLabelText('Sets for day 1 slot 1'), '9');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('9');
  fireEvent.press(screen.getByLabelText('Set day 1 slot 1 role to conditional'));
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('2');
  fireEvent.press(screen.getByLabelText('Set day 1 slot 1 role to major'));
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('5');

  // 3. Movement selection clears focused draft for that slot
  fireEvent.changeText(screen.getByLabelText('Sets for day 1 slot 1'), '9');
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('9');
  fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
  fireEvent.press(screen.getByLabelText('Choose Barbell Back Squat'));
  expect(screen.getByLabelText('Sets for day 1 slot 1').props.value).toBe('5');
});



