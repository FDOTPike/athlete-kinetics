/**
 * OnboardingMaxesStep.test.js — issue #218: an optional onboarding step asks
 * for the four maxes from SOME MILEAGE up. It writes the fields Profile writes
 * (one_rep_max), with the same clamp and saved-as message, in the same save as
 * the rest of the interview. It can be skipped, and a beginner never sees it.
 * The REAL store runs behind the screen (node:sqlite stands in for op-sqlite).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
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

// First render of a heavy screen in a fresh jest worker takes several seconds.
jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const raw = () => mockDrivers.get(A).raw;
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const next = () => pressLabel('Next');
const startTraining = () => act(async () => {
  fireEvent.press(screen.getByLabelText('START TRAINING'));
  await settle();
});
const stepLabel = () => screen.getByLabelText(/^Step \d+ of \d+$/).props.accessibilityLabel;
const maxField = (label) => screen.getByLabelText(`${label} one rep max in kilograms, type to set`);
const typeMax = (label, text) => {
  act(() => { fireEvent.changeText(maxField(label), text); });
  act(() => { fireEvent(maxField(label), 'endEditing'); });
};
const idOf = (name) => state().movements.find((m) => m.name === name).movement_id;
const savedMaxes = () => raw().prepare('SELECT movement_id, load_kg FROM one_rep_max ORDER BY movement_id').all()
  .map((r) => [r.movement_id, r.load_kg]);

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

/** welcome -> goal -> focus -> experience. */
const openExperience = () => {
  render(<OnboardingScreen />);
  next();
  next();
  next();
  expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
};
/** From logistics to the review, answering the required limits question. */
const logisticsToReview = () => {
  next(); // logistics -> equipment
  next(); // equipment -> limits
  pressLabel('No, nothing to note');
  next(); // limits -> review
  expect(screen.getByLabelText('START TRAINING')).toBeTruthy();
};

test('SOME MILEAGE sees the optional maxes step after experience; typed maxes are saved with the interview', async () => {
  openExperience();
  pressLabel(/^SOME MILEAGE\./);
  expect(stepLabel()).toBe('Step 4 of 9');
  next();
  expect(screen.getByTestId('onboarding-maxes-step')).toBeTruthy();
  expect(screen.getByText('YOUR ONE-REP MAXES (OPTIONAL)')).toBeTruthy();
  typeMax('SQUAT', '140');
  typeMax('BENCH', '102.5');
  // Nothing is written before the athlete finishes.
  expect(savedMaxes()).toEqual([]);
  next();
  expect(screen.getByText('YOUR WEEK')).toBeTruthy();
  logisticsToReview();
  await startTraining();
  expect(state().onboarded).toBe(true);
  expect(savedMaxes()).toEqual([[idOf('Competition Squat'), 140], [idOf('Competition Bench'), 102.5]].sort((a, b) => a[0] - b[0]));
  expect(state().oneRepMaxes[idOf('Competition Squat')]).toBe(140);
  expect(state().oneRepMaxes[idOf('Competition Bench')]).toBe(102.5);
});

test('the step keeps the Profile clamp and says what is kept', () => {
  openExperience();
  next();
  typeMax('DEADLIFT', '999');
  expect(screen.getByText(/^Saved as 500\.0 kg/)).toBeTruthy();
  expect(maxField('DEADLIFT').props.value).toBe('500.0');
  typeMax('OHP', '12');
  expect(maxField('OHP').props.value).toBe('');
});

test('skipping the step saves no maxes, even ones typed before the skip', async () => {
  openExperience();
  next();
  typeMax('SQUAT', '140');
  pressLabel('Skip one-rep maxes for now');
  expect(screen.getByText('YOUR WEEK')).toBeTruthy();
  logisticsToReview();
  await startTraining();
  expect(state().onboarded).toBe(true);
  expect(savedMaxes()).toEqual([]);
});

test('NEW TO THIS never sees the step, and maxes typed before switching to it are not saved', async () => {
  openExperience();
  next();
  typeMax('SQUAT', '140');
  act(() => { fireEvent.press(screen.getByLabelText('Back')); });
  pressLabel(/^NEW TO THIS\./);
  expect(stepLabel()).toBe('Step 4 of 8');
  next();
  expect(screen.getByText('YOUR WEEK')).toBeTruthy();
  logisticsToReview();
  await startTraining();
  expect(state().onboarded).toBe(true);
  expect(savedMaxes()).toEqual([]);
});
