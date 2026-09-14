// Compare capture_d02.cjs JSONL output, retaining every changed production
// prescription with the exact input and before/after output for reproduction.
// Usage: node packages/inference/test/compare_d02.mjs <capture-dir> <report.json>
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
const report = { base: 'b94053b4d63fb0ffd3b933aa1890d80f7313a87b', suites: [] };
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
  const result = { suite, beforeCalls, afterCalls, uniqueInputs: before.size,
    changedInputs: changed.size, changedCalls: [...changed.values()].reduce((sum, row) => sum + row.occurrences, 0),
    changes: [...changed.values()] };
  report.suites.push(result);
  console.log(JSON.stringify({ ...result, changes: undefined }));
}
const serialized = JSON.stringify(report, null, 2) + '\n';
writeFileSync(destination, destination.endsWith('.gz') ? gzipSync(serialized) : serialized);
