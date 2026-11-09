/**
 * sportProfile.ts — which sport the athlete plays, what they want from it,
 * and how much of it is already in their week (work order 3).
 *
 * Three things, kept apart on purpose:
 *
 *   SPORT OBJECTIVE  — a structured answer: sport, desired outcome, experience.
 *                      It is NOT an activity kind. The Activities schedule
 *                      (064 activity_series) has its own kind list; a sport
 *                      here that the schedule cannot name (Australian
 *                      football, Muay Thai, powerlifting…) is still a real
 *                      answer.
 *   SCHEDULE EVIDENCE — the weekly sport sessions the athlete has actually
 *                      put in their schedule. When it exists it is the
 *                      authority for workload. A number typed during
 *                      onboarding is used only while no schedule exists, and
 *                      the two are never added together.
 *   COMPETITION DATE — context for reminders and goal review. It carries no
 *                      peaking and no maximal-testing authority.
 *
 * Pure: no clock, no storage.
 *
 * Honesty rules encoded here:
 *   - every emphasis names its published basis, or says it is a coaching
 *     convention; where no reviewed basis exists there is NO emphasis;
 *   - an emphasis the movement library cannot serve is reported as a limit,
 *     never silently dropped and never approximated with something else;
 *   - nothing here promises fewer injuries or better performance;
 *   - workload is counted in sessions. No cross-sport "load score" is
 *     invented from duration and effort.
 */
import type { MuscleGroupId } from './focusGoals';

// ---------------------------------------------------------------------------
// Sports
// ---------------------------------------------------------------------------

export const SPORTS = [
  "basketball",
  "court_netball",
  "football_association",
  "football_australian",
  "football_rugby",
  "football_american",
  "hockey_field",
  "hockey_ice",
  "grappling_bjj",
  "grappling_wrestling",
  "grappling_judo",
  "muay_thai",
  "combat_boxing",
  "combat_mma",
  "powerlifting",
  "other",
  "racquet_tennis",
  "racquet_squash",
  "racquet_pickleball",
  "running_sprinting",
  "running_endurance",
  "swimming",
] as const;
export type SportId = (typeof SPORTS)[number];

/** How the first question groups the sports, so "football" and "hockey" are
 *  asked as a family and then told apart explicitly. */
export const SPORT_FAMILIES = ["grappling", "striking", "court", "football", "hockey", "strength", "other", "racquet", "running", "swimming"] as const;
export type SportFamilyId = (typeof SPORT_FAMILIES)[number];

export interface SportInfo {
  readonly label: string;
  readonly family: SportFamilyId;
  /** Shown when the family has more than one code. */
  readonly distinction: string | null;
}

export const SPORT_INFO: Record<SportId, SportInfo> = {
  basketball: { label: "Basketball", family: "court", distinction: "Basketball: you can dribble continuously and, when you catch the ball while moving or after ending a dribble, take two steps to stop, pass or shoot; all five players may use the whole 28 m by 15 m floor, and the backboard keeps rebounding in the game." },
  court_netball: { label: "Netball", family: "court", distinction: "Netball: you must pass or shoot within three seconds; after releasing the ball you cannot touch it again until it touches another player or rebounds from the goalpost, so there is no dribbling; on a one-foot landing you may step with the other foot and pivot on the landing foot, but cannot put the landing foot back down; the court is three equal thirds with each of the seven positions restricted to its own areas, and the goal is a ring on a post with no backboard." },
  football_association: { label: "Football (soccer)", family: "football", distinction: "Association football: round ball, played with the feet." },
  football_australian: { label: "Australian football (AFL)", family: "football", distinction: "Australian rules: oval ball, marking and kicking, an oval field." },
  football_rugby: { label: "Rugby", family: "football", distinction: "Rugby union or rugby league: oval ball, tackling, no forward pass." },
  football_american: { label: "American football", family: "football", distinction: "Gridiron: downs, pads and helmets." },
  hockey_field: { label: "Field hockey", family: "hockey", distinction: "Played on grass or turf." },
  hockey_ice: { label: "Ice hockey", family: "hockey", distinction: "Played on ice, on skates." },
  grappling_bjj: { label: "Brazilian jiu-jitsu", family: "grappling", distinction: "Brazilian jiu-jitsu: the fight continues on the ground and being on your back is a position you can attack from (the guard); matches end by submission or points." },
  grappling_wrestling: { label: "Wrestling", family: "grappling", distinction: "Wrestling: pinning both shoulders ends the match, the bottom position is only a way out, and the contest is built on standing level changes, penetration steps, takedowns and sprawls in short high-intensity periods." },
  grappling_judo: { label: "Judo", family: "grappling", distinction: "Judo: standing throws from a gi grip are the main scoring action, with short groundwork transitions; being thrown is the most common injury mechanism." },
  muay_thai: { label: "Muay Thai", family: "striking", distinction: "Muay Thai: punches, kicks, knees and elbows, with a clinch." },
  combat_boxing: { label: "Boxing", family: "striking", distinction: "Boxing: punches only, with footwork and trunk rotation; no kicks or clinch knees." },
  combat_mma: { label: "Mixed martial arts", family: "striking", distinction: "Mixed martial arts: striking plus cage wrestling and ground grappling, so both the striking and the grappling demands apply at once." },
  powerlifting: { label: "Powerlifting", family: "strength", distinction: null },
  other: { label: "Another sport", family: "other", distinction: null },
  racquet_tennis: { label: "Tennis", family: "racquet", distinction: "Tennis: a net divides a 23.77 m by 8.23 m singles court, there is no player-to-player contact and no elevated target; points are built from serves, groundstrokes and net approaches." },
  racquet_squash: { label: "Squash", family: "racquet", distinction: "Squash: two players share an enclosed four-wall court 9.75 m by 6.40 m and must hit the front wall above the tin, so the ball stays in play off the walls and rallies are continuous." },
  racquet_pickleball: { label: "Pickleball", family: "racquet", distinction: "Pickleball: a 20 ft by 44 ft court with a 7 ft (2.13 m) non-volley zone on each side of the net, where volleying the ball out of the air is a fault." },
  running_sprinting: { label: "Sprinting", family: "running", distinction: "Sprinting: short maximal-speed efforts where acceleration and top speed decide the result, not aerobic capacity." },
  running_endurance: { label: "Distance running", family: "running", distinction: "Distance running: sustained aerobic running where running economy and aerobic capacity decide the result." },
  swimming: { label: "Swimming", family: "swimming", distinction: "Swimming: non-weight-bearing propulsion through water, led by the upper body and trunk with wall push-offs." },
};

export const SPORT_FAMILY_LABEL: Record<SportFamilyId, string> = {
  grappling: "Grappling",
  striking: "Striking",
  court: "Court",
  football: "Football",
  hockey: "Hockey",
  strength: "Strength",
  other: "Another sport",
  racquet: "Racquet",
  running: "Running",
  swimming: "Swimming",
};

