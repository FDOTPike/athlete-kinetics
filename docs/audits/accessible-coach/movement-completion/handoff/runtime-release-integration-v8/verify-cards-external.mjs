#!/usr/bin/env node
/**
 * tools/rendering/verify_movement_evidence.mjs — the evidence gate.
 *
 * WO-09 round evidence was, at one point, 537 SVGs full of `NaN` coordinates,
 * zero drawn bones and `fill="textHi"` where a colour belonged — and it was
 * signed off as PASS because nobody opened the PNGs. This gate exists so that
 * cannot recur: it inspects the COMMITTED ARTIFACTS, not the generator that
 * made them, and it fails closed.
 *
 * An audit then showed that grading properties is not enough. Swapping Goblet
 * Squat position 2's SVG and PNG for position 1's — same size, index untouched
 * — passed every check, because a swapped card is still finite, still
 * correctly coloured, still non-blank and still unclipped. Deleting a contact
 * sheet passed too, because sheets were counted from the index and never
 * opened. So the gate now asks about IDENTITY as well as validity: is this the
 * card the manifest says belongs at this (body, size, position), and is every
 * file the index promises actually present and intact?
 *
 * Checks:
 *
 *   C0  structure      index schema, card/sheet counts, files present
 *   C1  finite geometry every numeric SVG attribute is a finite number
 *   C2  resolved colour every fill/stroke is a known theme hex (or "none")
 *   C3  known primitives only <rect>, <circle>, <text> — production emits no
 *                        <line>, so one means the rig was re-implemented
 *   C4  figure present  non-trivial primitive count AND real ink in the stage
 *   C5  on-card         recomputed geometry inside the card rect, and no ink
 *                        touching the card border in the raster
 *   C6  text complete   every text band inked and clear of the margin at
 *                        app240, 320px and 390px, font scale 1.30
 *   C7  honest labelling card and index declare a headless approximation
 *   C8  no ungated art. no render artifact outside an evidence_index.json
 *   C9  recorded hash   on-disk bytes match the SHA-256 the index recorded
 *   C10 identity        the SVG on disk is byte-identical to the card REBUILT
 *                        from the manifest for that body/size/position, and the
 *                        index's own metadata matches the rebuild
 *   C11 raster matches  the PNG is a rasterization of THAT SVG, by pixel
 *                        comparison — so swapping a PNG and its recorded hash
 *                        together still fails
 *   C12 sheets          every contact sheet exists, hashes, rebuilds identically
 *                        and rasterizes to a non-blank image of the right size
 *   C13 coverage        cards are exactly bodies x sizes x authored positions,
 *                        each once; sheets exactly bodies x sizes
 *   C14 card vs sheet    each card PNG agrees with its column inside the
 *                        contact sheet across the WHOLE card, text included
 *
 * C10-C12 are only sound because card construction is deterministic: the
 * builder in lib/evidenceCard.mjs is shared with the generator and reads no
 * clock, no network and no host font metrics.
 *
 * WHAT THIS GATE DOES NOT CERTIFY. C11 deliberately compares only the figure
 * stage, because `sans-serif` resolves to a host font and the text bands of a
 * PNG rendered on one machine cannot be pixel-compared against a raster made
 * on another. C14 closes most of that gap without any host dependency — it
 * compares two COMMITTED artifacts to each other — but it proves the card and
 * the sheet AGREE, not that the glyphs in either one spell the text the SVG
 * contains. Proving that needs a font-deterministic pipeline (an embedded font
 * or text converted to paths) and a re-render of every artifact. Until then the
 * rendered wording is NOT AUTOMATICALLY CERTIFIED and Axis-B render evidence
 * requires human visual review before approval.
 *
 * Usage:
 *   node tools/rendering/verify_movement_evidence.mjs --all
 *   node tools/rendering/verify_movement_evidence.mjs <evidence-dir> [...]
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/node_modules/sharp/lib/index.js';
import { draftInput } from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/tools/rendering/lib/draftInput.mjs';
const draftSource = draftInput();
import { loadPreviewManifest } from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/tools/rendering/lib/previewData.mjs';
import { deriveEntries, loadDerivation } from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/tools/rendering/lib/derivation.mjs';
import {
  CARD_HEX,
  ROLE_HEX,
  ROOT,
  loadCanonicalFigure,
  readViewBox,
} from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/tools/rendering/lib/canonicalSvg.mjs';
import {
  BODIES,
  LEGACY_BODIES,
  SIZES,
  buildAllCards,
  buildSheet,
  cardBase,
  sheetBase,
} from 'file:///C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App/tools/rendering/lib/evidenceCard.mjs';

const MOVEMENTS_DIR = path.join(ROOT, 'acceptance-evidence/wo09/movements');
const MANIFEST_PATH = draftSource.input;

/** Colours a generated card may legally contain. */
const ALLOWED_COLOURS = new Set([...Object.values(ROLE_HEX), ...Object.values(CARD_HEX), 'none']);

