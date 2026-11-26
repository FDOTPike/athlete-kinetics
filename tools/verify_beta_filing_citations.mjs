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
import { DatabaseSync } from 'node:sqlite';
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

let cachedXmlDom = undefined;
function loadXmlDomParser() {
  if (cachedXmlDom !== undefined) return cachedXmlDom;
  try {
    cachedXmlDom = requireFromHere('@xmldom/xmldom').DOMParser;
  } catch {
    cachedXmlDom = null;
  }
  return cachedXmlDom;
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/HEALTH_APPS_DECLARATION.md|2': {
    path: 'apps/mobile/src/screens/ProfileScreen.tsx',
    isRange: false,
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    endAnchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
    startAnchor: 'Connected. Overnight HRV and sleep feed your readiness score',
  },
  'docs/release/beta/HEALTH_CONNECT_PERMISSIONS.md|7': {
    path: 'apps/mobile/src/state/biometricsCopy.ts',
    isRange: false,
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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
    anchorInStringLiteral: true,
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

function isThematicBreak(trimmed) {
  return /^(?:-[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:\*[ \t]*){3,}$/.test(trimmed);
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
    // CommonMark §4.1 thematic break (3+ matching `-`, `_`, or `*`) takes precedence over list markers
    if (isThematicBreak(trimmed)) break;
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

function canInterruptParagraph(rest) {
  const spaces = leadingSpaceCount(rest);
  if (spaces > 3) return false;
  const trimmed = rest.slice(spaces);
  if (trimmed.length === 0) return true;
  if (trimmed[0] === '>') return true;
  if (/^#{1,6}(?:[ ]|$)/.test(trimmed)) return true;
  if (isThematicBreak(trimmed)) return true;
  const openFence = /^(`{3,}|~{3,})([^\r\n]*)$/.exec(trimmed);
  if (openFence && (openFence[1][0] !== '`' || !openFence[2].includes('`'))) return true;
  if (matchHtmlBlockOpen(trimmed, true) !== null) return true;
  const listMatch = /^([-+*]|\d{1,9}[.)])([ ]+)(.*)$/.exec(trimmed);
  if (listMatch && listMatch[3].trim().length > 0) {
    if (!/^\d/.test(listMatch[1]) || Number.parseInt(listMatch[1], 10) === 1) return true;
  }
  return false;
}

function scanBalancedDestination(str, startIdx) {
  let idx = startIdx;
  if (idx >= str.length) return -1;
  if (str[idx] === '<') {
    idx += 1;
    while (idx < str.length) {
      const ch = str[idx];
      if (ch === '\r' || ch === '\n' || ch === '<') return -1;
      if (ch === '\\' && idx + 1 < str.length) {
        idx += 2;
        continue;
      }
      if (ch === '>') return idx + 1;
      idx += 1;
    }
    return -1;
  }
  let parenDepth = 0;
  let consumed = 0;
  while (idx < str.length) {
    const ch = str[idx];
    const code = str.charCodeAt(idx);
    if (code <= 0x20 || code === 0x7f) break;
    if (ch === '\\' && idx + 1 < str.length && ASCII_PUNCT_RE.test(str[idx + 1])) {
      idx += 2;
      consumed += 2;
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      idx += 1;
      consumed += 1;
      continue;
    }
    if (ch === ')') {
      if (parenDepth === 0) break;
      parenDepth -= 1;
      idx += 1;
      consumed += 1;
      continue;
    }
    idx += 1;
    consumed += 1;
  }
  return consumed > 0 && parenDepth === 0 ? idx : -1;
}

function scanLinkTitle(str, startIdx) {
  if (startIdx >= str.length) return -1;
  const opener = str[startIdx];
  if (opener !== '"' && opener !== "'" && opener !== '(') return -1;
  const closer = opener === '(' ? ')' : opener;
  let idx = startIdx + 1;
  while (idx < str.length) {
    const ch = str[idx];
    if (ch === '\\' && idx + 1 < str.length) {
      idx += 2;
      continue;
    }
    if (opener === '(' && ch === '(') return -1;
    if (ch === closer) {
      const inner = str.slice(startIdx + 1, idx);
      if (/\n[ \t]*\n/.test(inner)) return -1;
      return idx + 1;
    }
    idx += 1;
  }
  return -1;
}

function normalizeLinkLabel(rawLabel) {
  return rawLabel.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().replace(/\u00df/g, 'ss');
}

function scanLinkLabel(str, startIdx) {
  if (startIdx < 0 || startIdx >= str.length || str[startIdx] !== '[') return null;
  let idx = startIdx + 1;
  const labelStart = idx;
  let labelChars = 0;
  let foundClose = false;
  while (idx < str.length && labelChars <= 999) {
    const ch = str[idx];
    if (ch === '\\' && idx + 1 < str.length) {
      idx += 2;
      labelChars += 2;
      continue;
    }
    if (ch === '[') return null;
    if (ch === ']') {
      foundClose = true;
      break;
    }
    idx += 1;
    labelChars += 1;
  }
  if (!foundClose || labelChars > 999) return null;
  return {
    rawLabel: str.slice(labelStart, idx),
    endIdx: idx + 1,
  };
}

function peelOneLinkRefDef(text) {
  let idx = 0;
  let spaces = 0;
  while (idx < text.length && text[idx] === ' ' && spaces < 4) {
    idx += 1;
    spaces += 1;
  }
  if (spaces > 3 || text[idx] !== '[') return null;
  const parsedLabel = scanLinkLabel(text, idx);
  if (parsedLabel === null || parsedLabel.rawLabel.length === 0) return null;
  const { rawLabel, endIdx } = parsedLabel;
  if (!/\S/.test(rawLabel) || text[endIdx] !== ':') return null;
  const normalizedLabel = normalizeLinkLabel(rawLabel);
  idx = endIdx + 1;

  while (idx < text.length && (text[idx] === ' ' || text[idx] === '\t')) idx += 1;
  if (idx < text.length && text[idx] === '\n') {
    idx += 1;
    while (idx < text.length && (text[idx] === ' ' || text[idx] === '\t')) idx += 1;
  }
  if (idx >= text.length) return null;

  const afterDest = scanBalancedDestination(text, idx);
  if (afterDest === -1) return null;

  const destEndMatch = /^[ \t]*(?:\n|$)/.exec(text.slice(afterDest));
  let wsIdx = afterDest;
  let sawWs = false;
  let sawNewlineBeforeTitle = false;
  while (wsIdx < text.length && (text[wsIdx] === ' ' || text[wsIdx] === '\t')) {
    wsIdx += 1;
    sawWs = true;
  }
  if (wsIdx < text.length && text[wsIdx] === '\n') {
    wsIdx += 1;
    sawWs = true;
    sawNewlineBeforeTitle = true;
    while (wsIdx < text.length && (text[wsIdx] === ' ' || text[wsIdx] === '\t')) wsIdx += 1;
  }

  if (sawWs && wsIdx < text.length && (text[wsIdx] === '"' || text[wsIdx] === "'" || text[wsIdx] === '(')) {
    const afterTitle = scanLinkTitle(text, wsIdx);
    if (afterTitle !== -1) {
      const titleLineEnd = /^[ \t]*(?:\n|$)/.exec(text.slice(afterTitle));
      if (titleLineEnd) {
        return { rest: text.slice(afterTitle + titleLineEnd[0].length), normalizedLabel };
      }
    }
    if (sawNewlineBeforeTitle && destEndMatch) {
      return { rest: text.slice(afterDest + destEndMatch[0].length), normalizedLabel };
    }
    return null;
  }

  if (destEndMatch) {
    return { rest: text.slice(afterDest + destEndMatch[0].length), normalizedLabel };
  }
  return null;
}

function peelLeadingLinkRefDefs(paragraphText, definedLabels) {
  let rest = paragraphText;
  while (rest.length > 0) {
    const next = peelOneLinkRefDef(rest);
    if (next === null) break;
    if (definedLabels) definedLabels.add(next.normalizedLabel);
    rest = next.rest;
  }
  return rest;
}

function skipOptionalInlineWsNoBlankLine(str, startIdx) {
  let idx = startIdx;
  let sawAny = false;
  let newlines = 0;
  while (idx < str.length) {
    const ch = str[idx];
    if (ch === ' ' || ch === '\t') {
      idx += 1;
      sawAny = true;
    } else if (ch === '\n') {
      newlines += 1;
      if (newlines > 1) return null;
      idx += 1;
      sawAny = true;
    } else if (ch === '\r') {
      idx += 1;
    } else {
      break;
    }
  }
  return { idx, sawAny };
}

function tryConsumeInlineLinkTail(block, openParenIdx) {
  if (block[openParenIdx] !== '(') return -1;
  const ws1 = skipOptionalInlineWsNoBlankLine(block, openParenIdx + 1);
  if (ws1 === null) return -1;
  let idx = ws1.idx;
  if (idx >= block.length) return -1;
  if (block[idx] === ')') return idx + 1;

  let hasDest = false;
  if (block[idx] !== '"' && block[idx] !== "'") {
    const afterDest = scanBalancedDestination(block, idx);
    if (afterDest !== -1) {
      idx = afterDest;
      hasDest = true;
    }
  }

  const ws2 = skipOptionalInlineWsNoBlankLine(block, idx);
  if (ws2 === null) return -1;
  idx = ws2.idx;
  if (idx >= block.length) return -1;
  if (block[idx] === ')') return idx + 1;

  if (hasDest && !ws2.sawAny) return -1;
  if (block[idx] === '"' || block[idx] === "'" || block[idx] === '(') {
    const afterTitle = scanLinkTitle(block, idx);
    if (afterTitle === -1) return -1;
    const ws3 = skipOptionalInlineWsNoBlankLine(block, afterTitle);
    if (ws3 === null) return -1;
    if (ws3.idx < block.length && block[ws3.idx] === ')') {
      return ws3.idx + 1;
    }
  }
  return -1;
}

const HTML_RAW_TOKEN_RE = /^(?:<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![A-Z][\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/[A-Za-z][A-Za-z0-9-]*\s*>|<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>|<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*>)/;

function scanInlineLinkLabel(block, startIdx) {
  if (startIdx < 0 || startIdx >= block.length || block[startIdx] !== '[') return null;
  let pos = startIdx + 1;
  while (pos < block.length && pos - (startIdx + 1) <= 999) {
    const ch = block[pos];
    if (ch === ']') {
      return {
        rawLabel: block.slice(startIdx + 1, pos),
        endIdx: pos + 1,
      };
    }
    if (ch === '[') return null;
    if (ch === '\\' && pos + 1 < block.length && ASCII_PUNCT_RE.test(block[pos + 1])) {
      pos += 2;
      continue;
    }
    if (ch === '<') {
      const htmlMatch = HTML_RAW_TOKEN_RE.exec(block.slice(pos));
      if (htmlMatch) {
        pos += htmlMatch[0].length;
        continue;
      }
    }
    if (ch === '`') {
      let runLen = 0;
      while (pos + runLen < block.length && block[pos + runLen] === '`') runLen += 1;
      let j = pos + runLen;
      let closePos = -1;
      while (j < block.length) {
        if (block[j] !== '`') {
          j += 1;
          continue;
        }
        let closeLen = 0;
        while (j + closeLen < block.length && block[j + closeLen] === '`') closeLen += 1;
        if (closeLen === runLen) {
          closePos = j;
          break;
        }
        j += closeLen;
      }
      pos = closePos === -1 ? pos + runLen : closePos + runLen;
      continue;
    }
    pos += 1;
  }
  return null;
}

function extractInlineCitationsFromBlock(doc, block, definedLabels, citations, errors) {
  const openBrackets = [];
  const deactivatePriorLinkOpeners = () => {
    for (let k = 0; k < openBrackets.length; k += 1) {
      if (!openBrackets[k].isImage) openBrackets[k].active = false;
    }
  };
  let i = 0;
  while (i < block.length) {
    if (block[i] === '\\' && i + 1 < block.length && ASCII_PUNCT_RE.test(block[i + 1])) {
      i += 2;
      continue;
    }
    if (block[i] === '!' && block[i + 1] === '[') {
      openBrackets.push({ isImage: true, active: true, contentStart: i + 2 });
      i += 2;
      continue;
    }
    if (block[i] === '[') {
      openBrackets.push({ isImage: false, active: true, contentStart: i + 1 });
      i += 1;
      continue;
    }
    if (block[i] === ']') {
      if (openBrackets.length === 0) {
        i += 1;
        continue;
      }
      const opener = openBrackets.pop();
      if (!opener.active) {
        i += 1;
        continue;
      }
      if (block[i + 1] === '(') {
        const afterLink = tryConsumeInlineLinkTail(block, i + 1);
        if (afterLink !== -1) {
          if (!opener.isImage) deactivatePriorLinkOpeners();
          i = afterLink;
          continue;
        }
      }
      const nextLabel = block[i + 1] === '[' ? scanInlineLinkLabel(block, i + 1) : null;
      if (nextLabel !== null) {
        if (nextLabel.rawLabel.length === 0) {
          const firstSlice = scanInlineLinkLabel(block, opener.contentStart - 1);
          if (
            firstSlice !== null
            && firstSlice.endIdx === i + 1
            && /\S/.test(firstSlice.rawLabel)
            && definedLabels.has(normalizeLinkLabel(firstSlice.rawLabel))
          ) {
            if (!opener.isImage) deactivatePriorLinkOpeners();
            i = nextLabel.endIdx;
            continue;
          }
        } else if (/\S/.test(nextLabel.rawLabel) && definedLabels.has(normalizeLinkLabel(nextLabel.rawLabel))) {
          if (!opener.isImage) deactivatePriorLinkOpeners();
          i = nextLabel.endIdx;
          continue;
        }
        if (nextLabel.rawLabel.length === 0 || /\S/.test(nextLabel.rawLabel)) {
          i += 1;
          continue;
        }
      }
      const selfLabel = scanInlineLinkLabel(block, opener.contentStart - 1);
      if (
        selfLabel !== null
        && selfLabel.endIdx === i + 1
        && /\S/.test(selfLabel.rawLabel)
        && definedLabels.has(normalizeLinkLabel(selfLabel.rawLabel))
      ) {
        if (!opener.isImage) deactivatePriorLinkOpeners();
      }
      i += 1;
      continue;
    }
    if (block[i] === '<') {
      const htmlMatch = HTML_RAW_TOKEN_RE.exec(block.slice(i));
      if (htmlMatch) {
        i += htmlMatch[0].length;
        continue;
      }
    }
    if (block[i] !== '`') {
      i += 1;
      continue;
    }
    let runLen = 0;
    while (i + runLen < block.length && block[i + runLen] === '`') runLen += 1;
    let j = i + runLen;
    let closePos = -1;
    while (j < block.length) {
      if (block[j] !== '`') {
        j += 1;
        continue;
      }
      let closeLen = 0;
      while (j + closeLen < block.length && block[j + closeLen] === '`') closeLen += 1;
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
    const content = block.slice(i + runLen, closePos);
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
}

/**
 * Strip CommonMark block containers (blockquotes, list items, fenced/indented code blocks,
 * HTML blocks Types 1-7, Setext & ATX headings, link reference definitions), then scan
 * each paragraph/heading inline block independently for live single-backtick citations.
 */
function extractLiveCitations(doc, text, errors) {
  const lines = text.split(/\r?\n/);
  const inlineBlocks = [];
  const definedLabels = new Set();
  const containers = [];
  let currentParagraph = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  let htmlBlock = null;

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const body = peelLeadingLinkRefDefs(currentParagraph.join('\n'), definedLabels);
    if (body.trim().length > 0) {
      inlineBlocks.push(body);
    }
    currentParagraph = [];
  };

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
    }

    if (htmlBlock !== null) {
      const indentCols = leadingSpaceCount(stripped);
      const isBlank = indentCols === stripped.length;
      if (htmlBlock.mode === 'blankLine') {
        if (isBlank) htmlBlock = null;
      } else if (htmlBlock.closeRe.test(stripped)) {
        htmlBlock = null;
      }
      flushParagraph();
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
      flushParagraph();
      continue;
    }

    // CommonMark §5.1 lazy continuation: if in a paragraph and open containers were not all matched,
    // check whether the unmatched remainder interrupts the paragraph; if not, append lazily!
    if (currentParagraph.length > 0 && !matched.matchedAll) {
      if (!canInterruptParagraph(stripped)) {
        currentParagraph.push(stripped.trimStart());
        continue;
      }
      flushParagraph();
      containers.length = matched.matchedCount;
    } else if (!matched.matchedAll) {
      containers.length = matched.matchedCount;
    }

    // CommonMark §4.3: Setext heading underline (`===` or `---`) when continuing a non-lazy paragraph
    const preOpenIndent = leadingSpaceCount(stripped);
    const preOpenTrimmed = stripped.slice(preOpenIndent);
    if (currentParagraph.length > 0 && matched.matchedAll && preOpenIndent <= 3 && /^(?:=+|-+)[ ]*$/.test(preOpenTrimmed)) {
      const remainingHeadingText = peelLeadingLinkRefDefs(currentParagraph.join('\n'), definedLabels);
      currentParagraph = [];
      if (remainingHeadingText.trim().length > 0) {
        inlineBlocks.push(remainingHeadingText);
        continue;
      }
    }

    const hadParagraphBeforeOpen = currentParagraph.length > 0;
    const opened = openNewContainers(stripped, containers, hadParagraphBeforeOpen);
    stripped = opened.rest;
    if (hadParagraphBeforeOpen && !opened.inParagraph) {
      flushParagraph();
    }

    const indentCols = leadingSpaceCount(stripped);
    const trimmedAfterIndent = stripped.slice(indentCols);
    const isBlank = trimmedAfterIndent.length === 0;

    if (isBlank) {
      flushParagraph();
      continue;
    }

    // CommonMark §4.4: 4+ virtual columns of indentation when NOT interrupting a paragraph
    if (currentParagraph.length === 0 && indentCols >= 4) {
      continue;
    }

    if (indentCols <= 3) {
      // CommonMark §4.5: fenced code block opening
      const openMatch = /^(`{3,}|~{3,})([^\r\n]*)$/.exec(trimmedAfterIndent);
      if (openMatch) {
        const marker = openMatch[1];
        const info = openMatch[2];
        if (marker[0] !== '`' || !info.includes('`')) {
          flushParagraph();
          inFence = true;
          fenceChar = marker[0];
          fenceLen = marker.length;
          continue;
        }
      }

      // CommonMark §4.6: HTML blocks Types 1-7
      const htmlOpen = matchHtmlBlockOpen(trimmedAfterIndent, currentParagraph.length > 0);
      if (htmlOpen !== null) {
        flushParagraph();
        if (!htmlOpen.closesImmediately) {
          htmlBlock = { mode: htmlOpen.mode, closeRe: htmlOpen.closeRe };
        }
        continue;
      }

      // CommonMark §4.1 thematic break (3+ matching `-`, `_`, or `*`)
      if (isThematicBreak(trimmedAfterIndent)) {
        flushParagraph();
        continue;
      }

      // CommonMark §4.2 ATX heading (isolated inline block)
      const atxMatch = /^(#{1,6})(?:[ ]+(.*?))?[ ]*$/.exec(trimmedAfterIndent);
      if (atxMatch && (trimmedAfterIndent.length === atxMatch[1].length || trimmedAfterIndent[atxMatch[1].length] === ' ')) {
        flushParagraph();
        const rawHeading = (atxMatch[2] ?? '').replace(/(?:^|[ ]+)#+[ ]*$/, '');
        if (rawHeading.length > 0) {
          inlineBlocks.push(rawHeading);
        }
        continue;
      }
    }

    currentParagraph.push(trimmedAfterIndent);
  }
  flushParagraph();

  const citations = [];
  for (const block of inlineBlocks) {
    extractInlineCitationsFromBlock(doc, block, definedLabels, citations, errors);
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

function buildJsTsActiveViewsWithTypeScript(ts, relPath, rawText) {
  const scriptKind = relPath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : relPath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : relPath.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(relPath, rawText, ts.ScriptTarget.Latest, true, scriptKind);
  const parseErrors = (sf.parseDiagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
  // Use exact UTF-16 code units (`split('')`, NOT `Array.from`) so astral code points (e.g. emoji) match TS AST offsets 1:1
  const activeChars = rawText.split('');
  const strictCodeChars = rawText.split('');
  const maskIn = (arr, pos, end) => {
    const clampedEnd = Math.min(arr.length, end);
    for (let p = Math.max(0, pos); p < clampedEnd; p += 1) {
      if (arr[p] !== '\r' && arr[p] !== '\n') arr[p] = ' ';
    }
  };
  const visit = (node) => {
    // Mask dead standalone string/template literal ExpressionStatements (other than directives like 'use strict')
    if (ts.isExpressionStatement(node)) {
      const expr = node.expression;
      if (
        ts.isStringLiteral(expr)
        || ts.isNoSubstitutionTemplateLiteral(expr)
        || ts.isTemplateExpression(expr)
      ) {
        const txt = expr.getText(sf).trim();
        if (txt !== "'use strict'" && txt !== '"use strict"') {
          maskIn(activeChars, expr.getStart(sf), expr.getEnd());
        }
      }
    }
    const children = node.getChildren(sf);
    if (children.length === 0) {
      if (node.kind !== ts.SyntaxKind.JsxText) {
        const leading = ts.getLeadingCommentRanges(rawText, node.pos) ?? [];
        for (const r of leading) {
          maskIn(activeChars, r.pos, r.end);
          maskIn(strictCodeChars, r.pos, r.end);
        }
        const trailing = ts.getTrailingCommentRanges(rawText, node.end) ?? [];
        for (const r of trailing) {
          maskIn(activeChars, r.pos, r.end);
          maskIn(strictCodeChars, r.pos, r.end);
        }
      }
      if (
        node.kind === ts.SyntaxKind.StringLiteral
        || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
      ) {
        const s = node.getStart(sf);
        const e = node.getEnd();
        if (e - s >= 2) maskIn(strictCodeChars, s + 1, e - 1);
      } else if (node.kind === ts.SyntaxKind.TemplateHead) {
        const s = node.getStart(sf);
        const e = node.getEnd();
        if (e - s >= 3) maskIn(strictCodeChars, s + 1, e - 2);
      } else if (node.kind === ts.SyntaxKind.TemplateMiddle) {
        const s = node.getStart(sf);
        const e = node.getEnd();
        if (e - s >= 3) maskIn(strictCodeChars, s + 1, e - 2);
      } else if (node.kind === ts.SyntaxKind.TemplateTail) {
        const s = node.getStart(sf);
        const e = node.getEnd();
        if (e - s >= 2) maskIn(strictCodeChars, s + 1, e - 1);
      }
      return;
    }
    for (const child of children) visit(child);
  };
  visit(sf);
  return {
    activeText: activeChars.join(''),
    strictCodeText: strictCodeChars.join(''),
    parseErrors,
  };
}

function stripJsTsCommentsPreservingLines(relPath, rawText, maskKeepNewlines) {
  const ts = loadTypeScriptCompiler();
  if (ts !== null) {
    return buildJsTsActiveViewsWithTypeScript(ts, relPath, rawText);
  }
  let out = '';
  let idx = 0;
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
  return { activeText: out, strictCodeText: out, parseErrors: [] };
}

function stripSqlCommentsAndLiteralsPreservingLines(rawText, maskKeepNewlines) {
  let out = '';
  let idx = 0;
  while (idx < rawText.length) {
    const ch = rawText[idx];
    // SQLite single-quoted string literal ('...'), double-quoted identifier ("..."), or backtick identifier (`...`)
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += quote;
      idx += 1;
      while (idx < rawText.length) {
        if (rawText[idx] === quote && rawText[idx + 1] === quote) {
          out += '  ';
          idx += 2;
          continue;
        }
        if (rawText[idx] === quote) {
          out += quote;
          idx += 1;
          break;
        }
        out += rawText[idx] === '\r' || rawText[idx] === '\n' ? rawText[idx] : ' ';
        idx += 1;
      }
      continue;
    }
    // SQLite bracket-quoted identifier ([...])
    if (ch === '[') {
      out += '[';
      idx += 1;
      while (idx < rawText.length) {
        if (rawText[idx] === ']') {
          out += ']';
          idx += 1;
          break;
        }
        out += rawText[idx] === '\r' || rawText[idx] === '\n' ? rawText[idx] : ' ';
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

function inspectXmlDom(rawText) {
  const DOMParser = loadXmlDomParser();
  if (DOMParser === null) return { parseErrors: [], doc: null };
  const parseErrors = [];
  let doc = null;
  try {
    doc = new DOMParser({
      errorHandler: {
        warning: () => {},
        error: (msg) => parseErrors.push(String(msg)),
        fatalError: (msg) => parseErrors.push(String(msg)),
      },
    }).parseFromString(rawText, 'text/xml');
  } catch (err) {
    parseErrors.push(String(err));
  }
  return { parseErrors, doc };
}

function inspectSqliteTables(repoRoot, relPath, rawText, readFile) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.prepare('SELECT ln(2.0), sqrt(2.0)').get();
    } catch {
      db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
      db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
    }
    const schemaDir = 'packages/core-db/src/schema';
    const absSchemaDir = path.join(repoRoot, schemaDir);
    if (relPath.startsWith(`${schemaDir}/`) && fs.existsSync(absSchemaDir)) {
      const targetBase = path.posix.basename(relPath);
      const priorFiles = fs
        .readdirSync(absSchemaDir)
        .filter((f) => /^0\d\d_.*\.sql$/.test(f) && !f.startsWith('004_') && f < targetBase)
        .sort();
      for (const prior of priorFiles) {
        db.exec(readFile(`${schemaDir}/${prior}`));
      }
    }
    db.exec(rawText);
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    return { sqlError: null, tables: new Set(rows.map((r) => String(r.name))) };
  } catch (err) {
    return { sqlError: String(err), tables: new Set() };
  } finally {
    db.close();
  }
}

const ANDROID_XML_NS = 'http://schemas.android.com/apk/res/android';
const ANDROID_TOOLS_XML_NS = 'http://schemas.android.com/tools';

function verifyXmlElementSemantics(xmlInfo, spec, c) {
  if (xmlInfo.parseErrors.length > 0) {
    return `malformed XML: ${xmlInfo.parseErrors[0]}`;
  }
  if (!xmlInfo.doc || !xmlInfo.doc.documentElement) return null;
  const root = xmlInfo.doc.documentElement;
  if (Boolean(root.namespaceURI) || (root.localName ?? root.tagName) !== 'manifest') {
    return 'AndroidManifest root element must be unprefixed <manifest> in default namespace';
  }
  const allAnchors = [spec.startAnchor, ...(spec.rangeAnchors ?? []), ...(spec.endAnchor ? [spec.endAnchor] : [])].join('\n');
  const permMatch = /android:name="([^"]+)"/.exec(allAnchors);
  if (permMatch) {
    const targetPerm = permMatch[1];
    const requiresRemove = allAnchors.includes('tools:node="remove"');
    const nodes = root.getElementsByTagName('uses-permission');
    let found = false;
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes.item(i);
      if (!el || el.parentNode !== root || Boolean(el.namespaceURI)) continue;
      if (el.getAttributeNS(ANDROID_XML_NS, 'name') !== targetPerm) continue;
      if (requiresRemove && el.getAttributeNS(ANDROID_TOOLS_XML_NS, 'node') !== 'remove') continue;
      if (typeof el.lineNumber === 'number' && (el.lineNumber < c.start || el.lineNumber > c.end)) continue;
      found = true;
      break;
    }
    if (!found) {
      return `missing active XML <uses-permission android:name="${targetPerm}"${requiresRemove ? ' tools:node="remove"' : ''}> element in lines ${c.start}-${c.end}`;
    }
  }
  if (allAnchors.includes('android:allowBackup="false"')) {
    const apps = root.getElementsByTagName('application');
    let found = false;
    for (let i = 0; i < apps.length; i += 1) {
      const el = apps.item(i);
      if (
        el
        && el.parentNode === root
        && !el.namespaceURI
        && el.getAttributeNS(ANDROID_XML_NS, 'allowBackup') === 'false'
      ) {
        found = true;
        break;
      }
    }
    if (!found) {
      return 'missing active XML <application android:allowBackup="false"> attribute';
    }
  }
  return null;
}

function verifySqlTableSemantics(sqlInfo, spec) {
  if (sqlInfo.sqlError !== null) {
    return `SQLite schema execution failed: ${sqlInfo.sqlError}`;
  }
  const anchors = [spec.startAnchor, ...(spec.rangeAnchors ?? [])];
  for (const anchor of anchors) {
    const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/i.exec(anchor);
    if (m && !sqlInfo.tables.has(m[1])) {
      return `SQLite execution did not create expected table "${m[1]}"`;
    }
  }
  return null;
}

/**
 * Build line-aligned source views so commented-out or inert string/CDATA/PI text
 * in XML, TS/TSX, or SQL cannot masquerade as active implementation.
 */
function buildSourceBundle(repoRoot, relPath, rawText, readFile) {
  const maskKeepNewlines = (chunk) => chunk.replace(/[^\r\n]/g, ' ');
  const lines = splitPhysicalLines(rawText);
  if (relPath.endsWith('.xml')) {
    const stripped = rawText
      .replace(/<!--[\s\S]*?(?:-->|$)/g, maskKeepNewlines)
      .replace(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/g, maskKeepNewlines)
      .replace(/<\?[\s\S]*?(?:\?>|$)/g, maskKeepNewlines);
    const activeLines = splitPhysicalLines(stripped);
    return {
      lines,
      activeLines,
      strictCodeLines: activeLines,
      parseErrors: [],
      xmlInfo: inspectXmlDom(rawText),
      sqlInfo: null,
    };
  }
  if (relPath.endsWith('.sql')) {
    const stripped = stripSqlCommentsAndLiteralsPreservingLines(rawText, maskKeepNewlines);
    const activeLines = splitPhysicalLines(stripped);
    return {
      lines,
      activeLines,
      strictCodeLines: activeLines,
      parseErrors: [],
      xmlInfo: null,
      sqlInfo: inspectSqliteTables(repoRoot, relPath, rawText, readFile),
    };
  }
  if (relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.mjs') || relPath.endsWith('.js')) {
    const { activeText, strictCodeText, parseErrors } = stripJsTsCommentsPreservingLines(relPath, rawText, maskKeepNewlines);
    return {
      lines,
      activeLines: splitPhysicalLines(activeText),
      strictCodeLines: splitPhysicalLines(strictCodeText),
      isJsTs: true,
      parseErrors,
      xmlInfo: null,
      sqlInfo: null,
    };
  }
  return {
    lines,
    activeLines: lines,
    strictCodeLines: lines,
    isJsTs: false,
    parseErrors: [],
    xmlInfo: null,
    sqlInfo: null,
  };
}

function maskJsStringInteriorsInSnippet(snippet) {
  let out = '';
  let i = 0;
  while (i < snippet.length) {
    const ch = snippet[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const closeIdx = findClosingSingleLineQuote(snippet, i, ch);
      if (closeIdx !== -1) {
        out += ch + ' '.repeat(closeIdx - i - 1) + ch;
        i = closeIdx + 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function verifyBetaFilingCitations({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  readFile = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8'),
  exists = (relPath) => fs.existsSync(path.join(repoRoot, relPath)),
} = {}) {
  const errors = [];
  const bundleCache = new Map();
  const getSourceBundle = (relPath) => {
    if (!bundleCache.has(relPath)) {
      const raw = readFile(relPath);
      bundleCache.set(relPath, buildSourceBundle(repoRoot, relPath, raw, readFile));
    }
    return bundleCache.get(relPath);
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
      const bundle = getSourceBundle(c.targetPath);
      const { lines, activeLines, strictCodeLines, parseErrors, xmlInfo, sqlInfo } = bundle;
      if (parseErrors.length > 0) {
        errors.push(`${doc} (${c.raw}): syntax error in ${c.targetPath}: ${parseErrors[0]}`);
        return;
      }
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

      const lineMatchesAnchor = (lineIdx, anchor, isComment, allowStringLiteral) => {
        if (isComment) return lines[lineIdx].includes(anchor);
        if (allowStringLiteral || !bundle.isJsTs) return activeLines[lineIdx].includes(anchor);
        return (
          activeLines[lineIdx].includes(anchor)
          && strictCodeLines[lineIdx].includes(maskJsStringInteriorsInSnippet(anchor))
        );
      };

      const rangeMatchesAnchor = (startIdx, endExclusiveIdx, anchor, isComment, allowStringLiteral) => {
        if (isComment) return lines.slice(startIdx, endExclusiveIdx).join('\n').includes(anchor);
        const inActive = activeLines.slice(startIdx, endExclusiveIdx).join('\n').includes(anchor);
        if (!inActive) return false;
        if (allowStringLiteral || !bundle.isJsTs) return true;
        return strictCodeLines
          .slice(startIdx, endExclusiveIdx)
          .join('\n')
          .includes(maskJsStringInteriorsInSnippet(anchor));
      };

      if (!lineMatchesAnchor(c.start - 1, spec.startAnchor, spec.startAnchorIsComment, spec.anchorInStringLiteral)) {
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
        const prevMatched = c.start >= 2
          && lineMatchesAnchor(c.start - 2, spec.prevAnchor, false, Boolean(spec.prevAnchorInStringLiteral));
        if (!prevMatched) {
          errors.push(
            `${doc} (${c.raw}): preceding line ${c.start - 1} does not contain disambiguating context "${spec.prevAnchor}"`,
          );
          return;
        }
      }

      const expectedEndAnchor = spec.endAnchor ?? spec.startAnchor;
      const endIsComment = spec.endAnchor !== undefined ? spec.endAnchorIsComment : spec.startAnchorIsComment;
      const endAllowString = spec.endAnchor !== undefined
        ? Boolean(spec.endAnchorInStringLiteral || spec.anchorInStringLiteral)
        : Boolean(spec.anchorInStringLiteral);
      if (!lineMatchesAnchor(c.end - 1, expectedEndAnchor, endIsComment, endAllowString)) {
        errors.push(
          `${doc} (${c.raw}): end line ${c.end} does not contain expected end anchor "${expectedEndAnchor}"; got "${lines[c.end - 1].trim().slice(0, 80)}"`,
        );
        return;
      }

      if (Array.isArray(spec.rangeAnchors) && spec.rangeAnchors.length > 0) {
        for (const req of spec.rangeAnchors) {
          if (!rangeMatchesAnchor(c.start - 1, c.end, req, spec.rangeAnchorsAreComments, spec.anchorInStringLiteral)) {
            errors.push(`${doc} (${c.raw}): range ${c.start}-${c.end} is missing required active evidence "${req}"`);
          }
        }
      }

      if (xmlInfo !== null && !spec.startAnchorIsComment) {
        const xmlErr = verifyXmlElementSemantics(xmlInfo, spec, c);
        if (xmlErr !== null) {
          errors.push(`${doc} (${c.raw}): ${xmlErr}`);
        }
      }

      if (sqlInfo !== null) {
        const sqlErr = verifySqlTableSemantics(sqlInfo, spec);
        if (sqlErr !== null) {
          errors.push(`${doc} (${c.raw}): ${sqlErr}`);
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
