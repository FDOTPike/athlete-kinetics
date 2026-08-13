-- =============================================================================
-- 052_bounded_microcycle_roles.sql
-- Uncapped major selection, bounded lift-family dose, contextual assistance,
-- true accessory roles, and frozen routine stress decisions.
-- =============================================================================

-- This contract is NOT the capability/progression graph. It groups only
-- movements that may carry major lift-family stress and assigns the coefficient
-- used by Σ(coefficient × prescribed volume).
CREATE TABLE IF NOT EXISTS movement_lift_family (
  movement_id       INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  family            TEXT NOT NULL CHECK (family IN
                      ('squat','deadlift','bench_press','overhead_press',
                       'horizontal_pull','vertical_pull','power_clean')),
  stress_coefficient REAL NOT NULL CHECK (stress_coefficient BETWEEN 0.25 AND 1.25),
  preferred_purpose TEXT CHECK (preferred_purpose IS NULL OR preferred_purpose IN
                      ('heavy','volume','technique','speed','low_fatigue'))
) STRICT;

INSERT OR IGNORE INTO movement_lift_family
  (movement_id, family, stress_coefficient, preferred_purpose)
SELECT m.movement_id, v.column2, v.column3, v.column4
FROM (VALUES
  ('Competition Squat','squat',1.00,NULL),
  ('Front Squat','squat',0.90,NULL),
  ('Front Squat (Clean Grip)','squat',0.90,NULL),
  ('Box Squat','squat',0.90,'heavy'),
  ('Box Squat with Bands','squat',1.00,'heavy'),
  ('Reverse Band Box Squat','squat',0.80,'technique'),
  ('Speed Box Squat','squat',0.65,'speed'),
  ('Squat with Bands','squat',1.00,'heavy'),
  ('Wide Stance Barbell Squat','squat',0.95,NULL),
  ('Narrow Stance Squats','squat',0.90,NULL),
  ('Barbell Squat To A Bench','squat',0.85,'technique'),
  ('Front Barbell Squat To A Bench','squat',0.85,'technique'),
  ('Double Kettlebell Front Squat','squat',0.70,'volume'),
  ('Zercher Squat','squat',0.85,NULL),
  ('Jefferson Squats','squat',0.80,NULL),
  ('Barbell Hack Squat','squat',0.85,NULL),
  ('Goblet Squat','squat',0.55,'low_fatigue'),
  ('Dumbbell Squat','squat',0.55,'volume'),
  ('Dumbbell Sumo Squat','squat',0.55,'volume'),
  ('Deadlift','deadlift',1.00,NULL),
  ('Sumo Deadlift','deadlift',1.00,NULL),
  ('Deficit Deadlift','deadlift',1.05,'heavy'),
  ('Deadlift with Bands','deadlift',1.05,'heavy'),
  ('Reverse Band Deadlift','deadlift',0.85,'technique'),
  ('Reverse Band Sumo Deadlift','deadlift',0.85,'technique'),
  ('Sumo Deadlift with Bands','deadlift',1.00,'heavy'),
  ('Stiff-Legged Barbell Deadlift','deadlift',0.90,'volume'),
  ('Romanian Deadlift','deadlift',0.85,'volume'),
  ('Dumbbell Romanian Deadlift','deadlift',0.60,'low_fatigue'),
  ('Cable Deadlifts','deadlift',0.60,'low_fatigue'),
  ('Competition Bench','bench_press',1.00,NULL),
  ('Barbell Bench Press - Medium Grip','bench_press',1.00,NULL),
  ('Bench Press - With Bands','bench_press',1.05,'heavy'),
  ('Board Press','bench_press',0.90,'heavy'),
  ('Pin Presses','bench_press',0.90,'heavy'),
  ('Close-Grip Bench Press','bench_press',0.85,'volume'),
  ('Barbell Incline Bench Press - Medium Grip','bench_press',0.85,'volume'),
  ('Decline Bench Press','bench_press',0.90,'volume'),
  ('Floor Press','bench_press',0.80,'technique'),
  ('Dumbbell Bench Press','bench_press',0.65,'volume'),
  ('Dumbbell Bench Press with Neutral Grip','bench_press',0.62,'volume'),
  ('Dumbbell Floor Press','bench_press',0.60,'technique'),
  ('Incline Dumbbell Press','bench_press',0.65,'volume'),
  ('One Arm Dumbbell Bench Press','bench_press',0.60,'technique'),
  ('One-Arm Kettlebell Floor Press','bench_press',0.55,'technique'),
  ('Overhead Press','overhead_press',1.00,NULL),
  ('Shoulder Press - With Bands','overhead_press',1.00,'heavy'),
  ('Standing Dumbbell Press','overhead_press',0.70,'volume'),
  ('Seated Dumbbell Press','overhead_press',0.65,'volume'),
  ('Dumbbell Shoulder Press','overhead_press',0.65,'volume'),
  ('Cable Shoulder Press','overhead_press',0.60,'low_fatigue'),
  ('Seated Cable Shoulder Press','overhead_press',0.58,'low_fatigue'),
  ('Arnold Press','overhead_press',0.65,'volume'),
  ('Alternating Kettlebell Press','overhead_press',0.65,'technique'),
  ('Kettlebell Seated Press','overhead_press',0.60,'technique'),
  ('Kettlebell Seesaw Press','overhead_press',0.65,'speed'),
  ('Double Kettlebell Push Press','overhead_press',0.85,'speed'),
  ('Barbell Row','horizontal_pull',1.00,NULL),
  ('Bent Over Barbell Row','horizontal_pull',1.00,NULL),
  ('Reverse Grip Bent-Over Rows','horizontal_pull',0.95,'volume'),
  ('T-Bar Row','horizontal_pull',0.85,'volume'),
  ('Chest-Supported Dumbbell Row','horizontal_pull',0.70,'low_fatigue'),
  ('Single-Arm Dumbbell Row','horizontal_pull',0.65,'volume'),
  ('Bent Over Two-Dumbbell Row','horizontal_pull',0.70,'volume'),
  ('Bent Over Two-Dumbbell Row With Palms In','horizontal_pull',0.68,'volume'),
  ('Cable Row','horizontal_pull',0.60,'low_fatigue'),
  ('Seated Cable Rows','horizontal_pull',0.60,'low_fatigue'),
  ('One-Arm Dumbbell Row','horizontal_pull',0.65,'technique'),
  ('One-Arm Kettlebell Row','horizontal_pull',0.60,'technique'),
  ('Two-Arm Kettlebell Row','horizontal_pull',0.65,'volume'),
  ('Weighted Pull-up','vertical_pull',1.00,NULL),
  ('Pull-Up','vertical_pull',0.85,'volume'),
  ('Chin-up','vertical_pull',0.82,'volume'),
  ('V-Bar Pullup','vertical_pull',0.80,'volume'),
  ('Lat Pulldown','vertical_pull',0.62,'low_fatigue'),
  ('Wide-Grip Lat Pulldown','vertical_pull',0.62,'low_fatigue'),
  ('Close-Grip Front Lat Pulldown','vertical_pull',0.62,'low_fatigue'),
  ('Power Clean','power_clean',1.00,'speed'),
  ('Kettlebell Dead Clean','power_clean',0.55,'technique')
) AS v
JOIN movement m ON m.name = v.column1;