/** Minimum share of stage pixels that must be inked for a figure to count. */
const MIN_STAGE_INK_RATIO = 0.02;
/** Minimum primitives a canonical figure must draw. */
const MIN_PRIMS = 8;
/** No ink is tolerated within this many px of the card edge. */
const EDGE_MARGIN_PX = 2;
/** Card background, for ink detection. */
const BG = [0x0a, 0x0a, 0x09];
/** Per-channel delta above which a pixel counts as ink. */
const INK_DELTA = 24;
/**
 * Mean per-channel difference allowed between a PNG's STAGE REGION and a fresh
 * rasterization of its own SVG.
 *
 * Only the stage is compared, and that is deliberate. `sans-serif` resolves to
 * whatever the host installs — these PNGs were rasterized on a box that falls
 * back to a monospace face, while CI runs ubuntu-latest — so comparing the text
 * bands would fail every legitimate card the moment the gate ran anywhere but
 * the machine that rendered it. The stage carries no text: it is pure vector
 * geometry, identical on any rasterizer bar sub-pixel anti-aliasing.
 *
 * Measured across the whole corpus: 0.0000 for a PNG against a fresh raster of
 * its own SVG, and a minimum of 2.739 for the closest same-dimension mismatch
 * that exists (farmer carry app240, position 3 filed as position 4). A
 * threshold of 1.0 sits between them with a 2.7x margin.
 *
 * The card's TEXT is not left unguarded: C10 proves the SVG's text is exactly
 * what the manifest dictates, and C6 proves the committed PNG renders every
 * text band, inked and inside the card.
 */
const MAX_STAGE_MEAN_DELTA = 1.0;
/**
 * Largest per-channel difference tolerated between a card PNG and that card's
 * column inside the contact sheet. Calibrated over all 462 cards: the worst
 * legitimate difference is 12 (librsvg rounding rotated edges differently at
 * large x offsets) and no legitimate pixel exceeds 16, against 159-237 for the
 * text-band tampering this check exists to catch.
 */
const MAX_CARD_SHEET_DELTA = 16;

/** Minimum share of a contact sheet's pixels that must be inked. */
const MIN_SHEET_INK_RATIO = 0.01;

const failures = [];
const notes = [];
let checkedCards = 0;
let checkedSheets = 0;

function fail(card, check, message) {
  failures.push(`${check}  ${card}: ${message}`);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------------------
// SVG-level checks
// ---------------------------------------------------------------------------
const NUMERIC_ATTRS = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'stroke-width', 'opacity', 'font-size'];

function checkSvg(label, svg) {
  // C1 — finite geometry.
  for (const attr of NUMERIC_ATTRS) {
    const re = new RegExp(`\\s${attr}="([^"]*)"`, 'g');
    for (const m of svg.matchAll(re)) {
      const raw = m[1];
      if (raw === '100%') continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) fail(label, 'C1', `attribute ${attr}="${raw}" is not a finite number`);
    }
  }
  if (/\bNaN\b|\bundefined\b|\bInfinity\b/.test(svg)) {
    fail(label, 'C1', 'SVG text contains NaN/undefined/Infinity');
  }

  // C2 — resolved colour roles.
  for (const m of svg.matchAll(/\s(?:fill|stroke)="([^"]*)"/g)) {
    const value = m[1];
    if (value === '100%') continue;
    if (!ALLOWED_COLOURS.has(value)) {
      fail(label, 'C2', `unresolved or unknown colour ${JSON.stringify(value)} (expected a theme hex or "none")`);
    }
  }

  // C3 — known primitives only.
  for (const m of svg.matchAll(/<([a-zA-Z][\w-]*)/g)) {
    const tag = m[1];
    if (!['svg', 'g', 'rect', 'circle', 'text'].includes(tag)) {
      fail(label, 'C3', `unexpected SVG element <${tag}> (production emits bone|circle|rect only)`);
    }
  }

  // C7 — honest labelling. The footnote wraps across several <text> runs, so
  // the declaration is reassembled before it is matched.
  const allText = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ');
  if (!/headless[\s\S]*approximation/i.test(allText) || !/not native-device evidence/i.test(allText)) {
    fail(label, 'C7', 'card does not label itself a headless approximation / non-native evidence');
  }
}

