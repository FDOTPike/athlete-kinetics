/**
 * ProfileEffortCeilingInfo.test.js — #161. The "i" for the effort ceiling
 * (What does RPE mean?) sits on the same label row as "6 · EFFORT CEILING",
 * not on its own row above the duration stepper's label.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

// Every ancestor of a rendered node, nearest first.
const ancestorsOf = (node) => {
  const out = [];
  for (let n = node; n; n = n.parent) out.push(n);
  return out;
};
// The lowest node that contains both a and b.
const sharedAncestor = (a, b) => {
  const inA = new Set(ancestorsOf(a));
  return ancestorsOf(b).find((n) => inA.has(n)) ?? null;
};

describe('#161 Profile: the effort-ceiling info sits on its label row', () => {
  test('the RPE info button shares a row with "6 · EFFORT CEILING" and not with the stepper buttons', () => {
    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const label = screen.getByText('6 · EFFORT CEILING');
    const info = screen.getByLabelText('What does RPE mean?');
    const row = sharedAncestor(label, info);
    expect(row).not.toBeNull();
    // The row that holds the label and the "i" must not hold the stepper's
    // buttons; before the fix it did, because the "i" sat in a row above it.
    expect(row.findAll((n) => n.props.accessibilityLabel === 'Increase 6 · EFFORT CEILING')).toHaveLength(0);
    expect(row.findAll((n) => n.props.accessibilityLabel === 'Decrease 6 · EFFORT CEILING')).toHaveLength(0);
  });
});
