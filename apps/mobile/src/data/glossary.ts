/**
 * glossary.ts — Canonical Learning Glossary for S&C terminology.
 *
 * Single source of truth for inline InfoTip components and the offline
 * Glossary screen. No network requests, no remote wiki dependencies.
 */

export type GlossaryCategory =
  | 'effort'
  | 'loading'
  | 'structure'
  | 'role'
  | 'goal'
  | 'movement'
  | 'metric'
  | 'general';

export interface GlossaryEntry {
  readonly id: string;
  readonly term: string;
  readonly category: GlossaryCategory;
  readonly definition: string;
  readonly aliases?: readonly string[];
}

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  // --- Effort ---
  {
    id: 'RPE',
    term: 'RPE',
    category: 'effort',
    definition:
      'Rate of Perceived Exertion, 1–10 scale. A 10 means no more reps could be completed; an 8 means about two clean reps remained in reserve. The cap is a ceiling, not a target.',
    aliases: ['rate of perceived exertion', 'effort rating', 'rpe scale'],
  },
  {
    id: 'RIR',
    term: 'RIR',
    category: 'effort',
    definition:
      'Reps in Reserve — how many more clean repetitions you could have completed before technical failure. 0 RIR means no more clean reps.',
    aliases: ['reps in reserve', 'clean reps', 'clean reps left'],
  },
  {
    id: 'TARGET RPE',
    term: 'TARGET RPE',
    category: 'effort',
    definition:
      'The planned effort ceiling prescribed for a set. It guides intended intensity, but is never assumed to be your actual effort.',
    aliases: ['target rpe', 'planned rpe', 'prescribed rpe'],
  },
  {
    id: 'ACTUAL RPE',
    term: 'ACTUAL RPE',
    category: 'effort',
    definition:
      'The effort you actually experienced on a completed set, reported directly by you or translated from your clean reps in reserve.',
    aliases: ['actual rpe', 'reported rpe', 'logged rpe'],
  },
  {
    id: 'RPE CAP',
    term: 'RPE CAP',
    category: 'effort',
    definition:
      'The maximum effort ceiling permitted for a session or block. Sets should stay at or below this number.',
    aliases: ['rpe cap', 'rpe ceiling', 'effort ceiling'],
  },
  {
    id: 'RPE START',
    term: 'RPE START',
    category: 'effort',
    definition:
      'Where the first working set should sit. Not a maximum — the block builds from here.',
    aliases: ['rpe start', 'starting rpe'],
  },
  {
    id: 'RPE MAX',
    term: 'RPE MAX',
    category: 'effort',
    definition:
      'The hardest any set should feel this block. A ceiling, not a target.',
    aliases: ['rpe max', 'maximum rpe', 'highest rpe'],
  },

  // --- Metrics & Prescription ---
  {
    id: '1RM',
    term: '1RM',
    category: 'metric',
    definition:
      'One-rep max — the heaviest load you can lift once with solid form. Target weights are calculated from it, so keep it honest and current.',
    aliases: ['one-rep max', 'one rep max', '1-rm', 'max lift'],
  },
  {
    id: 'LOAD',
    term: 'LOAD',
    category: 'metric',
    definition:
      'Multiplier on your planned working weights. ×0.85 means take 15% off the bar today.',
    aliases: ['load multiplier', 'weight multiplier', 'intensity multiplier'],
  },
  {
    id: 'SETS',
    term: 'SETS',
    category: 'metric',
    definition:
      'Adjustment to your planned set count per movement. −1 means drop one set across the board.',
    aliases: ['set count', 'planned sets'],
  },
  {
    id: 'REPS',
    term: 'REPS',
    category: 'metric',
    definition:
      'Repetitions — the number of times you perform an exercise movement consecutively within a single set.',
    aliases: ['repetitions', 'rep count'],
  },
  {
    id: 'TONNAGE',
    term: 'TONNAGE',
    category: 'metric',
    definition:
      'Total work for the session: reps × load, summed over every set.',
    aliases: ['volume load', 'total work', 'session tonnage'],
  },
  {
    id: 'ACWR',
    term: 'ACWR',
    category: 'metric',
    definition:
      'Acute:Chronic Workload Ratio — recent recorded external load compared with the preceding four-week average. Bodyweight, conditioning, grappling, and unlogged training may be incomplete.',
    aliases: ['workload ratio', 'acute chronic ratio'],
  },
  {
    id: 'ATP-PC',
    term: 'ATP-PC',
    category: 'metric',
    definition:
      'The phosphagen energy system — maximal efforts under ~10 seconds (heavy singles, sprints, throws).',
    aliases: ['phosphagen', 'alactic system'],
  },
  {
    id: 'READINESS',
    term: 'READINESS',
    category: 'metric',
    definition:
      'A subjective and contextual signal of how prepared you feel to train today. A guide for daily adjustments, not an absolute guarantee of performance.',
    aliases: ['readiness score', 'daily readiness', 'recovery signal'],
  },
  {
    id: 'HRV',
    term: 'HRV',
    category: 'metric',
    definition:
      'Heart Rate Variability — beat-to-beat variation in heart rhythm. A contextual trend signal reflecting training and life stress, not a diagnosis or proof of recovery.',
    aliases: ['heart rate variability', 'hrv score', 'recovery trend'],
  },

  // --- Loading Methods ---
  {
    id: 'LINEAR',
    term: 'LINEAR',
    category: 'loading',
    definition:
      'Load climbs steadily week to week. The simplest progression and the best starting point.',
    aliases: ['linear loading', 'linear progression'],
  },
  {
    id: 'UNDULATING',
    term: 'Undulating',
    category: 'loading',
    definition:
      'Reps and effort trade off across the block, with a shorter, harder middle week between two longer, easier ones.',
    aliases: ['wave', 'wave loading'],
  },
  {
    id: 'STEP',
    term: 'STEP',
    category: 'loading',
    definition:
      'The same load for a stretch of weeks, then a single jump up. Good when technique needs time.',
    aliases: ['step loading', 'step progression'],
  },
  {
    id: 'APRE',
    term: 'APRE',
    category: 'loading',
    definition:
      "Autoregulated. The set you actually perform decides the next set's load, so a bad day costs less.",
    aliases: ['autoregulated', 'autoregulation', 'apre loading'],
  },
  {
    id: 'DELOAD',
    term: 'DELOAD',
    category: 'loading',
    definition:
      'A planned easy week. Sets drop and the RPE cap comes down so you absorb the block instead of digging a hole.',
    aliases: ['deload week', 'recovery week', 'unloading'],
  },

  // --- Structure ---
  {
    id: 'BLOCK',
    term: 'BLOCK',
    category: 'structure',
    definition:
      'Four to six weeks of training that build on each other, ending in a deload.',
    aliases: ['training block', 'mesocycle'],
  },
  {
    id: 'MICROCYCLE',
    term: 'MICROCYCLE',
    category: 'structure',
    definition:
      'One week inside a block — the repeating pattern of days.',
    aliases: ['training week', 'weekly microcycle'],
  },
  {
    id: 'MACROCYCLE',
    term: 'MACROCYCLE',
    category: 'structure',
    definition:
      'The long arc, eight blocks, that carries you from general fitness toward a peak.',
    aliases: ['macro-cycle', 'macro cycle', 'long term plan'],
  },
  {
    id: 'BUILD',
    term: 'BUILD',
    category: 'structure',
    definition:
      'Volume weeks. More total work at moderate effort to accumulate fitness.',
    aliases: ['accumulation phase', 'volume block'],
  },
  {
    id: 'INTENSIFICATION',
    term: 'INTENSIFICATION',
    category: 'structure',
    definition:
      "Volume comes down, effort goes up. You do less work but it's harder.",
    aliases: ['intensification phase', 'transmutation'],
  },
  {
    id: 'REALISE',
    term: 'REALISE',
    category: 'structure',
    definition:
      "The peak week. Lowest volume, highest effort — this is where the block's work shows up.",
    aliases: ['realization phase', 'peak week', 'realize'],
  },

  // --- Goals ---
  {
    id: 'STRENGTH',
    term: 'STRENGTH',
    category: 'goal',
    definition:
      'Maximal force production against heavy external resistance with high movement control.',
    aliases: ['maximal strength', 'strength training'],
  },
  {
    id: 'HYPERTROPHY',
    term: 'HYPERTROPHY',
    category: 'goal',
    definition:
      'Muscle growth and volume accumulation through targeted mechanical tension and muscular fatigue.',
    aliases: ['muscle building', 'mass building'],
  },
  {
    id: 'POWER',
    term: 'POWER',
    category: 'goal',
    definition:
      'Speed and rate of force development — moving a load or your body with explosive intent.',
    aliases: ['explosive power', 'rate of force development'],
  },
  {
    id: 'ENDURANCE',
    term: 'ENDURANCE',
    category: 'goal',
    definition:
      'Sustained muscular work and cardiovascular capacity over extended durations.',
    aliases: ['stamina', 'aerobic capacity', 'muscular endurance'],
  },
  {
    id: 'GPP',
    term: 'GPP',
    category: 'goal',
    definition:
      'General Physical Preparedness — broad, balanced fitness (strength, conditioning, mobility) rather than peaking for one quality.',
    aliases: ['general physical preparedness', 'all round fitness'],
  },
  {
    id: 'HYBRID',
    term: 'HYBRID',
    category: 'goal',
    definition:
      'Blended training combining strength and endurance qualities concurrently within one balanced plan.',
    aliases: ['concurrent training', 'hybrid athlete'],
  },
  {
    id: 'RETURN TO TRAINING',
    term: 'RETURN TO TRAINING',
    category: 'goal',
    definition:
      'Gradual, progressive rebuilding of training tolerance and movement confidence after time off or injury.',
    aliases: ['return to training', 'reconditioning', 'rehab progression'],
  },

  // --- Slot Roles ---
  {
    id: 'MAJOR',
    term: 'MAJOR',
    category: 'role',
    definition:
      'The main lift of the day. Everything else is arranged around it.',
    aliases: ['main lift', 'primary movement'],
  },
  {
    id: 'SUPPLEMENTARY',
    term: 'SUPPLEMENTARY',
    category: 'role',
    definition:
      'Direct support for the major — same pattern, different angle or implement.',
    aliases: ['secondary lift', 'assistance exercise'],
  },
  {
    id: 'ACCESSORY',
    term: 'ACCESSORY',
    category: 'role',
    definition:
      'Smaller work for a specific muscle or weak point. First to be cut when time is short.',
    aliases: ['accessory lift', 'isolation work'],
  },
  {
    id: 'CONDITIONAL',
    term: 'CONDITIONAL',
    category: 'role',
    definition:
      'Only appears when a condition is met — an injury restriction, or equipment you have today.',
    aliases: ['conditional lift', 'situational exercise'],
  },

  // --- Movement Patterns ---
  {
    id: 'SQUAT',
    term: 'SQUAT',
    category: 'movement',
    definition:
      'Knees bend and hips drop straight down. Quads and glutes do the work.',
    aliases: ['squat pattern', 'knee flexion'],
  },
  {
    id: 'LUNGE',
    term: 'LUNGE',
    category: 'movement',
    definition:
      'One leg in front of the other. Builds single-leg strength and balance the squat can hide.',
    aliases: ['lunge pattern', 'split squat', 'single leg'],
  },
  {
    id: 'HINGE',
    term: 'HINGE',
    category: 'movement',
    definition:
      'Hips push back with a flat back, knees only slightly bent. Hamstrings and glutes.',
    aliases: ['hip hinge', 'deadlift pattern', 'posterior chain'],
  },
  {
    id: 'HORIZONTAL PUSH',
    term: 'HORIZONTAL PUSH',
    category: 'movement',
    definition:
      'Pressing away from your chest — bench press, push-up. Chest, front shoulder, triceps.',
    aliases: ['chest press', 'push-up', 'horizontal press'],
  },
  {
    id: 'ROW',
    term: 'ROW',
    category: 'movement',
    definition:
      'Pulling toward your stomach. Mid-back and lats. The balance to horizontal pushing.',
    aliases: ['horizontal pull', 'rowing pattern'],
  },
  {
    id: 'OVERHEAD PRESS',
    term: 'OVERHEAD PRESS',
    category: 'movement',
    definition:
      'Pressing above your head. Shoulders and triceps, with the trunk holding you steady.',
    aliases: ['vertical push', 'shoulder press', 'overhead'],
  },
  {
    id: 'VERTICAL PULL',
    term: 'VERTICAL PULL',
    category: 'movement',
    definition:
      'Pulling down from above — pull-up, lat pulldown. Lats and biceps.',
    aliases: ['vertical pull pattern', 'pull-up', 'lat pulldown'],
  },
  {
    id: 'CARRY',
    term: 'CARRY',
    category: 'movement',
    definition:
      'Holding a load and walking. Trains the grip and trunk under time, not reps.',
    aliases: ['loaded carry', "farmer's walk", 'carry pattern'],
  },
] as const;