/** Text baselines and font sizes, used to locate text bands in the raster. */
function textBands(svg, cardHeight) {
  const bands = [];
  for (const m of svg.matchAll(/<text\s[^>]*y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)) {
    const y = Number(m[1]);
    const size = Number(m[2]);
    const content = m[3];
    if (!content.trim()) continue;
    bands.push({
      top: Math.max(0, Math.floor(y - size * 0.95)),
      bottom: Math.min(cardHeight - 1, Math.ceil(y + size * 0.32)),
      text: content,
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Raster helpers
// ---------------------------------------------------------------------------
async function rasterStats(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const isInk = (x, y) => {
    const i = (y * width + x) * channels;
    return Math.max(
      Math.abs(data[i] - BG[0]),
      Math.abs(data[i + 1] - BG[1]),
      Math.abs(data[i + 2] - BG[2]),
    ) > INK_DELTA;
  };
  return { data, width, height, channels, isInk };
}

function countInk(raster, x0, y0, x1, y1) {
  let n = 0;
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(raster.width, Math.ceil(x1));
  const yb = Math.min(raster.height, Math.ceil(y1));
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) if (raster.isInk(x, y)) n++;
  return { ink: n, area: Math.max(1, (xb - xa) * (yb - ya)) };
}

/**
 * Mean per-channel difference between two equally sized rasters over one
 * rectangle. Alpha is ignored; only visible RGB is compared.
 */
function meanRegion(a, b, rect) {
  const W = a.width;
  const ch = a.channels;
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(a.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(a.height, Math.ceil(rect.y + rect.h));
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * ch;
      for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[i + c] - b.data[i + c]); n++; }
    }
  }
  return n === 0 ? Number.POSITIVE_INFINITY : sum / n;
}

/**
 * C9 + C11 for one artifact pair: the bytes on disk hash to what the index
 * recorded, and the PNG really is a rasterization of the SVG beside it.
 */
async function checkArtifactPair({ label, dir, record, expectedSvg, kind, stageRects }) {
  const svgPath = path.join(dir, path.basename(record.svgPath));
  const pngPath = path.join(dir, path.basename(record.pngPath));
  if (!fs.existsSync(svgPath)) { fail(label, 'C0', `${kind} SVG missing (${path.basename(svgPath)})`); return null; }
  if (!fs.existsSync(pngPath)) { fail(label, 'C0', `${kind} PNG missing (${path.basename(pngPath)})`); return null; }

  const svgBuf = fs.readFileSync(svgPath);
  const pngBuf = fs.readFileSync(pngPath);
  const svg = svgBuf.toString('utf8');

  // C9 — the index's own hashes.
  if (record.svgSha256 && sha256(svgBuf) !== record.svgSha256) {
    fail(label, 'C9', `${kind} SVG does not match the SHA-256 the index recorded for it`);
  }
  if (record.pngSha256 && sha256(pngBuf) !== record.pngSha256) {
    fail(label, 'C9', `${kind} PNG does not match the SHA-256 the index recorded for it`);
  }

  // C10 — identity against the rebuild from the manifest.
  if (svg !== expectedSvg) {
    fail(label, 'C10', `${kind} SVG is not the ${kind} the manifest describes for this position — `
      + `rebuilding it from the manifest gives different bytes (${expectedSvg.length} vs ${svg.length} chars)`);
  }

  // C11 — the PNG is a rasterization of this SVG.
  let raster;
  try {
    raster = await rasterStats(pngBuf);
  } catch (e) {
    fail(label, 'C11', `${kind} PNG could not be decoded: ${String(e.message).slice(0, 120)}`);
    return null;
  }
  const fresh = await rasterStats(await sharp(Buffer.from(expectedSvg)).png().toBuffer());
  if (fresh.width !== raster.width || fresh.height !== raster.height) {
    fail(label, 'C11', `${kind} PNG is ${raster.width}x${raster.height}, the rebuilt ${kind} rasterizes to ${fresh.width}x${fresh.height}`);
  } else {
    let worst = 0;
    let worstRect = null;
    for (const rect of stageRects) {
      const delta = meanRegion(raster, fresh, rect);
      if (delta > worst) { worst = delta; worstRect = rect; }
    }
    if (worst > MAX_STAGE_MEAN_DELTA) {
      fail(label, 'C11', `${kind} PNG does not draw the figure its own SVG describes `
        + `(mean channel difference ${worst.toFixed(2)} > ${MAX_STAGE_MEAN_DELTA} over the stage at `
        + `${worstRect.x.toFixed(0)},${worstRect.y.toFixed(0)}) — the image shows something else`);
    }
  }
  return { svg, raster };
}

