/**
 * verify_emphasis.mjs — sport selection and goal-responsive programming
 * (work order 3), on the REAL 300-movement library and its real muscle
 * mapping (built from the migration chain; no synthetic movements).
 *
 * Pins:
 *   [1] the sport question: families, explicit football and hockey
 *       distinctions, a supported fallback, validation, "not sure";
 *   [2] what each outcome changes and on what basis — and that nothing is
 *       promised and nothing unsupported is added;
 *   [3] scheduled sport workload: the schedule is the evidence, stated
 *       numbers are a fallback, the two are never added;
 *   [4] the side-car is additive: no emphasis means a byte-identical block;
 *   [5] focus changes movement selection and weekly allocation, inside
 *       every gate, never touching a main lift's job;
 *   [6] the athlete's explicit choice and the strength main lifts outrank it;
 *   [7] a goal exercise is planned when the gates allow, and explained when
 *       they do not;
 *   [8] sport changes selection (and competition lifts for powerlifting);
 *   [9] workload changes dose and progression of accessories only;
 *  [10] time, determinism, weekly identity, held movements, honest report.
 *
 * Run: npm run verify:preparation
 */
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const gen = require('./.build/blockGenerator.js');
const pe = require('./.build/programEmphasis.js');
const sp = require('./.build/sportProfile.js');
const fg = require('./.build/focusGoals.js');
const budget = require('./.build/sessionTimeBudget.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// --- the real library -----------------------------------------------------------
const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'core-db', 'src', 'schema');
const db = new DatabaseSync(':memory:');
for (const name of readdirSync(schemaDir).filter((n) => /^0\d\d_.*\.sql$/.test(n) && !n.startsWith('004_')).sort()) {
  db.exec(readFileSync(join(schemaDir, name), 'utf8'));
}
const movements = db.prepare(`SELECT m.movement_id, m.name, m.pattern, m.is_compound, d.difficulty_rating, d.supported_prefixes,
  (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json,
  (w.movement_id IS NOT NULL) AS beginner_ok, (mst.movement_id IS NOT NULL) AS sport_tracking, ms.scope AS scope,
  tp.default_sets, tp.target_seconds, lm.mode
  FROM movement m LEFT JOIN movement_detail d ON d.movement_id = m.movement_id
  LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id
  LEFT JOIN movement_sport_tracking mst ON mst.movement_id = m.movement_id
  LEFT JOIN movement_scope ms ON ms.movement_id = m.movement_id
  LEFT JOIN movement_time_policy tp ON tp.movement_id = m.movement_id
  LEFT JOIN movement_logging_mode lm ON lm.movement_id = m.movement_id ORDER BY m.movement_id`).all().map((r) => {
  const prefixes = JSON.parse(r.supported_prefixes ?? '[]');
  return {
    movement_id: r.movement_id, name: r.name, pattern: r.pattern, is_compound: r.is_compound === 1,
    required: JSON.parse(r.required_json), difficulty: r.difficulty_rating ?? undefined,
    beginner_ok: r.beginner_ok === 1, sportTracking: r.sport_tracking === 1,
    capability_available_weight_room: true, capability_available_sport_conditioning: true,
    scope: r.scope ?? undefined,
    // The store's rule for an undeclared slot: a sole supported implement stands.
    plannedImplement: prefixes.length === 1 ? prefixes[0] : undefined,
    timePolicy: r.mode === 'time' && r.default_sets !== null
      ? { defaultSets: r.default_sets, targetSeconds: r.target_seconds } : undefined,
  };
});
const roles = db.prepare('SELECT movement_id, muscle_group_id, role FROM movement_muscle_role').all()
  .map((r) => ({ movementId: r.movement_id, muscleGroupId: r.muscle_group_id, role: r.role }));
const ALL_EQUIPMENT = db.prepare('SELECT DISTINCT item FROM movement_equipment').all().map((r) => r.item);
const byId = new Map(movements.map((m) => [m.movement_id, m]));
const idOf = (name) => movements.find((m) => m.name === name).movement_id;
const primaryOf = (movementId) => roles.filter((r) => r.movementId === movementId && r.role === 'primary').map((r) => r.muscleGroupId);

const profile = (over = {}) => ({
  objective: 'hypertrophy', training_age: 'intermediate', weekly_frequency: 4, max_sessions_per_day: 1,
  session_duration_cap_min: 60, base_rpe_cap: 8.5, target_energy_system: 'hybrid',
  progression_methodology: 'autoregulated', injury_flags: [], mobility_limits: [],
  equipment_inventory: ALL_EQUIPMENT, ...over,
});
const emphasisOf = (parts) => pe.buildProgramEmphasis({ focus: null, sport: null, workload: null, goalMovements: [], roles, ...parts });
const plan = (prof, parts, extra = {}) => gen.generateBlock({
  profile: prof, movements: extra.movements ?? movements, startDate: '2026-10-05', schemaType: extra.schemaType ?? 'LINEAR',
  ...(extra.macroBlockIndex === undefined ? {} : { macroBlockIndex: extra.macroBlockIndex }),
  ...(parts === null ? {} : { emphasis: emphasisOf(parts) ?? undefined }),
  ...(extra.programDays === undefined ? {} : { programDays: extra.programDays }),
});
const week = (block, n = 1) => block.sessions.filter((s) => s.week_index === n);
const day = (block, dayIndex, n = 1) => week(block, n).find((s) => s.day_index === dayIndex);
const names = (session) => session.slots.map((slot) => byId.get(slot.movement_id).name);
const ids = (block, n = 1) => week(block, n).flatMap((s) => s.slots.map((slot) => slot.movement_id));
const sportOf = (sportId, outcomeId, over = {}) => ({
  sportId, otherSportName: null, outcomeId, experienceId: '2_to_5_years',
  practiceSessionsPerWeek: 2, matchesPerWeek: 1, typicalSessionMinutes: 90, competitionDate: null, ...over,
});
const workloadOf = (sport, scheduled = []) => sp.resolveSportWorkload({ scheduled, profile: sport });
const TODAY = '2026-10-02';
const reportText = (block) => [...block.emphasis.applied, ...block.emphasis.omitted].join(' ');

