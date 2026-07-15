
/** Phase 17 utility-first active-session surface. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { JOINTS, nextUp as nextRunnerWork, targetLoadKg } from '@ak/inference';
import { palette, useStore, type LoggedSet, type Movement, type PlanSlot, type SetMetricPatch, type SlotTarget } from '../state/useStore';

const accent = palette.green;
type SessionMode = 'guided' | 'self_directed';
interface LocalRest { startedAtMs: number; seconds: number; slotId: number; }
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const scaleFor = (v: string | undefined): number => v === 'extra_large' ? 1.28 : v === 'large' ? 1.14 : 1;
const secondsText = (n: number): string => {
  const value = Math.max(0, Math.round(n)); const min = Math.floor(value / 60); const sec = value % 60;
  return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${value}s`;
};
const restSecondsFor = (rpe: number, age: string | undefined): number => {
  const base = rpe >= 9 ? 240 : rpe >= 8 ? 180 : rpe >= 7 ? 120 : 90;
  const multiplier = age === 'beginner' ? .75 : age === 'elite' ? 1.25 : 1;
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

function Dot({ state }: { state: 'complete' | 'current' | 'upcoming' }): React.JSX.Element {
  return <View style={styles.rail}><View style={[styles.dot, state === 'complete' && styles.dotComplete, state === 'current' && styles.dotCurrent]}>{state === 'complete' && <Text style={styles.check}>✓</Text>}</View></View>;
}
function Stepper({ label, value, minus, plus, scale }: { label: string; value: string; minus: () => void; plus: () => void; scale: number }): React.JSX.Element {
  return <View style={styles.stepper}>
    <Text style={[styles.stepperLabel, { fontSize: 11 * scale }]}>{label}</Text>
    <Pressable onPress={minus} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}><Text style={[styles.stepperSymbol, { fontSize: 26 * scale }]}>−</Text></Pressable>
    <Text style={[styles.stepperValue, { fontSize: 17 * scale }]} accessibilityLabel={`${label} ${value}`}>{value}</Text>
    <Pressable onPress={plus} accessibilityRole="button" accessibilityLabel={`Increase ${label}`} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}><Text style={[styles.stepperSymbol, { fontSize: 26 * scale }]}>+</Text></Pressable>
  </View>;
}
function Disclosure({ open, onPress, children }: { open: boolean; onPress: () => void; children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.disclosure}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`How and why, ${open ? 'expanded' : 'collapsed'}`} style={({ pressed }) => [styles.disclosureTrigger, pressed && styles.pressed]}><Text style={styles.disclosureTitle}>How & why</Text><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text></Pressable>
    {open && <View style={styles.disclosureBody}>{children}</View>}
  </View>;
}
function CompletedMetrics({
  sets,
  bandLadder,
  movementsById,
  onEdit,
  scale,
}: {
  sets: readonly LoggedSet[];
  bandLadder: readonly { level: number; label: string }[];
  movementsById: ReadonlyMap<number, Movement>;
  onEdit: (setId: number, reps: number, loadKg: number, rpe: number, metrics?: SetMetricPatch) => void;
  scale: number;
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const metricSets = sets.filter((set) => set.timeS !== null || set.bandLevel !== null || (
    bandLadder.length > 0 && movementsById.get(set.movement_id)?.supportedPrefixes?.includes('Banded') === true
  ));
  if (metricSets.length === 0) return null;
  return <View style={styles.loggedDetails}>
    <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Review logged details, ${open ? 'expanded' : 'collapsed'}`} style={({ pressed }) => [styles.loggedDetailsTrigger, pressed && styles.pressed]}>
      <Text style={[styles.loggedDetailsTitle, { fontSize: 14 * scale }]}>Review logged details</Text><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open && <View style={styles.loggedDetailsBody}>{metricSets.map((set) => {
      const duration = set.timeS;
      const supportsBand = bandLadder.length > 0 && movementsById.get(set.movement_id)?.supportedPrefixes?.includes('Banded') === true;
      return <View key={set.set_id} style={styles.loggedMetricRow}>
        <Text style={[styles.loggedMetricTitle, { fontSize: 13 * scale }]}>Set {set.set_index}</Text>
        {duration !== null && <View style={styles.metricAdjustRow}>
          <Pressable onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { timeS: Math.max(1, duration - 5) })} accessibilityRole="button" accessibilityLabel={`Decrease logged duration for set ${set.set_index}`} style={({ pressed }) => [styles.metricAdjust, pressed && styles.pressed]}><Text style={[styles.metricAdjustText, { fontSize: 14 * scale }]}>−5s</Text></Pressable>
          <Text style={[styles.metricValue, { fontSize: 15 * scale }]}>{secondsText(duration)}</Text>
          <Pressable onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { timeS: duration + 5 })} accessibilityRole="button" accessibilityLabel={`Increase logged duration for set ${set.set_index}`} style={({ pressed }) => [styles.metricAdjust, pressed && styles.pressed]}><Text style={[styles.metricAdjustText, { fontSize: 14 * scale }]}>+5s</Text></Pressable>
        </View>}
        {supportsBand && <View style={styles.loggedBandBlock}>
          <Text style={[styles.loggedBandLabel, { fontSize: 12 * scale }]}>Band</Text>
          <View style={styles.loggedBandChoices}>{bandLadder.map((band) => {
            const selected = set.bandLevel === band.level;
            return <Pressable key={band.level} onPress={() => onEdit(set.set_id, set.reps, set.load_kg, set.rpe, { bandLevel: selected ? null : band.level })} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Set ${set.set_index} band ${band.label}${selected ? ', selected' : ''}`} style={({ pressed }) => [styles.loggedBandChoice, selected && styles.bandChoiceSelected, pressed && styles.pressed]}><Text style={[styles.bandChoiceText, selected && styles.bandChoiceTextSelected, { fontSize: 12 * scale }]}>{band.label}</Text></Pressable>;
          })}</View>
        </View>}
      </View>;
    })}</View>}
  </View>;
}

export default function SessionScreen(): React.JSX.Element {
  const state = useStore((s) => s);
  const {
    movements, session, sessionPlan, activeSessionPlanSlotId, profile, oneRepMaxes,
    lastTriage, substitution, startSession, selectMovementSlot, setMovementPreference,
    openSubstitution, closeSubstitution, applyRegression, applyDaySwap, reportNiggle,
    logSet, editSet, endSession, runner, sessionMode, uiPreferences, bandLadder, lastLoggedLoads = {},
    advanceRunnerRest, skipRunnerRest, runnerThumbsDown, runnerHalt,
  } = state;
  const preferences = uiPreferences;
  const typeScale = scaleFor(preferences.textScale);
  // Mode is frozen when the session starts. Preference edits intentionally wait
  // for the next session instead of changing an athlete's current flow.
  const defaultMode: SessionMode = preferences.sessionModeOverride ?? (profile.training_age === 'beginner' ? 'guided' : 'self_directed');
  const mode: SessionMode = sessionMode ?? defaultMode;
  const runnerPhase = runner?.phase ?? 'working';

  const [nowMs, setNowMs] = useState(Date.now());
  const [localRest, setLocalRest] = useState<LocalRest | null>(null);
  const [reps, setReps] = useState(5);
  const [seconds, setSeconds] = useState(30);
  const [loadKg, setLoadKg] = useState(0);
  const [rpe, setRpe] = useState(8);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [niggleRegion, setNiggleRegion] = useState<string | null>(null);
  const [niggleSeverity, setNiggleSeverity] = useState(4);
  const [bandLevel, setBandLevel] = useState<number | null>(null);
  const advancedRest = useRef<string | null>(null);

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
  const halted = runnerPhase === 'halted' || triageHalted;
  const complete = !halted && (runnerPhase === 'complete' || allDone);
  const target = currentSlot === null ? null : targetFor(currentSlot);
  const oneRm = currentSlot === null ? undefined : oneRepMaxes[currentSlot.movementId];
  const currentSessionLoad = currentSlot === null
    ? undefined
    : session?.sets.find((set) => set.movement_id === currentSlot.movementId)?.load_kg;
  const lastLoad = currentSlot === null ? undefined : currentSessionLoad ?? lastLoggedLoads[currentSlot.movementId];
  const rpeTarget = currentSlot?.targetRpe ?? rpe;
  const oneRmLoad = currentSlot !== null && target?.kind === 'reps' && oneRm !== undefined ? targetLoadKg(oneRm, target.reps, rpeTarget) : null;
  const suggestedLoad = currentSlot?.overrideLoadKg ?? oneRmLoad ?? lastLoad ?? 0;
  const loadEvidence = currentSlot?.overrideLoadKg != null ? `Prescribed ${currentSlot.overrideLoadKg.toFixed(1)} kg` : oneRmLoad !== null ? `Based on your ${oneRm?.toFixed(1)} kg 1RM` : lastLoad !== undefined ? `Last logged ${lastLoad.toFixed(1)} kg` : 'Start light and use target RPE';

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
    setLoadKg(suggestedLoad);
  }, [
    currentSlot?.sessionPlanSlotId,
    currentMovement?.movement_id,
    target?.kind,
    target?.kind === 'reps' ? target.reps : target?.seconds,
    currentSlot?.targetRpe,
    currentSlot?.overrideLoadKg,
    suggestedLoad,
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

  if (session === null) {
    const blocked = lastTriage?.kind === 'matched' && lastTriage.directive.halt;
    return <View style={styles.idle}>
      <Text style={[styles.kicker, { fontSize: 12 * typeScale }]}>SESSION</Text>
      <Text style={[styles.idleTitle, { fontSize: 30 * typeScale }]}>{blocked ? 'Training is paused.' : 'Ready when you are.'}</Text>
      <Text style={[styles.idleBody, { fontSize: 16 * typeScale }]}>{blocked ? 'Resolve today’s safety halt before starting another session.' : mode === 'guided' ? 'You will move one clear step at a time.' : 'Your session will stay in one clear vertical timeline.'}</Text>
      {!blocked && <Pressable onPress={() => startSession()} accessibilityRole="button" accessibilityLabel="Start a new workout session" style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}><Text style={[styles.primaryText, { fontSize: 17 * typeScale }]}>Start session</Text></Pressable>}
    </View>;
  }

  const beginnerPlanViolation = profile.training_age === 'beginner' && sessionPlan.some((slot) => {
    const movement = byId.get(slot.movementId);
    return movement === undefined || (movement.difficulty !== 'Beginner' && !movement.beginnerOk);
  });
  if (beginnerPlanViolation) {
    return <View style={styles.idle} accessibilityRole="alert">
      <Text style={[styles.kicker, { fontSize: 12 * typeScale }]}>SESSION CHECK</Text>
      <Text style={[styles.idleTitle, { fontSize: 30 * typeScale }]}>This plan needs Coach review.</Text>
      <Text style={[styles.idleBody, { fontSize: 16 * typeScale }]}>A movement outside this athlete’s tier was blocked before it could be shown.</Text>
      <Pressable onPress={endSession} accessibilityRole="button" accessibilityLabel="Finish the blocked session" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={[styles.secondaryText, { fontSize: 16 * typeScale }]}>Finish session</Text></Pressable>
    </View>;
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
    const safeLoad = clamp(Math.round(loadKg * 2) / 2, 0, 500);
    const safeRpe = clamp(Math.round(rpe * 2) / 2, 5, 10);
    const metrics = target.kind === 'time' ? { timeS: Math.round(clamp(seconds, 1, 3600)), ...(bandLevel === null ? {} : { bandLevel }) } : bandLevel === null ? undefined : { bandLevel };
    logSet(currentMovement.movement_id, target.kind === 'time' ? 1 : Math.round(clamp(reps, 1, 50)), safeLoad, safeRpe, undefined, undefined, undefined, metrics, currentSlot.sessionPlanSlotId);
    if (runner === null) {
      if (preferences.restTimerEnabled) setLocalRest({ startedAtMs: Date.now(), seconds: restSecondsFor(safeRpe, profile.training_age), slotId: currentSlot.sessionPlanSlotId });
      else moveLegacyForward();
    }
  };
  const thumbsDown = (): void => {
    if (currentMovement === null) return;
    if (runner !== null) {
      // The store commits Avoid + the runner offer + substitution atomically.
      runnerThumbsDown();
      return;
    }
    // Compatibility path for a legacy open session without a checkpoint.
    setMovementPreference(currentMovement.movement_id, -1);
    openSubstitution(currentMovement.movement_id);
  };
  const submitNiggle = (): void => {
    if (niggleRegion === null) return;
    // reportNiggle owns the deterministic NIGGLE/HALT transition and only
    // offers substitution for qualifying, non-halt reports.
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

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} accessibilityLabel="Current workout timeline">
      <View style={styles.header}>
        <Text style={[styles.kicker, { fontSize: 12 * typeScale }]}>{mode === 'guided' ? 'GUIDED SESSION' : 'SELF-DIRECTED SESSION'}</Text>
        <Text style={[styles.headerTitle, { fontSize: 26 * typeScale }]}>{halted ? 'Session paused' : complete ? 'Session complete' : 'Your next step'}</Text>
        {!halted && !complete && <Text style={[styles.headerMeta, { fontSize: 14 * typeScale }]}>{sessionPlan.length === 0 ? 'No movements are planned yet.' : `${sessionPlan.filter((slot) => loggedCount(slot) >= slot.plannedSets).length} of ${sessionPlan.length} exercises complete`}</Text>}
      </View>

      {halted && <View style={styles.haltCard} accessibilityRole="alert">
        <Text style={[styles.haltTitle, { fontSize: 20 * typeScale }]}>Stop training for today.</Text>
        <Text style={[styles.haltBody, { fontSize: 15 * typeScale }]}>{runner?.haltReason ?? (lastTriage?.kind === 'matched' ? lastTriage.directive.vector.coaching_cue : 'A safety report needs your attention before more sets are logged.')}</Text>
        <Pressable onPress={endSession} accessibilityRole="button" accessibilityLabel="Finish the halted session" style={({ pressed }) => [styles.danger, pressed && styles.pressed]}><Text style={[styles.dangerText, { fontSize: 16 * typeScale }]}>Finish session</Text></Pressable>
      </View>}
      {complete && <View style={styles.completeCard} accessibilityRole="summary">
        <Text style={[styles.completeTitle, { fontSize: 20 * typeScale }]}>All planned work is logged.</Text>
        <Text style={[styles.completeBody, { fontSize: 15 * typeScale }]}>Take the win. There is nothing else you need to decide here.</Text>
        <CompletedMetrics sets={session.sets} bandLadder={bandLadder} movementsById={byId} onEdit={editSet} scale={typeScale} />
        <Pressable onPress={endSession} accessibilityRole="button" accessibilityLabel="Finish completed session" style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}><Text style={[styles.primaryText, { fontSize: 16 * typeScale }]}>Finish session</Text></Pressable>
      </View>}
      {!halted && !complete && sessionPlan.length === 0 && <View style={styles.emptyCard}>
        <Text style={[styles.emptyTitle, { fontSize: 19 * typeScale }]}>No exercise is queued.</Text>
        <Text style={[styles.emptyBody, { fontSize: 15 * typeScale }]}>Return to Coach to create a session plan, then come back here.</Text>
        <Pressable onPress={endSession} accessibilityRole="button" accessibilityLabel="Finish empty session" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={[styles.secondaryText, { fontSize: 16 * typeScale }]}>Finish session</Text></Pressable>
      </View>}

      {!halted && !complete && sessionPlan.length > 0 && <View style={styles.timeline}>
        {sessionPlan.map((slot) => {
          const movement = byId.get(slot.movementId);
          const logged = loggedCount(slot);
          const finished = logged >= slot.plannedSets;
          const active = !finished && currentSlot?.sessionPlanSlotId === slot.sessionPlanSlotId;
          const selectable = mode === 'self_directed' && !finished && !active && !resting;
          if (finished) {
            const completedSets = session?.sets.filter((set) => sameSlot(set, slot)) ?? [];
            const latestCompleted = completedSets[0];
            const bandLabel = latestCompleted?.bandLevel === null || latestCompleted?.bandLevel === undefined
              ? null
              : bandLadder.find((band) => band.level === latestCompleted.bandLevel)?.label ?? `band ${latestCompleted.bandLevel}`;
            const metricSummary = latestCompleted?.timeS !== null && latestCompleted?.timeS !== undefined
              ? ` · ${secondsText(latestCompleted.timeS)} logged`
              : bandLabel === null ? '' : ` · ${bandLabel}`;
            return <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
              <Dot state="complete" /><View style={styles.completeRow}>
                <Text style={[styles.completeRowName, { fontSize: 16 * typeScale }]} numberOfLines={1}>{movement?.name ?? 'Movement'}</Text>
                <Text style={[styles.completeRowMeta, { fontSize: 13 * typeScale }]}>{logged} sets complete{metricSummary}</Text>
                <CompletedMetrics sets={completedSets} bandLadder={bandLadder} movementsById={byId} onEdit={editSet} scale={typeScale} />
              </View>
            </View>;
          }
          if (!active) return <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
            <Dot state="upcoming" />
            <Pressable disabled={!selectable} onPress={() => chooseSlot(slot)} accessibilityRole={selectable ? 'button' : 'text'} accessibilityState={{ disabled: !selectable }} accessibilityLabel={selectable ? `Choose ${movement?.name ?? 'movement'} as the current exercise` : `${movement?.name ?? 'Movement'}, upcoming, ${targetText(slot)}`} style={({ pressed }) => [styles.upcomingRow, selectable && styles.upcomingSelectable, pressed && selectable && styles.pressed]}>
              <View><Text style={[styles.upcomingName, { fontSize: 16 * typeScale }]} numberOfLines={1}>{movement?.name ?? 'Movement'}</Text><Text style={[styles.upcomingMeta, { fontSize: 13 * typeScale }]}>{targetText(slot)}</Text></View>{selectable && <Text style={[styles.choose, { fontSize: 13 * typeScale }]}>Choose</Text>}
            </Pressable>
          </View>;
          return <View key={slot.sessionPlanSlotId} style={styles.timelineRow}>
            <Dot state="current" />
            <View style={styles.currentCard}>
              {resting ? <>
                <Text style={[styles.currentLabel, { fontSize: 12 * typeScale }]}>REST</Text>
                <Text style={[styles.restTime, { fontSize: 42 * typeScale }]}>{secondsText(restRemaining)}</Text>
                <Text style={[styles.restBody, { fontSize: 16 * typeScale }]}>Recover for {movement?.name ?? 'the next set'}.</Text>
                <Pressable onPress={readyNow} accessibilityRole="button" accessibilityLabel="Ready now, skip the rest timer" style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}><Text style={[styles.primaryText, { fontSize: 17 * typeScale }]}>Ready now</Text></Pressable>
                {upcomingText !== null && <Text style={[styles.nextUp, { fontSize: 13 * typeScale }]}>Next up: {upcomingText}</Text>}
              </> : <>
                <Text style={[styles.currentLabel, { fontSize: 12 * typeScale }]}>CURRENT · SET {Math.min(slot.plannedSets, currentLogged + 1)} OF {slot.plannedSets}</Text>
                <Text style={[styles.movementName, { fontSize: 27 * typeScale }]}>{movement?.name ?? 'Movement'}</Text>
                <Text style={[styles.targetLine, { fontSize: 16 * typeScale }]}>Target {targetText(slot)}{slot.targetRpe === null ? '' : ` · RPE ${slot.targetRpe.toFixed(1)}`}</Text>
                <Text style={[styles.loadEvidence, { fontSize: 14 * typeScale }]}>{loadEvidence}</Text>
                <View style={styles.stepperRow}>
                  <Stepper scale={typeScale} label={target?.kind === 'time' ? 'Seconds' : 'Reps'} value={String(target?.kind === 'time' ? seconds : reps)} minus={() => target?.kind === 'time' ? setSeconds((n) => clamp(n - 5, 5, 3600)) : setReps((n) => clamp(n - 1, 1, 50))} plus={() => target?.kind === 'time' ? setSeconds((n) => clamp(n + 5, 5, 3600)) : setReps((n) => clamp(n + 1, 1, 50))} />
                  <Stepper scale={typeScale} label="Load kg" value={loadKg.toFixed(1)} minus={() => setLoadKg((n) => clamp(n - 2.5, 0, 500))} plus={() => setLoadKg((n) => clamp(n + 2.5, 0, 500))} />
                  <Stepper scale={typeScale} label="RPE" value={rpe.toFixed(1)} minus={() => setRpe((n) => clamp(n - .5, 5, 10))} plus={() => setRpe((n) => clamp(n + .5, 5, 10))} />
                </View>
                {supportsBands && <View style={styles.bandBlock}>
                  <Text style={[styles.bandLabel, { fontSize: 13 * typeScale }]}>Band</Text>
                  <View style={styles.bandChoices}>{bandLadder.map((band) => {
                    const selectedBand = bandLevel === band.level;
                    return <Pressable key={band.level} onPress={() => setBandLevel(selectedBand ? null : band.level)} accessibilityRole="button" accessibilityState={{ selected: selectedBand }} accessibilityLabel={`Band ${band.label}${selectedBand ? ', selected' : ''}`} style={({ pressed }) => [styles.bandChoice, selectedBand && styles.bandChoiceSelected, pressed && styles.pressed]}><Text style={[styles.bandChoiceText, selectedBand && styles.bandChoiceTextSelected]}>{band.label}</Text></Pressable>;
                  })}</View>
                </View>}
                <Pressable onPress={logCurrent} accessibilityRole="button" accessibilityLabel={`Log set ${Math.min(slot.plannedSets, currentLogged + 1)} for ${movement?.name ?? 'movement'}`} style={({ pressed }) => [styles.logAction, pressed && styles.logActionPressed]}><Text style={[styles.logText, { fontSize: 19 * typeScale }]}>Log set</Text></Pressable>
                <Disclosure open={detailsOpen} onPress={() => setDetailsOpen((value) => !value)}>
                  {movement?.coachingIntent != null && <Text style={[styles.intent, { fontSize: 15 * typeScale }]}>{movement.coachingIntent}</Text>}
                  {setup.length > 0 && <View style={styles.copyGroup}><Text style={[styles.copyHeading, { fontSize: 12 * typeScale }]}>SET UP</Text>{setup.map((line, index) => <Text key={`setup-${index}`} style={[styles.copyLine, { fontSize: 15 * typeScale }]}>{index + 1}. {line}</Text>)}</View>}
                  {cues.length > 0 && <View style={styles.copyGroup}><Text style={[styles.copyHeading, { fontSize: 12 * typeScale }]}>CUES</Text>{cues.map((line, index) => <Text key={`cue-${index}`} style={[styles.copyLine, { fontSize: 15 * typeScale }]}>• {line}</Text>)}</View>}
                  {setup.length === 0 && cues.length === 0 && movement?.coachingIntent == null && <Text style={[styles.missing, { fontSize: 14 * typeScale }]}>Curated coaching for this movement is still being reviewed.</Text>}
                  {movement?.videoUrl !== undefined && movement.videoUrl.trim().length > 0 && <Pressable onPress={() => { void Linking.openURL(movement.videoUrl); }} accessibilityRole="link" accessibilityLabel={`Open video for ${movement.name} in your browser`} style={({ pressed }) => [styles.video, pressed && styles.pressed]}><Text style={[styles.videoText, { fontSize: 15 * typeScale }]}>Open form video</Text></Pressable>}
                </Disclosure>
                <View style={styles.quickRow}>
                  <Pressable onPress={thumbsDown} accessibilityRole="button" accessibilityLabel={`Avoid ${movement?.name ?? 'this movement'} and find a substitution`} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={[styles.quickText, { fontSize: 14 * typeScale }]}>Doesn’t feel right</Text></Pressable>
                  <Pressable onPress={() => setSafetyOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: safetyOpen }} accessibilityLabel={`Report discomfort, ${safetyOpen ? 'expanded' : 'collapsed'}`} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}><Text style={[styles.quickText, { fontSize: 14 * typeScale }]}>Report discomfort</Text></Pressable>
                </View>
                {safetyOpen && <View style={styles.safety}>
                  <Text style={[styles.safetyPrompt, { fontSize: 15 * typeScale }]}>Where, and how strong is it?</Text>
                  <View style={styles.joints}>{(JOINTS as readonly string[]).map((joint) => {
                    const selectedJoint = niggleRegion === joint;
                    return <Pressable key={joint} onPress={() => setNiggleRegion(joint)} accessibilityRole="button" accessibilityState={{ selected: selectedJoint }} accessibilityLabel={`${joint.replace(/_/g, ' ')}${selectedJoint ? ', selected' : ''}`} style={({ pressed }) => [styles.joint, selectedJoint && styles.jointSelected, pressed && styles.pressed]}><Text style={[styles.jointText, selectedJoint && styles.jointTextSelected]}>{joint.replace(/_/g, ' ')}</Text></Pressable>;
                  })}</View>
                  <View style={styles.severity}>{[4, 6, 8].map((severity) => {
                    const selectedSeverity = niggleSeverity === severity;
                    const label = severity === 4 ? 'Mild' : severity === 6 ? 'Moderate' : 'Stop';
                    return <Pressable key={severity} onPress={() => setNiggleSeverity(severity)} accessibilityRole="button" accessibilityState={{ selected: selectedSeverity }} accessibilityLabel={`${label} discomfort, ${severity} of 10`} style={({ pressed }) => [styles.severityButton, selectedSeverity && (severity >= 8 ? styles.severityDanger : styles.severitySelected), pressed && styles.pressed]}><Text style={[styles.severityText, selectedSeverity && styles.severityTextSelected]}>{label}</Text></Pressable>;
                  })}</View>
                  <Pressable disabled={niggleRegion === null} onPress={submitNiggle} accessibilityRole="button" accessibilityLabel="Save discomfort report" style={({ pressed }) => [styles.safetySubmit, niggleRegion === null && styles.disabled, pressed && styles.pressed]}><Text style={[styles.safetySubmitText, { fontSize: 15 * typeScale }]}>{niggleSeverity >= 8 ? 'Stop session' : 'Find an alternative'}</Text></Pressable>
                </View>}
                <Pressable onPress={() => runnerHalt('manual')} accessibilityRole="button" accessibilityLabel="Stop this session" style={({ pressed }) => [styles.stop, pressed && styles.pressed]}><Text style={[styles.stopText, { fontSize: 14 * typeScale }]}>Stop session</Text></Pressable>
              </>}
            </View>
          </View>;
        })}
      </View>}

      {!halted && !complete && substitution !== null && <View style={styles.substitution}>
        <View style={styles.subHeader}><View><Text style={[styles.subTitle, { fontSize: 19 * typeScale }]}>Choose an alternative</Text><Text style={[styles.subBody, { fontSize: 14 * typeScale }]}>Your completed sets stay recorded. The replacement carries the remaining work.</Text></View><Pressable onPress={closeSubstitution} accessibilityRole="button" accessibilityLabel="Close substitution options" style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>×</Text></Pressable></View>
        {substitution.result.haltAdvised && <View style={styles.subHalt}><Text style={[styles.subHaltText, { fontSize: 15 * typeScale }]}>This report needs a pause rather than another exercise today.</Text><Pressable onPress={() => runnerHalt('safety')} accessibilityRole="button" accessibilityLabel="Halt session from substitution safety advice" style={({ pressed }) => [styles.danger, pressed && styles.pressed]}><Text style={[styles.dangerText, { fontSize: 15 * typeScale }]}>Stop session</Text></Pressable></View>}
        {substitution.result.layer1Regression.options.map((option) => <Pressable key={option.movement_id} onPress={() => applyRegression(substitution.targetId, option.movement_id)} accessibilityRole="button" accessibilityLabel={`Use ${option.name} instead`} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><View style={styles.optionCopy}><Text style={[styles.optionName, { fontSize: 16 * typeScale }]}>{option.name}</Text><Text style={[styles.optionReason, { fontSize: 13 * typeScale }]}>{option.rationale}</Text></View><Text style={styles.optionArrow}>›</Text></Pressable>)}
        {substitution.result.layer2DaySwap.options.map((option) => <Pressable key={`swap-${option.plannedSlotId}`} onPress={() => applyDaySwap(substitution.targetId, option)} accessibilityRole="button" accessibilityLabel={`Move ${option.name} forward into this session`} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><View style={styles.optionCopy}><Text style={[styles.optionName, { fontSize: 16 * typeScale }]}>{option.name}</Text><Text style={[styles.optionReason, { fontSize: 13 * typeScale }]}>{option.rationale}</Text></View><Text style={styles.optionArrow}>›</Text></Pressable>)}
        {substitution.result.layer1Regression.options.length === 0 && substitution.result.layer2DaySwap.options.length === 0 && <Text style={[styles.noOptions, { fontSize: 14 * typeScale }]}>No safe replacement is available with today’s equipment. It is okay to finish here.</Text>}
      </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  idle: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', padding: 28, backgroundColor: palette.bg },
  kicker: { color: accent, fontWeight: '800', letterSpacing: 1.2 },
  idleTitle: { marginTop: 12, color: palette.text, fontWeight: '700', letterSpacing: -.5 },
  idleBody: { marginTop: 12, maxWidth: 330, color: palette.dim, lineHeight: 23 },
  header: { marginBottom: 24 },
  headerTitle: { marginTop: 7, color: palette.text, fontWeight: '700', letterSpacing: -.4 },
  headerMeta: { marginTop: 8, color: palette.dim },
  primary: { minHeight: 58, minWidth: 176, marginTop: 24, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 12, backgroundColor: accent },
  primaryPressed: { backgroundColor: '#69F3C4' },
  primaryText: { color: palette.bg, fontWeight: '800' },
  timeline: { marginTop: 2 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 30, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.line },
  dot: { width: 13, height: 13, marginTop: 18, borderRadius: 7, borderWidth: 2, borderColor: palette.dim, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotCurrent: { width: 16, height: 16, marginTop: 20, borderColor: accent, backgroundColor: accent },
  dotComplete: { borderColor: palette.green, backgroundColor: palette.green },
  check: { color: palette.bg, fontSize: 9, fontWeight: '900' },
  completeRow: { flex: 1, minHeight: 56, marginLeft: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  completeRowName: { color: palette.text, fontWeight: '600' },
  completeRowMeta: { marginTop: 3, color: palette.green },
  loggedDetails: { marginTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  loggedDetailsTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loggedDetailsTitle: { color: palette.dim, fontWeight: '700' },
  loggedDetailsBody: { paddingBottom: 4 },
  loggedMetricRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.line },
  loggedMetricTitle: { color: palette.text, fontWeight: '700' },
  metricAdjustRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metricAdjust: { minWidth: 54, minHeight: 40, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  metricAdjustText: { color: palette.text, fontWeight: '700' },
  metricValue: { minWidth: 68, marginHorizontal: 8, color: palette.text, fontWeight: '700', textAlign: 'center' },
  loggedBandBlock: { marginTop: 10 },
  loggedBandLabel: { color: palette.dim, fontWeight: '800', letterSpacing: .7, textTransform: 'uppercase' },
  loggedBandChoices: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginHorizontal: -3 },
  loggedBandChoice: { minHeight: 36, margin: 3, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  currentCard: { flex: 1, marginLeft: 16, marginBottom: 12, padding: 20, borderWidth: 1, borderColor: accent, borderRadius: 16, backgroundColor: palette.surface },
  currentLabel: { color: accent, fontWeight: '800', letterSpacing: 1 },
  movementName: { marginTop: 8, color: palette.text, fontWeight: '700', letterSpacing: -.5 },
  targetLine: { marginTop: 8, color: palette.text, fontWeight: '600' },
  loadEvidence: { marginTop: 5, color: palette.dim },
  stepperRow: { flexDirection: 'row', marginTop: 22, marginHorizontal: -4 },
  stepper: { flex: 1, minWidth: 0, marginHorizontal: 4, alignItems: 'center' },
  stepperLabel: { minHeight: 30, color: palette.dim, fontSize: 11, fontWeight: '800', letterSpacing: .55, textTransform: 'uppercase' },
  stepperButton: { width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 10, backgroundColor: palette.bg },
  stepperSymbol: { color: palette.text, fontSize: 26, fontWeight: '400' },
  stepperValue: { minHeight: 37, paddingTop: 8, color: palette.text, fontSize: 17, fontWeight: '700' },
  logAction: { minHeight: 64, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: accent },
  logActionPressed: { backgroundColor: '#69F3C4' },
  logText: { color: palette.bg, fontWeight: '800' },
  restTime: { marginTop: 10, color: palette.text, fontWeight: '700', letterSpacing: -1 },
  restBody: { marginTop: 6, color: palette.dim },
  nextUp: { marginTop: 16, color: palette.dim, lineHeight: 19 },
  upcomingRow: { flex: 1, minHeight: 68, marginLeft: 16, paddingVertical: 13, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.line },
  upcomingSelectable: { paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.surface },
  upcomingName: { color: palette.text, fontWeight: '600' },
  upcomingMeta: { marginTop: 3, color: palette.dim },
  choose: { alignSelf: 'center', color: accent, fontSize: 13, fontWeight: '700' },
  disclosure: { marginTop: 18, borderTopWidth: 1, borderTopColor: palette.line },
  disclosureTrigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disclosureTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  chevron: { color: palette.dim, fontSize: 20 },
  disclosureBody: { paddingBottom: 4 },
  intent: { color: palette.text, lineHeight: 22 },
  copyGroup: { marginTop: 16 },
  copyHeading: { marginBottom: 7, color: palette.dim, fontWeight: '800', letterSpacing: .8 },
  copyLine: { marginBottom: 6, color: palette.text, lineHeight: 22 },
  missing: { color: palette.dim, lineHeight: 20 },
  video: { minHeight: 48, marginTop: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: accent, borderRadius: 10 },
  videoText: { color: accent, fontWeight: '700' },
  bandBlock: { marginTop: 18 },
  bandLabel: { color: palette.dim, fontWeight: '800', letterSpacing: .7, textTransform: 'uppercase' },
  bandChoices: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -3 },
  bandChoice: { minHeight: 40, margin: 3, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 9 },
  bandChoiceSelected: { borderColor: accent, backgroundColor: '#143228' },
  bandChoiceText: { color: palette.dim, fontSize: 13, fontWeight: '600' },
  bandChoiceTextSelected: { color: palette.text },
  quickRow: { flexDirection: 'row', marginTop: 12, marginHorizontal: -4 },
  quick: { flex: 1, minHeight: 48, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 10 },
  quickText: { color: palette.text, fontWeight: '600', textAlign: 'center' },
  safety: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#1D1A16' },
  safetyPrompt: { color: palette.text, fontWeight: '600' },
  joints: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -3 },
  joint: { minHeight: 36, margin: 3, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  jointSelected: { borderColor: palette.amber, backgroundColor: '#3A2D1C' },
  jointText: { color: palette.dim, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  jointTextSelected: { color: palette.text },
  severity: { flexDirection: 'row', marginTop: 12, marginHorizontal: -3 },
  severityButton: { flex: 1, minHeight: 44, marginHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 9 },
  severitySelected: { borderColor: palette.amber, backgroundColor: '#3A2D1C' },
  severityDanger: { borderColor: palette.red, backgroundColor: '#3B1C1C' },
  severityText: { color: palette.dim, fontSize: 13, fontWeight: '700' },
  severityTextSelected: { color: palette.text },
  safetySubmit: { minHeight: 48, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.amber },
  safetySubmitText: { color: palette.bg, fontWeight: '800' },
  disabled: { opacity: .42 },
  stop: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  stopText: { color: palette.dim, textDecorationLine: 'underline' },
  haltCard: { padding: 20, borderWidth: 1, borderColor: palette.red, borderRadius: 16, backgroundColor: '#251616' },
  haltTitle: { color: palette.text, fontWeight: '800' },
  haltBody: { marginTop: 8, color: palette.text, lineHeight: 22 },
  danger: { minHeight: 52, marginTop: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 11, backgroundColor: palette.red },
  dangerText: { color: palette.bg, fontWeight: '800' },
  completeCard: { padding: 20, borderWidth: 1, borderColor: palette.green, borderRadius: 16, backgroundColor: '#13251F' },
  completeTitle: { color: palette.text, fontWeight: '800' },
  completeBody: { marginTop: 8, color: palette.text, lineHeight: 22 },
  emptyCard: { padding: 20, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.surface },
  emptyTitle: { color: palette.text, fontWeight: '700' },
  emptyBody: { marginTop: 8, color: palette.dim, lineHeight: 22 },
  secondary: { minHeight: 52, marginTop: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: palette.line, borderRadius: 11 },
  secondaryText: { color: palette.text, fontWeight: '700' },
  substitution: { marginTop: 24, padding: 16, borderWidth: 1, borderColor: accent, borderRadius: 16, backgroundColor: palette.surface },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  subTitle: { color: palette.text, fontWeight: '800' },
  subBody: { maxWidth: 280, marginTop: 5, color: palette.dim, lineHeight: 20 },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: palette.text, fontSize: 27, fontWeight: '300' },
  subHalt: { marginTop: 14, padding: 13, borderRadius: 10, backgroundColor: '#251616' },
  subHaltText: { color: palette.text, lineHeight: 21 },
  option: { minHeight: 64, marginTop: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line },
  optionCopy: { flex: 1, paddingRight: 10 },
  optionName: { color: palette.text, fontWeight: '700' },
  optionReason: { marginTop: 3, color: palette.dim, lineHeight: 18 },
  optionArrow: { color: accent, fontSize: 28 },
  noOptions: { marginTop: 16, color: palette.dim, lineHeight: 20 },
  pressed: { opacity: .68 },
});
