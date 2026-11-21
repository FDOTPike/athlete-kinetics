// Usage: node scripts/verify-question-parity.mjs <read-only lab> [--write-assets]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { offlineTransformersLoad } from './embedder-integrity.mjs';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const lab = resolve(process.argv[2]);
const fromLab = (path) => import(pathToFileURL(join(lab, path)).href);
await fromLab('ask/guard-sealed.mjs');
const { readCandidate, entryPhrases, makeRouter, parseQuestions, projectGlossary } = await fromLab('ask/lib.mjs');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const bank = read(join(lab, 'ask/bank.json'));
const meta = read(join(lab, 'ask/candidates/a4-two-batches/candidate.json'));
const phrases = read(join(lab, 'ask/candidates/a4-two-batches/phrases.json'));
const config = read(join(lab, 'ask/config.json'));
const candidate = readCandidate(meta, phrases, bank, config.referenceRouter);
assert.deepEqual(candidate.problems, []);
const git = spawnSync('git', ['-c', `safe.directory=${lab.replaceAll('\\', '/')}`, '-C', lab, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
assert.equal(git.status, 0, git.stderr);
const commit = git.stdout.trim();
const dataFile = join(root, 'packages/inference/src/semantic/questionPhrases.ts');
if (process.argv.includes('--write-assets')) {
  writeFileSync(dataFile, `// Source: lab ${commit}, ask/candidates/a4-two-batches/{candidate,phrases}.json; defaults: ask/config.json and ask/lib.mjs.\nexport const QUESTION_SETTINGS = ${JSON.stringify(candidate.effective, null, 2)} as const;\nexport const QUESTION_PHRASES: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(candidate.phrases, null, 2)};\n`);
}
const out = join(root, 'packages/inference/test/.build/question');
mkdirSync(out, { recursive: true });
const compiled = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--strict', '--target', 'es2020', '--module', 'commonjs', '--lib', 'es2020', '--outDir', out,
  join(root, 'packages/inference/src/semantic/questionRouter.ts'), join(root, 'packages/inference/src/semantic/onnxEmbedder.ts'), join(root, 'apps/mobile/src/data/glossary.ts')], { encoding: 'utf8' });
assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
const appModule = require(join(out, 'packages/inference/src/semantic/questionRouter.js'));
const data = require(join(out, 'packages/inference/src/semantic/questionPhrases.js'));
const cosine = require(join(out, 'packages/inference/src/semantic/cosine.js'));
const redFlag = require(join(out, 'packages/inference/src/semantic/redFlag.js'));
const glossary = require(join(out, 'apps/mobile/src/data/glossary.js')).GLOSSARY_ENTRIES;
assert.deepEqual(projectGlossary(glossary), bank.entries, 'lab bank must equal the shipped glossary');
assert.deepEqual(data.QUESTION_SETTINGS, candidate.effective);
assert.deepEqual(data.QUESTION_PHRASES, candidate.phrases);
const rows = [];
for (const entry of bank.entries) {
  const extra = [...(candidate.phrases[entry.id] ?? []), ...(candidate.effective.matchDefinitions ? [entry.definition] : [])];
  for (const phrase of entryPhrases(entry, extra)) rows.push({ entryId: entry.id, phrase });
}
for (const phrase of candidate.phrases.refer ?? []) rows.push({ entryId: 'refer', phrase });
assert.deepEqual(appModule.questionPhraseRows(glossary), rows);
const ort = await import('onnxruntime-node');
const { pipeline } = await import('@xenova/transformers');
const transformerLoad = offlineTransformersLoad(read(join(root, 'packages/inference/assets/phrase-codebase.json')).embeddingModel);
const encoder = await pipeline('feature-extraction', transformerLoad.modelId, { quantized: true, ...transformerLoad.options });
const vectors = [];
for (const row of rows) vectors.push(Array.from((await encoder(row.phrase, { pooling: 'mean', normalize: true })).data, (x) => Number(x.toFixed(6))));
const asset = { dim: vectors[0].length, entryIds: rows.map((row) => row.entryId), vectors };
const assetPath = join(root, 'packages/inference/assets/question-vectors.json');
if (process.argv.includes('--write-assets')) writeFileSync(assetPath, JSON.stringify(asset) + '\n');
else assert.equal(JSON.stringify(read(assetPath)), JSON.stringify(asset), 'bundled phrase vectors must match the lab build-time path');
const matrix = cosine.packVectors(vectors, asset.dim);
const labRouter = makeRouter({ app: { modules: { cosine, redFlag } }, phraseRows: rows, matrix, dim: asset.dim, settings: candidate.effective });
const assets = join(root, 'packages/inference/assets/minilm');
const session = await ort.InferenceSession.create(join(assets, 'model_quantized.onnx'));
const queryEncoder = require(join(out, 'packages/inference/src/semantic/onnxEmbedder.js')).createMiniLmEmbedder({ session, Tensor: ort.Tensor, tokenizer: read(join(assets, 'tokenizer.min.json')) });
const questions = parseQuestions(readFileSync(join(lab, 'ask/data/dev.jsonl'), 'utf8'), 'dev');
const fixtures = [];
try {
  for (const question of questions) {
    const query = await queryEncoder.embed(question.text);
    const expected = labRouter(question.text, query);
    const actual = appModule.routeQuestion(question.text, query, { matrix, entryIds: asset.entryIds, dim: asset.dim });
    assert.deepEqual(actual, { outcome: expected.outcome, shown: expected.shown }, question.id);
    fixtures.push({ text: question.text, query: Array.from(query), expected: actual });
  }
} finally { await session.release(); await encoder.dispose(); }
if (process.argv.includes('--write-assets')) writeFileSync(join(root, 'packages/inference/test/question-dev-parity.json'), JSON.stringify(fixtures) + '\n');
console.log(`Question routing parity: ${questions.length}/${questions.length} identical outcomes (lab ${commit}); sealed guard active.`);
