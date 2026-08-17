import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SecondaryButton } from '../components/ui';
import { theme } from '../theme/theme';

interface NewBlockChooserScreenProps {
  onSelectAuto: () => void;
  onSelectCustom: () => void;
  onCancel?: () => void;
}

export default function NewBlockChooserScreen({
  onSelectAuto,
  onSelectCustom,
  onCancel,
}: NewBlockChooserScreenProps): React.JSX.Element {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="new-block-chooser-screen"
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>pikeMethods</Text>
      </View>

      <Text style={styles.eyebrow}>PERIODIZATION</Text>
      <Text style={styles.title}>Start a new block</Text>
      <Text style={styles.intro}>Pick how much you want the coach to decide.</Text>

      <View style={styles.modeList}>
        {/* Mode 1: Auto */}
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={onSelectAuto}
          accessibilityRole="button"
          accessibilityLabel="Auto: The coach builds the whole block from your goal, history and equipment. Fastest, and the default if you're not sure."
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.modeName}>Auto</Text>
          </View>
          <Text style={styles.modeBlurb}>
            The coach builds the whole block from your goal, history and equipment. Fastest, and the default if you're not sure.
          </Text>
        </Pressable>

        {/* Mode 2: Custom */}
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={onSelectCustom}
          accessibilityRole="button"
          accessibilityLabel="Custom: You choose every movement, day by day. Full control — you'll need to know what you're doing."
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.modeName}>Custom</Text>
          </View>
          <Text style={styles.modeBlurb}>
            You choose every movement, day by day. Full control — you'll need to know what you're doing.
          </Text>
        </Pressable>

        {/* Mode 3: Guided (Disabled) */}
        <View
          style={[styles.card, styles.cardDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Guided: The coach drafts a week, you swap anything you don't like, then confirm. Coming soon"
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.modeName, styles.modeNameDisabled]}>Guided</Text>
            <View style={styles.badgeDisabled}>
              <Text style={styles.badgeDisabledText}>Coming soon</Text>
            </View>
          </View>
          <Text style={[styles.modeBlurb, styles.modeBlurbDisabled]}>
            The coach drafts a week, you swap anything you don't like, then confirm.
          </Text>
        </View>
      </View>

      {onCancel !== undefined && (
        <SecondaryButton
          label="Cancel"
          onPress={onCancel}
          accessibilityLabel="Cancel"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[5], paddingBottom: 56, gap: theme.space[4] },
  header: { marginBottom: theme.space[2] },
  wordmark: { color: theme.color.textLow, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  eyebrow: { color: theme.color.textLow, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.color.textHi, fontSize: 30, fontWeight: '800' },
  intro: { color: theme.color.textMid, fontSize: 15, lineHeight: 22 },
  modeList: { gap: theme.space[4], marginTop: theme.space[2] },
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  cardPressed: {
    borderColor: theme.color.textMid,
    backgroundColor: theme.color.ink1,
  },
  cardDisabled: {
    opacity: 0.6,
    borderColor: theme.color.line,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeName: {
    color: theme.color.textHi,
    fontSize: 18,
    fontWeight: '800',
  },
  modeNameDisabled: {
    color: theme.color.textMid,
  },
  modeBlurb: {
    color: theme.color.textMid,
    fontSize: 14,
    lineHeight: 20,
  },
  modeBlurbDisabled: {
    color: theme.color.textLow,
  },
  badgeDisabled: {
    backgroundColor: theme.color.ink0,
    borderWidth: 1,
    borderColor: theme.color.line,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDisabledText: {
    color: theme.color.textLow,
    fontSize: 11,
    fontWeight: '700',
  },
});
