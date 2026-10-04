/**
 * tools/rendering/lib/canonicalSvg.mjs — the ONE headless primitive -> SVG path.
 *
 * WO-09 evidence is only worth reading if the drawing in a PNG is the drawing
 * the app performs. That holds when exactly one module turns
 * `layoutCanonicalFigure()` primitives into SVG, and every generator imports
 * it. This is that module; `render_manifest_evidence.mjs` (round sweeps) and
 * `render_movement_evidence.mjs` (per-movement cards) both consume it, so a
 * second, divergent rasterizer cannot drift away from production again.
 *
 * The contract mirrored here is `MovementPreview.tsx`'s CanonicalStage:
 *  - geometry comes from the movement's OWN `viewBox` crop, never the global
 *    manifest box (they are different rectangles, and the manifest box has no
 *    x/y at all);
 *  - primitive kinds are `bone` | `circle` | `rect` — there is no `line`;
 *  - a bone is a ROUNDED BAR of width `w` box-units, drawn as a rotated rect
 *    with rx = thickness/2, not a stroked line;
 *  - colours are theme ROLES resolved through ROLE_HEX, never emitted raw;
 *  - `opacity` and the optional `stroke`/`strokeWidth` outline are carried
 *    through, because the torso reads as a hole without its contour;
 *  - primitive ORDER is the z-order; `layoutCanonicalFigure` already emits
 *    ground/far/torso/near/head/implement layering, so nothing re-sorts.
 *
 * Every helper here fails closed: an unknown primitive kind, an unknown colour
 * role or a non-finite number throws rather than emitting NaN or a role name
 * into an SVG attribute.
 */

import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');

/**
 * Theme role -> hex, mirroring apps/mobile/src/theme/theme.ts. `MovementPreview`
 * resolves the same five roles through `roleColor()`; these are the only
 * colours a figure may contain. Chalk (#EFC94C) is deliberately absent.
 */
export const ROLE_HEX = Object.freeze({
  textHi: '#F7F6F3',
  textMid: '#A9A7A0',
  textLow: '#6B6963',
  line: '#262623',
  ink1: '#141412',
});

/** Extra surface colours a CARD may use (never a figure primitive). */
export const CARD_HEX = Object.freeze({
  ink0: '#0A0A09',
});

/** The ground line the drawings sit on, in box units (MovementPreview.tsx). */
export const GROUND_Y = 96.9;

/** The app's canonical stage fit, in dp (MovementPreview.tsx CANONICAL_FIT). */
export const CANONICAL_FIT = 240;

export class EvidenceContractError extends Error {}

function fail(message) {
  throw new EvidenceContractError(`canonicalSvg: ${message}`);
}

/** Every number that reaches an SVG attribute passes through here. */
export function num(value, what) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${what} must be a finite number, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Resolve a theme colour role. Unknown roles fail closed. */
export function roleHex(role, what) {
  if (typeof role !== 'string' || !Object.prototype.hasOwnProperty.call(ROLE_HEX, role)) {
    fail(`${what} must be one of ${Object.keys(ROLE_HEX).join('|')}, got ${JSON.stringify(role)}`);
  }
  return ROLE_HEX[role];
}

/**
 * Compile the production layout module with tsc and import it. Nothing is
 * fetched: `canonicalFigure.ts` imports nothing, so this is a pure local
 * build and the evidence stays offline.
 */