// ---------------------------------------------------------------------------
// Per-card verification
// ---------------------------------------------------------------------------
async function verifyCard({ dir, index, card, rebuilt }) {
  const label = `${index.slug}/${path.basename(card.svgPath)}`;

  const pair = await checkArtifactPair({
    label, dir, record: card, expectedSvg: rebuilt.svg, kind: 'card',
    stageRects: [rebuilt.stage],
  });
  if (pair === null) return;
  const { svg, raster } = pair;

  checkSvg(label, svg);

  // C10 — the index's own metadata must describe the rebuilt card too, or the
  // index could disagree with both the manifest and the file it points at.
  for (const [key, expected] of [
    ['caption', rebuilt.caption], ['frameId', rebuilt.frameId],
    ['cardWidth', rebuilt.cardWidth], ['cardHeight', rebuilt.cardHeight],
    ['primCount', rebuilt.primCount],
  ]) {
    if (card[key] !== undefined && card[key] !== expected) {
      fail(label, 'C10', `index records ${key}=${JSON.stringify(card[key])}, the manifest rebuild gives ${JSON.stringify(expected)}`);
    }
  }

  // C4a — the figure draws real primitives.
  if (rebuilt.primCount < MIN_PRIMS) {
    fail(label, 'C4', `figure draws only ${rebuilt.primCount} primitives (expected >= ${MIN_PRIMS})`);
  }

  // C5a — recomputed geometry sits inside the card rect.
  const b = rebuilt.figureBounds;
  if (b === null) {
    fail(label, 'C5', 'figure has no visible geometry');
  } else if (b.minX < 0 || b.minY < 0 || b.maxX > rebuilt.cardWidth || b.maxY > rebuilt.cardHeight) {
    fail(label, 'C5', `figure bounds [${b.minX.toFixed(1)},${b.minY.toFixed(1)} .. ${b.maxX.toFixed(1)},${b.maxY.toFixed(1)}] fall outside the ${rebuilt.cardWidth}x${rebuilt.cardHeight} card`);
  }

  // C4b — the stage is not blank.
  const stage = rebuilt.stage;
  const stageInk = countInk(raster, stage.x, stage.y, stage.x + stage.w, stage.y + stage.h);
  const ratio = stageInk.ink / stageInk.area;
  if (ratio < MIN_STAGE_INK_RATIO) {
    fail(label, 'C4', `stage is blank or nearly blank: ${(ratio * 100).toFixed(2)}% inked (need >= ${(MIN_STAGE_INK_RATIO * 100).toFixed(0)}%)`);
  }

  // C5b — nothing is clipped at the card border.
  for (const [side, x0, y0, x1, y1] of [
    ['top', 0, 0, raster.width, EDGE_MARGIN_PX],
    ['bottom', 0, raster.height - EDGE_MARGIN_PX, raster.width, raster.height],
    ['left', 0, 0, EDGE_MARGIN_PX, raster.height],
    ['right', raster.width - EDGE_MARGIN_PX, 0, raster.width, raster.height],
  ]) {
    const { ink } = countInk(raster, x0, y0, x1, y1);
    if (ink > 0) fail(label, 'C5', `${ink} inked pixels touch the ${side} card edge (content is clipped)`);
  }

  // C6 — every text band renders, and none runs into the margin.
  const bands = textBands(svg, rebuilt.cardHeight);
  if (bands.length < 4) {
    fail(label, 'C6', `expected eyebrow+meta+caption+footnote text, found ${bands.length} non-empty text runs`);
  }
  for (const band of bands) {
    const { ink } = countInk(raster, 0, band.top, raster.width, band.bottom + 1);
    if (ink === 0) {
      fail(label, 'C6', `text band ${JSON.stringify(band.text.slice(0, 32))} rendered no ink`);
      continue;
    }
    const leftMargin = countInk(raster, 0, band.top, EDGE_MARGIN_PX + 2, band.bottom + 1);
    const rightMargin = countInk(raster, raster.width - (EDGE_MARGIN_PX + 2), band.top, raster.width, band.bottom + 1);
    if (leftMargin.ink > 0 || rightMargin.ink > 0) {
      fail(label, 'C6', `text ${JSON.stringify(band.text.slice(0, 32))} reaches the card margin (clipped at ${card.mode}, font scale ${index.fontScale})`);
    }
  }

  checkedCards++;
}

