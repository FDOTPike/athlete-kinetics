'use strict';

/**
 * nodeSqliteOpDriver.js — test-only stand-in for the op-sqlite DB handle.
 *
 * Implements the surface the real store exercises synchronously —
 * executeSync returning { rows }, whole-file DDL execution, and
 * parameterized DML — over node:sqlite, so the REAL zustand store code can
 * run against the REAL migration-chain bytes without a native module or a
 * device.
 *
 * Routing rule (matters): only READ statements and SINGLE-statement
 * parameterized writes go through prepare(). Everything else — DDL files,
 * BEGIN/COMMIT/ROLLBACK, PRAGMA assignments — goes through exec(), because
 * sqlite3_prepare compiles ONLY the first statement of a multi-statement
 * batch and would silently apply one statement of a migration file.
 */

const { DatabaseSync } = require('node:sqlite');

/** Count top-level statement terminators, ignoring ';' inside quoted regions. */
function countTopLevelSemicolons(sql) {
  let count = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote !== null) {
      if (ch === quote) {
        if (sql[i + 1] === quote) { i += 1; } else { quote = null; }
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === ';') count += 1;
  }
  return count;
}

function makeNodeSqliteDriver() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  // The schema's readiness math uses ln()/sqrt(); register the same
  // deterministic fallbacks verify:migrations uses when the bundled engine
  // lacks the math extension.
  try {
    db.prepare('SELECT ln(2.0), sqrt(2.0)').get();
  } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }

  const stripComments = (sql) => sql.replace(/^--.*$/gm, '');
  const isRead = (sql) => /^\s*(SELECT|WITH)\b/i.test(sql);

  return {
    /** Direct handle for fixture setup and assertion queries. */
    raw: db,
    executeSync(sql, params = []) {
      const clean = stripComments(String(sql));
      if (isRead(clean)) {
        return { rows: db.prepare(clean).all(...params) };
      }
      const single = countTopLevelSemicolons(clean) <= 1;
      if (single && clean.includes('?')) {
        db.prepare(clean).run(...params);
        return { rows: [] };
      }
      db.exec(clean);
      return { rows: [] };
    },
  };
}

module.exports = { makeNodeSqliteDriver };
