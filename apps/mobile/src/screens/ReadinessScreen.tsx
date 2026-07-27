/**
 * ReadinessScreen.tsx - the READY surface.
 *
 * This is intentionally a decision surface, not a dashboard. The immediate
 * recommendation stays visible; the underlying vector and history are only
 * available through inline disclosure.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StateVectorRow } from '@ak/inference';
import { useStore } from '../state/useStore';
import { theme } from '../theme/theme';
import {
  PrimaryButton,
  SecondaryButton,
  ListRow,
  Disclosure,
} from '../components/ui';

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
}

const STATE_META: Record<AthleteState, ReadinessMeta> = {
  OPTIMAL: {
    label: 'Ready',
    title: 'Ready to train',
    recommendation: 'Follow today\'s plan at the effort it prescribes.',
    explanation: 'Your recent training load and recovery signals support the planned work.',
  },
  RECOVERY: {
    label: 'Recovery focus',
    title: 'Train steadily today',
    recommendation: 'Keep the planned work controlled and leave room to recover.',
    explanation: 'Your signals support training with a conservative, steady effort.',
  },
  OVERREACHED: {
    label: 'Recovery needed',
    title: 'Make recovery the work',
    recommendation: 'Reduce training stress today and follow the adjusted plan.',
    explanation: 'Your recent load or readiness score indicates that extra recovery is the useful next step.',
  },
};

const HALT_META: ReadinessMeta = {
  label: 'Training paused',
  title: 'Resolve today\'s safety report',
  recommendation: 'Training is paused for today. Review the report before doing more work.',
  explanation: 'A safety report set a halt for today. The Coach view keeps the related guidance visible.',
};

const format = (value: number | null, digits: number, suffix = ''): string =>
  value === null ? 'Not available' : `${value.toFixed(digits)}${suffix}`;

const formatSigned = (value: number | null, digits: number): string =>
  value === null ? 'Not available' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

export const readinessCoverage = (vector: StateVectorRow): string => {
  const available = [vector.acwr !== null, vector.hrv_z !== null, vector.sleep_efficiency_pct !== null]
    .filter(Boolean).length;
  if (available === 0) return 'No current inputs';
  if (available === 1 && vector.acwr !== null) return 'Load only · 1 of 3 inputs';
  return `${available} of 3 inputs`;
};
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
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    try {
      refreshVector();
    } finally {
      setRefreshing(false);
    }
  }, [refreshVector]);

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'booting') {
    return (
      <CenteredState>
        <ActivityIndicator size="large" color={theme.color.textHi} />
        <Text style={styles.infoText}>Preparing your training data.</Text>
      </CenteredState>
    );
  }

  if (status === 'error') {
    return (
      <CenteredState>
        <View style={styles.card}>
          <Text style={styles.wordmark}>READY</Text>
          <Text style={styles.title}>Training data needs attention</Text>
          <Text style={styles.body}>{error ?? 'The database could not be opened.'}</Text>
          <PrimaryButton label="Retry" onPress={boot} accessibilityLabel="Retry database boot" />
        </View>
      </CenteredState>
    );
  }

  if (vector === null) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.contentContainer} testID="readiness-screen">
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.wordmark}>READY</Text>
          <Text style={styles.title}>No readiness yet</Text>
          <Text style={styles.body}>
            Log a session and sync any available telemetry to build today's recommendation.
          </Text>
          <PrimaryButton
            label="Load demo athlete"
            onPress={loadDemoAthlete}
            accessibilityLabel="Load the 180 day demo athlete"
          />
          <SecondaryButton label="Refresh" onPress={refreshVector} />
          <View style={{ marginTop: theme.space[3] }}>
            <Disclosure label="Reset and load demo">
              {!confirmReset ? (
                <View style={{ gap: theme.space[3] }}>
                  <Text style={styles.caption}>
                    This removes training history, telemetry, blocks, and today's reports. Your
                    profile and saved profile slots remain.
                  </Text>
                  <SecondaryButton
                    label="Continue to reset"
                    onPress={() => setConfirmReset(true)}
                    accessibilityLabel="Continue to reset training data and load demo"
                  />
                </View>
              ) : (
                <View style={{ gap: theme.space[3] }}>
                  <Text style={styles.body}>This cannot be undone. Reset the training data and load the demo athlete?</Text>
                  <PrimaryButton
                    label="Reset training data and load demo"
                    onPress={() => {
                      resetTrainingData();
                      loadDemoAthlete();
                      setConfirmReset(false);
                    }}
                    accessibilityLabel="Confirm reset training data and load demo athlete"
                  />
                  <SecondaryButton label="Keep my data" onPress={() => setConfirmReset(false)} />
                </View>
              )}
            </Disclosure>
          </View>
        </View>
      </ScrollView>
    );
  }

  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
  const athleteState = classifyReadiness(vector);
  const meta = halted ? HALT_META : STATE_META[athleteState];
  const hasLiveSession = session !== null;
  const isRestDay = todayPlan === null && !halted && !hasLiveSession;

  const primaryLabel = halted
    ? 'Review safety report'
    : hasLiveSession
      ? 'Open active session'
      : todayPlan !== null
        ? "Review today's plan"
        : athleteState === 'OVERREACHED'
          ? 'Review recovery plan'
          : 'Review your plan';
  const primaryHandler = hasLiveSession ? onOpenSession : onOpenCoach;

  // Quiet readiness metrics rows
  const renderRawMetricsList = () => {
    return (
      <View style={{ gap: theme.space[1] }}>
        <ListRow
          label="Readiness estimate"
          detail={`${Math.round(vector.readiness_score)} / 100`}
        />
        <ListRow label="Data coverage" detail={readinessCoverage(vector)} />
        <ListRow label="Acute to chronic load" detail={format(vector.acwr, 2)} />
        <ListRow label="HRV deviation" detail={formatSigned(vector.hrv_z, 1)} />
        <ListRow label="Sleep efficiency" detail={format(vector.sleep_efficiency_pct, 1, '%')} />
        <ListRow label="Acute load" detail={format(vector.acute_load_kg, 0, ' kg')} />
        <ListRow label="Chronic load" detail={format(vector.chronic_load_kg, 0, ' kg')} />
        <ListRow label="HRV component" detail={vector.hrv_component.toFixed(1)} />
        <ListRow label="Load component" detail={vector.load_component.toFixed(1)} />
        <ListRow label="Sleep component" detail={vector.sleep_component.toFixed(1)} />

        <View style={{ marginTop: theme.space[3] }}>
          <Disclosure label="Recent readiness" hint="Last seven recorded days">
            {trend.length === 0 ? (
              <Text style={styles.caption}>No recent readiness history is available.</Text>
            ) : (
              <View style={{ gap: theme.space[1] }}>
                {trend.slice(-7).reverse().map((point) => (
                  <ListRow
                    key={point.date}
                    label={point.date}
                    detail={`${Math.round(point.readiness_score)} / 100`}
                  />
                ))}
              </View>
            )}
          </Disclosure>
        </View>
      </View>
    );
  };

  if (isRestDay) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.color.textMid} colors={[theme.color.textMid]} />}
        testID="readiness-screen"
      >
        {/* Wordmark top-left */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
        </View>

        {/* Display-type Rest day statement */}
        <Text style={styles.displayMain}>Rest day.</Text>
        <Text style={styles.displaySub}>That's the work.</Text>

        <View style={styles.section}>
          <Disclosure label="Why this recommendation" hint="The short explanation first">
            <Text style={styles.body}>{meta.explanation}</Text>
            <View style={{ marginTop: theme.space[4] }}>
              <SecondaryButton label="Refresh readiness" onPress={refreshVector} />
            </View>
          </Disclosure>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>READINESS METRICS</Text>
          {uiPreferences.readinessDetail === 'full' ? (
            renderRawMetricsList()
          ) : (
            <Text style={styles.caption}>
              Full metrics are hidden for this profile. You can change that in Athlete.
            </Text>
          )}
        </View>

        <Text style={styles.date}>Readiness for {today}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.color.textMid} colors={[theme.color.textMid]} />}
      testID="readiness-screen"
    >
      {/* Wordmark top-left */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>pikeMethods</Text>
      </View>

      <View style={[styles.card, styles.cardActiveSpine]}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{meta.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.body}>{meta.recommendation}</Text>
        {hasLiveSession && <Text style={styles.caption}>Your active workout is ready to resume.</Text>}
        {!hasLiveSession && todayPlan !== null && (
          <Text style={styles.caption}>{todayPlan.focus} is planned today.</Text>
        )}
        {!hasLiveSession && todayPlan === null && !halted && (
          <Text style={styles.caption}>
            {athleteState === 'OVERREACHED'
              ? 'There is no training task to force today.'
              : 'There is no planned session for today.'}
          </Text>
        )}
        {primaryHandler !== undefined ? (
          <PrimaryButton label={primaryLabel} onPress={primaryHandler} />
        ) : (
          <Text style={styles.navigationHint}>Open the relevant tab below to continue.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DETAILS</Text>
        <Disclosure label="Why this recommendation" hint="The short explanation first">
          <Text style={styles.body}>{meta.explanation}</Text>
          {halted && lastTriage !== null && lastTriage.kind === 'matched' && (
            <Text style={styles.haltCue}>{lastTriage.directive.vector.coaching_cue}</Text>
          )}
          <View style={{ marginTop: theme.space[3] }}>
            {uiPreferences.readinessDetail === 'full' ? (
              <Disclosure label="Full readiness metrics" hint="Numbers and recent history">
                {renderRawMetricsList()}
              </Disclosure>
            ) : (
              <Text style={styles.caption}>
                Full metrics are hidden for this profile. You can change that in Athlete.
              </Text>
            )}
          </View>
          <View style={{ marginTop: theme.space[3] }}>
            <SecondaryButton label="Refresh readiness" onPress={refreshVector} />
          </View>
        </Disclosure>
      </View>

      <Text style={styles.date}>Readiness for {today}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  contentContainer: {
    paddingHorizontal: theme.space[4], // 16
    paddingTop: theme.space[4],        // 16
    paddingBottom: theme.space[6],     // 32
  },
  header: {
    marginBottom: theme.space[4],
  },
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  center: {
    flex: 1,
    backgroundColor: theme.color.ink0,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: theme.space[5],
    gap: theme.space[4],
  },
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[5],
    gap: theme.space[4],
  },
  cardActiveSpine: {
    borderLeftWidth: 3,
    borderLeftColor: theme.color.chalk,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  statusBadgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  title: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  body: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  caption: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  displayMain: {
    ...theme.font.display,
    color: theme.color.textHi,
    marginTop: theme.space[4],
  },
  displaySub: {
    ...theme.font.display,
    color: theme.color.textMid,
    marginBottom: theme.space[5],
  },
  section: {
    marginTop: theme.space[5],
    gap: theme.space[3],
  },
  sectionTitle: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  navigationHint: {
    textAlign: 'center',
    marginTop: theme.space[2],
    ...theme.font.label,
    color: theme.color.textMid,
  },
  haltCue: {
    color: theme.color.chalk,
    marginTop: theme.space[2],
    ...theme.font.body,
  },
  date: {
    textAlign: 'center',
    marginTop: theme.space[5],
    ...theme.font.label,
    color: theme.color.textLow,
  },
  infoText: {
    ...theme.font.body,
    color: theme.color.textMid,
    textAlign: 'center',
  },
});