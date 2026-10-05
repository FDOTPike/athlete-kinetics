import React from 'react';
import { Text, View } from 'react-native';
import { theme } from '../theme/theme';
import { SUPPORT_HELD_MESSAGE, SUPPORT_UNAVAILABLE_MESSAGE } from '../state/healthSupportStore';
import { QuietAction } from './ui';

export default function TrainingSupportNotice({ unavailable, onOpenSession }: {
  unavailable: boolean; onOpenSession?: () => void;
}): React.JSX.Element {
  return <View testID="training-support-notice" accessibilityRole="alert" style={{ padding: theme.space[4], gap: theme.space[4] }}>
    <Text style={{ ...theme.font.title, color: theme.color.textHi }}>Coach suggestions on hold</Text>
    <Text style={{ ...theme.font.body, color: theme.color.textHi }}>{unavailable ? SUPPORT_UNAVAILABLE_MESSAGE : SUPPORT_HELD_MESSAGE}</Text>
    <Text style={{ ...theme.font.body, color: theme.color.textMid }}>You can review health and training support and your saved history in Athlete Profile.</Text>
    {onOpenSession !== undefined && <QuietAction label="Open current session" accessibilityLabel="Open current session to rest or finish" onPress={onOpenSession} />}
  </View>;
}
