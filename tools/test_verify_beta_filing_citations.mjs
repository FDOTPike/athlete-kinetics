/**
 * test_verify_beta_filing_citations.mjs — Falsifier & mutation-poisoning tests
 * for `tools/verify_beta_filing_citations.mjs`.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_ANCHORS,
  EXPECTED_CITATION_COUNT,
  REQUIRED_FILING_DOCS,
  verifyBetaFilingCitations,
} from './verify_beta_filing_citations.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRepoFile = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const mutateRepoFile = (target, transform) => verifyBetaFilingCitations({
  repoRoot,
  readFile: (rel) => rel === target ? transform(readRepoFile(rel)) : readRepoFile(rel),
});
const dataSafety = 'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md';
const privacy = 'docs/release/beta/PRIVACY_POLICY_DRAFT.md';
const healthConnect = 'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md';
const disclaimer = 'docs/release/beta/DISCLAIMER.md';
const citationAt = (doc, slot) => {
  const spec = EXPECTED_ANCHORS[`${doc}|${slot}`];
  const citations = [...readRepoFile(doc).matchAll(/`((?:apps|packages|tools)\/[\w./-]+):(\d+)(?:-(\d+))?`/g)];
  const [token, target, start, end = start] = citations[slot] ?? [];
  if (target !== spec.path) throw new Error(`${doc} slot ${slot} does not cite ${spec.path}`);
  return { token, target, start: Number(start), end: Number(end), spec };
};
const profileCitation = citationAt(disclaimer, 1);
const { token: profileCitationToken } = profileCitation;
const exportCitation = citationAt(dataSafety, 1);
const subjectiveCitation = citationAt(dataSafety, 7);
const subjectiveTable = /CREATE TABLE IF NOT EXISTS subjective_report \([\s\S]*?^\) STRICT;/m;

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

  // Off-by-one drifted anchor line fails closed and names the exact mutated ProfileScreen citation coordinate
  let mutatedProfileCoord = '';
  const driftRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'docs/release/beta/DISCLAIMER.md') return real;
      return real.replace(/ProfileScreen\.tsx:(\d+)-(\d+)/, (_m, n1, n2) => {
        const s = Number(n1) - 10;
        const e = Number(n2) - 10;
        mutatedProfileCoord = `apps/mobile/src/screens/ProfileScreen.tsx:${s}-${e}`;
        return `ProfileScreen.tsx:${s}-${e}`;
      });
    },
  });
  const matchesExactProfileCitation = (err, coord) => {
    const startNum = coord.split(':')[1]?.split('-')[0];
    return (
      typeof err === 'string'
      && Boolean(coord)
      && err.startsWith(`docs/release/beta/DISCLAIMER.md (\`${coord}\`): line ${startNum} does not contain expected anchor`)
    );
  };
  check(
    'WO04-SOL-07: drifted ProfileScreen line number fails closed and names the exact mutated ProfileScreen coordinate',
    !driftRes.ok
      && driftRes.errors.length === 1
      && matchesExactProfileCitation(driftRes.errors[0], mutatedProfileCoord)
      && !matchesExactProfileCitation(driftRes.errors[0], profileCitationToken.slice(1, -1)),
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

  // WO04-SOL-03-R3: CommonMark 4-backtick fence containing ``` line, tilde fence containing `~~~ info`,
  // HTML comments (`<!-- ... -->`), and backslash-escaped opening backtick (`\`...`) must NEVER count as live citations
  const fourBacktickFenceRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/(`apps\/mobile\/src\/screens\/ProfileScreen\.tsx:\d+(?:-\d+)?`)/, '````\n```\n$1\n````')
        : real;
    },
  });
  const tildeFenceWithTrailingTextRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/(`apps\/mobile\/src\/screens\/ProfileScreen\.tsx:\d+(?:-\d+)?`)/, '~~~\n~~~ not-a-closing-fence\n$1\n~~~')
        : real;
    },
  });
  const htmlCommentRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/(`apps\/mobile\/src\/screens\/ProfileScreen\.tsx:\d+(?:-\d+)?`)/, '<!-- hidden\n$1\n-->')
        : real;
    },
  });
  const escapedBacktickRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/`apps\/mobile\/src\/screens\/ProfileScreen\.tsx:(\d+(?:-\d+)?)`/, '\\`apps/mobile/src/screens/ProfileScreen.tsx:$1`')
        : real;
    },
  });
  check(
    'WO04-SOL-03-R3: 4-backtick fence with inner 3-backticks, tilde fence with info line, HTML comment, and escaped backtick all fail closed',
    !fourBacktickFenceRes.ok
      && !tildeFenceWithTrailingTextRes.ok
      && !htmlCommentRes.ok
      && !escapedBacktickRes.ok,
    [
      fourBacktickFenceRes.ok,
      tildeFenceWithTrailingTextRes.ok,
      htmlCommentRes.ok,
      escapedBacktickRes.ok,
    ].join(','),
  );

  // WO04-SOL-02-R3: commenting out implementation in XML, TS, or SQL fails closed even when line numbers stay intact
  const xmlCommentedManifestRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/android/app/src/main/AndroidManifest.xml') return real;
      return real.replace(
        /<uses-permission\s+android:name="android\.permission\.INTERNET"\s+tools:node="remove"\s*\/>/,
        (m) => `<!-- ${m} -->`,
      );
    },
  });
  const tsCommentedSealRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      return real.replace(
        'sealBackup(archive, password, mobileBackupCrypto)',
        '/* sealBackup(archive, password, mobileBackupCrypto) */ null',
      );
    },
  });
  const commentedSubjectiveSql = readRepoFile(subjectiveCitation.target)
    .replace(subjectiveTable, (statement) => `/* ${statement} */`)
    .replace(/^CREATE INDEX IF NOT EXISTS idx_subjective_date .*;$/m, '-- $&');
  const fixtureDb = new DatabaseSync(':memory:');
  let fixtureSqlError;
  try {
    fixtureDb.exec(commentedSubjectiveSql);
  } catch (err) {
    fixtureSqlError = String(err);
  } finally {
    fixtureDb.close();
  }
  const sqlCommentedTableRes = mutateRepoFile(subjectiveCitation.target, () => commentedSubjectiveSql);
  const missingSubjectiveAnchor = `${dataSafety} (${subjectiveCitation.token}): line ${subjectiveCitation.start} does not contain expected anchor "${subjectiveCitation.spec.startAnchor}"`;
  check(
    'WO04-SOL-02-R3: commenting out cited XML permission removal, TS backup sealing, or SQL table definition fails closed',
    !fixtureSqlError && !xmlCommentedManifestRes.ok && !tsCommentedSealRes.ok && !sqlCommentedTableRes.ok
      && sqlCommentedTableRes.errors.some((error) => error.startsWith(missingSubjectiveAnchor))
      && !sqlCommentedTableRes.errors.some((error) => error.includes('SQLite schema execution failed')),
    fixtureSqlError ?? sqlCommentedTableRes.errors.join(' | '),
  );

  // WO04-SOL-04..06-R3: filing spans cover export invocation, restore authentication + preview, sleep_daily storage, and readiness exclusion
  const coversSpan = ({ target, start, end, spec }) => {
    const lines = readRepoFile(target).split(/\r\n?|\n/);
    const span = lines.slice(start - 1, end).join('\n');
    return start < end
      && lines[start - 1]?.includes(spec.startAnchor)
      && lines[end - 1]?.includes(spec.endAnchor)
      && spec.rangeAnchors.every((anchor) => span.includes(anchor));
  };
  check(
    'WO04-SOL-04..06-R3: Data Safety, Privacy Policy, and Health Connect spans cover full export, restore auth/preview, sleep_daily, and RHR readiness exclusion',
    [exportCitation, citationAt(dataSafety, 6), citationAt(privacy, 15), citationAt(privacy, 10),
      citationAt(privacy, 11), citationAt(healthConnect, 8)].every(coversSpan),
    'missing widened evidence span',
  );

  // WO04-SOL-03-R4: blockquote fence, space+tab indented block, post-heading indented block,
  // HTML attribute backticks, link-title backticks, and <pre> HTML blocks must NEVER count as live citations
  const replaceProfileRefInDisclaimer = (fn) => verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      return rel === 'docs/release/beta/DISCLAIMER.md'
        ? real.replace(/(`apps\/mobile\/src\/screens\/ProfileScreen\.tsx:\d+(?:-\d+)?`)/, fn)
        : real;
    },
  });
  const blockquoteFenceRes = replaceProfileRefInDisclaimer((m) => `\n> \`\`\`\n> ${m}\n> \`\`\`\n`);
  const spaceTabIndentRes = replaceProfileRefInDisclaimer((m) => `\n\n \t${m}\n`);
  const postHeadingIndentRes = replaceProfileRefInDisclaimer((m) => `\n## Extra Heading\n    ${m}\n`);
  const htmlTitleAttrRes = replaceProfileRefInDisclaimer((m) => `<span title="${m}">notice</span>`);
  const linkTitleBacktickRes = replaceProfileRefInDisclaimer((m) => `[notice](https://example.com "${m}")`);
  const preBlockRes = replaceProfileRefInDisclaimer((m) => `\n<pre>\n${m}\n</pre>\n`);
  check(
    'WO04-SOL-03-R4: blockquote fence, space+tab indent, post-heading indent, HTML title attr, link title, and <pre> block all fail closed',
    !blockquoteFenceRes.ok
      && !spaceTabIndentRes.ok
      && !postHeadingIndentRes.ok
      && !htmlTitleAttrRes.ok
      && !linkTitleBacktickRes.ok
      && !preBlockRes.ok,
    [
      blockquoteFenceRes.ok,
      spaceTabIndentRes.ok,
      postHeadingIndentRes.ok,
      htmlTitleAttrRes.ok,
      linkTitleBacktickRes.ok,
      preBlockRes.ok,
    ].join(','),
  );

  // WO04-SOL-02-R4: `disabled:// const saved = await pickerSave(...)` after a colon still masks the line comment and fails closed
  const colonLineCommentRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      return real.replace(
        'const saved = await pickerSave(encryptedPath, fileName);',
        'disabled:// const saved = await pickerSave(encryptedPath, fileName);',
      );
    },
  });
  check(
    'WO04-SOL-02-R4: line comment immediately following a label/ternary colon (`disabled:// ...`) fails closed',
    !colonLineCommentRes.ok,
    colonLineCommentRes.errors[0] ?? 'accepted colon-prefixed // comment',
  );

  // WO04-SOL-03-R5: HTML Type 6 `<div>` block, HTML Type 7 standalone tag block, list-nested fenced block,
  // list-nested indented code block, and Setext `===`/`---` heading followed by indented code block all fail closed
  const htmlDivBlockRes = replaceProfileRefInDisclaimer((m) => `<div>\n${m}\n</div>`);
  const htmlType7BlockRes = replaceProfileRefInDisclaimer((m) => `\n\n<custom-widget data-x="1">\n${m}\n</custom-widget>\n`);
  const listFenceRes = replaceProfileRefInDisclaimer((m) => `\n- \`\`\`\n  ${m}\n  \`\`\`\n`);
  const listIndentedCodeRes = replaceProfileRefInDisclaimer((m) => `\n-     ${m}\n`);
  const setextEqHeadingIndentRes = replaceProfileRefInDisclaimer((m) => `\nExtra Heading\n=============\n    ${m}\n`);
  const setextDashHeadingIndentRes = replaceProfileRefInDisclaimer((m) => `\nExtra Heading\n-------------\n    ${m}\n`);
  const multilineLinkRefRes = replaceProfileRefInDisclaimer((m) => `\n\n[ref]: https://example.com\n  "${m}"\n`);
  const nestedParenLinkTitleRes = replaceProfileRefInDisclaimer((m) => `[notice](https://example.com/a(1) "${m}")`);
  check(
    'WO04-SOL-03-R5: HTML <div>/custom blocks, list-nested fenced/indented blocks, Setext `===`/`---` post-heading indented blocks, and multiline/paren link titles all fail closed',
    !htmlDivBlockRes.ok
      && !htmlType7BlockRes.ok
      && !listFenceRes.ok
      && !listIndentedCodeRes.ok
      && !setextEqHeadingIndentRes.ok
      && !setextDashHeadingIndentRes.ok
      && !multilineLinkRefRes.ok
      && !nestedParenLinkTitleRes.ok,
    [
      htmlDivBlockRes.ok,
      htmlType7BlockRes.ok,
      listFenceRes.ok,
      listIndentedCodeRes.ok,
      setextEqHeadingIndentRes.ok,
      setextDashHeadingIndentRes.ok,
      multilineLinkRefRes.ok,
      nestedParenLinkTitleRes.ok,
    ].join(','),
  );

  // WO04-SOL-02-R5: multiline division expression continued onto the picker line (`/ 1; // const saved = await pickerSave(...)`)
  // must NOT be misread as a regex literal and must mask the trailing `//` comment so the anchor check fails closed
  const multilineDivisionCommentRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      const writeAnchor = "await fs().writeFile(encryptedPath, created.text, 'utf8');";
      const pickerAnchor = 'const saved = await pickerSave(encryptedPath, fileName);';
      const re = new RegExp(
        writeAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + '(\\r?\\n[ \\t]+)'
        + pickerAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      );
      return real.replace(re, (_m, eolAndIndent) => `${writeAnchor} const saved = 1${eolAndIndent}/ 1; // ${pickerAnchor}`);
    },
  });
  check(
    'WO04-SOL-02-R5: multiline continued division (`/ 1; // const saved = await pickerSave(...)`) masks the trailing comment and fails closed',
    !multilineDivisionCommentRes.ok,
    multilineDivisionCommentRes.errors[0] ?? 'accepted multiline division followed by // comment',
  );

  // WO04-SOL-R6a: CommonMark multiline ref-def titles, escaped ref labels, deep nested parens in link dest,
  // unmatched `](...)` non-links, cross-block backticks, and lazy blockquote continuations match CommonMark
  const refMultilineTitleRes = replaceProfileRefInDisclaimer((m) => `[notice]: /url "title starts\n${m}\ntitle ends"`);
  const refEscapeLabelRes = replaceProfileRefInDisclaimer((m) => `[no\\]tice]: /url "${m}"`);
  const deepNestedDestRes = replaceProfileRefInDisclaimer((m) => `[notice](/a(b(c)) "${m}")`);
  const unmatchedCloserControlRes = replaceProfileRefInDisclaimer((m) => `](/url "${m}")`);
  const precedingParaTickControlRes = replaceProfileRefInDisclaimer((m) => `\`\n\n${m}`);
  const pseudoSpanAcrossParasRes = replaceProfileRefInDisclaimer((m) => `\`\n\n${m.slice(1, -1)}\n\n\``);
  const atxUnmatchedTickControlRes = replaceProfileRefInDisclaimer((m) => `# \`\n${m}`);
  const lazyBlockquoteControlRes = replaceProfileRefInDisclaimer((m) => `> Paragraph\n    ${m}`);
  check(
    'WO04-SOL-R6a: CommonMark multiline/escaped ref-defs, deep nested link parens, unmatched closers, block-scoped backticks, and lazy continuations match CommonMark',
    !refMultilineTitleRes.ok
      && !refEscapeLabelRes.ok
      && !deepNestedDestRes.ok
      && unmatchedCloserControlRes.ok
      && precedingParaTickControlRes.ok
      && !pseudoSpanAcrossParasRes.ok
      && atxUnmatchedTickControlRes.ok
      && lazyBlockquoteControlRes.ok,
    [
      refMultilineTitleRes.ok,
      refEscapeLabelRes.ok,
      deepNestedDestRes.ok,
      unmatchedCloserControlRes.ok,
      precedingParaTickControlRes.ok,
      pseudoSpanAcrossParasRes.ok,
      atxUnmatchedTickControlRes.ok,
      lazyBlockquoteControlRes.ok,
    ].join(','),
  );

  // WO04-SOL-R6b: TypeScript UTF-16 non-BMP emoji comments + inert template-literal statements,
  // XML CDATA / processing-instruction wrapping, and SQLite string-wrapping + bracket-quoted identifiers
  const emojiBeforeLivePickerRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      return real.replace(
        'const saved = await pickerSave(encryptedPath, fileName);',
        '/*\u{1F600}*/const saved = await pickerSave(encryptedPath, fileName);',
      );
    },
  });
  const pickerInTemplateTextRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      const writeAnchor = "await fs().writeFile(encryptedPath, created.text, 'utf8');";
      const pickerAnchor = 'const saved = await pickerSave(encryptedPath, fileName);';
      const re = new RegExp(
        writeAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + '(\\r?\\n[ \\t]+)'
        + pickerAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      );
      return real.replace(re, (_m, eolAndIndent) => `${writeAnchor} const saved = true;${eolAndIndent}\`${pickerAnchor}\`;`);
    },
  });
  const xmlCdataManifestRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/android/app/src/main/AndroidManifest.xml') return real;
      return real.replace(
        /<uses-permission\s+android:name="android\.permission\.INTERNET"\s+tools:node="remove"\s*\/>/,
        (m) => `<![CDATA[${m}]]>`,
      );
    },
  });
  const xmlPiManifestRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/android/app/src/main/AndroidManifest.xml') return real;
      return real.replace(
        /<uses-permission\s+android:name="android\.permission\.INTERNET"\s+tools:node="remove"\s*\/>/,
        (m) => `<?unused ${m}?>`,
      );
    },
  });
  const mutateSubjectiveSql = (transformLines) => verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'packages/core-db/src/schema/005_subjective_report.sql') return real;
      const eol = real.includes('\r\n') ? '\r\n' : '\n';
      const lines = real.replace(/\r?\n$/, '').split(/\r?\n/);
      transformLines(lines);
      return `${lines.join(eol)}${eol}`;
    },
  });
  const sqlAnchorInStringRes = mutateSubjectiveSql((ls) => {
    const idx = ls.findIndex((l) => l.startsWith('CREATE INDEX'));
    ls[6] = "SELECT '";
    ls[8] = "';";
    for (let k = 9; k < idx; k += 1) ls[k] = `-- ${ls[k]}`;
    ls[idx] = `-- ${ls[idx]}`;
  });
  const sqlBracketMasksRealCommentRes = mutateSubjectiveSql((ls) => {
    const idx = ls.findIndex((l) => l.startsWith('CREATE INDEX'));
    ls[6] = "SELECT 1 AS ['];";
    for (let k = 7; k < idx; k += 1) ls[k] = `-- ${ls[k]}`;
    ls[idx] = `-- ${ls[idx]}`;
  });
  const sqlBracketFakesCommentControlRes = mutateSubjectiveSql((ls) => {
    ls[7] = `SELECT 1 AS [a--b]; ${ls[7]}`;
  });
  check(
    'WO04-SOL-R6b: UTF-16 emoji comments, inert TS template text, XML CDATA/PI wrapping, and SQLite string/bracket-identifier rules all match real language parsers',
    emojiBeforeLivePickerRes.ok
      && !pickerInTemplateTextRes.ok
      && !xmlCdataManifestRes.ok
      && !xmlPiManifestRes.ok
      && !sqlAnchorInStringRes.ok
      && !sqlBracketMasksRealCommentRes.ok
      && sqlBracketFakesCommentControlRes.ok,
    [
      emojiBeforeLivePickerRes.ok,
      pickerInTemplateTextRes.ok,
      xmlCdataManifestRes.ok,
      xmlPiManifestRes.ok,
      sqlAnchorInStringRes.ok,
      sqlBracketMasksRealCommentRes.ok,
      sqlBracketFakesCommentControlRes.ok,
    ].join(','),
  );

  // WO04-ASTRA-R7a: CommonMark reference-style link labels (`[see][C]` + `[C]: /guide`),
  // undefined/collapsed/deactivated-outer controls, and matching-vs-mixed thematic breaks (`*-_` vs `***`)
  const mutateDisclaimerProfileCitation = (replacement) => verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'docs/release/beta/DISCLAIMER.md') return real;
      return real.replace(profileCitationToken, () => replacement);
    },
  });
  const refLabelHiddenRes = mutateDisclaimerProfileCitation(
    `[see][${profileCitationToken}]\n\n[${profileCitationToken}]: /guide`,
  );
  const undefinedRefControlRes = mutateDisclaimerProfileCitation(
    `[see][${profileCitationToken}]`,
  );
  const collapsedRefControlRes = mutateDisclaimerProfileCitation(
    `[${profileCitationToken}][]\n\n[${profileCitationToken}]: /guide`,
  );
  const deactivatedOuterRefControlRes = mutateDisclaimerProfileCitation(
    `[outer [\`inner\`]][${profileCitationToken}]\n\n[\`inner\`]: /inner\n[${profileCitationToken}]: /guide`,
  );
  const mixedThematicBreakRes = mutateDisclaimerProfileCitation(
    `word\n*-_\n    ${profileCitationToken}`,
  );
  const matchingThematicBreakRes = mutateDisclaimerProfileCitation(
    `word\n***\n    ${profileCitationToken}`,
  );
  check(
    'WO04-ASTRA-R7a: resolved reference-link labels hide citations while undefined/collapsed/deactivated refs and mixed `*-_` lines match CommonMark',
    !refLabelHiddenRes.ok
      && refLabelHiddenRes.totalCitations === 56
      && undefinedRefControlRes.ok
      && undefinedRefControlRes.totalCitations === 57
      && collapsedRefControlRes.ok
      && collapsedRefControlRes.totalCitations === 57
      && deactivatedOuterRefControlRes.ok
      && deactivatedOuterRefControlRes.totalCitations === 57
      && mixedThematicBreakRes.ok
      && mixedThematicBreakRes.totalCitations === 57
      && !matchingThematicBreakRes.ok
      && matchingThematicBreakRes.totalCitations === 56,
    [
      refLabelHiddenRes.ok,
      undefinedRefControlRes.ok,
      collapsedRefControlRes.ok,
      deactivatedOuterRefControlRes.ok,
      mixedThematicBreakRes.ok,
      matchingThematicBreakRes.ok,
    ].join(','),
  );

  const unclosedBacktickInRefLabelRes = mutateDisclaimerProfileCitation(
    `[see][a \`b]\n${profileCitationToken}\n\n[a \`b]: /url`,
  );
  check(
    'WO04-SOL-R8: a raw reference label closes before a subsequent citation even with an unclosed backtick',
    unclosedBacktickInRefLabelRes.ok && unclosedBacktickInRefLabelRes.totalCitations === 57,
    `ok=${unclosedBacktickInRefLabelRes.ok}, citations=${unclosedBacktickInRefLabelRes.totalCitations}`,
  );

  for (const [label, definition, matches] of [
    ['\u03c2', '\u03c3', true], // final sigma and sigma
    ['\u039f\u03a3', '\u03bf\u03c3', true], // uppercase sigma at the end of a word
    ['\ufb01', 'fi', true],
    ['\u1e9e', 'ss', true],
    ['\u00df', 'ss', true],
    ['\u0130', 'i\u0307', true],
    ['\u0131', 'i', false],
    ['\u00b2', '2', false],
    ['a\\]b', 'a\\]b', true],
  ]) {
    const res = mutateDisclaimerProfileCitation(
      `[see][${label} ${profileCitationToken}]\n\n[${definition} ${profileCitationToken}]: /guide`,
    );
    check(
      `WO04-SOL-R8: reference labels ${JSON.stringify(label)} and ${JSON.stringify(definition)} ${matches ? 'match' : 'stay distinct'}`,
      res.ok === !matches && res.totalCitations === (matches ? 56 : 57),
      `ok=${res.ok}, citations=${res.totalCitations}`,
    );
  }

  const pickerAnchor = 'const saved = await pickerSave(encryptedPath, fileName);';
  const pickerInRegexRes = mutateRepoFile(exportCitation.target, (real) => {
    const lines = real.split('\n');
    lines[exportCitation.end - 1] = lines[exportCitation.end - 1].replace(
      pickerAnchor, `const saved = true; const message = /${pickerAnchor}/;`,
    );
    return lines.join('\n');
  });
  const pickerAnchorError = `${dataSafety} (${exportCitation.token}): end line ${exportCitation.end} does not contain expected end anchor "${pickerAnchor}"`;
  check(
    'WO04-SOL-R8: a picker anchor inside a regular expression literal fails at the cited end line',
    !pickerInRegexRes.ok
      && pickerInRegexRes.errors.some((error) => error.startsWith(pickerAnchorError)),
    pickerInRegexRes.errors[0] ?? 'accepted regex literal as an active picker anchor',
  );

  // WO04-ASTRA-R7b: assigned template string spoofing of quoted code statements (`writeFile(..., 'utf8')`),
  // mutated string argument (`'hex!'`), and XML `xmlns:tools` / `xmlns:android` namespace URI rebinding
  const writeInAssignedTemplateRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      return real.replace(
        "await fs().writeFile(encryptedPath, created.text, 'utf8');",
        "const message = `await fs().writeFile(encryptedPath, created.text, 'utf8');`;",
      );
    },
  });
  const mutatedWriteEncodingArgRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/src/state/backupStore.ts') return real;
      return real.replace(
        "await fs().writeFile(encryptedPath, created.text, 'utf8');",
        "await fs().writeFile(encryptedPath, created.text, 'hex!');",
      );
    },
  });
  const reboundToolsNsRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/android/app/src/main/AndroidManifest.xml') return real;
      return real.replace('xmlns:tools="http://schemas.android.com/tools"', 'xmlns:tools="urn:unrelated"');
    },
  });
  const reboundAndroidNsRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'apps/mobile/android/app/src/main/AndroidManifest.xml') return real;
      return real.replace('xmlns:android="http://schemas.android.com/apk/res/android"', 'xmlns:android="urn:unrelated"');
    },
  });
  check(
    'WO04-ASTRA-R7b: assigned template-string write spoofing, mutated string arguments, and rebound Android/tools XML namespaces all fail closed',
    !writeInAssignedTemplateRes.ok
      && !mutatedWriteEncodingArgRes.ok
      && !reboundToolsNsRes.ok
      && !reboundAndroidNsRes.ok,
    [
      writeInAssignedTemplateRes.ok,
      mutatedWriteEncodingArgRes.ok,
      reboundToolsNsRes.ok,
      reboundAndroidNsRes.ok,
    ].join(','),
  );
}

