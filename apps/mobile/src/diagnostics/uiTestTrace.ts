/**
 * uiTestTrace.ts — CI-only trace of the Health permission flow for the iOS UI
 * tests (tools/ios_ui_tests.sh captures the app's system log).
 *
 * Inert unless the app is launched with `-AKUITestTrace 1` (iOS reads launch
 * arguments into NSUserDefaults; a person launching from the home screen
 * cannot pass them). It records only which branch the flow took and the
 * booleans that chose it: no athlete data, names, dates or health values.
 * Release builds drop console.log; an error-level log reaches the system log.
 */
import { Platform } from 'react-native';

export const UI_TEST_TRACE_SETTING = 'AKUITestTrace';
let enabled: boolean | null = null;

function traceEnabled(): boolean {
  if (enabled !== null) return enabled;
  enabled = false;
  if (Platform.OS !== 'ios') return enabled;
  try {
    const { Settings } = require('react-native') as { Settings?: { get(key: string): unknown } };
    const value = Settings?.get(UI_TEST_TRACE_SETTING);
    enabled = value === 1 || value === '1' || value === true || value === 'YES';
  } catch {
    enabled = false;
  }
  return enabled;
}

export function uiTestTrace(event: string): void {
  if (traceEnabled()) console.error(`[ak-health] ${event}`);
}
