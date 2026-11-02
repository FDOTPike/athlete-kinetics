// Android walk 2026-11-03 (fn-6): a backup made at 01:52 on Tuesday 3 Nov in
// Sydney was named pikeMethods-2026-11-02.pmbak, because the name used the
// UTC date. The athlete's own calendar date names the file.
process.env.TZ = 'Australia/Sydney';

const { backupFileNameFor } = require('../../src/state/backupStore');

test('just after local midnight the name carries the local date, not the UTC one', () => {
  // 2026-11-02T14:52:00Z is 01:52 on 3 Nov in Sydney (AEDT, UTC+11).
  expect(backupFileNameFor(new Date('2026-11-02T14:52:00Z'))).toBe('pikeMethods-2026-11-03.pmbak');
});

test('late in the local evening the name keeps that local day', () => {
  // 2026-11-03T12:30:00Z is 23:30 on 3 Nov in Sydney.
  expect(backupFileNameFor(new Date('2026-11-03T12:30:00Z'))).toBe('pikeMethods-2026-11-03.pmbak');
});