const SPORT_SET: ReadonlySet<string> = new Set(SPORTS);
export const isSportId = (value: unknown): value is SportId => typeof value === 'string' && SPORT_SET.has(value);

export const sportsInFamily = (family: SportFamilyId): readonly SportId[] =>
  SPORTS.filter((sport) => SPORT_INFO[sport].family === family);

// ---------------------------------------------------------------------------
// Desired outcomes
// ---------------------------------------------------------------------------

export const SPORT_OUTCOMES = [
  'jump_higher',
  'faster_running',
  'strength_for_contact',
  'stay_available',
  'last_the_whole_game',
  'bigger_competition_lifts',
  'striking_and_clinch',
  'general_support',
] as const;
export type SportOutcomeId = (typeof SPORT_OUTCOMES)[number];

export const SPORT_OUTCOME_LABEL: Record<SportOutcomeId, string> = {
  jump_higher: 'Jump higher',
  faster_running: 'Run faster and change direction',
  strength_for_contact: 'Be stronger in contact',
  stay_available: 'Keep training and playing without long breaks',
  last_the_whole_game: 'Last the whole game',
  bigger_competition_lifts: 'Lift more in the squat, bench press and deadlift',
  striking_and_clinch: 'Be stronger in striking and the clinch',
  general_support: 'General strength for my sport',
};

/** The outcomes offered for each sport. `general_support` is always last and
 *  always available: it is the honest answer when nothing else fits. */
export const SPORT_OUTCOMES_BY_SPORT: Record<SportId, readonly SportOutcomeId[]> = {
  basketball: ["jump_higher", "faster_running", "stay_available", "last_the_whole_game", "general_support"],
  court_netball: ["jump_higher", "faster_running", "stay_available", "last_the_whole_game", "general_support"],
  football_association: ["faster_running", "stay_available", "last_the_whole_game", "general_support"],
  football_australian: ["faster_running", "jump_higher", "strength_for_contact", "stay_available", "last_the_whole_game", "general_support"],
  football_rugby: ["strength_for_contact", "faster_running", "stay_available", "last_the_whole_game", "general_support"],
  football_american: ["strength_for_contact", "faster_running", "jump_higher", "stay_available", "general_support"],
  hockey_field: ["faster_running", "stay_available", "last_the_whole_game", "general_support"],
  hockey_ice: ["strength_for_contact", "stay_available", "last_the_whole_game", "general_support"],
  grappling_bjj: ["strength_for_contact", "stay_available", "last_the_whole_game", "general_support"],
  grappling_wrestling: ["strength_for_contact", "faster_running", "stay_available", "last_the_whole_game", "general_support"],
  grappling_judo: ["strength_for_contact", "stay_available", "last_the_whole_game", "general_support"],
  muay_thai: ["striking_and_clinch", "last_the_whole_game", "stay_available", "general_support"],
  combat_boxing: ["last_the_whole_game", "stay_available", "general_support"],
  combat_mma: ["strength_for_contact", "last_the_whole_game", "stay_available", "general_support"],
  powerlifting: ["bigger_competition_lifts", "general_support"],
  other: ["jump_higher", "faster_running", "strength_for_contact", "stay_available", "last_the_whole_game", "general_support"],
  racquet_tennis: ["faster_running", "stay_available", "last_the_whole_game", "general_support"],
  racquet_squash: ["faster_running", "stay_available", "last_the_whole_game", "general_support"],
  racquet_pickleball: ["faster_running", "stay_available", "last_the_whole_game", "general_support"],
  running_sprinting: ["faster_running", "stay_available", "general_support"],
  running_endurance: ["stay_available", "last_the_whole_game", "faster_running", "general_support"],
  swimming: ["stay_available", "last_the_whole_game", "general_support"],
};

const SPORT_OUTCOME_SET: ReadonlySet<string> = new Set(SPORT_OUTCOMES);
export const isSportOutcomeId = (value: unknown): value is SportOutcomeId =>
  typeof value === 'string' && SPORT_OUTCOME_SET.has(value);

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export const SPORT_EXPERIENCE = ['new', 'under_2_years', '2_to_5_years', 'over_5_years'] as const;
export type SportExperienceId = (typeof SPORT_EXPERIENCE)[number];

export const SPORT_EXPERIENCE_LABEL: Record<SportExperienceId, string> = {
  new: 'I am new to it',
  under_2_years: 'Less than 2 years',
  '2_to_5_years': '2 to 5 years',
  over_5_years: 'More than 5 years',
};

const SPORT_EXPERIENCE_SET: ReadonlySet<string> = new Set(SPORT_EXPERIENCE);
export const isSportExperienceId = (value: unknown): value is SportExperienceId =>
  typeof value === 'string' && SPORT_EXPERIENCE_SET.has(value);

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

export const SPORT_OTHER_NAME_MAX = 40;
export const SPORT_SESSIONS_PER_WEEK_MAX = 14;
export const SPORT_SESSION_MINUTES_MAX = 600;

export interface SportProfileDraft {
  readonly sportId: string;
  /** Required for 'other': what the athlete calls their sport. */
  readonly otherSportName?: string | null;
  readonly outcomeId: string;
  readonly experienceId: string;
  /** Typical practice sessions a week, or null for "not sure". */
  readonly practiceSessionsPerWeek: number | null;
  /** Typical matches, games, bouts or meets a week, or null for "not sure". */
  readonly matchesPerWeek: number | null;
  /** Typical length of one session in minutes, or null for "not sure". */
  readonly typicalSessionMinutes: number | null;
  /** ISO YYYY-MM-DD of the next competition, or null. Context only. */
  readonly competitionDate: string | null;
}

export interface SportProfile {
  readonly sportId: SportId;
  readonly otherSportName: string | null;
  readonly outcomeId: SportOutcomeId;
  readonly experienceId: SportExperienceId;
  readonly practiceSessionsPerWeek: number | null;
  readonly matchesPerWeek: number | null;
  readonly typicalSessionMinutes: number | null;
  readonly competitionDate: string | null;
}

export type SportField =
  | 'sportId' | 'otherSportName' | 'outcomeId' | 'experienceId'
  | 'practiceSessionsPerWeek' | 'matchesPerWeek' | 'typicalSessionMinutes' | 'competitionDate';

export interface SportFieldError { readonly field: SportField; readonly message: string }

