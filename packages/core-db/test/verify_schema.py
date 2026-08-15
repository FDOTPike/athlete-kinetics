"""
verify_schema.py â€” executes the real schema files against a real SQLite engine,
loads 30 days of synthetic athlete data, and asserts the full pipeline:
raw sets -> trigger rollup -> windowed view -> materialized state_vector.

Run:  python packages/core-db/test/verify_schema.py
"""
import math
import re
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "src" / "schema"

con = sqlite3.connect(":memory:")
con.row_factory = sqlite3.Row
ver = sqlite3.sqlite_version_info
assert ver >= (3, 37), f"SQLite {sqlite3.sqlite_version} too old for STRICT tables"

# op-sqlite builds with SQLITE_ENABLE_MATH_FUNCTIONS; CPython's bundled SQLite
# may not, so register equivalents if missing.
try:
    con.execute("SELECT ln(2.0), sqrt(2.0)")
except sqlite3.OperationalError:
    con.create_function("ln", 1, lambda x: math.log(x) if x and x > 0 else None)
    con.create_function("sqrt", 1, lambda x: math.sqrt(x) if x is not None and x >= 0 else None)

fail = 0
def check(label, ok, detail=""):
    global fail
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  [{detail}]" if detail else ""))
    if not ok:
        fail += 1

# --- 1. migrations -----------------------------------------------------------
print(f"SQLite {sqlite3.sqlite_version}")
print("\n[1] schema files execute cleanly")
for f in ["001_mechanical_input.sql", "002_telemetry.sql", "003_state_vector.sql",
          "005_subjective_report.sql", "006_user_profile.sql", "007_program_engine.sql",
          "008_taxonomy.sql", "009_periodization.sql", "010_movement_library.sql",
          "011_niggle_tracking.sql", "012_report_severity.sql", "013_profile_slot.sql",
          "014_movement_prefixes.sql", "015_set_prefix.sql"]:
    con.executescript((SCHEMA_DIR / f).read_text(encoding="utf-8"))
    check(f, True)
con.execute("PRAGMA foreign_keys = ON")

# --- 2. synthetic 30-day history --------------------------------------------
print("\n[2] synthetic data: 30 days, train 5/7 days, full telemetry")
D0 = date(2026, 5, 11)
days = [D0 + timedelta(days=i) for i in range(30)]
con.execute("INSERT INTO macro_cycle (macro_cycle_id, name, goal, start_date) VALUES (1,'Block 1','strength',?)", (days[0].isoformat(),))
con.execute("INSERT INTO micro_cycle (micro_cycle_id, macro_cycle_id, week_index, phase) VALUES (1,1,1,'accumulation')")
# movement_id 1 ('Competition Squat') comes from the 007 library seed.

sid = 0
for i, d in enumerate(days):
    if i % 7 in (5, 6):          # rest days
        continue
    sid += 1
    con.execute("INSERT INTO session (session_id, micro_cycle_id, session_date) VALUES (?,1,?)", (sid, d.isoformat()))
    for s in range(1, 6):        # 5 sets x 5 reps @ 140 kg, rpe ramps 6->8.5
        con.execute(
            "INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)"
            " VALUES (?,1,?,5,140,?,0)", (sid, s, 6 + s * 0.5))
for i, d in enumerate(days):
    iso = d.isoformat()
    con.execute("INSERT INTO hrv_daily (date, rmssd_ms) VALUES (?,?)", (iso, 75 + (i % 5) * 4 - 8))
    con.execute("INSERT INTO sleep_daily (date, in_bed_min, asleep_min) VALUES (?,480,?)", (iso, 408 + (i % 4) * 6))
    con.execute("INSERT INTO spo2_daily (date, mean_pct, min_pct, sample_count) VALUES (?,?,93,400)", (iso, 96.0 + (i % 3) * 0.4))
# raw high-frequency stream sanity (PK + checks)
base_ms = 1779000000000
con.executemany("INSERT INTO spo2_sample (epoch_ms, spo2_pct) VALUES (?,?)",
                [(base_ms + i * 1000, 95 + (i % 4)) for i in range(5000)])
con.commit()
check("inserts committed (FK + CHECK + STRICT all enforced)", True)

# --- 3. trigger-maintained rollup vs ground truth ----------------------------
print("\n[3] mech_daily trigger rollup")
row = con.execute("SELECT * FROM mech_daily WHERE date=?", (days[0].isoformat(),)).fetchone()
check("tonnage = 5 sets x 5 reps x 140 kg = 3500", row and row["tonnage_kg"] == 3500.0, f"got {row['tonnage_kg']}")
check("hard_sets (rpe>=8) = 2", row["hard_sets"] == 2, f"got {row['hard_sets']}")
con.execute("UPDATE set_record SET load_kg=150 WHERE set_id=1")
row = con.execute("SELECT tonnage_kg FROM mech_daily WHERE date=?", (days[0].isoformat(),)).fetchone()
check("UPDATE delta: 3500 -> 3550", row["tonnage_kg"] == 3550.0, f"got {row['tonnage_kg']}")
con.execute("DELETE FROM set_record WHERE set_id=1")
row = con.execute("SELECT tonnage_kg, set_count FROM mech_daily WHERE date=?", (days[0].isoformat(),)).fetchone()
check("DELETE delta: 3550 -> 2800, 4 sets", row["tonnage_kg"] == 2800.0 and row["set_count"] == 4)
con.execute("DELETE FROM session WHERE session_id=1")  # cascade -> sets -> rollup
row = con.execute("SELECT tonnage_kg FROM mech_daily WHERE date=?", (days[0].isoformat(),)).fetchone()
check("CASCADE delete drains rollup to 0", row["tonnage_kg"] == 0.0, f"got {row['tonnage_kg']}")
con.execute("INSERT INTO session (session_id, micro_cycle_id, session_date) VALUES (999,1,?)", (days[0].isoformat(),))
for s in range(1, 6):
    con.execute("INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)"
                " VALUES (999,1,?,5,140,?,0)", (s, 6 + s * 0.5))

# --- 4. view + materialization ----------------------------------------------
print("\n[4] state vector materialization (004)")
sql_004 = (SCHEMA_DIR / "004_state_vector_materialize.sql").read_text(encoding="utf-8")
sql_004 = re.sub(r"^--.*$", "", sql_004, flags=re.M)  # strip comment-only lines
target = days[-1].isoformat()
for d in days[-14:]:
    con.execute(sql_004, (d.isoformat(),))
con.commit()
sv = con.execute("SELECT * FROM state_vector WHERE date=?", (target,)).fetchone()
check("row materialized for target date", sv is not None)
check("readiness in [0,100]", 0 <= sv["readiness_score"] <= 100, f"score={sv['readiness_score']}")
check("ACWR ~ 1.0 on steady loading", sv["acwr"] is not None and 0.85 <= sv["acwr"] <= 1.15, f"acwr={round(sv['acwr'],3)}")
check("load_component = 100 in sweet spot", sv["load_component"] == 100.0)
check("hrv_z computed from 28d ln-baseline", sv["hrv_z"] is not None, f"z={round(sv['hrv_z'],3)}")
check("sleep efficiency generated col (85-89%)", 80 <= sv["sleep_efficiency_pct"] <= 95, f"{sv['sleep_efficiency_pct']}")
expected = round((0.35 * sv["hrv_component"]
                  + 0.25 * sv["sleep_component"]) / 0.60, 1)
