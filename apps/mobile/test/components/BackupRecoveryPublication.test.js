import {
  RecoveryPublicationUnresolvedError,
  publishRecoveryBackup,
  reconcileRecoveryPublication,
} from '../../src/state/backupRecoveryPublication';

const paths = {
  final: '/doc/pikeMethods-recovery-current.pmbak',
  fresh: '/doc/pikeMethods-recovery-current.pmbak.new',
  previous: '/doc/pikeMethods-recovery-current.pmbak.previous',
};

// Neighbouring and lookalike names that no publication or reconciliation step may touch.
const UNRELATED = Object.freeze({
  '/doc/pikeMethods-recovery-current.pmbak.bak': 'unrelated-bak',
  '/doc/pikeMethods-recovery-current.pmbak.previous.new': 'unrelated-previous-new',
  '/doc/pikeMethods-recovery-current.pmbak.new.previous': 'unrelated-new-previous',
  '/doc/pikeMethods-recovery-current.pmbak.tmp': 'unrelated-tmp',
  '/doc/user-recovery.pmbak': 'unrelated-user',
  '/doc/coach_athletes.json': 'unrelated-registry',
});

const envelope = (label) => `{"container":"${label}"}`;
/** Structural stand-in for isWellFormedBackupContainer: complete envelope text only. */
const isWellFormed = (text) => /^\{"container":"[a-z-]+"\}$/.test(text);
const tear = (text) => text.slice(0, Math.ceil(text.length / 2));
const RETAINED = envelope('retained-older-recovery');
const SEALED = envelope('sealed-current-data');
const SEALED_IDENTITY = 'sealed-identity';

/** In-memory app-private directory. Every operation, including authentication,
 * is an indexed boundary where the process can die or the operation can fail. */
function harness(initial, { dieAt = null, tornDeath = false, failAt = [], corrupt = null } = {}) {
  const files = new Map(Object.entries({ ...UNRELATED, ...initial }));
  const operations = [];
  const failures = new Set(failAt);
  let dead = false;
  const step = (kind, target, apply) => {
    if (dead) throw new Error('process is dead');
    const index = operations.length;
    operations.push(`${kind} ${target}`);
    if (index === dieAt) {
      dead = true;
      if (tornDeath && kind === 'write') apply(true);
      throw new Error(`process death before ${kind} ${target}`);
    }
    if (failures.has(index)) throw new Error(`injected failure at ${kind} ${target}`);
    return apply(false);
  };
  const name = (path) => path.slice('/doc/'.length);
  const io = {
    exists: async (path) => step('exists', name(path), () => files.has(path)),
    read: async (path) => step('read', name(path), () => {
      if (!files.has(path)) throw new Error(`missing ${path}`);
      return files.get(path);
    }),
    write: async (path, value) => step('write', name(path), (partial) => {
      files.set(path, partial ? tear(value) : corrupt === 'write' ? envelope('tampered-fresh') : value);
    }),
    move: async (source, destination) => step('move', `${name(source)} -> ${name(destination)}`, () => {
      // A native move onto an existing destination deletes it first; never rely on that hidden delete.
      if (!files.has(source) || files.has(destination)) throw new Error('move precondition violated');
      const moved = corrupt === 'move' && source === paths.fresh ? envelope('tampered-final') : files.get(source);
      files.delete(source);
      files.set(destination, moved);
    }),
    remove: async (path) => step('remove', name(path), () => { files.delete(path); }),
  };
  const authenticate = async (text) => step('verify', 'archive', () => (text === SEALED ? SEALED_IDENTITY : null));
  return { io, authenticate, files, operations };
}

const recoveryFiles = (files) => ({
  final: files.get(paths.final) ?? null,
  fresh: files.get(paths.fresh) ?? null,
  previous: files.get(paths.previous) ?? null,
});

const restart = (files, options) => harness(Object.fromEntries(files), options);

