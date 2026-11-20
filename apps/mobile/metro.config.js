const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { betaBuildSetting } = require('./buildFlags');

const workspaceRoot = path.resolve(__dirname, '..', '..');
// Git worktrees share the root install through a directory junction. Metro's
// resolver must see the junction target, otherwise Babel helpers that are
// physically present in the hoisted install are reported as missing.
const workspaceNodeModules = fs.realpathSync(path.resolve(workspaceRoot, 'node_modules'));

/** Monorepo Metro config: watch the workspace packages and resolve hoisted
 *  node_modules from the repo root. */
const config = {
  // Issue #132: babel.config.js inlines AK_BETA_BUILD into the bundle. Metro's
  // transform cache does not see environment values, so key the cache on the
  // setting; otherwise a beta bundle could reuse non-beta transforms.
  cacheVersion: `beta-build-${betaBuildSetting(process.env)}`,
  watchFolders: [workspaceRoot, workspaceNodeModules],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      workspaceNodeModules,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
