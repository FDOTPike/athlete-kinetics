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
  'basketball',
  'football_association',
  'football_australian',
  'football_rugby',
  'football_american',
  'hockey_field',
  'hockey_ice',
  'powerlifting',
  'muay_thai',
  'other',
] as const;
export type SportId = (typeof SPORTS)[number];

/** How the first question groups the sports, so "football" and "hockey" are
 *  asked as a family and then told apart explicitly. */
export const SPORT_FAMILIES = ['basketball', 'football', 'hockey', 'powerlifting', 'muay_thai', 'other'] as const;
export type SportFamilyId = (typeof SPORT_FAMILIES)[number];

export interface SportInfo {
  readonly label: string;
  readonly family: SportFamilyId;
  /** Shown when the family has more than one code. */
  readonly distinction: string | null;
}

export const SPORT_INFO: Record<SportId, SportInfo> = {
  basketball: { label: 'Basketball', family: 'basketball', distinction: null },
  football_association: { label: 'Football (soccer)', family: 'football', distinction: 'Association football: round ball, played with the feet.' },
  football_australian: { label: 'Australian football (AFL)', family: 'football', distinction: 'Australian rules: oval ball, marking and kicking, an oval field.' },
  football_rugby: { label: 'Rugby', family: 'football', distinction: 'Rugby union or rugby league: oval ball, tackling, no forward pass.' },
  football_american: { label: 'American football', family: 'football', distinction: 'Gridiron: downs, pads and helmets.' },
  hockey_field: { label: 'Field hockey', family: 'hockey', distinction: 'Played on grass or turf.' },
  hockey_ice: { label: 'Ice hockey', family: 'hockey', distinction: 'Played on ice, on skates.' },
  powerlifting: { label: 'Powerlifting', family: 'powerlifting', distinction: null },
  muay_thai: { label: 'Muay Thai', family: 'muay_thai', distinction: null },
  other: { label: 'Another sport', family: 'other', distinction: null },
};

export const SPORT_FAMILY_LABEL: Record<SportFamilyId, string> = {
  basketball: 'Basketball',
  football: 'Football',
  hockey: 'Hockey',
  powerlifting: 'Powerlifting',
  muay_thai: 'Muay Thai',
  other: 'Another sport',
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
  basketball: ['jump_higher', 'faster_running', 'stay_available', 'last_the_whole_game', 'general_support'],
  football_association: ['faster_running', 'stay_available', 'last_the_whole_game', 'general_support'],
  football_australian: ['faster_running', 'jump_higher', 'strength_for_contact', 'stay_available', 'last_the_whole_game', 'general_support'],
  football_rugby: ['strength_for_contact', 'faster_running', 'stay_available', 'last_the_whole_game', 'general_support'],
  football_american: ['strength_for_contact', 'faster_running', 'jump_higher', 'stay_available', 'general_support'],
  hockey_field: ['faster_running', 'stay_available', 'last_the_whole_game', 'general_support'],
  hockey_ice: ['strength_for_contact', 'stay_available', 'last_the_whole_game', 'general_support'],
  powerlifting: ['bigger_competition_lifts', 'general_support'],
  muay_thai: ['striking_and_clinch', 'last_the_whole_game', 'stay_available', 'general_support'],
  other: ['jump_higher', 'faster_running', 'strength_for_contact', 'stay_available', 'last_the_whole_game', 'general_support'],
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

const NO_PROMISE = 'The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.';

/**
 * What a sport answer changes, by desired OUTCOME (the sport decides which
 * outcomes are offered and adds sport-specific evidence where it exists).
 *
 * Where no reviewed basis exists the emphasis is empty and the summary says
 * so. That is the supported fallback, not a failure.
 */
export function sportEmphasisFor(profile: Pick<SportProfile, 'sportId' | 'outcomeId' | 'otherSportName'>): SportEmphasis {
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
        explanation: `${lead} The gym plan is not adjusted for sport workload. Add your weekly sessions in Activities and the next block will take them into account.`,
      };
  }
}

/** A competition date is context only. This is the whole of what it is used for. */
export const COMPETITION_DATE_NOTE = 'The date is used for reminders and for reviewing your goals. It does not make the plan peak, taper or test a maximum.';
