import {
  cleanupRestorePublication,
  publishAtomicMetadata,
  restoreJournalTempFile,
  restoreMarkerFile,
  restoreMarkerTempFile,
  sweepStandaloneRestoreMetadata,
} from '../../src/state/backupRecoveryMetadata';
import { interruptedRestoreAction } from '@ak/core-db';

const operationId = '0123456789abcdef0123456789abcdef';

test('publishes recovery metadata only after verified same-directory temporary bytes', async () => {
  const files = new Map();
  const calls = [];
  const io = {
    exists: async (path) => files.has(path),
    read: async (path) => files.get(path) ?? '',
    write: async (path, value) => { calls.push(['write', path]); files.set(path, value); },
    move: async (source, destination) => {
      calls.push(['move', source, destination]);
      if (!files.has(source)) return;
      files.set(destination, files.get(source));
      files.delete(source);
    },
    remove: async (path) => { calls.push(['remove', path]); files.delete(path); },
  };
  const destination = `/doc/${restoreMarkerFile('applying', operationId)}`;
  const temporary = `/doc/${restoreMarkerTempFile('applying', operationId)}`;
  await publishAtomicMetadata(io, destination, temporary, operationId, (value) => value === operationId);
  expect(files.get(destination)).toBe(operationId);
  expect(files.has(temporary)).toBe(false);
  expect(calls).toEqual([
    ['write', temporary],
    ['move', temporary, destination],
  ]);
});

test.each([
  ['missing destination', false],
  ['unchanged source', true],
])('a resolved native move with %s fails closed', async (_name, copyDestination) => {
  const files = new Map();
  await expect(publishAtomicMetadata({
    exists: async (path) => files.has(path),
    read: async (path) => files.get(path) ?? '',
    write: async (path, value) => { files.set(path, value); },
    move: async (source, destination) => {
      if (copyDestination) files.set(destination, files.get(source));
      return undefined;
    },
    remove: async (path) => { files.delete(path); },
  }, '/doc/final', '/doc/source.new', 'operation', (value) => value === 'operation'))
    .rejects.toThrow(/could not be published/);
  expect(files.has('/doc/final')).toBe(copyDestination);
  expect(files.get('/doc/source.new')).toBe('operation');
});

test('a torn temporary metadata write never reaches the authoritative path', async () => {
  const files = new Map();
  const destination = '/doc/.ak_restore_journal.json';
  const temporary = `/doc/${restoreJournalTempFile(operationId)}`;
  await expect(publishAtomicMetadata({
    exists: async (path) => files.has(path),
    read: async (path) => files.get(path) ?? '',
    write: async (path, value) => { files.set(path, value.slice(0, 4)); },
    move: async () => { throw new Error('must not move torn bytes'); },
    remove: async (path) => { files.delete(path); },
  }, destination, temporary, '{"version":1}', (value) => value === '{"version":1}'))
    .rejects.toThrow(/temporary write could not be verified/);
  expect(files.has(destination)).toBe(false);
});

test('sweeps only exact orphan metadata and leaves every recovery rotation file to reconciliation', async () => {
  const names = [
    restoreJournalTempFile(operationId),
    restoreMarkerFile('applying', operationId),
    restoreMarkerTempFile('committed', operationId),
    '.ak_restore_applying',
    'pikeMethods-recovery-current.pmbak.new',
    'pikeMethods-recovery-current.pmbak.previous',
    'pikeMethods-recovery-current.pmbak',
    '.ak_restore_applying-not-an-operation',
    'user-file.new',
  ];
  const removed = [];
  await expect(sweepStandaloneRestoreMetadata('/doc', names, false, async (path) => { removed.push(path); }))
    .resolves.toEqual([
      restoreJournalTempFile(operationId),
      restoreMarkerFile('applying', operationId),
      restoreMarkerTempFile('committed', operationId),
      '.ak_restore_applying',
    ]);
  for (const retained of [
    'pikeMethods-recovery-current.pmbak',
    'pikeMethods-recovery-current.pmbak.new',
    'pikeMethods-recovery-current.pmbak.previous',
    'user-file.new',
  ]) {
    expect(removed).not.toContain(`/doc/${retained}`);
  }
});

test('while a journal exists, sweeps torn temp publications but retains authoritative markers', async () => {
  const marker = restoreMarkerFile('applying', operationId);
  const markerTemp = restoreMarkerTempFile('applying', operationId);
  const removed = [];
  await sweepStandaloneRestoreMetadata('/doc', [marker, markerTemp], true, async (path) => { removed.push(path); });
  expect(removed).toEqual([`/doc/${markerTemp}`]);
});

test('failure at every terminal cleanup boundary remains recoverable for committed and rolled-back states', async () => {
  for (const terminal of ['committed', 'rolled_back']) {
    const terminalPath = terminal === 'committed' ? '/commit' : '/rolled-back';
    for (let failAt = 1; failAt <= 4; failAt += 1) {
      const files = new Set([terminalPath, '/apply', '/rollback-copy', '/journal']);
      let operation = 0;
      const remove = async (path) => {
        if (!files.has(path)) return;
        operation += 1;
        if (operation === failAt) throw new Error(`${terminal}-death-${failAt}`);
        files.delete(path);
      };
      await expect(cleanupRestorePublication(
        ['/commit', '/rolled-back'],
        ['/apply'],
        async () => remove('/rollback-copy'),
        '/journal',
        remove,
      )).rejects.toThrow(`${terminal}-death-${failAt}`);

      expect(files.has('/journal')).toBe(true);
      const action = interruptedRestoreAction(
        operationId,
        files.has('/apply') ? operationId : null,
        files.has('/commit') ? operationId : null,
        files.has('/rolled-back') ? operationId : null,
      );
      expect(action).not.toBe('preserve_invalid');
      if (action === 'rollback') expect(files.has('/rollback-copy')).toBe(true);
    }
  }
});
