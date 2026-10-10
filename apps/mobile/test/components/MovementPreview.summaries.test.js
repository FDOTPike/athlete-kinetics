// A preview's summary is shown on screen under the drawing. It must be a whole
// sentence, and where it states how many positions are drawn, or which side the
// figure is seen from, that must be true of the entry.
import { previewManifest } from './previewManifest';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
const byId = new Map(previewManifest.entries.map((entry) => [entry.movementId, entry]));
/** A derived variant is drawn from its base's frames, in its base's view. */
const drawnFrom = (entry) => (entry.derivesFrom === undefined ? entry : byId.get(entry.derivesFrom));
const WITH_SUMMARY = previewManifest.entries.filter((entry) => typeof entry.summary === 'string').map((entry) => [entry.name, entry]);

test('most previews carry a summary', () => {
  expect(WITH_SUMMARY.length).toBeGreaterThanOrEqual(170);
});

test.each(WITH_SUMMARY)('%s: the summary is a whole sentence', (_name, entry) => {
  const summary = entry.summary.trim();
  expect(summary).toMatch(/[.!?]$/);
  expect(summary).not.toMatch(/\.{2,}$/); // not padded out with dots
  expect(summary).not.toMatch(/\s[.!?]$/);
});

test.each(WITH_SUMMARY)('%s: a stated number of drawn positions is the number of frames', (_name, entry) => {
  const stated = /^(\w+) drawn positions/i.exec(entry.summary);
  if (stated === null) return;
  expect(NUMBER_WORDS.indexOf(stated[1].toLowerCase())).toBe(drawnFrom(entry).frames.length);
});

test.each(WITH_SUMMARY)('%s: a stated side or front view is the view it is drawn in', (_name, entry) => {
  const stated = /seen from the (side|front)/i.exec(entry.summary);
  // The three original prototypes carry no view field to hold the claim to.
  if (stated === null || drawnFrom(entry).view === undefined) return;
  expect(drawnFrom(entry).view).toBe(stated[1].toLowerCase());
});
