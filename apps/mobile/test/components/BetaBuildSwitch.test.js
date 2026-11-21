/**
 * @jest-environment node
 */
// Issue #132: the question box is switched by a build-time value. A build
// without AK_BETA_BUILD has it off; a beta build (AK_BETA_BUILD=on) has it on.
// These tests run the app's own babel.config.js over the real
// src/config/features.ts, the way Metro does when it builds the bundle.
const path = require('path');
const babel = require('@babel/core');

const appRoot = path.join(__dirname, '..', '..');
const featuresFile = path.join(appRoot, 'src', 'config', 'features.ts');
const { betaBuildSetting } = require('../../buildFlags');

const savedValue = process.env.AK_BETA_BUILD;
afterEach(() => {
  if (savedValue === undefined) delete process.env.AK_BETA_BUILD;
  else process.env.AK_BETA_BUILD = savedValue;
});

function buildFeatures(value) {
  if (value === undefined) delete process.env.AK_BETA_BUILD;
  else process.env.AK_BETA_BUILD = value;
  const { code } = babel.transformFileSync(featuresFile, {
    cwd: appRoot,
    root: appRoot,
    configFile: path.join(appRoot, 'babel.config.js'),
    babelrc: false,
    filename: featuresFile,
  });
  const module = { exports: {} };
  // The compiled module must not read the environment at runtime: run it with
  // a `process` that has no env, so only the inlined value can decide.
  new Function('module', 'exports', 'require', 'process', code)(module, module.exports, require, { env: {} });
  return { code, features: module.exports };
}

test('the default build (no AK_BETA_BUILD) has the question box off', () => {
  const { code, features } = buildFeatures(undefined);
  expect(features.IS_BETA_BUILD).toBe(false);
  expect(features.QUESTION_BOX_ENABLED).toBe(false);
  expect(code).not.toMatch(/process\.env/);
});

test('the beta configuration (AK_BETA_BUILD=on) has the question box on', () => {
  const { code, features } = buildFeatures('on');
  expect(features.IS_BETA_BUILD).toBe(true);
  expect(features.QUESTION_BOX_ENABLED).toBe(true);
  expect(code).not.toMatch(/process\.env/);
});

test('anything but an explicit on keeps the box off', () => {
  for (const value of ['', 'off', '0', 'false', 'no', 'beta', 'onn']) {
    expect(buildFeatures(value).features.QUESTION_BOX_ENABLED).toBe(false);
  }
  for (const value of ['ON', ' on ', 'true', '1']) {
    expect(buildFeatures(value).features.QUESTION_BOX_ENABLED).toBe(true);
  }
});

test('betaBuildSetting reads only AK_BETA_BUILD and defaults off', () => {
  expect(betaBuildSetting(undefined)).toBe('off');
  expect(betaBuildSetting({})).toBe('off');
  expect(betaBuildSetting({ AK_BETA_BUILD: 'on' })).toBe('on');
  expect(betaBuildSetting({ AK_BETA_BUILD: 'off' })).toBe('off');
});

test('Metro keeps separate caches for beta and non-beta bundles', () => {
  const load = (value) => {
    if (value === undefined) delete process.env.AK_BETA_BUILD;
    else process.env.AK_BETA_BUILD = value;
    let config;
    jest.isolateModules(() => { config = require('../../metro.config.js'); });
    return config.cacheVersion;
  };
  const off = load(undefined);
  const on = load('on');
  expect(off).not.toBe(on);
  expect(load('off')).toBe(off);
});
