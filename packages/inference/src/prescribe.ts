/**
 * prescribe.ts — the single prescription entry point for the UI layer.
 *
 * Synchronous and infallible: the deterministic policy is the sole numeric
 * authority. `source` survives in the type so the UI badge can distinguish
 * a plain policy prescription from one refined by a subjective-report
 * guardrail (semantic/triage.ts).
 */
import { evaluatePolicy } from './policyReference';
import type { AdjustmentVector } from './outputSchema';
import type { StateVectorRow } from './types';

export type AdjustmentSource = 'policy' | 'profile' | 'guardrail';

export interface Prescription {
  vector: AdjustmentVector;
  source: AdjustmentSource;
}

export function getPrescription(row: StateVectorRow): Prescription {
  return { vector: evaluatePolicy(row), source: 'policy' };
}
