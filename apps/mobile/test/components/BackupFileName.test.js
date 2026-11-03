// Android walk 2026-11-03 (fn-6): a backup made at 01:52 on Tuesday 3 Nov in
// Sydney was named pikeMethods-2026-11-02.pmbak, because the name used the
// UTC date. The athlete's own calendar date names the file.
//
// Setting process.env.TZ inside a Jest test does not change the worker's zone
// on Linux CI, so the dates are built from LOCAL clock times and hold in any
// zone. East of UTC (Sydney) the 00:30 case fails a UTC-dated name; west of
// UTC the 23:30 case does.
const { backupFileNameFor } = require('../../src/state/backupStore');
const fromModule = require('../../src/state/backupFileName').backupFileNameFor;

test('the store names backups with the same function the zone test runs', () => {
  expect(backupFileNameFor).toBe(fromModule);
});

test('just after local midnight the name carries the local date', () => {
  expect(backupFileNameFor(new Date(2026, 10, 3, 0, 30))).toBe('pikeMethods-2026-11-03.pmbak');
});

test('late in the local evening the name keeps that local day', () => {
  expect(backupFileNameFor(new Date(2026, 10, 3, 23, 30))).toBe('pikeMethods-2026-11-03.pmbak');
});

// On a UTC host the two cases above cannot tell a local date from a UTC one,
// because the two agree there. This case runs the real function in a separate
// Node process started in Sydney's zone (review, PR 118: overriding the Date's
// getters made it disagree with its own timestamp). 01:52 on Tuesday 3 Nov in
// Sydney is 14:52 on 2 Nov in UTC; a name built from the UTC date fails here
// on every host. The child also reports its offset, so a host whose Node
// cannot apply the zone fails instead of passing by accident.
test('a Sydney backup at 01:52 on 3 Nov is named 3 Nov, not the UTC date', () => {
  const { execFileSync } = require('child_process');
  const { readFileSync } = require('fs');
  const path = require('path');
  const ts = require('typescript');
  const source = readFileSync(path.join(__dirname, '../../src/state/backupFileName.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const child = [
    "let code = '';",
    "process.stdin.on('data', (chunk) => { code += chunk; });",
    "process.stdin.on('end', () => {",
    "  const exports = {};",
    "  new Function('exports', code)(exports);",
    "  const at = new Date(Date.UTC(2026, 10, 2, 14, 52));",
    "  process.stdout.write(JSON.stringify({ offset: at.getTimezoneOffset(), utcDay: at.toISOString().slice(0, 10), name: exports.backupFileNameFor(at) }));",
    "});",
  ].join('\n');
  const out = JSON.parse(execFileSync(process.execPath, ['-e', child], {
    input: code,
    env: { ...process.env, TZ: 'Australia/Sydney' },
    encoding: 'utf8',
  }));
  expect(out.offset).toBe(-660); // AEDT, UTC+11: the zone really applied
  expect(out.utcDay).toBe('2026-11-02');
  expect(out.name).toBe('pikeMethods-2026-11-03.pmbak');
});

test('single-digit months and days are zero-padded', () => {
  expect(backupFileNameFor(new Date(2027, 0, 5, 12, 0))).toBe('pikeMethods-2027-01-05.pmbak');
});
