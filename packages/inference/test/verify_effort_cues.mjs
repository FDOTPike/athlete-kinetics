/**
 * verify_effort_cues.mjs — the plain-language effort anchors (WO §2.7, W5).
 *
 * Pins the owner-ratified band table at EVERY half-step 5.0..10.0, the
 * out-of-domain null, the RIR-first/breathing-second framing, the
 * pain-is-not-effort stop guidance, and the no-biometrics boundary of the
 * copy (no wording may imply sensor measurement of effort).
 *
 * Run: joined to verify:blocks (npm run verify:blocks).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  effortCue,
  EFFORT_STOP_GUIDANCE,
  EFFORT_BREATHING_NOTE,
  mapRirToRpe,
  RIR_CHOICES,
  RIR_OPTIONS,
} = require('./.build/effortCues.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const EXPECTED = {
  5.0: 'Easy; at least four good reps left.',
  5.5: 'Easy; at least four good reps left.',
  6.0: 'Easy; at least four good reps left.',
  6.5: 'Moderate; about three good reps left.',
  7.0: 'Moderate; about three good reps left.',
  7.5: 'Hard but controlled; about two good reps left.',
  8.0: 'Hard but controlled; about two good reps left.',
  8.5: 'Very hard; about one good rep left.',
  9.0: 'Very hard; about one good rep left.',
  9.5: 'Limit effort; no good reps left; never trade form for the number.',
  10.0: 'Limit effort; no good reps left; never trade form for the number.',
};

let boundaries = true;
for (const [rpe, expected] of Object.entries(EXPECTED)) {
  const got = effortCue(Number(rpe));
  if (got !== expected) {
    boundaries = false;
    console.log(`      mismatch at ${rpe}: ${JSON.stringify(got)}`);
  }
}
check('[cue] every half-step 5.0..10.0 maps to its owner-ratified band', boundaries);

check('[cue] out-of-domain values return null (5-10 only)',
  effortCue(4.5) === null && effortCue(10.5) === null && effortCue(0) === null);
check('[cue] non-finite input returns null', effortCue(NaN) === null && effortCue(Infinity) === null);

check('[cue] stop guidance names pain, dizziness, and loss of control without a diagnosis',
  EFFORT_STOP_GUIDANCE.includes('Pain') && EFFORT_STOP_GUIDANCE.includes('dizziness')
  && EFFORT_STOP_GUIDANCE.includes('losing control') && EFFORT_STOP_GUIDANCE.includes('stop')
  && !/\b(diagnos|injur\w* treat|medical advice)\b/i.test(EFFORT_STOP_GUIDANCE),
  EFFORT_STOP_GUIDANCE);

check('[cue] pain is explicitly not effort',
  EFFORT_STOP_GUIDANCE.includes('Pain is not effort'), EFFORT_STOP_GUIDANCE);

check('[cue] breathing note is framed as secondary and variable',
  EFFORT_BREATHING_NOTE.includes('vary by exercise and fitness'),
  EFFORT_BREATHING_NOTE);

check('[cue] no cue implies biometric or sensor measurement of effort',
  [EFFORT_STOP_GUIDANCE, EFFORT_BREATHING_NOTE, ...Object.values(EXPECTED)]
    .every((text) => !/\b(heart rate|HRV|SpO2|oxygen|sensor|wearable|Health Connect|biometric)\b/i.test(text)));

// ---------------------------------------------------------------------------
// WO §2.2, §7.2 Item 5 & CANONICAL_CONTRACT §1 — Pure Effort Mapping Contract
// ---------------------------------------------------------------------------

check('[rir] RIR_CHOICES is exported as constant array with 5 choices',
  Array.isArray(RIR_CHOICES) && JSON.stringify(RIR_CHOICES) === JSON.stringify(['0', '1', '2', '3', '4+']));

check('[rir] mapRirToRpe is exported as pure function', typeof mapRirToRpe === 'function');

const RIR_MAPPINGS = [
  ['0', 10.0, 'No more clean reps'],
  ['1', 9.0, 'About one clean rep left'],
  ['2', 8.0, 'About two clean reps left'],
  ['3', 7.0, 'About three clean reps left'],
  ['4+', 6.0, 'At least four clean reps left'],
  ['Not sure', null, 'Athlete cannot give a reliable answer'],
];

for (const [choice, expectedRpe] of RIR_MAPPINGS) {
  const got = typeof mapRirToRpe === 'function' ? mapRirToRpe(choice) : undefined;
  check(`[rir] choice '${choice}' maps to actual RPE ${expectedRpe}`,
    got === expectedRpe,
    `got: ${got}, expected: ${expectedRpe}`);
}

check('[rir] out-of-domain and malformed inputs strictly map to null',
  typeof mapRirToRpe === 'function' &&
  mapRirToRpe(null) === null &&
  mapRirToRpe(undefined) === null &&
  mapRirToRpe('') === null &&
  mapRirToRpe('5') === null &&
  mapRirToRpe(-1) === null &&
  mapRirToRpe('unknown') === null &&
  mapRirToRpe(NaN) === null);

check('[rir] RIR_OPTIONS provides structured choices matching contract',
  Array.isArray(RIR_OPTIONS) &&
  RIR_OPTIONS.length === 6 &&
  RIR_OPTIONS.every((opt) => opt && typeof opt.choice === 'string' && typeof opt.label === 'string' && typeof opt.meaning === 'string') &&
  RIR_OPTIONS[0].rpe === 10.0 && RIR_OPTIONS[0].choice === '0' && RIR_OPTIONS[0].meaning === 'No more clean reps' &&
  RIR_OPTIONS[1].rpe === 9.0 && RIR_OPTIONS[1].choice === '1' && RIR_OPTIONS[1].meaning === 'About one clean rep left' &&
  RIR_OPTIONS[2].rpe === 8.0 && RIR_OPTIONS[2].choice === '2' && RIR_OPTIONS[2].meaning === 'About two clean reps left' &&
  RIR_OPTIONS[3].rpe === 7.0 && RIR_OPTIONS[3].choice === '3' && RIR_OPTIONS[3].meaning === 'About three clean reps left' &&
  RIR_OPTIONS[4].rpe === 6.0 && RIR_OPTIONS[4].choice === '4+' && RIR_OPTIONS[4].meaning === 'At least four clean reps left' &&
  RIR_OPTIONS[5].rpe === null && RIR_OPTIONS[5].choice === 'Not sure' && RIR_OPTIONS[5].meaning === 'Athlete cannot give a reliable answer');

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