// ---------------------------------------------------------------------------
// Per-sheet verification
// ---------------------------------------------------------------------------
async function verifySheet({ dir, index, sheet, rebuilt }) {
  const label = `${index.slug}/${path.basename(sheet.svgPath)}`;

  // A sheet is cards laid side by side, so its stages are each card's stage
  // shifted by the widths that precede it.
  let offset = 0;
  const stageRects = [];
  for (const c of rebuilt.cards) {
    stageRects.push({ x: offset + c.stage.x, y: c.stage.y, w: c.stage.w, h: c.stage.h });
    offset += c.cardWidth;
  }
  const pair = await checkArtifactPair({
    label, dir, record: sheet, expectedSvg: rebuilt.svg, kind: 'sheet', stageRects,
  });
  if (pair === null) return;
  const { raster } = pair;

  if (sheet.columns !== undefined && sheet.columns !== rebuilt.columns) {
    fail(label, 'C12', `index records ${sheet.columns} columns, the manifest gives ${rebuilt.columns} authored positions`);
  }
  if (raster.width !== rebuilt.width || raster.height !== rebuilt.height) {
    fail(label, 'C12', `sheet PNG is ${raster.width}x${raster.height}, the rebuilt sheet is ${rebuilt.width}x${rebuilt.height}`);
  }
  const { ink, area } = countInk(raster, 0, 0, raster.width, raster.height);
  if (ink / area < MIN_SHEET_INK_RATIO) {
    fail(label, 'C12', `contact sheet is blank or nearly blank: ${((ink / area) * 100).toFixed(2)}% inked`);
  }

  // C14 — card PNG against its column in this sheet, every pixel, TEXT
  // INCLUDED.
  //
  // A sheet is the card SVGs concatenated at integer offsets and rasterized in
  // the same run, so the two renders of a card agree almost exactly. Almost:
  // at large x offsets librsvg rounds rotated edges marginally differently, so
  // a handful of anti-aliased pixels drift. Measured across all 462 cards the
  // worst legitimate per-pixel difference is 12 and NO legitimate pixel
  // exceeds 16, while replacing a caption band reaches 237 across 3,731 pixels
  // and blanking a heading reaches 159 across 1,108. The bar is therefore "no
  // pixel differs by more than 16".
  //
  // This is the only text check that holds on every platform, because it
  // compares two COMMITTED artifacts to each other and never to a host
  // rasterization. C11 cannot certify text for exactly that reason.
  let colX = 0;
  for (const rebuiltCard of rebuilt.cards) {
    const record = index.cards.find((c) => c.body === sheet.body && c.mode === sheet.mode
      && c.position === rebuiltCard.position);
    if (!record) { colX += rebuiltCard.cardWidth; continue; }
    const cardPng = path.join(dir, path.basename(record.pngPath));
    if (!fs.existsSync(cardPng)) { colX += rebuiltCard.cardWidth; continue; }

    let card;
    try {
      card = await rasterStats(fs.readFileSync(cardPng));
    } catch {
      colX += rebuiltCard.cardWidth;
      continue;
    }

    const w = Math.min(card.width, rebuiltCard.cardWidth);
    const h = Math.min(card.height, rebuiltCard.cardHeight, raster.height);
    let over = 0;
    let worst = 0;
    let firstX = -1;
    let firstY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * card.width + x) * card.channels;
        const j = (y * raster.width + (colX + x)) * raster.channels;
        let d = 0;
        for (let ch = 0; ch < 3; ch++) {
          const v = Math.abs(card.data[i + ch] - raster.data[j + ch]);
          if (v > d) d = v;
        }
        if (d > worst) worst = d;
        if (d > MAX_CARD_SHEET_DELTA) {
          over++;
          if (firstX < 0) { firstX = x; firstY = y; }
        }
      }
    }
    if (over > 0) {
      const band = firstY < rebuiltCard.stage.y ? 'header'
        : firstY > rebuiltCard.stage.y + rebuiltCard.stage.h ? 'caption/footnote'
          : 'stage';
      fail(label, 'C14', `position ${rebuiltCard.position}'s card PNG and its column in this sheet `
        + `differ on ${over} pixel(s), worst ${worst} (first at ${firstX},${firstY}, ${band}) — `
        + 'two renders of the same card must agree, so one of them has been altered');
    }

    // The strip below a short card is sheet background and nothing else.
    outer: for (let y = rebuiltCard.cardHeight; y < raster.height; y++) {
      for (let x = 0; x < rebuiltCard.cardWidth; x++) {
        const j = (y * raster.width + (colX + x)) * raster.channels;
        if (Math.abs(raster.data[j] - BG[0]) > MAX_CARD_SHEET_DELTA
          || Math.abs(raster.data[j + 1] - BG[1]) > MAX_CARD_SHEET_DELTA
          || Math.abs(raster.data[j + 2] - BG[2]) > MAX_CARD_SHEET_DELTA) {
          fail(label, 'C14', `sheet carries content at ${colX + x},${y}, below position `
            + `${rebuiltCard.position}'s card, where only background belongs`);
          break outer;
        }
      }
    }

    colX += rebuiltCard.cardWidth;
  }

  checkedSheets++;
}

