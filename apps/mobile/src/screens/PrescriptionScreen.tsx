/**
 * PrescriptionScreen.tsx — today's mechanical adjustment vector.
 *
 * The athlete picks today's movement patterns, hits PRESCRIBE, and gets
 * load x / sets delta / RPE cap / one blunt cue. Source badge shows whether
 * the on-device SLM produced it or the deterministic policy table did —
 * both obey the same contract, so the screen renders them identically.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MOVEMENT_PATTERNS, type MovementPattern } from '@ak/inference';
import { palette, useStore } from '../state/useStore';

const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'SQUAT',
  hinge: 'HINGE',
  push_h: 'PUSH H',
  push_v: 'PUSH V',
  pull_h: 'PULL H',
  pull_v: 'PULL V',
  lunge: 'LUNGE',
  carry: 'CARRY',
  rotation: 'ROTATION',
  isolation: 'ISO',
  locomotion: 'BJJ/CONDITIONING',
};

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

export default function PrescriptionScreen(): React.JSX.Element {
  const vector = useStore((s) => s.vector);
  const today = useStore((s) => s.today);
  const prescription = useStore((s) => s.prescription);
  const computePrescription = useStore((s) => s.computePrescription);

  const [selected, setSelected] = useState<readonly MovementPattern[]>(['squat', 'push_h']);

  const toggle = (p: MovementPattern): void => {
    setSelected((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : cur.length >= 6 ? cur : [...cur, p],
    );
  };

  if (vector === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>NO STATE VECTOR</Text>
        <Text style={styles.dimText}>
          A prescription needs today&apos;s readiness data. Sync telemetry or run the seed script.
        </Text>
      </View>
    );
  }

  const stale = prescription !== null && prescription.forDate !== today;
  const current = stale ? null : prescription;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>TODAY&apos;S PATTERNS</Text>
      <View style={styles.patternWrap}>
        {MOVEMENT_PATTERNS.map((p) => {
          const active = selected.includes(p);
          return (
            <Pressable
              key={p}
              onPress={() => toggle(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${PATTERN_LABELS[p]} pattern, ${active ? 'selected' : 'not selected'}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {PATTERN_LABELS[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={selected.length === 0}
        onPress={() => computePrescription(selected)}
        accessibilityRole="button"
        accessibilityLabel="Compute today's training prescription"
        style={({ pressed }) => [
          styles.prescribeBtn,
          pressed && styles.prescribeBtnPressed,
          selected.length === 0 && styles.prescribeBtnDisabled,
        ]}
      >
        <Text style={styles.prescribeBtnText}>PRESCRIBE</Text>
      </Pressable>

      {current !== null && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultDate}>{current.forDate}</Text>
            <View
              style={[
                styles.sourceBadge,
                { borderColor: current.source === 'guardrail' ? palette.amber : palette.green },
              ]}
            >
              <Text
                style={[
                  styles.sourceBadgeText,
                  { color: current.source === 'guardrail' ? palette.amber : palette.green },
                ]}
              >
                {current.source === 'guardrail' ? 'GUARDRAIL' : 'POLICY'}
              </Text>
            </View>
          </View>

          <View style={styles.bigRow}>
            <View style={styles.bigCell}>
              <Text style={styles.bigValue}>×{current.vector.load_modifier.toFixed(2)}</Text>
              <Text style={styles.bigLabel}>LOAD</Text>
            </View>
            <View style={styles.bigCell}>
              <Text style={styles.bigValue}>{signed(current.vector.set_modifier)}</Text>
              <Text style={styles.bigLabel}>SETS</Text>
            </View>
            <View style={styles.bigCell}>
              <Text style={styles.bigValue}>{current.vector.rpe_cap.toFixed(1)}</Text>
              <Text style={styles.bigLabel}>RPE CAP</Text>
            </View>
          </View>

          <Text style={styles.cue}>{current.vector.coaching_cue}</Text>
        </View>
      )}

      {current === null && (
        <Text style={styles.dimText}>
          {stale
            ? 'Previous prescription was for another day. Recompute.'
            : 'Pick patterns and prescribe. Deterministic, offline, instant.'}
        </Text>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  sectionLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  patternWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: palette.green, backgroundColor: '#10241D' },
  chipText: { color: palette.dim, fontSize: 15, fontWeight: '700' },
  chipTextActive: { color: palette.green },
  prescribeBtn: {
    height: 80,
    borderRadius: 16,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  prescribeBtnPressed: { backgroundColor: '#26C28F' },
  prescribeBtnDisabled: { backgroundColor: palette.line },
  prescribeBtnText: { color: '#06251B', fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  resultCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultDate: { color: palette.dim, fontSize: 13, letterSpacing: 2 },
  sourceBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sourceBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  bigRow: { flexDirection: 'row', marginBottom: 14 },
  bigCell: { flex: 1, alignItems: 'center' },
  bigValue: {
    color: palette.text,
    fontSize: 38,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bigLabel: { color: palette.dim, fontSize: 11, letterSpacing: 2, marginTop: 4 },
  cue: { color: palette.text, fontSize: 16, lineHeight: 23 },
  errorTitle: { color: palette.red, fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  dimText: { color: palette.dim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
