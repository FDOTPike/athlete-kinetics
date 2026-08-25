/**
 * test_verify_install_scripts.mjs — falsifiers for the `[F3d]` install-script
 * policy gate.
 *
 * Hermes r6, finding R6-1: the inline `[F3d]` gate was deleted outright by a
 * text splice during the round-6 CI-structure extraction. Nothing went red. The
 * only trace was the total check count dropping 618 -> 600, which was observed
 * and not investigated. The gate had no fixtures, so there was nothing to fail.
 *
 * Every assertion the deleted gate made now has a fixture that BREAKS it. If
 * this file stops failing on these inputs, the policy has gone soft — and if
 * this file disappears, `verify:qa-artifact` stops running and `verify:ci`
 * goes red, which is the anchor the inline version never had.
 *
 * Run: node tools/test_verify_install_scripts.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkInstallScriptPolicy,
  installScriptPackages,
  lockEntryIdentity,
} from './verify_install_scripts.mjs';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** A policy that is genuinely closed: pinned, in lockstep, strict, floored. */
const SOUND_PKG = {
  engines: { node: '>=24.0.0', npm: '>=11.6.0' },
  allowScripts: { 'sharp@0.32.6': true, 'fsevents@2.3.3': true },
};
const SOUND_LOCK = {
  packages: {
    '': { name: 'root', version: '1.0.0' },
    'node_modules/sharp': { name: 'sharp', version: '0.32.6', hasInstallScript: true },
    'node_modules/fsevents': { name: 'fsevents', version: '2.3.3', hasInstallScript: true },
    'node_modules/lodash': { name: 'lodash', version: '4.17.21' },
  },
};
const SOUND_NPMRC = 'strict-allow-scripts=true\nengine-strict=true\n';
const sound = (over = {}) => checkInstallScriptPolicy({
  pkgJson: SOUND_PKG, lockJson: SOUND_LOCK, npmrc: SOUND_NPMRC, ...over,
});
/** Did the gate go red, and for the expected reason? */
const redBecause = (r, needle) => r.ok === false && r.problems.some((p) => p.includes(needle));

// =============================================================================
console.log('[1] the positive control — a closed policy passes');

{
  const r = sound();
  check('a pinned, in-lockstep, strict policy is accepted', r.ok === true, r.problems.join('; ').slice(0, 140));
  check('  ...and all nine assertions are reported', r.checks.length === 9, String(r.checks.length));
}

// =============================================================================
console.log('\n[2] R6-1 NEGATIVE FALSIFIERS — the drift the gate must catch');

{
  // REQUIRED FALSIFIER (a): drop an allowScripts entry. sharp still runs an
  // install script in the lockfile, but nobody has reviewed it.
  const pkgJson = { ...SOUND_PKG, allowScripts: { 'fsevents@2.3.3': true } };
  const r = sound({ pkgJson });
  check('dropping an allowScripts entry is REJECTED (unreviewed install script)',
    redBecause(r, 'explicitly reviewed'), r.problems.join('; ').slice(0, 100));
  check('  ...and the unreviewed package is named', r.observed.missing.includes('sharp@0.32.6'),
    r.observed.missing.join(','));
}

{
  // REQUIRED FALSIFIER (b): flip engine-strict. npm 10 would then ignore the
  // engines floor, and an npm that predates allowScripts ignores the policy
  // entirely — every install script runs, with the policy still on disk.
  const r = sound({ npmrc: 'strict-allow-scripts=true\nengine-strict=false\n' });
  check('flipping `engine-strict` to false is REJECTED', redBecause(r, 'engines floor'),
    r.problems.join('; ').slice(0, 100));
}

{
  // The other half of strictness: advisory mode warns and installs anyway.
  const r = sound({ npmrc: 'strict-allow-scripts=false\nengine-strict=true\n' });
  check('an advisory (non-strict) allow-scripts setting is REJECTED', redBecause(r, 'STRICT'));
}

// =============================================================================
console.log('\n[3] lockstep must hold in BOTH directions');

{
  // Direction 1: a NEW install-script dependency appears in the lockfile.
  const lockJson = {
    packages: {
      ...SOUND_LOCK.packages,
      'node_modules/evil-postinstall': { name: 'evil-postinstall', version: '1.0.0', hasInstallScript: true },
    },
  };
  const r = sound({ lockJson });
  check('a NEW unreviewed install-script package is REJECTED',
    redBecause(r, 'explicitly reviewed') && r.observed.missing.includes('evil-postinstall@1.0.0'),
    r.observed.missing.join(','));
}

{
  // Direction 2: the reviewed package is gone, the standing approval is not.
  // This is the direction a one-way gate misses: nothing is unreviewed, so it
  // looks clean, while `sharp@0.32.6` keeps a pre-approval that would execute
  // the moment that exact version returns.
  const lockJson = {
    packages: Object.fromEntries(
      Object.entries(SOUND_LOCK.packages).filter(([p]) => p !== 'node_modules/sharp'),
    ),
  };
  const r = sound({ lockJson });
  check('a STALE allowScripts entry (package gone, approval left) is REJECTED',
    redBecause(r, 'stale') && r.observed.stale.includes('sharp@0.32.6'), r.observed.stale.join(','));
}

