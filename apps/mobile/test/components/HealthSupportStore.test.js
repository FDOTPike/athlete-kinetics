import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import { createHealthSupportStore } from '../../src/state/healthSupportStore';

const schema = readFileSync(join(__dirname, '../../../../packages/core-db/src/schema/064_accessible_coach_support.sql'), 'utf8');
const setup = () => {
  const db = makeNodeSqliteDriver();
  db.raw.exec('CREATE TABLE session(session_id INTEGER PRIMARY KEY) STRICT; CREATE TABLE movement(movement_id INTEGER PRIMARY KEY) STRICT; INSERT INTO movement VALUES (1),(2);');
  db.raw.exec(schema);
  let active = { athleteId: 'one', db };
  return { db, adapter: createHealthSupportStore(active, () => active), switchTo: (value) => { active = value; } };
};
const all = [{ targetKind: 'all_prescription' }];

test('text is exact, inert and omitted from facts and decision evidence', () => {
  const { db, adapter } = setup();
  for (const text of ["POTS; stay below 150 bpm — 'DROP TABLE session'", 'Everything is fine, cleared for everything']) {
    adapter.saveNote('symptom_trigger', text, undefined, adapter.facts().revision, 100);
    expect(adapter.details().notes.some((n) => n.bodyText === text)).toBe(true);
    expect(adapter.evaluate(all).status).toBe('available');
    expect(JSON.stringify(adapter.facts())).not.toContain(text);
  }
  adapter.savePreference('position', 'recumbent', 'Private preference', adapter.facts().revision, 110);
  expect(adapter.evaluate(all).status).toBe('available');
  adapter.recordDecision(all, 'session', 'preview', 120);
  expect(JSON.stringify(db.raw.prepare('SELECT * FROM recommendation_support_record').all())).not.toMatch(/POTS|Private/);
});

test('draft/confirmed revisions hold exactly selected guidance; editing requires fresh confirmation', () => {
  const { adapter } = setup();
  const id = adapter.saveInstruction({ instructionText: 'My transcription', scopes: [{ targetKind: 'movement', movementId: 1 }] }, 0, 100);
  const first = adapter.details();
  expect(first.instructions[0].transcriptionState).toBe('draft');
  expect(adapter.evaluate([{ targetKind: 'movement', movementId: 1 }]).status).toBe('held');
  expect(adapter.evaluate([{ targetKind: 'movement', movementId: 2 }]).status).toBe('available');
  adapter.confirmInstruction(id, 1, first.revision, 110);
  expect(adapter.evaluate(all).status).toBe('held');
  adapter.saveInstruction({ instructionId: id, instructionText: 'New revision', scopes: [] }, adapter.facts().revision, 120);
  expect(adapter.details().instructions[0]).toMatchObject({ revision: 2, transcriptionState: 'draft' });
  expect(() => adapter.confirmInstruction(id, 1, adapter.facts().revision, 130)).toThrow(/current revision/);
});

test('instruction deletion removes every transcription and scope text and retains content-free hold through reopen', () => {
  const { db, adapter } = setup();
  const id = adapter.saveInstruction({ instructionText: 'Private clinician note', scopes: [{ targetKind: 'movement', movementId: 1, reportedScopeText: 'Private scope' }] }, 0, 100);
  adapter.recordDecision(all, 'session', 'before-delete', 110);
  adapter.deleteInstruction(id, adapter.facts().revision, 120);
  expect(db.raw.prepare('SELECT count(*) AS n FROM clinician_instruction_revision').get().n).toBe(0);
  expect(db.raw.prepare('SELECT reported_scope_text FROM health_support_scope').all().every((r) => r.reported_scope_text === null)).toBe(true);
  const reopened = createHealthSupportStore({ athleteId: 'one', db }, () => ({ athleteId: 'one', db }));
  expect(reopened.evaluate([{ targetKind: 'movement', movementId: 1 }])).toMatchObject({ status: 'held', reasonCodes: ['support_deleted'] });
  expect(reopened.evaluate([{ targetKind: 'movement', movementId: 2 }]).status).toBe('available');
  expect(reopened.facts().holds[0]).toMatchObject({ origin: 'deleted_support_review', instructionId: null, instructionRevision: null });
});

