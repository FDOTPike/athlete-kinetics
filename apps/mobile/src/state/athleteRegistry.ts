/**
 * athleteRegistry.ts — IO shell over athleteRegistryCore.
 *
 * The registry is a tiny JSON file in the app document directory. It is the
 * thing that DECIDES which SQLite file to open, so it cannot live inside any
 * of the databases it selects — the same reason the embedding model path
 * bootstraps from the document dir (deviceEmbedder precedent).
 *
 * Every function is failure-tolerant: a missing or corrupt registry yields
 * the default single-athlete registry (core invariant I5), so the worst
 * possible outcome of registry damage is "the app behaves like it did before
 * Coach Mode existed." Writes are best-effort; a failed write leaves the
 * previous file intact (documented trade-off: last-write-wins, no fsync
 * ceremony for a <1 KB file rewritten a handful of times per install).
 */
import {
  REGISTRY_FILE,
  parseRegistry,
  serializeRegistry,
  type AthleteRegistry,
} from './athleteRegistryCore';

interface BlobUtilFs {
  dirs: { DocumentDir: string };
  exists(path: string): Promise<boolean>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>;
}

/** Deferred require, NOT a top-level import: react-native-blob-util touches
 *  its native module on import (the deviceEmbedder lesson) — failures must
 *  surface inside the caller's try/catch, not at bundle eval. */
function blobFs(): BlobUtilFs {
  const mod = require('react-native-blob-util') as { default: { fs: BlobUtilFs } };
  return mod.default.fs;
}

function registryPath(): string {
  return `${blobFs().dirs.DocumentDir}/${REGISTRY_FILE}`;
}

export async function loadRegistry(): Promise<AthleteRegistry> {
  try {
    const fs = blobFs();
    const path = registryPath();
    if (!(await fs.exists(path))) return parseRegistry('');
    return parseRegistry(await fs.readFile(path, 'utf8'));
  } catch {
    return parseRegistry('');
  }
}

export async function saveRegistry(reg: AthleteRegistry): Promise<boolean> {
  try {
    await blobFs().writeFile(registryPath(), serializeRegistry(reg), 'utf8');
    return true;
  } catch {
    return false;
  }
}
