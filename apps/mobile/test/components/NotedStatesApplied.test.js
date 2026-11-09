/**
 * Issue #207: after Apply, the reply to a "Something feels off" report states
 * (1) what it matched in plain words, (2) what changed today with the applied
 * figures, after the severity gate and the experience scaling, or that
 * nothing changed, and (3) only then the entry's cue. It sits above the form.
 *
 * Real store over node:sqlite. The embedder is a stand-in that returns the
 * bundled vector of the "soreness-doms" entry, so the report matches it.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import BlockScreen from '../../src/screens/BlockScreen';
import { reportEffectText } from '../../src/state/reportCopy';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import codebase from '../../../../packages/inference/assets/phrase-codebase.json';
import vectors from '../../../../packages/inference/assets/phrase-codebase.vectors.json';

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

/** The bundled vector of an entry's own text (rows are each entry's text, then its aliases). */
const entryVector = (id) => {
  let row = 0;
  for (const entry of codebase.entries) {
    if (entry.id === id) return vectors.vectors[row];
    row += 1 + entry.aliases.length;
  }
  throw new Error(`no entry ${id}`);
};

const DOMS_CUE = codebase.entries.find((e) => e.id === 'soreness-doms').cue;

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, triaging: false, lastTriage: null });
  // Scaled a hair below unit length so float rounding cannot push the
  // stored similarity past 1.0 (a CHECK on subjective_report).
  useStore.getState().setEmbedder({ embed: async () => entryVector('soreness-doms').map((x) => x * 0.99) });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  expect(useStore.getState().loadDemoAthlete()).toBe('loaded');
});

afterEach(() => { useStore.getState().setEmbedder(null); });

const applyReport = async (text, severity) => {
  fireEvent.press(screen.getByText('Something feels off'));
  fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), text);
  fireEvent.press(screen.getByLabelText(`Severity ${severity} of 10`));
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Apply report'));
    await settle();
  });
};

/** Text of every Text node under a view, in render order. */
const textsIn = (view) => within(view).UNSAFE_queryAllByType(require('react-native').Text)
  .map((node) => [].concat(node.props.children).join(''));

test('a beginner at severity 2: names the match, says unchanged, then the cue', async () => {
  // The issue's walk: a beginner, mild soreness at severity 2 (below the gate).
  useStore.setState({ profile: { ...useStore.getState().profile, training_age: 'beginner' } });
  render(<BlockScreen />);
  await applyReport('A bit sore in my legs from last squats', 2);
  expect(useStore.getState().lastTriage).toEqual(expect.objectContaining({ kind: 'positive', entryId: 'soreness-doms' }));
  const view = screen.getByTestId('report-result-noted');
  const texts = textsIn(view);
  const matched = texts.indexOf('Matched: Normal muscle soreness (DOMS)');
  const unchanged = texts.indexOf("Today's plan is unchanged.");
  const cue = texts.indexOf(DOMS_CUE);
  expect(matched).toBeGreaterThan(-1);
  expect(unchanged).toBeGreaterThan(matched);
  expect(cue).toBeGreaterThan(unchanged);
});

test('soreness the gate keeps: names the match and states the applied figures before the cue', async () => {
  render(<BlockScreen />);
  await applyReport('very sore muscles from the last session', 6);
  const { lastTriage, prescription } = useStore.getState();
  expect(lastTriage.kind).toBe('matched');
  expect(prescription.report.entryId).toBe('soreness-doms');
  const view = screen.getByTestId('report-result-adjusted');
  const texts = textsIn(view);
  const applied = texts.indexOf(reportEffectText(prescription.report.effect));
  expect(texts.indexOf('Matched: Normal muscle soreness (DOMS)')).toBeGreaterThan(-1);
  expect(applied).toBeGreaterThan(texts.indexOf('Matched: Normal muscle soreness (DOMS)'));
  expect(texts.indexOf(DOMS_CUE)).toBeGreaterThan(applied);
});

test('the reply sits above the report form', async () => {
  render(<BlockScreen />);
  await applyReport('A bit sore in my legs from last squats', 2);
  const all = screen.UNSAFE_root.findAll(() => true);
  const result = all.indexOf(screen.getByTestId('report-result-noted'));
  const input = all.indexOf(screen.getByLabelText('Describe how your body feels today'));
  expect(result).toBeLessThan(input);
});
