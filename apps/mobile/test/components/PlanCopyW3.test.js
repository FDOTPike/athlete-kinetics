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
  expect(text).toContain('Paused for illness. Your place is held and will come back to it');
  expect(text).not.toMatch(/block \d/);
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
