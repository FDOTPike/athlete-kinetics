import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

jest.setTimeout(60_000);

let drivers;
let mockRegistry;
let mockSaveRegistryImpl;

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
      if (mockSaveRegistryImpl) return mockSaveRegistryImpl(next);
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
    mockSaveRegistryImpl = null;
    mockRegistry = {
      version: 1,
      activeId: 'default',
      advancedToolsUnlocked: true,
      athletes: [
        { id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 },
        { id: 'ath-2', name: 'Second Athlete', dbName: 'athlete_2.db', createdAtMs: 2 },
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

  test('asynchronous registry write failures and rejections in create, switch, rename, and delete settle with awaitable results and preserve UI state', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    const tree = render(<ProfileScreen />);
    await flush();

    fireEvent.press(tree.getByText('MANAGE ATHLETES'));

    // 1. ADD ATHLETE with asynchronous saveRegistry returning false:
    mockSaveRegistryImpl = async () => false;
    fireEvent.changeText(tree.getByLabelText("New athlete's name"), 'Jordan');
    await act(async () => {
      fireEvent.press(tree.getByLabelText('Add a new athlete'));
    });
    await flush();

    expect(tree.queryByText('Could not create the athlete — registry write failed.')).toBeTruthy();
    expect(tree.getByLabelText("New athlete's name").props.value).toBe('Jordan');

    // 2. Switch athlete with asynchronous saveRegistry returning false:
    await act(async () => {
      fireEvent.press(tree.getByLabelText('Athlete Second Athlete, tap to switch'));
    });
    await flush();

    expect(tree.queryByText('Could not persist the athlete switch — registry write failed.')).toBeTruthy();

    // 3. Rename athlete with rejected saveRegistry:
    mockSaveRegistryImpl = async () => {
      throw new Error('Registry rename disk error');
    };
    fireEvent.press(tree.getByLabelText('Rename Second Athlete'));
    fireEvent.changeText(tree.getByLabelText('New name for Second Athlete'), 'Renamed Two');
    await act(async () => {
      fireEvent.press(tree.getByLabelText('Save name'));
    });
    await flush();

    expect(useStore.getState().error).toBe('Registry rename disk error');
    expect(tree.queryByText('Registry rename disk error')).toBeTruthy();
    expect(tree.getByLabelText('New name for Second Athlete').props.value).toBe('Renamed Two');
    fireEvent.press(tree.getByLabelText('Cancel rename'));

    // 4. Delete athlete with rejected saveRegistry:
    mockSaveRegistryImpl = async () => {
      throw new Error('Registry delete disk error');
    };
    fireEvent.press(tree.getByLabelText('Delete Second Athlete and their database'));
    expect(tree.getByText('Confirm delete Second Athlete')).toBeTruthy();
    await act(async () => {
      fireEvent.press(tree.getByText('Confirm delete Second Athlete'));
    });
    await flush();

    expect(useStore.getState().error).toBe('Registry delete disk error');
    expect(tree.queryByText('Registry delete disk error')).toBeTruthy();
    expect(tree.getByText('Confirm delete Second Athlete')).toBeTruthy();
  });
});
