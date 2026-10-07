// Authoring script: chest-supported incline shoulder raises (front-raise@incline).
//   135 Barbell Incline Shoulder Raise
//   187 Dumbbell Incline Shoulder Raise
// Redrawn to the owner's correction of 2026-10-07: chest facing a 45 degree
// incline bench, feet wide on the floor, the arms raising with the elbows
// leading and the elbow angle a little over 100 degrees, shown from the side
// with depth. The whole figure comes from proneInclineRaiseGeometry() and one
// phase per keyframe (`pi`); the stored joints are that geometry's projection.
//
// Run from the repository root, then re-cut the family files:
//   node tools/rendering/author_prone_incline_raise_motion.mjs
//   node tools/rendering/wo09_split_preview_manifest.mjs
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));

/** Two decimals, as every stored joint in the manifest is. */
const round = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

/** The stored joints for one keyframe: the drawn projection, plus the phase that drives it. */
function pose(barbell, pi) {
  const j = layout.proneInclineRaiseGeometry(pi, layout.CANONICAL_BODY_PARAMETERS, barbell).joints;
  const out = {};
  for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) out[key] = round(j[key]);
  return { ...out, pi };
}

const PHASES = [0, 0.5, 1, 1, 0];
// A one-second raise, a held top, and one unbroken lowering on the same path.
const SEGMENTS = [500, 500, 400, 1300];

const MOVEMENTS = [
  {
    id: 135,
    barbell: true,
    viewBox: [10, 16, 72, 84],
    captions: [
      'Lie chest-down on the incline bench, feet wide on the floor, with the hands on the bar outside the shoulders.',
      'Set the shoulder blades, then lead the rep through the elbows.',
      'Raise the bar under the shoulders with the elbows leading out and up.',
      'Hold the top with the shoulder position set.',
      'Lower with the same smooth path.',
    ],
    summary: 'Chest on a 45 degree incline bench, raise the bar like an upright row by leading with the elbows, then lower on the same path.',
    reason: 'Redrawn to the owner correction of 2026-10-07. Chest facing a 45 degree incline bench with the feet wide on the floor; both hands on one bar, each brought in one wrist width from the first draft at the direction of the owner; it works like an upright row, the bar rising under the shoulders while the elbows lead out and up and the elbow angle closes from long arms to a little over 100 degrees; trunk and legs stay still. Drawn from a 3D model through a 40 degree oblique projection so the side-on view shows the arms working across the body.',
  },
  {
    id: 187,
    barbell: false,
    viewBox: [12, 16, 78, 84],
    captions: [
      'Lie chest-down on the incline bench, feet wide on the floor, with the dumbbells hanging under the chest.',
      'Set the shoulder blades, then lead the rep through the elbows.',
      'Raise until the elbows reach shoulder height and the forearms are almost level with the floor.',
      'Hold the top with the shoulder position set.',
      'Lower with the same smooth path.',
    ],
    summary: 'Chest on a 45 degree incline bench, raise the dumbbells out to the sides, elbows leading and arms straightening toward the top, then lower on the same path.',
    reason: 'Redrawn to the owner correction of 2026-10-07. Chest facing a 45 degree incline bench with the feet wide on the floor; a dumbbell in each hand; the bells start together under the chest with the elbow at a little over 100 degrees; the upper arms swing out to shoulder height with the elbows leading, and the arms straighten gradually so the forearms finish almost parallel with the floor (the second owner correction: the top position of the first draft read too much like an upright row); trunk and legs stay still. Drawn from a 3D model through a 40 degree oblique projection so the side-on view shows the arms working across the body.',
  },
];

for (const spec of MOVEMENTS) {
  const at = manifest.entries.findIndex((existing) => existing.movementId === spec.id);
  if (at < 0) throw Error(`Movement ${spec.id} is not in the manifest`);
  const previous = manifest.entries[at];
  const slug = previous.assetKey.split('/')[1];
  if (!layout.PRONE_INCLINE_RAISE_SLUGS.has(slug)) throw Error(`Movement ${spec.id} has unexpected slug ${slug}`);
  // Everything that identifies the movement and its catalogue text is kept.
  manifest.entries[at] = {
    ...previous,
    view: 'oblique',
    viewBox: spec.viewBox,
    reason: spec.reason,
    summary: spec.summary,
    frames: PHASES.map((pi, i) => ({ id: `p${i + 1}`, caption: spec.captions[i], joints: pose(spec.barbell, pi) })),
    segmentDurationsMs: SEGMENTS,
  };
}

fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
console.log(`Re-authored ${MOVEMENTS.map((spec) => spec.id).join(', ')} in movementPreviewManifest.json`);
