/**
 * In-memory Coach Verification Lab.
 *
 * Every scenario calls the same pure inference functions used by production.
 * No database/store mutator is accepted here, so a diagnostic run cannot
 * alter an athlete profile, plan, session, history, or readiness evidence.
 */
import {
  MOVEMENT_PATTERNS,
  SCHEMA_TYPES,
  advance,
  deriveControlAction,
  deriveDailyAdjustment,
  derivePrescription,
  detectFlaws,
  evaluateSessionOutcome,
  generateBlock,
  resolveLoadSelection,
  resolveMovementAvailability,
  startRunner,
  type GeneratorMovement,
  type MovementPattern,
  type PatternDailyDelta,
  type StateVectorRow,
  type UserProfile,
} from '@ak/inference';

export interface DiagnosticMovement extends GeneratorMovement {
  readonly beginner_ok: boolean;
}

export interface DiagnosticEvidencePoint {
  readonly date: string;
  readonly tonnageKg: number;
  readonly setCount: number;
  readonly bodyweightKg: number | null;
  readonly hrvRmssdMs: number | null;
  readonly restingHr: number | null;
  readonly sleepMinutes: number | null;
}

export interface CoachVerificationInput {
  readonly profile: UserProfile;
  readonly vector: StateVectorRow | null;
  readonly movements: readonly DiagnosticMovement[];
  readonly evidence: readonly DiagnosticEvidencePoint[];
  readonly today: string;
  /** Adapter-supplied time keeps the engine and report deterministic. */
  readonly generatedAtMs: number;
  readonly profileContext: {
    readonly sessionsToday: number;
    readonly trainedDaysLast7: number;
  };
}

export interface LabModuleResult {
  readonly id: 'prescription' | 'schemas' | 'adaptation' | 'load_selection' | 'routing' | 'session';
  readonly title: string;
  readonly status: 'pass' | 'attention';
  readonly summary: string;
  readonly details: readonly string[];
}

export interface EvidenceWindowSummary {
  readonly days: 14 | 30 | 90;
  readonly sampleDays: number;
  readonly trainingDays: number;
  readonly setCount: number;
  readonly tonnageKg: number;
  readonly bodyweightDays: number;
  readonly hrvDays: number;
  readonly sleepDays: number;
}

export interface CoachVerificationReport {
  readonly version: 1;
  readonly generatedAtMs: number;
  readonly today: string;
  readonly modules: readonly LabModuleResult[];
  readonly evidence: readonly EvidenceWindowSummary[];
  readonly passed: number;
  readonly attention: number;
}

const fallbackVector = (today: string, generatedAtMs: number): StateVectorRow => ({
  date: today,
  readiness_score: 70,
  hrv_component: 0,
  load_component: 0,
  sleep_component: 0,
  spo2_component: 0,
  acwr: null,
  acute_load_kg: null,
  chronic_load_kg: null,
  ln_rmssd: null,
  hrv_z: null,
  sleep_efficiency_pct: null,
  spo2_night_mean: null,
  computed_at_ms: generatedAtMs,
});

const isoDay = (iso: string, offset: number): string => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const result = (
  id: LabModuleResult['id'],
  title: string,
  status: LabModuleResult['status'],
  summary: string,
  details: readonly string[],
): LabModuleResult => ({ id, title, status, summary, details });

const attention = (
  id: LabModuleResult['id'],
  title: string,
  error: unknown,
): LabModuleResult => result(
  id,
  title,
  'attention',
  'The production engine refused this diagnostic input.',
  [error instanceof Error ? error.message : String(error)],
);

