/**
 * tools/rendering/lib/evidenceCard.mjs — the ONE definition of an evidence card.
 *
 * `render_movement_evidence.mjs` writes cards with this module and
 * `verify_movement_evidence.mjs` REBUILDS them with it, so the gate can ask the
 * question that matters: is the file on disk the card the manifest says belongs
 * at this (body, size, position)?
 *
 * That question is why this lives here rather than inside the generator. An
 * audit swapped Goblet Squat position 2's SVG and PNG for position 1's, left
 * the index untouched, and the gate passed — because every check graded
 * PROPERTIES of whatever file it found (finite, coloured, non-blank, unclipped)
 * and none graded IDENTITY. Properties are preserved by a swap; identity is
 * not.
 *
 * Card construction is deterministic — no clock, no network, no host font
 * measurement (lib/textFit.mjs) — so byte equality between a rebuilt card and
 * the committed one is a sound test, and a mismatch is always a real defect.
 */

import {
  CARD_HEX,
  GROUND_Y,
  ROLE_HEX as HEX,
  appStageScale,
  escapeXml,
  figureBounds,
  isVisiblePrim,
  primToSvg,
} from './canonicalSvg.mjs';
import { measureText, wrapText } from './textFit.mjs';

/** Accessibility text scale every card is rendered at. */
export const FONT_SCALE = 1.30;
/** Card gutter, in px. */
export const PAD = 16;
const EYEBROW_PX = Number((11 * FONT_SCALE).toFixed(2));
const META_PX = Number((12 * FONT_SCALE).toFixed(2));
const CAPTION_PX = Number((14 * FONT_SCALE).toFixed(2));
const FOOT_PX = Number((10 * FONT_SCALE).toFixed(2));
const LINE_GAP = 1.35;

/** The only silhouette emitted by new movement evidence. */
export const BODIES = ['neutral'];
/** Historical evidence only; never used by the generator's default path. */
export const LEGACY_BODIES = ['male', 'female'];

/**
 * The three presentations. `app240` is the app's own canonical stage fit on a
 * 320 dp card; the other two fit the stage to the card's content width.
 */
export const SIZES = [
  { mode: 'app240', cardWidth: 320 },
  { mode: '320px', cardWidth: 320 },
  { mode: '390px', cardWidth: 390 },
];

export const FOOTNOTE = 'Headless librsvg approximation of production layout primitives — not native-device evidence.';

export function stageScaleFor(mode, cardWidth, viewBox) {
  if (mode === 'app240') return appStageScale(viewBox);
  return (cardWidth - 2 * PAD) / viewBox[2];
}

/** A block of wrapped lines with its measured height. */
function block(text, fontPx, maxWidth) {
  const lines = wrapText(text, fontPx, maxWidth);
  return { lines, fontPx, height: lines.length * fontPx * LINE_GAP };
}

function textLines(blk, x, top, fill, weight) {
  return blk.lines.map((line, i) => {
    const y = top + blk.fontPx * (0.82 + i * LINE_GAP);
    const w = weight ? ` font-weight="${weight}"` : '';
    return `<text x="${x}" y="${y.toFixed(2)}" fill="${fill}" font-family="sans-serif" font-size="${blk.fontPx}"${w} xml:space="preserve">${escapeXml(line)}</text>`;
  }).join('');
}

/**
 * One evidence card.
 *
 * Height is DERIVED from the wrapped text blocks and the stage, so no text can
 * be pushed past the bottom edge, and every line is wrapped to the content
 * width, so none can run past the right edge.
 *
 * `layout` is the compiled production module from `loadCanonicalFigure()`;
 * passing it in keeps this module free of the tsc build step so the generator
 * and the gate can share one compile.
 */
