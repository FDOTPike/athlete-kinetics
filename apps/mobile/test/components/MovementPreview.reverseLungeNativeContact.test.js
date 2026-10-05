/** Actual RN style regression, hypothetical covered fixture; no approval. */
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { MovementPreview } from '../../src/components/movementPreview';
import * as manifest from '../../src/components/movementPreview/manifest';
import { DUAL_BODY_PARAMETERS } from '../../src/components/movementPreview/canonicalFigure';
import { resetPreviewPlayback, isPlaybackActive } from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';
import { previewManifest } from './previewManifest';
const raw=previewManifest.entries.find(e=>e.movementId===52);
const fixture=manifest.buildPreviewEntry({...raw,status:'covered'});
const subject={movement_id:52,media:{assetKey:raw.assetKey,status:'ready'}};
const near=(a,b)=>Math.abs(a-b)<1e-7;

beforeEach(()=>{
  jest.useFakeTimers();resetPreviewPlayback();
  jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(manifest,'resolveMovementPreview').mockImplementation(()=>fixture);
});
afterEach(()=>{cleanup();jest.useRealTimers();jest.restoreAllMocks();resetPreviewPlayback();});

test.each(['neutral'])('52 actual rounded RN feet contact the native ground after landing (%s)',async bodyName=>{
  const body=DUAL_BODY_PARAMETERS[bodyName],scale=Math.min(240/raw.viewBox[2],240/raw.viewBox[3]);
  render(<MovementPreview movement={subject} bodyType={bodyName} reducedMotion={true}/>);
  await act(async()=>{});
  for(let frame=0;frame<fixture.frames.length;frame++){
    const styles=React.Children.toArray(screen.getByTestId('movement-preview-stage-canonical').props.children).map(c=>StyleSheet.flatten(c.props.style));
    const floor=styles.find(s=>s.height===1&&s.right===0&&s.backgroundColor===theme.color.line);
    const feet=styles.filter(s=>s.transform&&near(s.height,body.lw*.9*scale)&&near(s.width,5.4*scale));
    expect(feet).toHaveLength(2);
    for(const foot of feet){
      const theta=parseFloat(foot.transform.find(t=>t.rotate!==undefined).rotate)*Math.PI/180;
      const r=Math.min(foot.borderRadius,foot.width/2,foot.height/2);
      // Support of a finite rounded rectangle; an endpoint plus radius proxy
      // misses the inset cap centre when the rear foot rotates onto the toes.
      const bottom=foot.top+foot.height/2+(foot.width/2-r)*Math.abs(Math.sin(theta))+(foot.height/2-r)*Math.abs(Math.cos(theta))+r;
      const gap=floor.top-bottom;
      expect(gap).toBeGreaterThanOrEqual(-.05);expect(Math.abs(gap)).toBeLessThan(.05);
    }
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    act(()=>jest.runAllTicks());expect(jest.getTimerCount()).toBe(0);expect(isPlaybackActive()).toBe(false);
  }
});
