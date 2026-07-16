"""
verify_library.py — the movement-library gate (P16 S4).

Executes the real schema chain (001..021) against a real SQLite engine and
asserts the seeded library against the CURATED staging file it was generated
from: row counts, side-car completeness, CHECK-domain membership, equipment
strictness, progression chain integrity, variant rows (audit F3), tier
visibility, and content-structure bounds (audit F5). Deliberately avoids REAL columns so it
stays green on pre-3.41 libsqlite.

Run:  python packages/core-db/test/verify_library.py
"""
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "src" / "schema"
STAGING = Path(__file__).resolve().parents[1] / "staging" / "movement_import.json"
CONTENT_MANIFEST = Path(__file__).resolve().parents[1] / "staging" / "movement_coaching_intent_manifest.json"
CONTENT_STAGING = Path(__file__).resolve().parents[1] / "staging" / "movement_coaching_intent.json"

con = sqlite3.connect(":memory:")
con.row_factory = sqlite3.Row

fail = 0
def check(label, ok, detail=""):
    global fail
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  [{detail}]" if detail else ""))
    if not ok:
        fail += 1

print(f"SQLite {sqlite3.sqlite_version}")
print("\n[1] current schema chain applies twice (self-heal path)")
files = sorted(f for f in SCHEMA_DIR.glob("0*.sql") if not f.name.startswith("004"))
for _ in range(2):
    for f in files:
        con.executescript(f.read_text(encoding="utf-8"))
check("chain applied twice without error (idempotent)", True)
con.execute("PRAGMA foreign_keys = ON")

staging = json.loads(STAGING.read_text(encoding="utf-8"))
content_manifest = json.loads(CONTENT_MANIFEST.read_text(encoding="utf-8"))
content_staging = json.loads(CONTENT_STAGING.read_text(encoding="utf-8"))

# --- attestation-checkpoint state (Fable ruling 2026-07-16) -------------------
# The coaching-content layer is gated on Francis's per-record videoVerified
# attestation. While that checkpoint is legitimately OPEN (zero attestations
# AND zero emitted slots), the content checks below report PENDING instead of
# FAIL — a gate that is red for months by design trains people to ignore red.
# The instant ANY attestation or ANY emitted slot exists, the checkpoint is
# CLOSED and every content check becomes a hard failure again (partial
# emission must never pass).
_staging_records = content_staging if isinstance(content_staging, list) else content_staging.get("records", [])
_attested = sum(1 for r in _staging_records if r.get("videoVerified"))
CONTENT_CHECKPOINT_OPEN = (_attested == 0 and len(content_manifest["slots"]) == 0)

def content_check(label, ok, detail=""):
    """A check that is allowed to be pending ONLY while the attestation
    checkpoint is open; identical to check() once it closes."""
    if CONTENT_CHECKPOINT_OPEN and not ok:
        print(f"  PEND  {label}  [awaiting videoVerified attestation checkpoint]")
        return
    check(label, ok, detail)
if not isinstance(content_manifest.get("slots"), dict):
    raise ValueError("movement_coaching_intent_manifest.json slots must be an object")
if not all(isinstance(records, list) for records in content_manifest["slots"].values()):
    raise ValueError("movement_coaching_intent_manifest.json slot values must be arrays")
content_manifest_records = [record for records in content_manifest["slots"].values() for record in records]
if not all(isinstance(record, dict) and isinstance(record.get("name"), str)
               and re.fullmatch(r"[a-f0-9]{64}", record.get("content_sha256", ""))
               for record in content_manifest_records):
    raise ValueError("movement_coaching_intent_manifest.json records need name and content_sha256")
content_manifest_names = [record["name"] for record in content_manifest_records]
if not isinstance(content_staging.get("movements"), list):
    raise ValueError("movement_coaching_intent.json movements must be an array")
content_staging_records = content_staging["movements"]
if not all(
    isinstance(record, dict) and isinstance(record.get("name"), str)
    for record in content_staging_records
):
    raise ValueError("movement_coaching_intent.json records need names")
content_staging_names = [record["name"] for record in content_staging_records]
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
check("current movement corpus is exactly 124 names", len(names_db) == 124, f"n={len(names_db)}")
missing = [n for n in seeded_expect if n not in names_db]
check("every curated (non-prefix-represented) staging record is seeded", not missing, str(missing[:3]))
leaked = [m["name"] for m in staging["movements"] if not m["curated"] and m["name"] in names_db]
check("no uncurated staging record leaked into the DB", not leaked, str(leaked[:3]))


