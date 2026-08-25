/**
 * verify_install_scripts.mjs — PURE, falsifiable assertions about the npm
 * install-script policy (gate `[F3d]`).
 *
 * WHY THIS MODULE EXISTS — TWICE OVER.
 *
 * The policy itself: a package with an install script runs arbitrary code on
 * `npm install`, on every developer machine and every CI runner, before any
 * test has executed. npm >= 11.6 can refuse to run any install script that is
 * not explicitly reviewed, via an `allowScripts` map in package.json. That
 * refusal is only real if three things hold together — the map exists and is
 * pinned to exact versions, the map and the lockfile agree IN BOTH DIRECTIONS,
 * and `.npmrc` makes the policy strict rather than advisory. Any one of those
 * failing silently restores arbitrary code execution while leaving the policy
 * looking present.
 *
 * The module: the original `[F3d]` gate lived inline in `verify_store_sql.mjs`
 * and was DELETED by a text splice during the round-6 CI-structure extraction
 * (Hermes r6, finding R6-1). It had no fixtures of its own, so nothing failed
 * when it vanished; only the total check count moved, 618 -> 600, and that was
 * not investigated. A gate that can disappear without a single red test is a
 * gate that was never anchored. It is a module now so that
 * `test_verify_install_scripts.mjs` can attack it directly, and so that its
 * removal would itself be a failing test rather than a silent subtraction.
 *
 * Everything here is a pure function of already-parsed inputs: no filesystem,
 * no npm invocation. The caller supplies package.json, package-lock.json and
 * the raw `.npmrc` text; fixtures supply synthetic ones.
 */

/** The first npm that understands `allowScripts`. Below this the policy is inert. */
export const REQUIRED_NPM_FLOOR = '11.6';
/** The supported node major. */
export const REQUIRED_NODE_MAJOR = '24';

/**
 * The identity of a lockfile entry, as `name@version`.
 *
 * npm keys `packages` by INSTALL PATH, not by name, so the same package can
 * appear at several paths and a nested copy carries a path the name cannot be
 * read off directly. `v.name` is authoritative when npm records it; the path
 * tail is the fallback.
 */
export function lockEntryIdentity(path, entry) {
  const name = entry?.name ?? String(path).split('node_modules/').pop();
  return `${name}@${entry?.version}`;
}

/**
 * Every lockfile package that runs an install script, as a Set of `name@version`.
 */
export function installScriptPackages(lockJson) {
  return new Set(
    Object.entries(lockJson?.packages ?? {})
      .filter(([, v]) => v?.hasInstallScript)
      .map(([path, v]) => lockEntryIdentity(path, v)),
  );
}

/**
 * Check the install-script policy.
 *
 * Returns a `checks` array so the caller can surface each assertion under its
 * own name — the shape the inline gate had — plus an `ok`/`problems` summary.
 *
 * @param {{pkgJson: object, lockJson: object, npmrc: string}} input
 * @returns {{ok: boolean, problems: string[], checks: Array<{label: string, ok: boolean, detail: string}>, observed: object}}
 */
export function checkInstallScriptPolicy({ pkgJson = null, lockJson = null, npmrc = '' } = {}) {
  const checks = [];
  const add = (label, ok, detail = '') => checks.push({ label, ok: Boolean(ok), detail: String(detail) });

  const lockInstallScripts = installScriptPackages(lockJson);
  const allowScripts = pkgJson?.allowScripts ?? null;
  const allowKeys = Object.keys(allowScripts ?? {});
  const npmrcText = String(npmrc ?? '');

  // --- the policy exists at all -------------------------------------------
  add('package.json declares an allowScripts policy',
    allowScripts !== null && typeof allowScripts === 'object' && !Array.isArray(allowScripts),
    allowScripts === null ? '(absent)' : `${allowKeys.length} entries`);

  // --- and is pinned, so a version bump cannot inherit a review ------------
  add('every allowScripts entry is pinned to an exact name@version',
    allowKeys.length > 0 && allowKeys.every((k) => /.+@\d+\.\d+\.\d+/.test(k)),
    allowKeys.filter((k) => !/.+@\d+\.\d+\.\d+/.test(k)).join(', ') || allowKeys.join(', '));

  // --- lockstep, direction 1: nothing runs unreviewed ----------------------
  const missing = [...lockInstallScripts].filter((k) => !(k in (allowScripts ?? {})));
  add('every lockfile package with install scripts is explicitly reviewed',
    missing.length === 0, missing.join(', '));

  // --- lockstep, direction 2: no review outlives its package ---------------
  // A stale entry is a standing pre-approval for a name@version nobody is
  // using. Reintroduce that version and it executes without a fresh look.
  const stale = allowKeys.filter((k) => !lockInstallScripts.has(k));
  add('no allowScripts entry is stale (all still exist in the lockfile)',
    stale.length === 0, stale.join(', '));

  // --- the policy is STRICT, not advisory ---------------------------------
  add('.npmrc exists and is committed', npmrcText.length > 0);
  add('.npmrc makes the policy STRICT (unreviewed scripts fail, never warn)',
    /^\s*strict-allow-scripts\s*=\s*true\s*$/m.test(npmrcText));
  add('.npmrc enforces the engines floor so an old npm cannot ignore the policy',
    /^\s*engine-strict\s*=\s*true\s*$/m.test(npmrcText));

  // --- and an npm that predates allowScripts cannot be used ---------------
  const npmEngine = pkgJson?.engines?.npm ?? '';
  const nodeEngine = pkgJson?.engines?.node ?? '';
  add('package.json floors npm at the first version that understands allowScripts',
    npmEngine.includes(REQUIRED_NPM_FLOOR), npmEngine || '(absent)');
  add('package.json floors node at the supported major',
    new RegExp(REQUIRED_NODE_MAJOR).test(nodeEngine), nodeEngine || '(absent)');

  const problems = checks.filter((c) => !c.ok).map((c) => `${c.label}${c.detail ? ` [${c.detail}]` : ''}`);
  return {
    ok: problems.length === 0,
    problems,
    checks,
    observed: {
      allowKeys,
      lockInstallScripts: [...lockInstallScripts],
      missing,
      stale,
      npmEngine,
      nodeEngine,
    },
  };
}
