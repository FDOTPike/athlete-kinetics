/**
 * ios_ui_annotate.mjs — publish one XCUITest run's result as GitHub Actions
 * annotations (job logs and artifacts are not reachable from every reviewer
 * environment; annotations are served by the API itself).
 *
 *   node tools/ios_ui_annotate.mjs <test-name> <xcodebuild-exit-code> <log>
 *
 * Passed: one notice carrying the test's AKUI observation lines. Failed (or no
 * pass line): one error with the XCTest failure messages and accessibility
 * audit issues, and one with the start of the element tree at failure.
 * Content-free beyond what the test log already contains. Never fails the job.
 */
import { existsSync, readFileSync } from 'node:fs';

const [test, codeText, logPath] = process.argv.slice(2);
const code = Number(codeText);
const escape = (text) => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const cap = (text, n) => (text.length > n ? `${text.slice(0, n)}…` : text);
const lines = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n') : [];
const observations = lines.filter((l) => l.startsWith('AKUI ') && !l.startsWith('AKUI A11Y ') && !l.startsWith('AKUI FAIL-TREE ')
  && !l.startsWith('AKUI files sheet without'))
  .map((l) => l.slice(5).trim());
const a11y = lines.filter((l) => l.startsWith('AKUI A11Y ')).map((l) => l.slice(10).trim());
const tree = lines.find((l) => l.startsWith('AKUI FAIL-TREE '));
const failures = [...new Set(lines.filter((l) => /: error: -\[|XCTAssert\w* failed|failed - |Failed to |did not appear|never became/.test(l)
  && !l.startsWith('AKUI')).map((l) => l.trim()))];
const passed = code === 0 && lines.some((l) => /Test Case .*\b(passed)\b/.test(l) || /\*\* TEST EXECUTE SUCCEEDED \*\*/.test(l));
const xcodebuildErrors = lines.filter((l) => /^xcodebuild: error|Testing failed:|Unable to |Early unexpected exit/.test(l.trim())).map((l) => l.trim());

if (passed) {
  console.log(`::notice title=ui ${test} passed::${escape(cap(observations.join(' | ') || '(no observations printed)', 4000))}`);
} else {
  const parts = [`exit ${code}`, ...failures.slice(0, 8), ...xcodebuildErrors.slice(0, 4)];
  if (a11y.length > 0) parts.push(`${a11y.length} accessibility audit issue(s): ${a11y.slice(0, 25).join(' || ')}`);
  parts.push(`observations: ${observations.slice(-12).join(' | ')}`);
  console.log(`::error title=ui ${test} failed::${escape(cap(parts.join(' ### '), 6000))}`);
  // GitHub keeps 10 errors per step: the on-screen inventory goes out as a
  // warning so every test's result fits.
  const sheet = lines.find((l) => l.startsWith('AKUI files sheet without'));
  const screen = [sheet?.slice(5), tree?.slice(15)].filter(Boolean).join(' ### ');
  if (screen) console.log(`::warning title=ui ${test} on screen at failure::${escape(cap(screen, 6000))}`);
}
