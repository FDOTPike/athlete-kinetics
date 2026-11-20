import React from 'react';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
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

describe('Issue #150 — Profile preserves scroll position after sub-views and renders inline athlete switch refusal', () => {
  beforeEach(() => {
    drivers = new Map();
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

  test('closing Terminology Glossary restores ProfileScreen scroll offset', async () => {
    useStore.getState().boot();
    await flush();

    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const tree = render(<ProfileScreen />);
    await flush();

    fireEvent.scroll(tree.getByTestId('keyboard-aware-scroll-view'), {
      nativeEvent: { contentOffset: { x: 0, y: 1240 } },
    });

    fireEvent.press(tree.getByLabelText('Open terminology glossary'));
    expect(tree.queryByText('ATHLETE PROFILE')).toBeNull();

    fireEvent.press(tree.getByLabelText('Back to Athlete Profile'));
    expect(tree.getByText('ATHLETE PROFILE')).toBeOnTheScreen();
    expect(scrollToSpy).toHaveBeenCalledWith({ y: 1240, animated: false });
    scrollToSpy.mockRestore();
  });

  test('refused athlete switch during an active session renders the refusal message inline inside the tapped athlete block', async () => {
    useStore.getState().boot();
    await flush();

    act(() => {
      useStore.getState().startSession();
    });
    expect(useStore.getState().session).not.toBeNull();

    const tree = render(<ProfileScreen />);
    await flush();

    fireEvent.press(tree.getByText('MANAGE ATHLETES'));
    await act(async () => {
      fireEvent.press(tree.getByLabelText('Athlete Second Athlete, tap to switch'));
    });
    await flush();

    const secondAthleteBlock = tree.getByTestId('athlete-block-ath-2');
    expect(
      within(secondAthleteBlock).getByText('End the active session before switching athletes.'),
    ).toBeOnTheScreen();
  });
});
