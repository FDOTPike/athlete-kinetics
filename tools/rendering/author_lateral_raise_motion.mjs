// Authoring script: standing lateral raises, front view.
//   50  Dumbbell Lateral Raise     (lateral-raise@standing)
//   236 Lateral Raise - With Bands (shoulder-raise@standing)
// Each entry is bound to its own catalogue text. The arms are drawn by
// lateralRaiseArms() from one abduction angle per keyframe (`la`), so the arc
// is exact on every tick; the stored elbow and wrist are that same geometry at
// the keyframe, for anything that reads the raw joints.
//
// Run from the repository root, then re-cut the family files:
//   node tools/rendering/author_lateral_raise_motion.mjs
//   node tools/rendering/wo09_split_preview_manifest.mjs
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));

const round = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

// The standing front-view figure every coronal movement in the manifest uses.
const STANDING_FRONT = {
  hd: [50, 17.6], nk: [50, 28.6], hp: [50, 51.6],
  kn: [41.95, 72.07], an: [47, 94], kf: [58.05, 72.07], af: [53, 94],
};
// Front-view shoulder roots, exactly as resolveFigureJoints places them.
const half = layout.CANONICAL_BODY_PARAMETERS.sw * 0.92;
const NEAR_SHOULDER = [STANDING_FRONT.nk[0] - half, STANDING_FRONT.nk[1]];
const FAR_SHOULDER = [STANDING_FRONT.nk[0] + half, STANDING_FRONT.nk[1]];

function pose(slug, la) {
  const arms = layout.lateralRaiseArms(la, layout.LATERAL_RAISE_ELBOW_DEG[slug], NEAR_SHOULDER, FAR_SHOULDER);
  return {
    hd: STANDING_FRONT.hd, nk: STANDING_FRONT.nk, hp: STANDING_FRONT.hp,
    el: round(arms.near.el), wr: round(arms.near.wr), ef: round(arms.far.el), wf: round(arms.far.wr),
    kn: STANDING_FRONT.kn, an: STANDING_FRONT.an, kf: STANDING_FRONT.kf, af: STANDING_FRONT.af,
    la,
  };
}

const MOVEMENTS = [
  {
    id: 50,
    slug: 'dumbbell-lateral-raise',
    previewId: 'dumbbell_lateral_raise_50_draft',
    equipment: 'dumbbells',
    // Hanging just off the thighs, then elbows to shoulder height (the upper
    // arm 88 degrees from hanging puts the elbow within half a unit of the
    // shoulder line).
    // The half-way keyframe is a teaching still: the elbows visibly lead the hands.
    angles: [15, 52, 88, 88, 15],
    // "Three seconds down": one unbroken three-second lowering.
    segmentDurationsMs: [550, 550, 300, 3000],
    captions: [
      'Stand with a slight forward lean and the dumbbells hanging just off the thighs.',
      'Lead with the elbows as the arms rise out to the sides.',
      'Raise until the elbows reach shoulder height.',
      'At the top the elbows are at shoulder height and the hands stay below them.',
      'Lower on a controlled three-second count and keep the torso still.',
    ],
    summary: 'Raise the dumbbells out to the sides until the elbows reach shoulder height, then lower for three seconds.',
    reason: 'Source-bound draft, front view. Arms abduct with one fixed soft elbow bend, elbows lead and finish at shoulder height with the hands below them, trunk and legs stay still, and the lowering takes three seconds as the cue asks. A front view cannot show the slight forward lean or the slightly-forward arm path the instructions describe; those live in the captions only.',
  },
  {
    id: 236,
    slug: 'lateral-raise-with-bands',
    previewId: 'lateral_raise_with_bands_236_draft',
    equipment: 'band',
    // Arms almost straight at the sides of the thighs, then just above level.
    angles: [8, 52, 96, 96, 8],
    // "Pause, then lower slowly."
    segmentDurationsMs: [650, 650, 500, 2200],
    captions: [
      'Stand on the middle of the band and hold an end in each hand at the sides of the thighs, back tall.',
      'With a slight, fixed bend in the elbows, raise the arms out to the sides.',
      'Raise until the arms are just above level with the floor.',
      'Pause at the top with the torso still.',
      'Lower slowly against the band to the start.',
    ],
    summary: 'Stand on the band and raise both arms out to the sides to just above level, pause, then lower slowly.',
    reason: 'Source-bound draft, front view. The band is stood on at its middle and an end runs to each hand, so it lengthens as the arms rise. One fixed slight elbow bend, arms finish just above level with the floor, a pause at the top, and a lowering slower than the raise. Trunk and legs stay still.',
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
    view: 'front',
    techniqueCitations: [],
    viewBox: [10, 8, 80, 90],
    equipment: spec.equipment,
    instructions: row.source.instructions,
    cues: row.source.cues,
    coachingIntent: row.source.coaching_intent,
    reason: spec.reason,
    summary: spec.summary,
    frames: spec.angles.map((la, i) => ({ id: `p${i + 1}`, caption: spec.captions[i], joints: pose(spec.slug, la) })),
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
