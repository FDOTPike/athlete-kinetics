/**
 * FocusGoalFields — the two controlled editors behind work order 2:
 *
 *   FocusPicker  — "Is there an area that you want to work on?" Bundles first,
 *                  individual muscle groups on request, every bundle editable.
 *   GoalEditor   — a SMART goal: outcome, measurement and units, baseline or an
 *                  explicit unknown, target, personal reason, deadline or none.
 *
 * Both are presentational and controlled, so the first-run interview and the
 * profile screen share exactly the same questions and the same validation.
 * Nothing here saves anything.
 *
 * Law: zero hex literals; selected = inverted fill, never chalk; 56pt targets.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  FOCUS_BUNDLES,
  FOCUS_BUNDLE_INFO,
  FOCUS_MAX_MUSCLES,
  FOCUS_QUESTION,
  GOAL_METHOD_MAX,
  GOAL_METRICS,
  GOAL_METRIC_INFO,
  GOAL_TEXT_MAX,
  GOAL_UNIT_MAX,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_INFO,
  assessGoalFeasibility,
  describeFocus,
  focusFromBundle,
  normalizeFocusSelection,
  validateSmartGoal,
  type FocusBundleId,
  type GoalField,
  type GoalMetricId,
  type MuscleGroupId,
  type SmartGoalDraft,
  type TrainingAge,
} from '@ak/inference';
import { theme } from '../theme/theme';
import { Chip, QuietAction } from './ui';

/** Today in the device's local calendar, YYYY-MM-DD. Kept here (not imported
 * from the store) so the editors stay usable wherever the store is not. */
export const localIsoToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

export interface FocusDraft {
  readonly bundleId: FocusBundleId | null;
  readonly muscles: readonly MuscleGroupId[];
}

/** No emphasis. The honest default: nothing is assumed about the athlete. */
export const BALANCED_FOCUS_DRAFT: FocusDraft = { bundleId: 'balanced', muscles: [] };

export const focusDraftSummary = (draft: FocusDraft): string => {
  const normalized = normalizeFocusSelection({ bundleId: draft.bundleId, muscles: draft.muscles });
  return normalized.ok ? describeFocus(normalized.selection) : normalized.message;
};

export interface FocusPickerProps {
  value: FocusDraft;
  onChange: (next: FocusDraft) => void;
  /** Whether the individual muscle-group chips are shown. */
  showMuscles: boolean;
  onToggleMuscles: () => void;
}

