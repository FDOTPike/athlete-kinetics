/**
 * verify_beta_filing_citations.mjs — Worktree citation, path-identity, & range-anchor
 * verifier for the six Play Store / regulatory beta filing drafts under `docs/release/beta/`.
 *
 * Unlike `docs/release/beta/plan/*.md` (which are intentionally pinned to historical
 * commits `26f6557a` and `47857623` in `tools/device-validation/verify_plan.py`),
 * the six top-level filing drafts carry unprefixed `file:line` / `file:start-end`
 * evidence references intended to point at the current release-integration checkout.
 *
 * Enforces fail-closed invariants:
 *   1. Every required filing document exists, is non-empty, and cites >= 1 source location.
 *   2. Fenced blocks and multi-backtick literals are never counted as live citations, and
 *      malformed `apps/|packages/|tools/` code spans fail closed.
 *   3. Every cited path is repository-contained (`..` / absolute paths rejected before I/O),
 *      matches the expected source path for that citation slot, and `1 <= start <= end <= physicalLineCount`.
 *   4. Every citation matches its expected `startAnchor`, `endAnchor`, `prevAnchor` (when
 *      disambiguating duplicate lines), and all `rangeAnchors` inside `start..end`.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFromHere = createRequire(import.meta.url);
let cachedTs = undefined;
function loadTypeScriptCompiler() {
  if (cachedTs !== undefined) return cachedTs;
  try {
    cachedTs = requireFromHere('typescript');
  } catch {
    cachedTs = null;
  }
  return cachedTs;
}

export const REQUIRED_FILING_DOCS = Object.freeze([
  'docs/release/beta/DISCLAIMER.md',
  'docs/release/beta/HEALTH_APPS_DECLARATION.md',
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md',
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md',
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md',
  'docs/release/beta/STORE_LISTING_DRAFT.md',
]);

export const EXPECTED_CITATION_COUNT = 57;

export const EXPECTED_ANCHORS = Object.freeze({
  'docs/release/beta/DISCLAIMER.md|0': {
    path: 'apps/mobile/src/screens/SessionScreen.tsx',
    isRange: false,
    startAnchor: '<Text style={styles.haltTitle}>Stop training for today.</Text>',
  },
  'docs/release/beta/DISCLAIMER.md|1': {
    path: 'apps/mobile/src/screens/ProfileScreen.tsx',
    isRange: true,
    prevAnchor: '<Text style={styles.safetyText}>',
    startAnchor: 'pikeMethods provides training guidance, not medical advice. It is not a medical device.',
    endAnchor: 'Stop if something feels unsafe and seek qualified professional advice when needed.',
  },

  'docs/release/beta/HEALTH_APPS_DECLARATION.md|0': {
    path: 'packages/core-db/src/schema/001_mechanical_input.sql',
    isRange: true,
    startAnchor: 'CREATE TABLE IF NOT EXISTS session (',
    rangeAnchors: ['CREATE TABLE IF NOT EXISTS set_record ('],
    endAnchor: 'rpe              REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10),',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|1': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|2': {
    path: 'apps/mobile/src/screens/ProfileScreen.tsx',
    isRange: false,
    prevAnchor: '<Text style={styles.safetyText}>',
    startAnchor: 'pikeMethods provides training guidance, not medical advice. It is not a medical device.',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|3': {
    path: 'apps/mobile/src/screens/SessionScreen.tsx',
    isRange: true,
    startAnchor: "const triageHalted = lastTriage?.kind === 'matched' && lastTriage.directive.halt;",
    rangeAnchors: ["const halted = runnerPhase === 'halted' || (!runnerComplete && triageHalted);"],
    endAnchor: '<Text style={styles.haltTitle}>Stop training for today.</Text>',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|4': {
    path: 'apps/mobile/src/screens/SessionScreen.tsx',
    isRange: true,
    startAnchorIsComment: true,
    startAnchor: "// restrictions stay enforced per slot below and inside the store's mutation",
    rangeAnchors: ["if (state.getTrainingSupportDecision([currentMovement.movement_id]).status !== 'available') return;"],
    endAnchor: 'if (!currentSlotExecutable) return;',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|5': {
    path: 'apps/mobile/src/screens/ProfileScreen.tsx',
    isRange: false,
    prevAnchor: 'pikeMethods provides training guidance, not medical advice. It is not a medical device.',
    startAnchor: 'Stop if something feels unsafe and seek qualified professional advice when needed.',
  },

  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|0': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: true,
    startAnchor: '<uses-permission',
    rangeAnchors: ['android:name="android.permission.INTERNET"'],
    endAnchor: 'tools:node="remove" />',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|1': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'async function createEncryptedBytes(',
    rangeAnchors: [
      'sealBackup(archive, password, mobileBackupCrypto)',
      'saveDocuments(',
      'createBackup: async (password) => {',
      "await fs().writeFile(encryptedPath, created.text, 'utf8');",
    ],
    endAnchor: 'const saved = await pickerSave(encryptedPath, fileName);',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|2': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'const created = await createEncryptedBytes(password, get().lastSuccessfulBackupAt);',
    rangeAnchors: ["await fs().writeFile(encryptedPath, created.text, 'utf8');"],
    endAnchor: 'const saved = await pickerSave(encryptedPath, fileName);',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|3': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: true,
    startAnchorIsComment: true,
    startAnchor: '/** Coach Mode: remove a non-active, non-default athlete from the registry',
    endAnchor: 'deleteAthlete: (id: string) => Promise<boolean>;',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|4': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: true,
    startAnchor: 'deleteAthlete: async (id) => {',
    rangeAnchors: [
      "set({ error: 'The active and default athletes cannot be deleted.' });",
      'open({ name: removed.dbName }).delete();',
    ],
    endAnchor: 'Athlete removed from the list, but their database file could not be deleted',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|5': {
    path: 'apps/mobile/src/state/athleteRegistry.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '* The registry is a tiny JSON file in the app document directory.',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|6': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: true,
    startAnchor: 'INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source)',
    rangeAnchors: [
      'INSERT INTO resting_hr_daily (date, bpm, source, synced_at_ms)',
      'INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min)',
      '[r.date, r.inBedMin, r.asleepMin ?? 0, r.deepMin, r.remMin, r.lightMin],',
    ],
    endAnchor: ');',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|7': {
    path: 'packages/core-db/src/schema/005_subjective_report.sql',
    isRange: false,
    startAnchor: 'CREATE TABLE IF NOT EXISTS subjective_report (',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|8': {
    path: 'packages/core-db/src/schema/007_program_engine.sql',
    isRange: false,
    startAnchor: 'CREATE TABLE IF NOT EXISTS athlete_profile (',
  },
  'docs/release/beta/GOOGLE_DATA_SAFETY_ANSWERS.md|9': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'async function createEncryptedBytes(',
    rangeAnchors: ['sealBackup(archive, password, mobileBackupCrypto)'],
    endAnchor: '}',
  },

  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|0': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: false,
    startAnchor: '<uses-permission android:name="android.permission.health.READ_SLEEP" />',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|1': {
    path: 'packages/biometrics/src/healthConnect.ts',
    isRange: false,
    startAnchor: "read('SleepSession'),",
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|2': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: false,
    startAnchor: '<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|3': {
    path: 'packages/biometrics/src/healthConnect.ts',
    isRange: false,
    startAnchor: "read('HeartRateVariabilityRmssd'),",
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|4': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: false,
    startAnchor: '<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|5': {
    path: 'packages/biometrics/src/healthConnect.ts',
    isRange: false,
    startAnchor: "read('RestingHeartRate'),",
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|6': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|7': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|8': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: true,
    startAnchorIsComment: true,
    endAnchorIsComment: true,
    rangeAnchorsAreComments: true,
    startAnchor: '* On both platforms HRV (where read) and sleep feed readiness; resting heart',
    rangeAnchors: ['rate is kept with the measured days and does not feed readiness, so no copy'],
    endAnchor: '* says it does.',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|9': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: true,
    startAnchor: 'UNION SELECT date FROM hrv_daily UNION SELECT date FROM sleep_daily',
    rangeAnchors: [
      'UNION SELECT date FROM resting_hr_daily',
      'COALESCE(rhr.bpm, h.resting_hr) AS resting_hr',
      'LEFT JOIN resting_hr_daily rhr USING (date)',
    ],
    endAnchor: 'restingHr: row.resting_hr, sleepMinutes: row.asleep_min,',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|10': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchor: 'INSERT INTO resting_hr_daily (date, bpm, source, synced_at_ms)',
  },

  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|0': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: true,
    startAnchorIsComment: true,
    startAnchor: 'offline posture: the production app has no in-process network',
    rangeAnchors: ['<uses-permission', 'android:name="android.permission.INTERNET"'],
    endAnchor: 'tools:node="remove" />',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|1': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/** Coach Mode (Phase 15): registered athletes',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|2': {
    path: 'apps/mobile/src/state/athleteRegistry.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '* The registry is a tiny JSON file in the app document directory.',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|3': {
    path: 'packages/core-db/src/schema/007_program_engine.sql',
    isRange: false,
    startAnchor: 'CREATE TABLE IF NOT EXISTS athlete_profile (',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|4': {
    path: 'packages/core-db/src/schema/066_focus_and_goals.sql',
    isRange: true,
    startAnchor: 'CREATE TABLE IF NOT EXISTS athlete_focus (',
    rangeAnchors: ['CREATE TABLE IF NOT EXISTS athlete_goal ('],
    endAnchor: ') STRICT;',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|5': {
    path: 'packages/core-db/src/schema/001_mechanical_input.sql',
    isRange: true,
    startAnchor: 'CREATE TABLE IF NOT EXISTS session (',
    rangeAnchors: ['CREATE TABLE IF NOT EXISTS set_record ('],
    endAnchor: 'rpe              REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10),',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|6': {
    path: 'packages/core-db/src/schema/005_subjective_report.sql',
    isRange: false,
    startAnchor: 'CREATE TABLE IF NOT EXISTS subjective_report (',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|7': {
    path: 'packages/core-db/src/schema/064_accessible_coach_support.sql',
    isRange: false,
    startAnchor: 'CREATE TABLE IF NOT EXISTS health_support_profile (',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|8': {
    path: 'packages/biometrics/src/healthConnect.ts',
    isRange: false,
    startAnchor: 'const [hrv, rhr, sleep] = await Promise.all([',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|9': {
    path: 'packages/biometrics/src/appleHealth.ts',
    isRange: false,
    startAnchor: 'const [sleep, restingHr] = await Promise.all([',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|10': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: true,
    startAnchor: 'INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source)',
    rangeAnchors: [
      'INSERT INTO resting_hr_daily (date, bpm, source, synced_at_ms)',
      'INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min)',
      '[r.date, r.inBedMin, r.asleepMin ?? 0, r.deepMin, r.remMin, r.lightMin],',
    ],
    endAnchor: ');',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|11': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: true,
    startAnchorIsComment: true,
    endAnchorIsComment: true,
    rangeAnchorsAreComments: true,
    startAnchor: '* On both platforms HRV (where read) and sleep feed readiness; resting heart',
    rangeAnchors: ['rate is kept with the measured days and does not feed readiness, so no copy'],
    endAnchor: '* says it does.',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|12': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|13': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: false,
    startAnchor: "scope: 'all-athletes',",
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|14': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'async function createEncryptedBytes(',
    rangeAnchors: [
      'sealBackup(archive, password, mobileBackupCrypto)',
      'createBackup: async (password) => {',
      "await fs().writeFile(encryptedPath, created.text, 'utf8');",
    ],
    endAnchor: 'const saved = await pickerSave(encryptedPath, fileName);',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|15': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'chooseRestore: async (password) => {',
    rangeAnchors: [
      "const opened = await openBackup(asText(await fs().readFile(localPath, 'utf8')), password, mobileBackupCrypto);",
      "set({ status: 'preview', message: 'Review this backup before replacing data.', preview: restorePreview(pending) });",
      'confirmRestore: async (_password) => {',
      'await publishRecoveryBackup(',
      'const opened = await openBackup(text, restorePassword, mobileBackupCrypto);',
    ],
    endAnchor: 'await replaceAllData(pending.archive);',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|16': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: false,
    startAnchor: "set({ status: 'success', message: 'Restore complete. All athlete data was replaced from the backup.'",
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|17': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/** Coach Mode: remove a non-active, non-default athlete from the registry',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|18': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchor: 'deleteAthlete: async (id) => {',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|19': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchor: 'Athlete removed from the list, but their database file could not be deleted',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|20': {
    path: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
    isRange: false,
    startAnchor: 'android:allowBackup="false"',
  },
  'docs/release/beta/PRIVACY_POLICY_DRAFT.md|21': {
    path: 'apps/mobile/src/state/deviceBackupPolicy.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '* (idempotent) so a container restored by the OS is re-protected.',
  },

  // Intentional `:1` file-presence anchors documented in RECORDS_2026-11-06.md:21
  'docs/release/beta/STORE_LISTING_DRAFT.md|0': {
    path: 'apps/mobile/src/screens/OnboardingScreen.tsx',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/**',
  },
  'docs/release/beta/STORE_LISTING_DRAFT.md|1': {
    path: 'apps/mobile/src/screens/SessionScreen.tsx',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/** Phase 17 utility-first active-session surface. */',
  },
  'docs/release/beta/STORE_LISTING_DRAFT.md|2': {
    path: 'apps/mobile/src/screens/ProgressScreen.tsx',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/**',
  },
  'docs/release/beta/STORE_LISTING_DRAFT.md|3': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/STORE_LISTING_DRAFT.md|4': {
    path: 'apps/mobile/src/state/useStore.ts',
    isRange: false,
    startAnchorIsComment: true,
    startAnchor: '/** Coach Mode (Phase 15): registered athletes',
  },
  'docs/release/beta/STORE_LISTING_DRAFT.md|5': {
    path: 'apps/mobile/src/state/backupStore.ts',
    isRange: true,
    startAnchor: 'async function createEncryptedBytes(',
    rangeAnchors: [
      'sealBackup(archive, password, mobileBackupCrypto)',
      'createBackup: async (password) => {',
      "await fs().writeFile(encryptedPath, created.text, 'utf8');",
    ],
    endAnchor: 'const saved = await pickerSave(encryptedPath, fileName);',
  },
});

const STRICT_CITATION_TOKEN_RE = /^((?:apps|packages|tools)\/[A-Za-z0-9_./-]+):(\d+)(?:-(\d+))?$/;

function isRepoContainedRelativePath(repoRoot, relPath) {
  if (!relPath || path.isAbsolute(relPath) || relPath.includes('\\')) return false;
  const segments = relPath.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) return false;
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(resolvedRoot, relPath);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const ASCII_PUNCT_RE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const HTML_TYPE1_OPEN_RE = /^<(pre|script|style|textarea)(?:[ \t>]|$)/i;
const HTML_TYPE1_CLOSE_RE = /<\/(?:pre|script|style|textarea)\s*>/i;
const HTML_TYPE2_OPEN_RE = /^<!--/;
const HTML_TYPE2_CLOSE_RE = /-->/;
const HTML_TYPE3_OPEN_RE = /^<\?/;
const HTML_TYPE3_CLOSE_RE = /\?>/;
const HTML_TYPE4_OPEN_RE = /^<![A-Za-z]/;
const HTML_TYPE4_CLOSE_RE = />/;
const HTML_TYPE5_OPEN_RE = /^<!\[CDATA\[/;
const HTML_TYPE5_CLOSE_RE = /\]\]>/;
const HTML_TYPE6_OPEN_RE = /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t/>]|$)/i;
const HTML_TYPE7_OPEN_RE = /^(?:<(?!(?:pre|script|style|textarea)(?:[ \t/>]|$))[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:[^\s"'=<>`]+|'[^'\r\n]*'|"[^"\r\n]*"))?)*[ \t]*\/?>|<\/(?!(?:pre|script|style|textarea)(?:[ \t>]|$))[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*$/i;

function expandTabsToSpaces(rawLine) {
  let out = '';
  let col = 0;
  for (let i = 0; i < rawLine.length; i += 1) {
    const ch = rawLine[i];
    if (ch === '\t') {
      const width = 4 - (col % 4);
      out += ' '.repeat(width);
      col += width;
    } else {
      out += ch;
      col += 1;
    }
  }
  return out;
}

function leadingSpaceCount(str) {
  let idx = 0;
  while (idx < str.length && str[idx] === ' ') idx += 1;
  return idx;
}

function matchOpenContainers(expandedLine, containers) {
  let rest = expandedLine;
  let matchedCount = 0;
  while (matchedCount < containers.length) {
    const c = containers[matchedCount];
    const spaces = leadingSpaceCount(rest);
    const trimmed = rest.slice(spaces);
    if (c.type === 'blockquote') {
      if (spaces <= 3 && trimmed[0] === '>') {
        rest = trimmed[1] === ' ' ? trimmed.slice(2) : trimmed.slice(1);
        matchedCount += 1;
      } else {
        break;
      }
    } else if (c.type === 'list') {
      if (trimmed.length === 0) {
        rest = '';
        matchedCount += 1;
      } else if (spaces >= c.indent) {
        rest = rest.slice(c.indent);
        matchedCount += 1;
      } else {
        break;
      }
    }
  }
  return { rest, matchedCount, matchedAll: matchedCount === containers.length };
}

function openNewContainers(startRest, containers, inParagraphInitial) {
  let rest = startRest;
  let inParagraph = inParagraphInitial;
  while (true) {
    const spaces = leadingSpaceCount(rest);
    if (spaces > 3) break;
    const trimmed = rest.slice(spaces);
    if (trimmed[0] === '>') {
      containers.push({ type: 'blockquote' });
      rest = trimmed[1] === ' ' ? trimmed.slice(2) : trimmed.slice(1);
      inParagraph = false;
      continue;
    }
    // CommonMark §4.1 thematic break takes precedence over `-` / `*` list markers
    if (/^(?:[-_*][ ]*){3,}$/.test(trimmed)) break;
    const listMatch = /^([-+*]|\d{1,9}[.)])([ ]+|$)/.exec(trimmed);
    if (listMatch) {
      const marker = listMatch[1];
      const afterMarker = trimmed.slice(marker.length);
      const spacesAfter = leadingSpaceCount(afterMarker);
      const contentAfter = afterMarker.slice(spacesAfter);
      // CommonMark §5.2: interrupting a paragraph requires non-empty item and (if ordered) `1.` / `1)`
      if (inParagraph) {
        if (contentAfter.length === 0) break;
        if (/^\d/.test(marker) && Number.parseInt(marker, 10) !== 1) break;
      }
      let paddingCols;
      if (contentAfter.length === 0) {
        paddingCols = 1;
        rest = '';
      } else if (spacesAfter >= 5) {
        // CommonMark §5.2 rule 3: 5+ spaces after list marker means indented code on first line (N = 1)
        paddingCols = 1;
        rest = afterMarker.slice(1);
      } else {
        paddingCols = spacesAfter;
        rest = afterMarker.slice(spacesAfter);
      }
      containers.push({ type: 'list', indent: spaces + marker.length + paddingCols });
      inParagraph = false;
      continue;
    }
    break;
  }
  return { rest, inParagraph };
}

function matchHtmlBlockOpen(trimmedAfterIndent, inParagraph) {
  if (HTML_TYPE1_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'closeRe', closeRe: HTML_TYPE1_CLOSE_RE, closesImmediately: HTML_TYPE1_CLOSE_RE.test(trimmedAfterIndent) };
  }
  if (HTML_TYPE2_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'closeRe', closeRe: HTML_TYPE2_CLOSE_RE, closesImmediately: HTML_TYPE2_CLOSE_RE.test(trimmedAfterIndent) };
  }
  if (HTML_TYPE3_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'closeRe', closeRe: HTML_TYPE3_CLOSE_RE, closesImmediately: HTML_TYPE3_CLOSE_RE.test(trimmedAfterIndent) };
  }
  if (HTML_TYPE4_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'closeRe', closeRe: HTML_TYPE4_CLOSE_RE, closesImmediately: HTML_TYPE4_CLOSE_RE.test(trimmedAfterIndent) };
  }
  if (HTML_TYPE5_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'closeRe', closeRe: HTML_TYPE5_CLOSE_RE, closesImmediately: HTML_TYPE5_CLOSE_RE.test(trimmedAfterIndent) };
  }
  if (HTML_TYPE6_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'blankLine', closeRe: null, closesImmediately: false };
  }
  if (!inParagraph && HTML_TYPE7_OPEN_RE.test(trimmedAfterIndent)) {
    return { mode: 'blankLine', closeRe: null, closesImmediately: false };
  }
  return null;
}

/**
 * Strip CommonMark block containers (blockquotes, list items, fenced/indented code blocks,
 * HTML blocks Types 1-7, Setext & ATX headings, link reference definitions), inline HTML
 * tags/comments/autolinks, link destination/title tails, and backslash-escaped backticks,
 * then extract single-backtick inline code spans using CommonMark backtick-run matching.
 */
function extractLiveCitations(doc, text, errors) {
  const lines = text.split(/\r?\n/);
  const unfencedLines = [];
  const containers = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  let htmlBlock = null; // { mode: 'closeRe' | 'blankLine', closeRe: RegExp | null }
  let inParagraph = false;

  for (let i = 0; i < lines.length; i += 1) {
    const expanded = expandTabsToSpaces(lines[i]);
    const matched = matchOpenContainers(expanded, containers);
    let stripped = matched.rest;

    if (!matched.matchedAll) {
      if (inFence) {
        inFence = false;
        fenceChar = '';
        fenceLen = 0;
      }
      if (htmlBlock !== null) {
        htmlBlock = null;
      }
      if (!inParagraph) {
        containers.length = matched.matchedCount;
      }
    }

    if (htmlBlock !== null) {
      const indentCols = leadingSpaceCount(stripped);
      const isBlank = indentCols === stripped.length;
      if (htmlBlock.mode === 'blankLine') {
        if (isBlank) {
          htmlBlock = null;
          unfencedLines.push('');
        }
      } else if (htmlBlock.closeRe.test(stripped)) {
        htmlBlock = null;
      }
      inParagraph = false;
      continue;
    }

    if (inFence) {
      const indentCols = leadingSpaceCount(stripped);
      const trimmedAfterIndent = stripped.slice(indentCols);
      if (indentCols <= 3) {
        const closeMatch = /^(`{3,}|~{3,})[ ]*$/.exec(trimmedAfterIndent);
        if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLen) {
          inFence = false;
          fenceChar = '';
          fenceLen = 0;
        }
      }
      inParagraph = false;
      continue;
    }

    // CommonMark §4.3: Setext heading underline (`===` or `---`) when continuing a non-lazy paragraph
    const preOpenIndent = leadingSpaceCount(stripped);
    const preOpenTrimmed = stripped.slice(preOpenIndent);
    if (inParagraph && matched.matchedAll && preOpenIndent <= 3 && /^(?:=+|-+)[ ]*$/.test(preOpenTrimmed)) {
      inParagraph = false;
      continue;
    }

    if (!matched.matchedAll) {
      // Check whether unmatched line starts a container/block interruption rather than lazy paragraph continuation
      containers.length = matched.matchedCount;
    }

    const opened = openNewContainers(stripped, containers, inParagraph && matched.matchedAll);
    stripped = opened.rest;
    if (!opened.inParagraph) {
      inParagraph = false;
    }

    const indentCols = leadingSpaceCount(stripped);
    const trimmedAfterIndent = stripped.slice(indentCols);
    const isBlank = trimmedAfterIndent.length === 0;

    if (isBlank) {
      inParagraph = false;
      unfencedLines.push('');
      continue;
    }

    // CommonMark §4.4: 4+ virtual columns of indentation when NOT interrupting a paragraph
    if (!inParagraph && indentCols >= 4) {
      inParagraph = false;
      continue;
    }

    if (indentCols <= 3) {
      // CommonMark §4.5: fenced code block opening
      const openMatch = /^(`{3,}|~{3,})([^\r\n]*)$/.exec(trimmedAfterIndent);
      if (openMatch) {
        const marker = openMatch[1];
        const info = openMatch[2];
        if (marker[0] !== '`' || !info.includes('`')) {
          inFence = true;
          fenceChar = marker[0];
          fenceLen = marker.length;
          inParagraph = false;
          continue;
        }
      }

      // CommonMark §4.6: HTML blocks Types 1-7
      const htmlOpen = matchHtmlBlockOpen(trimmedAfterIndent, inParagraph);
      if (htmlOpen !== null) {
        if (!htmlOpen.closesImmediately) {
          htmlBlock = { mode: htmlOpen.mode, closeRe: htmlOpen.closeRe };
        }
        inParagraph = false;
        continue;
      }

      // CommonMark §4.7 single-line & multi-line link reference definitions `[id]: dest "title"`
      if (!inParagraph) {
        const linkRefHead = /^\[[^\]\r\n]+\]:[ ]*(.*)$/.exec(trimmedAfterIndent);
        if (linkRefHead) {
          const destAndTitleRe = /^(?:<[^<>\r\n]*>|\S+)(?:([ ]+)(?:"(?:\\"|[^"\r\n])*"|'(?:\\'|[^'\r\n])*'|\((?:\\\)|[^)\r\n])*\)))?[ ]*$/;
          const titleOnlyRe = /^[ ]*(?:"(?:\\"|[^"\r\n])*"|'(?:\\'|[^'\r\n])*'|\((?:\\\)|[^)\r\n])*\))[ ]*$/;
          const tail = linkRefHead[1];
          if (tail.length > 0) {
            const dtMatch = destAndTitleRe.exec(tail);
            if (dtMatch) {
              // Optional title on next line when current line had destination only
              if (!dtMatch[1] && i + 1 < lines.length) {
                const nextMatch = matchOpenContainers(expandTabsToSpaces(lines[i + 1]), containers);
                if (nextMatch.matchedAll && titleOnlyRe.test(nextMatch.rest)) {
                  i += 1;
                }
              }
              inParagraph = false;
              continue;
            }
          } else if (i + 1 < lines.length) {
            // Destination (and optional title) on next line
            const nextMatch = matchOpenContainers(expandTabsToSpaces(lines[i + 1]), containers);
            const nextTrimmed = nextMatch.rest.trimStart();
            const dtMatch = nextMatch.matchedAll ? destAndTitleRe.exec(nextTrimmed) : null;
            if (dtMatch) {
              i += 1;
              if (!dtMatch[1] && i + 1 < lines.length) {
                const titleLineMatch = matchOpenContainers(expandTabsToSpaces(lines[i + 1]), containers);
                if (titleLineMatch.matchedAll && titleOnlyRe.test(titleLineMatch.rest)) {
                  i += 1;
                }
              }
              inParagraph = false;
              continue;
            }
          }
        }
      }

      // CommonMark §4.1 & §4.2: ATX headings and thematic breaks terminate/do not start paragraphs
      if (/^#{1,6}(?:[ ]|$)/.test(trimmedAfterIndent) || /^(?:[-_*][ ]*){3,}$/.test(trimmedAfterIndent)) {
        inParagraph = false;
        unfencedLines.push(stripped);
        continue;
      }
    }

    inParagraph = true;
    unfencedLines.push(stripped);
  }

  const unfenced = unfencedLines.join('\n');
  const citations = [];
  let i = 0;
  const HTML_RAW_TOKEN_RE = /^(?:<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![A-Z][\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/[A-Za-z][A-Za-z0-9-]*\s*>|<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>)/;
  const LINK_TAIL_RE = /^\]\(\s*(?:<[^<>\r\n]*>|(?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))+)(?:\s+(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\((?:\\\)|[^)])*\)))?\s*\)/;

  while (i < unfenced.length) {
    // CommonMark §2.4: backslash before ASCII punctuation escapes it outside code spans
    if (unfenced[i] === '\\' && i + 1 < unfenced.length && ASCII_PUNCT_RE.test(unfenced[i + 1])) {
      i += 2;
      continue;
    }
    // CommonMark §6.5 & §6.6: raw HTML tags (with quoted attributes), HTML comments, and autolinks
    if (unfenced[i] === '<') {
      const htmlMatch = HTML_RAW_TOKEN_RE.exec(unfenced.slice(i));
      if (htmlMatch) {
        i += htmlMatch[0].length;
        continue;
      }
    }
    // CommonMark §6.3: link destination & title after `]` (`](url "title")`) are not inline-parsed for code spans
    if (unfenced[i] === ']' && unfenced[i + 1] === '(') {
      const linkTail = LINK_TAIL_RE.exec(unfenced.slice(i));
      if (linkTail) {
        i += linkTail[0].length;
        continue;
      }
    }
    if (unfenced[i] !== '`') {
      i += 1;
      continue;
    }
    let runLen = 0;
    while (i + runLen < unfenced.length && unfenced[i + runLen] === '`') runLen += 1;
    let j = i + runLen;
    let closePos = -1;
    while (j < unfenced.length) {
      if (unfenced[j] !== '`') {
        j += 1;
        continue;
      }
      let closeLen = 0;
      while (j + closeLen < unfenced.length && unfenced[j + closeLen] === '`') closeLen += 1;
      if (closeLen === runLen) {
        closePos = j;
        break;
      }
      j += closeLen;
    }
    if (closePos === -1) {
      i += runLen;
      continue;
    }
    const content = unfenced.slice(i + runLen, closePos);
    if (runLen === 1) {
      const trimmed = content.trim();
      if (/^(?:apps|packages|tools)\//.test(trimmed)) {
        const m = STRICT_CITATION_TOKEN_RE.exec(trimmed);
        if (!m) {
          errors.push(`${doc} (\`${trimmed}\`): malformed source citation token`);
        } else {
          citations.push({
            raw: `\`${trimmed}\``,
            targetPath: m[1],
            start: Number.parseInt(m[2], 10),
            end: m[3] === undefined ? Number.parseInt(m[2], 10) : Number.parseInt(m[3], 10),
            hasExplicitRange: m[3] !== undefined,
          });
        }
      }
    }
    i = closePos + runLen;
  }
  return citations;
}

