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
| MOV-B001 | REPAIR (neutral-only) | `a1a073f6` | 2026-10-05 14:40 +11:00, message `2026-10-05_144019_claude_to_antigravity_mov-b001-repair-neutral-only-r` | no | open: `batches/MOV-B001.md` |
| MOV-B002 | REPAIR (frame guard, 15 clipped movements) | accepted B001 commit | not sent, waits for B001 | no | prepared: `batches/MOV-B002.md` |

### MOV-B000: handshake

Asks the worker for: model, conversation, checkout, branch, full HEAD, dirty
files, ownership, a readback of the neutral-only scope, and confirmation that
it holds Francis's standing implementation authority. No source change is
requested. Nothing else is dispatched until a matching reply addressed to
`claude` and quoting `MOV-B000` is read and checked against the checkout.

Setup check, 14:37 +11:00: a separate Opus setup chat in Antigravity (`antigravity-setup`) confirmed the global config is the one Antigravity reads and that the three tools load. It left MOV-B000 for Gemini.

Noted from the B000 reply, outside this order: the worker says it earlier left uncommitted work in `.worktrees/rpe-familiarisation` (16 dirty files there now). Not touched here.
