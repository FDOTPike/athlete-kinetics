/**
 * WO-09 remediation — fail-closed approval boundary (step A) and the
 * structurally valid approval path (step B).
 *
 * NO test in this file mocks the resolver: every assertion runs against the
 * REAL `resolveMovementPreview` and the REAL manifest module state.
 *
 * Step A holds the boundary the remediation was for: while the manifest's
 * qualified technique review is `pending` (and every real movement_media row
 * is `external_fallback`/`planned`), a covered manifest entry resolves to
 * NOTHING — the three legacy prototypes included. The positive path is
 * exercised only through an explicitly-labelled hypothetical-approval fixture
 * (review `complete` + media `ready`), which is exactly what the approval
 * path must look like when a qualified signoff actually flips the state.
 *
 * Step B holds the approval-path metadata contract: each authored canonical
 * entry carries previewId, summary and per-frame ids, so a future status flip
 * parses through the real boundary — proven here on fixtures
 * copied from the live manifest, never by approving a real movement.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import { MovementPreview } from '../../src/components/movementPreview';
import { previewManifest, shippedEntries } from './previewManifest';
import {
  previewEntries,
  rawPreviewEntries,
  PREVIEW_TECHNIQUE_REVIEW,
  buildPreviewEntry,
  resolveMovementPreview,
} from '../../src/components/movementPreview/manifest';

// R2 Part C split the preview data into an index plus one file per family. This
// suite needs every entry, and the raw authoring fields (previewId, status), so
// it uses the module's own readers: `previewEntries()` for the resolved entries
// and `rawPreviewEntries()` for the authoring records.
const RAW_MANIFEST = {
  entries: rawPreviewEntries(),
  techniqueReview: PREVIEW_TECHNIQUE_REVIEW,
};
const PREVIEW_ENTRIES = previewEntries();

// 164, 268 and 269 are back as pending drafts (the figure now has a hand that
// bends at the wrist); 200 Finger Curls stays out on its source hold. The note
// below records why they left.
// Entry 0183 took the four wrist-curl movements (164 Cable Wrist Curl, 200
// Finger Curls, 268 and 269 the seated dumbbell wrist curls) out of the manifest.
// All four have since been drawn again as pending pose-table drafts and are in
// the list below. For 200 Finger Curls only the catalogue TEXT is still on a
// source hold: its drawing is an authored pending draft whose text came from a
// separately audited description (see MovementPreview.fingerCurls.test.js).
// Family 15 (horizontal press, incline): the barbell base (134) and its three
// variations (212 the hammer-grip dumbbell pair, 216 the cable press, 218 the
// palms-in dumbbell pair) join as authored canonicals, pending like the rest.
// Family 16 (rear delt, standing): Band Pull-Apart (24, base) and Cable Rear
// Delt Fly (159). Family 17 (pallof, standing): Pallof Press (25, base) and
// Pallof Press With Rotation (251). Family 18 (calf raise, seated): Barbell
// Seated Calf Raise (111, base) and Dumbbell Seated One-Leg Calf Raise (191).
// Family 19 (plank, prone): Plank (26, base). Family 20 (horizontal pull,
// prone supported): Chest-Supported Dumbbell Row (42, base). Family 21 (dead
// bug, supine): Dead Bug (44, base). Family 22 (squat, sumo stance): Dumbbell
// Sumo Squat (57, base). Family 23 (face pull, standing): Face Pull (59,
// base). Family 24 (horizontal pull, seated): Seated Cable Rows (266, base).
// Family 25 (push-up, floor): Feet-Elevated Push-Up (60), Push Up to Side
// Plank (254) and Push-Up Wide (255) - the base Push-up (16) is prototype
// covered and has no prompt block, so it is not re-authored here.
// Family 26 (trunk flex, supine): Crunch - Hands Overhead (174), Crunches
// (175) and Rope Crunch (263) - the family base is reuse-unchanged.
// Family 27 (elbow extension, standing overhead): Cable Rope Overhead Triceps
// Extension (116, base), Cable One Arm Tricep Extension (157), Dumbbell
// Tricep Extension - Pronated Grip (193), Standing Dumbbell Triceps Extension
// (282) and Standing Overhead Barbell Triceps Extension (283).
// Family 28 (shrug, standing): Dumbbell Shrug (53, base), Barbell Shrug (82),
// Barbell Shrug Behind The Back (138) and Cable Shrugs (163).
// Family 29 (trunk flex, seated): 3/4 Sit-Up (125, base), Cable Seated Crunch
// (161), Jackknife Sit-Up (225) and Janda Sit-Up (226).
// Family 30 (hip extension, standing): Cable Pull-Through (40, base), Band
// Good Morning (Pull Through) (132) and Hip Extension with Bands (214).
// Family 31 (trunk twist, supine): Russian Twist (73, base), Cross-Body
// Crunch (173) and Oblique Crunches (245).
// Family 32 (push-up, incline): Incline Push-Up (90, base), Close-Grip (222)
// and Wide (223).
// Family 33 (elbow flexion, preacher, front view): Preacher Curl (92, base),
// Cable Preacher Curl (158) and Preacher Hammer Dumbbell Curl (253).
// Family 34 (hip extension, supine): Glute Bridge (29, base) and Single-Leg
// Glute Bridge (75).
// Family 35 (lunge, standing): Dumbbell Lunge (51, base) and Step-up with
// Knee Raise (286).
// Family 36 (rear delt, bent over): Barbell Rear Delt Row (110, base) and
// Bent Over Dumbbell Rear Delt Raise With Head On Bench (143).
// Family 37 (horizontal pull, kneeling): Kneeling Single-Arm High Pulley Row
// (122, base) and Kneeling High Pulley Row (234).
// Family 38 (front raise, incline): Barbell Incline Shoulder Raise (135, base)
// and Dumbbell Incline Shoulder Raise (187).
const CANONICAL_AUTHORED = [14, 9, 15, 10, 11, 12, 21, 54, 17, 19, 39, 62, 55, 74, 103, 169, 294, 298, 300, 97, 113, 287, 86, 100, 128, 133, 141, 168, 185, 196, 227, 246, 22, 30, 117, 238, 273, 142, 144, 146, 147, 32, 115, 197, 198, 224, 127, 274, 280, 284, 76, 118, 267, 270, 34, 106, 114, 126, 167, 172, 199, 260, 278, 134, 212, 216, 218, 24, 159, 25, 251, 111, 191, 26, 42, 44, 57, 59, 266, 60, 254, 255, 174, 175, 263, 116, 157, 193, 282, 283, 53, 82, 138, 163, 125, 161, 225, 226, 40, 132, 214, 73, 173, 245, 90, 222, 223, 92, 158, 253, 29, 75, 51, 286, 110, 143, 122, 234, 135, 187, 80, 262, 292, 264, 49, 178, 220, 84, 52, 66, 152, 50, 236, 87, 206, 272, 219, 221, 207, 155, 179, 180, 156, 237, 276, 171, 268, 269, 164, 95, 124, 72, 99, 150, 183, 285, 232, 181, 160, 248, 89, 37, 182, 27, 295, 297, 139, 162, 261, 131, 200];
const PROTOTYPE_COVERED = [28, 16, 88];
// R2 Part A authored the first derived draft preview (186, `derivesFrom` 62);
// Stage 2 Batch 1 adds 247 (`derivesFrom` 12), 20 (`derivesFrom` 19) and 113
// (`derivesFrom` 9). 55 (B1-55) was rebuilt with its own drawn frames in the
// squat (standing) family checkpoint; Scapular Pull-Up (74), One Arm Lat
// Pulldown (103), Close-Grip Front Lat Pulldown (169), Underhand Cable
// Pulldowns (294), V-Bar Pullup (298) and the Wide-Grip Lat Pulldown rebuild
// (300, own frames after the owner's seated-read fix) join the authored
// canonicals in the vertical-pull (standing) family. Each stays pending
// exactly like every other authored entry: a derivation is not an approval,
// and nothing here may flip a status.
const DERIVED_DRAFTS = [186, 247, 20];

const entryFor = (movementId) => PREVIEW_ENTRIES.find((entry) => entry.movementId === movementId);
const rawEntryFor = (movementId) => RAW_MANIFEST.entries.find((entry) => entry.movementId === movementId);

/** Hypothetical approval fixture: review complete + DB media ready. */
const APPROVED_REVIEW = { status: 'complete', detail: 'Hypothetical approval fixture — not a real signoff.' };
const approvedSubjectFor = (movementId) => ({
  movement_id: movementId,
  name: rawEntryFor(movementId).name,
  media: { assetKey: rawEntryFor(movementId).assetKey, status: 'ready', revision: 1, fallbackUrl: null },
});
const unapprovedSubjectFor = (movementId) => ({
  movement_id: movementId,
  name: rawEntryFor(movementId).name,
  media: { assetKey: rawEntryFor(movementId).assetKey, status: 'external_fallback', revision: 1, fallbackUrl: null },
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

// ── A. the fail-closed approval boundary ─────────────────────────────────────

describe('fail-closed approval boundary (A)', () => {
  test('the manifest still reports the qualified review as pending', () => {
    expect(PREVIEW_TECHNIQUE_REVIEW.status).toBe('pending');
  });

  test('with the review pending, EVERY covered movement resolves to null — the three prototypes included', () => {
    for (const movementId of PROTOTYPE_COVERED) {
      // Even a subject carrying the covered entry's own asset key fails
      // closed while the review is pending.
      expect(resolveMovementPreview(unapprovedSubjectFor(movementId))).toBeNull();
    }
  });

  test('review complete but DB media not ready still fails closed (the DB contract gate)', () => {
    for (const movementId of PROTOTYPE_COVERED) {
      const subject = {
        ...unapprovedSubjectFor(movementId),
        media: { ...unapprovedSubjectFor(movementId).media, status: 'external_fallback' },
      };
      expect(resolveMovementPreview(subject, APPROVED_REVIEW)).toBeNull();
      expect(resolveMovementPreview({ ...subject, media: { ...subject.media, status: 'planned' } }, APPROVED_REVIEW)).toBeNull();
      expect(resolveMovementPreview({ ...subject, media: { ...subject.media, status: null } }, APPROVED_REVIEW)).toBeNull();
    }
  });

  test('DB media ready but the review pending still fails closed (the review-state gate)', () => {
    for (const movementId of PROTOTYPE_COVERED) {
      expect(resolveMovementPreview(approvedSubjectFor(movementId))).toBeNull();
    }
  });

  test('review complete + media ready but identities disagree fails closed (the identity gate)', () => {
    for (const movementId of PROTOTYPE_COVERED) {
      expect(resolveMovementPreview({
        ...approvedSubjectFor(movementId),
        media: { ...approvedSubjectFor(movementId).media, assetKey: 'movement/goblet-squat/demo/v1' },
      }, APPROVED_REVIEW)).toBeNull();
    }
  });

  test('the fully approved fixture (review complete + media ready + keys agree) resolves — the positive path is not vacuous', () => {
    for (const movementId of PROTOTYPE_COVERED) {
      const resolved = resolveMovementPreview(approvedSubjectFor(movementId), APPROVED_REVIEW);
      expect(resolved).not.toBeNull();
      expect(resolved.movementId).toBe(movementId);
      expect(resolved.status).toBe('covered');
    }
  });

  test('the component renders NOTHING for a covered-but-unapproved prototype (end to end, no mocks)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const utils = render(<MovementPreview movement={unapprovedSubjectFor(28)} />);
    await act(async () => {});
    expect(utils.toJSON()).toBeNull();
    expect(screen.queryByTestId('movement-preview-figure')).toBeNull();
  });

  test('the positive path exists at the resolver seam, while the component athlete path stays closed', () => {
    // The approved fixture resolves through the REAL gate logic when every
    // condition is met — this is exactly the shape of an approved movement.
    const resolved = resolveMovementPreview(approvedSubjectFor(16), APPROVED_REVIEW);
    expect(resolved).not.toBeNull();
    expect(resolved.frames).toHaveLength(3);
    // The component always consults the manifest's OWN review state, so the
    // athlete-facing render stays closed until a qualified signoff flips it.
    expect(resolveMovementPreview(approvedSubjectFor(16))).toBeNull();
  });
});

// ── B. the structurally valid approval path ──────────────────────────────────

describe('approval-path metadata (B)', () => {
  test('each authored canonical entry carries previewId, summary and per-frame ids', () => {
    for (const movementId of CANONICAL_AUTHORED) {
      const entry = rawEntryFor(movementId);
      expect(entry.status).toBe('pending');
      expect(typeof entry.previewId).toBe('string');
      expect(entry.previewId.length).toBeGreaterThan(3);
      expect(typeof entry.summary).toBe('string');
      expect(entry.summary.length).toBeGreaterThan(20);
      // The adversarial gate requires >= 5 keyframes; arc-sampled re-authoring
      // (O-1/O-2/O-8/O-5) legitimately carries more.
      expect(entry.frames.length).toBeGreaterThanOrEqual(5);
      const ids = entry.frames.map((frame) => frame.id);
      for (const id of ids) expect(typeof id).toBe('string');
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('generated family entries match the compact source projection', () => {
    const sourceById = new Map(previewManifest.entries.map((entry) => [entry.movementId, entry]));
    expect(shippedEntries).toHaveLength(sourceById.size);
    for (const shipped of shippedEntries) {
      const source = sourceById.get(shipped.movementId);
      if (source === undefined) throw new Error(`preview source missing for ${shipped.movementId}`);
      const projected = { ...source };
      const covered = Array.isArray(source.frames) && source.frames.length > 0
        && source.previewId !== undefined && source.summary !== undefined;
      if (covered) {
        delete projected.coachingIntent;
        expect(shipped).not.toHaveProperty('coachingIntent');
        if (source.derivesFrom === undefined) {
          delete projected.instructions;
          delete projected.cues;
          expect(shipped).not.toHaveProperty('instructions');
          expect(shipped).not.toHaveProperty('cues');
        } else {
          expect(shipped.instructions).toBe(source.instructions);
          expect(shipped.cues).toBe(source.cues);
        }
        expect(shipped.reason).toBe(source.reason);
        expect(shipped.summary).toBe(source.summary);
        expect(shipped.previewId).toBe(source.previewId);
        expect(shipped.frames).toEqual(source.frames);
      }
      expect(JSON.stringify(shipped)).toBe(JSON.stringify(projected));
    }
  });

  test('previewIds are unique across every manifest entry', () => {
    const ids = RAW_MANIFEST.entries.map((entry) => entry.previewId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(CANONICAL_AUTHORED)(
    'movement %d: flipping ONLY the status to covered parses through the real boundary (fixture, not the live manifest)',
    (movementId) => {
      const raw = rawEntryFor(movementId);
      const fixture = { ...raw, status: 'covered' };
      const parsed = buildPreviewEntry(fixture);
      expect(parsed.status).toBe('covered');
      expect(parsed.previewId).toBe(raw.previewId);
      expect(parsed.summary).toBe(raw.summary);
      expect(parsed.frameData.rig).toBe('canonical');
      expect(parsed.frameData.view).toBe(raw.view);
      expect(parsed.frameData.viewBox).toEqual(raw.viewBox);
      expect(parsed.frames).toHaveLength(raw.frames.length);
      expect(parsed.frames.length).toBeGreaterThanOrEqual(5);
      expect(new Set(parsed.frames.map((frame) => frame.id)).size).toBe(parsed.frames.length);
      // The LIVE manifest still holds the movement pending.
      expect(rawEntryFor(movementId).status).toBe('pending');
      expect(entryFor(movementId).status).toBe('pending');
    },
  );

  test('every real movement in the manifest stays pending (nothing was approved)', () => {
    const pending = RAW_MANIFEST.entries
      .filter((entry) => entry.movementId !== 28 && entry.movementId !== 16 && entry.movementId !== 88)
      .filter((entry) => entry.status === 'pending');
    expect(pending.map((entry) => entry.movementId).sort((a, b) => a - b))
      .toEqual([...CANONICAL_AUTHORED, ...DERIVED_DRAFTS].sort((a, b) => a - b));   // 29 is in CANONICAL_AUTHORED since family 34
    expect(RAW_MANIFEST.techniqueReview.status).toBe('pending');
  });
});
