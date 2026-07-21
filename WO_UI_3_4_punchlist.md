# WO-UI-3 + WO-UI-4 — FIDELITY CLOSE-CONDITIONS (Antigravity queue)

Source: Fable fidelity review, 2026-07-21 (ledger 0059). Both screens are
**APPROVE, source-level**; these are the close conditions before commit. Cross-
verified against committed source by Claude. Small, precisely scoped, all inside
the guardrails.

Laws/guardrails travel with the WO (`WO_UI_SKIN.md`). Reminders that bite here:
Guardrail 2 — `components/ui/*` and `theme/*` are FROZEN (consume, don't edit).
Law 2 — chalk marks current/active only. Law 1 — zero hex.

## File list (the ONLY files you may touch)
- `apps/mobile/src/screens/BlockScreen.tsx`
- `apps/mobile/src/screens/LibraryScreen.tsx`
- `apps/mobile/test/components/FocusScreens.test.js` (BlockScreen coverage lives here)
- `apps/mobile/test/components/LibraryScreen.test.js`

No store/theme/primitive edits. If any task seems to need one, STOP and escalate.

---

## Item 1 (WO-3, blocker) — SUBSTITUTED badge must not announce as a button

`BlockScreen.tsx:325`:
`<Chip label="SUBSTITUTED" selected={false} onPress={() => {}} />`
The `Chip` primitive always renders a `Pressable` with `accessibilityRole=
"button"`, so this reads to a screen reader as a button that does nothing.

RULED (Francis): **local static badge — do NOT modify the frozen `Chip`.**
Replace the no-op `Chip` at L325 with a display-only element, local to
BlockScreen:
- A `View` + `Text`, NOT pressable, no `onPress`, no `accessibilityRole="button"`.
  Prefer no interactive role at all; if a role is set, use `text`. Optionally
  `accessibilityLabel="Substituted"` so it's announced as a status, not a control.
- Visually match the tertiary/unselected chip treatment per §1j so it still reads
  as a chip badge: `borderWidth: 1`, `borderColor: theme.color.line`,
  `borderRadius: theme.radius.chip`, transparent fill, label in
  `theme.font.label` / `theme.color.textMid`. Zero hex — theme tokens only.
- It is display-only, so it does NOT need the 56pt `theme.touch.min` target;
  size it as a compact badge.
This is a static status label, not a re-implementation of Chip's interactive
behavior — keep it that way (no press states, no selected logic).

---

## Item 2 (WO-3, coverage) — today-spine assertion in verify:components

The Law-2 guarantee (chalk spine on TODAY only; missed/other days unmarked) is
currently untested. Add to `FocusScreens.test.js` a BlockScreen case that:
- renders a block spanning multiple days including `today`;
- asserts the today marker (`styles.dayMarkToday`, gated by `isToday`) is present
  on exactly the today row;
- asserts it is ABSENT on every other row (past/missed/future).
If the marker isn't queryable, add a screen-local `testID` on the today marker
element (BlockScreen.tsx only) to make it assertable — that is the sole allowed
screen change for this item. The point is that this law survives future edits.

---

## Item 3 (WO-4, nit) — barrel imports

`LibraryScreen.tsx:25–28` import primitives by direct path. Collapse to one
barrel import for consistency with every other screen:
`import { Chip, PrimaryButton, SecondaryButton, Disclosure } from '../components/ui';`
No behavior change; typecheck must stay green.

---

## Item 4 (WO-4, coverage) — grow LibraryScreen.test.js beyond 4 tests

Current suite asserts header/search/equipment-filter/detail-card. Add assertions
for the rest of the §1k/§1l surface:
- **Tier / equipment filter** narrows the list (beyond the one equipment case).
- **Progression-ladder current rung**: the chalk spine renders on the
  `isCurrent` rung and on no other rung.
- **Video link-out**: pressing the form-video affordance calls
  `Linking.openURL` (mock `Linking`); assert it fires and that there is no
  in-app player. (Error swallow on the promise is correct — don't change it.)
- **Empty-state**: the legacy-content empty state renders for a movement with no
  curated steps/cues.

---

## Not in this queue
- **WO-UI-2 (SESSION):** nothing for Antigravity — Conditional GO stands; the
  §1i on-device parity check is Francis's, on the shared bundle below.
- **Joint close bundle (Francis):** device build with **Archivo confirmed
  rendering**, screenshots per the checkpoint spec (all states, both tiers where
  they differ, 1.0×/2.0×), and a native `typecheck` + `verify:components` green
  run. WO-UI-2/3/4 close together on that bundle.

## Checkpoint (bounced if incomplete)
`typecheck` + `verify:components` green (now including the today-spine and new
Library assertions); zero-hex grep on both screens; confirm no `accessibilityRole
="button"` on the SUBSTITUTED badge; screenshots as above. Do not self-approve —
Fable confirms Items 1–4 closed; Francis commits.