function prescriptionScenario(input: CoachVerificationInput): LabModuleResult {
  try {
    const derived = derivePrescription({
      vector: input.vector ?? fallbackVector(input.today, input.generatedAtMs),
      profile: input.profile,
      ctx: input.profileContext,
      reports: [],
    });
    const finite = Number.isFinite(derived.vector.load_modifier)
      && Number.isFinite(derived.vector.set_modifier)
      && Number.isFinite(derived.vector.rpe_cap);
    return result(
      'prescription',
      'Daily prescription',
      finite ? 'pass' : 'attention',
      finite ? 'Policy and profile clamps produced a bounded prescription.' : 'A non-finite prescription value was produced.',
      [
        `Source: ${derived.source}`,
        `Load x${derived.vector.load_modifier.toFixed(2)} · sets ${derived.vector.set_modifier >= 0 ? '+' : ''}${derived.vector.set_modifier} · RPE cap ${derived.vector.rpe_cap.toFixed(1)}`,
        input.vector === null ? 'Used the documented neutral diagnostic vector; no readiness row exists today.' : 'Used today\'s materialized readiness vector.',
      ],
    );
  } catch (error) {
    return attention('prescription', 'Daily prescription', error);
  }
}

function schemaScenario(input: CoachVerificationInput): LabModuleResult {
  try {
    const plans = SCHEMA_TYPES.map((schemaType) => generateBlock({
      profile: input.profile,
      movements: input.movements,
      startDate: input.today,
      schemaType,
      macroBlockIndex: 1,
      recentAcwr: input.vector?.acwr ?? null,
    }));
    const valid = plans.every((plan) => plan.weeks === 4 && plan.sessions.length > 0);
    return result(
      'schemas',
      'Four training styles',
      valid ? 'pass' : 'attention',
      valid ? 'LINEAR, WAVE, STEP, and APRE each generated a complete four-week preview.' : 'At least one style could not produce a usable preview.',
      plans.map((plan) => `${plan.schemaType}: ${plan.sessions.length} sessions · ${plan.sessions.reduce((n, session) => n + session.slots.length, 0)} slots · ${plan.warnings.length} warnings`),
    );
  } catch (error) {
    return attention('schemas', 'Four training styles', error);
  }
}

function adaptationScenario(input: CoachVerificationInput): LabModuleResult {
  try {
    const days = 7;
    const vectors = Array.from({ length: days }, (_, index) => ({
      ...(input.vector ?? fallbackVector(input.today, input.generatedAtMs)),
      date: isoDay(input.today, index - (days - 1)),
    }));
    const deltas = Object.fromEntries(MOVEMENT_PATTERNS.map((pattern) => {
      const delta = pattern === 'squat' ? 2 : pattern === 'hinge' ? -2 : null;
      const row: PatternDailyDelta = {
        avgDeltaRPE: Array.from({ length: days }, () => delta),
        avgAttenuation: Array.from({ length: days }, () => delta === null ? 0 : 1),
        setCount: Array.from({ length: days }, () => delta === null ? 0 : 3),
        maxJointSev: Array.from({ length: days }, () => 0),
      };
      return [pattern, row];
    })) as Record<MovementPattern, PatternDailyDelta>;
    const flaws = detectFlaws(vectors, deltas, input.profile.training_age);
    const action = deriveControlAction(flaws, input.profile, 'gpp', 1);
    const daily = deriveDailyAdjustment(action, ['squat', 'hinge'], input.profile);
    const squat = action.corrections.squat;
    const hinge = action.corrections.hinge;
    const bounded = squat.dLoad_p <= 1 && squat.dSet_p <= 0
      && hinge.dLoad_p >= 1 && hinge.dSet_p >= 0
      && daily.rpe_cap <= input.profile.base_rpe_cap;
    return result(
      'adaptation',
      'Adaptive coaching',
      bounded ? 'pass' : 'attention',
      bounded ? 'Deficit and headroom signals produced bounded, directionally correct changes.' : 'An adaptive change crossed its expected authority boundary.',
      [
        `Squat deficit: load x${squat.dLoad_p.toFixed(2)}, sets ${squat.dSet_p}, RPE ${squat.dRpe_p}`,
        `Hinge headroom: load x${hinge.dLoad_p.toFixed(2)}, sets +${hinge.dSet_p}, RPE +${hinge.dRpe_p}`,
        `Combined day remains capped at RPE ${daily.rpe_cap.toFixed(1)}.`,
      ],
    );
  } catch (error) {
    return attention('adaptation', 'Adaptive coaching', error);
  }
}

