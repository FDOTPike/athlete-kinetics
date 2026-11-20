/**
 * TodayUpdateWorkoutStore.test.js — issue 149, store side.
 *
 * After an equipment change, today's unstarted planned workout can hold a
 * movement the new equipment does not cover. These behavioural tests run the
 * REAL zustand store over the REAL migration chain (node:sqlite behind the
 * executeSync surface, as in SessionAccessBoundary.test.js) and pin:
 *
 *   - Today sees the conflict through todayPlanEquipmentConflict, the same
 *     access check startSession runs;
 *   - updateTodayPlannedWorkout rebuilds ONLY today's planned slots, the other
 *     planned days and today's planned_session row are byte-identical;
 *   - the rebuilt workout then starts, and passes the access check;
 *   - it works with no readiness vector;
 *   - nothing is rebuilt once a session has started from it, and nothing is
 *     rebuilt when there is no conflict.
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

const OWNED_EQUIPMENT = ['barbell', 'squat_rack', 'dumbbells', 'bench'];

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

/** A four-week block starting today, generated with the owned equipment. */
const generatedBlockWithEquipment = async (equipment) => {
  const boot = await bootStore();
  const { useStore } = boot;
  useStore.getState().saveProfile({ training_age: 'intermediate', equipment_inventory: equipment });
  useStore.getState().generateNewBlock('LINEAR');
  expect(useStore.getState().error).toBeNull();
  expect(useStore.getState().todayPlan).not.toBeNull();
  return boot;
};

/** Everything that is not today's planned workout, in a comparable form. */
const otherPlannedDays = (raw, todayId) => ({
  sessions: raw.prepare(
    'SELECT * FROM planned_session WHERE planned_session_id != ? ORDER BY planned_session_id',
  ).all(todayId),
  slots: raw.prepare(
    'SELECT * FROM planned_slot WHERE planned_session_id != ? ORDER BY planned_slot_id',
  ).all(todayId),
});

const todaySlots = (raw, todayId) => raw.prepare(
  'SELECT movement_id, sets, target_rpe FROM planned_slot WHERE planned_session_id = ? ORDER BY slot_index',
).all(todayId);

const todaySessionRow = (raw, todayId) => raw.prepare(
  'SELECT planned_session_id, week_index, day_index, focus, phase, session_date FROM planned_session WHERE planned_session_id = ?',
).get(todayId);

test('the conflict is visible before Start; the update rebuilds only today; the workout then starts', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  const todayId = useStore.getState().todayPlan.plannedSessionId;
  const beforeOthers = otherPlannedDays(raw, todayId);
  const beforeToday = todaySessionRow(raw, todayId);
  const beforeSlots = todaySlots(raw, todayId);

  // The equipment change: the owned barbell and rack are gone.
  useStore.getState().saveProfile({ equipment_inventory: [] });
  expect(useStore.getState().todayPlanEquipmentConflict()).toBe(true);

  expect(useStore.getState().updateTodayPlannedWorkout()).toBe(true);
  expect(useStore.getState().error).toBeNull();

  // Today is repaired: the same planned day, now startable.
  expect(useStore.getState().todayPlanEquipmentConflict()).toBe(false);
  expect(useStore.getState().todayPlan.plannedSessionId).toBe(todayId);
  expect(todaySessionRow(raw, todayId)).toEqual(beforeToday);
  expect(todaySlots(raw, todayId)).not.toEqual(beforeSlots);

  // Only today changed.
  expect(otherPlannedDays(raw, todayId)).toEqual(beforeOthers);

  useStore.getState().startSession();
  const started = useStore.getState();
  expect(started.error).toBeNull();
  expect(started.session).not.toBeNull();
  const origin = raw.prepare(
    'SELECT source_planned_session_id FROM session_origin WHERE session_id = ?',
  ).get(started.session.sessionId);
  expect(origin.source_planned_session_id).toBe(todayId);
});

test('the update works with no readiness vector', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  expect(useStore.getState().vector).toBeNull();
  const todayId = useStore.getState().todayPlan.plannedSessionId;

  useStore.getState().saveProfile({ equipment_inventory: [] });
  expect(useStore.getState().updateTodayPlannedWorkout()).toBe(true);
  expect(useStore.getState().vector).toBeNull();

  useStore.getState().startSession();
  expect(useStore.getState().session).not.toBeNull();
  expect(todaySlots(raw, todayId).length).toBeGreaterThan(0);
});

test('no conflict means nothing is rebuilt', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  const todayId = useStore.getState().todayPlan.plannedSessionId;
  const beforeSlots = todaySlots(raw, todayId);

  expect(useStore.getState().todayPlanEquipmentConflict()).toBe(false);
  expect(useStore.getState().updateTodayPlannedWorkout()).toBe(false);
  expect(useStore.getState().error).toBe("Today's workout already fits your equipment.");
  expect(todaySlots(raw, todayId)).toEqual(beforeSlots);
});

