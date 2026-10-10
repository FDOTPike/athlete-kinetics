/**
 * lib/derivation.mjs — load the production `derivesFrom` contract module
 * (`apps/mobile/src/components/movementPreview/derivation.ts`) for the offline
 * tools, exactly the way lib/canonicalSvg.mjs loads canonicalFigure.ts:
 * compiled locally with tsc, imported, nothing fetched. One implementation of
 * the rules, so evidence can never be produced by a second, hand-written copy
 * of the derivation (review finding F1).
 */
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './canonicalSvg.mjs';

export async function loadDerivation({ root = ROOT, buildDir } = {}) {
  const outDir = buildDir ?? path.join(root, 'tools/rendering/.build-derivation');
  const src = path.join(root, 'apps/mobile/src/components/movementPreview/derivation.ts');
  const built = path.join(outDir, 'derivation.js');

  // derivation.ts imports the drawing module (its jointOffsets rule measures
  // drawn segments, B1-55), so tsc emits both and the build is fresh only when
  // it is newer than BOTH sources.
  const figureSrc = path.join(root, 'apps/mobile/src/components/movementPreview/canonicalFigure.ts');
  let fresh = false;
  try {
    const builtAt = statSync(built).mtimeMs;
    fresh = builtAt > statSync(src).mtimeMs && builtAt > statSync(figureSrc).mtimeMs;
  } catch {
    fresh = false;
  }

  if (!fresh) {
    try {
      execSync(
        'npx tsc --strict --skipLibCheck --target es2020 --module commonjs --outDir ' +
        `${JSON.stringify(outDir)} ` +
        JSON.stringify(src),
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (error) {
      const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
      throw new Error(`could not compile derivation.ts${detail ? `:\n${detail}` : ''}`);
    }
  }

  return import(`${pathToFileURL(built).href}?v=${statSync(built).mtimeMs}`);
}

/**
 * Every raw entry, with each variant resolved through the production contract.
 * A variant entry carries no frames of its own; this is what gives it the
 * base's frames (its `joints` objects shared, never copied) for rendering,
 * measuring or verifying.
 */
export function deriveEntries(rawEntries, derivation) {
  return rawEntries.map((entry) => {
    if (!derivation.isVariantEntry(entry)) return entry;
    const base = rawEntries.find((candidate) => candidate.movementId === entry.derivesFrom);
    // A record that carries BOTH the pointer and frames is an already-resolved
    // variant (for example the prototype's render input). It is VERIFIED
    // against its base rather than re-derived — a hand-flattened variant with
    // edited joints or reordered steps is refused exactly as resolution would
    // refuse it (critic findings A-C2 / A2-C4). Anything else with a pointer is
    // a raw variant and goes through the contract.
    if (Array.isArray(entry.frames) && entry.frames.length > 0) {
      derivation.verifyResolvedVariant(entry, base);
      return entry;
    }
    return derivation.deriveVariantEntry(entry, base);
  });
}
