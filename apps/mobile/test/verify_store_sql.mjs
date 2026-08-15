/**
 * verify_store_sql.mjs â€” extracts every SQL literal from useStore.ts and
 * PREPARES it against the real migrated schema. sqlite3_prepare validates
 * tables, columns, and syntax, so a typo'd column in the store's DAO layer
 * fails here instead of at runtime on a device.
 *
 * Run:  node apps/mobile/test/verify_store_sql.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

const SCHEMA_FILES = ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
  '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
  '014_movement_prefixes.sql', '015_set_prefix.sql',
  '016_movement_library_seed.sql', '017_movement_batch.sql',
  '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
  '021_taxonomy_corrections.sql',
  '022_set_target.sql', '023_phase17_session_foundation.sql',
  '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
  '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
  '028_capability_graph.sql', '029_routine_history_analytics.sql',
  '030_readiness_import_integration.sql', '031_planned_session_method.sql',
  '032_capability_content.sql', '033_goal_program.sql', '034_autopilot_attribution.sql',
  '035_profile_load_preference.sql', '036_movement_media.sql',
  '037_movement_library_v2_batch.sql', '038_movement_library_v2_batch.sql',
  '039_movement_library_v2_batch.sql', '040_movement_library_v2_batch.sql',
  '041_movement_library_v2_batch.sql', '042_movement_library_v2_batch.sql',
  '043_movement_library_v2_batch.sql', '044_movement_library_v2_batch.sql',
  '045_movement_library_v2_batch.sql', '046_movement_library_v2_batch.sql',
  '047_movement_library_v2_batch.sql', '048_movement_library_v2_batch.sql',
  '049_movement_content_correction_v1.sql', '050_movement_role_convergence.sql',
  '051_routine_access_context.sql', '052_bounded_microcycle_roles.sql',
  '053_routine_role_compatibility.sql',
  '054_contract_cutoff_provenance.sql',
  '055_return_checkin_ack.sql'];

const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const f of SCHEMA_FILES) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}

const src = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
const statements = [...src.matchAll(/executeSync\(\s*(?:'([^']+)'|`([^`]+)`|"([^"]+)")/g)]
  .map((m) => m[1] ?? m[2] ?? m[3]);
// The store also executes MATERIALIZE_STATE_VECTOR_SQL from @ak/core-db.
statements.push(
  readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
    .replace(/^--.*$/gm, ''),
);

let fail = 0;
let pass = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass += 1; else fail += 1;
};
const phase17Prefixes = Object.fromEntries(db.prepare(`
  SELECT m.name, d.supported_prefixes
  FROM movement m JOIN movement_detail d USING(movement_id)
  WHERE m.name IN ('Dumbbell Bench Press', 'Dumbbell Shoulder Press', 'Pallof Press')
  ORDER BY m.name
`).all().map((row) => [row.name, row.supported_prefixes]));
const exactPhase17Prefixes =
  phase17Prefixes['Dumbbell Bench Press'] === '["DB"]'
  && phase17Prefixes['Dumbbell Shoulder Press'] === '["DB"]'
  && phase17Prefixes['Pallof Press'] === '["Banded"]';
check('store schema chain includes exact 024 equipment-prefix corrections',
  exactPhase17Prefixes,
  JSON.stringify(phase17Prefixes));
console.log(`[store DAO SQL] preparing ${statements.length} statements against live schema`);
for (const sql of statements) {
  const head = sql.replace(/\s+/g, ' ').trim().slice(0, 72);
  try {
    db.prepare(sql);
    console.log(`  PASS  ${head}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${head}\n        ${e instanceof Error ? e.message : e}`);
    fail += 1;
  }
}

// --- P2-1: executable profile_load_preference production behavior -----------
// The production helper is compiled before this verifier. These checks invoke
// the exact hydration, upsert, transition, and guarded-save code used by
// useStore against an op-sqlite-shaped adapter over a real node:sqlite DB.
console.log('[profile_load_preference executable behavior]');
{
  const require = createRequire(import.meta.url);
  const production = require(join(ROOT, 'packages', 'core-db', 'test', '.build', 'loadPreferenceStore.js'));
  const inference = require(join(ROOT, 'packages', 'inference', 'test', '.build', 'loadSelection.js'));
  const raw = new DatabaseSync(':memory:');
  try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  for (const file of SCHEMA_FILES) raw.exec(readFileSync(join(SCHEMA_DIR, file), 'utf-8'));

  const calls = [];
  const productionDb = {
    executeSync(sql, params) {
      calls.push({ sql, params: params ?? [] });
      if (/^\s*SELECT/i.test(sql)) {
        return { rows: raw.prepare(sql).all(...(params ?? [])) };
      }
      if (params && params.length > 0) raw.prepare(sql).run(...params);
      else raw.exec(sql);
      return { rows: [] };
    },
  };
  const activate = (slotId) => {
    raw.exec('UPDATE profile_slot SET is_active = 0');
    raw.prepare('UPDATE profile_slot SET is_active = 1 WHERE slot_id = ?').run(slotId);
  };

  check('active slot is slot 2 (intermediate)',
    raw.prepare('SELECT slot_id FROM profile_slot WHERE is_active = 1').get()?.slot_id === 2);

  raw.exec('DELETE FROM profile_load_preference WHERE profile_slot_id = 2');
  production.persistLoadPreferenceRow(productionDb, 'manual', true);
  production.persistLoadPreferenceRow(productionDb, 'auto', false);
  const upserted = raw.prepare('SELECT preference, is_explicit FROM profile_load_preference WHERE profile_slot_id = 2').get();
  check('production active-slot upsert inserts then conflict-updates both fields',
    upserted?.preference === 'auto' && upserted?.is_explicit === 0);

  activate(3);
  production.persistLoadPreferenceRow(productionDb, 'auto', true);
  const advancedAuto = production.readActiveLoadPreference(productionDb, 'advanced', inference.defaultLoadPreference);
  check('production hydration preserves persisted advanced auto over manual default',
    advancedAuto.preference === 'auto' && advancedAuto.explicit === true);
  production.persistLoadPreferenceRow(productionDb, 'manual', true);
  const advancedManual = production.readActiveLoadPreference(productionDb, 'advanced', inference.defaultLoadPreference);
  check('production non-beginner manual round-trips as manual',
    advancedManual.preference === 'manual' && advancedManual.explicit === true);

  activate(4);
  raw.exec('DELETE FROM profile_load_preference WHERE profile_slot_id = 4');
  const missingElite = production.readActiveLoadPreference(productionDb, 'elite', inference.defaultLoadPreference);
  check('production missing-row hydration falls back to the elite manual default',
    missingElite.preference === 'manual' && missingElite.explicit === false);
  const malformedElite = production.loadPreferenceFromRow(
    { preference: 'poison', is_explicit: 1 }, 'elite', inference.defaultLoadPreference,
  );
  check('production malformed-row hydration falls back without retaining invalid explicitness',
    malformedElite.preference === 'manual' && malformedElite.explicit === false);

  activate(2);
  production.persistLoadPreferenceRow(productionDb, 'auto', true);
  activate(3);
  production.persistLoadPreferenceRow(productionDb, 'manual', true);
  const switchedAdvanced = production.readActiveLoadPreference(productionDb, 'advanced', inference.defaultLoadPreference);
  activate(2);
  const switchedIntermediate = production.readActiveLoadPreference(productionDb, 'intermediate', inference.defaultLoadPreference);
  check('production hydration is isolated per active profile slot',
    switchedAdvanced.preference === 'manual' && switchedIntermediate.preference === 'auto');

  const explicitDefault = production.planProfileLoadTransition(
    'intermediate', 'advanced', switchedIntermediate, inference.transitionLoadPreference,
  );
  check('explicit same-as-default survives round-trip and non-beginner transition',
    explicitDefault.preference === 'auto' && explicitDefault.explicit === true && explicitDefault.changed === false);
  production.persistLoadPreferenceRow(productionDb, 'auto', false);
  const defaultedIntermediate = production.readActiveLoadPreference(productionDb, 'intermediate', inference.defaultLoadPreference);
  const redefaulted = production.planProfileLoadTransition(
    'intermediate', 'advanced', defaultedIntermediate, inference.transitionLoadPreference,
  );
  check('non-explicit non-beginner transition independently re-defaults',
    redefaulted.preference === 'manual' && redefaulted.explicit === false && redefaulted.changed === true);

  const directStart = calls.length;
  let directCommit = 0;
  const beginnerManual = production.executeDirectLoadPreferenceSave({
    getDb: () => productionDb,
    sessionActive: false,
    trainingAge: 'beginner',
    preference: 'manual',
    commitState: () => { directCommit += 1; },
  });
  check('production direct-save rejects beginner manual without DB or state mutation',
    beginnerManual.ok === false && beginnerManual.error === null
      && calls.length === directStart && directCommit === 0);

  const assertActiveRejection = (label, priorAge, nextAge, current) => {
    const next = production.planProfileLoadTransition(
      priorAge, nextAge, current, inference.transitionLoadPreference,
    );
    let getDbCalls = 0;
    let profileWrites = 0;
    let stateCommits = 0;
    const result = production.executeProfileLoadSave({
      getDb: () => { getDbCalls += 1; return productionDb; },
      sessionActive: true,
      current,
      next,
      persistProfile: () => { profileWrites += 1; },
      commitState: () => { stateCommits += 1; },
    });
    check(label, result.ok === false
      && result.error === production.ACTIVE_LOAD_PREFERENCE_ERROR
      && getDbCalls === 0 && profileWrites === 0 && stateCommits === 0);
  };
  assertActiveRejection(
    'production guard rejects active advanced/manual/explicit -> beginner before all mutations',
    'advanced', 'beginner', { preference: 'manual', explicit: true },
  );
  assertActiveRejection(
    'production guard rejects active beginner/auto/non-explicit -> advanced before all mutations',
    'beginner', 'advanced', { preference: 'auto', explicit: false },
  );

  const unchanged = production.planProfileLoadTransition(
    'intermediate', 'advanced', { preference: 'auto', explicit: true }, inference.transitionLoadPreference,
  );
  const profileRow = () => raw.prepare(
    'SELECT session_duration_cap_min, updated_at_ms, objective, training_age, weekly_frequency, max_sessions_per_day, base_rpe_cap, target_energy_system, progression_methodology, injury_flags, mobility_limits, equipment_inventory FROM athlete_profile WHERE profile_id = 1',
  ).get();
  const prefRow = () => raw.prepare(
    'SELECT preference, is_explicit FROM profile_load_preference WHERE profile_slot_id = 2',
  ).get();
  const profileBefore = profileRow();
  const prefBefore = prefRow();
  check('athlete_profile row 1 exists before the ordinary active-session edit', profileBefore !== undefined);
  const editedProfile = {
    objective: profileBefore.objective,
    training_age: profileBefore.training_age,
    weekly_frequency: profileBefore.weekly_frequency,
    max_sessions_per_day: profileBefore.max_sessions_per_day,
    session_duration_cap_min: profileBefore.session_duration_cap_min === 60 ? 90 : 60,
    base_rpe_cap: profileBefore.base_rpe_cap,
    target_energy_system: profileBefore.target_energy_system,
    progression_methodology: profileBefore.progression_methodology,
    injury_flags: JSON.parse(profileBefore.injury_flags),
    mobility_limits: JSON.parse(profileBefore.mobility_limits),
    equipment_inventory: JSON.parse(profileBefore.equipment_inventory),
  };
  let ordinaryProfileWrites = 0;
  let ordinaryStateCommits = 0;
  const ordinary = production.executeProfileLoadSave({
    getDb: () => productionDb,
    sessionActive: true,
    current: { preference: 'auto', explicit: true },
    next: unchanged,
    persistProfile: (db) => {
      ordinaryProfileWrites += 1;
      production.persistProfileFields(db, editedProfile);
    },
    commitState: () => { ordinaryStateCommits += 1; },
  });
  const profileAfter = profileRow();
  const prefAfter = prefRow();
  check('production guard permits an active-session profile edit when the preference tuple is unchanged',
    ordinary.ok === true && ordinaryProfileWrites === 1 && ordinaryStateCommits === 1);
  check('ordinary active-session edit durably persists the profile row via the production seam',
    profileAfter !== undefined
      && profileAfter.session_duration_cap_min === editedProfile.session_duration_cap_min
      && profileAfter.session_duration_cap_min !== profileBefore.session_duration_cap_min
      && profileAfter.updated_at_ms > profileBefore.updated_at_ms);
  check('ordinary active-session edit leaves the preference row and tuple unchanged',
    prefAfter?.preference === prefBefore?.preference
      && prefAfter?.is_explicit === prefBefore?.is_explicit
      && prefAfter?.preference === 'auto' && prefAfter?.is_explicit === 0);
}

// Wiring tripwires: mutation testing (2026-06-12) proved the layer-3 chain
// could be silently unwired with every gate green. The pure derivation is
// verified in verify:policy [6]; these assert the store actually routes
// through it and guards date rollover.
console.log('[store wiring]');
function need(needle, re) {
  const ok = re.test(src);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  store references ${needle}`);
  if (ok) pass += 1; else fail += 1;
}
need('derivePrescription(', /derivePrescription\(/);
need('rolloverDay', /rolloverDay/);
need('localToday()', /localToday\(\)/);
need('detectFlaws(', /detectFlaws\(/);
need('buildPatternWindow(', /buildPatternWindow\(/);
need('flawReport', /flawReport/);

console.log('[boot readiness contract]');
const bootCommitStart = src.indexOf("      set({\n        oneRepMaxes:");
const bootCommitEnd = src.indexOf('      get().refreshVector();', bootCommitStart);
const bootCommit = bootCommitStart >= 0 && bootCommitEnd > bootCommitStart
  ? src.slice(bootCommitStart, bootCommitEnd)
  : '';
check(
  'boot publishes movements in the same commit that publishes ready status',
  bootCommit.includes("status: 'ready'") && bootCommit.includes('\n        movements,'),
);
const appSrc = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'App.tsx'), 'utf-8');
check(
  'COACH cannot mount before the store is ready',
  /tab === 'coach' && status === 'ready' && \(\s*<BlockScreen/.test(appSrc),
);

console.log('[onboarding guided-program contract]');
const onboardingStart = src.indexOf('completeOnboarding: (patch, athleteName');
const onboardingEnd = src.indexOf('previewTrainingProgram: (input) => {', onboardingStart);
const onboardingBody = onboardingStart >= 0 && onboardingEnd > onboardingStart
  ? src.slice(onboardingStart, onboardingEnd)
  : '';
const onboardingSave = onboardingBody.indexOf('persistProfileFields(d, merged)');
check(
  'completed questionnaire persists its profile',
  onboardingSave >= 0,
);
check(
  'onboarding commits profile, preference, and explicit-choice metadata in one transaction',
  onboardingBody.includes("d.executeSync('BEGIN')")
    && onboardingBody.includes('persistLoadPreferenceRow(d, pref, prefExplicit)')
    && onboardingBody.includes("d.executeSync('COMMIT')")
    && onboardingBody.includes("d.executeSync('ROLLBACK')"),
);
check(
  'completed questionnaire does not silently generate a LINEAR block',
  !onboardingBody.includes('generateNewBlock'),
);
check(
  'fresh onboarded athletes route into explicit guided program setup',
  appSrc.includes('showProgramSetup') && appSrc.includes('<ProgramSetupScreen />'),
);

const previewProgramStart = src.indexOf('previewTrainingProgram: (input) => {');
const previewProgramEnd = src.indexOf('createTrainingProgram: (input) => {', previewProgramStart);
const previewProgramBody = src.slice(previewProgramStart, previewProgramEnd);
check(
  'program preview session guard lives on the preview action, not onboarding registry failure',
  previewProgramBody.includes('get().session !== null')
    && previewProgramBody.includes('End the active session before previewing program changes.')
    && !onboardingBody.includes('End the active session before previewing program changes.'),
);
check(
  'program preview rejects a preferred movement outside the shared tier/capability boundary',
  previewProgramBody.includes('!permittedForProfile(movement, profile, accessContext)')
    && previewProgramBody.includes('!capabilityAvailable.has(movement.movement_id)')
    && previewProgramBody.includes('accessContextForBlockFocus')
    && previewProgramBody.includes('A preferred movement is teaching-only for this athlete.'),
);

console.log('[planned-session completion contract]');
const completionSql = statements.find((sql) => sql.includes('END AS completion_status')) ?? '';

console.log('[guided goal-program contract]');
const shapeStart = src.indexOf('const trainingProgramShape =');
const shapeEnd = src.indexOf('/** Everything per-athlete', shapeStart);
const shapeBody = src.slice(shapeStart, shapeEnd);
check('date horizon rejects under 4 and over 32 weeks and rounds up to a complete block boundary',
  shapeBody.includes('daysAway < 28 || daysAway > 224')
    && shapeBody.includes('Math.ceil(daysAway / 28)')
    && shapeBody.includes('plannedBlockCount * 28'),
);
const createStart = src.indexOf('createTrainingProgram: (input) => {');
const createEnd = src.indexOf('rolloverDay: () => {', createStart);
const createBody = src.slice(createStart, createEnd);
check('program creation refuses active sessions and existing blocks/programs',
  createBody.includes('get().session !== null')
    && createBody.includes('get().block !== null || get().program !== null'),
);
const generatorStart = src.indexOf('generateNewBlock: (schemaType =');
const generatorEnd = src.indexOf('refreshBlock:', generatorStart);
const generatorBody = src.slice(generatorStart, generatorEnd);
check('program creation is transactional and calls the SHARED programTx helpers',
  generatorBody.includes("d.executeSync('BEGIN')")
    && generatorBody.includes('insertTrainingProgram(d, {')
    && generatorBody.includes('linkTrainingBlockProgram(d, blockId, programId,')
    && generatorBody.includes('archiveActiveTrainingBlock(d)')
    && generatorBody.includes("d.executeSync('COMMIT')"),
);
const updateStart = src.indexOf('updateProgramPreferences: (input) => {');
const updateEnd = src.indexOf('previewNextProgramBlock:', updateStart);
const updateBody = src.slice(updateStart, updateEnd);
check('future preference edits never write current or historical block tables',
  !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(training_block|block_meta|planned_session|planned_slot)\b/i.test(updateBody),
);
check('program continuation is confirmation-only and refuses an active session',
  src.includes('previewNextProgramBlock: () =>')
    && src.includes('continueTrainingProgram: () =>')
    && src.includes('End the active session before continuing the program.'),
);

console.log('[guided program macro ownership contract]');
check('program-owned macro index is used in BOTH preview and committed generation',
  src.includes('programMacroIndex(activeProgram.startingMacroBlockIndex, activeProgram.currentSequenceIndex + 1)')
    && src.includes('programMacroIndex(pendingProgramContinuation.startingMacroBlockIndex, pendingProgramContinuation.sequenceIndex)'),
);
check('continuation carries the program anchor, never re-reads the global cycle',
  src.includes('startingMacroBlockIndex: current.startingMacroBlockIndex')
    && src.includes("pendingProgramContinuation.startingMacroBlockIndex"),
);
check('standalone block generation still advances the athlete global cycle',
  src.includes('nextMacroPosition(d).macroBlockIndex'),
);

check(
  'planned completion is joined through exact session_origin provenance and immutable session_outcome',
  completionSql.includes('so.source_planned_session_id = ps.planned_session_id')
    && completionSql.includes('JOIN session_outcome outcome ON outcome.session_id = so.session_id'),
);
check(
  'planned completion never uses same-date sets as a proxy',
  completionSql.length > 0
    && !completionSql.includes('set_record')
    && !completionSql.includes('s.session_date = ps.session_date'),

);
console.log('[session rest override store contract]');
const restOverrideStart = src.indexOf('setRunnerRestOverride: (seconds) => {');
const restOverrideEnd = src.indexOf('runnerThumbsDown: () => {', restOverrideStart);
const restOverrideBody = restOverrideStart >= 0 && restOverrideEnd > restOverrideStart
  ? src.slice(restOverrideStart, restOverrideEnd)
  : '';
check(
  'rest override advances the pure runner and persists the resulting checkpoint transactionally',
  restOverrideBody.includes("kind: 'SET_REST_OVERRIDE'")
    && restOverrideBody.includes("d.executeSync('BEGIN')")
    && restOverrideBody.includes('persistRunnerCheckpoint(')
    && restOverrideBody.includes("d.executeSync('COMMIT')"),
);

// --- [Phase 13 Step 4] autopilot projection SQL: EXECUTED against seeded rows ----
// PREPARE only proves columns/syntax; the ΔE join + reciprocal attenuation are the
// signal the whole autopilot consumes, so run the EXACT store SQL on known data.
const a = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass += 1; else fail += 1;
};
console.log('[autopilot projection — executed against seeded rows]');
const setAggSql = statements.find((s) => s.includes('sum_attenuation'));
const niggleWinSql = statements.find((s) => /SELECT region, severity, reported_at_ms\s+FROM niggle/.test(s));
const maxNigSql = statements.find((s) => /MAX\(severity\)[\s\S]*FROM niggle WHERE reported_at_ms >= \?/.test(s));
a('store exposes the set-aggregate, niggle-window, and max-niggle SQL literals',
  Boolean(setAggSql) && Boolean(niggleWinSql) && Boolean(maxNigSql));
if (setAggSql && niggleWinSql && maxNigSql) {
  db.exec('BEGIN');
  db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (901,'AP Test Squat','squat',1)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (901,'2026-06-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (901,901,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (901,901,1,901,4,5,8.0)");
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (901,'2026-06-10',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (901,901,901,1,5,100,9.0,0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (902,901,901,2,5,100,8.0,0)");
  // effective 80 / base 100 → ratio 0.8 → 1/max(1,0.8)=1.0 ; effective 120 → 1/1.2≈0.8333
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (901,'[\"KB\"]',1.0,1.0,1.0,80.0)");
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (902,'[]',1.0,1.0,1.0,120.0)");
  // Provenance snapshots (022): each set's target RPE pinned at log time.
  db.exec("INSERT INTO set_target (set_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (901,'planned',8.0,901,0)");
  db.exec("INSERT INTO set_target (set_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (902,'planned',8.0,901,0)");
  const rows = db.prepare(setAggSql).all('2026-06-01', '2026-06-15');
  const sq = rows.find((r) => r.pattern === 'squat');
  a('set-aggregate returns ONE (date,pattern) row for the seeded squat sets',
    rows.length === 1 && Boolean(sq) && Number(sq.set_count) === 2);
  a('ΔE via set_target snapshot: sum_delta_rpe=(9−8)+(8−8)=1.0, delta_count=2',
    Boolean(sq) && Number(sq.sum_delta_rpe) === 1.0 && Number(sq.delta_count) === 2, sq && `${sq.sum_delta_rpe}/${sq.delta_count}`);
  a('reciprocal attenuation: 1/max(1,0.8)=1.0 + 1/max(1,1.2)=0.8333 → 1.8333',
    Boolean(sq) && Math.abs(Number(sq.sum_attenuation) - (1.0 + 1 / 1.2)) < 1e-9, sq && String(sq.sum_attenuation));
  // a set with NO set_prefix coalesces to base load → attenuation 1.0; and a set
  // with no prescribed target contributes to set_count but NOT to delta_count.
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (902,'2026-06-11',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (903,902,901,1,5,100,7.0,0)");
  const sq2 = db.prepare(setAggSql).all('2026-06-11', '2026-06-11').find((r) => r.pattern === 'squat');
  a('no-set_prefix set coalesces to base load → attenuation 1.0', Boolean(sq2) && Math.abs(Number(sq2.sum_attenuation) - 1.0) < 1e-9, sq2 && String(sq2.sum_attenuation));
  a('ΔE excludes a set with no prescribed target (delta_count 0 on un-planned day)', Boolean(sq2) && Number(sq2.delta_count) === 0, sq2 && String(sq2.delta_count));
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (903,'2026-06-12',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (904,903,901,1,5,100,NULL,0)");
  db.exec("INSERT INTO set_target (set_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (904,'planned',8.0,901,0)");
  const sqNullRpe = db.prepare(setAggSql).all('2026-06-12', '2026-06-12').find((r) => r.pattern === 'squat');
  a('delta-RPE excludes unanswered actual RPE even when its frozen target exists',
    Boolean(sqNullRpe) && Number(sqNullRpe.set_count) === 1
      && Number(sqNullRpe.delta_count) === 0 && Number(sqNullRpe.sum_delta_rpe) === 0,
    sqNullRpe && `${sqNullRpe.set_count}/${sqNullRpe.delta_count}/${sqNullRpe.sum_delta_rpe}`);
  // PROVENANCE (022): an overlapping ARCHIVED plan with a LOWER target must NOT
  // corrupt ΔE. The set_target snapshot pins each set at log time; the old
  // MIN(target_rpe)-by-(date,movement) join (no status filter) would have used
  // 6.0 -> a false +3.0 deficit. The snapshot keeps ΔE at (9-8)+(8-8)=1.0.
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms,status) VALUES (801,'2026-05-01','strength',0,'archived')");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (801,801,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (801,801,1,901,4,5,6.0)");
  const sqOv = db.prepare(setAggSql).all('2026-06-10', '2026-06-10').find((r) => r.pattern === 'squat');
  a('provenance: overlapping archived plan (target 6.0) does NOT corrupt ΔE — snapshot pins 8.0, sum_delta stays 1.0',
    Boolean(sqOv) && Number(sqOv.sum_delta_rpe) === 1.0 && Number(sqOv.delta_count) === 2, sqOv && `${sqOv.sum_delta_rpe}/${sqOv.delta_count}`);
  // niggle ms-window + max-severity (date bucketing itself is done in local JS).
  db.exec("INSERT INTO niggle (id,region,severity,reported_at_ms) VALUES ('apn1','knee',6,5000)");
  const nrows = db.prepare(niggleWinSql).all(0);
  a('niggle window select returns the seeded niggle by ms bound', nrows.length === 1 && nrows[0].region === 'knee' && Number(nrows[0].severity) === 6);
  a('max-niggle select returns the severity at/after the ms bound', Number(db.prepare(maxNigSql).all(0)[0].s) === 6);
  a('max-niggle select returns 0 when the bound is after the niggle (no false halt)', Number(db.prepare(maxNigSql).all(9999)[0].s) === 0);
  db.exec('ROLLBACK');
}

// --- planned-slot autopilot attribution hydration ---------------------------
console.log('[autopilot attribution hydration]');
const slotHydrationSql = statements.find((sql) =>
  sql.includes('SELECT sl.slot_index') && sql.includes('planned_slot_autopilot'),
);
const attributionInsertSql = statements.find((sql) =>
  sql.includes('INSERT INTO planned_slot_autopilot'),
);
a('store exposes the planned-slot attribution hydration SQL', Boolean(slotHydrationSql));
a('store exposes the planned-slot attribution persistence SQL', Boolean(attributionInsertSql));
if (slotHydrationSql && attributionInsertSql) {
  db.exec('BEGIN');
  db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (930,'Attribution Squat','squat',1),(931,'Untouched Press','push_h',1)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (930, '2030-03-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (930,930,1,1,'lower','accumulation','2030-03-01')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (930,930,1,930,3,5,7.5),(931,930,2,931,3,5,7.5)");
  db.prepare(attributionInsertSql).run(930, -0.5, -1, 'eased');
  const hydratedSlots = db.prepare(slotHydrationSql).all(930);
  a('store hydration round-trips one delta and leaves an untouched slot absent',
    hydratedSlots.length === 2
      && Number(hydratedSlots[0].autopilot_rpe_delta) === -0.5
      && Number(hydratedSlots[0].autopilot_set_delta) === -1
      && hydratedSlots[0].autopilot_reason === 'eased'
      && hydratedSlots[1].autopilot_rpe_delta === null
      && hydratedSlots[1].autopilot_set_delta === null
      && hydratedSlots[1].autopilot_reason === null,
    JSON.stringify(hydratedSlots));
  db.exec('ROLLBACK');
}

// --- [Phase 13 Step 4] immutability + bounded-read source invariants -------------
console.log('[autopilot wiring invariants]');
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');
// Anchor on the IMPLEMENTATION (it has a default param) — not the interface decl.
const gnbRaw = (() => { const i = src.indexOf('generateNewBlock: (schemaType ='); const j = src.indexOf('refreshBlock:', i); return i >= 0 && j > i ? src.slice(i, j) : ''; })();
const gnb = stripComments(gnbRaw);
a('generateNewBlock body located', gnb.length > 0);
a('IMMUTABILITY: generateNewBlock writes NO past/raw table (session/set_record/set_prefix/mech_daily/niggle/state_vector)',
  !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(session|set_record|set_prefix|set_target|mech_daily|niggle|state_vector)\b/i.test(gnb));
a('the ONLY write targets are forward plan/program tables plus weekly frequency',
  [...gnb.matchAll(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/gi)]
    .every((m) => ['training_block', 'block_meta', 'planned_session', 'planned_slot', 'planned_slot_target',
      'training_program', 'training_program_day', 'training_program_movement_preference',
      'training_block_program', 'planned_slot_autopilot', 'athlete_profile'].includes(m[1])));
const hyd = stripComments((() => { const i = gnbRaw.indexOf('autopilot hydration'); const j = gnbRaw.indexOf('generateBlock({'); return i >= 0 && j > i ? gnbRaw.slice(i, j) : ''; })());
a('n+1-free: a SINGLE grouped per-(date,pattern) set-aggregate read', (hyd.match(/GROUP BY s\.session_date, m\.pattern/g) || []).length === 1);
a('bounded: the hydration issues a fixed, small number of reads (≤ 4 executeSync)', (() => { const n = (hyd.match(/executeSync/g) || []).length; return n >= 1 && n <= 4; })());
a('bounded: the set-aggregate carries a session_date window predicate', /WHERE s\.session_date >= \? AND s\.session_date <= \?/.test(hyd));
a('no executeSync inside a for/map/forEach in the hydration (n+1 guard)', !/(for\s*\(|\.forEach\s*\(|\.map\s*\()[^;{]*executeSync/.test(hyd));

// --- Calibration Policy v1 store invariants -------------------------------------
console.log('[Calibration Policy v1 store invariants]');
a('source tripwire: "recentAcwr" does not appear in useStore.ts', !src.includes('recentAcwr'));
a('boot rematerialization loop window is exactly 14 days', /demoDates\(localToday\(\),\s*14\)/.test(src));

// --- resetTrainingData: EXECUTE the store's wipe on seeded data -----------------
// Proves the reset clears ALL history (so the demo can re-load) while KEEPING the
// athlete_profile + movement library (the user's settings survive).
console.log('[resetTrainingData — executed against seeded rows]');
const resetBody = (() => {
  const i = src.indexOf('resetTrainingData: () => {');
  const j = src.indexOf('loadDemoAthlete: () => {', i);
  return i >= 0 && j > i ? src.slice(i, j) : '';
})();
const resetTables = [...resetBody.matchAll(/DELETE FROM (\w+)'/g)].map((m) => m[1]);
a('resetTrainingData body found with its unconditional DELETEs', resetTables.length >= 15, `${resetTables.length} tables`);
a('reset NEVER clears athlete_profile / movement / profile_slot (settings survive)',
  !['athlete_profile', 'movement', 'movement_detail', 'movement_preference', 'profile_slot'].some((t) => resetTables.includes(t)));
a('reset NEVER clears the load preference (035) or UI preferences (023) — profile settings survive',
  !['profile_load_preference', 'profile_ui_preference'].some((t) => resetTables.includes(t)));
a('reset explicitly clears both immutable Phase 18 side-cars',
  ['set_dose_target', 'session_outcome'].every((table) => resetTables.includes(table)));
a('reset explicitly clears the autopilot attribution side-car',
  resetTables.includes('planned_slot_autopilot'));
a('reset explicitly clears frozen legacy-role snapshots before their planned slots',
  resetTables.includes('planned_slot_legacy_role_allowance')
    && resetTables.indexOf('planned_slot_legacy_role_allowance') < resetTables.indexOf('planned_slot'));
a('reset removes each immutable side-car only after its parent',
  resetTables.indexOf('set_record') >= 0
    && resetTables.indexOf('set_dose_target') > resetTables.indexOf('set_record')
    && resetTables.indexOf('session') >= 0
    && resetTables.indexOf('session_outcome') > resetTables.indexOf('session'));
if (resetTables.length >= 15) {
  const MAT = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8').replace(/^--.*$/gm, '');
  db.exec('BEGIN');
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (701,'2026-06-10',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (701,701,1,1,5,100,8,0)");
  db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (701,'reps',5)");
  db.exec(`INSERT INTO session_outcome (
    session_id,outcome_kind,terminal_phase,halt_reason,origin_kind,session_mode,training_age,
    slot_count,planned_set_count,logged_set_count,exact_dose_count,under_dose_count,
    over_dose_count,unknown_dose_count,unmapped_set_count,missing_set_count,
    missing_unskipped_set_count,extra_set_count,adapted_slot_count,skipped_slot_count,
    off_plan_slot_count,finalized_at_ms,engine_version
  ) VALUES (701,'followed_plan','complete',NULL,'planned','guided','beginner',
    1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1)`);
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (701,'[]',1,1,1,100)");
  db.exec("INSERT INTO niggle (id,region,severity,reported_at_ms) VALUES ('rn1','knee',5,1000)");
  db.exec("INSERT INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (1,100,0)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (701,'2026-06-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (701,701,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_session_method (planned_session_id,schema_type,routine_template_id,template_name,frozen_at_ms) VALUES (701,'APRE',NULL,'Reset probe',0)");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (701,701,1,1,4,5,8.0)");
  db.exec("INSERT INTO planned_slot_autopilot (planned_slot_id,rpe_delta,set_delta,reason) VALUES (701,-0.5,-1,'eased')");
  db.exec("INSERT INTO planned_slot_routine_decision (planned_slot_id,role,lift_family,stress_purpose,stress_coefficient,equivalent_volume,stress_dose,adaptations_json) VALUES (701,'supplementary',NULL,NULL,0,0,0,'[]')");
  db.exec("INSERT INTO planned_slot_legacy_role_allowance (planned_slot_id,role) VALUES (701,'supplementary')");
  db.prepare(MAT).run('2026-06-10'); // materializes a state_vector row (mech_daily already filled by trigger)
  const cnt = (t) => Number(db.prepare(`SELECT count(*) c FROM ${t}`).get().c);
  const seeded = ['session', 'set_record', 'set_dose_target', 'session_outcome', 'set_prefix', 'niggle', 'one_rep_max', 'training_block', 'planned_session', 'planned_session_method', 'planned_slot', 'planned_slot_autopilot', 'planned_slot_routine_decision', 'planned_slot_legacy_role_allowance', 'mech_daily', 'state_vector'];
  a('seed populated the history tables', seeded.every((t) => cnt(t) > 0));
  const profBefore = cnt('athlete_profile'); const movBefore = cnt('movement');
  for (const t of resetTables) db.prepare(`DELETE FROM ${t}`).run(); // the store's exact sequence
  a('reset cleared EVERY history table (demo can re-load)', resetTables.every((t) => cnt(t) === 0), seeded.map((t) => `${t}=${cnt(t)}`).filter((s) => !s.endsWith('=0')).join(',') || 'all empty');
  a('athlete_profile + movement library SURVIVE the reset',
    cnt('athlete_profile') === profBefore && profBefore === 1 && cnt('movement') === movBefore && movBefore === 300,
    `profile ${cnt('athlete_profile')}/${profBefore}, movement ${cnt('movement')}/${movBefore}`);
  db.exec('ROLLBACK');
}

// --- wipe/reset behavior contracts (audit A2/A3/A4 + reset defect) -----------
{
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
  const wipeStart = src.indexOf('wipeActiveBlockState: () => {');
  const wipeBody = src.slice(wipeStart, src.indexOf('switchAthlete:', wipeStart));
  for (const key of ['prescription: null', 'substitution: null', 'sessionPlan: []', 'activeMovementId: null']) {
    const ok = wipeBody.includes(key);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  wipe clears stale state: ${key}`);
    if (!ok) fail += 1;
  }
  const resetStart = src.indexOf('resetTrainingData: () => {');
  const resetBody = src.slice(resetStart, src.indexOf('loadDemoAthlete:', resetStart));
  for (const key of ['session: null', 'prescription: null', 'substitution: null', 'sessionPlan: []']) {
    const ok = resetBody.includes(key);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  full reset clears in-memory state: ${key}`);
    if (!ok) fail += 1;
  }
  const guards = [
    ['generateNewBlock refuses during an active session', 'End the active session before generating a new block.'],
    ['switchProfile refuses during an active session', 'End the active session before switching profiles.'],
    ['startSession has a duplicate-start guard', 'double-start would orphan'],
    ['boot is single-flight', 'bootInFlight'],
    ['registry write failures surface to the athlete', 'registry write failed'],
    ['time-mode movements enforce seconds at the log boundary', 'is time-based'],
    ['set logging rejects non-finite or negative load at the store boundary', 'Enter a finite load of 0 kg or more before logging the set.'],
    ['boot resumes an unfinished session (crash recovery)', 'RESUMES it on restart'],
    ['missing readiness vector clears the stale prescription', "vector === null) { set({ prescription: null })"],
    ['direct preference saves delegate to the executable production seam', 'executeDirectLoadPreferenceSave('],
    ['profile transitions delegate to the executable production seam', 'planProfileLoadTransition('],
    ['guarded profile persistence delegates to the executable production seam', 'executeProfileLoadSave('],
    ['preference hydration delegates to the executable production seam', 'readActiveLoadPreference('],
    ['same-as-default explicit choices are persisted independently', 'loadPreferenceExplicit: prefExplicit'],
    ['current-session carry-forward chooses the latest logged set', 'candidate.set_id > latest.set_id'],
    ['screens resolve loads through the pure resolver', 'resolveLoadSelection('],
  ];
  for (const [label, needle] of guards) {
    const ok = src.includes(needle);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) fail += 1;
  }
  const screen = readFileSync(join(import.meta.dirname, '..', 'src', 'screens', 'ProfileScreen.tsx'), 'utf-8');
  const ok = screen.includes('End the active session before deleting the block');
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  destructive wipe blocked during an active session (UI)`);
  if (!ok) fail += 1;
}

// --- [Phase 13 Step 5] Upgrade, Constraints, and Store Lifecycle Tests -----------
{
  console.log('[022 upgrade, constraints, and store lifecycle simulation]');

  const FILES = [
    '001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
    '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
    '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
    '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
    '014_movement_prefixes.sql', '015_set_prefix.sql',
    '016_movement_library_seed.sql', '017_movement_batch.sql',
    '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
    '021_taxonomy_corrections.sql', '022_set_target.sql', '023_phase17_session_foundation.sql',
    '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
    '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
    '028_capability_graph.sql', '029_routine_history_analytics.sql',
    '030_readiness_import_integration.sql', '031_planned_session_method.sql',
    '032_capability_content.sql', '033_goal_program.sql', '034_autopilot_attribution.sql',
    '035_profile_load_preference.sql'
  ];

  // 1. Schema shape test: applying 022 on a fresh DB produces the correct set_target schema.
  // The old rename-copy upgrade pattern was removed (it destroyed session_plan_slot_id on
  // re-apply). Old-draft set_target was never shipped; the migration is now a pure
  // CREATE IF NOT EXISTS — a no-op when tables already exist.
  const upDb = new DatabaseSync(':memory:');
  for (let i = 0; i < FILES.indexOf('022_set_target.sql'); i++) {
    upDb.exec(readFileSync(join(SCHEMA_DIR, FILES[i]), 'utf-8'));
  }
  upDb.exec(readFileSync(join(SCHEMA_DIR, '022_set_target.sql'), 'utf-8'));

  const cols = upDb.prepare('PRAGMA table_info(set_target)').all();
  const hasCol = cols.some((c) => c.name === 'session_plan_slot_id');
  check('022 schema: set_target has session_plan_slot_id column on fresh apply', hasCol);
  if (!hasCol) fail += 1;

  // Insert a current-schema row and verify all columns round-trip correctly.
  upDb.exec(`INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (901, 'Squat', 'squat', 1)`);
  upDb.exec(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (1, '2026-07-15', 0)`);
  upDb.exec(`INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, provenance_kind, target_rpe, source_planned_slot_id) VALUES (1, 1, 0, 901, 3, 'planned', 8.0, 101)`);
  upDb.exec(`INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (1, 1, 901, 1, 5, 100, 8.0, 0)`);
  upDb.exec(`INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (1, 1, 'planned', 8.0, 101, 12345)`);
  const row = upDb.prepare('SELECT * FROM set_target WHERE set_id = 1').get();
  const dataSurvived = row !== undefined && row.session_plan_slot_id === 1 && row.target_rpe === 8.0 && row.created_at_ms === 12345;
  check('022 schema: set_target round-trips session_plan_slot_id, target_rpe, created_at_ms', dataSurvived);
  if (!dataSurvived) fail += 1;

  // 2. Schema Constraints Test
  // session_origin constraint: origin_kind = 'free_form' but source_planned_session_id is not null
  let originFailed = false;
  try {
    upDb.exec("INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (1, 'free_form', 1);");
  } catch {
    originFailed = true;
  }
  check('schema constraint: session_origin rejects free_form with source planned session', originFailed);
  if (!originFailed) fail += 1;

  // session_plan_slot constraint: provenance_kind = 'free_form' but target_rpe is not null
  let slotFailed = false;
  try {
    upDb.exec(`
      INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id)
      VALUES (1, 1, 901, 3, 5, 'free_form', 8.0, null);
    `);
  } catch {
    slotFailed = true;
  }
  check('schema constraint: session_plan_slot rejects free_form with target RPE', slotFailed);
  if (!slotFailed) fail += 1;

  // 3. Store Lifecycle Simulation
  const lDb = new DatabaseSync(':memory:');
  for (const f of FILES) {
    lDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }

  // Seed movements
  lDb.exec("INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (901, 'Squat', 'squat', 1);");
  lDb.exec("INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (902, 'Bench Press', 'push_h', 1);");
  lDb.exec("INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (100, '2026-07-15', 'strength', 4, 'active', 0);");
  lDb.exec("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (10, 100, 1, 1, 'lower', 'accumulation', '2026-07-15');");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (101, 10, 1, 901, 3, 5, 8.0);");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (102, 10, 2, 902, 3, 5, 9.0);");

  // A. Start session (planned origin)
  lDb.exec("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (1, '2026-07-15', 1000000);");
  lDb.exec("INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (1, 'planned', 10);");
  lDb.exec(`
    INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date)
    VALUES (1, 1, 0, 901, 3, 5, 'planned', 8.0, 101, null, '2026-07-15');
  `);
  lDb.exec(`
    INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date)
    VALUES (2, 1, 1, 902, 3, 5, 'planned', 9.0, 102, null, '2026-07-15');
  `);

  // Consumed planned_slot_disposition
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (101, 'consumed', 1);");
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (102, 'consumed', 1);");

  // B. Log set for planned slot 1 (Squat)
  lDb.exec("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (1, 1, 901, 1, 5, 100.0, 8.0, 1005000);");
  lDb.exec("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (1, 1, 'planned', 8.0, 101, 1005000);");

  // Verify planned logging
  const set1 = lDb.prepare("SELECT * FROM set_target WHERE set_id = 1;").get();
  check('lifecycle test: planned set logging recorded target and slot reference', set1 !== undefined && set1.session_plan_slot_id === 1 && set1.provenance_kind === 'planned');
  if (!(set1 !== undefined && set1.session_plan_slot_id === 1 && set1.provenance_kind === 'planned')) fail += 1;

  // C. Substitution (Swap Bench Press 902 for Squat 901 as a substituted slot)
  // Bench slot (slot 2) gets updated to Squat 901
  lDb.exec(`
    UPDATE session_plan_slot
    SET movement_id = 901, provenance_kind = 'substituted', original_movement_id = 902
    WHERE session_plan_slot_id = 2;
  `);
  // Log set for slot 2
  lDb.exec("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (2, 1, 901, 2, 5, 105.0, 9.0, 1010000);");
  lDb.exec("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (2, 2, 'substituted', 9.0, 102, 1010000);");

  const set2 = lDb.prepare("SELECT * FROM set_target WHERE set_id = 2;").get();
  check('lifecycle test: substituted logging maps target and tracks original movement', set2 !== undefined && set2.session_plan_slot_id === 2 && set2.provenance_kind === 'substituted');
  if (!(set2 !== undefined && set2.session_plan_slot_id === 2 && set2.provenance_kind === 'substituted')) fail += 1;

  // D. Day-Swap and transaction rollback simulation
  // Future planned slot
  lDb.exec("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (11, 100, 1, 2, 'upper', 'accumulation', '2026-07-16');");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (103, 11, 1, 902, 3, 5, 7.5);");

  // Transaction: apply Day-Swap (Option)
  lDb.exec("BEGIN;");
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (103, 'swapped', 1);");
  // Update slot 2 to day_swapped
  lDb.exec(`
    UPDATE session_plan_slot
    SET movement_id = 902, provenance_kind = 'day_swapped', target_rpe = 7.5, source_planned_slot_id = 103, original_movement_id = 901, original_session_date = '2026-07-16'
    WHERE session_plan_slot_id = 2;
  `);
  lDb.exec("COMMIT;");

  const slot2 = lDb.prepare("SELECT * FROM session_plan_slot WHERE session_plan_slot_id = 2;").get();
  check('lifecycle test: day_swapped slot properties updated correctly', slot2 !== undefined && slot2.provenance_kind === 'day_swapped' && slot2.target_rpe === 7.5 && slot2.original_session_date === '2026-07-16');
  if (!(slot2 !== undefined && slot2.provenance_kind === 'day_swapped' && slot2.target_rpe === 7.5 && slot2.original_session_date === '2026-07-16')) fail += 1;

  // Verify rollback behavior: duplicate UNIQUE constraint failure (session_id, slot_index) rollback
  lDb.exec("BEGIN;");
  let transactionThrew = false;
  try {
    // Attempt insert that violates UNIQUE(session_id, slot_index)
    lDb.exec(`
      INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id)
      VALUES (1, 0, 902, 3, 5, 'free_form', null, null);
    `);
    lDb.exec("COMMIT;");
  } catch {
    transactionThrew = true;
    lDb.exec("ROLLBACK;");
  }
  check('lifecycle test: transaction rolls back on constraint violation', transactionThrew);
  if (!transactionThrew) fail += 1;

  // --- P1 #1 regression: training-block delete must not fail due to FK/CHECK clash --------
  // Reproduces the defect found by the auditor: delete a training_block that a session_origin
  // row references. With the old FK (ON DELETE SET NULL) this violated the CHECK constraint.
  // With the fixed schema (plain INTEGER, no FK) the delete must succeed.
  {
    const fkDb = new DatabaseSync(':memory:');
    fkDb.exec('PRAGMA foreign_keys = ON;');
    for (const f of FILES) fkDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
    fkDb.exec(`INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (200, '2026-07-15', 'strength', 4, 'active', 0)`);
    fkDb.exec(`INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (20, 200, 1, 1, 'lower', 'accumulation', '2026-07-15')`);
    fkDb.exec(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (2, '2026-07-15', 0)`);
    fkDb.exec(`INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (2, 'planned', 20)`);
    let blockDeleteFailed = false;
    try {
      fkDb.exec('DELETE FROM training_block WHERE block_id = 200');
    } catch {
      blockDeleteFailed = true;
    }
    check('P1 #1 regression: training_block delete with planned session_origin succeeds (no FK/CHECK clash)', !blockDeleteFailed);
    if (blockDeleteFailed) fail += 1;
    // The snapshot value is retained even though the plan is gone (correct immutable provenance)
    const snap = fkDb.prepare('SELECT source_planned_session_id FROM session_origin WHERE session_id = 2').get();
    check('P1 #1: snapshot source_planned_session_id retained after block delete', snap !== undefined && snap.source_planned_session_id === 20);
    if (!(snap !== undefined && snap.source_planned_session_id === 20)) fail += 1;
  }

  // --- P2 regression: unknown explicit sessionPlanSlotId in logSet must error ----------------
  // The production guard is in TypeScript (useStore.ts logSet). We verify its presence in
  // source so the gate catches regressions at the text level (same pattern as the other guards).
  {
    const storeSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
    const hasUnknownSlotGuard = storeSrc.includes('slot not found in the active session plan');
    check('P2: logSet errors on unknown explicit sessionPlanSlotId (no silent movement-fallback)', hasUnknownSlotGuard);
    if (!hasUnknownSlotGuard) fail += 1;
  }
  // --- Store-boundary halt enforcement (Phase 17 spec) ----------------------------------
  // When the runner is in a halted or complete phase, logSet must refuse at the store
  // boundary before it even attempts a DB write. The runner itself rejects LOG_SET
  // events from terminal states (check [12] in verify:runner), but the store must also
  // surface a user-visible error rather than silently no-op.
  // We verify the production guard is present in source (same approach as the P2 check).
  {
    const storeSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
    const hasHaltGuard = storeSrc.includes('cannot be logged in the current session state');
    check('store-boundary: logSet surfaces a user-visible error when runner rejects LOG_SET (halted/complete guard)', hasHaltGuard);
    if (!hasHaltGuard) fail += 1;

    // Verify the runner checkpoint also enforces it structurally: the HALT event
    // transitions to a terminal phase, and every subsequent LOG_SET is a strict no-op
    // (the runner returns the identical reference). We test this via the source
    // assertion that the guard checks for an identity-equal runner after advance.
    const hasIdentityGuard = storeSrc.includes('nextRunner === state.runner') || storeSrc.includes('nextRunner === runner');
    check('store-boundary: store checks runner identity-equality to detect no-ops from terminal phase events', hasIdentityGuard);
    if (!hasIdentityGuard) fail += 1;
  }
}

// --- Phase 18: immutable dose snapshots + atomic outcome finalization --------
{
  console.log('[Phase 18 store persistence contracts]');
  const sliceBetween = (startNeedle, endNeedle) => {
    const start = src.indexOf(startNeedle);
    const end = src.indexOf(endNeedle, start + startNeedle.length);
    return start >= 0 && end > start ? src.slice(start, end) : '';
  };
  const ordered = (body, needles) => {
    let cursor = -1;
    for (const needle of needles) {
      cursor = body.indexOf(needle, cursor + 1);
      if (cursor < 0) return false;
    }
    return true;
  };

  const logSetBody = sliceBetween('logSet: (movementId, reps', 'editSet: (setId, reps');
  const editSetBody = sliceBetween('editSet: (setId, reps', 'endSession: () => {');
  const hydrateBody = sliceBetween('const hydrateSessionFinalization =', 'const persistSessionOutcome =');
  const persistOutcomeBody = sliceBetween('const persistSessionOutcome =', 'const applyApreFinalization =');
  const applyApreBody = sliceBetween('const applyApreFinalization =', 'const runnerSelection =');
  const endSessionBody = sliceBetween('endSession: () => {', 'computePrescription: (_patterns) => {');

  a('Phase 18 implementation bodies are located',
    [logSetBody, editSetBody, hydrateBody, persistOutcomeBody, applyApreBody, endSessionBody]
      .every((body) => body.length > 0));

  const logBegin = logSetBody.indexOf("d.executeSync('BEGIN')");
  const logCommit = logSetBody.indexOf("d.executeSync('COMMIT')", logBegin);
  const logTxn = logBegin >= 0 && logCommit > logBegin ? logSetBody.slice(logBegin, logCommit) : '';
  a('dose snapshot is written in the set transaction after record + provenance and before checkpoint/commit',
    ordered(logTxn, [
      'INSERT INTO set_record',
      'INSERT INTO set_target',
      'INSERT INTO set_dose_target',
      'persistRunnerCheckpoint(',
    ]));
  a('dose snapshot binds the frozen prescribed target, never the actual logged dose',
    logSetBody.includes('const prescribedDose = planSlot?.target ?? null')
      && logTxn.includes('if (prescribedDose !== null)')
      && logTxn.includes('prescribedDose.kind === \'reps\' ? prescribedDose.reps : null')
      && logTxn.includes('prescribedDose.kind === \'time\' ? prescribedDose.seconds : null'));
  a('unanswered actual RPE stays nullable through store clamp and set_record binding',
    logSetBody.includes('const safeRpe = rpe === null ? null')
      && logTxn.includes('[s.sessionId, movementId, setIndex, safeReps, safeLoad, safeRpe, loggedAtMs]'));
  a('runner may use prescribed RPE for rest without fabricating persisted athlete evidence',
    logSetBody.includes("...(safeRpe === null ? {} : { actualRpe: safeRpe })")
      && logSetBody.includes('rpe: safeRpe'));
  a('metric-only set edits preserve an unanswered nullable RPE',
    editSetBody.includes('const safeRpe = rpe === null ? null')
      && editSetBody.includes('[safeReps, safeLoad, safeRpe, setId]')
      && editSetBody.includes('rpe: safeRpe'));
  a('set memory is updated only after the dose transaction commits',
    logCommit >= 0 && logSetBody.indexOf('const logged: LoggedSet', logCommit) > logCommit);
  a('editing actual work cannot rewrite its immutable prescribed-dose snapshot',
    !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+set_dose_target\b/i.test(editSetBody));

  a('finalization hydrates every set with an optional frozen dose and timed actual evidence',
    hydrateBody.includes('LEFT JOIN set_dose_target')
      && hydrateBody.includes("LEFT JOIN set_metric tm ON tm.set_id = sr.set_id AND tm.metric = 'time_s'")
      && !hydrateBody.includes('JOIN session_slot_target'));
  a('APRE attribution binds source planned-slot identity and performed movement identity',
    hydrateBody.includes('st.source_planned_slot_id')
      && hydrateBody.includes('sourcePlannedSlotId: row.source_planned_slot_id')
      && applyApreBody.includes('planned_slot_id')
      && applyApreBody.includes('loggedSet.sourcePlannedSlotId === slot.planned_slot_id')
      && applyApreBody.includes('loggedSet.movementId === slot.movement_id'));
  a('finalization classifies exactly once from the hydrated snapshot',
    (endSessionBody.match(/evaluateSessionOutcome\s*\(/g) ?? []).length === 1
      && endSessionBody.includes('sets: snapshot.sets')
      && endSessionBody.includes('persistSessionOutcome(')
      && endSessionBody.includes('outcomeDecision,'));

  const evidenceFields = [
    'slotCount', 'plannedSetCount', 'loggedSetCount', 'exactDoseCount',
    'underDoseCount', 'overDoseCount', 'unknownDoseCount', 'unmappedSetCount',
    'missingSetCount', 'missingUnskippedSetCount', 'extraSetCount',
    'adaptedSlotCount', 'skippedSlotCount', 'offPlanSlotCount',
  ];
  a('one classifier decision directly supplies all durable evidence fields',
    persistOutcomeBody.includes('const evidence = outcomeDecision.evidence')
      && evidenceFields.every((field) => persistOutcomeBody.includes(`evidence.${field}`))
      && ['kind', 'terminalPhase', 'haltReason', 'finalizedAtMs', 'engineVersion']
        .every((field) => persistOutcomeBody.includes(`outcomeDecision.${field}`)));

  const endBegin = endSessionBody.indexOf("d.executeSync('BEGIN')");
  const endCommit = endSessionBody.indexOf("d.executeSync('COMMIT')", endBegin);
  const endTxn = endBegin >= 0 && endCommit > endBegin ? endSessionBody.slice(endBegin, endCommit) : '';
  const checkpointDelete = endTxn.indexOf('DELETE FROM session_runner_checkpoint');
  const afterCheckpointDelete = checkpointDelete >= 0
    ? endTxn.slice(checkpointDelete + 'DELETE FROM session_runner_checkpoint'.length)
    : '';
  const catchReturn = endSessionBody.indexOf('return;', endCommit);
  const successClear = endSessionBody.indexOf('session: null', catchReturn);
  a('outcome, session finalization, and checkpoint delete share one transaction',
    (endSessionBody.match(/d\.executeSync\('BEGIN'\)/g) ?? []).length === 1
      && (endSessionBody.match(/d\.executeSync\('COMMIT'\)/g) ?? []).length === 1
      && ordered(endTxn, [
        'hydrateSessionFinalization(',
        'evaluateSessionOutcome(',
        'UPDATE session SET session_rpe = ?, duration_min = ?',
        'MATERIALIZE_STATE_VECTOR_SQL',
        'applyApreFinalization(',
        'persistSessionOutcome(',
        'DELETE FROM session_runner_checkpoint',
      ]));
  a('checkpoint deletion is the final database mutation before finalization commit',
    checkpointDelete >= 0 && !afterCheckpointDelete.includes('executeSync(')
      && !afterCheckpointDelete.includes('persistSessionOutcome(')
      && !afterCheckpointDelete.includes('applyApreFinalization('));
  a('finalization failure rolls back and returns without clearing resumable state',
    endSessionBody.slice(endCommit, catchReturn).includes("d.executeSync('ROLLBACK')")
      && catchReturn >= 0);
  a('successful finalization clears memory only after the durable commit',
    endCommit >= 0 && successClear > catchReturn
      && !endSessionBody.slice(catchReturn, successClear).includes('executeSync('));

  const hydrationSql = statements.find((sql) => sql.includes('LEFT JOIN set_dose_target'));
  a('the exact frozen-dose hydration SQL is exposed to the store gate', Boolean(hydrationSql));
  if (hydrationSql) {
    let hydrationRan = false;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18300,'2099-12-28',1000)");
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18300,18300,0,1,3,8,'planned',8,18300)");
      db.exec("INSERT INTO session_slot_target (session_plan_slot_id,target_kind,target_reps) VALUES (18300,'reps',8)");
      for (const [setId, setIndex, reps] of [[18301, 1, 5], [18302, 2, 6], [18303, 3, 1]]) {
        db.prepare('INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (?,18300,1,?,?,20,8,1100)')
          .run(setId, setIndex, reps);
        db.prepare("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (?,18300,'planned',8,18300,1100)")
          .run(setId);
      }
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18301,'reps',5)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_seconds) VALUES (18303,'time',30)");
      db.exec("INSERT INTO set_metric (set_id,metric,value) VALUES (18303,'time_s',25)");
      const beforeMutation = db.prepare(hydrationSql).all(18300);
      db.exec("UPDATE session_slot_target SET target_reps=9 WHERE session_plan_slot_id=18300");
      const afterMutation = db.prepare(hydrationSql).all(18300);
      const frozen = afterMutation.find((row) => Number(row.set_id) === 18301);
      const legacy = afterMutation.find((row) => Number(row.set_id) === 18302);
      const timed = afterMutation.find((row) => Number(row.set_id) === 18303);
      a('per-set target survives later session-slot mutation unchanged',
        Number(beforeMutation.find((row) => Number(row.set_id) === 18301)?.target_reps) === 5
          && Number(frozen?.target_reps) === 5);
      a('LEFT JOIN retains historical sets with honestly absent dose evidence',
        afterMutation.length === 3 && legacy?.target_kind === null);
      a('timed target and actual seconds hydrate from their immutable/metric side-cars',
        timed?.target_kind === 'time' && Number(timed.target_seconds) === 30 && Number(timed.time_s) === 25);
      hydrationRan = true;
    } finally {
      db.exec('ROLLBACK');
    }
    a('frozen-target hydration probe completed', hydrationRan);
  }

  const apreSourceSql = statements.find((sql) => sql.includes("COALESCE(psm.schema_type, bm.schema_type) = 'APRE'") && sql.includes('ps.week_index'));
  const apreSourceSlotsSql = statements.find((sql) => sql.includes('sl.planned_slot_id, sl.movement_id, sl.reps, orm.load_kg AS one_rm_kg'));
  const apreNextSlotSql = statements.find((sql) => sql.includes('SELECT sl.planned_slot_id, sl.reps, sl.target_rpe') && sql.includes('ps.week_index = ?'));
  const apreExistingOverrideSql = statements.find((sql) => sql.startsWith('SELECT target_load_kg FROM slot_override'));
  const apreUpsertSql = statements.find((sql) => sql.startsWith('INSERT INTO slot_override') && sql.includes('ON CONFLICT(planned_slot_id)'));
  a('exact production APRE read/write SQL is exposed to the attribution regression',
    Boolean(apreSourceSql) && Boolean(apreSourceSlotsSql) && Boolean(apreNextSlotSql)
      && Boolean(apreExistingOverrideSql) && Boolean(apreUpsertSql));
  if (
    hydrationSql && apreSourceSql && apreSourceSlotsSql && apreNextSlotSql
    && apreExistingOverrideSql && apreUpsertSql
  ) {
    const runApreContract = (sourcePlannedSessionId, loggedSets, finalizedAtMs) => {
      const source = db.prepare(apreSourceSql).get(sourcePlannedSessionId);
      if (source === undefined || Number(source.week_index) >= 4) return;
      const sourceSlots = db.prepare(apreSourceSlotsSql).all(sourcePlannedSessionId);
      for (const slot of sourceSlots) {
        if (slot.one_rm_kg === null) continue;
        const bestReps = loggedSets
          .filter((loggedSet) =>
            loggedSet.sourcePlannedSlotId === Number(slot.planned_slot_id)
              && loggedSet.movementId === Number(slot.movement_id))
          .reduce((best, loggedSet) => Math.max(best, loggedSet.reps), 0);
        const surplus = bestReps - Number(slot.reps);
        if (surplus <= 0) continue;
        const nextSlot = db.prepare(apreNextSlotSql).get(
          Number(source.block_id), Number(source.week_index) + 1, Number(slot.movement_id),
        );
        if (nextSlot === undefined) continue;
        const existing = db.prepare(apreExistingOverrideSql).get(Number(nextSlot.planned_slot_id));
        if (existing === undefined) throw new Error('APRE attribution fixture requires a baseline override');
        const deltaKg = Math.min(7.5, Math.ceil(surplus / 2) * 2.5);
        db.prepare(apreUpsertSql).run(
          Number(nextSlot.planned_slot_id),
          Number(existing.target_load_kg) + deltaKg,
          `APRE probe: +${deltaKg} kg from source slot ${slot.planned_slot_id}`,
          finalizedAtMs,
        );
      }
    };
    const loggedSetsFromHydration = (sessionId) => db.prepare(hydrationSql).all(sessionId).map((row) => ({
      sourcePlannedSlotId: row.source_planned_slot_id === null ? null : Number(row.source_planned_slot_id),
      movementId: Number(row.movement_id),
      reps: Number(row.reps),
    }));
    const overrideLoads = () => Object.fromEntries(db.prepare(
      'SELECT planned_slot_id,target_load_kg FROM slot_override WHERE planned_slot_id IN (18621,18622) ORDER BY planned_slot_id',
    ).all().map((row) => [Number(row.planned_slot_id), Number(row.target_load_kg)]));

    let apreCollisionRan = false;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (18601,'APRE Collision A','squat',1)");
      db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (18602,'APRE Collision B','hinge',1)");
      db.exec('INSERT INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (18601,100,0),(18602,100,0)');
      db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (18600,'2099-12-01','strength',0)");
      db.exec("INSERT INTO block_meta (block_id,macro_block_index,macro_phase,schema_type) VALUES (18600,1,'gpp','APRE')");
      db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (18610,18600,1,1,'lower','accumulation','2099-12-01')");
      db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (18620,18600,2,1,'lower','accumulation','2099-12-08')");
      db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (18611,18610,1,18601,3,5,8),(18612,18610,2,18602,3,5,8)");
      db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (18621,18620,1,18601,3,5,8),(18622,18620,2,18602,3,5,8)");
      db.exec("INSERT INTO slot_override (planned_slot_id,target_load_kg,reason,created_at_ms) VALUES (18621,100,'baseline A',0),(18622,100,'baseline B',0)");
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18630,'2099-12-01',1000)");
      // Source slot B was substituted to movement A. Its 12 reps must not be
      // attributed to source slot A merely because the performed movement collides.
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id,original_movement_id) VALUES (18631,18630,0,18601,1,5,'substituted',8,18612,18602)");
      db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (18631,18630,18601,1,12,100,8,1100)");
      db.exec("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (18631,18631,'substituted',8,18612,1100)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18631,'reps',5)");

      const collisionRows = db.prepare(hydrationSql).all(18630);
      const collisionLoggedSets = loggedSetsFromHydration(18630);
      runApreContract(18610, collisionLoggedSets, 2000);
      const afterCollision = overrideLoads();
      a('substituted collision retains source slot B + performed movement A identities',
        collisionRows.length === 1
          && Number(collisionRows[0].source_planned_slot_id) === 18612
          && Number(collisionRows[0].movement_id) === 18601);
      a('substituted reps cannot advance the wrong same-movement source slot',
        afterCollision[18621] === 100 && afterCollision[18622] === 100);

      // Positive control: a real movement-A set attributed to source slot A may
      // advance only movement A's next-week slot by the expected +2.5 kg.
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18632,18630,1,18601,1,5,'planned',8,18611)");
      db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (18632,18630,18601,2,7,100,8,1200)");
      db.exec("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (18632,18632,'planned',8,18611,1200)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18632,'reps',5)");
      runApreContract(18610, loggedSetsFromHydration(18630), 3000);
      const afterControl = overrideLoads();
      a('correctly attributed control set advances only its own future slot',
        afterControl[18621] === 102.5 && afterControl[18622] === 100);
      apreCollisionRan = true;
    } finally {
      db.exec('ROLLBACK');
    }
    a('APRE substitution-collision regression completed', apreCollisionRan);
  }
  const setRecordInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_record (session_id, movement_id, set_index'));
  const setTargetInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_target (set_id, session_plan_slot_id'));
  const doseInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_dose_target (set_id, target_kind'));
  a('exact production SQL for all three atomic set rows is exposed',
    Boolean(setRecordInsertSql) && Boolean(setTargetInsertSql) && Boolean(doseInsertSql));
  if (setRecordInsertSql && setTargetInsertSql && doseInsertSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18390,'2099-12-28',1000)");
    db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18390,18390,0,1,1,5,'planned',8,18390)");
    db.prepare(setRecordInsertSql).run(18390, 1, 1, 5, 20, null, 1100);
    const nullRpeSetId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
    db.prepare(setTargetInsertSql).run(nullRpeSetId, 18390, 'planned', 8, 18390, 1100);
    const nullablePair = db.prepare('SELECT sr.rpe, st.target_rpe FROM set_record sr JOIN set_target st ON st.set_id=sr.set_id WHERE sr.set_id=?').get(nullRpeSetId);
    a('exact production set SQL stores unanswered actual RPE as NULL beside its frozen target',
      nullablePair?.rpe === null && Number(nullablePair?.target_rpe) === 8);
    db.exec('ROLLBACK');

    db.exec('DROP TRIGGER IF EXISTS wo183_poison_dose');
    db.exec("CREATE TEMP TRIGGER wo183_poison_dose BEFORE INSERT ON set_dose_target BEGIN SELECT RAISE(ABORT,'wo18.3 dose poison'); END");
    let dosePoisonThrew = false;
    let poisonedSetId = 0;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18400,'2099-12-29',1000)");
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18400,18400,0,1,1,5,'planned',8,18400)");
      db.prepare(setRecordInsertSql).run(18400, 1, 1, 5, 20, 8, 1100);
      poisonedSetId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
      db.prepare(setTargetInsertSql).run(poisonedSetId, 18400, 'planned', 8, 18400, 1100);
      db.prepare(doseInsertSql).run(poisonedSetId, 'reps', 5, null);
      db.exec('COMMIT');
    } catch {
      dosePoisonThrew = true;
      db.exec('ROLLBACK');
    }
    db.exec('DROP TRIGGER wo183_poison_dose');
    const poisonedChildren = poisonedSetId === 0 ? 0 : Number(db.prepare(`
      SELECT (SELECT count(*) FROM set_record WHERE set_id=?)
           + (SELECT count(*) FROM set_target WHERE set_id=?)
           + (SELECT count(*) FROM set_dose_target WHERE set_id=?) AS c
    `).get(poisonedSetId, poisonedSetId, poisonedSetId).c);
    a('dose snapshot poison aborts the set record + both snapshots atomically',
      dosePoisonThrew && poisonedChildren === 0
        && Number(db.prepare('SELECT count(*) AS c FROM session WHERE session_id=18400').get().c) === 0);
  }

  const outcomeInsertSql = statements.find((sql) => sql.startsWith('INSERT INTO session_outcome'));
  const finalizeSessionSql = statements.find((sql) => sql.includes('UPDATE session SET session_rpe = ?, duration_min = ?'));
  const deleteCheckpointSql = statements.find((sql) => sql.includes('DELETE FROM session_runner_checkpoint WHERE session_id = ?'));
  const openSessionSql = statements.find((sql) => sql.includes('duration_min IS NULL AND started_at_ms IS NOT NULL'));
  a('exact production outcome/finalization/checkpoint SQL is exposed',
    Boolean(outcomeInsertSql) && Boolean(finalizeSessionSql)
      && Boolean(deleteCheckpointSql) && Boolean(openSessionSql));
  if (outcomeInsertSql && finalizeSessionSql && deleteCheckpointSql && openSessionSql) {
    const sessionId = 18500;
    const checkpointJson = '{"version":1,"probe":"wo18.3-exact-resume"}';
    const outcomeArgs = [
      sessionId, 'followed_plan', 'complete', null, 'planned', 'guided', 'beginner',
      1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5000, 1,
    ];
    db.exec('BEGIN');
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18500,'2099-12-30',1000)");
    db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18500,18500,0,1,1,5,'planned',8,18500)");
    db.prepare(`INSERT INTO session_runner_checkpoint
      (session_id,session_mode,phase,current_session_plan_slot_id,current_set_index,
       rest_target_seconds,rest_started_at_ms,runner_state_json,updated_at_ms)
      VALUES (?,'guided','complete',NULL,NULL,0,NULL,?,4444)`).run(sessionId, checkpointJson);
    db.exec('COMMIT');

    const checkpointBefore = db.prepare('SELECT * FROM session_runner_checkpoint WHERE session_id=?').get(sessionId);
    db.exec('DROP TRIGGER IF EXISTS wo183_poison_checkpoint_delete');
    db.exec(`CREATE TEMP TRIGGER wo183_poison_checkpoint_delete
      BEFORE DELETE ON session_runner_checkpoint WHEN OLD.session_id=18500
      BEGIN SELECT RAISE(ABORT,'wo18.3 checkpoint poison'); END`);
    let finalizationPoisonThrew = false;
    db.exec('BEGIN');
    try {
      db.prepare(outcomeInsertSql).run(...outcomeArgs);
      db.prepare(finalizeSessionSql).run(8, 1.5, sessionId);
      db.prepare(deleteCheckpointSql).run(sessionId);
      db.exec('COMMIT');
    } catch {
      finalizationPoisonThrew = true;
      db.exec('ROLLBACK');
    }
    db.exec('DROP TRIGGER wo183_poison_checkpoint_delete');

    const checkpointAfter = db.prepare('SELECT * FROM session_runner_checkpoint WHERE session_id=?').get(sessionId);
    const sessionAfterRollback = db.prepare('SELECT session_rpe,duration_min FROM session WHERE session_id=?').get(sessionId);
    const resumable = db.prepare(openSessionSql).get('2099-12-30');
    a('late checkpoint-delete poison rolls outcome + session finalization back',
      finalizationPoisonThrew
        && db.prepare('SELECT 1 FROM session_outcome WHERE session_id=?').get(sessionId) === undefined
        && sessionAfterRollback?.session_rpe === null
        && sessionAfterRollback?.duration_min === null);
    a('rollback preserves the exact checkpoint and boot-visible unfinished session',
      JSON.stringify(checkpointAfter) === JSON.stringify(checkpointBefore)
        && checkpointAfter?.runner_state_json === checkpointJson
        && Number(resumable?.session_id) === sessionId);

    db.exec('BEGIN');
    db.prepare(outcomeInsertSql).run(...outcomeArgs);
    db.prepare(finalizeSessionSql).run(8, 1.5, sessionId);
    db.prepare(deleteCheckpointSql).run(sessionId);
    db.exec('COMMIT');
    const finalized = db.prepare('SELECT session_rpe,duration_min FROM session WHERE session_id=?').get(sessionId);
    a('same exact SQL succeeds atomically after the poison is removed',
      db.prepare('SELECT outcome_kind FROM session_outcome WHERE session_id=?').get(sessionId)?.outcome_kind === 'followed_plan'
        && Number(finalized?.session_rpe) === 8
        && Number(finalized?.duration_min) === 1.5
        && db.prepare('SELECT 1 FROM session_runner_checkpoint WHERE session_id=?').get(sessionId) === undefined);

    // FK-off cleanup follows the immutable parent-first rule used by resetTrainingData.
    db.exec('DELETE FROM session_plan_slot WHERE session_id=18500');
    db.exec('DELETE FROM session WHERE session_id=18500');
    db.exec('DELETE FROM session_outcome WHERE session_id=18500');
  }

  // --- [T2] latestLoadMap query plan & semantics check ---
  console.log('[latestLoadMap query plan & semantics]');
  const latestLoadSql = statements.find((s) => s.includes('FROM movement m') && s.includes('set_record'));
  a('store exposes latestLoadMap SQL literal', Boolean(latestLoadSql));
  if (latestLoadSql) {
    const eqp = db.prepare(`EXPLAIN QUERY PLAN ${latestLoadSql}`).all();
    const hasScanSetRecord = eqp.some((row) => row.detail && row.detail.includes('SCAN set_record'));
    a('latestLoadMap EXPLAIN QUERY PLAN contains no SCAN set_record', !hasScanSetRecord, JSON.stringify(eqp));

    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (991,'No Set Movement','squat',1)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (992,'BW Movement','squat',0)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (993,'Weighted Movement','squat',1)");
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (991,'2026-06-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (991,991,992,1,10,0,7.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (992,991,993,1,5,80,7.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (993,991,993,2,5,85.5,8.0,0)");

    const rows = db.prepare(latestLoadSql).all();
    const map = Object.fromEntries(
      rows.filter((r) => r.load_kg !== null).map((r) => [r.movement_id, r.load_kg])
    );

    a('latestLoadMap: zero-set movement (991) is ABSENT', !(991 in map));
    a('latestLoadMap: last-set-was-0 movement (992) is PRESENT with 0', map[992] === 0, `got ${map[992]}`);
    a('latestLoadMap: weighted movement (993) has latest load_kg (85.5)', map[993] === 85.5, `got ${map[993]}`);
    db.exec('ROLLBACK');
  }

  // --- [T3] resolveGoalRung evidence window assertion ---
  console.log('[resolveGoalRung evidence window]');
  const goalRungSql = statements.find((s) => s.includes('WHERE p.progression_group = ? AND s.session_date >= date(?, ?)'));
  a('store exposes bounded resolveGoalRung SQL literal with bound date params', Boolean(goalRungSql));
  if (goalRungSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (981,'Window Test Pushup','push_h',0)");
    db.exec("INSERT INTO movement_progression (movement_id,progression_group,progression_rank) VALUES (981,'test_window_group',0)");

    // Session 981: inside 180-day window (today = 2026-06-01, session_date = 2026-05-01)
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (981,'2026-05-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (981,981,981,1,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (982,981,981,2,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (983,981,981,3,8,0,8.0,0)");

    // Session 982: outside 180-day window (today = 2026-06-01, session_date = 2025-10-01)
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (982,'2025-10-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (984,982,981,1,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (985,982,981,2,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (986,982,981,3,8,0,8.0,0)");

    const today = '2026-06-01';
    const windowParam = '-180 days';
    const rowsInside = db.prepare(goalRungSql).all('test_window_group', today, windowParam);
    a('qualifying session inside 180-day window returns sets', rowsInside.length === 3);

    // Delete session inside window and check session outside window
    db.exec("DELETE FROM set_record WHERE session_id = 981");
    db.exec("DELETE FROM session WHERE session_id = 981");
    const rowsOutside = db.prepare(goalRungSql).all('test_window_group', today, windowParam);
    a('byte-identical qualifying session dated outside 180-day window returns NO sets', rowsOutside.length === 0);

    db.exec('ROLLBACK');
  }

  // --- [T5] attestation writer SQL & FK integrity assertion ---
  console.log('[capability attestation SQL & FK integrity]');
  const attestInsertSql = statements.find((s) => s.includes('INSERT INTO movement_capability_attestation'));
  const attestDeleteSql = statements.find((s) => s.includes('DELETE FROM movement_capability_attestation WHERE prerequisite_movement_id'));
  a('store exposes exact attestation INSERT and DELETE SQL statements', Boolean(attestInsertSql) && Boolean(attestDeleteSql));
  if (attestInsertSql && attestDeleteSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (971,'Attest Prereq','push_h',0)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (972,'Attest Target','push_h',0)");
    db.exec("INSERT INTO movement_capability_edge (prerequisite_movement_id,movement_id,relationship,requires_attestation) VALUES (971,972,'prerequisite',1)");

    db.prepare(attestInsertSql).run(971, 972, 1000);
    const row = db.prepare('SELECT * FROM movement_capability_attestation WHERE prerequisite_movement_id = 971 AND movement_id = 972').get();
    a('attestation row appears with FK integrity', Boolean(row) && Number(row.attested_at_ms) === 1000);

    db.prepare(attestDeleteSql).run(971, 972);
    const rowRevoked = db.prepare('SELECT * FROM movement_capability_attestation WHERE prerequisite_movement_id = 971 AND movement_id = 972').get();
    a('revoke SQL removes attestation row', rowRevoked === undefined);

    db.exec('ROLLBACK');
  }

  // --- [T6] 051 prior-experience lifecycle + state propagation --------------
  console.log('[051 prior-experience lifecycle and context propagation]');
  const experienceUpsertSql = statements.find((s) => s.includes('INSERT INTO movement_prior_experience'));
  const experienceRevokeSql = statements.find((s) => s.includes('UPDATE movement_prior_experience'));
  a('store exposes the reconfirming UPSERT and non-destructive revoke SQL',
    Boolean(experienceUpsertSql) && Boolean(experienceRevokeSql));
  if (experienceUpsertSql && experienceRevokeSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (973,'Experience Target','push_v',1)");
    db.prepare(experienceUpsertSql).run(973, 100);
    let declaration = db.prepare('SELECT * FROM movement_prior_experience WHERE movement_id = 973').get();
    a('confirmation creates one active local declaration', declaration?.confirmed_at_ms === 100
      && declaration?.revoked_at_ms === null && declaration?.basis === 'local_user_confirmation');
    db.prepare(experienceRevokeSql).run(200, 973);
    declaration = db.prepare('SELECT * FROM movement_prior_experience WHERE movement_id = 973').get();
    a('revocation preserves the row and records an ordered timestamp', declaration?.confirmed_at_ms === 100
      && declaration?.revoked_at_ms === 200);
    db.prepare(experienceUpsertSql).run(973, 300);
    declaration = db.prepare('SELECT * FROM movement_prior_experience WHERE movement_id = 973').get();
    a('reconfirmation updates the timestamp and clears revocation', declaration?.confirmed_at_ms === 300
      && declaration?.revoked_at_ms === null);
    db.exec('ROLLBACK');
  }
  a('training-data reset deletes declarations but block/profile-slot wipes preserve them',
    src.includes("d.executeSync('DELETE FROM movement_prior_experience')")
      && !src.slice(src.indexOf('const runBlockWipe ='), src.indexOf('const defaultUiPreferences'))
        .includes('movement_prior_experience')
      && !src.slice(src.indexOf('switchProfile: (slotId)'), src.indexOf('resolveGoalRung:'))
        .includes('movement_prior_experience'));
  a('availability revision is independent of refreshVector and updates on declarations, attestations, imports, finalization, and reset',
    (src.match(/movementAvailabilityRevision: state\.movementAvailabilityRevision \+ 1/g) ?? []).length >= 5
      && src.includes('movementAvailabilityRevision: get().movementAvailabilityRevision + 1')
      && !src.slice(
        src.indexOf('  confirmMovementPriorExperience: (movementId, context) => {'),
        src.indexOf('  // --- Coach Mode (Phase 15)'),
      )
        .includes('refreshVector()'));
  const startBody = src.slice(src.indexOf('startSession: (repeatPlanned)'), src.indexOf('selectMovement: (movementId)'));
  a('start computes consumePlan before validating only the plan it will consume',
    startBody.indexOf('const consumePlan') >= 0
      && startBody.indexOf('const planToConsume') > startBody.indexOf('const consumePlan')
      && startBody.indexOf('planToConsume !== null && planToConsume.slots.some') > startBody.indexOf('const planToConsume'));
  a('Beginner routine provenance survives source-template deletion and still blocks start',
    startBody.includes('SELECT psm.routine_template_id, prc.routine_day_index')
      && startBody.includes("routineProvenance !== undefined && profile.training_age === 'beginner'")
      && !startBody.includes("profile.training_age === 'beginner' && routineProvenance?.routine_template_id"));
  a('routine start fails closed when source roles are missing, ambiguous, or no longer eligible',
    startBody.includes('const frozenTemplateRoles =')
      && startBody.includes('const currentRoleEligibility = routineRoleEligibility(d)')
      && startBody.includes('isRoutineRoleSnapshotExecutable('));
  a('routine start revalidates the frozen contextual family role contract',
    startBody.includes('const planningContract = routinePlanningContract(d)')
      && startBody.includes('contextualRoutineRoles(')
      && startBody.includes('planned_slot_routine_decision'));
  a('active sessions persist one frozen access context and restoration derives planned focus or free-form weight room',
    src.includes('activeSessionAccessContext: executionContext')
      && src.includes('activeSessionAccessContext: restoredAccessContext')
      && src.includes("restoredOrigin?.origin_kind === 'planned'")
      && src.includes("? accessContextForBlockFocus(restoredOrigin.focus as BlockFocus)")
      && src.includes(": 'weight_room'"));

  // --- [T7] logSet access boundary: ORDERING pin -----------------------------
  // The behaviour is proved executably against the real store, the real
  // migration chain and the real capability law in
  // apps/mobile/test/components/SessionAccessBoundary.test.js. What a
  // behavioural test can only show indirectly is WHERE the guard sits, so pin
  // the ordering here: after the identity/halt checks, before the runner
  // advance, and before the write transaction opens.
  console.log('[logSet store-boundary access revalidation]');
  const logSetAccessBody = src.slice(src.indexOf('  logSet: (movementId, reps, loadKg, rpe,'), src.indexOf('  deleteSet: (setId)'));
  const atGuard = logSetAccessBody.indexOf('const logAccessContext = executionContextForState(state);');
  const atVerdict = logSetAccessBody.indexOf('const logAvailability = capabilityMovementAvailability(');
  const atIdentity = logSetAccessBody.indexOf("set({ error: 'This set is not the current session step.' });");
  const atHalt = logSetAccessBody.indexOf("set({ error: 'Training is halted. Finish the session before logging more work.' });");
  const atAdvance = logSetAccessBody.indexOf('advanceSessionRunner(state.runner, {');
  const atBegin = logSetAccessBody.indexOf("d.executeSync('BEGIN');");
  a('logSet resolves the frozen access context and one shared capability verdict',
    atGuard >= 0 && atVerdict >= 0);
  a('logSet revalidates AFTER the slot-identity and halt guards',
    atHalt >= 0 && atIdentity >= 0 && atGuard > atIdentity && atGuard > atHalt);
  a('logSet revalidates BEFORE the runner advance and before the write transaction',
    atAdvance > atVerdict && atBegin > atVerdict);
  a('logSet fails closed on a missing verdict and never infers a fallback context',
    logSetAccessBody.includes("if (logAvailability?.state !== 'available') {")
      && logSetAccessBody.includes('set({ error: formatTeachingOnlyReason(logAvailability) });')
      && logSetAccessBody.includes('The active session access context cannot be verified. Reopen the session before logging more work.')
      && !/logAccessContext\s*(\?\?|\|\|)\s*'weight_room'/.test(logSetAccessBody));
  a('logSet feeds the shared law the live profile, niggles and prior-experience declarations',
    logSetAccessBody.includes('state.movements,')
      && logSetAccessBody.includes('state.profile,')
      && logSetAccessBody.includes('new Set(state.activePriorExperienceMovementIds),')
      && logSetAccessBody.includes('safetyExcludedMovementIdsFor(state.movements, state.profile, state.niggles),'));

  // --- [F3] Gate count & documentation drift assertion ---
  console.log('[documentation & CI gate count drift check]');
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const verifyAllScript = pkgJson.scripts['verify:all'] ?? '';
  const verifyInvocations = (verifyAllScript.match(/npm run verify:(?!all\b)[a-z0-9-]+/g) ?? []).length;

  const agentWorkflowContent = readFileSync(join(ROOT, 'AGENT_WORKFLOW.md'), 'utf-8');
  const ciYmlContent = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');

  const workflowMatch = agentWorkflowContent.match(/npm run verify:all\s+#\s+(\d+)\s+gates/);
  const workflowGateCount = workflowMatch ? Number(workflowMatch[1]) : null;

  const ciMatches = Array.from(ciYmlContent.matchAll(/\((\d+)\s+gates/g));
  const ciGateCounts = ciMatches.map((m) => Number(m[1]));

  a('verify:all script invokes exactly 20 verify:* targets', verifyInvocations === 20, `got ${verifyInvocations}`);
  a('AGENT_WORKFLOW.md documents exact verify:all gate count', workflowGateCount === verifyInvocations, `documented ${workflowGateCount}, actual ${verifyInvocations}`);
  a('ci.yml documents exact verify:all gate count at all occurrences', ciGateCounts.length >= 1 && ciGateCounts.every((c) => c === verifyInvocations), `ci.yml counts: ${ciGateCounts.join(',')}`);

  const androidBuildContent = readFileSync(join(ROOT, 'apps', 'mobile', 'android', 'app', 'build.gradle'), 'utf-8');
  const releaseBuildBlock = androidBuildContent.slice(androidBuildContent.lastIndexOf('release {'));
  const signingNames = [
    'AK_UPLOAD_STORE_FILE', 'AK_UPLOAD_STORE_PASSWORD',
    'AK_UPLOAD_KEY_ALIAS', 'AK_UPLOAD_KEY_PASSWORD',
  ];
  a('Android release build never uses the committed debug signing config',
    !releaseBuildBlock.includes('signingConfig signingConfigs.debug'));
  a('Android release signing requires all four external secret inputs',
    signingNames.every((name) => androidBuildContent.includes(name))
      && androidBuildContent.includes('Release signing is not configured.')
      && androidBuildContent.includes('gradle.taskGraph.whenReady'));
  a('CI artifact is explicitly debug-only and never invokes assembleRelease',
    ciYmlContent.includes('assembleDebug')
      && ciYmlContent.includes('athlete-kinetics-debug-qa-apk')
      && !ciYmlContent.includes('assembleRelease'));

  const gitignoreContent = readFileSync(join(ROOT, '.gitignore'), 'utf-8');
  a('upload keystores and local release credentials are ignored',
    gitignoreContent.includes('*.jks')
      && gitignoreContent.includes('**/keystore.properties')
      && gitignoreContent.includes('.env.release'));

  const profileScreenContent = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'screens', 'ProfileScreen.tsx'), 'utf-8');
  a('ATHLETE surface carries visible medical-device and medical-advice positioning',
    profileScreenContent.includes('not medical advice')
      && profileScreenContent.includes('It is not a medical device.'));

  // --- [T11] _chain_projection.sql.tpl equivalence check ---
  console.log('[SQL chain projection template equivalence check]');
  const tplPath = join(SCHEMA_DIR, '_chain_projection.sql.tpl');
  const tplSql = readFileSync(tplPath, 'utf-8');
  a('_chain_projection.sql.tpl contains WITH RECURSIVE walk', tplSql.includes('WITH RECURSIVE'));
  a('_chain_projection.sql.tpl deletes existing rows before insert', tplSql.includes('DELETE FROM movement_progression;'));

  db.exec(tplSql);
  const sqlProgressionRows = db.prepare('SELECT movement_id, progression_group, progression_rank FROM movement_progression ORDER BY progression_group, progression_rank').all();
}

