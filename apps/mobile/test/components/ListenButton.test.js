import React from 'react';
import { TurboModuleRegistry } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ListenButton } from '../../src/components/ui/ListenButton';

const native = {
  isAvailable: jest.fn(), speak: jest.fn(), stop: jest.fn(),
  onSpeechEvent: jest.fn(() => ({ remove: jest.fn() })),
};
beforeEach(() => {
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(native);
  native.isAvailable.mockReset().mockResolvedValue(true);
  native.speak.mockReset().mockResolvedValue();
  native.stop.mockReset().mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

test('hides when module is absent or engine unavailable', async () => {
  TurboModuleRegistry.get.mockReturnValue(null);
  const absent = render(<ListenButton speechKey="a" text="RPE 8" label="cues" />);
  await waitFor(() => expect(screen.queryByText('Listen')).toBeNull());
  absent.unmount();
  TurboModuleRegistry.get.mockReturnValue(native);
  native.isAvailable.mockResolvedValue(false);
  render(<ListenButton speechKey="a" text="RPE 8" label="cues" />);
  await waitFor(() => expect(native.isAvailable).toHaveBeenCalled());
  expect(screen.queryByText('Listen')).toBeNull();
});

test('first tap speaks pronunciation, second stops and unmount stops', async () => {
  const view = render(<ListenButton speechKey="a" text="RPE 8" label="cues" />);
  await screen.findByLabelText('Read the cues aloud');
  await act(async () => fireEvent.press(screen.getByLabelText('Read the cues aloud')));
  expect(native.speak).toHaveBeenCalledWith('R P E 8', expect.any(String));
  expect(screen.getByLabelText('Stop reading')).toBeOnTheScreen();
  await act(async () => fireEvent.press(screen.getByLabelText('Stop reading')));
  expect(native.stop).toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByLabelText('Read the cues aloud')));
  const beforeUnmount = native.stop.mock.calls.length;
  view.unmount();
  await waitFor(() => expect(native.stop.mock.calls.length).toBeGreaterThan(beforeUnmount));
});

test('starting a second control clears the first selection', async () => {
  render(<><ListenButton speechKey="a" text="First" label="setup" /><ListenButton speechKey="b" text="Second" label="cues" /></>);
  await screen.findByLabelText('Read the setup aloud');
  await screen.findByLabelText('Read the cues aloud');
  await act(async () => fireEvent.press(screen.getByLabelText('Read the setup aloud')));
  await act(async () => fireEvent.press(screen.getByLabelText('Read the cues aloud')));
  expect(screen.getByLabelText('Read the setup aloud')).toBeOnTheScreen();
  expect(screen.getByLabelText('Stop reading')).toBeOnTheScreen();
});
