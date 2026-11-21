'use strict';

/**
 * Prehab and flexibility policy (WO-03A / WO-03B).
 *
 * Author: deepseek-v4.1-flash-1017 via Hermes
 */

const {
  PREHAB_TARGETS,
  PREHAB_DISCLAIMER,
  prehabTargetFor,
  prehabCoverage,
} = require('@ak/inference');
const {
  FLEXIBILITY_PACKS,
  FLEXIBILITY_DOSE,
  MIN_MINUTES_BEFORE_HEAVY_SESSION,
  FLEXIBILITY_PACK_MINUTES,
  flexibilityPlacementFor,
} = require('@ak/inference');

describe('prehab catalog', () => {
  test('carries the seven targets with v13 aliases', () => {
    expect(PREHAB_TARGETS).toHaveLength(7);
    expect(PREHAB_TARGETS.map((target) => target.id).sort()).toEqual([
      'achilles_calf', 'elbow_tendon', 'hip_groin', 'knee_patellar',
      'low_back_core', 'shoulder_cuff', 'wrist_forearm',
    ]);
    for (const target of PREHAB_TARGETS) {
      expect(target.v13TargetId === null || target.v13TargetId.length > 2).toBe(true);
      expect(target.stopRule).toMatch(/3\/10/);
    }
  });

  test('elbow tendon binds both wrist directions and records no false gap', () => {
    const elbow = prehabTargetFor('elbow_tendon');
    const ids = elbow.movements.map((movement) => movement.movementId);
    expect(ids).toContain(268);
    expect(ids).toContain(269);
    expect(ids).toContain(164);
    expect(elbow.catalogGap).toBeNull();
    expect(prehabTargetFor('hip_groin').catalogGap).toMatch(/Copenhagen/i);
    expect(prehabCoverage('knee_patellar')).toBe('partial');
    expect(prehabCoverage('hip_groin')).toBe('gap');
    expect(prehabCoverage('shoulder_cuff')).toBe('bound');
  });

  test('no bound movement id falls outside the shipped catalog', () => {
    for (const target of PREHAB_TARGETS) {
      for (const movement of target.movements) {
        expect(Number.isInteger(movement.movementId)).toBe(true);
        expect(movement.movementId).toBeGreaterThanOrEqual(1);
        expect(movement.movementId).toBeLessThanOrEqual(300);
      }
    }
  });

  test('the disclaimer is the ratified wording and does not diagnose', () => {
    expect(PREHAB_DISCLAIMER).toBe(
      'Optional tendon and joint care — not a medical diagnosis or physical therapy prescription. Stop immediately if you feel sharp pain, numbness, tingling, or radiating symptoms.',
    );
    expect(PREHAB_DISCLAIMER).not.toMatch(/\btreats?\b|\bcures?\b/i);
  });
});

describe('flexibility policy', () => {
  test('carries the five regional packs', () => {
    expect(FLEXIBILITY_PACKS).toHaveLength(5);
    expect(FLEXIBILITY_PACKS.map((pack) => pack.id).sort()).toEqual([
      'ankles_calves', 'full_body_recovery', 'hips_hamstrings',
      'thoracic_shoulders', 'wrists_forearms',
    ]);
  });

  test('the dose is two 45-second holds or two sets of eight, at RPE 6 or below', () => {
    expect(FLEXIBILITY_DOSE.staticHoldSeconds).toBe(45);
    expect(FLEXIBILITY_DOSE.staticSets).toBe(2);
    expect(FLEXIBILITY_DOSE.dynamicReps).toBe(8);
    expect(FLEXIBILITY_DOSE.dynamicSets).toBe(2);
    expect(FLEXIBILITY_DOSE.rpeCeiling).toBe(6);
  });

  test('static work is blocked inside 60 minutes of a heavy session, allowed after it', () => {
    expect(MIN_MINUTES_BEFORE_HEAVY_SESSION).toBe(60);
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'strength', minutesUntilHeavy: 30 }).placement).toBe('blocked');
    expect(FLEXIBILITY_PACK_MINUTES).toBe(5);
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'strength', minutesUntilHeavy: 60 }).placement).toBe('blocked');
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'strength', minutesUntilHeavy: 64 }).placement).toBe('blocked');
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'strength', minutesUntilHeavy: 65 }).placement).toBe('pre_session');
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'strength', minutesUntilHeavy: null }).placement).toBe('post_session');
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'recovery', minutesUntilHeavy: null }).placement).toBe('standalone');
    expect(flexibilityPlacementFor({ packId: 'hips_hamstrings', sessionKind: 'skill', minutesUntilHeavy: 30 }).placement).toBe('blocked');
  });
});
// S5FIX
