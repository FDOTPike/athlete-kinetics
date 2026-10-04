import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';
const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
const row = catalogue.movements.find(e => e.id === 84);
if (!row || row.motion.source_hold_reason) throw Error('Unresolved84 source');
const resolved = layout.kickbackGeometry(0, layout.DUAL_BODY_PARAMETERS.neutral);
const pose = Object.fromEntries(['hd','nk','hp','el','wr','ef','wf','kn','an','kf','af'].map(k => [k, resolved[k]]));
const entry = { movementId: 84, name: row.name, assetKey: row.source.asset_key,
  previewId: 'ankle_cable_kickback_84_draft', pattern: row.source.pattern, status: 'pending',
  view: 'side', techniqueCitations: [], viewBox: [6, 8, 88, 96], equipment: 'cable_machine',
  instructions: row.source.instructions, cues: row.source.cues, coachingIntent: row.source.coaching_intent,
  reason: 'Source-bound draft: real low-pulley ankle cuff, held balance crossbar, quiet slight hinge/level pelvis/support leg and small25deg hip-extension arc. Working thigh/shin22.25 each with fixed5deg soft knee. Numeric range is schematic and requires separate review. No lumbar swing, hand-pulled cable or torso bounce. Independent technique/native runtime acceptance required.',
  summary: 'Hold the stack, push the strapped heel back and return with the pelvis quiet.',
  frames: [0, 12.5, 25, 25, 0].map((ke,i) => ({ id: `p${i+1}`, joints: {...structuredClone(pose),ke}, caption: [
    'Face the low pulley, strap the working ankle and hold the stack with a slight forward lean.',
    'Push the strapped heel back and slightly up through the hip; keep the pelvis level.',
    'Stop at a small range you control before the lower back starts arching.',
    'Squeeze the glute while the torso, hands and supporting leg stay still.',
    'Bring the leg forward slowly along the same hip arc.',
  ][i] })), segmentDurationsMs: [700,700,800,2200] };
const at = manifest.entries.findIndex(e => e.movementId === 84);
if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error('84 is owned by another author');
if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