// --- [049] the store's movement query, prepared against the LIVE schema ------
// MOVEMENT_LIBRARY_SQL is passed to executeSync by NAME, so the literal-scraping
// pass above never sees it. Extract and prepare it explicitly: a typo in the
// movement_scope LEFT JOIN would otherwise only surface on a device.
console.log('[049 movement library query + full-body scope projection]');
{
  const literal = src.match(/const MOVEMENT_LIBRARY_SQL = `([\s\S]*?)`;/);
  check('MOVEMENT_LIBRARY_SQL literal located in the store', literal !== null);
  if (literal !== null) {
    const librarySql = literal[1];
    try {
      const columns = db.prepare(librarySql).all();
      check('MOVEMENT_LIBRARY_SQL prepares and runs against the live 001-049 schema', true);
      check('the query projects a scope column for all 300 movements',
        columns.length === 300 && columns.every((row) => 'scope' in row),
        `${columns.length} rows`);
      const scoped = columns.filter((row) => row.scope === 'full_body').map((row) => row.name).sort();
      check('exactly the two ratified Turkish Get-Ups project scope full_body',
        JSON.stringify(scoped) === JSON.stringify([
          'Kettlebell Turkish Get-Up', 'Kettlebell Turkish Get-Up (Lunge style)']),
        JSON.stringify(scoped));
      check('every unscoped movement projects scope NULL (LEFT JOIN, row absent = not scoped)',
        columns.filter((row) => row.scope !== 'full_body').every((row) => row.scope === null));
      check('the scope LEFT JOIN adds no duplicate rows (one legal scope value per movement)',
        new Set(columns.map((row) => row.movement_id)).size === columns.length);
    } catch (e) {
      check(`MOVEMENT_LIBRARY_SQL prepares against the live schema — ${e instanceof Error ? e.message : e}`, false);
    }
  }
  a('movementFromRow narrows scope to the single legal value',
    /scope: r\.scope === 'full_body' \? 'full_body' : null/.test(src));
  a('both generator projections cross the null -> undefined boundary explicitly',
    (src.match(/scope: m\.scope \?\? undefined/g) ?? []).length === 2);
}