export type SportValidation =
  | { readonly ok: true; readonly profile: SportProfile }
  | { readonly ok: false; readonly errors: readonly SportFieldError[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
};
const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** The sport's display name, using the athlete's own word for "another sport". */
export const sportDisplayName = (profile: Pick<SportProfile, 'sportId' | 'otherSportName'>): string =>
  profile.sportId === 'other' && profile.otherSportName !== null && profile.otherSportName.trim().length > 0
    ? profile.otherSportName.trim()
    : SPORT_INFO[profile.sportId].label;

/**
 * Validate a sport answer. "Not sure" (null) is a complete answer for every
 * workload number: nothing is assumed in its place.
 */
export function validateSportProfile(draft: SportProfileDraft, today: string): SportValidation {
  const errors: SportFieldError[] = [];
  if (!isSportId(draft.sportId)) errors.push({ field: 'sportId', message: 'Choose your sport.' });
  const otherName = (draft.otherSportName ?? '').trim();
  if (draft.sportId === 'other' && (otherName.length < 2 || otherName.length > SPORT_OTHER_NAME_MAX)) {
    errors.push({ field: 'otherSportName', message: 'Name your sport.' });
  }
  if (!isSportOutcomeId(draft.outcomeId)
      || (isSportId(draft.sportId) && !SPORT_OUTCOMES_BY_SPORT[draft.sportId].includes(draft.outcomeId))) {
    errors.push({ field: 'outcomeId', message: 'Choose what you want from your training for this sport.' });
  }
  if (!isSportExperienceId(draft.experienceId)) {
    errors.push({ field: 'experienceId', message: 'Choose how long you have played.' });
  }
  if (draft.practiceSessionsPerWeek !== null && !isCount(draft.practiceSessionsPerWeek, SPORT_SESSIONS_PER_WEEK_MAX)) {
    errors.push({ field: 'practiceSessionsPerWeek', message: `Enter practice sessions a week (0 to ${SPORT_SESSIONS_PER_WEEK_MAX}), or choose "Not sure".` });
  }
  if (draft.matchesPerWeek !== null && !isCount(draft.matchesPerWeek, SPORT_SESSIONS_PER_WEEK_MAX)) {
    errors.push({ field: 'matchesPerWeek', message: `Enter matches a week (0 to ${SPORT_SESSIONS_PER_WEEK_MAX}), or choose "Not sure".` });
  }
  if (draft.typicalSessionMinutes !== null
      && (!isCount(draft.typicalSessionMinutes, SPORT_SESSION_MINUTES_MAX) || draft.typicalSessionMinutes < 1)) {
    errors.push({ field: 'typicalSessionMinutes', message: 'Enter the usual length in minutes, or choose "Not sure".' });
  }
  if (draft.competitionDate !== null) {
    if (!isRealIsoDate(draft.competitionDate)) {
      errors.push({ field: 'competitionDate', message: 'Enter the date as year-month-day, or leave it out.' });
    } else if (draft.competitionDate < today) {
      errors.push({ field: 'competitionDate', message: 'That date has passed. Enter your next competition, or leave it out.' });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      sportId: draft.sportId as SportId,
      otherSportName: draft.sportId === 'other' ? otherName : null,
      outcomeId: draft.outcomeId as SportOutcomeId,
      experienceId: draft.experienceId as SportExperienceId,
      practiceSessionsPerWeek: draft.practiceSessionsPerWeek,
      matchesPerWeek: draft.matchesPerWeek,
      typicalSessionMinutes: draft.typicalSessionMinutes,
      competitionDate: draft.competitionDate,
    },
  };
}

// ---------------------------------------------------------------------------
// What the sport answer changes in the gym, and on what basis
// ---------------------------------------------------------------------------

export interface SportBasis {
  /** 'published' = a named study or rulebook; 'convention' = a common
   *  coaching practice with no trial behind this exact use. */
  readonly kind: 'published' | 'convention';
  readonly citation: string;
  readonly finding: string;
}

export const SPORT_SOURCES = {
  suchomel2016: {
    kind: 'published',
    citation: 'Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.',
    finding: 'A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance.',
  },
  markovic2007: {
    kind: 'published',
    citation: 'Markovic G. Does plyometric training improve vertical jump height? A meta-analytical review. Br J Sports Med 2007;41(6):349-355.',
    finding: 'A meta-analysis of 26 studies: plyometric (jump) training improved vertical jump height by about 5 to 9 percent, depending on the jump test.',
  },
  vanDyk2019: {
    kind: 'published',
    citation: 'van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med 2019;53(21):1362.',
    finding: 'Across 15 studies in several sports, programmes that included the Nordic hamstring exercise had about half the rate of hamstring injuries.',
  },
  haroy2019: {
    kind: 'published',
    citation: 'Haroy J, et al. The Adductor Strengthening Programme prevents groin problems among male football players: a cluster-randomised controlled trial. Br J Sports Med 2019;53(3):150.',
    finding: 'In 35 semi-professional football teams, a single adductor exercise (the Copenhagen adduction) was followed by fewer groin problems across the season.',
  },
  tyler2002: {
    kind: 'published',
    citation: 'Tyler TF, et al. The effectiveness of a preseason exercise program to prevent adductor muscle strains in professional ice hockey players. Am J Sports Med 2002;30(5):680-683.',
    finding: 'In one professional ice hockey team, a preseason adductor-strengthening programme for at-risk players was followed by fewer adductor strains.',
  },
  ipfRules: {
    kind: 'published',
    citation: 'International Powerlifting Federation, Technical Rules Book.',
    finding: 'Powerlifting is contested in three lifts: the squat, the bench press and the deadlift.',
  },
  wilson2012: {
    kind: 'published',
    citation: 'Wilson JM, Marin PJ, Rhea MR, Wilson SMC, Loenneke JP, Anderson JC. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 2012;26(8):2293-2307.',
    finding: 'A meta-analysis of 21 studies: the more frequent and the longer the endurance training done alongside lifting, the smaller the strength, size and power gains.',
  },
} as const satisfies Record<string, SportBasis>;

export interface SportEmphasis {
  /** Muscle groups given extra emphasis in the gym. May be empty. */
  readonly muscles: readonly MuscleGroupId[];
  /** Promote the three competition lifts (powerlifting only). */
  readonly competitionLifts: boolean;
  /** One plain sentence saying what the plan does about this outcome. */
  readonly summary: string;
  readonly basis: readonly SportBasis[];
  /** What the app cannot do for this outcome, stated plainly. */
  readonly limits: readonly string[];
}

/** v12 emphasis overrides (owner approval outstanding): the whole result replaces the outcome
 *  branch for that (sport, outcome) pair. A pair absent here inherits the
 *  branch unchanged. */
export const SPORT_EMPHASIS_OVERRIDES: Partial<Record<SportId, Partial<Record<SportOutcomeId, SportEmphasis>>>> = {
  basketball: {
    jump_higher: {
      muscles: ["quadriceps", "glutes", "calves"],
      competitionLifts: false,
      summary: "Extra leg-strength work for quads, glutes and calves, which jumping relies on.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Markovic G. Does plyometric training improve vertical jump height? A meta-analytical review. Br J Sports Med 2007;41(6):349-355.", finding: "A meta-analysis of 26 studies: plyometric (jump) training improved vertical jump height by about 5 to 9 percent, depending on the jump test." }, { kind: "published", citation: "Collings TJ, et al. Reducing the Risk of ACL Injury: an ESSA Position Statement. Sports Med 2026;56(10):2389-2411. PMID 42133198.", finding: "Meta-analyses: structured neuromuscular warm-up programmes reduce ACL injury risk by about 60% in adolescent female soccer, basketball and handball." }],
      limits: ["The exercise library has no jump or plyometric drills yet, so this plan builds the leg strength behind a jump. It does not include jump training itself, which is what the jump-height research tested.", "Jump-landing and balance drills are not in the library, so the landing part of ACL prevention cannot be planned."],
    },
    faster_running: {
      muscles: ["hamstrings", "glutes", "quadriceps"],
      competitionLifts: false,
      summary: "Extra strength work for hamstrings, glutes and quads, which sprinting and changing direction rely on.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Stojanovic E, et al. Activity Demands and Physiological Responses During Basketball Match-Play. Sports Med 2018;48(1):111-135. PMID 29039018.", finding: "During live playing time in 40-minute matches, players travel 5-6 km at average physiological intensities above lactate threshold and 85% of maximal heart rate." }],
      limits: ["The app has no sprint or agility drills. Speed itself is trained by sprinting; this plan builds the strength behind it."],
    },
    stay_available: {
      muscles: ["hamstrings"],
      competitionLifts: false,
      summary: "Extra hamstring-strength work, the most studied strength measure for staying available in running and kicking sports.",
      basis: [{ kind: "published", citation: "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med 2019;53(21):1362.", finding: "Across 15 studies in several sports, programmes that included the Nordic hamstring exercise had about half the rate of hamstring injuries." }, { kind: "published", citation: "Collings TJ, et al. Reducing the Risk of ACL Injury: an ESSA Position Statement. Sports Med 2026;56(10):2389-2411. PMID 42133198.", finding: "Meta-analyses: structured neuromuscular warm-up programmes reduce ACL injury risk by about 60% in adolescent female soccer, basketball and handball." }],
      limits: ["The Nordic curl studied in the hamstring research is rated Advanced in the library. It is planned only when your experience level allows it; otherwise other hamstring exercises are used, which were not what the research tested.", "The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.", "The ACL prevention programmes combine plyometric, strength, balance and agility work; the library cannot deliver most of that, so this emphasis is not a prevention programme."],
    },
  },
  court_netball: {
    jump_higher: {
      muscles: ["quadriceps", "glutes", "calves"],
      competitionLifts: false,
      summary: "Extra leg-strength work for quads, glutes and calves, which jumping relies on.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Markovic G. Does plyometric training improve vertical jump height? A meta-analytical review. Br J Sports Med 2007;41(6):349-355.", finding: "A meta-analysis of 26 studies: plyometric (jump) training improved vertical jump height by about 5 to 9 percent, depending on the jump test." }, { kind: "published", citation: "Whitehead S, et al. Injury risk factors and their priority for mitigation in women's netball. Br J Sports Med 2025;59(5):294-305. PMID 39753322.", finding: "Poor landing technique/mechanics had the highest mitigation priority (median 5)." }, { kind: "published", citation: "Fox AS, Bonacci J, Saunders N. Single-leg squat and netball leap landing. Sports Biomech 2020;19(4):493-509. PMID 30152717.", finding: "Single-leg squat biomechanics associate with netball landing kinematics linked to ACL loading." }],
      limits: ["The exercise library has no jump or plyometric drills yet, so this plan builds the leg strength behind a jump. It does not include jump training itself, which is what the jump-height research tested.", "The netball evidence puts poor landing technique first, and the library has no single-leg catch-and-land or landing-mechanics drills, so that part is not planned."],
    },
    faster_running: {
      muscles: ["hamstrings", "glutes", "quadriceps"],
      competitionLifts: false,
      summary: "Extra strength work for hamstrings, glutes and quads, which sprinting and changing direction rely on.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }],
      limits: ["The app has no sprint or agility drills. Speed itself is trained by sprinting; this plan builds the strength behind it.", "Sprint and change-of-direction drills are not in the library. No netball-specific sprint evidence was reviewed; the basketball match-demand study is not applied here."],
    },
    stay_available: {
      muscles: ["hamstrings"],
      competitionLifts: false,
      summary: "Extra hamstring-strength work, the most studied strength measure for staying available in running and kicking sports.",
      basis: [{ kind: "published", citation: "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med 2019;53(21):1362.", finding: "Across 15 studies in several sports, programmes that included the Nordic hamstring exercise had about half the rate of hamstring injuries." }, { kind: "published", citation: "Whitehead S, et al. Injury risk factors and their priority for mitigation in women's netball. Br J Sports Med 2025;59(5):294-305. PMID 39753322.", finding: "Poor landing technique/mechanics had the highest mitigation priority (median 5)." }, { kind: "published", citation: "Fox AS, Bonacci J, Saunders N. Single-leg squat and netball leap landing. Sports Biomech 2020;19(4):493-509. PMID 30152717.", finding: "Single-leg squat biomechanics associate with netball landing kinematics linked to ACL loading." }, { kind: "published", citation: "Collings TJ, et al. Reducing the Risk of ACL Injury: an ESSA Position Statement. Sports Med 2026;56(10):2389-2411. PMID 42133198.", finding: "Meta-analyses: structured neuromuscular warm-up programmes reduce ACL injury risk by about 60% in adolescent female soccer, basketball and handball." }, { kind: "published", citation: "Belcher S, Whatman C, Brughelli M. A systematic video analysis of 21 anterior cruciate ligament injuries in elite netball players during games. Sports Biomech 2024;23(12):2546-2563. PMID 35129089.", finding: "17 of 21 elite-netball ACL injuries occurred during jump-landing actions, commonly rapid deceleration after jumping to receive a high pass with a wide-base double-footed landing." }],
      limits: ["The Nordic curl studied in the hamstring research is rated Advanced in the library. It is planned only when your experience level allows it; otherwise other hamstring exercises are used, which were not what the research tested.", "The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.", "Poor landing technique has the highest mitigation priority in women's netball and the ACL prevention evidence uses plyometric and balance drills the library lacks. Extra gym sets are not presented as a substitute."],
    },
  },
  grappling_bjj: {
    strength_for_contact: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Strength in contact is whole-body strength, which the plan already trains.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Andreato LV, et al. Physical and Physiological Profiles of Brazilian Jiu-Jitsu Athletes: a Systematic Review. Sports Med Open 2017;3(1):9. PMID 28194734.", finding: "BJJ is intermittent, 4-6 matches/day; VO2max 42-52; maximal, isometric and endurance strength can be associated with success." }, { kind: "published", citation: "James LP, et al. Towards a Determination of the Physiological Characteristics Distinguishing Successful Mixed Martial Arts Athletes. Sports Med 2016;46(10):1525-1551. PMID 26993133.", finding: "Grappling and striking sports differ in force-velocity profile between competition levels; the review reports observed differences, not measured training effects." }],
      limits: ["The app has no contact, tackling or wrestling drills.", "Grip, gi and forearm isometric work, neck work and mat conditioning are not in the library. The strengths linked to success in Brazilian jiu-jitsu are not a gym dose."],
    },
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. The hamstring-injury research behind the default availability emphasis comes from running and kicking sports, so it is not applied to jiu-jitsu; the plan stays general strength.",
      basis: [{ kind: "published", citation: "Scoggin JF 3rd, et al. Assessment of Injuries During Brazilian Jiu-Jitsu Competition. Orthop J Sports Med 2014;2(2):2325967114522184. PMID 26535299.", finding: "9.2 injuries per 1000 exposures; elbow most common; arm bar mechanism; lower risk than judo/wrestling/MMA." }],
      limits: ["Elbow and arm-bar exposure is not trained by the library.", "The app cannot promise fewer injuries or better results."],
    },
  },
  grappling_wrestling: {
    strength_for_contact: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Strength in contact is whole-body strength, which the plan already trains.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Chaabene H, et al. Physical and Physiological Attributes of Wrestlers: An Update. J Strength Cond Res 2017;31(5):1411-1442. PMID 28030533.", finding: "Anaerobic power/capacity discriminate success; maximal dynamic, isometric, explosive strength and strength endurance relate to performance; flexibility is not key." }, { kind: "published", citation: "James LP, et al. Towards a Determination of the Physiological Characteristics Distinguishing Successful Mixed Martial Arts Athletes. Sports Med 2016;46(10):1525-1551. PMID 26993133.", finding: "Grappling and striking sports differ in force-velocity profile between competition levels; the review reports observed differences, not measured training effects." }],
      limits: ["The app has no contact, tackling or wrestling drills.", "Neck and upper-back isometric work, sprawl and penetration-step drills and live wrestling are not in the library."],
    },
    faster_running: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. No reviewed source tested gym sprint work in wrestlers, so the default running emphasis is not applied.",
      basis: [],
      limits: ["The app has no sprint or agility drills, and none is planned for this sport."],
    },
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. The default hamstring emphasis comes from running and kicking sports; no wrestling-specific prevention trial was reviewed, so the plan stays general strength.",
      basis: [{ kind: "published", citation: "Thomas RE, Zamanpour K. Injuries in wrestling: systematic review. Phys Sportsmed 2018;46(2):168-196. PMID 29484899.", finding: "Weighted average competition injury rate 16.3 per 1000 athletic encounters (8/11 studies) and 69.5 per 1000 in database studies (5/27)." }],
      limits: ["Wrestling injury epidemiology was reviewed, but no wrestling-specific injury-prevention trial was reviewed, and the library has no neck, sprawl or penetration-step work.", "The app cannot promise fewer injuries or better results."],
    },
  },
  grappling_judo: {
    strength_for_contact: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Strength in contact is whole-body strength, which the plan already trains.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "Pocecco E, et al. Injuries in judo: a systematic literature review including suggestions for prevention. Br J Sports Med 2013;47(18):1139-1143. PMID 24255909.", finding: "11-12% injury risk at the 2008/2012 Olympics; knee, shoulder, fingers; being thrown the main mechanism." }],
      limits: ["The app has no contact, tackling or wrestling drills.", "Grip, gi and break-fall work are not in the library."],
    },
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Judo injuries concentrate in the knee, shoulder and fingers, mostly from being thrown; the default hamstring emphasis is not judo-specific and is not applied.",
      basis: [{ kind: "published", citation: "Pocecco E, et al. Injuries in judo: a systematic literature review including suggestions for prevention. Br J Sports Med 2013;47(18):1139-1143. PMID 24255909.", finding: "11-12% injury risk at the 2008/2012 Olympics; knee, shoulder, fingers; being thrown the main mechanism." }],
      limits: ["Judo injuries concentrate in the knee, shoulder and fingers, mostly from being thrown; break-fall and grip work are not trained by the library.", "The app cannot promise fewer injuries or better results."],
    },
  },
  combat_boxing: {
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. No boxing-specific injury study was reviewed, so the default running-sport hamstring emphasis is not applied.",
      basis: [],
      limits: ["The app cannot promise fewer injuries or better results."],
    },
  },
  combat_mma: {
    strength_for_contact: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Strength in contact is whole-body strength, which the plan already trains.",
      basis: [{ kind: "published", citation: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", finding: "A review: greater muscular strength is associated with better jumping, sprinting and change-of-direction performance." }, { kind: "published", citation: "James LP, et al. Towards a Determination of the Physiological Characteristics Distinguishing Successful Mixed Martial Arts Athletes. Sports Med 2016;46(10):1525-1551. PMID 26993133.", finding: "Grappling and striking sports differ in force-velocity profile between competition levels; the review reports observed differences, not measured training effects." }],
      limits: ["The app has no contact, tackling or wrestling drills.", "Cage wrestling, clinch and ground work are not in the library."],
    },
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. No MMA-specific injury study was reviewed, so the default running-sport hamstring emphasis is not applied.",
      basis: [],
      limits: ["The app cannot promise fewer injuries or better results."],
    },
  },
  racquet_tennis: {
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. The running-sport hamstring emphasis is not applied: tennis injury research does not show that extra hamstring work prevents tennis injuries, so the plan stays general strength.",
      basis: [{ kind: "published", citation: "Amor-Salamanca A, et al. Risk Factors and Prevention of Musculoskeletal Injuries in Adolescent and Adult High-Performance Tennis Players: A Systematic Review. Sports (Basel) 2025;13(10):336. PMID 41150471.", finding: "High-performance tennis exposes players to repetitive high-load strokes and abrupt directional changes; the review synthesises epidemiology, risk factors and physiotherapy-led prevention." }],
      limits: ["Tennis asks for repeated overhead serving and smashing plus one-sided groundstrokes; the library has shoulder external-rotation and wrist-curl work, but no serve, smash or groundstroke pattern and no on-court drill.", "The app cannot promise fewer injuries or better results."],
    },
  },
  racquet_squash: {
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Squash is built on repeated deep lunges and push-back recovery rather than running volume, so the running-sport hamstring emphasis is not applied and the plan stays general strength.",
      basis: [{ kind: "published", citation: "McCartney RV, Fallon T, Heron N. Squash Under Strain: A Systematic Review and Meta-Analysis of Injuries and Illnesses in Squash Players. Sports (Basel) 2026;14(2):79. PMID 41745681.", finding: "Pooled injury rate 0.74 per 365 athlete-days (95% CI 0.26-2.07) and 2.01 per 1000 athlete-days (95% CI 0.72-5.67), with very high heterogeneity; lower-limb soft-tissue injuries were most common." }],
      limits: ["Squash injuries in the reviewed literature are mostly lower-limb soft-tissue injuries; the library has lunge and leg-strength work, but no squash lunge-and-recovery drill and no on-court conditioning.", "No squash-specific injury-prevention trial was reviewed.", "The app cannot promise fewer injuries or better results."],
    },
  },
  racquet_pickleball: {
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Pickleball is played on a short court with a non-volley zone, so the running-sport hamstring emphasis is not applied and the plan stays general strength.",
      basis: [{ kind: "published", citation: "Bellm EJV, Lindish J, Mourad W, Owoeye OBA. Understanding Upper Extremity Injury Prevalence and Risk in Pickleball Players: A Nationwide Survey. JOSPT Open 2026;4(2):174-180. PMID 42686154.", finding: "689 of 1758 players (39.0%) reported at least one upper-extremity injury in 12 months; 16.2% reported time-loss injuries and chronic overuse was the most cited type (41%)." }],
      limits: ["A nationwide survey of pickleball players reported upper-extremity complaints in 39% of respondents; the library has shoulder-rotation and wrist-curl work, but no paddle-sport overhead or dinking pattern.", "No pickleball-specific injury-prevention trial was reviewed.", "The app cannot promise fewer injuries or better results."],
    },
  },
  running_sprinting: {
    stay_available: {
      muscles: ["hamstrings"],
      competitionLifts: false,
      summary: "Extra hamstring-strength work, the most studied strength measure for staying available in running and kicking sports.",
      basis: [{ kind: "published", citation: "van Dyk N, Behan FP, Whiteley R. Including the Nordic hamstring exercise in injury prevention programmes halves the rate of hamstring injuries: a systematic review and meta-analysis of 8459 athletes. Br J Sports Med 2019;53(21):1362.", finding: "Across 15 studies in several sports, programmes that included the Nordic hamstring exercise had about half the rate of hamstring injuries." }, { kind: "published", citation: "Sano Y, et al. Differential muscle activation patterns and kinematics during the nordic hamstring exercise and the maximum-speed single-leg bridge test. J Sports Sci 2026;44(21):3015-3026. PMID 42711864.", finding: "In 17 healthy male recreational athletes the maximum-speed single-leg bridge test elicited greater peak semitendinosus activation than the Nordic exercise, with activation and external force at longer hamstring lengths; this compares tests, not training effects." }],
      limits: ["The Nordic curl studied in the hamstring research is rated Advanced in the library. It is planned only when your experience level allows it; otherwise other hamstring exercises are used, which were not what the research tested.", "The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.", "The Nordic curl does not reproduce the hip-extended, high-velocity swing of sprinting; the library catalogues running and strength work but no sprint or acceleration drill."],
    },
  },
  running_endurance: {
    last_the_whole_game: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Your Distance running sessions are your sport fitness; the gym plan is kept from crowding them out.",
      basis: [{ kind: "published", citation: "Wilson JM, Marin PJ, Rhea MR, Wilson SMC, Loenneke JP, Anderson JC. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 2012;26(8):2293-2307.", finding: "A meta-analysis of 21 studies: the more frequent and the longer the endurance training done alongside lifting, the smaller the strength, size and power gains." }, { kind: "published", citation: "Denadai BS, et al. Explosive Training and Heavy Weight Training are Effective for Improving Running Economy in Endurance Athletes: A Systematic Review and Meta-Analysis. Sports Med 2017;47(3):545-554. PMID 27497600.", finding: "Explosive (-4.83%) and heavy weight (-3.65%) training produced similar improvements in running economy; isometric training did not reach significance." }],
      limits: ["The app does not plan running or sport-specific conditioning for you.", "The running-economy findings come from added heavy or explosive strength work in trained runners; the library catalogues no plyometric drill."],
    },
  },
  swimming: {
    stay_available: {
      muscles: [],
      competitionLifts: false,
      summary: "No extra emphasis. Swimming injuries concentrate at the shoulder, and Nordic hamstring work does not train a swimmer's shoulder, so the running-sport emphasis is not applied.",
      basis: [{ kind: "published", citation: "Li D, Liu Y. A 45-year global systematic evaluation of musculoskeletal injuries in swimmers: a systematic review and meta-analysis. J Sports Med Phys Fitness 2026;66(1):82-91. PMID 41342747.", finding: "Across 94 studies and 10,973 swimmers, shoulder injuries were reported in 70.2% of studies, knee in 36.1% and arm/forearm in 21.2%." }],
      limits: ["The library has shoulder and upper-back strength work, but no swim-stroke, streamline or pull-pattern exercise.", "No swimming-specific injury-prevention trial was reviewed.", "The app cannot promise fewer injuries or better results."],
    },
  },
};

