module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // .sql files import as raw strings (matches packages/core-db/src/types/sql.d.ts)
    ['inline-import', { extensions: ['.sql'] }],
    // Workspace aliases (mirror apps/mobile/tsconfig.json "paths")
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@ak/core-db': '../../packages/core-db/src',
          '@ak/inference': '../../packages/inference/src',
          '@ak/biometrics': '../../packages/biometrics/src',
        },
      },
    ],
  ],
};
