/**
 * PrescriptionScreen.tsx — today's mechanical adjustment vector.
 *
 * The athlete picks today's movement patterns, hits PRESCRIBE, and gets
 * load x / sets delta / RPE cap / one blunt cue. Source badge shows whether
 * the on-device SLM produced it or the deterministic policy table did —
 * both obey the same contract, so the screen renders them identically.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const triageReady = useStore((s) => s.triageReady);
  const triaging = useStore((s) => s.triaging);
  const lastTriage = useStore((s) => s.lastTriage);
  const reportSubjective = useStore((s) => s.reportSubjective);

  const [selected, setSelected] = useState<readonly MovementPattern[]>(['squat', 'push_h']);
  const [reportText, setReportText] = useState('');

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

      {/* ---- subjective report triage ---- */}
      <Text style={[styles.sectionLabel, styles.reportLabel]}>SUBJECTIVE REPORT</Text>
      {!triageReady ? (
        <Text style={styles.dimText}>
          On-device triage is inactive in this build (embedding model not wired yet).
          Prescriptions stay policy-driven.
        </Text>
      ) : (
        <>
          <TextInput
            style={styles.reportInput}
            value={reportText}
            onChangeText={setReportText}
            placeholder="How does it feel? e.g. knee a bit sore, 3/10"
            placeholderTextColor={palette.dim}
            maxLength={500}
            multiline
            accessibilityLabel="Describe how your body feels today"
          />
          <Pressable
            disabled={reportText.trim().length === 0 || triaging}
            onPress={() => {
              void reportSubjective(reportText).then(() => setReportText(''));
            }}
            accessibilityRole="button"
            accessibilityLabel="Triage this report"
            style={({ pressed }) => [
              styles.triageBtn,
              pressed && styles.triageBtnPressed,
              (reportText.trim().length === 0 || triaging) && styles.triageBtnDisabled,
            ]}
          >
            <Text style={styles.triageBtnText}>{triaging ? 'MATCHING…' : 'TRIAGE'}</Text>
          </Pressable>

          {lastTriage !== null && lastTriage.kind === 'rejected' && (
            <View style={styles.rejectCard}>
              <Text style={styles.rejectTitle}>NO CONFIDENT MATCH</Text>
              <Text style={styles.dimTextLeft}>
                Closest cue scored {(lastTriage.similarity * 100).toFixed(0)}% — below the
                threshold, so nothing changed. Rephrase with how it feels during movement.
              </Text>
            </View>
          )}
          {lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt && (
            <View style={styles.haltCard}>
              <Text style={styles.haltTitle}>STOP — SESSION OVER</Text>
              <Text style={styles.haltCue}>{lastTriage.directive.vector.coaching_cue}</Text>
              {lastTriage.directive.followUp !== null && (
                <Text style={styles.followUp}>{lastTriage.directive.followUp}</Text>
              )}
            </View>
          )}
          {lastTriage !== null && lastTriage.kind === 'matched' && !lastTriage.directive.halt && (
            <View style={styles.matchCard}>
              <Text style={styles.matchTitle}>
                GUARDRAIL APPLIED · {(lastTriage.directive.similarity * 100).toFixed(0)}% MATCH
              </Text>
              <Text style={styles.matchCue}>{lastTriage.directive.vector.coaching_cue}</Text>
              {lastTriage.directive.followUp !== null && (
                <Text style={styles.followUp}>{lastTriage.directive.followUp}</Text>
              )}
              <Text style={styles.dimTextLeft}>
                The prescription above now reflects this report.
              </Text>
            </View>
          )}
        </>
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
  dimTextLeft: { color: palette.dim, fontSize: 14, lineHeight: 20, marginTop: 8 },
  reportLabel: { marginTop: 28 },
  reportInput: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  triageBtn: {
    height: 64,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  triageBtnPressed: { backgroundColor: '#10241D' },
  triageBtnDisabled: { borderColor: palette.line },
  triageBtnText: { color: palette.green, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  rejectCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  rejectTitle: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  matchCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.amber,
    padding: 14,
  },
  matchTitle: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  matchCue: { color: palette.text, fontSize: 16, lineHeight: 22, marginTop: 8 },
  haltCard: {
    backgroundColor: '#2A1416',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.red,
    padding: 16,
  },
  haltTitle: { color: palette.red, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  haltCue: { color: palette.text, fontSize: 16, lineHeight: 22, marginTop: 8 },
  followUp: { color: palette.text, fontSize: 15, fontStyle: 'italic', marginTop: 8 },
});
