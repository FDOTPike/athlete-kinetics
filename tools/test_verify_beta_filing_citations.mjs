/**
 * test_verify_beta_filing_citations.mjs — Falsifier & mutation-poisoning tests
 * for `tools/verify_beta_filing_citations.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_CITATION_COUNT,
  REQUIRED_FILING_DOCS,
  verifyBetaFilingCitations,
} from './verify_beta_filing_citations.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failed += 1;
}

console.log('[1] Live worktree filing citations');
{
  const res = verifyBetaFilingCitations({ repoRoot });
  check(
    `all ${EXPECTED_CITATION_COUNT} citations across ${REQUIRED_FILING_DOCS.length} filing docs resolve to their exact worktree anchors`,
    res.ok && res.totalCitations === EXPECTED_CITATION_COUNT,
    res.ok ? `${res.totalCitations} citations` : res.errors.slice(0, 3).join(' | '),
  );
}

console.log('\n[2] Negative invariants & poisoning falsifiers');
{
  // Missing document fails closed
  const missingRes = verifyBetaFilingCitations({
    repoRoot,
    exists: (rel) => rel !== 'docs/release/beta/DISCLAIMER.md' && fs.existsSync(path.join(repoRoot, rel)),
  });
  check(
    'missing filing document fails closed',
    !missingRes.ok && missingRes.errors.some((e) => e.includes('DISCLAIMER.md: required filing document is missing')),
    missingRes.errors[0] ?? '',
  );

  // Emptied document fails closed
  const emptyRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => (rel === 'docs/release/beta/DISCLAIMER.md' ? '   \n' : fs.readFileSync(path.join(repoRoot, rel), 'utf8')),
  });
  check(
    'emptied filing document fails closed',
    !emptyRes.ok && emptyRes.errors.some((e) => e.includes('DISCLAIMER.md: filing document is empty')),
    emptyRes.errors[0] ?? '',
  );

  // Citation-free document fails closed
  const noCiteRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => (rel === 'docs/release/beta/DISCLAIMER.md' ? '# Disclaimer\nNo citations.\n' : fs.readFileSync(path.join(repoRoot, rel), 'utf8')),
  });
  check(
    'citation-free filing document fails closed',
    !noCiteRes.ok && noCiteRes.errors.some((e) => e.includes('cites zero source locations')),
    noCiteRes.errors[0] ?? '',
  );

  // Out-of-bounds line number fails closed
  const oobRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/SessionScreen\.tsx:\d+/, 'SessionScreen.tsx:999999')
        : real;
    },
  });
  check(
    'out-of-bounds line number fails closed',
    !oobRes.ok && oobRes.errors.some((e) => e.includes('out of bounds')),
    oobRes.errors[0] ?? '',
  );

  // Off-by-one drifted anchor line fails closed and names the moved line
  const driftRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/ProfileScreen\.tsx:(\d+)/, (_m, n) => `ProfileScreen.tsx:${Number(n) - 10}`)
        : real;
    },
  });
  check(
    'drifted line number fails closed and names the current anchor line',
    !driftRes.ok && driftRes.errors.some((e) => e.includes('does not contain expected anchor') && e.includes('anchor now at line')),
    driftRes.errors[0] ?? '',
  );
}

console.log(`\n${failed === 0 ? 'ALL BETA FILING CITATION TESTS PASSED' : `${failed} TEST(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
