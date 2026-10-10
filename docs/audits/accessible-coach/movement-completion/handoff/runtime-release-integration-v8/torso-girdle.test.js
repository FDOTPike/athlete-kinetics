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
const ids=[49,178,220],bodies=['neutral','male','female'];
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

test.each(cases)('flye %i actual drawn torso slices and shoulder bridge remain connected (%s)',async(id,bodyName)=>{
 const entry=fixtures.get(id),body=DUAL_BODY_PARAMETERS[bodyName],vb=entry.frameData.viewBox,scale=Math.min(240/vb[2],240/vb[3]),incline=rad(id===178?-15:id===220?30:0),neck=[43+24*Math.cos(incline)*Math.cos(rad(35)),67-24*Math.sin(incline)],hip=[43,67],spine=hip.map((v,k)=>v-neck[k]),length=Math.hypot(...spine),unit=spine.map(v=>v/length),normal=[-unit[1],unit[0]],thickness=Math.max(.6,length/32*1.6)*scale;
 const screenPoint=p=>[(p[0]-vb[0])*scale,(p[1]-vb[1])*scale];render(<MovementPreview movement={subject(id)} bodyType={bodyName} reducedMotion={true}/>);await act(async()=>{});
 for(let frame=0;frame<entry.frames.length;frame++){
  const slices=boneStyles(thickness).filter(s=>s.opacity===1&&s.backgroundColor===theme.color.textLow);expect(slices).toHaveLength(33);let end=0;
  slices.forEach((s,n)=>{const t=n/32,expected=neck.map((v,k)=>v+spine[k]*t);equalPoint(center(s),screenPoint(expected));expect(Math.cos(rad(rotation(s)))*unit[0]+Math.sin(rad(rotation(s)))*unit[1]).toBeCloseTo(0,8);const sw=body.sw*.58,expectedWidth=2*(sw+(Math.min(body.hw,sw*.9)-sw)*t)*scale;expect(s.width).toBeCloseTo(expectedWidth,8);const at=t*length*scale,lo=at-s.height/2,hi=at+s.height/2;expect(lo).toBeLessThanOrEqual(end+1e-7);end=Math.max(end,hi);});expect(end).toBeGreaterThanOrEqual(length*scale);
  const bridge=boneStyles(body.lw*.88*scale).filter(s=>s.opacity===1&&s.backgroundColor===theme.color.textLow);expect(bridge).toHaveLength(1);equalPoint(center(bridge[0]),screenPoint(neck));expect(bridge[0].width).toBeCloseTo(2*body.sw*.92*Math.sin(rad(35))*scale,8);expect(Math.sin(rad(rotation(bridge[0])))).toBeCloseTo(0,8);fireEvent.press(control());noPlayback();
 }
});
