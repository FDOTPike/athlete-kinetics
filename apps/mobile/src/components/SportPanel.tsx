/**
 * SportPanel — review and edit the sport answer from the Athlete profile
 * (work order 3).
 *
 * What it guarantees to the athlete:
 *   - changing or removing the sport never rewrites a plan that already
 *     exists; the panel says the change is used when the next block is made;
 *   - the weekly sport workload shown is exactly what the next block will be
 *     planned with, and says where it came from (the Activities schedule, or
 *     the numbers given with the sport answer);
 *   - what the plan will do about the chosen outcome, and what it cannot do,
 *     is stated before and after saving.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  SPORT_EXPERIENCE_LABEL,
  SPORT_OUTCOME_LABEL,
  sportDisplayName,
  sportEmphasisFor,
  sportWorkloadEffect,
  validateSportProfile,
  type SportProfile,
  type SportWorkload,
} from '@ak/inference';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import { PrimaryButton, SecondaryButton } from './ui';
import { localIsoToday } from './FocusGoalFields';
import {
  EMPTY_SPORT_FIELDS,
  SPORT_QUESTION,
  SportEditor,
  sportDraftFromFields,
  sportFieldsFromProfile,
  type SportFieldsState,
} from './SportFields';

/**
 * #176: what removing the sport will change, said before it happens. Only the
 * next block is affected; the competition date goes with the sport answer.
 */
export const removeSportText = (sport: SportProfile, workload: SportWorkload): string => {
  const counted = workload.source === 'stated'
    ? ', and the weekly sport numbers you gave will no longer be counted'
    : workload.source === 'schedule'
      ? '. Your Activities schedule is kept and still counted'
      : '';
  const date = sport.competitionDate === null ? '' : ` Your competition date (${sport.competitionDate}) is removed too.`;
  return `Remove ${sportDisplayName(sport)}? Your next block will be planned without your sport${counted}.${date} Your current plan is unchanged.`;
};

export function SportPanel(): React.JSX.Element | null {
  const ready = useStore((s) => s.status === 'ready');
  const sport = useStore((s) => s.sport) ?? null;
  const workload = useStore((s) => s.sportWorkload);
  const saveSport = useStore((s) => s.saveSport);
  const refreshSport = useStore((s) => s.refreshSport);

  const [fields, setFields] = useState<SportFieldsState | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // The schedule may have changed on another screen since this one was shown.
  useEffect(() => {
    if (ready && typeof refreshSport === 'function') refreshSport();
  }, [ready, refreshSport]);

  // Component tests drive the profile screen with partial store states; the
  // panel needs the real actions to be useful and renders nothing without them.
  if (!ready || typeof saveSport !== 'function' || workload === undefined) return null;

  const today = localIsoToday();
  const storeError = (): string => useStore.getState().error ?? 'That could not be saved.';
  const NEXT_BLOCK = 'Your current plan is unchanged; this is used when your next block is created.';

  const beginEdit = (): void => {
    setFields(sport === null ? EMPTY_SPORT_FIELDS : sportFieldsFromProfile(sport));
    setShowErrors(false);
    setMessage(null);
    setConfirmingRemove(false);
  };
  const commit = (): void => {
    if (fields === null) return;
    const draft = sportDraftFromFields(fields);
    if (!validateSportProfile(draft, today).ok) { setShowErrors(true); return; }
    if (saveSport(draft)) {
      setFields(null);
      setMessage(`Sport saved. ${NEXT_BLOCK}`);
    } else setMessage(storeError());
  };
  const remove = (): void => {
    setConfirmingRemove(false);
    if (saveSport(null)) {
      setFields(null);
      setMessage(`Sport removed. ${NEXT_BLOCK}`);
    } else setMessage(storeError());
  };

  const emphasis = sport === null ? null : sportEmphasisFor(sport);

  return (
    <View style={styles.panel} testID="sport-panel">
      <Text style={styles.heading} accessibilityRole="header">SPORT</Text>
      {sport === null ? (
        <Text style={styles.body} testID="profile-sport-summary">
          No sport set. The plan is general gym training.
        </Text>
      ) : (
        <>
          <Text style={styles.body} testID="profile-sport-summary">
            {`${sportDisplayName(sport)} — ${SPORT_OUTCOME_LABEL[sport.outcomeId].toLowerCase()}. Played: ${SPORT_EXPERIENCE_LABEL[sport.experienceId].toLowerCase()}.`}
          </Text>
          {emphasis !== null && <Text style={styles.dim} testID="profile-sport-emphasis">{emphasis.summary}</Text>}
          {sport.competitionDate !== null && (
            <Text style={styles.dim} testID="profile-sport-competition">
              {`Next competition: ${sport.competitionDate}. It is used for reminders and goal review only.`}
            </Text>
          )}
        </>
      )}
      {/* #176: said of the next block, in the future tense: nothing changes until one is made. */}
      <Text style={styles.dim} testID="profile-sport-workload">{sportWorkloadEffect(workload).nextBlockExplanation}</Text>

      {fields === null && confirmingRemove && sport !== null ? (
        <View style={styles.actions} testID="profile-sport-remove-confirmation">
          <Text style={styles.body} testID="profile-sport-remove-text">{removeSportText(sport, workload)}</Text>
          <PrimaryButton label="REMOVE SPORT" onPress={remove}
            accessibilityLabel="Remove the sport" testID="profile-sport-remove-confirm" />
          <SecondaryButton label="KEEP SPORT" fullWidth onPress={() => setConfirmingRemove(false)}
            accessibilityLabel="Keep the sport" testID="profile-sport-remove-keep" />
        </View>
      ) : fields === null ? (
        <View style={styles.actions}>
          <SecondaryButton label={sport === null ? 'ADD A SPORT' : 'CHANGE SPORT'} fullWidth onPress={beginEdit}
            accessibilityLabel={sport === null ? 'Add a sport' : 'Change your sport answer'} testID="profile-sport-edit" />
          {sport !== null && (
            <SecondaryButton label="I NO LONGER PLAY A SPORT" fullWidth onPress={() => { setMessage(null); setConfirmingRemove(true); }}
              accessibilityLabel="Remove the sport. Your plan becomes general gym training from the next block."
              testID="profile-sport-remove" />
          )}
        </View>
      ) : (
        <View>
          <Text style={styles.question} accessibilityRole="header">{SPORT_QUESTION}</Text>
          <SportEditor fields={fields} onChange={setFields} today={today} showAllErrors={showErrors} />
          <Text style={styles.dim}>Saving does not change your current plan. It is used when your next block is created.</Text>
          <View style={styles.actions}>
            <PrimaryButton label="SAVE SPORT" onPress={commit}
              accessibilityLabel="Save your sport answer" testID="profile-sport-save" />
            <SecondaryButton label="CANCEL" fullWidth onPress={() => setFields(null)}
              accessibilityLabel="Cancel changing the sport" testID="profile-sport-cancel" />
          </View>
        </View>
      )}

      {message !== null && (
        <Text style={styles.message} accessibilityLiveRegion="polite" testID="sport-panel-message">{message}</Text>
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
  question: { ...theme.font.title, color: theme.color.textHi, fontSize: 20, marginTop: theme.space[3] },
  body: { ...theme.font.body, color: theme.color.textHi },
  dim: { ...theme.font.body, color: theme.color.textMid },
  message: { ...theme.font.label, color: theme.color.textHi, marginTop: theme.space[2] },
  actions: { gap: theme.space[2], marginTop: theme.space[2] },
});

export default SportPanel;
