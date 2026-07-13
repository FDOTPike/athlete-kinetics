"""
verify_library.py — the movement-library gate (P16 S4).

Executes the real schema chain (001..016) against a real SQLite engine and
asserts the seeded library against the CURATED staging file it was generated
from: row counts, side-car completeness, CHECK-domain membership, equipment
strictness, progression chain integrity, variant rows (audit F3), tier
visibility, and content-structure bounds (audit F5). Deliberately avoids REAL columns so it
stays green on pre-3.41 libsqlite.

Run:  python packages/core-db/test/verify_library.py
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "src" / "schema"
STAGING = Path(__file__).resolve().parents[1] / "staging" / "movement_import.json"

con = sqlite3.connect(":memory:")
con.row_factory = sqlite3.Row

fail = 0
def check(label, ok, detail=""):
    global fail
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  [{detail}]" if detail else ""))
    if not ok:
        fail += 1

print(f"SQLite {sqlite3.sqlite_version}")
print("\n[1] schema chain applies (001..016, twice: self-heal path)")
files = sorted(f for f in SCHEMA_DIR.glob("0*.sql") if not f.name.startswith("004"))
for _ in range(2):
    for f in files:
        con.executescript(f.read_text(encoding="utf-8"))
check("chain applied twice without error (idempotent)", True)
con.execute("PRAGMA foreign_keys = ON")

staging = json.loads(STAGING.read_text(encoding="utf-8"))
curated = [m for m in staging["movements"] if m["curated"]]
# F4 decision (Francis 2026-07-13): BB Glute Bridge / BB Walking Lunge stay
# prefix-encoded (no rows); equipment-distinct variants are rows. Mirrors
# PREFIX_ENCODED in scripts/generate-library-migration.mjs.
PREFIX_ENCODED = {"Barbell Glute Bridge", "Barbell Walking Lunge"}
seeded_expect = sorted(m["name"] for m in curated if m["name"] not in PREFIX_ENCODED)

print("\n[2] row counts and completeness")
n_mv = con.execute("SELECT COUNT(*) FROM movement").fetchone()[0]
check("movement rows = 30 shipped + seeded curated", n_mv == 30 + len(seeded_expect), f"n={n_mv}")
n_det = con.execute("SELECT COUNT(*) FROM movement_detail").fetchone()[0]
check("every movement has a movement_detail side-car", n_det == n_mv, f"detail={n_det}")
orphans = con.execute(
    "SELECT COUNT(*) FROM movement m LEFT JOIN movement_detail d USING(movement_id) WHERE d.movement_id IS NULL"
).fetchone()[0]
check("no movement lacks detail (join check)", orphans == 0)
names_db = {r[0] for r in con.execute("SELECT name FROM movement")}
missing = [n for n in seeded_expect if n not in names_db]
check("every curated (non-prefix-represented) staging record is seeded", not missing, str(missing[:3]))
leaked = [m["name"] for m in staging["movements"] if not m["curated"] and m["name"] in names_db]
check("no uncurated staging record leaked into the DB", not leaked, str(leaked[:3]))


print("\n[3] seeded content quality (the curation contract)")
rows = con.execute("""
  SELECT m.name, d.base_name, d.supported_prefixes, d.difficulty_rating,
         d.target_muscles, d.instructions, d.cues, d.video_placeholder_uri
  FROM movement m JOIN movement_detail d USING(movement_id)
