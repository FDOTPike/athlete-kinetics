const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '..', '..');
// Git worktrees share the root install through a directory junction. Metro's
// resolver must see the junction target, otherwise Babel helpers that are
// physically present in the hoisted install are reported as missing.
const workspaceNodeModules = fs.realpathSync(path.resolve(workspaceRoot, 'node_modules'));

/** Monorepo Metro config: watch the workspace packages and resolve hoisted
 *  node_modules from the repo root. */
const config = {
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
