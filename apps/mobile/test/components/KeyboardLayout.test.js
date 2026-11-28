import React from 'react';
import { Keyboard, Platform, StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import KeyboardAwareScrollView, {
  DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT,
  scrollFocusedInputIntoView,
} from '../../src/components/KeyboardAwareScrollView';
import { theme } from '../../src/theme/theme';

describe('KeyboardAwareScrollView contract', () => {
  test('keeps every product TextInput in the app surface instead of Android landscape extract mode', () => {
    const srcRoot = path.resolve(__dirname, '../../src');
    const productFiles = [];

    function collectProductFiles(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collectProductFiles(fullPath);
        else if (entry.isFile() && entry.name.endsWith('.tsx')) productFiles.push(fullPath);
      }
    }

    collectProductFiles(srcRoot);
    // A JSX tag, not a type argument: `useRef<TextInput | null>` follows an
    // identifier and is not an input on screen.
    const JSX_TEXT_INPUT = /(?<![\w.])<TextInput\b[\s\S]*?\/>/g;
    expect([...'const r = useRef<TextInput | null>(null); <View />'.matchAll(JSX_TEXT_INPUT)]).toHaveLength(0);
    expect([...'(\n  <TextInput disableFullscreenUI />'.matchAll(JSX_TEXT_INPUT)]).toHaveLength(1);
    const inputTags = productFiles.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return [...source.matchAll(JSX_TEXT_INPUT)].map((match) => ({ file, tag: match[0] }));
    });

    const backupInputs = inputTags.filter(({ file }) => path.basename(file) === 'BackupTransferPanel.tsx');
    // +1: the preparation panel's "exercise you did instead" field (work order 1).
    // +9: the SMART goal editor (7) and the measurement entry (2) (work order 2).
    // +4: the sport editor (3) and the goal exercise search (1) (work order 3).
    // +1: the optional note on the session-feel panel (070).
    // +1: the flagged glossary question box (072).
    // +1: "Something feels off" on the completion screen (SubjectiveReportPanel, #180).
    // +1: the inline edit-logged-set reps/seconds input on SessionScreen (#142).
    // +3: the warm-up preset editor (preset name, custom exercise name, shared cue/physio note) (WO-WARMUP-02).
    expect(inputTags).toHaveLength(39 + 2 + 4 + 1 + 1 + 1 + 1 + 3);
    expect(backupInputs).toHaveLength(2);
    expect(backupInputs.map(({ tag }) => tag)).toEqual(expect.arrayContaining([
      expect.stringContaining('accessibilityLabel="Backup password, at least 12 characters"'),
      expect.stringContaining('accessibilityLabel="Confirm backup password"'),
    ]));
    for (const input of inputTags) {
      expect({ file: path.relative(srcRoot, input.file), tag: input.tag })
        .toEqual(expect.objectContaining({ tag: expect.stringMatching(/\bdisableFullscreenUI\b/) }));
    }
  });

  test('keeps the first control tap active and reserves scroll space for the focused field', () => {
    render(
      <KeyboardAwareScrollView>
        <TextInput accessibilityLabel="Example input" />
      </KeyboardAwareScrollView>,
    );

    const scroll = screen.getByTestId('keyboard-aware-scroll-view');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe(Platform.OS === 'ios' ? 'interactive' : 'on-drag');
    expect(StyleSheet.flatten(screen.getByTestId('keyboard-extra-scroll-space', { includeHiddenElements: true }).props.style))
      .toMatchObject({ height: DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT });
  });

  test('scrolls the native focused target above the keyboard with the configured clearance', () => {
    const scrollResponder = {
      scrollResponderScrollNativeHandleToKeyboard: jest.fn(),
    };

    scrollFocusedInputIntoView(scrollResponder, 42, 128);

    expect(scrollResponder.scrollResponderScrollNativeHandleToKeyboard)
      .toHaveBeenCalledWith(42, 128, true);
  });

  test('#141 re-scrolls the last focused input back into view after keyboardDidHide', () => {
    const { Keyboard } = require('react-native');
    const { act, fireEvent } = require('@testing-library/react-native');
    const originalOs = Platform.OS;
    Platform.OS = 'android';
    const listeners = {};
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      listeners[event] = handler;
      return { remove: jest.fn() };
    });
    const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const scrollToKeyboard = jest.fn();

    try {
      render(
        <KeyboardAwareScrollView
          ref={(node) => {
            if (node !== null) {
              node.scrollResponderScrollNativeHandleToKeyboard = scrollToKeyboard;
            }
          }}
        >
          <TextInput disableFullscreenUI accessibilityLabel="Target input" />
        </KeyboardAwareScrollView>,
      );

      const scroll = screen.getByTestId('keyboard-aware-scroll-view');
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 77 } });
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(1);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(77, DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT, true);

      act(() => {
        listeners.keyboardDidShow?.();
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(2);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(77, DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT, true);

      act(() => {
        listeners.keyboardDidHide?.();
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(3);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(77, DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT, true);
    } finally {
      Platform.OS = originalOs;
      rafSpy.mockRestore();
      addListenerSpy.mockRestore();
    }
  });
});

