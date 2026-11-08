'use strict';

/**
 * The WO-02 v12 22-sport catalog (proposed; owner approval outstanding) must reach the picker whole:
 * every sport in a family, every offered outcome resolving to a complete
 * emphasis, and no internal source code leaking into user copy.
 *
 * Author: deepseek-v4.1-flash-1017 via Hermes
 */

const {
  SPORTS,
  SPORT_FAMILIES,
  SPORT_INFO,
  SPORT_OUTCOMES_BY_SPORT,
  isSportId,
  sportEmphasisFor,
  sportsInFamily,
} = require('@ak/inference');

const offeredPairs = () =>
  SPORTS.flatMap((sport) => SPORT_OUTCOMES_BY_SPORT[sport].map((outcome) => [sport, outcome]));

describe('22-sport taxonomy proposal', () => {
  test('carries 22 sports across 10 families, each sport listed once', () => {
    expect(SPORTS).toHaveLength(22);
    expect(new Set(SPORTS).size).toBe(22);
    expect(SPORT_FAMILIES).toHaveLength(10);
    const grouped = SPORT_FAMILIES.flatMap((family) => sportsInFamily(family));
    expect([...grouped].sort()).toEqual([...SPORTS].sort());
  });

  test('offers 92 sport/outcome pairs and every pair resolves to complete copy', () => {
    const pairs = offeredPairs();
    expect(pairs).toHaveLength(92);
    for (const [sport, outcome] of pairs) {
      const emphasis = sportEmphasisFor({ sportId: sport, outcomeId: outcome, otherSportName: null });
      expect(typeof emphasis.summary).toBe('string');
      expect(emphasis.summary.length).toBeGreaterThan(10);
      expect(Array.isArray(emphasis.muscles)).toBe(true);
      expect(Array.isArray(emphasis.basis)).toBe(true);
      expect(Array.isArray(emphasis.limits)).toBe(true);
    }
  });

  test('no user-facing string carries an internal source code', () => {
    const code = /\bS\d{2}\b/;
    for (const [sport, outcome] of offeredPairs()) {
      const emphasis = sportEmphasisFor({ sportId: sport, outcomeId: outcome, otherSportName: null });
      expect(code.test(emphasis.summary)).toBe(false);
      for (const limit of emphasis.limits) expect(code.test(limit)).toBe(false);
    }
  });

  test('newly proposed sports are valid ids with a label and a family', () => {
    for (const sport of ['court_netball', 'grappling_bjj', 'combat_mma', 'racquet_squash', 'running_endurance', 'swimming']) {
      expect(isSportId(sport)).toBe(true);
      expect(SPORT_INFO[sport].label.length).toBeGreaterThan(2);
      expect(SPORT_FAMILIES).toContain(SPORT_INFO[sport].family);
    }
  });

  test('an unlisted sport is still rejected', () => {
    expect(isSportId('cricket')).toBe(false);
  });
});
