// Engineering evidence of the exact production layout at33ms ticks.
// Headless geometry is not a native compositor/FPS or technique approval.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, loadCanonicalFigure, primToSvg, ROLE_HEX, escapeXml } from './lib/canonicalSvg.mjs';
import { loadDerivation, deriveEntries } from './lib/derivation.mjs';
import { loadPreviewManifest, previewDataDigest, previewDataPaths } from './lib/previewData.mjs';

const args = process.argv.slice(2);
const ids = args[args.indexOf('--ids') + 1]?.split(',').map(Number);
const out = args[args.indexOf('--out') + 1];
if (!ids?.length || ids.some(id => !Number.isInteger(id)) || !out) throw Error('Use --ids <comma-separated IDs> --out <directory>');
const destination = path.resolve(out);
fs.mkdirSync(destination, { recursive: true });
const layout = await loadCanonicalFigure();
const entries = deriveEntries(loadPreviewManifest().entries, await loadDerivation());
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sourcePaths = [...previewDataPaths(), ...[
  'apps/mobile/src/components/movementPreview/canonicalFigure.ts',
  'apps/mobile/src/components/movementPreview/derivation.ts',
  'apps/mobile/src/components/movementPreview/MovementPreview.tsx',
  'tools/rendering/render_motion_cycle.mjs',
  'tools/rendering/lib/canonicalSvg.mjs',
].map(p => path.join(ROOT, p))];
const evidence = { sourceCommit: git('rev-parse', 'HEAD'),
  sourcesCommittedAtRender: git('status', '--porcelain', '--', 'apps/mobile/src/components/movementPreview', 'tools/rendering') === '',
  previewDataSha256: previewDataDigest(),
  rendering: 'Headless production primitives; no native FPS or technique approval.',
  sourceHashes: Object.fromEntries(sourcePaths.map(file => [path.relative(ROOT, file).replaceAll('\\', '/'), hash(fs.readFileSync(file))])),
  movements: [] };
for (const id of ids) {
  const entry = entries.find(e => e.movementId === id);
  if (!entry?.frames?.length) throw Error(`No drawable movement${id}`);
  const dir = path.join(destination, `movement-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const total = layout.segmentDurations(entry.frames.length, entry.segmentDurationsMs).reduce((a, b) => a + b, 0);
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  const [x, y, w, h] = entry.viewBox;
  const scale = Math.min(240 / w, 240 / h);
  const width = Math.ceil(w * scale), height = Math.ceil(h * scale);
  const records = [];
  for (const [bodyName, body] of Object.entries(layout.DUAL_BODY_PARAMETERS)) {
    const frames = [];
    for (const time of ticks) {
      const pose = layout.poseAtTime(entry.frames.map(f => f.joints), time, entry.segmentDurationsMs);
      const opts = { ...entry, body, implementTiltWeight: layout.peakWeightAtTime(entry.frames, entry.frameRoles, time, entry.segmentDurationsMs) };
      const prims = layout.layoutCanonicalFigure(pose, opts);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${ROLE_HEX.ink1}"/>${prims.map(p => primToSvg(p, [x, y, w, h], scale)).join('')}</svg>`;
      frames.push(svg);
    }
    const sampled = Array.from({ length: 12 }, (_, i) => Math.round(i * (ticks.length - 1) / 11));
    const cellHeight = height + 24;
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 6}" height="${cellHeight * 2}"><rect width="100%" height="100%" fill="${ROLE_HEX.ink1}"/>${sampled.map((i, index) => `<g transform="translate(${index % 6 * width} ${Math.floor(index / 6) * cellHeight})">${frames[i].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}<text x="4" y="${height + 16}" fill="${ROLE_HEX.textMid}" font-family="sans-serif" font-size="12">${ticks[i]}ms</text></g>`).join('')}</svg>`;
    const png = await sharp(Buffer.from(sheet)).png().toBuffer();
    fs.writeFileSync(path.join(dir, `${bodyName}-cycle.png`), png);
    // JSON escaping protects the inline script from source captions/asset data.
    const encodedFrames = JSON.stringify(frames).replaceAll('<', '\\u003c');
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeXml(entry.name)} cycle</title><style>body{background:#141412;color:#F7F6F3;font:16px sans-serif}button,input{margin:12px}#stage{width:${width}px;height:${height}px}</style><h2>${escapeXml(entry.name)} / ${bodyName}</h2><p>Headless production primitives. Technique and native smoothness are unapproved.</p><div id="stage"></div><button id="play">Play / pause</button><input id="scrub" type="range" min="0" max="${ticks.length - 1}" value="0"><span id="time"></span><script>const frames=${encodedFrames},times=${JSON.stringify(ticks)},stage=document.getElementById('stage'),scrub=document.getElementById('scrub'),label=document.getElementById('time');let active=false,i=0;function show(){stage.innerHTML=frames[i];scrub.value=i;label.textContent=times[i]+'ms';}document.getElementById('play').onclick=()=>{if(i===frames.length-1)i=0;active=!active;show();};scrub.oninput=()=>{active=false;i=Number(scrub.value);show();};setInterval(()=>{if(!active)return;if(i===frames.length-1){active=false;return;}i++;show();},33);show();</script>`;
    fs.writeFileSync(path.join(dir, `${bodyName}-cycle.html`), html);
    records.push({ body: bodyName, tickCount: ticks.length, totalMs: total, sheetSha256: hash(png), htmlSha256: hash(html), primitiveFramesSha256: hash(JSON.stringify(frames)) });
  }
  evidence.movements.push({ id, assetKey: entry.assetKey, view: entry.view, viewBox: entry.viewBox, records });
  console.log(`Rendered${id}: ${entry.name} / ${ticks.length}ticks ×3bodies`);
}
fs.writeFileSync(path.join(destination, 'cycle_evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
