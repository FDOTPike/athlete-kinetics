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
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
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
  // WO-03B: the store boots only after startup restore recovery authorizes
  // athlete data, which App.tsx does before the first boot. These tests start
  // from that authorized state; backup suites own the unauthorized cases.
  authorizeAthleteDataBoot();
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

// ---------------------------------------------------------------------------
// CodeRabbit on PR #16: after a failed boot Profile stays usable — it is where
// the athlete switches back — so its database-backed controls must do nothing
// while the database is closed. A throw from a press handler is not caught by
// any error boundary.
// ---------------------------------------------------------------------------

const { HISTORY_IMPORT_EXAMPLE } = require('@ak/inference');

const countIn = (dbName, table) => Number(drivers.get(dbName).raw
  .prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
/** The outermost rendered element carrying these props, so its handler can be
 *  invoked even where the control is disabled: a focused input can still report
 *  end-of-editing after the database has closed underneath it. */
const handlerOf = (props) => screen.UNSAFE_getAllByProps(props)[0];

test('after a failed boot, Profile database controls do nothing, and switching back recovers', async () => {
  mockRegistry = twoAthleteRegistry();
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  await mountProfile();
  const before = {
    blocks: countIn(DB_A, 'training_block'),
    bodyweight: countIn(DB_A, 'bodyweight_daily'),
    imports: countIn(DB_A, 'history_import'),
  };
  expect(before.blocks).toBe(1);
  fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));

  openFails.add(DB_B);
  fireEvent.press(screen.getByLabelText('Athlete Athlete B, tap to switch'));
  await settle();
  expect(store().status).toBe('error');
  expectDatabaseClosed();

  // A destructive write reached through ordinary taps.
  fireEvent.press(screen.getByLabelText("Delete the current block and today's state"));
  fireEvent.press(screen.getByLabelText('Confirm delete current block & state'));

  // Bodyweight: not editable, and inert even if end-of-editing still arrives.
  expect(screen.getByLabelText('Bodyweight today in kilograms').props.editable).toBe(false);
  act(() => { handlerOf({ accessibilityLabel: 'Bodyweight today in kilograms' }).props.onEndEditing(); });

  // Import: a preview that WOULD commit on a booted store, then the commit.
  fireEvent.press(screen.getByText('IMPORT TRAINING HISTORY'));
  fireEvent.changeText(screen.getByLabelText('Paste AK history import text'), HISTORY_IMPORT_EXAMPLE);
  fireEvent.press(screen.getByLabelText('Preview history import without saving'));
  expect(screen.getByText(/\d+ sessions · 0 errors/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Unknown:/)).toBeNull();
  expect(screen.getByLabelText('Commit reviewed history import').props.accessibilityState.disabled).toBe(true);
  act(() => { handlerOf({ label: 'COMMIT IMPORT' }).props.onPress(); });

  // Sub-screens that read or write the database do not open.
  expect(screen.getByLabelText('Open your existing activities').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Open Coach Verification Lab').props.accessibilityState.disabled).toBe(true);

  await settle();
  expectNoClosedDatabaseRead();
  expect(store().status).toBe('error');

  // Recovery: the athlete switches back from the same screen, and every
  // restriction lifts once the database is open again.
  fireEvent.press(screen.getByLabelText('Athlete Athlete A, tap to switch'));
  await settle();
  expect(store().status).toBe('ready');
  expect(store().activeAthleteId).toBe(ATHLETE_A);
  expect(screen.getByLabelText('Bodyweight today in kilograms').props.editable).not.toBe(false);
  expect(screen.getByLabelText('Open your existing activities').props.accessibilityState.disabled).toBe(false);
  expectNoClosedDatabaseRead();

  // Nothing tapped while the database was closed reached A's file.
  expect(countIn(DB_A, 'training_block')).toBe(before.blocks);
  expect(countIn(DB_A, 'bodyweight_daily')).toBe(before.bodyweight);
  expect(countIn(DB_A, 'history_import')).toBe(before.imports);
});

// ---------------------------------------------------------------------------
// WO-06 integration with PR #16: the Health and training support form lives on
// Profile, so it is mounted through every swap. While the database is closed it
// must not throw, must not offer a support write, must not write, and must keep
// prospective coach suggestions held; switching back restores it.
// ---------------------------------------------------------------------------

