'use strict';

module.exports = {
  preset: 'react-native',
  rootDir: __dirname,
  testMatch: ['<rootDir>/test/components/**/*.test.js'],
  transform: {
    '^.+\\.(js|ts|tsx)$': ['babel-jest', { babelrc: false, configFile: false, presets: ['module:@react-native/babel-preset'] }],
  },
  moduleNameMapper: {
    '^@ak/inference$': '<rootDir>/../../packages/inference/src/index.ts',
    '^@ak/core-db$': '<rootDir>/../../packages/core-db/src/index.ts',
    '^@ak/biometrics$': '<rootDir>/../../packages/biometrics/src/index.ts',
  },
  clearMocks: true,
  restoreMocks: true,
};