/**
 * SportDraftBack.test.js — #148. Android back while the sport editor is open
 * closes the editor and keeps the athlete on Profile. Unsaved changes are
 * confirmed before they are discarded; an unchanged editor closes quietly.
 */
import React from 'react';
import { Alert, BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider } from '../../src/navigation/navigation';
import { SportPanel } from '../../src/components/SportPanel';
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

jest.setTimeout(60_000);

const state = () => useStore.getState();
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};

// Press the hardware Back the way Android does: newest listener first.
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
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('#148 sport editor: Android back', () => {
  test('back with unsaved sport changes asks first, and Discard closes the editor without saving', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const hardwareBack = captureHardwareBack();
    try {
      render(<NavigationProvider initialTab="athlete"><SportPanel /></NavigationProvider>);
      press('profile-sport-edit');
      press('sport-family-hockey');
      press('sport-hockey_ice');

      expect(hardwareBack.press()).toBe(true);
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0][0]).toBe('Discard this sport?');
      expect(screen.getByTestId('profile-sport-save')).toBeTruthy();
      expect(state().sport).toBeNull();

      const discard = alert.mock.calls[0][2].find((button) => button.text === 'Discard');
      act(() => { discard.onPress(); });
      expect(screen.queryByTestId('profile-sport-save')).toBeNull();
      expect(screen.getByTestId('profile-sport-edit')).toBeTruthy();
      expect(state().sport).toBeNull();
    } finally {
      hardwareBack.restore();
    }
  });

  test('back with an unchanged sport editor closes it without asking', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const hardwareBack = captureHardwareBack();
    try {
      render(<NavigationProvider initialTab="athlete"><SportPanel /></NavigationProvider>);
      press('profile-sport-edit');

      expect(hardwareBack.press()).toBe(true);
      expect(alert).not.toHaveBeenCalled();
      expect(screen.queryByTestId('profile-sport-save')).toBeNull();
      expect(screen.getByTestId('profile-sport-edit')).toBeTruthy();
    } finally {
      hardwareBack.restore();
    }
  });
});
