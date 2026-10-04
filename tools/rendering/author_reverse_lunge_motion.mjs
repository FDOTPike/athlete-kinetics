import fs from 'node:fs';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';
const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
const row = catalogue.movements.find(e => e.id === 52);
if (!row || row.motion.source_hold_reason) throw Error('Unresolved52 source');
const resolved = layout.reverseLungeGeometry(0, layout.DUAL_BODY_PARAMETERS.neutral).joints;
const pose = Object.fromEntries(['hd','nk','hp','el','wr','ef','wf','kn','an','kf','af'].map(k => [k,resolved[k]]));
const entry = { movementId:52, name:row.name, assetKey:row.source.asset_key,
  previewId:'reverse_step_lunge_52_draft', pattern:row.source.pattern, status:'pending', view:'side',
  techniqueCitations:[], viewBox:[-6,6,80,96], equipment:'dumbbells', instructions:row.source.instructions,
  cues:row.source.cues, coachingIntent:row.source.coaching_intent,
  reason:'Source-bound reverse step with fixed whole front-foot contact, two hanging neutral dumbbells, stacked torso and constrained22.25/22.25 leg chains. Rear foot lifts, lands on the toes, rear knee hovers, and rear foot returns to the original stance. Numeric stride/hover/tempo are schematic draft choices; front alignment view, separate technique/native runtime acceptance still required. Not a forward or walking-lunge alias.',
  summary:'Step back softly, lower with the front foot planted and drive back to standing.',
  frames:[0,1,2,2,3,4].map((rl,i)=>({id:`p${i+1}`,joints:{...structuredClone(pose),rl},caption:[
    'Stand tall with a dumbbell in each hand and both feet on the floor.',
    'Step the rear foot back softly; keep the whole front foot planted.',
    'Lower with the torso stacked until the back knee hovers above the floor.',
    'Keep the front heel down; the front leg works while the rear toes support balance.',
    'Drive through the whole front foot to raise the body under control.',
    'Bring the rear foot back beside the planted front foot and stand tall again.',
  ][i]})), segmentDurationsMs:[900,900,500,1200,900] };
const at = manifest.entries.findIndex(e=>e.movementId===52);
if(at>=0&&manifest.entries[at].previewId!==entry.previewId)throw Error('52 is owned by another author');
if(at<0)manifest.entries.push(entry);else manifest.entries[at]=entry;
fs.writeFileSync(file,`${JSON.stringify(manifest)}\n`);
fs.writeFileSync('docs/audits/accessible-coach/movement-completion/REVERSE_LUNGE_SOURCE_BINDING.json',`${JSON.stringify({source:row, schematic:{legSegments:[22.25,22.25],footLength:5.4,rearHeelRise:3.3,peakHipY:68.4,torsoLength:24},acceptance:'unreviewed; supplemental front alignment and native evidence pending'},null,2)}\n`);
