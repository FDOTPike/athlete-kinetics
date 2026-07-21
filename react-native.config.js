/**
 * react-native.config.js — asset linking config.
 *
 * WO-UI-0: registers apps/mobile/assets/fonts/ so `npx react-native-asset`
 * links Archivo-VariableFont_wdth,wght.ttf into the Android res/font and
 * iOS Info.plist.
 *
 * After adding the TTF file to assets/fonts/, run:
 *   npx react-native-asset
 * Then rebuild the native project.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./apps/mobile/assets/fonts'],
};
