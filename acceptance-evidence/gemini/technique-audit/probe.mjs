import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { primToSvg, ROLE_HEX } from '../../../tools/rendering/lib/canonicalSvg.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();
const OUT = __dirname;
const P = 'apps/mobile/src/components/movementPreview';
const HEAD = 'd3bfe0a2d00b9067583cb74f585701f894440948';
const PREVIOUS = '1185f0d0d6eb91b482afe60af4a0bf8173ba8c06';
const IDS = [143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84];

const sha = b => createHash('sha256').update(b).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const blob = (rev, p) => execFileSync('git', ['show', `${rev}:${p}`], { cwd: ROOT, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 16 * 1024 * 1024 });

const expect = (ok, msg) => { if (!ok) throw Error(msg); };

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

function load(rev) {
  const figure = evaluate(blob(rev, `${P}/canonicalFigure.ts`).toString(), 'canonicalFigure.ts');
  const derivation = evaluate(blob(rev, `${P}/derivation.ts`).toString(), 'derivation.ts', figure);
  const files = git('ls-tree', '-r', '--name-only', rev, '--', `${P}/families`).split(/\r?\n/).filter(x => x.endsWith('.json'));
  const raw = files.flatMap(p => JSON.parse(blob(rev, p)).entries);
  const entries = raw.map(e => derivation.isVariantEntry(e) ? derivation.deriveVariantEntry(e, raw.find(b => b.movementId === e.derivesFrom)) : e);
  return { rev, figure, entries, files };
}

const candidate = load(HEAD);
const before = load(PREVIOUS);
const baselines = [before];

const ticks = (f, e) => {
  const total = f.segmentDurations(e.frames.length, e.segmentDurationsMs).reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
};

const frames = (s, id, bodyName) => {
  const e = s.entries.find(e => e.movementId === id), f = s.figure, body = f.DUAL_BODY_PARAMETERS[bodyName];
  return ticks(f, e).map(t => {
    const pose = f.poseAtTime(e.frames.map(f => f.joints), t, e.segmentDurationsMs);
    const opts = { ...e, body, implementTiltWeight: f.peakWeightAtTime(e.frames, e.frameRoles, t, e.segmentDurationsMs) };
    return { time: t, joints: f.resolveFigureJoints(pose, opts), primitives: f.layoutCanonicalFigure(pose, opts) };
  });
};

const preservation = [];
for (const base of baselines) {
  const cycles = [];
  for (const id of IDS) {
    for (const body of Object.keys(candidate.figure.DUAL_BODY_PARAMETERS)) {
      const now = frames(candidate, id, body);
      const then = frames(base, id, body);
      const entryIdentical = JSON.stringify(candidate.entries.find(e => e.movementId === id)) === JSON.stringify(base.entries.find(e => e.movementId === id));
      const joints = now.map(f => f.joints);
      const prims = now.map(f => f.primitives);
      const resolvedJointsIdentical = JSON.stringify(joints) === JSON.stringify(then.map(f => f.joints));
      const completePrimitivesIdentical = JSON.stringify(prims) === JSON.stringify(then.map(f => f.primitives));
      expect(entryIdentical && resolvedJointsIdentical && completePrimitivesIdentical, `Changed ${id}/${body} vs ${base.rev}`);
      cycles.push({
        id, body, tickCount: now.length, totalMs: now.at(-1).time,
        entryIdentical, resolvedJointsIdentical, completePrimitivesIdentical,
        resolvedJointsSha256: sha(JSON.stringify(joints)),
        completePrimitivesSha256: sha(JSON.stringify(prims))
      });
    }
  }
  preservation.push({ baselineCommit: base.rev, bodyCycleCount: cycles.length, poseCount: cycles.reduce((n, c) => n + c.tickCount, 0), cycles });
}

const f = candidate.figure;
const e = candidate.entries.find(e => e.movementId === 52);
const floor = 96.9;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function bottom(p) {
  const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy), r = p.w / 2;
  return (p.y1 + p.y2) / 2 + (L / 2 - r) * Math.abs(dy / L) + r;
}