function expectUnrelatedIntact(files) {
  for (const [path, value] of Object.entries(UNRELATED)) expect(files.get(path)).toBe(value);
}

function candidate(role, kind) {
  if (kind === 'absent') return {};
  const value = envelope(`${role}-archive`);
  return { [paths[role]]: kind === 'wellFormed' ? value : tear(value) };
}

/** Every previous/final/fresh combination. Columns: previous, final, fresh,
 * the role whose bytes survive at the final path, the reconciliation outcome,
 * and whether publication, abandonment or reconciliation can produce the state
 * (proved by the enumeration test below rather than asserted by hand). */
const RECONCILIATION_TABLE = [
  ['absent', 'absent', 'absent', null, 'unchanged', true],
  ['absent', 'absent', 'wellFormed', 'fresh', 'promoted_fresh', true],
  ['absent', 'absent', 'malformed', null, 'discarded_malformed', true],
  ['absent', 'wellFormed', 'absent', 'final', 'unchanged', true],
  ['absent', 'wellFormed', 'wellFormed', 'final', 'kept_final', true],
  ['absent', 'wellFormed', 'malformed', 'final', 'kept_final', true],
  ['absent', 'malformed', 'absent', 'final', 'unchanged', false],
  ['absent', 'malformed', 'wellFormed', 'final', 'kept_final', false],
  ['absent', 'malformed', 'malformed', 'final', 'kept_final', false],
  ['wellFormed', 'absent', 'absent', 'previous', 'restored_previous', true],
  ['wellFormed', 'absent', 'wellFormed', 'previous', 'restored_previous', true],
  ['wellFormed', 'absent', 'malformed', 'previous', 'restored_previous', false],
  ['wellFormed', 'wellFormed', 'absent', 'previous', 'restored_previous', true],
  ['wellFormed', 'wellFormed', 'wellFormed', 'previous', 'restored_previous', false],
  ['wellFormed', 'wellFormed', 'malformed', 'previous', 'restored_previous', false],
  ['wellFormed', 'malformed', 'absent', 'previous', 'restored_previous', false],
  ['wellFormed', 'malformed', 'wellFormed', 'previous', 'restored_previous', false],
  ['wellFormed', 'malformed', 'malformed', 'previous', 'restored_previous', false],
  ['malformed', 'absent', 'absent', null, 'discarded_malformed', false],
  ['malformed', 'absent', 'wellFormed', 'fresh', 'promoted_fresh', false],
  ['malformed', 'absent', 'malformed', null, 'discarded_malformed', false],
  ['malformed', 'wellFormed', 'absent', 'final', 'kept_final', false],
  ['malformed', 'wellFormed', 'wellFormed', 'final', 'kept_final', false],
  ['malformed', 'wellFormed', 'malformed', 'final', 'kept_final', false],
  ['malformed', 'malformed', 'absent', 'final', 'kept_final', false],
  ['malformed', 'malformed', 'wellFormed', 'final', 'kept_final', false],
  ['malformed', 'malformed', 'malformed', 'final', 'kept_final', false],
];

function tableState(previous, final, fresh) {
  return { ...candidate('previous', previous), ...candidate('final', final), ...candidate('fresh', fresh) };
}

function publicationDeathCases(operations) {
  const cases = [];
  for (let dieAt = 0; dieAt <= operations.length; dieAt += 1) {
    cases.push({ dieAt, tornDeath: false });
    if (operations[dieAt]?.startsWith('write ')) cases.push({ dieAt, tornDeath: true });
  }
  return cases;
}

async function cleanPublication(initial) {
  const clean = harness(initial);
  await publishRecoveryBackup(clean.io, paths, SEALED, clean.authenticate);
  return clean;
}

