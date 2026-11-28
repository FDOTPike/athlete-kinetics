# Owner-Ratified Warm-Up Presets Bounds & Copy Manifest (`WO-WARMUP-01` & `WO-WARMUP-02`)

**Owner Ratification Record (`2026-11-28`):**
- Product & architectural rulings `A1`–`A5` ratified by Francis (`2026-11-28T16:19:17+11:00`).
- Numeric bounds (`083_warmup_presets.sql`) and user-facing copy manifest (`WP-01`–`WP-29`) ratified verbatim by Francis (`2026-11-28T16:23:50+11:00`: *"Approve all proposed 083 numeric bounds (24 presets, 12 items, 1–5 sets, 1–100 reps, 5–1800s) and WP-01..WP-29 strings in WARMUP_PRESETS_SPEC_AND_COPY_MANIFEST.md as-is — dispatch Hydrogen now"*).

Per `.agents/rules/coding-rules-general.md` (`Rule §1`), implementation code MUST render ONLY strings from this ratified manifest or pre-existing approved codebase constants (`PREHAB_DISCLAIMER`, `PREHAB_STOP_RULE`, `STOP_GENERAL`, `STOP_JOINT`, `MUSCLE_GROUP_INFO`), and MUST enforce ONLY the ratified numeric bounds below.

---

## 1. Ratified Numeric Bounds & Schema Invariants (`083_warmup_presets.sql`)

- `MAX_WARMUP_PRESETS = 24`
- `MAX_WARMUP_PRESET_ITEMS = 12` (`item_order BETWEEN 0 AND 11`)
- `PRESET_NAME_MIN_LEN = 1`, `PRESET_NAME_MAX_LEN = 60` (trimmed)
- `CUSTOM_DRILL_TITLE_MIN_LEN = 1`, `CUSTOM_DRILL_TITLE_MAX_LEN = 120` (trimmed)
- `CUE_NOTE_MAX_LEN = 240` (`NULL` or `length(trim(cue_note)) BETWEEN 1 AND 240`)
- `PRESET_ITEM_SETS_MIN = 1`, `PRESET_ITEM_SETS_MAX = 5`, `DEFAULT_PRESET_ITEM_SETS = 1`
- `PRESET_DOSE_REPS_MIN = 1`, `PRESET_DOSE_REPS_MAX = 100`, `DEFAULT_PRESET_DOSE_REPS = 10` (step `1`)
- `PRESET_DOSE_SECONDS_MIN = 5`, `PRESET_DOSE_SECONDS_MAX = 1800`, `DEFAULT_PRESET_DOSE_SECONDS = 30` (step `5` `< 120`, `30` `>= 120`)
- `DEFAULT_INCLUDE_RAMP_SETS = true` (`1`)
- `resetTrainingData` policy: preserve `warmup_preset`, `warmup_preset_item`, and `warmup_session_type_assignment`; explicitly clear `planned_session_warmup_override` before `planned_session`.

---

## 2. Ratified User-Facing Copy (`WP-01` – `WP-29`)

| ID | Exact Ratified String / Template |
|---|---|
| `WP-01` | `'WARM-UP PRESETS'` |
| `WP-02` | `'Build saved warm-up routines for general preparedness (GPP), weakness prehab, or physio exercises, and assign them by session type.'` |
| `WP-03` | `'Manage warm-up presets'` / `'Hide warm-up presets'` |
| `WP-04` | `'No warm-up presets saved yet. Sessions use the automatic warm-up until you assign a preset.'` |
| `WP-05` | `'New warm-up preset'` / `'Edit'` / `'Delete'` / `'Confirm delete'` / `'Keep preset'` |
| `WP-06` | Label: `'Preset name'` · Placeholder: `'For example: Lower body prehab or Physio shoulder'` |
| `WP-07` | Label: `'Purpose'` · `'gpp'`: `'General preparedness (GPP)'` · `'prehab'`: `'Prehab & weaknesses'` · `'rehab'`: `'Rehab or physio'` |
| `WP-08` | Label: `'Weakness or target area (optional)'` · None chip: `'None'` |
| `WP-09` | `'elbow_tendon'`: `'Elbow tendon'` · `'shoulder_cuff'`: `'Shoulder rotator cuff'` · `'knee_patellar'`: `'Knee & patellar tendon'` · `'achilles_calf'`: `'Achilles & calf'` · `'hip_groin'`: `'Hip & groin'` · `'low_back_core'`: `'Lower back & trunk'` · `'wrist_forearm'`: `'Wrist & forearm'` |
| `WP-10` | Label: `'Include first-lift warm-up sets'` · Caption: `'Adds an unloaded rehearsal and 40% / 80% preparation sets for your first loaded exercise.'` |
| `WP-11` | `` `WARM-UP ITEMS (${items.length} of 12)` `` |
| `WP-12` | `'Built-in & prehab'` · `'Exercise library'` · `'Physio or custom'` |
| `WP-13` | Name label: `'Exercise name'` · Placeholder: `'For example: Banded wall slide'` · Cue label: `'Cue or physio note (optional)'` · Cue placeholder: `'For example: 3 second lowering, stay pain-free'` |
| `WP-14` | Kind chips: `'Reps'` / `'Seconds'` · Sets stepper: `'Sets'` · Amount stepper: `'Reps per set'` / `'Seconds per set'` · Side chip: `'Each side'` |
| `WP-15` | `'Add item'` · `'Move up'` · `'Move down'` · `'Remove'` |
| `WP-16` | `'Save preset'` · `'Cancel'` |
| `WP-17` | Missing name: `'Enter a name for this warm-up preset.'` · Empty items: `'Add at least one warm-up item before saving.'` · Missing custom title: `'Enter an exercise name for this item.'` · Preset cap: `'Up to 24 warm-up presets can be saved. Delete one to add another.'` · Item cap: `'Each preset holds up to 12 items.'` |
| `WP-18` | Heading: `'SESSION WARM-UP DEFAULTS'` · Hint: `'Choose which preset runs for each session type. Specific session types override Default.'` |
| `WP-19` | `'Automatic warm-up'` |
| `WP-20` | `'default'`: `'Default (all sessions)'` · `'upper'`: `'Upper body'` · `'lower'`: `'Lower body'` · `'full'`: `'Full body'` · `'push'`: `'Push'` · `'pull'`: `'Pull'` · `'legs'`: `'Legs'` · `'accessories'`: `'Accessories'` · `'conditioning'`: `'Conditioning'` · `'bjj'`: `'Sport & grappling'` · `'free_form'`: `'Unplanned session'` |
| `WP-21` | `` `Warm-up: ${activePresetName ?? 'Automatic warm-up'}` `` |
| `WP-22` | `'Change warm-up'` |
| `WP-23` | `` `Warm-up preset: ${preset.name} (${purposeLabel}).` `` |
| `WP-24` | `` `Target area: ${targetLabel}.` `` |
| `WP-25` | `` `${sets} sets · ${describePreparationDose(dose)}` `` |
| `WP-26` | `'Move smoothly and stay within a comfortable range.'` |
| `WP-27` | `` `${sets > 1 ? `Complete ${sets} easy preparation sets` : 'Complete 1 easy preparation set'} of ${movementName} with light or bodyweight resistance.` `` |
| `WP-28` | `` `${sets > 1 ? `Complete ${sets} sets.` : 'Complete as prescribed.'}${cueNote ? ` ${cueNote}` : ''}` `` |
| `WP-29` | `` `This session is estimated at about ${totalMin} minutes including your ${prepMin}-minute warm-up preset, which is over your ${capMin}-minute session limit. Your saved warm-up items were kept as written.` `` |
