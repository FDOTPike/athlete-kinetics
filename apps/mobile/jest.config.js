'use strict';

const path = require('path');

// Resolve the component-test directory once, with FORWARD slashes. Jest's
// `<rootDir>` substitution on Windows leaves backslash-dot sequences intact
// (e.g. `Athlete App\.worktrees`), and micromatch reads `\.` as an ESCAPED
// dot — so a testMatch built as `<rootDir>/test/components/...` matches zero
// files whenever the checkout path contains a dot-directory (any git
// worktree under `.worktrees/`). Normalizing the absolute path to forward
// slashes makes the pattern location-independent.
const testComponentsDir = path.join(__dirname, 'test', 'components').split(path.sep).join('/');

module.exports = {
  preset: 'react-native',
  rootDir: __dirname,
  testMatch: [`${testComponentsDir}/**/*.test.js`],
  transform: {
    '^.+\\\\.(js|ts|tsx)$': ['babel-jest', { babelrc: false, configFile: false, presets: ['module:@react-native/babel-preset'] }],
    // Raw loader for schema files. The app gets this from
    // babel-plugin-inline-import, which the transform above deliberately
    // excludes (babelrc/configFile off), so without this entry any module that
    // reaches packages/core-db's migration list is a parse error under jest.
    // With it, a component test can boot the REAL store against the REAL
    // complete migration chain. Separator-agnostic on purpose: an anchored pattern using
    // `\\\\` does not match a POSIX-normalized path.
    '\\.sql$': path.join(__dirname, 'test', 'sqlRawTransformer.js'),
  },
  moduleNameMapper: {
    '^@ak/inference$': '<rootDir>/../../packages/inference/src/index.ts',
    '^@ak/core-db$': '<rootDir>/../../packages/core-db/src/index.ts',
    '^@ak/biometrics$': '<rootDir>/../../packages/biometrics/src/index.ts',
  },
  clearMocks: true,
  restoreMocks: true,
};