// Android walk 2026-11-03 (fn-1): with behavior 'height' the shell resized
// itself against its own keyboard measurement and the onboarding footer
// jumped between two heights after the keyboard closed. Both platforms now use
// 'padding'; on Android the shell is enabled only while the keyboard is shown,
// because the did-hide event still reports an overlap.
describe('app shell keyboard avoidance', () => {
  const { Keyboard } = require('react-native');
  const { act } = require('@testing-library/react-native');
  const {
    shellKeyboardAvoidance,
    useKeyboardShown,
  } = require('../../src/components/KeyboardAwareScrollView');

  test('never uses height, which made the shell resize against itself', () => {
    for (const os of ['ios', 'android']) {
      for (const shown of [true, false]) {
        expect(shellKeyboardAvoidance(os, shown).behavior).toBe('padding');
      }
    }
  });

  test('Android adds padding only while the keyboard is shown', () => {
    expect(shellKeyboardAvoidance('android', true).enabled).toBe(true);
    expect(shellKeyboardAvoidance('android', false).enabled).toBe(false);
  });

  test('iOS keeps the shell enabled at all times, as before', () => {
    expect(shellKeyboardAvoidance('ios', true).enabled).toBe(true);
    expect(shellKeyboardAvoidance('ios', false).enabled).toBe(true);
  });

  test('useKeyboardShown follows did-show and did-hide and unsubscribes on unmount', () => {
    const handlers = {};
    const removers = [];
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      handlers[event] = handler;
      const remove = jest.fn();
      removers.push(remove);
      return { remove };
    });
    let shown = null;
    function Probe() {
      shown = useKeyboardShown();
      return null;
    }
    const view = render(<Probe />);
    expect(shown).toBe(false);
    act(() => handlers.keyboardDidShow());
    expect(shown).toBe(true);
    act(() => handlers.keyboardDidHide());
    expect(shown).toBe(false);
    view.unmount();
    expect(removers).toHaveLength(2);
    for (const remove of removers) expect(remove).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('#379 iOS Fabric focus, layout-shrink timing, and footer viewport clearance', () => {
  test('resolves TextInput.State.currentlyFocusedInput() on Fabric when event.nativeEvent.target is 0, and re-scrolls on iOS keyboardWillShow and keyboardDidShow', () => {
    const originalOs = Platform.OS;
    Platform.OS = 'ios';
    const listeners = {};
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      (listeners[event] ??= []).push(handler);
      return { remove: jest.fn() };
    });
    const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const focusedHost = { measureLayout: jest.fn(), measureInWindow: jest.fn() };
    const focusStateSpy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focusedHost);
    const scrollToKeyboard = jest.fn();

    try {
      render(
        <KeyboardAwareScrollView
          extraScrollHeight={213}
          ref={(node) => {
            if (node !== null) {
              node.scrollResponderScrollNativeHandleToKeyboard = scrollToKeyboard;
            }
          }}
        >
          <TextInput disableFullscreenUI accessibilityLabel="Sport minutes" />
        </KeyboardAwareScrollView>,
      );

      const scroll = screen.getByTestId('keyboard-aware-scroll-view');
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(1);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(focusedHost, 213, true);

      act(() => {
        for (const handler of listeners.keyboardWillShow ?? []) handler();
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(2);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(focusedHost, 213, true);

      act(() => {
        for (const handler of listeners.keyboardDidShow ?? []) handler();
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(3);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(focusedHost, 213, true);

      act(() => {
        for (const handler of listeners.keyboardDidHide ?? []) handler();
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(4);
      expect(scrollToKeyboard).toHaveBeenLastCalledWith(focusedHost, 213, true);
    } finally {
      Platform.OS = originalOs;
      focusStateSpy.mockRestore();
      rafSpy.mockRestore();
      addListenerSpy.mockRestore();
    }
  });

  test('ignores target === 0 when TextInput.State.currentlyFocusedInput() is null', () => {
    const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const focusStateSpy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(null);
    const scrollToKeyboard = jest.fn();

    try {
      render(
        <KeyboardAwareScrollView
          ref={(node) => {
            if (node !== null) {
              node.scrollResponderScrollNativeHandleToKeyboard = scrollToKeyboard;
            }
          }}
        >
          <TextInput disableFullscreenUI accessibilityLabel="Target input" />
        </KeyboardAwareScrollView>,
      );

      const scroll = screen.getByTestId('keyboard-aware-scroll-view');
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToKeyboard).not.toHaveBeenCalled();
    } finally {
      focusStateSpy.mockRestore();
      rafSpy.mockRestore();
    }
  });

  test('re-scrolls when ScrollView shrinks onLayout while focused, forwards onLayout, and stops re-scrolling on shrink after blur', () => {
    const originalOs = Platform.OS;
    Platform.OS = 'ios';
    const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    const focusedHost = { measureLayout: jest.fn(), measureInWindow: jest.fn() };
    const focusStateSpy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focusedHost);
    const scrollToKeyboard = jest.fn();
    const onLayoutProp = jest.fn();

    try {
      render(
        <KeyboardAwareScrollView
          onLayout={onLayoutProp}
          ref={(node) => {
            if (node !== null) {
              node.scrollResponderScrollNativeHandleToKeyboard = scrollToKeyboard;
            }
          }}
        >
          <TextInput disableFullscreenUI accessibilityLabel="Target input" />
        </KeyboardAwareScrollView>,
      );

      const scroll = screen.getByTestId('keyboard-aware-scroll-view');
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToKeyboard).toHaveBeenCalledTimes(1);

      act(() => {
        fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 110, width: 414, height: 667 } } });
      });
      expect(onLayoutProp).toHaveBeenCalledTimes(1);
      expect(scrollToKeyboard).toHaveBeenCalledTimes(1);

      act(() => {
        fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 110, width: 414, height: 383 } } });
      });
      expect(onLayoutProp).toHaveBeenCalledTimes(2);
      expect(scrollToKeyboard).toHaveBeenCalledTimes(2);

      act(() => {
        fireEvent(scroll, 'blur', { nativeEvent: { target: 0 } });
        fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 110, width: 414, height: 300 } } });
      });
      expect(onLayoutProp).toHaveBeenCalledTimes(3);
      expect(scrollToKeyboard).toHaveBeenCalledTimes(2);
    } finally {
      Platform.OS = originalOs;
      focusStateSpy.mockRestore();
      rafSpy.mockRestore();
    }
  });

  test('scrolls an occluded bottom input clear of ScrollView bottom via measureInWindow + measureLayout, leaves clear inputs alone, and rescues top-clipped inputs', () => {
    const rafSpy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    let innerY = -1826;
    let inputTopInContent = 2331;
    const nativeScroll = {
      measureInWindow: jest.fn((cb) => cb(0, 110, 414, 383)),
    };
    const innerView = {
      measureInWindow: jest.fn((cb) => cb(0, innerY, 414, 2852)),
    };
    const focusedHost = {
      measureLayout: jest.fn((relativeTo, onSuccess) => {
        if (relativeTo === innerView) {
          onSuccess(17, inputTopInContent, 380, 54);
        }
      }),
      measureInWindow: jest.fn((cb) => cb(17, innerY + inputTopInContent, 380, 54)),
    };
    const focusStateSpy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focusedHost);
    const scrollToKeyboard = jest.fn();
    const scrollToMock = jest.fn();

    try {
      render(
        <KeyboardAwareScrollView
          ref={(node) => {
            if (node !== null) {
              node.scrollResponderScrollNativeHandleToKeyboard = scrollToKeyboard;
              node.getNativeScrollRef = () => nativeScroll;
              node.getInnerViewRef = () => innerView;
              node.scrollTo = scrollToMock;
            }
          }}
        >
          <TextInput disableFullscreenUI accessibilityLabel="Sport minutes" />
        </KeyboardAwareScrollView>,
      );

      const scroll = screen.getByTestId('keyboard-aware-scroll-view');

      // Case 1: sport-minutes at 505..559 below footer.minY (493 = 110 + 383).
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToMock).toHaveBeenCalledTimes(1);
      expect(scrollToMock).toHaveBeenLastCalledWith({
        x: 0,
        y: 2331 + 54 - (383 - theme.space[4]),
        animated: true,
      });

      // Case 2: already clear input (SQUAT at topInContent=185, height=54, scrollY=0).
      scrollToMock.mockClear();
      innerY = 110;
      inputTopInContent = 185;
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToMock).not.toHaveBeenCalled();

      // Case 3: top-clipped input (topInContent=100, scrollY=200 => iy=10).
      innerY = -90;
      inputTopInContent = 100;
      act(() => {
        fireEvent(scroll, 'focus', { nativeEvent: { target: 0 } });
      });
      expect(scrollToMock).toHaveBeenCalledTimes(1);
      expect(scrollToMock).toHaveBeenLastCalledWith({
        x: 0,
        y: 100 - theme.space[4],
        animated: true,
      });
    } finally {
      focusStateSpy.mockRestore();
      rafSpy.mockRestore();
    }
  });
});
