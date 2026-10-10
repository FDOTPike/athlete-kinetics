// Actual rendered RN View bounds, including the FINITE rounded pad ends.
// A component contract probe, not observed native-device playback.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { MovementPreview } from '../../src/components/movementPreview';
import { DUAL_BODY_PARAMETERS, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import * as manifest from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const cases=[143,49,178,220].map(id=>[id,'neutral']);
afterEach(()=>jest.restoreAllMocks());

test.each(cases)('%i/%s actual RN head touches its finite support capsule',async(id,bodyType)=>{
  const raw=previewManifest.entries.find(e=>e.movementId===id);
  const fixture=manifest.buildPreviewEntry({...raw,status:'covered'});
  jest.spyOn(manifest,'resolveMovementPreview').mockReturnValue(fixture);
  jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(false);
  render(<MovementPreview movement={{movement_id:id,name:raw.name,media:{assetKey:raw.assetKey,status:'ready'}}} bodyType={bodyType}/>);
  await act(async()=>{});
  const stage=screen.getByTestId('movement-preview-stage-canonical');
  const views=stage.children.filter(n=>typeof n==='object').map(n=>StyleSheet.flatten(n.props.style));
  const scale=Math.min(240/raw.viewBox[2],240/raw.viewBox[3]);
  const body=DUAL_BODY_PARAMETERS[bodyType];
  const head=views.find(s=>s.borderWidth===2.5*scale&&Math.abs(s.width-2*body.hr*scale)<1e-8&&s.width===s.height);
  expect(head).toBeDefined();
  const prims=layoutCanonicalFigure(raw.frames[0].joints,{...raw,body});
  const padPrim=prims.find(p=>p.kind==='bone'&&p.w===4&&(id===143?p.color==='textHi':p.color==='textMid'));
  expect(padPrim).toBeDefined();
  const length=Math.hypot(padPrim.x2-padPrim.x1,padPrim.y2-padPrim.y1)*scale;
  const pad=views.find(s=>Math.abs(s.width-length)<1e-8&&Math.abs(s.height-4*scale)<1e-8&&s.transform?.[0]?.rotate);
  expect(pad).toBeDefined();
  const angle=parseFloat(pad.transform[0].rotate)*Math.PI/180;
  const unit=[Math.cos(angle),Math.sin(angle)];
  const center=[pad.left+pad.width/2,pad.top+pad.height/2];
  const point=[head.left+head.width/2,head.top+head.height/2];
  const delta=point.map((v,i)=>v-center[i]);
  const halfCore=(pad.width-pad.height)/2;
  const along=Math.max(-halfCore,Math.min(halfCore,delta[0]*unit[0]+delta[1]*unit[1]));
  const distance=Math.hypot(delta[0]-along*unit[0],delta[1]-along*unit[1]);
  expect(Math.abs(distance-pad.height/2-head.width/2)).toBeLessThan(1e-8);
});
