import { TurboModuleRegistry } from 'react-native';
import { isSpeechAvailable, speak, stop, subscribe } from '../../src/speech/speech';

let emit;
const native = {
  isAvailable: jest.fn(), speak: jest.fn(), stop: jest.fn(),
  onSpeechEvent: jest.fn((listener) => { emit = listener; return { remove: jest.fn() }; }),
};

beforeEach(async () => {
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(native);
  native.isAvailable.mockReset().mockResolvedValue(true);
  native.speak.mockReset().mockResolvedValue(undefined);
  native.stop.mockReset().mockResolvedValue(undefined);
  await stop();
});
afterEach(() => jest.restoreAllMocks());

test('reports the missing native module as unavailable', async () => {
  TurboModuleRegistry.get.mockReturnValue(null);
  expect(await isSpeechAvailable()).toBe(false);
  expect(await speak('a', 'Read this')).toBe(false);
});

test('a new key clears the old control and final event returns to idle', async () => {
  const seen = [];
  const unsubscribe = subscribe((key) => seen.push(key));
  await speak('a', 'First');
  await speak('b', 'Second');
  expect(native.speak).toHaveBeenNthCalledWith(1, 'First', expect.any(String));
  expect(native.speak).toHaveBeenNthCalledWith(2, 'Second', expect.any(String));
  expect(seen).toEqual([null, 'a', 'b']);
  emit({ type: 'done', utteranceId: native.speak.mock.calls[1][1] });
  expect(seen.at(-1)).toBe(null);
  unsubscribe();
});

test('stop clears selection and swallows native errors', async () => {
  const seen = [];
  const unsubscribe = subscribe((key) => seen.push(key));
  await speak('a', 'First');
  native.stop.mockRejectedValueOnce(new Error('engine'));
  await expect(stop()).resolves.toBeUndefined();
  expect(seen.at(-1)).toBe(null);
  unsubscribe();
});
