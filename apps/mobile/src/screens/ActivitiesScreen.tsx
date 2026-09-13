import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ACTIVITY_DEMANDS,
  ACTIVITY_EQUIPMENT_KINDS,
  ACTIVITY_FACILITY_KINDS,
  ACTIVITY_KIND_IDS,
  ACTIVITY_MODALITY_IDS,
  ACTIVITY_PURPOSE_IDS,
  type ActivityDemand,
  type ActivityEquipmentKind,
  type ActivityFacilityKind,
  type ActivityKindId,
  type ActivityModalityId,
  type ActivityOccurrenceState,
  type ActivityPurposeId,
  type TimingCommitment,
} from '@ak/inference';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { Chip, Disclosure, PrimaryButton, QuietAction, SecondaryButton } from '../components/ui';
import {
  deviceTimezone,
  type ActivityDefinitionFact,
  type ActivityOccurrenceFact,
  type ActivitySeriesFact,
} from '../state/activityStore';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';

const KIND_LABELS: Record<ActivityKindId, string> = {
  walking: 'Walking',
  running: 'Running',
  swimming: 'Swimming',
  cycling: 'Cycling',
  strength_training: 'Gym or strength training',
  basketball: 'Basketball',
  soccer: 'Soccer',
  netball: 'Netball',
  rugby: 'Rugby',
  cricket: 'Cricket',
  field_hockey: 'Field hockey',
  volleyball: 'Volleyball',
  wheelchair_mobility: 'Wheelchair mobility',
  wheelchair_sport: 'Wheelchair sport',
  custom: 'Another activity',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const FACILITIES: readonly ActivityFacilityKind[] = ACTIVITY_FACILITY_KINDS;
const EQUIPMENT: readonly ActivityEquipmentKind[] = ACTIVITY_EQUIPMENT_KINDS;

const words = (value: string): string => value.replace(/_/g, ' ');
const formatMinute = (minute: number | null): string => {
  if (minute === null) return 'time not set';
  const hours = Math.floor(minute / 60);
  const minutes = String(minute % 60).padStart(2, '0');
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
};
const parseMinute = (value: string): number | null => {
  if (value.trim() === '') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) throw new Error('Time must use 24-hour HH:MM, for example 17:00.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Enter a real time between 00:00 and 23:59.');
  return hour * 60 + minute;
};
const parseOptionalNumber = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error('Use a number or leave the field blank.');
  return parsed;
};
const activityDateWeekday = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

interface ActivitiesScreenProps {
  onClose: () => void;
}

type EntryMode = 'weekly' | 'one_off';

