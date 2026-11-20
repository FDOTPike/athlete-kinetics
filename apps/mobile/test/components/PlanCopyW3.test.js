import { pausedHeldText } from '../../src/screens/BlockScreen';
import { anchorReasonText } from '../../src/screens/ProgramSetupScreen';

// Android walk 2026-11-03, W3-1: the pause card said "held at block 2 of 8"
// while the same page said "Block 1 of 3". The 8 was the internal cycle index.
test('the pause card names the goal program block the athlete can see', () => {
  const text = pausedHeldText('an injury', { currentSequenceIndex: 1, plannedBlockCount: 3 });
  expect(text).toContain('You are held at block 1 of 3');
  expect(text).not.toContain('of 8');
});

test('with no goal program the pause card names no block number', () => {
  const text = pausedHeldText('illness', null);
  expect(text).toContain('Paused for illness. Your place is held');
  expect(text).not.toMatch(/block \d/);
  expect(text).not.toContain('will come back to it');
  expect(text).not.toContain('everything else works as normal');
  expect(text).toContain('automatic load increases from easy sessions');
});

test('#302 194c: currentSequenceIndex 0 shows no "block 0 of N"', () => {
  const text = pausedHeldText('illness', { currentSequenceIndex: 0, plannedBlockCount: 3 });
  expect(text).toContain('Your place is held');
  expect(text).not.toMatch(/block 0/);
});

// W3-8: the build page printed raw resolver codes ("capability").
test('anchor reasons read as plain words', () => {
  expect(anchorReasonText(['capability'])).toBe('Build the movement below it first.');
  expect(anchorReasonText(['tier', 'equipment'])).toBe(
    "Not for your experience level yet; needs equipment you don't have.",
  );
  expect(anchorReasonText([])).toBe('');
});

// W3 note for W4: the objective info button always asked about GPP.
test('the objective info button follows the selected objective', () => {
  const { OBJECTIVE_TIP } = require('../../src/screens/ProfileScreen');
  const { getGlossaryEntry } = require('../../src/data/glossary');
  expect(OBJECTIVE_TIP.strength).toBe('STRENGTH');
  expect(OBJECTIVE_TIP.weight_loss).toBeUndefined();
  for (const term of Object.values(OBJECTIVE_TIP)) {
    expect(getGlossaryEntry(term)).toBeTruthy();
  }
});

// W3-7: "Why today changed" showed raw values ("x0.77", "-1").
test('adjustment values read as words', () => {
  const { loadChangeText, setChangeText } = require('../../src/screens/BlockScreen');
  expect(loadChangeText(0.77)).toBe('Planned load reduced by 23%');
  expect(loadChangeText(1)).toBe('No change');
  // #302 194b: modifiers >= 1 never apply a load increase.
  expect(loadChangeText(1.05)).toBe('No change');
  expect(setChangeText(-1)).toBe('1 fewer set');
  expect(setChangeText(-2)).toBe('2 fewer sets');
  expect(setChangeText(0)).toBe('No change');
});

// W3-9b: the split description kept the default wording after the athlete
// set every day to full.
test('the split description follows the chosen day types', () => {
  const { chosenSplitText } = require('../../src/screens/ProgramSetupScreen');
  const { programFocuses, splitExplainer } = require('@ak/inference');
  const defaults = [...programFocuses('endurance', 2)];
  expect(chosenSplitText('endurance', defaults)).toBe(splitExplainer('endurance', 2));
  expect(chosenSplitText('endurance', ['full', 'full'])).toBe('2 full-body sessions a week, as you chose.');
  expect(chosenSplitText('strength', ['full', 'lower', 'full'])).toBe(
    '2 full-body sessions and 1 lower-body session a week, as you chose.',
  );
});
