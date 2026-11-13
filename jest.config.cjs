// Pure inference Jest configuration; mobile component tests use apps/mobile/jest.config.js.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/packages/inference/src/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: ['module:@react-native/babel-preset'],
      },
    ],
  },
};
