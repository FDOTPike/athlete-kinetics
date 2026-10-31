import React from 'react';
import { BackHandler } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider, useNavigation } from '../../src/navigation/navigation';
import { AppShell } from '../../src/App';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
jest.mock('../../src/inference/deviceEmbedder', () => ({
  tryCreateDeviceEmbedder: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@ak/biometrics', () => ({
  tryCreateBiometricsBridge: jest.fn(() => Promise.resolve(null)),
  tryCreateHealthConnectBridge: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../src/state/backupStore', () => {
  const safeBackupState = {
    startupSafe: true,
    recoveryAvailable: false,
    status: 'idle',
    message: null,
    preview: null,
    lastSuccessfulBackupAt: null,
    initialize: jest.fn(() => Promise.resolve(true)),
    createBackup: jest.fn(),
    chooseRestore: jest.fn(),
    reviewRecovery: jest.fn(),
    confirmRestore: jest.fn(),
    cancelRestore: jest.fn(),
  };
  const useBackupStore = (selector) => selector(safeBackupState);
  useBackupStore.getState = () => safeBackupState;
  return { useBackupStore };
});

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};

function NavProbe({ onRef }) {
  const nav = useNavigation();
  onRef(nav);
  return null;
}

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

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
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
});

describe('Full-screen ProgramSetupScreen in AppShell intercepts hardware Back and dismisses setup', () => {
  test('pressing hardware Back while BUILD YOUR PROGRAM is open dismisses ProgramSetupScreen instead of popping hidden tabHistory or exiting', async () => {
    const hardwareBack = captureHardwareBack();
    let navRef = null;
    try {
      render(
        <NavigationProvider initialTab="today">
          <NavProbe onRef={(r) => { navRef = r; }} />
          <AppShell />
        </NavigationProvider>,
      );

      await act(async () => {
        await settle();
      });
      expect(useStore.getState().status).toBe('ready');

      // Complete onboarding via demo athlete -> AppShell offers ProgramSetupScreen
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Skip the questionnaire and load the demo athlete'));
        await settle();
      });
      expect(useStore.getState().onboarded).toBe(true);
      expect(screen.getByTestId('program-setup-actions')).toBeOnTheScreen();

      // Start the program so main shell is shown
      act(() => {
        fireEvent.press(screen.getByLabelText('Create program'));
      });
      expect(useStore.getState().block).not.toBeNull();
      expect(screen.queryByTestId('program-setup-actions')).toBeNull();

      // Navigate from TODAY to ATHLETE (ProfileScreen), pushing onto tabHistory: ['today', 'athlete']
      act(() => {
        navRef.setTab('athlete');
      });
      expect(navRef.tab).toBe('athlete');

      // Athlete deletes their current block & state from ProfileScreen ("Confirm delete current block & state")
      act(() => {
        useStore.getState().wipeActiveBlockState();
      });

      // AppShell now presents full-screen BUILD YOUR PROGRAM (showProgramSetup === true)
      expect(screen.getByTestId('program-setup-actions')).toBeOnTheScreen();
      expect(screen.getByLabelText('Cancel')).toBeOnTheScreen();

      // Press hardware Back: should dismiss ProgramSetupScreen (same as onCancel) and stay on 'athlete'
      const handled = hardwareBack.press();

      expect(handled).toBe(true);
      expect(screen.getByText('ATHLETE PROFILE')).toBeOnTheScreen();
      expect({
        tab: navRef.tab,
        programSetupStillVisible: screen.queryByTestId('program-setup-actions') !== null,
      }).toEqual({
        tab: 'athlete',
        programSetupStillVisible: false,
      });
    } finally {
      hardwareBack.restore();
    }
  });
});