check("available-input weights renormalize without SpO2 and load", abs(sv["readiness_score"] - expected) < 0.05, f"{sv['readiness_score']} vs {expected}")
n = con.execute(sql_004, (target,))  # idempotent re-run (upsert)
check("re-run is idempotent upsert",
      con.execute("SELECT count(*) c FROM state_vector WHERE date=?", (target,)).fetchone()["c"] == 1)

# ACWR spike scenario: triple the load for the last 3 days, expect penalty
for j, d in enumerate(days[-3:]):
    con.execute("INSERT INTO session (session_id, micro_cycle_id, session_date) VALUES (?,1,?)", (2000 + j, d.isoformat()))
    for s in range(1, 11):
        con.execute("INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)"
                    " VALUES (?,1,?,5,140,9,0)", (2000 + j, s))
con.execute(sql_004, (target,))
sv2 = con.execute("SELECT acwr, load_component FROM state_vector WHERE date=?", (target,)).fetchone()
check("load spike raises ACWR > 1.3", sv2["acwr"] > 1.3, f"acwr={round(sv2['acwr'],3)}")
check("...and load_component is penalized", sv2["load_component"] < 100.0, f"{round(sv2['load_component'],1)}")

# --- 5. SLM read-path query plans --------------------------------------------
print("\n[5] SLM read path uses clustered PK (no scan, no temp B-tree)")
plan = con.execute("EXPLAIN QUERY PLAN SELECT * FROM state_vector WHERE date=?", (target,)).fetchall()
txt = " ".join(r["detail"] for r in plan)
check("point lookup: SEARCH ... PRIMARY KEY", "SEARCH" in txt and "PRIMARY KEY" in txt, txt)
plan = con.execute("EXPLAIN QUERY PLAN SELECT * FROM state_vector WHERE date >= date(?, '-13 days') ORDER BY date", (target,)).fetchall()
txt = " ".join(r["detail"] for r in plan)
check("trend scan: index-ordered, no USE TEMP B-TREE", "TEMP B-TREE" not in txt, txt)
plan = con.execute("EXPLAIN QUERY PLAN SELECT * FROM spo2_sample WHERE epoch_ms BETWEEN ? AND ?", (base_ms, base_ms + 10**6)).fetchall()
txt = " ".join(r["detail"] for r in plan)
check("raw stream range: clustered PK search", "SEARCH" in txt and "PRIMARY KEY" in txt, txt)

# --- 6. subjective report log -------------------------------------------------
print("\n[6] subjective_report (005)")
con.execute(
    "INSERT INTO subjective_report (date, reported_at_ms, raw_text, matched_entry_id,"
    " similarity, halt, load_modifier, set_modifier, rpe_cap)"
    " VALUES (?, 0, 'knee a bit sore', 'pain-mild', 0.72, 0, 0.7, 0, 7.0)",
    (days[-1].isoformat(),))
con.execute(
    "INSERT INTO subjective_report (date, reported_at_ms, raw_text) VALUES (?, 1, 'gibberish input')",
    (days[-1].isoformat(),))
rows = con.execute("SELECT * FROM subjective_report WHERE date=? ORDER BY report_id",
                   (days[-1].isoformat(),)).fetchall()
check("matched + rejected rows both persist", len(rows) == 2)
check("rejected row has NULL routing fields",
      rows[1]["matched_entry_id"] is None and rows[1]["similarity"] is None)
try:
    con.execute("INSERT INTO subjective_report (date, reported_at_ms, raw_text, halt)"
                " VALUES (?, 0, 'x', 2)", (days[-1].isoformat(),))
    check("halt CHECK rejects non-boolean", False)
except sqlite3.IntegrityError:
    check("halt CHECK rejects non-boolean", True)

# --- 7. athlete profile (007 supersedes 006) ------------------------------------
print("\n[7] athlete_profile (007)")
legacy = con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_profile'").fetchone()
check("legacy user_profile dropped by 007", legacy is None)
row = con.execute("SELECT * FROM athlete_profile WHERE profile_id = 1").fetchone()
check("seed row exists with safe defaults",
      row is not None and row["max_sessions_per_day"] == 1 and row["base_rpe_cap"] == 9.0)
check("default inventory is the full equipment list",
      row is not None and '"barbell"' in row["equipment_inventory"]
      and '"mats"' in row["equipment_inventory"])
con.execute("UPDATE athlete_profile SET objective='hybrid', weekly_frequency=5,"
            " injury_flags='[{\"region\":\"knee\",\"note\":\"old MCL\"}]' WHERE profile_id=1")
row = con.execute("SELECT objective, injury_flags FROM athlete_profile").fetchone()
check("'hybrid' objective accepted + JSON flags round-trip",
      row["objective"] == "hybrid" and "MCL" in row["injury_flags"])
try:
    con.execute("UPDATE athlete_profile SET base_rpe_cap = 11 WHERE profile_id = 1")
    check("CHECK rejects rpe cap > 10", False)
except sqlite3.IntegrityError:
    check("CHECK rejects rpe cap > 10", True)
try:
    con.execute("UPDATE athlete_profile SET injury_flags = 'not json' WHERE profile_id = 1")
    check("CHECK rejects malformed JSON", False)
except sqlite3.IntegrityError:
    check("CHECK rejects malformed JSON", True)
try:
    con.execute("UPDATE athlete_profile SET equipment_inventory = 'not json' WHERE profile_id = 1")
    check("CHECK rejects malformed inventory JSON", False)
except sqlite3.IntegrityError:
    check("CHECK rejects malformed inventory JSON", True)
try:
    con.execute("INSERT INTO athlete_profile (profile_id) VALUES (2)")
    check("single-row constraint holds", False)
except sqlite3.IntegrityError:
    check("single-row constraint holds", True)

# --- 8. movement library + equipment requirements (007) -------------------------
print("\n[8] movement library + movement_equipment (007)")
n_mov = con.execute("SELECT count(*) c FROM movement").fetchone()["c"]
check("library seeded (30 movements)", n_mov == 30, str(n_mov))
nordic = con.execute(
    "SELECT me.item FROM movement_equipment me JOIN movement m USING (movement_id)"
    " WHERE m.name = 'Nordic Curl'").fetchall()
check("Nordic Curl requires nordic_bench", [r["item"] for r in nordic] == ["nordic_bench"])
bw = con.execute(
    "SELECT count(*) c FROM movement m WHERE NOT EXISTS"
    " (SELECT 1 FROM movement_equipment me WHERE me.movement_id = m.movement_id)").fetchone()["c"]
check("bodyweight movements need nothing (Push-up, Plank, ...)", bw >= 5, str(bw))
try:
    con.execute("INSERT INTO movement_equipment (movement_id, item) VALUES (1, 'flux_capacitor')")
    check("item CHECK rejects unknown equipment", False)
