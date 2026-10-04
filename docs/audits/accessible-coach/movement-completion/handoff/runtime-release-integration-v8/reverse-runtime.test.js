/** Independent actual-RN evidence. Hypothetical covered fixtures only. */
const React=require('react');
const testing=require('@testing-library/react-native');
const {render,act,fireEvent,cleanup}=testing;
const screen=new Proxy({}, {get:(_,key)=>testing.screen[key]});
const {AccessibilityInfo,AppState,StyleSheet}=require('react-native');
const root='C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App';
const {MovementPreview}=require(root+'/apps/mobile/src/components/movementPreview/MovementPreview');
const manifest=require(root+'/apps/mobile/src/components/movementPreview/manifest');
const coordinator=require(root+'/apps/mobile/src/components/movementPreview/playbackCoordinator');
const {DUAL_BODY_PARAMETERS}=require(root+'/apps/mobile/src/components/movementPreview/canonicalFigure');
const {theme}=require(root+'/apps/mobile/src/theme/theme');
const raw=require(root+'/apps/mobile/src/components/movementPreview/movementPreviewManifest.json');
const ids=[52],bodies=['neutral','male','female'];
const cases=ids.flatMap(id=>bodies.map(body=>[id,body]));
const fixtures=new Map([...ids,253,53].map(id=>[id,manifest.buildPreviewEntry({...raw.entries.find(e=>e.movementId===id),status:'covered'})]));
const subject=id=>({movement_id:id,name:fixtures.get(id).name,media:{assetKey:fixtures.get(id).assetKey,status:'ready'}});
const control=()=>screen.getByTestId('movement-preview-control');
const styles=()=>React.Children.toArray(screen.getByTestId('movement-preview-stage-canonical').props.children).map(c=>StyleSheet.flatten(c.props.style));
const drawing=()=>JSON.stringify(styles());
const rad=deg=>deg*Math.PI/180;
const rotation=s=>parseFloat(s.transform?.find(t=>t.rotate!==undefined)?.rotate??'0');
const center=s=>[s.left+s.width/2,s.top+s.height/2];
const near=(a,b)=>Math.abs(a-b)<1e-7;
const boneStyles=(height)=>styles().filter(s=>s.transform&&near(s.height,height));
const scalarAt=(entry,time,key)=>{
 let remaining=Math.min(time,totalFor(entry));
 for(let i=0;i<entry.frames.length-1;i++){const duration=entry.frameData.segmentDurationsMs[i];if(remaining<duration){const u=remaining/duration,ease=u<.5?2*u*u:1-2*(1-u)**2;return entry.frames[i].joints[key]+(entry.frames[i+1].joints[key]-entry.frames[i].joints[key])*ease;}remaining-=duration;}
 return entry.frames.at(-1).joints[key];
};
const totalFor=entry=>entry.frameData.segmentDurationsMs.reduce((sum,value)=>sum+value,0);
function noPlayback(){act(()=>jest.runAllTicks());expect(jest.getTimerCount()).toBe(0);expect(coordinator.isPlaybackActive()).toBe(false);}
function equalPoint(actual,expected){expect(actual[0]).toBeCloseTo(expected[0],8);expect(actual[1]).toBeCloseTo(expected[1],8);}
function equalPoints(actual,expected){expect(actual).toHaveLength(expected.length);actual.sort((a,b)=>a[0]-b[0]);expected.sort((a,b)=>a[0]-b[0]);actual.forEach((p,i)=>equalPoint(p,expected[i]));}
beforeEach(()=>{jest.useFakeTimers();coordinator.resetPreviewPlayback();jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(false);jest.spyOn(manifest,'resolveMovementPreview').mockImplementation(s=>fixtures.get(s?.movement_id)??null);});
afterEach(()=>{cleanup();jest.useRealTimers();jest.restoreAllMocks();});


