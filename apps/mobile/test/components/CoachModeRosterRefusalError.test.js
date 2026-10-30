import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

jest.setTimeout(60_000);

let drivers;
let mockRegistry;

function mockDriverFor(name) {
  if (!drivers.has(name)) drivers.set(name, makeNodeSqliteDriver());
  return drivers.get(name);
}

jest.mock('@op-engineering/op-sqlite', () => ({
  open: ({ name }) => mockDriverFor(name),
}));

jest.mock('../../src/state/athleteRegistry', () => {
  const actual = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    ...actual,
    loadRegistry: async () => mockRegistry,
    saveRegistry: async (next) => {
      mockRegistry = next;
      return true;
    },
  };
});

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('Coach Mode athlete actions surface store refusal errors and preserve typed input', () => {
  beforeEach(() => {
    drivers = new Map();
    mockRegistry = {
      version: 1,
      activeAthleteId: 'default',
      advancedToolsUnlocked: true,
      athletes: [
        { id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 },
      ],
    };
    authorizeAthleteDataBoot();
    useStore.setState({ status: 'idle', error: null, session: null });
  });

  afterEach(() => {
    for (const d of drivers.values()) {
      try { d.close(); } catch { /* already closed */ }
    }
  });

  test('tapping ADD ATHLETE during an active session preserves typed name and surfaces the refusal error on ProfileScreen', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    // Start an in-progress session so Coach Mode roster mutations are refused by useStore.
    act(() => {
      useStore.getState().startSession();
    });
    expect(useStore.getState().session).not.toBeNull();

    const tree = render(<ProfileScreen />);
    await flush();

    // Open the Athlete Roster inside Coach Mode.
    fireEvent.press(tree.getByText('MANAGE ATHLETES'));

    const input = tree.getByLabelText("New athlete's name");
    fireEvent.changeText(input, 'Jordan');
    expect(tree.getByLabelText("New athlete's name").props.value).toBe('Jordan');

    await act(async () => {
      fireEvent.press(tree.getByLabelText('Add a new athlete'));
    });
    await flush();

    // Store recorded the refusal error and did not add the athlete.
    expect(useStore.getState().error).toBe('End the active session before adding athletes.');
    expect(useStore.getState().athletes.some((a) => a.name === 'Jordan')).toBe(false);

    // Expected: ProfileScreen surfaces the refusal error and does not wipe the typed name.
    expect({
      renderedError: tree.queryByText('End the active session before adding athletes.'),
      inputValue: tree.getByLabelText("New athlete's name").props.value,
    }).toEqual({
      renderedError: expect.anything(),
      inputValue: 'Jordan',
    });
  });
});
