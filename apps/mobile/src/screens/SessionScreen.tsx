/** Phase 17 utility-first active-session surface. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isDifficultyAllowed, JOINTS, nextUp as nextRunnerWork } from '@ak/inference';
import { formatTeachingOnlyReason, useStore, type LoadSelection, type LoggedSet, type Movement, type PlanSlot, type SetMetricPatch, type SlotTarget } from '../state/useStore';
import { useSubViewBack } from '../navigation/navigation';
import { theme } from '../theme/theme';
import {
  PrimaryButton,
  SecondaryButton,
  ListRow,
  Disclosure,
  Chip,
  Stepper,
  RestTimerCard,
} from '../components/ui';

type SessionMode = 'guided' | 'self_directed';
interface LocalRest { startedAtMs: number; seconds: number; slotId: number; }
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const secondsText = (n: number): string => {
  const value = Math.max(0, Math.round(n));
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${value}s`;
};

/** Strict load-draft parsing (Sol audit correction 1): decimal notation only,
 *  dot or comma separator; rejects trailing garbage, hex, NaN/Infinity text,
 *  and negatives. An empty/whitespace draft is ABSENT evidence (null), which
 *  is never coerced to zero. The literal "0" is a valid explicit zero. */
const LOAD_DRAFT_RE = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const parseLoadDraft = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!LOAD_DRAFT_RE.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** P1-2 (Opus audit): a loggable load must sit on the 2.5 kg rack grid and be
 *  within 0–500 inclusive. Reject — never silently snap — any draft that
 *  would change numerically at commit time. */
const LOAD_GRID = 2.5;
const LOAD_MAX = 500;
const isOnLoadGrid = (kg: number): boolean =>
  Number.isFinite(kg) && kg >= 0 && kg <= LOAD_MAX
  && Math.abs(kg / LOAD_GRID - Math.round(kg / LOAD_GRID)) < 1e-9;

/** True when the draft holds a loggable value (explicit zero included).
 *  Syntax + grid + range must all pass. */
const isLoadDraftLoggable = (text: string): boolean => {
  const parsed = parseLoadDraft(text);
  return parsed !== null && isOnLoadGrid(parsed);
};

/** Athlete-facing source/advisory copy for the load field (Kimi spec §1a, Sol
 *  audit corrections 3–6). The effective source comes from the pure resolver;
 *  this maps it to reviewed copy. An edited value keeps its source — there is
 *  no fifth "athlete-entered" source. */
const loadSourceCopy = (
  sel: LoadSelection,
  bodyweightMode: boolean,
  oneRmKg: number | undefined,
  timedTarget: boolean,
): string => {
  if (sel.source === 'manual') {
    switch (sel.advisoryKind) {
      case 'apre': return `Coach suggests ${sel.advisoryKg?.toFixed(1)} kg — your entry stands.`;
      case 'onerm': return `Coach suggests ${sel.advisoryKg?.toFixed(1)} kg from your ${oneRmKg?.toFixed(1)} kg 1RM — your entry stands.`;
      case 'history': return `Coach suggests ${sel.advisoryKg?.toFixed(1)} kg from your last session — your entry stands.`;
      default: return 'Your call. The number you enter is what gets logged.';
    }
  }
  if (sel.source === 'history') {
    return bodyweightMode
      ? `Last logged ${sel.initialLoadKg?.toFixed(1)} kg added load`
      : `Last logged ${sel.initialLoadKg?.toFixed(1)} kg`;
  }
  // seeded
  return bodyweightMode
    ? '0 kg means bodyweight only. Add weight when you need it.'
    : timedTarget
      ? 'First time on this one — choose a load you can control for the full interval.'
      : 'First time on this one — pick a weight you could lift about ten times.';
};

/** Derived-source copy must distinguish APRE prescription from 1RM
 *  derivation; the resolver's source alone does not carry that. */
const loadCopyFor = (
  sel: LoadSelection,
  bodyweightMode: boolean,
  oneRmKg: number | undefined,
  apreOverrideKg: number | null,
  timedTarget: boolean,
): string => {
  if (sel.source === 'derived') {
    const hasValidApre = apreOverrideKg !== null
      && Number.isFinite(apreOverrideKg)
      && apreOverrideKg >= 0;
    return hasValidApre
      ? bodyweightMode
        ? `Prescribed ${apreOverrideKg.toFixed(1)} kg added load`
        : `Prescribed ${apreOverrideKg.toFixed(1)} kg`
      : `Based on your ${oneRmKg?.toFixed(1)} kg 1RM`;
  }
  return loadSourceCopy(sel, bodyweightMode, oneRmKg, timedTarget);
};

const restSecondsFor = (rpe: number, age: string | undefined): number => {
  const base = rpe >= 9 ? 240 : rpe >= 8 ? 180 : rpe >= 7 ? 120 : 90;
  const multiplier = age === 'beginner' ? 0.75 : age === 'elite' ? 1.25 : 1;
  return clamp(Math.round((base * multiplier) / 15) * 15, 45, 300);
};

const targetFor = (slot: PlanSlot): SlotTarget => {
  const target = (slot as Partial<PlanSlot>).target;
  if (target?.kind === 'time' && Number.isFinite(target.seconds)) return { kind: 'time', seconds: Math.max(1, Math.round(target.seconds)) };
  if (target?.kind === 'reps' && Number.isFinite(target.reps)) return { kind: 'reps', reps: Math.max(1, Math.round(target.reps)) };
  return { kind: 'reps', reps: Math.max(1, Math.round((slot as Partial<PlanSlot>).plannedReps ?? 5)) };
};

const targetText = (slot: PlanSlot): string => {
  const target = targetFor(slot);
  return target.kind === 'time' ? `${slot.plannedSets} × ${secondsText(target.seconds)}` : `${slot.plannedSets} × ${target.reps}`;
};

const lines = (text: string | null | undefined, max: number): string[] => {
  if (text === null || text === undefined || text.trim().length === 0) return [];
  const split = text.split(/\r?\n|•/g).map((x) => x.replace(/^[-–—\s]+/, '').trim()).filter(Boolean);
  return (split.length > 0 ? split : [text.trim()]).slice(0, max);
};

const sameSlot = (logged: { session_plan_slot_id: number | null; movement_id: number }, slot: PlanSlot): boolean =>
  logged.session_plan_slot_id != null ? logged.session_plan_slot_id === slot.sessionPlanSlotId : logged.movement_id === slot.movementId;

const formatFinalizedDate = (ms: number): string => {
  const date = new Date(ms);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const dayName = weekdays[date.getDay()];
  const monthName = months[date.getMonth()];
  return `${dayName} ${day} ${monthName}`;
};

