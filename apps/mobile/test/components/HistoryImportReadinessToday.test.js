/**
 * HistoryImportReadinessToday.test.js — issue #145.
 *
 * A verified, load-complete AK_HISTORY_V1 import whose sessions are dated
 * before today must materialize a state_vector row for today and populate
 * store.vector after the commit. An unverified import (or one not marked
 * load-complete) must create no state_vector row.
 */

jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => {
    const { DatabaseSync } = require('node:sqlite');
    const raw = new DatabaseSync(':memory:');
    try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
      raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
      raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
    }
    const handle = {
      raw,
      executeSync(sql, params) {
        const text = String(sql);
        const bound = params ?? [];
        if (bound.length > 0) return { rows: raw.prepare(text).all(...bound) };
        if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(text)) return { rows: raw.prepare(text).all() };
        raw.exec(text);
        return { rows: [] };
      },
      close() { raw.close(); },
    };
    globalThis.__akTestSqlite = handle;
    return handle;
  },
}));

const bootStore = async () => {
  jest.resetModules();
  globalThis.__akTestSqlite = null;
  const { authorizeAthleteDataBoot } = require('../../src/state/dataMaintenanceLock');
  authorizeAthleteDataBoot();
  const { useStore } = require('../../src/state/useStore');
  useStore.getState().boot();
  for (let i = 0; i < 500 && useStore.getState().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(useStore.getState().status).toBe('ready');
  return { useStore, raw: globalThis.__akTestSqlite.raw };
};

const isoDaysBefore = (todayIso, daysBack) => {
  const [y, m, d] = todayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - daysBack));
  return dt.toISOString().slice(0, 10);
};

const twoPriorSessionsPayload = (todayIso) => {
  const d1 = isoDaysBefore(todayIso, 11);
  const d2 = isoDaysBefore(todayIso, 5);
  return [
    'AK_HISTORY_V1',
    `SESSION|${d1}|45|7`,
    'SET|Bodyweight Squat|1|10|40|7',
    'SET|Bodyweight Squat|2|10|40|7.5',
    'END_SESSION',
    `SESSION|${d2}|50|7.5`,
    'SET|Bodyweight Squat|1|10|45|7.5',
    'SET|Bodyweight Squat|2|10|45|8',
    'END_SESSION',
  ].join('\n');
};

test('verified, load-complete history import dated before today materializes today state_vector and sets store.vector', async () => {
  const { useStore, raw } = await bootStore();
  const today = useStore.getState().today;
  expect(useStore.getState().vector).toBeNull();

  const text = twoPriorSessionsPayload(today);
  const result = useStore.getState().importHistory(text, true, true);
  expect(result.committed).toBe(true);
  expect(result.duplicate).toBe(false);

  const todayRow = raw.prepare('SELECT * FROM state_vector WHERE date = ?').get(today);
  expect(todayRow).toBeDefined();
  expect(todayRow.acute_load_kg).toBeGreaterThan(0);
  expect(todayRow.chronic_load_kg).toBeGreaterThan(0);

  const vector = useStore.getState().vector;
  expect(vector).not.toBeNull();
  expect(vector.date).toBe(today);
  expect(vector.acute_load_kg).toBeGreaterThan(0);
  expect(vector.chronic_load_kg).toBeGreaterThan(0);
});

test('unverified history import creates no state_vector row and leaves store.vector null', async () => {
  const { useStore, raw } = await bootStore();
  const today = useStore.getState().today;

  const text = twoPriorSessionsPayload(today);
  const result = useStore.getState().importHistory(text, false, true);
  expect(result.committed).toBe(true);

  const count = raw.prepare('SELECT COUNT(*) AS c FROM state_vector').get().c;
  expect(Number(count)).toBe(0);
  expect(useStore.getState().vector).toBeNull();
});

test('verified but load-incomplete history import creates no state_vector row and leaves store.vector null', async () => {
  const { useStore, raw } = await bootStore();
  const today = useStore.getState().today;

  const text = twoPriorSessionsPayload(today);
  const result = useStore.getState().importHistory(text, true, false);
  expect(result.committed).toBe(true);

  const count = raw.prepare('SELECT COUNT(*) AS c FROM state_vector').get().c;
  expect(Number(count)).toBe(0);
  expect(useStore.getState().vector).toBeNull();
});
