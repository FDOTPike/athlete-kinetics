/**
 * theme.ts — the pikeMethods visual system. CANONICAL.
 *
 * Source of truth: the approved Claude-Design handoff
 * (pikeMethods Design.dc.html, section 1a), reviewed and ratified by the
 * lead designer 2026-07-20. Every screen styles FROM these tokens; a hex
 * literal in a screen file is a design defect.
 *
 * The palette IS the product philosophy: seven tokens, ONE accent ("chalk"),
 * and no red/amber/green anywhere — so a safety halt is typographically
 * incapable of looking like failure, and finishing a plan is incapable of
 * looking like a reward. Chalk marks exactly one thing: where you are now.
 */
export const theme = {
  color: {
    ink0: '#0A0A09',   // app background, text on chalk/primary fills
    ink1: '#141412',   // raised surface (sheet, field, pressed row)
    line: '#262623',   // borders, dividers, disabled fill
    textHi: '#F7F6F3', // primary text + primary button fill · 18.9:1 (AAA)
    textMid: '#A9A7A0',// secondary text · 8.4:1 (AAA)
    textLow: '#6B6963',// eyebrows, metadata · 4.6:1 (AA — metadata only)
    chalk: '#EFC94C',  // THE accent. Current/active marker ONLY. 12.2:1
    onChalk: '#171204',
    pressed: '#D9D8D3',// primary button pressed fill
  },
  font: {
    // Archivo variable TTF is bundled via assets/fonts (see WO-UI-0).
    // Until the asset lands, RN falls back to the system face; sizes hold.
    family: 'Archivo',
    metric:  { fontSize: 64, lineHeight: 68, fontWeight: '700' as const },
    display: { fontSize: 40, lineHeight: 46, fontWeight: '800' as const },
    title:   { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
    cue:     { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
    body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    label:   { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
    eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const,
               letterSpacing: 1.6, textTransform: 'uppercase' as const },
  },
  /** 4 · 8 · 12 · 16 · 24 · 32 · 48 — nothing between. */
  space: [0, 4, 8, 12, 16, 24, 32, 48] as const,
  radius: { chip: 2, control: 6, sheet: 10 },
  touch: { min: 56, log: 72, destructiveGap: 16 },
  motion: {
    state: { duration: 160 }, // opacity/transform only; 0 under reduced-motion
    sheet: { duration: 200 },
  },
} as const;

export type Theme = typeof theme;
