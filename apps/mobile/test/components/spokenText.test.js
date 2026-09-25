import { toSpokenText } from '../../src/speech/spokenText';

test.each([
  ['RPE', 'R P E'],
  ['RIR', 'R I R'],
  ['RDL', 'Romanian deadlift'],
  ['DB', 'dumbbell'],
  ['KB', 'kettlebell'],
  ['e.g.', 'for example'],
])('pronounces the whole token %s', (input, spoken) => {
  expect(toSpokenText(`Use ${input} here.`)).toBe(`Use ${spoken} here.`);
});

test('does not replace parts of longer tokens or change unknown text', () => {
  expect(toSpokenText('RPEX ADB KBB BRDL RIR2 tempo')).toBe('RPEX ADB KBB BRDL RIR2 tempo');
  expect(toSpokenText('Control the descent and pause.')).toBe('Control the descent and pause.');
});

test('strips bullets and speaks numbered steps without changing their numbers', () => {
  expect(toSpokenText('1. Brace.\n2. • Drive.\n• RPE 8.')).toBe('Step 1. Brace.\nStep 2. Drive.\nR P E 8.');
});
