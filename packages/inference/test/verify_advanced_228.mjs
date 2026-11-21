/**
 * Fail-first verification suite for Phase 2 #228 (Advanced Athlete Control)
 * + Owner A7 (Introductory Week 1 on new movement patterns).
 *
 * Covers:
 *   - Q2: extended session foci ('push', 'pull', 'legs', 'accessories')
 *   - Q3: explicit Mon–Sun ISO weekdays (1 = Mon .. 7 = Sun) chronological placement
 *   - Q1: intermediate/advanced/elite slot dose edits + routine-day assignment + MRV_p precedence
 *   - A7: Introductory Week 1 (2 sets, RPE <= 7.0) on unlogged patterns for intermediate+
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DEFAULT_PROFILE, MOVEMENT_PATTERNS } = require('./.build/types.js');
const {
  BLOCK_FOCUS_LIST,
  INTRO_WEEK_SESSIONS_BY_AGE,
  INTRODUCTORY_WEEK1_NOTE,
  accessContextForBlockFocus,
  generateBlock,
} = require('./.build/blockGenerator.js');

const MOVEMENTS = MOVEMENT_PATTERNS.map((pattern, index) => ({
  movement_id: index + 1,
  name: `M228 ${pattern}`,
  pattern,
  is_compound: !['isolation', 'rotation'].includes(pattern),
  required: [],
  difficulty: 'Beginner',
  beginner_ok: true,
  sportTracking: false,
  capability_available_weight_room: true,
  capability_available_sport_conditioning: true,
}));

const EXTRA_SQUAT = {
  movement_id: 901,
  name: 'Front Squat Var',
  pattern: 'squat',
  is_compound: true,
  required: [],
  difficulty: 'Intermediate',
  beginner_ok: true,
  sportTracking: false,
  capability_available_weight_room: true,
  capability_available_sport_conditioning: true,
};

const ALL_MOVEMENTS = [...MOVEMENTS, EXTRA_SQUAT];

const profileFor = (training_age = 'advanced', overrides = {}) => ({
  ...DEFAULT_PROFILE,
  objective: 'strength',
  training_age,
  weekly_frequency: 3,
  session_duration_cap_min: 90,
  base_rpe_cap: 9.0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Q2: extended session foci (push, pull, legs, accessories)
// ---------------------------------------------------------------------------
{
  for (const focus of ['push', 'pull', 'legs', 'accessories']) {
    assert.ok(
      BLOCK_FOCUS_LIST.includes(focus),
      `Q2: BLOCK_FOCUS_LIST must include '${focus}'`,
    );
    assert.equal(
      accessContextForBlockFocus(focus),
      'weight_room',
      `Q2: accessContextForBlockFocus('${focus}') must be 'weight_room'`,
    );
  }

  const plan = generateBlock({
    profile: profileFor('advanced', { objective: 'hypertrophy', weekly_frequency: 4 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16', // Monday
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'push' },
      { day_index: 2, focus: 'pull' },
      { day_index: 4, focus: 'legs' },
      { day_index: 5, focus: 'accessories' },
    ],
  });

  const w1 = plan.sessions.filter((s) => s.week_index === 1);
  assert.equal(w1.length, 4, 'Q2: all 4 extended-focus sessions generated in Week 1');
  const patternOf = (id) => ALL_MOVEMENTS.find((m) => m.movement_id === id)?.pattern;
  assert.deepEqual(
    w1.find((s) => s.focus === 'push')?.slots.map((sl) => patternOf(sl.movement_id)),
    ['push_h', 'push_v', 'isolation'],
    'Q2: push focus patterns must be [push_h, push_v, isolation]',
  );
  assert.deepEqual(
    w1.find((s) => s.focus === 'pull')?.slots.map((sl) => patternOf(sl.movement_id)),
    ['pull_h', 'pull_v', 'isolation'],
    'Q2: pull focus patterns must be [pull_h, pull_v, isolation]',
  );
  assert.deepEqual(
    w1.find((s) => s.focus === 'legs')?.slots.map((sl) => patternOf(sl.movement_id)),
    ['squat', 'hinge', 'lunge', 'isolation'],
    'Q2: legs focus patterns must be [squat, hinge, lunge, isolation]',
  );
  assert.deepEqual(
    w1.find((s) => s.focus === 'accessories')?.slots.map((sl) => patternOf(sl.movement_id)),
    ['isolation', 'carry', 'rotation'],
    'Q2: accessories focus patterns must be [isolation, carry, rotation]',
  );

  // Strength damping (hybrid) applies to push/pull/legs and NOT accessories
  const hybridLegsAndAcc = generateBlock({
    profile: profileFor('advanced', { objective: 'hybrid', weekly_frequency: 2 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'legs' },
      { day_index: 3, focus: 'accessories' },
    ],
  });
  const pureGppLegsAndAcc = generateBlock({
    profile: profileFor('advanced', { objective: 'gpp', weekly_frequency: 2 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'legs' },
      { day_index: 3, focus: 'accessories' },
    ],
  });
  // Accessories are outside STRENGTH_FOCI, so legs receives hybrid accessory cut if high fatigue, accessories never tagged strength.
  assert.equal(hybridLegsAndAcc.sessions.filter((s) => s.week_index === 1).length, 2);
  assert.equal(pureGppLegsAndAcc.sessions.filter((s) => s.week_index === 1).length, 2);
}

// ---------------------------------------------------------------------------
// Q3: explicit Mon–Sun ISO weekdays chronological placement
// ---------------------------------------------------------------------------
{
  // Wednesday 2026-11-18 -> startIsoWeekday = 3. Selected Mon(1), Wed(3), Fri(5).
  // Week 1 must order chronologically: Wed 2026-11-18 (day 3), Fri 2026-11-20 (day 5), Mon 2026-11-23 (day 1).
  const plan = generateBlock({
    profile: profileFor('advanced', { weekly_frequency: 3 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-18',
    schemaType: 'LINEAR',
    scheduleMode: 'iso_weekday',
    programDays: [
      { day_index: 1, focus: 'lower' },
      { day_index: 3, focus: 'upper' },
      { day_index: 5, focus: 'full' },
    ],
  });

  // Omitting scheduleMode preserves relative_day_index scheduling (day 1 lands on startDate).
  const relativeDefault = generateBlock({
    profile: profileFor('advanced', { weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-18',
    schemaType: 'LINEAR',
  });
  assert.equal(relativeDefault.sessions[0].session_date, '2026-11-18',
    'omitted scheduleMode preserves relative day-1 offset on Wednesday startDate');

  const w1 = plan.sessions.filter((s) => s.week_index === 1);
  assert.deepEqual(
    w1.map((s) => ({ day: s.day_index, date: s.session_date, focus: s.focus })),
    [
      { day: 3, date: '2026-11-18', focus: 'upper' },
      { day: 5, date: '2026-11-20', focus: 'full' },
      { day: 1, date: '2026-11-23', focus: 'lower' },
    ],
    'Q3: ISO weekdays must land on exact Mon/Wed/Fri calendar dates within [startDate .. startDate + 6]',
  );

  // Verify every session across all 4 weeks lands on its exact ISO weekday
  for (const s of plan.sessions) {
    assert.ok(s.session_date >= '2026-11-18', 'Q3: no session may precede startDate');
    const utcDay = new Date(`${s.session_date}T00:00:00Z`).getUTCDay();
    const iso = utcDay === 0 ? 7 : utcDay;
    assert.equal(iso, s.day_index, `Q3: ${s.session_date} must match ISO weekday ${s.day_index}`);
  }
}

// ---------------------------------------------------------------------------
// Q1: MRV_p precedence, slot dose overrides [1..10]/[1..30], and routine days
// ---------------------------------------------------------------------------
{
  const squatId = ALL_MOVEMENTS.find((m) => m.pattern === 'squat').movement_id;
  const benchId = ALL_MOVEMENTS.find((m) => m.pattern === 'push_h').movement_id;

  // 1) Coach-build clamps sets to patternMrvSets[p] without emitting override note
  const coachClamped = generateBlock({
    profile: profileFor('advanced', { objective: 'power', weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [{ day_index: 1, focus: 'legs' }],
    longitudinalControl: {
      patternMrvSets: { squat: 2 },
    },
  });
  const coachW1Squat = coachClamped.sessions.find((s) => s.week_index === 1).slots[0];
  assert.equal(coachW1Squat.sets, 2, 'Q1: coach-build must clamp slot sets to patternMrvSets[squat] = 2');
  assert.equal(
    (coachClamped.coachNotes ?? []).some((n) => n.includes('recovery ceiling')),
    false,
    'Q1: coach-build clamp must not emit athlete recovery-ceiling warning',
  );

  // 2) Explicit athlete Customize edit raises above MRV up to [1, 10] and emits exact note
  const athleteRaised = generateBlock({
    profile: profileFor('advanced', { objective: 'strength', weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      {
        day_index: 1,
        focus: 'legs',
        slot_overrides: [{ slot_index: 1, sets: 6, reps: 12, target_rpe: 8.5 }],
      },
    ],
    longitudinalControl: {
      patternMrvSets: { squat: 3 },
    },
  });
  for (const w of [1, 2, 3]) {
    const slot = athleteRaised.sessions.find((s) => s.week_index === w).slots[0];
    assert.deepEqual(
      { sets: slot.sets, reps: slot.reps, target_rpe: slot.target_rpe },
      { sets: 6, reps: 12, target_rpe: 8.5 },
      `Q1: Week ${w} must honour explicit Customize dose override above MRV=3`,
    );
  }
  const w4DeloadSlot = athleteRaised.sessions.find((s) => s.week_index === 4).slots[0];
  assert.ok(w4DeloadSlot.sets < 6, 'Q1: Week 4 deload must remain coach-scaled down');
  assert.ok(
    (athleteRaised.coachNotes ?? []).includes('Above your recent recovery ceiling of 3 sets.'),
    'Q1: must emit exact non-blocking MRV ceiling note when sets > patternMrvSets[p]',
  );

  // 3) Out-of-bounds [1, 10] set edit rejected or clamped; beginner edits rejected/ignored
  assert.throws(() => generateBlock({
    profile: profileFor('advanced', { weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    programDays: [{ day_index: 1, focus: 'legs', slot_overrides: [{ slot_index: 1, sets: 11 }] }],
  }), /1.*10|sets/i, 'Q1: sets > 10 must be rejected');

  assert.throws(() => generateBlock({
    profile: profileFor('beginner', { weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    programDays: [{ day_index: 1, focus: 'legs', slot_overrides: [{ slot_index: 1, sets: 6 }] }],
  }), /beginner/i, 'Q1: beginner must not accept athlete dose overrides');

  // 4) Assigned routine day replaces generated slots across Weeks 1-3, scales Week 4 deload
  const routinePlan = generateBlock({
    profile: profileFor('intermediate', { weekly_frequency: 1 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    programDays: [
      {
        day_index: 1,
        focus: 'upper',
        routine_assignment: {
          routine_template_id: 42,
          routine_day_index: 2,
          routine_name: 'Bench Specialization',
          slots: [
            { slot_index: 1, movement_id: benchId, sets: 7, reps: 4, target_rpe: 8.5 },
            { slot_index: 2, movement_id: squatId, sets: 3, reps: 6, target_rpe: 7.5 },
          ],
        },
      },
    ],
    longitudinalControl: {
      patternMrvSets: { push_h: 5 },
    },
  });
  for (const w of [1, 2, 3]) {
    const s = routinePlan.sessions.find((item) => item.week_index === w);
    assert.deepEqual(
      s.slots.map((sl) => ({ idx: sl.slot_index, id: sl.movement_id, sets: sl.sets, reps: sl.reps, rpe: sl.target_rpe })),
      [
        { idx: 1, id: benchId, sets: 7, reps: 4, rpe: 8.5 },
        { idx: 2, id: squatId, sets: 3, reps: 6, rpe: 7.5 },
      ],
      `Q1: routine day slots preserved on Week ${w}`,
    );
  }
  const routineW4 = routinePlan.sessions.find((item) => item.week_index === 4);
  assert.ok(routineW4.slots[0].sets < 7, 'Q1: Week 4 deload on routine day remains coach-scaled down');
  assert.ok(
    (routinePlan.coachNotes ?? []).includes('Above your recent recovery ceiling of 5 sets.'),
    'Q1: assigned routine slot exceeding MRV emits exact ceiling note',
  );
}

// ---------------------------------------------------------------------------
// #53: Simplified Linear Introductory Week 1 (session lower bound + -1 set / RPE<=7)
// ---------------------------------------------------------------------------
{
  assert.deepEqual(
    INTRO_WEEK_SESSIONS_BY_AGE,
    { beginner: 2, intermediate: 3, advanced: 4, elite: 5 },
    '#53: tier lower bounds must match { beginner: 2, intermediate: 3, advanced: 4, elite: 5 }',
  );
  assert.equal(
    INTRODUCTORY_WEEK1_NOTE,
    'Week 1 is an introductory week with lighter volume to gauge your work capacity before stepping up in Weeks 2 and 3.',
    '#53: exact ratified INTRODUCTORY_WEEK1_NOTE text',
  );

  // Bare generateBlock without introductoryWeek1 keeps all scheduled days & normal Week 1 dose
  const bareArgs = {
    profile: profileFor('intermediate', { objective: 'strength', weekly_frequency: 4 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'lower' },
      { day_index: 2, focus: 'upper' },
      { day_index: 4, focus: 'lower' },
      { day_index: 6, focus: 'upper' },
    ],
  };
  const barePlan = generateBlock(bareArgs);
  assert.equal(
    barePlan.sessions.filter((s) => s.week_index === 1).length,
    4,
    '#53: bare generateBlock without introductoryWeek1 keeps all 4 scheduled Week 1 sessions',
  );
  assert.equal(
    (barePlan.coachNotes ?? []).includes(INTRODUCTORY_WEEK1_NOTE),
    false,
    '#53: bare generateBlock without introductoryWeek1 does not emit intro note',
  );

  // Block 1 (introductoryWeek1: true) for intermediate (cap = 3) with 4 scheduled days:
  // Week 1 runs first 3 chronological days + (-1 set floored at 2) & RPE <= 7.0; Weeks 2-3 step up to 4 days + full sets.
  const introPlan = generateBlock({
    ...bareArgs,
    longitudinalControl: { introductoryWeek1: true },
  });
  const introW1 = introPlan.sessions.filter((s) => s.week_index === 1);
  const introW2 = introPlan.sessions.filter((s) => s.week_index === 2);
  const introW3 = introPlan.sessions.filter((s) => s.week_index === 3);
  assert.deepEqual(
    introW1.map((s) => s.day_index),
    [1, 2, 4],
    '#53: intermediate 4-day keeps first 3 chronological sessions [1, 2, 4] in Week 1',
  );
  assert.deepEqual(
    introW2.map((s) => s.day_index),
    [1, 2, 4, 6],
    '#53: Week 2 steps linearly up to all 4 scheduled sessions',
  );
  assert.deepEqual(
    introW3.map((s) => s.day_index),
    [1, 2, 4, 6],
    '#53: Week 3 includes all 4 scheduled sessions',
  );
  assert.equal(
    introW1[0].slots[0].sets,
    Math.max(2, barePlan.sessions[0].slots[0].sets - 1),
    '#53: Week 1 non-locomotion coach slot applies Math.max(2, sets - 1)',
  );
  assert.ok(
    introW1.every((s) => s.slots.every((sl) => sl.target_rpe <= 7.0)),
    '#53: Week 1 non-overridden slots cap target_rpe at 7.0',
  );
  assert.equal(
    introW2[0].slots[0].sets,
    barePlan.sessions.find((s) => s.week_index === 2 && s.day_index === 1).slots[0].sets,
    '#53: Week 2 resumes full scheduled working sets',
  );
  assert.ok(
    (introPlan.coachNotes ?? []).includes(INTRODUCTORY_WEEK1_NOTE),
    '#53: Block 1 with introductoryWeek1 emits exact INTRODUCTORY_WEEK1_NOTE',
  );

  // Scheduled <= tier lower bound keeps all scheduled days in Week 1 while still applying lighter Week 1 slot volume
  const adv4Day = generateBlock({
    profile: profileFor('advanced', { objective: 'strength', weekly_frequency: 4 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'lower' },
      { day_index: 2, focus: 'upper' },
      { day_index: 4, focus: 'legs' },
      { day_index: 5, focus: 'push' },
    ],
    longitudinalControl: { introductoryWeek1: true },
  });
  assert.equal(
    adv4Day.sessions.filter((s) => s.week_index === 1).length,
    4,
    '#53: advanced with 4 days (<= cap 4) keeps all 4 sessions in Week 1',
  );
  assert.ok(
    (adv4Day.coachNotes ?? []).includes(INTRODUCTORY_WEEK1_NOTE),
    '#53: lighter Week 1 slot volume emits INTRODUCTORY_WEEK1_NOTE even when session count <= cap',
  );

  // Explicit Customize override on extra day (> cap) keeps that extra day in Week 1 and honors edited slot dose
  const extraDayCustomized = generateBlock({
    profile: profileFor('beginner', { objective: 'strength', weekly_frequency: 3 }),
    movements: ALL_MOVEMENTS,
    startDate: '2026-11-16',
    schemaType: 'LINEAR',
    programDays: [
      { day_index: 1, focus: 'lower' },
      { day_index: 3, focus: 'upper' },
      {
        day_index: 5,
        focus: 'full',
        movement_preferences: [{ day_index: 5, slot_index: 1, pattern: 'squat', movement_id: EXTRA_SQUAT.movement_id }],
      },
    ],
    longitudinalControl: { introductoryWeek1: true },
  });
  assert.deepEqual(
    extraDayCustomized.sessions.filter((s) => s.week_index === 1).map((s) => s.day_index),
    [1, 3, 5],
    '#53: extra day beyond beginner cap (2) stays in Week 1 when athlete explicitly customized it',
  );
}

console.log('verify_advanced_228: all checks verified.');