except sqlite3.IntegrityError:
    check("item CHECK rejects unknown equipment", True)
# re-running the seed block is a no-op (idempotency contract)
before = con.execute("SELECT count(*) c FROM movement_equipment").fetchone()["c"]
con.executescript((SCHEMA_DIR / "007_program_engine.sql").read_text(encoding="utf-8"))
after = con.execute("SELECT count(*) c FROM movement_equipment").fetchone()["c"]
check("007 re-apply is a no-op (idempotent)", before == after, f"{before} == {after}")
row = con.execute("SELECT objective FROM athlete_profile WHERE profile_id = 1").fetchone()
check("007 re-apply preserves customized profile (objective stays 'hybrid')",
      row["objective"] == "hybrid")

# --- 9. block engine tables (007) ------------------------------------------------
print("\n[9] training_block / planned_session / planned_slot (007)")
con.execute("INSERT INTO training_block (block_id, start_date, objective, created_at_ms)"
            " VALUES (1, '2026-06-12', 'hybrid', 0)")
con.execute("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index,"
            " focus, phase, session_date) VALUES (1, 1, 1, 1, 'lower', 'accumulation', '2026-06-12')")
con.execute("INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps,"
            " target_rpe) VALUES (1, 1, 1, 4, 5, 7.5)")
check("block -> session -> slot inserts commit", True)
try:
    con.execute("INSERT INTO planned_session (block_id, week_index, day_index, focus, phase,"
                " session_date) VALUES (1, 5, 1, 'lower', 'deload', '2026-07-10')")
    check("week_index CHECK rejects week 5", False)
except sqlite3.IntegrityError:
    check("week_index CHECK rejects week 5", True)
try:
    con.execute("INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets,"
                " reps, target_rpe) VALUES (1, 2, 1, 4, 5, 4.5)")
    check("target_rpe CHECK rejects < 5.0", False)
except sqlite3.IntegrityError:
    check("target_rpe CHECK rejects < 5.0", True)
try:
    con.execute("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index,"
                " focus, phase, session_date) VALUES (2, 1, 1, 1, 'upper', 'accumulation', '2026-06-12')")
    check("UNIQUE(block, week, day) holds", False)
except sqlite3.IntegrityError:
    check("UNIQUE(block, week, day) holds", True)
con.execute("DELETE FROM training_block WHERE block_id = 1")
orphans = con.execute("SELECT (SELECT count(*) FROM planned_session) +"
                      " (SELECT count(*) FROM planned_slot) AS c").fetchone()["c"]
check("block delete cascades sessions + slots", orphans == 0, str(orphans))

# --- 10. movement_taxonomy skeleton (008) ----------------------------------------
print("\n[10] movement_taxonomy (008) â€” ExRx skeleton")
tax = con.execute("SELECT category, count(*) AS c FROM movement_taxonomy"
                  " GROUP BY category ORDER BY category").fetchall()
check("exactly ONE exercise per category, all 8 categories",
      len(tax) == 8 and all(r["c"] == 1 for r in tax),
      ",".join(r["category"] for r in tax))
bench = con.execute(
    "SELECT mt.category, mt.implement, mt.family FROM movement_taxonomy mt"
    " JOIN movement m ON m.movement_id = mt.movement_id"
    " WHERE m.name = 'Competition Bench'").fetchone()
check("Competition Bench -> push / barbell / bench_press",
      bench is not None and bench["category"] == "push"
      and bench["implement"] == "barbell" and bench["family"] == "bench_press")
# movement_id 6 (Weighted Pull-up) is NOT in the skeleton â€” the rejections
# below exercise the CHECKs, not the primary key.
try:
    con.execute("INSERT INTO movement_taxonomy (movement_id, category) VALUES (6, 'yoga')")
    check("category CHECK rejects unknown class", False)
except sqlite3.IntegrityError:
    check("category CHECK rejects unknown class", True)
try:
    con.execute("INSERT INTO movement_taxonomy (movement_id, category, implement)"
                " VALUES (6, 'row', 'trapbar')")
    check("implement CHECK rejects unknown implement", False)
except sqlite3.IntegrityError:
    check("implement CHECK rejects unknown implement", True)
before_tax = con.execute("SELECT count(*) c FROM movement_taxonomy").fetchone()["c"]
con.executescript((SCHEMA_DIR / "008_taxonomy.sql").read_text(encoding="utf-8"))
after_tax = con.execute("SELECT count(*) c FROM movement_taxonomy").fetchone()["c"]
check("008 re-apply is a no-op (idempotent)", before_tax == after_tax == 8,
      f"{before_tax} == {after_tax}")

# --- 11. periodization side-cars (009) -------------------------------------------
print("\n[11] one_rep_max / block_meta / slot_override / session_note (009)")
con.execute("INSERT INTO one_rep_max (movement_id, load_kg, updated_at_ms) VALUES (1, 150.0, 0)")
con.execute("INSERT INTO one_rep_max (movement_id, load_kg, updated_at_ms) VALUES (1, 155.0, 1)"
            " ON CONFLICT(movement_id) DO UPDATE SET load_kg = excluded.load_kg,"
            " updated_at_ms = excluded.updated_at_ms")
rm = con.execute("SELECT load_kg FROM one_rep_max WHERE movement_id = 1").fetchone()
check("1RM upsert round-trips (150 -> 155)", rm is not None and rm["load_kg"] == 155.0)
try:
    con.execute("INSERT INTO one_rep_max (movement_id, load_kg) VALUES (2, 10.0)")
    check("1RM CHECK rejects implausible load (< 20 kg)", False)
except sqlite3.IntegrityError:
    check("1RM CHECK rejects implausible load (< 20 kg)", True)
con.execute("INSERT INTO training_block (block_id, start_date, objective, created_at_ms)"
            " VALUES (50, '2026-06-15', 'hybrid', 0)")
con.execute("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type)"
            " VALUES (50, 7, 'peak', 'APRE')")
check("block_meta row commits (peak / APRE)", True)
try:
    con.execute("UPDATE block_meta SET schema_type = 'DUP' WHERE block_id = 50")
    check("schema_type CHECK rejects unknown schema", False)
except sqlite3.IntegrityError:
    check("schema_type CHECK rejects unknown schema", True)
try:
    con.execute("UPDATE block_meta SET macro_phase = 'taper' WHERE block_id = 50")
    check("macro_phase CHECK rejects unknown phase", False)
except sqlite3.IntegrityError:
    check("macro_phase CHECK rejects unknown phase", True)
try:
    con.execute("UPDATE block_meta SET macro_block_index = 9 WHERE block_id = 50")
    check("macro_block_index CHECK rejects > 8 (32-week cycle)", False)
except sqlite3.IntegrityError:
    check("macro_block_index CHECK rejects > 8 (32-week cycle)", True)
con.execute("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index,"
            " focus, phase, session_date) VALUES (50, 50, 2, 1, 'lower', 'intensification', '2026-06-22')")
