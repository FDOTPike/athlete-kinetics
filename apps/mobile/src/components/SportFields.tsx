/**
 * SportFields — the sport questions (work order 3), as one controlled editor
 * shared by the first-run interview and the Athlete profile:
 *
 *   which sport (football and hockey are told apart explicitly; "another
 *   sport" is always there), what the athlete wants from training for it, how
 *   long they have played, how much they train and play in a normal week, and
 *   an optional next competition.
 *
 * What it guarantees to the athlete:
 *   - "Not sure" is a complete answer for every workload number, and it is the
 *     starting answer: nothing is assumed;
 *   - the moment an outcome is chosen, the editor says what the plan will do
 *     about it AND what it cannot do — before anything is saved;
 *   - a competition date is context only, and the screen says so.
 *
 * Nothing here saves anything.
 *
 * Law: zero hex literals; selected = inverted fill, never chalk; 56pt targets.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  COMPETITION_DATE_NOTE,
  SPORT_EXPERIENCE,
  SPORT_EXPERIENCE_LABEL,
  SPORT_FAMILIES,
  SPORT_FAMILY_LABEL,
  SPORT_INFO,
  SPORT_OTHER_NAME_MAX,
  SPORT_OUTCOMES_BY_SPORT,
  SPORT_OUTCOME_LABEL,
  SPORT_SESSIONS_PER_WEEK_MAX,
  sportDisplayName,
  sportEmphasisFor,
  sportsInFamily,
  validateSportProfile,
  type SportExperienceId,
  type SportFamilyId,
  type SportField,
  type SportId,
  type SportOutcomeId,
  type SportProfile,
  type SportProfileDraft,
} from '@ak/inference';
import { theme } from '../theme/theme';
import { Chip, Stepper } from './ui';

export const SPORT_QUESTION = 'Do you play or compete in a sport?';

export interface SportFieldsState {
  readonly family: SportFamilyId | null;
  readonly sportId: SportId | null;
  readonly otherSportName: string;
  readonly outcomeId: SportOutcomeId | null;
  readonly experienceId: SportExperienceId | null;
  /** null = "not sure". */
  readonly practiceSessionsPerWeek: number | null;
  readonly matchesPerWeek: number | null;
  /** Blank = "not sure". */
  readonly minutesText: string;
  /** Blank = no competition date. */
  readonly competitionText: string;
}

export const EMPTY_SPORT_FIELDS: SportFieldsState = {
  family: null, sportId: null, otherSportName: '', outcomeId: null, experienceId: null,
  practiceSessionsPerWeek: null, matchesPerWeek: null, minutesText: '', competitionText: '',
};

/** A typed whole number, or NaN. A blank field is "not sure", never zero. */
const parseMinutes = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};

export const sportDraftFromFields = (fields: SportFieldsState): SportProfileDraft => ({
  sportId: fields.sportId ?? '',
  otherSportName: fields.sportId === 'other' ? fields.otherSportName : null,
  outcomeId: fields.outcomeId ?? '',
  experienceId: fields.experienceId ?? '',
  practiceSessionsPerWeek: fields.practiceSessionsPerWeek,
  matchesPerWeek: fields.matchesPerWeek,
  typicalSessionMinutes: parseMinutes(fields.minutesText),
  competitionDate: fields.competitionText.trim().length === 0 ? null : fields.competitionText.trim(),
});

export const sportFieldsFromProfile = (profile: SportProfile): SportFieldsState => ({
  family: SPORT_INFO[profile.sportId].family,
  sportId: profile.sportId,
  otherSportName: profile.otherSportName ?? '',
  outcomeId: profile.outcomeId,
  experienceId: profile.experienceId,
  practiceSessionsPerWeek: profile.practiceSessionsPerWeek,
  matchesPerWeek: profile.matchesPerWeek,
  minutesText: profile.typicalSessionMinutes === null ? '' : String(profile.typicalSessionMinutes),
  competitionText: profile.competitionDate ?? '',
});

/** One line for a review screen, e.g. "Football (soccer) — run faster and change direction". */
export const sportFieldsSummary = (fields: SportFieldsState): string => {
  if (fields.sportId === null || fields.outcomeId === null) return 'Not answered.';
  const name = sportDisplayName({ sportId: fields.sportId, otherSportName: fields.otherSportName });
  return `${name} — ${SPORT_OUTCOME_LABEL[fields.outcomeId].toLowerCase()}`;
};

