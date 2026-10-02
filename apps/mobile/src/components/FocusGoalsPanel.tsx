/**
 * FocusGoalsPanel — review and edit the training focus and SMART goals from
 * the Athlete profile (work order 2).
 *
 * What it guarantees to the athlete:
 *   - changing the focus or a goal never rewrites a plan that already exists;
 *     the note under each editor says when the change takes effect;
 *   - editing a goal keeps its earlier definition and every measurement;
 *   - progress is shown only from measurements they recorded;
 *   - nothing here promises an outcome.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  MAX_ACTIVE_GOALS,
  assessGoalFeasibility,
  describeFocus,
  goalProgress,
  validateSmartGoal,
  type FocusBundleId,
  type MuscleGroupId,
} from '@ak/inference';
import { useStore } from '../state/useStore';
import type { StoredFocus, StoredGoal } from '../state/focusGoalStore';
import { theme } from '../theme/theme';
import { Disclosure, PrimaryButton, SecondaryButton } from './ui';
import {
  BALANCED_FOCUS_DRAFT,
  EMPTY_GOAL_FIELDS,
  FocusPicker,
  GoalEditor,
  goalDraftFromFields,
  goalFieldsFromGoal,
  localIsoToday,
  type FocusDraft,
  type GoalFields,
} from './FocusGoalFields';

const draftFromFocus = (focus: StoredFocus | null): FocusDraft => focus === null
  ? BALANCED_FOCUS_DRAFT
  : { bundleId: focus.bundleId as FocusBundleId | null, muscles: focus.muscles as readonly MuscleGroupId[] };

export function FocusGoalsPanel(): React.JSX.Element | null {
  const ready = useStore((s) => s.status === 'ready');
  const focus = useStore((s) => s.focus) ?? null;
  const goals = useStore((s) => s.goals) ?? [];
  const trainingAge = useStore((s) => s.profile.training_age);
  const saveFocus = useStore((s) => s.saveFocus);
  const saveGoal = useStore((s) => s.saveGoal);
  const setGoalStatus = useStore((s) => s.setGoalStatus);
  const recordGoalObservation = useStore((s) => s.recordGoalObservation);
  const removeGoalObservation = useStore((s) => s.removeGoalObservation);

  const [focusDraft, setFocusDraft] = useState<FocusDraft | null>(null);
  const [showMuscles, setShowMuscles] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | 'new' | null>(null);
  const [goalFields, setGoalFields] = useState<GoalFields>(EMPTY_GOAL_FIELDS);
  const [showErrors, setShowErrors] = useState(false);
  const [measuringGoalId, setMeasuringGoalId] = useState<string | null>(null);
  const [measureValue, setMeasureValue] = useState('');
  const [measureDate, setMeasureDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Component tests drive the profile screen with partial store states; the
  // panel needs the real actions to be useful and renders nothing without them.
  if (!ready || typeof saveFocus !== 'function' || typeof saveGoal !== 'function') return null;

  const today = localIsoToday();
  const activeCount = goals.filter((goal) => goal.status === 'active').length;
  const storeError = (): string => useStore.getState().error ?? 'That could not be saved.';

  const beginFocusEdit = (): void => { setFocusDraft(draftFromFocus(focus)); setMessage(null); };
  const commitFocus = (): void => {
    if (focusDraft === null) return;
    if (saveFocus({ bundleId: focusDraft.bundleId, muscles: focusDraft.muscles })) {
      setFocusDraft(null);
      setMessage('Focus saved. Your current plan is unchanged; the new focus is used when your next block is created.');
    } else setMessage(storeError());
  };

  const beginGoalEdit = (goal: StoredGoal | null): void => {
    setEditingGoalId(goal === null ? 'new' : goal.goalId);
    setGoalFields(goal === null ? EMPTY_GOAL_FIELDS : goalFieldsFromGoal(goal.goal));
    setShowErrors(false);
    setMessage(null);
  };
  const commitGoal = (): void => {
    const draft = goalDraftFromFields(goalFields);
    if (!validateSmartGoal(draft, today).ok) { setShowErrors(true); return; }
    const existing = goals.find((goal) => goal.goalId === editingGoalId);
    const saved = existing === undefined
      ? saveGoal(draft)
      : saveGoal(draft, { goalId: existing.goalId, expectedRevision: existing.revision });
    if (saved) {
      setEditingGoalId(null);
      setMessage(existing === undefined
        ? 'Goal saved.'
        : 'Goal updated. Its earlier version and your recorded measurements are kept as they were.');
    } else setMessage(storeError());
  };

  const beginMeasure = (goalId: string): void => {
    setMeasuringGoalId(goalId);
    setMeasureValue('');
    setMeasureDate(today);
    setMessage(null);
  };
  const commitMeasure = (): void => {
    if (measuringGoalId === null) return;
    const text = measureValue.trim().replace(',', '.');
    const value = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
    if (recordGoalObservation(measuringGoalId, measureDate.trim(), value)) {
      setMeasuringGoalId(null);
      setMessage('Measurement recorded.');
    } else setMessage(storeError());
  };

  return (
    <View style={styles.panel} testID="focus-goals-panel">
      <Text style={styles.heading} accessibilityRole="header">TRAINING FOCUS</Text>
      <Text style={styles.body} testID="profile-focus-summary">
        {focus === null ? 'Not answered yet. Balanced whole body is used until you choose.' : describeFocus(focus)}
      </Text>
      {focusDraft === null ? (
        <SecondaryButton label="CHANGE FOCUS" fullWidth onPress={beginFocusEdit}
          accessibilityLabel="Change your training focus" testID="profile-focus-edit" />
      ) : (
        <View>
          <FocusPicker value={focusDraft} onChange={setFocusDraft}
            showMuscles={showMuscles} onToggleMuscles={() => setShowMuscles((visible) => !visible)} />
          <Text style={styles.dim}>
            Saving does not change your current plan. The focus is used when your next block is created.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="SAVE FOCUS" onPress={commitFocus}
              accessibilityLabel="Save your training focus" testID="profile-focus-save" />
            <SecondaryButton label="CANCEL" fullWidth onPress={() => setFocusDraft(null)}
              accessibilityLabel="Cancel changing the focus" testID="profile-focus-cancel" />
          </View>
        </View>
      )}

      <Text style={[styles.heading, styles.gap]} accessibilityRole="header">GOALS</Text>
      {goals.length === 0 && (
        <Text style={styles.dim} testID="profile-goals-empty">
          No goals set. That is fine — you can train with the focus alone.
        </Text>
      )}
      {goals.map((stored) => {
        const progress = goalProgress(stored.goal, stored.observations);
        const feasibility = assessGoalFeasibility(stored.goal, { today, trainingAge });
        const deadline = stored.goal.requestedDeadline === null ? 'no deadline' : `by ${stored.goal.requestedDeadline}`;
        return (
          <View key={stored.goalId} style={styles.goal} testID={`profile-goal-${stored.goalId}`}>
            <Text style={styles.goalTitle} accessibilityRole="header">{stored.goal.specificOutcome}</Text>
            <Text style={styles.body}>
              {`Target ${stored.goal.targetValue} ${stored.goal.unit}, ${deadline}${stored.status === 'active' ? '' : ` · ${stored.status}`}`}
            </Text>
            <Text style={styles.dim}>{`Measured: ${stored.goal.measurementMethod}`}</Text>
            <Text style={styles.dim}>{`Why: ${stored.goal.reason}`}</Text>
            <Text style={styles.body} testID={`profile-goal-progress-${stored.goalId}`}>{progress.summary}</Text>
            <Disclosure label="WHAT THIS ASKS FOR" testID={`profile-goal-feasibility-${stored.goalId}`}>
              <Text style={styles.body}>{feasibility.explanation}</Text>
              <Text style={styles.dim}>{feasibility.uncertainty}</Text>
            </Disclosure>
            {stored.observations.length > 0 && (
              <Disclosure label={`MEASUREMENTS (${stored.observations.length})`}>
                {stored.observations.map((observation) => (
                  <View key={observation.observationId} style={styles.observation}>
                    <Text style={styles.body}>{`${observation.observedOn}: ${observation.value} ${observation.unit}`}</Text>
                    <SecondaryButton label="REMOVE" onPress={() => removeGoalObservation(observation.observationId)}
                      accessibilityLabel={`Remove the measurement of ${observation.value} ${observation.unit} on ${observation.observedOn}`} />
                  </View>
                ))}
              </Disclosure>
            )}
            {measuringGoalId === stored.goalId ? (
              <View style={styles.editor}>
                <Text style={styles.label}>{`MEASUREMENT IN ${stored.goal.unit.toUpperCase()}`}</Text>
                <TextInput
                  disableFullscreenUI
                  style={styles.input}
                  value={measureValue}
                  onChangeText={setMeasureValue}
                  keyboardType="decimal-pad"
                  maxLength={10}
                  placeholder={`What you measured, in ${stored.goal.unit}`}
                  placeholderTextColor={theme.color.textLow}
                  accessibilityLabel={`Measurement in ${stored.goal.unit}`}
                  testID="profile-goal-measure-value"
                />
                <Text style={styles.label}>DATE MEASURED</Text>
                <TextInput
                  disableFullscreenUI
                  style={styles.input}
                  value={measureDate}
                  onChangeText={setMeasureDate}
                  maxLength={10}
                  autoCapitalize="none"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.color.textLow}
                  accessibilityLabel="Date measured, as year, month, day"
                  testID="profile-goal-measure-date"
                />
                <Text style={styles.dim}>Record only what you actually measured, the way your method says.</Text>
                <View style={styles.actions}>
                  <PrimaryButton label="SAVE MEASUREMENT" onPress={commitMeasure}
                    accessibilityLabel="Save this measurement" testID="profile-goal-measure-save" />
                  <SecondaryButton label="CANCEL" fullWidth onPress={() => setMeasuringGoalId(null)}
                    accessibilityLabel="Cancel recording a measurement" />
                </View>
              </View>
            ) : editingGoalId === stored.goalId ? null : (
              <View style={styles.actions}>
                <SecondaryButton label="RECORD A MEASUREMENT" fullWidth onPress={() => beginMeasure(stored.goalId)}
                  accessibilityLabel={`Record a measurement for ${stored.goal.specificOutcome}`}
                  testID={`profile-goal-measure-${stored.goalId}`} />
                <SecondaryButton label="EDIT GOAL" fullWidth onPress={() => beginGoalEdit(stored)}
                  accessibilityLabel={`Edit the goal ${stored.goal.specificOutcome}`}
                  testID={`profile-goal-edit-${stored.goalId}`} />
                {stored.status === 'active' ? (
                  <>
                    <SecondaryButton label="MARK ACHIEVED" fullWidth onPress={() => setGoalStatus(stored.goalId, 'achieved')}
                      accessibilityLabel={`Mark the goal ${stored.goal.specificOutcome} as achieved`} />
                    <SecondaryButton label="RETIRE GOAL" fullWidth onPress={() => setGoalStatus(stored.goalId, 'retired')}
                      accessibilityLabel={`Retire the goal ${stored.goal.specificOutcome}. It is kept, not deleted.`} />
                  </>
                ) : (
                  <SecondaryButton label="MAKE ACTIVE AGAIN" fullWidth
                    onPress={() => { if (!setGoalStatus(stored.goalId, 'active')) setMessage(storeError()); }}
                    accessibilityLabel={`Make the goal ${stored.goal.specificOutcome} active again`} />
                )}
              </View>
            )}
          </View>
        );
      })}

      {editingGoalId !== null ? (
        <View style={styles.editor} testID="profile-goal-editor">
          <Text style={styles.heading} accessibilityRole="header">{editingGoalId === 'new' ? 'NEW GOAL' : 'EDIT GOAL'}</Text>
          <GoalEditor fields={goalFields} onChange={setGoalFields} today={today}
            trainingAge={trainingAge} showAllErrors={showErrors} />
          <Text style={styles.dim}>
            A goal does not change your current plan or its four-week reviews. Editing keeps the earlier version and your measurements.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="SAVE GOAL" onPress={commitGoal}
              accessibilityLabel="Save this goal" testID="profile-goal-save" />
            <SecondaryButton label="CANCEL" fullWidth onPress={() => setEditingGoalId(null)}
              accessibilityLabel="Cancel editing the goal" testID="profile-goal-cancel" />
          </View>
        </View>
      ) : activeCount < MAX_ACTIVE_GOALS ? (
        <SecondaryButton label="ADD A GOAL" fullWidth onPress={() => beginGoalEdit(null)}
          accessibilityLabel="Add a goal" testID="profile-goal-add" />
      ) : (
        <Text style={styles.dim}>{`You have ${MAX_ACTIVE_GOALS} active goals. Retire one before adding another.`}</Text>
      )}

      {message !== null && (
        <Text style={styles.message} accessibilityLiveRegion="polite" testID="focus-goals-message">{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: theme.space[4], padding: theme.space[4], borderWidth: 1, borderColor: theme.color.line,
    borderRadius: theme.radius.control, backgroundColor: theme.color.ink1, gap: theme.space[2],
  },
  heading: { ...theme.font.eyebrow, color: theme.color.textHi },
  gap: { marginTop: theme.space[4] },
  body: { ...theme.font.body, color: theme.color.textHi },
  dim: { ...theme.font.body, color: theme.color.textMid },
  label: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[2] },
  message: { ...theme.font.label, color: theme.color.textHi, marginTop: theme.space[2] },
  goal: {
    padding: theme.space[3], borderWidth: 1, borderColor: theme.color.line,
    borderRadius: theme.radius.control, gap: theme.space[2],
  },
  goalTitle: { ...theme.font.cue, color: theme.color.textHi },
  observation: { gap: theme.space[2], marginBottom: theme.space[2] },
  actions: { gap: theme.space[2], marginTop: theme.space[2] },
  editor: { gap: theme.space[2], marginTop: theme.space[2] },
  input: {
    backgroundColor: theme.color.ink0, borderWidth: 1, borderColor: theme.color.line, borderRadius: theme.radius.control,
    color: theme.color.textHi, ...theme.font.body, minHeight: theme.touch.min, paddingHorizontal: theme.space[3],
  },
});

export default FocusGoalsPanel;
