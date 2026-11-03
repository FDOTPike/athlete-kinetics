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

// On a UTC host the two cases above cannot tell a local date from a UTC one,
// because the two agree there. This case pins the reported instant itself:
// 01:52 on Tuesday 3 Nov in Sydney is 14:52 on 2 Nov in UTC. The clock's
// local calendar reads Sydney's day whatever zone the host runs in, so a
// name built from the UTC date fails here on every host, UTC included.
test('a Sydney backup at 01:52 on 3 Nov is named 3 Nov, not the UTC date', () => {
  const sydneyClock = new Date(Date.UTC(2026, 10, 2, 14, 52));
  sydneyClock.getFullYear = () => 2026;
  sydneyClock.getMonth = () => 10;
  sydneyClock.getDate = () => 3;
  expect(sydneyClock.toISOString().slice(0, 10)).toBe('2026-11-02');
  expect(backupFileNameFor(sydneyClock)).toBe('pikeMethods-2026-11-03.pmbak');
});

test('single-digit months and days are zero-padded', () => {
  expect(backupFileNameFor(new Date(2027, 0, 5, 12, 0))).toBe('pikeMethods-2027-01-05.pmbak');
});
