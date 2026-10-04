import { DUAL_BODY_PARAMETERS, kickbackGeometry, poseAtTime, resolveFigureJoints, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const entry = previewManifest.entries.find(e=>e.movementId===84);
const minus = (a,b)=>a.map((v,i)=>v-b[i]);
const length = v=>Math.hypot(...v);
const dot = (a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

test.each(Object.keys(DUAL_BODY_PARAMETERS))('84 has a cuff-driven hip arc with fixed support/body and actual leg lengths (%s)',name=>{
  const body=DUAL_BODY_PARAMETERS[name], opts={...entry,body};
  const first=kickbackGeometry(0,body), total=entry.segmentDurationsMs.reduce((a,b)=>a+b,0);
  const ticks=[...Array.from({length:Math.ceil(total/33)},(_,i)=>i*33),total];
  for(const t of ticks){
    const pose=poseAtTime(entry.frames.map(f=>f.joints),t,entry.segmentDurationsMs);
    const f=resolveFigureJoints(pose,opts);
    for(const key of ['hd','nk','hp','waist','nArm','fArm','el','ef','wr','wf','nLeg','fLeg','kf','af']) expect(f[key]).toEqual(first[key]);
    const upper=minus(f.kn,f.nLeg), lower=minus(f.an,f.kn);
    expect(length(upper)).toBeCloseTo(22.25,8); expect(length(lower)).toBeCloseTo(22.25,8);
    expect(Math.acos(dot(upper,lower)/22.25**2)*180/Math.PI).toBeCloseTo(5,7);
    expect(length(minus(f.kf,f.fLeg))).toBeCloseTo(22.25,8);
    expect(length(minus(f.af,f.kf))).toBeCloseTo(22.25,8);
    for(const [root,elbow,wrist] of [[f.nArm,f.el,f.wr],[f.fArm,f.ef,f.wf]]){
      expect(length(minus(elbow,root))).toBeCloseTo(12.5,8);
      expect(length(minus(wrist,elbow))).toBeCloseTo(12,8);
    }
    const prims=layoutCanonicalFigure(pose,opts);
    const cables=prims.filter(p=>p.kind==='bone'&&p.w===1.4&&p.color==='textMid');
    expect(cables).toHaveLength(1);
    expect([cables[0].x1,cables[0].y1]).toEqual([84,89]);
    expect([cables[0].x2,cables[0].y2]).toEqual(f.an);
    expect([cables[0].x2,cables[0].y2]).not.toEqual(f.wr);
    const cuff=prims.find(p=>p.kind==='bone'&&p.w===2.2&&p.color==='textMid');
    expect(length(minus([(cuff.x1+cuff.x2)/2,(cuff.y1+cuff.y2)/2],f.an))).toBeLessThan(1e-10);
    expect(prims.indexOf(cables[0])).toBeLessThan(prims.indexOf(cuff));
  }
  const end=kickbackGeometry(25,body);
  expect(end.an[0]).toBeLessThan(first.an[0]-18);
  expect(end.an[1]).toBeLessThan(first.an[1]);
  expect(first.nk[0]).toBeGreaterThan(first.hp[0]);
  expect(resolveFigureJoints(poseAtTime(entry.frames.map(f=>f.joints),total,entry.segmentDurationsMs),opts)).toEqual(first);
});

test('84 remains a pending cuff action and its scalar survives app validation',()=>{
  expect(entry.status).toBe('pending');
  expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
  expect(buildPreviewEntry({...entry,status:'covered'}).frameData.frames[0].joints.ke).toBe(0);
  const bad=JSON.parse(JSON.stringify(entry)); bad.frames[0].joints.ke='bad';
  expect(()=>buildPreviewEntry({...bad,status:'covered'})).toThrow('bad canonical ke');
});
