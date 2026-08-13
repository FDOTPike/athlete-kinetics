/**
 * SessionAccessBoundary.test.js — executable regressions for the STORE-side
 * access boundary in useStore.logSet.
 *
 * SessionScreen disables an unavailable slot, but logSet is a public store
 * action. Before this boundary existed, a direct call could persist a set for
 * a movement the shared capability law refuses — the residual gap disclosed by
 * the movement-access audit.
 *
 * These are behavioural tests, not source-string assertions. They run the REAL
 * zustand store, booted by the REAL production boot path, over the REAL
 * production migration chain, against real library records pinned by name. The
 * only substitution is the storage driver: op-sqlite's synchronous JSI handle
 * is replaced by node:sqlite behind the exact `executeSync` surface the
 * production DAO speaks. Everything above that line — pragmas, the migration
 * runner, the movement library query, the capability resolver, the session
 * runner and its durable checkpoint — is production code.
 *
 * Each test boots its own isolated store and in-memory database, so a refusal
 * can be measured against a database that only this test wrote to.
 */

// The store opens its database through packages/core-db's deferred
// `require('@op-engineering/op-sqlite')`, which is what makes this swap
// possible without touching production code.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => {
    const { DatabaseSync } = require('node:sqlite');
    const raw = new DatabaseSync(':memory:');
    // The device build ships SQLite with SQLITE_ENABLE_MATH_FUNCTIONS; the
    // CLI/test driver shims the two the 001/004 materialization needs, exactly
    // as scripts/seed-db.ts and the other gates do.
    try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
      raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
      raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
    }
    const handle = {
      raw,
      executeSync(sql, params) {
        const text = String(sql);
        const bound = params ?? [];
        // A parameterized call is always one statement; a bare row-returning
        // statement is prepared; everything else (including a whole migration
        // file) goes through exec, which is what op-sqlite accepts too.
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

// Library records pinned by name via the real chain (see verify:pipeline's
// named acceptance block for the same pins).
const SUMO_DEADLIFT = 78;   // hinge, Intermediate, barbell only, NO prerequisite
const FRONT_SQUAT = 8;      // squat, Intermediate, barbell+rack, ONE ordinary prerequisite
const PUSH_UP = 16;         // push_h, Beginner, no equipment, no prerequisite, bodyweight

const OWNED_EQUIPMENT = ['barbell', 'squat_rack', 'dumbbells', 'bench'];

const count = (raw, sql, params = []) =>
  Number(raw.prepare(sql).get(...params).c);

/** Everything logSet is allowed to write, in one comparable snapshot. */
const writeFingerprint = (raw, sessionId) => ({
  setRecords: count(raw, 'SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', [sessionId]),
  setTargets: count(raw, 'SELECT COUNT(*) AS c FROM set_target'),
  setDoseTargets: count(raw, 'SELECT COUNT(*) AS c FROM set_dose_target'),
  setMetrics: count(raw, 'SELECT COUNT(*) AS c FROM set_metric'),
  setPrefixes: count(raw, 'SELECT COUNT(*) AS c FROM set_prefix'),
  checkpoint: raw.prepare(
    `SELECT phase, current_set_index, runner_state_json
       FROM session_runner_checkpoint WHERE session_id = ?`,
  ).get(sessionId) ?? null,
});

const runnerSnapshot = (useStore) => JSON.parse(JSON.stringify(useStore.getState().runner));

const bootStore = async () => {
  jest.resetModules();
  globalThis.__akTestSqlite = null;
  const { useStore } = require('../../src/state/useStore');
  useStore.getState().boot();
  // boot() awaits the athlete-registry read (which fails closed to the default
  // single-athlete registry under test) before its synchronous tail.
  for (let i = 0; i < 500 && useStore.getState().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(useStore.getState().status).toBe('ready');
  const raw = globalThis.__akTestSqlite.raw;
  // The real library really is loaded — proof the migration chain ran.
  expect(useStore.getState().movements).toHaveLength(300);
  return { useStore, raw };
};

/**
 * Boot, set an Intermediate athlete with a real inventory, seed one prior
 * session, then start today's session through the production free-form path
 * so the plan, the runner and the frozen access context are all real.
 */
const startSessionWith = async (movementIds, { confirmPriorExperienceFor = [] } = {}) => {
  const { useStore, raw } = await bootStore();
  useStore.getState().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: OWNED_EQUIPMENT,
  });
  expect(useStore.getState().profile.equipment_inventory).toEqual(
    expect.arrayContaining(['barbell']),
  );
  for (const movementId of confirmPriorExperienceFor) {
    expect(useStore.getState().confirmMovementPriorExperience(movementId, 'weight_room')).toBe(true);
  }

  raw.exec(`INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min)
            VALUES (9000, NULL, '2026-08-01', 1, 60)`);
  movementIds.forEach((movementId, index) => {
    raw.prepare(`INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
                 VALUES (9000, ?, 1, 5, 60.0, 8, ?)`).run(movementId, 1000 + index);
  });

  useStore.getState().startSession();
  const state = useStore.getState();
  expect(state.error).toBeNull();
  expect(state.session).not.toBeNull();
  expect(state.activeSessionAccessContext).toBe('weight_room');
  expect(state.sessionPlan.map((slot) => slot.movementId)).toEqual(movementIds);
  return { useStore, raw, sessionId: state.session.sessionId };
};

describe('logSet access boundary (real store, real production chain)', () => {
  test('an available control movement still logs, and the write lands in full', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([SUMO_DEADLIFT]);
    const slot = useStore.getState().sessionPlan[0];

    useStore.getState().logSet(
      SUMO_DEADLIFT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBeNull();
    const row = raw.prepare(
      'SELECT movement_id, reps, load_kg, rpe FROM set_record WHERE session_id = ?',
    ).get(sessionId);
    expect(row).toMatchObject({ movement_id: SUMO_DEADLIFT, reps: 5, load_kg: 60, rpe: 8 });
    expect(count(raw, 'SELECT COUNT(*) AS c FROM set_target')).toBe(1);
    expect(useStore.getState().session.sets).toHaveLength(1);
    expect(useStore.getState().runner.loggedSets).toBe(1);
  });

  test('a manual bodyweight load of 0.0 remains accepted', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([PUSH_UP]);
    const slot = useStore.getState().sessionPlan[0];

    useStore.getState().logSet(
      PUSH_UP, 12, 0, null, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBeNull();
    const row = raw.prepare(
      'SELECT movement_id, reps, load_kg, rpe FROM set_record WHERE session_id = ?',
    ).get(sessionId);
    // Explicit zero is a real logged value, never absent evidence.
    expect(row).toMatchObject({ movement_id: PUSH_UP, reps: 12, load_kg: 0, rpe: null });
    expect(useStore.getState().session.sets[0].load_kg).toBe(0);
  });

  test('a relevant mid-session niggle blocks a direct logSet and writes nothing', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([SUMO_DEADLIFT]);
    const slot = useStore.getState().sessionPlan[0];

    // Sumo Deadlift is a hinge; hinge loads hip and lower_back. An
    // intermediate athlete's triage minimum is 4, its halt minimum 8 — so this
    // report is explicitly NON-halting and must leave the session usable.
    useStore.getState().reportNiggle('hip', 4);
    expect(useStore.getState().niggles).toEqual([{ region: 'hip', severity: 4 }]);
    expect(useStore.getState().runner.phase).toBe('working');

    const before = writeFingerprint(raw, sessionId);
    const runnerBefore = runnerSnapshot(useStore);
    expect(before.setRecords).toBe(0);

    useStore.getState().logSet(
      SUMO_DEADLIFT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBe('Teaching only — held back by a reported niggle');
    expect(writeFingerprint(raw, sessionId)).toEqual(before);
    expect(runnerSnapshot(useStore)).toEqual(runnerBefore);
    expect(useStore.getState().session.sets).toHaveLength(0);
  });

  test('a missing frozen access context blocks a direct logSet with no fallback', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([SUMO_DEADLIFT]);
    const slot = useStore.getState().sessionPlan[0];

    // The context an active session froze at start is the only authority. An
    // unverifiable one must refuse, never silently re-derive weight_room.
    useStore.setState({ activeSessionAccessContext: null });

    const before = writeFingerprint(raw, sessionId);
    const runnerBefore = runnerSnapshot(useStore);

    useStore.getState().logSet(
      SUMO_DEADLIFT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBe(
      'The active session access context cannot be verified. Reopen the session before logging more work.',
    );
    expect(writeFingerprint(raw, sessionId)).toEqual(before);
    expect(runnerSnapshot(useStore)).toEqual(runnerBefore);
  });

  test('losing the required equipment mid-session blocks a direct logSet', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([SUMO_DEADLIFT]);
    const slot = useStore.getState().sessionPlan[0];

    useStore.getState().saveProfile({ equipment_inventory: [] });
    expect(useStore.getState().profile.equipment_inventory).toEqual([]);

    const before = writeFingerprint(raw, sessionId);
    const runnerBefore = runnerSnapshot(useStore);

    useStore.getState().logSet(
      SUMO_DEADLIFT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBe("Teaching only — needs equipment you don't have");
    expect(writeFingerprint(raw, sessionId)).toEqual(before);
    expect(runnerSnapshot(useStore)).toEqual(runnerBefore);
  });

  test('revoking a prior-experience confirmation blocks the next direct logSet', async () => {
    // Front Squat sits behind one ordinary capability prerequisite. An
    // Intermediate athlete may clear it by declaring prior experience — and
    // revoking that declaration must close the movement again immediately.
    const { useStore, raw, sessionId } = await startSessionWith([FRONT_SQUAT], {
      confirmPriorExperienceFor: [FRONT_SQUAT],
    });
    const slot = useStore.getState().sessionPlan[0];

    useStore.getState().logSet(
      FRONT_SQUAT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );
    expect(useStore.getState().error).toBeNull();
    expect(count(raw, 'SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', [sessionId])).toBe(1);

    // Return the runner to a loggable step so the refusal below can only come
    // from the access boundary, never from rest-phase sequencing.
    useStore.getState().skipRunnerRest();
    expect(useStore.getState().runner.phase).toBe('working');

    expect(useStore.getState().revokeMovementPriorExperience(FRONT_SQUAT)).toBe(true);

    const before = writeFingerprint(raw, sessionId);
    const runnerBefore = runnerSnapshot(useStore);
    expect(before.setRecords).toBe(1);

    useStore.getState().logSet(
      FRONT_SQUAT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );

    expect(useStore.getState().error).toBe(
      'Teaching only — prior-experience confirmation is available',
    );
    expect(writeFingerprint(raw, sessionId)).toEqual(before);
    expect(runnerSnapshot(useStore)).toEqual(runnerBefore);
    expect(useStore.getState().session.sets).toHaveLength(1);
  });

  test('the refusal is the access law, not the slot-identity or halt guards', async () => {
    const { useStore, raw, sessionId } = await startSessionWith([SUMO_DEADLIFT]);
    const slot = useStore.getState().sessionPlan[0];

    // Identity and halt handling still own their own refusals and messages.
    useStore.getState().logSet(
      PUSH_UP, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );
    expect(useStore.getState().error).toContain('Mismatched slot and movement');
    expect(count(raw, 'SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', [sessionId])).toBe(0);

    useStore.getState().runnerHalt('manual');
    useStore.getState().logSet(
      SUMO_DEADLIFT, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId,
    );
    expect(useStore.getState().error).toBe(
      'Training is halted. Finish the session before logging more work.',
    );
    expect(count(raw, 'SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', [sessionId])).toBe(0);
  });
});

describe('bounded routine store path (real store, real production chain)', () => {
  test('freezes Board Press plus Competition Bench as one weighted exposure and survives template deletion', async () => {
    const { useStore, raw } = await bootStore();
    useStore.getState().saveProfile({
      training_age: 'elite',
      session_duration_cap_min: 120,
      equipment_inventory: [...OWNED_EQUIPMENT, 'bands', 'boards'],
    });
    const idOf = (name) => Number(raw.prepare(
      'SELECT movement_id FROM movement WHERE name = ?',
    ).get(name).movement_id);
    const boardPressId = idOf('Board Press');
    const competitionBenchId = idOf('Competition Bench');

    const template = useStore.getState().saveRoutineTemplate({
      name: 'Distributed bench day',
      schemaType: 'LINEAR',
      slots: [
        { dayIndex: 1, slotIndex: 1, movementId: boardPressId, role: 'major', sets: 2, reps: 6, targetRpe: 8 },
        { dayIndex: 1, slotIndex: 2, movementId: competitionBenchId, role: 'major', sets: 3, reps: 7, targetRpe: 8 },
      ],
    });
    expect(template.slots.map((slot) => [slot.movementId, slot.sets, slot.reps])).toEqual([
      [boardPressId, 2, 6], [competitionBenchId, 3, 7],
    ]);

    const frozen = useStore.getState().freezeRoutineTemplateToPlannedSession(
      template.routineTemplateId, undefined, 1,
    );
    const context = raw.prepare(`
      SELECT family_decisions_json FROM planned_session_routine_context
      WHERE planned_session_id = ?
    `).get(frozen.plannedSessionId);
    const benchDecision = JSON.parse(context.family_decisions_json)
      .find((decision) => decision.family === 'bench_press');
    expect(benchDecision).toMatchObject({
      exposureCount: 1,
      variationCount: 2,
      equivalentVolume: 31.8,
    });
    expect(benchDecision.sessions[0]).toMatchObject({
      exposureCount: 1,
      variationCount: 2,
      equivalentVolume: 31.8,
    });
    const frozenSlots = raw.prepare(`
      SELECT ps.movement_id, ps.sets, ps.reps, rd.lift_family, rd.stress_purpose,
             rd.stress_coefficient, rd.equivalent_volume
      FROM planned_slot ps
      JOIN planned_slot_routine_decision rd USING (planned_slot_id)
      WHERE ps.planned_session_id = ? ORDER BY ps.slot_index
    `).all(frozen.plannedSessionId);
    expect(frozenSlots).toEqual([
      expect.objectContaining({
        movement_id: boardPressId, sets: 2, reps: 6, lift_family: 'bench_press',
        stress_purpose: 'heavy', stress_coefficient: 0.9, equivalent_volume: 10.8,
      }),
      expect.objectContaining({
        movement_id: competitionBenchId, sets: 3, reps: 7, lift_family: 'bench_press',
        stress_purpose: 'volume', stress_coefficient: 1, equivalent_volume: 21,
      }),
    ]);

    // Structurally valid but semantically corrupt review JSON must fail closed
    // instead of silently starting a routine with no reviewable family stress.
    raw.prepare(`
      UPDATE planned_session_routine_context SET family_decisions_json = '[{}]'
      WHERE planned_session_id = ?
    `).run(frozen.plannedSessionId);
    useStore.getState().refreshBlock();
    useStore.getState().startSession();
    expect(useStore.getState().session).toBeNull();
    expect(useStore.getState().error).toContain('frozen stress review is missing or invalid');
    raw.prepare(`
      UPDATE planned_session_routine_context SET family_decisions_json = ?
      WHERE planned_session_id = ?
    `).run(context.family_decisions_json, frozen.plannedSessionId);
    useStore.setState({ error: null });
    useStore.getState().refreshBlock();

    // A positive readiness day cannot grow a dose that the complete
    // microcycle already bounded and froze.
    useStore.setState({
      prescription: {
        vector: {
          load_modifier: 1.05,
          set_modifier: 1,
          rpe_cap: 10,
          coaching_cue: 'Good readiness supports the frozen routine as written.',
        },
        source: 'policy',
        forDate: useStore.getState().today,
      },
    });

    // The frozen sidecars, not a mutable template, own execution provenance.
    useStore.getState().deleteRoutineTemplate(template.routineTemplateId);
    useStore.getState().startSession();
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().sessionPlan.map((slot) => slot.movementId)).toEqual([
      boardPressId, competitionBenchId,
    ]);
    expect(useStore.getState().sessionPlan.map((slot) => slot.plannedSets)).toEqual([2, 3]);
  });
});
