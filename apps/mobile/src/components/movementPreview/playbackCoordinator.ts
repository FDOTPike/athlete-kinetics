/**
 * playbackCoordinator.ts — at most ONE movement preview may animate at a time,
 * anywhere in the app.
 *
 * Previews are cheap, but several looping at once is both a battery cost and a
 * visual mess, and WO-09 rules it out explicitly. The rule is enforced here
 * rather than in the screens: whoever starts playing hands over a `stop`
 * callback, and the previous player is stopped before the new one runs.
 *
 * Module state, deliberately: it is the only scope that spans two sibling
 * components that know nothing about each other.
 */
type StopPlayback = () => void;

let current: StopPlayback | null = null;

/** Start playing: stops whichever preview was playing before. */
export function claimPreviewPlayback(stop: StopPlayback): void {
  if (current !== null && current !== stop) {
    try {
      current();
    } catch {
      // Prevent errors in the superseded player from blocking the new claim
    }
  }
  current = stop;
}

/** Stop playing. A late release from an already-superseded player is ignored. */
export function releasePreviewPlayback(stop: StopPlayback): void {
  if (current === stop) current = null;
}

/** Test seam: forget any claim without stopping anything. */
export function resetPreviewPlayback(): void {
  current = null;
}

/** Inspect whether any preview is currently animating app-wide. */
export function isPlaybackActive(): boolean {
  return current !== null;
}
