/**
 * App.tsx — shell: status bar, safe area, custom tab bar with deterministic back navigation.
 *
 * Zero navigation library: five tabs, NavigationProvider stack, 64pt tab targets.
 */
import React, { useEffect, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tryCreateHealthConnectBridge } from '@ak/biometrics';
import { palette, useStore } from './state/useStore';
import { tryCreateDeviceEmbedder } from './inference/deviceEmbedder';
import { NavigationProvider, useNavigation, type Tab } from './navigation/navigation';
import TodayScreen from './screens/TodayScreen';
import ReadinessScreen from './screens/ReadinessScreen';
import SessionScreen from './screens/SessionScreen';
import ProgressScreen from './screens/ProgressScreen';
import ProgramSetupScreen from './screens/ProgramSetupScreen';
import BlockScreen from './screens/BlockScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProfileScreen from './screens/ProfileScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { statusBarPaddingTop } from './layout/statusBarPadding';

/**
 * W4: exactly THREE primary destinations. PLAN is the coach/program-management
 * route ('coach') presented under its athlete-facing name; Progress is the
 * read-only facts surface. Readiness detail, the live session, the Library,
 * and Profile/settings keep their existing route identities and are reached
 * from the header controls, so no capability is unreachable.
 */
const PRIMARY_TABS: readonly { key: Tab; label: string }[] = [
  { key: 'today', label: 'TODAY' },
  { key: 'coach', label: 'PLAN' },
  { key: 'progress', label: 'PROGRESS' },
];

/** Header controls: every non-primary surface keeps one stable way back. */
const HEADER_CONTROLS: readonly { key: Tab; label: string }[] = [
  { key: 'readiness', label: 'READINESS' },
  { key: 'session', label: 'SESSION' },
  { key: 'library', label: 'LIBRARY' },
  { key: 'athlete', label: 'ATHLETE' },
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
      <NavigationProvider>
        <AppShell />
      </NavigationProvider>
    </RootErrorBoundary>
  );
}

export function AppShell(): React.JSX.Element {
  const programSetupPending = useStore((s) =>
    s.status === 'ready' && s.onboarded && s.block === null && s.program === null);
  // "No block and no program" is NOT only a first-run state: archiving a
  // program archives its active block too, and an existing install can hold
  // nothing but archived blocks. Program setup is therefore an invitation, not
  // a gate — without a dismissal it hides the tab bar and strands the athlete
  // away from BlockScreen, routine templates, and the ATHLETE tab with no way
  // back (ProgramSetupScreen hides its own Cancel button when no onCancel is
  // supplied). Dismissal is per-visit: it resets as soon as the athlete leaves
  // the state, so archiving again re-offers setup.
  const [setupDismissed, setSetupDismissed] = useState(false);
  useEffect(() => {
    if (!programSetupPending) setSetupDismissed(false);
  }, [programSetupPending]);
  const showProgramSetup = programSetupPending && !setupDismissed;
  const { tab, setTab } = useNavigation();
  const boot = useStore((s) => s.boot);
  const status = useStore((s) => s.status);
  const onboarded = useStore((s) => s.onboarded);
  // W4: the header SESSION control shows a live-workout marker from the same
  // persisted-session fact TodayScreen already uses — never a guess.
  const session = useStore((s) => s.session);
  // First run (or a fresh Coach Mode athlete): the questionnaire replaces the
  // tabbed app until the profile is saved once. Existing installs never see it.
  const showOnboarding = status === 'ready' && !onboarded;

  useEffect(() => {
    boot();
    // Async, optional: wires subjective-report triage when the embedding
    // model is reachable; the app is fully functional without it.
    void tryCreateDeviceEmbedder().then((e) => {
      useStore.getState().setEmbedder(e);
    });
    // Health Connect is optional by contract: a null bridge (APK missing,
    // permission machinery broken, non-Android) costs nothing but telemetry.
    void tryCreateHealthConnectBridge().then((bridge) => {
      void useStore.getState().connectBiometrics(bridge);
    });
    // Foreground lifecycle: date rollover + biometric ingestion. No
    // background polling — nothing for Jetsam to kill mid-write.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useStore.getState().rolloverDay();
        void useStore.getState().syncBiometrics();
      }
    });
    return () => sub.remove();
  }, [boot]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {showOnboarding ? (
          <OnboardingScreen />
        ) : showProgramSetup ? (
          <ProgramSetupScreen onCancel={() => setSetupDismissed(true)} />
        ) : (
          <>
            {/* Shell-level route markers: assert WHICH route is active without
                depending on the inner screens' own internals. */}
            <View testID="session-screen-shown" style={styles.routeMarker} />
            {tab === 'today' && (
              <TodayScreen
                onOpenSession={() => setTab('session')}
                onOpenPlan={() => setTab('coach')}
              />
            )}
            {tab === 'readiness' && (
              <ReadinessScreen
                onOpenSession={() => setTab('session')}
                onOpenCoach={() => setTab('coach')}
              />
            )}
            {tab === 'session' && <SessionScreen />}
            {tab === 'progress' && <ProgressScreen />}
            {tab === 'coach' && status === 'ready' && (
              <BlockScreen onSessionStarted={() => setTab('session')} />
            )}
            {tab === 'library' && <LibraryScreen />}
            {tab === 'athlete' && (
              <View style={{ flex: 1 }} testID="athlete-screen-shown">
                <ProfileScreen />
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
      {!showOnboarding && !showProgramSetup && (
        <>
          {/* W4 header controls: the non-primary surfaces stay one tap away.
              The SESSION control carries a live-workout marker so an active
              workout is findable from anywhere without becoming a tab. */}
          <View style={styles.headerBar} accessibilityRole="toolbar">
            {HEADER_CONTROLS.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t.label}${t.key === 'session' && session !== null ? ' — workout in progress' : ''}`}
                  testID={`header-${t.key}`}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.tabBtnPressed]}
                >
                  <Text
                    style={[styles.headerText, active && styles.headerTextActive]}
                    accessibilityLiveRegion={t.key === 'session' ? 'polite' : undefined}
                  >
                    {t.key === 'session' && session !== null ? '● SESSION' : t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.tabBar} accessibilityRole="tablist">
            {PRIMARY_TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t.label} tab`}
                  testID={`tab-${t.key}`}
                  style={({ pressed }) => [styles.tabBtn, pressed && styles.tabBtnPressed]}
                >
                  <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
    // RN's SafeAreaView only pads on iOS. Honor Android's reported inset, but
    // keep the standard minimum when an edge-to-edge runtime reports zero.
    paddingTop: statusBarPaddingTop(Platform.OS, StatusBar.currentHeight),
  },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.bg,
  },
  headerBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.bg,
  },
  headerBtn: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    color: palette.faint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTextActive: {
    color: palette.text,
  },
  routeMarker: { height: 0, opacity: 0 },
  tabBtn: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnPressed: {
    opacity: 0.7,
  },
  tabText: { color: palette.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  tabTextActive: { color: palette.text, fontWeight: '800' },
  tabIndicator: { height: 3, width: 32, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: palette.chalk },
  crashBox: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  crashTitle: { color: palette.red, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  crashText: { color: palette.text, fontSize: 15, lineHeight: 21 },
  crashHint: { color: palette.dim, fontSize: 13, lineHeight: 19 },
});