""").fetchall()
by_name = {r["name"]: r for r in rows}
bad_text, bad_json, bad_uri = [], [], []
for n in seeded_expect:
    r = by_name[n]
    if not (r["instructions"].strip() and r["cues"].strip()):
        bad_text.append(n)
    try:
        assert isinstance(json.loads(r["supported_prefixes"]), list)
        assert isinstance(json.loads(r["target_muscles"]), list)
    except Exception:
        bad_json.append(n)
    if not r["video_placeholder_uri"].startswith("https://www.youtube.com/watch?v="):
        bad_uri.append(n)
check("all seeded rows carry instructions + cues", not bad_text, str(bad_text[:3]))
check("prefix/muscle JSON valid on all seeded rows", not bad_json, str(bad_json[:3]))
check("all seeded rows carry one YouTube placeholder URI", not bad_uri, str(bad_uri[:3]))

# Audit F5: the curation contract is structural, not just non-empty.
bad_cues, bad_steps, bad_claims = [], [], []
SENT = re.compile(r"[.!?]")
BANNED = re.compile(
    r"\b(cure|heal(s|ing)?|guarantee|injury[- ]proof|prevent(s|ing)? injur|bulletproof|"
    r"pain[- ]free|insurance|pays out|burn(s)? fat|melt|shred your|doctor|medical|"
    r"prescription|diagnos|therap)\b", re.I)
for n in seeded_expect:
    r = by_name[n]
    n_cues = len([c for c in SENT.split(r["cues"]) if c.strip()])
    n_steps = len([c for c in SENT.split(r["instructions"]) if c.strip()])
    if not (1 <= n_cues <= 3):
        bad_cues.append((n, n_cues))
    if not (2 <= n_steps <= 4):
        bad_steps.append((n, n_steps))
    if BANNED.search(r["instructions"]) or BANNED.search(r["cues"]):
        bad_claims.append(n)
check("every seeded row has 1-3 cues (plan info-density law)", not bad_cues, str(bad_cues[:3]))
check("every seeded row has 2-4 instruction steps (plan law)", not bad_steps, str(bad_steps[:3]))
check("no medical/performance claims in seeded text", not bad_claims, str(bad_claims[:3]))
empty_shipped = [r["name"] for r in rows if r["instructions"].strip() == ""]
check("shipped-content debt is exactly the 30 shipped rows (no seeded row empty)",
      len(empty_shipped) == 30 and not set(empty_shipped) & set(seeded_expect), f"empty={len(empty_shipped)}")
n_tax = con.execute(
    "SELECT COUNT(*) FROM movement_taxonomy t JOIN movement m USING(movement_id) WHERE m.name IN (%s)"
    % ",".join("?" * len(seeded_expect)), seeded_expect).fetchone()[0]
check("every seeded row has a taxonomy side-car", n_tax == len(seeded_expect), f"n={n_tax}")

print("\n[4] variant identity (F4 decision: rows only when equipment-distinct)")
ohp = json.loads(by_name["Overhead Press"]["supported_prefixes"])
check("shipped Overhead Press prefix set NOT mutated", ohp == ["BB", "DB", "KB"], str(ohp))
bws = json.loads(by_name["Bodyweight Squat"]["supported_prefixes"])
check("shipped Bodyweight Squat prefix set NOT mutated", bws == ["Bodyweight"], str(bws))
for variant in ("Cable Shoulder Press", "Dumbbell Squat"):
    check(f"equipment-distinct variant '{variant}' is a row with content",
          variant in by_name and by_name[variant]["instructions"].strip() != "")
for enc in sorted(PREFIX_ENCODED):
    check(f"'{enc}' is prefix-encoded, NOT a row (no duplicate identity)", enc not in names_db)

print("\n[4b] equipment strictness (no rows = bodyweight is load-bearing)")
PREFIX_ITEM = {"BB": "barbell", "DB": "dumbbells", "KB": "kettlebell",
               "Cable": "cable_machine", "Banded": "bands"}
eq = {}
for r in con.execute("SELECT m.name AS name, e.item AS item FROM movement_equipment e JOIN movement m USING(movement_id)"):
    eq.setdefault(r["name"], set()).add(r["item"])
bad_eq = []
for n in seeded_expect:
    first = json.loads(by_name[n]["supported_prefixes"])[0]
    item = PREFIX_ITEM.get(first)
    if item is not None and item not in eq.get(n, set()):
        bad_eq.append(n)
check("every implement-prefixed seeded row demands its implement", not bad_eq, str(bad_eq[:3]))

print("\n[4c] tier visibility (plan law: Beginner + whitelisted Intermediate staples)")
WHITELIST_EXPECT = {
    "Dumbbell Bench Press", "Dumbbell Shoulder Press",
    "Incline Dumbbell Press", "Dumbbell Step-Up", "Dumbbell Split Squat",
    "Cable Shoulder Press", "Straight-Arm Pulldown", "Cable Crunch",
}
wl_rows = {r[0] for r in con.execute(
    "SELECT m.name FROM movement_beginner_whitelist w JOIN movement m USING(movement_id)")}
check("whitelist table holds exactly the 8 ratified staples", wl_rows == WHITELIST_EXPECT,
      str(sorted(wl_rows ^ WHITELIST_EXPECT)))
wl_diffs = {r[0]: r[1] for r in con.execute("""
    SELECT m.name, d.difficulty_rating FROM movement_beginner_whitelist w
    JOIN movement m USING(movement_id) JOIN movement_detail d ON d.movement_id = m.movement_id""")}
check("every whitelisted movement is Intermediate (staples, not Advanced back-doors)",
      all(v == "Intermediate" for v in wl_diffs.values()), str({k: v for k, v in wl_diffs.items() if v != "Intermediate"}))
no_barbell = con.execute("""
    SELECT COUNT(*) FROM movement_beginner_whitelist w
    JOIN movement_equipment e USING(movement_id) WHERE e.item IN ('barbell', 'squat_rack')""").fetchone()[0]
check("ratified rule: no whitelisted movement demands a barbell", no_barbell == 0, f"n={no_barbell}")
# Category derived from movement.pattern exactly as the picker does
# (PATTERN_TO_CATEGORY in inference/types.ts) — the taxonomy side-car is
# sparse for shipped rows and would undercount.
PATTERN_TO_CATEGORY = {
    "squat": "squat", "hinge": "hinge", "push_h": "push", "push_v": "push",
    "pull_h": "row", "pull_v": "row", "lunge": "unilateral",
    "carry": "accessory", "rotation": "core", "isolation": "accessory",
    "locomotion": "cardio",
}
vis = {}
for r in con.execute("""
  SELECT m.pattern AS pattern, d.difficulty_rating AS diff,
         (w.movement_id IS NOT NULL) AS wl
  FROM movement m
  JOIN movement_detail d USING(movement_id)
  LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id"""):
    vis.setdefault(PATTERN_TO_CATEGORY[r["pattern"]], []).append(r["diff"] == "Beginner" or r["wl"] == 1)
uncovered = [c for c, flags in sorted(vis.items()) if not any(flags)]
check("every taxonomy category has a beginner-visible movement (Beginner or whitelisted)",
      not uncovered, str(uncovered))
counts = {c: sum(flags) for c, flags in sorted(vis.items())}
check("beginner-visible pool is non-trivial (>= 2 per loaded category)",
      all(v >= 2 for c, v in counts.items() if c != "cardio"), str(counts))

print("\n[5] progression chains (movement_progression)")
for group, expect_ranks in (("handstand-push-up", [0, 1, 2, 3, 4]), ("pull-up", [0, 1, 2, 3, 4])):
    rows = con.execute("""
      SELECT p.progression_rank, m.name FROM movement_progression p
      JOIN movement m USING(movement_id) WHERE p.progression_group = ?
      ORDER BY p.progression_rank""", (group,)).fetchall()
    got_ranks = [r[0] for r in rows]
    check(f"chain '{group}' complete ranks {expect_ranks}",
          got_ranks == expect_ranks, str([tuple(r) for r in rows]))
dup = con.execute("""
  SELECT COUNT(*) FROM (SELECT progression_group, progression_rank, COUNT(*) c
  FROM movement_progression GROUP BY 1,2 HAVING c > 1)""").fetchone()[0]
check("no duplicate (group, rank)", dup == 0)

print("\n[6] CHECK-domain spot writes (STRICT enforcement)")
try:
    con.execute("INSERT INTO movement_progression (movement_id, progression_group, progression_rank) VALUES (1, 'x', -1)")
    check("negative progression_rank rejected", False)
except sqlite3.IntegrityError:
    check("negative progression_rank rejected", True)
con.rollback()

print(f"\n{'ALL CHECKS PASSED' if fail == 0 else f'{fail} CHECK(S) FAILED'}")
sys.exit(1 if fail else 0)
