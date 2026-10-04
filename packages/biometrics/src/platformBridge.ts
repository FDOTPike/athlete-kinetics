/**
 * platformBridge.ts — the one biometrics factory the app calls.
 *
 * Android -> Health Connect, iOS -> Apple Health, anything else (or any
 * failure) -> null, which the store treats as "unavailable": the coach runs on
 * training data and subjective reports, nothing else changes. Both bridges
 * honour the same read-only, explicit-tap contract (BiometricsBridge).
 */
import { tryCreateAppleHealthBridge } from './appleHealth';
import { tryCreateHealthConnectBridge, type BiometricsBridge } from './healthConnect';

export type BiometricsProvider = 'health_connect' | 'apple_health' | null;

/** Which service this platform would read, for honest UI wording. */
export function biometricsProviderFor(os: string): BiometricsProvider {
  if (os === 'android') return 'health_connect';
  if (os === 'ios') return 'apple_health';
  return null;
}

export async function tryCreateBiometricsBridge(): Promise<BiometricsBridge | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native') as { Platform: { OS: string } };
    const provider = biometricsProviderFor(rn.Platform.OS);
    if (provider === 'health_connect') return await tryCreateHealthConnectBridge();
    if (provider === 'apple_health') return await tryCreateAppleHealthBridge();
    return null;
  } catch {
    return null;
  }
}
