/**
 * AthleteSwapProfileRender.test.js — Profile must survive an athlete file swap
 * without reading the database the swap has closed.
 *
 * Observed 2026-09-14 on a QA build (Android 15 emulator, 1d44acb): Profile ->
 * seven taps on BUILD -> MANAGE ATHLETES -> ADD ATHLETE replaced the app with
 * the root error boundary, "APP ERROR / kinetics db not booted", with the stack
 * getDb <- getMovementAvailabilityVerdicts <- useMemo <- ProfileScreen.
 *
 * createAthlete and switchAthlete share one shape: save the registry, close the
 * database and null the module handle, publish PER_ATHLETE_RESET, call boot().
 * boot() awaits a registry read before it opens anything, and React renders the
 * reset inside that gap, against no database at all. ProfileScreen is the
 * screen that starts the swap, so it is always mounted for it.
 *
 * Boots the REAL zustand store against the REAL migration chain and mounts the
 * REAL ProfileScreen, in the shape SuspensionResetAndSwitch.test.js
 * established: only the op-sqlite handle (node:sqlite, keyed by file name) and
 * the athlete-registry IO shell are replaced. The registry seam can HOLD the
 * read boot() makes after a swap, which pins the closed-database window open
 * while the test renders and inspects it. On a device that window is a file
 * read; here it is explicit, so a pass cannot come from winning a race.
 *
 * Expected to FAIL against b94053b.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import { useStore } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

const ATHLETE_A = 'default';
const ATHLETE_B = 'athlete-b';
const DB_A = 'athlete_kinetics.db';
const DB_B = 'athlete_b.db';
const CLOSED = 'kinetics db not booted';

// The first ProfileScreen render in a fresh jest worker pays several seconds of
// one-time module loading, which on its own exceeds jest's 5 s default (a store
// boot is a small fraction of that). ProfileScreens.test.js pays the same cost
// but its first test is synchronous, so the timeout cannot interrupt it; these
// tests are async, so whichever renders first would fail before asserting.
jest.setTimeout(60_000);

/** dbName -> driver: one database per athlete, created on first open. */
let drivers;
/** dbNames whose next open() throws, simulating a boot failure. */
let openFails;
let mockRegistry;
/** Arms a hold on the registry read that follows the next registry save. */
let mockHoldBootRead;
/** The held read, while it is held. */
let mockBootRead;

// Function DECLARATIONS: the jest.mock factories below are hoisted above this
// file's imports and must be able to reach them.
function mockDriverFor(name) {
  if (openFails.has(name)) {
    openFails.delete(name);
    throw new Error(`simulated DB boot failure for ${name}`);
  }
  if (!drivers.has(name)) drivers.set(name, makeNodeSqliteDriver());
  return drivers.get(name);
}

function mockDeferred() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
}

jest.mock('@op-engineering/op-sqlite', () => ({
  open: ({ name }) => mockDriverFor(name),
}));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => {
    if (mockBootRead !== null) await mockBootRead.promise;
    return mockRegistry;
  },
  // A swap saves the registry, closes the database, publishes the reset and
  // calls boot(), whose first act is loadRegistry(). Holding that read holds
  // the database closed.
  saveRegistry: async (next) => {
    mockRegistry = next;
    if (mockHoldBootRead) {
      mockHoldBootRead = false;
      mockBootRead = mockDeferred();
    }
    return true;
  },
}));

const store = () => useStore.getState();

/** The real read implementations, captured before any test wraps them. */
const REAL = {
  getMovementAvailabilityVerdicts: store().getMovementAvailabilityVerdicts,
  loadMeasuredHistory: store().loadMeasuredHistory,
  loadRecentOutcomes: store().loadRecentOutcomes,
};
const ALL_READS = Object.keys(REAL).sort();

/** Every read ProfileScreen makes through the store, stamped with the store
 *  lifecycle at the moment it was made. The real implementations still run. */
let reads;
const observeReads = () => {
  reads = [];
  const stamped = (name) => (...args) => {
    const { status, activeAthleteId } = useStore.getState();
    reads.push({ name, status, athlete: activeAthleteId });
    return REAL[name](...args);
  };
  useStore.setState(Object.fromEntries(Object.keys(REAL).map((name) => [name, stamped(name)])));
};
const readNamesFor = (athleteId) => [...new Set(reads
  .filter((r) => r.status === 'ready' && r.athlete === athleteId)
  .map((r) => r.name))].sort();

/** Stands in for App.tsx's module-private RootErrorBoundary: the same
 *  getDerivedStateFromError contract and the same visible fallback, plus a
 *  record of what it caught. */
let caught;
class RootBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    caught.push(error.message);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <View>
          <Text>APP ERROR</Text>
          <Text>{String(this.state.error.message)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

let consoleError;
/** A read that throws reaches the boundary; a read that is caught and logged
 *  (loadRecentOutcomes) only reaches console.error. Both are reads of a closed
 *  database, so both are collected. */
const closedDatabaseLogs = () => consoleError.mock.calls
  .map((args) => args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '))
  .filter((line) => line.includes(CLOSED));

const expectNoClosedDatabaseRead = () => {
  expect(caught).toEqual([]);
  expect(screen.queryByText('APP ERROR')).toBeNull();
  expect(closedDatabaseLogs()).toEqual([]);
  expect(reads.filter((r) => r.status !== 'ready')).toEqual([]);
};

/** The precondition that lets this file fail at all: inside the window the
 *  store's handle really is closed, so any read the screen made would throw. */
const expectDatabaseClosed = () => {
  expect(() => REAL.getMovementAvailabilityVerdicts('library')).toThrow(CLOSED);
};

/** Drain every pending continuation INSIDE act, so each store update an async
 *  action makes is rendered, and its effects run, before the test looks. */
const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
  });
};