export default function ActivitiesScreen({ onClose }: ActivitiesScreenProps): React.JSX.Element {
  const ledger = useStore((state) => state.activityLedger);
  const today = useStore((state) => state.today);
  const saveWeeklyActivity = useStore((state) => state.saveWeeklyActivity);
  const saveOneOffActivity = useStore((state) => state.saveOneOffActivity);
  const completeActivityOccurrence = useStore((state) => state.completeActivityOccurrence);
  const setActivityOccurrenceState = useStore((state) => state.setActivityOccurrenceState);
  const endActivitySeries = useStore((state) => state.endActivitySeries);

  const [formOpen, setFormOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('weekly');
  const [activityId, setActivityId] = useState<string | undefined>();
  const [seriesId, setSeriesId] = useState<string | undefined>();
  const [kindId, setKindId] = useState<ActivityKindId>('walking');
  const [displayName, setDisplayName] = useState(KIND_LABELS.walking);
  const [demand, setDemand] = useState<ActivityDemand>('unknown');
  const [facilityCode, setFacilityCode] = useState<ActivityFacilityKind | null>(null);
  const [equipmentCode, setEquipmentCode] = useState<ActivityEquipmentKind | null>(null);
  const [weekday, setWeekday] = useState(activityDateWeekday(today));
  const [timing, setTiming] = useState<TimingCommitment>('flexible');
  const [timeText, setTimeText] = useState('');
  const [dateText, setDateText] = useState(today);
  const [durationText, setDurationText] = useState('');
  const [effortText, setEffortText] = useState('');
  const [oneOffState, setOneOffState] = useState<ActivityOccurrenceState>('completed');
  const [modalityId, setModalityId] = useState<ActivityModalityId>('unknown');
  const [purposeId, setPurposeId] = useState<ActivityPurposeId>('unknown');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionTarget, setCompletionTarget] = useState<ActivityOccurrenceFact | null>(null);
  const [completionDuration, setCompletionDuration] = useState('');
  const [completionEffort, setCompletionEffort] = useState('');

  const activeSeries = useMemo(
    () => ledger.series.filter((row) => row.effectiveEndDate === null),
    [ledger.series, today],
  );

  const resetForm = (): void => {
    setActivityId(undefined);
    setSeriesId(undefined);
    setKindId('walking');
    setDisplayName(KIND_LABELS.walking);
    setDemand('unknown');
    setFacilityCode(null);
    setEquipmentCode(null);
    setWeekday(activityDateWeekday(today));
    setTiming('flexible');
    setTimeText('');
    setDateText(today);
    setDurationText('');
    setEffortText('');
    setOneOffState('completed');
    setModalityId('unknown');
    setPurposeId('unknown');
    setError(null);
  };

  const definitionFor = (id: string): ActivityDefinitionFact | undefined =>
    ledger.definitions.find((row) => row.activityId === id);

  const beginEditSeries = (row: ActivitySeriesFact): void => {
    const definition = definitionFor(row.activityId);
    if (definition === undefined) return;
    setActivityId(definition.activityId);
    setSeriesId(row.seriesId);
    setKindId(definition.kindId);
    setDisplayName(definition.displayName);
    setDemand(definition.demand);
    setFacilityCode(definition.facilities[0] ?? null);
    setEquipmentCode(definition.equipment[0] ?? null);
    setEntryMode('weekly');
    setWeekday(row.localWeekday);
    setTiming(row.timing);
    setTimeText(row.localStartMinute === null
      ? ''
      : `${String(Math.floor(row.localStartMinute / 60)).padStart(2, '0')}:${String(row.localStartMinute % 60).padStart(2, '0')}`);
    setDurationText(row.expectedDurationMin?.toString() ?? '');
    setEffortText(row.expectedEffort?.toString() ?? '');
    setError(null);
    setNotice(null);
    setFormOpen(true);
  };

  const save = (): void => {
    setError(null);
    try {
      const startMinute = parseMinute(timeText);
      const duration = parseOptionalNumber(durationText);
      const effort = parseOptionalNumber(effortText);
      const base = {
        activityId,
        kindId,
        displayName,
        demand,
        facilityCode,
        equipmentCode,
      };
      if (entryMode === 'weekly') {
        saveWeeklyActivity({
          ...base,
          seriesId,
          localWeekday: weekday,
          localStartMinute: startMinute,
          timezoneId: deviceTimezone(),
          timing,
          expectedDurationMin: duration,
          expectedEffort: effort,
          effectiveStartDate: today,
        });
        setNotice(seriesId === undefined ? 'Weekly activity saved.' : 'Weekly activity updated.');
      } else {
        saveOneOffActivity({
          ...base,
          localDate: dateText,
          localStartMinute: startMinute,
          timezoneId: deviceTimezone(),
          timing,
          state: oneOffState,
          modalityId,
          purposeId,
          expectedDurationMin: oneOffState === 'completed' ? null : duration,
          expectedEffort: oneOffState === 'completed' ? null : effort,
          actualDurationMin: oneOffState === 'completed' ? duration : null,
          actualEffort: oneOffState === 'completed' ? effort : null,
        });
        setNotice('Activity entry saved.');
      }
      resetForm();
      setFormOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const updatePlannedState = (occurrenceId: string, state: 'cancelled' | 'missed'): void => {
    setError(null);
    try {
      setActivityOccurrenceState(occurrenceId, state);
      setNotice(state === 'cancelled' ? 'Activity marked cancelled.' : 'Activity marked missed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const finishCompletion = (): void => {
    if (completionTarget === null) return;
    setError(null);
    try {
      completeActivityOccurrence({
        occurrenceId: completionTarget.occurrenceId,
        actualDurationMin: parseOptionalNumber(completionDuration),
        actualEffort: parseOptionalNumber(completionEffort),
      });
      setCompletionTarget(null);
      setCompletionDuration('');
      setCompletionEffort('');
      setNotice('Actual activity recorded.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="activities-screen"
    >
      <QuietAction label="BACK TO ATHLETE" onPress={onClose} accessibilityLabel="Back to athlete profile" />
      <Text accessibilityRole="header" style={styles.heading}>YOUR ACTIVITIES</Text>
      <Text style={styles.intro}>
        Record sport, walking, swimming, cycling, gym work, or another activity you already do.
        These are factual records. They do not silently add, remove, or intensify a coach workout.
      </Text>

      <View style={styles.summary} testID="activity-factual-summary">
        <Text style={styles.summaryTitle}>LAST 28 COMPLETED DAYS</Text>
        <Text style={styles.body}>
          {ledger.completedLast28Days} completed · {ledger.knownMinutesLast28Days} known minutes
          {ledger.completedWithUnknownDuration > 0
            ? ` · ${ledger.completedWithUnknownDuration} with duration unknown`
            : ''}
        </Text>
        <Text style={styles.summaryTitle}>CURRENT WEEKLY SCHEDULE</Text>
        <Text style={styles.body}>
          {ledger.scheduledKnownMinutesPerWeek} known minutes
          {ledger.scheduledWithUnknownDuration > 0
            ? ` · ${ledger.scheduledWithUnknownDuration} with duration unknown`
            : ''}
        </Text>
        <Text style={styles.hint}>
          Minutes are reported separately by activity. The app does not turn them into a medical safety score
          or treat sport as interchangeable with strength training.
        </Text>
      </View>

      {!formOpen && (
        <PrimaryButton
          label="ADD AN ACTIVITY"
          onPress={() => { resetForm(); setNotice(null); setFormOpen(true); }}
          accessibilityLabel="Add an existing or one-off activity"
        />
      )}

      {formOpen && (
        <View style={styles.form} testID="activity-entry-form">
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {seriesId === undefined ? 'ADD ACTIVITY' : 'EDIT WEEKLY ACTIVITY'}
          </Text>
          {seriesId === undefined && ledger.definitions.length > 0 && (
            <>
              <Text style={styles.label}>USE A SAVED ACTIVITY OR CREATE A NEW ONE</Text>
              <View style={styles.chips}>
                <Chip label="NEW ACTIVITY" selected={activityId === undefined} onPress={() => {
                  setActivityId(undefined);
                  setKindId('walking');
                  setDisplayName(KIND_LABELS.walking);
                  setDemand('unknown');
                  setFacilityCode(null);
                  setEquipmentCode(null);
                }} accessibilityLabel="Create a new activity definition" />
                {ledger.definitions.map((definition) => (
                  <Chip key={definition.activityId} label={definition.displayName.toUpperCase()}
                    selected={activityId === definition.activityId} onPress={() => {
                      setActivityId(definition.activityId);
                      setKindId(definition.kindId);
                      setDisplayName(definition.displayName);
                      setDemand(definition.demand);
                      setFacilityCode(definition.facilities[0] ?? null);
                      setEquipmentCode(definition.equipment[0] ?? null);
                    }} accessibilityLabel={`Use saved activity: ${definition.displayName}`} />
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>WHAT DO YOU ALREADY DO?</Text>
          <View style={styles.chips}>
            {ACTIVITY_KIND_IDS.map((kind) => (
              <Chip
                key={kind}
                label={KIND_LABELS[kind].toUpperCase()}
                selected={kindId === kind}
                disabled={activityId !== undefined}
                onPress={() => {
                  setKindId(kind);
                  if (kindId !== 'custom' || displayName === KIND_LABELS.custom) {
                    setDisplayName(KIND_LABELS[kind]);
                  }
                }}
                accessibilityLabel={`Activity type: ${KIND_LABELS[kind]}`}
              />
            ))}
          </View>

          <Text style={styles.label}>NAME SHOWN IN THE APP</Text>
          <TextInput
            disableFullscreenUI
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={160}
            accessibilityLabel="Activity name shown in the app"
            placeholder="For example, hobby horsing"
            placeholderTextColor={theme.color.textLow}
          />

          {seriesId === undefined && (
            <>
              <Text style={styles.label}>WHEN DOES THIS HAPPEN?</Text>
              <View style={styles.chips}>
                <Chip label="EVERY WEEK" selected={entryMode === 'weekly'}
                  onPress={() => setEntryMode('weekly')} accessibilityLabel="Repeat every week" />
                <Chip label="ONE-OFF" selected={entryMode === 'one_off'}
                  onPress={() => setEntryMode('one_off')} accessibilityLabel="One-off activity" />
              </View>
            </>
          )}

          {entryMode === 'weekly' ? (
            <>
              <Text style={styles.label}>DAY</Text>
              <View style={styles.chips}>
                {WEEKDAYS.map((day, index) => (
                  <Chip key={day} label={day.slice(0, 3).toUpperCase()} selected={weekday === index}
                    onPress={() => setWeekday(index)} accessibilityLabel={day} />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>DATE</Text>
              <TextInput disableFullscreenUI style={styles.input} value={dateText} onChangeText={setDateText}
                accessibilityLabel="Activity date, YYYY-MM-DD" placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.color.textLow} autoCapitalize="none" />
              <Text style={styles.label}>WHAT HAPPENED?</Text>
              <View style={styles.chips}>
                {(['completed', 'planned', 'cancelled', 'missed'] as const).map((state) => (
                  <Chip key={state} label={state.toUpperCase()} selected={oneOffState === state}
                    onPress={() => setOneOffState(state)} accessibilityLabel={`Activity state: ${state}`} />
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>TIMING</Text>
          <View style={styles.chips}>
            <Chip label="FLEXIBLE" selected={timing === 'flexible'} onPress={() => setTiming('flexible')}
              accessibilityLabel="Flexible timing" />
            <Chip label="FIXED" selected={timing === 'fixed'} onPress={() => setTiming('fixed')}
              accessibilityLabel="Fixed commitment" />
          </View>
          <Text style={styles.hint}>
            Fixed means the time is a real commitment, such as Friday basketball at 5 pm.
            Daylight-saving edge times are refused rather than guessed.
          </Text>
          <Text style={styles.label}>START TIME (OPTIONAL FOR FLEXIBLE)</Text>
          <TextInput disableFullscreenUI style={styles.input} value={timeText} onChangeText={setTimeText}
            keyboardType="numbers-and-punctuation" accessibilityLabel="Start time in 24-hour HH:MM"
            placeholder="17:00" placeholderTextColor={theme.color.textLow} />

          <Text style={styles.label}>
            {entryMode === 'one_off' && oneOffState === 'completed' ? 'ACTUAL MINUTES (OPTIONAL)' : 'EXPECTED MINUTES (OPTIONAL)'}
          </Text>
          <TextInput disableFullscreenUI style={styles.input} value={durationText} onChangeText={setDurationText}
            keyboardType="number-pad" accessibilityLabel="Whole activity duration in minutes"
            placeholder="Leave blank if unknown" placeholderTextColor={theme.color.textLow} />
          <Text style={styles.label}>
            {entryMode === 'one_off' && oneOffState === 'completed' ? 'ACTUAL EFFORT (OPTIONAL)' : 'EXPECTED EFFORT (OPTIONAL)'}
          </Text>
          <TextInput disableFullscreenUI style={styles.input} value={effortText} onChangeText={setEffortText}
            keyboardType="decimal-pad" accessibilityLabel="Whole activity effort from 1 to 10"
            placeholder="1 very easy · 10 hardest effort" placeholderTextColor={theme.color.textLow} />
          <Text style={styles.hint}>Effort is for the whole activity. Blank stays unknown; it is never converted to RIR.</Text>

          {entryMode === 'one_off' && (
            <Disclosure label="ACTIVITY CONTEXT (OPTIONAL)" hint="Modality and purpose stay factual">
              <Text style={styles.label}>MODALITY</Text>
              <View style={styles.chips}>
                {ACTIVITY_MODALITY_IDS.map((item) => (
                  <Chip key={item} label={words(item).toUpperCase()} selected={modalityId === item}
                    onPress={() => setModalityId(item)} accessibilityLabel={`Activity modality: ${words(item)}`} />
                ))}
              </View>
              <Text style={styles.label}>PURPOSE</Text>
              <View style={styles.chips}>
                {ACTIVITY_PURPOSE_IDS.map((item) => (
                  <Chip key={item} label={words(item).toUpperCase()} selected={purposeId === item}
                    onPress={() => setPurposeId(item)} accessibilityLabel={`Activity purpose: ${words(item)}`} />
                ))}
              </View>
            </Disclosure>
          )}

          <Disclosure label="ACCESS AND BROAD DEMAND (OPTIONAL)" hint="Unknown stays unknown">
            <Text style={styles.label}>BROAD DEMAND YOU REPORT</Text>
            <View style={styles.chips}>
              {ACTIVITY_DEMANDS.map((item) => (
                <Chip key={item} label={item.toUpperCase()} selected={demand === item}
                  onPress={() => setDemand(item)} accessibilityLabel={`Broad demand: ${item}`} />
              ))}
            </View>
            <Text style={styles.hint}>This is context, not a clinical rating or an exercise prescription.</Text>
            <Text style={styles.label}>KNOWN FACILITY OR SETTING</Text>
            <View style={styles.chips}>
              <Chip label="NONE RECORDED" selected={facilityCode === null} onPress={() => setFacilityCode(null)} />
              {FACILITIES.map((item) => (
                <Chip key={item} label={words(item).toUpperCase()} selected={facilityCode === item}
                  onPress={() => setFacilityCode(item)} accessibilityLabel={`Activity facility: ${words(item)}`} />
              ))}
            </View>
            <Text style={styles.label}>KNOWN ACTIVITY EQUIPMENT</Text>
            <View style={styles.chips}>
              <Chip label="NONE RECORDED" selected={equipmentCode === null} onPress={() => setEquipmentCode(null)} />
              {EQUIPMENT.map((item) => (
                <Chip key={item} label={words(item).toUpperCase()} selected={equipmentCode === item}
                  onPress={() => setEquipmentCode(item)} accessibilityLabel={`Activity equipment: ${words(item)}`} />
              ))}
            </View>
            <Text style={styles.hint}>Pool access is a facility. Swimming is the activity. These facts do not change strength-equipment eligibility.</Text>
          </Disclosure>

          {error !== null && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <PrimaryButton label="SAVE ACTIVITY" onPress={save} accessibilityLabel="Save activity facts" />
          <QuietAction label="CANCEL" onPress={() => { resetForm(); setFormOpen(false); }} />
        </View>
      )}

      {notice !== null && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {!formOpen && error !== null && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      <Text accessibilityRole="header" style={styles.sectionTitle}>WEEKLY COMMITMENTS</Text>
      {activeSeries.length === 0 ? (
        <Text style={styles.hint}>No current weekly activities recorded.</Text>
      ) : activeSeries.map((row) => (
        <View key={row.seriesId} style={styles.card} testID={`activity-series-${row.seriesId}`}>
          <Text style={styles.cardTitle}>{row.displayName}</Text>
          <Text style={styles.body}>
            {WEEKDAYS[row.localWeekday]} · {formatMinute(row.localStartMinute)} · {row.timing}
          </Text>
          <Text style={styles.hint}>
            {row.expectedDurationMin === null ? 'Duration unknown' : `${row.expectedDurationMin} expected minutes`}
            {row.expectedEffort === null ? ' · effort unknown' : ` · expected effort ${row.expectedEffort}/10`}
            {` · ${row.timezoneId}`}
          </Text>
          <SecondaryButton label="EDIT SCHEDULE" onPress={() => beginEditSeries(row)}
            accessibilityLabel={`Edit weekly schedule for ${row.displayName}`} />
          <QuietAction label="END THIS SCHEDULE" onPress={() => {
            try { endActivitySeries(row.seriesId); setNotice('Weekly schedule ended; past facts were kept.'); }
            catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
          }} accessibilityLabel={`End weekly schedule for ${row.displayName}`} />
        </View>
      ))}

      <Text accessibilityRole="header" style={styles.sectionTitle}>ONE-OFF AND RECORDED ACTIVITIES</Text>
      {ledger.occurrences.length === 0 ? (
        <Text style={styles.hint}>No one-off or completed activity entries yet.</Text>
      ) : ledger.occurrences.map((row) => (
        <View key={row.occurrenceId} style={styles.card} testID={`activity-occurrence-${row.occurrenceId}`}>
          <Text style={styles.cardTitle}>{row.displayName}</Text>
          <Text style={styles.body}>{row.localDate} · {row.state} · {row.timing}</Text>
          <Text style={styles.hint}>
            {row.state === 'completed'
              ? row.actualDurationMin === null ? 'Actual duration unknown' : `${row.actualDurationMin} actual minutes`
              : row.expectedDurationMin === null ? 'Expected duration unknown' : `${row.expectedDurationMin} expected minutes`}
            {row.state === 'completed'
              ? row.actualEffort === null ? ' · effort unknown' : ` · effort ${row.actualEffort}/10`
              : row.expectedEffort === null ? ' · effort unknown' : ` · expected effort ${row.expectedEffort}/10`}
          </Text>
          {row.state === 'planned' && (
            <View>
              <SecondaryButton label="LOG ACTUAL COMPLETION" onPress={() => {
                setCompletionTarget(row);
                // Actual minutes are an observation. The plan is shown only as
                // placeholder context so an untouched save stays unknown.
                setCompletionDuration('');
                setCompletionEffort('');
                setError(null);
              }} accessibilityLabel={`Log actual completion for ${row.displayName}`} />
              <View style={styles.chips}>
                <QuietAction label="MARK MISSED" onPress={() => updatePlannedState(row.occurrenceId, 'missed')} />
                <QuietAction label="MARK CANCELLED" onPress={() => updatePlannedState(row.occurrenceId, 'cancelled')} />
              </View>
            </View>
          )}
        </View>
      ))}

      {completionTarget !== null && (
        <View style={styles.form} testID="activity-completion-form">
          <Text accessibilityRole="header" style={styles.sectionTitle}>LOG {completionTarget.displayName.toUpperCase()}</Text>
          <Text style={styles.label}>ACTUAL MINUTES (OPTIONAL)</Text>
          <TextInput disableFullscreenUI style={styles.input} value={completionDuration}
            onChangeText={setCompletionDuration} keyboardType="number-pad"
            accessibilityLabel="Actual activity duration in minutes"
            placeholder={completionTarget.expectedDurationMin === null
              ? 'Leave blank if unknown'
              : `Planned ${completionTarget.expectedDurationMin} min · leave blank if unknown`}
            placeholderTextColor={theme.color.textLow} />
          <Text style={styles.label}>ACTUAL EFFORT (OPTIONAL)</Text>
          <TextInput disableFullscreenUI style={styles.input} value={completionEffort}
            onChangeText={setCompletionEffort} keyboardType="decimal-pad"
            accessibilityLabel="Actual whole activity effort from 1 to 10"
            placeholder="1 very easy · 10 hardest effort" placeholderTextColor={theme.color.textLow} />
          {error !== null && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <PrimaryButton label="SAVE ACTUAL ACTIVITY" onPress={finishCompletion} />
          <QuietAction label="CANCEL" onPress={() => setCompletionTarget(null)} />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[4], paddingBottom: theme.space[7], gap: theme.space[4] },
  heading: { ...theme.font.display, color: theme.color.textHi },
  intro: { ...theme.font.body, color: theme.color.textMid },
  summary: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  summaryTitle: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[1] },
  body: { ...theme.font.body, color: theme.color.textHi },
  hint: { ...theme.font.label, color: theme.color.textMid },
  form: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[4],
    gap: theme.space[3],
  },
  sectionTitle: { ...theme.font.title, color: theme.color.textHi, marginTop: theme.space[4] },
  label: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  input: {
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    color: theme.color.textHi,
    ...theme.font.body,
    paddingHorizontal: theme.space[3],
  },
  card: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  cardTitle: { ...theme.font.cue, color: theme.color.textHi },
  notice: { ...theme.font.body, color: theme.color.textHi },
  error: { ...theme.font.body, color: theme.color.textHi, borderLeftWidth: 3, borderLeftColor: theme.color.chalk, paddingLeft: theme.space[3] },
});