con.execute("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index,"
            " movement_id, sets, reps, target_rpe) VALUES (50, 50, 1, 1, 4, 5, 8.0)")
con.execute("INSERT INTO slot_override (planned_slot_id, target_load_kg, reason, created_at_ms)"
            " VALUES (50, 125.0, 'APRE: +2.5 kg, beat rep target by 2', 0)")
try:
    con.execute("UPDATE slot_override SET reason = '' WHERE planned_slot_id = 50")
    check("slot_override requires a human-readable reason", False)
except sqlite3.IntegrityError:
    check("slot_override requires a human-readable reason", True)
con.execute("DELETE FROM training_block WHERE block_id = 50")
left = con.execute("SELECT (SELECT count(*) FROM block_meta WHERE block_id = 50) +"
                   " (SELECT count(*) FROM slot_override WHERE planned_slot_id = 50) AS c").fetchone()["c"]
check("block delete cascades block_meta + slot_override", left == 0, str(left))
# 9999: session_id 999 is section [3]'s rollup fixture — do not touch it.
con.execute("INSERT INTO session (session_id, session_date) VALUES (9999, '2026-06-12')")
con.execute("INSERT INTO session_note (session_id, note, created_at_ms)"
            " VALUES (9999, 'solid session, grip was the limiter', 0)")
con.execute("DELETE FROM session WHERE session_id = 9999")
notes = con.execute("SELECT count(*) c FROM session_note WHERE session_id = 9999").fetchone()["c"]
check("session delete cascades its note", notes == 0)
before9 = con.execute("SELECT count(*) c FROM one_rep_max").fetchone()["c"]
con.executescript((SCHEMA_DIR / "009_periodization.sql").read_text(encoding="utf-8"))
after9 = con.execute("SELECT count(*) c FROM one_rep_max").fetchone()["c"]
check("009 re-apply is a no-op (idempotent)", before9 == after9, f"{before9} == {after9}")

# --- 12. movement library detail + sentiment (010) -------------------------------
print("\n[12] movement_detail / movement_preference (010) — Phase 12")
n_detail = con.execute("SELECT count(*) c FROM movement_detail").fetchone()["c"]
check("every movement has a detail row (30)", n_detail == 30, str(n_detail))
bench = con.execute(
    "SELECT md.base_name, md.difficulty_rating, md.supported_prefixes FROM movement_detail md"
    " JOIN movement m USING (movement_id) WHERE m.name = 'Dumbbell Bench Press'").fetchone()
comp = con.execute(
    "SELECT md.base_name FROM movement_detail md JOIN movement m USING (movement_id)"
    " WHERE m.name = 'Competition Bench'").fetchone()
check("DB Bench + Competition Bench share base_name 'Bench Press' (stored once)",
      bench["base_name"] == "Bench Press" and comp["base_name"] == "Bench Press")
check("supported_prefixes carries implement tokens as JSON",
      '"DB"' in bench["supported_prefixes"] and '"BB"' in bench["supported_prefixes"])
n_pref = con.execute("SELECT count(*) c FROM movement_preference").fetchone()["c"]
check("movement_preference empty by default (neutral == no row)", n_pref == 0, str(n_pref))

# Throwaway movement to exercise CHECK domains without the block-engine FKs.
con.execute("INSERT INTO movement (movement_id, name, pattern) VALUES (9001, 'Temp Move', 'squat')")
try:
    con.execute("INSERT INTO movement_detail (movement_id, base_name, difficulty_rating)"
                " VALUES (9001, 'X', 'Elite')")
    check("difficulty_rating CHECK rejects unknown tier", False)
except sqlite3.IntegrityError:
    check("difficulty_rating CHECK rejects unknown tier", True)
try:
    con.execute("INSERT INTO movement_detail (movement_id, base_name, supported_prefixes)"
                " VALUES (9001, 'X', 'not json')")
    check("supported_prefixes CHECK rejects malformed JSON", False)
except sqlite3.IntegrityError:
    check("supported_prefixes CHECK rejects malformed JSON", True)
for bad in (2, -2):
    try:
        con.execute("INSERT INTO movement_preference (movement_id, preference) VALUES (9001, ?)", (bad,))
        check(f"preference CHECK rejects {bad}", False)
    except sqlite3.IntegrityError:
        check(f"preference CHECK rejects {bad}", True)
con.execute("INSERT INTO movement_preference (movement_id, preference) VALUES (9001, 1)")
got = con.execute("SELECT preference FROM movement_preference WHERE movement_id = 9001").fetchone()
check("thumbs-up registers +1 (Prioritize)", got["preference"] == 1)
con.execute("INSERT INTO movement_detail (movement_id, base_name) VALUES (9001, 'Temp')")
con.execute("DELETE FROM movement WHERE movement_id = 9001")
left = con.execute("SELECT (SELECT count(*) FROM movement_detail WHERE movement_id = 9001) +"
                   " (SELECT count(*) FROM movement_preference WHERE movement_id = 9001) AS c").fetchone()["c"]
check("movement delete cascades detail + preference", left == 0, str(left))
before10 = con.execute("SELECT count(*) c FROM movement_detail").fetchone()["c"]
con.executescript((SCHEMA_DIR / "010_movement_library.sql").read_text(encoding="utf-8"))
after10 = con.execute("SELECT count(*) c FROM movement_detail").fetchone()["c"]
check("010 re-apply is a no-op (idempotent)", before10 == after10 == 30, f"{before10} == {after10}")

# --- 13. niggle tracking (011) ---------------------------------------------------
print("\n[13] niggle tracking (011) — Phase 12 Step 4")
con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('n1','knee',4,1000)")
con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('n2','lower_back',7,2000)")
nig = con.execute("SELECT region, severity FROM niggle ORDER BY reported_at_ms").fetchall()
check("niggle rows persist (append-only log)",
      len(nig) == 2 and nig[0]["region"] == "knee" and nig[1]["severity"] == 7)
for bad in (0, 11, -1):
    try:
        con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES (?, 'knee', ?, 0)",
                    (f"b{bad}", bad))
        check(f"severity CHECK rejects {bad}", False)
    except sqlite3.IntegrityError:
        check(f"severity CHECK rejects {bad}", True)
try:
    con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('bx','elbowww',4,0)")
    check("region CHECK rejects a non-JOINT region", False)
except sqlite3.IntegrityError:
    check("region CHECK rejects a non-JOINT region", True)
try:
    con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('n1','hip',3,0)")
    check("id PRIMARY KEY rejects a duplicate", False)
except sqlite3.IntegrityError:
    check("id PRIMARY KEY rejects a duplicate", True)
plan_n = con.execute("EXPLAIN QUERY PLAN SELECT region, severity FROM niggle"
                     " WHERE reported_at_ms >= ? ORDER BY reported_at_ms", (0,)).fetchall()
check("today's-niggles read uses idx_niggle_reported (no TEMP B-TREE)",
      "TEMP B-TREE" not in " ".join(r["detail"] for r in plan_n))
