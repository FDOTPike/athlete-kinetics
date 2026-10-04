/**
 * WO-09 F-1 — caption integrity.
 *
 * Five captions reached the manifest cut off mid-sentence by a generator that
 * truncated at 64 characters: they read "...the trunk stays braced and.",
 * "...dumbbells at.", "...the weights stay beside the.". Nothing caught them.
 * The rendering gate proves a caption is drawn, inside the card and unclipped;
 * it has no opinion on whether the sentence finishes, and the e2e suite only
 * asserted a minimum length.
 *
 * This file closes that. The five completed captions are pinned exactly, which
 * is the real regression guard. A dangling-function-word rule runs alongside
 * them as a cheap net for the same class on movements nobody is looking at —
 * but it is a heuristic, and its limits are asserted rather than assumed: it
 * catches three of the five F-1 values ("...and.", "...at.", "...the.") and
 * cannot catch the two that were cut after a content word ("...the spine.",
 * "...the stance stays."). Only the exact pins cover those.
 *
 * Captions are athlete-facing copy, so the wording is checked against the
 * movement's own curated `instructions` rather than invented here.
 */
const fs = require('fs');
const path = require('path');
const { previewManifest } = require('./previewManifest');

// R2 Part C: the preview data is an index plus one file per family; the merged
// shape comes from the app's own module through the shared test helper.
const MANIFEST = previewManifest;

const entryFor = (movementId) => {
  const entry = MANIFEST.entries.find((e) => e.movementId === movementId);
  if (!entry) throw new Error(`movement ${movementId} is not in the manifest`);
  return entry;
};

const captionAt = (movementId, position) => entryFor(movementId).frames[position - 1].caption;

/** The five F-1 captions, with the source text each one is drawn from. */
const F1_CAPTIONS = [
  {
    movementId: 12, position: 1,
    caption: 'Let the working arm reach long while the trunk stays braced and still.',
    verbatimInInstructions: true,
  },
  {
    movementId: 12, position: 4,
    caption: 'Lower smoothly back toward full reach.',
    // The instructions say "lower to the full reach" and say nothing at all
    // about the spine, so the truncated "while keeping the spine" clause was
    // dropped rather than completed with invented technique.
    verbatimInInstructions: false,
    sourcePhrases: ['the full reach'],
  },
  {
    movementId: 54, position: 1,
    caption: 'Take a long stance, one foot forward and one back, dumbbells at your sides.',
    verbatimInInstructions: true,
  },
  {
    movementId: 54, position: 2,
    caption: 'Lower straight down between the feet while the stance stays planted.',
    verbatimInInstructions: false,
    sourcePhrases: ['Lower straight down', 'the stance stays planted'],
  },
  {
    movementId: 19, position: 3,
    caption: 'Push off with short, quiet steps; the weights stay beside the hips.',
    verbatimInInstructions: false,
    sourcePhrases: ['beside the hips'],
  },
];

/** The exact truncated values F-1 recorded, which must never reappear. */
const F1_TRUNCATED = [
  [12, 1, 'Let the working arm reach long while the trunk stays braced and.'],
  [12, 4, 'Lower smoothly back toward full reach while keeping the spine.'],
  [54, 1, 'Take a long stance, one foot forward and one back, dumbbells at.'],
  [54, 2, 'Lower straight down between the feet while the stance stays.'],
  [19, 3, 'Push off with short, quiet steps; the weights stay beside the.'],
];

/**
 * A caption ending on one of these is a fragment, not a sentence. A 64-character
 * truncation often lands here, but not always — see FUNCTION_WORD_TRUNCATIONS.
 */
const DANGLING_TAIL = /\b(and|the|with|while|of|to|a|an|from|over|into|for|then|but|or|that|as|at|in|on|by|its|their|your|is|are|be|been)\.$/i;

/** The subset of F-1 values the dangling-tail heuristic is able to see. */
const FUNCTION_WORD_TRUNCATIONS = F1_TRUNCATED
  .map(([, , truncated]) => truncated)
  .filter((t) => /\b(and|at|the)\.$/i.test(t));

const canonicalEntries = MANIFEST.entries.filter(
  (e) => Array.isArray(e.frames) && e.frames.length > 0 && e.frames[0].joints && e.frames[0].joints.nk !== undefined,
);

describe('WO-09 F-1: movement caption integrity', () => {
  it('has canonical movements to check', () => {
    expect(canonicalEntries.length).toBeGreaterThan(0);
  });

  describe.each(F1_CAPTIONS)('movement $movementId position $position', (spec) => {
    it('reads as the completed caption', () => {
      expect(captionAt(spec.movementId, spec.position)).toBe(spec.caption);
    });

    it('is supported by the movement\'s own curated instructions', () => {
      const instructions = entryFor(spec.movementId).instructions ?? '';
      expect(instructions).not.toBe('');
      if (spec.verbatimInInstructions) {
        expect(instructions).toContain(spec.caption);
      } else {
        for (const phrase of spec.sourcePhrases) expect(instructions).toContain(phrase);
      }
    });
  });

  it.each(F1_TRUNCATED)('movement %i position %i no longer carries its truncated value', (movementId, position, truncated) => {
    expect(captionAt(movementId, position)).not.toBe(truncated);
  });

  it('no canonical caption ends on a dangling function word', () => {
    const offenders = [];
    for (const entry of canonicalEntries) {
      entry.frames.forEach((frame, i) => {
        if (DANGLING_TAIL.test((frame.caption ?? '').trim())) {
          offenders.push(`${entry.movementId}/pos${i + 1}: ${JSON.stringify(frame.caption)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('every canonical caption is a non-empty sentence ending in terminal punctuation', () => {
    const offenders = [];
    for (const entry of canonicalEntries) {
      entry.frames.forEach((frame, i) => {
        const caption = (frame.caption ?? '').trim();
        if (caption.length < 10 || !/[.!?]$/.test(caption)) {
          offenders.push(`${entry.movementId}/pos${i + 1}: ${JSON.stringify(frame.caption)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the dangling-tail rule rejects the F-1 values that end on a function word', () => {
    // Without this the rule above could pass by being vacuous.
    for (const truncated of FUNCTION_WORD_TRUNCATIONS) {
      expect(DANGLING_TAIL.test(truncated)).toBe(true);
    }
    // ...and does not reject any completed caption.
    for (const spec of F1_CAPTIONS) {
      expect(DANGLING_TAIL.test(spec.caption)).toBe(false);
    }
  });

  it('states honestly which F-1 values the heuristic cannot catch', () => {
    // "...while keeping the spine." and "...while the stance stays." were cut
    // after a content word, so no function-word rule sees them. They are
    // caught only by the exact pins above, and this test exists so that limit
    // is recorded in the suite rather than left as an unstated assumption.
    const uncatchable = F1_TRUNCATED
      .map(([, , truncated]) => truncated)
      .filter((t) => !DANGLING_TAIL.test(t));
    expect(uncatchable).toEqual([
      'Lower smoothly back toward full reach while keeping the spine.',
      'Lower straight down between the feet while the stance stays.',
    ]);
    // Each one is nonetheless pinned by exact value.
    for (const truncated of uncatchable) {
      const [movementId, position] = F1_TRUNCATED.find(([, , t]) => t === truncated);
      expect(captionAt(movementId, position)).not.toBe(truncated);
    }
  });
});
