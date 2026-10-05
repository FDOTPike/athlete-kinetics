import type { DifficultyRating, TrainingAge } from './types';

export type MovementAccessContext = 'library' | 'weight_room' | 'sport_conditioning';
export type ExecutableMovementAccessContext = 'weight_room' | 'sport_conditioning';

/** Library rows are advisory: sport-tracking records explain sport access,
 * while every other row explains weight-room access. Executable routes must
 * provide their real context directly. */
export function effectiveMovementAccessContext(
  accessContext: MovementAccessContext,
  sportTracking: boolean,
): ExecutableMovementAccessContext {
  if (accessContext === 'library') {
    return sportTracking ? 'sport_conditioning' : 'weight_room';
  }
  return accessContext;
}

/**
 * One progressive difficulty ceiling for every movement-selection route.
 * Undefined difficulty remains eligible solely for legacy callers that predate
 * movement_detail; every persisted library row has an authored difficulty.
 */
export function isDifficultyAllowed(
  trainingAge: TrainingAge,
  difficulty: DifficultyRating | undefined,
  beginnerOk: boolean,
  accessContext: MovementAccessContext,
  sportTracking: boolean,
): boolean {
  const effectiveContext = effectiveMovementAccessContext(accessContext, sportTracking);
  if (sportTracking || effectiveContext === 'sport_conditioning') return true;
  if (difficulty === undefined) return true;
  if (trainingAge === 'beginner') {
    return difficulty === 'Beginner'
      || (difficulty === 'Intermediate' && beginnerOk);
  }
  if (trainingAge === 'intermediate') return difficulty !== 'Advanced';
  return true;
}
