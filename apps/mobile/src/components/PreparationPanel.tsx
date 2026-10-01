/**
 * PreparationPanel — the athlete-facing surface for a session's frozen
 * movement-preparation protocol (065).
 *
 * It shows the protocol exactly as it was frozen at session start and records
 * what the athlete actually did, item by item. It never decides an outcome:
 * "Finish preparation" asks the store, which derives completed / modified from
 * the recorded items, and the two other exits say what they are — already
 * warm, or skipped. Stopping the session stays available at all times.
 *
 * Every action passes the revision this render was drawn from, so a second
 * tap on the same button cannot record twice.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PREPARATION_STATUS_LABEL,
  describePreparationDose,
  isTerminalPreparationStatus,
  preparationDoseUnit,
  preparationEstimateMinutes,
  prescribedAmount,
  type PreparationItem,
  type PreparationStage,
} from '@ak/inference';
import type { ActivePreparation, PreparationItemRecord, PreparationItemWrite } from '../state/preparationStore';
import { theme } from '../theme/theme';
import { Disclosure, PrimaryButton, SecondaryButton, Stepper } from './ui';

export interface PreparationPanelProps {
  preparation: ActivePreparation;
  onBegin: (expectedRevision: number) => void;
  onRecordItem: (itemIndex: number, write: PreparationItemWrite, expectedRevision: number) => void;
  onFinish: (outcome: 'finished' | 'already_warm' | 'skipped', expectedRevision: number) => void;
  /** Stop the whole session. Always reachable from this panel. */
  onStopSession: () => void;
}

const STAGE_LABEL: Record<PreparationStage, string> = {
  raise: 'Easy movement',
  mobilise: 'Mobility',
  activate: 'Balance and bracing',
  rehearse: 'Rehearsal',
  ramp: 'Preparation set',
};

const recordedText = (item: PreparationItem | undefined, record: PreparationItemRecord): string => {
  const unit = item === undefined ? '' : preparationDoseUnit(item.dose) === 'seconds' ? ' seconds' : ' reps';
  switch (record.status) {
    case 'pending': return 'Not recorded';
    case 'done': return 'Done as written';
    case 'modified': return `Changed: ${record.performedAmount ?? 0}${unit}${record.extraWork ? ' — recorded as extra work' : ''}`;
    case 'substituted': return `Did instead: ${record.substitutionText ?? ''}${record.extraWork ? ' — recorded as extra work' : ''}`;
    case 'skipped': return record.reasonCode === 'discomfort' ? 'Skipped: it did not feel right' : 'Skipped';
    case 'withheld': return 'Withheld: not available right now';
  }
};

