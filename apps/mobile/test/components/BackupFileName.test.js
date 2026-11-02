// Android walk 2026-11-03 (fn-6): a backup made at 01:52 on Tuesday 3 Nov in
// Sydney was named pikeMethods-2026-11-02.pmbak, because the name used the
// UTC date. The athlete's own calendar date names the file.
//
// Setting process.env.TZ inside a Jest test does not change the worker's zone
// on Linux CI, so the dates are built from LOCAL clock times and hold in any
// zone. East of UTC (Sydney) the 00:30 case fails a UTC-dated name; west of
// UTC the 23:30 case does.
const { backupFileNameFor } = require('../../src/state/backupStore');

test('just after local midnight the name carries the local date', () => {
  expect(backupFileNameFor(new Date(2026, 10, 3, 0, 30))).toBe('pikeMethods-2026-11-03.pmbak');
});

test('late in the local evening the name keeps that local day', () => {
  expect(backupFileNameFor(new Date(2026, 10, 3, 23, 30))).toBe('pikeMethods-2026-11-03.pmbak');
});

test('single-digit months and days are zero-padded', () => {
  expect(backupFileNameFor(new Date(2027, 0, 5, 12, 0))).toBe('pikeMethods-2027-01-05.pmbak');
});
