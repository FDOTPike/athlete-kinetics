/** Pending drawing fixtures only. No resolver approval or manifest mutation. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import * as manifest from '../../src/components/movementPreview/manifest';
import { MovementPreview } from '../../src/components/movementPreview';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';
import { previewManifest } from './previewManifest';

const root=path.resolve(__dirname,'../../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const draft=read('acceptance-evidence/wo09/batch3-perspective/draft-manifest.json');
// R2 Part C: the merged preview data comes from the app's own module.
const production=previewManifest;
const baseline=read('acceptance-evidence/wo09/batch3-perspective/base-primitives.json');
const baselineNeutral=read('acceptance-evidence/wo09/batch3-perspective/base-primitives-neutral.json');
const clone=v=>JSON.parse(JSON.stringify(v));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mid=p=>[(p.x1+p.x2)/2,(p.y1+p.y2)/2];
const length=p=>Math.hypot(p.x2-p.x1,p.y2-p.y1);
const options=(e,body)=>({view:e.view,assetKey:e.assetKey,body:rig.DUAL_BODY_PARAMETERS[body]});
function torsoCheck(prims,p) {
  const dx=p.hp[0]-p.nk[0],dy=p.hp[1]-p.nk[1],L=Math.hypot(dx,dy);
  const rows=prims.filter(v=>v.kind==='bone' && v.color==='textLow' && v.opacity===1 && !v.stroke
    && Math.abs((mid(v)[0]-p.nk[0])*dy-(mid(v)[1]-p.nk[1])*dx)<1e-6
    && Math.abs((v.x2-v.x1)*dx+(v.y2-v.y1)*dy)<1e-6);
  if(rows.length!==33 || rows.some(v=>v.w>2 || v.w<.5)) throw Error('tapered torso');
  if(length(rows[0])-length(rows[32])<1) throw Error('tapered torso profile');
  rows.forEach((v,i)=>{
    if(dist(mid(v),[p.nk[0]+dx*i/32,p.nk[1]+dy*i/32])>1e-6
      || Math.abs(length(v)-(length(rows[0])+(length(rows[32])-length(rows[0]))*i/32))>1e-6
      || (i && dist(mid(v),mid(rows[i-1]))>v.w)) throw Error('tapered torso continuity');
  });
  return rows;
}
function barCheck(prims) {
  const shafts=prims.filter(p=>p.kind==='bone' && p.w===1.4);
  if(shafts.length!==2) throw Error('shaft count');
  for(const p of shafts) if(Math.abs((p.y2-p.y1)/(p.x2-p.x1)-.25)>1e-8) throw Error('flat perspective');
  if(dist([shafts[0].x2,shafts[0].y2],[shafts[1].x1,shafts[1].y1])>1e-8) throw Error('shaft alignment');
  const hubs=prims.filter(p=>p.kind==='circle' && p.r===1.4);
  if(hubs.length!==2) throw Error('plate count');
  const center=[(shafts[0].x1+shafts[1].x2)/2,(shafts[0].y1+shafts[1].y2)/2];
  if(dist(center,[(hubs[0].cx+hubs[1].cx)/2,(hubs[0].cy+hubs[1].cy)/2])>1e-8) throw Error('plate balance');
  const onAxis=point=>Math.abs((point[1]-shafts[0].y1)-.25*(point[0]-shafts[0].x1));
  if(hubs.some(p=>onAxis([p.cx,p.cy])>1e-8)) throw Error('plate alignment');
  for(const h of hubs) {
    const rim=prims.filter(p=>p.kind==='bone' && p.color===h.fill && p.w<.5
      && dist(mid(p),[h.cx,h.cy])<3.2);
    if(rim.length!==25 || Math.abs(Math.max(...rim.map(length))-14)>.001) throw Error('plate face');
    rim.forEach(p=>{if(Math.abs((p.x2-p.x1)*4+(p.y2-p.y1))>1e-7) throw Error('plate plane');});
  }
  const hands=prims.filter(p=>p.kind==='circle' && p.r!==1.4 && !p.strokeWidth);
  const gripStart=[shafts[0].x1,shafts[0].y1],gripEnd=[shafts[1].x2,shafts[1].y2];
  const gripDx=gripEnd[0]-gripStart[0],gripDy=gripEnd[1]-gripStart[1];
  if(hands.length!==2 || hands.some(p=>onAxis([p.cx,p.cy])>.03
    || (p.cx-gripStart[0])*gripDx+(p.cy-gripStart[1])*gripDy<0
    || (p.cx-gripEnd[0])*gripDx+(p.cy-gripEnd[1])*gripDy>0)) throw Error('hand attachment');
  const head=prims.find(p=>p.kind==='circle' && p.strokeWidth===2.5);
  const distanceToSegment=p=>{
    const dx=p.x2-p.x1,dy=p.y2-p.y1;
    const t=Math.max(0,Math.min(1,((head.cx-p.x1)*dx+(head.cy-p.y1)*dy)/(dx*dx+dy*dy)));
    return dist([head.cx,head.cy],[p.x1+t*dx,p.y1+t*dy]);
  };
  const barBones=prims.filter(p=>p.kind==='bone' && (p.w===1.4 || p.w<.5));
  if(barBones.some(p=>distanceToSegment(p)<head.r+1.25+p.w/2)) throw Error('bar head collision');
  return {shafts,hubs};
}
function identity(e,p) {
  const dx=p.b[0]-p.nk[0],dy=p.b[1]-p.nk[1];
  if((e.movementId===1 && Math.abs(p.b[0]-52)>.02)
    || (e.movementId===8 && Math.abs(p.b[0]-54)>.02)) throw Error('squat bar path');
  if(e.movementId===1) {
    const sx=p.hp[0]-p.nk[0],sy=p.hp[1]-p.nk[1],L=Math.hypot(sx,sy);
    if(Math.abs((dx*-sy+dy*sx)/L-5)>.06 || Math.abs((dx*sx+dy*sy)/L-2)>.06) throw Error('back rack');
  }
  if(e.movementId===8 && (Math.abs(dx-4)>.02 || Math.abs(dy)>.02
    || p.el[0]-p.nk[0]<13.3
    || Math.abs((p.el[0]-p.nk[0])*dy-(p.el[1]-p.nk[1])*dx)<16)) throw Error('front rack');
  if(e.movementId===2 && Math.abs(p.b[0]-56)>.02) throw Error('deadlift path');
  if(e.movementId===5 && (dist(p.nk,e.frames[0].joints.nk)>.02 || dist(p.hp,e.frames[0].joints.hp)>.02)) throw Error('row hinge');
}
// Cable Crunch (39) was redrawn on 8 October 2026 at the owner's request: its
// original drawing was a stiff trunk hinging at the hips, where its text says
// the upper spine rounds with the hips frozen. The baseline file still records
// the original drawing at the commit it names, so the pin steps over that one
// row and holds the other eleven. Its redraw is tested against its text in
// MovementPreview.redrawnFromText.test.js.
const REDRAWN_SINCE_BASELINE = [39];
test('the original canonical neutral drawings stay byte-identical at 20ms intervals (all but the one redrawn since)', () => {
  expect(baselineNeutral.rows).toHaveLength(12);
  expect(baselineNeutral.rows.filter((row) => REDRAWN_SINCE_BASELINE.includes(row.id))).toHaveLength(REDRAWN_SINCE_BASELINE.length);
  for (const row of baselineNeutral.rows) {
    const e = production.entries.find((e) => e.movementId === row.id);
    if (REDRAWN_SINCE_BASELINE.includes(row.id)) {
      // Redrawn: it must really be a different drawing now, driven by the pose kit.
      expect(typeof e.frames[0].joints.ph).toBe('number');
      continue;
    }
    const draws = [];
    const ds = rig.segmentDurations(e.frames.length, e.segmentDurationsMs);
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    expect(rig.poseAtTime(poses, total, ds)).toEqual(poses[poses.length - 1]);
    for (let t = 0; t <= total; t += 20) {
      const pose = rig.poseAtTime(poses, t, ds);
      draws.push(rig.layoutCanonicalFigure(pose, { body: rig.CANONICAL_BODY_PARAMETERS, view: e.view, assetKey: e.assetKey }));
    }
    expect(createHash('sha256').update(JSON.stringify(draws)).digest('hex')).toBe(row.sha256);
  }
});
test.each(draft.entries)('$name: tapered body, actual bar primitives, grips and movement path through sweep',e=>{
  expect(production.entries.some(p=>p.movementId===e.movementId)).toBe(false);
  expect(e.status).toBe('pending');
  expect(draft.techniqueReview.status).toBe('pending');
  expect(manifest.buildPreviewEntry({...e,status:'covered'}).frameData.reducedMotionFrames).toHaveLength(9);
  const frames=e.frames.map(f=>f.joints), ds=e.segmentDurationsMs,total=ds.reduce((a,b)=>a+b,0);
  for(const body of ['neutral']){
    const opts=options(e,body),lengths={};
    for(let t=0;t<=total;t+=20) {
      const p=rig.poseAtTime(frames,t,ds),j=rig.resolveFigureJoints(p,opts);
      const prims=rig.layoutCanonicalFigure(p,opts);
      torsoCheck(prims,p); barCheck(prims);
      // Frame interpolation can move a rack a fraction off its analytic arc.
      if(t%450===0) identity(e,p);
      expect(dist(j.an,frames[0].an)).toBeLessThan(.001);
      expect(dist(j.af,[frames[0].af[0]-8,frames[0].af[1]-2])).toBeLessThan(.001);
      Object.entries(rig.drawnSegmentLengths(p,opts)).forEach(([k,v])=>(lengths[k]??=[]).push(v));
    }
    for(const [k,values] of Object.entries(lengths)) {
      const variation=(Math.max(...values)-Math.min(...values))/Math.max(...values);
      if(variation>.05) throw Error(e.name+' '+body+' '+k+' variation '+variation);
    }
  }
  if(e.movementId===2){
    expect(frames[0].b[1]).toBeGreaterThan(86);
    expect(frames[0].b[1]).toBeLessThan(88);
    expect(frames[4].nk[0]).toBe(frames[4].hp[0]);
    for(let i=1;i<=4;i++){expect(frames[i].hp[1]).toBeLessThan(frames[i-1].hp[1]);expect(frames[i].nk[1]).toBeLessThan(frames[i-1].nk[1]);}
  }
  if(e.movementId===5){expect(frames[0].b[1]-frames[4].b[1]).toBe(19);expect(frames[0].b[0]-frames[4].b[0]).toBe(10);}
});
test('mutation proofs reject old torso, flat shaft, tilted/unbalanced plates and detached hands',()=>{
  const e=draft.entries[0],p=e.frames[0].joints,opts=options(e,'neutral');
  const prims=rig.layoutCanonicalFigure(p,opts),rows=torsoCheck(prims,p);
  const noTorso=prims.filter(v=>!rows.includes(v));
  const oval={kind:'bone',x1:p.nk[0],y1:p.nk[1],x2:p.hp[0],y2:p.hp[1],w:14,color:'ink1',stroke:'textHi',opacity:1};
  expect(()=>torsoCheck([...noTorso,oval,{...oval,w:12}],p)).toThrow('tapered torso');
  let mutant=clone(prims); mutant.filter(v=>v.kind==='bone'&&v.w===1.4).forEach(v=>v.y2=v.y1);
  expect(()=>barCheck(mutant)).toThrow('flat perspective');
  mutant=clone(prims);mutant.find(v=>v.kind==='circle'&&v.r===1.4).cx+=3;
  expect(()=>barCheck(mutant)).toThrow('plate balance');
  mutant=clone(prims);const hubs=mutant.filter(v=>v.kind==='circle'&&v.r===1.4);hubs[0].cy+=2;hubs[1].cy-=2;
  expect(()=>barCheck(mutant)).toThrow('plate alignment');
  mutant=clone(prims); const rim=mutant.find(v=>v.kind==='bone'&&v.w<.5);rim.x2+=2;
  expect(()=>barCheck(mutant)).toThrow('plate plane');
  mutant=clone(prims);mutant.find(v=>v.kind==='circle'&&v.r!==1.4&&!v.strokeWidth).cy+=4;
  expect(()=>barCheck(mutant)).toThrow('hand attachment');
  mutant=clone(prims);mutant.find(v=>v.kind==='circle'&&v.r!==1.4&&!v.strokeWidth).cx+=100;mutant.find(v=>v.kind==='circle'&&v.r!==1.4&&!v.strokeWidth).cy+=25;
  expect(()=>barCheck(mutant)).toThrow('hand attachment');
  mutant=clone(prims);mutant.find(v=>v.kind==='circle'&&v.r!==1.4&&!v.strokeWidth).cx-=100;mutant.find(v=>v.kind==='circle'&&v.r!==1.4&&!v.strokeWidth).cy-=25;
  expect(()=>barCheck(mutant)).toThrow('hand attachment');
});
test.each(draft.entries)('$name mutation rejects displaced rack/path',e=>{
  const p=clone(e.frames[4].joints);
  if(e.movementId===5) p.hp[0]+=8; else p.b[0]+=8;
  expect(()=>identity(e,p)).toThrow();
});
test.each(draft.entries.map(e=>[e.name,'neutral',e]))('%s/%s: actual app Views match primitives at all nine reduced positions',async(_,body,e)=>{
  const fixture=manifest.buildPreviewEntry({...e,status:'covered'});
  jest.spyOn(manifest,'resolveMovementPreview').mockReturnValue(fixture);
  resetPreviewPlayback();
  const subject={movement_id:e.movementId,media:{assetKey:e.assetKey,status:'ready'}};
  const view=render(<MovementPreview movement={subject} bodyType={body} reducedMotion={true}/>);
  try {
    await act(async()=>{});
    for(let f=0;f<9;f++){
      expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(e.frames[f].caption);
      const stage=screen.getByTestId('movement-preview-stage-canonical');
      const styles=React.Children.toArray(stage.props.children).map(c=>StyleSheet.flatten(c.props.style)).slice(1);
      const prims=rig.layoutCanonicalFigure(e.frames[f].joints,options(e,body)),scale=240/101;
      expect(styles).toHaveLength(prims.length);
      prims.forEach((p,i)=>{
        expect(styles[i].backgroundColor).toBe(theme.color[p.kind==='bone'?p.color:p.fill]);
        if(p.kind==='bone'){
          expect(styles[i].width).toBeCloseTo(length(p)*scale,7);
          expect(styles[i].height).toBeCloseTo(Math.max(1,p.w*scale),7);
          expect(styles[i].left).toBeCloseTo((mid(p)[0]-15)*scale-length(p)*scale/2,7);
          expect(styles[i].top).toBeCloseTo(mid(p)[1]*scale-Math.max(1,p.w*scale)/2,7);
          expect(parseFloat(styles[i].transform[0].rotate)).toBeCloseTo(Math.atan2(p.y2-p.y1,p.x2-p.x1)*180/Math.PI,7);
        } else if(p.kind==='circle'){
          expect(styles[i].left).toBeCloseTo((p.cx-15-p.r)*scale,7);
          expect(styles[i].top).toBeCloseTo((p.cy-p.r)*scale,7);
          expect(styles[i].width).toBeCloseTo(2*p.r*scale,7);
        }
      });
      fireEvent.press(screen.getByTestId('movement-preview-control'));
    }
  } finally {view.unmount();jest.restoreAllMocks();resetPreviewPlayback();}
});
