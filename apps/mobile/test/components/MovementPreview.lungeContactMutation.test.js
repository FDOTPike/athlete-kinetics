/** The SAME contact assertion must reject bad data in either lead phase. */
// R2 Part C: the merged preview data comes from the app's own module.
import { previewManifest as raw } from './previewManifest';
import { DUAL_BODY_PARAMETERS } from '../../src/components/movementPreview/canonicalFigure';
import { measureLungeContacts, assertLungeContacts } from './lungeContactProbe';
const entry = raw.entries.find((e) => e.movementId === 17);
const rig = require('../../src/components/movementPreview/canonicalFigure');

test.each(['male', 'female'])('drawn contact check rejects drift, lift, and sinking (%s)', (body) => {
  for (const id of ['wl-13', 'wl-31']) for (const key of ['an', 'af']) {
    for (const [axis, delta] of [[0, 3], [1, -8], [1, 8]]) {
      const mutant = structuredClone(entry);
      mutant.frames.find((frame) => frame.id === id).joints[key][axis] += delta;
      expect(() => assertLungeContacts(measureLungeContacts(mutant, DUAL_BODY_PARAMETERS[body], rig)))
        .toThrow(/drawn tip drift|floor gap/);
    }
  }
  expect(() => assertLungeContacts([])).toThrow('Vacuous');
});