export function buildCard({ entry, viewBox, layout, body, mode, cardWidth, frameIndex }) {
  const frame = entry.frames[frameIndex];
  const totalFrames = entry.frames.length;
  const contentWidth = cardWidth - 2 * PAD;
  const scale = stageScaleFor(mode, cardWidth, viewBox);
  const stageW = viewBox[2] * scale;
  const stageH = viewBox[3] * scale;
  // Steps travel with the base pointer on every path: a record carrying
  // `frameRoles` without `derivesFrom` is one the resolver never checked, and
  // the app refuses it at load — so the renderer refuses it too (A2-C4).
  if (entry.frameRoles !== undefined && entry.derivesFrom === undefined) {
    throw new Error(`movement ${entry.movementId}: frameRoles on an entry that carries no derivesFrom`);
  }
  // Variant contract (R2 Part A): a variant's `frameRoles` decides which frame
  // carries the implement tilt. A base entry carries no steps, so it draws
  // exactly as it always has.
  const role = entry.frameRoles === undefined ? undefined : entry.frameRoles[frame.id];
  const prims = layout.layoutCanonicalFigure(frame.joints, {
    view: entry.view ?? 'side',
    body: layout.DUAL_BODY_PARAMETERS[body],
    assetKey: entry.assetKey,
    role,
    implementOrientation: entry.implementOrientation,
    implementCount: entry.implementCount,
    implementScale: entry.implementScale,
    bodyTurnDeg: entry.bodyTurnDeg,
    // Variant-only (B1-55): constant joint offsets, applied at draw time.
    jointOffsets: entry.jointOffsets,
    // Variant-only, front view (B1-300): grip change per hand, re-solved at draw time.
    gripDelta: entry.gripDelta,
  });

  const eyebrow = block(entry.name.toUpperCase(), EYEBROW_PX, contentWidth);
  const meta = block(`Position ${frameIndex + 1} of ${totalFrames} · ${body} · ${mode} · text 130%`, META_PX, contentWidth);
  const caption = block(frame.caption ?? '', CAPTION_PX, contentWidth);
  const foot = block(FOOTNOTE, FOOT_PX, contentWidth);

  const eyebrowTop = PAD;
  const metaTop = eyebrowTop + eyebrow.height + 2;
  const stageTop = metaTop + meta.height + 10;
  const stageX = PAD + Math.max(0, (contentWidth - stageW) / 2);
  const captionTop = stageTop + stageH + 12;
  const footTop = captionTop + caption.height + 8;
  const cardHeight = Math.ceil(footTop + foot.height + PAD);

  const groundY = (GROUND_Y - viewBox[1]) * scale;
  const ground = groundY >= 0 && groundY <= stageH
    ? `<rect x="0" y="${groundY.toFixed(2)}" width="${stageW.toFixed(2)}" height="1" fill="${HEX.line}"/>`
    : '';
  const figure = prims.map((p) => primToSvg(p, viewBox, scale)).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">`
    + `<rect width="100%" height="100%" fill="${CARD_HEX.ink0}"/>`
    + textLines(eyebrow, PAD, eyebrowTop, HEX.textLow, 600)
    + textLines(meta, PAD, metaTop, HEX.textMid)
    + `<g transform="translate(${stageX.toFixed(2)},${stageTop.toFixed(2)})">`
    + `<rect width="${stageW.toFixed(2)}" height="${stageH.toFixed(2)}" fill="${HEX.ink1}"/>${ground}${figure}</g>`
    + textLines(caption, PAD, captionTop, HEX.textHi)
    + textLines(foot, PAD, footTop, HEX.textLow)
    + '</svg>';

  // Visible paint only: ink1 "hole" bars match the stage by construction and
  // an invisible overhang is not a visual defect (see isVisiblePrim).
  const bounds = figureBounds(prims.filter(isVisiblePrim), viewBox, scale);
  return {
    svg,
    body,
    mode,
    position: frameIndex + 1,
    frameId: frame.id,
    caption: frame.caption,
    cardWidth,
    cardHeight,
    scale,
    stage: { x: stageX, y: stageTop, w: stageW, h: stageH },
    figureBounds: bounds === null ? null : {
      minX: stageX + bounds.minX, maxX: stageX + bounds.maxX,
      minY: stageTop + bounds.minY, maxY: stageTop + bounds.maxY,
    },
    primCount: prims.length,
    text: {
      // Widest laid-out line per band, for the fit assertion in the index.
      eyebrow: Math.max(...eyebrow.lines.map((l) => measureText(l, EYEBROW_PX))),
      meta: Math.max(...meta.lines.map((l) => measureText(l, META_PX))),
      caption: Math.max(...caption.lines.map((l) => measureText(l, CAPTION_PX))),
      foot: Math.max(...foot.lines.map((l) => measureText(l, FOOT_PX))),
      contentWidth,
    },
  };
}

/** Every card for one movement, in the generator's write order. */
export function buildAllCards({ entry, viewBox, layout, bodies = BODIES }) {
  const cards = [];
  for (const body of bodies) {
    for (const { mode, cardWidth } of SIZES) {
      for (let i = 0; i < entry.frames.length; i++) {
        cards.push(buildCard({ entry, viewBox, layout, body, mode, cardWidth, frameIndex: i }));
      }
    }
  }
  return cards;
}

/** One contact sheet: this body's positions at this size, left to right. */
export function buildSheet(cards) {
  const sheetH = Math.max(...cards.map((c) => c.cardHeight));
  const sheetW = cards.reduce((acc, c) => acc + c.cardWidth, 0);
  let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}">`
    + `<rect width="100%" height="100%" fill="${CARD_HEX.ink0}"/>`;
  let x = 0;
  for (const card of cards) {
    sheet += `<g transform="translate(${x},0)">${card.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
    x += card.cardWidth;
  }
  sheet += '</svg>';
  return { svg: sheet, width: sheetW, height: sheetH, columns: cards.length, cards };
}

/** Stable file stem for a card, shared by generator and gate. */
export function cardBase(slug, body, mode, position) {
  return `${slug}_${body}_${mode}_pos${position}`;
}

/** Stable file stem for a contact sheet. */
export function sheetBase(slug, body, mode) {
  return `${slug}_${body}_${mode}_sheet`;
}
