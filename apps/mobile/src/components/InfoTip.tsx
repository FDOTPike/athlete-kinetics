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

const colors = palette ?? {
  bg: '#000',
  surface: '#15151A',
  line: '#26262E',
  text: '#F4F4F6',
  dim: '#86868F',
  green: '#2EE6A8',
  amber: '#FFB454',
  red: '#FF5D5D',
};

/** The glossary is the single source of tooltip copy — add terms here. */
export const GLOSSARY: Record<string, string> = {
  RPE: 'Rate of Perceived Exertion, 1–10. 10 = no reps left in the tank; 8 = two reps in reserve. The cap is a ceiling, not a target.',
  '1RM': 'One-rep max — the heaviest load you can lift once with solid form. Target weights are calculated from it, so keep it honest and current.',
  GPP: 'General Physical Preparedness — broad, balanced fitness (strength, conditioning, mobility) rather than peaking for one quality.',
  ACWR: 'Acute:Chronic Workload Ratio — recent recorded external load compared with the preceding four-week average. Bodyweight, conditioning, grappling, and unlogged training may be incomplete.',
  HRV: 'Heart Rate Variability — beat-to-beat variation in heart rhythm. Higher than your baseline usually means recovered; suppressed means accumulated stress.',
  'ATP-PC': 'The phosphagen energy system — maximal efforts under ~10 seconds (heavy singles, sprints, throws).',
  TONNAGE: 'Total work for the session: reps × load, summed over every set.',
  LOAD: 'Multiplier on your planned working weights. ×0.85 means take 15% off the bar today.',
  SETS: 'Adjustment to your planned set count per movement. −1 means drop one set across the board.',

  // Movement patterns
  SQUAT: 'Knees bend and hips drop straight down. Quads and glutes do the work.',
  LUNGE: 'One leg in front of the other. Builds single-leg strength and balance the squat can hide.',
  HINGE: 'Hips push back with a flat back, knees only slightly bent. Hamstrings and glutes.',
  'HORIZONTAL PUSH': 'Pressing away from your chest — bench press, push-up. Chest, front shoulder, triceps.',
  ROW: 'Pulling toward your stomach. Mid-back and lats. The balance to horizontal pushing.',
  'OVERHEAD PRESS': 'Pressing above your head. Shoulders and triceps, with the trunk holding you steady.',
  'VERTICAL PULL': 'Pulling down from above — pull-up, lat pulldown. Lats and biceps.',
  CARRY: 'Holding a load and walking. Trains the grip and trunk under time, not reps.',

  // Block phases
  BUILD: 'Volume weeks. More total work at moderate effort to accumulate fitness.',
  INTENSIFICATION: 'Volume comes down, effort goes up. You do less work but it\'s harder.',
  REALISE: 'The peak week. Lowest volume, highest effort — this is where the block\'s work shows up.',
  DELOAD: 'A planned easy week. Sets drop and the RPE cap comes down so you absorb the block instead of digging a hole.',

  // Slot roles
  MAJOR: 'The main lift of the day. Everything else is arranged around it.',
  SUPPLEMENTARY: 'Direct support for the major — same pattern, different angle or implement.',
  ACCESSORY: 'Smaller work for a specific muscle or weak point. First to be cut when time is short.',
  CONDITIONAL: 'Only appears when a condition is met — an injury restriction, or equipment you have today.',

  // Loading methods
  LINEAR: 'Load climbs steadily week to week. The simplest progression and the best starting point.',
  WAVE: 'Load rises for two or three weeks, drops back, then rises past where it was.',
  STEP: 'The same load for a stretch of weeks, then a single jump up. Good when technique needs time.',
  APRE: 'Autoregulated. The set you actually perform decides the next set\'s load, so a bad day costs less.',

  // Effort targets
  'RPE START': 'Where the first working set should sit. Not a maximum — the block builds from here.',
  'RPE MAX': 'The hardest any set should feel this block. A ceiling, not a target.',

  // Structure
  BLOCK: 'Four to six weeks of training that build on each other, ending in a deload.',
  MICROCYCLE: 'One week inside a block — the repeating pattern of days.',
  'MACRO-CYCLE': 'The long arc, eight blocks, that carries you from general fitness toward a peak.',
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
    borderColor: colors.dim,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  iconText: { color: colors.dim, fontSize: 11, fontWeight: '800', fontStyle: 'italic' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    maxWidth: 360,
    gap: 8,
  },
  cardTerm: { color: colors.green, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  cardBody: { color: colors.text, fontSize: 15, lineHeight: 22 },
  cardHint: { color: colors.dim, fontSize: 12, marginTop: 4 },
});
