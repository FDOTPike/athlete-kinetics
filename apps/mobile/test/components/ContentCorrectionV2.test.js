/**
 * ContentCorrectionV2.test.js — the corrected coaching text as the app reads
 * it (coaching work order 4): the REAL store, booted by the production boot
 * path over the production migration chain (node:sqlite stands in for the
 * op-sqlite handle only), and the staged source the migration was generated
 * from.
 *
 *   - the library the store hydrates carries the concrete text, not the
 *     shared "Set up <name> with ..." template, for all 115 corrected rows;
 *   - what the store hands to the screens is exactly the staged, reviewed
 *     text — nothing is transformed on the way;
 *   - the rows deliberately held (animation-lane movements 135 and 187, frame
 *     conflicts, open identity questions) still read what they read before;
 *   - identity is untouched: ids, names, aliases, patterns, equipment and
 *     asset keys;
 *   - a plan and a logged session that reference a corrected movement are
 *     unaffected.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({ version: 1, activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }] }),
    saveRegistry: async () => undefined,
  };
});

// The first heavy module load in a fresh jest worker is slow.
jest.setTimeout(60_000);

const staging = (name) => JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'staging', name), 'utf8'));
const overlay = staging('movement_content_correction_v2.json');
const dispositions = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'audits', 'coaching-goals', 'evidence', 'WO4_DISPOSITIONS.json'), 'utf8'));

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const byName = () => new Map(state().movements.map((movement) => [movement.name, movement]));
const isTemplate = (movement) => (movement.instructions ?? '').startsWith(`Set up ${movement.name} with `);
const terminal = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, block: null, program: null, todayPlan: null });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
});

afterEach(() => { jest.restoreAllMocks(); });

test('the store hands the screens exactly the staged, reviewed text for all 115 corrected movements', () => {
  const library = byName();
  expect(overlay.records).toHaveLength(115);
  for (const record of overlay.records) {
    const movement = library.get(record.name);
    expect(movement).toBeDefined();
    expect(movement.instructions).toBe(record.changes.coaching.setup_steps.map((step) => terminal(step.trim())).join(' '));
    expect(movement.cues).toBe(record.changes.coaching.cues.map((cue) => terminal(cue.trim())).join(' '));
    expect(movement.coachingIntent).toBe(record.changes.coaching.coaching_intent);
    expect(isTemplate(movement)).toBe(false);
  }
});

test('a corrected description says where to start, what moves and how to return', () => {
  const curl = byName().get('Concentration Curls');
  expect(curl.instructions).toBe('Sit on a flat bench with the feet wide, hold one dumbbell and rest the back of that upper arm against the inner thigh with the arm straight and the palm facing forward. '
    + 'Keeping the upper arm still, curl the dumbbell up toward the shoulder. '
    + 'Squeeze, then lower slowly until the arm is straight. '
    + 'Complete the repetitions, then change arms.');
  expect(curl.cues).toBe('Upper arm stays on the thigh. Only the forearm moves. Lower slowly to a straight arm.');
  expect(curl.coachingIntent).toBe('Curl one dumbbell at a time with the upper arm braced against the inner thigh.');
});

test('only the deliberately held rows still read the shared template', () => {
  const stillTemplate = state().movements.filter(isTemplate).map((movement) => movement.movement_id).sort((a, b) => a - b);
  const held = dispositions.dispositions.filter((row) => row.disposition !== 'corrected').map((row) => row.id).sort((a, b) => a - b);
  expect(stillTemplate).toEqual(held);
  expect(stillTemplate).toHaveLength(29);
  expect(dispositions.counts).toEqual({
    corrected: 115, held_codex_animation_dependency: 15, held_owner_question: 11, codex_exclusive: 2, held_no_source: 1,
  });
});

test('movements 135 and 187 are untouched: same text as before the correction, no v2 provenance', () => {
  const rows = raw().prepare(`SELECT m.movement_id AS id, m.name, d.instructions, d.cues,
      (SELECT COUNT(*) FROM movement_content_correction c WHERE c.movement_id = m.movement_id) AS corrections
    FROM movement m JOIN movement_detail d USING(movement_id) WHERE m.movement_id IN (135, 187) ORDER BY 1`).all();
  expect(rows.map((row) => row.name)).toEqual(['Barbell Incline Shoulder Raise', 'Dumbbell Incline Shoulder Raise']);
  for (const row of rows) {
    expect(row.instructions.startsWith(`Set up ${row.name} with `)).toBe(true);
    expect(row.instructions).toMatch(/Move the arms through the intended arc with soft elbows/);
    expect(row.corrections).toBe(0);
  }
  expect(overlay.records.some((record) => /Incline Shoulder Raise/.test(record.name))).toBe(false);
});

test('identity is untouched: every movement keeps its id, name, pattern, equipment and asset key', () => {
  expect(state().movements).toHaveLength(300);
  expect(state().movements.map((movement) => movement.movement_id)).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
  const media = raw().prepare(`SELECT m.name, mm.asset_key AS assetKey, mm.status, mm.revision
    FROM movement m JOIN movement_media mm USING(movement_id)`).all();
  const manifest = new Map(staging('movement_media_manifest.json').records.map((record) => [record.name, record]));
  expect(media).toHaveLength(300);
  for (const row of media) {
    expect(row.assetKey).toBe(manifest.get(row.name).assetKey);
    expect(row.status).toBe(manifest.get(row.name).status);
    expect(row.revision).toBe(1);
  }
  // A corrected movement keeps the equipment list it had; the text does not change eligibility.
  const curl = byName().get('Concentration Curls');
  expect([...curl.required].sort()).toEqual(['bench', 'dumbbells']);
  expect(curl.pattern).toBe('isolation');
});

test('the correction is recorded beside v1, never over it', () => {
  const versions = raw().prepare('SELECT correction_version AS v, COUNT(*) AS c FROM movement_content_correction GROUP BY 1 ORDER BY 1').all();
  expect(versions).toEqual([{ v: 1, c: 32 }, { v: 2, c: 115 }]);
  expect(Number(raw().prepare(`SELECT COUNT(*) AS c FROM movement_content_correction a JOIN movement_content_correction b
    USING(movement_id) WHERE a.correction_version = 1 AND b.correction_version = 2`).get().c)).toBe(0);
  expect(overlay.ratification.state).toBe('pending_owner_review');
});

test('a plan and a logged session that reference a corrected movement are unaffected', () => {
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'cable_machine'] });
  const curlId = byName().get('Concentration Curls').movement_id;
  // History logged BEFORE the correction existed, against the same movement id.
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 10, 10, 7, 2000)').run(curlId);
  const historyBefore = JSON.stringify(raw().prepare('SELECT * FROM set_record WHERE session_id = 9000').all());
  // A free-form session repeats that history, so the corrected movement is in its plan.
  state().startSession();
  expect(state().session).not.toBeNull();
  expect(state().sessionPlan.map((slot) => slot.movementId)).toContain(curlId);
  state().finishPreparation('already_warm', state().preparation.revision);
  state().logSet(curlId, 10, 12.5, 7);
  expect(state().error).toBeNull();
  expect(raw().prepare('SELECT movement_id, reps, load_kg FROM set_record WHERE session_id = ?').all(state().session.sessionId))
    .toEqual([{ movement_id: curlId, reps: 10, load_kg: 12.5 }]);
  expect(JSON.stringify(raw().prepare('SELECT * FROM set_record WHERE session_id = 9000').all())).toBe(historyBefore);
  state().runnerHalt('manual');
  state().endSession();
  expect(state().session).toBeNull();
  useStore.setState({ error: null });
  // A plan made now references movement ids only; no coaching text is copied into it.
  expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
  const planColumns = raw().prepare("SELECT name FROM pragma_table_info('planned_slot')").all().map((row) => row.name);
  expect(planColumns).toContain('movement_id');
  expect(planColumns.some((name) => /instruction|cue|intent/.test(name))).toBe(false);
  // The text is read live from the library wherever the movement appears.
  expect(byName().get('Concentration Curls').instructions.startsWith('Sit on a flat bench')).toBe(true);
});
