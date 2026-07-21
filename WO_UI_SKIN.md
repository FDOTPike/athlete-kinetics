# WO-UI — the pikeMethods skin (approved design → screens)
Design source (CANONICAL): `pikeMethods Design.dc.html` in Francis's
design-handoff folder — sections 1a–1n. Ratified by the lead designer.
Foundation ALREADY LANDED: `apps/mobile/src/theme/theme.ts` (tokens),
`palette` remapped onto it (whole app already recolored), tab bar respecced.
Builder: ~~Sol~~ **ANTIGRAVITY** (Sol quota exhausted, 2026-07-20). One WO per
screen; STOP at each checkpoint with screenshots.

## ANTIGRAVITY-SPECIFIC GUARDRAILS (non-negotiable; history-informed)
A prior Antigravity session shipped unapproved migrations and dependencies,
costing a full remediation. Therefore, for every UI WO:
1. **Touch ONLY the screen file(s) named by the WO** plus its test file. No
   new dependencies, no scripts, no migrations, no store/engine changes, no
   package.json edits, no "helpful" extras. Needing anything outside the
   WO's file list = STOP and put it in the checkpoint bundle as a question.
2. The shared primitives in `components/ui/` and `theme/theme.ts` are
   FROZEN — consume them, never modify them. A primitive that doesn't fit
   is a checkpoint question, not an edit.
3. Before every checkpoint: `npm run typecheck` AND `npm run
   verify:components` green, plus the zero-hex grep on the touched screen.
   Include all three outputs in the bundle — a checkpoint without them is
   incomplete and will be bounced.
4. Never mark your own checkpoint passed. Fable reviews; Francis commits.
5. Behavior is frozen (Law 6). If a Text/Pressable needs its handler or
   store selector changed to match the design, STOP and escalate.

## Laws (violating any = failed WO)
1. Zero hex literals in screen files — every color/size/spacing from `theme`.
2. Chalk marks CURRENT/ACTIVE only. Never reward, never warning, never
   destructive. Selected chips = inverted white fill, not chalk.
3. No red/amber/green may be reintroduced. The deprecated palette aliases
   (`green/amber/red`) must be RETIRED from each screen you touch — replace
   with the semantically correct token per the design section.
4. Touch: primary log action 72pt; everything else ≥56pt; ≥16pt gap from
   destructive actions. Motion: opacity/transform, 160/200ms, reduced-motion→0.
5. Copy strings are fixed (P18 outcomes, cues); the design gives them a home,
   never edits them.
6. Functional behavior is FROZEN — these are styling+layout WOs. If a design
   requires a behavior change, STOP and escalate.

## WO-UI-0 — Archivo + shared primitives (first, everything inherits)
- Download Archivo variable TTF (fonts.google.com/specimen/Archivo →
  download family, use `Archivo-VariableFont_wdth,wght.ttf`) →
  `apps/mobile/assets/fonts/`, wire `react-native.config.js` assets +
  `npx react-native-asset`. Verify the family renders on-device.
- Build shared components in `apps/mobile/src/components/ui/` from design
  §1b: `PrimaryButton` (+pressed/disabled/focused), `SecondaryButton`,
  `TertiaryButton`, `QuietAction`, `Stepper` (88pt pads, value-hero),
  `Chip` (selected=inverted, disabled=45% ink1), `ListRow` (64pt, 3pt
  chalk spine variant, NOW/✓ trailing), `Disclosure`, `Sheet` (r10, 200ms),
  `RestTimerCard` (3pt chalk draining top edge — ONE Animated.timing scaleX
  for the whole duration, numerals update 1/s), `TabBarSpine` already done.
- Checkpoint UI-0: component screenshots at 1.0x and 2.0x.

## WO-UI-1 — READY (design §1c beginner-training, §1d rest-day)
Rest day is a first-class state: "Rest day. / That's the work." display type,
readiness rows as quiet list, no empty-state feel. Wordmark top-left.

## WO-UI-2 — SESSION (§1e guided, §1f rest-between-sets, §1g self-directed,
§1h halt+substitution sheets, §1i post-session quiet line)
The workhorse. Guided: center-stage movement, cue typography (cue > body),
next-up line, RestTimerCard. Self-directed: denser list, chips, steppers,
72pt LOG SET. Halt = full-width Secondary (outlined), never buried, no alarm
styling. Post-finalization idle shows the ONE quiet outcome line — all four
outcomes typographically identical (this is machine-checkable copy; §1i).

## WO-UI-3 — BLOCK (§1j)
Liquid calendar: chalk spine on today only; missed days simply unmarked.
Phase labels as eyebrows; substitution badges as tertiary chips.

## WO-UI-4 — LIBRARY (§1k browser, §1l detail card) — NEW SCREEN
Browser: search, pattern groups with horizontal/vertical subgroups, tier/
equipment filters. Detail card: name/implement chips/steps/cues (cues get
cue-scale type), video link-OUT affordance, progression ladder (vertical,
chalk spine on current rung), beginner subset vs full view, empty-state for
legacy content. Wire into the tab bar (LIBRARY tab exists in design).

## WO-UI-5 — ATHLETE (§1m) + ONBOARDING (§1n)
Profile groups as quiet lists; equipment picker chips; band ladder editor;
Coach Mode list with double-confirm delete (destructive = QuietAction with
16pt isolation, NOT red); Training-decisions disclosure (20 rows, 4 labels,
clinical-log styling). Onboarding: one decision per screen, display-type
question, chip answers, no progress percentage.

## Checkpoints (each WO)
Bundle = screenshots (all states, both tiers where they differ, 1.0x + 2.0x)
+ `npm run typecheck` + `verify:components` green + zero-hex grep proof
(`grep -n "#[0-9A-Fa-f]\{6\}" <screen>` returns nothing). Fable reviews
fidelity against the design section before the next WO starts.
verify:components grows per screen: assert tab spine present, halt button
accessibility, outcome-line copy rendering, chip selected-state semantics.
