// Negative controls for work order 4: each mutation breaks ONE guarantee of the
// content correction and runs the gate that is supposed to notice. A mutation
// that is NOT detected is a weak test.
//
//   node scripts/coaching/negative-controls-wo4.mjs          # all
//   node scripts/coaching/negative-controls-wo4.mjs C3       # one
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = (command) => spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// --no-cache: a stale transform cache once served an older copy of a migration.
const jest = (file) => `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/${file}`;
const LIBRARY = 'npm run verify:library';
const GENERATOR = 'node scripts/test-content-correction-v2-generator.mjs && node scripts/generate-content-correction-v2.mjs --check';
const MIG_BUILD = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/core-db/test/.build packages/core-db/src/migrationRunner.ts';
const MIG = `${MIG_BUILD} && node packages/core-db/test/verify_migrations.mjs`;
const SQL = 'packages/core-db/src/schema/068_movement_content_correction_v2.sql';
const OVERLAY = 'packages/core-db/staging/movement_content_correction_v2.json';
const EVIDENCE = 'packages/core-db/staging/movement_upstream_instructions.json';
const PROVENANCE = `INSERT OR IGNORE INTO movement_content_correction
  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES`;

const mutations = [
  {
    name: 'C1 the migration also rewrites movement 135 (animation lane)',
    file: SQL,
    from: PROVENANCE,
    to: `UPDATE movement_detail SET instructions = 'Lie back and raise the bar.' WHERE movement_id = 135;\n${PROVENANCE}`,
    gate: LIBRARY,
  },
  {
    name: 'C2 the migration also rewrites movement 187 (animation lane)',
    file: SQL,
    from: PROVENANCE,
    to: `UPDATE movement_detail SET cues = 'Raise the dumbbells.' WHERE movement_id = 187;\n${PROVENANCE}`,
    gate: MIG,
  },
  {
    name: 'C3 the migration renames a movement',
    file: SQL,
    from: PROVENANCE,
    to: `UPDATE movement SET name = 'Concentration Curl' WHERE name = 'Concentration Curls';\n${PROVENANCE}`,
    gate: LIBRARY,
  },
  {
    name: 'C4 the migration changes a movement equipment list',
    file: SQL,
    from: PROVENANCE,
    to: `DELETE FROM movement_equipment WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Concentration Curls') AND item = 'bench';\n${PROVENANCE}`,
    gate: MIG,
  },
  {
    name: 'C5 the migration changes a media asset key',
    file: SQL,
    from: PROVENANCE,
    to: `UPDATE movement_media SET revision = 2 WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Concentration Curls');\n${PROVENANCE}`,
    gate: LIBRARY,
  },
  {
    name: 'C6 the migration changes a difficulty rating',
    file: SQL,
    from: PROVENANCE,
    to: `UPDATE movement_detail SET difficulty_rating = 'Advanced' WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Concentration Curls');\n${PROVENANCE}`,
    gate: MIG,
  },
  {
    name: 'C7 the migration records no provenance',
    file: SQL,
    from: PROVENANCE,
    to: `CREATE TEMP TABLE IF NOT EXISTS discarded_provenance (movement_id, correction_version, correction_sha256, applied_at_ms);
INSERT INTO discarded_provenance
  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES`,
    gate: LIBRARY,
  },
  {
    name: 'C8 one generated UPDATE is hand-edited in the SQL (staging says otherwise)',
    file: SQL,
    from: `Keeping the upper arm still, curl the dumbbell up toward the shoulder.`,
    to: `Swing the dumbbell up toward the shoulder.`,
    gate: 'node scripts/generate-content-correction-v2.mjs --check',
  },
  {
    name: 'C9 the same hand-edit is also caught by the library gate (live text is not baseline + staged merge)',
    file: SQL,
    from: `Keeping the upper arm still, curl the dumbbell up toward the shoulder.`,
    to: `Swing the dumbbell up toward the shoulder.`,
    gate: LIBRARY,
  },
  {
    name: 'C10 staged text is edited without a new hash',
    file: OVERLAY,
    from: `"Upper arm stays on the thigh."`,
    to: `"Upper arm stays near the thigh."`,
    gate: GENERATOR,
  },
  {
    name: 'C11 a cue is turned into a prohibition (and resealed is impossible without the generator: hash mismatch or law breach)',
    file: OVERLAY,
    from: `"Only the forearm moves."`,
    to: `"Never move the upper arm."`,
    gate: LIBRARY,
  },
  {
    name: 'C12 the upstream evidence text is edited',
    file: EVIDENCE,
    from: `Sit down on a flat bench with one dumbbell in front of you between your legs.`,
    to: `Stand with one dumbbell in front of you.`,
    gate: LIBRARY,
  },
  {
    name: 'C13 the set claims owner approval that was never given',
    file: OVERLAY,
    from: `"state": "pending_owner_review"`,
    to: `"state": "owner_approved"`,
    gate: LIBRARY,
  },
  {
    name: 'C14 the same false approval claim is refused by the generator',
    file: OVERLAY,
    from: `"state": "pending_owner_review"`,
    to: `"state": "owner_approved"`,
    gate: GENERATOR,
  },
  {
    name: 'C15 the v2 sentinel is removed (a database that skipped 068 would go unnoticed)',
    file: 'packages/core-db/src/migrationRunner.ts',
    from: `      (SELECT COUNT(*) FROM movement_content_correction WHERE correction_version = 2) = 115\`,`,
    to: `      1 = 1\`,`,
    gate: MIG,
  },
  {
    name: 'C16 the migration is not registered in the production chain',
    file: 'packages/core-db/src/migrations.ts',
    from: `m065, m066, m067, m068];`,
    to: `m065, m066, m067];`,
    gate: jest('ContentCorrectionV2.test.js'),
  },
  {
    name: 'C17 the text-only (v67) backup schema is missing from the registry',
    file: 'packages/core-db/src/backup/schemaContract.ts',
    from: `  {
    userVersion: 67,
    migrationSlot: 68,
    tableCount: 117,
    objectCount: 203,
    fingerprint: '147840e91129313ec7ce6690d8af0e0f774834219cfa9791be930831c4d1765e',
  },`,
    to: '',
    gate: 'npm run verify:backup',
  },
];

