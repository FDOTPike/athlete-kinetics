# Movement order: plan to release

Written 5 October 2026 by Claude Opus 5.5 at Francis's request. Proposal, not
yet ratified. Deaddrop is no longer used (owner instruction, same day).

## Principle

The app release does not wait for 300 animations. The preview code is
fail-closed: nothing is shown until the global technique review is complete
and a movement's own media row is `ready`. So the app can ship with previews
dark, and movements are switched on in small audited tranches.

## Where things stand

- 300 catalogue movements. 131 are in the 174-movement beginner scope and
  drafted; about 43 beginner movements and 120 others have no draft.
- 124 movements have an external video link today; 176 have no media at all.
- Accepted this session: one neutral figure (MOV-B001); frame guard and zero
  clipping for every drafted movement (MOV-B002).
- Not accepted: Inverted Row and Body Tricep Press (MOV-B003); repair
  MOV-B004 is in flight.
- No draft has had a technique audit from rendered images, and nothing has
  been measured on a device. All drafts are `pending`.
- All implementation work is local only. Nothing is pushed.

## Phase 0: close out and protect the work

1. Let MOV-B004 finish, or stop it. Either way the orchestrator reads the
   result from git and audits it. No new authoring after it.
2. Push the implementation branch as a draft and open a review PR for the
   accepted infrastructure, source separate from evidence so each review is
   under 300 files. Needs Francis's go-ahead to push.
3. Coordination without a mailbox: a work order is a file on the
   orchestration branch; Francis points the implementer at it; the
   implementer's report is a file in its evidence commit; the orchestrator
   reads git.

## Phase 1: prove it runs, and sort what exists

1. Device measurement on three movements (a simple one, the busiest at 152
   views, one on the session screen): screen load time with and without a
   preview, frame timing during playback, memory. If it fails, the renderer
   moves to a single drawing surface before any more content is made.
2. Triage of the 134 drafts by eye: one neutral sheet per movement, each
   compared with its source text, sorted into ship candidate, repair, redo.
   Francis reviews only the ship candidates.

## Phase 2: Release 1

- Ship the app whether or not a tranche is ready. Previews stay dark unless
  a first tranche has cleared.
- First tranche: 20 to 30 movements, chosen from ship candidates that are in
  the beginner scope, appear in the starter programmes, and have no video
  link today.
- A tranche is switched on only with: technique audit from rendered images,
  runtime audit, device playback evidence, and Francis's sign-off.
- Dependency: marking a movement's media `ready` is a data change in the app
  lane (append-only migration), not in the movement lane.

## Phase 3: fix the source of motion (in parallel with Phase 2)

- One-movement spike, Inverted Row: reference clip, pose extraction, a 3D
  skeletal motion, projection to the existing 2D renderer. Compare cost and
  quality with hand-authoring.
- If it works, the 3D motion becomes the source of truth for new movements,
  and for the later online video or 3D view. Accepted 2D drafts stay until
  replaced.
- If it does not, hand-authoring continues with the image check built into
  every batch.

## Phase 4: the remaining movements, by value

1. Beginner movements with no draft (about 43), those with no video first.
2. Existing drafts that triage marked repair or redo.
3. Non-beginner movements a side or front view can show (about 105).
4. Last, the ones a flat view shows badly: 12 multi-stage or multi-view, 12
   articulated trunk, 5 wrist or rotation detail. Candidates for stills
   offline plus video online.
5. Holds stay held: 21 source holds, and the prone I-versus-Y endpoint for
   two movements, which needs Francis's answer once.

## Phase 5: online detail (after Release 1)

Opt-in video or 3D from the same motion source, replacing the external
links. No effect on app size or offline performance.

## Decisions for Francis

1. Release 1 with previews dark unless a tranche is ready (recommended), or
   hold the release for a tranche.
2. Go-ahead for the device measurement, and on what (the Pixel or an
   emulator).
3. Reference footage for the spike: recorded by Francis, or licensed.
4. Go-ahead to push the implementation branch as a draft and open the first
   review PR.
5. The prone I-versus-Y endpoint.