// --- [1] the sport question ---------------------------------------------------------
console.log('[1] the sport question');
{
  check('asked by family: basketball, football, hockey, powerlifting, Muay Thai, another sport',
    sp.SPORT_FAMILIES.join(',') === 'basketball,football,hockey,powerlifting,muay_thai,other');
  check('football is told apart explicitly: association, Australian, rugby, American',
    sp.sportsInFamily('football').join(',') === 'football_association,football_australian,football_rugby,football_american'
      && sp.sportsInFamily('football').every((id) => sp.SPORT_INFO[id].distinction.length > 20));
  check('hockey is told apart explicitly: field and ice',
    sp.sportsInFamily('hockey').join(',') === 'hockey_field,hockey_ice'
      && /grass or turf/.test(sp.SPORT_INFO.hockey_field.distinction) && /ice/.test(sp.SPORT_INFO.hockey_ice.distinction));
  check('every sport offers outcomes and always the honest general option, last',
    sp.SPORTS.every((id) => sp.SPORT_OUTCOMES_BY_SPORT[id].length >= 2 && sp.SPORT_OUTCOMES_BY_SPORT[id].at(-1) === 'general_support'));
  check('basketball offers jumping; powerlifting offers the competition lifts; Muay Thai offers striking and clinch',
    sp.SPORT_OUTCOMES_BY_SPORT.basketball.includes('jump_higher')
      && sp.SPORT_OUTCOMES_BY_SPORT.powerlifting[0] === 'bigger_competition_lifts'
      && sp.SPORT_OUTCOMES_BY_SPORT.muay_thai[0] === 'striking_and_clinch');
  const ok = sp.validateSportProfile(sportOf('basketball', 'jump_higher'), TODAY);
  check('a complete answer validates', ok.ok && ok.profile.sportId === 'basketball' && ok.profile.otherSportName === null);
  const fields = (draft) => { const r = sp.validateSportProfile(draft, TODAY); return r.ok ? [] : r.errors.map((e) => e.field); };
  check('an outcome the sport does not offer is refused',
    fields(sportOf('powerlifting', 'jump_higher')).includes('outcomeId') && fields(sportOf('chess', 'general_support')).includes('sportId'));
  check('"another sport" needs the athlete to name it, and keeps their word for it',
    fields(sportOf('other', 'general_support')).includes('otherSportName')
      && sp.sportDisplayName(sp.validateSportProfile(sportOf('other', 'general_support', { otherSportName: ' Netball ' }), TODAY).profile) === 'Netball');
  const unsure = sp.validateSportProfile(sportOf('muay_thai', 'general_support',
    { practiceSessionsPerWeek: null, matchesPerWeek: null, typicalSessionMinutes: null }), TODAY);
  check('"not sure" is a complete workload answer and stores no number',
    unsure.ok && unsure.profile.practiceSessionsPerWeek === null && unsure.profile.matchesPerWeek === null);
  check('workload numbers are bounded, whole and never negative',
    fields(sportOf('basketball', 'jump_higher', { practiceSessionsPerWeek: 15 })).includes('practiceSessionsPerWeek')
      && fields(sportOf('basketball', 'jump_higher', { matchesPerWeek: -1 })).includes('matchesPerWeek')
      && fields(sportOf('basketball', 'jump_higher', { practiceSessionsPerWeek: 2.5 })).includes('practiceSessionsPerWeek')
      && fields(sportOf('basketball', 'jump_higher', { typicalSessionMinutes: 0 })).includes('typicalSessionMinutes'));
  check('a competition date must be a real date that has not passed',
    fields(sportOf('powerlifting', 'general_support', { competitionDate: '2026-02-30' })).includes('competitionDate')
      && fields(sportOf('powerlifting', 'general_support', { competitionDate: '2026-10-01' })).includes('competitionDate')
      && sp.validateSportProfile(sportOf('powerlifting', 'general_support', { competitionDate: '2026-10-02' }), TODAY).ok);
}

// --- [2] what each outcome changes, and on what basis ---------------------------------
console.log('[2] outcomes, basis and limits');
{
  const of = (sportId, outcomeId) => sp.sportEmphasisFor({ sportId, outcomeId, otherSportName: null });
  const jump = of('basketball', 'jump_higher');
  check('jump higher: quads, glutes, calves, citing the strength review and the plyometric meta-analysis',
    jump.muscles.join(',') === 'quadriceps,glutes,calves' && jump.basis.length === 2
      && /Suchomel/.test(jump.basis[0].citation) && /Markovic/.test(jump.basis[1].citation));
  check('jump higher says plainly that the library has no jump training',
    jump.limits.some((line) => /no jump or plyometric drills/.test(line) && /does not include jump training itself/.test(line)));
  const stay = of('football_association', 'stay_available');
  check('staying available in football: hamstrings, citing the Nordic hamstring meta-analysis and the adductor trial',
    stay.muscles.join(',') === 'hamstrings' && /van Dyk/.test(stay.basis[0].citation) && /Adductor Strengthening Programme/.test(stay.basis[1].citation));
  check('the adductor work the evidence supports is NOT approximated: the library gap is stated',
    stay.limits.some((line) => /no adductor-strengthening exercise/.test(line)) && !stay.muscles.includes('inner_thighs'));
  check('ice hockey cites its own adductor study; basketball gets no groin claim',
    /ice hockey players/.test(of('hockey_ice', 'stay_available').basis[1].citation)
      && of('basketball', 'stay_available').basis.length === 1
      && !of('basketball', 'stay_available').limits.some((line) => /adductor/.test(line)));
  const lifts = of('powerlifting', 'bigger_competition_lifts');
  check('powerlifting promotes the three competition lifts, citing the rule book', lifts.competitionLifts === true
    && lifts.muscles.length === 0 && /International Powerlifting Federation/.test(lifts.basis[0].citation));
  const muay = of('muay_thai', 'striking_and_clinch');
  check('Muay Thai striking: no reviewed basis, so NO emphasis — and high-rep hip-flexor raises are not a default',
    muay.muscles.length === 0 && muay.basis.length === 0 && !muay.competitionLifts
      && /no reviewed evidence/.test(muay.summary) && muay.limits.some((line) => /hip-flexor raises are not added by default/.test(line)));
  check('the supported fallback is general strength with no emphasis',
    of('other', 'general_support').muscles.length === 0 && of('other', 'general_support').limits.length === 0);
  const everything = sp.SPORTS.flatMap((sportId) => sp.SPORT_OUTCOMES_BY_SPORT[sportId].map((outcomeId) => of(sportId, outcomeId)));
  check('every emphasis with muscles names a published basis',
    everything.every((e) => e.muscles.length === 0 || e.basis.some((b) => b.kind === 'published')));
  check('no outcome promises a result or fewer injuries',
    everything.every((e) => !/guarantee|will prevent|prevents injur|will improve|will make you/i.test(`${e.summary} ${e.limits.join(' ')}`))
      && stay.limits.some((line) => /cannot promise fewer injuries/.test(line)));
  check('every emphasised muscle is a canonical muscle-group id',
    everything.every((e) => e.muscles.every(fg.isMuscleGroupId)));
}