// --- [O3] fail-closed inventory parsing (the specialist-equipment guarantee) --
console.log('[O3 fail-closed equipment inventory parsing]');
{
  const requireCjs = createRequire(import.meta.url);
  const { inventoryFromRowCell, inventoryFromSnapshot, inventoryToSnapshot } = requireCjs(
    join(ROOT, 'apps', 'mobile', 'test', '.build', 'equipmentInventory.js'));
  const { EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS, SPECIALIST_EQUIPMENT_ITEMS, EQUIPMENT_PRESETS, DEFAULT_PROFILE } =
    requireCjs(join(ROOT, 'packages', 'inference', 'test', '.build', 'types.js'));
  const parseInventory = (json) => inventoryFromRowCell(json, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS);
  const eq = (a2, b2) => JSON.stringify(a2) === JSON.stringify(b2);

  check('the specialist vocabulary is a strict, non-empty subset of the persisted union',
    SPECIALIST_EQUIPMENT_ITEMS.length > 0
      && SPECIALIST_EQUIPMENT_ITEMS.every((i) => EQUIPMENT_ITEMS.includes(i))
      && SPECIALIST_EQUIPMENT_ITEMS.every((i) => !STANDARD_EQUIPMENT_ITEMS.includes(i))
      && EQUIPMENT_ITEMS.length === STANDARD_EQUIPMENT_ITEMS.length + SPECIALIST_EQUIPMENT_ITEMS.length);
  check('malformed inventory JSON falls back to STANDARD items and grants no specialist item',
    eq(parseInventory('{not json'), [...STANDARD_EQUIPMENT_ITEMS]),
    JSON.stringify(parseInventory('{not json')));
  const nonArrays = ['{}', '"x"', '7', 'null', 'true', '{"boards":true}'];
  check('every non-array inventory cell falls back to STANDARD items, granting no specialist item',
    nonArrays.every((json) => eq(parseInventory(json), [...STANDARD_EQUIPMENT_ITEMS])
      && SPECIALIST_EQUIPMENT_ITEMS.every((i) => !parseInventory(json).includes(i))),
    nonArrays.join(' '));
  check('DEFAULT_PROFILE grants no specialist equipment',
    SPECIALIST_EQUIPMENT_ITEMS.every((i) => !DEFAULT_PROFILE.equipment_inventory.includes(i))
      && eq(DEFAULT_PROFILE.equipment_inventory, [...STANDARD_EQUIPMENT_ITEMS]));
  check('the full_gym preset grants no specialist equipment',
    eq(EQUIPMENT_PRESETS.full_gym, STANDARD_EQUIPMENT_ITEMS));
  check('no preset anywhere grants specialist equipment',
    Object.values(EQUIPMENT_PRESETS).every((bundle) =>
      SPECIALIST_EQUIPMENT_ITEMS.every((i) => !bundle.includes(i))));
  check('unknown persisted items are dropped rather than carried into the CHECK domain',
    eq(parseInventory(JSON.stringify(['sled', 'boards', 'mats'])), ['mats', 'boards']));

  // --- the two REAL persistence boundaries, driven through live SQLite -------
  // These write to athlete_profile / profile_slot and read back out, so the
  // claim being proved is "survives persistence", not "the parser is a
  // function". The helpers below are the exact ones useStore calls at
  // profileFromRow / profileToJsonString / profileFromJsonString; the
  // source-text guards afterwards keep the test from drifting off production.
  const CANONICAL_WITH_BOARDS = ['barbell', 'bands', 'boards'];
  const hydrateProfileRow = (cell) => {
    db.exec('BEGIN');
    db.prepare('UPDATE athlete_profile SET equipment_inventory = ? WHERE profile_id = 1').run(cell);
    const row = db.prepare('SELECT equipment_inventory FROM athlete_profile WHERE profile_id = 1').get();
    db.exec('ROLLBACK');
    return inventoryFromRowCell(row.equipment_inventory, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS);
  };
  const slotRoundTrip = (inventory) => {
    // SAVE: exactly what profileToJsonString writes into profile_slot.profile_json.
    const snapshot = JSON.stringify({
      objective: 'gpp', training_age: 'intermediate', weekly_frequency: 4,
      max_sessions_per_day: 1, session_duration_cap_min: 90, base_rpe_cap: 9.0,
      target_energy_system: 'hybrid', progression_methodology: 'autoregulated',
      injury_flags: [], mobility_limits: [],
      equipment_inventory: inventoryToSnapshot(inventory),
    });
    db.exec('BEGIN');
    db.prepare('UPDATE profile_slot SET profile_json = ?, updated_at_ms = ? WHERE slot_id = 1')
      .run(snapshot, 1);
    // LOAD: read the row back and parse it as profileFromJsonString does.
    const row = db.prepare('SELECT profile_json FROM profile_slot WHERE slot_id = 1').get();
    db.exec('ROLLBACK');
    const parsed = JSON.parse(row.profile_json);
    return inventoryFromSnapshot(parsed.equipment_inventory, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS);
  };

  const hydrated = hydrateProfileRow(JSON.stringify(['boards', 'bands', 'barbell']));
  check('an explicit boards selection survives athlete_profile hydration, in canonical order',
    eq(hydrated, CANONICAL_WITH_BOARDS), JSON.stringify(hydrated));
  const slotted = slotRoundTrip(CANONICAL_WITH_BOARDS);
  check('an explicit boards selection survives a real profile_slot save then load',
    eq(slotted, CANONICAL_WITH_BOARDS), JSON.stringify(slotted));
  check('the slot round trip preserves canonical order even when saved out of order',
    eq(slotRoundTrip(['boards', 'barbell', 'bands']), CANONICAL_WITH_BOARDS));
  check('boards survives a profile_slot -> athlete_profile -> profile_slot cycle',
    eq(slotRoundTrip(hydrateProfileRow(JSON.stringify(slotRoundTrip(CANONICAL_WITH_BOARDS)))),
      CANONICAL_WITH_BOARDS));
  check('an empty inventory stays empty across BOTH boundaries, never repopulated',
    eq(hydrateProfileRow('[]'), []) && eq(slotRoundTrip([]), []));
  // Damage at either boundary must recover to STANDARD only — no boards.
  // The 007 column CHECK is the first line: json_valid() means a non-JSON cell
  // can never be STORED, so the parser's malformed-JSON branch is defence in
  // depth for values that predate the CHECK or arrive by direct edit. The
  // reachable damage through SQL is "valid JSON that is not an array".
  let nonJsonRejected = false;
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE athlete_profile SET equipment_inventory = ? WHERE profile_id = 1').run('{not json');
  } catch { nonJsonRejected = true; }
  db.exec('ROLLBACK');
  check('007 json_valid CHECK refuses to store a non-JSON inventory cell at all', nonJsonRejected);
  check('the parser still fails closed if a non-JSON cell ever reaches it (defence in depth)',
    eq(parseInventory('{not json'), [...STANDARD_EQUIPMENT_ITEMS]));
  const storableDamage = ['{}', '"x"', '7', 'null', '{"boards":true}', '{"0":"boards"}'];
  check('a storable non-array athlete_profile cell hydrates to STANDARD items and grants no boards',
    storableDamage.every((cell) => eq(hydrateProfileRow(cell), [...STANDARD_EQUIPMENT_ITEMS])),
    storableDamage.join(' '));
  // Two distinct slot-damage shapes, with deliberately different results —
  // both fail closed, one strictly harder than the other:
  //   ABSENT  (missing key / null)  -> [] via the `?? []` coercion. "Own
  //                                    nothing" is the strictest outcome there
  //                                    is, so this is safe by construction.
  //   PRESENT but not an array      -> the STANDARD recovery set. This was the
  //                                    live hole: it used to return the FULL
  //                                    union and would now have granted boards.
  const loadSnapshot = (value) =>
    inventoryFromSnapshot(value, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS);
  check('an absent or null profile_slot inventory loads to the empty set, not a granted default',
    [undefined, null].every((value) => eq(loadSnapshot(value), [])));
  const nonArraySnapshots = [{}, 'boards', 7, { boards: true }, true];
  check('a present-but-non-array profile_slot inventory loads to STANDARD items',
    nonArraySnapshots.every((value) => eq(loadSnapshot(value), [...STANDARD_EQUIPMENT_ITEMS])),
    JSON.stringify(nonArraySnapshots));
  check('NO damaged profile_slot inventory shape grants boards, whichever branch it takes',
    [undefined, null, ...nonArraySnapshots].every((value) =>
      SPECIALIST_EQUIPMENT_ITEMS.every((i) => !loadSnapshot(value).includes(i))));
  check('a slot whose JSON omits equipment_inventory entirely grants nothing at all', (() => {
    db.exec('BEGIN');
    db.prepare('UPDATE profile_slot SET profile_json = ? WHERE slot_id = 1')
      .run(JSON.stringify({ objective: 'gpp', training_age: 'elite' }));
    const row = db.prepare('SELECT profile_json FROM profile_slot WHERE slot_id = 1').get();
    db.exec('ROLLBACK');
    return eq(loadSnapshot(JSON.parse(row.profile_json).equipment_inventory), []);
  })());
  check('the snapshot writer COPIES the inventory (a later mutation cannot reach a saved slot)', (() => {
    const live = ['barbell', 'boards'];
    const saved = inventoryToSnapshot(live);
    live.push('mats');
    return eq(saved, ['barbell', 'boards']);
  })());
  // Production-drift guards: the helpers exercised above must be the ones the
  // store actually calls at each boundary.
  a('profileFromRow hydrates through inventoryFromRowCell',
    /inventoryFromRowCell\(json, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS\)/.test(src)
      && /equipment_inventory: parseInventory\(r\.equipment_inventory\)/.test(src));
  a('profileToJsonString saves through inventoryToSnapshot',
    /equipment_inventory: inventoryToSnapshot\(p\.equipment_inventory\)/.test(src));
  a('profileFromJsonString loads through inventoryFromSnapshot',
    /equipment_inventory: inventoryFromSnapshot\(\s*o\.equipment_inventory, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS,?\s*\)/.test(src));

  // SQL defaults are already standard-only and must stay that way as the union
  // widens — pinned here so nothing silently backfills a specialist item.
  const sql007 = readFileSync(join(SCHEMA_DIR, '007_program_engine.sql'), 'utf-8');
  const columnDefault = sql007.match(/equipment_inventory\s+TEXT NOT NULL DEFAULT\s+'(\[[^']+\])'/)?.[1];
  const legacyFullGym = sql007.match(/ELSE '(\[[^']+\])'/)?.[1];
  check('007 athlete_profile inventory default is exactly the STANDARD set',
    columnDefault === JSON.stringify(STANDARD_EQUIPMENT_ITEMS), String(columnDefault));
  check("007 legacy equipment_access 'full_gym' branch is exactly the STANDARD set",
    legacyFullGym === JSON.stringify(STANDARD_EQUIPMENT_ITEMS), String(legacyFullGym));

  // Live SQL proof: the persisted domain must ACCEPT a specialist item even
  // though nothing defaults to it — otherwise an explicit opt-in could never
  // be stored against a movement.
  const boardPress = db.prepare("SELECT movement_id FROM movement WHERE name = 'Board Press'").get();
  check('the persisted movement_equipment domain accepts the specialist item',
    Number(db.prepare('SELECT COUNT(*) AS c FROM movement_equipment WHERE movement_id = ? AND item = ?')
      .get(boardPress.movement_id, 'boards').c) === 1);
}