before11 = con.execute("SELECT count(*) c FROM niggle").fetchone()["c"]
con.executescript((SCHEMA_DIR / "011_niggle_tracking.sql").read_text(encoding="utf-8"))
after11 = con.execute("SELECT count(*) c FROM niggle").fetchone()["c"]
check("011 re-apply is a no-op (idempotent)", before11 == after11 == 2, f"{before11} == {after11}")

# --- 14. report severity side-car (012) ------------------------------------------
print("\n[14] report_severity (012) — Phase 12 Step 5")
con.execute("INSERT INTO subjective_report (report_id, date, reported_at_ms, raw_text,"
            " matched_entry_id) VALUES (7001, '2026-06-14', 0, 'knee sore', 'pain-mild')")
con.execute("INSERT INTO report_severity (report_id, severity) VALUES (7001, 6)")
joined = con.execute(
    "SELECT sr.matched_entry_id, rs.severity FROM subjective_report sr"
    " LEFT JOIN report_severity rs ON rs.report_id = sr.report_id"
    " WHERE sr.report_id = 7001").fetchone()
check("severity joins back to its report", joined["matched_entry_id"] == "pain-mild" and joined["severity"] == 6)
for bad in (0, 11):
    try:
        con.execute("INSERT INTO report_severity (report_id, severity) VALUES (?, ?)", (8000 + bad, bad))
        check(f"severity CHECK rejects {bad}", False)
    except sqlite3.IntegrityError:
        check(f"severity CHECK rejects {bad}", True)
con.execute("DELETE FROM subjective_report WHERE report_id = 7001")
orphan = con.execute("SELECT count(*) c FROM report_severity WHERE report_id = 7001").fetchone()["c"]
check("report delete cascades its severity row", orphan == 0)
before12 = con.execute("SELECT count(*) c FROM report_severity").fetchone()["c"]
con.executescript((SCHEMA_DIR / "012_report_severity.sql").read_text(encoding="utf-8"))
after12 = con.execute("SELECT count(*) c FROM report_severity").fetchone()["c"]
check("012 re-apply is a no-op (idempotent)", before12 == after12, f"{before12} == {after12}")

# --- 15. profile_slot (013) + wipeActiveBlockState cascade ------------------------
print("\n[15] profile_slot (013) + safe state wipe — Phase 12 Step 6")
slots = con.execute("SELECT slot_id, name, json_extract(profile_json, '$.training_age') AS ta, is_active"
                    " FROM profile_slot ORDER BY slot_id").fetchall()
check("four training-age profile slots seeded",
      len(slots) == 4 and [s["ta"] for s in slots] == ["beginner", "intermediate", "advanced", "elite"])
active_ta = con.execute("SELECT training_age FROM athlete_profile WHERE profile_id = 1").fetchone()["training_age"]
check("exactly one slot active, matching the live athlete_profile training age",
      sum(s["is_active"] for s in slots) == 1 and
      next(s["ta"] for s in slots if s["is_active"] == 1) == active_ta)
check("a slot's profile_json carries a full profile snapshot",
      con.execute("SELECT json_extract(profile_json, '$.objective') AS o,"
                  " json_extract(profile_json, '$.base_rpe_cap') AS r FROM profile_slot WHERE slot_id = 4")
      .fetchone()["o"] is not None)
try:
    con.execute("INSERT INTO profile_slot (slot_id, name, profile_json) VALUES (99, 'x', 'not json')")
    check("profile_json CHECK rejects malformed JSON", False)
except sqlite3.IntegrityError:
    check("profile_json CHECK rejects malformed JSON", True)

# wipeActiveBlockState cascade — seed an active block + today's reports/niggle.
TODAY = days[-1].isoformat()
con.execute("INSERT INTO training_block (block_id, start_date, objective, status, created_at_ms)"
            " VALUES (700, ?, 'hybrid', 'active', 0)", (TODAY,))
con.execute("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type)"
            " VALUES (700, 1, 'gpp', 'LINEAR')")
con.execute("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index,"
            " focus, phase, session_date) VALUES (700, 700, 1, 1, 'lower', 'accumulation', ?)", (TODAY,))
con.execute("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id,"
            " sets, reps, target_rpe) VALUES (700, 700, 1, 1, 4, 5, 8.0)")
con.execute("INSERT INTO slot_override (planned_slot_id, target_load_kg, reason, created_at_ms)"
            " VALUES (700, 120.0, 'test override', 0)")
con.execute("INSERT INTO subjective_report (report_id, date, reported_at_ms, raw_text, matched_entry_id, halt)"
            " VALUES (700, ?, 0, 'knee sore', 'pain-mild', 1)", (TODAY,))
con.execute("INSERT INTO report_severity (report_id, severity) VALUES (700, 6)")
con.execute("INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('w1', 'knee', 5, 9999999999999)")
sets_before = con.execute("SELECT count(*) c FROM set_record").fetchone()["c"]
# The wipe: active block (cascades) + today's subjective reports (cascades) + niggles.
con.execute("DELETE FROM training_block WHERE status = 'active'")
con.execute("DELETE FROM subjective_report WHERE date = ?", (TODAY,))
con.execute("DELETE FROM niggle WHERE reported_at_ms >= 0")
orphans = con.execute(
    "SELECT (SELECT count(*) FROM planned_session WHERE block_id = 700) +"
    " (SELECT count(*) FROM planned_slot WHERE planned_slot_id = 700) +"
    " (SELECT count(*) FROM slot_override WHERE planned_slot_id = 700) +"
    " (SELECT count(*) FROM block_meta WHERE block_id = 700) +"
    " (SELECT count(*) FROM report_severity WHERE report_id = 700) AS c").fetchone()["c"]
check("state wipe cascades cleanly — no orphaned session/slot/override/meta/severity", orphans == 0, str(orphans))
sets_after = con.execute("SELECT count(*) c FROM set_record").fetchone()["c"]
check("state wipe PRESERVES training history (set_record + mech_daily triggers untouched)",
      sets_after == sets_before)
before13 = con.execute("SELECT count(*) c FROM profile_slot").fetchone()["c"]
con.executescript((SCHEMA_DIR / "013_profile_slot.sql").read_text(encoding="utf-8"))
after13 = con.execute("SELECT count(*) c FROM profile_slot").fetchone()["c"]
check("013 re-apply is a no-op (idempotent)", before13 == after13 == 4, f"{before13} == {after13}")

# --- 16. movement_prefix (014) — Phase 13 Step 1 condition multipliers --------
print("\n[16] movement_prefix (014) — Phase 13 Step 1 condition multipliers")
prefRows = con.execute("SELECT prefix_name, cns_load_modifier, stability_requirement_modifier,"
                       " difficulty_modifier FROM movement_prefix ORDER BY prefix_name").fetchall()
check("five baseline condition prefixes seeded", len(prefRows) == 5,
      ",".join(r["prefix_name"] for r in prefRows))
check("all modifiers are positive multipliers (> 0)",
      all(r["cns_load_modifier"] > 0 and r["stability_requirement_modifier"] > 0
          and r["difficulty_modifier"] > 0 for r in prefRows))
