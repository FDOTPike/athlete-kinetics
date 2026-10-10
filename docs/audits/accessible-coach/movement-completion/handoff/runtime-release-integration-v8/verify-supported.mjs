import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
const root='C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App';
const base='C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion';const out=base+'/runtime-release-integration-v8';
const hash=b=>createHash('sha256').update(b).digest('hex');
const sharp=(await import(pathToFileURL(root+'/node_modules/sharp/lib/index.js'))).default;
const svg=await import(pathToFileURL(root+'/tools/rendering/lib/canonicalSvg.mjs'));const der=await import(pathToFileURL(root+'/tools/rendering/lib/derivation.mjs'));const data=await import(pathToFileURL(root+'/tools/rendering/lib/previewData.mjs'));
const fig=await svg.loadCanonicalFigure({root,buildDir:out+'/fresh-figure'});const d=await der.loadDerivation({root,buildDir:out+'/fresh-derivation'});
const errors=[],cacheChecks=[];
for(const [fresh,cached]of[['fresh-figure/canonicalFigure.js','tools/rendering/.build/canonicalFigure.js'],['fresh-derivation/canonicalFigure.js','tools/rendering/.build-derivation/canonicalFigure.js'],['fresh-derivation/derivation.js','tools/rendering/.build-derivation/derivation.js']]){
 const present=fs.existsSync(root+'/'+cached),same=present?hash(fs.readFileSync(out+'/'+fresh))===hash(fs.readFileSync(root+'/'+cached)):null;cacheChecks.push({fresh,cached,present,same});if(present&&!same)errors.push({type:'cache',cached});
}
const evidence=JSON.parse(fs.readFileSync(base+'/evidence-release-integration-v8/cycle_evidence.json','utf8'));
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(head!=='1185f0d0d6eb91b482afe60af4a0bf8173ba8c06'||head!==evidence.sourceCommit||!evidence.sourcesCommittedAtRender||data.previewDataDigest()!==evidence.previewDataSha256)errors.push({type:'source-identity'});
for(const [file,digest]of Object.entries(evidence.sourceHashes)){
 if(hash(fs.readFileSync(root+'/'+file))!==digest||hash(execFileSync('git',['show',head+':'+file],{cwd:root}))!==digest)errors.push({type:'source-hash',file});
}
const entries=der.deriveEntries(data.loadPreviewManifest().entries,d),motions=[];
const oldFig=await import(pathToFileURL(base+'/runtime-native-support-v7/fresh-figure/canonicalFigure.js'));const poseEngineDifferences=[],unchangedPrimitiveDifferences=[],intentionalSupportPrimitiveDifferences=[];
for(const m of evidence.movements){const e=entries.find(e=>e.movementId===m.id);const segs=fig.segmentDurations(e.frames.length,e.segmentDurationsMs),total=segs.reduce((a,b)=>a+b,0);const ticks=[...Array.from({length:Math.ceil(total/33)},(_,i)=>i*33),total];
 if(e.assetKey!==m.assetKey||JSON.stringify(e.viewBox)!==JSON.stringify(m.viewBox))errors.push({type:'movement-identity',id:m.id});
 let radiusVariation=0,upperVariation=0,maxBearingTick=0,maxAnchorShift=0,checked=0,maxBoundaryDelta=0,worldProjectionError=0,minSignedCurl=180,maxSignedCurl=-180,maxGripCenterError=0,maxRopeBranchError=0,maxFlexionScalarError=0,maxTautAlignmentError=0,maxStraightArmError=0,maxFlyeBendError=0,maxFlyePlaneError=0,maxLoadLengthError=0,maxLoadCentreError=0,maxLoadOrthogonalError=0,maxWorkingLegRadiusError=0,maxSoftKneeError=0,maxAnkleCuffError=0,maxWorkingLegBearingTick=0;
 for(const record of m.records){const body=fig.DUAL_BODY_PARAMETERS[record.body],vb=e.viewBox,scale=Math.min(240/vb[2],240/vb[3]),width=Math.ceil(vb[2]*scale),height=Math.ceil(vb[3]*scale);const frames=[];let lastAngle=null,lastLegAngle=null;
 const first=fig.resolveFigureJoints(e.frames[0].joints,{...e,body});
 for(const time of ticks){const pose=fig.poseAtTime(e.frames.map(f=>f.joints),time,e.segmentDurationsMs),opts={...e,body,implementTiltWeight:fig.peakWeightAtTime(e.frames,e.frameRoles,time,e.segmentDurationsMs)};const j=fig.resolveFigureJoints(pose,opts),prims=fig.layoutCanonicalFigure(pose,opts);checked++;
  if(m.id!==52){const oldPose=oldFig.poseAtTime(e.frames.map(f=>f.joints),time,e.segmentDurationsMs);if(JSON.stringify(oldPose)!==JSON.stringify(pose))poseEngineDifferences.push({id:m.id,body:record.body,time});const oldPrims=oldFig.layoutCanonicalFigure(oldPose,opts);if(JSON.stringify(oldPrims)!==JSON.stringify(prims))unchangedPrimitiveDifferences.push({id:m.id,body:record.body,time});}
  if(prims.some(p=>Object.values(p).some(v=>typeof v==='number'&&!Number.isFinite(v))))errors.push({type:'non-finite',id:m.id,time});
  if(m.id===143||[80,262,292,264,49,178,220].includes(m.id)){
   const push=[80,262,292].includes(m.id),straight=m.id===264,fly=[49,178,220].includes(m.id),world=fly?fig.flyeGeometry(pose.fo,body,m.id===178?-15:m.id===220?30:0):straight?fig.straightArmPulldownGeometry(pose.sa,body):push?fig.pushdownGeometry(pose.pe,body,m.id===292):fig.supportedRearRaiseGeometry(pose.ra,body),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
   for(const [arm,keys]of [[world.near,['nArm','el','wr']],[world.far,['fArm','ef','wf']]]){
    const {shoulder,elbow,wrist}=arm.world;radiusVariation=Math.max(radiusVariation,Math.abs(distance(elbow,wrist)-12));upperVariation=Math.max(upperVariation,Math.abs(distance(shoulder,elbow)-12.5));
    for(const [point,key]of [[shoulder,keys[0]],[elbow,keys[1]],[wrist,keys[2]]]){
     const expected=fly?[43+point[0]*Math.cos(35*Math.PI/180)-point[2]*Math.sin(35*Math.PI/180),67-point[1]]:straight?[49+point[0]*Math.cos(20*Math.PI/180)-point[2]*Math.sin(20*Math.PI/180),31-point[1]]:push?[45.3+point[0]*Math.sqrt(3)/2-point[2]/2,27.6-point[1]]:[60+(point[0]-point[2])*Math.SQRT1_2,55-point[1]];
     worldProjectionError=Math.max(worldProjectionError,Math.hypot(j[key][0]-expected[0],j[key][1]-expected[1]));
    }
    if(!push&&!straight&&!fly&&[shoulder,elbow,wrist].some(p=>Math.abs(p[0])>1e-7))errors.push({type:'world-lateral-plane',id:m.id,time});
    if(fly){const subtract=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),incline=(m.id===178?-15:m.id===220?30:0)*Math.PI/180,trunk=[Math.cos(incline),Math.sin(incline),0],upper=subtract(elbow,shoulder),fore=subtract(wrist,elbow),shaft=arm.world.shaft;
     maxFlyeBendError=Math.max(maxFlyeBendError,Math.abs(Math.acos(Math.max(-1,Math.min(1,dot(upper,fore)/150)))*180/Math.PI-15));
     maxFlyePlaneError=Math.max(maxFlyePlaneError,Math.abs(dot(upper,trunk)),Math.abs(dot(fore,trunk)));
     maxLoadLengthError=Math.max(maxLoadLengthError,Math.abs(distance(shaft[0],shaft[1])-10));
     maxLoadCentreError=Math.max(maxLoadCentreError,distance(shaft[0].map((v,i)=>(v+shaft[1][i])/2),wrist));
     maxLoadOrthogonalError=Math.max(maxLoadOrthogonalError,Math.abs(dot(subtract(shaft[1],shaft[0]),fore)));
    }
    if(straight){maxStraightArmError=Math.max(maxStraightArmError,Math.abs(distance(shoulder,wrist)-24.5));}
    if(push){const flexion=Math.acos(Math.max(-1,Math.min(1,(elbow[1]-wrist[1])/12)))*180/Math.PI;maxFlexionScalarError=Math.max(maxFlexionScalarError,Math.abs(flexion-pose.pe));
     if(m.id===292)maxRopeBranchError=Math.max(maxRopeBranchError,Math.abs(distance(world.junction.world,wrist)-12));
     if(Math.abs(shoulder[0]-elbow[0])>1e-7||Math.abs(shoulder[2]-elbow[2])>1e-7)errors.push({type:'unpinned-upper-arm',id:m.id,time});
    }
   }
   if(m.id===292||straight){
    const jWorld=world.junction.world,pWorld=world.pulley.world;
    const unit=v=>v.map(x=>x/Math.hypot(...v)),minus=(a,b)=>a.map((v,i)=>v-b[i]);
    const ta=unit(minus(world.near.world.wrist,jWorld)),tb=unit(minus(world.far.world.wrist,jWorld)),main=unit(minus(pWorld,jWorld)),resultant=ta.map((v,i)=>v+tb[i]);
    const cross=[resultant[1]*main[2]-resultant[2]*main[1],resultant[2]*main[0]-resultant[0]*main[2],resultant[0]*main[1]-resultant[1]*main[0]];
    maxTautAlignmentError=Math.max(maxTautAlignmentError,Math.hypot(...cross));
    if(resultant.reduce((sum,v,i)=>sum+v*main[i],0)>=0)errors.push({type:'rope-resultant-direction',id:m.id,time});
    for(const arm of [world.near,world.far])maxRopeBranchError=Math.max(maxRopeBranchError,Math.abs(distance(world.junction.world,arm.world.wrist)-12));
   }
   if(push||straight){const center=m.id===292||straight?world.junction.projected:[(j.wr[0]+j.wf[0])/2,(j.wr[1]+j.wf[1])/2],cables=prims.filter(p=>p.kind==='bone'&&p.w===1.4&&p.color==='textMid'),pulley=straight?[88,4]:[84,10];
    if(cables.length!==1)errors.push({type:'high-cable-count',id:m.id,time});else maxGripCenterError=Math.max(maxGripCenterError,Math.hypot(cables[0].x1-pulley[0],cables[0].y1-pulley[1]),Math.hypot(cables[0].x2-center[0],cables[0].y2-center[1]));
   }
  }else{
   const radius=Math.hypot(j.wr[0]-j.el[0],j.wr[1]-j.el[1]),upper=Math.hypot(j.el[0]-j.nArm[0],j.el[1]-j.nArm[1]);radiusVariation=Math.max(radiusVariation,Math.abs(radius-12));upperVariation=Math.max(upperVariation,Math.abs(upper-12.5));
  }
  if(m.id===84){const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),upper=[j.kn[0]-j.nLeg[0],j.kn[1]-j.nLeg[1]],lower=[j.an[0]-j.kn[0],j.an[1]-j.kn[1]];
   maxWorkingLegRadiusError=Math.max(maxWorkingLegRadiusError,Math.abs(distance(j.nLeg,j.kn)-22.25),Math.abs(distance(j.kn,j.an)-22.25));
   maxSoftKneeError=Math.max(maxSoftKneeError,Math.abs(Math.acos(Math.max(-1,Math.min(1,(upper[0]*lower[0]+upper[1]*lower[1])/(22.25**2))))*180/Math.PI-5));
   const cuffs=prims.filter(p=>p.kind==='bone'&&p.w===2.2&&p.color==='textMid'),cables=prims.filter(p=>p.kind==='bone'&&p.w===1.4&&p.color==='textMid');
   if(cuffs.length!==1||cables.length!==1)errors.push({type:'ankle-cuff-cable-count',id:m.id,time});else maxAnkleCuffError=Math.max(maxAnkleCuffError,distance([(cuffs[0].x1+cuffs[0].x2)/2,(cuffs[0].y1+cuffs[0].y2)/2],j.an),distance([cables[0].x2,cables[0].y2],j.an),distance([cables[0].x1,cables[0].y1],[84,89]));
   for(const key of ['hd','nk','hp','el','wr','ef','wf','fLeg','kf','af'])if(distance(j[key],first[key])>1e-7)errors.push({type:'kickback-stationary-anchor',id:m.id,time,key});
  }
  if(m.id===84){const legAngle=Math.atan2(j.an[1]-j.kn[1],j.an[0]-j.kn[0]);if(lastLegAngle!==null)maxWorkingLegBearingTick=Math.max(maxWorkingLegBearingTick,Math.abs(Math.atan2(Math.sin(legAngle-lastLegAngle),Math.cos(legAngle-lastLegAngle)))*180/Math.PI);lastLegAngle=legAngle;}
  const angle=Math.atan2(j.wr[1]-j.el[1],j.wr[0]-j.el[0])*180/Math.PI;if(lastAngle!==null){const delta=(angle-lastAngle)*Math.PI/180;maxBearingTick=Math.max(maxBearingTick,Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI));}lastAngle=angle;
  if([92,158,253].includes(m.id))for(const [root,elbow,wrist]of [[j.nArm,j.el,j.wr],[j.fArm,j.ef,j.wf]]){
   const u=elbow.map((v,i)=>v-root[i]),v=wrist.map((v,i)=>v-elbow[i]);const flexion=-Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])*180/Math.PI;
   minSignedCurl=Math.min(minSignedCurl,flexion);maxSignedCurl=Math.max(maxSignedCurl,flexion);if(flexion<10-1e-7||flexion>150+1e-7)errors.push({type:'signed-curl',id:m.id,time,flexion});
  }
  if([82,138,163,92,158].includes(m.id)){
   const shafts=prims.filter(p=>p.kind==='bone'&&p.w===1.6&&p.color==='textHi'),center=[(j.wr[0]+j.wf[0])/2,(j.wr[1]+j.wf[1])/2];
   if(shafts.length!==1)errors.push({type:'shared-bar-count',id:m.id,time});else maxGripCenterError=Math.max(maxGripCenterError,Math.hypot((shafts[0].x1+shafts[0].x2)/2-center[0],(shafts[0].y1+shafts[0].y2)/2-center[1]));
   if([163,158].includes(m.id)){const cables=prims.filter(p=>p.kind==='bone'&&p.w===1.4&&p.color==='textMid');if(cables.length!==1)errors.push({type:'center-cable-count',id:m.id,time});else maxGripCenterError=Math.max(maxGripCenterError,Math.hypot(cables[0].x2-center[0],cables[0].y2-center[1]));}
  }
  for(const k of (m.id===52?['an']:m.id===84?['hd','nk','hp','kf','af']:['hd','nk','hp','kn','an','kf','af']))if(j[k]&&first[k])maxAnchorShift=Math.max(maxAnchorShift,Math.hypot(j[k][0]-first[k][0],j[k][1]-first[k][1]));
  frames.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${svg.ROLE_HEX.ink1}"/>${prims.map(p=>svg.primToSvg(p,vb,scale)).join('')}</svg>`);
 }
 const dir=base+'/evidence-release-integration-v8/movement-'+m.id,html=fs.readFileSync(dir+'/'+record.body+'-cycle.html','utf8');const start=html.indexOf('const frames=')+13,end=html.indexOf(',times=',start);const embedded=JSON.parse(html.slice(start,end));
 if(hash(JSON.stringify(frames))!==record.primitiveFramesSha256||hash(JSON.stringify(embedded))!==record.primitiveFramesSha256||record.tickCount!==ticks.length||record.totalMs!==total)errors.push({type:'frame-source-rebuild',id:m.id,body:record.body});
 if(hash(fs.readFileSync(dir+'/'+record.body+'-cycle.png'))!==record.sheetSha256||hash(Buffer.from(html))!==record.htmlSha256)errors.push({type:'cycle-artifact-hash',id:m.id,body:record.body});
 const sampled=Array.from({length:12},(_,i)=>Math.round(i*(ticks.length-1)/11)),cellHeight=height+24;
 const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="${width*6}" height="${cellHeight*2}"><rect width="100%" height="100%" fill="${svg.ROLE_HEX.ink1}"/>${sampled.map((i,index)=>`<g transform="translate(${index%6*width} ${Math.floor(index/6)*cellHeight})">${frames[i].replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}<text x="4" y="${height+16}" fill="${svg.ROLE_HEX.textMid}" font-family="sans-serif" font-size="12">${ticks[i]}ms</text></g>`).join('')}</svg>`;
 const freshPng=await sharp(Buffer.from(sheet)).png().toBuffer();
 if(hash(freshPng)!==record.sheetSha256)errors.push({type:'cycle-png-source-rebuild',id:m.id,body:record.body});
 let at=0;for(const segment of segs){at+=segment;
  const before=fig.resolveFigureJoints(fig.poseAtTime(e.frames.map(f=>f.joints),Math.max(0,at-.001),segs),{...e,body});
  const after=fig.resolveFigureJoints(fig.poseAtTime(e.frames.map(f=>f.joints),Math.min(total,at+.001),segs),{...e,body});
  for(const key of ['nArm','fArm','el','ef','wr','wf'])maxBoundaryDelta=Math.max(maxBoundaryDelta,Math.hypot(before[key][0]-after[key][0],before[key][1]-after[key][1]));
 }
 }
 if(radiusVariation>1e-7||upperVariation>1e-7||maxAnchorShift>1e-7||maxBoundaryDelta>.001||worldProjectionError>1e-7||maxGripCenterError>1e-7||maxRopeBranchError>1e-7||maxFlexionScalarError>1e-5||maxTautAlignmentError>1e-10||maxStraightArmError>1e-7||maxFlyeBendError>1e-5||maxFlyePlaneError>1e-7||maxLoadLengthError>1e-7||maxLoadCentreError>1e-7||maxLoadOrthogonalError>1e-7||maxWorkingLegRadiusError>1e-7||maxSoftKneeError>1e-5||maxAnkleCuffError>1e-7)errors.push({type:'rig-invariant',id:m.id,radiusVariation,upperVariation,maxAnchorShift,maxBoundaryDelta,worldProjectionError,maxGripCenterError,maxRopeBranchError,maxFlexionScalarError,maxTautAlignmentError,maxStraightArmError,maxFlyeBendError,maxFlyePlaneError,maxLoadLengthError,maxLoadCentreError,maxLoadOrthogonalError,maxWorkingLegRadiusError,maxSoftKneeError,maxAnkleCuffError,maxWorkingLegBearingTick});
 motions.push({id:m.id,assetKey:e.assetKey,checked,radiusVariation,upperVariation,maxBearingTick,maxAnchorShift,maxBoundaryDelta,worldProjectionError,maxGripCenterError,maxRopeBranchError,maxFlexionScalarError,maxTautAlignmentError,maxStraightArmError,maxFlyeBendError,maxFlyePlaneError,maxLoadLengthError,maxLoadCentreError,maxLoadOrthogonalError,maxWorkingLegRadiusError,maxSoftKneeError,maxAnkleCuffError,maxWorkingLegBearingTick,minSignedCurl:[92,158,253].includes(m.id)?minSignedCurl:null,maxSignedCurl:[92,158,253].includes(m.id)?maxSignedCurl:null});
}
const previous=JSON.parse(fs.readFileSync(base+'/evidence-native-support-v7/cycle_evidence.json','utf8'));
const priorCycleMatches=[];
for(const id of [143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84])for(const body of ['neutral','male','female']){
 const before=previous.movements.find(m=>m.id===id).records.find(r=>r.body===body),after=evidence.movements.find(m=>m.id===id).records.find(r=>r.body===body);
 const same=before.primitiveFramesSha256===after.primitiveFramesSha256&&before.totalMs===after.totalMs&&before.tickCount===after.tickCount&&before.sheetSha256===after.sheetSha256&&before.htmlSha256===after.htmlSha256;priorCycleMatches.push({id,body,same});if(!same)errors.push({type:'prior-cycle-identity',id,body});// All SVG paint changed deliberately to inside borders; compare geometry/engine separately.
}
const priorFiles=execFileSync('git',['ls-tree','-r','--name-only','510127dd54798ad7963139908a2207e73531d119','--','apps/mobile/src/components/movementPreview/families'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const priorEntries=priorFiles.flatMap(file=>JSON.parse(execFileSync('git',['show','510127dd54798ad7963139908a2207e73531d119:'+file],{cwd:root,encoding:'utf8'})).entries),currentEntries=data.loadPreviewManifest().entries;
const geometry=e=>JSON.stringify({view:e.view,viewBox:e.viewBox,durations:e.segmentDurationsMs,joints:e.frames?.map(f=>f.joints),derivesFrom:e.derivesFrom,jointOffsets:e.jointOffsets,gripDelta:e.gripDelta,implementCount:e.implementCount,implementOrientation:e.implementOrientation,bodyTurnDeg:e.bodyTurnDeg,implementScale:e.implementScale});
const priorGeometryChanges=priorEntries.filter(e=>geometry(e)!==geometry(currentEntries.find(n=>n.movementId===e.movementId)??{})).map(e=>e.movementId);
if(priorGeometryChanges.length)errors.push({type:'prior-source-geometry-change',ids:priorGeometryChanges});
const paths=data.previewDataPaths(),sourceBytes=paths.map(file=>({file:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size}));
const budgets={rawBytes:sourceBytes.reduce((a,b)=>a+b.bytes,0),gzipBytes:gzipSync(Buffer.concat(paths.map(file=>fs.readFileSync(file)))).length,maxFamilyBytes:Math.max(...sourceBytes.slice(1).map(f=>f.bytes)),limits:data.PREVIEW_BUDGETS};
if(budgets.rawBytes>budgets.limits.rawBytes||budgets.gzipBytes>budgets.limits.gzipBytes||budgets.maxFamilyBytes>budgets.limits.familyBytes)errors.push({type:'source-storage-budget',budgets});
if(poseEngineDifferences.length||unchangedPrimitiveDifferences.length)errors.push({type:'prior-production-engine-or-geometry',poseDifferences:poseEngineDifferences.length,primitiveDifferences:unchangedPrimitiveDifferences.length});
const result={head,previewDataSha256:data.previewDataDigest(),cacheChecks,motions,poseEngineDifferences,unchangedPrimitiveDifferences,intentionalSupportPrimitiveDifferences,priorCycleMatches,priorEntriesChecked:priorEntries.length,priorGeometryChanges,budgets,errors,pass:errors.length===0};fs.writeFileSync(out+'/supported-math-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({head,result:result.pass,draws:motions.reduce((a,m)=>a+m.checked,0),cycles:evidence.movements.reduce((a,m)=>a+m.records.length,0),priorEntriesChecked:priorEntries.length,priorCycleMatches:priorCycleMatches.length,errors,budgets},null,2));if(errors.length)process.exitCode=1;
