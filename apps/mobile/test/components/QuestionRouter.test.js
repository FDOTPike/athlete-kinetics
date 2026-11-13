import { routeQuestion, questionPhraseRows } from '../../../../packages/inference/src/semantic/questionRouter';
import { packVectors } from '../../../../packages/inference/src/semantic/cosine';
import { GLOSSARY_ENTRIES } from '../../src/data/glossary';

test('one-card routing: symptom words take precedence, referral wins ties, and below threshold abstains', () => {
  const index = { matrix: new Float32Array([0.6, 0.6]), entryIds: ['RPE', 'refer'], dim: 1 };
  expect(routeQuestion('what is effort?', new Float32Array([1]), index)).toEqual({ outcome: 'refer', shown: [] });
  expect(routeQuestion('my knee hurts', new Float32Array([0]), index)).toEqual({ outcome: 'refer', shown: [] });
  expect(routeQuestion('unrelated', new Float32Array([0]), index)).toEqual({ outcome: 'none', shown: [] });
  expect(routeQuestion('effort', new Float32Array([1]), { ...index, matrix: new Float32Array([0.7, 0.6]) })).toEqual({ outcome: 'RPE', shown: ['RPE'] });
});

test('the bundled index and every open dev outcome stay in parity', () => {
  const asset = require('../../../../packages/inference/assets/question-vectors.json');
  const fixtures = require('../../../../packages/inference/test/question-dev-parity.json');
  expect(questionPhraseRows(GLOSSARY_ENTRIES).map((row) => row.entryId)).toEqual(asset.entryIds);
  const index = { matrix: packVectors(asset.vectors, asset.dim), entryIds: asset.entryIds, dim: asset.dim };
  expect(fixtures.length).toBeGreaterThan(0);
  for (const row of fixtures) expect(routeQuestion(row.text, Float32Array.from(row.query), index)).toEqual(row.expected);
});
