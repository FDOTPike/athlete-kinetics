import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { toSpokenText } from '../../speech/spokenText';
import { isSpeechAvailable, speak, stop, subscribe } from '../../speech/speech';

export interface ListenButtonProps {
  speechKey: string;
  text: string;
  label: string;
}

export function ListenButton({ speechKey, text, label }: ListenButtonProps): React.JSX.Element | null {
  const [available, setAvailable] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribe(setActiveKey);
    void isSpeechAvailable().then((yes) => { if (mounted) setAvailable(yes); });
    return () => {
      mounted = false;
      unsubscribe();
      void stop(speechKey);
    };
  }, [speechKey]);

  if (!available || text.trim().length === 0) return null;
  const selected = activeKey === speechKey;
  return (
    <Pressable
      onPress={() => { void (selected ? stop(speechKey) : speak(speechKey, toSpokenText(text))); }}
      accessibilityRole="button"
      accessibilityLabel={selected ? 'Stop reading' : `Read the ${label} aloud`}
      accessibilityState={{ selected, busy: selected }}
      style={{ minHeight: theme.touch.min, minWidth: theme.touch.min, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: theme.space[3] }}
    >
      <Text style={{ color: theme.color.textHi, ...theme.font.label }}>🔊 {selected ? 'Stop' : 'Listen'}</Text>
    </Pressable>
  );
}
