/**
 * verify:progression — gate for the deterministic progression-ladder resolver.
 * Compiled from packages/inference/src/progressionEngine.ts by the npm script.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  resolveActiveRung,
  DEFAULT_ADVANCEMENT_POLICY,
} = require('./.build/progressionEngine.js');

const rung = (name, rank, group = 'handstand-push-up') => ({
  movementName: name,
  progressionGroup: group,
  progressionRank: rank,
});

const CHAIN = [
  rung('Push-Up', 0),
  rung('Feet-Elevated Push-Up', 1),
  rung('Pike Push-Up', 2),
  rung('Eccentric Wall Handstand Push-Up', 3),
  rung('Handstand Push-Up', 4),
];
const hit = (name, sets = 3, reps = 8) => ({ movementName: name, bestSets: sets, bestReps: reps });

let n = 0;
const check = (label, fn) => {
  n += 1;
  fn();
  console.log(`  [${n}] PASS ${label}`);
};

check('empty history resolves to the lowest rung', () => {
  const r = resolveActiveRung(CHAIN, []);
  assert.equal(r.active.movementName, 'Push-Up');
  assert.equal(r.passed.length, 0);
  assert.equal(r.next.movementName, 'Feet-Elevated Push-Up');
});

check('passing rung 0 advances to rung 1', () => {
  const r = resolveActiveRung(CHAIN, [hit('Push-Up')]);
  assert.equal(r.active.movementName, 'Feet-Elevated Push-Up');
  assert.deepEqual(r.passed.map((p) => p.movementName), ['Push-Up']);
});

check('sets met but reps short does NOT advance', () => {
  const r = resolveActiveRung(CHAIN, [hit('Push-Up', 3, 7)]);
  assert.equal(r.active.movementName, 'Push-Up');
});

check('reps met but sets short does NOT advance', () => {
  const r = resolveActiveRung(CHAIN, [hit('Push-Up', 2, 12)]);
  assert.equal(r.active.movementName, 'Push-Up');
});

check('skipped-rung history does not unlock later rungs', () => {
  // Athlete logged pike work but never cleared feet-elevated: chain holds.
  const r = resolveActiveRung(CHAIN, [hit('Push-Up'), hit('Pike Push-Up')]);
  assert.equal(r.active.movementName, 'Feet-Elevated Push-Up');
});

check('fully passed chain keeps the goal movement active, next=null', () => {
  const r = resolveActiveRung(CHAIN, CHAIN.map((c) => hit(c.movementName)));
  assert.equal(r.active.movementName, 'Handstand Push-Up');
  assert.equal(r.next, null);
  assert.equal(r.passed.length, 4);
});

check('input order does not change resolution (determinism)', () => {
  const shuffled = [CHAIN[3], CHAIN[0], CHAIN[4], CHAIN[1], CHAIN[2]];
  const a = resolveActiveRung(CHAIN, [hit('Push-Up')]);
  const b = resolveActiveRung(shuffled, [hit('Push-Up')]);
  assert.deepEqual(a, b);
});

check('same inputs twice give deep-equal results (purity)', () => {
  const h = [hit('Push-Up'), hit('Feet-Elevated Push-Up')];
  assert.deepEqual(resolveActiveRung(CHAIN, h), resolveActiveRung(CHAIN, h));
});

check('history for movements outside the chain is ignored', () => {
  const r = resolveActiveRung(CHAIN, [hit('Deadlift'), hit('Barbell Curl')]);
  assert.equal(r.active.movementName, 'Push-Up');
});

check('stricter policy override blocks advancement', () => {
  const r = resolveActiveRung(CHAIN, [hit('Push-Up', 3, 8)], { requiredSets: 5, requiredReps: 5 });
  assert.equal(r.active.movementName, 'Push-Up');
});

check('default policy is 3x8', () => {
  assert.deepEqual(DEFAULT_ADVANCEMENT_POLICY, { requiredSets: 3, requiredReps: 8 });
});

check('empty chain throws', () => {
  assert.throws(() => resolveActiveRung([], []), /empty chain/);
});

check('mixed groups throw', () => {
  assert.throws(
    () => resolveActiveRung([rung('A', 0), rung('B', 1, 'pull-up')], []),
    /mixed groups/,
  );
});

check('duplicate ranks throw', () => {
  assert.throws(
    () => resolveActiveRung([rung('A', 1), rung('B', 1)], []),
    /duplicate rank/,
  );
});

check('rank gaps are legal ordinals', () => {
  const gappy = [rung('A', 0), rung('B', 10), rung('C', 40)];
  const r = resolveActiveRung(gappy, [hit('A')]);
  assert.equal(r.active.movementName, 'B');
  assert.equal(r.next.movementName, 'C');
});

console.log(`verify:progression — all ${n} checks green`);
