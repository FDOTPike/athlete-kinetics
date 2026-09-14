/**
 * BackupRecoveryRetryGate.test.js — a persistent startup recovery failure is
 * not a dead end (PR #18 review, P2).
 *
 * The gate offers one bounded "Retry protected recovery" action. It reruns the
 * same startup recovery authority, allows only one attempt at a time, and never
 * authorizes athlete data or boots the store unless recovery succeeds.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AppShellTestHarness from '../../src/AppShellTestHarness';
import { athleteDataBootAllowed, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';

const mockBoot = jest.fn();
let mockInitialize = jest.fn();

jest.mock('../../src/state/useStore', () => {
  const state = {
    status: 'booting', onboarded: true, session: null, block: null, program: null,
    boot: (...args) => mockBoot(...args),
  };
  const useStore = (selector) => selector(state);
  useStore.getState = () => ({
    ...state,
    setEmbedder: () => {},
    connectBiometrics: async () => {},
    rolloverDay: () => {},
    syncBiometrics: async () => {},
  });
  useStore.setState = () => {};
  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    useStore,
    formatTeachingOnlyReason: () => '',
  };
});
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
jest.mock('../../src/inference/deviceEmbedder', () => ({
  tryCreateDeviceEmbedder: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@ak/biometrics', () => ({
  tryCreateHealthConnectBridge: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../src/state/backupStore', () => {
  const state = {
    startupSafe: false,
    message: 'Restore recovery needs attention. Athlete data stays closed to protect the recovery files.',
    initialize: (...args) => mockInitialize(...args),
  };
  const useBackupStore = (selector) => selector(state);
  useBackupStore.getState = () => state;
  return { useBackupStore };
});

const RETRY = 'Retry protected recovery';
let attempts;

beforeEach(() => {
  resetDataMaintenanceLockForTests();
  mockBoot.mockReset();
  attempts = [];
  mockInitialize = jest.fn(() => new Promise((resolve, reject) => attempts.push({ resolve, reject })));
});

const settle = async (attempt, outcome) => {
  await act(async () => {
    if (outcome instanceof Error) attempt.reject(outcome);
    else attempt.resolve(outcome);
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
};

test('a persistent recovery failure offers one bounded retry that keeps athlete data closed until recovery succeeds', async () => {
  render(<AppShellTestHarness />);
  // The startup attempt runs once on mount.
  expect(mockInitialize).toHaveBeenCalledTimes(1);
  await settle(attempts[0], false);

  expect(screen.getByTestId('backup-recovery-gate')).toBeTruthy();
  expect(screen.getByText('RECOVERY NEEDED')).toBeTruthy();
  expect(screen.queryByTestId('shell-root')).toBeNull();

  // One attempt at a time: a second press while retrying starts nothing.
  fireEvent.press(screen.getByLabelText(RETRY));
  fireEvent.press(screen.getByLabelText(RETRY));
  expect(mockInitialize).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText(RETRY).props.accessibilityState.disabled).toBe(true);

  // A retry that fails again keeps athlete data closed and can be retried.
  await settle(attempts[1], false);
  expect(mockBoot).not.toHaveBeenCalled();
  expect(athleteDataBootAllowed()).toBe(false);
  expect(screen.getByLabelText(RETRY).props.accessibilityState.disabled).toBe(false);

  fireEvent.press(screen.getByLabelText(RETRY));
  expect(mockInitialize).toHaveBeenCalledTimes(3);
  await settle(attempts[2], true);
  expect(athleteDataBootAllowed()).toBe(true);
  expect(mockBoot).toHaveBeenCalledTimes(1);
});

test('two retry taps delivered before React re-renders start only one recovery attempt', async () => {
  render(<AppShellTestHarness />);
  await settle(attempts[0], false);
  // On a device both taps can reach onPress before the disabled state renders.
  // Invoke the action twice inside one act, so no re-render separates the calls.
  const retry = screen.UNSAFE_getByProps({ testID: 'backup-recovery-retry' });
  act(() => {
    retry.props.onPress();
    retry.props.onPress();
  });
  expect(mockInitialize).toHaveBeenCalledTimes(2);

  await settle(attempts[1], false);
  expect(mockBoot).not.toHaveBeenCalled();
  expect(athleteDataBootAllowed()).toBe(false);
});

test('a retry whose recovery throws stays closed and is offered again', async () => {
  render(<AppShellTestHarness />);
  await settle(attempts[0], false);

  fireEvent.press(screen.getByLabelText(RETRY));
  await settle(attempts[1], new Error('journal still invalid'));

  expect(mockBoot).not.toHaveBeenCalled();
  expect(athleteDataBootAllowed()).toBe(false);
  expect(screen.getByTestId('backup-recovery-gate')).toBeTruthy();
  expect(screen.getByLabelText(RETRY).props.accessibilityState.disabled).toBe(false);
});
