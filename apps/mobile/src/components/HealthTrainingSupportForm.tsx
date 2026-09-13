import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HealthSupportNoteKind, HealthSupportPreferenceKind } from '@ak/inference';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import {
  SUPPORT_DELETION_NOTICE, SUPPORT_DISCLOSURE, SUPPORT_HELD_MESSAGE, SUPPORT_UNAVAILABLE_MESSAGE,
  type SupportDetails, type SupportInstructionInput, type SupportScopeInput,
} from '../state/healthSupportStore';

const noteKinds: readonly HealthSupportNoteKind[] = ['general', 'functional_context', 'symptom_trigger', 'rest_context'];
const preferenceOptions: Readonly<Record<HealthSupportPreferenceKind, readonly string[]>> = {
  position: ['unanswered', 'no_preference', 'seated', 'recumbent', 'standing', 'other'],
  position_transitions: ['unanswered', 'concern_reported', 'no_concern_reported'],
  rest: ['unanswered', 'need_reported', 'no_need_reported'],
};
const label = (value: string): string => value.replace(/_/g, ' ');
function Button({ title, onPress }: { title: string; onPress: () => void }): React.JSX.Element {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={styles.button}>
    <Text style={styles.text}>{title}</Text>
  </Pressable>;
}
function Field({ title, value, change, multiline = false }: {
  title: string; value: string; change: (value: string) => void; multiline?: boolean;
}): React.JSX.Element {
  return <View><Text style={styles.text}>{title}</Text><TextInput accessibilityLabel={title}
    value={value} onChangeText={change} multiline={multiline} disableFullscreenUI style={[styles.input, multiline && styles.multiline]} /></View>;
}

