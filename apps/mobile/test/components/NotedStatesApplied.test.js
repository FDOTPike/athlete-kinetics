/**
 * Issue #207: after Apply, the reply to a "Something feels off" report states
 * (1) what it matched in plain words, (2) what changed today with the applied
 * figures, after the severity gate and the experience scaling, or that
 * nothing changed, and (3) then the entry's cue when it agrees with the
 * outcome. On BlockScreen, the reply sits above the form.
 *
 * Real store over node:sqlite. The embedder is a stand-in that returns the
 * bundled vector of the entry selected by each test.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { SubjectiveReportPanel } from '../../src/components/SubjectiveReportPanel';
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
const FATIGUE_CUE = 'Bar speed is the readout: cut load 15% and stop every set two reps short.';
const STRONG_CUE = 'Good day confirmed. The plan already accounts for readiness; execute it with intent.';
const FATIGUE_MATCH = 'Matched: Everything feels heavy (slow bar speed)';
const STRONG_MATCH = 'Matched: Feeling strong';
const UNCHANGED = "Today's plan is unchanged.";

const matchEntry = (entryId) => {
  // Scale a hair below unit length so float rounding cannot push the
  // stored similarity past 1.0 (a CHECK on subjective_report).
  useStore.getState().setEmbedder({ embed: async () => entryVector(entryId).map((x) => x * 0.99) });
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, triaging: false, lastTriage: null });
  matchEntry('soreness-doms');
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  expect(useStore.getState().loadDemoAthlete()).toBe('loaded');
});

afterEach(() => { useStore.getState().setEmbedder(null); });

const applyReport = async (text, severity) => {
  fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), text);
  fireEvent.press(screen.getByLabelText(`Severity ${severity} of 10`));
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Apply report'));
    await settle();
  });
};

const applyBlockReport = (text, severity) => {
  fireEvent.press(screen.getByText('Something feels off'));
  return applyReport(text, severity);
};

/** Text of every Text node under a view, in render order. */
const textsIn = (view) => within(view).UNSAFE_queryAllByType(require('react-native').Text)
  .map((node) => [].concat(node.props.children).join(''));

test('a beginner at severity 2: names the match, says unchanged, and omits the DOMS cue', async () => {
  // The issue's walk: a beginner, mild soreness at severity 2 (below the gate).
  useStore.setState({ profile: { ...useStore.getState().profile, training_age: 'beginner' } });
  render(<BlockScreen />);
  await applyBlockReport('A bit sore in my legs from last squats', 2);
  expect(useStore.getState().lastTriage).toEqual(expect.objectContaining({ kind: 'positive', entryId: 'soreness-doms' }));
  const view = screen.getByTestId('report-result-noted');
  const texts = textsIn(view);
  const matched = texts.indexOf('Matched: Normal muscle soreness (DOMS)');
  const unchanged = texts.indexOf(UNCHANGED);
  expect(matched).toBeGreaterThan(-1);
  expect(unchanged).toBeGreaterThan(matched);
  expect(screen.queryByText(DOMS_CUE)).toBeNull();
});

test('BlockScreen omits the fatigue cue for slightly tired legs at severity 1', async () => {
  matchEntry('fatigue-heavy');
  render(<BlockScreen />);
  await applyBlockReport('Legs feel slightly tired from yesterday', 1);

  expect(useStore.getState().lastTriage).toEqual(expect.objectContaining({ kind: 'positive', entryId: 'fatigue-heavy' }));
  expect(screen.queryByText(FATIGUE_CUE)).toBeNull();
  expect(textsIn(screen.getByTestId('report-result-noted'))).toEqual(['Noted', FATIGUE_MATCH, UNCHANGED]);
});

test('BlockScreen shows the Feeling strong cue after the unchanged-plan message', async () => {
  matchEntry('positive-strong');
  render(<BlockScreen />);
  await applyBlockReport('Feeling strong', 1);

  expect(useStore.getState().lastTriage).toEqual(expect.objectContaining({ kind: 'positive', entryId: 'positive-strong' }));
  expect(textsIn(screen.getByTestId('report-result-noted'))).toEqual(['Noted', STRONG_MATCH, UNCHANGED, STRONG_CUE]);
});

test.each([
  ['fatigue-heavy', 'Legs feel slightly tired from yesterday', [FATIGUE_MATCH, UNCHANGED]],
  ['positive-strong', 'Feeling strong', [STRONG_MATCH, UNCHANGED, STRONG_CUE]],
])('SubjectiveReportPanel shows the noted reply for %s', async (entryId, text, reply) => {
  matchEntry(entryId);
  function StoreBackedReportPanel() {
    const lastTriage = useStore((state) => state.lastTriage);
    const triaging = useStore((state) => state.triaging);
    const onApply = useStore((state) => state.reportSubjective);
    return <SubjectiveReportPanel hasVector triageReady lastTriage={lastTriage} triaging={triaging} onApply={onApply} onClose={jest.fn()} />;
  }
  render(<StoreBackedReportPanel />);
  await applyReport(text, 1);

  expect(useStore.getState().lastTriage).toEqual(expect.objectContaining({ kind: 'positive', entryId }));
  expect(screen.getByText('Noted')).toBeOnTheScreen();
  expect(screen.queryByText(FATIGUE_CUE)).toBeNull();
  for (const line of reply) expect(screen.getByText(line)).toBeOnTheScreen();
});

test('SubjectiveReportPanel keeps the cue-only reply for a synthetic result without a match id', async () => {
  render(<SubjectiveReportPanel hasVector triageReady triaging={false} lastTriage={{ kind: 'positive', cue: STRONG_CUE }} onApply={async () => true} onClose={jest.fn()} />);
  await applyReport('Feeling strong', 1);

  expect(screen.getByText('Noted')).toBeOnTheScreen();
  expect(screen.getByText(STRONG_CUE)).toBeOnTheScreen();
  expect(screen.queryByText(STRONG_MATCH)).toBeNull();
  expect(screen.queryByText(UNCHANGED)).toBeNull();
});

test('soreness the gate keeps: names the match and states the applied figures before the cue', async () => {
  render(<BlockScreen />);
  await applyBlockReport('very sore muscles from the last session', 6);
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
  await applyBlockReport('A bit sore in my legs from last squats', 2);
  const all = screen.UNSAFE_root.findAll(() => true);
  const result = all.indexOf(screen.getByTestId('report-result-noted'));
  const input = all.indexOf(screen.getByLabelText('Describe how your body feels today'));
  expect(result).toBeLessThan(input);
});