const repair = [];
for (const [bodyName, body] of Object.entries(f.DUAL_BODY_PARAMETERS)) {
  const start = f.reverseLungeGeometry(0, body);
  const samples = [];
  for (const time of ticks(f, e)) {
    const pose = f.poseAtTime(e.frames.map(x => x.joints), time, e.segmentDurationsMs);
    const g = f.reverseLungeGeometry(pose.rl, body);
    const j = f.resolveFigureJoints(pose, { ...e, body });
    const p = f.layoutCanonicalFigure(pose, { ...e, body });
    const foot = g.rearFoot, front = g.frontFoot;
    const rear = p.find(x => x.kind === 'bone' && x.w === g.footWidth && x.x1 === foot[0][0] && x.y1 === foot[0][1] && x.x2 === foot[1][0] && x.y2 === foot[1][1]);
    const planted = p.find(x => x.kind === 'bone' && x.w === g.footWidth && x.x1 === front[0][0] && x.y1 === front[0][1] && x.x2 === front[1][0] && x.y2 === front[1][1]);
    expect(rear && planted, 'Exact production foot primitives absent');
    const rearGap = floor - bottom(rear);
    const frontGap = floor - bottom(planted);
    const kneeGap = floor - j.kf[1] - body.lw * 1.18 / 2;
    const legError = Math.max(...[[j.nLeg, j.kn, j.an], [j.fLeg, j.kf, j.af]].flatMap(([r, k, a]) => [Math.abs(dist(r, k) - 22.25), Math.abs(dist(k, a) - 22.25)]));
    const armError = Math.max(...[[j.nArm, j.el, j.wr], [j.fArm, j.ef, j.wf]].flatMap(([r, k, a]) => [Math.abs(dist(r, k) - 12.5), Math.abs(dist(k, a) - 12)]));
    const shafts = p.filter(x => x.kind === 'bone' && x.w === 2.2);
    expect(shafts.length === 2, 'Dumbbell shaft count');
    const near = shafts.find(x => x.color === 'textHi');
    const far = shafts.find(x => x.color === 'textLow');
    const shaftError = Math.max(dist([(near.x1 + near.x2) / 2, (near.y1 + near.y2) / 2], j.wr), dist([(far.x1 + far.x2) / 2, (far.y1 + far.y2) / 2], j.wf));
    expect(JSON.stringify(front) === JSON.stringify(start.frontFoot), 'Front moved');
    expect(Math.abs(frontGap) < 1e-9 && rearGap >= -1e-9, 'Floor bounds');
    expect(pose.rl < 1 || pose.rl > 3 || Math.abs(rearGap) < 1e-9, 'Support gap');
    expect(legError < 1e-9 && armError < 1e-9 && shaftError < 1e-9, 'Length or load attachment drift');
    expect(kneeGap > 0, 'Knee floor contact');
    expect(j.hp[1] - j.nk[1] === 24 && j.hp[0] === j.nk[0] && j.nk[1] - j.hd[1] === 9, 'Trunk/head drift');
    samples.push({
      timeMs: time, phase: pose.rl,
      rearPaintedGapCanonical: rearGap, rearPaintedGapApp240Dp: rearGap * 2.5,
      frontPaintedGapCanonical: frontGap, rearKneeConservativeEnvelopeGapCanonical: kneeGap,
      legLengthMaxError: legError, armLengthMaxError: armError,
      dumbbellCenterMaxError: shaftError, rearFootLength: dist(...foot)
    });
  }
  const outFrames = frames(candidate, 52, bodyName);
  expect(JSON.stringify(outFrames[0].joints) === JSON.stringify(outFrames.at(-1).joints), 'Joint loop does not close');
  expect(JSON.stringify(outFrames[0].primitives) === JSON.stringify(outFrames.at(-1).primitives), 'Primitive loop does not close');
  const support = samples.filter(x => x.phase >= 1 && x.phase <= 3);
  const old = before.figure.reverseLungeGeometry(2, body);
  const oldp = { x1: old.rearFoot[0][0], y1: old.rearFoot[0][1], x2: old.rearFoot[1][0], y2: old.rearFoot[1][1], w: old.footWidth };
  expect(floor - bottom(oldp) > 1, 'Negative control not reproduced');
  repair.push({
    body: bodyName, tickCount: samples.length, totalMs: samples.at(-1).timeMs,
    supportedSampleCount: support.length,
    maxAbsoluteSupportedGapCanonical: Math.max(...support.map(x => Math.abs(x.rearPaintedGapCanonical))),
    old1185SupportedGapCanonical: floor - bottom(oldp),
    old1185SupportedGapApp240Dp: (floor - bottom(oldp)) * 2.5,
    minRearKneeConservativeEnvelopeGapCanonical: Math.min(...samples.map(x => x.rearKneeConservativeEnvelopeGapCanonical)),
    minRearKneeConservativeEnvelopeGapApp240Dp: Math.min(...samples.map(x => x.rearKneeConservativeEnvelopeGapCanonical)) * 2.5,
    maxLegLengthError: Math.max(...samples.map(x => x.legLengthMaxError)),
    maxArmLengthError: Math.max(...samples.map(x => x.armLengthMaxError)),
    maxDumbbellCenterError: Math.max(...samples.map(x => x.dumbbellCenterMaxError)),
    jointLoopClosed: true, completePrimitiveLoopClosed: true
  });
}

const cycleDir = 'acceptance-evidence/gemini/recheck52-cycles';
const ci = JSON.parse(fs.readFileSync(`${cycleDir}/cycle_evidence.json`));
expect(ci.sourceCommit === HEAD && ci.sourcesCommittedAtRender, 'Cycle binding');

const artifact = [];
for (const move of ci.movements) {
  for (const r of move.records) {
    const pp = `${cycleDir}/movement-${move.id}/${r.body}-cycle.png`;
    const hp = `${cycleDir}/movement-${move.id}/${r.body}-cycle.html`;
    expect(sha(fs.readFileSync(pp)) === r.sheetSha256, 'PNG hash');
    const html = fs.readFileSync(hp, 'utf8');
    expect(sha(html) === r.htmlSha256, 'HTML hash');
    artifact.push({ id: move.id, body: r.body, png: pp, pngSha256: r.sheetSha256, html: hp, htmlSha256: r.htmlSha256 });
  }
}

const cards = JSON.parse(fs.readFileSync('acceptance-evidence/gemini/recheck52-cards/evidence_index.json'));
expect(cards.sourceCommit === HEAD && cards.sourcesCommittedAtRender, 'Card binding');
const cardArtifacts = [];
for (const c of cards.cards) {
  for (const kind of ['svg', 'png']) {
    const p = c[`${kind}Path`];
    const h = c[`${kind}Sha256`];
    expect(sha(fs.readFileSync(p)) === h, 'Card artifact hash');
    cardArtifacts.push({ path: p, sha256: h });
  }
}

const report = {
  verdict: 'INCOMPLETE',
  candidate: { worktree: ROOT, branch: git('branch', '--show-current'), head: HEAD, tree: git('rev-parse', 'HEAD^{tree}') },
  preservation: preservation.map(x => ({ baseline: x.baselineCommit, cycles: x.bodyCycleCount, poses: x.poseCount })),
  repair,
  verifiedCycleCount: artifact.length,
  verifiedCardCount: cards.cards.length
};

fs.writeFileSync(path.join(OUT, 'technique-evidence-gemini.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