-- Explicit contextual assistance. Distance, not the movement taxonomy or the
-- capability graph, controls whether a candidate is supplementary/accessory.
CREATE TABLE IF NOT EXISTS movement_assistance_relationship (
  major_family TEXT NOT NULL CHECK (major_family IN
                 ('squat','deadlift','bench_press','overhead_press',
                  'horizontal_pull','vertical_pull','power_clean')),
  movement_id  INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  distance     INTEGER NOT NULL CHECK (distance BETWEEN 1 AND 3),
  stress_factor REAL NOT NULL CHECK (stress_factor BETWEEN 0.05 AND 1.00),
  fatigue_cost REAL NOT NULL CHECK (fatigue_cost BETWEEN 0.10 AND 5.00),
  reason       TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 120),
  PRIMARY KEY (major_family, movement_id)
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO movement_assistance_relationship
  (major_family, movement_id, distance, stress_factor, fatigue_cost, reason)
SELECT v.column1, m.movement_id, v.column3, v.column4, v.column5, v.column6
FROM (VALUES
  ('squat','Romanian Deadlift',1,0.45,2.2,'Posterior-chain support for squat strength'),
  ('squat','Bulgarian Split Squat',1,0.40,2.0,'Unilateral leg strength for the squat family'),
  ('squat','Barbell Hip Thrust',1,0.38,1.8,'Hip-extension support for the squat family'),
  ('deadlift','Barbell Hip Thrust',1,0.38,1.8,'Hip-extension volume with less spinal loading'),
  ('deadlift','Bulgarian Split Squat',1,0.35,2.0,'Unilateral leg support for deadlift strength'),
  ('deadlift','Chest-Supported Dumbbell Row',1,0.30,1.5,'Upper-back support with less spinal loading'),
  ('bench_press','Incline Dumbbell Press',1,0.38,1.7,'Pressing support through a different angle'),
  ('bench_press','Barbell Row',1,0.30,2.0,'Upper-back support for stable pressing'),
  ('bench_press','Triceps Pushdown',1,0.24,1.0,'Direct elbow-extension support for bench pressing'),
  ('overhead_press','Pull-Up',1,0.30,1.8,'Vertical-pull support around overhead pressing'),
  ('overhead_press','Incline Dumbbell Press',1,0.34,1.7,'Additional shoulder and pressing support'),
  ('overhead_press','Face Pull',1,0.20,0.8,'Scapular and rear-shoulder support'),
  ('horizontal_pull','Pull-Up',1,0.34,1.8,'Vertical-pull support for horizontal pulling'),
  ('horizontal_pull','Face Pull',1,0.20,0.8,'Scapular and rear-shoulder support'),
  ('vertical_pull','Barbell Row',1,0.36,2.0,'Horizontal-pull strength supporting vertical pulling'),
  ('vertical_pull','Face Pull',1,0.20,0.8,'Scapular support for vertical pulling'),
  ('power_clean','Front Squat',1,0.42,2.2,'Receiving-position and leg-strength support'),
  ('power_clean','Romanian Deadlift',1,0.42,2.2,'Posterior-chain strength for force production'),
  ('power_clean','Overhead Press',1,0.34,1.8,'Upper-body force-transfer support'),

  ('horizontal_pull','Hammer Curl',1,0.20,0.8,'Direct elbow-flexor support after pulling work'),
  ('vertical_pull','Hammer Curl',1,0.20,0.8,'Direct elbow-flexor support after pulling work'),
  ('squat','Hammer Curl',2,0.10,0.6,'Low-fatigue elbow-flexor work away from squat stress'),
  ('bench_press','Hammer Curl',2,0.10,0.6,'Low-fatigue elbow-flexor balance after bench work'),
  ('deadlift','Hammer Curl',2,0.10,0.6,'Low-fatigue elbow-flexor work after hinge stress'),
  ('overhead_press','Hammer Curl',2,0.10,0.6,'Low-fatigue elbow-flexor balance after overhead work'),
  ('power_clean','Hammer Curl',2,0.10,0.6,'Low-fatigue elbow-flexor work after power training'),

  ('squat','Standing Barbell Calf Raise',2,0.12,0.8,'Calf capacity not covered by the selected squat dose'),
  ('squat','Standing Dumbbell Calf Raise',2,0.10,0.6,'Low-fatigue calf work after squat training'),
  ('squat','Barbell Seated Calf Raise',2,0.10,0.7,'Seated calf work after squat training'),
  ('squat','Calf Raise On A Dumbbell',2,0.10,0.5,'Low-fatigue calf work after squat training'),
  ('squat','Calf Raises - With Bands',3,0.08,0.4,'Very low-fatigue calf work after squat training'),
  ('deadlift','Standing Dumbbell Calf Raise',2,0.10,0.6,'Low-fatigue lower-leg work after deadlifting'),
  ('deadlift','Calf Raises - With Bands',3,0.08,0.4,'Very low-fatigue lower-leg work after deadlifting'),

  ('horizontal_pull','Cable Wrist Curl',2,0.10,0.6,'Forearm work beyond the selected pulling stimulus'),
  ('horizontal_pull','Finger Curls',2,0.10,0.5,'Low-fatigue grip work after pulling'),
  ('horizontal_pull','Seated Dumbbell Palms-Down Wrist Curl',2,0.10,0.5,'Forearm extensor work after pulling'),
  ('vertical_pull','Cable Wrist Curl',2,0.10,0.6,'Forearm work beyond the selected pulling stimulus'),
  ('vertical_pull','Finger Curls',2,0.10,0.5,'Low-fatigue grip work after pulling'),
  ('deadlift','Finger Curls',2,0.10,0.5,'Low-fatigue grip work after deadlifting'),
  ('deadlift','Seated Dumbbell Palms-Up Wrist Curl',2,0.10,0.5,'Forearm flexor work after deadlifting'),
  ('power_clean','Finger Curls',2,0.10,0.5,'Low-fatigue grip work after power training'),

  ('bench_press','Band External Rotation',2,0.10,0.5,'Low-fatigue rotator-cuff work after bench pressing'),
  ('bench_press','Band Pull-Apart',2,0.10,0.5,'Low-fatigue rear-shoulder work after bench pressing'),
  ('overhead_press','Band External Rotation',2,0.10,0.5,'Low-fatigue rotator-cuff work after overhead pressing'),
  ('overhead_press','Band Pull-Apart',2,0.10,0.5,'Low-fatigue rear-shoulder work after overhead pressing'),
  ('horizontal_pull','Band External Rotation',2,0.10,0.5,'Low-fatigue shoulder work after pulling'),
  ('vertical_pull','Band Pull-Apart',2,0.10,0.5,'Low-fatigue rear-shoulder work after pulling'),

  ('squat','Pallof Press',2,0.12,0.7,'Low-fatigue trunk work after squat training'),
  ('squat','Dead Bug',3,0.08,0.4,'Low-fatigue trunk control after squat training'),
  ('deadlift','Pallof Press',2,0.12,0.7,'Low-fatigue trunk work after hinge training'),
  ('deadlift','Dead Bug',3,0.08,0.4,'Low-fatigue trunk control after hinge training'),
  ('bench_press','Dead Bug',3,0.08,0.4,'Low-fatigue trunk control after bench work'),
  ('overhead_press','Pallof Press',2,0.12,0.7,'Low-fatigue trunk work after overhead pressing'),
  ('power_clean','Pallof Press',2,0.12,0.7,'Low-fatigue trunk work after power training')
) AS v
JOIN movement m ON m.name = v.column2;