export interface SportEditorProps {
  fields: SportFieldsState;
  onChange: (next: SportFieldsState) => void;
  /** Local date, YYYY-MM-DD, supplied by the caller. */
  today: string;
  /** Show every problem, not only the ones on fields the athlete has touched. */
  showAllErrors?: boolean;
}

export function SportEditor({ fields, onChange, today, showAllErrors = false }: SportEditorProps): React.JSX.Element {
  const patch = (next: Partial<SportFieldsState>): void => onChange({ ...fields, ...next });
  const validation = validateSportProfile(sportDraftFromFields(fields), today);
  const fieldError = (field: SportField, touched: boolean): React.JSX.Element | null => {
    if (validation.ok || (!touched && !showAllErrors)) return null;
    const message = validation.errors.find((error) => error.field === field)?.message;
    return message === undefined ? null : (
      <Text style={styles.error} accessibilityRole="alert" testID={`sport-error-${field}`}>{message}</Text>
    );
  };

  const chooseFamily = (family: SportFamilyId): void => {
    const members = sportsInFamily(family);
    // A family with one code IS the sport. Football and hockey wait for the
    // athlete to say which: the app never picks one for them.
    patch({ family, sportId: members.length === 1 ? members[0]! : null, outcomeId: null });
  };
  const chooseSport = (sportId: SportId): void => patch({ sportId, outcomeId: null });
  const members = fields.family === null ? [] : sportsInFamily(fields.family);
  const emphasis = fields.sportId !== null && fields.outcomeId !== null
    ? sportEmphasisFor({ sportId: fields.sportId, outcomeId: fields.outcomeId, otherSportName: fields.otherSportName })
    : null;

  const count = (value: number | null): string => (value === null ? 'Not sure' : String(value));
  const step = (value: number | null, delta: number): number =>
    Math.max(0, Math.min(SPORT_SESSIONS_PER_WEEK_MAX, (value ?? 0) + (value === null && delta < 0 ? 0 : delta)));

  return (
    <View testID="sport-editor">
      <Text style={styles.label}>WHICH SPORT?</Text>
      <View style={styles.wrap}>
        {SPORT_FAMILIES.map((family) => (
          <Chip
            key={family}
            testID={`sport-family-${family}`}
            label={SPORT_FAMILY_LABEL[family].toUpperCase()}
            selected={fields.family === family}
            onPress={() => chooseFamily(family)}
            accessibilityLabel={SPORT_FAMILY_LABEL[family]}
            style={styles.wrapChip}
          />
        ))}
      </View>
      {fieldError('sportId', fields.family !== null && members.length === 1)}

      {members.length > 1 && (
        <>
          <Text style={styles.label}>{`WHICH KIND OF ${SPORT_FAMILY_LABEL[fields.family!].toUpperCase()}?`}</Text>
          <View style={styles.group}>
            {members.map((sportId) => (
              <Chip
                key={sportId}
                testID={`sport-${sportId}`}
                label={`${SPORT_INFO[sportId].label.toUpperCase()} — ${SPORT_INFO[sportId].distinction ?? ''}`}
                selected={fields.sportId === sportId}
                onPress={() => chooseSport(sportId)}
                accessibilityLabel={`${SPORT_INFO[sportId].label}. ${SPORT_INFO[sportId].distinction ?? ''}`}
                style={styles.chip}
              />
            ))}
          </View>
        </>
      )}

      {fields.sportId === 'other' && (
        <>
          <Text style={styles.label}>WHAT IS YOUR SPORT CALLED?</Text>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.otherSportName}
            onChangeText={(otherSportName) => patch({ otherSportName })}
            maxLength={SPORT_OTHER_NAME_MAX}
            placeholder="For example: netball"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="The name of your sport"
            testID="sport-other-name"
          />
          {fieldError('otherSportName', fields.otherSportName.length > 0)}
          <Text style={styles.dim}>
            The app has no sport-specific evidence for a sport it does not list. You still get an honest general plan, and your weekly sessions still count.
          </Text>
        </>
      )}

      {fields.sportId !== null && (
        <>
          <Text style={styles.label}>WHAT DO YOU WANT FROM YOUR GYM TRAINING FOR IT?</Text>
          <View style={styles.group}>
            {SPORT_OUTCOMES_BY_SPORT[fields.sportId].map((outcomeId) => (
              <Chip
                key={outcomeId}
                testID={`sport-outcome-${outcomeId}`}
                label={SPORT_OUTCOME_LABEL[outcomeId].toUpperCase()}
                selected={fields.outcomeId === outcomeId}
                onPress={() => patch({ outcomeId })}
                accessibilityLabel={SPORT_OUTCOME_LABEL[outcomeId]}
                style={styles.chip}
              />
            ))}
          </View>
          {fieldError('outcomeId', false)}
        </>
      )}

      {emphasis !== null && (
        <View style={styles.assessment} testID="sport-emphasis">
          <Text style={styles.assessmentTitle} accessibilityRole="header">WHAT THE PLAN WILL DO</Text>
          <Text style={styles.body} testID="sport-emphasis-summary">{emphasis.summary}</Text>
          {emphasis.limits.map((limit) => (
            <Text key={limit} style={styles.dim} testID="sport-emphasis-limit">{limit}</Text>
          ))}
          {emphasis.basis.length > 0 && (
            <Text style={styles.dim} testID="sport-emphasis-basis">
              {`Based on: ${emphasis.basis.map((basis) => basis.citation).join(' ')}`}
            </Text>
          )}
        </View>
      )}

      {fields.sportId !== null && (
        <>
          <Text style={styles.label}>HOW LONG HAVE YOU PLAYED?</Text>
          <View style={styles.wrap}>
            {SPORT_EXPERIENCE.map((experienceId) => (
              <Chip
                key={experienceId}
                testID={`sport-experience-${experienceId}`}
                label={SPORT_EXPERIENCE_LABEL[experienceId].toUpperCase()}
                selected={fields.experienceId === experienceId}
                onPress={() => patch({ experienceId })}
                accessibilityLabel={SPORT_EXPERIENCE_LABEL[experienceId]}
                style={styles.wrapChip}
              />
            ))}
          </View>
          {fieldError('experienceId', false)}

          <Text style={styles.label}>A NORMAL WEEK OF YOUR SPORT</Text>
          <Text style={styles.dim}>
            A full sport week leaves less room for gym work, so a new plan takes it into account. If you are not sure, leave it: nothing is assumed.
          </Text>
          <Stepper
            label="PRACTICE SESSIONS A WEEK"
            value={count(fields.practiceSessionsPerWeek)}
            onDecrement={() => patch({ practiceSessionsPerWeek: step(fields.practiceSessionsPerWeek, -1) })}
            onIncrement={() => patch({ practiceSessionsPerWeek: step(fields.practiceSessionsPerWeek, 1) })}
            testID="sport-practice"
          />
          <Chip
            testID="sport-practice-unsure"
            label="NOT SURE"
            selected={fields.practiceSessionsPerWeek === null}
            onPress={() => patch({ practiceSessionsPerWeek: null })}
            accessibilityLabel="Not sure how many practice sessions a week"
            style={styles.chip}
          />
          <Stepper
            label="MATCHES OR COMPETITIONS A WEEK"
            value={count(fields.matchesPerWeek)}
            onDecrement={() => patch({ matchesPerWeek: step(fields.matchesPerWeek, -1) })}
            onIncrement={() => patch({ matchesPerWeek: step(fields.matchesPerWeek, 1) })}
            testID="sport-matches"
          />
          <Chip
            testID="sport-matches-unsure"
            label="NOT SURE"
            selected={fields.matchesPerWeek === null}
            onPress={() => patch({ matchesPerWeek: null })}
            accessibilityLabel="Not sure how many matches a week"
            style={styles.chip}
          />
          <Text style={styles.label}>USUAL LENGTH OF ONE SESSION, IN MINUTES (OPTIONAL)</Text>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.minutesText}
            onChangeText={(minutesText) => patch({ minutesText })}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="Leave blank if you are not sure"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="Usual length of one sport session in minutes, optional"
            testID="sport-minutes"
          />
          {fieldError('typicalSessionMinutes', fields.minutesText.length > 0)}
          <Text style={styles.dim}>
            If you add your weekly sessions in Activities, those are counted instead of these numbers. They are never added together.
          </Text>

          <Text style={styles.label}>NEXT COMPETITION (OPTIONAL)</Text>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={fields.competitionText}
            onChangeText={(competitionText) => patch({ competitionText })}
            maxLength={10}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="Next competition date, as year, month, day. Optional."
            testID="sport-competition"
          />
          {fieldError('competitionDate', fields.competitionText.length > 0)}
          <Text style={styles.dim} testID="sport-competition-note">{COMPETITION_DATE_NOTE}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[3], marginBottom: theme.space[2] },
  dim: { ...theme.font.body, color: theme.color.textMid, marginBottom: theme.space[3] },
  body: { ...theme.font.body, color: theme.color.textHi, marginBottom: theme.space[2] },
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