print("\n[3] seeded content quality (the curation contract)")
rows = con.execute("""
  SELECT m.name, d.base_name, d.supported_prefixes, d.difficulty_rating,
         d.target_muscles, d.instructions, d.cues, d.video_placeholder_uri,
         i.coaching_intent
  FROM movement m
  JOIN movement_detail d USING(movement_id)
  LEFT JOIN movement_coaching_intent i USING(movement_id)
""").fetchall()
by_name = {r["name"]: r for r in rows}
emitted_content = set(content_manifest_names)
manifest_duplicates = sorted({name for name in content_manifest_names if content_manifest_names.count(name) > 1})
staging_duplicates = sorted({name for name in content_staging_names if content_staging_names.count(name) > 1})
manifest_unknown = sorted(emitted_content - names_db)
check("coaching-content manifest has no duplicate names", not manifest_duplicates, str(manifest_duplicates[:3]))
check("coaching-content manifest names are all seeded movements", not manifest_unknown, str(manifest_unknown[:3]))
check("coaching-content staging has no duplicate names", not staging_duplicates, str(staging_duplicates[:3]))
check("coaching-content staging covers exactly all 124 current movements",
      set(content_staging_names) == names_db and len(content_staging_names) == len(names_db),
      str(sorted(set(content_staging_names) ^ names_db)[:3]))
content_check("coaching-content manifest covers exactly all 124 current movements",
      emitted_content == names_db and len(content_manifest_names) == len(names_db),
      str(sorted(emitted_content ^ names_db)[:3]))
content_check("coaching-content staging and manifest name sets match exactly",
      set(content_staging_names) == emitted_content,
      str(sorted(set(content_staging_names) ^ emitted_content)[:3]))
content_contract_names = sorted(names_db)
bad_text, bad_json, bad_uri = [], [], []
for n in content_contract_names:
    r = by_name[n]
    if not (r["instructions"].strip() and r["cues"].strip()):
        bad_text.append(n)
    try:
        assert isinstance(json.loads(r["supported_prefixes"]), list)
        assert isinstance(json.loads(r["target_muscles"]), list)
    except Exception:
        bad_json.append(n)
    if re.fullmatch(r"https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}", r["video_placeholder_uri"]) is None:
        bad_uri.append(n)
content_check("all curated/emitted rows carry instructions + cues", not bad_text, str(bad_text[:3]))
check("prefix/muscle JSON valid on all curated/emitted rows", not bad_json, str(bad_json[:3]))
content_check("all curated/emitted rows carry one YouTube placeholder URI", not bad_uri, str(bad_uri[:3]))

def terminal(text):
    return text if re.search(r"[.!?]$", text) else text + "."

def normalized_sentences(values):
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        return None
    return " ".join(terminal(value.strip()) for value in values)