test('an open session blocks the update', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  const todayId = useStore.getState().todayPlan.plannedSessionId;

  useStore.getState().startSession();
  expect(useStore.getState().session).not.toBeNull();
  const beforeSlots = todaySlots(raw, todayId);

  useStore.getState().saveProfile({ equipment_inventory: [] });
  expect(useStore.getState().updateTodayPlannedWorkout()).toBe(false);
  expect(useStore.getState().error).toBe("End the active session before updating today's workout.");
  expect(todaySlots(raw, todayId)).toEqual(beforeSlots);
});

test('a session already started from today is never rebuilt, even with no session open', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  const todayId = useStore.getState().todayPlan.plannedSessionId;
  useStore.getState().startSession();
  expect(useStore.getState().session).not.toBeNull();
  const beforeSlots = todaySlots(raw, todayId);

  // The started session's origin row is durable; closing the session in state
  // alone must not make today's planned workout rebuildable.
  useStore.setState({ session: null });
  useStore.getState().saveProfile({ equipment_inventory: [] });
  expect(useStore.getState().todayPlanEquipmentConflict()).toBe(false);
  expect(useStore.getState().updateTodayPlannedWorkout()).toBe(false);
  expect(useStore.getState().error).toBe("Today's workout has already started, so it is not changed.");
  expect(todaySlots(raw, todayId)).toEqual(beforeSlots);
});

test('Start refuses while the conflict stands and nothing has been updated', async () => {
  const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
  const todayId = useStore.getState().todayPlan.plannedSessionId;
  const beforeSlots = todaySlots(raw, todayId);

  useStore.getState().saveProfile({ equipment_inventory: [] });
  useStore.getState().startSession();

  expect(useStore.getState().session).toBeNull();
  expect(useStore.getState().error).toBe(
    "Today's workout includes a movement your current equipment does not cover. Update today's workout before starting.",
  );
  expect(todaySlots(raw, todayId)).toEqual(beforeSlots);
});

const NON_EQUIPMENT_MSG =
  "This workout includes a movement outside your current safety or experience settings. Update today's workout to swap it for a matching alternative.";

