/**
 * tools/rendering/lib/textFit.mjs — deterministic text measurement and wrapping.
 *
 * Evidence cards must be reproducible byte-for-byte on any machine, so the
 * generator may NOT ask the local font stack how wide a string is: librsvg
 * resolves `sans-serif` to whatever the host installs, and wrapping against
 * that would make the committed SVGs machine-dependent.
 *
 * The model below is therefore a deliberately CONSERVATIVE (wide) estimate
 * that must hold for every face librsvg might pick. Two cases matter:
 *
 *  - a proportional sans (Arial, DejaVu Sans): narrow glyphs like `i` and `l`
 *    are cheap, capitals and `M`/`W` are expensive;
 *  - a MONOSPACE fallback, which is what a box with no proportional sans
 *    installed actually gives you. There every glyph — including `i` and the
 *    space — takes a full advance, and a proportional-only model
 *    under-measures by ~15% and the caption clips.
 *
 * So each class is floored at a monospace advance and the proportional
 * estimate is used only where it is WIDER. The model decides the line breaks;
 * `verify_movement_evidence.mjs` then rasterizes the finished card and
 * measures the real ink extents, so an over-optimistic estimate is caught by
 * the gate rather than trusted.
 */

/** Proportional advance widths in em, per character class, erring wide. */
const NARROW = new Set(['i', 'l', 'j', 't', 'f', 'r', 'I', '.', ',', ';', ':', "'", '"', '!', '|', '(', ')', '[', ']', '{', '}', '/', '\\', '-']);
const WIDE = new Set(['M', 'W', 'm', 'w', '@', '%']);
const DIGIT_EM = 0.58;
const NARROW_EM = 0.34;
const WIDE_EM = 0.98;
const UPPER_EM = 0.76;
const LOWER_EM = 0.60;
const SPACE_EM = 0.30;
const FALLBACK_EM = 0.80;

/**
 * Monospace floor. DejaVu Sans Mono advances 0.602 em and Courier New 0.600 em;
 * 0.62 clears both with margin.
 */
const MONO_FLOOR_EM = 0.62;

function proportionalEm(ch) {
  if (ch === ' ') return SPACE_EM;
  if (WIDE.has(ch)) return WIDE_EM;
  if (NARROW.has(ch)) return NARROW_EM;
  if (ch >= '0' && ch <= '9') return DIGIT_EM;
  if (ch >= 'A' && ch <= 'Z') return UPPER_EM;
  if (ch >= 'a' && ch <= 'z') return LOWER_EM;
  return FALLBACK_EM;
}

/** Width of one character, in em, safe for proportional AND monospace faces. */
export function charEm(ch) {
  return Math.max(MONO_FLOOR_EM, proportionalEm(ch));
}

/** Conservative rendered width of `text` at `fontSizePx`, in px. */
export function measureText(text, fontSizePx) {
  let em = 0;
  for (const ch of String(text)) em += charEm(ch);
  return em * fontSizePx;
}

/**
 * Greedy word wrap to `maxWidthPx`. A single word longer than the line is
 * hard-broken rather than allowed to overhang, because an overhanging word is
 * exactly the clipping this module exists to prevent.
 */
export function wrapText(text, fontSizePx, maxWidthPx) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const push = () => { if (line) { lines.push(line); line = ''; } };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measureText(candidate, fontSizePx) <= maxWidthPx) { line = candidate; continue; }
    push();
    if (measureText(word, fontSizePx) <= maxWidthPx) { line = word; continue; }
    // Hard-break an over-long single word.
    let chunk = '';
    for (const ch of word) {
      if (measureText(chunk + ch, fontSizePx) > maxWidthPx && chunk) { lines.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    line = chunk;
  }
  push();
  return lines.length > 0 ? lines : [''];
}
