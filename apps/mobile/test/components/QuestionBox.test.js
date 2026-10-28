import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GlossaryScreen from '../../src/screens/GlossaryScreen';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, acquireDataMaintenanceLock } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
let mockQuestionBoxEnabled = true;
jest.mock('../../src/config/features', () => ({ get QUESTION_BOX_ENABLED() { return mockQuestionBoxEnabled; } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return { loadRegistry: async () => ({ version: 1, activeId: core.DEFAULT_ATHLETE_ID, advancedToolsUnlocked: false,
    athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }] }), saveRegistry: async () => undefined };
});
jest.setTimeout(60_000);
const state = () => useStore.getState();
const rows = () => mockDriver.raw.prepare('SELECT * FROM question_log ORDER BY id').all();
const fixtures = require('../../../../packages/inference/test/question-dev-parity.json');
const ask = async (text) => {
  fireEvent.changeText(screen.getByLabelText('Question'), text);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ask' })));
};
beforeEach(async () => {
  mockQuestionBoxEnabled = true;
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', session: null, runner: null, error: null });
  state().boot();
  await waitFor(() => expect(state().status).toBe('ready'), { timeout: 30_000 });
  state().setEmbedder({ dim: 384, modelId: 'fixture', embed: jest.fn(async (text) => Float32Array.from(fixtures.find((row) => row.text === text)?.query ?? new Array(384).fill(0))) });
});
afterEach(() => { state().setEmbedder(null); });

test('flag defaults off and hides the question box entry', () => {
  expect(jest.requireActual('../../src/config/features').QUESTION_BOX_ENABLED).toBe(false);
  mockQuestionBoxEnabled = false;
  render(<GlossaryScreen />);
  expect(screen.queryByRole('button', { name: 'Question box' })).toBeNull();
  expect(screen.queryByLabelText('Question')).toBeNull();
  expect(rows()).toEqual([]);
});

test('a question from the glossary shows exactly one card and writes the displayed term with the original text', async () => {
  const question = fixtures.find((row) => row.expected.outcome === 'RPE');
  render(<GlossaryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Question box' }));
  expect(screen.getByText(/glossary only/)).toBeTruthy();
  expect(screen.getByText(/not medical advice/)).toBeTruthy();
  await ask(question.text);
  expect(screen.getAllByTestId('question-answer-card')).toHaveLength(1);
  expect(screen.getByText('RPE')).toBeTruthy();
  expect(rows()).toEqual([{ id: 1, asked_at: expect.any(Number), question_text: question.text, outcome_kind: 'card', glossary_term_id: 'RPE' }]);
});

test('no answer and the fixed symptom referral both log without a glossary card', async () => {
  const trainingBefore = { prescription: state().prescription, runner: state().runner, lastTriage: state().lastTriage };
  render(<GlossaryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Question box' }));
  await ask('unrelated');
  expect(screen.getByText('no answer for that yet')).toBeTruthy();
  expect(screen.queryByTestId('question-answer-card')).toBeNull();
  await ask('my knee hurts');
  expect(screen.getByText('Stop if something feels unsafe and seek qualified professional advice when needed.')).toBeTruthy();
  expect(screen.queryByText('no answer for that yet')).toBeNull();
  expect(rows().map(({ outcome_kind, glossary_term_id }) => [outcome_kind, glossary_term_id])).toEqual([['none', null], ['refer', null]]);
  expect({ prescription: state().prescription, runner: state().runner, lastTriage: state().lastTriage }).toEqual(trainingBefore);
});

test('a failed log never presents an answer, and invalid text writes nothing', async () => {
  render(<GlossaryScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Question box' }));
  expect(await state().askQuestion(' ')).toBeNull();
  expect(await state().askQuestion('a'.repeat(301))).toBeNull();
  expect(rows()).toEqual([]);
  mockDriver.raw.exec('DROP TABLE question_log');
  await ask('unrelated');
  expect(screen.queryByText('no answer for that yet')).toBeNull();
  expect(screen.getByRole('alert')).toBeTruthy();
});

test('an in-flight question holds its athlete database until the log is written', async () => {
  let finish;
  state().setEmbedder({ dim: 384, modelId: 'fixture', embed: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = state().askQuestion('unrelated');
  expect(() => acquireDataMaintenanceLock('test')).toThrow(/still being saved/);
  state().switchAthlete('another');
  expect(state().activeAthleteId).toBe('default');
  finish(new Float32Array(384));
  await pending;
  expect(rows()).toHaveLength(1);
  const release = acquireDataMaintenanceLock('test');
  release();
  state().resetTrainingData();
  expect(rows()).toEqual([]);
});

test('reset reports question-only history as cleared and an empty repeat as unchanged', async () => {
  expect(mockDriver.raw.prepare('SELECT count(*) AS c FROM session').get().c).toBe(0);
  await state().askQuestion('unrelated');
  expect(rows()).toHaveLength(1);

  expect(state().resetTrainingData()).toBe(true);
  expect(rows()).toEqual([]);
  expect(state().resetTrainingData()).toBe(false);
});

test('reset invalidates a pending question without blocking subsequent questions', async () => {
  await state().askQuestion('unrelated');
  let finish;
  state().setEmbedder({ dim: 384, modelId: 'fixture', embed: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = state().askQuestion('pending question');

  state().resetTrainingData();
  expect(state().error).toBeNull();
  expect(rows()).toEqual([]);
  finish(new Float32Array(384));

  expect(await pending).toBeNull();
  expect(rows()).toEqual([]);
  const release = acquireDataMaintenanceLock('test');
  release();
  state().setEmbedder(null);
  expect(await state().askQuestion('a subsequent question')).toEqual({ outcome: 'none', shown: [] });
  expect(rows().map((row) => row.question_text)).toEqual(['a subsequent question']);
});

test('a failed reset preserves question history and lets its pending question finish', async () => {
  await state().askQuestion('unrelated');
  let finish;
  state().setEmbedder({ dim: 384, modelId: 'fixture', embed: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = state().askQuestion('pending question');
  mockDriver.raw.exec("CREATE TRIGGER refuse_reset BEFORE DELETE ON question_log BEGIN SELECT RAISE(ABORT, 'reset refused'); END");

  expect(state().resetTrainingData()).toBe(false);
  expect(state().error).toMatch(/reset refused/);
  expect(rows()).toHaveLength(1);
  finish(new Float32Array(384));

  expect(await pending).toEqual({ outcome: 'none', shown: [] });
  expect(rows().map((row) => row.question_text)).toEqual(['unrelated', 'pending question']);
  const release = acquireDataMaintenanceLock('test');
  release();
});
