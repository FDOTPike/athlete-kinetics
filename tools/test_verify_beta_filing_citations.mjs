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
      && !matchesExactProfileCitation(driftRes.errors[0], 'apps/mobile/src/screens/ProfileScreen.tsx:506-507'),
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
  const sqlCommentedTableRes = verifyBetaFilingCitations({
    repoRoot,
    readFile: (rel) => {
      const real = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel !== 'packages/core-db/src/schema/066_focus_and_goals.sql') return real;
      return real.replace('CREATE TABLE IF NOT EXISTS athlete_goal (', '-- CREATE TABLE IF NOT EXISTS athlete_goal (');
    },
  });
  check(
    'WO04-SOL-02-R3: commenting out cited XML permission removal, TS backup sealing, or SQL table definition fails closed',
    !xmlCommentedManifestRes.ok && !tsCommentedSealRes.ok && !sqlCommentedTableRes.ok,
    [xmlCommentedManifestRes.ok, tsCommentedSealRes.ok, sqlCommentedTableRes.ok].join(','),
  );

  // WO04-SOL-04..06-R3: filing spans cover export invocation, restore authentication + preview, sleep_daily storage, and readiness exclusion
  const dataSafetyDoc = fs.readFileSync(path.join(repoRoot, 'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md'), 'utf8');
  const privacyDoc = fs.readFileSync(path.join(repoRoot, 'docs/release/beta/PRIVACY_POLICY_DRAFT.md'), 'utf8');
  const hcDoc = fs.readFileSync(path.join(repoRoot, 'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md'), 'utf8');
  check(
    'WO04-SOL-04..06-R3: Data Safety, Privacy Policy, and Health Connect spans cover full export, restore auth/preview, sleep_daily, and RHR readiness exclusion',
    dataSafetyDoc.includes('`apps/mobile/src/state/backupStore.ts:605-1066`')
      && dataSafetyDoc.includes('`apps/mobile/src/state/useStore.ts:7670-7696`')
      && privacyDoc.includes('`apps/mobile/src/state/backupStore.ts:1087-1207`')
      && privacyDoc.includes('`apps/mobile/src/state/useStore.ts:7670-7696`')
      && privacyDoc.includes('`apps/mobile/src/state/biometricsCopy.ts:13-15`')
      && hcDoc.includes('`apps/mobile/src/state/biometricsCopy.ts:13-15`'),
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
  const profileCitationToken = '`apps/mobile/src/screens/ProfileScreen.tsx:517-518`';
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
  const unclosedBacktickInRefLabelRes = mutateDisclaimerProfileCitation(
    `[see][a \`b]\n${profileCitationToken}\n\n[a \`b]: /url`,
  );
  check(
    'WO04-ASTRA-R7a: resolved reference-link labels hide citations while undefined/collapsed/deactivated refs, unclosed-backtick labels, and mixed `*-_` lines match CommonMark',
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
      && matchingThematicBreakRes.totalCitations === 56
      && !unclosedBacktickInRefLabelRes.ok
      && unclosedBacktickInRefLabelRes.totalCitations === 56,
    [
      refLabelHiddenRes.ok,
      undefinedRefControlRes.ok,
      collapsedRefControlRes.ok,
      deactivatedOuterRefControlRes.ok,
      mixedThematicBreakRes.ok,
      matchingThematicBreakRes.ok,
      unclosedBacktickInRefLabelRes.ok,
    ].join(','),
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

console.log(`\n${failed === 0 ? 'ALL BETA FILING CITATION TESTS PASSED' : `${failed} TEST(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