const bootRealStore = async () => {
  useStore.setState({ status: 'booting', error: null });
  store().boot();
  await settle();
  expect(store().status).toBe('ready');
};

const mountProfile = async () => {
  observeReads();
  render(<RootBoundary><ProfileScreen /></RootBoundary>);
  await settle();
  expectNoClosedDatabaseRead();
  // Not vacuous: every read under observation really runs on a booted store.
  expect(readNamesFor(store().activeAthleteId)).toEqual(ALL_READS);
};

const releaseBootRead = async () => {
  mockBootRead.release();
  mockBootRead = null;
  await settle();
};

const twoAthleteRegistry = () => ({
  version: 1,
  activeId: ATHLETE_A,
  advancedToolsUnlocked: true,
  athletes: [
    { id: ATHLETE_A, name: 'Athlete A', dbName: DB_A, createdAtMs: 0 },
    { id: ATHLETE_B, name: 'Athlete B', dbName: DB_B, createdAtMs: 1 },
  ],
});

beforeEach(() => {
  drivers = new Map();
  openFails = new Set();
  mockHoldBootRead = false;
  mockBootRead = null;
  caught = [];
  consoleError = jest.spyOn(console, 'error');
  mockRegistry = {
    version: 1,
    activeId: ATHLETE_A,
    advancedToolsUnlocked: false,
    athletes: [{ id: ATHLETE_A, name: 'Athlete A', dbName: DB_A, createdAtMs: 0 }],
  };
});

afterEach(async () => {
  // A failing test must not leave boot() parked: bootInFlight would stay set
  // and every later boot in this file would silently no-op.
  if (mockBootRead !== null) await releaseBootRead();
});

test('ADD ATHLETE: Profile never reads the closed database, then reads the new athlete', async () => {
  await bootRealStore();
  await mountProfile();

  // The QA path, through the real controls.
  for (let i = 0; i < 7; i += 1) fireEvent.press(screen.getByLabelText('Build 0.1.0'));
  await settle();
  expect(store().advancedToolsUnlocked).toBe(true);
  fireEvent.press(screen.getByLabelText('Coach mode, 1 athletes, collapsed'));
  fireEvent.changeText(screen.getByLabelText("New athlete's name"), 'Second');

  mockHoldBootRead = true;
  fireEvent.press(screen.getByLabelText('Add a new athlete'));
  await settle();

  // Inside the window: the reset is published and rendered, the registry names
  // the new athlete, and nothing has been reopened.
  const created = store().athletes.find((a) => a.name === 'Second');
  expect(created).toBeDefined();
  expect(mockBootRead).not.toBeNull();
  expect(store().status).toBe('booting');
  expect(store().activeAthleteId).toBe(created.id);
  expect(drivers.has(created.dbName)).toBe(false);
  expectDatabaseClosed();
  expectNoClosedDatabaseRead();
  expect(screen.getByText('ATHLETE PROFILE')).toBeOnTheScreen();

  await releaseBootRead();

  expect(store().status).toBe('ready');
  expect(store().error).toBeNull();
  expect(drivers.has(created.dbName)).toBe(true);
  // A brand-new file has never saved a profile: this athlete goes to onboarding.
  expect(store().onboarded).toBe(false);
  expectNoClosedDatabaseRead();
  // Once the new file is open, the screen reads IT rather than keeping what it
  // held for the previous athlete.
  expect(readNamesFor(created.id)).toEqual(ALL_READS);
});

test('switching athletes: Profile never reads the closed database, then reads the new athlete', async () => {
  mockRegistry = twoAthleteRegistry();
  await bootRealStore();
  await mountProfile();
  fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));

  mockHoldBootRead = true;
  fireEvent.press(screen.getByLabelText('Athlete Athlete B, tap to switch'));
  await settle();

  expect(mockBootRead).not.toBeNull();
  expect(store().status).toBe('booting');
  expect(store().activeAthleteId).toBe(ATHLETE_B);
  expect(drivers.has(DB_B)).toBe(false);
  expectDatabaseClosed();
  expectNoClosedDatabaseRead();
  expect(screen.getByText('ATHLETE PROFILE')).toBeOnTheScreen();

  await releaseBootRead();

  expect(store().status).toBe('ready');
  expect(store().error).toBeNull();
  expect(drivers.has(DB_B)).toBe(true);
  expectNoClosedDatabaseRead();
  expect(readNamesFor(ATHLETE_B)).toEqual(ALL_READS);
});

test('a switch whose boot fails leaves the database closed, and Profile still never reads it', async () => {
  mockRegistry = twoAthleteRegistry();
  await bootRealStore();
  await mountProfile();
  fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));

  openFails.add(DB_B);
  fireEvent.press(screen.getByLabelText('Athlete Athlete B, tap to switch'));
  await settle();

  // 'error', not 'booting': a guard that only waited out the swap reads here.
  expect(store().status).toBe('error');
  expect(store().error).toBe(`simulated DB boot failure for ${DB_B}`);
  expectDatabaseClosed();
  expectNoClosedDatabaseRead();
  expect(screen.getByText('ATHLETE PROFILE')).toBeOnTheScreen();
});
