import { DUAL_BODY_PARAMETERS, reverseLungeGeometry, poseAtTime, resolveFigureJoints, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const NATIVE_GROUND_Y=96.9; // actual MovementPreview ground View top
const entry = previewManifest.entries.find(e=>e.movementId===52);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const midpoint=p=>[(p.x1+p.x2)/2,(p.y1+p.y2)/2];

test.each(Object.keys(DUAL_BODY_PARAMETERS))('52 steps back and returns while the whole front sole stays planted (%s)',name=>{
  const body=DUAL_BODY_PARAMETERS[name],opts={...entry,body},start=reverseLungeGeometry(0,body);
  const total=entry.segmentDurationsMs.reduce((a,b)=>a+b,0);
  const ticks=[...Array.from({length:Math.ceil(total/33)},(_,i)=>i*33),total];
  for(const t of ticks){
    const pose=poseAtTime(entry.frames.map(f=>f.joints),t,entry.segmentDurationsMs);
    const g=reverseLungeGeometry(pose.rl,body),f=resolveFigureJoints(pose,opts);
    expect(f).toEqual(g.joints);
    expect(g.frontFoot).toEqual(start.frontFoot);
    expect(f.nk[0]).toBe(f.hp[0]);expect(f.hp[1]-f.nk[1]).toBeCloseTo(24,9);
    expect(f.hd[0]).toBe(f.nk[0]);expect(f.nk[1]-f.hd[1]).toBeCloseTo(9,9);
    for(const [root,knee,ankle] of [[f.nLeg,f.kn,f.an],[f.fLeg,f.kf,f.af]]){
      expect(dist(root,knee)).toBeCloseTo(22.25,8);expect(dist(knee,ankle)).toBeCloseTo(22.25,8);
    }
    for(const [root,elbow,wrist] of [[f.nArm,f.el,f.wr],[f.fArm,f.ef,f.wf]]){
      expect(dist(root,elbow)).toBeCloseTo(12.5,8);expect(dist(elbow,wrist)).toBeCloseTo(12,8);
      expect(root[0]).toBe(elbow[0]);expect(elbow[0]).toBe(wrist[0]);
    }
    for(const p of g.rearFoot) expect(p[1]+g.footWidth/2).toBeLessThanOrEqual(NATIVE_GROUND_Y+1e-9);
    expect(dist(...g.frontFoot)).toBeCloseTo(5.4,9);expect(dist(...g.rearFoot)).toBeCloseTo(5.4,9);
    const prims=layoutCanonicalFigure(pose,opts);
    const feet=prims.filter(p=>p.kind==='bone'&&p.w===g.footWidth&&p.x1===f.an[0]&&p.y1===f.an[1]);
    expect(feet.some(p=>p.x2===g.frontFoot[1][0]&&p.y2===g.frontFoot[1][1])).toBe(true);
    const shafts=prims.filter(p=>p.kind==='bone'&&p.w===2.2);
    expect(shafts).toHaveLength(2);
    const far=shafts.find(p=>p.color==='textLow'),near=shafts.find(p=>p.color==='textHi');
    expect(dist(midpoint(far),f.wf)).toBeLessThan(1e-9);expect(dist(midpoint(near),f.wr)).toBeLessThan(1e-9);
    expect(dist([near.x1,near.y1],[near.x2,near.y2])).toBeCloseTo(10,9);
    const head=prims.find(p=>p.kind==='circle'&&p.fill==='ink1');
    expect(prims.indexOf(far)).toBeLessThan(prims.indexOf(head));
    expect(prims.indexOf(near)).toBeGreaterThan(prims.indexOf(head));
  }
  const lift=reverseLungeGeometry(.5,body),land=reverseLungeGeometry(1,body),bottom=reverseLungeGeometry(2,body);
  expect(lift.rearFoot[1][1]).toBeLessThan(start.rearFoot[1][1]-6);
  expect(land.joints.af[0]).toBeLessThan(start.joints.af[0]-40);
  expect(land.rearFoot[1][1]+land.footWidth/2).toBeCloseTo(NATIVE_GROUND_Y,8);
  expect(bottom.joints.af).toEqual(land.joints.af);
  expect(bottom.rearFoot[0][1]).toBeLessThan(bottom.rearFoot[1][1]);
  const paintedKneeGap=NATIVE_GROUND_Y-bottom.joints.kf[1]-body.lw*1.18/2;
  expect(paintedKneeGap).toBeGreaterThan(3);expect(paintedKneeGap).toBeLessThan(4);
  expect(reverseLungeGeometry(3,body).joints).toEqual(land.joints);
  expect(reverseLungeGeometry(4,body)).toEqual(start);
  expect(resolveFigureJoints(poseAtTime(entry.frames.map(f=>f.joints),total,entry.segmentDurationsMs),opts)).toEqual(start.joints);
});

test('52 keeps the reverse-step scalar and remains pending with fail-closed malformed geometry',()=>{
  expect(entry.status).toBe('pending');expect(entry.deriveFrom).toBeUndefined();
  expect(entry.instructions).toMatch(/step one foot back/);
  expect(entry.frames.map(f=>f.joints.rl)).toEqual([0,1,2,2,3,4]);
  expect(buildPreviewEntry({...entry,status:'covered'}).frameData.frames.at(-1).joints.rl).toBe(4);
  const bad=JSON.parse(JSON.stringify(entry));bad.frames[1].joints.rl='bad';
  expect(()=>buildPreviewEntry({...bad,status:'covered'})).toThrow('bad canonical rl');
  for(const invalid of [-1,4.1,NaN,Infinity])expect(()=>reverseLungeGeometry(invalid,DUAL_BODY_PARAMETERS.neutral)).toThrow('Invalid reverse-lunge phase');
});
