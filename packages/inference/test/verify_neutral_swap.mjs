/**
 * Fail-first & regression verifier for #208: Neutral Exercise Swap, Parity List
 * (|tierDelta| === 0 first, then 1, with neutral subtitle), and Phase 1
 * Mechanism 1 (kTrigger) zero-Avoid (-1) guarantee on non-pathological causes.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const sub = require('./.build/substitution.js');
const { EQUIPMENT_ITEMS } = require('./.build/types.js');

const {
  computeSubstitutions,
  computeNeutralSwapOptions,
  NEUTRAL_SWAP_CAUSES,
  NON_PATHOLOGICAL_SWAP_CAUSES,
  NEUTRAL_SWAP_SUBTITLE,
  isNonPathologicalSwapCause,
  deriveAvoidPromotionsFromSwaps,
} = sub;

let fail = 0;
function check(name, cond, detail = '') {
  if (!cond) {
    fail += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`CHECK_OK: ${name}`);
  }
}

check('exports computeNeutralSwapOptions and ratified constants',
  typeof computeNeutralSwapOptions === 'function'
  && Array.isArray(NEUTRAL_SWAP_CAUSES)
  && NON_PATHOLOGICAL_SWAP_CAUSES instanceof Set
  && typeof NEUTRAL_SWAP_SUBTITLE === 'string'
  && typeof isNonPathologicalSwapCause === 'function'
  && typeof deriveAvoidPromotionsFromSwaps === 'function');

check('NEUTRAL_SWAP_CAUSES matches ratified cause set in order',
  JSON.stringify(NEUTRAL_SWAP_CAUSES) === JSON.stringify(['equipment_busy', 'preference', 'time']),
  JSON.stringify(NEUTRAL_SWAP_CAUSES));

check('NEUTRAL_SWAP_SUBTITLE matches exact ratified verbatim copy',
  NEUTRAL_SWAP_SUBTITLE === 'Same movement pattern · Uses your available equipment',
  NEUTRAL_SWAP_SUBTITLE);

check('isNonPathologicalSwapCause separates neutral causes from discomfort/other',
  isNonPathologicalSwapCause?.('equipment_busy') === true
  && isNonPathologicalSwapCause?.('preference') === true
  && isNonPathologicalSwapCause?.('time') === true
  && isNonPathologicalSwapCause?.('joint_discomfort') === false
  && isNonPathologicalSwapCause?.('other') === false);

// Load the real 300-movement library from the schema migration chain.
const SCHEMA_DIR = join(import.meta.dirname, '..', '..', 'core-db', 'src', 'schema');
const sqlFiles = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('004_'))
  .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)));
const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const file of sqlFiles) db.exec(readFileSync(join(SCHEMA_DIR, file), 'utf8'));

const detailById = new Map(
  db.prepare('SELECT movement_id, base_name, difficulty_rating FROM movement_detail').all()
    .map((r) => [Number(r.movement_id), r]),
);
const library = db.prepare(
  `SELECT m.movement_id, m.name, m.pattern, m.is_compound,
          (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json
   FROM movement m ORDER BY m.movement_id`,
).all().map((m) => {
  const detail = detailById.get(Number(m.movement_id));
  return {
    movement_id: Number(m.movement_id),
    name: m.name,
    pattern: m.pattern,
    is_compound: Number(m.is_compound) === 1,
    difficulty: detail.difficulty_rating,
    family: detail.base_name,
    required: JSON.parse(m.required_json ?? '[]'),
    preference: 0,
    beginnerOk: detail.difficulty_rating === 'Beginner',
    capabilityAvailable: true,
    sportTracking: false,
  };
});
const byName = (name) => library.find((m) => m.name === name);
const RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };

if (typeof computeNeutralSwapOptions === 'function') {
  const inclineDb = byName('Incline Dumbbell Press');
  assert.ok(inclineDb, 'Incline Dumbbell Press must exist in library');
  const options = computeNeutralSwapOptions({
    target: inclineDb,
    library,
    inventory: [...EQUIPMENT_ITEMS],
    niggles: [],
    futureSlots: [],
    currentDayIndex: 1,
    trainingAge: 'advanced',
    accessContext: 'weight_room',
  });

  check('computeNeutralSwapOptions returns multiple available same-pattern alternatives',
    options.length > 0 && options.every((o) => o.movement_id !== inclineDb.movement_id && o.pattern === inclineDb.pattern));

  const deltas = options.map((o) => o.absTierDelta);
  const sorted = deltas.every((d, idx) => idx === 0 || deltas[idx - 1] <= d);
  check('candidate ordering ranks |tierDelta| === 0 strictly before 1 (non-decreasing |tierDelta|)',
    sorted && deltas[0] === 0 && deltas.some((d) => d === 1),
    deltas.slice(0, 12).join(','));

  const firstBeginnerIdx = options.findIndex((o) => RANK[o.difficulty] < RANK[inclineDb.difficulty]);
  const dbBenchIdx = options.findIndex((o) => o.name === 'Dumbbell Bench Press');
  const cableChestIdx = options.findIndex((o) => o.name === 'Cable Chest Press');
  check('matched-difficulty parity options (Intermediate: Dumbbell Bench Press, Cable Chest Press) precede Beginner regressions (unlike discomfort regression list)',
    dbBenchIdx >= 0 && cableChestIdx >= 0 && firstBeginnerIdx > dbBenchIdx && firstBeginnerIdx > cableChestIdx,
    `dbBenchIdx=${dbBenchIdx}, cableChestIdx=${cableChestIdx}, firstBeginnerIdx=${firstBeginnerIdx}`);

  check('every neutral option uses exact neutral row subtitle and contains zero biomechanical-regression copy',
    options.every((o) =>
      o.subtitle === 'Same movement pattern · Uses your available equipment'
      && !/reduced mechanical demand|at matched difficulty|regression|substitutes/i.test(JSON.stringify(o))));

  // Verify neutral list includes matched/higher difficulty when athlete tier allows (Intermediate target, Advanced athlete)
  const hasAdvancedCandidate = library.some((m) => m.pattern === 'push_h' && m.difficulty === 'Advanced' && m.movement_id !== inclineDb.movement_id);
  if (hasAdvancedCandidate) {
    check('Intermediate target for Advanced athlete permits both same-tier (0) and adjacent-tier (1) candidates',
      options.some((o) => o.difficulty === 'Advanced' && o.absTierDelta === 1));
  }

  // Equipment gate: removing barbell drops barbell options while retaining dumbbell/bodyweight
  const noBarbell = computeNeutralSwapOptions({
    target: inclineDb,
    library,
    inventory: EQUIPMENT_ITEMS.filter((e) => e !== 'barbell'),
    niggles: [],
    futureSlots: [],
    currentDayIndex: 1,
    trainingAge: 'advanced',
    accessContext: 'weight_room',
  });
  check('equipment gate removes barbell alternatives when barbell unavailable',
    !noBarbell.some((o) => o.name === 'Barbell Incline Bench Press - Medium Grip')
    && noBarbell.some((o) => o.name === 'Push-up'));

  // Avoid (-1) exclusion: explicitly avoided movement never suggested
  const avoidId = byName('Barbell Incline Bench Press - Medium Grip').movement_id;
  const avoidLib = library.map((m) => (m.movement_id === avoidId ? { ...m, preference: -1 } : m));
  const afterAvoid = computeNeutralSwapOptions({
    target: inclineDb,
    library: avoidLib,
    inventory: [...EQUIPMENT_ITEMS],
    niggles: [],
    futureSlots: [],
    currentDayIndex: 1,
    trainingAge: 'advanced',
    accessContext: 'weight_room',
  });
  check('MOVEMENT_PREFERENCE.AVOID (-1) excluded from neutral candidates',
    !afterAvoid.some((o) => o.movement_id === avoidId));

  // Existing discomfort computeSubstitutions contract remains intact
  const discomfortRes = computeSubstitutions({
    target: inclineDb,
    library,
    inventory: [...EQUIPMENT_ITEMS],
    niggles: [],
    futureSlots: [],
    currentDayIndex: 1,
    trainingAge: 'advanced',
    accessContext: 'weight_room',
  });
  check('existing discomfort computeSubstitutions regression behavior unchanged',
    discomfortRes.layer1Regression.options.length > 0);
}

// Phase 1 Mechanism 1 (kTrigger) zero-Avoid (-1) invariant
if (typeof deriveAvoidPromotionsFromSwaps === 'function') {
  const neutralSwaps = [
    { movement_id: 1, cause: 'equipment_busy', overlaps_affected_joint: true },
    { movement_id: 1, cause: 'equipment_busy', overlaps_affected_joint: true },
    { movement_id: 2, cause: 'preference', overlaps_affected_joint: true },
    { movement_id: 2, cause: 'preference', overlaps_affected_joint: true },
    { movement_id: 2, cause: 'preference', overlaps_affected_joint: true },
    { movement_id: 3, cause: 'time', overlaps_affected_joint: true },
    { movement_id: 3, cause: 'time', overlaps_affected_joint: true },
  ];
  const neutralAvoids = deriveAvoidPromotionsFromSwaps(neutralSwaps, 2);
  check('Mechanism 1 (kTrigger=2) records ZERO Avoid (-1) promotions across repeated neutral swaps (even with overlapping joint signal)',
    Object.keys(neutralAvoids).length === 0,
    JSON.stringify(neutralAvoids));

  const mixedSwaps = [
    { movement_id: 4, cause: 'equipment_busy', overlaps_affected_joint: true },
    { movement_id: 4, cause: 'preference', overlaps_affected_joint: true },
    { movement_id: 4, cause: 'time', overlaps_affected_joint: true },
    { movement_id: 4, cause: 'joint_discomfort', overlaps_affected_joint: true },
    { movement_id: 5, cause: 'joint_discomfort', overlaps_affected_joint: true },
    { movement_id: 5, cause: 'joint_discomfort', overlaps_affected_joint: true },
  ];
  const mixedAvoids = deriveAvoidPromotionsFromSwaps(mixedSwaps, 2);
  check('Mechanism 1 (kTrigger=2) promotes ONLY repeated pathological joint_discomfort swaps (movement 5) and never neutral-mixed movement 4',
    mixedAvoids[4] === undefined && mixedAvoids[5] === -1,
    JSON.stringify(mixedAvoids));
}

if (fail > 0) {
  console.error(`\nNEUTRAL_SWAP_VERIFY_FAILED (${fail} failure(s))`);
  process.exit(1);
}
console.log('\nALL NEUTRAL SWAP VERIFIER CHECKS PASSED');
