#!/usr/bin/env node
// HISTORICAL (pinned to bd3243d5): reads the pre-R2 single-file preview manifest, which the app and the gates no longer read (it remains as the split generator's input and its check oracle); not wired to any gate.
/**
 * tools/rendering/render_manifest_evidence.mjs
 *
 * Renders the canonical 11-joint movement previews from the manifest through
 * the APP'S OWN layout module (apps/mobile/src/components/movementPreview/
 * canonicalFigure.ts, compiled with tsc at startup) into SVG -> PNG.
 *
 * This is the honest evidence path for WO-09 review rounds: every still in
 * acceptance-evidence/wo09/roundX/ is produced from the same primitive list
 * the React Native component draws. A visual claim about a frame can
 * therefore be traced to a rendered artifact built from production code, not
 * to source inspection alone.
 *
 * The primitive -> SVG mapping itself lives in lib/canonicalSvg.mjs and is
 * shared with render_movement_evidence.mjs, so the two generators cannot
 * drift apart.
 *
 * Headless renders are APPROXIMATIONS of the app's drawing: identical
 * geometry and colour, but rasterized by librsvg rather than by Android's or
 * iOS's view compositor. They are not native-device evidence.
 *
 * Usage:
 *   node tools/rendering/render_manifest_evidence.mjs --out acceptance-evidence/wo09/round1_baseline
 *
 * Per movement (12 canonical movements), per body (male/female):
 *   - all keyframes (stills),
 *   - the midpoint of every keyframe transition (sampled interpolation),
 *   - a contact sheet at 390 px cell width and one at 320 px (phone-size
 *     legibility, R3 criterion 7),
 *   - a bone-length variance audit JSON across keyframes AND samples
 *     (R3 criterion 2).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  GROUND_Y,
  ROLE_HEX as HEX,
  ROOT,
  loadCanonicalFigure,
  primToSvg,
} from './lib/canonicalSvg.mjs';

const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i >= 0 ? path.resolve(ROOT, process.argv[i + 1]) : path.resolve(ROOT, 'acceptance-evidence/wo09/round_current');
})();

/**
 * librsvg refuses an input surface wider or taller than 32767 px. A long
 * movement (walking lunge samples to 85 poses) overruns that in one row, so
 * contact sheets chunk into parts. A sheet that already fits keeps its
 * original single-file name and bytes.
 */
const SHEET_MAX_PX = 32000;

// ---------------------------------------------------------------------------
// 1. Compile the production layout module (plain TS, no RN imports).
// ---------------------------------------------------------------------------
const { layoutCanonicalFigure, lerpJoints, easeInOut, segmentDurations, segmentLengths, DUAL_BODY_PARAMETERS }
  = await loadCanonicalFigure();

// ---------------------------------------------------------------------------
// 2. Load the manifest and select the 12 canonical authored movements.
// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(
  path.join(ROOT, 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json'), 'utf8',
));

const movements = manifest.entries.filter((e) =>
  e.frames && e.frames.length > 0 && e.frames[0].joints && e.frames[0].joints.nk !== undefined,
);

/**
 * One rendered still. `widthPx` is the target on-screen width of the whole
 * drawing (e.g. 320 or 390 for a full-width phone card).
 */
function renderSvg(movement, pose, body, widthPx) {
  const vb = movement.viewBox ?? [0, 0, 100, 100];
  const scale = widthPx / vb[2];
  const heightPx = Math.round(vb[3] * scale);
  const prims = layoutCanonicalFigure(pose, { view: movement.view ?? 'side', body, assetKey: movement.assetKey });
  const groundY = (GROUND_Y - vb[1]) * scale;
  const ground = groundY >= 0 && groundY <= heightPx
    ? `<rect x="0" y="${groundY.toFixed(1)}" width="${widthPx}" height="1" fill="${HEX.line}"/>` : '';
  const body_svg = prims.map((p) => primToSvg(p, vb, scale)).join('');
  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb[2] * scale} ${vb[3] * scale}" width="${widthPx}" height="${heightPx}">` +
      `<rect width="100%" height="100%" fill="${HEX.ink1}"/>${ground}${body_svg}</svg>`,
    widthPx,
    heightPx,
  };
}

const slug = (assetKey) => assetKey.split('/')[1] ?? String(assetKey);

// ---------------------------------------------------------------------------
// 3. Pose enumeration: keyframes + midpoint of every transition.
// ---------------------------------------------------------------------------
function poses(movement) {
  const frames = movement.frames.map((f) => f.joints);
  const segs = segmentDurations(frames.length, movement.segmentDurationsMs);
  const out = [];
  frames.forEach((joints, i) => {
    out.push({ label: `frame${i + 1}`, kind: 'keyframe', index: i, joints });
    if (i < frames.length - 1) {
      out.push({
        label: `sample${i + 1}_${i + 2}`,
        kind: 'sample',
        index: i + 0.5,
        joints: lerpJoints(frames[i], frames[i + 1], easeInOut(0.5)),
      });
    }
  });
  return { out, segs };
}

