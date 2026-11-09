/**
 * Issue #185: both "Review safety report" links open a read-only view of
 * today's saved reports (text, severity, time, the entry matched and what it
 * changed). No control on it can withdraw, correct or answer anything.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { reportEffectBetween, reportEffectText, reportEntryName } from '../../src/state/reportCopy';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

jest.setTimeout(60000);

let mockDriver;

jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({
      version: 1,
      activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }],
    }),
    saveRegistry: async () => undefined,
  };
});

const settle = async () => {
  for (let n = 0; n < 8; n += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const countRows = () => mockDriver.raw.prepare('SELECT count(*) AS n FROM subjective_report').get().n;

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, triaging: false, lastTriage: null });
  useStore.getState().setEmbedder(null);
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  expect(useStore.getState().loadDemoAthlete()).toBe('loaded');
  await useStore.getState().reportSubjective('feeling dizzy', 8);
  await useStore.getState().reportSubjective('no change yet', 5);
  expect(useStore.getState().lastTriage?.directive?.halt).toBe(true);
});

/** Every pressable inside the view, by accessible name. */
const pressablesIn = (view) => within(view).queryAllByRole('button')
  .map((node) => node.props.accessibilityLabel);

test('the store reads today\'s reports with text, severity, match, effect and follow-up, and writes nothing', () => {
  const before = countRows();
  const reports = useStore.getState().loadTodaySafetyReports();
  expect(countRows()).toBe(before);
  expect(reports.map((r) => r.text)).toEqual(['feeling dizzy', 'no change yet']);
  const [dizzy, unmatched] = reports;
  expect(dizzy.severity).toBe(8);
  expect(dizzy.halt).toBe(true);
  expect(dizzy.entryId).not.toBeNull();
  expect(dizzy.effect).toEqual(expect.objectContaining({ halt: true }));
  expect(dizzy.followUp).toEqual(expect.any(String));
  expect(typeof dizzy.reportedAtMs).toBe('number');
  expect(unmatched.entryId).toBeNull();
  expect(unmatched.effect).toBeNull();
});

test('PLAN "Review safety report" opens the read-only view, not the empty report form', () => {
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText('Review safety report'));
  const view = screen.getByTestId('safety-report-view');
  expect(within(view).getByText('“feeling dizzy”')).toBeOnTheScreen();
  expect(within(view).getAllByText(/Severity 8 of 10/).length).toBe(1);
  expect(within(view).getByText('Training stopped for today.')).toBeOnTheScreen();
  expect(within(view).getByText(/^Follow-up question: /)).toBeOnTheScreen();
  expect(within(view).getAllByText('This question takes no answer for now.').length).toBeGreaterThan(0);
  expect(within(view).getByText('It matched no entry, so it changed nothing today.')).toBeOnTheScreen();
  // No field, and the only control closes the view.
  expect(within(view).UNSAFE_queryAllByType(require('react-native').TextInput)).toHaveLength(0);
  expect(pressablesIn(view)).toEqual(['Close today\'s safety reports']);
  expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
  fireEvent.press(within(view).getByLabelText('Close today\'s safety reports'));
  expect(screen.queryByTestId('safety-report-view')).toBeNull();
  expect(useStore.getState().lastTriage?.directive?.halt).toBe(true);
});

test('READY "Review safety report" opens the same read-only view, not the paused workout', () => {
  const onOpenSession = jest.fn();
  const onOpenCoach = jest.fn();
  render(<ReadinessScreen onOpenSession={onOpenSession} onOpenCoach={onOpenCoach} />);
  fireEvent.press(screen.getByLabelText('Review safety report'));
  const view = screen.getByTestId('safety-report-view');
  expect(within(view).getByText('“feeling dizzy”')).toBeOnTheScreen();
  expect(pressablesIn(view)).toEqual(['Close today\'s safety reports']);
  expect(onOpenSession).not.toHaveBeenCalled();
  expect(onOpenCoach).not.toHaveBeenCalled();
});

test('the effect sentence uses the report\'s own figures, or says nothing changed', () => {
  const base = { load_modifier: 1, set_modifier: 0, rpe_cap: 8.5 };
  expect(reportEffectText(reportEffectBetween({ load_modifier: 0.85, set_modifier: -1, rpe_cap: 8.5 }, base, false)))
    .toBe('Today: load reduced by 15% and one set fewer.');
  expect(reportEffectText(reportEffectBetween({ load_modifier: 0.54, set_modifier: -1, rpe_cap: 6 }, base, false)))
    .toBe('Today: load reduced by 46%, one set fewer and effort capped at RPE 6.');
  expect(reportEffectText(reportEffectBetween(base, base, false))).toBe('Today\'s plan is unchanged.');
  expect(reportEffectText(reportEffectBetween(base, base, true))).toBe('Training stopped for today.');
  expect(reportEntryName('soreness-doms')).toBe('Normal muscle soreness (DOMS)');
  expect(reportEntryName(null)).toBe('Not matched to any entry');
});