-- Rebuild the role child table to admit accessory and converge policy. Only
-- conditional rows are inherited; major/supplementary/accessory are derived
-- from the curated contracts above. Future movements receive no automatic role.
DROP TRIGGER IF EXISTS trg_movement_supplementary_ai;
DROP TABLE IF EXISTS movement_role_eligibility_v052;
CREATE TABLE IF NOT EXISTS movement_role_eligibility_v052 (
  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('major','supplementary','accessory','conditional')),
  PRIMARY KEY (movement_id, role)
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO movement_role_eligibility_v052 (movement_id, role)
SELECT movement_id, role FROM movement_role_eligibility WHERE role = 'conditional';
INSERT OR IGNORE INTO movement_role_eligibility_v052 (movement_id, role)
SELECT movement_id, 'major' FROM movement_lift_family;
INSERT OR IGNORE INTO movement_role_eligibility_v052 (movement_id, role)
SELECT movement_id, 'supplementary' FROM movement_lift_family;
INSERT OR IGNORE INTO movement_role_eligibility_v052 (movement_id, role)
SELECT movement_id, 'supplementary' FROM movement_assistance_relationship WHERE distance = 1;
INSERT OR IGNORE INTO movement_role_eligibility_v052 (movement_id, role)
SELECT movement_id, 'accessory' FROM movement_assistance_relationship WHERE distance >= 2;

