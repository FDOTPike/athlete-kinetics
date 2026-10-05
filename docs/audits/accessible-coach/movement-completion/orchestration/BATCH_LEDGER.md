# Movement order: batch and ownership ledger

Orchestrator and auditor: Claude Opus 5.5 in Claude Code Desktop (identity `claude`).
Implementer: Gemini in Antigravity (identity `antigravity`). Mail: deaddrop.
Owner decision in force: ONE gender-neutral figure for every movement.

A batch is accepted only after the orchestrator has checked the source and
evidence itself. `read`, a wake-up, an author claim or a green summary is not
acceptance.

## Ownership

| Checkout | Branch | Writer | Notes |
| --- | --- | --- | --- |
| `C:/Users/fpike/.gemini/antigravity/worktrees/Athlete App/athlete_movement_animation_completion` | `gemini/movement-animation-completion-2026-10-05` | Gemini (sole implementation writer) | Local only, no upstream. Observed clean at `a1a073f6a08ce0c1f9921ba385579856348b3923` on 2026-10-05. |
| `.claude/worktrees/movement-audit-a1a073f6` | detached `a1a073f6` | nobody (read-only audit runs) | Frozen candidate, tree `3c2dddd444fca1945b7b22b398f575b0c0dc663c`. |
| `.claude/worktrees/movement-orchestration` | `claude/movement-orchestration-2026-10-05` | Claude (this directory and audit reports only) | No app source edits. |

## Deaddrop

- Code: `C:/Users/fpike/Documents/deaddrop` at `de4a305083fbf255fb77667e4ef7ca4e53789e18`, outside the app repo and its dependencies.
- Mailbox (Athlete only, shared): `C:/Users/fpike/Documents/deaddrop-mail/athlete-app`.
- Claude: local-scope registration for the main checkout (`claude mcp get deaddrop` reports Connected).
- Antigravity: `deaddrop` entry in the global `~/.gemini/config/mcp_config.json`
  (backup beside it). A per-workspace `.agents/mcp_config.json` was tried first
  and was not loaded after a restart, so it was removed.
- Wake-up: NOT configured, by owner decision (2026-10-05): Francis nudges
  Gemini to read its mail. No sidecar, no `conversation_id`.

## Batches