const NO_PROMISE = 'The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.';

/**
 * What a sport answer changes, by desired OUTCOME (the sport decides which
 * outcomes are offered and adds sport-specific evidence where it exists).
 *
 * Where no reviewed basis exists the emphasis is empty and the summary says
 * so. That is the supported fallback, not a failure.
 */
export function sportEmphasisFor(profile: Pick<SportProfile, 'sportId' | 'outcomeId' | 'otherSportName'>): SportEmphasis {
  const override = SPORT_EMPHASIS_OVERRIDES[profile.sportId]?.[profile.outcomeId];
  if (override) return override;
  const sport = sportDisplayName(profile);
  switch (profile.outcomeId) {
    case 'jump_higher':
      return {
        muscles: ['quadriceps', 'glutes', 'calves'],
        competitionLifts: false,
        summary: 'Extra leg-strength work for quads, glutes and calves, which jumping relies on.',
        basis: [SPORT_SOURCES.suchomel2016, SPORT_SOURCES.markovic2007],
        limits: [
          'The exercise library has no jump or plyometric drills yet, so this plan builds the leg strength behind a jump. It does not include jump training itself, which is what the jump-height research tested.',
        ],
      };
    case 'faster_running':
      return {
        muscles: ['hamstrings', 'glutes', 'quadriceps'],
        competitionLifts: false,
        summary: 'Extra strength work for hamstrings, glutes and quads, which sprinting and changing direction rely on.',
        basis: [SPORT_SOURCES.suchomel2016],
        limits: [
          'The app has no sprint or agility drills. Speed itself is trained by sprinting; this plan builds the strength behind it.',
        ],
      };
    case 'stay_available': {
      const groin = profile.sportId === 'football_association' || profile.sportId === 'hockey_ice';
      return {
        muscles: ['hamstrings'],
        competitionLifts: false,
        summary: 'Extra hamstring-strength work, the most studied strength measure for staying available in running and kicking sports.',
        basis: groin
          ? [SPORT_SOURCES.vanDyk2019, profile.sportId === 'hockey_ice' ? SPORT_SOURCES.tyler2002 : SPORT_SOURCES.haroy2019]
          : [SPORT_SOURCES.vanDyk2019],
        limits: [
          ...(groin ? [
            'Inner-thigh (adductor) strengthening has trial support in your sport, but the exercise library has no adductor-strengthening exercise such as the Copenhagen adduction, so it is not in this plan.',
          ] : []),
          'The Nordic curl studied in the hamstring research is rated Advanced in the library. It is planned only when your experience level allows it; otherwise other hamstring exercises are used, which were not what the research tested.',
          NO_PROMISE,
        ],
      };
    }
    case 'bigger_competition_lifts':
      return {
        muscles: [],
        competitionLifts: true,
        summary: 'The squat, bench press and deadlift are planned as your main lifts whenever your equipment and experience allow.',
        basis: [SPORT_SOURCES.ipfRules],
        limits: [],
      };
    case 'strength_for_contact':
      return {
        muscles: [],
        competitionLifts: false,
        summary: 'No extra emphasis. Strength in contact is whole-body strength, which the plan already trains.',
        basis: [SPORT_SOURCES.suchomel2016],
        limits: ['The app has no contact, tackling or wrestling drills.'],
      };
    case 'last_the_whole_game':
      return {
        muscles: [],
        competitionLifts: false,
        summary: `No extra emphasis. Your ${sport} sessions are your sport fitness; the gym plan is kept from crowding them out.`,
        basis: [SPORT_SOURCES.wilson2012],
        limits: ['The app does not plan running or sport-specific conditioning for you.'],
      };
    case 'striking_and_clinch':
      return {
        muscles: [],
        competitionLifts: false,
        summary: 'No extra emphasis. The app has no reviewed evidence that a particular gym exercise improves striking or clinch strength, so it plans general strength.',
        basis: [],
        limits: ['High-repetition drills such as hip-flexor raises are not added by default; no reviewed source supports a dose for them.'],
      };
    case 'general_support':
    default:
      return {
        muscles: [],
        competitionLifts: false,
        summary: `No extra emphasis. The plan is general strength alongside your ${sport}.`,
        basis: [],
        limits: [],
      };
  }
}