function CompletedMetrics({
  sets,
  bandLadder,
  movementsById,
  onEdit,
}: {
  sets: readonly LoggedSet[];
  bandLadder: readonly { level: number; label: string }[];
  movementsById: ReadonlyMap<number, Movement>;
  onEdit: (setId: number, reps: number, loadKg: number, rpe: number | null, metrics?: SetMetricPatch) => void;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const metricSets = sets.filter((set) => set.timeS !== null || set.bandLevel !== null || (
    bandLadder.length > 0 && movementsById.get(set.movement_id)?.supportedPrefixes?.includes('Banded') === true
  ));
  if (metricSets.length === 0) return null;

  return (
    <View style={styles.loggedDetails}>
      <Disclosure
        label="Review logged details"
        open={open}
        onOpenChange={setOpen}
        accessibilityLabel={open ? "Review logged details, expanded" : "Review logged details, collapsed"}
      >
        <View style={styles.loggedDetailsBody}>
          {metricSets.map((set) => {
            const duration = set.timeS;
            const supportsBand = bandLadder.length > 0 && movementsById.get(set.movement_id)?.supportedPrefixes?.includes('Banded') === true;
            return (
              <View key={set.set_id} style={styles.loggedMetricRow}>
                <Text style={styles.loggedMetricTitle}>Set {set.set_index}</Text>
                {duration !== null && (
                  <View style={styles.metricAdjustRow}>
                    <Pressable
                      onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { timeS: Math.max(1, duration - 5) })}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease logged duration for set ${set.set_index}`}
                      style={({ pressed }) => [styles.metricAdjust, pressed && styles.pressed]}
                    >
                      <Text style={styles.metricAdjustText}>−5s</Text>
                    </Pressable>
                    <Text style={styles.metricValue}>{secondsText(duration)}</Text>
                    <Pressable
                      onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { timeS: duration + 5 })}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase logged duration for set ${set.set_index}`}
                      style={({ pressed }) => [styles.metricAdjust, pressed && styles.pressed]}
                    >
                      <Text style={styles.metricAdjustText}>+5s</Text>
                    </Pressable>
                  </View>
                )}
                {supportsBand && (
                  <View style={styles.loggedBandBlock}>
                    <Text style={styles.loggedBandLabel}>Band</Text>
                    <View style={styles.loggedBandChoices}>
                      {bandLadder.map((band) => {
                        const selected = set.bandLevel === band.level;
                        return (
                          <Chip
                            key={band.level}
                            label={band.label}
                            selected={selected}
                            onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { bandLevel: selected ? null : band.level })}
                            accessibilityLabel={`Set ${set.set_index} band ${band.label}`}
                            style={{ margin: theme.space[1] }}
                          />
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Disclosure>
    </View>
  );
}

function rowsOf<T>(res: unknown): T[] {
  const r = (res as { rows?: unknown }).rows;
  if (Array.isArray(r)) return r as T[];
  const arr = (r as { _array?: unknown } | undefined)?._array;
  return Array.isArray(arr) ? (arr as T[]) : [];
}

export default function SessionScreen(): React.JSX.Element {
  const state = useStore((s) => s);
  const {
    movements, session, sessionPlan, activeSessionPlanSlotId, profile, oneRepMaxes,
    lastTriage, substitution, startSession, selectMovementSlot, setMovementPreference,
    openSubstitution, closeSubstitution, applyRegression, applyDaySwap, reportNiggle,
    logSet, editSet, endSession, runner, sessionMode, uiPreferences, bandLadder,
    advanceRunnerRest, skipRunnerRest, setRunnerRestOverride, runnerThumbsDown, runnerHalt, lastEndedSessionId,
    loadSessionOutcome, dismissOutcome,
  } = state;

  const defaultMode: SessionMode = uiPreferences.sessionModeOverride ?? (profile.training_age === 'beginner' ? 'guided' : 'self_directed');
  const mode: SessionMode = sessionMode ?? defaultMode;
  const runnerPhase = runner?.phase ?? 'working';

  const getMovementAvailabilityVerdicts = state.getMovementAvailabilityVerdicts;
  const availabilityMap = useMemo(() => {
    const verdicts = getMovementAvailabilityVerdicts !== undefined ? getMovementAvailabilityVerdicts() : [];
    const map = new Map<number, (typeof verdicts)[number]>();
    for (const v of verdicts) map.set(v.movementId, v);
    return map;
  }, [getMovementAvailabilityVerdicts]);

  const [nowMs, setNowMs] = useState(Date.now());
  const [localRest, setLocalRest] = useState<LocalRest | null>(null);
  const [reps, setReps] = useState(5);
  const [seconds, setSeconds] = useState(30);
  // Load entry is a DRAFT STRING (WO four-mode load selection): "" is absent
  // evidence (blank), "0" is a valid explicit zero, and the two are never
  // conflated. Initialized from the resolver per set key; rerenders and
  // evidence refreshes must never overwrite an athlete-entered draft.
  const [loadText, setLoadText] = useState('');
  const [loadInvalid, setLoadInvalid] = useState(false);
  const [rpe, setRpe] = useState(8);
  const [rpeTouched, setRpeTouched] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [niggleRegion, setNiggleRegion] = useState<string | null>(null);
  const [niggleSeverity, setNiggleSeverity] = useState(4);
  const [bandLevel, setBandLevel] = useState<number | null>(null);
  const advancedRest = useRef<string | null>(null);

  const hasSubView = detailsOpen || safetyOpen || niggleRegion !== null || substitution !== null;
  useSubViewBack(hasSubView, () => {
    if (detailsOpen) setDetailsOpen(false);
    else if (safetyOpen) setSafetyOpen(false);
    else if (niggleRegion !== null) setNiggleRegion(null);
    else if (substitution !== null) closeSubstitution();
  });

  // Outcome details derived from store outcome data
  const outcome = useMemo(() => {
    if (lastEndedSessionId == null) return null;
    const dbOutcome = loadSessionOutcome(lastEndedSessionId);
    if (dbOutcome) {
      return {
        kind: dbOutcome.outcomeKind,
        dateStr: `Session saved · ${formatFinalizedDate(dbOutcome.finalizedAtMs)}`,
      };
    }
    return {
      kind: 'session_recorded',
      dateStr: 'Session saved',
    };
  }, [lastEndedSessionId, loadSessionOutcome]);

  const byId = useMemo(() => new Map(movements.map((m) => [m.movement_id, m])), [movements]);
  const loggedCount = (slot: PlanSlot): number => session?.sets.filter((set) => sameSlot(set, slot)).length ?? 0;
  const runnerCurrent = runner?.slots?.[runner.slotIndex ?? -1];
  const runnerCurrentId = runnerCurrent?.sessionPlanSlotId ?? null;
  const selected = activeSessionPlanSlotId === null ? null : sessionPlan.find((slot) => slot.sessionPlanSlotId === activeSessionPlanSlotId) ?? null;
  const firstIncomplete = sessionPlan.find((slot) => loggedCount(slot) < slot.plannedSets) ?? null;
  const fallback = selected !== null && loggedCount(selected) < selected.plannedSets ? selected : firstIncomplete;
  const currentSlot = runnerCurrentId !== null ? sessionPlan.find((slot) => slot.sessionPlanSlotId === runnerCurrentId) ?? fallback : fallback;
  const currentMovement: Movement | null = currentSlot === null ? null : byId.get(runnerCurrent?.movementId ?? currentSlot.movementId) ?? byId.get(currentSlot.movementId) ?? null;
  const currentLogged = currentSlot === null ? 0 : loggedCount(currentSlot);
  const allDone = sessionPlan.length > 0 && sessionPlan.every((slot) => loggedCount(slot) >= slot.plannedSets);
  const triageHalted = lastTriage?.kind === 'matched' && lastTriage.directive.halt;
  const runnerComplete = runnerPhase === 'complete';
  const halted = runnerPhase === 'halted' || (!runnerComplete && triageHalted);
  const complete = !halted && sessionPlan.length > 0 && (runnerComplete || allDone);
  const target = currentSlot === null ? null : targetFor(currentSlot);
  const oneRm = currentSlot === null ? undefined : oneRepMaxes[currentSlot.movementId];
  // P2-2 (Opus audit): bodyweightMode is true ONLY when the canonical first
  // supported prefix is exactly 'Bodyweight'. An absent, empty, unparseable,
  // or non-canonical prefix list is NOT bodyweight evidence — it fails toward
  // external-load safety behavior (blank first exposure, disabled LOG SET).
  const primaryImplement = currentMovement?.supportedPrefixes[0];
  const bodyweightMode = primaryImplement === 'Bodyweight';
  const loadLabel = bodyweightMode ? 'Added kg (0 = bodyweight)' : 'Load kg';
  // P2-4 (Opus audit): one stable target-RPE value for load resolution —
  // the slot target when present, a fixed fallback when absent. Used by both
  // the display resolver call and the one-time draft initializer so they
  // never diverge. Mutable Actual RPE is completion evidence and must not
  // recalculate source/advisory copy or rewrite load draft state.
  const stableTargetRpe = currentSlot?.targetRpe ?? 8;
  const loadSelection: LoadSelection | null = currentSlot === null || target === null
    ? null
    : state.resolveSlotLoad({
        movementId: currentSlot.movementId,
        bodyweightMode,
        targetReps: target.kind === 'reps' ? target.reps : null,
        targetRpe: stableTargetRpe,
        overrideLoadKg: currentSlot.overrideLoadKg,
        sessionPlanSlotId: currentSlot.sessionPlanSlotId,
      });
  const loadEvidence = loadSelection === null
    ? ''
    : loadCopyFor(
        loadSelection,
        bodyweightMode,
        oneRm,
        currentSlot?.overrideLoadKg ?? null,
        target?.kind === 'time',
      );
  const loadLoggable = isLoadDraftLoggable(loadText) && !loadInvalid;

  const runnerResting = runnerPhase === 'resting';
  const rest = runnerResting ? {
    seconds: runner?.restSecondsTarget ?? restSecondsFor(rpe, profile.training_age),
    startedAtMs: runner?.restStartedAtMs ?? nowMs,
    slotId: currentSlot?.sessionPlanSlotId ?? -1,
  } : localRest;
  const restRemaining = rest === null ? 0 : Math.max(0, rest.seconds - Math.floor((nowMs - rest.startedAtMs) / 1000));
  const resting = rest !== null && !halted && !complete;

  useEffect(() => {
    if (!resting) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resting]);

  useEffect(() => {
    if (currentSlot === null || target === null) return;
    setDetailsOpen(false); setSafetyOpen(false); setNiggleRegion(null); setNiggleSeverity(4); setBandLevel(null);
    setReps(target.kind === 'reps' ? target.reps : 1);
    setSeconds(target.kind === 'time' ? target.seconds : 30);
    setRpe(currentSlot.targetRpe ?? 8);
    setRpeTouched(false);
    // Initialize the load draft ONCE per set key from the resolver output.
    // null = blank (athlete must choose); 0 = identity/explicit zero. The
    // resolver's output is intentionally NOT a dependency: rerenders,
    // preference hydration, and evidence refreshes must never overwrite a
    // draft the athlete has already entered.
    const initial = state.resolveSlotLoad({
      movementId: currentSlot.movementId,
      bodyweightMode,
      targetReps: target.kind === 'reps' ? target.reps : null,
      targetRpe: stableTargetRpe,
      overrideLoadKg: currentSlot.overrideLoadKg,
      sessionPlanSlotId: currentSlot.sessionPlanSlotId,
    }).initialLoadKg;
    setLoadText(initial === null ? '' : initial.toFixed(1));
    setLoadInvalid(false);
  }, [
    currentSlot?.sessionPlanSlotId,
    currentLogged,
    currentMovement?.movement_id,
    target?.kind,
    target?.kind === 'reps' ? target.reps : target?.seconds,
    currentSlot?.targetRpe,
    currentSlot?.overrideLoadKg,
  ]);

  const moveLegacyForward = (): void => {
    if (currentSlot === null) return;
    const i = sessionPlan.findIndex((slot) => slot.sessionPlanSlotId === currentSlot.sessionPlanSlotId);
    const next = sessionPlan.slice(i + 1).find((slot) => loggedCount(slot) < slot.plannedSets)
      ?? sessionPlan.slice(0, Math.max(0, i)).find((slot) => loggedCount(slot) < slot.plannedSets)
      ?? null;
    if (next !== null) selectMovementSlot(next.sessionPlanSlotId);
  };

  useEffect(() => {
    if (!resting || restRemaining !== 0 || rest === null) return;
    const key = `${rest.slotId}:${rest.startedAtMs}`;
    if (advancedRest.current === key) return;
    advancedRest.current = key;
    if (runnerResting) advanceRunnerRest();
    else { setLocalRest(null); moveLegacyForward(); }
  }, [resting, restRemaining, rest?.slotId, rest?.startedAtMs, runnerResting]);

  if (session === null && lastEndedSessionId != null && outcome !== null) {
    // Phase-18 post-session quiet line (Outcome View)
    const isBeginner = profile.training_age === 'beginner';
    const outcomeCopy: Record<string, string> = isBeginner
      ? {
          followed_plan: "You followed today's plan. Recover well.",
          adapted_session: "You adjusted the session and kept the work appropriate.",
          stopped_safely: "Stopping was the right call. Recovery is part of the plan.",
          session_recorded: "Your session is saved. Continue from here next time.",
        }
      : {
          followed_plan: "Plan followed.",
          adapted_session: "Session adapted.",
          stopped_safely: "Session stopped safely.",
          session_recorded: "Session recorded.",
        };

    const displayMsg = outcomeCopy[outcome.kind] ?? outcomeCopy.session_recorded;

    return (
      <View style={styles.outcomeContainer}>
        {/* Wordmark top-left */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
        </View>

        <View style={styles.outcomeMain}>
          {/* 24pt grey dash above */}
          <View style={styles.outcomeDash} />
          <Text style={styles.outcomeText}>{displayMsg}</Text>
          <Text style={styles.outcomeDate}>{outcome.dateStr}</Text>
        </View>

        <View style={styles.outcomeFooter}>
          <SecondaryButton
            label="Back to Ready"
            onPress={dismissOutcome}
            accessibilityLabel="Back to Ready"
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    );
  }

  if (session === null) {
    const blocked = lastTriage?.kind === 'matched' && lastTriage.directive.halt;
    return (
      <View style={styles.idle}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
        </View>
        <Text style={styles.kicker}>SESSION</Text>
        <Text style={styles.idleTitle}>
          {blocked ? 'Training is paused.' : 'Ready when you are.'}
        </Text>
        <Text style={styles.idleBody}>
          {blocked
            ? 'Resolve today’s safety halt before starting another session.'
            : mode === 'guided'
            ? 'You will move one clear step at a time.'
            : 'Your session will stay in one clear vertical timeline.'}
        </Text>
        {!blocked && (
          <PrimaryButton
            label="Start session"
            onPress={() => startSession()}
            accessibilityLabel="Start a new workout session"
            style={{ marginTop: theme.space[5] }}
          />
        )}
      </View>
    );
  }

  const tierPlanViolation = sessionPlan.some((slot) => {
    const movement = byId.get(slot.movementId);
    return movement === undefined || !isDifficultyAllowed(
      profile.training_age,
      movement.difficulty,
      movement.beginnerOk,
    );
  });

  if (tierPlanViolation) {
    return (
      <View style={styles.idle} accessibilityRole="alert">
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
        </View>
        <Text style={styles.kicker}>SESSION CHECK</Text>
        <Text style={styles.idleTitle}>This plan needs Coach review.</Text>
        <Text style={styles.idleBody}>
          A movement outside this athlete’s tier was blocked before it could be shown.
        </Text>
        <SecondaryButton
          label="Finish session"
          onPress={() => { runnerHalt('safety'); endSession(); }}
          accessibilityLabel="Finish the blocked session"
          style={{ marginTop: theme.space[5] }}
        />
      </View>
    );
  }

  const chooseSlot = (slot: PlanSlot): void => {
    if (mode === 'guided' || loggedCount(slot) >= slot.plannedSets) return;
    selectMovementSlot(slot.sessionPlanSlotId);
  };

  const readyNow = (): void => {
    if (runnerResting) {
      skipRunnerRest();
    } else { setLocalRest(null); moveLegacyForward(); }
  };

  const logCurrent = (): void => {
    if (currentSlot === null || currentMovement === null || target === null || resting) return;
    const parsed = parseLoadDraft(loadText);
    // Logging an external-load set requires an explicit finite, non-negative
    // entry; blank is absent evidence and never coerced to zero.
    if (parsed === null) {
      setLoadInvalid(loadText.trim() !== '');
      return;
    }
    // P1-2: reject any draft that would change at commit time (off-grid or
    // out of range). The screen passes the exact athlete-entered value to
    // logSet — never a silently snapped or clamped rewrite.
    if (!isOnLoadGrid(parsed)) {
      setLoadInvalid(true);
      return;
    }
    const safeLoad = parsed;
    const safeRpe = rpeTouched ? clamp(Math.round(rpe * 2) / 2, 5, 10) : null;
    const metrics = target.kind === 'time' ? { timeS: Math.round(clamp(seconds, 1, 3600)), ...(bandLevel === null ? {} : { bandLevel }) } : bandLevel === null ? undefined : { bandLevel };
    logSet(currentMovement.movement_id, target.kind === 'time' ? 1 : Math.round(clamp(reps, 1, 50)), safeLoad, safeRpe, undefined, undefined, undefined, metrics, currentSlot.sessionPlanSlotId);
    if (runner === null) {
      if (uiPreferences.restTimerEnabled) setLocalRest({
        startedAtMs: Date.now(),
        seconds: restSecondsFor(safeRpe ?? currentSlot.targetRpe ?? 8, profile.training_age),
        slotId: currentSlot.sessionPlanSlotId,
      });
      else moveLegacyForward();
    }
  };

  const thumbsDown = (): void => {
    if (currentMovement === null) return;
    if (runner !== null) {
      runnerThumbsDown();
      return;
    }
    setMovementPreference(currentMovement.movement_id, -1);
    openSubstitution(currentMovement.movement_id);
  };

  const submitNiggle = (): void => {
    if (niggleRegion === null) return;
    reportNiggle(niggleRegion, niggleSeverity);
    setSafetyOpen(false);
  };

  const setup = lines(currentMovement?.instructions, 4);
  const cues = lines(currentMovement?.cues, 3);
  const supportsBands = currentMovement?.supportedPrefixes?.includes('Banded') === true && bandLadder.length > 0;
  const runnerNext = runner === null ? null : nextRunnerWork(runner);
  const upcomingSlot = runnerNext !== null
    ? sessionPlan.find((slot) => slot.sessionPlanSlotId === runnerNext.slot.sessionPlanSlotId) ?? null
    : currentSlot === null ? firstIncomplete
      : sessionPlan.slice(Math.max(0, sessionPlan.findIndex((slot) => slot.sessionPlanSlotId === currentSlot.sessionPlanSlotId) + 1)).find((slot) => loggedCount(slot) < slot.plannedSets) ?? null;
  const upcomingText = runnerNext !== null && upcomingSlot !== null
    ? `${byId.get(upcomingSlot.movementId)?.name ?? 'Movement'} · set ${runnerNext.setIndex} of ${runnerNext.slot.sets}`
    : upcomingSlot !== null
      ? `${byId.get(upcomingSlot.movementId)?.name ?? 'Movement'} · ${targetText(upcomingSlot)}`
      : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityLabel="Current workout timeline">
        {/* Wordmark top-left */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
          <Text style={styles.kicker}>{mode === 'guided' ? 'GUIDED SESSION' : 'SELF-DIRECTED SESSION'}</Text>
          <Text style={styles.headerTitle}>{halted ? 'Session paused' : complete ? 'Session complete' : 'Your next step'}</Text>
          {!halted && !complete && (
            <Text style={styles.headerMeta}>
              {sessionPlan.length === 0 ? 'No movements are planned yet.' : `${sessionPlan.filter((slot) => loggedCount(slot) >= slot.plannedSets).length} of ${sessionPlan.length} exercises complete`}
            </Text>
          )}
        </View>

        {halted && (
          <View style={styles.haltCard} accessibilityRole="alert">
            <Text style={styles.haltTitle}>Stop training for today.</Text>
            <Text style={styles.haltBody}>
              {runner?.haltReason ?? (lastTriage?.kind === 'matched' ? lastTriage.directive.vector.coaching_cue : 'A safety report needs your attention before more sets are logged.')}
            </Text>
            <View style={{ marginTop: theme.space[4], alignSelf: 'stretch' }}>
              <SecondaryButton
                label="Finish session"
                onPress={() => { if (runnerPhase !== 'halted') runnerHalt('safety'); endSession(); }}
                accessibilityLabel="Finish the halted session"
                fullWidth={true}
              />
            </View>
          </View>
        )}

        {complete && (
          <View style={styles.completeCard} accessibilityRole="summary">
            <Text style={styles.completeTitle}>All planned work is logged.</Text>
            <Text style={styles.completeBody}>Take the win. There is nothing else you need to decide here.</Text>
            <CompletedMetrics sets={session.sets} bandLadder={bandLadder} movementsById={byId} onEdit={editSet} />
            <PrimaryButton
              label="Finish session"
              onPress={endSession}
              accessibilityLabel="Finish completed session"
              style={{ marginTop: theme.space[4] }}
            />
          </View>
        )}

        {!halted && !complete && sessionPlan.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No exercise is queued.</Text>
            <Text style={styles.emptyBody}>Return to Coach to create a session plan, then come back here.</Text>
            <SecondaryButton
              label="Finish session"
              onPress={endSession}
              accessibilityLabel="Finish empty session"
              style={{ marginTop: theme.space[4] }}
            />
          </View>
        )}

        {!halted && !complete && sessionPlan.length > 0 && (
          <View style={styles.timeline}>
            {sessionPlan.map((slot) => {
              const movement = byId.get(slot.movementId);
              const fallbackVideoUrl = movement?.media?.status === 'external_fallback'
                ? movement.media.fallbackUrl
                : null;
              const logged = loggedCount(slot);
              const finished = logged >= slot.plannedSets;
              // Cross-movement rest still belongs to the just-finished slot.
              // Keep it active so the rest controls remain reachable.
              const active = currentSlot?.sessionPlanSlotId === slot.sessionPlanSlotId && (!finished || resting);
              const selectable = mode === 'self_directed' && !finished && !active && !resting;

              if (finished && !active) {
                const completedSets = session?.sets.filter((set) => sameSlot(set, slot)) ?? [];
                const latestCompleted = completedSets[0];
                const bandLabel = latestCompleted?.bandLevel === null || latestCompleted?.bandLevel === undefined
                  ? null
                  : bandLadder.find((band) => band.level === latestCompleted.bandLevel)?.label ?? `band ${latestCompleted.bandLevel}`;
                const metricSummary = latestCompleted?.timeS !== null && latestCompleted?.timeS !== undefined
                  ? ` · ${secondsText(latestCompleted.timeS)} logged`
                  : bandLabel === null ? '' : ` · ${bandLabel}`;

                return (
                  <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
                    <View style={styles.rail}>
                      <View style={[styles.dot, styles.dotComplete]}>
                        <Text style={styles.check}>✓</Text>
                      </View>
                    </View>
                    <View style={styles.completeRow}>
                      <Text style={styles.completeRowName} numberOfLines={1}>{movement?.name ?? 'Movement'}</Text>
                      <Text style={styles.completeRowMeta}>{logged} sets complete{metricSummary}</Text>
                      <CompletedMetrics sets={completedSets} bandLadder={bandLadder} movementsById={byId} onEdit={editSet} />
                    </View>
                  </View>
                );
              }

              if (!active) {
                return (
                  <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
                    <View style={styles.rail}>
                      <View style={styles.dot} />
                    </View>
                    <Pressable
                      disabled={!selectable}
                      onPress={() => chooseSlot(slot)}
                      accessibilityRole={selectable ? 'button' : 'text'}
                      accessibilityState={{ disabled: !selectable }}
                      accessibilityLabel={selectable ? `Choose ${movement?.name ?? 'movement'} as the current exercise` : `${movement?.name ?? 'Movement'}, upcoming, ${targetText(slot)}`}
                      style={({ pressed }) => [styles.upcomingRow, selectable && styles.upcomingSelectable, pressed && selectable && styles.pressed]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingName} numberOfLines={1}>{movement?.name ?? 'Movement'}</Text>
                        <Text style={styles.upcomingMeta}>{targetText(slot)}</Text>
                      </View>
                      {selectable && <Text style={styles.choose}>Choose</Text>}
                    </Pressable>
                  </View>
                );
              }

              // Active slot
              return (
                <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
                  {/* Left Active Spine (Chalk marks CURRENT/ACTIVE only) */}
                  <View style={[styles.rail, styles.railActive]}>
                    <View style={[styles.dot, styles.dotCurrent]} />
                  </View>

                  <View style={styles.currentCard}>
                    {resting ? (
                      <View style={{ alignItems: 'center', gap: theme.space[3] }}>
                        {/* Draining chalk barRestTimerCard */}
                        <RestTimerCard
                          totalSeconds={rest.seconds}
                          elapsedSeconds={restRemaining}
                          style={{ alignSelf: 'stretch' }}
                        />
                        {runnerResting && (
                          <>
                            <Stepper
                              testID="session-rest-stepper"
                              label="Session rest seconds"
                              value={String(rest.seconds)}
                              onDecrement={() => setRunnerRestOverride(clamp(rest.seconds - 15, 45, 300))}
                              onIncrement={() => setRunnerRestOverride(clamp(rest.seconds + 15, 45, 300))}
                              repeatOnHold={true}
                              style={styles.sessionStepper}
                            />
                            <Text style={styles.nextUp}>Applies to this session.</Text>
                          </>
                        )}
                        <PrimaryButton
                          label="Ready now"
                          onPress={readyNow}
                          accessibilityLabel="Ready now, skip the rest timer"
                          style={{ alignSelf: 'stretch' }}
                        />
                        {upcomingText !== null && <Text style={styles.nextUp}>Next up: {upcomingText}</Text>}
                      </View>
                    ) : (
                      <View style={{ gap: theme.space[3] }}>
                        <Text style={styles.currentLabel}>CURRENT · SET {Math.min(slot.plannedSets, currentLogged + 1)} OF {slot.plannedSets}</Text>
                        <Text style={styles.movementName}>{movement?.name ?? 'Movement'}</Text>
                        <Text style={styles.targetLine}>Target {targetText(slot)}{slot.targetRpe === null ? '' : ` · RPE ${slot.targetRpe.toFixed(1)}`}</Text>
                        <Text
                          style={styles.loadEvidence}
                          testID="session-load-source-line"
                          accessibilityLabel={`Load source. ${loadEvidence}`}
                        >
                          {loadEvidence}
                        </Text>
                        {loadInvalid && (
                          <Text
                            style={styles.loadEvidence}
                            testID="session-load-validation"
                            accessibilityRole="alert"
                            accessibilityLabel="Load validation. Enter a load from 0 to 500 in 2.5 kg increments."
                          >
                            Enter a load from 0 to 500 in 2.5 kg increments.
                          </Text>
                        )}
                        {!loadInvalid && !loadLoggable && (
                          <Text style={styles.loadEvidence} testID="session-load-hint">Enter a load to log this set.</Text>
                        )}

                        {/* Steppers using the shared primitive */}
                        <View testID="current-set-steppers" style={styles.stepperStack}>
                          <Stepper
                            testID="current-reps-stepper"
                            repeatOnHold={target?.kind === 'time'}
                            label={target?.kind === 'time' ? 'Seconds' : 'Reps'}
                            value={String(target?.kind === 'time' ? seconds : reps)}
                            onDecrement={() => target?.kind === 'time' ? setSeconds((n) => clamp(n - 5, 5, 3600)) : setReps((n) => clamp(n - 1, 1, 50))}
                            onIncrement={() => target?.kind === 'time' ? setSeconds((n) => clamp(n + 5, 5, 3600)) : setReps((n) => clamp(n + 1, 1, 50))}
                            style={styles.sessionStepper}
                          />
                          <View style={styles.loadField}>
                            <Text style={styles.loadFieldLabel} testID="session-load-label">{loadLabel.toUpperCase()}</Text>
                            <View style={styles.loadFieldRow}>
                              <Pressable
                                testID="session-load-decrease"
                                onPress={() => {
                                  const current = parseLoadDraft(loadText);
                                  if (current === null) return;
                                  setLoadText(clamp(current - 2.5, 0, 500).toFixed(1));
                                  setLoadInvalid(false);
                                }}
                                disabled={!isLoadDraftLoggable(loadText)}
                                accessibilityRole="button"
                                accessibilityLabel="Decrease load by 2.5 kilograms"
                                accessibilityState={{ disabled: !isLoadDraftLoggable(loadText) }}
                                style={({ pressed }) => [
                                  styles.loadAdjust,
                                  pressed && styles.loadAdjustPressed,
                                  !isLoadDraftLoggable(loadText) && styles.loadAdjustDisabled,
                                ]}
                              >
                                <Text style={styles.loadAdjustText}>−</Text>
                              </Pressable>
                              <TextInput
                                testID="session-load-input"
                                style={styles.loadInput}
                                value={loadText}
                                onChangeText={(t) => {
                                  setLoadText(t);
                                  const parsed = parseLoadDraft(t);
                                  setLoadInvalid(t.trim() !== '' && (parsed === null || !isOnLoadGrid(parsed)));
                                }}
                                keyboardType="numeric"
                                placeholder="—"
                                placeholderTextColor={theme.color.textLow}
                                maxLength={6}
                                accessibilityLabel={
                                  loadSelection === null
                                    ? `${loadLabel} entry`
                                    : `${bodyweightMode ? 'Added load in kilograms, zero means bodyweight only' : 'Load in kilograms'}. ${loadEvidence}`
                                }
                              />
                              <Pressable
                                testID="session-load-increase"
                                onPress={() => {
                                  const current = parseLoadDraft(loadText);
                                  if (current === null) return;
                                  setLoadText(clamp(current + 2.5, 0, 500).toFixed(1));
                                  setLoadInvalid(false);
                                }}
                                disabled={!isLoadDraftLoggable(loadText)}
                                accessibilityRole="button"
                                accessibilityLabel="Increase load by 2.5 kilograms"
                                accessibilityState={{ disabled: !isLoadDraftLoggable(loadText) }}
                                style={({ pressed }) => [
                                  styles.loadAdjust,
                                  pressed && styles.loadAdjustPressed,
                                  !isLoadDraftLoggable(loadText) && styles.loadAdjustDisabled,
                                ]}
                              >
                                <Text style={styles.loadAdjustText}>+</Text>
                              </Pressable>
                            </View>
                          </View>
                          <Stepper
                            testID="current-rpe-stepper"
                            label="Actual RPE"
                            value={rpe.toFixed(1)}
                            onDecrement={() => {
                              setRpeTouched(true);
                              setRpe((n) => clamp(n - 0.5, 5, 10));
                            }}
                            onIncrement={() => {
                              setRpeTouched(true);
                              setRpe((n) => clamp(n + 0.5, 5, 10));
                            }}
                            style={styles.sessionStepper}
                          />
                          <View style={styles.rpeConfirmation}>
                            <Chip
                              label={rpeTouched ? `RPE ${rpe.toFixed(1)} recorded` : `Confirm target RPE ${rpe.toFixed(1)}`}
                              selected={rpeTouched}
                              onPress={() => setRpeTouched(true)}
                              accessibilityLabel={rpeTouched
                                ? `Actual RPE ${rpe.toFixed(1)} confirmed`
                                : `Confirm actual RPE ${rpe.toFixed(1)}`}
                            />
                            <Text style={styles.rpeEvidence}>
                              {rpeTouched
                                ? 'This actual RPE will be used as Coach evidence.'
                                : 'Unanswered RPE is left out of Coach evidence.'}
                            </Text>
                          </View>
                        </View>

                        {supportsBands && (
                          <View style={styles.bandBlock}>
                            <Text style={styles.bandLabel}>Band</Text>
                            <View style={styles.bandChoices}>
                              {bandLadder.map((band) => {
                                const selectedBand = bandLevel === band.level;
                                return (
                                  <Chip
                                    key={band.level}
                                    label={band.label}
                                    selected={selectedBand}
                                    onPress={() => setBandLevel(selectedBand ? null : band.level)}
                                    accessibilityLabel={`Band ${band.label}`}
                                    style={{ margin: theme.space[1] }}
                                  />
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* 72pt Primary Action Log Set Button */}
                        <PrimaryButton
                          label="Log set"
                          onPress={logCurrent}
                          size="log"
                          disabled={!loadLoggable}
                          accessibilityLabel={loadLoggable
                            ? `Log set ${Math.min(slot.plannedSets, currentLogged + 1)} for ${movement?.name ?? 'movement'}`
                            : `Log set ${Math.min(slot.plannedSets, currentLogged + 1)} for ${movement?.name ?? 'movement'}, unavailable — enter a load first`}
                        />

                        {/* Shared Disclosure Primitive */}
                        <Disclosure
                          label="How & why"
                          open={detailsOpen}
                          onOpenChange={setDetailsOpen}
                          accessibilityLabel={detailsOpen ? "How and why, expanded" : "How and why, collapsed"}
                        >
                          <View style={{ gap: theme.space[3] }}>
                            {movement?.coachingIntent != null && <Text style={styles.intent}>{movement.coachingIntent}</Text>}
                            {setup.length > 0 && (
                              <View style={styles.copyGroup}>
                                <Text style={styles.copyHeading}>SET UP</Text>
                                {setup.map((line, index) => <Text key={`setup-${index}`} style={styles.copyLine}>{index + 1}. {line}</Text>)}
                              </View>
                            )}
                            {cues.length > 0 && (
                              <View style={styles.copyGroup}>
                                <Text style={styles.copyHeading}>CUES</Text>
                                {cues.map((line, index) => <Text key={`cue-${index}`} style={styles.cueLine}>• {line}</Text>)}
                              </View>
                            )}
                            {setup.length === 0 && cues.length === 0 && movement?.coachingIntent == null && (
                              <Text style={styles.missing}>Curated coaching for this movement is still being reviewed.</Text>
                            )}
                            {fallbackVideoUrl !== null && (
                              <View style={{ marginTop: theme.space[2] }}>
                                <SecondaryButton
                                  label="Open form video"
                                  onPress={() => { void Linking.openURL(fallbackVideoUrl); }}
                                  accessibilityLabel={`Open video for ${movement?.name ?? 'movement'} in your browser`}
                                  style={{ alignSelf: 'stretch' }}
                                />
                              </View>
                            )}
                          </View>
                        </Disclosure>

                        {/* 56pt quick avoidance / discomfort trigger rows */}
                        <View style={styles.quickRow}>
                          <SecondaryButton
                            label="Doesn’t feel right"
                            onPress={thumbsDown}
                            accessibilityLabel={`Avoid ${movement?.name ?? 'this movement'} and find a substitution`}
                            style={{ flex: 1, minHeight: theme.touch.min }}
                          />
                          <SecondaryButton
                            label="Report discomfort"
                            onPress={() => setSafetyOpen((value) => !value)}
                            accessibilityLabel="Report discomfort"
                            style={{ flex: 1, minHeight: theme.touch.min }}
                          />
                        </View>

                        {safetyOpen && (
                          <View style={styles.safety}>
                            <Text style={styles.safetyPrompt}>Where, and how strong is it?</Text>
                            <View style={styles.joints}>
                              {(JOINTS as readonly string[]).map((joint) => {
                                const selectedJoint = niggleRegion === joint;
                                return (
                                  <Chip
                                    key={joint}
                                    label={joint.replace(/_/g, ' ')}
                                    selected={selectedJoint}
                                    onPress={() => setNiggleRegion(joint)}
                                    accessibilityLabel={joint.replace(/_/g, ' ')}
                                    style={{ margin: theme.space[1] }}
                                  />
                                );
                              })}
                            </View>
                            <View style={styles.severity}>
                              {[4, 6, 8].map((severity) => {
                                const selectedSeverity = niggleSeverity === severity;
                                const label = severity === 4 ? 'Mild' : severity === 6 ? 'Moderate' : 'Stop';
                                return (
                                  <Chip
                                    key={severity}
                                    label={label}
                                    selected={selectedSeverity}
                                    onPress={() => setNiggleSeverity(severity)}
                                    accessibilityLabel={`${label} discomfort, ${severity} of 10`}
                                    style={{ flex: 1, marginHorizontal: theme.space[1] }}
                                  />
                                );
                              })}
                            </View>
                            <View style={{ marginTop: theme.space[3] }}>
                              <PrimaryButton
                                label={niggleSeverity >= 8 ? 'Stop session' : 'Find an alternative'}
                                onPress={submitNiggle}
                                disabled={niggleRegion === null}
                                accessibilityLabel="Save discomfort report"
                              />
                            </View>
                          </View>
                        )}

                        {/* Stop Session outlined full-width SecondaryButton */}
                        <View style={{ marginTop: theme.space[3] }}>
                          <SecondaryButton
                            label="Stop session"
                            onPress={() => runnerHalt('manual')}
                            accessibilityLabel="Stop this session"
                            fullWidth={true}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!halted && !complete && substitution !== null && (
          <View style={styles.substitution}>
            <View style={styles.subHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subTitle}>Choose an alternative</Text>
                <Text style={styles.subBody}>Your completed sets stay recorded. The replacement carries the remaining work.</Text>
              </View>
              <Pressable onPress={closeSubstitution} accessibilityRole="button" accessibilityLabel="Close substitution options" style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {substitution.result.haltAdvised && (
              <View style={styles.subHalt}>
                <Text style={styles.subHaltText}>This report needs a pause rather than another exercise today.</Text>
                <SecondaryButton
                  label="Stop session"
                  onPress={() => runnerHalt('safety')}
                  accessibilityLabel="Halt session from substitution safety advice"
                  fullWidth={true}
                  style={{ marginTop: theme.space[3] }}
                />
              </View>
            )}
            <View style={{ marginTop: theme.space[3] }}>
              {substitution.result.layer1Regression.options.map((option) => {
                const avail = availabilityMap.get(option.movement_id);
                const isTeachingOnly = avail?.state === 'teaching_only';
                return (
                  <Pressable key={option.movement_id} onPress={() => applyRegression(substitution.targetId, option.movement_id)} accessibilityRole="button" accessibilityLabel={`Use ${option.name} instead`} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionName}>{option.name}</Text>
                      <Text style={styles.optionReason}>{option.rationale}</Text>
                      {isTeachingOnly && (
                        <Text style={styles.teachingOnlyOption}>
                          {formatTeachingOnlyReason(avail.reasons)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.optionArrow}>›</Text>
                  </Pressable>
                );
              })}
              {substitution.result.layer2DaySwap.options.map((option) => {
                const avail = availabilityMap.get(option.movement_id);
                const isTeachingOnly = avail?.state === 'teaching_only';
                return (
                  <Pressable key={`swap-${option.plannedSlotId}`} onPress={() => applyDaySwap(substitution.targetId, option)} accessibilityRole="button" accessibilityLabel={`Move ${option.name} forward into this session`} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionName}>{option.name}</Text>
                      <Text style={styles.optionReason}>{option.rationale}</Text>
                      {isTeachingOnly && (
                        <Text style={styles.teachingOnlyOption}>
                          {formatTeachingOnlyReason(avail.reasons)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.optionArrow}>›</Text>
                  </Pressable>
                );
              })}
              {substitution.result.layer1Regression.options.length === 0 && substitution.result.layer2DaySwap.options.length === 0 && (
                <Text style={styles.noOptions}>No safe replacement is available with today’s equipment. It is okay to finish here.</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  content: {
    paddingHorizontal: theme.space[4], // 16
    paddingTop: theme.space[4],
    paddingBottom: theme.space[6],
  },
  header: {
    marginBottom: theme.space[4],
  },
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
    marginBottom: theme.space[3],
  },
  kicker: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  headerTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
    marginTop: theme.space[1],
  },
  headerMeta: {
    ...theme.font.label,
    color: theme.color.textMid,
    marginTop: theme.space[2],
  },
  idle: {
    flex: 1,
    padding: theme.space[5],
    backgroundColor: theme.color.ink0,
    justifyContent: 'center',
  },
  idleTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
    marginTop: theme.space[3],
  },
  idleBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    marginTop: theme.space[3],
    lineHeight: 23,
  },
  timeline: {
    marginTop: theme.space[1],
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: 30,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.color.line,
  },
  railActive: {
    borderRightColor: theme.color.chalk,
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.color.textLow,
    backgroundColor: theme.color.ink0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotCurrent: {
    borderColor: theme.color.chalk,
    backgroundColor: theme.color.chalk,
  },
  dotComplete: {
    borderColor: theme.color.chalk,
    backgroundColor: theme.color.chalk,
  },
  check: {
    color: theme.color.ink0,
    fontSize: 9,
    fontWeight: '900',
  },
  completeRow: {
    flex: 1,
    minHeight: 56,
    marginLeft: theme.space[4],
    paddingVertical: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  completeRowName: {
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '600',
  },
  completeRowMeta: {
    ...theme.font.label,
    color: theme.color.textMid,
    marginTop: theme.space[1],
  },
  loggedDetails: {
    marginTop: theme.space[2],
  },
  loggedDetailsBody: {
    paddingBottom: theme.space[1],
  },
  loggedMetricRow: {
    paddingVertical: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  loggedMetricTitle: {
    ...theme.font.label,
    color: theme.color.textHi,
    fontWeight: '700',
  },
  metricAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space[2],
  },
  metricAdjust: {
    minWidth: 54,
    minHeight: 40,
    paddingHorizontal: theme.space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
  },
  metricAdjustText: {
    ...theme.font.label,
    color: theme.color.textHi,
  },
  metricValue: {
    minWidth: 68,
    marginHorizontal: theme.space[2],
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '700',
    textAlign: 'center',
  },
  loggedBandBlock: {
    marginTop: theme.space[2],
  },
  loggedBandLabel: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  loggedBandChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.space[2],
  },
  currentCard: {
    flex: 1,
    marginLeft: theme.space[4],
    marginBottom: theme.space[3],
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  currentLabel: {
    ...theme.font.eyebrow,
    color: theme.color.chalk,
  },
  movementName: {
    ...theme.font.display,
    color: theme.color.textHi,
    marginTop: theme.space[2],
  },
  targetLine: {
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '600',
    marginTop: theme.space[2],
  },
  loadEvidence: {
    ...theme.font.label,
    color: theme.color.textMid,
    marginTop: theme.space[1],
  },
  stepperStack: {
    flexDirection: 'column',
    marginTop: theme.space[4],
    gap: theme.space[2],
  },
  sessionStepper: {
    flex: 0,
    width: '100%',
  },
  loadField: {
    width: '100%',
    alignItems: 'center',
  },
  loadFieldLabel: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
    marginBottom: theme.space[2],
  },
  loadFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  loadAdjust: {
    // 88pt hit zone, matching the Stepper primitive's ± pads
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink0,
    flexShrink: 0,
  },
  loadAdjustPressed: {
    backgroundColor: theme.color.ink1,
  },
  loadAdjustDisabled: {
    opacity: 0.45,
    backgroundColor: theme.color.ink1,
  },
  loadAdjustText: {
    ...theme.font.title,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontWeight: '300',
  },
  loadInput: {
    flex: 1,
    minWidth: 56,
    textAlign: 'center',
    ...theme.font.title,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    fontVariant: ['tabular-nums'],
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    minHeight: theme.touch.min,
    marginHorizontal: theme.space[2],
  },
  rpeConfirmation: {
    alignItems: 'center',
    gap: theme.space[1],
  },
  rpeEvidence: {
    ...theme.font.label,
    color: theme.color.textMid,
    textAlign: 'center',
  },
  nextUp: {
    ...theme.font.label,
    color: theme.color.textMid,
    marginTop: theme.space[3],
    textAlign: 'center',
  },
  upcomingRow: {
    flex: 1,
    minHeight: 68,
    marginLeft: theme.space[4],
    paddingVertical: theme.space[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  upcomingSelectable: {
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  upcomingName: {
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '600',
  },
  upcomingMeta: {
    ...theme.font.label,
    color: theme.color.textMid,
    marginTop: theme.space[1],
  },
  choose: {
    alignSelf: 'center',
    ...theme.font.label,
    color: theme.color.textHi,
  },
  intent: {
    ...theme.font.body,
    color: theme.color.textHi,
    lineHeight: 22,
  },
  copyGroup: {
    marginTop: theme.space[3],
  },
  copyHeading: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    marginBottom: theme.space[1],
  },
  copyLine: {
    ...theme.font.body,
    color: theme.color.textHi,
    lineHeight: 22,
    marginBottom: theme.space[1],
  },
  cueLine: {
    ...theme.font.cue,
    color: theme.color.textHi,
    lineHeight: 28,
    marginBottom: theme.space[1],
  },
  missing: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 20,
  },
  bandBlock: {
    marginTop: theme.space[3],
  },
  bandLabel: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  bandChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.space[2],
  },
  quickRow: {
    flexDirection: 'row',
    marginTop: theme.space[3],
    gap: theme.space[2],
  },
  safety: {
    marginTop: theme.space[3],
    padding: theme.space[3],
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  safetyPrompt: {
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '600',
  },
  joints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.space[2],
  },
  severity: {
    flexDirection: 'row',
    marginTop: theme.space[3],
  },
  haltCard: {
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  haltTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  haltBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 22,
    marginTop: theme.space[2],
  },
  completeCard: {
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  completeTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  completeBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 22,
    marginTop: theme.space[2],
  },
  emptyCard: {
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  emptyTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  emptyBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 22,
    marginTop: theme.space[2],
  },
  substitution: {
    marginTop: theme.space[4],
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subTitle: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  subBody: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 20,
    marginTop: theme.space[1],
  },
  close: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: theme.color.textHi,
    fontSize: 27,
    fontWeight: '300',
  },
  subHalt: {
    marginTop: theme.space[3],
    padding: theme.space[3],
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  subHaltText: {
    ...theme.font.body,
    color: theme.color.textHi,
    lineHeight: 21,
  },
  option: {
    minHeight: 64,
    marginTop: theme.space[2],
    paddingVertical: theme.space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  optionCopy: {
    flex: 1,
    paddingRight: theme.space[2],
  },
  optionName: {
    ...theme.font.body,
    color: theme.color.textHi,
    fontWeight: '700',
  },
  optionReason: {
    ...theme.font.label,
    color: theme.color.textMid,
    lineHeight: 18,
    marginTop: theme.space[1],
  },
  optionArrow: {
    color: theme.color.textMid,
    fontSize: 28,
  },
  noOptions: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 20,
    marginTop: theme.space[3],
  },
  pressed: {
    opacity: 0.68,
  },

  // Outcome view styles (Phase 18 §1i)
  outcomeContainer: {
    flex: 1,
    backgroundColor: theme.color.ink0,
    padding: theme.space[4],
  },
  outcomeMain: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
  },
  outcomeDash: {
    width: 24,
    height: 3,
    backgroundColor: theme.color.line,
    marginBottom: 28,
    alignSelf: 'center',
  },
  outcomeText: {
    ...theme.font.cue,
    color: theme.color.textHi,
    textAlign: 'center',
    maxWidth: 300,
  },
  outcomeDate: {
    ...theme.font.label,
    color: theme.color.textLow,
    marginTop: 20,
    textAlign: 'center',
  },
  outcomeFooter: {
    paddingBottom: theme.space[4],
  },
  teachingOnlyOption: {
    ...theme.font.label,
    color: theme.color.textLow,
    marginTop: theme.space[1],
  },
});
