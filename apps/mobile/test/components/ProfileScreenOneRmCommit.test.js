// #224: on Android, closing the keyboard with Back does not end editing, so a
// typed one-rep max was dropped when the athlete left Profile. The typed value
// must also be saved on keyboard hide, on blur and on unmount, once.
import React from 'react';
import { Keyboard } from 'react-native';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider } from '../../src/navigation/navigation';
import ProfileScreen from '../../src/screens/ProfileScreen';
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

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};

let keyboardListeners;
let keyboardSpy;
let save;
let ohpId;

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
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  ohpId = useStore.getState().movements.find((m) => m.name === 'Overhead Press').movement_id;
  save = jest.fn(useStore.getState().saveOneRepMax);
  useStore.setState({ saveOneRepMax: save });
  keyboardListeners = {};
  keyboardSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
    (keyboardListeners[event] ??= []).push(handler);
    return { remove: () => { keyboardListeners[event] = keyboardListeners[event].filter((h) => h !== handler); } };
  });
});

afterEach(() => {
  keyboardSpy.mockRestore();
});

const renderProfile = () => render(
  <NavigationProvider initialTab="athlete">
    <ProfileScreen />
  </NavigationProvider>,
);
const ohp = () => screen.getByLabelText('OHP one rep max in kilograms, type to set');
const hideKeyboard = () => act(() => { (keyboardListeners.keyboardDidHide ?? []).forEach((handler) => handler({})); });

describe('ProfileScreen one-rep max commits typed text without endEditing (#224)', () => {
  test('Android Back (keyboard hide) saves the typed OHP max', () => {
    renderProfile();
    fireEvent.changeText(ohp(), '80');
    hideKeyboard();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ohpId, 80);
    expect(useStore.getState().oneRepMaxes[ohpId]).toBe(80);
    expect(ohp().props.value).toBe('80.0');
  });

  test('leaving Profile (unmount) saves typed text over a saved max', () => {
    useStore.getState().saveOneRepMax(ohpId, 80);
    save.mockClear();
    const view = renderProfile();
    fireEvent.changeText(ohp(), '85');
    view.unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ohpId, 85);
    expect(useStore.getState().oneRepMaxes[ohpId]).toBe(85);
  });

  test('blur saves the typed OHP max', () => {
    renderProfile();
    fireEvent.changeText(ohp(), '80');
    fireEvent(ohp(), 'blur');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ohpId, 80);
  });

  test('Enter followed by blur, keyboard hide and unmount saves once', () => {
    const view = renderProfile();
    fireEvent.changeText(ohp(), '80');
    fireEvent(ohp(), 'endEditing');
    fireEvent(ohp(), 'blur');
    hideKeyboard();
    view.unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ohpId, 80);
  });

  test('hiding the keyboard or leaving with nothing typed saves nothing', () => {
    useStore.getState().saveOneRepMax(ohpId, 80);
    save.mockClear();
    const view = renderProfile();
    hideKeyboard();
    fireEvent(ohp(), 'blur');
    view.unmount();
    expect(save).not.toHaveBeenCalled();
    expect(useStore.getState().oneRepMaxes[ohpId]).toBe(80);
  });

  test('an invalid entry is handled on keyboard hide exactly as on endEditing', () => {
    useStore.getState().saveOneRepMax(ohpId, 80);
    save.mockClear();
    renderProfile();
    fireEvent.changeText(ohp(), 'abc');
    hideKeyboard();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ohpId, null);
    expect(save).not.toHaveBeenCalledWith(ohpId, expect.any(Number));
    expect(ohp().props.value).toBe('');
  });
});
