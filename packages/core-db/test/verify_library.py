"""Phase 2a movement-library gate: exact corpus, content, media, and tier law."""
import copy
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
correction_overlay = load("movement_content_correction_v1.json")
correction_manifest = load("movement_content_correction_v1_manifest.json")

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

# --- correction overlay (049) helpers ----------------------------------------
# The overlay is a domain-aware PATCH, never a shallow spread: a correction that
# touches only changes.movement.pattern must leave that record's coaching,
# difficulty, taxonomy and equipment intact. `apply_correction` below is the
# single definition of that merge, and section [7] proves the live database is
# exactly `pre-049 snapshot + merge` for all 300 movements.
DOMAIN_ORDER = ("movement", "detail", "coaching", "taxonomy", "equipment")
FIELD_ORDER = {
    "movement": ("pattern", "primary_muscle", "is_compound"),
    "detail": ("difficulty_rating", "target_muscles"),
    "coaching": ("coaching_intent", "setup_steps", "cues"),
    "taxonomy": ("category", "implement", "family"),
    "equipment": ("required_items",),
}

def canonical_changes(changes):
    """Rebuild `changes` in the FROZEN field order (sorting is prohibited), so
    the hash never depends on the order keys sit in the source file."""
    return {
        domain: {field: changes[domain][field]
                 for field in FIELD_ORDER[domain] if field in changes[domain]}
        for domain in DOMAIN_ORDER if domain in changes
    }

def correction_hash(record):
    return compact_hash({
        "name": record["name"],
        "correction_version": record["correction_version"],
        "supersedes_v2_sha256": record["supersedes_v2_sha256"],
        "changes": canonical_changes(record["changes"]),
    })

def assignment_hash(assignment):
    return compact_hash({"name": assignment["name"], "scope": assignment["scope"]})

correction_records = correction_overlay["records"]
correction_by_name = {record["name"]: record for record in correction_records}
scope_assignments = correction_overlay["scopeAssignments"]

print(f"SQLite {sqlite3.sqlite_version}")
print("\n[1] append-only schema and exact target")
schema_files = sorted(path for path in SCHEMA_DIR.glob("0*.sql") if not path.name.startswith("004"))
correction_files = [path for path in schema_files if path.name.startswith("049")]
# A second connection frozen at 048 is the correction baseline: every claim in
# [7] is "live == baseline + declared changes", so collateral damage anywhere in
# the 300-movement corpus is a failure, not an unnoticed drift.
base = sqlite3.connect(":memory:")
base.row_factory = sqlite3.Row
for path in schema_files:
    if path in correction_files:
        continue
    base.executescript(path.read_text(encoding="utf-8"))
for _ in range(2):
    for path in schema_files:
        con.executescript(path.read_text(encoding="utf-8"))
check("schema chain applies twice", True)
check("049 is the only correction migration in the chain", len(correction_files) == 1,
      str([path.name for path in correction_files]))
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

def staged_coaching(name):
    staged = v2_stage.get(name, {})
    return {
        "coaching_intent": staged.get("coachingIntent"),
        "setup_steps": staged.get("setupSteps", []),
        "cues": staged.get("cues", []),
    }

def effective_coaching(name):
    """v2 baseline overlaid, per FIELD, by the correction's coaching domain."""
    coaching = staged_coaching(name)
    record = correction_by_name.get(name)
    if record is not None and "coaching" in record["changes"]:
        coaching = {**coaching, **record["changes"]["coaching"]}
    return coaching

def coaching_row(name, coaching):
    return {
        "name": name,
        "coachingIntent": coaching["coaching_intent"],
        "instructions": " ".join(terminal(step.strip()) for step in coaching["setup_steps"]),
        "cues": " ".join(terminal(cue.strip()) for cue in coaching["cues"]),
    }