// ---------------------------------------------------------------------------
// Scheduled sport workload
// ---------------------------------------------------------------------------

/** One weekly sport session the athlete has put in their schedule. */
export interface ScheduledSportSession {
  readonly label: string;
  /** 0 = Sunday … 6 = Saturday, as stored in activity_series. */
  readonly weekday: number;
  readonly expectedDurationMin: number | null;
}

export type SportWorkloadSource = 'schedule' | 'stated' | 'none';
export type SportWorkloadTier = 'none' | 'light' | 'high' | 'very_high';

export interface SportWorkload {
  readonly source: SportWorkloadSource;
  readonly sessionsPerWeek: number;
  /** Sum of the durations that are known. Never an estimate for the others. */
  readonly knownMinutesPerWeek: number;
  readonly unknownDurationSessions: number;
  /** Weekdays (0 = Sunday) that carry at least one scheduled session. */
  readonly weekdays: readonly number[];
  readonly tier: SportWorkloadTier;
  /** How the workload was established, in the athlete's terms. */
  readonly description: string;
}

/** Product rule, stated as one: 3 or more sport sessions a week is "high",
 *  5 or more is "very high". The DIRECTION is published (Wilson 2012: more
 *  frequent concurrent training, smaller strength gains); these exact cut
 *  points are not, and are an owner decision. */