for col in ("cns_load_modifier", "stability_requirement_modifier", "difficulty_modifier"):
    try:
        con.execute(f"INSERT INTO movement_prefix (prefix_name, {col}) VALUES ('Bad', 0)")
        check(f"CHECK rejects a non-positive {col}", False)
    except sqlite3.IntegrityError:
        check(f"CHECK rejects a non-positive {col}", True)
try:
    con.execute("INSERT INTO movement_prefix (prefix_name) VALUES ('KB')")
    check("prefix_name PRIMARY KEY rejects a duplicate", False)
except sqlite3.IntegrityError:
    check("prefix_name PRIMARY KEY rejects a duplicate", True)
before14 = con.execute("SELECT count(*) c FROM movement_prefix").fetchone()["c"]
con.executescript((SCHEMA_DIR / "014_movement_prefixes.sql").read_text(encoding="utf-8"))
after14 = con.execute("SELECT count(*) c FROM movement_prefix").fetchone()["c"]
check("014 re-apply is a no-op (idempotent)", before14 == after14 == 5, f"{before14} == {after14}")

# --- 17. set_prefix (015) — Phase 13 Step 2 historical persistence -----------
print("\n[17] set_prefix (015) — Phase 13 Step 2 historical persistence")
sp_ids = [r["set_id"] for r in con.execute(
    "SELECT set_id FROM set_record ORDER BY set_id LIMIT 6").fetchall()]
check("set_record rows exist to attach side-cars to", len(sp_ids) >= 6, str(len(sp_ids)))
con.execute("INSERT INTO set_prefix (set_id, applied_prefixes, cns_load_modifier,"
            " stability_requirement_modifier, difficulty_modifier, effective_load_kg)"
            " VALUES (?, '[\"KB\"]', 1.15, 1.30, 1.10, 161.0)", (sp_ids[0],))
row = con.execute("SELECT applied_prefixes, effective_load_kg FROM set_prefix WHERE set_id = ?",
                  (sp_ids[0],)).fetchone()
check("side-car persists applied_prefixes + effective load",
      row is not None and row["applied_prefixes"] == '["KB"]' and row["effective_load_kg"] == 161.0)
for i, col in enumerate(("cns_load_modifier", "stability_requirement_modifier", "difficulty_modifier")):
    try:
        con.execute(f"INSERT INTO set_prefix (set_id, {col}, effective_load_kg) VALUES (?, 0, 10)",
                    (sp_ids[1 + i],))
        check(f"CHECK rejects a non-positive {col} in set_prefix", False)
    except sqlite3.IntegrityError:
        check(f"CHECK rejects a non-positive {col} in set_prefix", True)
try:
    con.execute("INSERT INTO set_prefix (set_id, effective_load_kg) VALUES (?, -1)", (sp_ids[4],))
    check("CHECK rejects a negative effective_load_kg", False)
except sqlite3.IntegrityError:
    check("CHECK rejects a negative effective_load_kg", True)
try:
    con.execute("INSERT INTO set_prefix (set_id, applied_prefixes, effective_load_kg) VALUES (?, 'not json', 10)",
                (sp_ids[5],))
    check("json_valid CHECK rejects malformed applied_prefixes", False)
except sqlite3.IntegrityError:
    check("json_valid CHECK rejects malformed applied_prefixes", True)
con.execute("DELETE FROM set_record WHERE set_id = ?", (sp_ids[0],))
orphan_sp = con.execute("SELECT count(*) c FROM set_prefix WHERE set_id = ?", (sp_ids[0],)).fetchone()["c"]
check("set_record delete cascades its set_prefix side-car (no orphan)", orphan_sp == 0)

# --- 18. Phase 17 guided-session persistence foundation ----------------------
print("\n[18] Phase 17 guided-session persistence foundation (023)")
p17 = sqlite3.connect(":memory:")
p17.row_factory = sqlite3.Row
p17.execute("PRAGMA foreign_keys = ON")
for migration in sorted(SCHEMA_DIR.glob("0*.sql")):
    if migration.name.startswith("004_"):
        continue
    p17.executescript(migration.read_text(encoding="utf-8"))

policy = {r["name"]: (r["default_sets"], r["target_seconds"]) for r in p17.execute("""
    SELECT m.name, p.default_sets, p.target_seconds
    FROM movement_time_policy p JOIN movement m USING(movement_id)
""")}
check("migration chain seeds the ratified time policy exactly", policy == {
    "Plank": (3, 30),
    "Farmer Carry": (3, 40),
    "Suitcase Carry": (3, 40),
    "Road Run": (1, 1200),
    "BJJ Sparring Round": (5, 300),
    "Trail Running/Walking": (1, 1200),
}, str(policy))

prefs = [tuple(r) for r in p17.execute("""
    SELECT profile_slot_id, session_mode_override, readiness_detail,
           rest_timer_enabled, text_scale
    FROM profile_ui_preference ORDER BY profile_slot_id
""")]
check("023 seeds slot-scoped UI defaults (Beginner summary; others full)", prefs == [
    (1, None, "summary", 1, "system"),
    (2, None, "full", 1, "system"),
    (3, None, "full", 1, "system"),
    (4, None, "full", 1, "system"),
], str(prefs))
p17.execute("UPDATE profile_ui_preference SET session_mode_override='guided', text_scale='large' WHERE profile_slot_id=1")
p17.executescript((SCHEMA_DIR / "023_phase17_session_foundation.sql").read_text(encoding="utf-8"))
custom_pref = p17.execute("SELECT session_mode_override, text_scale FROM profile_ui_preference WHERE profile_slot_id=1").fetchone()
check("023 re-apply preserves an athlete's UI preference override",
      custom_pref is not None and tuple(custom_pref) == ("guided", "large"))
try:
    p17.execute("UPDATE profile_ui_preference SET rest_timer_enabled=2 WHERE profile_slot_id=1")
    check("UI preference CHECK rejects a non-boolean timer", False)
except sqlite3.IntegrityError:
    check("UI preference CHECK rejects a non-boolean timer", True)

plank_id = p17.execute("SELECT movement_id FROM movement WHERE name='Plank'").fetchone()["movement_id"]
p17.execute("UPDATE movement_coaching_intent SET coaching_intent='Build a stable trunk that carries into every loaded movement.' WHERE movement_id=?", (plank_id,))
intent = p17.execute("SELECT coaching_intent FROM movement_coaching_intent WHERE movement_id=?", (plank_id,)).fetchone()
check("coaching-intent side-car round-trips reviewed copy", intent is not None and "stable trunk" in intent["coaching_intent"])
try:
    p17.execute("UPDATE movement_coaching_intent SET coaching_intent='   ' WHERE movement_id=?",
                (p17.execute("SELECT movement_id FROM movement WHERE name='Farmer Carry'").fetchone()["movement_id"],))
    check("coaching-intent CHECK rejects blank copy", False)
except sqlite3.IntegrityError:
    check("coaching-intent CHECK rejects blank copy", True)

p17.execute("INSERT INTO training_block (block_id, start_date, objective, created_at_ms) VALUES (2300, '2026-07-15', 'gpp', 0)")
p17.execute("""INSERT INTO planned_session
    (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
    VALUES (2300, 2300, 1, 1, 'conditioning', 'accumulation', '2026-07-15')""")
