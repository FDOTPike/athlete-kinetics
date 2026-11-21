'use strict';

/**
 * Multi-sport emphasis, workload and flexibility tagging (WO-03C).
 *
 * Author: deepseek-v4.1-flash-1017 via Hermes
 */

const {
  makeMultiSportEmphasisIndex,
  MAX_EMPHASIS_MUSCLES,
  SECONDARY_SPORT_WEIGHT,
  resolveMultiSportWorkload,
  assertDistinctSecondarySport,
  assertSecondarySportAllowed,
} = require('@ak/inference');

const emphasis = {
  focus: { muscles: ['quadriceps'], movementControl: false },
  sport: { name: 'Brazilian jiu-jitsu', muscles: ['hamstrings', 'upper_back'] },
  roles: [
    { movementId: 1, muscleGroupId: 'quadriceps', role: 'primary' },
    { movementId: 2, muscleGroupId: 'hamstrings', role: 'primary' },
    { movementId: 3, muscleGroupId: 'calves', role: 'primary' },
  ],
};

describe('multi-sport emphasis index', () => {
  test('orders focus, primary sport, then secondary sport without relabelling', () => {
    const index = makeMultiSportEmphasisIndex({
      emphasis,
      secondaryMuscles: ['calves', 'hamstrings', 'glutes'],
    });
    expect(index.muscles.slice(0, 3)).toEqual(['quadriceps', 'hamstrings', 'upper_back']);
    expect(index.originOf('quadriceps')).toBe('focus');
    expect(index.originOf('hamstrings')).toBe('sport');
    expect(index.originOf('calves')).toBe('secondary_sport');
    expect(index.muscles).toContain('glutes');
  });

  test('caps the index at eight muscles', () => {
    const many = {
      focus: { muscles: ['quadriceps', 'glutes', 'hamstrings', 'calves'], movementControl: false },
      sport: { name: 'Rugby', muscles: ['upper_back', 'chest', 'rear_shoulders', 'biceps', 'triceps', 'core'] },
      roles: [],
    };
    const index = makeMultiSportEmphasisIndex({ emphasis: many, secondaryMuscles: ['forearms', 'abs'] });
    expect(index.muscles.length).toBe(MAX_EMPHASIS_MUSCLES);
    expect(SECONDARY_SPORT_WEIGHT).toBe(0.5);
  });
});

const profile = (over) => ({
  sportId: 'grappling_bjj', outcomeId: 'stay_available', experienceId: 'over_5_years',
  otherSportName: null, practiceSessionsPerWeek: 3, matchesPerWeek: 0, typicalSessionMinutes: 90,
  competitionDate: null, ...over,
});

describe('secondary sport distinctness (v13 UNIQUE(sport_id))', () => {
  test('rejects the primary sport as the secondary and accepts a distinct one', () => {
    expect(() => assertDistinctSecondarySport('powerlifting', 'powerlifting')).toThrow(/must differ/);
    expect(() => assertDistinctSecondarySport('powerlifting', 'grappling_bjj')).not.toThrow();
    expect(() => assertDistinctSecondarySport('powerlifting', null)).not.toThrow();
  });
});

describe('multi-sport workload', () => {
  test('rejects a secondary sport with no primary', () => {
    expect(() => assertSecondarySportAllowed(null, 'grappling_bjj')).toThrow(/requires a primary sport/);
    expect(() => assertSecondarySportAllowed('powerlifting', 'grappling_bjj')).not.toThrow();
  });

  test('rejects two active profiles naming the same sport', () => {
    expect(() => resolveMultiSportWorkload({ scheduled: [], profiles: [profile({}), profile({})] }))
      .toThrow(/must differ/);
  });

  test('sums sessions across sports and applies the interference cap', () => {
    const result = resolveMultiSportWorkload({
      scheduled: [
        { label: 'BJJ', weekday: 1, expectedDurationMin: 90 },
        { label: 'BJJ', weekday: 3, expectedDurationMin: 90 },
        { label: 'Run', weekday: 2, expectedDurationMin: 45 },
        { label: 'Run', weekday: 4, expectedDurationMin: 45 },
        { label: 'Run', weekday: 6, expectedDurationMin: 60 },
      ],
      profiles: [
        profile({ sportId: 'grappling_bjj', outcomeId: 'strength_for_contact' }),
        profile({ sportId: 'running_endurance', outcomeId: 'faster_running', practiceSessionsPerWeek: 3 }),
      ],
    });
    expect(result.sessionsPerWeek).toBe(5);
    expect(result.tier).toBe('very_high');
    expect(result.interference.endurancePlusContact).toBe(true);
    expect(result.interference.lowBodyAccessorySetDelta).toBe(-2);
    expect(result.interference.mainLiftsKeepSets).toBe(true);
    expect(result.interference.spacingNote).toMatch(/6-24 hours/);
  });

  test('no interference without an endurance sport beside a contact sport', () => {
    const result = resolveMultiSportWorkload({
      scheduled: [],
      profiles: [profile({ sportId: 'grappling_bjj' }), profile({ sportId: 'powerlifting', outcomeId: 'bigger_competition_lifts' })],
    });
    expect(result.interference.endurancePlusContact).toBe(false);
    expect(result.interference.lowBodyAccessorySetDelta).toBe(0);
    expect(result.interference.spacingNote).toBeNull();
  });

  test('a strength objective is required for the cap', () => {
    const result = resolveMultiSportWorkload({
      scheduled: [],
      profiles: [
        profile({ sportId: 'running_endurance', outcomeId: 'faster_running' }),
        profile({ sportId: 'football_association', outcomeId: 'last_the_whole_game' }),
      ],
    });
    expect(result.interference.endurancePlusContact).toBe(true);
    expect(result.interference.lowBodyAccessorySetDelta).toBe(0);
  });
});