export const SPORT_WORKLOAD_HIGH_SESSIONS = 3;
export const SPORT_WORKLOAD_VERY_HIGH_SESSIONS = 5;

export const sportWorkloadTier = (sessionsPerWeek: number): SportWorkloadTier =>
  sessionsPerWeek >= SPORT_WORKLOAD_VERY_HIGH_SESSIONS ? 'very_high'
    : sessionsPerWeek >= SPORT_WORKLOAD_HIGH_SESSIONS ? 'high'
      : sessionsPerWeek >= 1 ? 'light' : 'none';

const plural = (count: number, word: string, many = `${word}s`): string => `${count} ${count === 1 ? word : many}`;

/**
 * Establish the weekly sport workload.
 *
 * The schedule is evidence: when the athlete has weekly sessions in
 * Activities, those are counted and the onboarding numbers are ignored. The
 * stated numbers are used only when the schedule is empty. They are never
 * added together, so a session cannot be counted twice.
 */
export function resolveSportWorkload(input: {
  readonly scheduled: readonly ScheduledSportSession[];
  readonly profile: Pick<SportProfile, 'practiceSessionsPerWeek' | 'matchesPerWeek' | 'typicalSessionMinutes'> | null;
}): SportWorkload {
  if (input.scheduled.length > 0) {
    const known = input.scheduled.filter((session) => session.expectedDurationMin !== null);
    const sessionsPerWeek = input.scheduled.length;
    return {
      source: 'schedule',
      sessionsPerWeek,
      knownMinutesPerWeek: known.reduce((sum, session) => sum + (session.expectedDurationMin ?? 0), 0),
      unknownDurationSessions: sessionsPerWeek - known.length,
      weekdays: [...new Set(input.scheduled.map((session) => session.weekday))].sort((a, b) => a - b),
      tier: sportWorkloadTier(sessionsPerWeek),
      // Named, so the athlete can see exactly what was counted.
      description: `${plural(sessionsPerWeek, 'weekly session')} in your Activities schedule (${[...new Set(input.scheduled.map((session) => session.label))].join(', ')})`,
    };
  }
  const practice = input.profile?.practiceSessionsPerWeek ?? null;
  const matches = input.profile?.matchesPerWeek ?? null;
  if (practice === null && matches === null) {
    return {
      source: 'none', sessionsPerWeek: 0, knownMinutesPerWeek: 0, unknownDurationSessions: 0, weekdays: [],
      tier: 'none',
      description: input.profile === null
        ? 'no sport sessions recorded'
        : 'you were not sure how often you train and play, and nothing is in your Activities schedule',
    };
  }
  const sessionsPerWeek = (practice ?? 0) + (matches ?? 0);
  const minutes = input.profile?.typicalSessionMinutes ?? null;
  return {
    source: 'stated',
    sessionsPerWeek,
    knownMinutesPerWeek: minutes === null ? 0 : minutes * sessionsPerWeek,
    unknownDurationSessions: minutes === null ? sessionsPerWeek : 0,
    weekdays: [],
    tier: sportWorkloadTier(sessionsPerWeek),
    description: `${practice === null ? 'practice not sure' : plural(practice, 'practice session')} and ${matches === null ? 'matches not sure' : plural(matches, 'match', 'matches')} a week, as you told the app`,
  };
}

