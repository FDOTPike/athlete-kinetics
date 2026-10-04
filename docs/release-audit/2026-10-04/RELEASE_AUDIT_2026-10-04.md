# Athlete App complete release audit — 4 October 2026

The app is not release-ready. Opus cloud execution has been successfully created and tasked with the concrete remediation work order; app code has not yet been certified repaired. This packet covers GitHub default/master, the completed coaching feature branch, and the separate local animation/accepted repair state. It combines independent platform, data-quality, movement-technique and movement-runtime audits plus source/gate/GitHub verification. It is a source and host-test audit with explicit missing native/device evidence, not a claim to have tested every device behavior.

## What Opus can access now
Cloud session: https://claude.ai/code/session_01DpTAicGC9rt7bPKRrJdjMX. Created with --model opus --effort high; CLI status resolves opus to claude-opus-5-5. The authenticated Claude CLI reports a Claude Pro account and GitHub connected; actual cloud log retrieval showed the session running audit commands and creating a migration simulation. All execution-order/finding follow-ups returned ok:true. There is no confirmed account/GitHub authorization blocker to starting the task.

A local browser sign-in is separate from cloud execution; the session is running through the already-authenticated CLI. Local status is model configuration evidence, not independent inference-server model attestation; the work order explicitly requires Opus to verify its served model and refuse silent substitution.

The cloud reads GitHub, not local untracked work. GitHub source at audit time:

| State | Exact source | Actual product coverage |
|---|---|---|
| Default master |1da218d8b1886040dcf89e0d630581f7b33824d9|124 effective movements; no motion previews; older app feature surface; latest GitHub CI succeeded|
| Complete coaching feature branch |claude/coaching-wo4-coaching-content,12a1fb15aff5611b771348a53e2e04f4079e0e34|300 movement rows; preparation/warm-up, focus/SMART goals, sport-responsive programming, encrypted backup; no motion preview source|
| Reviewed local health/animation state |01023cf04eeb85b73004b92de11f64efa7350a1c plus fingerprinted overlay|Accepted async/permission repair and129 preview entries; separate source from either GitHub baseline|

PR22 was merged into codex/rpe-familiarisation; PR23 into WO1; PR24 into WO2; PR25 into WO3. Their merged status does not mean master contains them. The feature branch has317 commits absent from master, while master has8 absent from it. The local main3358be64 is stale and was left untouched. Avoid launching from that checkout and assuming the newest app was uploaded.

The existing source handoff references are exact text copies of the local accepted repair with SHA-256 manifest. They are for narrow porting: wholesale replacement would discard the completed feature branch's newer coaching behavior. Motion geometry/evidence remains a separate Codex lane.

## Blockers requiring engineering work

