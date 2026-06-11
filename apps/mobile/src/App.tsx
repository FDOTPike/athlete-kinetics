/**
 * App.tsx — shell: status bar, safe area, custom tab bar.
 *
 * No navigation library: three screens, one useState, 64pt tab targets.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette, useStore } from './state/useStore';
import { tryCreateDeviceEmbedder } from './inference/deviceEmbedder';
import ReadinessScreen from './screens/ReadinessScreen';
import SessionScreen from './screens/SessionScreen';
import PrescriptionScreen from './screens/PrescriptionScreen';

type Tab = 'readiness' | 'session' | 'coach';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'readiness', label: 'READINESS' },
  { key: 'session', label: 'SESSION' },
  { key: 'coach', label: 'COACH' },
];

/** Root boundary: a render-time throw becomes a readable screen with the
 *  actual error message — release builds otherwise die silently. */
interface BoundaryState {
  error: Error | null;
}
class RootErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error !== null) {
      return (
        <SafeAreaView style={styles.root}>
          <View style={styles.crashBox}>
            <Text style={styles.crashTitle}>APP ERROR</Text>
            <Text style={styles.crashText}>{String(this.state.error.message)}</Text>
            <Text style={styles.crashHint}>
              Screenshot this and report it. Your data is untouched.
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App(): React.JSX.Element {
  return (
    <RootErrorBoundary>
      <AppShell />
    </RootErrorBoundary>
  );
}

function AppShell(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('readiness');
  const boot = useStore((s) => s.boot);

  useEffect(() => {
    boot();
    // Async, optional: wires subjective-report triage when the embedding
    // model is reachable; the app is fully functional without it.
    void tryCreateDeviceEmbedder().then((e) => {
      useStore.getState().setEmbedder(e);
    });
  }, [boot]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      <View style={styles.body}>
        {tab === 'readiness' && <ReadinessScreen />}
        {tab === 'session' && <SessionScreen />}
        {tab === 'coach' && <PrescriptionScreen />}
      </View>
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t.label} tab`}
              style={styles.tabBtn}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bg,
  },
  tabBtn: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabText: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  tabTextActive: { color: palette.green },
  tabIndicator: { height: 3, width: 36, borderRadius: 2, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: palette.green },
  crashBox: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  crashTitle: { color: palette.red, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  crashText: { color: palette.text, fontSize: 15, lineHeight: 21 },
  crashHint: { color: palette.dim, fontSize: 13, lineHeight: 19 },
});
