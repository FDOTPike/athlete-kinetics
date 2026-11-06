"""Reject movable references even when origin/master happens to match the pin."""
from pathlib import Path
import runpy
import subprocess
from unittest.mock import patch

pinned = '26f6557a793f1cafe9f609fb10e015cfc42d22b0'
beta = 'ee6dd8c49a642ec69396300c17d72480e3cadb41'
verifier = str(Path(__file__).with_name('verify_plan.py'))
check_output = subprocess.check_output
read_text = Path.read_text
reads = []
worktree_reads = []

def pinned_read(args, **kwargs):
    assert args[:2] == ['git', 'show'], args
    assert args[2].startswith(pinned + ':') or args[2].startswith(beta + ':'), 'reference reads must use a documented commit'
    reads.append(args[2])
    return check_output(args, **kwargs)

def tracked_read(self, *args, **kwargs):
    worktree_reads.append(self.as_posix())
    return read_text(self, *args, **kwargs)

with patch('subprocess.check_output', side_effect=pinned_read), patch.object(Path, 'read_text', tracked_read):
    runpy.run_path(verifier)
assert any(ref.startswith(pinned + ':packages/core-db/src/schema/') for ref in reads)
assert any(ref.startswith(pinned + ':packages/inference/') for ref in reads)
# Unprefixed citations are at the beta code revision named in LOG_READING_PLAN.md, not the worktree.
assert any(ref.startswith(beta + ':apps/mobile/src/') for ref in reads), 'unprefixed app citations must be read at the beta revision'
assert any(ref.startswith(beta + ':packages/') for ref in reads), 'unprefixed package citations must be read at the beta revision'
movable = [path for path in worktree_reads if path.startswith(('apps/', 'packages/')) or path == 'package.json']
assert movable == [], f'citations read from the worktree: {movable}'

def must_fail(replacement, reason):
    """Run the verifier with one input document replaced; it must stop with an error."""
    def altered_read(self, *args, **kwargs):
        if self.as_posix() == 'docs/release/beta/plan/ATHLETE_GUIDE.md':
            return replacement(read_text(self, *args, **kwargs))
        return read_text(self, *args, **kwargs)
    with patch.object(Path, 'read_text', altered_read):
        try:
            runpy.run_path(verifier)
        except (AssertionError, FileNotFoundError):
            return
    raise AssertionError(f'verifier passed with {reason}')

must_fail(lambda text: '', 'an empty ATHLETE_GUIDE.md')
must_fail(lambda text: '# Athlete guide\n\nNo citations here.\n', 'an ATHLETE_GUIDE.md with no citations')

real_glob = Path.glob
def glob_without_guide(self, pattern):
    return [path for path in real_glob(self, pattern) if path.name != 'ATHLETE_GUIDE.md']
real_exists = Path.exists
def exists_without_guide(self, *args, **kwargs):
    if self.as_posix() == 'docs/release/beta/plan/ATHLETE_GUIDE.md':
        return False
    return real_exists(self, *args, **kwargs)
with patch.object(Path, 'glob', glob_without_guide), patch.object(Path, 'exists', exists_without_guide):
    try:
        runpy.run_path(verifier)
    except (AssertionError, FileNotFoundError):
        pass
    else:
        raise AssertionError('verifier passed with ATHLETE_GUIDE.md missing')

print('EVIDENCE CAPTURED: citation and schema reads reject movable references; missing, empty or citation-free documents fail.')