function BoundSupportForm({ athleteId }: { athleteId: string }): React.JSX.Element {
  const state = useStore((s) => s);
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<SupportDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteKind, setNoteKind] = useState<HealthSupportNoteKind>('general');
  const [note, setNote] = useState('');
  const [noteId, setNoteId] = useState<string | undefined>();
  const [instruction, setInstruction] = useState('');
  const [instructionId, setInstructionId] = useState<string | undefined>();
  const [instructionDraftRevision, setInstructionDraftRevision] = useState<number | null>(null);
  const [issuer, setIssuer] = useState('');
  const [dates, setDates] = useState({ instructionDate: '', effectiveDate: '', reviewDate: '', expiryDate: '', dateZoneId: '' });
  const [scopes, setScopes] = useState<readonly SupportScopeInput[]>([{ targetKind: 'unresolved' }]);
  const [scopeKind, setScopeKind] = useState<SupportScopeInput['targetKind']>('unresolved');
  const [scopeSearch, setScopeSearch] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; revision: number } | null>(null);
  const [preferenceDetail, setPreferenceDetail] = useState<Record<HealthSupportPreferenceKind, string>>({ position: '', position_transitions: '', rest: '' });
  const reload = (): void => {
    try {
      const loaded = state.getHealthSupportDetails(athleteId);
      setDetails(loaded);
      setPreferenceDetail({ position: loaded.preferences.find((p) => p.preferenceKind === 'position')?.detailText ?? '',
        position_transitions: loaded.preferences.find((p) => p.preferenceKind === 'position_transitions')?.detailText ?? '',
        rest: loaded.preferences.find((p) => p.preferenceKind === 'rest')?.detailText ?? '' });
    } catch { setDetails(null); setError(SUPPORT_UNAVAILABLE_MESSAGE); }
  };
  useEffect(() => { if (expanded) reload(); }, [expanded, state.healthSupportRevision]);
  const save = (work: (revision: number) => void): void => {
    if (details === null) return;
    try { work(details.revision); setError(null); reload(); }
    catch (failure) {
      // Only known adapter validation messages are shown; SQLite/native errors may contain private text.
      const message = failure instanceof Error ? failure.message : '';
      setError(/^(Support |Enter a real reported|Use YYYY|An instruction supports)/.test(message)
        ? message : 'Support could not be saved. Reopen the details and try again.');
    }
  };
  const hide = (): void => {
    setExpanded(false); setDetails(null); setNote(''); setInstruction(''); setIssuer('');
    setDates({ instructionDate: '', effectiveDate: '', reviewDate: '', expiryDate: '', dateZoneId: '' });
    setPreferenceDetail({ position: '', position_transitions: '', rest: '' });
    setNoteId(undefined); setInstructionId(undefined); setDeleting(null); setError(null);
    setInstructionDraftRevision(null);
    setScopes([{ targetKind: 'unresolved' }]); setScopeSearch(''); setScopeKind('unresolved');
  };
  let status = 'support_unavailable';
  let reviewState = 'not_assessed';
  try { status = state.getTrainingSupportDecision().status; reviewState = state.getHealthSupportFacts().reviewState; } catch { /* unavailable is explicit */ }
  const candidates = scopeKind === 'movement' ? state.movements.map((m) => ({ name: m.name, scope: { targetKind: 'movement' as const, movementId: m.movement_id } }))
    : scopeKind === 'activity_definition' ? state.activityLedger.definitions.map((a) => ({ name: a.displayName, scope: { targetKind: 'activity_definition' as const, activityId: a.activityId } }))
      : scopeKind === 'activity_series' ? state.activityLedger.series.map((a) => ({ name: `${a.displayName} (weekly)`, scope: { targetKind: 'activity_series' as const, seriesId: a.seriesId } }))
        : scopeKind === 'activity_occurrence' ? state.activityLedger.occurrences.map((a) => ({ name: `${a.displayName} (${a.localDate})`, scope: { targetKind: 'activity_occurrence' as const, occurrenceId: a.occurrenceId } })) : [];
  return <View style={styles.section}>
    <Text style={styles.title}>Health and training support</Text>
    <Text style={styles.text}>Optional preferences, private notes and instructions you enter.</Text>
    <Text style={styles.text}>Review state: {label(reviewState)}. This is not medical clearance.</Text>
    {status !== 'available' && <Text accessibilityRole="alert" style={styles.text}>{status === 'held' ? SUPPORT_HELD_MESSAGE : SUPPORT_UNAVAILABLE_MESSAGE}</Text>}
    <Button title={expanded ? 'Hide health and training support' : 'Show health and training support'} onPress={() => expanded ? hide() : setExpanded(true)} />
    {error !== null && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
    {expanded && details !== null && <View style={styles.section}>
      <Text style={styles.text}>Saved as your note. The app does not interpret this text or verify medical clearance.</Text>
      <Text style={styles.text}>Preference recorded; exercise suitability has not been assessed.</Text>
      <Button title="Request review and pause coach suggestions" onPress={() => save((r) => state.setSupportReviewState(athleteId, 'review_required', r))} />
      <Button title="Record review pending and pause coach suggestions" onPress={() => save((r) => state.setSupportReviewState(athleteId, 'pending_review', r))} />
      <Button title="Withdraw my requested pause" onPress={() => save((r) => state.setSupportReviewState(athleteId, 'not_assessed', r))} />
      <Text style={styles.text}>Withdrawing your pause does not release an instruction review hold.</Text>
      {(Object.keys(preferenceOptions) as HealthSupportPreferenceKind[]).map((kind) => <View key={kind} style={styles.section}>
        <Text style={styles.title}>{label(kind)}</Text>
        {preferenceOptions[kind].map((value) => <Pressable key={value} style={styles.button} accessibilityRole="radio"
          accessibilityLabel={`${label(kind)}: ${label(value)}`}
          accessibilityState={{ checked: (details.preferences.find((p) => p.preferenceKind === kind)?.reportedValue ?? 'unanswered') === value }}
          onPress={() => save((r) => state.saveSupportPreference(athleteId, kind, value, preferenceDetail[kind], r))}>
          <Text style={styles.text}>{label(value)}</Text></Pressable>)}
        <Field title={`${label(kind)} details`} value={preferenceDetail[kind]} change={(value) => setPreferenceDetail((p) => ({ ...p, [kind]: value }))} multiline />
        <Button title={`Save ${label(kind)} details`} onPress={() => save((r) => state.saveSupportPreference(athleteId, kind,
          details.preferences.find((p) => p.preferenceKind === kind)?.reportedValue ?? 'unanswered', preferenceDetail[kind], r))} />
      </View>)}
      <Text style={styles.title}>Notes for your records</Text>
      {noteKinds.map((kind) => <Pressable key={kind} style={styles.button} accessibilityRole="radio"
        accessibilityLabel={`Note type: ${label(kind)}`} accessibilityState={{ checked: noteKind === kind }} onPress={() => setNoteKind(kind)}>
        <Text style={styles.text}>{label(kind)}</Text></Pressable>)}
      <Field title="Support note text" value={note} change={setNote} multiline />
      <Button title="Save support note" onPress={() => save((r) => { state.saveSupportNote(athleteId, noteKind, note, noteId, r); setNote(''); setNoteId(undefined); })} />
      {details.notes.map((n, index) => <View key={n.noteId} style={styles.section}>
        <Text style={styles.text}>{label(n.noteKind)}: {n.bodyText}</Text>
        <Button title={`Edit support note ${index + 1}`} onPress={() => { setNoteId(n.noteId); setNote(n.bodyText); setNoteKind(n.noteKind); }} />
        <Button title={`Delete support note ${index + 1}`} onPress={() => save((r) => state.deleteSupportNote(athleteId, n.noteId, r))} />
      </View>)}
      <Text style={styles.title}>Clinician instructions</Text>
      <Text style={styles.text}>{SUPPORT_DISCLOSURE}</Text>
      <Text style={styles.text}>Saving a draft holds the affected coach suggestions. Confirm each revision after reading it. Confirmation records your transcription; it does not verify the source or release the hold.</Text>
      <Field title="Clinician instruction text" value={instruction} change={(value) => {
        if (instructionDraftRevision === null) setInstructionDraftRevision(details.revision);
        setInstruction(value);
      }} multiline />
      <Field title="Reported issuer (optional)" value={issuer} change={setIssuer} />
      {(Object.keys(dates) as (keyof typeof dates)[]).map((key) => <Field key={key}
        title={key === 'dateZoneId' ? 'Reported time zone (optional)' : `${label(key.replace(/Date$/, ' date'))} (YYYY-MM-DD, optional)`}
        value={dates[key]} change={(value) => setDates((d) => ({ ...d, [key]: value }))} />)}
      <Text style={styles.text}>Dates are recorded as reported. They do not automatically begin or end a hold.</Text>
      <Text style={styles.title}>Affected guidance</Text>
      {([['unresolved', 'Scope not yet known'], ['all_prescription', 'All coach suggestions'], ['movement', 'Choose an exercise'],
        ['activity_definition', 'Choose an existing activity'], ['activity_series', 'Choose a weekly activity'],
        ['activity_occurrence', 'Choose one activity entry']] as const).map(([kind, title]) => <Button key={kind} title={title} onPress={() => {
          setScopeKind(kind); setScopeSearch(''); setScopes([{ targetKind: kind === 'all_prescription' ? kind : 'unresolved' }]);
        }} />)}
      {candidates.length > 0 && <Field title="Find affected activity or exercise" value={scopeSearch} change={setScopeSearch} />}
      {candidates.filter((c) => c.name.toLocaleLowerCase().includes(scopeSearch.toLocaleLowerCase())).slice(0, 20).map((candidate, index) => <Button
        key={index} title={`Select ${candidate.name}`} onPress={() => setScopes([candidate.scope])} />)}
      <Text style={styles.text}>{scopes.some((s) => s.targetKind === 'unresolved') ? 'Scope unresolved: all coach suggestions will be held.' : 'Scope selected. This records applicability, not suitability.'}</Text>
      <Button title="Save clinician instruction draft" onPress={() => save((r) => {
        const input: SupportInstructionInput = { instructionId, instructionText: instruction, issuerText: issuer, ...dates, scopes };
        state.saveSupportInstruction(athleteId, input, instructionDraftRevision ?? r);
        setInstructionDraftRevision(null); setInstruction(''); setInstructionId(undefined); setIssuer('');
        setDates({ instructionDate: '', effectiveDate: '', reviewDate: '', expiryDate: '', dateZoneId: '' });
      })} />
      {details.instructions.map((i, index) => {
        const suffix = details.instructions.length > 1 ? `, instruction ${index + 1}` : '';
        return <View key={i.instructionId} style={styles.section}>
          <Text style={styles.text}>{SUPPORT_DISCLOSURE}</Text>
          <Text style={styles.text}>Revision {i.revision}: {label(i.transcriptionState)}</Text>
          <Text style={styles.text}>{i.instructionText}</Text>
          {i.issuerText !== null && <Text style={styles.text}>Reported issuer: {i.issuerText}</Text>}
          {i.transcriptionState === 'draft' && <Button title={`Confirm transcription revision ${i.revision}${suffix}`}
            onPress={() => save((r) => state.confirmSupportInstruction(athleteId, i.instructionId, i.revision, r))} />}
          <Button title={`Edit clinician instruction revision ${i.revision}${suffix}`} onPress={() => {
            setInstructionDraftRevision(details.revision);
            setInstructionId(i.instructionId); setInstruction(i.instructionText); setIssuer(i.issuerText ?? ''); setScopes(i.scopes);
            setDates({ instructionDate: i.instructionDate ?? '', effectiveDate: i.effectiveDate ?? '', reviewDate: i.reviewDate ?? '', expiryDate: i.expiryDate ?? '', dateZoneId: i.dateZoneId ?? '' });
          }} />
          <Button title={`Delete clinician instruction revision ${i.revision}${suffix}`} onPress={() => setDeleting({ id: i.instructionId, revision: details.revision })} />
        </View>;
      })}
      {deleting !== null && <View accessibilityRole="alert" style={styles.section}>
        <Text style={styles.text}>{SUPPORT_DELETION_NOTICE}</Text>
        <Button title="Confirm instruction deletion" onPress={() => save((r) => {
          state.deleteSupportInstruction(athleteId, deleting.id, deleting.revision); setDeleting(null); setInstruction(''); setInstructionId(undefined);
          setInstructionDraftRevision(null);
          setIssuer(''); setDates({ instructionDate: '', effectiveDate: '', reviewDate: '', expiryDate: '', dateZoneId: '' });
          setScopes([{ targetKind: 'unresolved' }]); setScopeSearch(''); setScopeKind('unresolved');
        })} />
        <Button title="Keep instruction" onPress={() => setDeleting(null)} />
      </View>}
    </View>}
  </View>;
}

export default function HealthTrainingSupportForm(): React.JSX.Element {
  const athleteId = useStore((s) => s.activeAthleteId);
  return <BoundSupportForm key={athleteId} athleteId={athleteId} />;
}
const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 16 },
  title: { color: theme.color.textHi, fontSize: 18, fontWeight: '600' },
  text: { color: theme.color.textHi, fontSize: 16, flexShrink: 1 },
  button: { minHeight: 56, padding: 12, justifyContent: 'center', borderWidth: 1, borderColor: theme.color.line },
  input: { minHeight: 56, padding: 12, color: theme.color.textHi, borderWidth: 1, borderColor: theme.color.line },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
});
