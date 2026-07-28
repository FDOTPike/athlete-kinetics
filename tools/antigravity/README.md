# Antigravity project agent

This directory integrates the Antigravity Python SDK as **development tooling**.
It is not part of the React Native application, is not bundled on-device, and
does not change Athlete Kinetics' offline/no-account product architecture.

The original generated launcher was useful as a proof of connection, but it
hardcoded one Google Cloud project, exposed the SDK's default broad capability
set, enabled subagents, and supplied no repository workflow constraints. The
project launcher replaces those defaults with:

- an explicit workspace boundary;
- environment-based Vertex configuration;
- subagents disabled;
- a write-capable `builder` role that requires a ratified work-order file;
- a source-read-only `auditor` role, which is the safe default;
- interactive approval for every shell command;
- project-specific instructions from `AGENT_WORKFLOW.md`; and
- agent state stored outside the Git repository.

## Setup

Use a dedicated virtual environment so SDK dependencies do not enter the app's
Node dependency graph:

```powershell
py -m venv .venv-antigravity
.\.venv-antigravity\Scripts\python.exe -m pip install -r tools\antigravity\requirements.txt
gcloud.cmd auth application-default login
$env:ANTIGRAVITY_VERTEX_PROJECT = "your-google-cloud-project"
$env:ANTIGRAVITY_VERTEX_LOCATION = "australia-southeast1"
```

Vertex AI authentication, billing, and quota belong to the selected Google
Cloud project; they are separate from consumer Gemini subscription allowances.
Do not put credentials in this repository. Application Default Credentials stay
in Google's user-level credential store.

An explicit model can be selected with `ANTIGRAVITY_MODEL`, but leaving it
unset lets the installed SDK choose its supported default.

## Safe validation

The default role cannot edit source:

```powershell
.\.venv-antigravity\Scripts\python.exe tools\antigravity\run_project_agent.py --dry-run
.\.venv-antigravity\Scripts\python.exe tools\antigravity\run_project_agent.py
```

The dry run constructs and validates the real SDK configuration but does not
authenticate or start an agent session.

## Builder session

Builder mode is deliberately impossible without a work order committed or
saved inside the workspace:

```powershell
.\.venv-antigravity\Scripts\python.exe tools\antigravity\run_project_agent.py `
  --role builder `
  --work-order PHASE19_PLAN_capability_content.md
```

Use one builder at a time. Do not run the Antigravity IDE and this SDK launcher
as simultaneous writers against the same checkout.

## Where it fits

The launcher is a guarded **execution adapter**, not the project overseer and
not a model-to-model router.

1. **Francis — product owner and ratifier.** Chooses scope, resolves product
   decisions, and approves checkpoints.
2. **Opus 5 — primary overseer and experience/content auditor.** Drafts a
   bounded work order; audits coaching voice, movement content, UX intent, and
   completeness. It does not write concurrently with the builder.
3. **Antigravity IDE or SDK — sole implementation agent.** The IDE is useful
   for visual work, Stitch, emulator interaction, and exploratory development.
   This SDK launcher is useful for a reproducible, workspace-confined work
   order and gate run. Use one or the other as the active writer.
4. **Codex — independent architecture and systems auditor.** After Antigravity
   stops writing, Codex inspects the live diff, database and inference
   contracts, tests, CI, accessibility, and release risk. Codex should receive
   the work order plus repository state, not only another model's summary.
5. **Francis — release decision.** Reviews both audit streams, authorizes fixes,
   and decides when to commit, push, device-test, and release.

The normal handoff is:

```text
Opus work order -> Francis ratification -> Antigravity implementation
-> verification/checkpoint bundle -> Opus content/UX audit
-> Codex architecture/system audit -> Francis release decision
```

If either audit finds a blocking issue, produce a small corrective work order
and return it to the single Antigravity writer. Auditors should not quietly
become additional builders.

## Operational guardrails

- Keep the work order narrow and name its verification commands.
- Start a fresh agent session at major checkpoints to limit context and usage.
- Never expose `START_SUBAGENT`, image generation, or web tools by default.
- Review every proposed shell command before approving it.
- Require evidence: changed files, test output, remaining failures, and exact
  checkpoint status.
- Treat generated screenshots and audit reports as artifacts, not proof that
  the underlying contracts pass.