// ---------------------------------------------------------------------------
// 4. Render everything.
// ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const audit = { generatedBy: 'tools/rendering/render_manifest_evidence.mjs', movements: [] };

for (const movement of movements) {
  const key = slug(movement.assetKey);
  const { out: poseList } = poses(movement);
  const auditRows = [];

  for (const bodyName of ['male', 'female']) {
    const body = DUAL_BODY_PARAMETERS[bodyName];
    for (const pose of poseList) {
      for (const widthPx of [390, 320]) {
        const { svg } = renderSvg(movement, pose.joints, body, widthPx);
        const name = `${key}_${pose.label}_${bodyName}_${widthPx}px`;
        writeFileSync(path.join(OUT, `${name}.svg`), svg);
        await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${name}.png`));
      }
    }

    // Bone-length variance audit across keyframes + samples (criterion 2).
    const segs = {};
    for (const pose of poseList) {
      const lens = segmentLengths(pose.joints);
      for (const [seg, len] of Object.entries(lens)) {
        (segs[seg] ??= []).push(len);
      }
    }
    const variance = {};
    for (const [seg, lens] of Object.entries(segs)) {
      const max = Math.max(...lens), min = Math.min(...lens);
      variance[seg] = {
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        variancePct: max === 0 ? 0 : Number((((max - min) / max) * 100).toFixed(2)),
      };
    }
    auditRows.push({ body: bodyName, segments: variance });
  }

  // Contact sheets: rows = male/female, columns = poses, cell 390px / 320px.
  for (const cell of [390, 320]) {
    const first = renderSvg(movement, poseList[0].joints, DUAL_BODY_PARAMETERS.male, cell);
    const cellH = first.heightPx;
    const header = 34;
    const maxCols = Math.max(1, Math.floor(SHEET_MAX_PX / cell));
    const chunks = [];
    for (let i = 0; i < poseList.length; i += maxCols) chunks.push(poseList.slice(i, i + maxCols));

    for (const [chunkIndex, chunkPoses] of chunks.entries()) {
      const W = chunkPoses.length * cell;
      const H = header + 2 * (cellH + 26);
      let parts = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${HEX.ink1}"/>`;
      const part = chunks.length > 1 ? ` [part ${chunkIndex + 1}/${chunks.length}]` : '';
      parts += `<text x="8" y="22" fill="${HEX.textMid}" font-family="sans-serif" font-size="15">${movement.name} (${movement.view}) — ${cell}px cells${part}</text>`;
      chunkPoses.forEach((pose, i) => {
        const { svg, heightPx } = renderSvg(movement, pose.joints, DUAL_BODY_PARAMETERS.male, cell);
        const x = i * cell, y = header;
        parts += `<g transform="translate(${x},${y})"><rect width="${cell}" height="${heightPx}" fill="${HEX.ink1}"/>${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
        parts += `<text x="${x + 6}" y="${y + heightPx + 18}" fill="${HEX.textMid}" font-family="sans-serif" font-size="12">${pose.label}</text>`;
      });
      const y2 = header + cellH + 26;
      chunkPoses.forEach((pose, i) => {
        const { svg, heightPx } = renderSvg(movement, pose.joints, DUAL_BODY_PARAMETERS.female, cell);
        const x = i * cell;
        parts += `<g transform="translate(${x},${y2})"><rect width="${cell}" height="${heightPx}" fill="${HEX.ink1}"/>${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
      });
      parts += `<text x="8" y="${header + cellH + 20}" fill="${HEX.textLow}" font-family="sans-serif" font-size="12">male (top row) / female (bottom row)</text>`;
      parts += '</svg>';
      const suffix = chunks.length > 1 ? `_part${chunkIndex + 1}of${chunks.length}` : '';
      const sheetName = `${key}_contact_${cell}px${suffix}`;
      writeFileSync(path.join(OUT, `${sheetName}.svg`), parts);
      await sharp(Buffer.from(parts)).png().toFile(path.join(OUT, `${sheetName}.png`));
    }
  }

  audit.movements.push({
    movementId: movement.movementId,
    assetKey: movement.assetKey,
    name: movement.name,
    view: movement.view,
    frames: movement.frames.length,
    boneVariance: auditRows,
  });
  console.log(`rendered ${movement.name} (${key}): ${poseList.length} poses x 2 bodies x 2 widths`);
}

writeFileSync(path.join(OUT, 'bone_variance_audit.json'), JSON.stringify(audit, null, 2));
console.log(`\nevidence written to ${OUT}`);