// MULTISPORT_WORKLOAD: sessions are summed across active sports; the mobility
// tag is excluded upstream by the store query. Interference follows v13: with a
// running/sprinting/swimming sport beside a contact, court or grappling sport
// and a strength objective, main lifts keep their sets and lower-body
// accessories lose 1 set at high and 2 at very high workload.
export interface MultiSportInterference {
  readonly activeSports: readonly SportId[];
  readonly endurancePlusContact: boolean;
  readonly mainLiftsKeepSets: true;
  readonly lowBodyAccessorySetDelta: 0 | -1 | -2;
  readonly spacingNote: string | null;
}

export interface MultiSportWorkload extends SportWorkload {
  readonly interference: MultiSportInterference;
}

const ENDURANCE_SPORTS: ReadonlySet<SportId> = new Set(['running_sprinting', 'running_endurance', 'swimming']);
const CONTACT_OR_COURT_SPORTS: ReadonlySet<SportId> = new Set([
  'basketball', 'court_netball', 'football_association', 'football_australian', 'football_rugby',
  'football_american', 'hockey_field', 'hockey_ice', 'grappling_bjj', 'grappling_wrestling', 'grappling_judo',
  'combat_boxing', 'combat_mma',
]);
const STRENGTH_OUTCOMES: ReadonlySet<SportOutcomeId> = new Set(['strength_for_contact', 'bigger_competition_lifts']);

