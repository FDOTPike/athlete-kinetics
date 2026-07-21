# pikeMethods — UI design brief
Paste this entire document into Claude as the design prompt. It is the complete
context; do not assume anything beyond it. Written by the app's lead designer
against the shipped codebase — every screen and state listed here already
exists and works.

---

You are designing the complete visual system for **pikeMethods** (exact
casing: lowercase p, uppercase M), an offline-first strength & conditioning
app built in React Native for Android (iOS later). The engineering is done;
the app currently wears placeholder styling. You are replacing its skin, not
its skeleton — every screen, state, and copy string below is fixed
functionality your design must serve.

## 1. Brand
- Wordmark: **pikeMethods** — white, strong (bold/heavy weight), on a sleek
  black background. The lowercase-p/uppercase-M casing is non-negotiable.
- Direction: minimalist, clean, confident. Think professional coaching
  notebook, not fitness-influencer app. Monochrome-first: near-black
  backgrounds, white/grey typographic hierarchy. If you introduce an accent
  color, introduce AT MOST ONE, used only for the current/active element —
  and make the case for it. A pure weight/size/opacity hierarchy with zero
  accent is an acceptable and welcome proposal.
- Anti-dashboard, high-focus: show only what matters now. No cards nested in
  cards, no rings, no gradients-as-decoration, no glassmorphism, no confetti.

## 2. Context of use (design for THIS, not for screenshots)
- The athlete is mid-workout: sweaty hands, chalk, phone on a bench, 3-second
  glances between sets. Primary numbers must be readable at arm's length.
  Primary actions (log a set) must be hittable without looking carefully —
  oversized touch targets, generous spacing from destructive actions.
- One-handed use is the norm. Bottom-weighted primary actions.
- Gym lighting varies from dim to harsh — the black theme must hold contrast
  in both (WCAG AA minimum on all text; AAA on the mid-set numbers).
- Sessions last 45–90 min with the screen mostly off. Cold glances, not
  browsing. Every screen answers one question fast: "what do I do now?"

## 3. Hard constraints (engineering-enforced; violating these voids the design)
- React Native (Hermes) on 4 GB Android devices: no blur effects, no heavy
  shadows, no animated gradients, no full-screen re-renders per timer tick.
  Motion budget: opacity/transform only, 200ms max, and every animation must
  be skippable by the OS reduced-motion setting.
- 100% offline. No web fonts fetched at runtime — one bundled typeface
  family (propose it; system fonts acceptable; a single bundled variable
  font is the ceiling).
- Videos NEVER play in-app: a movement's video is a link that opens
  externally. Design the affordance as a link-out, not a player.
- OS text-scale must be honored to its maximum setting without truncating
  the mid-set numbers or the four outcome lines. Design at 1.0x and 2.0x.
- Every interactive element needs an accessibility label; focus order is
  part of the spec you deliver, not an afterthought.

## 4. The tier contract (a LAW, machine-checked in this codebase)
Two presentation tiers driven by athlete experience:
- **Beginner** — calm and small: a movement shows base name, which implement,
  at most 3 cues, one video link. Guided session mode: one movement at
  center stage, next-up preview, rest timer (silent, visual, no shame),
  oversized log controls. Beginners never see: autopilot internals, tempo
  detail, variation lists, science screens.
- **Non-beginner** — denser, faster, self-directed: full library, variations,
  condition toggles (Chains/Earthquake Bar etc.), autopilot detail. Same
  skeleton, more information per square inch. Never patronising.
Design BOTH tiers for every screen that differs.

## 5. Screen inventory (all exist today; design each, with states)
1. **ONBOARDING** — one-decision-per-screen questionnaire wizard; tier-aware
   (beginners skip advanced questions). Progress affordance, no percentage.
2. **READY (home)** — today's readiness + what today holds (planned session /
   rest day). Rest days are presented as a first-class positive state, never
   an empty state. This screen is the app's face — the wordmark lives here.