# Two INDEPENDENT assertions, neither of which implies the other:
#   (a) the ORIGINAL v2 fingerprints still reproduce from the frozen staging
#       files — the historical record of what Phase 2a actually shipped;
#   (b) the LIVE rows equal the v2 baseline merged with the 049 overlay.
bad_v2_hash = [name for name in sorted(v2_names)
               if compact_hash(coaching_row(name, staged_coaching(name))) != v2_hashes.get(name)]
bad_v2_assoc, bad_v2_url = [], []
for name in sorted(v2_names):
    actual = content_rows[name]
    observed = {
        "name": name,
        "coachingIntent": actual["coaching_intent"],
        "instructions": actual["instructions"],
        "cues": actual["cues"],
    }
    if observed != coaching_row(name, effective_coaching(name)):
        bad_v2_assoc.append(name)
    if actual["video_placeholder_uri"] != "":
        bad_v2_url.append(name)
check("176 v2 rows match their staged intent, steps, and cues merged with the 049 overlay",
      not bad_v2_assoc, str(bad_v2_assoc[:3]))
check("176 ORIGINAL v2 text-only fingerprints still reproduce from frozen staging",
      not bad_v2_hash, str(bad_v2_hash[:3]))
check("176 v2 rows contain no fabricated fallback URL", not bad_v2_url, str(bad_v2_url[:3]))
# The overlay must actually be live: every corrected record's DB text has to
# differ from the frozen v2 staging it supersedes.
uncorrected = [name for name in sorted(correction_by_name)
               if coaching_row(name, staged_coaching(name)) == coaching_row(name, effective_coaching(name))]
check("all 32 corrections change the shipped v2 coaching text", not uncorrected, str(uncorrected[:3]))

banned_claim = re.compile(r"\b(cure|heal(?:s|ing)?|guarantee|injury[- ]proof|prevent(?:s|ing)? injur|bulletproof|pain[- ]free|insurance|pays out|burn(?:s)? fat|melt|shred your|doctor|medical|prescription|diagnos|therap)\b", re.I)
negative_cue = re.compile(r"\b(?:don't|do not|never|avoid|stop|no)\b", re.I)
bad_structure, bad_claims, bad_cues, dup_cues = [], [], [], []
# Claim-safety and cue law apply to what the ATHLETE READS — the effective,
# post-049 copy — not to the superseded staging text.
effective_v2_content = [{
    "name": record["name"],
    "coachingIntent": effective_coaching(record["name"])["coaching_intent"],
    "setupSteps": effective_coaching(record["name"])["setup_steps"],
    "cues": effective_coaching(record["name"])["cues"],
} for record in v2_content]
for record in legacy_content + effective_v2_content:
    steps, cues = record.get("setupSteps", []), record.get("cues", [])
    if not 2 <= len(steps) <= 4 or not 1 <= len(cues) <= 3:
        bad_structure.append(record["name"])
    body = " ".join([record.get("coachingIntent", ""), *steps, *cues])
    if banned_claim.search(body):
        bad_claims.append(record["name"])
    if any(negative_cue.search(cue) for cue in cues):
        bad_cues.append(record["name"])
    # A movement carries at most three cues; a repeated one spends a scarce slot
    # on nothing. Trim + case folding, because "Brace the ribs" and "brace the
    # ribs " are one cue to the athlete. Mirrors the generator's cue rule, but
    # asserted here against the EFFECTIVE post-049 copy for all 300 movements.
    folded = [cue.strip().lower() for cue in cues]
    if len(set(folded)) != len(folded):
        dup_cues.append(record["name"])
check("all 300 coaching records keep 2-4 steps and 1-3 cues", not bad_structure, str(bad_structure[:3]))
check("all coaching text is claim-safe", not bad_claims, str(bad_claims[:3]))
check("all cues use positive intention", not bad_cues, str(bad_cues[:3]))
check("all 300 coaching records carry distinct cues after trim and case folding",
      not dup_cues, str(dup_cues[:3]))

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

print("\n[7] correction overlay contract (049)")
correction_names = [record["name"] for record in correction_records]
correction_set = set(correction_names)
check("overlay holds exactly 32 unique corrections",
      len(correction_names) == 32 and len(correction_set) == 32)