// --- [3] scheduled sport workload -------------------------------------------------------
console.log('[3] scheduled sport workload');
{
  const stated = sportOf('basketball', 'jump_higher', { practiceSessionsPerWeek: 2, matchesPerWeek: 1 });
  const fromStated = workloadOf(stated);
  check('with nothing scheduled the stated numbers are used and labelled as stated',
    fromStated.source === 'stated' && fromStated.sessionsPerWeek === 3 && fromStated.knownMinutesPerWeek === 270
      && /2 practice sessions and 1 match a week, as you told the app/.test(fromStated.description));
  const scheduled = [
    { label: 'Team training', weekday: 2, expectedDurationMin: 90 },
    { label: 'Game', weekday: 6, expectedDurationMin: null },
  ];
  const fromSchedule = workloadOf(stated, scheduled);
  check('the Activities schedule is the evidence: it replaces the stated numbers, never adds to them',
    fromSchedule.source === 'schedule' && fromSchedule.sessionsPerWeek === 2
      && /2 weekly sessions in your Activities schedule/.test(fromSchedule.description));
  check('known minutes are summed; an unknown duration stays unknown, not zero and not estimated',
    fromSchedule.knownMinutesPerWeek === 90 && fromSchedule.unknownDurationSessions === 1
      && fromSchedule.weekdays.join(',') === '2,6');
  const unsure = workloadOf(sportOf('basketball', 'jump_higher', { practiceSessionsPerWeek: null, matchesPerWeek: null }));
  check('"not sure" with nothing scheduled is no workload, said plainly',
    unsure.source === 'none' && unsure.tier === 'none' && /not sure how often/.test(unsure.description));
  check('tiers by weekly sessions: 0 none, 1-2 light, 3-4 high, 5+ very high',
    [0, 1, 2, 3, 4, 5, 9].map(sp.sportWorkloadTier).join(',') === 'none,light,light,high,high,very_high,very_high'
      && sp.SPORT_WORKLOAD_HIGH_SESSIONS === 3 && sp.SPORT_WORKLOAD_VERY_HIGH_SESSIONS === 5);
  const effect = (sessions) => sp.sportWorkloadEffect({ ...fromStated, sessionsPerWeek: sessions, tier: sp.sportWorkloadTier(sessions) });
  check('effects: light changes nothing, high cuts one accessory set, very high cuts two and holds week 3',
    effect(2).accessorySetCut === 0 && !effect(2).holdHardestWeek
      && effect(3).accessorySetCut === 1 && !effect(3).holdHardestWeek
      && effect(5).accessorySetCut === 2 && effect(5).holdHardestWeek);
  check('every effect explains itself and says the main lifts are unchanged when it cuts anything',
    [0, 2, 3, 5].every((n) => /^Sport workload: /.test(effect(n).explanation))
      && [3, 5].every((n) => /main lifts/i.test(effect(n).explanation)));
  check('no cross-sport load score is computed: the workload carries sessions and minutes only',
    Object.keys(fromSchedule).sort().join(',') === 'description,knownMinutesPerWeek,sessionsPerWeek,source,tier,unknownDurationSessions,weekdays');
}

// --- [4] additive side-car -----------------------------------------------------------------
console.log('[4] additive side-car');
const baseline = plan(profile(), null);
{
  check('nothing set (balanced focus, no sport, no goal exercise) builds NO emphasis',
    emphasisOf({}) === null && emphasisOf({ focus: fg.BALANCED_FOCUS }) === null
      && emphasisOf({ focus: fg.focusFromBundle('balanced') }) === null);
  const explicitUndefined = gen.generateBlock({ profile: profile(), movements, startDate: '2026-10-05', schemaType: 'LINEAR', emphasis: undefined });
  check('no emphasis is byte-identical and carries no report key',
    JSON.stringify(explicitUndefined) === JSON.stringify(baseline) && !('emphasis' in baseline));
  check('the objective is untouched by a sport answer (no new objective value exists)',
    plan(profile(), { sport: sportOf('muay_thai', 'general_support'), workload: workloadOf(null) }).objective === 'hypertrophy');
  check('the baseline is the plan the assertions below compare against',
    names(day(baseline, 1)).join(' | ') === 'Front Squat | Romanian Deadlift | Walking Lunge'
      && names(day(baseline, 2)).join(' | ') === 'Dumbbell Bench Press | Barbell Row | Overhead Press');
}