export async function loadCanonicalFigure({ root = ROOT, buildDir } = {}) {
  const outDir = buildDir ?? path.join(root, 'tools/rendering/.build');
  const src = path.join(root, 'apps/mobile/src/components/movementPreview/canonicalFigure.ts');
  const built = path.join(outDir, 'canonicalFigure.js');

  // Skip the compile when the build is already newer than the source. The
  // evidence gate runs once per directory and the negative-probe harness runs
  // it nine times; recompiling each time cost minutes for no new information.
  let fresh = false;
  try {
    fresh = statSync(built).mtimeMs > statSync(src).mtimeMs;
  } catch {
    fresh = false;
  }

  if (!fresh) {
    // NOT stdio:'inherit'. When this runs inside a child process whose stdout
    // is a pipe the caller reads only on exit, inheriting deadlocks tsc once
    // the pipe fills — which is exactly what happens when the gate is invoked
    // through `npm run`. Capture instead, and surface it only on failure.
    try {
      execSync(
        'npx tsc --strict --skipLibCheck --target es2020 --module commonjs --outDir ' +
        `${JSON.stringify(outDir)} ` +
        JSON.stringify(src),
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (error) {
      const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
      fail(`could not compile canonicalFigure.ts${detail ? `:
${detail}` : ''}`);
    }
  }

  return import(`${pathToFileURL(built).href}?v=${statSync(built).mtimeMs}`);
}

/**
 * One primitive as an SVG element, positioned in STAGE coordinates (the
 * viewBox crop scaled by `scale`). RN borders sit inside the primitive View
 * box; inset SVG's centered strokes so the painted OUTER bounds agree.
 */
export function primToSvg(prim, vb, scale) {
  if (prim === null || typeof prim !== 'object') fail(`primitive must be an object, got ${JSON.stringify(prim)}`);
  const ox = num(vb[0], 'viewBox x');
  const oy = num(vb[1], 'viewBox y');
  num(scale, 'scale');
  const f = (n, what) => Number(num(n, what).toFixed(2));
  const opacity = num(prim.opacity, `${prim.kind} opacity`);
  const inset = prim.stroke !== undefined ? num((prim.strokeWidth ?? 1) * scale, 'strokeWidth') / 2 : 0;

  const outline = (p) => (p.stroke !== undefined
    ? ` stroke="${roleHex(p.stroke, `${p.kind} stroke role`)}" stroke-width="${f((p.strokeWidth ?? 1) * scale, `${p.kind} strokeWidth`)}"`
    : '');

  if (prim.kind === 'bone') {
    const x1 = (num(prim.x1, 'bone x1') - ox) * scale;
    const y1 = (num(prim.y1, 'bone y1') - oy) * scale;
    const x2 = (num(prim.x2, 'bone x2') - ox) * scale;
    const y2 = (num(prim.y2, 'bone y2') - oy) * scale;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const th = Math.max(1, num(prim.w, 'bone w') * scale);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return `<rect x="${f(cx - len / 2 + inset, 'bone x')}" y="${f(cy - th / 2 + inset, 'bone y')}" width="${f(Math.max(0, len - 2 * inset), 'bone width')}" height="${f(Math.max(0, th - 2 * inset), 'bone height')}" rx="${f(Math.max(0, th / 2 - inset), 'bone rx')}" fill="${roleHex(prim.color, 'bone color role')}"${outline(prim)} opacity="${opacity}" transform="rotate(${f(angle, 'bone angle')} ${f(cx, 'bone cx')} ${f(cy, 'bone cy')})"/>`;
  }

  if (prim.kind === 'circle') {
    return `<circle cx="${f((num(prim.cx, 'circle cx') - ox) * scale, 'circle cx')}" cy="${f((num(prim.cy, 'circle cy') - oy) * scale, 'circle cy')}" r="${f(Math.max(0, num(prim.r, 'circle r') * scale - inset), 'circle r')}" fill="${roleHex(prim.fill, 'circle fill role')}"${outline(prim)} opacity="${opacity}"/>`;
  }

  if (prim.kind === 'rect') {
    return `<rect x="${f((num(prim.x, 'rect x') - ox) * scale + inset, 'rect x')}" y="${f((num(prim.y, 'rect y') - oy) * scale + inset, 'rect y')}" width="${f(Math.max(0, num(prim.w, 'rect w') * scale - 2 * inset), 'rect width')}" height="${f(Math.max(0, num(prim.h, 'rect h') * scale - 2 * inset), 'rect height')}" rx="${f(Math.max(0, num(prim.rx, 'rect rx') * scale - inset), 'rect rx')}" fill="${roleHex(prim.fill, 'rect fill role')}"${outline(prim)} opacity="${opacity}"/>`;
  }

  return fail(`unknown primitive kind ${JSON.stringify(prim.kind)} (expected bone|circle|rect)`);
}

/**
 * Axis-aligned bounds of a primitive in stage coordinates, used by the
 * off-card geometry check.
 *
 * A bone is drawn as a rotated rect of length x thickness with rx =
 * thickness/2. SVG clamps rx to width/2, and React Native clamps borderRadius
 * the same way, so a SHORT, THICK bar (the trunk) is a rounded rectangle, not
 * a capsule: treating it as a capsule over-estimates its reach by tens of px
 * and reports off-card geometry the rasterizer never draws. The bounds below
 * are the exact rotated-rectangle extents, which the rounded corners can only
 * shrink.
 */
export function primBounds(prim, vb, scale) {
  const ox = num(vb[0], 'viewBox x');
  const oy = num(vb[1], 'viewBox y');
  // Inside-border View/SVG paint stays within the original outer box.
  const pad = 0;
  if (prim.kind === 'bone') {
    const x1 = (num(prim.x1, 'bone x1') - ox) * scale;
    const y1 = (num(prim.y1, 'bone y1') - oy) * scale;
    const x2 = (num(prim.x2, 'bone x2') - ox) * scale;
    const y2 = (num(prim.y2, 'bone y2') - oy) * scale;
    const halfThick = Math.max(1, num(prim.w, 'bone w') * scale) / 2 + pad;
    const halfLong = Math.hypot(x2 - x1, y2 - y1) / 2 + pad;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const halfX = halfLong * cos + halfThick * sin;
    const halfY = halfLong * sin + halfThick * cos;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return { minX: cx - halfX, maxX: cx + halfX, minY: cy - halfY, maxY: cy + halfY };
  }
  if (prim.kind === 'circle') {
    const cx = (num(prim.cx, 'circle cx') - ox) * scale;
    const cy = (num(prim.cy, 'circle cy') - oy) * scale;
    const r = num(prim.r, 'circle r') * scale + pad;
    return { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r };
  }
  if (prim.kind === 'rect') {
    const x = (num(prim.x, 'rect x') - ox) * scale;
    const y = (num(prim.y, 'rect y') - oy) * scale;
    return {
      minX: x - pad, maxX: x + num(prim.w, 'rect w') * scale + pad,
      minY: y - pad, maxY: y + num(prim.h, 'rect h') * scale + pad,
    };
  }
  return fail(`unknown primitive kind ${JSON.stringify(prim.kind)} (expected bone|circle|rect)`);
}

/**
 * Does this primitive paint anything distinguishable from the stage?
 *
 * The rig deliberately draws some torso bars in `ink1` with no outline: on an
 * `ink1` stage they are invisible by construction (MovementPreview calls them
 * "the trunk renders as a hole"). Such a bar can overhang the stage by a few
 * px without producing a single visible pixel, so the off-card GEOMETRY check
 * measures visible paint only and leaves the hard guarantee to the raster
 * border check, which measures actual ink.
 */
export function isVisiblePrim(prim) {
  if (prim.stroke !== undefined) return true;
  const paint = prim.kind === 'bone' ? prim.color : prim.fill;
  return paint !== 'ink1';
}

/** Union of every primitive's bounds, or null for an empty figure. */
export function figureBounds(prims, vb, scale) {
  let b = null;
  for (const prim of prims) {
    const pb = primBounds(prim, vb, scale);
    b = b === null ? { ...pb } : {
      minX: Math.min(b.minX, pb.minX), maxX: Math.max(b.maxX, pb.maxX),
      minY: Math.min(b.minY, pb.minY), maxY: Math.max(b.maxY, pb.maxY),
    };
  }
  return b;
}

/**
 * A movement's viewBox crop. Canonical entries MUST carry their own 4-number
 * viewBox — `manifest.ts` throws without one, and the global `manifest.box`
 * has no x/y, so substituting it yields NaN geometry.
 */
export function readViewBox(entry) {
  const vb = entry?.viewBox;
  if (!Array.isArray(vb) || vb.length !== 4 || !vb.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    fail(`movement ${entry?.movementId} needs a 4-number viewBox, got ${JSON.stringify(vb)}`);
  }
  if (vb[2] <= 0 || vb[3] <= 0) fail(`movement ${entry?.movementId} viewBox must have positive extent`);
  return vb;
}

/** The app's own stage scale for a crop: fit inside CANONICAL_FIT dp square. */
export function appStageScale(vb) {
  return Math.min(CANONICAL_FIT / vb[2], CANONICAL_FIT / vb[3]);
}

/** Escape text destined for an SVG text node or attribute. */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
