/**
 * SportWorkloadCopy.test.js — #146. The Profile sport copy for a zero-session
 * schedule describes what each weekly tier does. These tests pin every
 * sentence in that copy to the effect values the generator actually uses, so
 * the copy and the code cannot drift apart.
 */
import { resolveSportWorkload, sportWorkloadEffect } from '@ak/inference';

const workloadWith = (sessions) => resolveSportWorkload({
  scheduled: Array.from({ length: sessions }, (_, index) => ({
    label: 'Basketball', weekday: index % 7, expectedDurationMin: 60,
  })),
  profile: null,
});

// Tier → sessions a week, the effect values, and the sentence the copy uses.
const TIERS = [
  {
    tier: 'light', sessions: 1, accessorySetCut: 0, holdHardestWeek: false,
    sentence: 'A light week does not change the gym plan.',
  },
  {
    tier: 'high', sessions: 3, accessorySetCut: 1, holdHardestWeek: false,
    sentence: 'A full week takes one set off each accessory exercise.',
  },
  {
    tier: 'very_high', sessions: 5, accessorySetCut: 2, holdHardestWeek: true,
    sentence: 'A very full week takes two sets off each accessory exercise, and week 3 repeats week 2 for every exercise, main lifts included.',
  },
];

const zeroSessionCopy = sportWorkloadEffect(workloadWith(0)).explanation;

describe('#146 Profile sport copy matches the workload effect', () => {
  test.each(TIERS)('$tier: the effect values are the ones the copy describes', ({ sessions, accessorySetCut, holdHardestWeek }) => {
    const effect = sportWorkloadEffect(workloadWith(sessions));
    expect(effect.accessorySetCut).toBe(accessorySetCut);
    expect(effect.holdHardestWeek).toBe(holdHardestWeek);
  });

  test.each(TIERS)('$tier: the zero-session copy states that tier in the same words', ({ sentence }) => {
    expect(zeroSessionCopy).toContain(sentence);
  });

  test('the zero-session copy does not promise a change for one weekly session', () => {
    expect(zeroSessionCopy).not.toMatch(/will take them into account/);
    expect(zeroSessionCopy).toMatch(/Add your weekly sessions in Activities and the next block counts them\./);
  });

  test('the tier explanations use the same effect the copy names', () => {
    expect(sportWorkloadEffect(workloadWith(3)).explanation).toMatch(/each accessory exercise has one fewer set/);
    expect(sportWorkloadEffect(workloadWith(5)).explanation).toMatch(/each accessory exercise has two fewer sets/);
    expect(sportWorkloadEffect(workloadWith(5)).explanation).toMatch(/week 3 of the block repeats week 2/);
  });
});
