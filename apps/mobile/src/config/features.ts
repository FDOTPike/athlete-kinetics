// Build-time switch (issue #132). babel.config.js replaces
// process.env.AK_BETA_BUILD with 'on' or 'off' when the JS bundle is built; a
// build made without AK_BETA_BUILD=on is not a beta build. See
// docs/PRE_RELEASE_ANDROID.md for how to make a beta build.
export const IS_BETA_BUILD: boolean = process.env.AK_BETA_BUILD === 'on';

// The question box is a beta feature: shown in beta builds only.
export const QUESTION_BOX_ENABLED: boolean = IS_BETA_BUILD;
