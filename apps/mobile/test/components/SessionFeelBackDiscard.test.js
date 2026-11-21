/**
 * Issue #192: on "How did this session go?", Android Back closed the panel and
 * lost a chosen answer and a typed note with no question asked.
 *
 * With something unsaved, Back now asks "Discard this answer?": "Keep editing"
 * keeps the answer and the note, "Discard" closes without saving. With nothing
 * unsaved, Back closes as before.
 */
import React from 'react';
import { Alert, BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SessionFeelPanel } from '../../src/components/SessionFeelPanel';
import { NavigationProvider } from '../../src/navigation/navigation';

// Capture the hardwareBackPress listeners NavigationProvider registers, then
// press them the way Android does (newest listener first).
function captureHardwareBack() {
  const listeners = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((eventName, listener) => {
    if (eventName === 'hardwareBackPress') listeners.push(listener);
    return { remove: () => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } };
  });
  return {
    press: () => {
      let handled = false;
      act(() => {
        for (let index = listeners.length - 1; index >= 0 && !handled; index -= 1) handled = listeners[index]() === true;
      });
      return handled;
    },
    restore: () => spy.mockRestore(),
  };
}

let back;
let alertSpy;

beforeEach(() => {
  back = captureHardwareBack();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  back.restore();
  alertSpy.mockRestore();
});

const renderPanel = (props = {}) => {
  const onClose = jest.fn();
  const onSave = jest.fn(() => null);
  render(
    <NavigationProvider>
      <SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={onClose} {...props} />
    </NavigationProvider>,
  );
  return { onClose, onSave };
};

const pressAlertButton = (text) => {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];
  const button = buttons.find((candidate) => candidate.text === text);
  act(() => { button.onPress?.(); });
};

test('#192: Back with an answer chosen asks before discarding, and "Keep editing" keeps it', () => {
  const { onClose } = renderPanel();
  fireEvent.press(screen.getByTestId('session-feel-harder'));

  expect(back.press()).toBe(true);
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(alertSpy.mock.calls[0][0]).toBe('Discard this answer?');
  expect(alertSpy.mock.calls[0][2].map((button) => button.text)).toEqual(['Keep editing', 'Discard']);
  expect(onClose).not.toHaveBeenCalled();

  pressAlertButton('Keep editing');
  expect(screen.getByTestId('session-feel-panel')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

test('#192: Back with a typed note asks, and "Discard" closes without saving', () => {
  const { onClose, onSave } = renderPanel();
  fireEvent.changeText(screen.getByTestId('session-feel-note'), 'left knee, sharp, set 2');

  expect(back.press()).toBe(true);
  expect(alertSpy.mock.calls[0][0]).toBe('Discard this answer?');
  expect(onClose).not.toHaveBeenCalled();

  pressAlertButton('Discard');
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});

test('#192: Back with nothing entered closes as before, without asking', () => {
  renderPanel();

  // No sub-view consumes Back, so the Android default (leave the screen) applies.
  expect(back.press()).toBe(false);
  expect(alertSpy).not.toHaveBeenCalled();
});

test('#192: Back on a saved answer that was not changed closes without asking', () => {
  renderPanel({ saved: { feel: 'harder', reasons: ['tired'] }, note: 'slept 5 h' });

  expect(back.press()).toBe(false);
  expect(alertSpy).not.toHaveBeenCalled();
});

test('#192: Back after changing a saved answer asks before discarding the change', () => {
  const { onClose } = renderPanel({ saved: { feel: 'harder', reasons: ['tired'] }, note: null });
  fireEvent.press(screen.getByTestId('session-feel-easier'));

  expect(back.press()).toBe(true);
  expect(alertSpy.mock.calls[0][0]).toBe('Discard this answer?');
  expect(onClose).not.toHaveBeenCalled();
});
