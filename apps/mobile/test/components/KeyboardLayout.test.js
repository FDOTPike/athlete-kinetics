import React from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import KeyboardAwareScrollView, {
  DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT,
  scrollFocusedInputIntoView,
} from '../../src/components/KeyboardAwareScrollView';

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
    expect(inputTags).toHaveLength(39 + 2 + 4 + 1 + 1);
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
