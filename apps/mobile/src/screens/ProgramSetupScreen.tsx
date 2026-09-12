import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  accessContextForBlockFocus,
  ANCHOR_MOVEMENT_NAMES,
  objectiveStyleLabel,
  powerObjectiveExplanation,
  SELECTABLE_SCHEMA_TYPES,
  defaultProgramDayIndices,
  programFocuses,
  splitExplainer,
  SPLIT_EXPLAINER_FOOTER,
  BLOCK_FOCUS_LIST,
  strengthAnchorCapacity,
  strengthAnchorRoleNames,
  weeklyProgressionSummary,
  type BlockFocus,
  type SchemaType,
} from '@ak/inference';
import { Chip, Disclosure, PrimaryButton, SecondaryButton } from '../components/ui';
import { theme } from '../theme/theme';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { recommendedProgramDefaults } from '../state/programDefaults';
import {
  useStore,
  type TrainingProgramDay,
  type TrainingProgramInput,
  type TrainingProgramMovementPreference,
} from '../state/useStore';

const SCHEMA_LABEL: Record<SchemaType, string> = {
  LINEAR: 'Linear', WAVE: 'Undulating', STEP: 'Step loading', APRE: 'Autoregulated',
};

const DAY_NAME = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

interface ProgramSetupScreenProps {
  editing?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function ProgramSetupScreen({
  editing = false, onComplete, onCancel,
}: ProgramSetupScreenProps): React.JSX.Element {
  const profile = useStore((s) => s.profile);
  const today = useStore((s) => s.today);
  const program = useStore((s) => s.program);
  const movements = useStore((s) => s.movements);
  const niggles = useStore((s) => s.niggles);
  const previewTrainingProgram = useStore((s) => s.previewTrainingProgram);
  const createTrainingProgram = useStore((s) => s.createTrainingProgram);
  const updateProgramPreferences = useStore((s) => s.updateProgramPreferences);
  const getVerdicts = useStore((s) => s.getMovementAvailabilityVerdicts);
  const movementAvailabilityRevision = useStore((s) => s.movementAvailabilityRevision);
  const confirmMovementPriorExperience = useStore((s) => s.confirmMovementPriorExperience);
  const activePriorExperienceMovementIds = useStore((s) => s.activePriorExperienceMovementIds);
  const storeError = useStore((s) => s.error);

  const initialFrequency = program?.days.length ?? profile.weekly_frequency;
  // W2: every programming control now OPENS on a disclosed coach default
  // instead of on null. The first run is review-and-confirm; the controls are
  // all still here, one disclosure away, and an existing program still wins
  // over the recommendation when editing.
  const recommended = useMemo(() => recommendedProgramDefaults(profile), [profile]);
  const [buildMode, setBuildMode] = useState<'coach' | 'custom'>(
    editing && (program?.movementPreferences.length ?? 0) > 0 ? 'custom' : recommended.buildMode,
  );
  const [horizonKind, setHorizonKind] = useState<'weeks' | 'date'>(
    editing ? (program?.horizonKind ?? recommended.horizonKind) : recommended.horizonKind,
  );
  const [blockCount, setBlockCount] = useState<number>(
    editing ? (program?.plannedBlockCount ?? recommended.blockCount) : recommended.blockCount,
  );
  const [reviewDate, setReviewDate] = useState(program?.requestedReviewDate ?? '');
  const [schemaType, setSchemaType] = useState<SchemaType>(
    editing ? (program?.schemaType ?? recommended.schemaType) : recommended.schemaType,
  );
  // Editing IS the fine-tuning task, so the optional area opens for it. A first
  // run keeps it closed: the point is that nothing in there has to be touched.
  const [advancedOpen, setAdvancedOpen] = useState(editing);
  const [dayIndices, setDayIndices] = useState<number[]>(() =>
    program?.days.map((day) => day.dayIndex) ?? [...defaultProgramDayIndices(initialFrequency)],
  );
  const [dayFocuses, setDayFocuses] = useState<Record<number, BlockFocus>>(() => {
    const initial: Record<number, BlockFocus> = {};
    if (program?.days && program.days.length > 0) {
      for (const d of program.days) {
        initial[d.dayIndex] = d.focus as BlockFocus;
      }
    } else {
      const defaultFocuses = programFocuses(profile.objective, initialFrequency);
      const defaults = defaultProgramDayIndices(initialFrequency);
      defaults.forEach((day, idx) => {
        initial[day] = defaultFocuses[idx] ?? 'full';
      });
    }
    return initial;
  });
  const [preferences, setPreferences] = useState<TrainingProgramMovementPreference[]>(() =>
    program?.movementPreferences ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const input = useMemo<TrainingProgramInput | null>(() => {
    // Only ONE way to be incomplete survives: choosing the Date horizon and not
    // yet typing a date. Every other field now opens on a real value, so the
    // form can no longer be blocked by a decision the athlete never made.
    if (horizonKind === 'date' && reviewDate.trim() === '') return null;
    const defaultFocuses = programFocuses(profile.objective, dayIndices.length);
    const days: TrainingProgramDay[] = dayIndices.map((dayIndex, i) => ({
      dayIndex,
      focus: dayFocuses[dayIndex] ?? defaultFocuses[i] ?? 'full',
    }));
    return {
      horizon: horizonKind === 'weeks'
        ? { kind: 'weeks', blockCount }
        : { kind: 'date', requestedReviewDate: reviewDate.trim() },
      schemaType,
      dayIndices,
      days,
      movementPreferences: buildMode === 'custom' ? preferences : [],
    };
  }, [horizonKind, schemaType, buildMode, blockCount, reviewDate, dayIndices, preferences, dayFocuses, profile.objective]);

  const previewResult = useMemo(() => {
    if (input === null) return { preview: null, error: null };
    try {
      return { preview: previewTrainingProgram(input), error: null };
    } catch (error) {
      return { preview: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [input, previewTrainingProgram]);

  const availableIdsByContext = useMemo(() => ({
    weight_room: new Set(getVerdicts('weight_room')
      .filter((verdict) => verdict.state === 'available').map((v) => v.movementId)),
    sport_conditioning: new Set(getVerdicts('sport_conditioning')
      .filter((verdict) => verdict.state === 'available').map((v) => v.movementId)),
  }), [getVerdicts, movementAvailabilityRevision, profile, movements, niggles]);

  const toggleDay = (day: number): void => {
    const nextDays = dayIndices.includes(day)
      ? (dayIndices.length === 1 ? dayIndices : dayIndices.filter((value) => value !== day))
      : [...dayIndices, day].sort((a, b) => a - b);
    setDayIndices(nextDays);
    setPreferences((current) => current.filter((preference) => preference.dayIndex !== day));
    setDayFocuses((current) => {
      const updated = { ...current };
      const defaultFocuses = programFocuses(profile.objective, nextDays.length);
      nextDays.forEach((d, idx) => {
        if (!updated[d]) {
          updated[d] = defaultFocuses[idx] ?? 'full';
        }
      });
      return updated;
    });
  };

  const setDayFocus = (dayIndex: number, focus: BlockFocus): void => {
    setDayFocuses((current) => ({
      ...current,
      [dayIndex]: focus,
    }));
  };

  const chooseMovement = (dayIndex: number, slotIndex: number, pattern: TrainingProgramMovementPreference['pattern'], movementId: number): void => {
    setPreferences((current) => [
      ...current.filter((item) => !(item.dayIndex === dayIndex && item.slotIndex === slotIndex)),
      { dayIndex, slotIndex, pattern, movementId },
    ]);
  };

  const confirm = (): void => {
    if (input === null || previewResult.preview === null) {
      setLocalError(previewResult.error ?? 'Finish each choice before continuing.');
      return;
    }
    setLocalError(null);
    const saved = editing ? updateProgramPreferences(input) : createTrainingProgram(input);
    if (saved) onComplete?.();
  };

  // W2 note: before the coach defaults landed, `input` was null on first
  // render, so nothing below ever dereferenced a preview until the athlete had
  // filled the form in. The preview now runs immediately, which puts these
  // derivations on the very first paint of a first-run athlete's screen — so
  // each one is defensive about a plan that is missing an optional array.
  // A throw here is a blank screen at exactly the worst moment.
  const weekOne = previewResult.preview?.plan?.sessions?.filter((session) => session.week_index === 1) ?? [];

  // --- W3 disclosures: honest style, capacity, anchor coverage -------------
  // The athlete-facing style is the goal's honest meaning (WO §2.2), shown
  // beside the raw persisted objective so the label can never silently
  // misrepresent the split actually scheduled.
  const styleLabel = objectiveStyleLabel(profile.objective);
  // R1 (Round 2, ledger 0060): the POWER explanation. Athletic power is
  // explosive-force work — the coach plans fast, speed-purpose rungs of the
  // big lifts (the curated 'speed' rows) and keeps every gate intact. The
  // copy states the tier law plainly: olympic-lift competition movements are
  // Advanced-tier and appear only for athletes whose tier admits them.
  const powerExplanation = profile.objective === 'power';
  // Strength anchor capacity (WO §2.5), Round 2 R4 + audit round 4 (P1):
  // the disclosed number comes from the DRAFT schedule (the athlete's live
  // dayIndices/dayFocuses choices), not the persisted profile — toggling a
  // day or changing a focus updates the warning BEFORE creation. The pure
  // law counts the DISTINCT anchor roles (squat/push_h/hinge) the drafted,
  // duration-shaped week can carry; fewer than 3 cannot carry the big
  // three (an all-lower week can never bench).
  const anchorCapacity = useMemo(() => strengthAnchorCapacity(
    profile, programFocuses, defaultProgramDayIndices,
    dayIndices.map((dayIndex) => ({ dayIndex, focus: dayFocuses[dayIndex] ?? 'full' })),
  ), [profile.objective, profile.weekly_frequency, profile.session_duration_cap_min, dayIndices, dayFocuses]);
  const strengthCapacityShort = profile.objective === 'strength' && anchorCapacity < 3;
  // Round 5: the warning speaks in ROLES, not slot counts — the pure export
  // names the distinct squat/push/hinge roles the drafted week covers, and
  // the copy names the missing role with the focus change that remedies it.
  const anchorRoleNames = useMemo(() => strengthAnchorRoleNames(
    profile, programFocuses,
    dayIndices.map((dayIndex) => ({ dayIndex, focus: dayFocuses[dayIndex] ?? 'full' })),
  ), [profile.objective, profile.weekly_frequency, profile.session_duration_cap_min, dayIndices, dayFocuses]);
  const missingAnchorRoles = useMemo(() => {
    const ALL_ROLES = ['squat', 'horizontal push (bench)', 'hinge (deadlift)'];
    return ALL_ROLES.filter((role) => !anchorRoleNames.includes(role));
  }, [anchorRoleNames]);
  // Round 6: the advice is GENERATED from actual capacity-improving edits —
  // simulate changing each drafted day's focus to every other focus and keep
  // only the edits that raise the distinct-role count to all three. If no
  // focus-only edit succeeds, the remedy is a training day; if the slot
  // budget (session duration) is what keeps roles out of a day's menu, point
  // at the Athlete/Profile session-length setting. The reduced-anchor choice
  // is always retained. Pure derivation, no invented copy.
  const focusFixSuggestions = useMemo(() => {
    if (missingAnchorRoles.length === 0) return [];
    const draft = dayIndices.map((dayIndex) => ({
      dayIndex,
      focus: (dayFocuses[dayIndex] ?? 'full') as BlockFocus,
    }));
    const fixes: string[] = [];
    const DAY_NAME_FIX = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    for (const day of draft) {
      for (const candidate of BLOCK_FOCUS_LIST) {
        if (candidate === day.focus) continue;
        const simulated = strengthAnchorCapacity(
          profile, programFocuses, defaultProgramDayIndices,
          draft.map((d) => (d.dayIndex === day.dayIndex ? { ...d, focus: candidate } : d)),
        );
        if (simulated === 3) {
          fixes.push(`set ${DAY_NAME_FIX[day.dayIndex - 1]}'s focus to ${candidate}`);
        }
      }
    }
    return fixes;
  }, [missingAnchorRoles, dayIndices, dayFocuses, profile.objective, profile.weekly_frequency, profile.session_duration_cap_min]);
  const durationConstrained = useMemo(() => {
    // Duration is the constraint when a longer session would let a drafted
    // day's menu reach a role the budget currently trims away.
    if (missingAnchorRoles.length === 0) return false;
    const longer = { ...profile, session_duration_cap_min: Math.min(240, profile.session_duration_cap_min + 15) };
    const draft = dayIndices.map((dayIndex) => ({
      dayIndex,
      focus: (dayFocuses[dayIndex] ?? 'full') as BlockFocus,
    }));
    return strengthAnchorCapacity(longer, programFocuses, defaultProgramDayIndices, draft)
      > anchorCapacity;
  }, [missingAnchorRoles, profile, dayIndices, dayFocuses, anchorCapacity]);
  // Anchor coverage for strength: which of the big three are gated-available
  // this week, which are blocked (with reasons), and whether a local
  // prior-experience declaration would clear an ordinary capability gap
  // (shared verdict: capability is the ONLY blocker and confirmationWouldClear).
  const anchorCoverage = useMemo(() => {
    if (profile.objective !== 'strength') return [];
    return ANCHOR_MOVEMENT_NAMES.map((name) => {
      const movement = movements.find((m) => m.name === name);
      if (movement === undefined) {
        return { name, state: 'missing_from_library' as const, confirmWouldClear: false, reasons: [] as string[], movementId: -1, confirmed: false };
      }
      const verdict = getVerdicts('weight_room').find((v) => v.movementId === movement.movement_id);
      const reasons = verdict?.reasons ?? [];
      const confirmWouldClear = (verdict?.state === 'teaching_only'
        && verdict.confirmationWouldClear
        && !verdict.separateAttestationRequired
        && verdict.reasons.length === 1
        && verdict.reasons[0] === 'capability');
      const confirmed = activePriorExperienceMovementIds.includes(movement.movement_id);
      return {
        name,
        movementId: movement.movement_id,
        state: verdict?.state === 'available' || confirmed ? ('available' as const) : ('blocked' as const),
        confirmWouldClear: confirmWouldClear && !confirmed,
        reasons,
        confirmed,
      };
    });
  }, [profile.objective, profile, movements, getVerdicts, movementAvailabilityRevision, activePriorExperienceMovementIds, niggles]);

  // Ranking decisions from the generated preview: anchor substitutions and
  // reasoned bodyweight fallbacks surface verbatim in the preview card.
  const rankingNotes = previewResult.preview?.plan?.warnings?.filter((w) =>
    w.includes('unavailable for') || w.includes('no loaded')) ?? [];

  // R3 (Round 2, ledger 0060): the weekly progression summary rendered in the
  // ACTUAL preview. The pure classifier explains the week-1 -> 2 and
  // week-3 -> 4 (deload) changes for every representative slot of the
  // generated plan — the same function the evidence harness prints.
  const progressionSummary = useMemo(() => {
    if (previewResult.preview?.plan == null) return [];
    const bodyweightNames = new Set((movements ?? [])
      .filter((m) => (m.supportedPrefixes ?? []).length === 1 && m.supportedPrefixes[0] === 'Bodyweight')
      .map((m) => m.movement_id));
    return weeklyProgressionSummary(
      previewResult.preview.plan,
      (movementId) => {
        const m = (movements ?? []).find((item) => item.movement_id === movementId);
        return m ? { name: m.name, bodyweight: bodyweightNames.has(m.movement_id) } : undefined;
      },
    );
  }, [previewResult.preview, movements]);

  // R8 §2.3 said a rule must never be enforced invisibly. That contract is kept
  // in full — what changed is how many rules there are left to enforce. Four of
  // the original five prompts ("choose who selects movements", "choose when you
  // want to review", "choose a program duration", "choose a progression
  // method") are gone because the decisions they policed now arrive with
  // disclosed defaults, not because the explanation was dropped. The one rule
  // that can still block is still explained, in the same live region.
  const missingRequirement = useMemo<string | null>(() => {
    if (horizonKind === 'date' && reviewDate.trim() === '') return 'Enter a review date.';
    return null;
  }, [horizonKind, reviewDate]);

  return (
    <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{editing ? 'MANAGE PROGRAM' : 'BUILD YOUR PROGRAM'}</Text>
      <Text style={styles.title}>{styleLabel}</Text>
      <Text style={styles.body}>
        Goal: {profile.objective.replace('_', ' ')} — {styleLabel}. Four-week blocks stay intact. You choose when to review the goal.
      </Text>

      {/* W2: the recommendation, stated before anything is asked. Every value
          the athlete no longer has to choose is named here, so nothing is
          applied quietly. */}
      {!editing && (
        <View style={styles.card} testID="program-recommendation-card">
          <Text style={styles.sectionTitle}>What the coach has picked for you</Text>
          <Text style={styles.notice}>{recommended.disclosure}</Text>
          <Text style={styles.caption}>
            Your {dayIndices.length}-day week comes from the training days you already gave during
            setup. Nothing here is permanent — you can change all of it later in Athlete / Profile.
          </Text>
        </View>
      )}

      {/* W2: the athlete reviews a real generated week BEFORE committing to it.
          This is read-only on purpose; editing movements is the Customize path
          inside the optional area below. */}
      {!editing && weekOne.length > 0 && (
        <View style={styles.card} testID="recommended-week-card">
          <Text style={styles.sectionTitle}>Your first week</Text>
          {weekOne.map((session) => (
            <View key={session.day_index} style={styles.session}>
              <Text style={styles.sessionTitle}>
                {DAY_NAME[session.day_index - 1] ?? `Day ${session.day_index}`} · {session.focus}
              </Text>
              {session.slots.map((slot) => {
                const movement = movements.find((item) => item.movement_id === slot.movement_id);
                return (
                  <Text key={slot.slot_index} style={styles.caption}>
                    {movement?.name ?? `Movement ${slot.movement_id}`} — {slot.sets}×{slot.reps}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {powerExplanation && (
        <View style={styles.card} testID="power-explanation-card">
          <Text style={styles.sectionTitle}>How athletic power works here</Text>
          <Text style={styles.notice}>
            {powerObjectiveExplanation('power', profile.training_age)}
          </Text>
          {profile.training_age !== 'beginner' && (
            <Text style={styles.caption}>
              Fast barbell, kettlebell and jump-style alternatives are planned until your training
              history supports the competition olympic lifts.
            </Text>
          )}
        </View>
      )}

      {strengthCapacityShort && (
        <View style={styles.card} testID="strength-capacity-warning">
          <Text style={styles.sectionTitle}>Your draft cannot cover all three big lifts.</Text>
          <Text style={styles.notice}>
            The big three need three lift roles a week: a squat, a horizontal push (bench), and a
            hinge (deadlift). Your drafted week covers {anchorCapacity} of those roles
            {' '}({anchorRoleNames.length === 0 ? 'none' : anchorRoleNames.join(', ')}), so the plan
            cannot include every main lift. It will not silently promise powerlifting and skip one.
          </Text>
          {focusFixSuggestions.length > 0 && (
            <Text style={styles.caption} testID="capacity-focus-fixes">
              Capacity fix — {focusFixSuggestions.length === 1 ? 'this edit' : 'any of these edits'}
              {' '}cover all three roles: {focusFixSuggestions.join('; ')}.
            </Text>
          )}
          {focusFixSuggestions.length === 0 && missingAnchorRoles.length > 0 && (
            <Text style={styles.caption} testID="capacity-day-fix">
              No single focus change covers all three roles — add a training day whose focus
              carries {missingAnchorRoles.join(' or ')}.
            </Text>
          )}
          {durationConstrained && (
            <Text style={styles.caption} testID="capacity-duration-fix">
              Your session length is also limiting which lifts fit in a day — you can raise it
              later in Athlete / Profile (minutes per session).
            </Text>
          )}
          <Text style={styles.caption}>
            You can also continue with a reduced-anchor plan.
          </Text>
        </View>
      )}

      {anchorCoverage.length > 0 && (
        <View style={styles.card} testID="anchor-coverage-card">
          <Text style={styles.sectionTitle}>Big-lift availability</Text>
          {anchorCoverage.map((anchor) => (
            <View key={anchor.name} style={styles.anchorRow}>
              <Text style={styles.anchorName}>
                {anchor.name}: {anchor.state === 'available' ? 'ready' : anchor.state === 'missing_from_library' ? 'not in your library' : 'blocked'}
              </Text>
              {anchor.state === 'blocked' && anchor.reasons.length > 0 && (
                <Text style={styles.caption}>{anchor.reasons.join(', ')}</Text>
              )}
              {anchor.confirmWouldClear && (
                <>
                  <Text style={styles.caption}>
                    You can declare you have trained this lift before — a local statement about your own
                    history, not a coaching assessment.
                  </Text>
                  <Chip
                    label={`I have trained ${anchor.name} before`}
                    selected={false}
                    onPress={() => confirmMovementPriorExperience(anchor.movementId, 'weight_room')}
                    testID={`anchor-confirm-${anchor.movementId}`}
                  />
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Everything the required path no longer asks for. Not removed, not
          hidden behind a different screen — one disclosure away, with every
          control that was here before, in the same order. */}
      <Disclosure
        label={editing ? 'Program controls' : 'Fine-tune your program (optional)'}
        hint="Movement selection, review horizon, training days, progression method"
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        testID="program-advanced"
      >
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Who chooses movements?</Text>
        <View style={styles.row}>
          <Chip label="Coach build" selected={buildMode === 'coach'} onPress={() => setBuildMode('coach')} />
          <Chip label="Customize" selected={buildMode === 'custom'} onPress={() => setBuildMode('custom')} />
        </View>
        <Text style={styles.caption}>Customize changes movements only. Sets, reps and RPE stay coach-controlled.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Review horizon</Text>
        <View style={styles.row}>
          <Chip label="Duration" selected={horizonKind === 'weeks'} onPress={() => setHorizonKind('weeks')} />
          <Chip label="Date" selected={horizonKind === 'date'} onPress={() => setHorizonKind('date')} />
        </View>
        {horizonKind === 'weeks' && (
          <View style={styles.wrap}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <Chip key={count} label={`${count * 4} wk`} selected={blockCount === count} onPress={() => setBlockCount(count)} />
            ))}
          </View>
        )}
        {horizonKind === 'date' && (
          <TextInput disableFullscreenUI value={reviewDate} onChangeText={setReviewDate} placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textLow} style={styles.input} autoCapitalize="none" />
        )}
        {previewResult.preview !== null && (
          <>
            <Text style={styles.notice}>
              Normalized review boundary: {previewResult.preview.plannedEndDate}
              {' '}({previewResult.preview.plannedBlockCount} × 4-week block
              {previewResult.preview.plannedBlockCount === 1 ? '' : 's'})
            </Text>
            {/* R3 (REVIEW_BOUNDARY, ratified 2026-08-22): blocks are whole
                4-week units, so the boundary rounds UP to the next whole block
                and can sit up to 27 days after the date entered. The date is a
                planning checkpoint only — it does not schedule a peak or a
                competition, and nothing about the training phases is derived
                from it. Disclosing both is required by the ratified contract. */}
            {horizonKind === 'date' && (
              <Text style={styles.caption}>
                Blocks are whole 4-week units, so this rounds up to the next full block and can fall
                up to 27 days after the date you chose. It is a review checkpoint, not a competition
                date — your training phases are not scheduled around it.
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Training days</Text>
        <Text style={styles.caption}>Day 1 is today. These days repeat every week.</Text>
        <View style={styles.wrap}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Chip key={day} label={DAY_NAME[day - 1]} selected={dayIndices.includes(day)} onPress={() => toggleDay(day)} />
          ))}
        </View>

        {/* Split explainer */}
        <View style={styles.explainerBox}>
          <Text style={styles.explainerText}>
            {splitExplainer(profile.objective, dayIndices.length)}
          </Text>
          <Text style={styles.explainerFooter}>{SPLIT_EXPLAINER_FOOTER}</Text>
        </View>

        {/* Day rows with focus chips */}
        <View style={styles.dayRowsContainer}>
          {dayIndices.map((dayIndex) => {
            const currentFocus = dayFocuses[dayIndex] ?? programFocuses(profile.objective, dayIndices.length)[dayIndices.indexOf(dayIndex)] ?? 'full';
            return (
              <View key={dayIndex} style={styles.dayRow}>
                <Text style={styles.dayRowTitle}>{DAY_NAME[dayIndex - 1]}</Text>
                <View style={styles.focusChipRow}>
                  {BLOCK_FOCUS_LIST.map((focus) => (
                    <Chip
                      key={focus}
                      label={focus}
                      selected={currentFocus === focus}
                      onPress={() => setDayFocus(dayIndex, focus)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Training method</Text>
        {profile.training_age === 'beginner' && (
          <Text style={styles.notice}>Linear is recommended: one clear progression is easiest to learn and review. You can change it.</Text>
        )}
        <View style={styles.wrap}>
          {SELECTABLE_SCHEMA_TYPES.map((method) => (
            <Chip key={method} label={SCHEMA_LABEL[method]} selected={schemaType === method} onPress={() => setSchemaType(method)} />
          ))}
        </View>
      </View>

      {buildMode === 'custom' && weekOne.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Customize generated week</Text>
          {weekOne.map((session) => (
            <View key={session.day_index} style={styles.session}>
              <Text style={styles.sessionTitle}>Day {session.day_index} · {session.focus}</Text>
              {session.slots.map((slot) => {
                const movement = movements.find((item) => item.movement_id === slot.movement_id);
                if (movement === undefined) return null;
                const selectedId = preferences.find((item) =>
                  item.dayIndex === session.day_index && item.slotIndex === slot.slot_index)?.movementId ?? slot.movement_id;
                const accessContext = accessContextForBlockFocus(session.focus as BlockFocus);
                const choices = movements.filter((item) => item.pattern === movement.pattern
                  && availableIdsByContext[accessContext].has(item.movement_id));
                return (
                  <View key={slot.slot_index} style={styles.slot}>
                    <Text style={styles.slotTitle}>{movement.pattern.replace('_', ' ')}</Text>
                    <View style={styles.wrap}>
                      {choices.map((choice) => (
                        <Chip key={choice.movement_id} label={choice.name} selected={selectedId === choice.movement_id}
                          onPress={() => chooseMovement(session.day_index, slot.slot_index, movement.pattern as TrainingProgramMovementPreference['pattern'], choice.movement_id)} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
      </Disclosure>

      {(localError ?? previewResult.error ?? storeError) !== null && (
        <Text style={styles.error}>{localError ?? previewResult.error ?? storeError}</Text>
      )}
      {progressionSummary.length > 0 && (
        <View style={styles.card} testID="weekly-progression-summary">
          <Text style={styles.sectionTitle}>How the weeks progress</Text>
          {progressionSummary.map((line, index) => (
            <Text key={`${index}:${line}`} style={styles.caption}>{line}</Text>
          ))}
        </View>
      )}
      {rankingNotes.length > 0 && (
        <View style={styles.card} testID="ranking-notes-card">
          <Text style={styles.sectionTitle}>Coach decisions in this plan</Text>
          {rankingNotes.map((note) => (
            <Text key={note} style={styles.caption}>{note}</Text>
          ))}
        </View>
      )}
      {missingRequirement !== null && (
        <Text style={styles.caption} accessibilityLiveRegion="polite">
          {missingRequirement}
        </Text>
      )}
      <PrimaryButton label={editing ? 'Save future preferences' : 'Create program'} onPress={confirm}
        disabled={input === null || previewResult.preview === null} />
      {onCancel !== undefined && <SecondaryButton label="Cancel" onPress={onCancel} />}
      <Text style={styles.caption}>Program starts {today}. Future blocks require confirmation.</Text>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[5], paddingBottom: 56, gap: theme.space[4] },
  eyebrow: { color: theme.color.textLow, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.color.textHi, fontSize: 30, fontWeight: '800', textTransform: 'capitalize' },
  body: { color: theme.color.textMid, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, padding: theme.space[4], gap: theme.space[3] },
  sectionTitle: { color: theme.color.textHi, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caption: { color: theme.color.textLow, fontSize: 12, lineHeight: 18 },
  notice: { color: theme.color.textMid, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.color.line, color: theme.color.textHi, paddingHorizontal: 12, fontSize: 16 },
  session: { borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: 12, gap: 10 },
  sessionTitle: { color: theme.color.textHi, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  slot: { gap: 6 },
  slotTitle: { color: theme.color.textMid, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  error: { color: theme.color.textHi, borderLeftWidth: 3, borderLeftColor: theme.color.textHi, paddingLeft: 10 },
  explainerBox: {
    marginTop: theme.space[2],
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    gap: 4,
  },
  explainerText: {
    color: theme.color.textHi,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  explainerFooter: {
    color: theme.color.textLow,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  dayRowsContainer: {
    marginTop: theme.space[2],
    gap: theme.space[3],
  },
  dayRow: {
    paddingTop: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    gap: 6,
  },
  dayRowTitle: {
    color: theme.color.textHi,
    fontSize: 14,
    fontWeight: '700',
  },
  focusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  anchorRow: {
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  anchorName: {
    color: theme.color.textHi,
    fontSize: 13,
    fontWeight: '700',
  },
});