// --- [5] focus: selection and weekly allocation -----------------------------------------------
console.log('[5] focus changes selection and weekly allocation');
const beach = plan(profile(), { focus: fg.focusFromBundle('beach_muscles') });
{
  check('beach muscles: the main press becomes an incline press (upper chest), which still trains the chest',
    names(day(beach, 2))[0] === 'Incline Dumbbell Press' && names(day(beach, 6))[0] === 'Incline Dumbbell Press'
      && primaryOf(idOf('Incline Dumbbell Press')).includes('chest') && primaryOf(idOf('Incline Dumbbell Press')).includes('upper_chest'));
  check('beach muscles: ONE upper day a week gives its last slot to biceps; the other keeps overhead pressing',
    names(day(beach, 2))[2] === 'Barbell Curl' && names(day(beach, 6))[2] === 'Overhead Press');
  check('lower days are untouched by an upper-body focus',
    JSON.stringify(day(beach, 1).slots) === JSON.stringify(day(baseline, 1).slots)
      && JSON.stringify(day(beach, 4).slots) === JSON.stringify(day(baseline, 4).slots));
  check('the main lifts of every session keep their place and their job (rows untouched, slot count unchanged)',
    names(day(beach, 2))[1] === 'Barbell Row' && week(beach).every((s, i) => s.slots.length === week(baseline)[i].slots.length));
  check('the report says what changed, in plain language',
    beach.emphasis.applied.includes('Focus — Beach muscles: upper chest, biceps, triceps.')
      && beach.emphasis.applied.includes('Trained directly every week: upper chest, biceps.')
      && beach.emphasis.applied.includes('Incline Dumbbell Press is planned instead of Dumbbell Bench Press: it trains upper chest directly (your focus).')
      && beach.emphasis.applied.includes('Barbell Curl takes the place of Overhead Press on one upper day a week, for biceps (your focus). Overhead Press is still trained on another day.'));
  check('and what could not be done, with a way to change it',
    beach.emphasis.omitted.length === 1 && /^No room for extra triceps work in your 60-minute sessions/.test(beach.emphasis.omitted[0])
      && /Longer sessions or one more training day would make room/.test(beach.emphasis.omitted[0]));

  const long = plan(profile({ session_duration_cap_min: 90 }), { focus: fg.focusFromBundle('beach_muscles') });
  check('with longer sessions all three areas get direct work and nothing is omitted',
    long.emphasis.applied.includes('Trained directly every week: upper chest, biceps, triceps.') && long.emphasis.omitted.length === 0);
  const short = plan(profile({ session_duration_cap_min: 45 }), { focus: fg.focusFromBundle('beach_muscles') });
  check('45-minute sessions hold only main lifts: the press still changes, nothing is displaced, the gap is stated',
    week(short).every((s) => s.slots.length === 2) && names(day(short, 2))[0] === 'Incline Dumbbell Press'
      && short.emphasis.omitted.length === 2 && short.emphasis.omitted.every((line) => /45-minute sessions/.test(line)));

  const lower = plan(profile(), { focus: fg.focusFromBundle('lower_body') });
  check('lower body: one lower day gives its last slot to glutes; squat and hinge stay; upper days untouched',
    names(day(lower, 1)).join(' | ') === 'Front Squat | Romanian Deadlift | Glute Bridge'
      && names(day(lower, 4)).join(' | ') === 'Front Squat | Romanian Deadlift | Walking Lunge'
      && JSON.stringify(day(lower, 2).slots) === JSON.stringify(day(baseline, 2).slots));
  check('a main lift is never swapped for a movement that drops its job (no glute-only "squat" replaces the squat)',
    !ids(lower).includes(idOf('Kneeling Squat')) && primaryOf(idOf('Kneeling Squat')).join(',') === 'glutes');
  const only = (muscles) => plan(profile(), { focus: fg.normalizeFocusSelection({ bundleId: null, muscles }).selection });
  const glutesOnly = only(['glutes']);
  const tricepsOnly = only(['triceps']);
  check('a single-muscle focus still cannot take over a main lift: the squat stays a squat for the quads, the press stays a chest press',
    week(glutesOnly).every((s, i) => s.slots.slice(0, 2).every((slot, j) => slot.movement_id === week(baseline)[i].slots[j].movement_id))
      && week(tricepsOnly).every((s) => s.focus !== 'upper' || primaryOf(s.slots[0].movement_id).includes('chest'))
      && glutesOnly.emphasis.applied.some((line) => /takes the place of .+ on one lower day a week, for glutes/.test(line)));
  const posture = plan(profile(), { focus: fg.focusFromBundle('posture') });
  check('posture: core work uses a control pattern, rear shoulders get direct work, once a week each',
    names(day(posture, 1))[2] === 'Pallof Press' && byId.get(idOf('Pallof Press')).pattern === 'rotation'
      && names(day(posture, 2))[2] === 'Band Pull-Apart'
      && names(day(posture, 4))[2] === 'Walking Lunge' && names(day(posture, 6))[2] === 'Overhead Press');

  // Weekly allocation bounds, across every focus bundle and several shapes.
  let bounded = true;
  let mainLiftsKept = true;
  for (const bundle of ['posture', 'beach_muscles', 'lower_body']) {
    for (const over of [{}, { weekly_frequency: 3 }, { weekly_frequency: 5 }, { objective: 'gpp' }, { session_duration_cap_min: 75 }]) {
      const base = plan(profile(over), null);
      const focused = plan(profile(over), { focus: fg.focusFromBundle(bundle) });
      const lost = new Map();
      for (const [index, session] of week(focused).entries()) {
        const before = week(base)[index];
        if (session.slots.length < before.slots.length) bounded = false;
        for (const [slotIndex, slot] of before.slots.entries()) {
          const pattern = byId.get(slot.movement_id).pattern;
          const now = session.slots[slotIndex];
          if (byId.get(now.movement_id).pattern !== pattern) {
            lost.set(pattern, (lost.get(pattern) ?? 0) + 1);
            if (slotIndex < 2) mainLiftsKept = false;
          }
        }
      }
      for (const [pattern, count] of lost) {
        const stillTrained = week(focused).some((s) => s.slots.some((slot) => byId.get(slot.movement_id).pattern === pattern));
        if (count > 1 || !stillTrained) bounded = false;
      }
    }
  }
  check('a pattern is displaced at most once a week and is always still trained on another day', bounded);
  check('the first two slots of a session are never given to a different kind of movement', mainLiftsKept);
}

