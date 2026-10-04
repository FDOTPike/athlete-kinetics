/**
 * nativeSmoke.ts — CI-only native smoke for the simulator build.
 *
 * Runs ONLY when the app is launched with the launch argument
 * `-AKNativeSmoke 1` (iOS reads launch arguments into NSUserDefaults, which
 * React Native's Settings module exposes). A person launching the app from the
 * home screen cannot pass launch arguments, so this is inert in normal use and
 * never touches athlete data: it uses its own throwaway database file.
 *
 * It proves, on the real native runtime, what host tests cannot:
 *   - op-sqlite compiled with SQLITE_ENABLE_MATH_FUNCTIONS (ln/sqrt), and the
 *     production migration chain applies to a fresh native database;
 *   - the bundled, pinned MiniLM model loads in onnxruntime and a known phrase
 *     routes to its own codebase entry (tokenizer + inference + routing);
 *   - the native CSPRNG the encrypted backup uses (mobileBackupCrypto.randomBytes,
 *     a direct RNGetRandomValues TurboModule call with no fallback) works;
 *   - the normal store boots to "ready" against a fresh install.
 * The result is written to Documents/ak-native-smoke.json and logged with an
 * `[ak-native-smoke]` marker for the macOS CI job to collect. Content-free:
 * no athlete data is read or written.
 */
import { Platform } from 'react-native';
import { loadCodebase, triage, type PhraseCodebase } from '@ak/inference';
import { BACKUP_SCHEMA_USER_VERSION, closeKineticsDb, migrate, openKineticsDb } from '@ak/core-db';
import { tryCreateDeviceEmbedder } from '../inference/deviceEmbedder';
import { useStore } from '../state/useStore';
import { mobileBackupCrypto } from '../state/backupCrypto';
import phraseCodebaseJson from '../../../../packages/inference/assets/phrase-codebase.json';
import phraseVectorsJson from '../../../../packages/inference/assets/phrase-codebase.vectors.json';

export const NATIVE_SMOKE_SETTING = 'AKNativeSmoke';
const SMOKE_DB = 'ak_native_smoke.db';
const RESULT_FILE = 'ak-native-smoke.json';

export function nativeSmokeRequested(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const { Settings } = require('react-native') as { Settings?: { get(key: string): unknown } };
    const value = Settings?.get(NATIVE_SMOKE_SETTING);
    return value === 1 || value === '1' || value === true || value === 'YES';
  } catch {
    return false;
  }
}

type Check = { name: string; ok: boolean; detail: string };

async function step(checks: Check[], name: string, run: () => Promise<string> | string): Promise<void> {
  try {
    checks.push({ name, ok: true, detail: await run() });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

export async function runNativeSmoke(): Promise<void> {
  const checks: Check[] = [];
  const startedAt = Date.now();

  await step(checks, 'sqlite math functions', () => {
    const db = openKineticsDb(SMOKE_DB);
    try {
      const row = (db.executeSync('SELECT ln(1) AS l, sqrt(4) AS s').rows ?? [])[0] as { l: number; s: number } | undefined;
      if (row?.l !== 0 || row?.s !== 2) throw new Error(`ln(1)=${row?.l} sqrt(4)=${row?.s}`);
      return 'ln(1)=0 sqrt(4)=2';
    } finally { closeKineticsDb(db); }
  });

  await step(checks, 'fresh migration chain', () => {
    const db = openKineticsDb(SMOKE_DB);
    try {
      migrate(db);
      const version = Number(((db.executeSync('PRAGMA user_version').rows ?? [])[0] as { user_version: number }).user_version);
      const movements = Number(((db.executeSync('SELECT COUNT(*) AS c FROM movement').rows ?? [])[0] as { c: number }).c);
      db.executeSync('SELECT COUNT(*) AS c FROM v_readiness_inputs');
      if (version !== BACKUP_SCHEMA_USER_VERSION || movements !== 300) throw new Error(`user_version=${version} movements=${movements}`);
      return `user_version=${version} movements=${movements}`;
    } finally {
      closeKineticsDb(db);
      try {
        const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
        open({ name: SMOKE_DB }).delete();
      } catch { /* throwaway file */ }
    }
  });

  await step(checks, 'embedder inference + routing', async () => {
    const embedder = await tryCreateDeviceEmbedder();
    if (embedder === null) throw new Error('embedder unavailable (model missing from bundle or ORT failed to load)');
    const codebase = loadCodebase(phraseCodebaseJson as unknown as PhraseCodebase, phraseVectorsJson.vectors);
    const entry = (phraseCodebaseJson as unknown as PhraseCodebase).entries[0]!;
    const vector = await embedder.embed(entry.text);
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    const routed = triage(vector, codebase);
    if (vector.length !== 384 || Math.abs(norm - 1) > 1e-3) throw new Error(`dims=${vector.length} norm=${norm}`);
    if (!routed.confident || routed.entry?.id !== entry.id) {
      throw new Error(`routed ${routed.entry?.id ?? 'none'} (${routed.similarity.toFixed(4)}), expected ${entry.id}`);
    }
    return `dims=384 norm=${norm.toFixed(6)} routed=${entry.id} similarity=${routed.similarity.toFixed(6)}`;
  });

  // The exact production entropy path of encrypted backups (no global polyfill
  // is installed, by design): two independent draws of the documented sizes.
  await step(checks, 'native CSPRNG (backup provider)', () => {
    const a = mobileBackupCrypto.randomBytes(32);
    const b = mobileBackupCrypto.randomBytes(32);
    if (!(a instanceof Uint8Array) || a.length !== 32 || b.length !== 32) throw new Error(`lengths ${a.length}/${b.length}`);
    if (a.every((x) => x === 0) || b.every((x) => x === 0)) throw new Error('all-zero random bytes');
    if (a.every((x, i) => x === b[i])) throw new Error('two draws were identical');
    return 'RNGetRandomValues via mobileBackupCrypto.randomBytes: 2 x 32 bytes, distinct';
  });

  await step(checks, 'store boot', async () => {
    for (let waited = 0; waited < 30_000 && useStore.getState().status !== 'ready'; waited += 250) {
      if (useStore.getState().status === 'error') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const { status, error } = useStore.getState();
    if (status !== 'ready') throw new Error(`status=${status} ${error ?? ''}`);
    return 'status=ready';
  });

  const result = {
    schema: 'ak.native-smoke/1',
    platform: Platform.OS,
    ok: checks.every((c) => c.ok),
    elapsedMs: Date.now() - startedAt,
    checks,
  };
  const text = JSON.stringify(result);
  console.log(`[ak-native-smoke] ${text}`);
  try {
    const blob = (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
    await blob.fs.writeFile(`${blob.fs.dirs.DocumentDir}/${RESULT_FILE}`, text, 'utf8');
  } catch { /* the console marker is the fallback channel */ }
}