/** Alias for backward compatibility and alternate naming */
export const glossary: readonly GlossaryEntry[] = GLOSSARY_ENTRIES;

/**
 * Retrieve a canonical glossary entry by its ID, visible term, or alias.
 * Case-insensitive. Returns undefined if not found.
 */
export function getGlossaryEntry(key: string): GlossaryEntry | undefined {
  if (!key || typeof key !== 'string') return undefined;
  const normalized = key.trim().toLowerCase();
  if (!normalized) return undefined;

  // 1. Direct match on id or term
  const exact = GLOSSARY_ENTRIES.find(
    (entry) =>
      entry.id.toLowerCase() === normalized ||
      entry.term.toLowerCase() === normalized,
  );
  if (exact) return exact;

  // 2. Direct match on aliases
  const aliasMatch = GLOSSARY_ENTRIES.find((entry) =>
    entry.aliases?.some((alias) => alias.toLowerCase() === normalized),
  );
  if (aliasMatch) return aliasMatch;

  // 3. Special legacy keys
  if (normalized === 'wave') {
    return GLOSSARY_ENTRIES.find((entry) => entry.id === 'UNDULATING');
  }
  if (normalized === 'macro-cycle' || normalized === 'macro cycle') {
    return GLOSSARY_ENTRIES.find((entry) => entry.id === 'MACROCYCLE');
  }

  return undefined;
}

/**
 * Search the glossary offline across term, aliases, category, and definition.
 * Case-insensitive with predictable sorting.
 * If query is empty or whitespace, returns all entries sorted alphabetically by term.
 */
export function searchGlossary(query: string): readonly GlossaryEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...GLOSSARY_ENTRIES].sort((a, b) => a.term.localeCompare(b.term));
  }

  return GLOSSARY_ENTRIES.filter((entry) => {
    if (entry.term.toLowerCase().includes(normalized)) return true;
    if (entry.id.toLowerCase().includes(normalized)) return true;
    if (entry.category.toLowerCase().includes(normalized)) return true;
    if (entry.definition.toLowerCase().includes(normalized)) return true;
    if (entry.aliases?.some((alias) => alias.toLowerCase().includes(normalized))) {
      return true;
    }
    return false;
  }).sort((a, b) => {
    const aTermLower = a.term.toLowerCase();
    const bTermLower = b.term.toLowerCase();
    const aExact = aTermLower === normalized;
    const bExact = bTermLower === normalized;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aTermLower.startsWith(normalized);
    const bStarts = bTermLower.startsWith(normalized);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return a.term.localeCompare(b.term);
  });
}
