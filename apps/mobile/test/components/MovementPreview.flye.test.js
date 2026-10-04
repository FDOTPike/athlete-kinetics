// World action/load/support regressions; these do not approve technique/FPS.
import { DUAL_BODY_PARAMETERS, flyeGeometry, poseAtTime, resolveFigureJoints, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const entries = [49,178,220].map(id => previewManifest.entries.find(e => e.movementId === id));
const inclineFor = id => id === 178 ? -15 : id === 220 ? 30 : 0;
const subtract = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
const distance = (a,b) => Math.hypot(...subtract(a,b));

test.each(entries)('$movementId flye uses shoulder opening with fixed soft elbows and two attached loads', entry => {
  expect(entry.status).toBe('pending');
  const total = entry.segmentDurationsMs.reduce((a,b) => a+b,0);
  const ticks = [...Array.from({length:Math.ceil(total/33)},(_,i) => i*33),total];
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const opts = {...entry,body};
    const first = resolveFigureJoints(entry.frames[0].joints,opts);
    for (const t of ticks) {
      const pose = poseAtTime(entry.frames.map(f => f.joints),t,entry.segmentDurationsMs);
      const fly = flyeGeometry(pose.fo,body,inclineFor(entry.movementId));
      const f = resolveFigureJoints(pose,opts);
      for (const key of ['hd','nk','hp','kn','an','kf','af','nArm','fArm','nLeg','fLeg']) expect(f[key]).toEqual(first[key]);
      for (const arm of [fly.near,fly.far]) {
        const {shoulder,elbow,wrist,shaft} = arm.world;
        const upper = subtract(elbow,shoulder), fore = subtract(wrist,elbow);
        expect(distance(shoulder,elbow)).toBeCloseTo(12.5,8);
        expect(distance(elbow,wrist)).toBeCloseTo(12,8);
        expect(Math.acos(dot(upper,fore)/(12.5*12))*180/Math.PI).toBeCloseTo(15,7);
        expect(dot(upper,fly.trunk)).toBeCloseTo(0,8);
        expect(dot(fore,fly.trunk)).toBeCloseTo(0,8);
        expect(distance(shaft[0],shaft[1])).toBeCloseTo(10,8);
        expect(distance(shaft[0].map((v,i) => (v+shaft[1][i])/2),wrist)).toBeLessThan(1e-10);
        expect(dot(subtract(shaft[1],shaft[0]),fore)).toBeCloseTo(0,8);
      }
      expect(f.wr).toEqual(fly.near.projected.wrist);
      expect(f.wf).toEqual(fly.far.projected.wrist);
      const prims = layoutCanonicalFigure(pose,opts);
      expect(prims.filter(p => p.kind==='bone' && p.w===2.2)).toHaveLength(2);
      expect(prims.filter(p => p.kind==='rect' && (p.fill==='textHi'||p.fill==='textLow'))).toHaveLength(0);
      for (const p of prims) for (const v of Object.values(p).filter(v => typeof v==='number')) expect(Number.isFinite(v)).toBe(true);
      const headDepth = dot(subtract(f.hd,fly.pad[0]),fly.padNormal);
      expect(headDepth).toBeCloseTo(-(body.hr+2),8); // Inside-border RN outer circle touches pad.
    }
    const closed = flyeGeometry(0,body,inclineFor(entry.movementId));
    const open = flyeGeometry(1,body,inclineFor(entry.movementId));
    expect(distance(closed.near.world.wrist,closed.far.world.wrist)).toBeCloseTo(7,8);
    expect(distance(open.near.world.wrist,open.far.world.wrist)).toBeGreaterThan(60);
    expect(distance(open.near.world.elbow,closed.near.world.elbow)).toBeGreaterThan(16);
    expect(resolveFigureJoints(poseAtTime(entry.frames.map(f=>f.joints),total,entry.segmentDurationsMs),opts)).toEqual(first);
  }
});

test('flye setups distinguish flat/incline floor feet and secured decline legs', () => {
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const flat = flyeGeometry(0,body,0), incline = flyeGeometry(0,body,30), decline = flyeGeometry(0,body,-15);
    expect(flat.joints.nk[1]).toBe(flat.joints.hp[1]);
    expect(incline.joints.nk[1]).toBeLessThan(incline.joints.hp[1]);
    expect(decline.joints.nk[1]).toBeGreaterThan(decline.joints.hp[1]);
    expect(flat.joints.an[1]).toBe(96); expect(incline.joints.an[1]).toBe(96);
    expect(decline.joints.an[1]).toBeLessThan(decline.joints.hp[1]);
    const entry = entries.find(e=>e.movementId===178);
    const prims = layoutCanonicalFigure(entry.frames[0].joints,{...entry,body});
    expect(prims.filter(p=>p.kind==='bone' && p.w===4.4 && p.color==='textMid')).toHaveLength(1);
  }
});

test('flye scalar crosses the actual app boundary and malformed data fails', () => {
  for (const entry of entries) {
    expect(buildPreviewEntry({...entry,status:'covered'}).frameData.frames[0].joints.fo).toBe(0);
    expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
    const bad = JSON.parse(JSON.stringify(entry)); bad.frames[0].joints.fo='bad';
    expect(()=>buildPreviewEntry({...bad,status:'covered'})).toThrow('bad canonical fo');
  }
});