| Batch | Type | Baseline | Sent | Acknowledged | Outcome |
| --- | --- | --- | --- | --- | --- |
| MOV-B000 | STATUS (handshake) | `a1a073f6` | 2026-10-05 14:02 +11:00, message `2026-10-05_140225_claude_to_antigravity_mov-b000-status-handshake-repl` | yes, 14:39 +11:00, message `2026-10-05_143944_antigravity_to_claude_mov-b000-ack-status-handshake-` | CLOSED. Reply checked against the checkout: path, branch, HEAD `a1a073f6`, clean tree all match. Worker reports model Gemini 3.8 Flash (High), conversation `3faf5eed-a7cd-4eac-86fc-925378062def`, no other writer. Round trip verified. |
| MOV-B001 | REPAIR (neutral-only) | `a1a073f6` | 2026-10-05 14:40 +11:00 | yes, 14:41; completion 15:27, message `2026-10-05_152752_antigravity_to_claude_mov-b001-complete-neutral-only` | ACCEPTED at source `7754e1507f3688d17b57552810554c07a4269b15`, evidence commit `ee5bca7143e922b491024972f9f8e81875e83824`. Orchestrator re-run on that commit: typecheck 0; MovementPreview suites 0 (700 passed, 4 skipped); evidence gate 0; rendered-output probe 0 of 132 changed. Three follow-ups carried into MOV-B002 (skipped regression lock, unused import and stale comment, misreported SHA). Evidence: `evidence/b001-neutral-identity/`. |
| MOV-B002 | REPAIR (B001 follow-ups, frame guard, 15 clipped movements) | `ee5bca7143e922b491024972f9f8e81875e83824` | 2026-10-05 15:31 +11:00; correction `batches/MOV-B002-C1.md` 15:52 (the ack had named 8 wrong movement IDs) | yes, 15:51 and 15:53; completion 16:16, message `2026-10-05_161607_antigravity_to_claude_mov-b002-complete-frame-guard-` | ACCEPTED at `982b081b627ce2f170b4294a8768881a362c7110` (tree `d48431cc24fd4619d8a6115f404e57fe40b75b13`). Orchestrator re-run: typecheck 0; MovementPreview suites 0 (701 passed, 2 todo); evidence gate 0; probe zero overflow for all 132; drawings changed for exactly the fifteen; both real source frame mutations fail the suite; the coverage test sees interpolated motion for all 129 entries it runs. Follow-ups carried into MOV-B003: derived movements missing from the committed guard, a leftover three-name loop, evidence in the source commit. For the visual audit: siblings now have slightly different crops (Dumbbell Floor Press vs its two siblings; Cable Seated Crunch vs its four). Evidence: `evidence/b002-frame-guard/`. |
| MOV-B003 | AUTHOR (Inverted Row, Body Tricep Press) plus B002 follow-ups | `982b081b627ce2f170b4294a8768881a362c7110` | 2026-10-05 16:21 +11:00 | yes, 16:22; completion 16:58, message `2026-10-05_165834_antigravity_to_claude_mov-b003-complete-inverted-row` | GATES PASS, TECHNIQUE NOT ACCEPTED at `6f4b4283f4c56ae9fb03bc8f8a21861a10d751a8` (source `aa3f7aac61b56b3db90dbf0a4785396d6b63a607`, tree `7869ef92022d0df7aea12b8514014b28ab8f6e0d`). Orchestrator re-run: typecheck 0; suites 0 (708 passed); storage 0; evidence gate 0; 132 earlier movements byte-identical; zero clipping for 134; follow-ups done. Rendered cycles inspected: Inverted Row bar at chest not hip height (58.9 above floor; rig hip 44.1) and arms 70.9 degrees from vertical at long arms; Body Tricep Press shoulder angle moves 28.35 degrees against 'shoulders stay still', bound set at 30 to fit. Repair is MOV-B004. Evidence: `evidence/b003-fixed-bar/`. |
| MOV-B004 | REPAIR (technique of the two fixed-bar movements) | `6f4b4283f4c56ae9fb03bc8f8a21861a10d751a8` | 2026-10-05 17:24 +11:00, after the handover check below | yes, 17:26 +11:00, ids and names confirmed, baseline clean | in progress: `batches/MOV-B004.md` |

### MOV-B000: handshake

Asks the worker for: model, conversation, checkout, branch, full HEAD, dirty
files, ownership, a readback of the neutral-only scope, and confirmation that
it holds Francis's standing implementation authority. No source change is
requested. Nothing else is dispatched until a matching reply addressed to
`claude` and quoting `MOV-B000` is read and checked against the checkout.

Setup check, 14:37 +11:00: a separate Opus setup chat in Antigravity (`antigravity-setup`) confirmed the global config is the one Antigravity reads and that the three tools load. It left MOV-B000 for Gemini.

Noted from the B000 reply, outside this order: the worker says it earlier left uncommitted work in `.worktrees/rpe-familiarisation` (16 dirty files there now). Not touched here.

## Worker handover, 2026-10-05

Francis found that the nudges had gone to an Antigravity chat opened for RPE familiarisation; that chat did MOV-B001 to MOV-B003 by path in the movement checkout. All three landed only in that checkout (checked each time; the RPE worktrees are unchanged). Francis is moving the worker role to the Gemini movement chat in goal mode and telling the first chat to stop. No mail is sent until a `HANDOVER ACK` from the new chat is checked against the checkout. Committed work is kept.

`HANDOVER ACK` received 17:05 +11:00 (message `2026-10-05_170514_antigravity_to_claude_handover-ack-sole-implementer-`) and checked: new conversation `233f7d27-e16a-4b40-a703-914fc9456807` (the earlier worker was `3faf5eed-a7cd-4eac-86fc-925378062def`), model Gemini 3.8 Flash (High), same checkout and branch, HEAD `6f4b4283f4c56ae9fb03bc8f8a21861a10d751a8`, clean, sole writer, neutral-only readback correct. Worker of record from MOV-B004 on.
