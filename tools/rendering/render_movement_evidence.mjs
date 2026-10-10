#!/usr/bin/env node
/**
 * tools/rendering/render_movement_evidence.mjs
 *
 * Per-movement offline preview evidence: one neutral card per (size x authored
 * position), plus one neutral contact sheet per size.
 *
 * The card itself is defined in lib/evidenceCard.mjs, which this generator
 * shares with verify_movement_evidence.mjs — the gate rebuilds every card and
 * sheet from the manifest and requires the committed bytes to match, so a card
 * filed under the wrong position cannot pass. Geometry, colour and layering
 * come from lib/canonicalSvg.mjs, the same primitive -> SVG mapping
 * render_manifest_evidence.mjs uses, which mirrors MovementPreview.tsx.
 *
 * Three presentations, all at accessibility font scale 1.30:
 *   app240 — the app's own canonical stage fit, min(240/vbW, 240/vbH), on a
 *            320 dp card: what a 320 dp phone actually shows;
 *   320px  — stage fitted to a 320 dp card's content width;
 *   390px  — stage fitted to a 390 dp card's content width.
 *
 * HEADLESS RENDERS ARE APPROXIMATIONS. The geometry and colours are
 * production's, but the rasterizer is librsvg, not Android's or iOS's view
 * compositor, and the text is set in the host's `sans-serif`, not the app's
 * type ramp. These PNGs are engineering render evidence. They are NOT
 * native-device evidence and they are NOT technique approval.
 *
 * Output is offline and deterministic: no network, no clock, no host font
 * measurement (see lib/textFit.mjs).
 *
 * Usage:
 *   node tools/rendering/render_movement_evidence.mjs --movement 9 [--out <dir>]
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { draftInput } from './lib/draftInput.mjs';
const draftSource = draftInput();
import { ROOT, loadCanonicalFigure, readViewBox } from './lib/canonicalSvg.mjs';
import { deriveEntries, loadDerivation } from './lib/derivation.mjs';
import { loadPreviewManifest, previewDataDigest } from './lib/previewData.mjs';
import {
  BODIES,
  FONT_SCALE,
  SIZES,
  buildAllCards,
  buildSheet,
  cardBase,
  sheetBase,
} from './lib/evidenceCard.mjs';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const args = draftSource.args;
let movementId = null;
let outDir = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' || args[i] === '--movement') movementId = Number.parseInt(args[++i], 10);
  else if (args[i] === '--out') outDir = args[++i];
}
if (!Number.isInteger(movementId)) {
  console.error('Usage: node render_movement_evidence.mjs --movement <id> [--out <dir>]');
  process.exit(2);
}

const MANIFEST_PATH = draftSource.input;
// Production reads the whole preview data set through the shared loader (R2
// Part C: the index plus one file per family); a draft run reads the one draft
// file it was given.
const manifest = draftSource.draft
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  : loadPreviewManifest();
// A variant entry stores no frames of its own: it is resolved through the
// production `derivesFrom` contract (the SAME module the app loads) before
// rendering, so a variant is never drawn from a hand-flattened copy (F1).
const derivation = await loadDerivation();
const entry = deriveEntries(manifest.entries, derivation)
  .find((e) => e.movementId === movementId);
if (!entry) {
  console.error(`Movement ID ${movementId} not found in manifest`);
  process.exit(2);
}
if (!entry.frames || entry.frames.length === 0 || entry.frames[0]?.joints?.nk === undefined) {
  console.error(`Movement ${movementId} (${entry.name}) is not a canonical 11-joint entry; this generator renders canonical entries only.`);
  process.exit(2);
}

const viewBox = readViewBox(entry);
const slug = entry.assetKey.split('/')[1] ?? String(movementId);
const OUT = outDir
  ? path.resolve(ROOT, outDir)
  : path.join(ROOT, 'acceptance-evidence/wo09/movements', `mov${String(movementId).padStart(2, '0')}_${slug}`);
if (draftSource.draft && !outDir) throw Error("Draft rendering needs --out");
fs.mkdirSync(OUT, { recursive: true });

const layout = await loadCanonicalFigure();

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function gitOrNull(...gitArgs) {
  try {
    return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const frames = entry.frames;
const index = {
  generatedBy: 'tools/rendering/render_movement_evidence.mjs',
  rendering: 'headless librsvg approximation of production layout primitives; NOT native-device evidence',
  sourceCommit: gitOrNull('rev-parse', 'HEAD'),
  // These renders are reproducible from `sourceCommit` only if the inputs that
  // determine them — the manifest, the production layout module and the
  // rendering tools — were committed at render time.
  sourcesCommittedAtRender: gitOrNull(
    'status', '--porcelain', '--',
    'apps/mobile/src/components/movementPreview',
    'tools/rendering',
    ...(draftSource.draft ? [path.relative(ROOT, MANIFEST_PATH)] : []),
  ) === '',
  generatorCommit: gitOrNull('log', '-1', '--format=%H', '--', 'tools/rendering'),
  // The digest of the preview data this render was made from, and which input
  // it covers. 'single-file-sha256' = one file's own bytes (a draft run, whose
  // verification reads that file back from git at the recorded commit);
  // 'split-preview-data-sha256' = the shared digest over the index and every
  // family file (production since R2 Part C). Production evidence records the
  // digest; only a draft run's digest is re-derived and compared (C10 in
  // verify_movement_evidence.mjs), and pre-split evidence carries no scheme, so
  // it reads as 'single-file-sha256'.
  manifestShaScheme: draftSource.draft ? 'single-file-sha256' : 'split-preview-data-sha256',
  manifestSha256: draftSource.draft ? sha256(fs.readFileSync(MANIFEST_PATH)) : previewDataDigest(),
  ...(draftSource.draft ? { draftOnly: true } : {}),
  movementId,
  movementName: entry.name,
  assetKey: entry.assetKey,
  slug,
  view: entry.view,
  viewBox,
  totalFrames: frames.length,
  bodyContract: 'neutral',
  bodies: BODIES,
  sizes: SIZES.map((s) => s.mode),
  fontScale: FONT_SCALE,
  cards: [],
  sheets: [],
  boneVariance: {},
};

console.log(`Rendering evidence for movement ${movementId}: ${entry.name} (${frames.length} positions, viewBox ${JSON.stringify(viewBox)})`);

const allCards = buildAllCards({ entry, viewBox, layout });

for (const card of allCards) {
  const base = cardBase(slug, card.body, card.mode, card.position);
  const svgPath = path.join(OUT, `${base}.svg`);
  const pngPath = path.join(OUT, `${base}.png`);
  fs.writeFileSync(svgPath, card.svg, 'utf8');
  const png = await sharp(Buffer.from(card.svg)).png().toBuffer();
  fs.writeFileSync(pngPath, png);
  index.cards.push({
    body: card.body,
    mode: card.mode,
    position: card.position,
    frameId: card.frameId,
    caption: card.caption,
    cardWidth: card.cardWidth,
    cardHeight: card.cardHeight,
    stageScale: Number(card.scale.toFixed(4)),
    stage: {
      x: Number(card.stage.x.toFixed(2)), y: Number(card.stage.y.toFixed(2)),
      w: Number(card.stage.w.toFixed(2)), h: Number(card.stage.h.toFixed(2)),
    },
    visibleFigureBounds: card.figureBounds === null ? null : {
      minX: Number(card.figureBounds.minX.toFixed(2)), maxX: Number(card.figureBounds.maxX.toFixed(2)),
      minY: Number(card.figureBounds.minY.toFixed(2)), maxY: Number(card.figureBounds.maxY.toFixed(2)),
    },
    primCount: card.primCount,
    svgPath: path.relative(ROOT, svgPath).replace(/\\/g, '/'),
    pngPath: path.relative(ROOT, pngPath).replace(/\\/g, '/'),
    svgSha256: sha256(card.svg),
    pngSha256: sha256(png),
  });
}

for (const body of BODIES) {
  for (const { mode } of SIZES) {
    const cards = allCards.filter((c) => c.body === body && c.mode === mode);
    const sheet = buildSheet(cards);
    const base = sheetBase(slug, body, mode);
    const svgPath = path.join(OUT, `${base}.svg`);
    const pngPath = path.join(OUT, `${base}.png`);
    fs.writeFileSync(svgPath, sheet.svg, 'utf8');
    const png = await sharp(Buffer.from(sheet.svg)).png().toBuffer();
    fs.writeFileSync(pngPath, png);
    index.sheets.push({
      body,
      mode,
      columns: sheet.columns,
      width: sheet.width,
      height: sheet.height,
      svgPath: path.relative(ROOT, svgPath).replace(/\\/g, '/'),
      pngPath: path.relative(ROOT, pngPath).replace(/\\/g, '/'),
      svgSha256: sha256(sheet.svg),
      pngSha256: sha256(png),
    });
  }
}

// Bone-length variance across the authored keyframes (technique invariant).
const boneLens = {};
for (const frame of frames) {
  for (const [seg, len] of Object.entries(layout.segmentLengths(frame.joints))) {
    (boneLens[seg] ??= []).push(len);
  }
}
for (const [seg, lens] of Object.entries(boneLens)) {
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  index.boneVariance[seg] = {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    variancePct: max === 0 ? 0 : Number((((max - min) / max) * 100).toFixed(2)),
  };
}

fs.writeFileSync(path.join(OUT, 'evidence_index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Wrote ${index.cards.length} cards and ${index.sheets.length} contact sheets to ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
