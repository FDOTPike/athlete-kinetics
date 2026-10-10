// Host storage/retained JSON-clone regressions, never native or phone RAM proof.
// Run: node --expose-gc tools/rendering/verify_preview_storage.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readPreviewDataSources, PREVIEW_BUDGETS, loadPreviewManifest } from './lib/previewData.mjs';
if (typeof global.gc !== 'function') throw Error('Run with --expose-gc; heap proof must not be silently skipped');
const sources = readPreviewDataSources();
const families = sources.slice(1);
const rawBytes = sources.reduce((sum,[,text])=>sum+Buffer.byteLength(text),0);
const gzipBytes = zlib.gzipSync(sources.map(([,text])=>text).join('')).byteLength;
const largest = [...families].sort((a,b)=>Buffer.byteLength(b[1])-Buffer.byteLength(a[1]))[0];
const merged = loadPreviewManifest();
const allText = JSON.stringify(merged);
function retainedClone(text) {
  // Keep the parsed clone reachable through collection. Record every sample;
  // median reduces host GC noise, while the guard remains finite and explicit.
  const samples = [];
  for (let i=0;i<5;i++) {
    global.gc();
    const before = process.memoryUsage().heapUsed;
    globalThis.__motionStorageClone = JSON.parse(text);
    global.gc();
    samples.push(process.memoryUsage().heapUsed-before);
    delete globalThis.__motionStorageClone;
  }
  return { samples, medianBytes:[...samples].sort((a,b)=>a-b)[2] };
}
const singleFamily = retainedClone(largest[1]);
const allFamilies = retainedClone(allText);
const checks = {
  aggregateRaw: rawBytes<=PREVIEW_BUDGETS.rawBytes,
  aggregateGzip: gzipBytes<=PREVIEW_BUDGETS.gzipBytes,
  everyFamily: families.every(([,text])=>Buffer.byteLength(text)<=PREVIEW_BUDGETS.familyBytes),
  singleFamilyClone: singleFamily.medianBytes>0 && singleFamily.medianBytes<=PREVIEW_BUDGETS.singleFamilyMaxBytes,
  allFamiliesClone: allFamilies.medianBytes>0 && allFamilies.medianBytes<=PREVIEW_BUDGETS.allFamiliesMaxBytes,
};
const report = { runtime:process.version, scope:'Host storage and retained JSON-clone regression only; no native peak memory/frame-timing/4GBphone acceptance',
  records:merged.entries.length, families:families.length, rawBytes,gzipBytes,
  largestFamily:{file:path.basename(largest[0]),rawBytes:Buffer.byteLength(largest[1])},
  singleFamily,allFamilies,budgets:PREVIEW_BUDGETS,checks,pass:Object.values(checks).every(Boolean) };
const outIndex=process.argv.indexOf('--out');
if(outIndex>=0) fs.writeFileSync(process.argv[outIndex+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.pass) process.exitCode=1;