// ---------------------------------------------------------------------------
// Index schema
// ---------------------------------------------------------------------------
function indexSchemaErrors(index, expectedBodies) {
  const errors = [];
  if (expectedBodies === null) {
    errors.push(`evidence_index.json has unknown bodyContract ${JSON.stringify(index.bodyContract)}`);
  } else if (JSON.stringify(index.bodies) !== JSON.stringify(expectedBodies)) {
    errors.push(`evidence_index.json bodies must be exactly ${JSON.stringify(expectedBodies)} (got ${JSON.stringify(index.bodies)})`);
  }
  const vb = index.viewBox;
  if (!Array.isArray(vb) || vb.length !== 4 || !vb.every((n) => Number.isFinite(n))) {
    errors.push(`evidence_index.json has no 4-number viewBox (got ${JSON.stringify(vb)}) — the generator did not record the movement crop it rendered`);
  }
  if (!Array.isArray(index.cards) || index.cards.length === 0) {
    errors.push('evidence_index.json lists no cards');
    return errors;
  }
  if (!Array.isArray(index.sheets) || index.sheets.length === 0) {
    errors.push('evidence_index.json lists no contact sheets');
  }
  const required = ['body', 'mode', 'position', 'cardWidth', 'cardHeight', 'stageScale', 'primCount', 'svgPath', 'pngPath', 'svgSha256', 'pngSha256'];
  index.cards.forEach((card, i) => {
    for (const key of required) {
      if (card[key] === undefined) errors.push(`card[${i}] is missing ${key}`);
    }
    const st = card.stage;
    if (!st || !['x', 'y', 'w', 'h'].every((k) => Number.isFinite(st[k]))) {
      errors.push(`card[${i}] is missing finite stage {x,y,w,h}`);
    }
  });
  (index.sheets ?? []).forEach((sheet, i) => {
    for (const key of ['body', 'mode', 'svgPath', 'pngPath', 'svgSha256', 'pngSha256']) {
      if (sheet[key] === undefined) errors.push(`sheet[${i}] is missing ${key}`);
    }
  });
  return errors.slice(0, 8);
}

/**
 * C8 — no ungated render artifacts. A movement directory that ships SVG/PNG
 * stills without an evidence_index.json is invisible to every check above,
 * which is exactly how 537 NaN-bearing SVGs were once signed off as PASS.
 */