test('stale revision, failed scope FK and injected write failure roll back the entire capture', () => {
  const { db, adapter } = setup();
  expect(() => adapter.saveInstruction({ instructionText: 'Rollback text', scopes: [{ targetKind: 'movement', movementId: 999 }] }, 0, 100)).toThrow();
  expect(db.raw.prepare('SELECT count(*) AS n FROM clinician_instruction').get().n).toBe(0);
  expect(adapter.facts().revision).toBe(0);
  adapter.saveNote('general', 'Saved note', undefined, 0, 200);
  expect(() => adapter.saveNote('general', 'Stale note', undefined, 0, 210)).toThrow(/changed/);
  db.raw.exec("CREATE TRIGGER fail_support BEFORE UPDATE ON health_support_profile BEGIN SELECT RAISE(ABORT, 'injected'); END;");
  expect(() => adapter.saveNote('general', 'Must roll back', undefined, 1, 220)).toThrow('injected');
  expect(adapter.details().notes.map((n) => n.bodyText)).toEqual(['Saved note']);
});

test('athlete ID and exact handle binding protect reads, writes and cached adapters', () => {
  const { db, adapter, switchTo } = setup();
  const other = setup().db;
  adapter.saveNote('general', 'Athlete one private', undefined, 0, 100);
  switchTo({ athleteId: 'two', db: other });
  expect(adapter.evaluate(all).status).toBe('support_unavailable');
  expect(() => adapter.details()).toThrow(/unavailable/);
  expect(() => adapter.saveNote('general', 'Wrong athlete', undefined, 1, 110)).toThrow(/unavailable/);
  expect(other.raw.prepare('SELECT count(*) AS n FROM health_support_note').get().n).toBe(0);
  switchTo({ athleteId: 'one', db: other });
  expect(adapter.evaluate(all).status).toBe('support_unavailable');
  expect(db.raw.prepare('SELECT count(*) AS n FROM health_support_note').get().n).toBe(1);
});

test('missing contract fails closed; explicit self-pause withdrawal works', () => {
  const { db, adapter } = setup();
  adapter.setReviewState('pending_review', 0, 100);
  expect(adapter.evaluate(all).status).toBe('held');
  adapter.setReviewState('not_assessed', adapter.facts().revision, 110);
  expect(adapter.evaluate(all).status).toBe('available');
  db.raw.exec('DROP TABLE health_support_note');
  expect(adapter.evaluate(all).status).toBe('support_unavailable');
});

test('withdrawn instruction holds do not block solely because review-state metadata remains', () => {
  const { db, adapter } = setup();
  adapter.saveInstruction({ instructionText: 'Reported instruction', scopes: [] }, 0, 100);
  db.raw.exec("UPDATE health_support_hold SET state='withdrawn',revision=revision+1");
  expect(adapter.facts().reviewState).toBe('review_required');
  expect(adapter.evaluate(all).status).toBe('available');
});

test('an orphan current instruction fails closed instead of becoming an empty restriction set', () => {
  const { db, adapter } = setup();
  adapter.saveInstruction({ instructionText: 'Reported instruction', scopes: [] }, 0, 100);
  // Deliberately damaged fixture: remove the held row only after disabling its no-delete trigger.
  db.raw.exec('DROP TRIGGER trg_health_support_hold_no_delete_held_bd; DELETE FROM health_support_hold;');
  expect(adapter.evaluate(all).status).toBe('support_unavailable');
});

test('Unicode resource bounds reject rather than truncate and note deletion preserves independent instructions', () => {
  const { adapter } = setup();
  const text = '🧑'.repeat(4000);
  const noteId = adapter.saveNote('general', text, undefined, 0, 100);
  expect(adapter.details().notes[0].bodyText).toBe(text);
  expect(() => adapter.saveNote('general', text + 'x', undefined, 1, 110)).toThrow(/4000/);
  adapter.saveInstruction({ instructionText: 'Independent', scopes: [] }, 1, 120);
  adapter.deleteNote(noteId, adapter.facts().revision, 130);
  expect(adapter.details().notes).toHaveLength(0);
  expect(adapter.details().instructions).toHaveLength(1);
  expect(adapter.evaluate(all).status).toBe('held');
});