| ID | Priority | Current blocker | Owner / evidence |
|---|---|---|---|
| APP-01 |P1|A delayed safety/subjective report for athleteA can be persisted inB after a switch.|Opus; reproduced on BOTH GitHub baselines using the real store and synthetic native scheduling.|
| APP-02 |P1|A delayed biometric read forA can be persisted inB.|Opus; same reproduction framework.|
| APP-03 |P2|An older grant check can overwrite newer explicit denial and begin reading.|Opus; observed denied→ready with readDaily called.|
| APP-04 |P2|Concurrent registry mutations lose an accepted rename; sibling create/switch/delete paths need the same serialization.|Opus; controlled overlapping read-modify-write reproduction.|
| APP-05 |P2|PendingA onboarding name renamesB and resets persisted activeId from a stale registry.|Opus; reproduced on master and feature branch.|
| INT-01 |P1 integration contract|Master migration ordinal34 is058; feature ordinal34 is035. A blind source-array transplant violates shipped migration identity.|Opus; source first-prefix mismatch. The sampled upgrade DOES boot via sentinel replay; this is not a reproduced crash.|
| INT-02 |P2 actual upgrade defect|The sampled populated master→feature upgrade preserves selected rows but its schema fingerprint is rejected by the production backup contract.|Opus; full production SQL/runner reproduction. Only suspension_episode CREATE text differs because frozen058 comments differ; retain tight schema validation.|
| INT-03 |release prerequisite|Complete features and accepted local fixes are not on one GitHub release branch; motion implementation remains locally isolated.|Opus integrates app; Codex owns motion lane; freeze source and reconcile reviewed differences.|
| IOS-01 |P1 source/configuration|Hoisted op-sqlite podspec reads root package config, while SQLite math flags exist only in the mobile workspace. Native schema uses ln/sqrt.|Opus; source-confirmed configuration error, native boot not yet reproduced.|
| IOS-02 |P1 requested parity|No Apple Health adapter, platform factory, HealthKit entitlement or usage description.|Opus; correct signal semantics and truthful native authorization handling.|
| IOS-03 |P1 requested parity|ONNX model never added to iOS native resources; runtime silently falls back when it cannot open it.|Opus; reuse and hash-verify actual bundled model/tokenizer.|
| IOS-04 |release prerequisite|No macOS native build/simulator smoke/iOS artifact job.|Opus; Linux cloud work must drive Mac CI or an authorized Mac. Metro success is not a native build.|
| IOS-05 |release prerequisite|Template bundle ID, no configured Apple team/provisioning/archive export setup.|Opus prepares configuration; owner supplies registered identity/signing access.|
| IOS-06 |release prerequisite|Empty AppIcon catalogue without image pixels.|Opus reuses approved brand source.|
| IOS-07 |P2 visual parity|Archivo font assets are not linked in iOS.|Opus; verify native rendering/large text.|
| IOS-08 |P2 product readiness|Display/launch metadata remains scaffold branding.|Opus; retain approved pikeMethods design.|
| IOS-09 |native acceptance missing|Backup CSPRNG/Files picker/path/recovery, crypto/export policy, full workouts/resume, offline boot, Health data/revocation, VoiceOver and large text lack iPhone proof.|Opus establishes native tests; owner/device/account acceptance remains external.|
| SEC-01 |triage needed|Current audited lock reports66 vulnerable package entries:1critical,58high,6moderate,1low.|Opus classifies reachable build/runtime paths and applies compatible fixes; advisory counts are not proof of a mobile exploit.|
| BUILD-01 |supply-chain readiness|Model fetch defaults to mutable main with no known artifact hashes.|Opus pins a trusted revision/hashes and proves model/vector/tokenizer equivalence.|
| AND-01 |release prerequisite|Current Android Release uses public debug signing rather than a production upload key.|Opus prepares build; owner/key/store access provides final signing.|
| QA-01 |release proof missing|No complete integrated cross-platform native/device acceptance packet.|Opus + independent reviewer; bind source, artifact, logs, build and install identities.|
| QA-02 |gate incomplete|Feature verify:ci did not finish its backup-recovery component suite during a bounded run.|Opus diagnoses the suite without skipping it or manufacturing a pass; see COMPONENT_GATE_OBSERVATION.md.|
| DOC-01 |cloud-work friction|Old workflow/checklists have stale model assignments, feature counts, memory/checkpoint instructions and gate commands.|Opus updates controlling documentation; the direct owner authorization governs.|
| AUDIO-01 |integration/status decision|Spoken cues remain on openPR21, absent both audited baselines. Text coaching must not be called speech support.|Review existing branch/acceptance and integrate if in the intended complete release scope; do not invent a second audio system.|

Apple design traps: SDNN is not RMSSD and cannot be stored under the latter's meaning; HealthKit intentionally hides read-denial status. Preserve per-signal provenance/units/baselines and unknown/no-data states. Detailed source evidence and Apple primary citations are in IOS_AUDIT.md. PrivacyInfo exists; RN's pod hook can add its resource reference, so this audit does not falsely claim that a missing checked-in resources entry proves a missing archive manifest.

