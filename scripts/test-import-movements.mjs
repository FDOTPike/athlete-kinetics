import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the pure classifier without fetching or writing staging files.
const source = readFileSync(new URL('./import-movements.mjs', import.meta.url), 'utf8');
const classifier = source.slice(source.indexOf('function classifyPattern('), source.indexOf('\nfunction mapExercise('));
const classify = (name, category) => runInNewContext(`${classifier}\nclassifyPattern(ex)`, {
  ex: { name, category },
}, { timeout: 1000 });
assert.equal(classify('raise '.repeat(50000)), 'accessory');
for (const [name, expected] of [
  ['Front Raise', 'accessory'], ['raise to front', 'push'],
  ['raise\nfront', 'accessory'], ['raise\nraise front', 'push'],
  ['Single-arm front raise', 'unilateral'], ['Bench press', 'push'],
]) assert.equal(classify(name), expected, name);
assert.equal(classify('raise front', 'cardio'), 'cardio');
console.log('Movement import tests: 8 checks passed.');