describe('#354 non-equipment access boundaries & routine-frozen workout updates', () => {
  const freezeSingleMoveRoutine = async (trainingAge, movementName) => {
    const boot = await bootStore();
    const { useStore, raw } = boot;
    useStore.getState().saveProfile({
      training_age: trainingAge,
      equipment_inventory: OWNED_EQUIPMENT,
    });
    const row = raw.prepare(
      `SELECT m.movement_id, m.name
         FROM movement m
         JOIN movement_role_eligibility r USING (movement_id)
        WHERE r.role = 'major' AND m.name = ?
        ORDER BY m.movement_id LIMIT 1`,
    ).get(movementName);
    expect(row).toBeDefined();
    const saved = useStore.getState().saveRoutineTemplate({
      name: 'Stage A test routine',
      schemaType: 'LINEAR',
      slots: [{
        dayIndex: 1, slotIndex: 1, movementId: Number(row.movement_id),
        role: 'major', sets: 3, reps: 5, targetRpe: 7.5,
      }],
    });
    const frozen = useStore.getState().freezeRoutineTemplateToPlannedSession(saved.routineTemplateId, undefined, 1);
    expect(frozen.plannedSessionId).toBeGreaterThan(0);
    return { ...boot, templateId: saved.routineTemplateId, plannedSessionId: frozen.plannedSessionId };
  };

  test('active niggle triggers non-equipment conflict (even when equipment also fails), startSession error matches, and update repairs today', async () => {
    const { useStore, raw } = await generatedBlockWithEquipment(OWNED_EQUIPMENT);
    const todayId = useStore.getState().todayPlan.plannedSessionId;
    const beforeOthers = otherPlannedDays(raw, todayId);

    // Default strength Day 1 is lower (knee-loaded squat/hinge/lunge); report knee niggle >= triageMin(4) & < haltMin(8).
    expect(useStore.getState().reportNiggle('knee', 5)).toBe(true);
    expect(useStore.getState().todayPlanEquipmentConflict()).toBe(true);
    useStore.getState().startSession();
    expect(useStore.getState().session).toBeNull();
    expect(useStore.getState().error).toBe(NON_EQUIPMENT_MSG);
    expect(useStore.getState().todayPlanConflictReason()).toBe('non_equipment');

    // Precedence: if equipment is ALSO removed, non-equipment copy still wins over equipment copy.
    useStore.getState().saveProfile({ equipment_inventory: [] });
    useStore.getState().startSession();
    expect(useStore.getState().session).toBeNull();
    expect(useStore.getState().error).toBe(NON_EQUIPMENT_MSG);
    expect(useStore.getState().todayPlanConflictReason()).toBe('non_equipment');

    // Restore equipment while niggle persists -> update replaces knee-loaded slots and allows startSession.
    useStore.getState().saveProfile({ equipment_inventory: OWNED_EQUIPMENT });
    expect(useStore.getState().updateTodayPlannedWorkout()).toBe(true);
    expect(useStore.getState().todayPlanEquipmentConflict()).toBe(false);
    expect(useStore.getState().todayPlanConflictReason()).toBeNull();
    expect(otherPlannedDays(raw, todayId)).toEqual(beforeOthers);
    useStore.getState().startSession();
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().session).not.toBeNull();
  });

  test('tier ceiling classifies as non-equipment on Today and startSession and update repairs today', async () => {
    const tierBoot = await bootStore();
    tierBoot.useStore.getState().saveProfile({
      training_age: 'advanced',
      equipment_inventory: OWNED_EQUIPMENT,
      objective: 'strength',
    });
    tierBoot.useStore.getState().generateNewBlock('LINEAR');
    expect(tierBoot.useStore.getState().todayPlan).not.toBeNull();
    tierBoot.useStore.getState().saveProfile({ training_age: 'beginner' });
    expect(tierBoot.useStore.getState().todayPlanEquipmentConflict()).toBe(true);
    expect(tierBoot.useStore.getState().todayPlanConflictReason()).toBe('non_equipment');
    tierBoot.useStore.getState().startSession();
    expect(tierBoot.useStore.getState().session).toBeNull();
    expect(tierBoot.useStore.getState().error).toBe(NON_EQUIPMENT_MSG);
    expect(tierBoot.useStore.getState().updateTodayPlannedWorkout()).toBe(true);
    expect(tierBoot.useStore.getState().todayPlanConflictReason()).toBeNull();
    tierBoot.useStore.getState().startSession();
    expect(tierBoot.useStore.getState().session).not.toBeNull();
  });

  test('capability prerequisite only classifies as non-equipment on Today and startSession', async () => {
    const capBoot = await freezeSingleMoveRoutine('advanced', 'Front Squat');
    capBoot.useStore.getState().saveProfile({ training_age: 'intermediate', objective: 'gpp' });
    expect(capBoot.useStore.getState().todayPlanEquipmentConflict()).toBe(true);
    expect(capBoot.useStore.getState().todayPlanConflictReason()).toBe('non_equipment');
    capBoot.useStore.getState().startSession();
    expect(capBoot.useStore.getState().session).toBeNull();
    expect(capBoot.useStore.getState().error).toBe(NON_EQUIPMENT_MSG);
  });

  test('routine-frozen workout failing access boundary can be updated (clearing routine freeze); valid intermediate routine stays locked', async () => {
    const { useStore, raw, templateId, plannedSessionId } = await freezeSingleMoveRoutine(
      'intermediate',
      'Barbell Bench Press - Medium Grip',
    );
    expect(useStore.getState().profile.training_age).toBe('intermediate');

    // Negative invariant: while valid for intermediate, update refuses with the routine refusal.
    expect(useStore.getState().todayPlanEquipmentConflict()).toBe(false);
    expect(useStore.getState().updateTodayPlannedWorkout()).toBe(false);
    expect(useStore.getState().error).toBe("Today's workout comes from a routine. Edit the routine to change it.");

    // Equipment change makes routine workout fail access boundary -> update replaces & clears routine lock.
    useStore.getState().saveProfile({ equipment_inventory: [] });
    expect(useStore.getState().todayPlanEquipmentConflict()).toBe(true);
    expect(useStore.getState().updateTodayPlannedWorkout()).toBe(true);
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().todayPlanConflictReason()).toBeNull();
    expect(raw.prepare('SELECT COUNT(*) AS c FROM planned_session_method WHERE planned_session_id = ?').get(plannedSessionId).c).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS c FROM planned_session_routine_context WHERE planned_session_id = ?').get(plannedSessionId).c).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS c FROM routine_template WHERE routine_template_id = ?').get(templateId).c).toBe(1);

    useStore.getState().startSession();
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().session).not.toBeNull();
  });

  test('beginner inherited routine lock (even with beginner-safe movement) surfaces update and clears lock cleanly', async () => {
    const { useStore, raw, templateId, plannedSessionId } = await freezeSingleMoveRoutine(
      'intermediate',
      'Barbell Bench Press - Medium Grip',
    );
    useStore.getState().saveProfile({ training_age: 'beginner', objective: 'strength' });

    const todaySlotMovementId = useStore.getState().todayPlan.slots[0].movementId;
    const verdictForBeginner = useStore.getState()
      .getMovementAvailabilityVerdicts('weight_room')
      .find((v) => v.movementId === todaySlotMovementId);
    expect(verdictForBeginner?.state).toBe('available');

    expect(useStore.getState().todayPlanEquipmentConflict()).toBe(true);
    expect(useStore.getState().todayPlanConflictReason()).toBe('non_equipment');
    expect(useStore.getState().updateTodayPlannedWorkout()).toBe(true);
    expect(useStore.getState().error).toBeNull();
    expect(raw.prepare('SELECT COUNT(*) AS c FROM planned_session_method WHERE planned_session_id = ?').get(plannedSessionId).c).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS c FROM planned_session_routine_context WHERE planned_session_id = ?').get(plannedSessionId).c).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS c FROM routine_template WHERE routine_template_id = ?').get(templateId).c).toBe(1);

    useStore.getState().startSession();
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().session).not.toBeNull();
  });
});
