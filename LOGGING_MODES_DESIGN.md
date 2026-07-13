# Logging modes (reps / time) + band levels — RATIFIED & IMPLEMENTED
Proposed 2026-07-13 · Ratified by Francis 2026-07-14 · Implemented same day (migration 018 + store + minimal functional UI)

## Francis's rulings (verbatim intent)
1. Band ladder as personal ordinals — **yes**.
2. **Time only.** Distance dropped for carries: "it means the same thing —
   the intention should go behind the WHY of the movement being chosen for
   that particular athlete." Distance does not exist in the schema.
3. Time-based movements **join progression** — the app serves any fitness or
   athletic goal.

## As implemented

### Data (migration 018)
- `movement_logging_mode(movement_id PK, mode CHECK('reps','time'))` — no row
  = reps. Seeded time: Plank, Road Run, BJJ Sparring Round, Farmer Carry,
  Suitcase Carry.
- `set_metric(set_id, metric CHECK('time_s','band_level'), value, PK(set_id, metric))`
  — composite key: a banded plank carries BOTH a time and a band level.
- `band_ladder(level PK, label)` — the athlete's own ordinals (colors/brands
  are theirs); empty until defined in Profile.
- `progression_policy(progression_group PK, required_sets, required_value)` —
  per-chain advancement: a time chain qualifies on SECONDS, a custom rep
  chain overrides the engine's 3×8 default. No row = default.

### Store
- `Movement.loggingMode` exposed ('reps' | 'time').
- `logSet` ENFORCES time mode: reps forced to 1, seconds required (refuses
  otherwise); persists time_s / band_level to set_metric.
- `resolveGoalRung` feeds COALESCE(time_s, reps) into the resolver and applies
  the per-chain policy — a plank chain progresses on held seconds.

### UI (minimal-functional only; aesthetics await the pikeMethods template)
- Time-mode movements: the REPS stepper becomes SECONDS (5s steps, 5–3600).
- Bodyweight movements: load initializes to 0 and reads "ADDED KG
  (0 = bodyweight)"; loaded movements start at 100 kg as before.
- Band picker + band-ladder Profile editor: DESIGNED, not built — lands with
  the redesign. Until then band_level has storage + progression semantics but
  no input surface.
- Logged-set list still renders "1 × kg" for timed sets — display debt,
  redesign scope.

## Known debt (owned, not hidden)
Band ladder UI/API; timed-set display; generator prescription of seconds
(blockGenerator still prescribes rep targets — P17/P18 scope); no banded
progression chain exists yet to consume band_level.
