/**
 * biometricsCopy.ts — the ATHLETE screen's health-data wording, per platform.
 *
 * The two services do not mean the same thing by "ready":
 *   - Health Connect reports granted permissions, so "ready" means the app may
 *     read overnight HRV (RMSSD), resting heart rate and sleep.
 *   - Apple Health never reveals whether READ access was allowed (an empty
 *     result can mean no data or no access), and this app reads sleep only on
 *     iOS (HealthKit's HRV is SDNN, not the RMSSD the coach is calibrated on).
 *     So "ready" on iOS means "access was requested" — never "connected" or
 *     "granted" — and the copy says where to change it.
 * Wording only; behaviour lives in the store and the platform bridges.
 */
import type { BiometricsProvider } from '@ak/biometrics';

export type BiometricsUiStatus = 'off' | 'unavailable' | 'idle' | 'denied' | 'ready';

export interface BiometricsCopy {
  title: string;
  hint: string;
  connectLabel: string | null;
  connectAccessibilityLabel: string;
  syncAccessibilityLabel: string;
  /** The HRV glossary tip only applies where HRV is actually read. */
  showHrvTip: boolean;
}

/** Same mapping as @ak/biometrics biometricsProviderFor, kept local so the
 *  screen depends on no runtime export of the native-bridge package. */
export function providerForPlatform(os: string): BiometricsProvider {
  return os === 'android' ? 'health_connect' : os === 'ios' ? 'apple_health' : null;
}

export function biometricsCopy(provider: BiometricsProvider, status: BiometricsUiStatus): BiometricsCopy {
  const connectLabel = status === 'idle' ? 'CONNECT' : status === 'denied' ? 'TRY AGAIN' : null;
  if (provider === 'apple_health') {
    const hint = status === 'ready'
      ? 'Apple Health access requested. Sleep that Health shares feeds your readiness score, synced when the app comes to the foreground. '
        + 'Apple Health does not tell apps whether you allowed reading, so if no sleep appears, check Settings › Health › Data Access & Devices. '
        + 'HRV is not read on iPhone: Health records a different HRV measure (SDNN) from the one this coach uses.'
      : status === 'idle'
        ? 'Apple Health is available. Tap CONNECT to choose whether to share sleep — the coach works fully without it.'
        : status === 'denied'
          ? 'The Apple Health request did not complete. The coach still works fully from training data and your reports. Tap TRY AGAIN.'
          : status === 'unavailable'
            ? 'Apple Health is not available on this device. The coach runs on training data and your reports — nothing else changes.'
            : 'Checking Apple Health…';
    return {
      title: 'HEALTH DATA — APPLE HEALTH',
      hint,
      connectLabel,
      connectAccessibilityLabel: 'Choose whether to share sleep from Apple Health',
      syncAccessibilityLabel: 'Sync sleep from Apple Health now',
      showHrvTip: false,
    };
  }
  const hint = status === 'ready'
    ? 'Connected. Overnight HRV, resting heart rate, and sleep feed your readiness score automatically — synced when the app comes to the foreground.'
    : status === 'idle'
      ? 'Health Connect is available. Tap CONNECT to grant read access to overnight HRV, resting heart rate, and sleep — the coach works fully without it.'
      : status === 'denied'
        ? 'Permission not granted. The coach still works fully from training data and your reports. Tap TRY AGAIN, or grant read access in Health Connect settings.'
        : status === 'unavailable'
          ? provider === null
            ? 'Health data is not available on this device. The coach runs on training data and your reports — nothing else changes.'
            : 'Health Connect is not available on this device. The coach runs on training data and your reports — nothing else changes.'
          : 'Checking Health Connect…';
  return {
    title: 'BIOMETRICS — HEALTH CONNECT',
    hint,
    connectLabel,
    connectAccessibilityLabel: 'Connect Health Connect and grant read permissions',
    syncAccessibilityLabel: 'Sync biometrics from Health Connect now',
    showHrvTip: true,
  };
}
