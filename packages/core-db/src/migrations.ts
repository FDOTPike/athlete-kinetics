/**
 * migrations.ts — PRAGMA user_version-gated, forward-only migration runner.
 *
 * Schema files are bundled as raw strings (babel-plugin-inline-import for
 * `.sql`, configured in apps/mobile/babel.config.js). 004 is intentionally
 * NOT a migration — it is the parameterized daily upsert executed by the DAO.
 */
import { type DB } from '@op-engineering/op-sqlite';

import m001 from './schema/001_mechanical_input.sql';
import m002 from './schema/002_telemetry.sql';
import m003 from './schema/003_state_vector.sql';

/** Ordered, append-only. Never edit a shipped entry — add a new one. */
const MIGRATIONS: readonly string[] = [m001, m002, m003];

export function migrate(db: DB): void {
  const row = db.executeSync('PRAGMA user_version;').rows[0] as {
    user_version: number;
  };
  const current = row.user_version;

  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(async (tx) => {
      tx.execute(MIGRATIONS[v]);
      tx.execute(`PRAGMA user_version = ${v + 1};`);
    });
  }
}
