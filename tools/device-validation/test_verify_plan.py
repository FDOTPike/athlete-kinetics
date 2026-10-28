"""Reject movable references even when origin/master happens to match the pin."""
from pathlib import Path
import runpy
import subprocess
from unittest.mock import patch

pinned = '26f6557a793f1cafe9f609fb10e015cfc42d22b0'
check_output = subprocess.check_output
reads = []

def pinned_read(args, **kwargs):
    assert args[:2] == ['git', 'show'], args
    assert args[2].startswith(pinned + ':'), 'reference reads must use the documented commit'
    reads.append(args[2])
    return check_output(args, **kwargs)

with patch('subprocess.check_output', side_effect=pinned_read):
    runpy.run_path(str(Path(__file__).with_name('verify_plan.py')))
assert any(':packages/core-db/src/schema/' in ref for ref in reads)
assert any(':packages/inference/' in ref for ref in reads)
print('EVIDENCE CAPTURED: citation and schema reads reject movable references.')
