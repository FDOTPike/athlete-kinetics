// Source-specific shoulder action; not an alias of the elbow pushdowns.
import fs from 'node:fs';
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
const row = catalogue.movements.find(e => e.id === 264);
if (!row || row.motion.source_hold_reason) throw Error('Unresolved264 source');
const pose = { hd: [52, 22], nk: [49, 31], hp: [43, 54],
  el: [59, 24], wr: [68, 18], ef: [54, 24], wf: [63, 18],
  kn: [45, 75], an: [42, 96], kf: [33, 74], af: [30, 96] };
const entry = { movementId: 264, name: row.name, assetKey: row.source.asset_key,
  previewId: 'straight_arm_pulldown_264_draft', pattern: row.source.pattern, status: 'pending',
  view: 'oblique', techniqueCitations: [], viewBox: [6, -5, 94, 107], equipment: 'cable_machine',
  instructions: row.source.instructions, cues: row.source.cues, coachingIntent: row.source.coaching_intent,
  reason: 'Source-bound draft: staggered feet and slight quiet hinge; both straight arms sweep from overhead/front to thighs through the shoulders, preserving12.5/12 world lengths and zero elbow flexion. One high pulley, two neutral rope grips, full controlled return. Independent technique/native runtime acceptance required.',
  summary: 'Sweep straight arms from overhead to the thighs with a quiet hinge.',
  frames: [-30, 30, 85, 85, -30].map((sa, i) => ({ id: `p${i + 1}`, joints: { ...structuredClone(pose), sa }, caption: [
    'Stagger the feet, hinge slightly and hold the high-pulley rope up in front with straight arms.',
    'Sweep the straight arms down through the shoulders; keep the torso quiet.',
    'Finish with the rope at the thighs and the elbows still straight.',
    'Keep the shoulders controlled and the arms long at the bottom.',
    'Return overhead along the same shoulder arc without bending the elbows.',
  ][i] })), segmentDurationsMs: [800, 800, 600, 2600] };
const at = manifest.entries.findIndex(e => e.movementId === 264);
if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error('264 is owned by another author');
if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
