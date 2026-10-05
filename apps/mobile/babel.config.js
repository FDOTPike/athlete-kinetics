const path = require('path');

// Workspace aliases (mirror apps/mobile/tsconfig.json "paths").
//
// These MUST be anchored to __dirname, not written as bare relative strings.
// babel-plugin-module-resolver resolves a relative alias against its `root`
// (i.e. the process cwd), not against the file being transformed — so a bare
// '../../packages/inference/src' silently means a DIFFERENT directory depending
// on where the tool was launched. In a git worktree under `.worktrees/<name>/`
// that path resolves two levels up and lands in the MAIN checkout, so the app
// and the component tests would compile against the wrong copy of the
// workspace packages while every other gate used the worktree's. Anchoring to
// __dirname makes the alias location-independent, exactly like the forward-slash
// normalization jest.config.js needs for the same class of reason.
const pkg = (name) => path.join(__dirname, '..', '..', 'packages', name, 'src');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // .sql files import as raw strings (matches packages/core-db/src/types/sql.d.ts)
    ['inline-import', { extensions: ['.sql'] }],
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@ak/core-db': pkg('core-db'),
          '@ak/inference': pkg('inference'),
          '@ak/biometrics': pkg('biometrics'),
        },
      },
    ],
  ],
};
