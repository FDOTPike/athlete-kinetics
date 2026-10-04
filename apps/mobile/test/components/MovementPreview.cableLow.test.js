/**
 * WO-09 Batch 1, B1-113 — Cable Deadlifts, first re-based on 9 Romanian
 * Deadlift (ledger Entry 0175), now rebuilt as OWN frames after the owner's
 * family-3 review (neutral start ruling; the low-cable geometry unchanged).
 *
 * The live 113 draws seven side-view frames of its own (neutral upright start,
 * hanging arms, pulley ahead of the toes) and the low-cable implement is keyed
 * on the slug (CABLE_LOW_SLUGS). What this file holds, one test per rule:
 *   - the step list: base 9 has its own 5-step `hinge-return` list; legacy
 *     base 88 keeps its 3-step `hinge` list (unchanged machinery);
 *   - the live 113: own frames, no derivation, equipment cable_machine, the
 *     library's own instructions and cues, its own (empty) citations;
 *   - the drawing (CABLE_LOW_SLUGS, keyed on the slug): per frame, a handle
 *     and a hand at each wrist, a straight cable from the handle's clip to a
 *     floor pulley ahead of that side's ankle, the near cable painted BEFORE
 *     the near limbs and the far cable before the far limbs, and no barbell
 *     plate; base 9 still draws its plate and no cable.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  STEP_FAMILY_BY_BASE,
  STEP_LISTS,
  deriveVariantEntry,
  rawPreviewEntries,
  stepListForBase,
} from '../../src/components/movementPreview/manifest';
import {
  DUAL_BODY_PARAMETERS,
  EQUIPMENT_BY_SLUG,
  layoutCanonicalFigure,
  layoutLowCable,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';

// The raw authoring records live in the manifest (the compact family files
// carry the drawn data only) - see previewManifest.js.
const RAW = require('../../src/components/movementPreview/movementPreviewManifest.json').entries;
const rawEntryFor = (movementId) => RAW.find((entry) => entry.movementId === movementId);
const BASE = rawEntryFor(9);
const VARIANT = rawEntryFor(113);
const BODIES = ['neutral', 'male', 'female'];
const GROUND_LINE = 96.4;
const PULLEY_FORWARD = 9;
const PULLEY_R = 1.8;

const optionsFor = (entry, body) => ({
  view: BASE.view, body: DUAL_BODY_PARAMETERS[body], assetKey: entry.assetKey,
});
const isCable = (p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4;
const isPulley = (p) => p.kind === 'circle' && p.fill === 'line';
const isPlate = (p) => p.kind === 'circle' && (p.r === 6.6 || p.r === 2.2);
const sameBone = (p, a, b) => p.kind === 'bone'
  && Math.abs(p.x1 - a[0]) < 1e-9 && Math.abs(p.y1 - a[1]) < 1e-9
  && Math.abs(p.x2 - b[0]) < 1e-9 && Math.abs(p.y2 - b[1]) < 1e-9;

describe('base 9 has its own 5-step hinge list; legacy 88 keeps its 3 steps', () => {
  test('base 9 maps to hinge-return (start, hinge, bottom, drive, return), one step per frame', () => {
    expect(STEP_FAMILY_BY_BASE[9]).toBe('hinge-return');
    expect(STEP_LISTS['hinge-return'].steps).toEqual(['start', 'hinge', 'bottom', 'drive', 'return']);
    expect(STEP_LISTS['hinge-return'].peak).toBeUndefined();
    expect(stepListForBase(9)).toBe(STEP_LISTS['hinge-return']);
    expect(stepListForBase(9).steps).toHaveLength(BASE.frames.length);
  });

  test('base 88 still maps to the untouched 3-step hinge list', () => {
    expect(STEP_FAMILY_BY_BASE[88]).toBe('hinge');
    expect(stepListForBase(88)).toBe(STEP_LISTS.hinge);
    expect(STEP_LISTS.hinge.steps).toEqual(['start', 'hinge', 'bottom']);
    expect(stepListForBase(88).steps).toHaveLength(rawEntryFor(88).frames.length);
  });
});

describe('the live 113 Cable Deadlifts draws its own frames now', () => {
  test('it carries no derivation, side view, seven frames from a neutral upright start', () => {
    expect(VARIANT.derivesFrom).toBeUndefined();
    expect(VARIANT.frameRoles).toBeUndefined();
    expect(VARIANT.captionOverrides).toBeUndefined();
    expect(VARIANT.view).toBe('side');
    expect(VARIANT.frames).toHaveLength(7);
    const first = VARIANT.frames[0].joints;
    // Neutral upright start (ruling 4): the shoulders sit high over the hips.
    const torsoPitch = Math.atan2(first.nk[0] - first.hp[0], first.hp[1] - first.nk[1]) * 180 / Math.PI;
    expect(Math.abs(torsoPitch)).toBeLessThan(5);
    const last = VARIANT.frames[VARIANT.frames.length - 1].joints;
    expect(last.hp[0]).toBeCloseTo(first.hp[0], 9);
    expect(last.nk[1]).toBeCloseTo(first.nk[1], 9);
  });

  test('it keeps the equipment override, the hinge pattern and its own citations', () => {
    expect(BASE.equipment).toBe('barbell');
    expect(VARIANT.equipment).toBe('cable_machine');
    expect(VARIANT.pattern).toBe('hinge');
    expect(EQUIPMENT_BY_SLUG[VARIANT.assetKey.split('/')[1]]).toBe('cable_machine');
    expect(VARIANT.techniqueCitations).toEqual([]);
  });

  test('its name, asset key, instructions and cues are the library rows, verbatim', () => {
    const sql = fs.readFileSync(path.resolve(__dirname,
      '../../../../packages/core-db/src/schema/025_movement_coaching_content.sql'), 'utf8');
    expect(VARIANT.name).toBe('Cable Deadlifts');
    expect(VARIANT.assetKey).toBe('movement/cable-deadlifts/demo/v1');
    // Scoped to movement 113's own rows (B1-113-C1): each reviewed_content
    // VALUES block keys its tuple on movement_name, so parse the tuples whose
    // first field is 113's name and compare their fields exactly, instead of
    // searching the whole file for the text.
    const parseTuple = (line) => {
      const fields = [];
      const re = /'((?:[^']|'')*)'/g;
      let match;
      while ((match = re.exec(line)) !== null) fields.push(match[1].replace(/''/g, "'"));
      return fields;
    };
    const rows = sql.split('\n')
      .filter((line) => line.trimStart().startsWith("('"))
      .map(parseTuple)
      .filter((fields) => fields[0] === VARIANT.name);
    // One row in the coaching-intent block, one in the movement_detail block.
    expect(rows).toHaveLength(2);
    for (const [, coachingIntent, instructions, cues] of rows) {
      expect(instructions).toBe(VARIANT.instructions);
      expect(cues).toBe(VARIANT.cues);
      expect(coachingIntent).toBe(VARIANT.coachingIntent);
    }
  });
});

describe('the low-cable drawing (CABLE_LOW_SLUGS, keyed on the variant slug)', () => {
  test.each(BODIES)('every frame draws a handle, hand, cable and floor pulley per side (%s)', (body) => {
    for (const frame of VARIANT.frames) {
      const opts = optionsFor(VARIANT, body);
      const f = resolveFigureJoints(frame.joints, opts);
      const prims = layoutCanonicalFigure(frame.joints, opts);
      for (const [wr, an, near] of [[f.wr, f.an, true], [f.wf, f.af, false]]) {
        const clip = [wr[0], wr[1] + 3.4];
        const pulley = [an[0] + PULLEY_FORWARD, GROUND_LINE - PULLEY_R];
        // A straight cable from the handle's clip to the floor pulley.
        const cable = prims.filter((p) => isCable(p) && sameBone(p, clip, pulley));
        expect(cable).toHaveLength(1);
        expect(cable[0].opacity).toBe(near ? 1 : 0.9);
        const wheel = prims.filter((p) => isPulley(p)
          && Math.abs(p.cx - pulley[0]) < 1e-9 && Math.abs(p.cy - pulley[1]) < 1e-9);
        expect(wheel).toHaveLength(1);
        expect(wheel[0].cy + wheel[0].r).toBeCloseTo(GROUND_LINE, 9);
        // The D-handle: a grip bar centred on the hand, two straps to the clip.
        expect(prims.filter((p) => sameBone(p, [wr[0] - 3, wr[1]], [wr[0] + 3, wr[1]]))).toHaveLength(1);
        expect(prims.filter((p) => sameBone(p, [wr[0] - 3, wr[1]], clip))).toHaveLength(1);
        expect(prims.filter((p) => sameBone(p, [wr[0] + 3, wr[1]], clip))).toHaveLength(1);
        // The hand is drawn over its grip.
        const hand = prims.findIndex((p) => p.kind === 'circle'
          && p.cx === wr[0] && p.cy === wr[1] && p.r === DUAL_BODY_PARAMETERS[body].lw * 0.44);
        const grip = prims.findIndex((p) => sameBone(p, [wr[0] - 3, wr[1]], [wr[0] + 3, wr[1]]));
        expect(hand).toBeGreaterThan(grip);
        expect(prims[hand].fill).toBe(near ? 'textHi' : 'textLow');
      }
      expect(prims.filter(isCable)).toHaveLength(2);
      expect(prims.filter(isPulley)).toHaveLength(2);
    }
  });

  test.each(BODIES)('the near cable is painted before the near limbs, the far one before the far limbs (%s)', (body) => {
    for (const frame of VARIANT.frames) {
      const opts = optionsFor(VARIANT, body);
      const f = resolveFigureJoints(frame.joints, opts);
      const prims = layoutCanonicalFigure(frame.joints, opts);
      const indexOf = (a, b) => prims.findIndex((p) => sameBone(p, a, b));
      const nearCable = prims.findIndex((p) => isCable(p) && p.opacity === 1);
      const farCable = prims.findIndex((p) => isCable(p) && p.opacity !== 1);
      const nearThigh = indexOf(f.nLeg, f.kn);
      const nearShin = indexOf(f.kn, f.an);
      const nearForearm = indexOf(f.el, f.wr);
      const farThigh = indexOf(f.fLeg, f.kf);
      const farShin = indexOf(f.kf, f.af);
      const farForearm = indexOf(f.ef, f.wf);
      for (const i of [nearThigh, nearShin, nearForearm, farThigh, farShin, farForearm]) {
        expect(i).toBeGreaterThanOrEqual(0);
      }
      expect(nearCable).toBeLessThan(nearThigh);
      expect(nearCable).toBeLessThan(nearShin);
      expect(nearCable).toBeLessThan(nearForearm);
      expect(farCable).toBeLessThan(farThigh);
      expect(farCable).toBeLessThan(farShin);
      // The near cable passes in front of the far leg and the torso.
      expect(nearCable).toBeGreaterThan(farShin);
      // The handles ride on top of their own forearms.
      const nearGrip = indexOf([f.wr[0] - 3, f.wr[1]], [f.wr[0] + 3, f.wr[1]]);
      const farGrip = indexOf([f.wf[0] - 3, f.wf[1]], [f.wf[0] + 3, f.wf[1]]);
      expect(nearGrip).toBeGreaterThan(nearForearm);
      expect(farGrip).toBeGreaterThan(farForearm);
      expect(farGrip).toBeLessThan(nearThigh);
    }
  });

  test('no barbell plate on 113; base 9 still draws its plate and no cable', () => {
      for (const frame of VARIANT.frames) {
        const variant = layoutCanonicalFigure(frame.joints, optionsFor(VARIANT, 'neutral'));
        expect(variant.filter(isPlate)).toHaveLength(0);
      }
      for (const frame of BASE.frames) {
        const base = layoutCanonicalFigure(frame.joints, optionsFor(BASE, 'neutral'));
        expect(base.filter(isPlate)).toHaveLength(2);
        expect(base.filter((p) => p.kind === 'bone' && p.color === 'textMid')).toHaveLength(0);
        expect(base.filter(isPulley)).toHaveLength(0);
      }
    });

  test('layoutLowCable is pure and places the pulley on the floor ahead of each ankle', () => {
    const j = { wr: [47, 60], wf: [42.2, 60], an: [44, 96], af: [39.2, 96] };
    const snapshot = JSON.stringify(j);
    const out = layoutLowCable(j, DUAL_BODY_PARAMETERS.neutral, 'textLow', 0.9);
    expect(JSON.stringify(j)).toBe(snapshot);
    const near = expect.closeTo;
    expect(out.nearCable[0]).toMatchObject({
      x1: near(47, 9), y1: near(63.4, 9), x2: near(53, 9), y2: near(94.6, 9), color: 'textMid', opacity: 1,
    });
    expect(out.farCable[0]).toMatchObject({
      x1: near(42.2, 9), y1: near(63.4, 9), x2: near(48.2, 9), y2: near(94.6, 9), opacity: 0.9,
    });
    expect(out.nearHandle[out.nearHandle.length - 1]).toMatchObject({ kind: 'circle', cx: 47, cy: 60, fill: 'textHi' });
    expect(out.farHandle[out.farHandle.length - 1]).toMatchObject({ kind: 'circle', cx: 42.2, cy: 60, fill: 'textLow' });
  });
});
