/** Drawn primitive contact evidence, not the scanner's informational flag. */
// R2 Part C: the merged preview data comes from the app's own module.
import { previewManifest as raw } from './previewManifest';
import { DUAL_BODY_PARAMETERS } from '../../src/components/movementPreview/canonicalFigure';
import { measureLungeContacts, assertLungeContacts } from './lungeContactProbe';
const entry = raw.entries.find((e) => e.movementId === 17);

test.each(['neutral'])('drawn support and lead feet stay planted in both lunge descents (%s)', (body) => {
  const rows = measureLungeContacts(entry, DUAL_BODY_PARAMETERS[body],
    require('../../src/components/movementPreview/canonicalFigure'));
  assertLungeContacts(rows);
  expect(rows.filter((row) => row.role === 'lead').map((row) => row.foot)).toEqual(['an', 'af']);
  expect(entry.frames.at(-1).joints.hp[0] - entry.frames[0].joints.hp[0]).toBeGreaterThan(40);
});
