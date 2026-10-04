// Three source-specific bench setups sharing only the true shoulder arc.
import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';
const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
for (const [id, incline, setup] of [[49, 0, 'flat bench with feet on the floor'], [178, -15, 'decline bench with the legs secured under the ankle roller'], [220, 30, 'low incline bench with feet on the floor']]) {
  const row = catalogue.movements.find(e => e.id === id);
  if (!row || row.motion.source_hold_reason) throw Error(`Unresolved${id} source`);
  const resolved = layout.flyeGeometry(0, layout.DUAL_BODY_PARAMETERS.neutral, incline).joints;
  const pose = Object.fromEntries(['hd','nk','hp','el','wr','ef','wf','kn','an','kf','af'].map(k => [k, resolved[k]]));
  const entry = { movementId: id, name: row.name, assetKey: row.source.asset_key,
    previewId: `flye_${id}_draft`, pattern: row.source.pattern, status: 'pending',
    view: 'oblique', techniqueCitations: [], viewBox: [0, 15, 104, 88], equipment: 'dumbbells',
    instructions: row.source.instructions, cues: row.source.cues, coachingIntent: row.source.coaching_intent,
    reason: `Source-bound ${incline === 0 ? 'flat' : incline < 0 ? 'secured decline' : 'low incline'} draft: wide chest-plane shoulder arc, fixed15deg soft elbows and12.5/12 world arm lengths, two rigid neutral-grip dumbbells, head/back supported and quiet legs. Bench angle${incline}deg and85deg opening are schematic draft choices, not universal ROM prescriptions. Independent technique/native runtime acceptance required.`,
    summary: 'Open through the shoulders with a fixed soft elbow bend, then hug the same arc closed.',
    frames: [0, 0.5, 1, 1, 0].map((fo, i) => ({ id: `p${i + 1}`, joints: { ...structuredClone(pose), fo }, caption: [
      `Lie on a ${setup}; hold two bells over the chest with palms facing each other.`,
      'Open slowly in a wide shoulder arc; keep the same soft elbow bend.',
      'Stop at a chest stretch you control, without dropping the shoulders deeper.',
      'Keep the back and head supported and the elbow bend unchanged.',
      'Hug the same arc closed over the chest; keep the bells apart.',
    ][i] })), segmentDurationsMs: [1000, 1000, 300, 1800] };
  const at = manifest.entries.findIndex(e => e.movementId === id);
  if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error(`${id} owned by another author`);
  if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
}
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
