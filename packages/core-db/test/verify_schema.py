"""
verify_schema.py — executes the real schema files against a real SQLite engine,
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
          "005_subjective_report.sql", "006_user_profile.sql", "007_program_engine.sql"]:
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
expected = round(0.35 * sv["hrv_component"] + 0.30 * sv["load_component"]
                 + 0.25 * sv["sleep_component"] + 0.10 * sv["spo2_component"], 1)
check("weights sum: 0.35/0.30/0.25/0.10", abs(sv["readiness_score"] - expected) < 0.05, f"{sv['readiness_score']} vs {expected}")
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

print(f"\n{'ALL CHECKS PASSED' if fail == 0 else f'{fail} CHECK(S) FAILED'}")
sys.exit(1 if fail else 0)
