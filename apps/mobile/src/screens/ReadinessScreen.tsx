/**
 * ReadinessScreen.tsx - the READY surface.
 *
 * This is intentionally a decision surface, not a dashboard. The immediate
 * recommendation stays visible; the underlying vector and history are only
 * available through inline disclosure.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { StateVectorRow } from '@ak/inference';
import { palette, useStore } from '../state/useStore';
import {
  Body,
  Caption,
  Disclosure,
  FocusCard,
  PrimaryAction,
  ProgressRow,
  Screen,
  SecondaryAction,
  Section,
  StatusMark,
  type FocusTone,
} from '../components/FocusPrimitives';

export type AthleteState = 'OPTIMAL' | 'OVERREACHED' | 'RECOVERY';

/** Mirrors the LOADCTL policy bands without making this screen an engine. */
export function classifyReadiness(v: StateVectorRow): AthleteState {
  if ((v.acwr !== null && v.acwr > 1.5) || v.readiness_score < 40) return 'OVERREACHED';
  if (
    v.readiness_score >= 70 &&
    (v.acwr === null || (v.acwr >= 0.8 && v.acwr <= 1.3))
  ) {
    return 'OPTIMAL';
  }
  return 'RECOVERY';
}

interface ReadinessMeta {
  label: string;
  title: string;
  recommendation: string;
  explanation: string;
  tone: FocusTone;
}

const STATE_META: Record<AthleteState, ReadinessMeta> = {
  OPTIMAL: {
    label: 'Ready',
    title: 'Ready to train',
    recommendation: 'Follow today\'s plan at the effort it prescribes.',
    explanation: 'Your recent training load and recovery signals support the planned work.',
    tone: 'success',
  },
  RECOVERY: {
    label: 'Recovery focus',
    title: 'Train steadily today',
    recommendation: 'Keep the planned work controlled and leave room to recover.',
    explanation: 'Your signals support training with a conservative, steady effort.',
    tone: 'caution',
  },
  OVERREACHED: {
    label: 'Recovery needed',
    title: 'Make recovery the work',
    recommendation: 'Reduce training stress today and follow the adjusted plan.',
    explanation: 'Your recent load or readiness score indicates that extra recovery is the useful next step.',
    tone: 'danger',
  },
};

const HALT_META: ReadinessMeta = {
  label: 'Training paused',
  title: 'Resolve today\'s safety report',
  recommendation: 'Training is paused for today. Review the report before doing more work.',
  explanation: 'A safety report set a halt for today. The Coach view keeps the related guidance visible.',
  tone: 'danger',
};

const format = (value: number | null, digits: number, suffix = ''): string =>
  value === null ? 'Not available' : `${value.toFixed(digits)}${suffix}`;

const formatSigned = (value: number | null, digits: number): string =>
  value === null ? 'Not available' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

export interface ReadinessScreenProps {
  /** Supplied by the shell so the focused action can open a live session. */
  onOpenSession?: () => void;
  /** Supplied by the shell so the focused action can take the athlete to Coach. */
  onOpenCoach?: () => void;
}

function CenteredState({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.center}>{children}</View>;
}