export function PreparationPanel({
  preparation, onBegin, onRecordItem, onFinish, onStopSession,
}: PreparationPanelProps): React.JSX.Element {
  const { protocol, items, revision, status } = preparation;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [insteadText, setInsteadText] = useState('');

  const finished = isTerminalPreparationStatus(status);
  const currentIndex = items.find((record) => record.status === 'pending')?.index ?? null;
  const anyRecorded = items.some((record) => record.status !== 'pending');

  const openEditor = (index: number, item: PreparationItem): void => {
    setEditingIndex(index);
    setAmount(prescribedAmount(item.dose));
    setInsteadText('');
  };
  const closeEditor = (): void => { setEditingIndex(null); setInsteadText(''); };

  if (protocol === null) {
    // The frozen protocol cannot be read by this build. Nothing is guessed in
    // its place; the athlete can still record an honest outcome or stop.
    return (
      <View style={styles.card} testID="preparation-panel" accessibilityLabel="Preparation">
        <Text style={styles.eyebrow}>PREPARATION</Text>
        <Text style={styles.title} accessibilityRole="header">Preparation details could not be shown</Text>
        <Text style={styles.body}>
          This session's preparation was saved by a different app version and cannot be displayed here. Warm up as you normally would, then choose what describes it.
        </Text>
        {!finished && (
          <View style={styles.actions}>
            <SecondaryButton label="I am already warm" fullWidth onPress={() => onFinish('already_warm', revision)}
              accessibilityLabel="Record that you are already warm" testID="preparation-already-warm" />
            <SecondaryButton label="Skip preparation" fullWidth onPress={() => onFinish('skipped', revision)}
              accessibilityLabel="Skip preparation and record it as skipped" testID="preparation-skip" />
            <SecondaryButton label="Stop session" fullWidth onPress={onStopSession}
              accessibilityLabel="Stop this session" testID="preparation-stop-session" />
          </View>
        )}
      </View>
    );
  }

  const estimate = preparationEstimateMinutes(protocol);

  return (
    <View style={styles.card} testID="preparation-panel" accessibilityLabel="Preparation">
      <Text style={styles.eyebrow}>PREPARATION</Text>
      <Text style={styles.title} accessibilityRole="header">Prepare for this session</Text>
      <Text style={styles.meta} testID="preparation-estimate">
        {`About ${estimate} minute${estimate === 1 ? '' : 's'} · ${protocol.variant === 'standard' ? 'full protocol' : 'short protocol'}`}
      </Text>
      <Text style={styles.status} testID="preparation-status" accessibilityLiveRegion="polite">
        {PREPARATION_STATUS_LABEL[status]}
      </Text>
      {protocol.basis.map((line) => (
        <Text key={line} style={styles.body}>{line}</Text>
      ))}
      {protocol.notes.map((line) => (
        <Text key={line} style={styles.note} accessibilityRole="alert" testID="preparation-note">{line}</Text>
      ))}

      {status === 'pending' && (
        <View style={styles.actions}>
          <PrimaryButton label="Start preparation" onPress={() => onBegin(revision)}
            accessibilityLabel="Start preparation" testID="preparation-begin" />
        </View>
      )}

      <View style={styles.list} accessibilityLabel="Preparation items">
        {protocol.items.map((item, index) => {
          const record = items.find((candidate) => candidate.index === index);
          if (record === undefined) return null;
          const current = !finished && status === 'in_progress' && currentIndex === index;
          const editing = editingIndex === index && record.status === 'pending' && !finished;
          const unit = preparationDoseUnit(item.dose);
          const step = unit === 'seconds' ? (prescribedAmount(item.dose) >= 120 ? 30 : 5) : 1;
          return (
            <View key={`${item.itemId}:${index}`} style={[styles.item, current && styles.itemCurrent]}
              testID={`preparation-item-${index}`}>
              <Text style={styles.stage}>{STAGE_LABEL[item.stage]}</Text>
              <Text style={styles.itemTitle} accessibilityRole="header">{item.title}</Text>
              <Text style={styles.dose} testID={`preparation-item-${index}-dose`}>{describePreparationDose(item.dose)}</Text>
              {record.status !== 'pending' && (
                <Text style={styles.recorded} testID={`preparation-item-${index}-recorded`}>
                  {recordedText(item, record)}
                </Text>
              )}
              {current && (
                <>
                  <Text style={styles.body}>{item.instruction}</Text>
                  <Text style={styles.cue}>{item.cue}</Text>
                  <Text style={styles.stop}>{item.stopInstruction}</Text>
                  {item.regression !== null && (
                    <Text style={styles.body}>{`Easier option: ${item.regression}`}</Text>
                  )}
                  {!editing && (
                    <View style={styles.actions}>
                      <PrimaryButton label="Done" onPress={() => onRecordItem(index, { status: 'done' }, revision)}
                        accessibilityLabel={`Mark ${item.title} done as written`}
                        testID={`preparation-item-${index}-done`} />
                      <SecondaryButton label="I did it differently" fullWidth onPress={() => openEditor(index, item)}
                        accessibilityLabel={`Record a different amount or exercise for ${item.title}`}
                        testID={`preparation-item-${index}-change`} />
                      <SecondaryButton label="Skip this" fullWidth
                        onPress={() => onRecordItem(index, { status: 'skipped', reasonCode: 'athlete_choice' }, revision)}
                        accessibilityLabel={`Skip ${item.title}`}
                        testID={`preparation-item-${index}-skip`} />
                      <SecondaryButton label="It does not feel right" fullWidth
                        onPress={() => onRecordItem(index, { status: 'skipped', reasonCode: 'discomfort' }, revision)}
                        accessibilityLabel={`Skip ${item.title} because it does not feel right`}
                        testID={`preparation-item-${index}-discomfort`} />
                    </View>
                  )}
                  {editing && (
                    <View style={styles.editor} testID={`preparation-item-${index}-editor`}>
                      <Stepper
                        label={unit === 'seconds' ? 'Seconds you did' : 'Reps you did'}
                        value={String(amount)}
                        onDecrement={() => setAmount((value) => Math.max(0, value - step))}
                        onIncrement={() => setAmount((value) => Math.min(3600, value + step))}
                        testID={`preparation-item-${index}-amount`}
                      />
                      <Text style={styles.fieldLabel}>Did a different exercise? Name it (optional)</Text>
                      <TextInput
                        disableFullscreenUI
                        style={styles.input}
                        value={insteadText}
                        onChangeText={setInsteadText}
                        maxLength={200}
                        placeholder="For example: easy rowing"
                        placeholderTextColor={theme.color.textLow}
                        accessibilityLabel="Exercise you did instead"
                        testID={`preparation-item-${index}-instead`}
                      />
                      <Text style={styles.body}>
                        Doing much more than written is recorded as extra work, not as preparation.
                      </Text>
                      <PrimaryButton label="Save what I did"
                        onPress={() => {
                          const text = insteadText.trim();
                          onRecordItem(index, text.length > 0
                            ? { status: 'substituted', substitutionText: text, performedAmount: amount, reasonCode: 'athlete_choice' }
                            : { status: 'modified', performedAmount: amount, reasonCode: 'athlete_choice' }, revision);
                          closeEditor();
                        }}
                        accessibilityLabel={`Save what you did for ${item.title}`}
                        testID={`preparation-item-${index}-save`} />
                      <SecondaryButton label="Cancel" fullWidth onPress={closeEditor}
                        accessibilityLabel="Cancel the change" testID={`preparation-item-${index}-cancel`} />
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>

      {protocol.omitted.length > 0 && (
        <Disclosure label="Left out, and why" testID="preparation-omitted">
          {protocol.omitted.map((omission, index) => (
            <Text key={`${omission.itemId}:${index}`} style={styles.body}>{omission.detail}</Text>
          ))}
        </Disclosure>
      )}

      {!finished && (
        <View style={styles.actions}>
          {status === 'in_progress' && (
            <PrimaryButton label="Finish preparation" disabled={!anyRecorded}
              onPress={() => onFinish('finished', revision)}
              accessibilityLabel="Finish preparation and move to your first set"
              testID="preparation-finish" />
          )}
          <SecondaryButton label="I am already warm" fullWidth onPress={() => onFinish('already_warm', revision)}
            accessibilityLabel="Record that you are already warm and move to your first set"
            testID="preparation-already-warm" />
          <SecondaryButton label="Skip preparation" fullWidth onPress={() => onFinish('skipped', revision)}
            accessibilityLabel="Skip preparation and record it as skipped"
            testID="preparation-skip" />
          <SecondaryButton label="Stop session" fullWidth onPress={onStopSession}
            accessibilityLabel="Stop this session" testID="preparation-stop-session" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    gap: theme.space[2],
  },
  eyebrow: { ...theme.font.eyebrow, color: theme.color.textLow },
  title: { ...theme.font.title, color: theme.color.textHi },
  meta: { ...theme.font.label, color: theme.color.textMid },
  status: { ...theme.font.label, color: theme.color.textHi },
  body: { ...theme.font.body, color: theme.color.textMid },
  note: { ...theme.font.body, color: theme.color.textHi },
  list: { gap: theme.space[3], marginTop: theme.space[3] },
  item: {
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    gap: theme.space[1],
  },
  // Chalk marks exactly one thing: where the athlete is now.
  itemCurrent: { borderColor: theme.color.chalk },
  stage: { ...theme.font.eyebrow, color: theme.color.textLow },
  itemTitle: { ...theme.font.cue, color: theme.color.textHi },
  dose: { ...theme.font.label, color: theme.color.textHi },
  recorded: { ...theme.font.label, color: theme.color.textMid },
  cue: { ...theme.font.cue, color: theme.color.textHi },
  stop: { ...theme.font.label, color: theme.color.textMid },
  actions: { gap: theme.space[2], marginTop: theme.space[3] },
  editor: { gap: theme.space[2], marginTop: theme.space[3] },
  fieldLabel: { ...theme.font.label, color: theme.color.textMid },
  input: {
    ...theme.font.body,
    color: theme.color.textHi,
    minHeight: theme.touch.min,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.space[3],
    backgroundColor: theme.color.ink0,
  },
});

export default PreparationPanel;