check("corrected names sit inside the 176 target and are disjoint from the 124 legacy",
      correction_set <= target_set and correction_set.isdisjoint(legacy_names))
bad_hash = [r["name"] for r in correction_records if correction_hash(r) != r["correction_sha256"]]
check("every correction_sha256 reproduces over {name, version, supersedes, changes}",
      not bad_hash, str(bad_hash[:3]))
bad_supersede = [r["name"] for r in correction_records
                 if r["supersedes_v2_sha256"] != v2_hashes.get(r["name"])]
check("every correction supersedes the exact shipped v2 fingerprint",
      not bad_supersede, str(bad_supersede[:3]))
# The approval binds the hash: any later copy or equipment edit invalidates it.
bad_approval = [r["name"] for r in correction_records
                if not isinstance(r.get("ratification"), dict)
                or r["ratification"].get("correction_sha256") != r["correction_sha256"]
                or r["ratification"].get("approver_role") != "owner"
                or r["ratification"].get("approval_basis") != "owner_release_decision"]
check("every correction carries an owner approval bound to its own current hash",
      not bad_approval, str(bad_approval[:3]))
manifest_by_name = {record["name"]: record for record in correction_manifest["records"]}
check("manifest records agree with the overlay on name, version, and hash",
      set(manifest_by_name) == correction_set
      and all(manifest_by_name[r["name"]]["correction_sha256"] == r["correction_sha256"]
              and manifest_by_name[r["name"]]["correction_version"] == r["correction_version"]
              for r in correction_records))
check("the overlay declares media excluded and no media-shaped key appears in it",
      correction_overlay.get("mediaExcluded") is True
      and not re.search(r"asset_?[Kk]ey|video_placeholder_uri|videoUrl|https?://",
                        json.dumps([r["changes"] for r in correction_records])))

bad_scope_hash = [a["name"] for a in scope_assignments
                  if assignment_hash(a) != a["assignment_sha256"]]
check("every scope assignment_sha256 reproduces", not bad_scope_hash, str(bad_scope_hash[:3]))
scope_set_hash = compact_hash(sorted(a["assignment_sha256"] for a in scope_assignments))
check("the scope set roll-up reproduces (an assignment cannot be added or removed undetected)",
      scope_set_hash == correction_manifest["scopeAssignmentsSetSha256"])
check("scope assignments validate against the full 300-name corpus, not just the 176 target",
      {a["name"] for a in scope_assignments} <= names_db
      and any(a["name"] in legacy_names for a in scope_assignments))
scope_rows = {row["name"]: row["scope"] for row in con.execute(
    "SELECT m.name, s.scope FROM movement_scope s JOIN movement m USING(movement_id)")}
check("movement_scope holds exactly the two ratified full-body rows",
      scope_rows == {a["name"]: a["scope"] for a in scope_assignments},
      json.dumps(scope_rows, sort_keys=True))
check("no other rotation movement gained a scope row",
      len(scope_rows) == 2)

provenance = {row["name"]: row for row in con.execute("""
  SELECT m.name, c.correction_version, c.correction_sha256, c.applied_at_ms
  FROM movement_content_correction c JOIN movement m USING(movement_id)
""")}
check("one provenance row per corrected movement, at version 1, hash-matched",
      set(provenance) == correction_set
      and all(provenance[r["name"]]["correction_version"] == 1
              and provenance[r["name"]]["correction_sha256"] == r["correction_sha256"]
              and provenance[r["name"]]["applied_at_ms"] == correction_overlay["build"]["applied_at_ms"]
              for r in correction_records))

print("\n[8] domain-aware patch merge: live == pre-049 baseline + declared changes")

