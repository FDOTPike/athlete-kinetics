// Raster regression: SVG borders stay within the unchanged RN outer box.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { primToSvg, primBounds } from './lib/canonicalSvg.mjs';
const fixtures=[
  {prim:{kind:'circle',cx:20,cy:20,r:6.2,fill:'ink1',stroke:'textHi',strokeWidth:2.5,opacity:1},bounds:[13.8,13.8,26.2,26.2]},
  {prim:{kind:'bone',x1:10,y1:20,x2:30,y2:20,w:8,color:'textLow',stroke:'textHi',strokeWidth:2.5,opacity:1},bounds:[10,16,30,24]},
  {prim:{kind:'rect',x:10,y:10,w:20,h:12,rx:2,fill:'line',stroke:'textHi',strokeWidth:2.5,opacity:1},bounds:[10,10,30,22]},
];
for(const {prim,bounds} of fixtures) test(`${prim.kind} inside border matches native outer dimensions`,async()=>{
  const scale=4, vb=[0,0,50,50];
  const actual=primBounds(prim,vb,scale);
  for(const [key,expected] of Object.entries({minX:bounds[0]*scale,minY:bounds[1]*scale,maxX:bounds[2]*scale,maxY:bounds[3]*scale})) assert.ok(Math.abs(actual[key]-expected)<1e-8,key);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">${primToSvg(prim,vb,scale)}</svg>`;
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let painted=0;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>8){
    painted++;
    assert.ok(x>=Math.floor(bounds[0]*scale)&&x<Math.ceil(bounds[2]*scale),`paint escapes native x bounds at${x}`);
    assert.ok(y>=Math.floor(bounds[1]*scale)&&y<Math.ceil(bounds[3]*scale),`paint escapes native y bounds at${y}`);
  }
  assert.ok(painted>0);
});
