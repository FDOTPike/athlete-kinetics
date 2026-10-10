// Authoring script: standing front raises, side view.
//   87  Dumbbell Front Raise (front-raise@standing)   both arms
//   206 Front Cable Raise    (shoulder-raise@standing) one arm, low pulley behind
// Each entry is bound to its own catalogue text. The arms are drawn by
// frontRaiseArm() from one flexion angle per keyframe (`fr`), so the arc is
// exact on every tick; the stored elbow and wrist are that same geometry at
// the keyframe, before the far side's perspective offset.
//
// Run from the repository root, then re-cut the family files:
//   node tools/rendering/author_front_raise_motion.mjs
//   node tools/rendering/wo09_split_preview_manifest.mjs
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));

/** Two decimals, as every stored joint in the manifest is. */
const round = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

// An upright side-view figure facing right: trunk 24, thigh and shin 22.25 each.
const STANDING_SIDE = {
  hd: [44, 18.5], nk: [44, 27.5], hp: [44, 51.5],
  kn: [44, 73.75], an: [44, 96], kf: [44, 73.75], af: [44, 96],
};

/** The stored joints for one keyframe: the standing body, the solved arms before the far-side offset, and the angle that drives them. */
function pose(slug, fr) {
  const spec = layout.FRONT_RAISE[slug];
  const near = layout.frontRaiseArm(fr, spec.softElbowDeg, STANDING_SIDE.nk);
  const far = layout.frontRaiseArm(spec.bothArms ? fr : layout.FRONT_RAISE_FREE_ARM_DEG, spec.softElbowDeg, STANDING_SIDE.nk);
  return {
    hd: STANDING_SIDE.hd, nk: STANDING_SIDE.nk, hp: STANDING_SIDE.hp,
    el: round(near.el), wr: round(near.wr), ef: round(far.el), wf: round(far.wr),
    kn: STANDING_SIDE.kn, an: STANDING_SIDE.an, kf: STANDING_SIDE.kf, af: STANDING_SIDE.af,
    fr,
  };
}

const MOVEMENTS = [
  {
    id: 87,
    slug: 'dumbbell-front-raise',
    previewId: 'dumbbell_front_raise_87_draft',
    equipment: 'dumbbells',
    viewBox: [26, 6, 56, 94],
    // In front of the thighs, then straight ahead to shoulder height.
    angles: [6, 90, 90, 6, 6],
    // "Slower down than up": one unbroken raise, and a lowering twice as long.
    segmentDurationsMs: [900, 200, 1800, 500],
    captions: [
      'Stand holding the dumbbells in front of your thighs, palms facing back.',
      'Raise both arms straight ahead with a soft elbow to shoulder height, the torso a pillar.',
      'Hold at shoulder height with the hands soft.',
      'Lower on a slow count, slower down than up.',
      'The delts raise, the body stays.',
    ],
    summary: 'Raise both dumbbells straight ahead to shoulder height with a soft elbow, then lower on a slow count.',
    reason: 'Source-bound draft, side view. The text allows one or both arms; this draft shows both, as a labelled bilateral demonstration. The arms flex forward from in front of the thighs to shoulder height with a soft elbow, the trunk and legs stay still, and the lowering is slower than the raise. The bells are held palms back, so they read end-on from the side.',
  },
  {
    id: 206,
    slug: 'front-cable-raise',
    previewId: 'front_cable_raise_206_draft',
    equipment: 'cable_machine',
    viewBox: [8, 6, 68, 94],
    // In front of the thigh, then just above level with the floor.
    angles: [6, 96, 96, 6, 6],
    // "Pause, then lower slowly."
    segmentDurationsMs: [1100, 500, 2200, 500],
    captions: [
      'Stand facing away from the low pulley with the handle in one hand in front of the thigh.',
      'Keep the torso still and a slight bend in the elbow as the arm rises to the front, until it is just above level with the floor.',
      'Pause at the top.',
      'Lower slowly to the start.',
      'Change arms after the set.',
    ],
    summary: 'Facing away from a low pulley, raise one arm to the front to just above level, pause, then lower slowly.',
    reason: 'Source-bound draft, side view. One handle on a low pulley behind the athlete; the working arm rises to the front to just above level with the floor while the free arm hangs, the trunk and legs stay still, there is a pause at the top, and the lowering is slower than the raise. One arm is shown; the caption tells the athlete to change arms after the set.',
  },
];

for (const spec of MOVEMENTS) {
  const row = catalogue.movements.find((entry) => entry.id === spec.id);
  if (!row) throw Error(`Movement ${spec.id} is not in the catalogue`);
  if (row.motion.source_hold_reason) throw Error(`Movement ${spec.id} is on a source hold`);
  if (row.source.asset_key !== `movement/${spec.slug}/demo/v1`) {
    throw Error(`Movement ${spec.id} asset key ${row.source.asset_key} does not match slug ${spec.slug}`);
  }
  if (spec.angles[0] !== spec.angles.at(-1)) throw Error(`Movement ${spec.id} does not close its loop`);
  const entry = {
    movementId: spec.id,
    name: row.name,
    assetKey: row.source.asset_key,
    previewId: spec.previewId,
    pattern: row.source.pattern,
    status: 'pending',
    view: 'side',
    techniqueCitations: [],
    viewBox: spec.viewBox,
    equipment: spec.equipment,
    instructions: row.source.instructions,
    cues: row.source.cues,
    coachingIntent: row.source.coaching_intent,
    reason: spec.reason,
    summary: spec.summary,
    frames: spec.angles.map((fr, i) => ({ id: `p${i + 1}`, caption: spec.captions[i], joints: pose(spec.slug, fr) })),
    segmentDurationsMs: spec.segmentDurationsMs,
  };
  const at = manifest.entries.findIndex((existing) => existing.movementId === spec.id);
  if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) {
    throw Error(`Movement ${spec.id} is already owned by another author`);
  }
  if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
}

fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
console.log(`Authored ${MOVEMENTS.map((spec) => spec.id).join(', ')} in movementPreviewManifest.json`);