test('one captured support snapshot evaluates a large candidate set without candidate-amplified reads', () => {
  const { db, adapter } = setup();
  const insertMovement = db.raw.prepare('INSERT INTO movement(movement_id) VALUES (?)');
  const insertHold = db.raw.prepare(`INSERT INTO health_support_hold
    (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
    VALUES (?,1,'user_requested','held','review_requested',1,1)`);
  const insertScope = db.raw.prepare(`INSERT INTO health_support_scope
    (scope_id,hold_id,target_kind,movement_id) VALUES (?,?,'movement',?)`);
  for (let movementId = 3; movementId <= 400; movementId += 1) insertMovement.run(movementId);
  for (let movementId = 1; movementId <= 64; movementId += 1) {
    insertHold.run(`hold-${movementId}`);
    insertScope.run(`scope-${movementId}`, `hold-${movementId}`, movementId);
  }

  let reads = 0;
  const executeSync = db.executeSync.bind(db);
  db.executeSync = (sql, values) => {
    if (/^\s*(SELECT|WITH)\b/i.test(String(sql))) reads += 1;
    return executeSync(sql, values);
  };
  const snapshot = adapter.captureEvaluation();
  const captureReads = reads;
  const decisions = Array.from({ length: 400 }, (_, index) =>
    snapshot.evaluate([{ targetKind: 'movement', movementId: index + 1 }]));

  expect(captureReads).toBe(68); // contract + profile + holds + orphan check + 64 scope reads
  expect(reads).toBe(captureReads);
  expect(decisions.slice(0, 64).every((decision) => decision.status === 'held')).toBe(true);
  expect(decisions.slice(64).every((decision) => decision.status === 'available')).toBe(true);
});

test('decision evidence preserves the supplied factual identity and fails closed above the schema bound', () => {
  const { db, adapter } = setup();
  const identity = 'session-start:session:42:movement:1';
  expect(adapter.recordDecision([{ targetKind: 'movement', movementId: 1 }], 'session', identity, 120).status).toBe('available');
  const row = db.raw.prepare(`SELECT decision_id,advice_target_identity AS identity
    FROM recommendation_support_record`).get();
  expect(row.identity).toBe(identity);
  expect(row.identity).not.toContain(row.decision_id);

  expect(adapter.recordDecision([{ targetKind: 'movement', movementId: 1 }], 'session', identity, 120).status).toBe('available');
  expect(db.raw.prepare(`SELECT generated_at_ms FROM recommendation_support_record
    WHERE advice_target_identity=?`).all(identity).map((record) => record.generated_at_ms)).toEqual([120]);

  db.raw.prepare("UPDATE recommendation_support_record SET engine_version='older-engine'").run();
  expect(adapter.recordDecision([{ targetKind: 'movement', movementId: 1 }], 'session', identity, 120).status).toBe('support_unavailable');
  db.raw.prepare("UPDATE recommendation_support_record SET engine_version='wo06-capture-2'").run();

  db.raw.exec(`INSERT INTO health_support_hold
    (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
    VALUES ('changed-same-ms',1,'user_requested','held','review_requested',1,1);
    INSERT INTO health_support_scope (scope_id,hold_id,target_kind,movement_id)
    VALUES ('changed-same-ms-scope','changed-same-ms','movement',1);`);
  expect(adapter.recordDecision([{ targetKind: 'movement', movementId: 1 }], 'session', identity, 120).status).toBe('support_unavailable');

  expect(adapter.recordDecision(all, 'session', 'x'.repeat(161), 121).status).toBe('support_unavailable');
  expect(db.raw.prepare('SELECT count(*) AS n FROM recommendation_support_record').get().n).toBe(1);
});