const only = process.argv[2];
const results = [];
for (const mutation of mutations) {
  if (only !== undefined && !mutation.name.startsWith(`${only} `)) continue;
  const original = fs.readFileSync(mutation.file, 'utf8');
  const occurrences = original.split(mutation.from).length - 1;
  if (occurrences !== 1) {
    results.push({ name: mutation.name, outcome: `ANCHOR ${occurrences === 0 ? 'NOT FOUND' : 'NOT UNIQUE'}` });
    console.log(JSON.stringify(results.at(-1)));
    continue;
  }
  let mutated = original.replace(mutation.from, () => mutation.to);
  if (mutation.alsoRegex !== undefined) {
    if (!mutation.alsoRegex[0].test(mutated)) {
      results.push({ name: mutation.name, outcome: 'SECOND ANCHOR NOT FOUND' });
      console.log(JSON.stringify(results.at(-1)));
      continue;
    }
    mutated = mutated.replace(mutation.alsoRegex[0], () => mutation.alsoRegex[1]);
  }
  fs.writeFileSync(mutation.file, mutated);
  let result;
  try { result = run(mutation.gate); } finally { fs.writeFileSync(mutation.file, original); }
  const output = `${result.stdout}\n${result.stderr}`;
  const failed = (output.match(/^\s*(?:FAIL|×|✕|ERROR)\s.*$/gm) ?? []).slice(0, 3).map((line) => line.trim().slice(0, 180));
  const other = failed.length === 0 ? (output.match(/(?:stale|Error:|AssertionError|error TS\d+).*$/m)?.[0] ?? '').slice(0, 180) : '';
  results.push({ name: mutation.name, outcome: result.status === 0 ? 'NOT DETECTED' : 'detected', exit: result.status, sample: failed, other });
  console.log(JSON.stringify(results.at(-1)));
}
run(MIG_BUILD);
console.log('SUMMARY', JSON.stringify(results.map((row) => [row.name, row.outcome])));
