// Optional prescription audit: node --require ./packages/inference/test/capture_d02.cjs <verifier>.
// D02_CAPTURE names an output JSONL file. Only production planner calls are captured;
// R05 has its own counterfactual matrix. No test expectations or engine inputs change.
const { appendFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const Module = require('node:module');
const filename = process.env.D02_CAPTURE;
if (filename) {
  writeFileSync(filename, '');
  const originalLoad = Module._load;
  const patched = new WeakSet();
  const canonical = (value) => {
    if (value instanceof Set) return [...value].sort();
    if (value instanceof Map) return canonical(Object.fromEntries(value));
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
  };
  Module._load = function (...args) {
    const exported = originalLoad.apply(this, args);
    if (!exported || typeof exported !== 'object' || patched.has(exported)) return exported;
    patched.add(exported);
    for (const name of ['generateBlock', 'composeRoutine', 'composeRoutineMicrocycle']) {
      if (typeof exported[name] !== 'function') continue;
      const original = exported[name];
      exported[name] = function (input) {
        const result = original.apply(this, arguments);
        if (!new Error().stack.includes('verify_r05.mjs')) {
          const serialized = JSON.stringify(canonical(input));
          const key = name + ':' + createHash('sha256').update(serialized).digest('hex');
          appendFileSync(filename, JSON.stringify({ key, function: name,
            verifier: resolve(process.argv[1]), input: JSON.parse(serialized), output: result }) + '\n');
        }
        return result;
      };
    }
    return exported;
  };
}
