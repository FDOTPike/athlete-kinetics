import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './canonicalSvg.mjs';
/**
 * Explicit offline draft input; the default runtime evidence gate is unchanged.
 *
 * R2 Part C split the preview data into `previewIndex.json` plus
 * `families/<family>.json`, so the PRODUCTION input this returns is the index
 * (its path is what a draft/production identity check can `git show`), and the
 * entries themselves are read through `lib/previewData.mjs`
 * (`loadPreviewManifest()`), which merges the split back into the shape the
 * tools were written against.
 */
export function draftInput() {
  const args=process.argv.slice(2), i=args.indexOf('--draft-manifest');
  if(i<0) return {args,input:path.join(ROOT,'apps/mobile/src/components/movementPreview/previewIndex.json'),draft:false};
  if(!args[i+1] || args[i+1].startsWith('--') || args.lastIndexOf('--draft-manifest')!==i || args.includes('--all')) {
    throw Error('One explicit draft manifest required; --all remains production-only');
  }
  const input=path.resolve(ROOT,args[i+1]); args.splice(i,2);
  const data=JSON.parse(fs.readFileSync(input,'utf8'));
  if(data.techniqueReview?.status!=='pending' || !data.entries?.length
    || data.entries.some(e=>e.status!=='pending' || !e.frames?.[0]?.joints?.nk)) throw Error('Only pending canonical drafts accepted');
  return {args,input,draft:true};
}