// Direct actual View geometry; no production expected rig helper.
function endpoints(s){const a=rad(rotation(s)),c=center(s),d=[s.width/2*Math.cos(a),s.width/2*Math.sin(a)];return [[c[0]-d[0],c[1]-d[1]],[c[0]+d[0],c[1]+d[1]]];}
const samples=[];
function assertRig(id,bodyName,phase,time){
 const body=DUAL_BODY_PARAMETERS[bodyName],entry=fixtures.get(id),vb=entry.frameData.viewBox,scale=2.5,draws=styles(),floor=draws.find(s=>s.height===1&&s.right===0&&s.backgroundColor===theme.color.line),screenPoint=p=>[(p[0]-vb[0])*scale,(p[1]-vb[1])*scale];
 const step=phase<=1?phase:phase>=3?4-phase:1,lower=phase<=1||phase>=3?0:phase<=2?phase-1:3-phase,sole=96.9-body.lw*.9/2,stand=sole-44.5,hip=[48-20*step,stand+(58-stand)*step+10.4*lower],neck=[hip[0],hip[1]-24];
 let rearGap=0,frontGap=0;
 for(const nearSide of [true,false]){
  const opacity=nearSide?1:.9,role=nearSide?theme.color.textHi:theme.color.textLow,select=height=>boneStyles(height*scale).filter(s=>s.opacity===opacity&&s.backgroundColor===role),thigh=select(body.lw*1.18).find(s=>near(s.width,22.25*scale)),shin=select(body.lw*.9).find(s=>near(s.width,22.25*scale)),foot=select(body.lw*.9).find(s=>near(s.width,5.4*scale));
  expect(thigh).toBeDefined();expect(shin).toBeDefined();expect(foot).toBeDefined();
  const [root,knee]=endpoints(thigh),[knee2,ankle]=endpoints(shin),[heel,toe]=endpoints(foot);
  equalPoint(knee,knee2);equalPoint(ankle,heel);equalPoint(root,screenPoint(nearSide?hip:[hip[0]-body.hw*.5,hip[1]]));
  equalPoint(ankle,screenPoint(nearSide?[48,sole]:[48-body.hw*.5-42.25*step,sole-3.3*step-7*Math.sin(Math.PI*step)]));expect(knee[0]).toBeGreaterThanOrEqual((root[0]+ankle[0])/2-1e-7);
  const a=rad(rotation(foot)),r=Math.min(foot.borderRadius,foot.width/2,foot.height/2),paintedBottom=center(foot)[1]+(foot.width/2-r)*Math.abs(Math.sin(a))+(foot.height/2-r)*Math.abs(Math.cos(a))+r,gap=floor.top-paintedBottom;
  expect(gap).toBeGreaterThanOrEqual(-.05);if(nearSide){expect(Math.abs(gap)).toBeLessThan(.05);frontGap=gap;}else rearGap=gap;
  const armUpper=select(body.lw*.88).find(s=>near(s.width,12.5*scale)),forearm=select(body.lw*.72).find(s=>near(s.width,12*scale));expect(armUpper).toBeDefined();expect(forearm).toBeDefined();
  const [shoulder,elbow]=endpoints(armUpper),[elbow2,wrist]=endpoints(forearm);equalPoint(elbow,elbow2);equalPoint(shoulder,screenPoint([neck[0]+(nearSide?1:-1)*body.sw*.58,neck[1]]));expect(elbow[0]).toBeCloseTo(wrist[0],8);
  const shafts=select(2.2).filter(s=>near(s.width,10*scale));expect(shafts).toHaveLength(1);equalPoint(center(shafts[0]),wrist);expect(Math.sin(rad(rotation(shafts[0])))).toBeCloseTo(0,8);
  const plateColor=nearSide?theme.color.textMid:theme.color.textLow,plates=boneStyles(4.6*scale).filter(s=>s.opacity===opacity&&s.backgroundColor===plateColor&&near(s.width,4.6*scale));expect(plates).toHaveLength(2);equalPoints(plates.map(center),[[wrist[0]-5*scale,wrist[1]],[wrist[0]+5*scale,wrist[1]]]);
  const shaftIndex=draws.findIndex(s=>s===shafts[0]),headIndex=draws.findIndex(s=>!s.transform&&near(s.width,2*body.hr*scale)&&s.borderColor===theme.color.textHi);expect(headIndex).toBeGreaterThan(0);if(nearSide)expect(shaftIndex).toBeGreaterThan(headIndex);else expect(shaftIndex).toBeLessThan(headIndex);
 }
 samples.push({body:bodyName,time,phase,frontGapDp:frontGap,rearGapDp:rearGap,heelLiftExpected:phase>0&&phase<1||phase>3&&phase<4,rearToeContactExpected:phase>=1&&phase<=3});
}
test.each(cases)('52 actual drawn leg lengths, loads and front contact remain coherent through a closed cycle (%s)',async(id,body)=>{
 const entry=fixtures.get(id),total=totalFor(entry),view=render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={false} singleCycle={true}/>);await act(async()=>{});const first=drawing();noPlayback();fireEvent.press(control());
 for(let t=0;t<=total;t+=33){assertRig(id,body,scalarAt(entry,t,'rl'),t);act(()=>jest.advanceTimersByTime(33));}
 expect(control()).toHaveTextContent('REPLAY');expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 6 of 6');expect(drawing()).toEqual(first);noPlayback();act(()=>jest.advanceTimersByTime(30000));expect(drawing()).toEqual(first);view.unmount();
});
test.each(cases)('52 reduced-motion exact geometry, captions and wrap stay timer-free (%s)',async(id,body)=>{
 const entry=fixtures.get(id);render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={true}/>);await act(async()=>{});const first=drawing();
 for(let i=0;i<entry.frames.length;i++){expect(control()).toHaveTextContent('NEXT POSITION');assertRig(id,body,entry.frames[i].joints.rl,'authored-'+i);expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(entry.frames[i].caption);expect(screen.getByTestId('movement-preview-figure').props.accessibilityLabel).toContain(entry.frames[i].caption);noPlayback();if(i===entry.frames.length-1)expect(drawing()).toEqual(first);fireEvent.press(control());}
 expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 6');expect(drawing()).toEqual(first);
});
test.each(cases)('reverse lunge %i pause/background/reduced-motion/identity/unmount cleanup (%s)',async(id,body)=>{
 let appStateChange;const remove=jest.fn();jest.spyOn(AppState,'addEventListener').mockImplementation((type,listener)=>{appStateChange=listener;return {remove};});
 const view=render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={false}/>);await act(async()=>{});noPlayback();
 fireEvent.press(control());act(()=>jest.advanceTimersByTime(264));const paused=drawing();fireEvent.press(control());expect(drawing()).toEqual(paused);noPlayback();act(()=>jest.advanceTimersByTime(1000));expect(drawing()).toEqual(paused);
 fireEvent.press(control());act(()=>jest.advanceTimersByTime(33));const held=drawing();act(()=>appStateChange('background'));expect(drawing()).toEqual(held);noPlayback();
 act(()=>appStateChange('active'));act(()=>jest.advanceTimersByTime(1000));expect(drawing()).toEqual(held);expect(control()).toHaveTextContent('PLAY');
 fireEvent.press(control());view.rerender(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={true}/>);expect(control()).toHaveTextContent('NEXT POSITION');noPlayback();
 view.rerender(<MovementPreview movement={subject(53)} bodyType={body} reducedMotion={false}/>);expect(control()).toHaveTextContent('PLAY');expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 6');noPlayback();
 fireEvent.press(control());view.rerender(<MovementPreview movement={{movement_id:99999}} bodyType={body} reducedMotion={false}/>);expect(screen.queryByTestId('movement-preview-control')).toBeNull();noPlayback();
 view.unmount();expect(remove).toHaveBeenCalledTimes(1);
});


test('52 rl is validated and real draft status stays pending',()=>{const source=raw.entries.find(e=>e.movementId===52);expect(source.status).toBe('pending');expect(fixtures.get(52).frames.map(f=>f.joints.rl)).toEqual([0,1,2,2,3,4]);const bad=JSON.parse(JSON.stringify(source));bad.frames[1].joints.rl='bad';expect(()=>manifest.buildPreviewEntry({...bad,status:'covered'})).toThrow('bad canonical rl');});
afterAll(()=>require('node:fs').writeFileSync('C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion/runtime-release-integration-v8/reverse-runtime-measurements.json',JSON.stringify(samples,null,2)+'\n'));
