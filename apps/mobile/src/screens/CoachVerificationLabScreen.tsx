/** Hidden, sandbox-only coach verification surface. */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { MovementPattern } from '@ak/inference';
import {
  runCoachVerificationLab,
  serializeRedactedCoachReport,
  type CoachVerificationReport,
  type DiagnosticEvidencePoint,
} from '../diagnostics/coachVerificationLab';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import { QuietAction } from '../components/ui';

interface Props {
  readonly onClose: () => void;
}

export default function CoachVerificationLabScreen({ onClose }: Props): React.JSX.Element {
  const profile = useStore((state) => state.profile);
  const vector = useStore((state) => state.vector);
  const movements = useStore((state) => state.movements);
  const today = useStore((state) => state.today);
  const loadMeasuredHistory = useStore((state) => state.loadMeasuredHistory);
  const loadCoachDiagnosticContext = useStore((state) => state.loadCoachDiagnosticContext);
  const loadCoachMovementAccessContext = useStore((state) => state.loadCoachMovementAccessContext);
  const getMovementAvailabilityVerdicts = useStore((state) => state.getMovementAvailabilityVerdicts);
  const [evidence, setEvidence] = useState<readonly DiagnosticEvidencePoint[]>([]);
  const [report, setReport] = useState<CoachVerificationReport | null>(null);
  const [windowDays, setWindowDays] = useState<14 | 30 | 90>(30);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    setEvidence(loadMeasuredHistory(90));
  }, [loadMeasuredHistory]);

  const selectedEvidence = useMemo(
    () => report?.evidence.find((item) => item.days === windowDays) ?? null,
    [report, windowDays],
  );

  const run = (): void => {
    const availableWeightRoom = new Map(
      getMovementAvailabilityVerdicts('weight_room').map((verdict) => [verdict.movementId, verdict.state === 'available']),
    );
    const availableSport = new Map(
      getMovementAvailabilityVerdicts('sport_conditioning').map((verdict) => [verdict.movementId, verdict.state === 'available']),
    );
    setReport(runCoachVerificationLab({
      profile,
      vector,
      today,
      generatedAtMs: Date.now(),
      evidence,
      profileContext: loadCoachDiagnosticContext(),
      movementAccess: loadCoachMovementAccessContext(),
      movements: movements.map((movement) => ({
        movement_id: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern as MovementPattern,
        is_compound: movement.is_compound,
        required: movement.required,
        difficulty: movement.difficulty,
        beginner_ok: movement.beginnerOk,
        sportTracking: movement.sportTracking,
        capability_available_weight_room: availableWeightRoom.get(movement.movement_id) === true,
        capability_available_sport_conditioning: availableSport.get(movement.movement_id) === true,
        scope: movement.scope ?? undefined,
      })),
    }));
    setShareNotice(null);
  };

  const share = (): void => {
    if (report === null) return;
    void Share.share({
      title: 'pikeMethods verification report',
      message: serializeRedactedCoachReport(report),
    }).then(() => setShareNotice('Redacted report opened in the system share sheet.'))
      .catch(() => setShareNotice('The system share sheet could not be opened.'));
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="coach-verification-lab"
    >
      <QuietAction label="← BACK TO ATHLETE" onPress={onClose} accessibilityLabel="Close Coach Verification Lab" />
      <Text style={styles.eyebrow}>ADVANCED TOOLS</Text>
      <Text style={styles.title}>COACH VERIFICATION LAB</Text>
      <Text style={styles.body}>
        Runs production coaching engines against an in-memory sandbox. It reads selected profile and evidence values, but cannot write athlete data.
      </Text>

      <View style={styles.notice} testID="lab-no-write-notice">
        <Text style={styles.noticeTitle}>SANDBOX · READ-ONLY</Text>
        <Text style={styles.body}>No plan, prescription, session, profile, history, readiness, or movement record is changed.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Run all verification scenarios"
        onPress={run}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>RUN ALL CHECKS</Text>
      </Pressable>

      {report === null ? (
        <Text style={styles.empty}>No diagnostic run yet.</Text>
      ) : (
        <>
          <Text style={styles.summary}>{report.passed} passed · {report.attention} need attention</Text>
          {report.modules.map((module) => (
            <View key={module.id} style={styles.card} testID={`lab-module-${module.id}`}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{module.title.toUpperCase()}</Text>
                <Text style={styles.status}>{module.status === 'pass' ? 'PASS' : 'CHECK'}</Text>
              </View>
              <Text style={styles.body}>{module.summary}</Text>
              {module.details.map((detail) => <Text key={detail} style={styles.detail}>• {detail}</Text>)}
            </View>
          ))}

          <View style={styles.card} testID="lab-my-evidence">
            <Text style={styles.cardTitle}>MY EVIDENCE</Text>
            <Text style={styles.body}>Read-only coverage summary. Missing data stays missing; the Lab does not fill gaps.</Text>
            <View style={styles.windowRow}>
              {([14, 30, 90] as const).map((days) => (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  accessibilityState={{ selected: windowDays === days }}
                  accessibilityLabel={`Show ${days} day evidence`}
                  onPress={() => setWindowDays(days)}
                  style={[styles.windowButton, windowDays === days && styles.windowButtonSelected]}
                >
                  <Text style={[styles.windowText, windowDays === days && styles.windowTextSelected]}>{days} DAYS</Text>
                </Pressable>
              ))}
            </View>
            {selectedEvidence !== null && (
              <View>
                <Text style={styles.detail}>{selectedEvidence.trainingDays} training days · {selectedEvidence.setCount} sets</Text>
                <Text style={styles.detail}>{selectedEvidence.tonnageKg.toFixed(1)} kg recorded tonnage</Text>
                <Text style={styles.detail}>Bodyweight {selectedEvidence.bodyweightDays} days · HRV {selectedEvidence.hrvDays} days · sleep {selectedEvidence.sleepDays} days</Text>
              </View>
            )}
          </View>

          <QuietAction label="SHARE REDACTED REPORT" onPress={share} accessibilityLabel="Share redacted Coach Verification report" />
          {shareNotice !== null && <Text style={styles.detail}>{shareNotice}</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[4], paddingBottom: theme.space[6], gap: theme.space[3] },
  eyebrow: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[3] },
  title: { ...theme.font.title, color: theme.color.textHi },
  body: { ...theme.font.body, color: theme.color.textMid },
  notice: { backgroundColor: theme.color.ink1, borderColor: theme.color.line, borderWidth: 1, borderRadius: theme.radius.control, padding: theme.space[3] },
  noticeTitle: { ...theme.font.eyebrow, color: theme.color.textHi, marginBottom: theme.space[1] },
  primary: { minHeight: theme.touch.min, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.control, backgroundColor: theme.color.textHi },
  primaryText: { ...theme.font.cue, color: theme.color.ink0 },
  pressed: { opacity: 0.8 },
  empty: { ...theme.font.label, color: theme.color.textLow, paddingVertical: theme.space[4] },
  summary: { ...theme.font.cue, color: theme.color.textHi, marginTop: theme.space[2] },
  card: { backgroundColor: theme.color.ink1, borderColor: theme.color.line, borderWidth: 1, borderRadius: theme.radius.control, padding: theme.space[3], gap: theme.space[2] },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space[2] },
  cardTitle: { ...theme.font.cue, color: theme.color.textHi, flex: 1 },
  status: { ...theme.font.eyebrow, color: theme.color.chalk },
  detail: { ...theme.font.label, color: theme.color.textMid },
  windowRow: { flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' },
  windowButton: { minHeight: theme.touch.min, minWidth: 88, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.color.line },
  windowButtonSelected: { backgroundColor: theme.color.textHi },
  windowText: { ...theme.font.label, color: theme.color.textMid },
  windowTextSelected: { color: theme.color.ink0, fontWeight: '700' },
});
