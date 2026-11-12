import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scanRedFlags } = require('./.build/semantic/redFlag.js');
const examples = [
  ['no knee pain', false, false],
  ['zero lower back pain', false, false],
  ['free of shoulder tightness', false, false],
  ['no knee pain, chest is fine, shoulder tight', false, false],
  ['no knee pain, but sharp pain in left hip', true, false],
  ['knee pain is zero', false, false],
  ['shoulder pain resolved', false, false],
  ['was dizzy yesterday but fine now', false, false],
  ['sharp pain in left knee', true, false],
  ['sharp, knee', true, false],
  ['sharp pain in chest during bench press, feeling dizzy', true, true],
  ['not dizzy but dizzy now', false, true],
  ['no pain and dizzy', false, true],
  ['knee pain and dizzy resolved', true, false],
  ['sharp knee pain is zero', false, false],
  ['was dizzy yesterday but fine now, dizzy again', false, true],
];
let failures = 0;
for (const [text, pain, systemic] of examples) {
  const got = scanRedFlags(text);
  if (got.pain !== pain || got.systemic !== systemic) {
    failures++;
    console.error(`Mismatch ${JSON.stringify(text)} expected pain=${pain} systemic=${systemic}, got ${JSON.stringify(got)}`);
  }
}
console.log(`EVIDENCE CAPTURED: ${examples.length} cases, ${failures} mismatches`);
if (failures) process.exitCode = 1;
