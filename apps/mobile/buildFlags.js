'use strict';

// Build-time switches (issue #132).
//
// AK_BETA_BUILD is read from the environment of the process that builds the JS
// bundle (Metro, or the Gradle/Xcode bundle step that runs Metro). This Babel
// plugin replaces every `process.env.AK_BETA_BUILD` in app source with the
// string 'on' or 'off', so the app never reads the environment at runtime and
// there is no in-app setting. Missing, empty or any other value means 'off':
// only an explicit on/true/1 makes a beta build.
//
// No dependency is added: this is the whole plugin.

const ON_VALUES = new Set(['on', 'true', '1']);

/** 'on' only when the environment explicitly says so; otherwise 'off'. */
function betaBuildSetting(env) {
  const raw = env === undefined || env === null ? undefined : env.AK_BETA_BUILD;
  if (typeof raw !== 'string') return 'off';
  return ON_VALUES.has(raw.trim().toLowerCase()) ? 'on' : 'off';
}

function inlineBuildFlags({ types: t }) {
  return {
    name: 'ak-inline-build-flags',
    visitor: {
      MemberExpression(path, state) {
        if (!path.matchesPattern('process.env.AK_BETA_BUILD')) return;
        if (path.parentPath.isAssignmentExpression({ left: path.node })) return;
        const setting = state.opts.beta === 'on' ? 'on' : 'off';
        path.replaceWith(t.stringLiteral(setting));
      },
    },
  };
}

module.exports = inlineBuildFlags;
module.exports.betaBuildSetting = betaBuildSetting;
