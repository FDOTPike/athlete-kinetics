/**
 * verify_session_time.mjs — the one session-time contract and the THREE
 * planners that must obey it.
 *
 * What is pinned here:
 *   [1] the contract itself: preparation is reserved first and never below
 *       the reviewed floor; rest is the runner's own prescription; the repair
 *       order is condense preparation -> trim sets to each slot's minimum ->
 *       report the conflict;
 *   [2] block generator: ONE movement-count law (slotBudgetForCap) feeds the
 *       generator AND both strength-anchor calculations, so the three former
 *       copies of clamp(round(cap / 22), 2, 5) cannot disagree, and a short
 *       session is no longer promised two movements it has no time for;
 *   [3] routine microcycle and [4] routine composer: preparation is counted
 *       inside the session limit before any work is shed, and what cannot fit
 *       is refused with options rather than quietly shortened.
 *
 * Each "regression" check states the pre-contract behaviour it would have
 * failed on, so the check is known to be sensitive to the fix.
 *
 * Run: npm run verify:preparation
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const time = require('./.build/sessionTimeBudget.js');
const { restSecondsFor } = require('./.build/sessionRunner.js');
const {
  generateBlock, strengthAnchorCapacity, strengthAnchorRoleNames, programFocuses, defaultProgramDayIndices,
} = require('./.build/blockGenerator.js');
const { composeRoutineMicrocycle } = require('./.build/routineMicrocycle.js');
const { composeRoutine } = require('./.build/routineComposer.js');
const { DEFAULT_PROFILE, EQUIPMENT_ITEMS } = require('./.build/types.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const legacySlotBudget = (cap) => clamp(Math.round(cap / 22), 2, 5);

// --- [1] the contract -------------------------------------------------------
console.log('[1] session-time contract');
{
  check('preparation floor is 5 minutes and the standard allowance is 10',
    time.PREPARATION_FLOOR_MIN === 5 && time.PREPARATION_STANDARD_MIN === 10);
  check('planners reserve 5 min under 45, 8 from 45, 10 from 60',
    [15, 30, 44, 45, 59, 60, 90, 240].map(time.preparationPlanningMinutes).join(',') === '5,5,5,8,8,10,10,10',
    [15, 30, 44, 45, 59, 60, 90, 240].map(time.preparationPlanningMinutes).join(','));
  check('reserveSessionTime never reserves below the floor',
    time.reserveSessionTime({ capMin: 60, preparationMin: 0 }).preparationMin === 5
      && time.reserveSessionTime({ capMin: 60, preparationMin: 0 }).mainWorkMin === 55);
  check('a limit that leaves no main-work time is infeasible with a reason code',
    time.reserveSessionTime({ capMin: 5, preparationMin: 5 }).feasible === false
      && time.reserveSessionTime({ capMin: 5, preparationMin: 5 }).reasonCode === 'no_main_work_time'
      && time.reserveSessionTime({ capMin: 3, preparationMin: 5 }).reasonCode === 'cap_below_preparation_floor');

  // Rest is the runner's law, not a second table.
  const rests = [6, 7, 8, 9].map((rpe) => {
    const two = time.estimateSlotTime({ sets: 2, target: { kind: 'reps', reps: 5 }, targetRpe: rpe });
    return two.restSeconds === restSecondsFor({ targetRpe: rpe }, 'intermediate');
  });
  check('rest between sets equals the runner\'s own rest prescription at every effort band', rests.every(Boolean));
  const slot = time.estimateSlotTime({ sets: 4, target: { kind: 'reps', reps: 5 }, targetRpe: 8 });
  check('a slot counts changeover + work + rest BETWEEN sets (4x5 @ RPE 8 = 120 + 80 + 540 s)',
    slot.transitionSeconds === 120 && slot.workSeconds === 80 && slot.restSeconds === 540 && slot.totalSeconds === 740,
    JSON.stringify(slot));
  const timed = time.estimateSlotTime({ sets: 5, target: { kind: 'time', seconds: 300 }, targetRpe: 7.5 });
  check('a timed slot counts its seconds, not one repetition (5 x 300 s rounds)',
    timed.workSeconds === 1500 && timed.restSeconds === 4 * 120, JSON.stringify(timed));
  const floored = time.estimateSlotTime({ sets: 1, target: { kind: 'reps', reps: 5 }, targetRpe: 8, minimumSeconds: 330 });
  check('a reviewed minimum can only lengthen a slot, never shorten it',
    floored.totalSeconds === 330 && floored.allowanceSeconds === 330 - 140
      && time.estimateSlotTime({ sets: 4, target: { kind: 'reps', reps: 5 }, targetRpe: 8, minimumSeconds: 60 }).totalSeconds === 740
      && time.estimateSlotTime({ sets: 4, target: { kind: 'reps', reps: 5 }, targetRpe: 8, minimumSeconds: 60 }).allowanceSeconds === 0,
    JSON.stringify(floored));
  const session = time.estimateSessionTime({
    preparationMin: 10,
    slots: [{ sets: 4, target: { kind: 'reps', reps: 5 }, targetRpe: 8 }, { sets: 3, target: { kind: 'reps', reps: 10 }, targetRpe: 7 }],
  });
  check('a session total is preparation + changeovers + work + rest',
    Math.abs(session.totalMin - (session.preparationMin + session.transitionMin + session.workMin + session.restMin + session.allowanceMin)) < 0.15
      && session.preparationMin === 10, JSON.stringify(session));

  // Repair order.
  const heavy = (sets, minSets, trimPriority) => ({
    sets, minSets, trimPriority, trimmable: true, target: { kind: 'reps', reps: 5 }, targetRpe: 8.5,
  });
  const condensed = time.fitSessionToCap({ capMin: 22, preparationMin: 10, slots: [heavy(3, 2, 1), heavy(2, 2, 0)] });
  check('step 1: preparation is condensed to the floor before any set is trimmed',
    condensed.preparationCondensed && condensed.preparationMin === 5 && condensed.trimmedSlotIndices.length === 0
      && condensed.feasible, JSON.stringify(condensed.estimate));
  const trimmed = time.fitSessionToCap({ capMin: 30, preparationMin: 10, slots: [heavy(5, 2, 1), heavy(4, 2, 0)] });
  check('step 2: the lower-priority slot is trimmed first, and no slot goes below its minimum',
    trimmed.preparationMin === 5 && trimmed.sets[1] < 4 && trimmed.sets.every((sets) => sets >= 2),
    `sets=${trimmed.sets.join(',')} feasible=${trimmed.feasible}`);
  const impossible = time.fitSessionToCap({ capMin: 15, preparationMin: 10, slots: [heavy(5, 4, 1), heavy(5, 4, 0)] });
  check('step 3: a session that still cannot fit is reported infeasible — preparation is NOT removed',
    impossible.feasible === false && impossible.preparationMin === 5 && impossible.overByMin > 0
      && impossible.sets.every((sets) => sets === 4), JSON.stringify({ sets: impossible.sets, over: impossible.overByMin }));
  const frozen = time.fitSessionToCap({
    capMin: 15, preparationMin: 5,
    slots: [{ sets: 6, minSets: 1, trimPriority: 0, trimmable: false, target: { kind: 'reps', reps: 5 }, targetRpe: 9 }],
  });
  check('a non-trimmable slot (sport rounds, frozen plan) is never rewritten', frozen.sets[0] === 6 && !frozen.feasible);

  const offers = time.feasibleSessionAlternatives({ capMin: 15, requiredMin: 26, weeklyFrequency: 4 });
  check('offers are things the athlete can choose: a longer session on the 15-minute stepper, or fewer longer sessions',
    offers.length === 2 && offers[0].kind === 'extend_session' && offers[0].capMin === 30
      && offers[1].kind === 'fewer_longer_sessions' && offers[1].weeklyFrequency === 2 && offers[1].capMin === 30,
    JSON.stringify(offers));
  check('no offer is invented when nothing inside the profile domain fits',
    time.feasibleSessionAlternatives({ capMin: 240, requiredMin: 400, weeklyFrequency: 3 }).length === 0);
  const sentence = time.describeSessionTimeConflict({
    label: 'The lower session', capMin: 15, estimate: impossible.estimate, alternatives: offers,
  });
  check('the conflict sentence names the limit, the preparation and the options',
    /session limit is 15 minutes/.test(sentence) && /5 min preparation/.test(sentence)
      && /Preparation was not removed/.test(sentence) && /Lengthen sessions to 30 minutes/.test(sentence), sentence);
}

// --- [2] block generator ----------------------------------------------------
console.log('[2] block generator');
const PATTERNS = ['squat', 'hinge', 'lunge', 'isolation', 'push_h', 'pull_h', 'push_v', 'pull_v', 'carry', 'rotation', 'locomotion'];
const library = PATTERNS.flatMap((pattern, index) => [0, 1].map((variant) => ({
  movement_id: index * 2 + variant + 1,
  name: `${pattern} ${variant + 1}`,
  pattern,
  is_compound: pattern !== 'isolation',
  required: [],
  difficulty: 'Beginner',
  beginner_ok: true,
  sportTracking: false,
  capability_available_weight_room: true,
  capability_available_sport_conditioning: true,
})));
const patternOf = new Map(library.map((movement) => [movement.movement_id, movement.pattern]));
const profileAt = (capMin, overrides = {}) => ({
  ...DEFAULT_PROFILE, equipment_inventory: [...EQUIPMENT_ITEMS], objective: 'strength',
  weekly_frequency: 3, session_duration_cap_min: capMin, ...overrides,
});
const blockAt = (capMin, overrides = {}, movements = library) => generateBlock({
  profile: profileAt(capMin, overrides), movements, startDate: '2026-10-05',
});
{
  const caps = [15, 30, 45, 60, 75, 90, 105, 120, 180, 240];
  check('slotBudgetForCap on the session-length stepper',
    caps.map(time.slotBudgetForCap).join(',') === '1,1,2,3,3,4,5,5,5,5', caps.map(time.slotBudgetForCap).join(','));
  check('REGRESSION: the old law promised 2 movements (44 nominal minutes) to a 15- and a 30-minute session',
    legacySlotBudget(15) === 2 && legacySlotBudget(30) === 2
      && time.slotBudgetForCap(15) === 1 && time.slotBudgetForCap(30) === 1);
  check('from 45 minutes up the stepper values keep their existing movement count',
    caps.filter((cap) => cap >= 45).every((cap) => time.slotBudgetForCap(cap) === legacySlotBudget(cap)));

  // The three former copies now agree, at every cap and objective.
  let anchorsAgree = true;
  let countsAgree = true;
  let detail = '';
  for (const capMin of caps) {
    for (const objective of ['strength', 'hypertrophy', 'gpp']) {
      for (const frequency of [2, 3, 4]) {
        const profile = profileAt(capMin, { objective, weekly_frequency: frequency });
        const focuses = programFocuses(objective, frequency);
        const dayIndices = defaultProgramDayIndices(frequency);
        const plan = generateBlock({
          profile, movements: library, startDate: '2026-10-05',
          programDays: focuses.map((focus, index) => ({ day_index: dayIndices[index], focus })),
        });
        const weekOne = plan.sessions.filter((session) => session.week_index === 1);
        const budget = time.slotBudgetForCap(capMin);
        // Every focus menu has at least three patterns, so a budget of 1-3
        // is reached exactly; larger budgets are bounded by the focus menu.
        if (!weekOne.every((session) => session.slots.length <= budget)
          || (budget <= 3 && !weekOne.every((session) => session.slots.length === budget))) {
          countsAgree = false;
          detail = `cap=${capMin} ${objective} f=${frequency} slots=${weekOne.map((session) => session.slots.length).join('/')} budget=${budget}`;
        }
        const carried = new Set(weekOne.flatMap((session) => session.slots.map((slot) => patternOf.get(slot.movement_id)))
          .filter((pattern) => ['squat', 'push_h', 'hinge'].includes(pattern)));
        const capacity = strengthAnchorCapacity(profile, programFocuses, defaultProgramDayIndices);
        const names = strengthAnchorRoleNames(profile, programFocuses);
        if (capacity !== carried.size || names.length !== carried.size) {
          anchorsAgree = false;
          detail = `cap=${capMin} ${objective} f=${frequency} capacity=${capacity} names=${names.length} generated=${carried.size}`;
        }
      }
    }
  }
  check('the generator carries exactly the movement count its own law states, at every cap', countsAgree, detail);
  check('strengthAnchorCapacity and strengthAnchorRoleNames match the generated week at every cap (one shared law)',
    anchorsAgree, detail);

  const short = blockAt(15);
  check('15-minute cap: every session reserves at least the 5-minute preparation floor',
    short.timeBudget.sessions.length === short.sessions.length
      && short.timeBudget.sessions.every((session) => session.preparationMin >= 5));
  check('15-minute cap: every session fits the limit INCLUDING preparation, rest and changeovers',
    short.timeBudget.conflicts.length === 0
      && short.timeBudget.sessions.every((session) => session.feasible && session.estimatedMin <= 15),
    `max=${Math.max(...short.timeBudget.sessions.map((session) => session.estimatedMin))}`);
  check('15-minute cap: one movement per session, never below the 2-set working floor',
    short.sessions.every((session) => session.slots.length === 1
      && session.slots.every((slot) => session.phase === 'deload' ? slot.sets >= 1 : slot.sets >= 2)));
  check('15-minute cap: a set reduction is disclosed as a warning, never silent',
    short.timeBudget.sessions.some((session) => session.trimmedSlotIndexes.length > 0)
      ? short.warnings.some((warning) => /sets reduced .* so the session fits 15 minutes including 5 minutes of preparation/.test(warning))
      : true, short.warnings.join(' | '));
  const legacyTwoSlots = time.estimateSessionTime({
    preparationMin: 5,
    slots: [0, 1].map(() => ({ sets: 4, target: { kind: 'reps', reps: 5 }, targetRpe: 7.5 })),
  });
  check('REGRESSION: the session the old law generated for 15 minutes needs more than 15 once preparation is counted',
    legacyTwoSlots.totalMin > 15, `${legacyTwoSlots.totalMin} min`);

  const standard = blockAt(90);
  check('90-minute cap: preparation is counted (10 min) and no set is trimmed',
    standard.timeBudget.sessions.every((session) => session.preparationMin === 10 && session.trimmedSlotIndexes.length === 0
      && session.feasible) && standard.timeBudget.conflicts.length === 0);
  check('the report is deterministic and carries the contract version',
    JSON.stringify(blockAt(90).timeBudget) === JSON.stringify(standard.timeBudget)
      && standard.timeBudget.contractVersion === time.SESSION_TIME_CONTRACT_VERSION && standard.timeBudget.capMin === 90);

  // An infeasible short session: a 20-minute continuous run cannot fit 15 minutes
  // with preparation. It is reported with options; it is not shortened.
  const runLibrary = library.map((movement) => movement.pattern === 'locomotion'
    ? { ...movement, timePolicy: { defaultSets: 1, targetSeconds: 1200 } } : movement);
  const infeasible = generateBlock({
    profile: profileAt(15, { objective: 'endurance' }), movements: runLibrary, startDate: '2026-10-05',
    programDays: [{ day_index: 1, focus: 'conditioning' }, { day_index: 3, focus: 'conditioning' }, { day_index: 5, focus: 'conditioning' }],
  });
  const runsFirst = infeasible.sessions.every((session) => patternOf.get(session.slots[0].movement_id) === 'locomotion');
  check('infeasible fixture: every conditioning session leads with the 20-minute run', runsFirst);
  check('an infeasible short session is reported as a conflict with feasible options',
    infeasible.timeBudget.conflicts.length > 0
      && infeasible.timeBudget.alternatives.some((offer) => offer.kind === 'extend_session' && offer.capMin === 30)
      && infeasible.timeBudget.conflicts.every((conflict) => /Preparation was not removed/.test(conflict)),
    infeasible.timeBudget.conflicts[0] ?? 'no conflict');
  check('the infeasible session still reserves the preparation floor and the run is not shortened',
    infeasible.timeBudget.sessions.every((session) => session.preparationMin === 5 && !session.feasible && session.overByMin > 0));
  const feasibleRun = generateBlock({
    profile: profileAt(30, { objective: 'endurance' }), movements: runLibrary, startDate: '2026-10-05',
    programDays: [{ day_index: 1, focus: 'conditioning' }],
  });
  check('the offered 30-minute session really is feasible for the same plan',
    feasibleRun.timeBudget.conflicts.length === 0 && feasibleRun.timeBudget.sessions.every((session) => session.feasible));

  // REGRESSION (review of pull request 22): an offer used to be derived from the
  // CURRENT session's estimate. A longer session is planned afresh — more
  // movements, a larger preparation allowance — so a derived offer could itself
  // be infeasible. Here a 26-minute run and a timed carry cross the 30 -> 45
  // threshold, where the session gains its second movement.
  const crossingLibrary = library.map((movement) => movement.pattern === 'locomotion'
    ? { ...movement, timePolicy: { defaultSets: 1, targetSeconds: 1560 } }
    : movement.pattern === 'carry' ? { ...movement, timePolicy: { defaultSets: 3, targetSeconds: 240 } } : movement);
  const conditioningDays = [{ day_index: 1, focus: 'conditioning' }, { day_index: 3, focus: 'conditioning' }, { day_index: 5, focus: 'conditioning' }];
  const crossingAt = (capMin) => generateBlock({
    profile: profileAt(capMin, { objective: 'endurance' }), movements: crossingLibrary, startDate: '2026-10-05', programDays: conditioningDays,
  });
  const crossing = crossingAt(30);
  const worstMin = Math.max(...crossing.timeBudget.sessions.map((session) => session.estimatedMin));
  const derived = time.feasibleSessionAlternatives({ capMin: 30, requiredMin: worstMin, weeklyFrequency: 3 })[0];
  const offered = crossing.timeBudget.alternatives.find((offer) => offer.kind === 'extend_session');
  check('crossing fixture: the 30-minute block does not fit, and the length derived from its estimate is 45',
    crossing.timeBudget.conflicts.length > 0 && derived !== undefined && derived.capMin === 45, `worst=${worstMin}`);
  check('crossing fixture: the block planned AT 45 minutes gains a movement and does not fit either',
    crossingAt(45).timeBudget.conflicts.length > 0
      && crossingAt(45).sessions[0].slots.length > crossing.sessions[0].slots.length);
  check('the offered length is one at which the regenerated block has no conflict',
    offered !== undefined && offered.capMin > 45 && crossingAt(offered.capMin).timeBudget.conflicts.length === 0,
    JSON.stringify(crossing.timeBudget.alternatives));
  check('and it is the smallest such length on the 15-minute stepper',
    offered !== undefined && [...Array((offered.capMin - 45) / 15).keys()].every((step) =>
      crossingAt(45 + step * 15).timeBudget.conflicts.length > 0));
  check('every conflict message names the verified length, never the derived one',
    offered !== undefined && crossing.timeBudget.conflicts.every((conflict) =>
      conflict.includes(`Lengthen sessions to ${offered.capMin} minutes.`) && !conflict.includes('Lengthen sessions to 45 minutes.')),
    crossing.timeBudget.conflicts[0]);

  // The same property across the profile domain, for both libraries: whatever
  // is offered has been planned and fits.
  let offersChecked = 0;
  let offerDetail = '';
  for (const movements of [library, runLibrary, crossingLibrary]) {
    for (const objective of ['strength', 'hypertrophy', 'gpp', 'endurance', 'hybrid']) {
      for (const frequency of [2, 3, 4, 5, 6]) {
        for (const capMin of [15, 30, 45, 60, 75, 90]) {
          const profile = profileAt(capMin, { objective, weekly_frequency: frequency });
          const plan = generateBlock({ profile, movements, startDate: '2026-10-05' });
          for (const offer of plan.timeBudget.alternatives) {
            offersChecked += 1;
            const replanned = generateBlock({
              profile: { ...profile, session_duration_cap_min: offer.capMin,
                weekly_frequency: offer.kind === 'fewer_longer_sessions' ? offer.weeklyFrequency : frequency },
              movements, startDate: '2026-10-05',
            });
            if (replanned.timeBudget.conflicts.length > 0 || offer.capMin <= capMin
                || (offer.kind === 'fewer_longer_sessions' && offer.weeklyFrequency * offer.capMin > frequency * capMin)) {
              offerDetail = `${objective} f=${frequency} cap=${capMin} offer=${JSON.stringify(offer)}`;
            }
          }
          if (plan.timeBudget.conflicts.length === 0 && plan.timeBudget.alternatives.length > 0) {
            offerDetail = `${objective} f=${frequency} cap=${capMin}: offers without a conflict`;
          }
        }
      }
    }
  }
  check('every offer in the profile domain is longer than the current limit and fits when the block is planned as offered',
    offersChecked > 0 && offerDetail === '', `${offersChecked} offers ${offerDetail}`);
}

// --- [3] routine microcycle -------------------------------------------------
console.log('[3] routine microcycle');
{
  const movements = [1, 2, 3, 4, 5, 6, 7, 8].map((movementId) => ({
    movementId, name: `Lift ${movementId}`, pattern: 'squat', targetMuscles: ['quadriceps'], isCompound: true,
  }));
  const eligibility = {
    major: new Set([1, 2, 6, 7, 8]), supplementary: new Set([3]), accessory: new Set([4, 5]), conditional: new Set(),
  };
  const compose = (selections, durationCapMin) => composeRoutineMicrocycle({
    selections, movements,
    liftFamilies: [
      { movementId: 1, family: 'squat', stressCoefficient: 1, preferredPurpose: null },
      { movementId: 2, family: 'deadlift', stressCoefficient: 1, preferredPurpose: null },
      { movementId: 6, family: 'bench_press', stressCoefficient: 1, preferredPurpose: null },
      { movementId: 7, family: 'overhead_press', stressCoefficient: 1, preferredPurpose: null },
      { movementId: 8, family: 'row', stressCoefficient: 1, preferredPurpose: null },
    ],
    assistance: [
      { family: 'squat', movementId: 3, distance: 1, stressFactor: 0.5, fatigueCost: 1, reason: 'close squat support' },
      { family: 'squat', movementId: 4, distance: 2, stressFactor: 0.2, fatigueCost: 1, reason: 'low-fatigue support' },
      { family: 'deadlift', movementId: 3, distance: 1, stressFactor: 0.5, fatigueCost: 1, reason: 'close hinge support' },
      { family: 'deadlift', movementId: 4, distance: 2, stressFactor: 0.2, fatigueCost: 1, reason: 'low-fatigue support' },
    ],
    roleEligibility: eligibility,
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4, 5, 6, 7, 8]),
  });
  const major = { dayIndex: 1, slotIndex: 1, movementId: 1, role: 'major', sets: 4, reps: 5, targetRpe: 8 };
  const supp = { dayIndex: 1, slotIndex: 2, movementId: 3, role: 'supplementary', sets: 3, reps: 8, targetRpe: 7.5 };
  const acc = { dayIndex: 1, slotIndex: 3, movementId: 4, role: 'accessory', sets: 2, reps: 12, targetRpe: 6.5 };

  const roomy = compose([major, supp, acc], 90);
  check('fixture composes without a blocker', roomy.blockers.length === 0, roomy.blockers.join(' | '));
  const day = roomy.dayTimes[0];
  check('90-minute day: preparation (10 min) is counted in the day total',
    day !== undefined && day.preparationMin === 10 && day.feasible
      && Math.abs(day.estimatedMin - (day.preparationMin + day.mainWorkMin)) < 0.15, JSON.stringify(day));
  // The pre-contract role allowances, restated here as the independent
  // expectation: set-up plus minutes per set, per role.
  const legacyAllowance = (row) => ({ major: 3 + row.sets * 2.5, supplementary: 2 + row.sets * 1.5,
    conditional: 1.5 + row.sets * 1.25, accessory: 1 + row.sets })[row.role];
  const asSlot = (row, floor) => ({
    sets: row.sets, target: { kind: 'reps', reps: row.reps }, targetRpe: row.targetRpe,
    ...(floor ? { minimumSeconds: legacyAllowance(row) * 60 } : {}),
  });
  const sharedOnly = time.estimateSessionTime({ preparationMin: 0, slots: [major, supp, acc].map((row) => asSlot(row, false)) }).totalMin;
  const expectedMain = time.estimateSessionTime({ preparationMin: 0, slots: [major, supp, acc].map((row) => asSlot(row, true)) }).totalMin;
  const legacyMain = [major, supp, acc].reduce((sum, row) => sum + legacyAllowance(row), 0);
  check('the day uses the SHARED estimator with each role allowance from before the contract as its minimum',
    Math.abs(day.mainWorkMin - expectedMain) < 0.15, `${day.mainWorkMin} vs ${expectedMain}`);
  check('conservative: the day is never estimated shorter than the law it replaces, nor than the measured time',
    day.mainWorkMin >= legacyMain - 0.05 && day.mainWorkMin >= sharedOnly - 0.05,
    `day=${day.mainWorkMin} legacy=${legacyMain} measured=${sharedOnly}`);

  // 27 minutes holds all three movements on their own but not with preparation.
  // Pre-contract the day passed untouched (legacy total 22.5 <= 27).
  const tight = compose([major, supp, acc], 27);
  const tightDay = tight.dayTimes[0];
  check('REGRESSION: a day that only fits WITHOUT preparation now sheds support work',
    legacyMain <= 27 && expectedMain <= 27 && expectedMain + 5 > 27
      && tight.prescriptions.some((row) => !row.included)
      && tightDay.preparationMin === 5 && tightDay.estimatedMin <= 27 && tightDay.feasible,
    `legacy=${legacyMain} main=${expectedMain} day=${JSON.stringify(tightDay)}`);
  check('the omission says preparation was counted',
    tight.adaptations.some((line) => /including 5 minutes of preparation/.test(line)), tight.adaptations.join(' | '));
  check('accessories are shed before supplementary work, and the major is kept',
    tight.prescriptions.find((row) => row.movementId === 1).included === true
      && tight.prescriptions.find((row) => row.movementId === 4).included === false);

  // Two majors cannot fit 15 minutes even at one set each (5.5 minutes each
  // under the role allowance) once the 5-minute preparation floor is counted.
  // Pre-contract the same day passed at 11 of 15 minutes, because preparation
  // was not counted.
  const twoMajors = [major, { ...major, slotIndex: 2, movementId: 2 }];
  const blocked = compose(twoMajors, 15);
  const minimumWork = twoMajors.reduce((sum, row) => sum + legacyAllowance({ ...row, sets: 1 }), 0);
  check('REGRESSION fixture: two one-set majors fit 15 minutes on their own but not with preparation',
    minimumWork <= 15 && minimumWork + 5 > 15, `${minimumWork} min`);
  check('15-minute day with two majors: refused with a blocker that names preparation and options',
    blocked.blockers.some((line) => /cannot fit every selected major at a safe minimum dose inside 15 minutes once 5 minutes of preparation are counted/.test(line)
      && /Options: remove a major from this day\./.test(line) && /Lengthen sessions to 30 minutes\./.test(line)),
    blocked.blockers.join(' | '));
  check('the blocked day still reports the preparation floor — it was not removed to make the day pass',
    blocked.dayTimes[0].preparationMin === 5 && blocked.dayTimes[0].feasible === false);
  const single = compose([{ ...major, sets: 2 }], 15);
  check('15-minute day with one short major fits with preparation counted',
    single.blockers.length === 0 && single.dayTimes[0].feasible && single.dayTimes[0].estimatedMin <= 15,
    JSON.stringify(single.dayTimes[0]));
}

// --- [4] routine composer ---------------------------------------------------
console.log('[4] routine composer');
{
  const compose = (selections, durationCapMin) => composeRoutine({
    selections, schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4]),
  });
  const full = [{ movementId: 1, role: 'major' }, { movementId: 2, role: 'supplementary' }, { movementId: 3, role: 'accessory' }];
  const roomy = compose(full, 90);
  check('90-minute cap keeps every selection and warns about nothing', roomy.slots.length === 3 && roomy.warnings.length === 0,
    roomy.warnings.join(' | '));
  // The pre-contract fixed role minutes, restated as the independent expectation.
  const roleMinutes = { major: 18, supplementary: 12, accessory: 8, conditional: 8 };
  const mainOf = (slots) => time.estimateSessionTime({
    preparationMin: 0,
    slots: slots.map((slot) => ({
      sets: slot.sets, target: { kind: 'reps', reps: slot.reps }, targetRpe: slot.targetRpe,
      minimumSeconds: roleMinutes[slot.role] * 60,
    })),
  }).totalMin;
  check('conservative: a selection is never estimated shorter than its pre-contract role minutes',
    mainOf(roomy.slots) >= roomy.slots.reduce((sum, slot) => sum + roleMinutes[slot.role], 0) - 0.05);
  const need = mainOf(roomy.slots);
  const cap = Math.ceil(need) + 2; // holds all three WITHOUT preparation, not with it
  const tight = compose(full, cap);
  check('REGRESSION: a cap that holds the work but not the preparation now sheds the accessory',
    need <= cap && tight.slots.length < 3 && tight.warnings.some((warning) => /Duration cap omitted movement 3/.test(warning))
      && mainOf(tight.slots) + 5 <= cap, `need=${need} cap=${cap} kept=${tight.slots.length}`);
  check('the major is never shed by the composer', tight.slots.some((slot) => slot.movementId === 1 && slot.role === 'major'));
  const majors = compose([{ movementId: 1, role: 'major' }, { movementId: 2, role: 'major' }], 15);
  check('majors that cannot fit are kept and flagged, with preparation named in the warning',
    majors.slots.length === 2 && majors.warnings.some((warning) => /once 5 minutes of preparation are counted/.test(warning)),
    majors.warnings.join(' | '));
  const beginner = composeRoutine({
    selections: full, schemaType: 'LINEAR', objective: 'strength', trainingAge: 'beginner',
    durationCapMin: cap, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4]),
  });
  check('experience changes the dose, never which selections survive the cap',
    beginner.slots.map((slot) => slot.movementId).join(',') === tight.slots.map((slot) => slot.movementId).join(',')
      && beginner.slots.every((slot, index) => slot.sets === tight.slots[index].sets - 1));
  const lone = compose([{ movementId: 1, role: 'major' }], 15);
  check('a single selection keeps its default dose at the real cap (no widened limit needed)',
    lone.slots.length === 1 && lone.slots[0].sets === 4 && lone.slots[0].reps === 4);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