// --- [6] precedence ---------------------------------------------------------------------------
console.log('[6] gates, explicit choices and main lifts outrank the emphasis');
{
  const noIncline = movements.map((m) => [65, 134, 212, 216].includes(m.movement_id)
    ? { ...m, capability_available_weight_room: false } : m);
  const gated = plan(profile(), { focus: fg.focusFromBundle('beach_muscles') }, { movements: noIncline });
  check('capability gate: an incline press that is not available to the athlete is never chosen for the focus',
    ![65, 134, 212, 216].some((id) => ids(gated).includes(id)) && names(day(gated, 2))[0] === 'Dumbbell Bench Press');
  check('and the report says no exercise passed the checks, instead of pretending',
    gated.emphasis.omitted.some((line) => /^No extra upper chest work: no exercise that trains upper chest directly passed/.test(line)));
  const noArmWork = movements.map((m) => (primaryOf(m.movement_id).some((muscle) => ['biceps', 'triceps'].includes(muscle))
    ? { ...m, capability_available_weight_room: false } : m));
  const gatedAllocation = plan(profile(), { focus: fg.focusFromBundle('beach_muscles') }, { movements: noArmWork });
  check('capability gate on allocation: no slot is given to an arm exercise the athlete is not cleared for',
    !ids(gatedAllocation).some((id) => primaryOf(id).some((muscle) => ['biceps', 'triceps'].includes(muscle)))
      && names(day(gatedAllocation, 2))[2] === 'Overhead Press'
      && gatedAllocation.emphasis.omitted.filter((line) => /^No extra (biceps|triceps) work: no exercise/.test(line)).length === 2);
  const bodyweightOnly = plan(profile({ equipment_inventory: [] }), { focus: fg.focusFromBundle('beach_muscles') });
  check('equipment gate: with no equipment nothing that needs equipment is planned',
    ids(bodyweightOnly).every((id) => byId.get(id).required.length === 0));
  const beginner = plan(profile({ training_age: 'beginner' }), { focus: fg.focusFromBundle('lower_body') });
  check('tier gate: a beginner is never handed an Advanced movement for the focus',
    ids(beginner).every((id) => byId.get(id).difficulty !== 'Advanced')
      && ids(beginner).every((id) => byId.get(id).difficulty === 'Beginner' || byId.get(id).beginner_ok));
  const chosen = plan(profile(), { focus: fg.focusFromBundle('beach_muscles') }, {
    programDays: [
      { day_index: 1, focus: 'lower' },
      { day_index: 2, focus: 'upper', movement_preferences: [
        { slot_index: 1, pattern: 'push_h', movement_id: idOf('Dumbbell Bench Press') },
        { slot_index: 3, pattern: 'push_v', movement_id: idOf('Overhead Press') },
      ] },
      { day_index: 4, focus: 'lower' },
      { day_index: 6, focus: 'upper' },
    ],
  });
  check('the athlete\'s own exercise choice for a slot is kept: not swapped, not displaced',
    names(day(chosen, 2))[0] === 'Dumbbell Bench Press' && names(day(chosen, 2))[2] === 'Overhead Press'
      && names(day(chosen, 6))[0] === 'Incline Dumbbell Press');
  const strengthBase = plan(profile({ objective: 'strength', weekly_frequency: 3 }), null);
  const strengthFocus = plan(profile({ objective: 'strength', weekly_frequency: 3 }), { focus: fg.focusFromBundle('lower_body') });
  check('strength main lifts are untouched by a focus: squat, bench and deadlift stay where they were',
    week(strengthFocus).every((s, i) => s.slots.slice(0, 2).every((slot, j) => slot.movement_id === week(strengthBase)[i].slots[j].movement_id))
      && names(day(strengthFocus, 5)).join(' | ') === 'Competition Squat | Competition Bench | Deadlift');
  check('a conditioning or sport day is left alone',
    (() => {
      const base = plan(profile({ objective: 'gpp' }), null);
      const focused = plan(profile({ objective: 'gpp' }), { focus: fg.focusFromBundle('lower_body') });
      return JSON.stringify(day(focused, 6).slots) === JSON.stringify(day(base, 6).slots) && day(base, 6).focus === 'conditioning';
    })());
}

// --- [7] goal exercises --------------------------------------------------------------------------
console.log('[7] an exercise a goal names');
{
  const gppBase = plan(profile({ objective: 'gpp' }), null);
  const goal = plan(profile({ objective: 'gpp' }), { goalMovements: [{ movementId: idOf('Front Squat'), goalLabel: 'Front squat 100 kg for 5' }] });
  check('a goal exercise replaces the default for its slot when the gates allow',
    names(day(gppBase, 1))[0] === 'Competition Squat' && names(day(goal, 1))[0] === 'Front Squat' && names(day(goal, 4))[0] === 'Front Squat');
  check('and the report says why it is there',
    goal.emphasis.applied.some((line) => line === 'Front Squat is in your plan because of your goal "Front squat 100 kg for 5". It is never the first thing cut when a session is short.'));
  const noBarbell = plan(profile({ equipment_inventory: ALL_EQUIPMENT.filter((item) => item !== 'barbell' && item !== 'kettlebell') }),
    { goalMovements: [{ movementId: idOf('Front Squat'), goalLabel: 'Front squat 100 kg for 5' }] });
  check('a goal never re-admits a gated movement: no barbell, no front squat, and the reason is equipment',
    !ids(noBarbell).includes(idOf('Front Squat'))
      && noBarbell.emphasis.omitted.some((line) => /names Front Squat, but it is not in this plan: it needs equipment you have not listed\./.test(line)));
  const nordic = plan(profile(), { goalMovements: [{ movementId: idOf('Nordic Curl'), goalLabel: 'Ten Nordic curls' }] });
  check('an Advanced goal exercise is not planned for an intermediate, and the reason is experience level',
    byId.get(idOf('Nordic Curl')).difficulty === 'Advanced' && !ids(nordic).includes(idOf('Nordic Curl'))
      && nordic.emphasis.omitted.some((line) => /names Nordic Curl, but it is not in this plan: it is above your current experience level\./.test(line)));
  const nordicAdvanced = plan(profile({ training_age: 'advanced' }), { goalMovements: [{ movementId: idOf('Nordic Curl'), goalLabel: 'Ten Nordic curls' }] });
  check('for an advanced athlete the same goal exercise takes one spare accessory slot a week, with the reason given',
    ids(nordicAdvanced).filter((id) => id === idOf('Nordic Curl')).length === 1
      && nordicAdvanced.emphasis.applied.some((line) => /^Nordic Curl takes the place of .+ on one lower day a week, because of your goal "Ten Nordic curls"\./.test(line)));
  const own = plan(profile(), { goalMovements: [{ movementId: idOf('Front Squat'), goalLabel: 'Front squat 100 kg for 5' }] }, {
    programDays: [1, 2, 4, 6].map((day_index, i) => ({
      day_index, focus: i % 2 === 0 ? 'lower' : 'upper',
      ...(i % 2 === 0 ? { movement_preferences: [{ slot_index: 1, pattern: 'squat', movement_id: idOf('Goblet Squat') }] } : {}),
    })),
  });
  check('the athlete\'s explicit slot choice outranks the goal exercise, and the report says so',
    names(day(own, 1))[0] === 'Goblet Squat'
      && own.emphasis.omitted.some((line) => /you chose a different exercise for that slot, and your choice was kept\./.test(line)));
  const gone = plan(profile(), { goalMovements: [{ movementId: 99999, goalLabel: 'Old goal' }] });
  check('a goal linked to a movement that no longer exists changes nothing and is reported',
    JSON.stringify(gone.sessions) === JSON.stringify(baseline.sessions)
      && gone.emphasis.omitted.some((line) => /the exercise is no longer in the library\./.test(line)));
}