function loadSelectionScenario(): LabModuleResult {
  try {
    const common = {
      bodyweightMode: false,
      targetReps: 5,
      targetRpe: 8,
      oneRepMaxKg: 120,
      overrideLoadKg: 95,
      lastLoggedLoadKg: 80,
      currentSessionLoadKg: null,
      isFirstSet: true,
    } as const;
    const beginner = resolveLoadSelection({ ...common, trainingAge: 'beginner', preference: 'auto' });
    const automatic = resolveLoadSelection({ ...common, trainingAge: 'advanced', preference: 'auto' });
    const manual = resolveLoadSelection({ ...common, trainingAge: 'advanced', preference: 'manual' });
    const bodyweight = resolveLoadSelection({
      ...common,
      trainingAge: 'advanced',
      preference: 'manual',
      bodyweightMode: true,
      targetReps: null,
      oneRepMaxKg: null,
      overrideLoadKg: null,
      lastLoggedLoadKg: null,
    });
    const valid = beginner.source === 'history'
      && automatic.source === 'derived'
      && manual.source === 'manual' && manual.initialLoadKg === null
      && bodyweight.source === 'manual' && bodyweight.initialLoadKg === 0;
    return result(
      'load_selection',
      'Four-mode load selection',
      valid ? 'pass' : 'attention',
      valid ? 'Seed/history, derived, manual, and bodyweight-zero laws resolved as designed.' : 'One load-source precedence result differed from the ratified contract.',
      [
        `Beginner with history: ${beginner.source} ${beginner.initialLoadKg ?? '—'} kg`,
        `Advanced automatic with APRE target: ${automatic.source} ${automatic.initialLoadKg ?? '—'} kg`,
        `Advanced manual: blank entry, ${manual.advisoryKind ?? 'no'} advisory`,
        `Manual bodyweight added load starts at ${bodyweight.initialLoadKg?.toFixed(1) ?? '—'} kg`,
      ],
    );
  } catch (error) {
    return attention('load_selection', 'Four-mode load selection', error);
  }
}

function routingScenario(input: CoachVerificationInput): LabModuleResult {
  try {
    const verdicts = resolveMovementAvailability({
      movements: input.movements.map((movement) => ({
        movementId: movement.movement_id,
        difficulty: movement.difficulty ?? 'Intermediate',
        beginnerOk: movement.beginner_ok,
        requiredEquipment: movement.required,
      })),
      edges: [],
      evidence: [],
      attestedEdgeKeys: new Set<string>(),
      trainingAge: input.profile.training_age,
      equipment: new Set(input.profile.equipment_inventory),
      safetyExcludedMovementIds: new Set<number>(),
    });
    const available = verdicts.filter((item) => item.state === 'available').length;
    const tier = verdicts.filter((item) => item.reasons.includes('tier')).length;
    const equipment = verdicts.filter((item) => item.reasons.includes('equipment')).length;
    const valid = verdicts.length === input.movements.length && available > 0;
    return result(
      'routing',
      'Movement routing',
      valid ? 'pass' : 'attention',
      valid ? 'The shared tier/equipment predicate classified the current library.' : 'The movement router returned incomplete or unusable coverage.',
      [
        `${available}/${verdicts.length} movements executable for this profile`,
        `${tier} teaching-only by tier · ${equipment} teaching-only by equipment`,
        'Progression/capability edges remain enforced by the live store projection; this sandbox adds none.',
      ],
    );
  } catch (error) {
    return attention('routing', 'Movement routing', error);
  }
}