staged_by_name = {record["name"]: record for record in content_staging_records}
manifest_hash_by_name = {record["name"]: record["content_sha256"] for record in content_manifest_records}
bad_association, bad_fingerprints = [], []
for name in content_contract_names:
    staged = staged_by_name.get(name)
    actual = by_name[name]
    if staged is None:
        bad_association.append(name)
        continue
    expected_steps = normalized_sentences(staged.get("setupSteps"))
    expected_cues = normalized_sentences(staged.get("cues"))
    expected = {
        "name": name,
        "coachingIntent": staged.get("coachingIntent"),
        "instructions": expected_steps,
        "cues": expected_cues,
        "videoUrl": staged.get("videoUrl"),
    }
    actual_content = {
        "name": name,
        "coachingIntent": actual["coaching_intent"],
        "instructions": actual["instructions"],
        "cues": actual["cues"],
        "videoUrl": actual["video_placeholder_uri"],
    }
    if actual_content != expected:
        bad_association.append(name)
    fingerprint = hashlib.sha256(json.dumps(
        actual_content, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")).hexdigest()
    if manifest_hash_by_name.get(name) != fingerprint:
        bad_fingerprints.append(name)
content_check("every movement is associated with its exact same-name staged intent/steps/cues/video",
      not bad_association, str(bad_association[:3]))
content_check("every migrated movement-content fingerprint matches the generated manifest",
      not bad_fingerprints, str(bad_fingerprints[:3]))


# Audit F5: the curation contract is structural, not just non-empty.
bad_cues, bad_steps, bad_claims = [], [], []
SENT = re.compile(r"[.!?]")
BANNED = re.compile(
    r"\b(cure|heal(s|ing)?|guarantee|injury[- ]proof|prevent(s|ing)? injur|bulletproof|"
    r"pain[- ]free|insurance|pays out|burn(s)? fat|melt|shred your|doctor|medical|"
    r"prescription|diagnos|therap)\b", re.I)
for n in content_contract_names:
    r = by_name[n]
    n_cues = len([c for c in SENT.split(r["cues"]) if c.strip()])
    n_steps = len([c for c in SENT.split(r["instructions"]) if c.strip()])
    if not (1 <= n_cues <= 3):
        bad_cues.append((n, n_cues))
    if not (2 <= n_steps <= 4):
        bad_steps.append((n, n_steps))
    if BANNED.search(r["instructions"]) or BANNED.search(r["cues"]):
        bad_claims.append(n)
content_check("every seeded row has 1-3 cues (plan info-density law)", not bad_cues, str(bad_cues[:3]))
content_check("every seeded row has 2-4 instruction steps (plan law)", not bad_steps, str(bad_steps[:3]))
check("no medical/performance claims in seeded text", not bad_claims, str(bad_claims[:3]))
intent_by_name = {r["name"]: r["coaching_intent"] for r in rows if r["coaching_intent"] is not None}
check("emitted coaching intents exactly match the generated manifest",
      set(intent_by_name) == emitted_content, str(sorted(set(intent_by_name) ^ emitted_content)[:3]))
bad_intents = [name for name, intent in intent_by_name.items()
               if not (1 <= len(intent.strip()) <= 160) or BANNED.search(intent)]
check("every emitted coaching intent is concise and claim-safe", not bad_intents, str(bad_intents[:3]))
generic_intents = [name for name, intent in intent_by_name.items()
                   if re.search(r"\bbuild strength,\s*mobility,\s*and technique with\b", intent, re.I)]
check("no emitted coaching intent uses the rejected generic template",
      not generic_intents, str(generic_intents[:3]))
shipped_names = names_db - set(seeded_expect)
empty_names = {r["name"] for r in rows if r["instructions"].strip() == ""}
expected_empty = shipped_names - emitted_content
check("movement-detail content debt matches emitted coaching-content migrations",
      empty_names == expected_empty, str(sorted(empty_names ^ expected_empty)[:3]))
n_tax = con.execute(
    "SELECT COUNT(*) FROM movement_taxonomy t JOIN movement m USING(movement_id) WHERE m.name IN (%s)"
    % ",".join("?" * len(seeded_expect)), seeded_expect).fetchone()[0]
check("every seeded row has a taxonomy side-car", n_tax == len(seeded_expect), f"n={n_tax}")
taxonomy_category = {r["name"]: r["category"] for r in con.execute("""
    SELECT m.name, t.category FROM movement_taxonomy t JOIN movement m USING(movement_id)
""")}
staged_category = {m["name"]: m["pattern"] for m in curated}
bad_taxonomy = [n for n in seeded_expect if taxonomy_category.get(n) != staged_category[n]]
check("every seeded taxonomy category matches curated staging",
      not bad_taxonomy, str([(n, taxonomy_category.get(n), staged_category[n]) for n in bad_taxonomy[:3]]))

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
for n in sorted(names_db):
    first = json.loads(by_name[n]["supported_prefixes"])[0]
    item = PREFIX_ITEM.get(first)
    if item is not None and item not in eq.get(n, set()):
        bad_eq.append(n)
check("every implement-prefixed current row demands its implement", not bad_eq, str(bad_eq[:3]))
phase17_prefixes = {name: json.loads(by_name[name]["supported_prefixes"]) for name in (
    "Dumbbell Bench Press", "Dumbbell Shoulder Press", "Pallof Press"
)}
check("024 applies the three ratified Phase 17 equipment-prefix corrections",
      phase17_prefixes == {"Dumbbell Bench Press": ["DB"], "Dumbbell Shoulder Press": ["DB"], "Pallof Press": ["Banded"]},
      str(phase17_prefixes))

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
