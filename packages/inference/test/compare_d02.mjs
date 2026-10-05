// Compare capture_d02.cjs JSONL output, retaining every changed production
// prescription with the exact input and before/after output for reproduction.
// Usage: node packages/inference/test/compare_d02.mjs <capture-dir> <report.json>
// Every changed output is also checked for a dose increase: no session, slot or
// prescription may appear, no prescription may become included, and no set,
// rep, effort, duration, stress or budget value may rise. The report bytes do
// not depend on this check.
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const [directory, destination] = process.argv.slice(2);
assert.ok(directory && destination, 'capture directory and destination required');
const suites = ['blocks', 'pipeline', 'autopilot', 'verify_movementRanking',
  'verify_effort_cues', 'verify_load_selection', 'verify_programQualityRound2',
  'verify_completion_action', 'verify_longitudinal_bounds'];
const DOSE_FIELD = /^(sets|reps|target_?[rR]pe|rpe|rpe_?[cC]ap|.*[mM]inutes?|.*[dD]uration.*|budget|weeklyBudget|equivalentVolume|stressDose|initialStress|finalStress|exposureCount|weeks)$/;
const COUNTED = new Set(['sessions', 'slots', 'prescriptions', 'familyDecisions']);
const increasesOf = (before, after, path = '', found = []) => {
  if (Array.isArray(before) && Array.isArray(after)) {
    if (COUNTED.has(path.split('.').pop()) && after.length > before.length) found.push(`${path} length ${before.length}->${after.length}`);
    for (let i = 0; i < Math.min(before.length, after.length); i += 1) increasesOf(before[i], after[i], `${path}[${i}]`, found);
  } else if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of Object.keys(after)) increasesOf(before[key], after[key], path ? `${path}.${key}` : key, found);
  } else {
    const field = path.split('.').pop().replace(/\[\d+\]$/, '');
    if (typeof before === 'number' && typeof after === 'number' && DOSE_FIELD.test(field) && after > before) found.push(`${path} ${before}->${after}`);
    if (field === 'included' && before === false && after === true) found.push(`${path} included`);
  }
  return found;
};
const setsIn = (value) => Array.isArray(value) ? value.reduce((sum, item) => sum + setsIn(item), 0)
  : value && typeof value === 'object'
    ? Object.entries(value).reduce((sum, [key, item]) => sum + (key === 'sets' && typeof item === 'number' ? item : setsIn(item)), 0)
    : 0;
const report = { base: 'b94053b4d63fb0ffd3b933aa1890d80f7313a87b', suites: [] };
let checkedInputs = 0;
let setsDelta = 0;
for (const suite of suites) {
  const before = new Map();
  let beforeCalls = 0;
  for await (const line of createInterface({ input: createReadStream(join(directory, `before-${suite}.jsonl`)), crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    const previous = before.get(row.key);
    if (previous) assert.equal(previous.output, JSON.stringify(row.output), 'same input must be deterministic');
    before.set(row.key, { output: JSON.stringify(row.output), calls: (previous?.calls ?? 0) + 1 });
    beforeCalls += 1;
  }
  const changed = new Map();
  const seen = new Map();
  let afterCalls = 0;
  for await (const line of createInterface({ input: createReadStream(join(directory, `after-${suite}.jsonl`)), crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    assert.ok(before.has(row.key), `unmatched after input: ${suite}/${row.key}`);
    seen.set(row.key, (seen.get(row.key) ?? 0) + 1);
    if (before.get(row.key).output !== JSON.stringify(row.output)) {
      changed.set(row.key, { key: row.key, function: row.function, input: row.input,
        before: JSON.parse(before.get(row.key).output), after: row.output,
        occurrences: seen.get(row.key) });
    }
    afterCalls += 1;
  }
  assert.equal(afterCalls, beforeCalls, 'no captured calls may disappear');
  for (const [key, value] of before) assert.equal(seen.get(key), value.calls, `unmatched before call ${key}`);
  for (const change of changed.values()) {
    const increases = increasesOf(change.before, change.after);
    assert.deepEqual(increases, [], `no dose increase: ${suite}/${change.key}`);
    checkedInputs += 1;
    setsDelta += setsIn(change.after) - setsIn(change.before);
  }
  const result = { suite, beforeCalls, afterCalls, uniqueInputs: before.size,
    changedInputs: changed.size, changedCalls: [...changed.values()].reduce((sum, row) => sum + row.occurrences, 0),
    changes: [...changed.values()] };
  report.suites.push(result);
  console.log(JSON.stringify({ ...result, changes: undefined }));
}
console.log(`NO DOSE INCREASE: ${checkedInputs} changed inputs checked; total prescribed sets delta ${setsDelta}`);
const serialized = JSON.stringify(report, null, 2) + '\n';
writeFileSync(destination, destination.endsWith('.gz') ? gzipSync(serialized) : serialized);
