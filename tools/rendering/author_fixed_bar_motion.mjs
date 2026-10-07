// Authoring script for MOV-B003: Fixed-bar body motions (66 Inverted Row & 152 Body Tricep Press).
// Source-bound drafts adhering to schemas 016 and 068.
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));

// ----------------------------------------------------------------------------
// Movement 66: Inverted Row
// ----------------------------------------------------------------------------
const row66 = catalogue.movements.find(e => e.id === 66);
if (!row66 || row66.motion.source_hold_reason) throw Error('Unresolved source for 66');

const geom66_0 = layout.invertedRowGeometry(0, layout.CANONICAL_BODY_PARAMETERS).joints;
const basePose66 = Object.fromEntries(
  ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af', 'b'].map(k => [k, geom66_0[k]])
);

const captions66 = [
  'Get under the hip-height bar with heels planted and body in one rigid plank.',
  'Pull your chest toward the bar, leading with the elbows.',
  'Touch your chest to the bar with glutes squeezed and body rigid.',
  'Hold chest to bar at the top, touching the same spot.',
  'Lower under control without letting the hips sag.',
  'Return to fully long arms with the plank held rigid.',
];

const irValues = [0, 0.5, 1.0, 1.0, 0.5, 0];
const entry66 = {
  movementId: 66,
  name: row66.name,
  assetKey: row66.source.asset_key,
  previewId: 'inverted_row_66_draft',
  pattern: row66.source.pattern,
  status: 'pending',
  view: 'side',
  techniqueCitations: [],
  viewBox: [0, 8, 92, 92],
  equipment: 'barbell',
  instructions: row66.source.instructions,
  cues: row66.source.cues,
  coachingIntent: row66.source.coaching_intent,
  reason: 'Source-bound draft: figure under hip-height rack bar, face up, hands fixed on the bar for the whole cycle; heels planted on the floor; ankle, knee, hip and shoulder in one rigid plank throughout; elbows lead and travel back past the trunk; chest reaches the bar at the top; return to fully long arms. Independent technique and native runtime acceptance required. Not a generic row alias.',
  summary: 'Pull your chest to the bar leading with the elbows, keeping the body rigid.',
  frames: irValues.map((ir, i) => ({
    id: `p${i + 1}`,
    caption: captions66[i],
    joints: { ...structuredClone(basePose66), ir },
  })),
  segmentDurationsMs: [800, 600, 400, 800, 800],
};

const at66 = manifest.entries.findIndex(e => e.movementId === 66);
if (at66 >= 0 && manifest.entries[at66].previewId !== entry66.previewId) {
  throw Error('Movement 66 is already owned by another author');
}
if (at66 < 0) manifest.entries.push(entry66); else manifest.entries[at66] = entry66;

// ----------------------------------------------------------------------------
// Movement 152: Body Tricep Press
// ----------------------------------------------------------------------------
const row152 = catalogue.movements.find(e => e.id === 152);
if (!row152 || row152.motion.source_hold_reason) throw Error('Unresolved source for 152');

const geom152_0 = layout.bodyTricepPressGeometry(0, layout.CANONICAL_BODY_PARAMETERS).joints;
const basePose152 = Object.fromEntries(
  ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af', 'b'].map(k => [k, geom152_0[k]])
);

const captions152 = [
  'Grip the chest-height bar shoulder-width and lean on straight arms in one line.',
  'Bend the elbows while shoulders stay still and the body stays straight.',
  'Lower until elbows are deeply flexed toward the bar.',
  'Pause at the bottom, keeping the body in one straight line.',
  'Press through the palms, straightening the elbows to push away.',
  'Return to straight arms with the body held in one line.',
];

const tpValues = [0, 0.5, 1.0, 1.0, 0.5, 0];
const entry152 = {
  movementId: 152,
  name: row152.name,
  assetKey: row152.source.asset_key,
  previewId: 'body_tricep_press_152_draft',
  pattern: row152.source.pattern,
  status: 'pending',
  view: 'side',
  techniqueCitations: [],
  viewBox: [0, 8, 85, 92],
  equipment: 'squat_rack',
  instructions: row152.source.instructions,
  cues: row152.source.cues,
  coachingIntent: row152.source.coaching_intent,
  reason: 'Source text for Body Tricep Press is marked pending owner review; authored draft bound to schema 068 instructions and cues. Fixed chest-height bar in rack with planted toes, rigid body plank, isolated elbow extension with bounded upper arm drift and bottom pause. Independent technique and native runtime acceptance required. Not a push-up or shoulder press alias.',
  summary: 'Lean on the chest-height bar, bend elbows to lower, pause and press back.',
  frames: tpValues.map((tp, i) => ({
    id: `p${i + 1}`,
    caption: captions152[i],
    joints: { ...structuredClone(basePose152), tp },
  })),
  segmentDurationsMs: [900, 600, 500, 800, 800],
};

const at152 = manifest.entries.findIndex(e => e.movementId === 152);
if (at152 >= 0 && manifest.entries[at152].previewId !== entry152.previewId) {
  throw Error('Movement 152 is already owned by another author');
}
if (at152 < 0) manifest.entries.push(entry152); else manifest.entries[at152] = entry152;

// Write updated manifest
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
console.log('Successfully authored Movement 66 and Movement 152 in movementPreviewManifest.json');