function sessionScenario(input: CoachVerificationInput): LabModuleResult {
  try {
    const slot = {
      sessionPlanSlotId: 1,
      movementId: 1,
      movementName: 'Diagnostic movement',
      sets: 1,
      target: { kind: 'reps' as const, reps: 5 },
      targetRpe: 8,
    };
    let runner = startRunner([slot], { tier: input.profile.training_age, startedAtMs: input.generatedAtMs });
    runner = advance(runner, { kind: 'LOG_SET', actualRpe: 8, atMs: input.generatedAtMs + 1 });
    if (runner.phase === 'resting') {
      runner = advance(runner, { kind: 'SKIP_REST', atMs: input.generatedAtMs + 2 });
    }
    const decision = evaluateSessionOutcome({
      originKind: 'planned',
      terminal: { phase: 'complete', haltReason: null },
      slots: [{ sessionPlanSlotId: 1, plannedSets: 1, provenanceKind: 'planned' }],
      sets: [{
        setId: 1,
        sessionPlanSlotId: 1,
        provenanceKind: 'planned',
        prescribedDose: slot.target,
        actualDose: slot.target,
      }],
      skippedSessionPlanSlotIds: runner.skippedSessionPlanSlotIds,
      finalizedAtMs: input.generatedAtMs + 3,
    });
    const valid = runner.phase === 'complete' && decision?.kind === 'followed_plan';
    return result(
      'session',
      'Session lifecycle and outcome',
      valid ? 'pass' : 'attention',
      valid ? 'The production runner completed and the outcome engine classified exact work.' : 'The runner or outcome classification differed from the exact-plan scenario.',
      [
        `Runner phase: ${runner.phase}`,
        `Outcome: ${decision?.kind ?? 'none'}`,
        `Exact dose: ${decision?.evidence.exactDoseCount ?? 0}/${decision?.evidence.loggedSetCount ?? 0}`,
      ],
    );
  } catch (error) {
    return attention('session', 'Session lifecycle and outcome', error);
  }
}

function evidenceWindow(
  points: readonly DiagnosticEvidencePoint[],
  today: string,
  days: 14 | 30 | 90,
): EvidenceWindowSummary {
  const first = isoDay(today, -(days - 1));
  const rows = points.filter((point) => point.date >= first && point.date <= today);
  return {
    days,
    sampleDays: rows.length,
    trainingDays: rows.filter((point) => point.setCount > 0).length,
    setCount: rows.reduce((sum, point) => sum + point.setCount, 0),
    tonnageKg: Math.round(rows.reduce((sum, point) => sum + point.tonnageKg, 0) * 10) / 10,
    bodyweightDays: rows.filter((point) => point.bodyweightKg !== null).length,
    hrvDays: rows.filter((point) => point.hrvRmssdMs !== null || point.restingHr !== null).length,
    sleepDays: rows.filter((point) => point.sleepMinutes !== null).length,
  };
}

export function runCoachVerificationLab(input: CoachVerificationInput): CoachVerificationReport {
  const modules = [
    prescriptionScenario(input),
    schemaScenario(input),
    adaptationScenario(input),
    loadSelectionScenario(),
    routingScenario(input),
    sessionScenario(input),
  ];
  return {
    version: 1,
    generatedAtMs: input.generatedAtMs,
    today: input.today,
    modules,
    evidence: ([14, 30, 90] as const).map((days) => evidenceWindow(input.evidence, input.today, days)),
    passed: modules.filter((module) => module.status === 'pass').length,
    attention: modules.filter((module) => module.status === 'attention').length,
  };
}

/** Share-safe by construction: no athlete name, free text, database/file name,
 * raw evidence rows, or per-day health values enter this export. */
export function serializeRedactedCoachReport(report: CoachVerificationReport): string {
  return JSON.stringify({
    report: 'pikeMethods Coach Verification Lab',
    version: report.version,
    generatedAtMs: report.generatedAtMs,
    today: report.today,
    passed: report.passed,
    attention: report.attention,
    modules: report.modules,
    evidenceCoverage: report.evidence,
    redaction: 'Names, free text, database identifiers, raw dates, and raw health readings omitted.',
  }, null, 2);
}
