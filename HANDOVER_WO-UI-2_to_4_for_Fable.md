# HANDOVER — WO-UI-2 → WO-UI-4, for Fable review

Date: 2026-07-21 · Builder: Antigravity · Prepared by: Claude (checkpoint auditor)

Purpose: bring Fable current on the SESSION, BLOCK, and LIBRARY screens. One
was reviewed and conditionally passed; two were built but never given a fidelity
review. Mechanical law-sweeps below are mine (grep-level, source-verified); the
**design-fidelity judgments against the design sections are Fable's to make.**

Laws/guardrails are in `WO_UI_SKIN.md` and travel with each WO. "Conditional GO"
throughout means: engineering + architecture pass on source inspection, and the
only thing outstanding is a local `typecheck`+`verify:components` green run plus
a screenshot bundle with **Archivo confirmed rendering** (all states, both
training-age tiers where they differ, 1.0×/2.0×). No checkpoint closes without
that bundle.

## Status at a glance

| WO | Screen | Design § | Reviewed? | Mechanical sweep | Fidelity | Verdict |
|----|--------|----------|-----------|------------------|----------|---------|
| UI-2 / 2b | SESSION | §1e–§1i | YES (bounced → remediated → re-audited) | PASS | pending on-device | **Conditional GO** |
| UI-3 | BLOCK | §1j | NO | PASS (clean) | **not yet reviewed** | **Needs Fable** |
| UI-4 | LIBRARY | §1k–§1l | NO | PASS (1 nit) | **not yet reviewed** | **Needs Fable** |

Mechanical sweep = zero hex literals, no red/amber/green tokens, primitives
consumed (not forked), no native `Alert`/`style:'destructive'`.

---

## WO-UI-2 / 2b — SESSION (§1e–§1i) — reviewed, Conditional GO

History: first submission was **bounced** for two architecture blockers and a
correctness bug —
- S1: raw `op-sqlite` + SQL inside the screen (boundary breach).
- S2: `useStore.setState`/`getState` mutation invented in the UI (Law 6 / escalation skipped).
- S3: `try/catch` defaulted to `followed_plan`, silently showing a false outcome; the test asserted the masked path.

WO-2b remediation (re-audited against committed source) closed all of them:
- Outcome read moved to store `loadSessionOutcome` via shared `getDb()`; screen consumes a selector only — no `require`/`executeSync`/`getState` left in the screen.
- `dismissOutcome` store action replaces the direct `setState`.
- Honest fallback: store returns `null` → screen shows the truthful neutral `session_recorded`, never a fabricated positive.
- Tests parametrize all four §1i outcome kinds × both tiers, plus the dismiss action.
- Zero hex, `palette.*` retired.

What Fable still owns: on-device fidelity of §1e guided (center-stage movement,
cue > body typography, next-up line, RestTimerCard), §1g self-directed (dense
list, chips/steppers, 72pt LOG SET), §1h halt/substitution (full-width neutral
Secondary, no alarm styling), and the §1i post-session line — confirm all four
outcomes render **typographically identical** on device.

Outstanding: local green run + Archivo screenshots.

---

## WO-UI-3 — BLOCK (§1j) — built, NOT reviewed

Mechanical sweep (source-verified): **clean.**
- Imports primitives from the `../components/ui` barrel; 19 primitive usages; no local forks.
- Zero hex literals; no red/amber/green tokens; no `Alert`/destructive.
- Chalk present in styles (BlockScreen.tsx:724, 726, 741) — a border/spine + accent.

What Fable must verify against §1j (the "liquid calendar"):
1. **Chalk spine on TODAY only.** §1j is explicit: today gets the spine; *missed
   days are simply unmarked*. Confirm the chalk styles at 724/726/741 apply
   exclusively to the today row and never to missed/past/future rows — this is
   the Law-2 risk on this screen (chalk = current/active only, never a
   reward/warning for a missed day).
2. Phase labels rendered as **eyebrows**.
3. Substitution badges as **tertiary chips** (not primary/selected styling).
4. Missed days visually recede (unmarked), not error-colored.

Coverage gap: **no dedicated BlockScreen test file.** `FocusScreens.test.js`
imports BlockScreen but Fable should confirm it actually asserts the today-spine
semantics; if not, that's a `verify:components` growth item before close.

---

## WO-UI-4 — LIBRARY (§1k browser, §1l detail) — built, NOT reviewed

Mechanical sweep (source-verified): **clean, one nit.**
- Consumes frozen primitives (`Chip`, `PrimaryButton`, `SecondaryButton`,
  `Disclosure`) — **but imports them by direct file path** (`../components/ui/Chip`,
  …) rather than the barrel (lines 25–28). Functionally fine (not a fork); flag
  as a style nit for consistency with the other screens.
- 9 primitive usages; zero hex; no red/amber/green; no `Alert`/destructive.
- Chalk used for the **active progression-ladder rung** (LibraryScreen.tsx:504)
  — the §1l-correct use of chalk (current rung = active).

What Fable must verify against §1k/§1l:
1. §1k browser: search, pattern groups with horizontal/vertical subgroups,
   tier/equipment filters.
2. §1l detail card: name/implement chips; steps; **cues rendered at cue-scale
   type**; **video link-OUT affordance** (external, not inline playback);
   progression ladder vertical with chalk spine on the current rung; beginner
   subset vs full view; **empty-state for legacy content**.
3. LIBRARY tab correctly wired into the tab bar.

Coverage gap: `LibraryScreen.test.js` exists but has only **4 tests** — likely
thin for the §1k/§1l surface area (search, filters, ladder, video link-out,
empty-state). Recommend Fable treat coverage growth as a close condition.

---

## Recommended Fable order
1. WO-UI-3 today-spine semantics (highest Law-2 risk).
2. WO-UI-4 §1l detail card + coverage.
3. WO-UI-2 on-device §1i outcome-line parity (lowest risk; already source-clean).

Nothing here is committed as closed. Each remains Conditional GO / Needs-Review
pending Fable's fidelity call and the screenshot+green bundle.