3. **SESSION** — the workhorse. States: no-session idle; active self-directed
   (movement picker grouped Back→horizontal/vertical etc., implement chips,
   condition chips, REPS-or-SECONDS stepper, ADDED-KG stepper for bodyweight,
   RPE, oversized LOG SET, logged-set list with edit/delete); active guided
   (P17 runner: center-stage movement + cues, sets/reps/target, rest
   countdown between sets, next-up preview, thumbs-down → substitution
   offer sheet); post-finalization idle showing ONE quiet outcome line
   (copy in §6). Include the halt flow (a safety stop is a dignified,
   prominent, non-scary action — never buried, never alarming red panic).
4. **BLOCK** — the 4-week plan overview: weeks, sessions, phases
   (accumulation/deload etc.), substitution badges. Liquid-calendar feel:
   a missed day is simply not highlighted — no red, no guilt.
5. **LIBRARY (movement browser + detail card)** — search + filters
   (pattern group with horizontal/vertical subgroups, equipment, tier);
   detail card: name, implement chips, instructions (2–4 plain steps),
   1–3 cues (these are the product's soul — give them typographic priority),
   video link-out, progression-chain position when the movement belongs to
   one (e.g. Push-Up → … → Handstand Push-Up as a quiet vertical ladder,
   current rung marked). Beginner sees the calm subset; advanced sees all.
   Empty-state for the 30 legacy movements whose long-form content is
   pending.
6. **ATHLETE/PROFILE** — profile settings, equipment inventory picker
   (13 items incl. Machine/Smith/Sled/Suspension/Trap Bar…), band ladder
   editor (personal ordinals: level + label), Coach Mode (athlete list,
   add/rename/switch/delete with double-confirm), and the collapsed
   **"Training decisions"** disclosure: latest 20 dates + one of four neutral
   labels each. No counts, no percentages, no trends. Styled like a clinical
   log, not a trophy room.

## 6. Fixed copy (verbatim; the design gives it a home)
Post-session quiet line — Beginner:
- "You followed today's plan. Recover well."
- "You adjusted the session and kept the work appropriate."
- "Stopping was the right call. Recovery is part of the plan."
- "Your session is saved. Continue from here next time."
Non-beginner: "Plan followed." / "Session adapted." / "Session stopped
safely." / "Session recorded."
All four must carry IDENTICAL visual weight — stopping safely may not look
like a lesser outcome than following the plan. This is a product law.

## 7. What this app must never look like
No streaks, flames, rings, badges, points, levels, confetti, PR fireworks,
social anything, notification nagging, or engagement-bait. Rest and safety
halts get the same dignity as heavy lifting. If a design element could make
an athlete train when they shouldn't, it is wrong.

## 8. Deliverables (in this order, all implementable in RN StyleSheet)
1. **Design tokens** — full palette (name + hex + usage), type scale
   (family, sizes, weights, line-heights), spacing scale, radii, touch-target
   minimums, motion spec. Deliver as a token table AND a TypeScript
   `theme.ts` object.
2. **Component inventory** — button hierarchy, steppers, chips (implement/
   condition/filter), list rows, disclosure, sheet, timer ring/bar (rest
   countdown — pick a form that reads at a glance without being a
   "progress ring" celebration), input fields, tab bar. Each with states
   (default/pressed/disabled/focused) and both text scales.
3. **Screen-by-screen specs** — layout, hierarchy, and state variants for
   every screen in §5, both tiers where they differ. Wireframe-level HTML/SVG
   mockups are welcome; pixel-perfection is not required — DECISIONS are.
4. **The two Phase-18 surfaces** — quiet outcome line placement + the
   Training decisions disclosure, designed to be almost boring on purpose.
5. **Accessibility spec** — focus order per screen, label conventions,
   contrast table, 2.0x text-scale behavior notes.
Work top-down: tokens first, get those right, everything else inherits.
If a requirement here conflicts with a design instinct, the requirement wins;
say so and move on. Where the brief is silent, choose the calmer option.
