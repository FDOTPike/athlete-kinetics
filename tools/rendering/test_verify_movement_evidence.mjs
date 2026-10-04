#!/usr/bin/env node
/**
 * tools/rendering/test_verify_movement_evidence.mjs — negative probes for the
 * evidence gate.
 *
 * A gate that has never been seen to fail is not evidence of anything. This
 * harness renders a real movement, confirms the gate PASSES it, then injects
 * one defect at a time and confirms the gate FAILS with the specific check
 * that owns that defect.
 *
 * M1-M7 are the defects that shipped in the first WO-09 movement-card sweep
 * (NaN geometry from a wrong viewBox, theme role names emitted as SVG colours,
 * `line` primitives production never emits, blank figures, off-card geometry,
 * captions clipped at font scale 1.30, and a card that fails to declare itself
 * a headless approximation).
 *
 * M8-M14 are the defects a later audit found the gate accepting. They matter
 * because the first seven all corrupt a card's PROPERTIES, and a gate can
 * catch every one of them while still approving a perfectly well-formed card
 * that is simply the WRONG card, or a card whose companion file has gone
 * missing. M8 in particular is the audit's own reproduction: swap position 2's
 * SVG and PNG for position 1's, at the same size, leaving the index untouched.
 *
 * Exit 0 only when the clean render passes AND every probe fails closed.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadCanonicalFigure, readViewBox } from './lib/canonicalSvg.mjs';
import { loadPreviewManifest } from './lib/previewData.mjs';
import { BODIES, SIZES, buildAllCards, buildSheet, cardBase, sheetBase } from './lib/evidenceCard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const RENDER = path.join(HERE, 'render_movement_evidence.mjs');
const VERIFY = path.join(HERE, 'verify_movement_evidence.mjs');
const DRAFT_MANIFEST = path.join(ROOT, 'acceptance-evidence/wo09/batch3-perspective/draft-manifest.json');
/** Goblet Squat: 5 authored positions, a side view, a held implement. */
const PROBE_MOVEMENT = '14';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wo09-evidence-probe-'));
const clean = path.join(tmpRoot, 'clean');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function runVerify(dir) {
  try {
    const stdout = execFileSync(process.execPath, [VERIFY, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function runDraftVerify(dir) {
  try {
    const stdout = execFileSync(process.execPath, [VERIFY, '--draft-manifest', DRAFT_MANIFEST, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function readIndex(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'evidence_index.json'), 'utf8'));
}

function writeIndex(dir, index) {
  fs.writeFileSync(path.join(dir, 'evidence_index.json'), `${JSON.stringify(index, null, 2)}\n`);
}

/** A card record and its on-disk paths, chosen by body/mode/position. */
function pick(dir, { body = 'neutral', mode = '320px', position = 1 } = {}) {
  const index = readIndex(dir);
  const card = index.cards.find((c) => c.body === body && c.mode === mode && c.position === position);
  if (!card) throw new Error(`probe setup: no card ${body}/${mode}/pos${position}`);
  return {
    index,
    card,
    svgPath: path.join(dir, path.basename(card.svgPath)),
    pngPath: path.join(dir, path.basename(card.pngPath)),
  };
}

function pickSheet(dir, { body = 'neutral', mode = '320px' } = {}) {
  const index = readIndex(dir);
  const sheet = index.sheets.find((s) => s.body === body && s.mode === mode);
  if (!sheet) throw new Error(`probe setup: no sheet ${body}/${mode}`);
  return {
    index,
    sheet,
    svgPath: path.join(dir, path.basename(sheet.svgPath)),
    pngPath: path.join(dir, path.basename(sheet.pngPath)),
  };
}

async function reraster(svgPath, pngPath) {
  await sharp(Buffer.from(fs.readFileSync(svgPath, 'utf8'))).png().toFile(pngPath);
}

function replaceOnce(text, needle, replacement, what) {
  const at = text.indexOf(needle);
  if (at < 0) throw new Error(`probe setup: could not find ${what}`);
  return text.slice(0, at) + replacement + text.slice(at + needle.length);
}

// ---------------------------------------------------------------------------
// Mutations. Each returns the check code it must provoke.
// ---------------------------------------------------------------------------
const MUTATIONS = [
  {
    name: 'M1  non-finite coordinate (the wrong-viewBox NaN defect)',
    expect: 'C1',
    async apply(dir) {
      const { svgPath } = pick(dir);
      let svg = fs.readFileSync(svgPath, 'utf8');
      const m = svg.match(/<circle cx="(-?[\d.]+)"/);
      if (!m) throw new Error('probe setup: no circle to corrupt');
      svg = replaceOnce(svg, `<circle cx="${m[1]}"`, '<circle cx="NaN"', 'a circle cx');
      fs.writeFileSync(svgPath, svg);
    },
  },
  {
    name: 'M2  theme role name emitted as an SVG colour',
    expect: 'C2',
    async apply(dir) {
      const { svgPath } = pick(dir);
      const svg = fs.readFileSync(svgPath, 'utf8');
      fs.writeFileSync(svgPath, replaceOnce(svg, 'fill="#F7F6F3"', 'fill="textHi"', 'a textHi fill'));
    },
  },
  {
    name: 'M3  a <line> primitive production never emits',
    expect: 'C3',
    async apply(dir) {
      const { svgPath } = pick(dir);
      const svg = fs.readFileSync(svgPath, 'utf8');
      fs.writeFileSync(svgPath, replaceOnce(svg, '</svg>', '<line x1="10" y1="10" x2="40" y2="40" stroke="#F7F6F3"/></svg>', 'the closing tag'));
    },
  },
  {
    name: 'M4  blank figure (stage drawn, no bones)',
    expect: 'C4',
    async apply(dir) {
      const { svgPath, pngPath } = pick(dir);
      let svg = fs.readFileSync(svgPath, 'utf8');
      svg = svg.replace(/(<g transform="translate\([\d.,]+\)"><rect[^>]*\/>)[\s\S]*?(<\/g>)/, '$1$2');
      fs.writeFileSync(svgPath, svg);
      await reraster(svgPath, pngPath);
    },
  },
  {
    name: 'M5  off-card geometry (stage pushed past the card edge)',
    expect: 'C5',
    async apply(dir) {
      const { index, card, svgPath, pngPath } = pick(dir);
      const shifted = card.stage.x - 120;
      let svg = fs.readFileSync(svgPath, 'utf8');
      svg = replaceOnce(
        svg,
        `<g transform="translate(${card.stage.x.toFixed(2)},${card.stage.y.toFixed(2)})">`,
        `<g transform="translate(${shifted.toFixed(2)},${card.stage.y.toFixed(2)})">`,
        'the stage transform',
      );
      fs.writeFileSync(svgPath, svg);
      await reraster(svgPath, pngPath);
      index.cards.find((c) => c.svgPath === card.svgPath).stage.x = shifted;
      writeIndex(dir, index);
    },
  },
  {
    name: 'M6  caption clipped at the card edge (font scale 1.30, unwrapped)',
    expect: 'C6',
    async apply(dir) {
      const { svgPath, pngPath } = pick(dir);
      let svg = fs.readFileSync(svgPath, 'utf8');
      const m = svg.match(/<text x="16" y="([\d.]+)" fill="#F7F6F3"([^>]*)>([^<]*)<\/text>/);
      if (!m) throw new Error('probe setup: no caption run found');
      svg = replaceOnce(
        svg,
        m[0],
        `<text x="16" y="${m[1]}" fill="#F7F6F3"${m[2]}>Hold the load close to the chest with the elbows tucked in tight</text>`,
        'the caption run',
      );
      fs.writeFileSync(svgPath, svg);
      await reraster(svgPath, pngPath);
    },
  },
  {
    name: 'M7  card does not declare itself a headless approximation',
    expect: 'C7',
    async apply(dir) {
      const { svgPath } = pick(dir);
      const svg = fs.readFileSync(svgPath, 'utf8');
      fs.writeFileSync(svgPath, svg.replace(/<text[^>]*fill="#6B6963"[^>]*font-size="13"[^>]*>[^<]*<\/text>/g, ''));
    },
  },

  // --- defects the audit found the gate accepting ---------------------------
  {
    name: 'M8  same-size position swap, index untouched (audit P1a)',
    expect: 'C10',
    async apply(dir) {
      const a = pick(dir, { position: 1 });
      const b = pick(dir, { position: 2 });
      fs.copyFileSync(a.svgPath, b.svgPath);
      fs.copyFileSync(a.pngPath, b.pngPath);
    },
  },
  {
    name: 'M9  contact sheet PNG deleted (audit P1b)',
    expect: 'C0',
    async apply(dir) {
      fs.rmSync(pickSheet(dir).pngPath);
    },
  },
  {
    name: 'M10 contact sheet PNG blanked at the same dimensions',
    expect: 'C11',
    async apply(dir) {
      const { pngPath } = pickSheet(dir);
      const { width, height } = await sharp(pngPath).metadata();
      await sharp({ create: { width, height, channels: 4, background: { r: 10, g: 10, b: 9, alpha: 1 } } })
        .png().toFile(`${pngPath}.tmp`);
      fs.renameSync(`${pngPath}.tmp`, pngPath);
    },
  },
  {
    name: 'M11 position swap WITH the index hashes swapped to match',
    expect: 'C10',
    async apply(dir) {
      const index = readIndex(dir);
      const a = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 1);
      const b = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 2);
      fs.copyFileSync(path.join(dir, path.basename(a.svgPath)), path.join(dir, path.basename(b.svgPath)));
      fs.copyFileSync(path.join(dir, path.basename(a.pngPath)), path.join(dir, path.basename(b.pngPath)));
      // Forge the record so the recorded-hash check (C9) is satisfied.
      b.svgSha256 = sha256(fs.readFileSync(path.join(dir, path.basename(b.svgPath))));
      b.pngSha256 = sha256(fs.readFileSync(path.join(dir, path.basename(b.pngPath))));
      writeIndex(dir, index);
    },
  },
  {
    name: 'M12 an authored position has no card at all',
    expect: 'C13',
    async apply(dir) {
      const index = readIndex(dir);
      const victim = index.cards.find((c) => c.body === 'neutral' && c.mode === '390px' && c.position === 3);
      fs.rmSync(path.join(dir, path.basename(victim.svgPath)));
      fs.rmSync(path.join(dir, path.basename(victim.pngPath)));
      index.cards = index.cards.filter((c) => c !== victim);
      writeIndex(dir, index);
    },
  },
  {
    name: 'M13 a stray render artifact sits beside the graded ones',
    expect: 'C13',
    async apply(dir) {
      const { pngPath } = pick(dir);
      fs.copyFileSync(pngPath, path.join(dir, 'goblet-squat_neutral_320px_pos1_EXTRA.png'));
    },
  },
  {
    name: 'M15 ONLY the PNG swapped, its hash forged, SVG left correct',
    expect: 'C11',
    async apply(dir) {
      // The one defect C9 and C10 cannot see: the SVG still matches the
      // manifest and the recorded hashes still match the files, but the image
      // a reviewer actually looks at shows a different position.
      const index = readIndex(dir);
      const src = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 1);
      const dst = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 2);
      const dstPng = path.join(dir, path.basename(dst.pngPath));
      fs.copyFileSync(path.join(dir, path.basename(src.pngPath)), dstPng);
      dst.pngSha256 = sha256(fs.readFileSync(dstPng));
      writeIndex(dir, index);
    },
  },
  {
    name: 'M16 legacy male filename injected into neutral evidence',
    expect: 'C13',
    async apply(dir) {
      const { index, card, svgPath, pngPath } = pick(dir, { mode: '320px', position: 3 });
      const maleSvg = svgPath.replace('_neutral_', '_male_');
      const malePng = pngPath.replace('_neutral_', '_male_');
      fs.renameSync(svgPath, maleSvg);
      fs.renameSync(pngPath, malePng);
      card.svgPath = card.svgPath.replace('_neutral_', '_male_');
      card.pngPath = card.pngPath.replace('_neutral_', '_male_');
      writeIndex(dir, index);
    },
  },
  {
    name: 'M19 legacy body label injected into evidence metadata',
    expect: 'C0',
    async apply(dir) {
      const index = readIndex(dir);
      index.bodies = ['male'];
      writeIndex(dir, index);
    },
  },
  {
    name: 'M17 a card PNG caption band repainted with the caption from another position, hash forged',
    expect: 'C14',
    async apply(dir) {
      // The audit's first case. Nothing about the card is malformed: the SVG
      // still matches the manifest, the stage still matches the SVG, the text
      // band is still inked and inside the card, and the recorded hash matches
      // the file. Only the rendered WORDS are another position's.
      const index = readIndex(dir);
      const src = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 1);
      const dst = index.cards.find((c) => c.body === 'neutral' && c.mode === '320px' && c.position === 2);
      const srcPng = path.join(dir, path.basename(src.pngPath));
      const dstPng = path.join(dir, path.basename(dst.pngPath));
      const top = Math.round(dst.stage.y + dst.stage.h + 12);
      const height = Math.min(60, dst.cardHeight - top - 20);
      const band = await sharp(srcPng).extract({ left: 0, top, width: dst.cardWidth, height }).png().toBuffer();
      const out = await sharp(dstPng).composite([{ input: band, top, left: 0 }]).png().toBuffer();
      fs.writeFileSync(dstPng, out);
      dst.pngSha256 = sha256(fs.readFileSync(dstPng));
      writeIndex(dir, index);
    },
  },
  {
    name: 'M18 a contact sheet heading band blanked, hash forged',
    expect: 'C14',
    async apply(dir) {
      // The audit's second case. The sheet stays the right size, stays well
      // inked overall, and hashes to its record — but the heading a reviewer
      // reads to know which movement and position they are looking at is gone.
      const index = readIndex(dir);
      const sheet = index.sheets.find((s) => s.body === 'neutral' && s.mode === '320px');
      const sheetPng = path.join(dir, path.basename(sheet.pngPath));
      const { width } = await sharp(sheetPng).metadata();
      const blank = await sharp({ create: { width, height: 40, channels: 4, background: { r: 10, g: 10, b: 9, alpha: 1 } } })
        .png().toBuffer();
      const out = await sharp(sheetPng).composite([{ input: blank, top: 8, left: 0 }]).png().toBuffer();
      fs.writeFileSync(sheetPng, out);
      sheet.pngSha256 = sha256(fs.readFileSync(sheetPng));
      writeIndex(dir, index);
    },
  },
  {
    name: 'M14 caption text altered in the card only',
    expect: 'C10',
    async apply(dir) {
      const { svgPath, pngPath } = pick(dir);
      let svg = fs.readFileSync(svgPath, 'utf8');
      const m = svg.match(/<text x="16" y="([\d.]+)" fill="#F7F6F3"([^>]*)>([^<]*)<\/text>/);
      if (!m) throw new Error('probe setup: no caption run found');
      svg = replaceOnce(svg, m[0], `<text x="16" y="${m[1]}" fill="#F7F6F3"${m[2]}>Lock the knees</text>`, 'the caption run');
      fs.writeFileSync(svgPath, svg);
      await reraster(svgPath, pngPath);
      const index = readIndex(dir);
      const rec = index.cards.find((c) => path.basename(c.svgPath) === path.basename(svgPath));
      rec.svgSha256 = sha256(fs.readFileSync(svgPath));
      rec.pngSha256 = sha256(fs.readFileSync(pngPath));
      writeIndex(dir, index);
    },
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`probe corpus: movement ${PROBE_MOVEMENT} rendered to ${clean}`);
execFileSync(process.execPath, [RENDER, '--movement', PROBE_MOVEMENT, '--out', clean], { stdio: 'ignore' });

const failures = [];

// R2 Part C: the preview data is an index plus one file per family.
const manifest = loadPreviewManifest();
const probeEntry = manifest.entries.find((entry) => entry.movementId === Number(PROBE_MOVEMENT));
const elevenEntry = {
  ...probeEntry,
  frames: Array.from({ length: 11 }, (_, i) => ({
    ...probeEntry.frames[i % probeEntry.frames.length],
    id: `neutral-contract-${i + 1}`,
  })),
};
const layout = await loadCanonicalFigure();

// Family 38: the rack must fit its crop, or it clips the card and bleeds
// across columns when buildSheet embeds cards without their SVG viewport.
for (const movementId of [135, 187]) {
  const entry = manifest.entries.find(e => e.movementId === movementId);
  if (!entry?.frames?.length) {
    failures.push('family 38 movement ' + movementId + ' missing its drawn frames');
    continue;
  }
  for (const card of buildAllCards({ entry, viewBox: readViewBox(entry), layout })) {
    const b = card.figureBounds;
    const s = card.stage;
    if (!b || b.minX < s.x || b.maxX > s.x + s.w
      || b.minY < s.y || b.maxY > s.y + s.h) {
      failures.push('family 38 movement ' + movementId + ', ' + card.mode
        + ', position ' + card.position + ': visible figure exceeds its crop');
    }
  }
}

const elevenCards = buildAllCards({ entry: elevenEntry, viewBox: readViewBox(elevenEntry), layout });
const elevenSheets = BODIES.flatMap((body) => SIZES.map(({ mode }) =>
  buildSheet(elevenCards.filter((card) => card.body === body && card.mode === mode))));
const stems = [
  ...elevenCards.map((card) => cardBase('probe', card.body, card.mode, card.position)),
  ...BODIES.flatMap((body) => SIZES.map(({ mode }) => sheetBase('probe', body, mode))),
];
if (elevenCards.length !== 33 || elevenSheets.length !== 3
  || (elevenCards.length + elevenSheets.length) * 2 !== 72
  || stems.some((stem) => !stem.includes('_neutral_') || /_(?:male|female)_/.test(stem))) {
  failures.push('11-position neutral contract must produce 33 cards, 3 sheets and 72 SVG/PNG files with neutral-only names');
} else {
  console.log('  11-position contract 33 cards / 3 sheets / 72 SVG+PNG files');
}

const cleanIndex = readIndex(clean);
if (JSON.stringify(cleanIndex.bodies) !== JSON.stringify(['neutral'])
  || cleanIndex.bodyContract !== 'neutral'
  || cleanIndex.cards.length !== 15 || cleanIndex.sheets.length !== 3
  || JSON.stringify(cleanIndex).includes('"male"') || JSON.stringify(cleanIndex).includes('"female"')) {
  failures.push('clean generated evidence must contain only neutral metadata with 15 cards and 3 sheets');
}

const baseline = runVerify(clean);
if (baseline.code !== 0) {
  failures.push(`clean render must PASS the gate, got exit ${baseline.code}:\n${baseline.output}`);
  console.log('  clean render      FAIL (expected pass)');
} else {
  console.log('  clean render      pass');
}

const provenanceDir = path.join(tmpRoot, 'provenance');
// Build a positive draft fixture from the committed historical manifest.
// Do not rely on an untracked local artifact folder, or let three mutations
// pass merely because their unchanged starting fixture was already invalid.
execFileSync(process.execPath, [RENDER, '--draft-manifest', DRAFT_MANIFEST, '--movement', '1', '--out', provenanceDir],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const cleanDraft = runDraftVerify(provenanceDir);
if (cleanDraft.code !== 0) failures.push(`clean source-bound draft must PASS before identity mutations:\n${cleanDraft.output}`);
else console.log('  clean source-bound draft pass');
const provenance = readIndex(provenanceDir);
for (const [name, change] of [
  ['different manifest hash', i => { i.manifestSha256 = sha256(fs.readFileSync(path.join(ROOT, 'apps/mobile/src/components/movementPreview/previewIndex.json'))); }],
  ['empty commit', i => { i.sourceCommit = ''; }],
  ['malformed commit', i => { i.sourceCommit = 'not-a-commit'; }],
]) {
  const dir = path.join(tmpRoot, `provenance-${name.replaceAll(' ', '-')}`);
  fs.cpSync(provenanceDir, dir, { recursive: true });
  const index = readIndex(dir); change(index); writeIndex(dir, index);
  const result = runDraftVerify(dir);
  if (result.code === 0 || !result.output.includes('C10 draft source identity mismatch')) failures.push(`draft ${name}: expected C10 failure`);
  else console.log(`  draft ${name} rejected by C10`);
}

for (const mutation of MUTATIONS) {
  const dir = path.join(tmpRoot, mutation.name.slice(0, 3).trim());
  fs.cpSync(clean, dir, { recursive: true });
  await mutation.apply(dir);
  const result = runVerify(dir);
  const caught = result.code !== 0 && result.output.includes(`${mutation.expect}  `);
  if (!caught) {
    failures.push(`${mutation.name}: expected ${mutation.expect} failure, got exit ${result.code}\n${result.output}`);
    console.log(`  ${mutation.name}  NOT CAUGHT`);
  } else {
    console.log(`  ${mutation.name}  rejected by ${mutation.expect}`);
  }
}

fs.rmSync(tmpRoot, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\nFAIL — the evidence gate does not fail closed (${failures.length}):`);
  for (const f of failures) console.error(`\n${f}`);
  process.exit(1);
}
console.log(`\nPASS — clean evidence passes and all ${MUTATIONS.length} injected defects are rejected by their own check.`);
