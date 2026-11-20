/**
 * OnboardingKeyboardFooter.test.js — issue #379: OnboardingScreen's
 * KeyboardAwareScrollView sits above a sticky Back/Next footer (and optional
 * gate notice), so extraScrollHeight must include the footer height and update
 * when the footer container resizes.
 */
import React from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT } from '../../src/components/KeyboardAwareScrollView';
import OnboardingScreen, { ONBOARDING_FOOTER_MIN_HEIGHT } from '../../src/screens/OnboardingScreen';
import { theme } from '../../src/theme/theme';
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
const state = () => useStore.getState();
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const next = () => pressLabel('Next');

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
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 }],
  };
  useStore.setState({
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    runner: null,
    focus: null,
    goals: [],
    block: null,
    program: null,
    todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

describe('#379 OnboardingScreen keyboard footer clearance', () => {
  test('ONBOARDING_FOOTER_MIN_HEIGHT matches styles.footer tokens (85 on iOS, 81 on Android)', () => {
    const expected = 1 + theme.space[3] + theme.touch.min + (Platform.OS === 'ios' ? theme.space[4] : theme.space[3]);
    expect(ONBOARDING_FOOTER_MIN_HEIGHT).toBe(expected);
  });

  test('onboarding-scroll-view reserves footer height in keyboard-extra-scroll-space and updates when onboarding-footer-container resizes', () => {
    render(<OnboardingScreen />);

    const initialExpected = DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT + ONBOARDING_FOOTER_MIN_HEIGHT;
    const spacerHeight = () =>
      StyleSheet.flatten(screen.getByTestId('keyboard-extra-scroll-space', { includeHiddenElements: true }).props.style).height;
    expect(spacerHeight()).toBe(initialExpected);
    expect(spacerHeight()).toBeGreaterThan(DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT);

    const footerContainer = screen.getByTestId('onboarding-footer-container');
    act(() => {
      fireEvent(footerContainer, 'layout', { nativeEvent: { layout: { width: 414, height: 149 } } });
    });

    const updatedExpected = DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT + 149;
    expect(spacerHeight()).toBe(updatedExpected);
  });

  test('Step 4 sport-minutes and Step 6 OneRmRow inputs render inside onboarding-scroll-view with footer clearance', () => {
    render(<OnboardingScreen />);
    const spacerHeight = () =>
      StyleSheet.flatten(screen.getByTestId('keyboard-extra-scroll-space', { includeHiddenElements: true }).props.style).height;
    next(); // welcome -> goal
    next(); // goal -> focus
    fireEvent.press(screen.getByTestId('onboarding-wants-sport'));
    next(); // focus -> sport

    fireEvent.press(screen.getByTestId('sport-family-grappling'));
    fireEvent.press(screen.getByTestId('sport-grappling_bjj'));
    fireEvent.press(screen.getByTestId('sport-outcome-strength_for_contact'));
    fireEvent.press(screen.getByTestId('sport-experience-2_to_5_years'));

    const sportMinutes = screen.getByTestId('sport-minutes');
    expect(sportMinutes.props.keyboardType).toBe('number-pad');
    expect(spacerHeight())
      .toBeGreaterThanOrEqual(DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT + ONBOARDING_FOOTER_MIN_HEIGHT);

    next(); // sport -> experience
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
    next(); // experience -> maxes (default SOME MILEAGE)

    expect(screen.getByTestId('onboarding-maxes-step')).toBeTruthy();
    for (const lift of ['SQUAT', 'BENCH', 'DEADLIFT', 'OHP']) {
      expect(screen.getByLabelText(`${lift} one rep max in kilograms, type to set`).props.keyboardType).toBe('numeric');
    }
    expect(spacerHeight())
      .toBeGreaterThanOrEqual(DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT + ONBOARDING_FOOTER_MIN_HEIGHT);
  });

  test('tapping onboarding-header dismisses an open number-pad / numeric keyboard', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    render(<OnboardingScreen />);

    fireEvent(screen.getByTestId('onboarding-header'), 'touchEnd');
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });
});
