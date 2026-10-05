/**
 * apps/mobile/react-native.config.js — autolinking overrides for the app
 * project (the CLI resolves `config` from this directory for both the Podfile
 * and Gradle autolinking).
 *
 * Apple Health is an iOS-only service. Its React Native binding and the Nitro
 * runtime it depends on are linked on iOS ONLY: on Android the app reads Health
 * Connect, and adding their native libraries there would add an unused .so to
 * the APK and to its 16 KB page-alignment audit (tools/inspect_elf_alignment.sh).
 * packages/biometrics/src/appleHealth.ts requires the binding only when
 * Platform.OS === 'ios'.
 */
module.exports = {
  dependencies: {
    '@kingstinct/react-native-healthkit': { platforms: { android: null } },
    '@react-native-healthkit/core': { platforms: { android: null } },
    'react-native-nitro-modules': { platforms: { android: null } },
  },
};
