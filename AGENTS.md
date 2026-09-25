# AGENTS.md: standing rules for coding agents in this repo

`AGENT_WORKFLOW.md` is the full protocol, and if the two ever disagree it wins.
This file is the short version, which Codex loads automatically. The task itself
comes from the work order named in your start prompt. Read that work order next,
then only the files it cites.

## Roles
- **Francis** is the owner. He rules on policy, schema, movement identity and UI.
- **Sol** (GPT-5.6, Codex) builds. Sol executes one work order at a time,
  touches only the files that work order allows, and STOPS at its checkpoint.
- **Fable** audits checkpoint bundles. Nobody self-approves.

## Never bend these
1. **No cloud at runtime.** Make no network calls and send no telemetry. The
   production Android manifest keeps `INTERNET` removed.
2. **Engines are deterministic.** They are pure TypeScript with no RNG, no clock
   reads and no LLMs at runtime.
3. **Memory.** The ceiling is 512 MiB and the target is 450 MB. Load reference
   data once, and create native resources lazily.
4. **Typing.** TS `--strict` with no `any`. SQLite tables are `STRICT`.
5. **Migrations are append-only.** Never edit a shipped migration. New work takes
   a new slot, and only when the work order grants one.
6. **No new npm or Gradle dependency** unless the work order explicitly allows it.

## Branches
- Product work lives on the release line. PRs target `codex/rpe-familiarisation`.
  `master` is a separate lineage; never target it.
- Always push explicitly: `git push -u origin HEAD:<branch>`. Never use a bare
  `git push`. Never merge, and never enable auto-merge.

## Setup in a fresh worktree
Run `npm ci`, then `npm run fetch:embedder`, then `node scripts/verify-preflight.mjs`.
Never junction or copy `node_modules` from another checkout: it builds the wrong
source and still reports green.

## Verification
- Run `npm run typecheck` green before every commit.
- `npm run verify:ci` is the merge gate and must exit 0.
- Component tests: `npm run verify:components`. The first render of a heavy
  screen can take about 6 s, so give async tests a file-level timeout.
- Verify by running code, never by re-reading it.
- Once you add a guard, break the thing it guards once, record the failure, then
  revert. A gate you never saw fail proves nothing.
- The owner has no local Android toolchain. CI's `android-apk` job is the only
  proof that native code compiles.

## Records
- **Your first file write** appends an entry to `PROMPT_LEDGER.md` containing your
  start prompt verbatim. Number it one above the highest `## Entry NNNN` on any
  local or remote ref, because unmerged branches hold numbers too, and say why
  you skipped numbers. Complete its Output section when the work lands.
- End a session with `HANDOVER_<date>_<topic>.md`. Log deviations in
  `DEVIATION_LOG.md` (append only) as they happen.
- **Evidence is what you observed, nothing more.** Mark device behaviour you did
  not see as UNVERIFIED. Overstating status is the cardinal sin.

## When blocked
STOP and write down the blocker. A workaround that crosses any rule above, or
touches a file the work order does not allow, fails the work order.