console.log('\n[3] Round 9 regressions');
{
  const backupFlag = citationAt(privacy, 20);
  const sleepPermission = citationAt(healthConnect, 0);
  const checkCitationError = (label, result, citation, reason) => {
    const errors = result.errors.filter((error) => error.includes(`(${citation.token}):`));
    check(`WO04-R9: ${label}`, !result.ok && errors.some((error) => error.includes(reason)),
      errors.join(' | ') || 'no error at cited location');
  };

  checkCitationError('missing TypeScript compiler fails closed',
    verifyBetaFilingCitations({ repoRoot, tsCompiler: null }), exportCitation, 'TypeScript compiler is unavailable');
  checkCitationError('missing XML parser fails closed',
    verifyBetaFilingCitations({ repoRoot, xmlDomParser: null }), backupFlag, 'XML parser is unavailable');
  checkCitationError('XML parser without a document root fails closed',
    verifyBetaFilingCitations({ repoRoot, xmlDomParser: class {
      parseFromString() { return { documentElement: null }; }
    } }), sleepPermission, 'XML document has no root element');

  const hiddenProfileCitation = (label, result) => check(
    `WO04-R9: ${label}`, !result.ok && result.totalCitations === EXPECTED_CITATION_COUNT - 1
      && result.errors.length === 1 && result.errors[0].includes(`found ${EXPECTED_CITATION_COUNT - 1}`),
    result.errors.join(' | ') || 'citation was counted',
  );
  const hideProfile = (replacement, eol = '\n') => mutateRepoFile(disclaimer,
    (real) => real.replace(profileCitationToken, () => replacement).replace(/\r\n?|\n/g, eol));
  hiddenProfileCitation('bare CR fenced block hides its citation',
    hideProfile(`~~~\n${profileCitationToken}\n~~~`, '\r'));
  const bareCrSourceRes = mutateRepoFile(profileCitation.target, (real) => real.replace(/\r\n?|\n/g, '\r'));
  check('WO04-R9: bare CR source preserves physical citation lines', bareCrSourceRes.ok,
    bareCrSourceRes.errors[0] ?? '');
  for (const quote of ['"', "'"]) {
    hiddenProfileCitation(`quote-initial ${quote} destination takes a title`,
      hideProfile(`[see](${quote}dest${quote} "title ${profileCitationToken}")`));
    hiddenProfileCitation(`quote-initial ${quote} title-only link backtracks`,
      hideProfile(`[see](${quote}title ${profileCitationToken}${quote})`));
  }

  const displacedBackupFlag = mutateRepoFile(backupFlag.target, (real) => real
    .replace(backupFlag.spec.startAnchor, `data-decoy='${backupFlag.spec.startAnchor}'`)
    .replace('<application', `<application ${backupFlag.spec.startAnchor}`));
  checkCitationError('allowBackup attribute must be on the cited line', displacedBackupFlag, backupFlag,
    'missing active XML <application android:allowBackup="false"> attribute');
  const displacedPermission = mutateRepoFile(sleepPermission.target, (real) => {
    const lines = real.split(/\r\n?|\n/);
    const { start, spec: { startAnchor } } = sleepPermission;
    if (lines[start].trim() !== '') throw new Error('Permission fixture needs a blank line after the citation');
    lines[start] = lines[start - 1];
    lines[start - 1] = lines[start - 1].replace(startAnchor, `<wrapper xmlns="urn:decoy">${startAnchor}</wrapper>`);
    return lines.join('\n');
  });
  checkCitationError('uses-permission element must start within the cited span', displacedPermission, sleepPermission,
    `missing active XML <uses-permission android:name="android.permission.health.READ_SLEEP"> element in lines ${sleepPermission.start}-${sleepPermission.end}`);

  const priorPath = EXPECTED_ANCHORS['docs/release/beta/HEALTH_APPS_DECLARATION.md|0'].path;
  const priorHasTable = mutateRepoFile(priorPath, (real) => `${real}\n${readRepoFile(subjectiveCitation.target).match(subjectiveTable)[0]}\n`);
  checkCitationError('a table created by a prior migration is not evidence', priorHasTable, subjectiveCitation,
    'SQLite table "subjective_report" already exists before the cited migration');

  const scopeCitation = citationAt(privacy, 13);
  const appendedMatch = (anchor, alteredCode) => `decoy: \`${anchor}\`, ${alteredCode}`;
  const misalignedLine = mutateRepoFile(scopeCitation.target, (real) => real.replace(
    scopeCitation.spec.startAnchor, appendedMatch(scopeCitation.spec.startAnchor, "scope: 'other-target',"),
  ));
  checkCitationError('strict evidence at a different offset cannot satisfy a line anchor', misalignedLine, scopeCitation,
    `line ${scopeCitation.start} does not contain expected anchor "${scopeCitation.spec.startAnchor}"`);
  const alignedSecondOccurrence = mutateRepoFile(scopeCitation.target, (real) => real.replace(
    scopeCitation.spec.startAnchor, appendedMatch(scopeCitation.spec.startAnchor, scopeCitation.spec.startAnchor),
  ));
  check('WO04-R9: a later occurrence can satisfy both views at one offset', alignedSecondOccurrence.ok,
    alignedSecondOccurrence.errors[0] ?? '');
  const writeAnchor = "await fs().writeFile(encryptedPath, created.text, 'utf8');";
  const misalignedRange = mutateRepoFile(exportCitation.target, (real) => real.replace(
    writeAnchor, `const decoy = \`${writeAnchor}\`; ${writeAnchor.replace('utf8', 'hex!')}`,
  ));
  checkCitationError('strict evidence at a different offset cannot satisfy a range anchor', misalignedRange, exportCitation,
    `range ${exportCitation.start}-${exportCitation.end} is missing required active evidence "${writeAnchor}"`);

  const tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'beta-citations-')));
  try {
    const stageFile = (root, rel) => {
      const dest = path.join(root, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, readRepoFile(rel));
    };
    const linkDirectory = (root, rel, dest) => {
      const link = path.join(root, rel);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(dest, link, 'junction');
    };
    const external = path.join(tempRoot, 'external');
    const docRoot = path.join(tempRoot, 'doc');
    const sourceRoot = path.join(tempRoot, 'source');
    const migrationRoot = path.join(tempRoot, 'migration');
    for (const rel of [disclaimer, citationAt(disclaimer, 0).target, profileCitation.target]) stageFile(external, rel);
    linkDirectory(docRoot, path.dirname(disclaimer), path.join(external, path.dirname(disclaimer)));
    stageFile(sourceRoot, disclaimer);
    linkDirectory(sourceRoot, path.dirname(profileCitation.target), path.join(external, path.dirname(profileCitation.target)));
    stageFile(migrationRoot, dataSafety);
    stageFile(migrationRoot, subjectiveCitation.target);
    linkDirectory(migrationRoot, priorPath, external);

    const escapeReason = 'path escapes repository containment';
    const escapedDoc = verifyBetaFilingCitations({ repoRoot: docRoot });
    check('WO04-R9: required filing document cannot follow a junction outside the checkout',
      !escapedDoc.ok && escapedDoc.errors.some((error) => error.startsWith(`${disclaimer}:`) && error.includes(escapeReason)),
      escapedDoc.errors.filter((error) => error.startsWith(`${disclaimer}:`)).join(' | ') || 'no containment error');
    checkCitationError('cited source cannot follow a junction outside the checkout',
      verifyBetaFilingCitations({ repoRoot: sourceRoot }), profileCitation, escapeReason);
    checkCitationError('prior migration cannot follow a junction outside the checkout',
      verifyBetaFilingCitations({ repoRoot: migrationRoot }), subjectiveCitation, `${escapeReason}: ${priorPath}`);
  } finally {
    if (path.dirname(tempRoot) !== fs.realpathSync(os.tmpdir())) throw new Error('Unexpected fixture root');
    fs.rmSync(tempRoot, { recursive: true });
  }

  const { scripts } = JSON.parse(readRepoFile('package.json'));
  check('WO04-R9: CI and release run the citation verifier and its regression suite',
    scripts['verify:beta-citations'] === 'node tools/verify_beta_filing_citations.mjs && node tools/test_verify_beta_filing_citations.mjs'
      && scripts['verify:release'].endsWith(' && npm run verify:beta-citations')
      && scripts['verify:ci'].endsWith(' && npm run verify:beta-citations'),
    scripts['verify:ci'].split(' && ').at(-1));

  const emptyPrior = mutateRepoFile(priorPath, () => ' \t\r\n');
  checkCitationError('whitespace-only prior migrations fail closed', emptyPrior, subjectiveCitation,
    `SQLite schema execution failed: Error: prior migration is empty: ${priorPath}`);

  const internet = citationAt(dataSafety, 0);
  const permissionError = 'missing active XML <uses-permission android:name="android.permission.INTERNET" tools:node="remove"> element';
  const nameAttr = 'android:name="android.permission.INTERNET"';
  const removeAttr = 'tools:node="remove"';
  for (const requiredAttr of [nameAttr, removeAttr]) {
    const displaced = mutateRepoFile(internet.target, (real) => {
      const lines = real.split(/\r\n?|\n/);
      // Leave a textual decoy where the citation expects the real namespaced attribute.
      lines[internet.start] = `        ${requiredAttr === nameAttr ? `data-name='${nameAttr}'` : nameAttr}`;
      lines[internet.end - 1] = `        data-node='${removeAttr} />'${requiredAttr === nameAttr ? ` ${removeAttr}` : ''}`;
      lines[internet.end] = `        ${requiredAttr} />${lines[internet.end]}`;
      return lines.join('\n');
    });
    checkCitationError(`${requiredAttr} must be inside the cited multiline permission`, displaced, internet, permissionError);
  }

  const withExtraAttribute = (space) => mutateRepoFile(internet.target,
    (real) => real.replace(nameAttr, `data-extra="x"${space}${nameAttr}`));
  checkCitationError('xmldom warnings for unspaced attributes fail closed', withExtraAttribute(''), internet,
    'malformed XML: [xmldom warning]');
  const spacedAttributes = withExtraAttribute(' ');
  check('WO04-R9: correctly spaced attributes in a multiline permission remain valid', spacedAttributes.ok,
    spacedAttributes.errors[0] ?? '');

  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n'], ['bare CR', '\r']]) {
    const unicodeManifest = mutateRepoFile(internet.target, (real) => real
      .replace('Read-only by design:', 'Read-only by design:\u2028')
      .replace(/\r\n?|\n/g, eol));
    check(`WO04-R9: U+2028 does not shift XML attribute and element locators with ${label}`, unicodeManifest.ok,
      unicodeManifest.errors[0] ?? '');
  }

  for (const explain of ['EXPLAIN ', 'EXPLAIN QUERY PLAN ']) {
    const explainedTable = mutateRepoFile(subjectiveCitation.target, (real) => {
      const ddl = real.match(subjectiveTable)[0];
      return real.replace(ddl, `${explain}${ddl}\n${ddl}`);
    });
    checkCitationError(`${explain.trim()} is not CREATE TABLE evidence when the table is created elsewhere`,
      explainedTable, subjectiveCitation, 'no CREATE TABLE statement for "subjective_report" starts in cited lines');
  }
  const splitExplain = mutateRepoFile(subjectiveCitation.target, (real) => {
    const lines = real.split(/\r\n?|\n/);
    lines[subjectiveCitation.start - 2] = 'EXPLAIN';
    const ddl = real.match(subjectiveTable)[0];
    return lines.join('\n').replace(ddl, `${ddl}\n${ddl}`);
  });
  checkCitationError('EXPLAIN on the preceding line disqualifies the cited CREATE TABLE', splitExplain, subjectiveCitation,
    'no CREATE TABLE statement for "subjective_report" starts in cited lines');

  // Parse the mutated backupStore.ts as TSX so the probe reaches anchor matching, not syntax rejection.
  const ts = createRequire(import.meta.url)('typescript');
  const pickerAnchor = exportCitation.spec.endAnchor;
  const jsxTextSpoof = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => rel === exportCitation.target
      ? readRepoFile(rel).replace('const rows = <T>', 'const rows = <T,>')
        .replace(pickerAnchor, `<div>${pickerAnchor}</div>;`)
      : readRepoFile(rel),
    tsCompiler: {
      ...ts,
      createSourceFile: (file, source, target, parents, kind) =>
        ts.createSourceFile(file, source, target, parents, file === exportCitation.target ? ts.ScriptKind.TSX : kind),
    },
  });
  checkCitationError('pickerSave inside a JSX text node is not statement evidence', jsxTextSpoof, exportCitation,
    `end line ${exportCitation.end} does not contain expected end anchor "${pickerAnchor}"`);

  const haltCitation = citationAt(disclaimer, 0);
  const haltText = 'Stop training for today.';
  const realHalt = mutateRepoFile(haltCitation.target, (real) => real.replace(
    haltCitation.spec.startAnchor, `<View>${haltCitation.spec.startAnchor}</View>`,
  ));
  check('WO04-R9: the SessionScreen JSX element retains its exact text', realHalt.ok, realHalt.errors[0] ?? '');
  const alteredHalt = mutateRepoFile(haltCitation.target, (real) => real.replace(haltText, 'Stop training for now.'));
  checkCitationError('the JSX element still requires its exact text', alteredHalt, haltCitation,
    `does not contain expected anchor "${haltCitation.spec.startAnchor}"`);

  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n'], ['bare CR', '\r']]) {
    const brokenDestination = hideProfile(`[see](<url\\\ncontinued> "title ${profileCitationToken}")`, eol);
    check(`WO04-R9: a backslash cannot escape ${label} in an angle-bracket destination`, brokenDestination.ok,
      brokenDestination.errors.join(' | '));
  }
  hiddenProfileCitation('an escaped closing angle bracket keeps the link title hidden',
    hideProfile(`[see](<url\\>more> "title ${profileCitationToken}")`));
}

console.log(`\n${failed === 0 ? 'ALL BETA FILING CITATION TESTS PASSED' : `${failed} TEST(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