// --- [8] sport ---------------------------------------------------------------------------------------
console.log('[8] sport changes selection');
{
  const gppBase = plan(profile({ objective: 'gpp' }), null);
  const football = sportOf('football_association', 'stay_available', { practiceSessionsPerWeek: 1, matchesPerWeek: 1 });
  const stay = plan(profile({ objective: 'gpp' }), { sport: football, workload: workloadOf(football) });
  check('football, staying available: an accessory becomes direct hamstring work; main lifts unchanged',
    names(day(gppBase, 1))[2] === 'Walking Lunge' && primaryOf(byId.get(day(stay, 1).slots[2].movement_id).movement_id).includes('hamstrings')
      && week(stay).every((s, i) => s.slots.slice(0, 2).every((slot, j) => slot.movement_id === week(gppBase)[i].slots[j].movement_id)));
  check('the report names the sport outcome as the reason and carries the limits',
    stay.emphasis.applied.some((line) => /\(your Football \(soccer\) outcome\)\.$/.test(line))
      && stay.emphasis.omitted.some((line) => /no adductor-strengthening exercise/.test(line))
      && stay.emphasis.omitted.some((line) => /cannot promise fewer injuries/.test(line)));
  const lifter = sportOf('powerlifting', 'bigger_competition_lifts', { practiceSessionsPerWeek: 0, matchesPerWeek: 0, competitionDate: '2027-03-01' });
  const meet = plan(profile(), { sport: lifter, workload: workloadOf(lifter) });
  check('powerlifting on a bodybuilding objective: the competition lifts become the main lifts',
    names(day(baseline, 1))[0] === 'Front Squat'
      && names(day(meet, 1)).slice(0, 2).join(' | ') === 'Competition Squat | Deadlift' && names(day(meet, 2))[0] === 'Competition Bench'
      && meet.emphasis.applied.includes('Competition lifts planned as main lifts: Competition Squat, Competition Bench, Deadlift.'));
  check('a competition date changes NOTHING in the plan and the report says so',
    JSON.stringify(meet.sessions) === JSON.stringify(plan(profile(), { sport: { ...lifter, competitionDate: null }, workload: workloadOf(lifter) }).sessions)
      && meet.emphasis.omitted.some((line) => line === 'Your competition on 2027-03-01 does not change this plan. The date is used for reminders and for reviewing your goals. It does not make the plan peak, taper or test a maximum.'));
  const datedFootball = plan(profile({ objective: 'gpp' }), { sport: { ...football, competitionDate: '2027-03-01' }, workload: workloadOf(football) });
  check('for every sport, not only powerlifting: a competition date changes no session, set, rep or effort',
    JSON.stringify(datedFootball.sessions) === JSON.stringify(stay.sessions)
      && !datedFootball.emphasis.applied.some((line) => /Competition lifts/.test(line)));
  const noRack = plan(profile({ equipment_inventory: ALL_EQUIPMENT.filter((item) => item !== 'barbell') }), { sport: lifter, workload: workloadOf(lifter) });
  check('competition lifts obey the gates: without a barbell none is planned and each is reported',
    !ids(noRack).some((id) => ['Competition Squat', 'Competition Bench', 'Deadlift'].includes(byId.get(id).name))
      && noRack.emphasis.omitted.filter((line) => /is not planned as a main lift/.test(line)).length === 3);
  const newLifter = plan(profile({ training_age: 'beginner' }), { sport: lifter, workload: workloadOf(lifter) });
  check('a new lifter is not forced onto the competition lifts, and is told',
    JSON.stringify(newLifter.sessions) === JSON.stringify(plan(profile({ training_age: 'beginner' }), null).sessions)
      && newLifter.emphasis.omitted.some((line) => /not forced as main lifts for a new lifter/.test(line)));
  const thai = sportOf('muay_thai', 'striking_and_clinch', { practiceSessionsPerWeek: 2, matchesPerWeek: 0 });
  const striking = plan(profile(), { sport: thai, workload: workloadOf(thai) });
  check('an outcome with no reviewed basis leaves the plan exactly as it was',
    JSON.stringify(striking.sessions) === JSON.stringify(baseline.sessions)
      && striking.emphasis.applied.some((line) => /^Muay Thai — be stronger in striking and the clinch: No extra emphasis\./.test(line)));
  const both = plan(profile(), { focus: fg.focusFromBundle('beach_muscles'), sport: football, workload: workloadOf(football) });
  check('the athlete\'s focus is served before the sport emphasis when both want the same slot',
    names(day(both, 2))[2] === 'Barbell Curl' && both.emphasis.applied[0] === 'Focus — Beach muscles: upper chest, biceps, triceps.');
}

