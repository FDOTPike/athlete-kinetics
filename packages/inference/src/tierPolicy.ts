import type { DifficultyRating, TrainingAge } from './types';

/**
 * One progressive difficulty ceiling for every movement-selection route.
 * Undefined difficulty remains eligible solely for legacy callers that predate
 * movement_detail; every persisted library row has an authored difficulty.
 */
export function isDifficultyAllowed(
  trainingAge: TrainingAge,
  difficulty: DifficultyRating | undefined,
  beginnerOk = false,
): boolean {
  if (difficulty === undefined) return true;
  if (trainingAge === 'beginner') {
    return difficulty === 'Beginner'
      || (difficulty === 'Intermediate' && beginnerOk);
  }
  if (trainingAge === 'intermediate') return difficulty !== 'Advanced';
  return true;
}
