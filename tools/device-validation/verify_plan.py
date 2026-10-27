"""Check draft citations and run every analysis query on reference-schema fixtures."""
import os
from pathlib import Path
import re
import sqlite3
import subprocess

ROOT = Path(__file__).resolve().parents[2]
os.chdir(ROOT)
os.environ['GIT_OPTIONAL_LOCKS'] = '0'
cache = {}
def source(path):
    if path not in cache:
        cache[path] = subprocess.check_output(['git', 'show', f'origin/master:{path}'], encoding='utf-8')
    return cache[path]

files = list(Path('docs/release/beta/plan').glob('*.md')) + list(Path('tools/device-validation').glob('*.md'))
count = 0
for file in files:
    text = file.read_text(encoding='utf-8-sig')
    for ref, path, line in re.findall(r'(origin/master:)?((?:apps|packages|tools)/[\w/.-]+|package\.json):(\d+)', text):
        contents = source(path) if ref else Path(path).read_text(encoding='utf-8-sig')
        assert 1 <= int(line) <= len(contents.splitlines()), (file, path, line)
        count += 1

schema = 'packages/core-db/src/schema/'
paths = ['001_mechanical_input.sql', '005_subjective_report.sql', '009_periodization.sql',
         '022_set_target.sql', '023_phase17_session_foundation.sql',
         '026_phase18_session_outcome.sql', '034_autopilot_attribution.sql',
         '070_session_feel.sql', '071_beta_recording.sql']
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
for path in paths:
    for create in re.findall(r'CREATE TABLE IF NOT EXISTS .*?\) STRICT;', source(schema + path), re.S):
        db.execute(create)
# Foreign keys intentionally off: fixture parents outside the queried surface are absent.
db.execute("INSERT INTO session(session_id,session_date) VALUES(1,'2026-11-01')")
db.execute("INSERT INTO session(session_id,session_date) VALUES(2,'2026-10-01')")
for slot, movement, sets in [(1,10,3),(2,20,2),(3,30,1)]:
    db.execute("INSERT INTO session_plan_slot(session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES(?,1,?,?,?,8,'planned',7,?)", (slot,slot,movement,sets,slot))
# Outcome satisfies real schema constraints; skipped slot is wholly missing.
db.execute("""INSERT INTO session_outcome VALUES
(1,'session_recorded','complete',NULL,'planned','guided','beginner',3,6,4,3,0,0,0,1,3,1,0,1,1,1,100,1)""")
db.execute('INSERT INTO session_skipped_slot VALUES(2)')
for sid, slot, movement, load, rpe in [(1,1,10,0,6),(2,1,10,25,None),(3,3,30,30,7),(4,None,40,40,8)]:
    db.execute('INSERT INTO set_record(set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES(?,1,?,?,8,?,?,?)',(sid,movement,sid,load,rpe,sid*100))
    db.execute("INSERT INTO set_target(set_id,session_plan_slot_id,provenance_kind) VALUES(?,?,'free_form')",(sid,slot))
db.execute("INSERT INTO set_load_shown VALUES(1,'manual',0,NULL,NULL)")
db.execute("INSERT INTO set_load_shown VALUES(2,'manual',NULL,NULL,NULL)")
db.execute("INSERT INTO set_dose_target VALUES(1,'reps',8,NULL)")
db.execute("INSERT INTO subjective_report(report_id,date,reported_at_ms,raw_text,halt) VALUES(1,'2026-11-01',500,'synthetic report',1)")
text = Path('docs/release/beta/plan/LOG_READING_PLAN.md').read_text(encoding='utf-8')
queries = re.findall(r'```sql\n(.*?)```', text, re.S)
params = dict(start_date='2026-11-01',end_date='2026-11-14',start_ms=0,end_ms=1000)
results = [list(db.execute(q, params)) for q in queries]
assert len(results)==8
assert len(results[0])==1, 'date window must exclude earlier session'
slots = {r['session_plan_slot_id']:r for r in results[1]}
assert slots[1]['logged_sets']==2 and slots[1]['missing_sets']==1
assert slots[2]['recorded_skip']==1 and slots[2]['logged_sets']==0 and slots[2]['missing_sets']==2
assert slots[3]['logged_sets']==1, 'joins must not multiply counts'
assert [r['set_id'] for r in results[2]]==[4], 'unmapped sets must be visible'
loads = {r['set_id']:r for r in results[3]}
assert loads[1]['seed_state']=='numeric' and loads[1]['lifted_minus_seed_kg']==0
assert loads[2]['seed_state']=='blank' and loads[2]['lifted_minus_seed_kg'] is None
assert loads[3]['seed_state']=='unrecorded', 'absence must not become zero'
assert results[4][1]['effort_state']=='unanswered'
assert results[5][0]['feel'] is None, 'missing feel must remain missing'
assert results[6][0]['halt']==1
assert len(results[7])==3
print(f'EVIDENCE CAPTURED: {count} citation locations exist; all {len(queries)} SQL queries executed against origin/master table definitions.')
print('Fixture assertions cover date exclusion, empty skipped slot, slot counts, unmapped sets, zero/blank/absent load seeds, missing effort and missing feel.')