function splitPhysicalLines(rawText) {
  const withoutTrailingEol = rawText.replace(/\r?\n$/, '');
  return withoutTrailingEol.split(/\r?\n/);
}

function findClosingSingleLineQuote(rawText, openIdx, quote) {
  let i = openIdx + 1;
  while (i < rawText.length) {
    const ch = rawText[i];
    if (ch === '\r' || ch === '\n') return -1;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i;
    i += 1;
  }
  return -1;
}

const REGEX_PRECEDING_CHAR_RE = /[=(,[!:&|?{;~^%*+\-<>]/;

function canStartRegexLiteral(maskedPrefix, rawText, slashIdx) {
  if (slashIdx > 0 && rawText[slashIdx - 1] === '<') return false; // JSX `</Tag>`
  let k = maskedPrefix.length - 1;
  while (k >= 0 && /\s/.test(maskedPrefix[k])) k -= 1;
  if (k < 0) return true;
  if (maskedPrefix[k] === '+' && k > 0 && maskedPrefix[k - 1] === '+') return false; // postfix `x++ / y`
  if (maskedPrefix[k] === '-' && k > 0 && maskedPrefix[k - 1] === '-') return false; // postfix `x-- / y`
  if (REGEX_PRECEDING_CHAR_RE.test(maskedPrefix[k])) return true;
  const identMatch = /(?:^|[^A-Za-z0-9_$])(return|case|throw|typeof|void|delete|in|of|instanceof|new|yield|await)$/.exec(
    maskedPrefix.slice(Math.max(0, k - 14), k + 1),
  );
  return Boolean(identMatch);
}

function findClosingRegexLiteral(rawText, openIdx) {
  let i = openIdx + 1;
  if (i >= rawText.length || rawText[i] === '/' || rawText[i] === '*' || rawText[i] === '\r' || rawText[i] === '\n') {
    return -1;
  }
  let inCharClass = false;
  while (i < rawText.length) {
    const ch = rawText[i];
    if (ch === '\r' || ch === '\n') return -1;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      inCharClass = true;
      i += 1;
      continue;
    }
    if (ch === ']' && inCharClass) {
      inCharClass = false;
      i += 1;
      continue;
    }
    if (ch === '/' && !inCharClass) {
      let end = i + 1;
      while (end < rawText.length && /[dgimsuvy]/.test(rawText[end])) end += 1;
      return end - 1;
    }
    i += 1;
  }
  return -1;
}

function stripJsTsCommentsWithTypeScript(ts, relPath, rawText) {
  const scriptKind = relPath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : relPath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : relPath.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(relPath, rawText, ts.ScriptTarget.Latest, true, scriptKind);
  const chars = Array.from(rawText);
  const maskRange = (pos, end) => {
    for (let p = pos; p < end; p += 1) {
      if (chars[p] !== '\r' && chars[p] !== '\n') chars[p] = ' ';
    }
  };
  const visit = (node) => {
    const children = node.getChildren(sf);
    if (children.length === 0) {
      if (node.kind !== ts.SyntaxKind.JsxText) {
        const leading = ts.getLeadingCommentRanges(rawText, node.pos) ?? [];
        for (const r of leading) maskRange(r.pos, r.end);
        const trailing = ts.getTrailingCommentRanges(rawText, node.end) ?? [];
        for (const r of trailing) maskRange(r.pos, r.end);
      }
      return;
    }
    for (const child of children) visit(child);
  };
  visit(sf);
  return chars.join('');
}

function stripJsTsCommentsPreservingLines(relPath, rawText, maskKeepNewlines) {
  const ts = loadTypeScriptCompiler();
  if (ts !== null) {
    return stripJsTsCommentsWithTypeScript(ts, relPath, rawText);
  }
  let out = '';
  let idx = 0;
  // Stack entries: -1 = inside template literal text; >= 0 = brace depth inside `${...}`
  const templateStack = [];

  while (idx < rawText.length) {
    const inTemplateText = templateStack.length > 0 && templateStack[templateStack.length - 1] === -1;
    if (inTemplateText) {
      if (rawText[idx] === '\\' && idx + 1 < rawText.length) {
        out += rawText[idx] + rawText[idx + 1];
        idx += 2;
        continue;
      }
      if (rawText[idx] === '`') {
        templateStack.pop();
        out += '`';
        idx += 1;
        continue;
      }
      if (rawText[idx] === '$' && rawText[idx + 1] === '{') {
        templateStack[templateStack.length - 1] = 0;
        out += '${';
        idx += 2;
        continue;
      }
      out += rawText[idx];
      idx += 1;
      continue;
    }

    // Outside template text (normal code or `${...}` expression)
    if (rawText.startsWith('/*', idx)) {
      const end = rawText.indexOf('*/', idx + 2);
      const slice = end === -1 ? rawText.slice(idx) : rawText.slice(idx, end + 2);
      out += maskKeepNewlines(slice);
      idx = end === -1 ? rawText.length : end + 2;
      continue;
    }
    if (rawText.startsWith('//', idx)) {
      const nl = rawText.indexOf('\n', idx + 2);
      const slice = nl === -1 ? rawText.slice(idx) : rawText.slice(idx, nl);
      out += maskKeepNewlines(slice);
      idx = nl === -1 ? rawText.length : nl;
      continue;
    }
    if (rawText[idx] === '`') {
      templateStack.push(-1);
      out += '`';
      idx += 1;
      continue;
    }
    if (templateStack.length > 0) {
      if (rawText[idx] === '{') {
        templateStack[templateStack.length - 1] += 1;
        out += '{';
        idx += 1;
        continue;
      }
      if (rawText[idx] === '}') {
        if (templateStack[templateStack.length - 1] === 0) {
          templateStack[templateStack.length - 1] = -1;
        } else {
          templateStack[templateStack.length - 1] -= 1;
        }
        out += '}';
        idx += 1;
        continue;
      }
    }
    if (rawText[idx] === '/' && canStartRegexLiteral(out, rawText, idx)) {
      const closeRegexIdx = findClosingRegexLiteral(rawText, idx);
      if (closeRegexIdx !== -1) {
        out += rawText.slice(idx, closeRegexIdx + 1);
        idx = closeRegexIdx + 1;
        continue;
      }
    }
    if (rawText[idx] === "'" || rawText[idx] === '"') {
      const quote = rawText[idx];
      // Do not treat JSX prose apostrophes (`Today's`, `athlete's`) as JS string openers
      const isJsxProseApostrophe = quote === "'" && idx > 0 && /[A-Za-z0-9]/.test(rawText[idx - 1]);
      const closeIdx = isJsxProseApostrophe ? -1 : findClosingSingleLineQuote(rawText, idx, quote);
      if (closeIdx !== -1) {
        out += rawText.slice(idx, closeIdx + 1);
        idx = closeIdx + 1;
        continue;
      }
    }
    out += rawText[idx];
    idx += 1;
  }
  return out;
}

/**
 * Replace commented-out characters with spaces while preserving exact line breaks
 * so commented-out XML directives, TS/TSX statements, or SQL declarations cannot
 * masquerade as active implementation.
 */
function stripCommentsPreservingLines(relPath, rawText) {
  const maskKeepNewlines = (chunk) => chunk.replace(/[^\r\n]/g, ' ');
  if (relPath.endsWith('.xml')) {
    return rawText.replace(/<!--[\s\S]*?(?:-->|$)/g, maskKeepNewlines);
  }
  if (relPath.endsWith('.sql')) {
    let out = '';
    let idx = 0;
    while (idx < rawText.length) {
      const ch = rawText[idx];
      if (ch === "'" || ch === '"') {
        const quote = ch;
        out += ch;
        idx += 1;
        while (idx < rawText.length) {
          if (rawText[idx] === quote && rawText[idx + 1] === quote) {
            out += quote + quote;
            idx += 2;
            continue;
          }
          out += rawText[idx];
          if (rawText[idx] === quote) {
            idx += 1;
            break;
          }
          idx += 1;
        }
        continue;
      }
      if (rawText.startsWith('/*', idx)) {
        const end = rawText.indexOf('*/', idx + 2);
        const slice = end === -1 ? rawText.slice(idx) : rawText.slice(idx, end + 2);
        out += maskKeepNewlines(slice);
        idx = end === -1 ? rawText.length : end + 2;
        continue;
      }
      if (rawText.startsWith('--', idx)) {
        const nl = rawText.indexOf('\n', idx + 2);
        const slice = nl === -1 ? rawText.slice(idx) : rawText.slice(idx, nl);
        out += maskKeepNewlines(slice);
        idx = nl === -1 ? rawText.length : nl;
        continue;
      }
      out += ch;
      idx += 1;
    }
    return out;
  }
  if (relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.mjs') || relPath.endsWith('.js')) {
    return stripJsTsCommentsPreservingLines(relPath, rawText, maskKeepNewlines);
  }
  return rawText;
}

export function verifyBetaFilingCitations({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  readFile = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8'),
  exists = (relPath) => fs.existsSync(path.join(repoRoot, relPath)),
} = {}) {
  const errors = [];
  const sourceCache = new Map();
  const activeSourceCache = new Map();
  const getSourceBundle = (relPath) => {
    if (!sourceCache.has(relPath)) {
      const raw = readFile(relPath);
      sourceCache.set(relPath, splitPhysicalLines(raw));
      activeSourceCache.set(relPath, splitPhysicalLines(stripCommentsPreservingLines(relPath, raw)));
    }
    return {
      lines: sourceCache.get(relPath),
      activeLines: activeSourceCache.get(relPath),
    };
  };

  let totalCitations = 0;

  for (const doc of REQUIRED_FILING_DOCS) {
    if (!isRepoContainedRelativePath(repoRoot, doc) || !exists(doc)) {
      errors.push(`${doc}: required filing document is missing`);
      continue;
    }
    const text = readFile(doc);
    if (!text.trim()) {
      errors.push(`${doc}: filing document is empty`);
      continue;
    }
    const citations = extractLiveCitations(doc, text, errors);
    if (citations.length === 0) {
      errors.push(`${doc}: filing document cites zero source locations`);
      continue;
    }

    citations.forEach((c, idx) => {
      totalCitations += 1;
      const key = `${doc}|${idx}`;
      const spec = EXPECTED_ANCHORS[key];
      if (!spec) {
        errors.push(`${doc} [#${idx}] (${c.raw}): unmapped citation slot ${key}`);
        return;
      }
      if (!isRepoContainedRelativePath(repoRoot, c.targetPath)) {
        errors.push(`${doc} (${c.raw}): path escapes repository containment: ${c.targetPath}`);
        return;
      }
      if (c.targetPath !== spec.path) {
        errors.push(`${doc} (${c.raw}): expected path "${spec.path}", got "${c.targetPath}"`);
        return;
      }
      if (!exists(c.targetPath)) {
        errors.push(`${doc} (${c.raw}): target file does not exist: ${c.targetPath}`);
        return;
      }
      const { lines, activeLines } = getSourceBundle(c.targetPath);
      if (c.start < 1 || c.end < c.start || c.end > lines.length) {
        errors.push(`${doc} (${c.raw}): line range ${c.start}-${c.end} out of bounds (1..${lines.length})`);
        return;
      }
      if (Boolean(spec.isRange) !== (c.end > c.start)) {
        errors.push(
          `${doc} (${c.raw}): expected ${spec.isRange ? 'multi-line range' : 'single-line anchor'} for ${spec.path}`,
        );
        return;
      }

      const startPool = spec.startAnchorIsComment ? lines : activeLines;
      const startLine = startPool[c.start - 1];
      if (!startLine.includes(spec.startAnchor)) {
        const movedTo = lines
          .map((line, i) => (line.includes(spec.startAnchor) ? i + 1 : -1))
          .filter((n) => n > 0);
        const hint = movedTo.length > 0 ? ` (anchor now at line ${movedTo.join(',')})` : ' (anchor not found in file)';
        errors.push(
          `${doc} (${c.raw}): line ${c.start} does not contain expected anchor "${spec.startAnchor}"${hint}; got "${lines[c.start - 1].trim().slice(0, 80)}"`,
        );
        return;
      }

      if (spec.prevAnchor) {
        const prevLine = c.start >= 2 ? activeLines[c.start - 2] : '';
        if (!prevLine.includes(spec.prevAnchor)) {
          errors.push(
            `${doc} (${c.raw}): preceding line ${c.start - 1} does not contain disambiguating context "${spec.prevAnchor}"`,
          );
          return;
        }
      }

      const expectedEndAnchor = spec.endAnchor ?? spec.startAnchor;
      const endPool = (spec.endAnchor !== undefined ? spec.endAnchorIsComment : spec.startAnchorIsComment)
        ? lines
        : activeLines;
      const endLine = endPool[c.end - 1];
      if (!endLine.includes(expectedEndAnchor)) {
        errors.push(
          `${doc} (${c.raw}): end line ${c.end} does not contain expected end anchor "${expectedEndAnchor}"; got "${lines[c.end - 1].trim().slice(0, 80)}"`,
        );
        return;
      }

      if (Array.isArray(spec.rangeAnchors) && spec.rangeAnchors.length > 0) {
        const rangePool = spec.rangeAnchorsAreComments ? lines : activeLines;
        const sliceJoined = rangePool.slice(c.start - 1, c.end).join('\n');
        for (const req of spec.rangeAnchors) {
          if (!sliceJoined.includes(req)) {
            errors.push(`${doc} (${c.raw}): range ${c.start}-${c.end} is missing required active evidence "${req}"`);
          }
        }
      }
    });
  }

  if (totalCitations !== EXPECTED_CITATION_COUNT) {
    errors.push(
      `expected ${EXPECTED_CITATION_COUNT} total citations across ${REQUIRED_FILING_DOCS.length} docs, found ${totalCitations}`,
    );
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