// --- [9] workload: dose and progression -----------------------------------------------------------------
console.log('[9] workload changes accessory dose and progression only');
{
  const gpp = profile({ objective: 'gpp' });
  const gppBase = plan(gpp, null);
  const withSessions = (n) => {
    const sport = sportOf('other', 'general_support', { otherSportName: 'Netball', practiceSessionsPerWeek: n, matchesPerWeek: 0 });
    return plan(gpp, { sport, workload: workloadOf(sport) });
  };
  const light = withSessions(2);
  const high = withSessions(3);
  const veryHigh = withSessions(5);
  const strengthDays = (block, n) => week(block, n).filter((s) => ['lower', 'upper', 'full'].includes(s.focus));
  check('a light sport week changes nothing in the plan', JSON.stringify(light.sessions) === JSON.stringify(gppBase.sessions));
  check('a high sport week takes exactly one set off each accessory on strength days, weeks 1-3',
    [1, 2, 3].every((n) => strengthDays(high, n).every((s, i) => s.slots.every((slot, j) =>
      slot.sets === strengthDays(gppBase, n)[i].slots[j].sets - (j >= 2 ? 1 : 0)
      && slot.reps === strengthDays(gppBase, n)[i].slots[j].reps && slot.target_rpe === strengthDays(gppBase, n)[i].slots[j].target_rpe))));
  check('main lifts, the deload week and the sport/conditioning day are untouched',
    JSON.stringify(week(high, 4)) === JSON.stringify(week(gppBase, 4))
      && JSON.stringify(day(high, 6)) === JSON.stringify(day(gppBase, 6))
      && high.sessions.every((s, i) => s.slots.every((slot, j) => slot.movement_id === gppBase.sessions[i].slots[j].movement_id)));
  check('a very high sport week cuts two sets but never below one',
    strengthDays(veryHigh, 1).every((s, i) => s.slots.every((slot, j) =>
      slot.sets === Math.max(1, strengthDays(gppBase, 1)[i].slots[j].sets - (j >= 2 ? 2 : 0)))));
  const dose = (session) => session.slots.map((slot) => `${slot.sets}x${slot.reps}@${slot.target_rpe}`).join(',');
  check('a very high sport week holds progression: week 3 repeats week 2 instead of stepping up',
    week(veryHigh, 3).every((s, i) => dose(s) === dose(week(veryHigh, 2)[i]))
      && week(gppBase, 3).some((s, i) => dose(s) !== dose(week(gppBase, 2)[i]))
      && JSON.stringify(week(veryHigh, 4)) === JSON.stringify(week(gppBase, 4)));
  check('nothing is ever RAISED by sport workload',
    [light, high, veryHigh].every((block) => block.sessions.every((s, i) => s.slots.every((slot, j) =>
      slot.sets <= gppBase.sessions[i].slots[j].sets && slot.target_rpe <= gppBase.sessions[i].slots[j].target_rpe))));
  const scheduled = [0, 2, 4].map((weekday) => ({ label: 'Training', weekday, expectedDurationMin: 60 }));
  const one = sportOf('other', 'general_support', { otherSportName: 'Netball', practiceSessionsPerWeek: 1, matchesPerWeek: 0 });
  const fromSchedule = plan(gpp, { sport: one, workload: sp.resolveSportWorkload({ scheduled, profile: one }) });
  check('three sessions in the Activities schedule outweigh one stated: the schedule decides',
    JSON.stringify(fromSchedule.sessions) === JSON.stringify(high.sessions)
      && fromSchedule.emphasis.applied.some((line) => /3 weekly sessions in your Activities schedule/.test(line)));
  check('scheduled sessions count even with no sport answer',
    (() => {
      const block = plan(gpp, { workload: sp.resolveSportWorkload({ scheduled, profile: null }) });
      return JSON.stringify(block.sessions) === JSON.stringify(high.sessions);
    })());
  const goalHigh = (() => {
    const sport = sportOf('other', 'general_support', { otherSportName: 'Netball', practiceSessionsPerWeek: 3, matchesPerWeek: 0 });
    return plan(gpp, { sport, workload: workloadOf(sport), goalMovements: [{ movementId: idOf('Walking Lunge'), goalLabel: 'Lunge my bodyweight' }] });
  })();
  check('the exercise a goal names keeps its full dose under a high sport week',
    names(day(goalHigh, 1))[2] === 'Walking Lunge' && day(goalHigh, 1).slots[2].sets === day(gppBase, 1).slots[2].sets
      && day(goalHigh, 2).slots[2].sets === day(gppBase, 2).slots[2].sets - 1);
  const hybrid = profile({ objective: 'hybrid' });
  const hybridBase = plan(hybrid, null);
  const hybridHigh = (() => {
    const sport = sportOf('muay_thai', 'general_support', { practiceSessionsPerWeek: 3, matchesPerWeek: 0 });
    return plan(hybrid, { sport, workload: workloadOf(sport) });
  })();
  check('the hybrid tax and the sport workload cut are never added together (the larger applies)',
    hybridHigh.sessions.every((s, i) => s.slots.every((slot, j) => hybridBase.sessions[i].slots[j].sets - slot.sets <= 1)));
  // A schema and macro phase where the hybrid tax itself is already taking a
  // set off accessories: only then can "added" and "larger of" differ.
  const taxed = [];
  for (const schemaType of ['LINEAR', 'WAVE', 'STEP', 'APRE']) {
    for (let macroBlockIndex = 1; macroBlockIndex <= 8; macroBlockIndex += 1) {
      const cost = gen.schemaFatigueCost(schemaType, gen.macroPhaseOf(macroBlockIndex), false);
      if (cost >= gen.HYBRID_TAX_THRESHOLD && cost < 1.5) taxed.push({ schemaType, macroBlockIndex });
    }
  }
  check('a schema and phase exists where the hybrid tax is exactly one set', taxed.length > 0, JSON.stringify(taxed[0] ?? null));
  const taxedCase = taxed[0];
  const hybridWide = profile({ objective: 'hybrid', weekly_frequency: 5, session_duration_cap_min: 90 });
  const untaxedReference = plan(hybridWide, null, { schemaType: 'LINEAR', macroBlockIndex: 1 });
  const hybridTaxed = plan(hybridWide, null, taxedCase);
  const withWorkload = (n) => {
    const sport = sportOf('muay_thai', 'general_support', { practiceSessionsPerWeek: n, matchesPerWeek: 0 });
    return plan(hybridWide, { sport, workload: workloadOf(sport) }, taxedCase);
  };
  const accessorySets = (block) => week(block).filter((s) => ['lower', 'upper', 'full'].includes(s.focus))
    .flatMap((s) => s.slots.slice(2).map((slot) => slot.sets));
  check('that case has accessory slots on strength days to tax',
    accessorySets(hybridTaxed).length > 0 && accessorySets(untaxedReference).length === accessorySets(hybridTaxed).length);
  check('where the hybrid tax already takes one set, a high sport week takes NO further set (larger of, not the sum)',
    JSON.stringify(withWorkload(3).sessions) === JSON.stringify(hybridTaxed.sessions));
  check('and a very high sport week takes exactly one more (two in total, not three), never below one',
    accessorySets(withWorkload(5)).every((sets, i) => sets === Math.max(1, accessorySets(hybridTaxed)[i] - 1)));
}