{
  // A version bump must not inherit the previous version's review.
  const lockJson = {
    packages: {
      ...SOUND_LOCK.packages,
      'node_modules/sharp': { name: 'sharp', version: '0.33.0', hasInstallScript: true },
    },
  };
  const r = sound({ lockJson });
  check('a version BUMP does not inherit the old review',
    redBecause(r, 'explicitly reviewed') && redBecause(r, 'stale'),
    `missing=${r.observed.missing} stale=${r.observed.stale}`);
}

// =============================================================================
console.log('\n[4] the policy must be pinned and present');

{
  const r = sound({ pkgJson: { engines: SOUND_PKG.engines } });
  check('no allowScripts policy at all is REJECTED', redBecause(r, 'declares an allowScripts policy'));
}
{
  const r = sound({ pkgJson: { ...SOUND_PKG, allowScripts: {} } });
  check('an EMPTY policy is REJECTED (it reviews nothing while sharp runs)',
    r.ok === false, r.problems.join('; ').slice(0, 90));
}
{
  // A range is not a review: `sharp@^0.32.0` pre-approves versions nobody saw.
  const r = sound({ pkgJson: { ...SOUND_PKG, allowScripts: { 'sharp@^0.32.0': true, 'fsevents@2.3.3': true } } });
  check('an unpinned (range) allowScripts key is REJECTED', redBecause(r, 'pinned'));
}
{
  const r = sound({ pkgJson: { ...SOUND_PKG, allowScripts: ['sharp@0.32.6'] } });
  check('an allowScripts ARRAY (wrong shape, silently ignored by npm) is REJECTED',
    redBecause(r, 'declares an allowScripts policy'));
}

// =============================================================================
console.log('\n[5] the engine floors that make the policy enforceable');

{
  const r = sound({ pkgJson: { ...SOUND_PKG, engines: { node: '>=24.0.0', npm: '>=10.0.0' } } });
  check('an npm floor below 11.6 is REJECTED (that npm ignores allowScripts)',
    redBecause(r, 'floors npm'));
}
{
  const r = sound({ pkgJson: { ...SOUND_PKG, engines: { node: '>=20.0.0', npm: '>=11.6.0' } } });
  check('a node floor below the supported major is REJECTED', redBecause(r, 'floors node'));
}
{
  const r = sound({ pkgJson: { ...SOUND_PKG, engines: undefined } });
  check('no engines block at all is REJECTED', redBecause(r, 'floors npm') && redBecause(r, 'floors node'));
}

// =============================================================================
console.log('\n[6] .npmrc must be real text, not a claim about it');

{
  const r = sound({ npmrc: '' });
  check('a missing .npmrc is REJECTED', redBecause(r, 'exists and is committed'));
}
{
  // A commented-out directive is prose. npm never reads it.
  const r = sound({ npmrc: '# strict-allow-scripts=true\n# engine-strict=true\n' });
  check('COMMENTED-OUT directives are REJECTED', redBecause(r, 'STRICT') && redBecause(r, 'engines floor'));
}
{
  // Whitespace and surrounding config are fine; the directive is what counts.
  const r = sound({ npmrc: 'registry=https://registry.npmjs.org/\n  strict-allow-scripts = true  \nengine-strict=true\n' });
  check('a well-formed .npmrc with other settings still passes', r.ok === true,
    r.problems.join('; ').slice(0, 90));
}

// =============================================================================
console.log('\n[7] lockfile identity helpers');

{
  check('a nested path with no `name` falls back to the path tail',
    lockEntryIdentity('node_modules/a/node_modules/sharp', { version: '0.32.6' }) === 'sharp@0.32.6');
  check('a recorded `name` wins over the path',
    lockEntryIdentity('node_modules/aliased', { name: 'sharp', version: '0.32.6' }) === 'sharp@0.32.6');
  check('packages without install scripts are not collected',
    !installScriptPackages(SOUND_LOCK).has('lodash@4.17.21'));
  check('a lockfile with no packages block yields an empty set',
    installScriptPackages({}).size === 0);
}

// =============================================================================
console.log('\n[8] the REAL policy in this repository');

{
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const lockJson = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf-8'));
  const npmrc = readFileSync(join(ROOT, '.npmrc'), 'utf-8');
  const r = checkInstallScriptPolicy({ pkgJson, lockJson, npmrc });
  check('the shipped install-script policy passes every assertion', r.ok === true,
    r.problems.join(' | ').slice(0, 200));
  check('  ...and it actually reviews something (the gate is not vacuous)',
    r.observed.lockInstallScripts.length > 0, r.observed.lockInstallScripts.join(', '));
}

console.log(`\n${fail === 0 ? 'ALL INSTALL-SCRIPT POLICY FIXTURES PASSED' : `${fail} INSTALL-SCRIPT POLICY FIXTURE(S) FAILED`}`);
process.exit(fail ? 1 : 0);