DROP TABLE movement_role_eligibility;
ALTER TABLE movement_role_eligibility_v052 RENAME TO movement_role_eligibility;

-- SQLite cannot widen the shipped role/slot CHECKs in place. This child-only
-- table rebuild preserves every template row while making slot count unbounded.
DROP TABLE IF EXISTS routine_template_slot_v052;
CREATE TABLE IF NOT EXISTS routine_template_slot_v052 (
  routine_template_slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_template_id      INTEGER NOT NULL REFERENCES routine_template ON DELETE CASCADE,
  day_index                INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  slot_index               INTEGER NOT NULL CHECK (slot_index >= 1),
  role                     TEXT NOT NULL CHECK (role IN ('major','supplementary','accessory','conditional')),
  movement_id              INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  sets                     INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 10),
  reps                     INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 100),
  target_rpe               REAL NOT NULL CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  UNIQUE (routine_template_id, day_index, slot_index)
) STRICT;

INSERT INTO routine_template_slot_v052
  (routine_template_slot_id, routine_template_id, day_index, slot_index,
   role, movement_id, sets, reps, target_rpe)
SELECT routine_template_slot_id, routine_template_id, day_index, slot_index,
       role, movement_id, sets, reps, target_rpe
FROM routine_template_slot;

