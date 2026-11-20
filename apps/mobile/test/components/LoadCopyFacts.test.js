import { isEasedBelow, loadCopyFactsFor } from '../../src/state/loadCopyFacts';

// #131 critic fix: the facts name the source resolveSlotLoad used.
describe('load copy facts', () => {
  test('eased day, Set 2 in manual mode: the advisory is the earlier session load', () => {
    const facts = loadCopyFactsFor({ currentSessionLoadKg: 10, hasSetThisSession: true, lastLoggedKg: 17.5, easedToday: true });
    expect(facts.advisoryFromThisSession).toBe(false);
    expect(facts.historyFromThisSession).toBe(true);
    expect(facts.unadjustedHistoryKg).toBe(17.5);
  });

  test('a day with no load reduction: a set logged this session is the advisory source', () => {
    const facts = loadCopyFactsFor({ currentSessionLoadKg: 12.5, hasSetThisSession: true, lastLoggedKg: 12.5, easedToday: false });
    expect(facts.advisoryFromThisSession).toBe(true);
    expect(facts.historyFromThisSession).toBe(true);
  });

  test('no set this session on an eased day: neither source is this session', () => {
    const facts = loadCopyFactsFor({ currentSessionLoadKg: null, hasSetThisSession: false, lastLoggedKg: 17.5, easedToday: true });
    expect(facts.advisoryFromThisSession).toBe(false);
    expect(facts.historyFromThisSession).toBe(false);
  });

  test('a non-finite current-session load is not used as this session history', () => {
    const facts = loadCopyFactsFor({ currentSessionLoadKg: Number.NaN, hasSetThisSession: true, lastLoggedKg: 10, easedToday: false });
    expect(facts.historyFromThisSession).toBe(false);
  });
});

describe('eased wording needs a shown load lower than the unadjusted load', () => {
  test('a 0 kg added load is not eased', () => {
    expect(isEasedBelow(0, 0)).toBe(false);
  });
  test('a lower shown load is eased', () => {
    expect(isEasedBelow(7.5, 10)).toBe(true);
  });
  test('a missing value is not eased', () => {
    expect(isEasedBelow(null, 10)).toBe(false);
    expect(isEasedBelow(7.5, null)).toBe(false);
  });
});