The critical protobufjs6.11.6 dependency enters through development @xenova/transformers → onnxruntime-web → onnx-proto. Its descriptor injection advisory requires attacker control over definitions; mobile-runtime exploitability was not established. Do not blindly apply npm audit fix --force. [GitHub reviewed advisory](https://github.com/advisories/GHSA-xq3m-2v4x-88gg).

## Inputs and acceptance Opus cannot fabricate

- Apple Developer access is confirmed not yet set up by the owner. Account setup, registered bundle identity/team, approved signing certificate/profile or owner-managed signing, App Store Connect and TestFlight install access remain final release inputs. Engineering and unsigned macOS build checks continue independently.
- A macOS/Xcode build executor. GitHub-hosted macOS CI can provide unsigned native evidence; final HealthKit/device behavior still needs iPhone/Health data.
- Android upload/signing key, Play account and factual health/privacy declarations.
- Approved final icon/brand source, public privacy/support URLs, store listing assets, truthful encryption/export/privacy answers and account acceptance. Account/policy existence was not inspected and is unknown, not assumed absent.
- Exact final source/artifact approval and physical device acceptance.
- The135/187 prone forward lower-trap raise endpoint/source remains unresolved (I versusY); do not guess or silently approve a different movement.

The4GB phone/memory acceptance is explicitly deferred to Francis as requested. It does not block code, integration, unsigned native builds or animation preparation. Existing host lifecycle/leak guards remain useful. No document in this packet certifies physical RAM/Jetsam compliance.

## Separate movement audits and remaining work

MOVEMENT_TECHNIQUE_AUDIT.md and MOVEMENT_RUNTIME_AUDIT.md were written by independent auditors who did not implement the assets. These are pre-implementation audits; both must review the exact final asset/app revision again after changes.

- Local candidate has129 entries:3 historical covered,123 pending,3 intentionally unsuitable;126 drawable drafts after variant resolution. Global technique review pending hides all production previews. Zero approved visible previews.
-171 of the300 library movements lack an entry;2 have recorded unsuitable status, leaving169 eligible movements without animation entries. The Beginner-only174-record queue has52 eligible missing movements. The full missing-ID list is in the technique report.
- Technique production probes:0pass/7fail for the named shrug/preacher/rear-delt cases.135/187 old source interpretation is superseded by the owner-approved prone forward-raise intent; endpoint/source remains held.143 reuses rear-delt ROW geometry for a raise; preacher returns/captions/tempo and whole-body shrug action disagree with the instruction.
- Runtime existing tests:759 Jest and102 Tier1 passed. Independent production probes:4fail/1 final-stop control pass. Defects are pause snap, inherited movement playback/time, stale uncovered coordination claim and penultimate endpoint interpolation. Nine drafts have confirmed circular/rectangular clipping; curl186 changes implement rendering at role boundaries. No native frame-rate/smoothness claim is made.
- Feature branch retains31 generic instruction rows and115 content corrections without per-record recorded ratification. Recorded content/source acceptance must be reconciled; code/schema validity does not establish all movement technique truth.

After Opus's app source/native work is independently accepted: use a fresh integration-based motion branch; port the existing system without overwriting feature code; fix demonstrated renderer and technique defects first; complete all eligible movement entries in bounded source-reviewed families; retain explicit exclusions; run the separate technique and runtime audits again; capture native playback/crop/lifecycle/accessibility evidence; enable only accepted revisions. The hourly follow-up in this thread is active to continue that sequence. No movement asset or approval flag was edited during this audit.

## Validation record

Master: npm ci and typecheck pass. Its20 gates were executed; verify:all initially stopped at the missing model prerequisite, then fetch:embedder and every remaining gate passed. Components:8suites/85tests passed. Existing GitHub run37188590190 succeeded. Production iOS Metro bundle passed (2,484,785bytes), with retained SHA; Xcode/native/signing/device verification remains unperformed.

Feature12a: npm ci/fetch and verification progressed through the host gates into component tests. The root-owned aggregate run was interrupted at20:08:31 Sydney after more than18minutes without further component log output. Jest remained CPU-active; the exact stack was not verified. Its result is INCOMPLETE/INTERRUPTED (exec exit-1), not a passing suite or an asserted product failure. COMPONENT_GATE_OBSERVATION.md and feature-ci-interruption.json retain evidence. Opus must diagnose the retention suite and complete it without weakening recovery coverage. Expected negative-control FAIL text elsewhere in the log is not a failed gate.

Independent app diagnostics: master7tests→2controlsPASS/5FAIL; feature7tests→2controlsPASS/5FAIL; local accepted repair7suites/102testsPASS. Populated migration upgrade sample preserved selected rows but backup fingerprint failed. Independent motion counts/probes and untouched source hashes are retained in the respective reports/runtime evidence.

Logs and machine-readable snapshots are retained beside this report. OPUS_AUTONOMOUS_RELEASE_WORK_ORDER.md was delivered to the real cloud session with ok:true, including the later concrete backup-fingerprint reproduction. No app source was changed, no existing dirty checkout was committed, and nothing was merged/published to stores during the audit.

The cloud development workflow and account prerequisites were checked against [Anthropic cloud documentation](https://code.claude.com/docs/en/claude-code-on-the-web). The continuing local follow-up requires the computer and Codex app to remain running, as described in [OpenAI scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app).
