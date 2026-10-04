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
const ids=[143,49,178,220],bodies=['neutral','male','female'];
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

const fs=require('node:fs');const contactMeasurements=[];
test.each(cases)('support %i actual RN head circle contacts finite rounded pad (%s)',async(id,bodyName)=>{
 const entry=fixtures.get(id),body=DUAL_BODY_PARAMETERS[bodyName],vb=entry.frameData.viewBox,scale=Math.min(240/vb[2],240/vb[3]);render(<MovementPreview movement={subject(id)} bodyType={bodyName} reducedMotion={true}/>);await act(async()=>{});
 const all=styles(),pad=boneStyles(4*scale).find(s=>s.backgroundColor===(id===143?theme.color.textHi:theme.color.textMid)),head=all.find(s=>!s.transform&&near(s.width,2*body.hr*scale)&&s.borderColor===theme.color.textHi);expect(pad).toBeDefined();expect(head).toBeDefined();
 const h=center(head),p=center(pad),a=rad(rotation(pad)),dx=h[0]-p[0],dy=h[1]-p[1],along=dx*Math.cos(a)+dy*Math.sin(a),across=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)),halfCore=Math.max(0,(pad.width-pad.height)/2),tipBeyond=Math.max(0,Math.abs(along)-halfCore),closestDistance=Math.hypot(tipBeyond,across),gap=closestDistance-pad.height/2-head.width/2;
 const infinitePlaneGap=across-pad.height/2-head.width/2;contactMeasurements.push({id,body:bodyName,scale,gapDp:gap,infinitePlaneGapDp:infinitePlaneGap,tipBeyondDp:tipBeyond,head,pad});fs.writeFileSync('C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion/runtime-release-integration-v8/head-support-measurements.json',JSON.stringify(contactMeasurements,null,2));noPlayback();expect(Math.abs(gap)).toBeLessThan(.05);
});