describe('startup reconciliation of recovery rotation files', () => {
  test.each(RECONCILIATION_TABLE)('previous %s, final %s, fresh %s -> survivor %s (%s)', async (previous, final, fresh, survivor, outcome) => {
    const initial = tableState(previous, final, fresh);
    const expectedFinal = survivor === null ? null : initial[paths[survivor]];

    const run = harness(initial);
    await expect(reconcileRecoveryPublication(run.io, paths, isWellFormed, false)).resolves.toBe(outcome);
    expect(recoveryFiles(run.files)).toEqual({ final: expectedFinal, fresh: null, previous: null });
    expectUnrelatedIntact(run.files);

    const settled = run.operations.length;
    await expect(reconcileRecoveryPublication(run.io, paths, isWellFormed, false)).resolves.toBe('unchanged');
    expect(run.operations.slice(settled).every((operation) => operation.startsWith('exists '))).toBe(true);

    const journaled = harness(initial);
    const before = new Map(journaled.files);
    const reconciliation = reconcileRecoveryPublication(journaled.io, paths, isWellFormed, true);
    if (previous === 'absent' && fresh === 'absent') await expect(reconciliation).resolves.toBe('unchanged');
    else await expect(reconciliation).rejects.toBeInstanceOf(RecoveryPublicationUnresolvedError);
    expect(journaled.files).toEqual(before);
  });

  test.each(RECONCILIATION_TABLE)('death at every reconciliation boundary converges: previous %s, final %s, fresh %s', async (previous, final, fresh, survivor) => {
    const initial = tableState(previous, final, fresh);
    const expectedFinal = survivor === null ? null : initial[paths[survivor]];
    const clean = harness(initial);
    await reconcileRecoveryPublication(clean.io, paths, isWellFormed, false);
    for (let dieAt = 0; dieAt < clean.operations.length; dieAt += 1) {
      const interrupted = harness(initial, { dieAt });
      await expect(reconcileRecoveryPublication(interrupted.io, paths, isWellFormed, false)).rejects.toThrow('process death');
      if (expectedFinal !== null) expect(Object.values(recoveryFiles(interrupted.files))).toContain(expectedFinal);
      const restarted = restart(interrupted.files);
      await reconcileRecoveryPublication(restarted.io, paths, isWellFormed, false);
      expect(recoveryFiles(restarted.files)).toEqual({ final: expectedFinal, fresh: null, previous: null });
      expectUnrelatedIntact(restarted.files);
    }
  });
});

