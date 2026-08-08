/**
 * verify_load_selection.mjs — exhaustive table tests for the pure four-mode
 * load-selection resolver (WO_FOUR_MODE_LOAD §8 "Pure resolver").
 *
 * Asserts, for every tier/preference/evidence branch:
 *  - beginner NEVER resolves derived or manual;
 *  - manual advisory never becomes the operative first-set entry;
 *  - APRE precedence applies only on non-beginner auto;
 *  - the derived path calls the shipped 2.5 kg-rounded targetLoadKg;
 *  - timed targets cannot use 1RM derivation (fall to history/seeded) but a
 *    valid absolute APRE override still resolves derived on non-beginner auto;
 *  - absent evidence and explicit zero remain distinct;
 *  - invalid numeric inputs fail closed (no NaN/Infinity operative values);
 *  - input-order independence and double-run determinism;
 *  - manual current-session carry-forward uses the ACTUAL logged load, keeps
 *    source manual, and is not an advisory;
 *  - manual bodyweight identity load initializes to 0 even on the first set;
 *  - tier defaults and transition laws (enter beginner forces auto, leaving
 *    beginner re-defaults, non-beginner hops preserve only explicit choices).
 *
 * Run: npm run build:inference-test && node packages/inference/test/verify_load_selection.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  resolveLoadSelection,
  defaultLoadPreference,
  transitionLoadPreference,
} = require('./.build/loadSelection.js');
const { targetLoadKg } = require('./.build/blockGenerator.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const base = {
  trainingAge: 'intermediate',
  preference: 'auto',
  bodyweightMode: false,
  targetReps: 5,
  targetRpe: 8,
  oneRepMaxKg: null,
  overrideLoadKg: null,
  lastLoggedLoadKg: null,
  currentSessionLoadKg: null,
  isFirstSet: true,
};
const resolve = (overrides = {}) => resolveLoadSelection({ ...base, ...overrides });

// --- Beginner law: seeded -> history only -----------------------------------
console.log('[beginner law]');
check('beginner with no evidence is seeded blank (external load)',
  (() => { const r = resolve({ trainingAge: 'beginner' }); return r.source === 'seeded' && r.initialLoadKg === null; })());
check('beginner with honest history resolves history at the exact logged load',
  (() => { const r = resolve({ trainingAge: 'beginner', lastLoggedLoadKg: 40 }); return r.source === 'history' && r.initialLoadKg === 40; })());
check('beginner with explicit-zero history resolves history at 0 (zero is evidence)',
  (() => { const r = resolve({ trainingAge: 'beginner', lastLoggedLoadKg: 0 }); return r.source === 'history' && r.initialLoadKg === 0; })());
check('beginner NEVER derives: 1RM + reps ignored',
  (() => { const r = resolve({ trainingAge: 'beginner', oneRepMaxKg: 100 }); return r.source === 'seeded' && r.initialLoadKg === null; })());
check('beginner NEVER derives: APRE override ignored even with 1RM + history',
  (() => { const r = resolve({ trainingAge: 'beginner', overrideLoadKg: 95, oneRepMaxKg: 100, lastLoggedLoadKg: 40 }); return r.source === 'history' && r.initialLoadKg === 40; })());
check('beginner manual preference cannot produce manual or derived authority',
  (() => { const r = resolve({ trainingAge: 'beginner', preference: 'manual', overrideLoadKg: 95, oneRepMaxKg: 100 }); return (r.source === 'seeded' || r.source === 'history') && r.advisoryKg === null; })());
check('beginner timed target with full evidence still resolves history',
  (() => { const r = resolve({ trainingAge: 'beginner', targetReps: null, overrideLoadKg: 10, oneRepMaxKg: 100, lastLoggedLoadKg: 12.5 }); return r.source === 'history' && r.initialLoadKg === 12.5; })());
check('beginner bodyweight seeded initializes to identity load 0',
  (() => { const r = resolve({ trainingAge: 'beginner', bodyweightMode: true }); return r.source === 'seeded' && r.initialLoadKg === 0; })());

// --- Non-beginner auto -------------------------------------------------------
console.log('[non-beginner auto]');
for (const age of ['intermediate', 'advanced', 'elite']) {
  check(`${age} auto: APRE override -> derived`,
    (() => { const r = resolve({ trainingAge: age, overrideLoadKg: 95, oneRepMaxKg: 100, lastLoggedLoadKg: 40 }); return r.source === 'derived' && r.initialLoadKg === 95; })());
  check(`${age} auto: reps + 1RM -> derived via targetLoadKg (2.5 kg rounding)`,
    (() => { const r = resolve({ trainingAge: age, oneRepMaxKg: 100, lastLoggedLoadKg: 40 }); return r.source === 'derived' && r.initialLoadKg === targetLoadKg(100, 5, 8); })());
  check(`${age} auto: history only -> history at exact load`,
    (() => { const r = resolve({ trainingAge: age, lastLoggedLoadKg: 62.5 }); return r.source === 'history' && r.initialLoadKg === 62.5; })());
  check(`${age} auto: no evidence -> seeded blank`,
    (() => { const r = resolve({ trainingAge: age }); return r.source === 'seeded' && r.initialLoadKg === null; })());
  check(`${age} auto: explicit-zero history is not treated as missing`,
    (() => { const r = resolve({ trainingAge: age, lastLoggedLoadKg: 0 }); return r.source === 'history' && r.initialLoadKg === 0; })());
}
check('auto derived path equals the shipped targetLoadKg across a grid',
  (() => {
    for (const oneRm of [60, 100, 142.5]) {
      for (const reps of [3, 5, 8]) {
        for (const rpe of [7, 8.5, 10]) {
          const r = resolve({ oneRepMaxKg: oneRm, targetReps: reps, targetRpe: rpe });
          if (r.source !== 'derived' || r.initialLoadKg !== targetLoadKg(oneRm, reps, rpe)) return false;
        }
      }
    }
    return true;
  })());

// --- Timed targets -----------------------------------------------------------
console.log('[timed targets]');
check('timed + APRE override + non-beginner auto -> derived (absolute prescription)',
  (() => { const r = resolve({ targetReps: null, overrideLoadKg: 25 }); return r.source === 'derived' && r.initialLoadKg === 25; })());
check('timed + 1RM but no APRE -> history when available',
  (() => { const r = resolve({ targetReps: null, oneRepMaxKg: 100, lastLoggedLoadKg: 17.5 }); return r.source === 'history' && r.initialLoadKg === 17.5; })());
check('timed + 1RM, no APRE, no history -> seeded blank (no derivation)',
  (() => { const r = resolve({ targetReps: null, oneRepMaxKg: 100 }); return r.source === 'seeded' && r.initialLoadKg === null; })());

// --- Manual mode -------------------------------------------------------------
console.log('[manual mode]');
check('manual first set, no evidence: blank entry, no advisory',
  (() => { const r = resolve({ preference: 'manual' }); return r.source === 'manual' && r.initialLoadKg === null && r.advisoryKg === null && r.advisoryKind === null; })());
check('manual first set: APRE advisory wins precedence and never prefills',
  (() => { const r = resolve({ preference: 'manual', overrideLoadKg: 95, oneRepMaxKg: 100, lastLoggedLoadKg: 40 }); return r.source === 'manual' && r.initialLoadKg === null && r.advisoryKg === 95 && r.advisoryKind === 'apre'; })());
check('manual first set: 1RM advisory when no APRE',
  (() => { const r = resolve({ preference: 'manual', oneRepMaxKg: 100, lastLoggedLoadKg: 40 }); return r.advisoryKg === targetLoadKg(100, 5, 8) && r.advisoryKind === 'onerm' && r.initialLoadKg === null; })());
check('manual first set: history advisory when no APRE/1RM',
  (() => { const r = resolve({ preference: 'manual', lastLoggedLoadKg: 40 }); return r.advisoryKg === 40 && r.advisoryKind === 'history' && r.initialLoadKg === null; })());
check('manual timed target: 1RM cannot advise (no derivation)',
  (() => { const r = resolve({ preference: 'manual', targetReps: null, oneRepMaxKg: 100 }); return r.advisoryKg === null && r.advisoryKind === null; })());
check('manual timed target: APRE advisory still lawful (absolute)',
  (() => { const r = resolve({ preference: 'manual', targetReps: null, overrideLoadKg: 25 }); return r.advisoryKg === 25 && r.advisoryKind === 'apre' && r.initialLoadKg === null; })());
check('manual bodyweight first set initializes to identity load 0, source manual',
  (() => { const r = resolve({ preference: 'manual', bodyweightMode: true }); return r.source === 'manual' && r.initialLoadKg === 0; })());
check('manual bodyweight first set with advisory: entry is 0, advisory separate',
  (() => { const r = resolve({ preference: 'manual', bodyweightMode: true, overrideLoadKg: 10 }); return r.source === 'manual' && r.initialLoadKg === 0 && r.advisoryKg === 10; })());
check('auto bodyweight seeded also initializes to identity load 0',
  (() => { const r = resolve({ bodyweightMode: true }); return r.source === 'seeded' && r.initialLoadKg === 0; })());
check('bodyweight never derives from 1RM even in auto',
  (() => { const r = resolve({ bodyweightMode: true, oneRepMaxKg: 100 }); return r.source === 'seeded' && r.initialLoadKg === 0; })());

// --- D1-A: bodyweight 1RM carve-out (ratified by Francis 2026-08-08) ---------
console.log('[D1-A bodyweight 1RM carve-out]');
check('D1-A: non-beginner auto + bodyweight + reps + 1RM only -> seeded identity zero (never derived)',
  (() => { const r = resolve({ trainingAge: 'intermediate', bodyweightMode: true, oneRepMaxKg: 100, targetReps: 5 }); return r.source === 'seeded' && r.initialLoadKg === 0 && r.advisoryKg === null; })());
check('D1-A: non-beginner auto + bodyweight + reps + 1RM + history -> history (not derived)',
  (() => { const r = resolve({ trainingAge: 'intermediate', bodyweightMode: true, oneRepMaxKg: 100, lastLoggedLoadKg: 5 }); return r.source === 'history' && r.initialLoadKg === 5; })());
check('D1-A: non-beginner auto + bodyweight + valid APRE -> derived',
  (() => { const r = resolve({ trainingAge: 'intermediate', bodyweightMode: true, overrideLoadKg: 10, oneRepMaxKg: 100 }); return r.source === 'derived' && r.initialLoadKg === 10; })());
check('D1-A: manual + bodyweight + 1RM only -> no 1RM advisory, identity zero',
  (() => { const r = resolve({ trainingAge: 'intermediate', preference: 'manual', bodyweightMode: true, oneRepMaxKg: 100 }); return r.source === 'manual' && r.initialLoadKg === 0 && r.advisoryKg === null && r.advisoryKind === null; })());
check('D1-A: beginner ignores APRE even for bodyweight',
  (() => { const r = resolve({ trainingAge: 'beginner', bodyweightMode: true, overrideLoadKg: 10 }); return r.source === 'seeded' && r.initialLoadKg === 0; })());
check('D1-A: manual + bodyweight + APRE advisory stays supporting only',
  (() => { const r = resolve({ trainingAge: 'intermediate', preference: 'manual', bodyweightMode: true, overrideLoadKg: 10 }); return r.source === 'manual' && r.initialLoadKg === 0 && r.advisoryKg === 10 && r.advisoryKind === 'apre'; })());

// --- Current-session carry-forward (manual only) -----------------------------
console.log('[carry-forward]');
check('manual subsequent set carries the ACTUAL current-session load',
  (() => { const r = resolve({ preference: 'manual', isFirstSet: false, currentSessionLoadKg: 47.5, lastLoggedLoadKg: 40 }); return r.source === 'manual' && r.initialLoadKg === 47.5; })());
check('carry-forward keeps the advisory separate (carried value is not advice)',
  (() => { const r = resolve({ preference: 'manual', isFirstSet: false, currentSessionLoadKg: 47.5, overrideLoadKg: 95 }); return r.initialLoadKg === 47.5 && r.advisoryKg === 95 && r.advisoryKind === 'apre'; })());
check('carry-forward honors an explicit zero logged earlier in the session',
  (() => { const r = resolve({ preference: 'manual', isFirstSet: false, currentSessionLoadKg: 0 }); return r.source === 'manual' && r.initialLoadKg === 0; })());
check('auto mode does not use current-session carry-forward (evidence path only)',
  (() => { const r = resolve({ isFirstSet: false, currentSessionLoadKg: 47.5, lastLoggedLoadKg: 40 }); return r.source === 'history' && r.initialLoadKg === 40; })());

// --- Fail-closed on invalid numerics -----------------------------------------
console.log('[fail-closed]');
for (const bad of [NaN, Infinity, -Infinity, -5]) {
  check(`invalid lastLoggedLoadKg (${String(bad)}) is absent evidence`,
    (() => { const r = resolve({ lastLoggedLoadKg: bad }); return r.source === 'seeded' && r.initialLoadKg === null; })());
  check(`invalid overrideLoadKg (${String(bad)}) cannot derive`,
    (() => { const r = resolve({ overrideLoadKg: bad }); return r.source === 'seeded'; })());
  check(`invalid oneRepMaxKg (${String(bad)}) cannot derive`,
    (() => { const r = resolve({ oneRepMaxKg: bad }); return r.source === 'seeded'; })());
  check(`invalid currentSessionLoadKg (${String(bad)}) does not carry forward`,
    (() => { const r = resolve({ preference: 'manual', isFirstSet: false, currentSessionLoadKg: bad }); return r.source === 'manual' && r.initialLoadKg === null; })());
}
for (const bad of [NaN, Infinity, -Infinity, -5, 0, 2.5]) {
  check(`invalid targetReps (${String(bad)}) cannot derive from 1RM`,
    (() => { const r = resolve({ targetReps: bad, oneRepMaxKg: 100 }); return r.source === 'seeded' && r.initialLoadKg === null; })());
}
for (const bad of [NaN, Infinity, -Infinity, -5, 4.5, 10.5]) {
  check(`invalid targetRpe (${String(bad)}) cannot derive from 1RM`,
    (() => { const r = resolve({ targetRpe: bad, oneRepMaxKg: 100 }); return r.source === 'seeded' && r.initialLoadKg === null; })());
}
check('valid APRE remains authoritative when rep/RPE derivation inputs are invalid',
  (() => { const r = resolve({ targetReps: NaN, targetRpe: Infinity, oneRepMaxKg: 100, overrideLoadKg: 55 }); return r.source === 'derived' && r.initialLoadKg === 55; })());

// --- Determinism + input-order independence ----------------------------------
console.log('[determinism]');
const fullEvidence = { overrideLoadKg: 95, oneRepMaxKg: 100, lastLoggedLoadKg: 40, targetReps: 5 };
const first = resolveLoadSelection({ ...base, ...fullEvidence });
const second = resolveLoadSelection({ ...base, ...fullEvidence });
check('double-run deep equality', JSON.stringify(first) === JSON.stringify(second));
const shuffledFull = {};
for (const k of Object.keys({ ...base, ...fullEvidence }).reverse()) shuffledFull[k] = { ...base, ...fullEvidence }[k];
check('input-order independence', JSON.stringify(resolveLoadSelection(shuffledFull)) === JSON.stringify(first));

// --- Tier defaults + transition laws -----------------------------------------
console.log('[tier defaults and transitions]');
check('defaults: beginner/intermediate auto, advanced/elite manual',
  defaultLoadPreference('beginner') === 'auto' && defaultLoadPreference('intermediate') === 'auto'
    && defaultLoadPreference('advanced') === 'manual' && defaultLoadPreference('elite') === 'manual');
check('entering beginner forces auto from any prior value',
  transitionLoadPreference('advanced', 'beginner', 'manual', true) === 'auto'
    && transitionLoadPreference('intermediate', 'beginner', 'auto', true) === 'auto');
check('leaving beginner applies the destination default',
  transitionLoadPreference('beginner', 'intermediate', 'auto', false) === 'auto'
    && transitionLoadPreference('beginner', 'advanced', 'auto', false) === 'manual'
    && transitionLoadPreference('beginner', 'elite', 'auto', false) === 'manual');
check('leaving beginner re-defaults even if the stored value says manual',
  transitionLoadPreference('beginner', 'advanced', 'manual', true) === 'manual'
    && transitionLoadPreference('beginner', 'intermediate', 'manual', true) === 'auto');
check('non-beginner hops preserve an explicit choice',
  transitionLoadPreference('advanced', 'elite', 'auto', true) === 'auto'
    && transitionLoadPreference('elite', 'intermediate', 'manual', true) === 'manual');
check('non-beginner hops re-derive a non-explicit (defaulted) value',
  transitionLoadPreference('advanced', 'intermediate', 'manual', false) === 'auto'
    && transitionLoadPreference('intermediate', 'advanced', 'auto', false) === 'manual');

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