export default function ReadinessScreen({
  onOpenSession,
  onOpenCoach,
}: ReadinessScreenProps): React.JSX.Element {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const today = useStore((s) => s.today);
  const vector = useStore((s) => s.vector);
  const trend = useStore((s) => s.trend);
  const session = useStore((s) => s.session);
  const todayPlan = useStore((s) => s.todayPlan);
  const lastTriage = useStore((s) => s.lastTriage);
  const uiPreferences = useStore((s) => s.uiPreferences);
  const boot = useStore((s) => s.boot);
  const refreshVector = useStore((s) => s.refreshVector);
  const loadDemoAthlete = useStore((s) => s.loadDemoAthlete);
  const resetTrainingData = useStore((s) => s.resetTrainingData);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'booting') {
    return (
      <CenteredState>
        <ActivityIndicator size="large" color={palette.green} />
        <Caption>Preparing your training data.</Caption>
      </CenteredState>
    );
  }

  if (status === 'error') {
    return (
      <CenteredState>
        <FocusCard eyebrow="READY" title="Training data needs attention" tone="danger">
          <Body>{error ?? 'The database could not be opened.'}</Body>
          <PrimaryAction label="Retry" onPress={boot} accessibilityLabel="Retry database boot" />
        </FocusCard>
      </CenteredState>
    );
  }

  if (vector === null) {
    return (
      <Screen testID="readiness-screen">
        <FocusCard eyebrow="READY" title="No readiness yet" tone="default">
          <Body>
            Log a session and sync any available telemetry to build today\'s recommendation.
          </Body>
          <PrimaryAction
            label="Load demo athlete"
            onPress={loadDemoAthlete}
            accessibilityLabel="Load the 180 day demo athlete"
          />
          <SecondaryAction label="Refresh" onPress={refreshVector} />
          <Disclosure label="Reset and load demo" tone="danger">
            {!confirmReset ? (
              <>
                <Caption>
                  This removes training history, telemetry, blocks, and today\'s reports. Your
                  profile and saved profile slots remain.
                </Caption>
                <SecondaryAction
                  label="Continue to reset"
                  onPress={() => setConfirmReset(true)}
                  accessibilityLabel="Continue to reset training data and load demo"
                />
              </>
            ) : (
              <>
                <Body>This cannot be undone. Reset the training data and load the demo athlete?</Body>
                <PrimaryAction
                  label="Reset training data and load demo"
                  onPress={() => {
                    resetTrainingData();
                    loadDemoAthlete();
                    setConfirmReset(false);
                  }}
                  accessibilityLabel="Confirm reset training data and load demo athlete"
                />
                <SecondaryAction label="Keep my data" onPress={() => setConfirmReset(false)} />
              </>
            )}
          </Disclosure>
        </FocusCard>
      </Screen>
    );
  }

  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
  const athleteState = classifyReadiness(vector);
  const meta = halted ? HALT_META : STATE_META[athleteState];
  const hasLiveSession = session !== null;
  const primaryLabel = halted
    ? 'Review safety report'
    : hasLiveSession
      ? 'Open active session'
      : todayPlan !== null
        ? 'Review today\'s plan'
        : athleteState === 'OVERREACHED'
          ? 'Review recovery plan'
          : 'Review your plan';
  const primaryHandler = hasLiveSession ? onOpenSession : onOpenCoach;

  return (
    <Screen testID="readiness-screen">
      <FocusCard eyebrow="TODAY" title={meta.title} tone={meta.tone}>
        <StatusMark label={meta.label} tone={meta.tone} />
        <Body>{meta.recommendation}</Body>
        {hasLiveSession && <Caption>Your active workout is ready to resume.</Caption>}
        {!hasLiveSession && todayPlan !== null && (
          <Caption>{todayPlan.focus} is planned today.</Caption>
        )}
        {!hasLiveSession && todayPlan === null && !halted && (
          <Caption>
            {athleteState === 'OVERREACHED'
              ? 'There is no training task to force today.'
              : 'There is no planned session for today.'}
          </Caption>
        )}
        {primaryHandler !== undefined ? (
          <PrimaryAction label={primaryLabel} onPress={primaryHandler} />
        ) : (
          <Caption style={styles.navigationHint}>Open the relevant tab below to continue.</Caption>
        )}
      </FocusCard>

      <Section title="Details">
        <Disclosure label="Why this recommendation" hint="The short explanation first">
          <Body>{meta.explanation}</Body>
          {halted && lastTriage !== null && lastTriage.kind === 'matched' && (
            <Caption style={styles.haltCue}>{lastTriage.directive.vector.coaching_cue}</Caption>
          )}
          {uiPreferences.readinessDetail === 'full' ? (
          <Disclosure label="Full readiness metrics" hint="Numbers and recent history">
            <ProgressRow
              label="Readiness score"
              value={`${Math.round(vector.readiness_score)} / 100`}
              tone={meta.tone}
            />
            <ProgressRow label="Acute to chronic load" value={format(vector.acwr, 2)} />
            <ProgressRow label="HRV deviation" value={formatSigned(vector.hrv_z, 1)} />
            <ProgressRow label="Sleep efficiency" value={format(vector.sleep_efficiency_pct, 1, '%')} />
            <ProgressRow label="Night SpO2" value={format(vector.spo2_night_mean, 1, '%')} />
            <ProgressRow label="Acute load" value={format(vector.acute_load_kg, 0, ' kg')} />
            <ProgressRow label="Chronic load" value={format(vector.chronic_load_kg, 0, ' kg')} />
            <ProgressRow label="HRV component" value={vector.hrv_component.toFixed(1)} />
            <ProgressRow label="Load component" value={vector.load_component.toFixed(1)} />
            <ProgressRow label="Sleep component" value={vector.sleep_component.toFixed(1)} />
            <ProgressRow label="SpO2 component" value={vector.spo2_component.toFixed(1)} />
            <Disclosure label="Recent readiness" hint="Last seven recorded days">
              {trend.length === 0 ? (
                <Caption>No recent readiness history is available.</Caption>
              ) : (
                trend.slice(-7).reverse().map((point) => (
                  <ProgressRow
                    key={point.date}
                    label={point.date}
                    value={`${Math.round(point.readiness_score)} / 100`}
                    tone={
                      point.readiness_score >= 70
                        ? 'success'
                        : point.readiness_score >= 40
                          ? 'caution'
                          : 'danger'
                    }
                  />
                ))
              )}
            </Disclosure>
          </Disclosure>
          ) : (
            <Caption>Full metrics are hidden for this profile. You can change that in Athlete.</Caption>
          )}
          <SecondaryAction label="Refresh readiness" onPress={refreshVector} />
        </Disclosure>
      </Section>

      <Caption style={styles.date}>Readiness for {today}</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  navigationHint: { textAlign: 'center', marginTop: 4 },
  haltCue: { color: palette.amber, marginTop: 2 },
  date: { textAlign: 'center', marginTop: 24 },
});