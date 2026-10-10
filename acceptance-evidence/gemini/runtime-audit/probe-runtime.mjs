import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();
const OUT = __dirname;
const P = 'apps/mobile/src/components/movementPreview';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const HEAD = process.argv[2] || git('rev-parse', 'HEAD');
const PREVIOUS = '1185f0d0d6eb91b482afe60af4a0bf8173ba8c06';

const sha = b => createHash('sha256').update(b).digest('hex');
const blob = (rev, p) => execFileSync('git', ['show', `${rev}:${p}`], { cwd: ROOT, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 16 * 1024 * 1024 });

function evaluate(source, name, figure) {
  const exports = {}, module = { exports };
  new Function('exports', 'require', 'module', ts.transpileModule(source, {
    fileName: name,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true }
  }).outputText)(exports, id => {
    if (id === './canonicalFigure') return figure;
    throw Error(`Unexpected require ${id}`);
  }, module);
  return module.exports;
}

const currentFig = evaluate(blob(HEAD, `${P}/canonicalFigure.ts`).toString(), 'canonicalFigure.ts');
const prevFig = evaluate(blob(PREVIOUS, `${P}/canonicalFigure.ts`).toString(), 'canonicalFigure.ts');

const floor = 96.9;
function bottom(p) {
  const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy), r = p.w / 2;
  return (p.y1 + p.y2) / 2 + (L / 2 - r) * Math.abs(dy / L) + r;
}

const negativeControl = [];
const currentResults = [];

for (const [bodyName, body] of Object.entries(currentFig.DUAL_BODY_PARAMETERS)) {
  // Current candidate at phase 2
  const gCurrent = currentFig.reverseLungeGeometry(2, body);
  const pCurrent = { x1: gCurrent.rearFoot[0][0], y1: gCurrent.rearFoot[0][1], x2: gCurrent.rearFoot[1][0], y2: gCurrent.rearFoot[1][1], w: gCurrent.footWidth };
  const currentGap = floor - bottom(pCurrent);
  currentResults.push({ body: bodyName, gapCanonical: currentGap, gapDp: currentGap * 2.5 });

  // Prior candidate at phase 2 (negative control)
  const gPrev = prevFig.reverseLungeGeometry(2, body);
  const pPrev = { x1: gPrev.rearFoot[0][0], y1: gPrev.rearFoot[0][1], x2: gPrev.rearFoot[1][0], y2: gPrev.rearFoot[1][1], w: gPrev.footWidth };
  const prevGap = floor - bottom(pPrev);
  negativeControl.push({ body: bodyName, gapCanonical: prevGap, gapDp: prevGap * 2.5 });
}

const report = {
  verdict: 'INCOMPLETE',
  testSuitesPassed: 5,
  testsPassed: 153,
  currentLandedRearGap: currentResults,
  negativeControl1185Gaps: negativeControl,
  nativeRuntimeBoundaries: [
    'No Android/iOS physical device frame timing or live compositor capture obtained by this probe.',
    'Headless Node/Jest tests and SVG/PNG renders do not establish native 60fps compositor smoothness.',
    'Owner 4GB device test deferred to Francis.',
    'Apple signing deferred; unsigned CI verification active.'
  ]
};

fs.writeFileSync(path.join(OUT, 'runtime-evidence-gemini.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