def snapshot(connection):
    rows = {}
    for row in connection.execute("SELECT movement_id, name, pattern, primary_muscle, is_compound FROM movement"):
        rows[row["name"]] = {
            "movement": {"pattern": row["pattern"], "primary_muscle": row["primary_muscle"],
                         "is_compound": row["is_compound"]},
            "detail": None, "coaching_intent": None, "taxonomy": None,
            "equipment": [], "media": None,
        }
    for row in connection.execute("""
      SELECT m.name, d.base_name, d.supported_prefixes, d.difficulty_rating, d.target_muscles,
             d.instructions, d.cues, d.video_placeholder_uri
      FROM movement m JOIN movement_detail d USING(movement_id)"""):
        rows[row["name"]]["detail"] = {key: row[key] for key in row.keys() if key != "name"}
    for row in connection.execute("""
      SELECT m.name, i.coaching_intent FROM movement m
      JOIN movement_coaching_intent i USING(movement_id)"""):
        rows[row["name"]]["coaching_intent"] = row["coaching_intent"]
    for row in connection.execute("""
      SELECT m.name, t.category, t.implement, t.family FROM movement m
      JOIN movement_taxonomy t USING(movement_id)"""):
        rows[row["name"]]["taxonomy"] = {key: row[key] for key in row.keys() if key != "name"}
    for row in connection.execute("""
      SELECT m.name, e.item FROM movement m JOIN movement_equipment e USING(movement_id)"""):
        rows[row["name"]]["equipment"].append(row["item"])
    for row in connection.execute("""
      SELECT m.name, mm.asset_key, mm.status, mm.revision FROM movement m
      JOIN movement_media mm USING(movement_id)"""):
        rows[row["name"]]["media"] = {key: row[key] for key in row.keys() if key != "name"}
    for entry in rows.values():
        entry["equipment"].sort()
    return rows

def apply_correction(baseline, record):
    """Section 4.4: per-FIELD merge for movement/detail/coaching/taxonomy;
    whole-list REPLACE for equipment. Unchanged keys survive."""
    effective = copy.deepcopy(baseline)
    changes = canonical_changes(record["changes"])
    for field, value in changes.get("movement", {}).items():
        effective["movement"][field] = value
    for field, value in changes.get("detail", {}).items():
        effective["detail"][field] = json.dumps(value, ensure_ascii=False, separators=(",", ":")) \
            if field == "target_muscles" else value
    if "coaching" in changes:
        merged = {**{
            "coaching_intent": effective["coaching_intent"],
            "setup_steps": None, "cues": None,
        }, **changes["coaching"]}
        effective["coaching_intent"] = merged["coaching_intent"]
        effective["detail"]["instructions"] = " ".join(terminal(s.strip()) for s in merged["setup_steps"])
        effective["detail"]["cues"] = " ".join(terminal(c.strip()) for c in merged["cues"])
    for field, value in changes.get("taxonomy", {}).items():
        effective["taxonomy"][field] = value
    if "equipment" in changes:
        effective["equipment"] = sorted(changes["equipment"]["required_items"])
    return effective

base_snapshot = snapshot(base)
live_snapshot = snapshot(con)
check("the pre-049 baseline is itself the full 300-movement corpus", len(base_snapshot) == 300)
drift, media_drift = [], []
for name in sorted(names_db):
    expected = base_snapshot[name]
    record = correction_by_name.get(name)
    if record is not None:
        expected = apply_correction(expected, record)
    if live_snapshot[name] != expected:
        drift.append(name)
    if live_snapshot[name]["media"] != base_snapshot[name]["media"]:
        media_drift.append(name)
check("every one of the 300 movements equals baseline + merge, field for field",
      not drift, str(drift[:3]))
check("049 writes NO media: asset keys, statuses and revisions are byte-identical",
      not media_drift, str(media_drift[:3]))
untouched_urls = [name for name in sorted(names_db)
                  if live_snapshot[name]["detail"]["video_placeholder_uri"]
                  != base_snapshot[name]["detail"]["video_placeholder_uri"]]
check("049 leaves every video_placeholder_uri byte-identical (legacy YouTube fallbacks included)",
      not untouched_urls, str(untouched_urls[:3]))
