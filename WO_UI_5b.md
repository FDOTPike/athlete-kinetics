# WO-UI-5b — ATHLETE (§1m) + ONBOARDING (§1n) REMEDIATION

Builder: **ANTIGRAVITY**. This WO re-does WO-UI-5 against the frozen design
system. It was bounced at Fable review for forking primitives, reintroducing
red, and an absent deliverable. Fix the four items below — nothing else.

The laws travel with this work order. Read the guardrails and the six laws in
`WO_UI_SKIN.md` first; they are binding here verbatim. Highlights that this WO
tripped last time:
- Guardrail 2: the primitives in `components/ui/` are FROZEN. **Consume them.
  Do not re-implement them locally.** A primitive that doesn't fit is a
  checkpoint question, not a local rebuild.
- Guardrail 1: touch ONLY the two named screen files plus their test file.
  Anything you need outside that set (e.g. a new store selector) = STOP and put
  it in the checkpoint bundle as a question. Do NOT reach into raw SQL from a
  screen (this is the WO-2 failure; it was remediated by adding a store action).
- Law 3: zero red/amber/green, anywhere, including via native component styling.

## File list (the ONLY files you may touch)
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/screens/OnboardingScreen.tsx`
- `apps/mobile/test/components/ProfileScreens.test.js` (NEW — no test currently
  covers these two screens; `FocusScreens.test.js` covers Readiness + Block only)

Do not edit `components/ui/*`, `theme/*`, `useStore.ts`, migrations, or
`package.json`. If a task seems to require one of these, STOP and escalate.

---

## P1 (blocker) — Consume the frozen primitives; delete the local forks

Both screens currently re-implement primitives inline. Remove the local
components and route through `components/ui`. Import from the barrel:
`import { Chip, Stepper, QuietAction } from '../components/ui';`

Exact primitive APIs (match these signatures — do not add props):
- `Chip`: `{ label: string; selected: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; style?; testID? }`
  Selected state is handled INSIDE the primitive (inverted white fill, ink0
  text). Do not pass color styling.
- `Stepper`: `{ label: string; value: string; onDecrement: () => void; onIncrement: () => void; style?; testID? }`
  `value` is a preformatted display string.
- `QuietAction`: `{ label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; style?; testID? }`

Swaps:
- `ProfileScreen.ChipRow` — replace the inner `Pressable`/`styles.chip`/
  `chipActive` with a row of `Chip` (one per option, `selected={opt === value}`).
  Keep the outer labelled-row wrapper and `InfoTip`; only the chip element
  itself changes. Preserve the existing `accessibilityLabel` per chip
  (`` `${label}: ${opt.replace(/_/g,' ')}` ``) by passing it through.
- `ProfileScreen.NumberRow` — replace with `Stepper` (`value={display}`,
  `onDecrement={onDec}`, `onIncrement={onInc}`). Preserve label + `InfoTip`.
- `OnboardingScreen.BigStepper` — replace with `Stepper`. If the onboarding
  "value-hero 88pt" scale genuinely cannot be expressed through the `Stepper`
  primitive's own sizing, that is a **checkpoint question** (the primitive may
  need a size variant) — do NOT re-add a local stepper. Flag it and stop.
- `OnboardingScreen` chip/card selects — replace with `Chip`.

After the swap, `grep -n "components/ui" <both screens>` must return matches,
and there must be no remaining local `styles.chip`, `styles.chipActive`, or a
local stepper/chip component in either file.

---

## P2 (blocker) — Coach-Mode delete: QuietAction double-confirm, never red

§1m: destructive delete = QuietAction with ≥16pt isolation, NOT red, and
**double-confirm**. The current code uses `Alert.alert(..., { style:
'destructive' })`, which renders a red button on iOS (Law 3 breach) and is a
single native modal.

Replace the in-canvas destructive flows with a two-step reveal, precedent:
the reset flow already in `ReadinessScreen` (`confirmReset` local state gating
a second confirm control). Pattern:
1. First control (`QuietAction`, label e.g. `Delete <name>`) sets a local
   `confirmingDeleteId` state; it does NOT delete.
2. On confirm-armed, render a second `QuietAction` (label e.g.
   `Confirm delete — this removes their database`) isolated by ≥16pt
   (`marginTop: theme.space[?]` giving ≥16pt) from every other control; only
   this second press calls the store delete action.
3. A neutral `Keep` / cancel `QuietAction` clears the armed state.

Apply to:
- Coach-Mode athlete delete (ProfileScreen ~L713) — the §1m-named case.
- Block delete (~L605) and profile SWITCH (~L579): these also pass
  `style: 'destructive'` → red. At minimum they must lose the red native
  styling. Convert to the same in-canvas neutral confirm for consistency. The
  destructive store actions themselves (`deleteAthlete`, `wipeActiveBlockState`,
  `switchProfile`) are FROZEN — call them unchanged; only the trigger UX moves.

`QuietAction` must be imported and `Alert` from `react-native` should no longer
back any destructive path in `ProfileScreen`. No `style: 'destructive'` may
remain in the file.

---

## P3 (blocker) — Build the §1m Training-decisions disclosure (currently absent)

§1m: "Training-decisions disclosure (20 rows, 4 labels, clinical-log styling)."
This is the last 20 finalized sessions from `session_outcome`, each shown as a
quiet clinical-log row labelled by its outcome kind. The four labels are the
§1i terse (non-beginner) strings:
`Plan followed` · `Session adapted` · `Session stopped safely` ·
`Session recorded` (map from `outcome_kind`:
`followed_plan / adapted_session / stopped_safely / session_recorded`).

DATA ACCESS — READ THIS: the screen must NOT open a DB or run SQL (WO-2
failure). Reading the last 20 `session_outcome` rows requires a store selector
that does not exist yet. That is outside your file list → **STOP and raise it as
a checkpoint question** requesting a store action, e.g.
`loadRecentOutcomes(limit: number): { outcomeKind: string; finalizedAtMs: number }[]`
(mirrors the `loadSessionOutcome` action added in WO-2b). Build the disclosure
UI only after that action exists. Render inside the shared `Disclosure`
primitive; rows as quiet `ListRow`s (label = outcome label, detail = date via
the existing `formatFinalizedDate` helper pattern). No accent, no color per
outcome — all four labels typographically identical (§1i invariant).

---

## P4 (RULED — keep as-is; do not modify)

Onboarding progress dots (`OnboardingScreen` L214–218, `dotActive`/`dotDone`,
styles L508) render a done/current/upcoming tracker with chalk on the current
dot. Francis has ruled: **keep as-is.** Chalk-on-current is a legal Law-2 use
(marks current/active), and the dot row is not a percentage, so it satisfies
§1n. Do NOT touch the dots in this WO. No action required.

## P5 (minor) — Band-level REMOVE confirmation
Band-level `REMOVE` (ProfileScreen ~L492) deletes on a single tap. Add the same
two-step confirm as P2 (it is already color-compliant — textMid, not red).

---

## Checkpoint bundle (incomplete bundles are bounced unread)
1. `npm run typecheck` — green.
2. `npm run verify:components` — green, and GROWN: add `ProfileScreens.test.js`
   asserting (a) chips/steppers render via the shared primitives' selected/label
   semantics, (b) the delete double-confirm requires two presses before the
   store action fires (assert the action is NOT called on first press, IS on
   second), (c) the training-decisions disclosure renders the four labels from
   mocked outcome rows.
3. Zero-hex grep on both screens: `grep -nE "#[0-9A-Fa-f]{3,6}" <screen>`
   returns nothing (already clean — keep it that way).
4. `grep -nE "style: 'destructive'|palette\.|\bAlert\b" ProfileScreen.tsx`
   returns nothing for destructive alerts.
5. Screenshots — all states, both training-age tiers where they differ, 1.0x +
   2.0x. Confirm a title renders in **Archivo** before capture (the pikeMethods
   wordmark makes the narrower face obvious); screenshots taken before the font
   lands fail fidelity review through no fault of the builder.

Do not mark your own checkpoint passed. Fable reviews §1m/§1n fidelity; Francis
commits. Any item needing a frozen file (store/theme/primitive) is a checkpoint
question, not an edit.

---

## FINAL-PASS PUNCH-LIST (post-audit, 2026-07-21) — ProfileScreen.tsx only

The 5b remediation passed re-audit; these two fidelity items remain. Scope:
`ProfileScreen.tsx` only. No store/theme/primitive/test-behavior changes.

**F1 (RULED — QuietAction for all).** The armed destructive **confirm** button
must be `QuietAction` on all three delete paths, matching the athlete-delete
path (L724) and the §1m letter (destructive = quiet, never high-emphasis).
- Block-wipe confirm (L618): `PrimaryButton` → `QuietAction`.
- Band-remove confirm (L467): `PrimaryButton` → `QuietAction`.
- Leave athlete-delete (L724) as-is; it is already correct.
After this, `grep -n "PrimaryButton" ProfileScreen.tsx` must not match any
destructive-confirm site. (PrimaryButton may still be used for non-destructive
primary actions, if any.)

**F2 (isolation, ≥16pt).** The destructive confirm must have ≥16pt separation
from adjacent controls (the cancel/"Keep" and any input), per §1m/Law 4.
- `confirmBox` (column): the current `marginTop: space[4]` isolates the confirm
  from the text above but the cancel sits `gap: space[2]` (8pt) below it — add
  trailing isolation so the destructive↔cancel gap is ≥16pt.
- `confirmBoxInline` (band-remove row): `marginTop` is inert in a `flexDirection:
  'row'` container, so the current isolation does nothing. Give the destructive
  confirm a real ≥16pt separation from the "Keep" action and the input (e.g.
  horizontal spacing, or restructure to a column confirm box like the others).
  Simplest consistent fix: use the same column `confirmBox` layout for the band
  case so all three confirms isolate identically.

Verification additions: re-run typecheck + verify:components green (ProfileScreens
test labels are unchanged by F1/F2 — confirm they still pass), zero-hex grep, and
the `PrimaryButton`-not-on-destructive grep above. Screenshots must show all
three confirm flows.
