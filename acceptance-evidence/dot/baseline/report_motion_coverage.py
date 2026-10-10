import argparse,collections,copy,hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parent/'athlete-kinetics'
# This offline inventory preserves historical source contracts and never changes approval states.
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p): return json.loads(p.read_text(encoding='utf-8'))
def require(ok,message):
 if not ok: raise ValueError(message)
def build(root):
 base=root/'docs/audits/accessible-coach/movement-completion'
 preview=root/'apps/mobile/src/components/movementPreview'
 mp=load(base/'ALL_300_MOTION_MAP.json'); historical=load(base/'ORDERED_BACKLOG.json')
 man=load(preview/'movementPreviewManifest.json'); index=load(preview/'previewIndex.json')
 require(sorted(r['id'] for r in mp['movements'])==list(range(1,301)),'Catalogue must contain exactly IDs1..300 once')
 entries={e['movementId']:e for e in man['entries']}
 require(len(entries)==len(man['entries']),'Duplicate authored movement identity')
 require(set(entries)<=set(range(1,301)),'Uncatalogued authored movement')
 require(set(entries)==set(index['movementOrder']),'Manifest/index coverage differs')
 require(man['techniqueReview']['status']=='pending' and index['techniqueReview']['status']=='pending','Global review gate changed without final evidence')
 original=set(i for f in historical['missing_169_by_family'] for i in f['ids'])
 require(len(original)==169,'Historical169 backlog must be preserved')
 families={slug:load(preview/'families'/f'{slug}.json') for slug in index['families']}
 carried={e['movementId']:e for f in families.values() for e in f['entries']}
 require(set(carried)==set(entries),'Split family coverage differs')
 for id,e in entries.items():
  projection=copy.deepcopy(e)
  if e.get('frames') and e.get('previewId') and e.get('summary'):
   projection.pop('coachingIntent',None)
   if 'derivesFrom' not in e:
    projection.pop('instructions',None); projection.pop('cues',None)
  require(projection==carried[id],f'Family bytes/content projection differs for{id}')
 rows=[]
 for r in mp['movements']:
  id=r['id']; e=entries.get(id); hold=r['motion']['source_hold_reason']
  if id==220: hold='Retained handoff hold: imported wrist rotation versus curated neutral-grip flye has no owner ratification.'
  if e: require(e['assetKey']==r['source']['asset_key'],f'Asset identity mismatch{id}')
  drawable=bool(e and (e.get('frames') or e.get('derivesFrom')))
  state='source_hold_with_draft' if hold and drawable else 'source_hold' if hold else 'authored_draft' if drawable else 'truthful_activity_fallback' if id==7 else 'prototype_exclusion_needs_authored_replacement' if id in (68,70) else 'missing_draft'
  rows.append(dict(id=id,name=r['name'],assetKey=r['source']['asset_key'],physicalFamily=r['motion']['physical_family'],coverageState=state,recordStatus=e.get('status') if e else None,drawable=drawable,originalMissing169=id in original,sourceHold=hold,sourceContractSha256=hashlib.sha256(json.dumps(r['source'],sort_keys=True,ensure_ascii=False).encode()).hexdigest(),sourceProvenance=r['source']['instructions_provenance'],previewFamily=index['movementFamily'].get(str(id)),previewAssetSha256=digest(preview/'families'/f"{index['movementFamily'][str(id)]}.json") if e else None,requiredViews=r['motion']['review_views'],reviewObligations=['exact final source technique review','exact final source runtime review','Android playback/accessibility/frame timing','iOS playback/accessibility/frame timing'],enabled=False))
 counts=dict(catalogue=len(rows),records=len(entries),drawable=sum(r['drawable'] for r in rows),recordStatuses=dict(collections.Counter(e['status'] for e in entries.values())),coverageStates=dict(collections.Counter(r['coverageState'] for r in rows)),originalMissingRemaining=sum(r['originalMissing169'] and not r['drawable'] for r in rows),sourceHolds=sum(bool(r['sourceHold']) for r in rows),enabled=0)
 paths=[base/'ALL_300_MOTION_MAP.json',base/'ORDERED_BACKLOG.json',preview/'movementPreviewManifest.json',preview/'previewIndex.json',preview/'canonicalFigure.ts',preview/'manifest.ts',preview/'MovementPreview.tsx',preview/'familyLoaders.ts',*sorted((preview/'families').glob('*.json'))]
 return dict(kind='source-bound engineering inventory; not technique or native acceptance',candidateCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),candidateTree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip(),sources={str(p.relative_to(root)).replace('\\','/'):digest(p) for p in paths},counts=counts,exclusionReassessment={str(i):next(r['coverageState'] for r in rows if r['id']==i) for i in (7,27,68,70,291)},nativeEvidence={'Android':'pending; no playback/accessibility/frame-timing capture bound to this candidate','iOS':'pending; Windows has no Xcode; unsigned CI build is separate from observed playback','owner4GBPhone':'deferred to Francis','AppleSigning':'owner pending'},movements=rows)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--root',type=pathlib.Path,default=root);parser.add_argument('--out',type=pathlib.Path);args=parser.parse_args()
 result=build(args.root)
 require(len(result['movements'])==300,'Coverage ledger size')
 if args.out:
  args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print(json.dumps(result['counts']))