p17.execute("""INSERT INTO planned_slot
    (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
    VALUES (2300, 2300, 1, ?, 3, 1, 7.0)""", (plank_id,))
p17.execute("INSERT INTO planned_slot_target (planned_slot_id, target_kind, target_seconds) VALUES (2300, 'time', 30)")
plan_target = p17.execute("SELECT target_kind, target_reps, target_seconds FROM planned_slot_target WHERE planned_slot_id=2300").fetchone()
check("planned-slot target freezes a time union", plan_target is not None and tuple(plan_target) == ("time", None, 30))
try:
    p17.execute("UPDATE planned_slot_target SET target_reps=5 WHERE planned_slot_id=2300")
    check("slot-target XOR CHECK rejects mixed reps/time targets", False)
except sqlite3.IntegrityError:
    check("slot-target XOR CHECK rejects mixed reps/time targets", True)

p17.execute("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (2300, '2026-07-15', 1000)")
p17.execute("""INSERT INTO session_plan_slot
    (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps,
     provenance_kind, target_rpe, source_planned_slot_id)
    VALUES (2300, 2300, 0, ?, 3, NULL, 'planned', 7.0, 2300)""", (plank_id,))
p17.execute("INSERT INTO session_slot_target (session_plan_slot_id, target_kind, target_seconds) VALUES (2300, 'time', 30)")
p17.execute("""INSERT INTO session_runner_checkpoint
    (session_id, session_mode, phase, current_session_plan_slot_id, current_set_index,
     rest_target_seconds, rest_started_at_ms, runner_state_json, updated_at_ms)
    VALUES (2300, 'guided', 'working', 2300, 1, 0, NULL, '{}', 1000)""")
p17.execute("""UPDATE session_runner_checkpoint
    SET phase='resting', rest_target_seconds=120, rest_started_at_ms=1000
    WHERE session_id=2300""")
checkpoint = p17.execute("SELECT phase, rest_target_seconds, rest_started_at_ms FROM session_runner_checkpoint WHERE session_id=2300").fetchone()
check("runner checkpoint persists a valid resting boundary", checkpoint is not None and tuple(checkpoint) == ("resting", 120, 1000))
try:
    p17.execute("UPDATE session_runner_checkpoint SET rest_target_seconds=30 WHERE session_id=2300")
    check("runner checkpoint rejects rest outside the contract", False)
except sqlite3.IntegrityError:
    check("runner checkpoint rejects rest outside the contract", True)
try:
    p17.execute("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (2301, '2026-07-15', 0)")
    p17.execute("""INSERT INTO session_runner_checkpoint
        (session_id, session_mode, phase, rest_target_seconds, runner_state_json)
        VALUES (2301, 'self_directed', 'complete', 0, 'not json')""")
    check("runner checkpoint rejects malformed serialized state", False)
except sqlite3.IntegrityError:
    check("runner checkpoint rejects malformed serialized state", True)

p17.execute("DELETE FROM session WHERE session_id=2300")
child_rows = p17.execute("""
    SELECT (SELECT count(*) FROM session_plan_slot WHERE session_id=2300)
         + (SELECT count(*) FROM session_slot_target WHERE session_plan_slot_id=2300)
         + (SELECT count(*) FROM session_runner_checkpoint WHERE session_id=2300) AS c
""").fetchone()["c"]
check("session delete cascades frozen session target + runner checkpoint", child_rows == 0, str(child_rows))
p17.execute("DELETE FROM training_block WHERE block_id=2300")
check("block delete cascades its frozen planned target",
      p17.execute("SELECT count(*) c FROM planned_slot_target WHERE planned_slot_id=2300").fetchone()["c"] == 0)

p17.execute("INSERT INTO profile_slot (slot_id, name, profile_json) VALUES (99, 'Test', '{\"training_age\":\"advanced\"}')")
p17.execute("""INSERT INTO profile_ui_preference
    (profile_slot_id, readiness_detail, rest_timer_enabled, text_scale)
    VALUES (99, 'full', 1, 'system')""")
p17.execute("DELETE FROM profile_slot WHERE slot_id=99")
check("profile-slot delete cascades its UI preferences",
      p17.execute("SELECT count(*) c FROM profile_ui_preference WHERE profile_slot_id=99").fetchone()["c"] == 0)
# --- 19. Phase 18 immutable training-decision side-cars ----------------------
print("\n[19] Phase 18 immutable training-decision side-cars (026)")
dose_columns = [r["name"] for r in p17.execute("PRAGMA table_info(set_dose_target)")]
check("dose snapshot stores only the reps/time union",
      dose_columns == ["set_id", "target_kind", "target_reps", "target_seconds"],
      str(dose_columns))
check("dose snapshot has no RPE, load, or band judgment columns",
      all(token not in " ".join(dose_columns).lower() for token in ("rpe", "load", "band")))

for session_id in range(2600, 2611):
    p17.execute("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (?, '2026-07-16', 1000)",
                (session_id,))
for set_id in range(2600, 2604):
    p17.execute("""INSERT INTO set_record
        (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
        VALUES (?, 2600, ?, ?, 1, 0, 8, 1100)""",
        (set_id, plank_id, set_id - 2599))
p17.execute("INSERT INTO set_dose_target (set_id, target_kind, target_reps) VALUES (2600, 'reps', 5)")
p17.execute("INSERT INTO set_dose_target (set_id, target_kind, target_seconds) VALUES (2601, 'time', 30)")
doses = [tuple(r) for r in p17.execute("""
    SELECT set_id, target_kind, target_reps, target_seconds
    FROM set_dose_target ORDER BY set_id
""")]
check("repetition and timed dose snapshots round-trip exactly",
      doses == [(2600, "reps", 5, None), (2601, "time", None, 30)], str(doses))
for label, statement in [
    ("mixed reps/time dose", "INSERT INTO set_dose_target (set_id, target_kind, target_reps, target_seconds) VALUES (2602, 'reps', 5, 30)"),
    ("missing timed dose", "INSERT INTO set_dose_target (set_id, target_kind) VALUES (2603, 'time')"),
]:
    try:
        p17.execute(statement)
        check(f"026 rejects {label}", False)
    except sqlite3.IntegrityError:
        check(f"026 rejects {label}", True)
for label, statement in [
    ("dose UPDATE", "UPDATE set_dose_target SET target_reps=8 WHERE set_id=2600"),
    ("dose REPLACE", "INSERT OR REPLACE INTO set_dose_target (set_id, target_kind, target_reps) VALUES (2600, 'reps', 8)"),
    ("direct dose DELETE", "DELETE FROM set_dose_target WHERE set_id=2600"),
]:
    try:
        p17.execute(statement)
        check(f"immutability trigger rejects {label}", False)
    except sqlite3.IntegrityError:
        check(f"immutability trigger rejects {label}", True)
p17.execute("DELETE FROM set_record WHERE set_id=2601")
check("set-record parent deletion cascades its immutable dose snapshot",
      p17.execute("SELECT count(*) c FROM set_dose_target WHERE set_id=2601").fetchone()["c"] == 0)

