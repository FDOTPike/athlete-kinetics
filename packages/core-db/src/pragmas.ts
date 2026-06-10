/**
 * pragmas.ts — op-sqlite connection bootstrap for the kinematics DB.
 *
 * Tuned for coexistence with an mmap'd ~1 GB GGUF model on a 4 GB device:
 * the DB must stay fast WITHOUT competing with SLM weight pages for the OS
 * page cache (verified budget: <= 50 MB for the entire SQLite layer).
 */
import { open, type DB } from '@op-engineering/op-sqlite';

export const DB_NAME = 'athlete_kinetics.db';

/** Applied once per connection, in order, before any query runs. */
const BOOT_PRAGMAS: readonly string[] = [
  // WAL: writers (live set logging, telemetry sync) never block the SLM's
  // read of the state_vector; readers see a consistent snapshot.
  'PRAGMA journal_mode = WAL;',
  // NORMAL is durable-enough under WAL (fsync on checkpoint, not per-commit)
  // and roughly halves write latency on mobile flash.
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA foreign_keys = ON;',
  // Sort/temp B-trees in RAM, not on flash.
  'PRAGMA temp_store = MEMORY;',
  // 16 MB page cache (negative = KiB). Sized so cache + WAL stays inside the
  // audited 20-50 MB DB envelope.
  'PRAGMA cache_size = -16000;',
  // No DB mmap: the model weights own the page-cache budget. SQLite reads go
  // through its own (bounded) page cache instead.
  'PRAGMA mmap_size = 0;',
  // Checkpoint every ~1000 pages (~4 MB) so the WAL file stays small.
  'PRAGMA wal_autocheckpoint = 1000;',
  // Telemetry sync and UI writes can briefly contend; don't throw SQLITE_BUSY.
  'PRAGMA busy_timeout = 5000;',
];

export function openKineticsDb(): DB {
  const db = open({ name: DB_NAME });
  for (const pragma of BOOT_PRAGMAS) db.executeSync(pragma);
  return db;
}

/**
 * Call with `true` immediately before llama.rn context creation and `false`
 * after generation completes. Shrinks the page cache and pauses WAL
 * checkpointing so DB I/O cannot evict hot SLM weight pages mid-inference
 * (the audited thrash failure mode).
 */
export function setInferenceMode(db: DB, on: boolean): void {
  if (on) {
    db.executeSync('PRAGMA cache_size = -4000;');      // 4 MB
    db.executeSync('PRAGMA wal_autocheckpoint = 0;');  // defer checkpoints
  } else {
    db.executeSync('PRAGMA cache_size = -16000;');
    db.executeSync('PRAGMA wal_autocheckpoint = 1000;');
    db.executeSync('PRAGMA wal_checkpoint(PASSIVE);'); // catch up now
  }
}

/** Run on app background/terminate: keeps the query planner statistics fresh
 *  and truncates the WAL so the next cold open is a clean single-file read. */
export function closeKineticsDb(db: DB): void {
  db.executeSync('PRAGMA optimize;');
  db.executeSync('PRAGMA wal_checkpoint(TRUNCATE);');
  db.close();
}