// --- [10] time, determinism, held movements, honest report ------------------------------------------------
console.log('[10] time, determinism and honesty');
{
  const cases = [];
  for (const objective of ['hypertrophy', 'strength', 'gpp', 'power', 'endurance', 'hybrid']) {
    for (const cap of [30, 45, 60, 90]) {
      for (const bundle of ['posture', 'beach_muscles', 'lower_body']) {
        const sport = sportOf('basketball', 'jump_higher', { practiceSessionsPerWeek: 4, matchesPerWeek: 1 });
        const prof = profile({ objective, session_duration_cap_min: cap });
        cases.push({ prof, base: plan(prof, null), focused: plan(prof, { focus: fg.focusFromBundle(bundle), sport, workload: workloadOf(sport) }) });
      }
    }
  }
  check('the emphasis never adds a time conflict and never exceeds the session slot budget',
    cases.every(({ prof, base, focused }) => focused.timeBudget.conflicts.length <= base.timeBudget.conflicts.length
      && focused.sessions.every((s) => s.slots.length <= budget.slotBudgetForCap(prof.session_duration_cap_min))),
    `${cases.length} plans`);
  check('every session still fits its limit including preparation',
    cases.every(({ base, focused }) => focused.timeBudget.sessions.every((s, i) => s.feasible || !base.timeBudget.sessions[i].feasible)));
  check('same inputs, same block (deterministic)',
    cases.slice(0, 12).every(({ prof }) => JSON.stringify(plan(prof, { focus: fg.focusFromBundle('posture') }))
      === JSON.stringify(plan(prof, { focus: fg.focusFromBundle('posture') }))));
  check('a session slot keeps its movement across all four weeks',
    cases.every(({ focused }) => [2, 3, 4].every((n) => week(focused, n).every((s, i) =>
      s.slots.map((slot) => slot.movement_id).join(',') === week(focused, 1)[i].slots.map((slot) => slot.movement_id).join(',')))));
  const heldIds = [135, 187];
  const shoulders = plan(profile({ session_duration_cap_min: 90 }), { focus: fg.normalizeFocusSelection({ bundleId: null, muscles: ['shoulders', 'chest'] }).selection });
  check('held movements 135 and 187 are never newly prescribed by the emphasis',
    primaryOf(187).includes('shoulders')
      && cases.every(({ base, focused }) => heldIds.every((id) => !ids(focused).includes(id) || ids(base).includes(id)))
      && heldIds.every((id) => !ids(shoulders).includes(id)));
  // Make 135 and 187 the only movements that could serve a shoulders emphasis:
  // the pool is the baseline plan's own movements minus every shoulder-primary
  // one, plus the two held ids. A spare slot then exists on upper days (the
  // overhead-press slot has nothing to fill it) and an isolation slot on lower
  // days — the two places the emphasis could put them.
  const longBaseline = plan(profile({ session_duration_cap_min: 90 }), null);
  const baselineIds = new Set(longBaseline.sessions.flatMap((s) => s.slots.map((slot) => slot.movement_id)));
  const cornered = movements.filter((m) => heldIds.includes(m.movement_id)
    || (baselineIds.has(m.movement_id) && !primaryOf(m.movement_id).includes('shoulders')));
  const shouldersOnly = { focus: fg.normalizeFocusSelection({ bundleId: null, muscles: ['shoulders'] }).selection };
  const corneredPlan = plan(profile({ session_duration_cap_min: 90 }), shouldersOnly, { movements: cornered });
  check('the cornered pool really offers only the two held movements for shoulders, and leaves a spare slot',
    cornered.filter((m) => primaryOf(m.movement_id).includes('shoulders')).map((m) => m.movement_id).join(',') === '135,187'
      && week(corneredPlan).some((s) => s.focus === 'upper' && s.slots.length < budget.slotBudgetForCap(90))
      && week(corneredPlan).some((s) => s.slots.some((slot) => byId.get(slot.movement_id).pattern === 'isolation')));
  check('even when they are the ONLY option, 135 and 187 are neither swapped in nor given a slot',
    heldIds.every((id) => !corneredPlan.sessions.some((s) => s.slots.some((slot) => slot.movement_id === id))));
  check('and the athlete is told no exercise passed the checks for that area',
    corneredPlan.emphasis.omitted.some((line) => /^No extra shoulders work: no exercise that trains shoulders directly passed/.test(line)));
  // A goal that NAMES a held movement does not get it planned either. The
  // baseline may already contain one by its own ranking; that is not a new
  // prescription and is left alone.
  const heldGoal = (id) => plan(profile({ session_duration_cap_min: 90 }),
    { goalMovements: [{ movementId: id, goalLabel: 'Shoulder raise goal' }] });
  const newlyHeld = heldIds.filter((id) => !baselineIds.has(id));
  check('neither held movement is in the baseline plan, so a goal naming one would be a new prescription',
    newlyHeld.length === heldIds.length, newlyHeld.join(','));
  check('a goal that names 135 or 187 does not put it in the plan',
    newlyHeld.every((id) => !heldGoal(id).sessions.some((s) => s.slots.some((slot) => slot.movement_id === id))));
  check('and the athlete is told that exercise is on hold',
    newlyHeld.every((id) => heldGoal(id).emphasis.omitted.some((line) =>
      /^Your goal "Shoulder raise goal" names .+, but it is not in this plan: that exercise is on hold while its instructions are being corrected.$/.test(line))));
  const everyReport = cases.map(({ focused }) => reportText(focused)).join(' ');
  check('no report promises an outcome', !/guarantee|will prevent|will improve|you will reach|will make you/i.test(everyReport));
  check('every report line is a full sentence in plain language (no ids, no pattern codes)',
    cases.every(({ focused }) => [...focused.emphasis.applied, ...focused.emphasis.omitted].every((line) =>
      /[.]$/.test(line) && !/push_h|pull_h|push_v|pull_v|movement \d+|undefined|null/.test(line))));
  check('the report is versioned and its lines are unique',
    cases.every(({ focused }) => focused.emphasis.version === pe.PROGRAM_EMPHASIS_VERSION
      && new Set(focused.emphasis.applied).size === focused.emphasis.applied.length
      && new Set(focused.emphasis.omitted).size === focused.emphasis.omitted.length));
  check('with nothing set the athlete is told this is the standard plan',
    /No focus, sport or goal exercise is set/.test(pe.NO_EMPHASIS_EXPLANATION));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