const { SUPPORT_UNAVAILABLE_MESSAGE } = require('../../src/state/healthSupportStore');

test('after a failed boot, the support form offers no write and holds advice, and switching back restores it', async () => {
  mockRegistry = twoAthleteRegistry();
  await bootRealStore();
  await mountProfile();

  // Booted: the form reads and writes A's file, so the closed case is not vacuous.
  fireEvent.press(screen.getByLabelText('Show health and training support'));
  fireEvent.changeText(screen.getByLabelText('Support note text'), 'Note saved while ready');
  fireEvent.press(screen.getByLabelText('Save support note'));
  await settle();
  expect(countIn(DB_A, 'health_support_note')).toBe(1);
  expect(store().getTrainingSupportDecision().status).toBe('available');
  const profileRevision = Number(drivers.get(DB_A).raw
    .prepare('SELECT revision FROM health_support_profile').get().revision);

  fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));
  openFails.add(DB_B);
  fireEvent.press(screen.getByLabelText('Athlete Athlete B, tap to switch'));
  await settle();
  expect(store().status).toBe('error');
  expectDatabaseClosed();

  // Prospective advice fails closed rather than reading or guessing.
  expect(store().getTrainingSupportDecision().status).toBe('support_unavailable');
  expect(screen.getByText('Health and training support')).toBeOnTheScreen();
  expect(screen.getAllByText(SUPPORT_UNAVAILABLE_MESSAGE).length).toBeGreaterThan(0);

  // The athlete change remounted the form collapsed; opening it loads nothing
  // and exposes no write control.
  expect(screen.queryByLabelText('Support note text')).toBeNull();
  fireEvent.press(screen.getByLabelText('Show health and training support'));
  await settle();
  expect(screen.queryByLabelText('Support note text')).toBeNull();
  expect(screen.queryByLabelText('Save support note')).toBeNull();
  expect(screen.queryByLabelText('Save clinician instruction draft')).toBeNull();
  expect(screen.queryByText('Note saved while ready')).toBeNull();
  expectNoClosedDatabaseRead();

  // Recovery from the same screen.
  fireEvent.press(screen.getByLabelText('Athlete Athlete A, tap to switch'));
  await settle();
  expect(store().status).toBe('ready');
  expect(store().getTrainingSupportDecision().status).toBe('available');
  fireEvent.press(screen.getByLabelText('Show health and training support'));
  await settle();
  expect(screen.getByLabelText('Save support note')).toBeOnTheScreen();
  expect(screen.getByText(/Note saved while ready/)).toBeOnTheScreen();
  expectNoClosedDatabaseRead();

  // Nothing reached A's support records while the database was closed.
  expect(countIn(DB_A, 'health_support_note')).toBe(1);
  expect(Number(drivers.get(DB_A).raw
    .prepare('SELECT revision FROM health_support_profile').get().revision)).toBe(profileRevision);
});

// CodeRabbit on PR #17: a form opened while the database is closed must load
// once that same athlete's database is ready, without being hidden and reopened,
// and must not keep showing the unavailable error after it loads.
test('a support form opened while the database is closed loads when that athlete becomes ready', async () => {
  mockRegistry = twoAthleteRegistry();
  await bootRealStore();
  await mountProfile();
  fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));

  openFails.add(DB_B);
  fireEvent.press(screen.getByLabelText('Athlete Athlete B, tap to switch'));
  await settle();
  expect(store().status).toBe('error');
  expect(store().activeAthleteId).toBe(ATHLETE_B);

  fireEvent.press(screen.getByLabelText('Show health and training support'));
  await settle();
  expect(screen.queryByLabelText('Save support note')).toBeNull();
  expect(screen.getAllByText(SUPPORT_UNAVAILABLE_MESSAGE).length).toBeGreaterThan(0);

  // Retry the same athlete: no athlete change, so the form is not remounted.
  useStore.setState({ status: 'booting', error: null });
  store().boot();
  await settle();
  expect(store().status).toBe('ready');
  expect(store().activeAthleteId).toBe(ATHLETE_B);

  expect(screen.getByLabelText('Hide health and training support')).toBeOnTheScreen();
  expect(screen.getByLabelText('Save support note')).toBeOnTheScreen();
  expect(screen.queryByText(SUPPORT_UNAVAILABLE_MESSAGE)).toBeNull();
  expectNoClosedDatabaseRead();
});