// --- [Calibration Policy v1: 21-Day Return Check-in] -------------------------
// The check-in is an ACKNOWLEDGEMENT prompt. Numerical return modifiers are
// deferred under the ratification, so the decisive assertions here are the
// negative ones: no modifier value, no dose write, no plan regeneration.
{
  console.log('[Calibration Policy v1: 21-Day Return Check-in]');
  check('useStore imports evaluateReturn from @ak/inference',
    /import \{[^}]*evaluateReturn[^}]*\} from '@ak\/inference'/.test(src));
  check('useStore defines returnCheckin state and the two ratified actions',
    /returnCheckin: ReturnCheckinState \| null/.test(src) &&
    /refreshReturnCheckin: \(\) => void/.test(src) &&
    /confirmReturnCheckin: \(action: ReturnAction\) => void/.test(src) &&
    /dismissReturnCheckin: \(\) => void/.test(src));
  check('useStore persists acknowledgements with INSERT OR IGNORE (one row per detected gap)',
    /INSERT OR IGNORE INTO return_checkin_ack\s*\n?\s*\(last_qualifying_date, acknowledged_action, acknowledged_at_ms\)/.test(src));
  check('useStore wipes return_checkin_ack in resetTrainingData',
    /DELETE FROM return_checkin_ack/.test(src));

  // Qualifying evidence = a session carrying at least one logged set OR eligible
  // imported history with sets. A bare session shell is not training evidence.
  check('the layoff gap is measured from local sessions WITH sets and verified imported history WITH sets',
    /SELECT MAX\(qualifying_date\) AS max_date FROM \(\s*SELECT s\.session_date AS qualifying_date FROM session s\s*WHERE EXISTS \(SELECT 1 FROM set_record r WHERE r\.session_id = s\.session_id\)\s*UNION ALL\s*SELECT his\.session_date AS qualifying_date FROM history_import_session his\s*JOIN history_import hi USING \(history_import_id\)\s*WHERE hi\.verified = 1\s*AND EXISTS \(SELECT 1 FROM history_import_set hiset WHERE hiset\.history_import_session_id = his\.history_import_session_id\)\s*\)/.test(src.replace(/\s+/g, ' ')));

  // Behavioral test: imported-only athlete within 21 days vs beyond 21 days, newer wins
  const testDb = new DatabaseSync(':memory:');
  for (const f of SCHEMA_FILES) {
    testDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }
  const qualQuery = `SELECT MAX(qualifying_date) AS max_date FROM (
    SELECT s.session_date AS qualifying_date FROM session s
      WHERE EXISTS (SELECT 1 FROM set_record r WHERE r.session_id = s.session_id)
    UNION ALL
    SELECT his.session_date AS qualifying_date FROM history_import_session his
      JOIN history_import hi USING (history_import_id)
      WHERE hi.verified = 1
        AND EXISTS (SELECT 1 FROM history_import_set hiset WHERE hiset.history_import_session_id = his.history_import_session_id)
  )`;

  // 1. Unverified import -> null
  testDb.prepare("INSERT INTO history_import (history_import_id, content_fingerprint, format_version, verified, readiness_eligible, created_at_ms) VALUES (1, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'AK_HISTORY_V1', 0, 0, 1000)").run();
  testDb.prepare("INSERT INTO history_import_session (history_import_session_id, history_import_id, source_ordinal, session_date, source_line) VALUES (1, 1, 1, '2026-07-10', 1)").run();
  testDb.prepare("INSERT INTO history_import_set (history_import_set_id, history_import_session_id, movement_id, set_index, reps, load_kg, source_line) VALUES (1, 1, 1, 1, 5, 100, 1)").run();
  check('unverified import is not qualifying evidence', testDb.prepare(qualQuery).get().max_date === null);

  // 2. Verified import -> qualifying date recognized
  testDb.prepare("UPDATE history_import SET verified = 1 WHERE history_import_id = 1").run();
  check('verified imported history is recognized as qualifying evidence',
    testDb.prepare(qualQuery).get().max_date === '2026-07-10');

  // 3. Local session older than imported -> imported (newer) wins
  testDb.prepare("INSERT INTO session (session_id, session_date) VALUES (101, '2026-06-01')").run();
  testDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, logged_at_ms) VALUES (201, 101, 1, 1, 5, 80, 1000)").run();
  check('imported history newer than local session wins',
    testDb.prepare(qualQuery).get().max_date === '2026-07-10');

  // 4. Local session newer than imported -> local wins
  testDb.prepare("INSERT INTO session (session_id, session_date) VALUES (102, '2026-07-14')").run();
  testDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, logged_at_ms) VALUES (202, 102, 1, 1, 5, 85, 2000)").run();
  check('local session newer than imported history wins',
    testDb.prepare(qualQuery).get().max_date === '2026-07-14');

  // NEGATIVE INVARIANTS — the ratification forbids an automatic dose change.
  const confirmFn = stripComments((() => {
    const i = src.indexOf('confirmReturnCheckin: (action)');
    const j = src.indexOf('dismissReturnCheckin: () => {', i);
    return i >= 0 && j > i ? src.slice(i, j) : '';
  })());
  check('confirmReturnCheckin body was located for the negative invariants', confirmFn.length > 0);
  check('NO return modifier constant exists anywhere in the store',
    !/week1LoadMultiplier|week1RpeCap|FRESH_BLOCK_MODIFIER/.test(src));
  check('acknowledging NEVER regenerates the block', !/generateNewBlock\(/.test(confirmFn));
  check('acknowledging writes ONLY the ack ledger (no dose or plan table)',
    [...confirmFn.matchAll(/(?:INSERT(?:\s+OR\s+IGNORE)?\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/gi)]
      .every((m) => m[1] === 'return_checkin_ack'));
  check('generateNewBlock takes no dose-modifier parameter',
    /generateNewBlock: \(schemaType\?: SchemaType\) => void/.test(src)
    && /generateNewBlock: \(schemaType = 'LINEAR'\) => \{/.test(src));

  db.prepare(`
    INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-07-01', 'review_first_session', ?)
  `).run(Date.now());
  const ackRow = db.prepare(
    "SELECT * FROM return_checkin_ack WHERE last_qualifying_date = '2026-07-01'").get();
  check('return_checkin_ack inserts and selects correctly',
    ackRow !== undefined && ackRow.acknowledged_action === 'review_first_session');

  // INSERT OR IGNORE keyed on the qualifying date is what suppresses a re-prompt
  // for the SAME detected gap.
  db.prepare(`
    INSERT OR IGNORE INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-07-01', 'continue_plan', ?)
  `).run(Date.now());
  const ackCount = db.prepare(
    "SELECT COUNT(*) AS c FROM return_checkin_ack WHERE last_qualifying_date = '2026-07-01'").get().c;
  check('a second acknowledgement for the same gap is ignored, not duplicated',
    Number(ackCount) === 1, `${ackCount} rows`);

  // --- Step 4b: Athlete Isolation Test with Per-Athlete DB Files ------------
  const isoDir = mkdtempSync(join(tmpdir(), 'ak-athlete-isolation-'));
  const fileA = join(isoDir, 'athlete_a.db');
  const fileB = join(isoDir, 'athlete_b.db');
  const dbAthleteA = new DatabaseSync(fileA);
  const dbAthleteB = new DatabaseSync(fileB);
  for (const f of SCHEMA_FILES) {
    const sql = readFileSync(join(SCHEMA_DIR, f), 'utf-8');
    dbAthleteA.exec(sql);
    dbAthleteB.exec(sql);
  }
  dbAthleteA.prepare(`
    INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-06-01', 'continue_plan', 12345)
  `).run();
  dbAthleteB.prepare(`
    INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-05-15', 'review_first_session', 99999)
  `).run();

  const ackA = dbAthleteA.prepare("SELECT COUNT(*) AS c FROM return_checkin_ack").get().c;
  const ackB = dbAthleteB.prepare("SELECT COUNT(*) AS c FROM return_checkin_ack").get().c;
  check('athlete isolation: separate database files hold independent acknowledgements',
    Number(ackA) === 1 && Number(ackB) === 1);

  // Execute resetTrainingData on Athlete A only
  for (const t of resetTables) {
    dbAthleteA.prepare(`DELETE FROM ${t}`).run();
  }
  const ackAAfterReset = dbAthleteA.prepare("SELECT COUNT(*) AS c FROM return_checkin_ack").get().c;
  const ackBAfterReset = dbAthleteB.prepare("SELECT COUNT(*) AS c FROM return_checkin_ack").get().c;
  check('athlete isolation: resetTrainingData on Athlete A wipes A and does NOT touch Athlete B',
    Number(ackAAfterReset) === 0 && Number(ackBAfterReset) === 1);

  dbAthleteA.close();
  dbAthleteB.close();
  rmSync(isoDir, { recursive: true, force: true });

  // --- Step 1: Retrospective SQL Signals & Trigger Threshold Invariants -----
  console.log('[Calibration Policy v1: Retrospective SQL Signals]');
  const retroDb = new DatabaseSync(':memory:');
  for (const f of SCHEMA_FILES) {
    retroDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }
  retroDb.prepare("INSERT INTO session (session_id, session_date) VALUES (1, '2026-07-15')").run();
  const sessRowBefore = retroDb.prepare("SELECT session_rpe FROM session WHERE session_id = 1").get();
  check('session.session_rpe is NULL on creation (never 0, never imputed)',
    sessRowBefore.session_rpe === null);

  // Set with NULL RPE
  retroDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (1, 1, 1, 1, 10, 50, NULL, 1000)").run();
  const mechNull = retroDb.prepare("SELECT hard_sets, reps_with_rpe, rpe_x_reps FROM mech_daily WHERE date = '2026-07-15'").get();
  check('set with NULL RPE yields hard_sets = 0, reps_with_rpe = 0',
    mechNull.hard_sets === 0 && mechNull.reps_with_rpe === 0 && mechNull.rpe_x_reps === 0);

  // Set with RPE 7.5 (< 8 threshold)
  retroDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (2, 1, 1, 2, 10, 50, 7.5, 2000)").run();
  const mech75 = retroDb.prepare("SELECT hard_sets, reps_with_rpe FROM mech_daily WHERE date = '2026-07-15'").get();
  check('set with RPE 7.5 (< 8) does NOT increment hard_sets',
    mech75.hard_sets === 0 && mech75.reps_with_rpe === 10);

  // Set with RPE 8.0 (>= 8 threshold)
  retroDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (3, 1, 1, 3, 10, 50, 8.0, 3000)").run();
  const mech80 = retroDb.prepare("SELECT hard_sets, reps_with_rpe FROM mech_daily WHERE date = '2026-07-15'").get();
  check('set with RPE 8.0 (>= 8) increments hard_sets to 1',
    mech80.hard_sets === 1 && mech80.reps_with_rpe === 20);

  // Set with RPE 9.5 (>= 8 threshold)
  retroDb.prepare("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (4, 1, 1, 4, 5, 60, 9.5, 4000)").run();
  const mech95 = retroDb.prepare("SELECT hard_sets, reps_with_rpe FROM mech_daily WHERE date = '2026-07-15'").get();
  check('set with RPE 9.5 increments hard_sets to 2',
    mech95.hard_sets === 2 && mech95.reps_with_rpe === 25);
}

console.log(`verify:store SQL — ${pass}/${pass + fail} checks green`);
process.exit(fail ? 1 : 0);
