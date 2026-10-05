/** UiTestTrace.test.js — the CI permission-flow trace is inert unless the app
 *  was launched with -AKUITestTrace 1 on iOS, and then logs only its marker. */
beforeEach(() => { jest.resetModules(); });
afterEach(() => { jest.dontMock('react-native/Libraries/Settings/Settings'); });

function load(platform, setting) {
  jest.doMock('react-native/Libraries/Settings/Settings', () => {
    const settings = { get: (key) => (key === 'AKUITestTrace' ? setting : undefined) };
    return { __esModule: true, default: settings, ...settings };
  });
  require('react-native').Platform.OS = platform;
  return require('../../src/diagnostics/uiTestTrace');
}

test.each([
  ['ios', undefined], ['ios', 0], ['android', 1],
])('silent on %s with setting %p', (platform, setting) => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    load(platform, setting).uiTestTrace('request start rev=1');
    expect(error).not.toHaveBeenCalled();
  } finally { error.mockRestore(); }
});

test('logs the marked event on iOS when launched with the flag', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    load('ios', 1).uiTestTrace('request start rev=1');
    expect(error).toHaveBeenCalledWith('[ak-health] request start rev=1');
  } finally { error.mockRestore(); }
});