DROP TABLE routine_template_slot;
ALTER TABLE routine_template_slot_v052 RENAME TO routine_template_slot;
CREATE INDEX IF NOT EXISTS idx_routine_slot_template
  ON routine_template_slot (routine_template_id, day_index, slot_index);

-- Freeze the exact routine day and the human-reviewable analysis. These are
-- athlete-local because each athlete owns a separate SQLite database.
CREATE TABLE IF NOT EXISTS planned_session_routine_context (
  planned_session_id   INTEGER PRIMARY KEY REFERENCES planned_session ON DELETE CASCADE,
  routine_day_index    INTEGER NOT NULL CHECK (routine_day_index BETWEEN 1 AND 7),
  family_decisions_json TEXT NOT NULL CHECK (
                          json_valid(family_decisions_json)
                          AND json_type(family_decisions_json) = 'array'
                          AND json_array_length(family_decisions_json) >= 1
                        ),
  warnings_json         TEXT NOT NULL CHECK (
                          json_valid(warnings_json) AND json_type(warnings_json) = 'array'
                        ),
  recommendations_json  TEXT NOT NULL CHECK (
                          json_valid(recommendations_json) AND json_type(recommendations_json) = 'array'
                        ),
  adaptations_json      TEXT NOT NULL CHECK (
                          json_valid(adaptations_json) AND json_type(adaptations_json) = 'array'
                        )
) STRICT;

CREATE TABLE IF NOT EXISTS planned_slot_routine_decision (
  planned_slot_id    INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('major','supplementary','accessory','conditional')),
  lift_family        TEXT CHECK (lift_family IS NULL OR lift_family IN
                       ('squat','deadlift','bench_press','overhead_press',
                        'horizontal_pull','vertical_pull','power_clean')),
  stress_purpose     TEXT CHECK (stress_purpose IS NULL OR stress_purpose IN
                       ('heavy','volume','technique','speed','low_fatigue')),
  stress_coefficient REAL NOT NULL CHECK (stress_coefficient BETWEEN 0 AND 1.25),
  equivalent_volume  REAL NOT NULL CHECK (equivalent_volume >= 0),
  stress_dose        REAL NOT NULL CHECK (stress_dose >= 0),
  adaptations_json   TEXT NOT NULL CHECK (
                       json_valid(adaptations_json) AND json_type(adaptations_json) = 'array'
                     ),
  CHECK (
    (role = 'major' AND lift_family IS NOT NULL AND stress_purpose IS NOT NULL
      AND stress_coefficient > 0)
    OR
    (role <> 'major' AND lift_family IS NULL AND stress_purpose IS NULL
      AND stress_coefficient = 0 AND equivalent_volume = 0 AND stress_dose = 0)
  )
) STRICT;
