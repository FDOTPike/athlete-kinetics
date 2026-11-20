import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const blockGen = require('./.build/blockGenerator.js');
const sport = require('./.build/sportProfile.js');
const emphasis = require('./.build/programEmphasis.js');
const { DEFAULT_PROFILE } = require('./.build/types.js');
const { applyPrescriptionToSlot } = require('./.build/derivePrescription.js');

const { generateBlock } = blockGen;

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
};

// Minimal complete movement library supporting BB & Bodyweight + all 11 patterns.
const FULL_MOVEMENTS = [
  { movement_id: 1, name: 'Barbell Back Squat', pattern: 'squat', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 2, name: 'Barbell Bench Press', pattern: 'push_h', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 3, name: 'Barbell Deadlift', pattern: 'hinge', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 4, name: 'Barbell Overhead Press', pattern: 'push_v', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 5, name: 'Barbell Bent-Over Row', pattern: 'pull_h', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 6, name: 'Pull-Up', pattern: 'pull_v', is_compound: true, required: ['pullup_bar'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Bodyweight' },
  { movement_id: 7, name: 'Barbell Split Squat', pattern: 'lunge', is_compound: true, required: ['barbell'], difficulty: 'Intermediate', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'BB' },
  { movement_id: 8, name: 'Dumbbell Biceps Curl', pattern: 'isolation', is_compound: false, required: ['dumbbells'], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'DB' },
  { movement_id: 9, name: 'Farmer Carry', pattern: 'carry', is_compound: true, required: ['dumbbells'], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'DB' },
  { movement_id: 10, name: 'Cable Woodchop', pattern: 'rotation', is_compound: true, required: ['cables'], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Cable' },
  { movement_id: 11, name: 'Sled Push', pattern: 'locomotion', is_compound: true, required: ['sled'], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Machine' },
  { movement_id: 12, name: 'Air Squat', pattern: 'squat', is_compound: true, required: [], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Bodyweight' },
  { movement_id: 13, name: 'Push-Up', pattern: 'push_h', is_compound: true, required: [], difficulty: 'Beginner', beginner_ok: true, sportTracking: false, capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Bodyweight' },
];

const mkProfile = (over = {}) => ({
  ...DEFAULT_PROFILE,
  objective: 'strength',
  training_age: 'intermediate',
  weekly_frequency: 4,
  session_duration_cap_min: 90,
  equipment_inventory: ['barbell', 'dumbbells', 'pullup_bar', 'cables', 'sled'],
  ...over,
});

const mkInput = (over = {}) => ({
  profile: mkProfile(over.profile),
  startDate: '2026-08-03',
  macroBlockIndex: 1,
  movements: FULL_MOVEMENTS,
  schemaType: 'LINEAR',
  ...over,
});

const slotsInWeek = (block, week, filterFn = () => true) =>
  block.sessions
    .filter((s) => s.week_index === week)
    .flatMap((s) => s.slots.map((sl) => {
      const mv = FULL_MOVEMENTS.find((m) => m.movement_id === sl.movement_id);
      return {
        ...sl,
        pattern: mv?.pattern,
        plannedImplement: mv?.plannedImplement,
      };
    }))
    .filter(filterFn);

const toTodaySlot = (sl) => ({
  plannedSlotId: sl.slot_index,
  slotIndex: sl.slot_index,
  movementId: sl.movement_id,
  movementName: FULL_MOVEMENTS.find((m) => m.movement_id === sl.movement_id)?.name ?? 'Movement',
  sets: sl.sets,
  target: { kind: 'reps', reps: sl.reps },
  targetRpe: sl.target_rpe,
  ...(sl.backOff !== undefined ? { backOff: sl.backOff } : {}),
});

console.log('[Phase2 #219 Q1A / Q4] Strength 5->4->3, accessories 8->8->6, Deadlift back-offs (-7.5%), volume ceiling');
{
  const gpp = generateBlock(mkInput({ macroBlockIndex: 1 }));
  assert.ok(gpp.sessions.length > 0, 'baseline block must produce sessions');

  const w1Sq = slotsInWeek(gpp, 1, (s) => s.pattern === 'squat' && s.slot_index < 3);
  const w2Sq = slotsInWeek(gpp, 2, (s) => s.pattern === 'squat' && s.slot_index < 3);
  const w3Sq = slotsInWeek(gpp, 3, (s) => s.pattern === 'squat' && s.slot_index < 3);
  const w4Sq = slotsInWeek(gpp, 4, (s) => s.pattern === 'squat' && s.slot_index < 3);
  check('weighted primary squat reps step 5 -> 4 -> 3',
    w1Sq.length > 0 && w1Sq.every((s) => s.reps === 5)
      && w2Sq.every((s) => s.reps === 4)
      && w3Sq.every((s) => s.reps === 3),
    `w1=${w1Sq[0]?.reps} w2=${w2Sq[0]?.reps} w3=${w3Sq[0]?.reps}`);

  check('weighted primary strength RPE steps +0.5/week up to base_rpe_cap (w4 deload lower)',
    w1Sq.length > 0
      && w2Sq[0].target_rpe - w1Sq[0].target_rpe === 0.5
      && w3Sq[0].target_rpe - w2Sq[0].target_rpe === 0.5
      && w4Sq[0].target_rpe < w1Sq[0].target_rpe,
    `rpe=[${w1Sq[0]?.target_rpe}, ${w2Sq[0]?.target_rpe}, ${w3Sq[0]?.target_rpe}, w4=${w4Sq[0]?.target_rpe}]`);

  const w1Acc = slotsInWeek(gpp, 1, (s) => s.slot_index >= 3 && s.plannedImplement !== 'Bodyweight');
  const w2Acc = slotsInWeek(gpp, 2, (s) => s.slot_index >= 3 && s.plannedImplement !== 'Bodyweight');
  const w3Acc = slotsInWeek(gpp, 3, (s) => s.slot_index >= 3 && s.plannedImplement !== 'Bodyweight');
  check('strength accessory slots step 8 -> 8 -> 6',
    w1Acc.length > 0 && w1Acc.every((s) => s.reps === 8)
      && w2Acc.every((s) => s.reps === 8)
      && w3Acc.every((s) => s.reps === 6),
    `acc=[${w1Acc[0]?.reps}, ${w2Acc[0]?.reps}, ${w3Acc[0]?.reps}]`);

  // Deadlift (hinge primary, non-single): 1 top set (5->4->3) + 2x5 @ -7.5% (0.925), max 3 sets.
  const w1Dl = slotsInWeek(gpp, 1, (s) => s.pattern === 'hinge' && s.slot_index < 3);
  const w2Dl = slotsInWeek(gpp, 2, (s) => s.pattern === 'hinge' && s.slot_index < 3);
  const w3Dl = slotsInWeek(gpp, 3, (s) => s.pattern === 'hinge' && s.slot_index < 3);
  check('deadlift primary prescribes 1 top set (5->4->3) + 2x5 @ -7.5% (max 3 sets)',
    w1Dl.length > 0 && w1Dl[0].sets === 3 && w1Dl[0].reps === 5
      && w2Dl[0].sets === 3 && w2Dl[0].reps === 4
      && w3Dl[0].sets === 3 && w3Dl[0].reps === 3
      && w1Dl[0].backOff?.sets === 2 && w1Dl[0].backOff?.reps === 5
      && Math.abs((w1Dl[0].backOff?.loadMultiplier ?? 0) - 0.925) < 1e-6
      && w1Dl[0].backOff?.targetRpe === Math.max(5.0, w1Dl[0].target_rpe - 0.5),
    JSON.stringify(w1Dl[0]?.backOff));

  // #219 Q4 (B): high session_duration_cap_min keeps 3-4 movements / <= 15 sets.
  const longSession = generateBlock(mkInput({
    profile: mkProfile({ session_duration_cap_min: 120 }),
    macroBlockIndex: 1,
  }));
  const week1Long = longSession.sessions.filter((s) => s.week_index === 1);
  check('120-min duration cap keeps 3-4 movements and <= 15 sets per session',
    week1Long.length === 4 && week1Long.every((s) => s.slots.length >= 3 && s.slots.length <= 4 && s.slots.reduce((a, sl) => a + sl.sets, 0) <= 15),
    `slots=${week1Long.map((s) => `${s.slots.length}/${s.slots.reduce((a, sl) => a + sl.sets, 0)}`).join(',')}`);
}

console.log('[Phase2 #229 Q2] Advanced/Elite intensification & peak top single + -10% back-offs');
{
  for (const age of ['advanced', 'elite']) {
    const vol = generateBlock(mkInput({
      profile: mkProfile({ training_age: age, base_rpe_cap: 9.0 }),
      macroBlockIndex: 5, // 'volume' (intensification)
    }));
    const w1 = vol.sessions.filter((s) => s.week_index === 1);
    const sq1 = w1[0].slots.find((sl) => sl.movement_id === 1);
    const dl1 = w1[0].slots.find((sl) => sl.movement_id === 3);
    const bn1 = w1[1].slots.find((sl) => sl.movement_id === 2);
    check(`${age} volume block prescribes top single + 3x5 @ -10% for squat/bench and 2x5 for deadlift`,
      vol.macroPhase === 'volume'
        && sq1?.reps === 1 && sq1?.sets === 4 && sq1?.target_rpe === 8.0
        && sq1?.backOff?.sets === 3 && sq1?.backOff?.reps === 5 && sq1?.backOff?.loadMultiplier === 0.9
        && bn1?.reps === 1 && bn1?.sets === 4 && bn1?.backOff?.sets === 3 && bn1?.backOff?.reps === 5
        && dl1?.reps === 1 && dl1?.sets === 3 && dl1?.backOff?.sets === 2 && dl1?.backOff?.reps === 5 && dl1?.backOff?.loadMultiplier === 0.9,
      `sq=${JSON.stringify({ reps: sq1?.reps, sets: sq1?.sets, rpe: sq1?.target_rpe, backOff: sq1?.backOff })} dl=${JSON.stringify(dl1?.backOff)}`);

    const w3Sq = vol.sessions.filter((s) => s.week_index === 3)
      .flatMap((s) => s.slots).find((sl) => sl.movement_id === 1);
    check(`${age} top single RPE ramps 8.0 -> 8.5 -> 9.0 capped at base_rpe_cap=9.0`,
      w3Sq?.target_rpe === 9.0, `w3Rpe=${w3Sq?.target_rpe}`);

    const peak = generateBlock(mkInput({
      profile: mkProfile({ training_age: age, base_rpe_cap: 9.0 }),
      macroBlockIndex: 7, // 'peak'
    }));
    const pkW1 = peak.sessions.filter((s) => s.week_index === 1);
    const pkSq = pkW1[0].slots.find((sl) => sl.movement_id === 1);
    const pkDl = pkW1[0].slots.find((sl) => sl.movement_id === 3);
    check(`${age} peak block W1-3 prescribes top single + 2x3 @ -10% for Squat/Bench/Deadlift`,
      peak.macroPhase === 'peak'
        && pkSq?.reps === 1 && pkSq?.sets === 3 && pkSq?.backOff?.sets === 2 && pkSq?.backOff?.reps === 3 && pkSq?.backOff?.loadMultiplier === 0.9
        && pkDl?.reps === 1 && pkDl?.sets === 3 && pkDl?.backOff?.sets === 2 && pkDl?.backOff?.reps === 3,
      `pkSq=${JSON.stringify({ reps: pkSq?.reps, sets: pkSq?.sets, backOff: pkSq?.backOff })}`);
  }

  check('computeBackOffLoadKg rounds -7.5% and -10% onto 2.5 kg plate grid',
    typeof blockGen.computeBackOffLoadKg === 'function'
      && blockGen.computeBackOffLoadKg(100, 0.925) === 92.5
      && blockGen.computeBackOffLoadKg(100, 0.9) === 90
      && blockGen.computeBackOffLoadKg(140, 0.9) === 125,
    String(typeof blockGen.computeBackOffLoadKg));

  const vol = generateBlock(mkInput({ profile: mkProfile({ training_age: 'advanced' }), macroBlockIndex: 5 }));
  const sq = vol.sessions.filter((s) => s.week_index === 1)[0].slots.find((sl) => sl.movement_id === 1);
  if (sq && sq.backOff) {
    const down = applyPrescriptionToSlot(toTodaySlot(sq), { load_modifier: 0.9, set_modifier: -1, rpe_cap: 7.5, coaching_cue: 'ease off' });
    check('applyPrescriptionToSlot clamps top + backOff RPE and adjusts backOff set count',
      down.targetRpe <= 7.5 && (down.backOff?.sets ?? -1) === Math.max(0, down.sets - 1) && (down.backOff?.targetRpe ?? 99) <= down.targetRpe,
      JSON.stringify({ sets: down.sets, rpe: down.targetRpe, backOff: down.backOff }));
  } else {
    check('applyPrescriptionToSlot preserves and scales backOff metadata', false, `backOff missing on sq: ${JSON.stringify(sq)}`);
  }
}

console.log('[Phase2 #229 Q3] SBD same-session guard & weekly heavy caps');
{
  let sbdAllSameSession = false;
  let capViolated = '';
  let totalSessions = 0;
  for (let freq = 1; freq <= 7; freq += 1) {
    const b = generateBlock(mkInput({
      profile: mkProfile({ training_age: 'advanced', weekly_frequency: freq }),
      macroBlockIndex: 5,
    }));
    const w1 = b.sessions.filter((s) => s.week_index === 1);
    assert.equal(w1.length, freq, `freq=${freq} must generate ${freq} week-1 sessions`);
    totalSessions += w1.length;
    let sqCount = 0;
    let bnCount = 0;
    let dlCount = 0;
    for (const ses of w1) {
      // Check ALL slots in the session: S+B+D never all primary heavy (slot_index <= 3 in same session or < 3)
      const patterns = ses.slots.filter((sl) => sl.slot_index <= 3)
        .map((sl) => FULL_MOVEMENTS.find((m) => m.movement_id === sl.movement_id)?.pattern);
      if (patterns.includes('squat') && patterns.includes('push_h') && patterns.includes('hinge')) {
        sbdAllSameSession = true;
      }
      const primary = ses.slots.filter((sl) => sl.slot_index < 3)
        .map((sl) => FULL_MOVEMENTS.find((m) => m.movement_id === sl.movement_id)?.pattern);
      if (primary.includes('squat')) sqCount += 1;
      if (primary.includes('push_h')) bnCount += 1;
      if (primary.includes('hinge')) dlCount += 1;
    }
    if (dlCount > 2) capViolated = `freq=${freq} dl=${dlCount}`;
    if (sqCount > 3) capViolated = `freq=${freq} sq=${sqCount}`;
    if (bnCount > 4) capViolated = `freq=${freq} bn=${bnCount}`;
  }
  check('never schedules Squat + Bench + Deadlift all in same session (freq 1..7)',
    totalSessions === 28 && !sbdAllSameSession, `sbdSame=${sbdAllSameSession}`);
  check('weekly heavy exposures obey Deadlift <= 2, Squat <= 3, Bench <= 4 across freq 1..7',
    totalSessions === 28 && capViolated === '', capViolated);
}

console.log('[Phase2 #229 Q4] Base RPE cap default 9.0 & 9.5 advanced/elite opt-in');
{
  check('DEFAULT_PROFILE.base_rpe_cap is 9.0', DEFAULT_PROFILE.base_rpe_cap === 9.0);
  const peak95 = generateBlock(mkInput({
    profile: mkProfile({ training_age: 'elite', base_rpe_cap: 9.5 }),
    macroBlockIndex: 7,
  }));
  const w3Sq95 = peak95.sessions.filter((s) => s.week_index === 3).flatMap((s) => s.slots).find((sl) => sl.movement_id === 1);
  check('elite peak block with base_rpe_cap 9.5 reaches >= 9.0 cleanly without exceeding 9.5',
    (w3Sq95?.target_rpe ?? 0) >= 9.0 && (w3Sq95?.target_rpe ?? 99) <= 9.5 && w3Sq95?.reps === 1,
    `rpe=${w3Sq95?.target_rpe} reps=${w3Sq95?.reps}`);
}

console.log('[Phase2 #229 Q1 / Q5 / question1] Countdown, Peaking Catalog & Taper Week');
{
  check('COMPETITION_DATE_NOTE updated verbatim',
    sport.COMPETITION_DATE_NOTE === 'If you add a competition date, your blocks count down to peak and taper for competition day, and the date stays synced with your goal review.',
    sport.COMPETITION_DATE_NOTE);

  check('SPORT_PEAKING_CATEGORIES & basketball catalog match ratified contract',
    JSON.stringify(sport.SPORT_PEAKING_CATEGORIES) === JSON.stringify(['competition_simulation', 'sport_drill', 'high_intensity_cardio'])
      && sport.SPORT_PEAKING_CATEGORY_LABEL?.competition_simulation === 'Competition simulation'
      && sport.SPORT_PEAKING_CATEGORY_LABEL?.sport_drill === 'Sport-specific movement drills'
      && sport.SPORT_PEAKING_CATEGORY_LABEL?.high_intensity_cardio === 'High-intensity sport cardio'
      && Array.isArray(sport.SPORT_PEAKING_CATALOG?.basketball)
      && sport.SPORT_PEAKING_CATALOG.basketball.length === 3
      && sport.SPORT_PEAKING_CATALOG.basketball[0].name === 'Mock basketball game'
      && sport.SPORT_PEAKING_CATALOG.basketball[1].name === 'Specific basketball movement drills'
      && sport.SPORT_PEAKING_CATALOG.basketball[2].name === 'High-intensity cardio'
      && Array.isArray(sport.SPORT_PEAKING_CATALOG?.football_rugby)
      && sport.SPORT_PEAKING_CATALOG.football_rugby.length === 0,
    JSON.stringify(sport.SPORT_PEAKING_CATALOG?.basketball));

  check('backward competition countdown horizon sets plannedEndDate = competitionDate without overshoot',
    typeof blockGen.resolveCompetitionCountdownHorizon === 'function'
      && blockGen.resolveCompetitionCountdownHorizon('2026-08-03', '2026-09-20').plannedEndDate === '2026-09-20'
      && blockGen.resolveCompetitionCountdownHorizon('2026-08-03', '2026-09-20').plannedBlockCount === 2,
    String(typeof blockGen.resolveCompetitionCountdownHorizon));

  if (typeof blockGen.countdownMacroPhaseSequence === 'function') {
    check('countdown sequence: 1 -> peak; 2 -> volume,peak; 3 -> hypertrophy,volume,peak',
      JSON.stringify(blockGen.countdownMacroPhaseSequence(1)) === JSON.stringify(['peak'])
        && JSON.stringify(blockGen.countdownMacroPhaseSequence(2)) === JSON.stringify(['volume', 'peak'])
        && JSON.stringify(blockGen.countdownMacroPhaseSequence(3)) === JSON.stringify(['hypertrophy', 'volume', 'peak']));
  } else {
    check('countdownMacroPhaseSequence exported', false, 'missing export');
  }

  // Final taper week for powerlifting ONLY vs other sports:
  const plTaperBlock = generateBlock(mkInput({
    profile: mkProfile({ training_age: 'advanced' }),
    macroBlockIndex: 7,
    competitionDate: '2026-08-31',
    sportId: 'powerlifting',
  }));
  const plW4 = plTaperBlock.sessions.filter((s) => s.week_index === 4);
  const plW4Primary = plW4.flatMap((s) => s.slots.filter((sl) => sl.slot_index < 3));
  const plW4Acc = plW4.flatMap((s) => s.slots.filter((sl) => sl.slot_index >= 3));
  check('powerlifting final taper week prescribes 2x3 @ RPE 6.5 primary / 2x6 @ RPE 6.0 accessory',
    plW4Primary.length > 0 && plW4Primary.every((sl) => sl.sets === 2 && sl.reps === 3 && sl.target_rpe === 6.5 && !sl.backOff)
      && plW4Acc.length > 0 && plW4Acc.every((sl) => sl.sets === 2 && sl.reps === 6 && sl.target_rpe === 6.0),
    JSON.stringify({ primary: plW4Primary[0], acc: plW4Acc[0] }));

  const bballTaperBlock = generateBlock(mkInput({
    profile: mkProfile({ training_age: 'intermediate' }),
    macroBlockIndex: 7,
    competitionDate: '2026-08-31',
    sportId: 'basketball',
  }));
  const bbW4Primary = bballTaperBlock.sessions.filter((s) => s.week_index === 4).flatMap((s) => s.slots.filter((sl) => sl.slot_index < 3));
  const bbW4Acc = bballTaperBlock.sessions.filter((s) => s.week_index === 4).flatMap((s) => s.slots.filter((sl) => sl.slot_index >= 3));
  check('non-powerlifting (basketball) final taper week tapers gym to 2 sets @ RPE 6.5 primary / 2 sets @ RPE 6.0 accessory',
    bbW4Primary.length > 0 && bbW4Primary.every((sl) => sl.sets === 2 && sl.target_rpe === 6.5)
      && bbW4Acc.length > 0 && bbW4Acc.every((sl) => sl.sets === 2 && sl.target_rpe === 6.0),
    JSON.stringify({ primary: bbW4Primary[0], acc: bbW4Acc[0] }));

  // Emphasis explains competition countdown instead of "does not change this plan".
  const emp = emphasis.buildProgramEmphasis({
    sport: {
      sportId: 'basketball', outcomeId: 'general_support', experienceId: 'over_5_years',
      otherSportName: null, practiceSessionsPerWeek: 2, matchesPerWeek: 1, typicalSessionMinutes: 60,
      competitionDate: '2026-10-01',
    },
    workload: sport.resolveSportWorkload({ scheduled: [], profile: null }),
    focus: null, goals: [], goalMovements: [],
  });
  const lines = emphasis.sportReportLines(emp);
  check('emphasis stops saying competitionDate does not change this plan',
    !lines.omitted.some((line) => line.includes('does not change this plan'))
      && lines.applied.some((line) => line.includes('2026-10-01')),
    JSON.stringify(lines));
}

console.log('[Phase2 #229 Q7] Lifting taxonomy & outside workload exclusion');
{
  check('SPORTS has 24 sports including olympic_weightlifting and strongman',
    sport.SPORTS.length === 24
      && sport.SPORTS.includes('olympic_weightlifting')
      && sport.SPORTS.includes('strongman')
      && sport.SPORT_INFO.olympic_weightlifting?.label === 'Olympic weightlifting'
      && sport.SPORT_INFO.olympic_weightlifting?.distinction === 'snatch and clean & jerk'
      && sport.SPORT_INFO.strongman?.label === 'Strongman'
      && sport.SPORT_INFO.strongman?.distinction === 'events, carries and overhead'
      && sport.SPORT_INFO.powerlifting?.distinction === 'squat, bench press and deadlift',
    `count=${sport.SPORTS.length}`);

  check('SPORT_OUTCOMES_BY_SPORT olympic_weightlifting and strongman = [general_support]; powerlifting keeps bigger_competition_lifts',
    JSON.stringify(sport.SPORT_OUTCOMES_BY_SPORT.olympic_weightlifting) === JSON.stringify(['general_support'])
      && JSON.stringify(sport.SPORT_OUTCOMES_BY_SPORT.strongman) === JSON.stringify(['general_support'])
      && sport.SPORT_OUTCOMES_BY_SPORT.powerlifting.includes('bigger_competition_lifts'));

  check('SPORT_COMPETITIONS_PER_YEAR_MAX = 52; lifting sport accepts 52 comps while basketball rejects 15',
    sport.SPORT_COMPETITIONS_PER_YEAR_MAX === 52
      && sport.validateSportProfile({
        sportId: 'powerlifting', otherSportName: null, outcomeId: 'bigger_competition_lifts', experienceId: 'over_5_years',
        practiceSessionsPerWeek: 0, matchesPerWeek: 52, typicalSessionMinutes: null, competitionDate: '2026-10-01',
      }, '2026-08-03').ok === true
      && sport.validateSportProfile({
        sportId: 'basketball', otherSportName: null, outcomeId: 'general_support', experienceId: 'over_5_years',
        practiceSessionsPerWeek: 0, matchesPerWeek: 15, typicalSessionMinutes: null, competitionDate: '2026-10-01',
      }, '2026-08-03').ok === false,
    String(sport.SPORT_COMPETITIONS_PER_YEAR_MAX));

  for (const liftSport of ['powerlifting', 'olympic_weightlifting', 'strongman']) {
    const wl = sport.resolveSportWorkload({
      scheduled: [],
      profile: {
        sportId: liftSport, outcomeId: liftSport === 'powerlifting' ? 'bigger_competition_lifts' : 'general_support',
        experienceId: 'over_5_years', otherSportName: null,
        practiceSessionsPerWeek: 4, matchesPerWeek: 12, typicalSessionMinutes: 90, competitionDate: '2026-10-01',
      },
    });
    check(`${liftSport} excluded from outside-sport cardio/fatigue workload`,
      wl.sessionsPerWeek === 0 && wl.knownMinutesPerWeek === 0 && wl.tier === 'none',
      JSON.stringify(wl));
  }

  const multi = sport.resolveMultiSportWorkload({
    scheduled: [],
    profiles: [
      {
        sportId: 'powerlifting', outcomeId: 'bigger_competition_lifts', experienceId: 'over_5_years',
        otherSportName: null, practiceSessionsPerWeek: 4, matchesPerWeek: 6, typicalSessionMinutes: 90, competitionDate: '2026-10-01',
      },
      {
        sportId: 'running_endurance', outcomeId: 'faster_running', experienceId: '2_to_5_years',
        otherSportName: null, practiceSessionsPerWeek: 3, matchesPerWeek: 0, typicalSessionMinutes: 45, competitionDate: null,
      },
    ],
  });
  check('resolveMultiSportWorkload excludes lifting sport while still counting non-lifting secondary sport',
    multi.sessionsPerWeek === 3, `sessions=${multi.sessionsPerWeek}`);
}

{
  // applyPrescriptionToSlot omission when readiness reduces back-off slot to 1 total set
  const easedSingleSet = applyPrescriptionToSlot(
    {
      sets: 3,
      reps: 5,
      targetRpe: 8.5,
      backOff: { sets: 2, reps: 5, targetRpe: 8.0, loadMultiplier: 0.925 },
    },
    { load_modifier: 0.9, set_modifier: -2, rpe_cap: 7.5 },
  );
  check('applyPrescriptionToSlot omits backOff cleanly when sets <= 1 under set_modifier: -2',
    easedSingleSet.sets === 1 && easedSingleSet.backOff === undefined && !('backOff' in easedSingleSet),
    JSON.stringify(easedSingleSet));
}

{
  const combinedInput = mkInput({
    profile: mkProfile({ training_age: 'advanced', weekly_frequency: 1, session_duration_cap_min: 240 }),
    startDate: '2026-11-18',
    macroBlockIndex: 5,
    scheduleMode: 'iso_weekday',
    programDays: [{ day_index: 3, focus: 'full', slot_overrides: [
      { slot_index: 1, sets: 10 }, { slot_index: 2, sets: 10 },
    ] }],
  });
  const normal = generateBlock(combinedInput);
  const first = normal.sessions.find((session) => session.week_index === 1);
  check('strength set trimming preserves explicit athlete set overrides',
    first !== undefined && JSON.stringify(first.slots.slice(0, 2).map((slot) => slot.sets)) === '[10,10]');
  const meet = generateBlock({ ...combinedInput, competitionDate: '2026-11-24', sportId: 'powerlifting' });
  check('weekday scheduling keeps every meet session before competition',
    meet.sessions.length > 0 && meet.sessions.every((session) => session.session_date < '2026-11-24')
      && meet.sessions[0].session_date === '2026-11-18');
}

console.log(`\nPhase 2 Inference Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