coaching_only = [r["name"] for r in correction_records if set(r["changes"]) == {"coaching"}]
untouched_domains = [name for name in coaching_only
                     if live_snapshot[name]["movement"] != base_snapshot[name]["movement"]
                     or live_snapshot[name]["taxonomy"] != base_snapshot[name]["taxonomy"]
                     or live_snapshot[name]["equipment"] != base_snapshot[name]["equipment"]
                     or live_snapshot[name]["detail"]["difficulty_rating"]
                     != base_snapshot[name]["detail"]["difficulty_rating"]]
# 32 corrections - 4 equipment replacements - 4 push_v pattern fixes - 1 TGU = 23.
check("a coaching-only correction leaves movement, taxonomy, difficulty and equipment intact",
      len(coaching_only) == 23 and not untouched_domains, f"{len(coaching_only)} coaching-only")

print("\n[9] specialist equipment and scope constraints")
equipment_sql = con.execute(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'movement_equipment'").fetchone()[0]
sql_items = re.findall(r"'([a-z_]+)'", equipment_sql.split("CHECK (item IN")[1])
check("the post-049 movement_equipment domain is the complete 11-item union",
      sorted(sql_items) == sorted([
          "barbell", "squat_rack", "bench", "dumbbells", "kettlebell", "pullup_bar",
          "nordic_bench", "bands", "cable_machine", "mats", "boards"]),
      str(sorted(sql_items)))
check("movement_equipment keeps STRICT, WITHOUT ROWID and the composite primary key",
      "STRICT" in equipment_sql and "WITHOUT ROWID" in equipment_sql
      and "PRIMARY KEY (movement_id, item)" in equipment_sql)
check("the rebuild preserved every pre-049 equipment row outside the four replacements",
      sum(len(entry["equipment"]) for name, entry in base_snapshot.items()
          if name not in {r["name"] for r in correction_records if "equipment" in r["changes"]})
      == sum(len(entry["equipment"]) for name, entry in live_snapshot.items()
             if name not in {r["name"] for r in correction_records if "equipment" in r["changes"]}))
board_id = con.execute("SELECT movement_id FROM movement WHERE name = 'Board Press'").fetchone()[0]
check("Board Press is the ONLY movement requiring specialist equipment",
      [name for name, entry in live_snapshot.items() if "boards" in entry["equipment"]] == ["Board Press"])
try:
    con.execute("INSERT INTO movement_equipment (movement_id, item) VALUES (?, 'sled')", (board_id,))
    check("widened equipment domain still rejects a bogus item", False)
except sqlite3.IntegrityError:
    check("widened equipment domain still rejects a bogus item", True)
con.rollback()
tgu_id = con.execute("SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up'").fetchone()[0]
try:
    con.execute("INSERT INTO movement_scope (movement_id, scope) VALUES (?, 'upper_body')", (tgu_id,))
    check("movement_scope CHECK rejects a non-full_body value", False)
except sqlite3.IntegrityError:
    check("movement_scope CHECK rejects a non-full_body value", True)
con.rollback()
try:
    con.execute("INSERT INTO movement_scope (movement_id, scope) VALUES (?, 'full_body')", (tgu_id,))
    check("movement_scope composite primary key rejects a duplicate", False)
except sqlite3.IntegrityError:
    check("movement_scope composite primary key rejects a duplicate", True)
con.rollback()
con.execute("DELETE FROM movement WHERE movement_id = ?", (tgu_id,))
check("movement delete cascades both 049 side-cars",
      con.execute("SELECT COUNT(*) FROM movement_scope WHERE movement_id = ?", (tgu_id,)).fetchone()[0] == 0
      and con.execute("SELECT COUNT(*) FROM movement_equipment WHERE movement_id = ?", (tgu_id,)).fetchone()[0] == 0)
con.rollback()

print(f"\n{'ALL CHECKS PASSED' if fail == 0 else f'{fail} CHECK(S) FAILED'}")
sys.exit(1 if fail else 0)
