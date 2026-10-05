/**
 * AppShellTestHarness.tsx — W4 test harness.
 *
 * Renders the REAL AppShell wrapped in ONE NavigationProvider owned by the
 * harness, so the BackProbe observes the exact context the shell consumes.
 * App's boot side-effects (device embedder, Health Connect) are mocked at the
 * module boundary in the test file and never run here.
 */
import React from 'react';
import { NavigationProvider, useNavigation } from './navigation/navigation';
import { AppShell } from './App';

export default function AppShellTestHarness({ onBackState }: { onBackState?: (poppable: boolean) => void }): React.JSX.Element {
  return (
    <NavigationProvider initialTab="today">
      <BackProbe onBackState={onBackState} />
      <AppShell />
    </NavigationProvider>
  );
}

/** Reads the live navigation context so tests can assert back-stack depth. */
function BackProbe({ onBackState }: { onBackState?: (poppable: boolean) => void }): React.JSX.Element | null {
  const { tabHistory } = useNavigation();
  React.useEffect(() => {
    onBackState?.(tabHistory.length > 1);
  }, [tabHistory, onBackState]);
  return null;
}
