const React=require('react');
const testing=require('@testing-library/react-native');
const {render,act,fireEvent,cleanup}=testing;
const screen=new Proxy({}, {get:(_,key)=>testing.screen[key]});
const {AccessibilityInfo}=require('react-native');
const root=require('node:path').resolve(__dirname, '../../../..');
const {MovementPreview}=require(root+'/apps/mobile/src/components/movementPreview/MovementPreview');
const manifest=require(root+'/apps/mobile/src/components/movementPreview/manifest');
const {poseAtTime}=require(root+'/apps/mobile/src/components/movementPreview/canonicalFigure');
const coordinator=require(root+'/apps/mobile/src/components/movementPreview/playbackCoordinator');
const raw=require(root+'/apps/mobile/src/components/movementPreview/movementPreviewManifest.json');
const fixtureFor=id=>manifest.buildPreviewEntry({...raw.entries.find(e=>e.movementId===id),status:'covered'});
const fixtures=new Map([14,17].map(id=>[id,fixtureFor(id)]));
const subject=id=>({movement_id:id,name:fixtures.get(id)?.name,media:{assetKey:fixtures.get(id)?.assetKey,status:'ready'}});
const drawing=()=>JSON.stringify(React.Children.toArray(screen.getByTestId('movement-preview-stage-canonical').props.children).map(c=>c.props.style));
beforeEach(()=>{jest.useFakeTimers();coordinator.resetPreviewPlayback();jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(false);jest.spyOn(manifest,'resolveMovementPreview').mockImplementation(s=>fixtures.get(s?.movement_id)??null);});
afterEach(()=>{cleanup();jest.useRealTimers();jest.restoreAllMocks();});
test('pausing canonical playback preserves the currently visible interpolated drawing',async()=>{
 render(<MovementPreview movement={subject(14)} reducedMotion={false}/>);await act(async()=>{});
 fireEvent.press(screen.getByTestId('movement-preview-control'));
 act(()=>jest.advanceTimersByTime(264));const before=drawing();
 fireEvent.press(screen.getByTestId('movement-preview-control'));expect(drawing()).toEqual(before);
});
test('changing the movement in the same mounted slot starts the new movement still at position one',async()=>{
 const view=render(<MovementPreview movement={subject(14)} reducedMotion={false}/>);await act(async()=>{});
 fireEvent.press(screen.getByTestId('movement-preview-control'));act(()=>jest.advanceTimersByTime(660));
 view.rerender(<MovementPreview movement={subject(17)} reducedMotion={false}/>);
 expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('PLAY');
 expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 43');
 expect(coordinator.isPlaybackActive()).toBe(false);
});
test('a preview becoming uncovered releases its global playback claim',async()=>{
 const view=render(<MovementPreview movement={subject(14)} reducedMotion={false}/>);await act(async()=>{});
 fireEvent.press(screen.getByTestId('movement-preview-control'));
 view.rerender(<MovementPreview movement={{movement_id:99999}} reducedMotion={false}/>);
 expect(screen.queryByTestId('movement-preview-control')).toBeNull();expect(coordinator.isPlaybackActive()).toBe(false);
});
test('production poseAtTime reaches its authored final pose exactly at total duration',()=>{
 const e=fixtures.get(14);const frames=e.frames.map(f=>f.joints);const total=e.frameData.segmentDurationsMs.slice(0,frames.length-1).reduce((a,b)=>a+b,0);
 expect(poseAtTime(frames,total,e.frameData.segmentDurationsMs)).toEqual(frames.at(-1));
});
test('single-cycle canonical component stops on final authored pose and cleans its timer',async()=>{
 const e=fixtures.get(14);const view=render(<MovementPreview movement={subject(14)} reducedMotion={false}/>);await act(async()=>{});
 fireEvent.press(screen.getByTestId('movement-preview-control'));act(()=>jest.advanceTimersByTime(2000));
 expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 5 of 5');
 expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('REPLAY');expect(coordinator.isPlaybackActive()).toBe(false);
 const held=drawing();act(()=>jest.advanceTimersByTime(30000));expect(drawing()).toEqual(held);view.unmount();
});
