import fs from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const out='acceptance-evidence/dot/technique-audit',evidencePath=out+'/initial-technique-evidence.json',d=JSON.parse(fs.readFileSync(evidencePath)),sha=x=>createHash('sha256').update(x).digest('hex');
const inspected=[...['neutral','male','female'].map(body=>`acceptance-evidence/dot/recheck52-cycles/movement-52/${body}-cycle.png`),...['app240','320px','390px'].map(size=>`acceptance-evidence/dot/recheck52-cards/dumbbell-reverse-lunge_neutral_${size}_sheet.png`),...[143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84].map(id=>`acceptance-evidence/dot/recheck52-cycles/movement-${id}/neutral-cycle.png`)];
for(const s of d.sourceHashes)if(sha(fs.readFileSync(s.path))!==s.diskSha256)throw Error('Candidate changed '+s.path);
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
if(git('rev-parse','HEAD')!==d.candidate.head||git('rev-parse','HEAD^{tree}')!==d.candidate.tree)throw Error('Identity changed');
d.imagesActuallyInspected=inspected.map(path=>({path,sha256:sha(fs.readFileSync(path)),observation:'Static headless sheet viewed using view_image; no live/native playback inferred'}));d.v7Limit='510127dd54798ad7963139908a2207e73531d119 unavailable locally; parent reports authorized remote fetch rejected upload-pack: not our ref. Historical V8 V7-preservation report remains provenance context; no independent V7 source rerun claimed.';
d.additionalRetainedHolds='ALL_300_MOTION_MAP.json continues to record source holds for138,163,253; preserve until source reconciliation. Existing220 imported wrist-rotation ambiguity and135/187 prone I/Y endpoints remain unresolved.';
d.sourceHashesAfter=d.sourceHashes.map(s=>({path:s.path,diskSha256:sha(fs.readFileSync(s.path))}));d.sourceFreezeReleased=true;d.probeSha256=sha(fs.readFileSync(out+'/probe-initial.mjs'));d.numericLogSha256=sha(fs.readFileSync(out+'/probe-initial.log'));d.kneeBeforeAfterSha256=sha(fs.readFileSync(out+'/rear-knee-before-after.json'));
fs.writeFileSync(evidencePath,JSON.stringify(d,null,2)+'\n');
const h=p=>d.sourceHashes.find(s=>s.path===p).diskSha256,table=d.repair.map(r=>`| ${r.body} | ${r.old1185SupportedGapApp240Dp.toFixed(6)} | ${r.maxAbsoluteSupportedGapCanonical.toExponential(6)} | ${r.minRearKneeConservativeEnvelopeGapCanonical.toFixed(12)} |`).join('\n');
const report=`# Independent initial technique audit

**Verdict: INCOMPLETE for technique/native acceptance.** The narrow V8-1 rear-toe contact defect is repaired in the exact committed production geometry. No new reproducible depiction defect was found in this bounded recheck. This grants no technique certification, preview enablement, native smoothness, signing/store or 4 GB approval.

Candidate: \`${d.candidate.head}\`, tree \`${d.candidate.tree}\`, branch \`${d.candidate.branch}\`, worktree \`${d.candidate.worktree}\`. Product source stayed unchanged; only untracked acceptance evidence was present. Auditor did not implement or edit product source/assets or approval states.

## Contact repair and source truth

The actual native rotated rounded View at \`MovementPreview.tsx:262\` has finite inset cap centres, so endpoint-plus-radius remains invalid. I independently evaluated the rounded rectangle outer bound from the exact production foot primitives. The original1185 negative control reproduces the prior toe gaps. The repaired rear foot is tangent to actual floor96.9 throughout supported phases1-3 for all three bodies, never crosses below it during the lifted step/return, and retains5.4-unit length. Both22.25-unit leg segments are preserved, the whole front sole remains fixed/tangent, and both joints and ordered primitive arrays close exactly at4400ms.

| Body | Old1185 supported gap at app240(dp) | New maximum absolute supported gap(canonical) | New minimum conservative rear-knee gap(canonical) |
|---|---:|---:|---:|
${table}

These are fresh computations over135 ticks per body, including terminal frames;79 supported ticks per body. The knee values are conservative local envelopes using the widest adjacent limb radius, not observations of a circular knee primitive. Detailed exact old/new knee values are retained in \`rear-knee-before-after.json\`. Rounded3-decimal values hide the small geometry difference; this audit does not reuse1185 knee measurements.

Maximum observed segment-length error is1.78e-14 for legs and7.11e-15 for arms. Both hanging loads attach to their own wrist centres(max error3.55e-15), two shafts remain present, and the tall torso/head axis stays stacked. The source contract at \`025_movement_coaching_content.sql:65\` requires a backward step, hovering rear knee, whole front-foot drive and return. The six captions and900/900/500/1200/900ms phases depict those actions; numeric stride, depth and tempo remain schematic draft choices. The neutral app240/320/390 sheets show the captions, two hanging bells, planted front sole and rear support. All three body cycle sheets show the full backward/lower/rise/return sequence including the terminal stance.

Side view cannot establish frontal knee tracking, pelvic rotation, bilateral alignment, balance or load distribution. \`REVERSE_LUNGE_SOURCE_BINDING.json\` explicitly requires supplemental front alignment and native evidence; these remain missing.

## Preceding16 preservation

IDs143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84 were compared independently to each revision's exact committed entries and production modules at1185. All entries, resolved joints and complete ordered primitive arrays are identical over48 body cycles/6297 poses. Durations are identical as part of the entry comparison. All51 fresh body cycles/6702 poses(including52) were independently reconstructed, and every encoded SVG array/timeline and retained PNG/HTML hash matched its source-bound index.

Fresh neutral sheets for all16 were actually viewed. They preserve forehead support/lateral arm sweep, quiet scapular shrugs, supported preacher curls and rotating hammer loads, distinct bar/rope pushdowns, straight-arm high-cable shoulder sweep, supported fixed-elbow flat/decline/incline flyes and ankle-cable hip extension. This preservation does not upgrade prior evidence limits or establish unseen supplementary alignment/grip dimensions.

Exact V7 commit510127dd54798ad7963139908a2207e73531d119 was unavailable in this checkout. The parent attempted authorized remote retrieval, which returned \`upload-pack: not our ref\`. The sealed V8 report claims exact preservation toV7; it is retained provenance context, not a fresh source reproduction by this auditor. Direct1185 preservation above is independently reproduced.

ALL_300_MOTION_MAP still records source holds on138,163,253; they must remain explicit until reconciled with authoritative bindings.220's imported wrist rotation versus curated neutral-grip ambiguity remains unratified.135/187's owner-prone correction and unresolved I/Y endpoint remain held. No schema/count result can clear these holds.

## Evidence identity and limits

- canonicalFigure.ts SHA256: \`${h('apps/mobile/src/components/movementPreview/canonicalFigure.ts')}\`.
- MovementPreview.tsx SHA256: \`${h('apps/mobile/src/components/movementPreview/MovementPreview.tsx')}\`.
- canonicalSvg.mjs SHA256: \`${h('tools/rendering/lib/canonicalSvg.mjs')}\`.
- Source SQL SHA256: \`${h('packages/core-db/src/schema/025_movement_coaching_content.sql')}\`.
- Cycle index SHA256: \`${d.freshCycleArtifactVerification.cycleEvidenceSha256}\`.
- Card index SHA256: \`${d.freshCardArtifactVerification.evidenceIndexSha256}\`.

18 neutral cards/36PNG+SVG artifacts were hash-checked;3 neutral card sheets and19 cycle sheets were actually viewed(22PNG sheets total). Complete lists of source hashes, all sampled measurements, encoded-cycle identities, verified artifacts and actually viewed images are in the companion JSON. Hashing an artifact is distinct from visually inspecting it.

No ordinary-speed browser playback, slow live playback or scrubbed browser motion was observed. No node_repl/computer-use runtime is exposed in this agent's tools. Encoded timelines and static frames are headless engineering evidence. No Android/iOS compositor pixels, frame timing, accessibility actions or qualified human technique review were obtained by this auditor. These acceptance gates remain pending; previews must remain pending.

## Handback

1. What I did: created only this evidence-directory probe, raw logs, exact numeric evidence, viewed-image inventory and report. No product changes, commits or approval state edits.
2. Commands and decisive output: \`node --check acceptance-evidence/dot/technique-audit/probe-initial.mjs\` exited0; \`node acceptance-evidence/dot/technique-audit/probe-initial.mjs\` exited0 and retained \`"verifiedCycleCount": 51\`, \`"verifiedPoseCount": 6702\`, \`"verifiedCardCount": 18\` in probe-initial.log. Source52's prior contact failure is reproduced numerically in that same log. An initial audit-only import-path error was corrected; its failed log is retained separately and establishes no product finding.
3. Not verified: ordinary-speed/slow/scrub playback, native playback/accessibility/frame timing, supplemental front alignment, qualified technique certification, fresh V7 source reproduction, source-hold ratification and owner-deferred4GB device acceptance.
4. Judgment: bounded contact repair is established by exact source-derived native outer geometry; global acceptance remains INCOMPLETE. Unchanged1185 bytes can preserve only the prior review's scope and limitations.
5. Next atomic action: implementing lane may continue feasible independent families while holding preview gates, then supply one exact committed final candidate with complete source-bound evidence for both auditors. Initial source freeze is released.
`;
fs.writeFileSync(out+'/INITIAL_TECHNIQUE_REVIEW.md',report);
console.log(JSON.stringify({report:out+'/INITIAL_TECHNIQUE_REVIEW.md',reportSha256:sha(report),evidence:evidencePath,evidenceSha256:sha(fs.readFileSync(evidencePath)),imagesActuallyViewed:inspected.length,sourceInputsUnchanged:true,sourceFreezeReleased:true},null,2));