function uncoveredArtifacts() {
  const offenders = [];
  if (!fs.existsSync(MOVEMENTS_DIR)) return offenders;
  for (const name of fs.readdirSync(MOVEMENTS_DIR)) {
    const dir = path.join(MOVEMENTS_DIR, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (fs.existsSync(path.join(dir, 'evidence_index.json'))) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /\.(svg|png)$/i.test(x))) {
      offenders.push(`${name}/${f}`);
    }
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// Directory driver
// ---------------------------------------------------------------------------
async function verifyDir(dir, layout) {
  const rel = path.relative(ROOT, dir).replace(/\\/g, '/') || dir;
  const indexPath = path.join(dir, 'evidence_index.json');
  if (!fs.existsSync(indexPath)) {
    failures.push(`C0  ${rel}: no evidence_index.json`);
    return;
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (draftSource.draft) {
    try {
      if (!/^[0-9a-f]{40}$/i.test(index.sourceCommit)) throw Error('invalid source commit');
      execFileSync('git', ['cat-file', '-e', `${index.sourceCommit}^{commit}`], { cwd: ROOT });
      const sourceManifest = execFileSync('git', ['show', `${index.sourceCommit}:${path.relative(ROOT, MANIFEST_PATH).replaceAll('\\', '/')}`], { cwd: ROOT });
      if (index.draftOnly !== true || index.sourcesCommittedAtRender !== true
        || (index.manifestShaScheme ?? 'single-file-sha256') !== 'single-file-sha256'
        || index.manifestSha256 !== sha256(sourceManifest)) {
        failures.push('C10 draft source identity mismatch'); return;
      }
    } catch {
      failures.push('C10 draft source identity mismatch'); return;
    }
  }

  if (!/not native-device evidence/i.test(index.rendering ?? '')) {
    failures.push(`C7  ${index.slug ?? rel}: evidence_index.json does not declare the renders non-native approximations`);
  }

  // Retained evidence predating this contract has no bodyContract marker and
  // remains verifiable as historical proof. Every new generator output marks
  // bodyContract=neutral and must contain only neutral cards and sheets.
  const expectedBodies = index.bodyContract === 'neutral' ? BODIES
    : index.bodyContract === undefined ? LEGACY_BODIES : null;
  const schema = indexSchemaErrors(index, expectedBodies);
  if (schema.length > 0) {
    for (const e of schema) failures.push(`C0  ${index.slug ?? rel}: ${e}`);
    return;
  }

  const entry = resolvedEntries.find((e) => e.movementId === index.movementId);
  if (!entry) {
    failures.push(`C0  ${index.slug ?? rel}: movement ${index.movementId} is not in the manifest`);
    return;
  }

  // Rebuild everything the manifest says this movement's evidence must be.
  let viewBox;
  try {
    viewBox = readViewBox(entry);
  } catch (e) {
    failures.push(`C0  ${index.slug}: ${e.message}`);
    return;
  }
  if (JSON.stringify(viewBox) !== JSON.stringify(index.viewBox)) {
    failures.push(`C10  ${index.slug}: index records viewBox ${JSON.stringify(index.viewBox)}, the manifest gives ${JSON.stringify(viewBox)}`);
    return;
  }
  const rebuiltCards = buildAllCards({ entry, viewBox, layout, bodies: expectedBodies });
  const rebuiltByKey = new Map(rebuiltCards.map((c) => [`${c.body}|${c.mode}|${c.position}`, c]));

  // C13 — coverage: exactly bodies x sizes x positions, each exactly once.
  const seen = new Map();
  for (const card of index.cards) {
    const key = `${card.body}|${card.mode}|${card.position}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const expectedSvg = `${cardBase(index.slug, card.body, card.mode, card.position)}.svg`;
    const expectedPng = `${cardBase(index.slug, card.body, card.mode, card.position)}.png`;
    if (path.basename(card.svgPath) !== expectedSvg || path.basename(card.pngPath) !== expectedPng) {
      failures.push(`C13  ${index.slug}: card ${key.replace(/\|/g, ' / ')} must use filenames ${expectedSvg} and ${expectedPng}`);
    }
  }
  for (const [key, count] of seen) {
    if (count > 1) failures.push(`C13  ${index.slug}: ${count} cards indexed for ${key.replace(/\|/g, ' / ')}`);
    if (!rebuiltByKey.has(key)) failures.push(`C13  ${index.slug}: indexed card ${key.replace(/\|/g, ' / ')} is not a body/size/position the manifest defines`);
  }
  for (const key of rebuiltByKey.keys()) {
    if (!seen.has(key)) failures.push(`C13  ${index.slug}: no card for ${key.replace(/\|/g, ' / ')}`);
  }

  const expectedSheets = new Set();
  for (const body of expectedBodies) for (const { mode } of SIZES) expectedSheets.add(`${body}|${mode}`);
  const seenSheets = new Map();
  for (const sheet of index.sheets) {
    const key = `${sheet.body}|${sheet.mode}`;
    seenSheets.set(key, (seenSheets.get(key) ?? 0) + 1);
    const expectedSvg = `${sheetBase(index.slug, sheet.body, sheet.mode)}.svg`;
    const expectedPng = `${sheetBase(index.slug, sheet.body, sheet.mode)}.png`;
    if (path.basename(sheet.svgPath) !== expectedSvg || path.basename(sheet.pngPath) !== expectedPng) {
      failures.push(`C13  ${index.slug}: sheet ${key.replace('|', ' / ')} must use filenames ${expectedSvg} and ${expectedPng}`);
    }
  }
  for (const key of expectedSheets) {
    if (!seenSheets.has(key)) failures.push(`C13  ${index.slug}: no contact sheet for ${key.replace('|', ' / ')}`);
  }
  for (const [key, count] of seenSheets) {
    if (count > 1) failures.push(`C13  ${index.slug}: ${count} contact sheets indexed for ${key.replace('|', ' / ')}`);
    if (!expectedSheets.has(key)) failures.push(`C13  ${index.slug}: unexpected contact sheet ${key.replace('|', ' / ')}`);
  }

  // Every file on disk under this directory must be one the index names, so a
  // stray or renamed artifact cannot hide beside the graded ones.
  const named = new Set();
  for (const r of [...index.cards, ...index.sheets]) {
    named.add(path.basename(r.svgPath));
    named.add(path.basename(r.pngPath));
  }
  for (const f of fs.readdirSync(dir).filter((x) => /\.(svg|png)$/i.test(x))) {
    if (!named.has(f)) failures.push(`C13  ${index.slug}: ${f} is present but not listed in evidence_index.json`);
  }

  for (const card of index.cards) {
    const rebuilt = rebuiltByKey.get(`${card.body}|${card.mode}|${card.position}`);
    if (!rebuilt) continue; // already reported by C13
    await verifyCard({ dir, index, card, rebuilt });
  }

  for (const sheet of index.sheets) {
    const cards = rebuiltCards.filter((c) => c.body === sheet.body && c.mode === sheet.mode);
    if (cards.length === 0) continue; // already reported by C13
    await verifySheet({ dir, index, sheet, rebuilt: buildSheet(cards) });
  }

  notes.push(`${index.slug}: ${index.cards.length} cards, ${index.sheets.length} sheets, viewBox ${JSON.stringify(index.viewBox)}`);
}

// Production reads the whole preview data set through the shared loader (R2
// Part C: the index plus one file per family); a draft run reads the one draft
// file it was given.
const manifest = draftSource.draft
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  : loadPreviewManifest();
// A variant entry stores no frames of its own: resolve every entry through the
// production `derivesFrom` contract before any lookup, exactly as the renderer
// does. Without this the gate read a variant's missing viewBox as its own and
// failed evidence that is valid (B1-247-C1).
const resolvedEntries = deriveEntries(manifest.entries, await loadDerivation({root: ROOT, buildDir: 'C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion/runtime-release-integration-v8/fresh-card-derivation'}));
const layout = await loadCanonicalFigure({root: ROOT, buildDir: 'C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion/runtime-release-integration-v8/fresh-card-figure'});

const argv = draftSource.args;
if (draftSource.draft && argv.length === 0) throw Error("Draft verification needs an explicit directory");
let dirs;
if (argv.includes('--all') || argv.length === 0) {
  dirs = fs.readdirSync(MOVEMENTS_DIR)
    .map((d) => path.join(MOVEMENTS_DIR, d))
    .filter((d) => fs.statSync(d).isDirectory() && fs.existsSync(path.join(d, 'evidence_index.json')));
} else {
  dirs = argv.filter((a) => !a.startsWith('--')).map((d) => path.resolve(ROOT, d));
}

if (dirs.length === 0) {
  console.error('verify_movement_evidence: no evidence directories to check');
  process.exit(1);
}

for (const dir of dirs) await verifyDir(dir, layout);

if (argv.includes('--all') || argv.length === 0) {
  for (const f of uncoveredArtifacts()) {
    failures.push(`C8  ${f}: render artifact is not covered by an evidence_index.json, so no check grades it`);
  }
}

for (const note of notes) console.log(`  ${note}`);
console.log(`\nchecked ${checkedCards} cards and ${checkedSheets} contact sheets across ${dirs.length} movement(s)`);

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} evidence contract violation(s):`);
  for (const f of failures.slice(0, 60)) console.error(`  ${f}`);
  if (failures.length > 60) console.error(`  ... and ${failures.length - 60} more`);
  process.exit(1);
}
console.log('PASS — what is proven: the SVG of every card and sheet is byte-identical to the');
console.log('       rebuild from the manifest; every file matches its recorded hash; the figure');
console.log('       stage of every PNG matches a fresh raster of its own SVG; every card PNG');
console.log('       agrees with its column in the contact sheet across the whole card, text');
console.log('       included, to within measured rasterizer noise; coverage is complete; and');
console.log('       every text band is inked and inside the card.');
console.log('');
console.log('NOT AUTOMATICALLY CERTIFIED — that the GLYPHS rasterized into a PNG spell the text');
console.log('       its SVG contains. `sans-serif` resolves to a host font, so proving it needs');
console.log('       a font-deterministic pipeline and a re-render of every artifact. C10 proves');
console.log('       the SVG text is exactly what the manifest dictates and C14 proves the card');
console.log('       and sheet renders agree, but agreement is not correctness.');
console.log('       Axis-B render evidence requires human visual review before approval.');
