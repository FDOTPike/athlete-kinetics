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

  // Off-by-one drifted anchor line fails closed and names the specific mutated ProfileScreen citation
  const driftRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/ProfileScreen\.tsx:(\d+)-(\d+)/, (_m, n1, n2) => `ProfileScreen.tsx:${Number(n1) - 10}-${Number(n2) - 10}`)
        : real;
    },
  });
  check(
    'WO04-SOL-07: drifted ProfileScreen line number fails closed and names the exact ProfileScreen citation',
    !driftRes.ok
      && driftRes.errors.length === 1
      && driftRes.errors[0].includes('ProfileScreen.tsx:')
      && driftRes.errors[0].includes('does not contain expected anchor'),
    driftRes.errors[0] ?? '',
  );

  // WO04-SOL-01a: substituting ProgressScreen.tsx:1 with a duplicate OnboardingScreen.tsx:1 fails closed
  const wrongPathRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/STORE_LISTING_DRAFT.md'
        ? real.replace('apps/mobile/src/screens/ProgressScreen.tsx:1', 'apps/mobile/src/screens/OnboardingScreen.tsx:1')
        : real;
    },
  });
  check(
    'WO04-SOL-01a: substituting ProgressScreen.tsx:1 with OnboardingScreen.tsx:1 fails closed',
    !wrongPathRes.ok && wrongPathRes.errors.some((e) => e.includes('expected path')),
    wrongPathRes.errors[0] ?? 'accepted wrong path',
  );

  // WO04-SOL-01b: substituting ProfileScreen visible text (517) with accessibilityLabel line (511) fails closed via prevAnchor
  const wrongDuplicateLineRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/HEALTH_APPS_DECLARATION.md'
        ? real.replace('ProfileScreen.tsx:517', 'ProfileScreen.tsx:511')
        : real;
    },
  });
  check(
    'WO04-SOL-01b: substituting ProfileScreen visible notice (517) with accessibilityLabel line (511) fails closed via prevAnchor',
    !wrongDuplicateLineRes.ok && wrongDuplicateLineRes.errors.some((e) => e.includes('disambiguating context')),
    wrongDuplicateLineRes.errors[0] ?? 'accepted duplicate substring on wrong line',
  );

  // WO04-SOL-01c: repository-escaping relative path is rejected before calling exists/readFile
  let touchedOutsideRepo = false;
  const escapeRes = verifyBetaFilingCitations({
    repoRoot,
    exists: (rel) => {
      if (rel.includes('..')) touchedOutsideRepo = true;
      return fs.existsSync(path.join(repoRoot, rel));
    },
    readFile: (rel) => {
      if (rel.includes('..')) touchedOutsideRepo = true;
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/`apps\/mobile\/src\/screens\/SessionScreen\.tsx:\d+(?:-\d+)?`/, '`apps/../../../outside.ts:1`')
        : real;
    },
  });
  check(
    'WO04-SOL-01c: repository-escaping path is rejected before touching filesystem callbacks',
    !escapeRes.ok && !touchedOutsideRepo,
    escapeRes.errors[0] ?? 'escaped repo containment',
  );

  // WO04-SOL-02a: truncating AndroidManifest.xml:4-14 to :4-4 or mutating tools:node="remove" at line 14 fails closed
  const truncatedRangeRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/PRIVACY_POLICY_DRAFT.md'
        ? real.replace('AndroidManifest.xml:4-14', 'AndroidManifest.xml:4-4')
        : real;
    },
  });
  const mutatedRangeBodyRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'apps/mobile/android/app/src/main/AndroidManifest.xml'
        ? real.replace('tools:node="remove"', 'tools:node="merge"')
        : real;
    },
  });
  check(
    'WO04-SOL-02: truncating range 4-14 to 4-4 or mutating tools:node="remove" inside the range fails closed',
    !truncatedRangeRes.ok && !mutatedRangeBodyRes.ok,
    truncatedRangeRes.errors[0] ?? mutatedRangeBodyRes.errors[0] ?? 'accepted truncated/mutated range',
  );

  // WO04-SOL-02b: trailing newline does not inflate physical line count by 1
  const manifestRaw = fs.readFileSync(path.join(repoRoot, 'apps/mobile/android/app/src/main/AndroidManifest.xml'), 'utf8');
  const physicalManifestLines = manifestRaw.replace(/\r?\n$/, '').split(/\r?\n/).length;
  const trailingNewlineOobRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/PRIVACY_POLICY_DRAFT.md'
        ? real.replace('AndroidManifest.xml:24', `AndroidManifest.xml:24-${physicalManifestLines + 1}`)
        : real;
    },
  });
  check(
    'WO04-SOL-02b: range ending on trailing-newline phantom line fails closed as out of bounds',
    !trailingNewlineOobRes.ok && trailingNewlineOobRes.errors.some((e) => e.includes('out of bounds')),
    trailingNewlineOobRes.errors[0] ?? 'accepted phantom trailing line',
  );

  // WO04-SOL-03: fenced code blocks, double-backtick literals, and malformed `:999x` source refs fail closed
  const fencedRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/(`apps\/mobile\/src\/screens\/SessionScreen\.tsx:\d+(?:-\d+)?`)/, '```\n$1\n```')
        : real;
    },
  });
  const doubleBacktickRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/`apps\/mobile\/src\/screens\/SessionScreen\.tsx:(\d+(?:-\d+)?)`/, '`` `apps/mobile/src/screens/SessionScreen.tsx:$1` ``')
        : real;
    },
  });
  const malformedRefRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? `${real}\n\`apps/mobile/src/screens/ProfileScreen.tsx:999x\`\n`
        : real;
    },
  });
  check(
    'WO04-SOL-03: fenced citations, double-backtick literals, and malformed `:999x` references fail closed',
    !fencedRes.ok && !doubleBacktickRes.ok && !malformedRefRes.ok,
    [fencedRes.ok, doubleBacktickRes.ok, malformedRefRes.ok].join(','),
  );
}

console.log(`\n${failed === 0 ? 'ALL BETA FILING CITATION TESTS PASSED' : `${failed} TEST(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
