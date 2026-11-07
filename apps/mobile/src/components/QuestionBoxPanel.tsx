import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { QuestionResult } from '../../../../packages/inference/src/semantic/questionRouter';
import { GLOSSARY_ENTRIES } from '../data/glossary';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import { PrimaryButton, QuietAction } from './ui';

// Existing referral wording: screens/ProfileScreen.tsx, training guidance safety notice.
export const QUESTION_SYMPTOM_MESSAGE = 'Stop if something feels unsafe and seek qualified professional advice when needed.';

export default function QuestionBoxPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const askQuestion = useStore((s) => s.askQuestion);
  const error = useStore((s) => s.error);
  const athleteId = useStore((s) => s.activeAthleteId);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => { setQuestion(''); setResult(null); }, [athleteId]);
  const entry = GLOSSARY_ENTRIES.find((item) => item.id === result?.shown[0]);
  const submit = async (): Promise<void> => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setResult(null);
    try { setResult(await askQuestion(question)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View style={styles.panel} testID="question-box">
    <QuietAction label="Glossary" onPress={onClose} />
    <Text style={styles.title}>Question box</Text>
    <Text style={styles.text}>Answers from the glossary only. This is not medical advice.</Text>
    <TextInput disableFullscreenUI accessibilityLabel="Question" maxLength={300}
      multiline value={question} onChangeText={(value) => { setQuestion(value); setResult(null); }}
      editable={!busy} style={styles.input} />
    <PrimaryButton label="Ask" onPress={() => { void submit(); }} disabled={busy || question.trim().length === 0} />
    {error !== null && <Text style={styles.text} accessibilityRole="alert">{error}</Text>}
    {result?.outcome === 'none' && <Text style={styles.text} accessibilityLiveRegion="polite">no answer for that yet</Text>}
    {result?.outcome === 'refer' && <Text style={styles.text} accessibilityRole="alert">{QUESTION_SYMPTOM_MESSAGE}</Text>}
    {entry !== undefined && <View style={styles.panel} testID="question-answer-card" accessibilityLiveRegion="polite">
      <Text style={styles.title}>{entry.term}</Text><Text style={styles.text}>{entry.definition}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: theme.space[3], padding: theme.space[3], backgroundColor: theme.color.ink1 },
  title: { ...theme.font.cue, color: theme.color.textHi },
  text: { ...theme.font.body, color: theme.color.textMid },
  input: { ...theme.font.body, color: theme.color.textHi, borderWidth: 1, borderColor: theme.color.line,
    minHeight: theme.touch.min, padding: theme.space[3], borderRadius: theme.radius.control },
});
