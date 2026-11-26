/**
 * verify_beta_filing_citations.mjs — Worktree citation & semantic-anchor verifier
 * for the six Play Store / regulatory beta filing drafts under `docs/release/beta/`.
 *
 * Unlike `docs/release/beta/plan/*.md` (which are intentionally pinned to historical
 * commits `26f6557a` and `47857623` in `tools/device-validation/verify_plan.py`),
 * the six top-level filing drafts carry unprefixed `file:line` evidence references
 * intended to point at the current release-integration checkout.
 *
 * Enforces fail-closed invariants:
 *   1. Every required filing document exists, is non-empty, and cites >= 1 source location.
 *   2. Total citation count across the six documents equals EXPECTED_CITATION_COUNT (57).
 *   3. Every cited path resolves inside the repository and `1 <= start <= end <= lineCount`.
 *   4. Every `(doc, path, start)` coordinate matches its expected semantic anchor substring
 *      on that exact source line, so a silent line shift after a merge fails closed and
 *      reports the moved line number.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_FILING_DOCS = Object.freeze([
  'docs/release/beta/DISCLAIMER.md',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md',
  'docs/release/beta/STORE_LISTING_DRAFT.md',
]);

export const EXPECTED_CITATION_COUNT = 57;

/** Keyed by `${doc}|${occurrenceIndexInDoc}` -> expected substring on cited `start` line. */
export const EXPECTED_ANCHORS = Object.freeze({
  'docs/release/beta/DISCLAIMER.md|0': '<Text style={styles.haltTitle}>Stop training for today.</Text>',
  'docs/release/beta/DISCLAIMER.md|1': 'pikeMethods provides training guidance, not medical advice. It is not a medical device.',

  'docs/release/beta/HEALTH_APPS_DECLARATION.md|0': 'CREATE TABLE IF NOT EXISTS session (',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|1': 'Connected. Overnight HRV and sleep feed your readiness score',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|2': 'pikeMethods provides training guidance, not medical advice. It is not a medical device.',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|3': '<Text style={styles.haltTitle}>Stop training for today.</Text>',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|4': "// restrictions stay enforced per slot below and inside the store's mutation",
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|5': 'Stop if something feels unsafe and seek qualified professional advice when needed.',

  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|0': '<uses-permission',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|1': 'createBackup: async (password) => {',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|2': 'encryptedPath = `${exportDirectory}/${fileName}`;',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|3': '/** Coach Mode: remove a non-active, non-default athlete from the registry',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|4': 'Athlete removed from the list, but their database file could not be deleted',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|5': '* The registry is a tiny JSON file in the app document directory.',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|6': 'INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source)',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|7': 'CREATE TABLE IF NOT EXISTS subjective_report (',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|8': 'CREATE TABLE IF NOT EXISTS athlete_profile (',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|9': "set({ status: 'working', message: 'Creating an encrypted snapshot",

  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|0': '<uses-permission android:name="android.permission.health.READ_SLEEP" />',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|1': "read('SleepSession'),",
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|2': '<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|3': "read('HeartRateVariabilityRmssd'),",
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|4': '<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|5': "read('RestingHeartRate'),",
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|6': 'Connected. Overnight HRV and sleep feed your readiness score',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|7': 'Connected. Overnight HRV and sleep feed your readiness score',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|8': '* On both platforms HRV (where read) and sleep feed readiness; resting heart',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|9': 'UNION SELECT date FROM hrv_daily UNION SELECT date FROM sleep_daily',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|10': 'INSERT INTO resting_hr_daily (date, bpm, source, synced_at_ms)',

  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|0': 'offline posture: the production app has no in-process network',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|1': '/** Coach Mode (Phase 15): registered athletes',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|2': '* The registry is a tiny JSON file in the app document directory.',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|3': 'CREATE TABLE IF NOT EXISTS athlete_profile (',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|4': 'CREATE TABLE IF NOT EXISTS athlete_focus (',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|5': 'CREATE TABLE IF NOT EXISTS session (',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|6': 'CREATE TABLE IF NOT EXISTS subjective_report (',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|7': 'CREATE TABLE IF NOT EXISTS health_support_profile (',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|8': 'const [hrv, rhr, sleep] = await Promise.all([',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|9': 'const [sleep, restingHr] = await Promise.all([',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|10': 'INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source)',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|11': '* On both platforms HRV (where read) and sleep feed readiness; resting heart',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|12': 'Connected. Overnight HRV and sleep feed your readiness score',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|13': "scope: 'all-athletes',",
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|14': 'createBackup: async (password) => {',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|15': 'confirmRestore: async (_password) => {',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|16': "set({ status: 'success', message: 'Restore complete. All athlete data was replaced from the backup.'",
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|17': '/** Coach Mode: remove a non-active, non-default athlete from the registry',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|18': 'deleteAthlete: async (id) => {',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|19': 'Athlete removed from the list, but their database file could not be deleted',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|20': 'android:allowBackup="false"',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|21': '* (idempotent) so a container restored by the OS is re-protected.',

  // Intentional `:1` file-presence anchors documented in RECORDS_2026-11-06.md:21
  'docs/release/beta/STORE_LISTING_DRAFT.md|0': '/**',
  'docs/release/beta/STORE_LISTING_DRAFT.md|1': '/** Phase 17 utility-first active-session surface. */',
  'docs/release/beta/STORE_LISTING_DRAFT.md|2': '/**',
  'docs/release/beta/STORE_LISTING_DRAFT.md|3': 'Connected. Overnight HRV and sleep feed your readiness score',
  'docs/release/beta/STORE_LISTING_DRAFT.md|4': '/** Coach Mode (Phase 15): registered athletes',
  'docs/release/beta/STORE_LISTING_DRAFT.md|5': 'createBackup: async (password) => {',
});

const CITATION_RE = /`((?:apps|packages|tools)\/[\w/.-]+):(\d+)(?:-(\d+))?`/g;

export function verifyBetaFilingCitations({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  readFile = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8'),
  exists = (relPath) => fs.existsSync(path.join(repoRoot, relPath)),
} = {}) {
  const errors = [];
  const sourceCache = new Map();
  const getLines = (relPath) => {
    if (!sourceCache.has(relPath)) {
      sourceCache.set(relPath, readFile(relPath).split(/\r?\n/));
    }
    return sourceCache.get(relPath);
  };

  let totalCitations = 0;

  for (const doc of REQUIRED_FILING_DOCS) {
    if (!exists(doc)) {
      errors.push(`${doc}: required filing document is missing`);
      continue;
    }
    const text = readFile(doc);
    if (!text.trim()) {
      errors.push(`${doc}: filing document is empty`);
      continue;
    }
    const matches = [...text.matchAll(CITATION_RE)];
    if (matches.length === 0) {
      errors.push(`${doc}: filing document cites zero source locations`);
      continue;
    }

    matches.forEach((m, idx) => {
      totalCitations += 1;
      const [, targetPath, startStr, endStr] = m;
      const start = Number.parseInt(startStr, 10);
      const end = endStr === undefined ? start : Number.parseInt(endStr, 10);
      const key = `${doc}|${idx}`;
      const expectedAnchor = EXPECTED_ANCHORS[key];

      if (expectedAnchor === undefined) {
        errors.push(`${doc} [#${idx}] (${m[0]}): unmapped citation slot ${key}`);
        return;
      }
      if (!exists(targetPath)) {
        errors.push(`${doc} (${m[0]}): target file does not exist: ${targetPath}`);
        return;
      }
      const lines = getLines(targetPath);
      if (start < 1 || end < start || end > lines.length) {
        errors.push(`${doc} (${m[0]}): line range ${start}-${end} out of bounds (1..${lines.length})`);
        return;
      }
      const actualLine = lines[start - 1];
      if (!actualLine.includes(expectedAnchor)) {
        const movedTo = lines
          .map((line, i) => (line.includes(expectedAnchor) ? i + 1 : -1))
          .filter((n) => n > 0);
        const hint = movedTo.length > 0 ? ` (anchor now at line ${movedTo.join(',')})` : ' (anchor not found in file)';
        errors.push(
          `${doc} (${m[0]}): line ${start} does not contain expected anchor "${expectedAnchor}"${hint}; got "${actualLine.trim().slice(0, 80)}"`,
        );
      }
    });
  }

  if (errors.length === 0 && totalCitations !== EXPECTED_CITATION_COUNT) {
    errors.push(`expected ${EXPECTED_CITATION_COUNT} total citations across ${REQUIRED_FILING_DOCS.length} docs, found ${totalCitations}`);
  }

  return {
    ok: errors.length === 0,
    checkedDocs: REQUIRED_FILING_DOCS.length,
    totalCitations,
    errors,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const res = verifyBetaFilingCitations({ repoRoot });
  if (!res.ok) {
    console.error(`BETA FILING CITATIONS REJECTED (${res.errors.length} failure(s)):`);
    for (const err of res.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(
    `BETA FILING CITATIONS VERIFIED: ${res.totalCitations} citations across ${res.checkedDocs} documents match worktree anchors.`,
  );
}
