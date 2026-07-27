# AK_HISTORY_V1 Import Specification & Template

`AK_HISTORY_V1` is a plain-text format for offline import of training history into Athlete Kinetics (`pikeMethods`).

## Format Rules

1. **Header Requirement:** The document MUST start with `AK_HISTORY_V1` on the first non-comment line.
2. **Comments:** Lines starting with `#` or blank lines are ignored.
3. **Session Boundary:** Each session starts with `SESSION` and ends with `END_SESSION`.
4. **Delimiters:** Fields within lines are separated by pipe characters (`|`).

## Record Definitions

### Session Record
`SESSION|YYYY-MM-DD|duration_minutes(optional)|session_rpe(optional)`
- `YYYY-MM-DD`: ISO-8601 date string.
- `duration_minutes`: Integer or float (optional).
- `session_rpe`: Float between 5.0 and 10.0 (optional).

### Set Record
`SET|movement_name|set_index|reps|load_kg|rpe(optional)|seconds(optional)`
- `movement_name`: Exact string match with a movement in the library (case-sensitive).
- `set_index`: 1-based sequential integer per movement in session.
- `reps`: Completed repetition count (integer ≥ 0).
- `load_kg`: Added load in kilograms (float ≥ 0).
- `rpe`: Perceived exertion between 5.0 and 10.0 (optional).
- `seconds`: Timed duration in seconds (optional).

### End Session Record
`END_SESSION`

---

## Copyable 3-Session Template

An athlete or AI assistant can copy and customize the text block below:

```text
AK_HISTORY_V1

# Session 1: Squat & Pull
SESSION|2026-06-01|45|7.5
SET|Competition Squat|1|5|100|7.0|
SET|Competition Squat|2|5|100|7.5|
SET|Competition Squat|3|5|100|8.0|
SET|Pull-Up|1|8|0|7.0|
SET|Pull-Up|2|8|0|7.5|
SET|Pull-Up|3|8|0|8.0|
END_SESSION

# Session 2: Bench Press
SESSION|2026-06-03|50|8.0
SET|Competition Bench|1|5|80|7.5|
SET|Competition Bench|2|5|80|8.0|
SET|Competition Bench|3|5|80|8.5|
END_SESSION

# Session 3: Deadlift
SESSION|2026-06-05|40|8.0
SET|Deadlift|1|5|140|7.5|
SET|Deadlift|2|5|140|8.0|
SET|Deadlift|3|5|140|8.5|
END_SESSION
```
