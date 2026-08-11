# Coach Verification Lab boundary

Status: implemented for pre-release visual acceptance; public release remains unauthorized.

## Product boundary

- The main `COACH` tab remains visible because it is the normal athlete-facing program and session-planning surface.
- Multi-athlete database management and the Coach Verification Lab are hidden by default.
- Seven taps on `BUILD 0.1.0` in `ATHLETE` unlock those advanced surfaces on the local device. The setting persists in `coach_athletes.json`, applies across athlete switches, and can be explicitly relocked.
- The gesture is a discoverability mechanism, not authentication. It does not grant filesystem, account, network, or release authority.

## No-write law

The Lab accepts plain snapshot values and invokes only pure production inference functions. A run cannot receive or call a database/store mutator. It may read:

- the selected athlete's profile and current materialized state vector;
- the movement-library projection and current availability verdicts;
- exact read-only session/frequency counts used by profile clamps;
- bounded measured-history rollups for the 14/30/90-day evidence summary.

It must not write a profile, plan, prescription, block, session, set, outcome, readiness row, movement, or history record. Real data entry remains in the ordinary athlete screens.

## Scenario coverage

One explicit `RUN ALL CHECKS` action executes these production engines in memory:

1. daily prescription policy plus profile clamps;
2. LINEAR, WAVE, STEP, and APRE four-week previews;
3. kinematic deficit/headroom detection and bounded control projection;
4. seeded/history/derived/manual load precedence, including manual bodyweight added-load `0.0`;
5. shared tier/equipment movement availability;
6. guided-session reducer plus exact-dose outcome classification.

The evidence panel reports coverage and training aggregates for 14, 30, and 90 days. Missing measurements remain missing.

## Sharing and privacy

The share action serializes a redacted report. It omits athlete names, free text, database/file identifiers, raw evidence rows, raw per-day dates, and raw health readings. The export contains engine results and aggregate evidence coverage only.

## Release boundary

This feature authorizes local debug APK/device acceptance only. It does not authorize release signing, Play Console upload, staged rollout, or public distribution.
