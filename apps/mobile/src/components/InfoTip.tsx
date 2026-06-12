/**
 * InfoTip.tsx — reusable ⓘ glossary tooltip for S&C terminology.
 *
 * Tap the icon, get a plain-language card; tap anywhere to dismiss.
 * RN core only (Modal with animationType="none"), no positioning math —
 * a centered card never clips inside ScrollViews or nav strips.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../state/useStore';

/** The glossary is the single source of tooltip copy — add terms here. */
export const GLOSSARY: Record<string, string> = {
  RPE: 'Rate of Perceived Exertion, 1–10. 10 = no reps left in the tank; 8 = two reps in reserve. The cap is a ceiling, not a target.',
  '1RM': 'One-rep max — the heaviest load you can lift once with solid form. Target weights are calculated from it, so keep it honest and current.',
  GPP: 'General Physical Preparedness — broad, balanced fitness (strength, conditioning, mobility) rather than peaking for one quality.',
  ACWR: 'Acute:Chronic Workload Ratio — this week’s training load versus your 4-week average. Above ~1.5 means load is spiking faster than your body has adapted to.',
  HRV: 'Heart Rate Variability — beat-to-beat variation in heart rhythm. Higher than your baseline usually means recovered; suppressed means accumulated stress.',
  'ATP-PC': 'The phosphagen energy system — maximal efforts under ~10 seconds (heavy singles, sprints, throws).',
  TONNAGE: 'Total work for the session: reps × load, summed over every set.',
  LOAD: 'Multiplier on your planned working weights. ×0.85 means take 15% off the bar today.',
  SETS: 'Adjustment to your planned set count per movement. −1 means drop one set across the board.',
};

interface InfoTipProps {
  /** Glossary key; the card shows this as its title. */
  term: keyof typeof GLOSSARY & string;
}

export default function InfoTip({ term }: InfoTipProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const body = GLOSSARY[term] ?? '';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`What does ${term} mean?`}
        style={styles.icon}
      >
        <Text style={styles.iconText}>i</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss explanation"
        >
          <View style={styles.card}>
            <Text style={styles.cardTerm}>{term}</Text>
            <Text style={styles.cardBody}>{body}</Text>
            <Text style={styles.cardHint}>tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  iconText: { color: palette.dim, fontSize: 11, fontWeight: '800', fontStyle: 'italic' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
    maxWidth: 360,
    gap: 8,
  },
  cardTerm: { color: palette.green, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  cardBody: { color: palette.text, fontSize: 15, lineHeight: 22 },
  cardHint: { color: palette.dim, fontSize: 12, marginTop: 4 },
});
