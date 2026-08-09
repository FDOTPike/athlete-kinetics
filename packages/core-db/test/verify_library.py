"""Phase 2a movement-library gate: exact corpus, content, media, and tier law."""
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "src" / "schema"
STAGING_DIR = ROOT / "staging"

def load(name):
    return json.loads((STAGING_DIR / name).read_text(encoding="utf-8"))

movement_import = load("movement_import.json")
seeded = load("seeded_manifest.json")
target = load("library_target_v1.json")
legacy_content = load("movement_coaching_intent.json")["movements"]
legacy_manifest = load("movement_coaching_intent_manifest.json")
v2_content = load("movement_coaching_intent_v2.json")["movements"]
v2_manifest = load("movement_coaching_intent_v2_manifest.json")
media_manifest = load("movement_media_manifest.json")
quarantine_doc = load("movement_quarantine.json")
quarantine = quarantine_doc.get("entries", quarantine_doc.get("records", []))

con = sqlite3.connect(":memory:")
con.row_factory = sqlite3.Row
fail = 0

def check(label, ok, detail=""):
    global fail
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  [{detail}]" if detail else ""))
    if not ok:
        fail += 1

def terminal(text):
    return text if re.search(r"[.!?]$", text) else text + "."

def compact_hash(value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

print(f"SQLite {sqlite3.sqlite_version}")
print("\n[1] append-only schema and exact target")
schema_files = sorted(path for path in SCHEMA_DIR.glob("0*.sql") if not path.name.startswith("004"))
for _ in range(2):
    for path in schema_files:
        con.executescript(path.read_text(encoding="utf-8"))
check("schema chain applies twice", True)
con.execute("PRAGMA foreign_keys = ON")

target_batches = target.get("batches", [])
target_names = [name for batch in target_batches for name in batch.get("names", [])]
target_set = set(target_names)
expected_slots = [f"{slot:03d}" for slot in range(37, 49)]
check("target manifest freezes exactly 176 unique names",
      len(target_names) == 176 and len(target_set) == 176)
check("batch slots and sizes are 037-048 with 15x11 + 11",
      [batch.get("slot") for batch in target_batches] == expected_slots
      and [len(batch.get("names", [])) for batch in target_batches] == [15] * 11 + [11])
check("seeded manifest batch names exactly match the frozen target",
      all(seeded["slots"].get(batch["slot"]) == batch["names"] for batch in target_batches))

staged_by_name = {record["name"]: record for record in movement_import["movements"]}
check("every target is v2-curated in mapped staging",
      all(staged_by_name.get(name, {}).get("curated") is True
          and staged_by_name[name].get("curation_version") == 2 for name in target_names))
quarantine_names = {record.get("name") for record in quarantine}
check("target and quarantine are disjoint", target_set.isdisjoint(quarantine_names))
forbidden = re.compile(r"(?:stretch|plyo|jump squat|snatch|\bjerk\b|hang clean|dumbbell clean|kettlebell clean|strongman|with chains)", re.I)
bad_scope = sorted(name for name in target_names if forbidden.search(name))
check("target excludes stretching, plyometric, Olympic, strongman, and chain-only catalogue rows",
      not bad_scope, str(bad_scope[:3]))

source_payload = {
    "source": movement_import["source"],
    "imported_at": movement_import["imported_at"],
    "count": movement_import["count"],
    "movements": [{key: record[key] for key in (
        "name", "base_name", "pattern", "supported_prefixes", "difficulty_rating",
        "target_muscles", "secondary_muscles", "is_compound", "source"
    )} for record in movement_import["movements"]],
}
check("source provenance canonical SHA-256 reproduces",
      compact_hash(source_payload) == target["source"]["canonicalSourceSha256"])
check("balance report accounts for exactly 176 targets",
      all(sum(values.values()) == 176 for values in target["balance"].values()))

print("\n[2] live rows and side-car completeness")
names_db = {row[0] for row in con.execute("SELECT name FROM movement")}
check("live movement corpus is exactly 300 unique names", len(names_db) == 300)
check("live corpus contains the entire frozen target", target_set <= names_db)
check("no uncurated staging record leaked into the DB",
      not [record["name"] for record in movement_import["movements"]
           if not record["curated"] and record["name"] in names_db])
for table in ("movement_detail", "movement_coaching_intent", "movement_media"):
    count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    check(f"{table} covers all 300 movements", count == 300, f"n={count}")

curated_names = {record["name"] for record in movement_import["movements"] if record["curated"]}
prefix_encoded = set(seeded["prefix_encoded"])
seedable_curated = curated_names - prefix_encoded
taxonomy_names = {row[0] for row in con.execute(
    "SELECT m.name FROM movement_taxonomy t JOIN movement m USING(movement_id)")}
check("all 270 seedable curated rows have taxonomy", seedable_curated <= taxonomy_names)

print("\n[3] versioned coaching content")
legacy_records = [record for rows in legacy_manifest["slots"].values() for record in rows]
v2_records = [record for rows in v2_manifest["slots"].values() for record in rows]
legacy_names = {record["name"] for record in legacy_records}
v2_names = {record["name"] for record in v2_records}
check("legacy v1 manifest remains exactly 124 records", len(legacy_records) == 124 and len(legacy_names) == 124)
check("v2 manifest is exactly the 176-name target", len(v2_records) == 176 and v2_names == target_set)
check("v1 and v2 content are disjoint and cover all 300", legacy_names.isdisjoint(v2_names) and legacy_names | v2_names == names_db)
check("v2 fingerprint explicitly excludes media", v2_manifest.get("mediaExcluded") is True
      and v2_manifest.get("fingerprintFields") == ["name", "coachingIntent", "instructions", "cues"])

legacy_stage = {record["name"]: record for record in legacy_content}
v2_stage = {record["name"]: record for record in v2_content}
content_rows = {row["name"]: row for row in con.execute("""
  SELECT m.name, d.instructions, d.cues, d.video_placeholder_uri, i.coaching_intent
  FROM movement m JOIN movement_detail d USING(movement_id)
  JOIN movement_coaching_intent i USING(movement_id)
""")}
youtube = re.compile(r"https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$")
bad_legacy_assoc, bad_legacy_hash, bad_legacy_url = [], [], []
legacy_hashes = {record["name"]: record["content_sha256"] for record in legacy_records}
for name in sorted(legacy_names):
    staged = legacy_stage.get(name)
    actual = content_rows[name]
    expected = {
        "name": name,
        "coachingIntent": staged.get("coachingIntent") if staged else None,
        "instructions": " ".join(terminal(step.strip()) for step in staged.get("setupSteps", [])) if staged else None,
        "cues": " ".join(terminal(cue.strip()) for cue in staged.get("cues", [])) if staged else None,
        "videoUrl": staged.get("videoUrl") if staged else None,
    }
    observed = {
        "name": name,
        "coachingIntent": actual["coaching_intent"],
        "instructions": actual["instructions"],
        "cues": actual["cues"],
        "videoUrl": actual["video_placeholder_uri"],
    }
    if observed != expected:
        bad_legacy_assoc.append(name)
    if compact_hash(observed) != legacy_hashes.get(name):
        bad_legacy_hash.append(name)
    if youtube.fullmatch(actual["video_placeholder_uri"]) is None:
        bad_legacy_url.append(name)
check("124 legacy coaching rows and URLs remain byte-identical", not bad_legacy_assoc, str(bad_legacy_assoc[:3]))
check("124 legacy v1 fingerprints remain valid", not bad_legacy_hash, str(bad_legacy_hash[:3]))
check("124 legacy rows retain canonical reviewed YouTube fallbacks", not bad_legacy_url, str(bad_legacy_url[:3]))

v2_hashes = {record["name"]: record["content_sha256"] for record in v2_records}
bad_v2_assoc, bad_v2_hash, bad_v2_url = [], [], []
for name in sorted(v2_names):
    staged = v2_stage.get(name)
    actual = content_rows[name]
    observed = {
        "name": name,
        "coachingIntent": actual["coaching_intent"],
        "instructions": actual["instructions"],
        "cues": actual["cues"],
    }
    expected = {
        "name": name,
        "coachingIntent": staged.get("coachingIntent") if staged else None,
        "instructions": " ".join(terminal(step.strip()) for step in staged.get("setupSteps", [])) if staged else None,
        "cues": " ".join(terminal(cue.strip()) for cue in staged.get("cues", [])) if staged else None,
    }
    if observed != expected:
        bad_v2_assoc.append(name)
    if compact_hash(observed) != v2_hashes.get(name):
        bad_v2_hash.append(name)
    if actual["video_placeholder_uri"] != "":
        bad_v2_url.append(name)
check("176 v2 rows match their exact staged intent, steps, and cues", not bad_v2_assoc, str(bad_v2_assoc[:3]))
check("176 v2 text-only fingerprints reproduce", not bad_v2_hash, str(bad_v2_hash[:3]))
check("176 v2 rows contain no fabricated fallback URL", not bad_v2_url, str(bad_v2_url[:3]))

banned_claim = re.compile(r"\b(cure|heal(?:s|ing)?|guarantee|injury[- ]proof|prevent(?:s|ing)? injur|bulletproof|pain[- ]free|insurance|pays out|burn(?:s)? fat|melt|shred your|doctor|medical|prescription|diagnos|therap)\b", re.I)
negative_cue = re.compile(r"\b(?:don't|do not|never|avoid|stop|no)\b", re.I)
bad_structure, bad_claims, bad_cues = [], [], []
for record in legacy_content + v2_content:
    steps, cues = record.get("setupSteps", []), record.get("cues", [])
    if not 2 <= len(steps) <= 4 or not 1 <= len(cues) <= 3:
        bad_structure.append(record["name"])
    body = " ".join([record.get("coachingIntent", ""), *steps, *cues])
    if banned_claim.search(body):
        bad_claims.append(record["name"])
    if any(negative_cue.search(cue) for cue in cues):
        bad_cues.append(record["name"])
check("all 300 coaching records keep 2-4 steps and 1-3 cues", not bad_structure, str(bad_structure[:3]))
check("all coaching text is claim-safe", not bad_claims, str(bad_claims[:3]))
check("all cues use positive intention", not bad_cues, str(bad_cues[:3]))

print("\n[4] stable media contract")
media_records = media_manifest.get("records", [])
media_names = [record.get("name") for record in media_records]
media_keys = [record.get("assetKey") for record in media_records]
key_pattern = re.compile(r"movement/[a-z0-9]+(?:-[a-z0-9]+)*/demo/v1$")
check("media manifest covers exactly all 300 names", len(media_records) == 300 and set(media_names) == names_db)
check("media asset keys are unique and canonical",
      len(set(media_keys)) == 300 and all(isinstance(key, str) and key_pattern.fullmatch(key) for key in media_keys))
check("media statuses are 124 external fallbacks + 176 planned + zero ready",
      sum(record["status"] == "external_fallback" for record in media_records) == 124
      and sum(record["status"] == "planned" for record in media_records) == 176
      and not any(record["status"] == "ready" for record in media_records))
media_db = {row["name"]: row for row in con.execute("""
  SELECT m.name, mm.asset_key, mm.status, mm.revision, d.video_placeholder_uri
  FROM movement m JOIN movement_media mm USING(movement_id)
  JOIN movement_detail d USING(movement_id)
""")}
media_manifest_by_name = {record["name"]: record for record in media_records}
bad_media = []
for name, row in media_db.items():
    manifest_row = media_manifest_by_name[name]
    if (row["asset_key"] != manifest_row["assetKey"] or row["status"] != manifest_row["status"] or row["revision"] != 1):
        bad_media.append(name)
    if row["status"] == "external_fallback" and not row["video_placeholder_uri"]:
        bad_media.append(name)
    if row["status"] == "planned" and row["video_placeholder_uri"]:
        bad_media.append(name)
check("database media rows exactly match the manifest and fallback state", not bad_media, str(sorted(set(bad_media))[:3]))

print("\n[5] equipment, tier, progression, and logging laws")
detail_rows = {row["name"]: row for row in con.execute("""
  SELECT m.name, m.pattern, d.supported_prefixes, d.difficulty_rating
  FROM movement m JOIN movement_detail d USING(movement_id)
""")}
equipment = {}
for row in con.execute("SELECT m.name, e.item FROM movement_equipment e JOIN movement m USING(movement_id)"):
    equipment.setdefault(row["name"], set()).add(row["item"])
prefix_item = {"BB": "barbell", "DB": "dumbbells", "KB": "kettlebell", "Cable": "cable_machine", "Banded": "bands"}
bad_equipment = []
for name, row in detail_rows.items():
    prefixes = json.loads(row["supported_prefixes"])
    expected_item = prefix_item.get(prefixes[0] if prefixes else None)
    if expected_item is not None and expected_item not in equipment.get(name, set()):
        bad_equipment.append(name)
check("every implement-prefixed movement requires its canonical equipment", not bad_equipment, str(bad_equipment[:3]))

whitelist_expect = {
    "Dumbbell Bench Press", "Dumbbell Shoulder Press", "Incline Dumbbell Press",
    "Dumbbell Step-Up", "Dumbbell Split Squat", "Cable Shoulder Press",
    "Straight-Arm Pulldown", "Cable Crunch",
}
whitelist = {row[0] for row in con.execute(
    "SELECT m.name FROM movement_beginner_whitelist w JOIN movement m USING(movement_id)")}
check("beginner whitelist remains the ratified eight", whitelist == whitelist_expect)
check("whitelist contains only Intermediate non-barbell staples", all(
    detail_rows[name]["difficulty_rating"] == "Intermediate"
    and "barbell" not in equipment.get(name, set())
    and "squat_rack" not in equipment.get(name, set()) for name in whitelist))
difficulties = [row["difficulty_rating"] for row in detail_rows.values()]
check("library contains all three authored difficulty tiers", set(difficulties) == {"Beginner", "Intermediate", "Advanced"})

for group in ("handstand-push-up", "pull-up"):
    ranks = [row[0] for row in con.execute(
        "SELECT progression_rank FROM movement_progression WHERE progression_group = ? ORDER BY progression_rank", (group,))]
    check(f"progression chain {group} is unchanged", ranks == [0, 1, 2, 3, 4])
target_progressions = con.execute(
    "SELECT COUNT(*) FROM movement_progression p JOIN movement m USING(movement_id) "
    f"WHERE m.name IN ({','.join('?' for _ in target_names)})", target_names).fetchone()[0]
check("no target movement invents a progression edge", target_progressions == 0)
trail = con.execute("""
  SELECT lm.mode, tp.default_sets, tp.target_seconds
  FROM movement m JOIN movement_logging_mode lm USING(movement_id)
  JOIN movement_time_policy tp USING(movement_id)
  WHERE m.name = 'Trail Running/Walking'
""").fetchone()
check("Trail Running/Walking uses explicit time logging", tuple(trail or ()) == ("time", 1, 1200))

print("\n[6] STRICT media checks")
movement_id = con.execute("SELECT movement_id FROM movement LIMIT 1").fetchone()[0]
try:
    con.execute("UPDATE movement_media SET status = 'remote' WHERE movement_id = ?", (movement_id,))
    check("invalid media status is rejected", False)
except sqlite3.IntegrityError:
    check("invalid media status is rejected", True)
con.rollback()
try:
    con.execute("UPDATE movement_media SET revision = 0 WHERE movement_id = ?", (movement_id,))
    check("non-positive media revision is rejected", False)
except sqlite3.IntegrityError:
    check("non-positive media revision is rejected", True)
con.rollback()

print(f"\n{'ALL CHECKS PASSED' if fail == 0 else f'{fail} CHECK(S) FAILED'}")
sys.exit(1 if fail else 0)