/** v13's UNIQUE(sport_id) across ranks, enforced in code because 076's
 *  table rebuild makes a cross-table SQL trigger unsafe (see 077). */
/** Rank-1 must exist and the two sports must differ. This is the single
 *  production guard a secondary-profile save path must call; the schema cannot
 *  carry it (see 077: 076 rebuilds the primary table, so an FK with CASCADE
 *  would delete the Rank-2 row and a RESTRICT/trigger would break the rename). */
export function assertSecondarySportAllowed(
  primarySportId: SportId | null,
  secondarySportId: SportId | null,
): void {
  if (secondarySportId === null) return;
  if (primarySportId === null) throw new Error('secondary sport requires a primary sport');
  assertDistinctSecondarySport(primarySportId, secondarySportId);
}

export function assertDistinctSecondarySport(
  primarySportId: SportId,
  secondarySportId: SportId | null,
): void {
  if (secondarySportId !== null && secondarySportId === primarySportId) {
    throw new Error('secondary sport must differ from primary sport');
  }
}

export function resolveMultiSportWorkload(input: {
  readonly scheduled: readonly ScheduledSportSession[];
  readonly profiles: readonly SportProfile[];
}): MultiSportWorkload {
  if (input.profiles.length >= 2) {
    assertSecondarySportAllowed(input.profiles[0].sportId, input.profiles[1].sportId);
  }
  const activeSports = [...new Set(input.profiles.map((profile) => profile.sportId))];
  let sessionsPerWeek: number;
  let source: SportWorkload['source'];
  if (input.scheduled.length > 0) {
    sessionsPerWeek = input.scheduled.length;
    source = 'schedule';
  } else if (input.profiles.length > 0) {
    sessionsPerWeek = input.profiles.reduce(
      (sum, profile) => sum + (profile.practiceSessionsPerWeek ?? 0) + (profile.matchesPerWeek ?? 0), 0);
    source = 'stated';
  } else {
    sessionsPerWeek = 0;
    source = 'none';
  }
  const tier = sportWorkloadTier(sessionsPerWeek);
  const known = input.scheduled.filter((session) => session.expectedDurationMin !== null);
  const endurancePlusContact = activeSports.some((sport) => ENDURANCE_SPORTS.has(sport))
    && activeSports.some((sport) => CONTACT_OR_COURT_SPORTS.has(sport));
  const strengthObjective = input.profiles.some((profile) => STRENGTH_OUTCOMES.has(profile.outcomeId));
  const lowBodyAccessorySetDelta: 0 | -1 | -2 = !endurancePlusContact || !strengthObjective
    ? 0
    : tier === 'very_high' ? -2 : tier === 'high' ? -1 : 0;
  return {
    source,
    sessionsPerWeek,
    knownMinutesPerWeek: known.reduce((sum, session) => sum + (session.expectedDurationMin ?? 0), 0),
    unknownDurationSessions: input.scheduled.length - known.length,
    weekdays: [...new Set(input.scheduled.map((session) => session.weekday))].sort((a, b) => a - b),
    tier,
    description: sessionsPerWeek === 0
      ? 'no sport sessions recorded'
      : `${plural(sessionsPerWeek, 'weekly session')} across ${plural(activeSports.length, 'active sport')}`,
    interference: {
      activeSports,
      endurancePlusContact,
      mainLiftsKeepSets: true,
      lowBodyAccessorySetDelta,
      spacingNote: lowBodyAccessorySetDelta === 0
        ? null
        : 'Separate heavy lower-body strength and hard runs or sparring by at least 6-24 hours where possible.',
    },
  };
}

export interface SportWorkloadEffect {
  /** Working sets removed from each accessory exercise on strength days. */
  readonly accessorySetCut: 0 | 1 | 2;
  /** The hardest week repeats the week before it instead of stepping up. */
  readonly holdHardestWeek: boolean;
  readonly explanation: string;
}

/**
 * What the workload changes in a NEW block. Sets come off accessories only,
 * the main lifts keep their exercises and their sets, and the deload week is
 * never touched. At the highest tier the week-3 step-up is withheld for the
 * WHOLE session, main lifts included: they repeat week 2. Nothing here raises
 * anything.
 */
export function sportWorkloadEffect(workload: SportWorkload): SportWorkloadEffect {
  const lead = `Sport workload: ${workload.description}.`;
  switch (workload.tier) {
    case 'very_high':
      return {
        accessorySetCut: 2,
        holdHardestWeek: true,
        explanation: `${lead} That is a very full week, so each accessory exercise has two fewer sets, and week 3 of the block repeats week 2 instead of stepping up — for every exercise, your main lifts included. Your main lifts keep their exercises and their sets.`,
      };
    case 'high':
      return {
        accessorySetCut: 1,
        holdHardestWeek: false,
        explanation: `${lead} To leave room for it, each accessory exercise has one fewer set. Your main lifts and the weekly progression are unchanged.`,
      };
    case 'light':
      return {
        accessorySetCut: 0,
        holdHardestWeek: false,
        explanation: `${lead} That does not change the gym plan.`,
      };
    case 'none':
    default:
      return {
        accessorySetCut: 0,
        holdHardestWeek: false,
        explanation: `${lead} The gym plan is not adjusted for sport workload. Add your weekly sessions in Activities and the next block counts them. A light week does not change the gym plan. A full week takes one set off each accessory exercise. A very full week takes two sets off each accessory exercise, and week 3 repeats week 2 for every exercise, main lifts included.`,
      };
  }
}

/** A competition date is context only. This is the whole of what it is used for. */
export const COMPETITION_DATE_NOTE = 'The date is used for reminders and for reviewing your goals. It does not make the plan peak, taper or test a maximum.';
