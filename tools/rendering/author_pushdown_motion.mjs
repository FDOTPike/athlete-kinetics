// Bounded source-backed drafts: never changes a review/approval gate.
import fs from 'node:fs';
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
const standing = { hd: [45.6, 18.6], nk: [45.3, 27.6], hp: [44.4, 51.5],
  el: [45.3, 40.1], wr: [55, 36], ef: [40.5, 40.1], wf: [50.2, 36],
  kn: [44.2, 73.75], an: [44, 96], kf: [44.2, 73.75], af: [44, 96] };
for (const id of [80, 262, 292]) {
  const row = catalogue.movements.find(e => e.id === id);
  if (!row || row.motion.source_hold_reason) throw Error(`Unresolved source for${id}`);
  const grip = id === 262 ? 'palms facing up' : id === 80 ? 'palms facing down' : 'palms facing each other';
  const captions = [
    `Hold the ${id === 292 ? 'rope ends' : 'high-cable bar'} with ${grip}; pin the upper arms beside the ribs.`,
    'Straighten the elbows while the upper arms and body stay still.',
    id === 292 ? 'Finish with the rope ends spread beside the thighs and arms long.' : 'Finish with the arms long and the bar at the thighs.',
    'Pause at full extension without moving the shoulders.',
    'Let the cable rise slowly until the forearms point up again.',
  ];
  const entry = { movementId: id, name: row.name, assetKey: row.source.asset_key,
    previewId: `pushdown_${id}_draft`, pattern: row.source.pattern, status: 'pending',
    view: 'oblique', techniqueCitations: [], viewBox: [10, 4, 82, 98], equipment: 'cable_machine',
    instructions: row.source.instructions, cues: row.source.cues, coachingIntent: row.source.coaching_intent,
    reason: 'Source-bound draft: fixed shoulders and elbows;12.5/12 world arm lengths,110deg flexion to full extension. Oblique projection exposes the high pulley and actual grip. Rope wrists close in the bent start and spread to the sides at full extension, with constant forearm and rope-branch lengths. Independent technique/native runtime acceptance required.',
    summary: id === 292 ? 'Extend the elbows and spread the rope beside the thighs.' : 'Extend the elbows with the upper arms pinned beside the ribs.',
    frames: [110, 55, 0, 0, 110].map((pe, i) => ({ id: `p${i + 1}`, caption: captions[i], joints: { ...structuredClone(standing), pe } })),
    segmentDurationsMs: [650, 650, 1000, 2200] };
  const at = manifest.entries.findIndex(e => e.movementId === id);
  if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error(`Movement${id} is already owned by another author`);
  if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
}
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