P18_OUTCOME_SQL = """INSERT INTO session_outcome (
    session_id, outcome_kind, terminal_phase, halt_reason, origin_kind,
    session_mode, training_age, slot_count, planned_set_count, logged_set_count,
    exact_dose_count, under_dose_count, over_dose_count, unknown_dose_count,
    unmapped_set_count, missing_set_count, missing_unskipped_set_count,
    extra_set_count, adapted_slot_count, skipped_slot_count, off_plan_slot_count,
    finalized_at_ms, engine_version
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""
def p18_outcome_row(session_id, kind, phase, halt_reason, evidence, origin="planned"):
    return (session_id, kind, phase, halt_reason, origin, "guided", "beginner",
            *evidence, 2600000 + session_id, 1)
P18_FOLLOWED = (1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
P18_EMPTY = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
P18_ADAPTED = (1, 2, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0)
P18_UNMAPPED_OFF_PLAN = (0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)

p17.execute(P18_OUTCOME_SQL,
            p18_outcome_row(2600, "followed_plan", "complete", None, P18_FOLLOWED))
p17.execute(P18_OUTCOME_SQL,
            p18_outcome_row(2601, "stopped_safely", "halted", "niggle", P18_EMPTY))
p17.execute(P18_OUTCOME_SQL,
            p18_outcome_row(2609, "adapted_session", "complete", None, P18_ADAPTED))
p17.execute(P18_OUTCOME_SQL,
            p18_outcome_row(2610, "session_recorded", "complete", None, P18_UNMAPPED_OFF_PLAN))
outcomes = [tuple(r) for r in p17.execute("""
    SELECT session_id, outcome_kind, terminal_phase, halt_reason
    FROM session_outcome ORDER BY session_id
""")]
check("complete, adapted, directive-halt, and unmapped neutral outcomes round-trip",
      outcomes == [
        (2600, "followed_plan", "complete", None),
        (2601, "stopped_safely", "halted", "niggle"),
        (2609, "adapted_session", "complete", None),
        (2610, "session_recorded", "complete", None),
      ], str(outcomes))

invalid_outcomes = [
    ("zero-set manual halt", p18_outcome_row(2602, "stopped_safely", "halted", "manual", P18_EMPTY)),
    ("zero-set completion", p18_outcome_row(2603, "session_recorded", "complete", None, P18_EMPTY)),
    ("terminal/label mismatch", p18_outcome_row(2604, "followed_plan", "halted", "safety", P18_FOLLOWED)),
    ("negative evidence", p18_outcome_row(2605, "session_recorded", "complete", None,
        (0, 0, 1, -1, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0))),
    ("impossible per-slot set count", p18_outcome_row(2606, "session_recorded", "complete", None,
        (1, 101, 1, 1, 0, 0, 0, 0, 100, 100, 0, 0, 0, 0))),
    ("unknown outcome kind", p18_outcome_row(2607, "rewarded", "complete", None, P18_FOLLOWED)),
    ("unknown halt reason", p18_outcome_row(2608, "stopped_safely", "halted", "ego", P18_EMPTY)),
]
for label, row in invalid_outcomes:
    try:
        p17.execute(P18_OUTCOME_SQL, row)
        check(f"026 rejects {label}", False)
    except sqlite3.IntegrityError:
        check(f"026 rejects {label}", True)

replace_followed = P18_OUTCOME_SQL.replace("INSERT INTO", "INSERT OR REPLACE INTO", 1)
for label, statement, params in [
    ("outcome UPDATE", "UPDATE session_outcome SET outcome_kind='session_recorded' WHERE session_id=2600", ()),
    ("outcome REPLACE", replace_followed, p18_outcome_row(2600, "session_recorded", "complete", None, P18_FOLLOWED)),
    ("direct outcome DELETE", "DELETE FROM session_outcome WHERE session_id=2600", ()),
]:
    try:
        p17.execute(statement, params)
        check(f"immutability trigger rejects {label}", False)
    except sqlite3.IntegrityError:
        check(f"immutability trigger rejects {label}", True)

p17.execute("DELETE FROM session WHERE session_id=2600")
p17.execute("DELETE FROM session WHERE session_id=2601")
children = p17.execute("""
    SELECT (SELECT count(*) FROM set_dose_target WHERE set_id BETWEEN 2600 AND 2603)
         + (SELECT count(*) FROM session_outcome WHERE session_id IN (2600,2601)) AS c
""").fetchone()["c"]
check("parent set/session deletion cascades both immutable Phase 18 side-cars",
      children == 0, str(children))

# --- [20] Calibration Policy v1: return_checkin_ack (055) ---------------------
# An acknowledgement ledger, not a dose record. Numerical return modifiers are
# deferred, so the table must carry no applied-dose column at all.
print("\n[20] return_checkin_ack (055)")
sql_055 = (SCHEMA_DIR / "055_return_checkin_ack.sql").read_text(encoding="utf-8")
p17.executescript(sql_055)
p17.execute("INSERT INTO return_checkin_ack VALUES ('2026-07-01', 'continue_plan', 1000)")
rc = p17.execute("SELECT * FROM return_checkin_ack WHERE last_qualifying_date='2026-07-01'").fetchone()
check("return_checkin_ack row persists", rc is not None and rc["acknowledged_action"] == "continue_plan")

cols = {r["name"] for r in p17.execute("PRAGMA table_info(return_checkin_ack)")}
check("055 carries ONLY the acknowledgement columns (no applied-dose column)",
      cols == {"last_qualifying_date", "acknowledged_action", "acknowledged_at_ms"}, str(sorted(cols)))
check("055 SQL mentions no dose modifier",
      not re.search(r"multiplier|rpe_cap|applied_modifier", sql_055, re.I))

# One row per DETECTED GAP: a repeat acknowledgement of the same qualifying date
# is ignored, which is what suppresses a duplicate prompt.
p17.execute("INSERT OR IGNORE INTO return_checkin_ack VALUES ('2026-07-01', 'review_first_session', 2000)")
again = p17.execute("SELECT acknowledged_action, COUNT(*) c FROM return_checkin_ack WHERE last_qualifying_date='2026-07-01'").fetchone()
check("repeat acknowledgement for the same gap is ignored", again["c"] == 1 and again["acknowledged_action"] == "continue_plan")

try:
    p17.execute("INSERT INTO return_checkin_ack VALUES ('2026-07-02', 'fresh_block', 1000)")
    check("055 CHECK rejects an unratified action", False)
except sqlite3.IntegrityError:
    check("055 CHECK rejects an unratified action", True)

try:
    p17.execute("INSERT INTO return_checkin_ack VALUES ('01-07-2026', 'continue_plan', 1000)")
    check("055 CHECK rejects a malformed qualifying date", False)
except sqlite3.IntegrityError:
    check("055 CHECK rejects a malformed qualifying date", True)

print(f"\n{'ALL CHECKS PASSED' if fail == 0 else f'{fail} CHECK(S) FAILED'}")
sys.exit(1 if fail else 0)