export function FocusPicker({ value, onChange, showMuscles, onToggleMuscles }: FocusPickerProps): React.JSX.Element {
  const chosen = new Set(value.muscles);
  const atLimit = chosen.size >= FOCUS_MAX_MUSCLES;

  const chooseBundle = (bundleId: FocusBundleId): void => {
    onChange({ bundleId, muscles: focusFromBundle(bundleId).muscles });
  };
  const toggleMuscle = (muscle: MuscleGroupId): void => {
    const next = new Set(chosen);
    if (next.has(muscle)) next.delete(muscle);
    else if (!atLimit) next.add(muscle);
    const muscles = MUSCLE_GROUPS.filter((group) => next.has(group));
    // Hand-picking areas is an emphasis: it is no longer "balanced", and an
    // empty hand-picked set is balanced again.
    const bundleId = muscles.length === 0 ? 'balanced' : value.bundleId === 'balanced' ? null : value.bundleId;
    onChange({ bundleId, muscles });
  };

  return (
    <View testID="focus-picker">
      <Text style={styles.question} accessibilityRole="header">{FOCUS_QUESTION}</Text>
      <Text style={styles.dim}>
        Pick one to start from, then add or remove areas if you like. This changes emphasis only: you still train your whole body, and safety, your equipment and your available time always come first.
      </Text>
      <View style={styles.group}>
        {FOCUS_BUNDLES.map((bundleId) => {
          const bundle = FOCUS_BUNDLE_INFO[bundleId];
          return (
            <Chip
              key={bundleId}
              testID={`focus-bundle-${bundleId}`}
              label={`${bundle.label.toUpperCase()} — ${bundle.description}`}
              selected={value.bundleId === bundleId}
              onPress={() => chooseBundle(bundleId)}
              accessibilityLabel={`${bundle.label}. ${bundle.description}`}
              style={styles.chip}
            />
          );
        })}
      </View>
      <QuietAction
        label={showMuscles ? 'Hide muscle groups' : 'Choose muscle groups myself'}
        onPress={onToggleMuscles}
        accessibilityLabel={showMuscles ? 'Hide individual muscle groups' : 'Choose individual muscle groups'}
      />
      {showMuscles && (
        <View style={styles.wrap} testID="focus-muscle-groups">
          {MUSCLE_GROUPS.map((muscle) => {
            const selected = chosen.has(muscle);
            return (
              <Chip
                key={muscle}
                testID={`focus-muscle-${muscle}`}
                label={MUSCLE_GROUP_INFO[muscle].label.toUpperCase()}
                selected={selected}
                disabled={!selected && atLimit}
                onPress={() => toggleMuscle(muscle)}
                accessibilityLabel={`${MUSCLE_GROUP_INFO[muscle].label}${selected ? ', selected' : ''}`}
                style={styles.wrapChip}
              />
            );
          })}
        </View>
      )}
      {showMuscles && atLimit && (
        <Text style={styles.dim} accessibilityLiveRegion="polite">
          {`That is ${FOCUS_MAX_MUSCLES} areas, the most that still counts as an emphasis. Remove one to add another.`}
        </Text>
      )}
      <Text style={styles.summary} testID="focus-summary" accessibilityLiveRegion="polite">
        {`Selected — ${focusDraftSummary(value)}`}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SMART goal
// ---------------------------------------------------------------------------

export interface GoalFields {
  readonly specificOutcome: string;
  readonly metricId: GoalMetricId;
  readonly unit: string;
  readonly measurementMethod: string;
  readonly baselineKnown: boolean;
  readonly baselineText: string;
  readonly targetText: string;
  readonly reason: string;
  readonly deadlineSet: boolean;
  readonly deadlineText: string;
}

export const EMPTY_GOAL_FIELDS: GoalFields = {
  specificOutcome: '', metricId: 'load_kg', unit: '', measurementMethod: '',
  baselineKnown: true, baselineText: '', targetText: '', reason: '',
  deadlineSet: false, deadlineText: '',
};

/** A typed number, or NaN. A blank field is NOT zero. */
const parseNumber = (text: string): number => {
  const trimmed = text.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};

export const goalDraftFromFields = (fields: GoalFields): SmartGoalDraft => ({
  specificOutcome: fields.specificOutcome,
  metricId: fields.metricId,
  unit: fields.unit,
  measurementMethod: fields.measurementMethod,
  baselineKnown: fields.baselineKnown,
  baselineValue: fields.baselineKnown ? parseNumber(fields.baselineText) : null,
  targetValue: parseNumber(fields.targetText),
  reason: fields.reason,
  requestedDeadline: fields.deadlineSet ? fields.deadlineText.trim() : null,
});

export const goalFieldsFromGoal = (goal: {
  specificOutcome: string; metricId: GoalMetricId; unit: string; measurementMethod: string;
  baselineKnown: boolean; baselineValue: number | null; targetValue: number; reason: string;
  requestedDeadline: string | null;
}): GoalFields => ({
  specificOutcome: goal.specificOutcome,
  metricId: goal.metricId,
  unit: goal.unit,
  measurementMethod: goal.measurementMethod,
  baselineKnown: goal.baselineKnown,
  baselineText: goal.baselineValue === null ? '' : String(goal.baselineValue),
  targetText: String(goal.targetValue),
  reason: goal.reason,
  deadlineSet: goal.requestedDeadline !== null,
  deadlineText: goal.requestedDeadline ?? '',
});

export interface GoalEditorProps {
  fields: GoalFields;
  onChange: (next: GoalFields) => void;
  /** Local date, YYYY-MM-DD, supplied by the caller. */
  today: string;
  trainingAge?: TrainingAge;
  /** Show every problem, not only the ones on fields the athlete has filled. */
  showAllErrors?: boolean;
}

export function GoalEditor({ fields, onChange, today, trainingAge, showAllErrors = false }: GoalEditorProps): React.JSX.Element {
  const patch = (next: Partial<GoalFields>): void => onChange({ ...fields, ...next });
  const validation = validateSmartGoal(goalDraftFromFields(fields), today);
  const metric = GOAL_METRIC_INFO[fields.metricId];
  const unit = metric.unit ?? (fields.unit.trim().length > 0 ? fields.unit.trim() : 'your unit');
  const errorFor = (field: GoalField, touched: boolean): string | null => {
    if (validation.ok || (!touched && !showAllErrors)) return null;
    return validation.errors.find((error) => error.field === field)?.message ?? null;
  };
  const feasibility = validation.ok ? assessGoalFeasibility(validation.goal, { today, trainingAge }) : null;
  const fieldError = (field: GoalField, touched: boolean): React.JSX.Element | null => {
    const message = errorFor(field, touched);
    return message === null ? null : (
      <Text style={styles.error} accessibilityRole="alert" testID={`goal-error-${field}`}>{message}</Text>
    );
  };

  return (
    <View testID="goal-editor">
      <Text style={styles.label}>WHAT EXACTLY DO YOU WANT TO ACHIEVE?</Text>
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={fields.specificOutcome}
        onChangeText={(specificOutcome) => patch({ specificOutcome })}
        maxLength={GOAL_TEXT_MAX}
        placeholder="For example: squat 100 kg for 5 reps"
        placeholderTextColor={theme.color.textLow}
        accessibilityLabel="The specific outcome you want"
        testID="goal-outcome"
      />
      {fieldError('specificOutcome', fields.specificOutcome.length > 0)}

      <Text style={styles.label}>WHAT WILL YOU MEASURE?</Text>
      <View style={styles.wrap}>
        {GOAL_METRICS.map((metricId) => (
          <Chip
            key={metricId}
            testID={`goal-metric-${metricId}`}
            label={GOAL_METRIC_INFO[metricId].label.toUpperCase()}
            selected={fields.metricId === metricId}
            onPress={() => patch({ metricId })}
            accessibilityLabel={`Measure ${GOAL_METRIC_INFO[metricId].label.toLowerCase()}`}
            style={styles.wrapChip}
          />
        ))}
      </View>
      {metric.unit === null && (
        <>
          <Text style={styles.label}>IN WHAT UNIT?</Text>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.unit}
            onChangeText={(unitText) => patch({ unit: unitText })}
            maxLength={GOAL_UNIT_MAX}
            placeholder="For example: rounds"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="The unit you will measure in"
            testID="goal-unit"
          />
          {fieldError('unit', fields.unit.length > 0)}
        </>
      )}

      <Text style={styles.label}>HOW WILL YOU MEASURE IT?</Text>
      <Text style={styles.dim}>{metric.methodPrompt}</Text>
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={fields.measurementMethod}
        onChangeText={(measurementMethod) => patch({ measurementMethod })}
        maxLength={GOAL_METHOD_MAX}
        placeholder="The same way every time"
        placeholderTextColor={theme.color.textLow}
        accessibilityLabel="How you will measure it"
        testID="goal-method"
      />
      {fieldError('measurementMethod', fields.measurementMethod.length > 0)}

      <Text style={styles.label}>WHERE ARE YOU NOW?</Text>
      <View style={styles.group}>
        <Chip
          testID="goal-baseline-known"
          label="I KNOW MY NUMBER"
          selected={fields.baselineKnown}
          onPress={() => patch({ baselineKnown: true })}
          accessibilityLabel="I know my starting number"
          style={styles.chip}
        />
        <Chip
          testID="goal-baseline-unknown"
          label="I DO NOT KNOW YET"
          selected={!fields.baselineKnown}
          onPress={() => patch({ baselineKnown: false, baselineText: '' })}
          accessibilityLabel="I do not know my starting number yet"
          style={styles.chip}
        />
      </View>
      {fields.baselineKnown ? (
        <>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.baselineText}
            onChangeText={(baselineText) => patch({ baselineText })}
            keyboardType="decimal-pad"
            maxLength={10}
            placeholder={`Your number now, in ${unit}`}
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel={`Where you are now, in ${unit}`}
            testID="goal-baseline"
          />
          {fieldError('baselineValue', fields.baselineText.length > 0)}
        </>
      ) : (
        <Text style={styles.dim}>
          That is fine. Nothing is assumed in its place; record a first measurement when you can and it becomes your starting point.
        </Text>
      )}

      <Text style={styles.label}>YOUR TARGET</Text>
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={fields.targetText}
        onChangeText={(targetText) => patch({ targetText })}
        keyboardType="decimal-pad"
        maxLength={10}
        placeholder={`The number you are aiming for, in ${unit}`}
        placeholderTextColor={theme.color.textLow}
        accessibilityLabel={`Your target, in ${unit}`}
        testID="goal-target"
      />
      {fieldError('targetValue', fields.targetText.length > 0)}

      <Text style={styles.label}>WHY DOES THIS MATTER TO YOU?</Text>
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={fields.reason}
        onChangeText={(reason) => patch({ reason })}
        maxLength={GOAL_TEXT_MAX}
        placeholder="In your own words"
        placeholderTextColor={theme.color.textLow}
        accessibilityLabel="Why this goal matters to you"
        testID="goal-reason"
      />
      {fieldError('reason', fields.reason.length > 0)}

      <Text style={styles.label}>BY WHEN?</Text>
      <View style={styles.group}>
        <Chip
          testID="goal-deadline-none"
          label="NO DEADLINE"
          selected={!fields.deadlineSet}
          onPress={() => patch({ deadlineSet: false, deadlineText: '' })}
          accessibilityLabel="No deadline"
          style={styles.chip}
        />
        <Chip
          testID="goal-deadline-set"
          label="SET A DATE"
          selected={fields.deadlineSet}
          onPress={() => patch({ deadlineSet: true })}
          accessibilityLabel="Set a deadline date"
          style={styles.chip}
        />
      </View>
      {fields.deadlineSet && (
        <>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.deadlineText}
            onChangeText={(deadlineText) => patch({ deadlineText })}
            maxLength={10}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="Deadline date, as year, month, day"
            testID="goal-deadline"
          />
          {fieldError('requestedDeadline', fields.deadlineText.length > 0)}
        </>
      )}
      <Text style={styles.dim}>
        The date is yours. Your plan is still reviewed every four weeks, and it is never rushed, peaked or tested to a maximum for a date.
      </Text>

      {feasibility !== null && (
        <View style={styles.assessment} testID="goal-feasibility">
          <Text style={styles.assessmentTitle} accessibilityRole="header">WHAT THIS ASKS FOR</Text>
          <Text style={styles.body} testID="goal-feasibility-explanation">{feasibility.explanation}</Text>
          <Text style={styles.dim} testID="goal-feasibility-uncertainty">{feasibility.uncertainty}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  question: { ...theme.font.title, color: theme.color.textHi, fontSize: 20, marginBottom: theme.space[3] },
  label: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[3], marginBottom: theme.space[2] },
  dim: { ...theme.font.body, color: theme.color.textMid, marginBottom: theme.space[3] },
  body: { ...theme.font.body, color: theme.color.textHi, marginBottom: theme.space[2] },
  summary: { ...theme.font.label, color: theme.color.textHi, marginTop: theme.space[3], marginBottom: theme.space[3] },
  error: { ...theme.font.label, color: theme.color.textHi, marginTop: theme.space[1], marginBottom: theme.space[2] },
  group: { gap: theme.space[2], marginBottom: theme.space[2] },
  chip: { marginBottom: theme.space[1] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], marginBottom: theme.space[2] },
  wrapChip: { marginBottom: theme.space[1] },
  input: {
    backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, borderRadius: theme.radius.control,
    color: theme.color.textHi, ...theme.font.body, minHeight: theme.touch.min, paddingHorizontal: theme.space[3],
  },
  assessment: {
    marginTop: theme.space[3], padding: theme.space[4], borderWidth: 1, borderColor: theme.color.line,
    borderRadius: theme.radius.control, backgroundColor: theme.color.ink1,
  },
  assessmentTitle: { ...theme.font.eyebrow, color: theme.color.textHi, marginBottom: theme.space[2] },
});
