// Authoring script: Seated Side Lateral Raise (272, lateral-raise@seated).
// Bound to its own catalogue text. The whole figure comes from
// seatedLateralRaiseGeometry(), a 3D model seen through a 35 degree oblique
// projection so the seat, the level thighs and both arms show at once. One
// abduction angle per keyframe (`la`) drives it; the stored joints are that
// geometry's projection at the keyframe.
//
// Run from the repository root, then re-cut the family files:
//   node tools/rendering/author_seated_lateral_raise_motion.mjs
//   node tools/rendering/wo09_split_preview_manifest.mjs
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));

/** Two decimals, as every stored joint in the manifest is. */
const round = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

const SLUG = 'seated-side-lateral-raise';

/** The stored joints for one keyframe: the drawn projection of the 3D seated figure, plus the angle that drives it. */
function pose(la) {
  const j = layout.seatedLateralRaiseGeometry(la, layout.CANONICAL_BODY_PARAMETERS).joints;
  const out = {};
  for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) out[key] = round(j[key]);
  return { ...out, la };
}

const row = catalogue.movements.find((entry) => entry.id === 272);
if (!row) throw Error('Movement 272 is not in the catalogue');
if (row.motion.source_hold_reason) throw Error('Movement 272 is on a source hold');
if (row.source.asset_key !== `movement/${SLUG}/demo/v1`) throw Error(`Movement 272 asset key ${row.source.asset_key} does not match slug ${SLUG}`);

// Hanging by the sides, then out until the arms are parallel to the floor.
const ANGLES = [8, 52, 94, 94, 8];
// "pause for a second. Lower back down slowly": a one-second hold, then one unbroken lowering.
const SEGMENTS = [550, 550, 1000, 2000];
const CAPTIONS = [
  'Sit at the end of a flat bench with the feet firmly on the floor and a dumbbell in each hand hanging by your sides.',
  'Keeping the torso still, lift the dumbbells out to the side with a slight bend at the elbow.',
  'Continue until the arms are parallel to the floor.',
  'Pause for a second at shoulder level.',
  'Lower back down slowly to the start.',
];

const entry = {
  movementId: 272,
  name: row.name,
  assetKey: row.source.asset_key,
  previewId: 'seated_side_lateral_raise_272_draft',
  pattern: row.source.pattern,
  status: 'pending',
  view: 'oblique',
  techniqueCitations: [],
  viewBox: [12, 26, 72, 74],
  equipment: 'dumbbells',
  instructions: row.source.instructions,
  cues: row.source.cues,
  coachingIntent: row.source.coaching_intent,
  reason: 'Source-bound draft, drawn from a 3D model through a 35 degree oblique projection so it reads as seated. On the end of a flat bench, thighs level, feet flat on the floor; the arms abduct with one slight fixed elbow bend from hanging by the sides to parallel with the floor, hold there for one second, and lower more slowly than they rose; the trunk and legs stay still. Not drawn: the instruction to tilt the hands forward "as if pouring water". This rig has no wrist rotation to show it, and the catalogue flags that cue for technique review, so no caption asserts it.',
  summary: 'Seated on a bench end, raise the dumbbells out to the sides until the arms are parallel to the floor, pause for a second, then lower slowly.',
  frames: ANGLES.map((la, i) => ({ id: `p${i + 1}`, caption: CAPTIONS[i], joints: pose(la) })),
  segmentDurationsMs: SEGMENTS,
};
const at = manifest.entries.findIndex((existing) => existing.movementId === 272);
if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error('Movement 272 is already owned by another author');
if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;

fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
console.log('Authored 272 in movementPreviewManifest.json');