describe('portable-restore recovery publication', () => {
  test.each([true, false])('retained recovery %p: authenticated before promotion and at the final path, with no delete before a move', async (retained) => {
    const clean = await cleanPublication(retained ? { [paths.final]: RETAINED } : {});
    expect(recoveryFiles(clean.files)).toEqual({ final: SEALED, fresh: null, previous: null });
    expectUnrelatedIntact(clean.files);
    expect(clean.operations).toEqual([
      'exists pikeMethods-recovery-current.pmbak.new',
      'exists pikeMethods-recovery-current.pmbak.previous',
      'exists pikeMethods-recovery-current.pmbak',
      'write pikeMethods-recovery-current.pmbak.new',
      'read pikeMethods-recovery-current.pmbak.new',
      'verify archive',
      ...(retained ? ['move pikeMethods-recovery-current.pmbak -> pikeMethods-recovery-current.pmbak.previous'] : []),
      'move pikeMethods-recovery-current.pmbak.new -> pikeMethods-recovery-current.pmbak',
      'read pikeMethods-recovery-current.pmbak',
      'verify archive',
      ...(retained ? ['remove pikeMethods-recovery-current.pmbak.previous'] : []),
    ]);
  });

  test.each(['fresh', 'previous'])('refuses to publish over an unreconciled %s rotation file without changing anything', async (role) => {
    const run = harness({ [paths.final]: RETAINED, [paths[role]]: envelope('leftover-rotation') });
    const before = new Map(run.files);
    await expect(publishRecoveryBackup(run.io, paths, SEALED, run.authenticate)).rejects.toBeInstanceOf(RecoveryPublicationUnresolvedError);
    expect(run.files).toEqual(before);
  });

  test.each([
    ['the fresh file', 'write', /^The recovery backup could not be verified/],
    ['the promoted final file', 'move', /^The retained recovery backup could not be verified/],
  ])('when %s fails authentication the pre-publication recovery state is restored', async (_label, corrupt, message) => {
    for (const retained of [true, false]) {
      const run = harness(retained ? { [paths.final]: RETAINED } : {}, { corrupt });
      await expect(publishRecoveryBackup(run.io, paths, SEALED, run.authenticate)).rejects.toThrow(message);
      expect(recoveryFiles(run.files)).toEqual({ final: retained ? RETAINED : null, fresh: null, previous: null });
      expectUnrelatedIntact(run.files);
    }
  });

  test.each([true, false])('an in-process failure at every write, move, verification and removal restores the pre-publication state (retained %p)', async (retained) => {
    const initial = retained ? { [paths.final]: RETAINED } : {};
    const clean = await cleanPublication(initial);
    for (let failAt = 0; failAt < clean.operations.length; failAt += 1) {
      const run = harness(initial, { failAt: [failAt] });
      await expect(publishRecoveryBackup(run.io, paths, SEALED, run.authenticate)).rejects.toThrow();
      expect(recoveryFiles(run.files)).toEqual({ final: retained ? RETAINED : null, fresh: null, previous: null });
      expectUnrelatedIntact(run.files);
    }
  });

  test.each([true, false])('a failed abandonment stays recoverable and startup converges without losing the retained recovery (retained %p)', async (retained) => {
    const initial = retained ? { [paths.final]: RETAINED } : {};
    const clean = await cleanPublication(initial);
    let unresolvedCases = 0;
    for (let failAt = 0; failAt < clean.operations.length; failAt += 1) {
      const probe = harness(initial, { failAt: [failAt] });
      await publishRecoveryBackup(probe.io, paths, SEALED, probe.authenticate).catch(() => undefined);
      for (let abandonAt = failAt + 1; abandonAt < probe.operations.length; abandonAt += 1) {
        const run = harness(initial, { failAt: [failAt, abandonAt] });
        await expect(publishRecoveryBackup(run.io, paths, SEALED, run.authenticate)).rejects.toBeInstanceOf(RecoveryPublicationUnresolvedError);
        unresolvedCases += 1;
        if (retained) expect(Object.values(recoveryFiles(run.files))).toContain(RETAINED);
        const restarted = restart(run.files);
        await reconcileRecoveryPublication(restarted.io, paths, isWellFormed, false);
        const survivor = recoveryFiles(restarted.files);
        expect({ fresh: survivor.fresh, previous: survivor.previous }).toEqual({ fresh: null, previous: null });
        if (retained) expect(survivor.final).toBe(RETAINED);
        else expect([null, SEALED]).toContain(survivor.final);
        expectUnrelatedIntact(restarted.files);
      }
    }
    expect(unresolvedCases).toBeGreaterThan(0);
  });

  test.each([true, false])('process death at every publication boundary never leaves both archives absent and startup converges (retained %p)', async (retained) => {
    const initial = retained ? { [paths.final]: RETAINED } : {};
    const clean = await cleanPublication(initial);
    const supersededAt = clean.operations.indexOf('remove pikeMethods-recovery-current.pmbak.previous');
    const freshWrittenAt = clean.operations.indexOf('write pikeMethods-recovery-current.pmbak.new');
    expect(freshWrittenAt).toBeGreaterThanOrEqual(0);
    if (retained) expect(supersededAt).toBe(clean.operations.length - 1);
    for (const deathCase of publicationDeathCases(clean.operations)) {
      const run = harness(initial, deathCase);
      const publication = publishRecoveryBackup(run.io, paths, SEALED, run.authenticate);
      // A dead process reports nothing; only the files it left behind are observable.
      if (deathCase.dieAt < clean.operations.length) await expect(publication).rejects.toThrow();
      else await publication;

      const atDeath = Object.values(recoveryFiles(run.files));
      if (retained) {
        expect(atDeath.includes(RETAINED) || recoveryFiles(run.files).final === SEALED).toBe(true);
        if (deathCase.dieAt <= supersededAt) expect(atDeath).toContain(RETAINED);
      }

      const restarted = restart(run.files);
      await reconcileRecoveryPublication(restarted.io, paths, isWellFormed, false);
      const expectedFinal = retained
        ? (deathCase.dieAt > supersededAt ? SEALED : RETAINED)
        : (deathCase.dieAt <= freshWrittenAt ? null : SEALED);
      expect(recoveryFiles(restarted.files)).toEqual({ final: expectedFinal, fresh: null, previous: null });
      expectUnrelatedIntact(restarted.files);

      // A second death inside startup reconciliation converges to the same survivor.
      for (let reconcileDeath = 0; reconcileDeath < restarted.operations.length; reconcileDeath += 1) {
        const interrupted = restart(run.files, { dieAt: reconcileDeath });
        await expect(reconcileRecoveryPublication(interrupted.io, paths, isWellFormed, false)).rejects.toThrow('process death');
        if (expectedFinal !== null) expect(Object.values(recoveryFiles(interrupted.files))).toContain(expectedFinal);
        const recovered = restart(interrupted.files);
        await reconcileRecoveryPublication(recovered.io, paths, isWellFormed, false);
        expect(recoveryFiles(recovered.files)).toEqual({ final: expectedFinal, fresh: null, previous: null });
      }
    }
  });

  test('the table marks exactly the combinations publication, abandonment and reconciliation can produce', async () => {
    const kind = (value) => (value === null ? 'absent' : isWellFormed(value) ? 'wellFormed' : 'malformed');
    const produced = new Set();
    const capture = (files) => {
      const state = recoveryFiles(files);
      produced.add(`${kind(state.previous)}|${kind(state.final)}|${kind(state.fresh)}`);
    };
    const captureReconciliationDeaths = async (files) => {
      const settled = restart(files);
      await reconcileRecoveryPublication(settled.io, paths, isWellFormed, false);
      capture(settled.files);
      for (let dieAt = 0; dieAt < settled.operations.length; dieAt += 1) {
        const interrupted = restart(files, { dieAt });
        await reconcileRecoveryPublication(interrupted.io, paths, isWellFormed, false).catch(() => undefined);
        capture(interrupted.files);
      }
    };
    for (const retained of [true, false]) {
      const initial = retained ? { [paths.final]: RETAINED } : {};
      capture(harness(initial).files);
      const clean = await cleanPublication(initial);
      capture(clean.files);
      for (const deathCase of publicationDeathCases(clean.operations)) {
        const run = harness(initial, deathCase);
        await publishRecoveryBackup(run.io, paths, SEALED, run.authenticate).catch(() => undefined);
        capture(run.files);
        await captureReconciliationDeaths(run.files);
      }
      for (let failAt = 0; failAt < clean.operations.length; failAt += 1) {
        const probe = harness(initial, { failAt: [failAt] });
        await publishRecoveryBackup(probe.io, paths, SEALED, probe.authenticate).catch(() => undefined);
        capture(probe.files);
        for (let abandonAt = failAt + 1; abandonAt < probe.operations.length; abandonAt += 1) {
          const run = harness(initial, { failAt: [failAt, abandonAt] });
          await publishRecoveryBackup(run.io, paths, SEALED, run.authenticate).catch(() => undefined);
          capture(run.files);
          await captureReconciliationDeaths(run.files);
        }
      }
    }
    const producible = RECONCILIATION_TABLE.filter((row) => row[5]).map(([previous, final, fresh]) => `${previous}|${final}|${fresh}`);
    expect([...produced].sort()).toEqual([...producible].sort());
  });
});
