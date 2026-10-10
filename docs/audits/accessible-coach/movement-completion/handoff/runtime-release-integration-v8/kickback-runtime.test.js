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
const ids=[84],bodies=['neutral','male','female'];
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

// Independent analytic hip/knee action; no production expected-geometry helper.
function assertAttachment(id,bodyName,extension){
 const body=DUAL_BODY_PARAMETERS[bodyName],entry=fixtures.get(id),vb=entry.frameData.viewBox,scale=240/96,upper=rad(extension+2.5),lower=rad(extension-2.5),hip=[51.5,51.5],knee=[hip[0]-22.25*Math.sin(upper),hip[1]+22.25*Math.cos(upper)],ankle=[hip[0]-22.25*Math.sin(upper)-22.25*Math.sin(lower),hip[1]+22.25*Math.cos(upper)+22.25*Math.cos(lower)];
 const screenPoint=p=>[(p[0]-vb[0])*scale,(p[1]-vb[1])*scale];
 function assertBone(style,start,end){expect(style).toBeDefined();equalPoint(center(style),screenPoint([(start[0]+end[0])/2,(start[1]+end[1])/2]));expect(style.width).toBeCloseTo(Math.hypot(end[0]-start[0],end[1]-start[1])*scale,8);expect(rotation(style)).toBeCloseTo(Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI,8);}
 const thighs=boneStyles(body.lw*1.18*scale).filter(s=>s.opacity===1&&s.backgroundColor===theme.color.textHi),shins=boneStyles(body.lw*.9*scale).filter(s=>s.opacity===1&&s.backgroundColor===theme.color.textHi);expect(thighs).toHaveLength(1);expect(shins).toHaveLength(1);assertBone(thighs[0],hip,knee);assertBone(shins[0],knee,ankle);
 const cables=boneStyles(1.4*scale).filter(s=>s.backgroundColor===theme.color.textMid);expect(cables).toHaveLength(1);assertBone(cables[0],[84,89],ankle);
 const length=22.25,half=(body.lw*.9+1)/2,dx=-(ankle[1]-knee[1])/length*half,dy=(ankle[0]-knee[0])/length*half,cuffs=boneStyles(2.2*scale).filter(s=>s.backgroundColor===theme.color.textMid);expect(cuffs).toHaveLength(1);assertBone(cuffs[0],[ankle[0]-dx,ankle[1]-dy],[ankle[0]+dx,ankle[1]+dy]);
 const draws=styles(),cableIndex=draws.findIndex(s=>JSON.stringify(s)===JSON.stringify(cables[0])),legIndex=draws.findIndex(s=>JSON.stringify(s)===JSON.stringify(thighs[0])),cuffIndex=draws.findIndex(s=>JSON.stringify(s)===JSON.stringify(cuffs[0]));expect(cableIndex).toBeLessThan(legIndex);expect(cuffIndex).toBeGreaterThan(legIndex);
 const hands=draws.filter(s=>!s.transform&&near(s.width,2*body.lw*.44*scale)&&s.backgroundColor===theme.color.textHi);equalPoints(hands.map(center),[[79.5,31],[74.7,31]].map(screenPoint));
}
test.each(cases)('kickback %i pe reaches actual RN attachment across full return (%s)',async(id,body)=>{
 const entry=fixtures.get(id),total=totalFor(entry),view=render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={false} singleCycle={true}/>);await act(async()=>{});
 expect(entry.frameData.view).toBe('side');expect(control()).toHaveTextContent('PLAY');const first=drawing();noPlayback();
 fireEvent.press(control());expect(coordinator.isPlaybackActive()).toBe(true);
 for(let t=0;t<=total;t+=33){assertAttachment(id,body,scalarAt(entry,t,'ke'));act(()=>jest.advanceTimersByTime(33));}
 expect(control()).toHaveTextContent('REPLAY');expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 5 of 5');
 expect(drawing()).toEqual(first);noPlayback();const held=drawing();act(()=>jest.advanceTimersByTime(30000));expect(drawing()).toEqual(held);view.unmount();
});

test.each(cases)('kickback %i reduced-motion retains grip, caption and no timers (%s)',async(id,body)=>{
 const entry=fixtures.get(id);render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={true}/>);await act(async()=>{});const first=drawing();
 for(let i=0;i<entry.frames.length;i++){expect(control()).toHaveTextContent('NEXT POSITION');assertAttachment(id,body,entry.frames[i].joints.ke);
  expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(entry.frames[i].caption);expect(screen.getByTestId('movement-preview-figure').props.accessibilityLabel).toContain(entry.frames[i].caption);noPlayback();
  if(i===entry.frames.length-1)expect(drawing()).toEqual(first);fireEvent.press(control());}
 expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 5');expect(drawing()).toEqual(first);
});

test.each(cases)('kickback %i pause/background/reduced-motion/identity/unmount cleanup (%s)',async(id,body)=>{
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

test('84 ke validates at the real boundary and remains pending',()=>{
 const source=raw.entries.find(e=>e.movementId===84);expect(source.status).toBe('pending');expect(fixtures.get(84).frames.map(f=>f.joints.ke)).toEqual([0,12.5,25,25,0]);const bad=JSON.parse(JSON.stringify(source));bad.frames[0].joints.ke='bad';expect(()=>manifest.buildPreviewEntry({...bad,status:'covered'})).toThrow('bad canonical ke');
});
