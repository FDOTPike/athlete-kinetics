// Fixed crops from the production rig across all bodies and the whole cycle.
// This is an authoring tool, never a runtime auto-zoom.
import fs from 'node:fs';
import { loadCanonicalFigure, figureBounds, isVisiblePrim } from './lib/canonicalSvg.mjs';
import { loadDerivation, deriveEntries } from './lib/derivation.mjs';

const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const layout = await loadCanonicalFigure();
const entries = deriveEntries(manifest.entries, await loadDerivation());
const ids = process.argv.slice(2).map(Number);
if (!ids.length || ids.some(id => !Number.isInteger(id))) throw Error('Supply the reviewed movement IDs to reframe');
for (const id of ids) {
  const entry = entries.find(e => e.movementId === id);
  const raw = manifest.entries.find(e => e.movementId === id);
  if (!entry?.frames?.length) throw Error(`Movement ${id} has no authored poses`);
  const before = [...entry.viewBox];
  const total = layout.segmentDurations(entry.frames.length, entry.segmentDurationsMs).reduce((a, b) => a + b, 0);
  const times = new Set([0, total]);
  for (let t = 0; t < total; t += 33) times.add(t);
  let elapsed = 0;
  for (const duration of layout.segmentDurations(entry.frames.length, entry.segmentDurationsMs)) {
    elapsed += duration;
    for (const offset of [-0.001, 0, 0.001]) times.add(Math.max(0, Math.min(total, elapsed + offset)));
  }
  let bounds = { minX: entry.viewBox[0], minY: entry.viewBox[1], maxX: entry.viewBox[0] + entry.viewBox[2], maxY: entry.viewBox[1] + entry.viewBox[3] };
  for (const body of Object.values(layout.DUAL_BODY_PARAMETERS)) {
    for (const time of times) {
      const pose = layout.poseAtTime(entry.frames.map(f => f.joints), time, entry.segmentDurationsMs);
      const options = { ...entry, view: entry.view, body,
        implementTiltWeight: layout.peakWeightAtTime(entry.frames, entry.frameRoles, time, entry.segmentDurationsMs) };
      const b = figureBounds(layout.layoutCanonicalFigure(pose, options).filter(isVisiblePrim), [0, 0, 100, 100], 1);
      if (!b) throw Error(`Movement ${id} has no painted geometry`);
      bounds.minX = Math.min(bounds.minX, b.minX - 2);
      bounds.minY = Math.min(bounds.minY, b.minY - 2);
      bounds.maxX = Math.max(bounds.maxX, b.maxX + 2);
      bounds.maxY = Math.max(bounds.maxY, b.maxY + 2);
    }
  }
  const x = Math.floor(bounds.minX * 100) / 100;
  const y = Math.floor(bounds.minY * 100) / 100;
  raw.viewBox = [x, y, Math.ceil((bounds.maxX - x) * 100) / 100, Math.ceil((bounds.maxY - y) * 100) / 100];
  console.log(`${id}: ${JSON.stringify(before)} -> ${JSON.stringify(raw.viewBox)}`);
}
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
