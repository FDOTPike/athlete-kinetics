/**
 * Issue #156: "program" is the spelling used across the app. No "programme"
 * (any case) may remain in apps/mobile/src. Reads the source tree directly.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');

const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sourceFiles(path) : [path];
});

test('no "programme" (any case) remains in apps/mobile/src', () => {
  const hits = sourceFiles(SRC)
    .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
    .flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .map((line, index) => ({ file, line: index + 1, text: line }))
      .filter((hit) => /programme/i.test(hit.text)));
  expect(hits.map((hit) => `${hit.file}:${hit.line}`)).toEqual([]);
});
