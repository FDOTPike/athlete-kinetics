/**
 * ReadinessScreen.tsx — today's System Readiness dashboard.
 *
 * Reads the materialized state_vector only (the same single-row surface the
 * SLM consumes). No charts libraries, no animations: plain Views sized by
 * data, classification by the same thresholds the SLM policy uses.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StateVectorRow } from '@ak/inference';
import { palette, useStore } from '../state/useStore';

// ---------------------------------------------------------------------------
// Classification — mirrors the LOADCTL policy bands (promptAssembly.ts):
// ACWR > 1.5 or R < 40 is the hard-cut regime; optimal requires R >= 70
// inside the 0.8-1.3 ACWR sweet spot; everything else is recovery/caution.
// ---------------------------------------------------------------------------
export type AthleteState = 'OPTIMAL' | 'OVERREACHED' | 'RECOVERY';

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

const STATE_META: Record<AthleteState, { color: string; blurb: string }> = {
  OPTIMAL: { color: palette.green, blurb: 'Load tolerance high. Execute or push the plan.' },
  OVERREACHED: { color: palette.red, blurb: 'Load spike or suppressed recovery. Cut volume.' },
  RECOVERY: { color: palette.amber, blurb: 'Partial recovery. Hold the plan, cap intensity.' },
};

const fmt = (v: number | null, dp: number, suffix = ''): string =>
  v === null ? '—' : `${v.toFixed(dp)}${suffix}`;
const fmtSigned = (v: number | null, dp: number): string =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}σ`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface MetricTileProps {
  label: string;
  value: string;
  alert?: boolean;
}
function MetricTile({ label, value, alert = false }: MetricTileProps): React.JSX.Element {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, alert && { color: palette.red }]}>{value}</Text>
    </View>
  );
}

interface TrendBarsProps {
  points: readonly { date: string; readiness_score: number }[];
}
function TrendBars({ points }: TrendBarsProps): React.JSX.Element {
  return (
    <View style={styles.trendRow}>
      {points.map((p) => {
        const color =
          p.readiness_score >= 70
            ? palette.green
            : p.readiness_score >= 40
              ? palette.amber
              : palette.red;
        return (
          <View key={p.date} style={styles.trendSlot}>
            <View
              style={[
                styles.trendBar,
                { height: Math.max(4, (p.readiness_score / 100) * 64), backgroundColor: color },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function ReadinessScreen(): React.JSX.Element {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const today = useStore((s) => s.today);
  const vector = useStore((s) => s.vector);
  const trend = useStore((s) => s.trend);
  const boot = useStore((s) => s.boot);
  const refreshVector = useStore((s) => s.refreshVector);
  const loadDemoAthlete = useStore((s) => s.loadDemoAthlete);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshVector(); // synchronous JSI read; spinner is purely tactile
    setRefreshing(false);
  }, [refreshVector]);

  useEffect(() => {
    boot();
  }, [boot]);

  if (status === 'booting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.green} />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>DB BOOT FAILED</Text>
        <Text style={styles.dimText}>{error ?? 'unknown error'}</Text>
        <Pressable
          style={styles.bigButton}
          onPress={boot}
          accessibilityRole="button"
          accessibilityLabel="Retry database boot"
        >
          <Text style={styles.bigButtonText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  if (vector === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>NO STATE VECTOR</Text>
        <Text style={styles.dimText}>
          No data yet for {today}. Log sessions and sync telemetry — or explore the app with a
          180-day demo athlete (only available while the database is empty).
        </Text>
        <Pressable
          style={styles.bigButton}
          onPress={loadDemoAthlete}
          accessibilityRole="button"
          accessibilityLabel="Load the 180 day demo athlete"
        >
          <Text style={styles.bigButtonText}>LOAD DEMO ATHLETE</Text>
        </Pressable>
        <Pressable
          style={styles.bigButton}
          onPress={refreshVector}
          accessibilityRole="button"
          accessibilityLabel="Retry loading today's state vector"
        >
          <Text style={styles.bigButtonText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  const athleteState = classifyReadiness(vector);
  const meta = STATE_META[athleteState];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.dim} />
      }
    >
      <Text style={styles.dateLabel}>{vector.date}</Text>

      <Text
        style={[styles.score, { color: meta.color }]}
        accessibilityLabel={`System readiness ${Math.round(vector.readiness_score)} out of 100, state ${athleteState}`}
      >
        {Math.round(vector.readiness_score)}
      </Text>
      <Text style={styles.scoreCaption}>SYSTEM READINESS</Text>

      <View style={[styles.banner, { borderColor: meta.color }]}>
        <Text style={[styles.bannerState, { color: meta.color }]}>{athleteState}</Text>
        <Text style={styles.bannerBlurb}>{meta.blurb}</Text>
      </View>

      <View style={styles.tileRow}>
        <MetricTile
          label="ACWR"
          value={fmt(vector.acwr, 2)}
          alert={vector.acwr !== null && vector.acwr > 1.5}
        />
        <MetricTile
          label="HRV Z"
          value={fmtSigned(vector.hrv_z, 1)}
          alert={vector.hrv_z !== null && vector.hrv_z < -1.5}
        />
      </View>
      <View style={styles.tileRow}>
        <MetricTile label="SLEEP EFF" value={fmt(vector.sleep_efficiency_pct, 1, '%')} />
        <MetricTile label="SPO2" value={fmt(vector.spo2_night_mean, 1, '%')} />
      </View>

      <Text style={styles.sectionLabel}>14-DAY READINESS</Text>
      <TrendBars points={trend} />
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
    gap: 16,
  },
  dateLabel: {
    color: palette.dim,
    fontSize: 14,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  score: {
    fontSize: 112,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    lineHeight: 118,
  },
  scoreCaption: {
    color: palette.dim,
    fontSize: 13,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  banner: {
    borderWidth: 2,
    borderRadius: 14,
    backgroundColor: palette.surface,
    padding: 18,
    marginBottom: 16,
  },
  bannerState: { fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  bannerBlurb: { color: palette.text, fontSize: 15, marginTop: 6, lineHeight: 21 },
  tileRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  tileLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2, marginBottom: 6 },
  tileValue: {
    color: palette.text,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    color: palette.dim,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 10,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 64,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  trendSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  errorTitle: { color: palette.red, fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  dimText: { color: palette.dim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bigButton: {
    minHeight: 64,
    minWidth: 220,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: { color: palette.green, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
});
