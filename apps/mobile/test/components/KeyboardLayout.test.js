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
    const inputTags = productFiles.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return [...source.matchAll(/<TextInput\b[\s\S]*?\/>/g)].map((match) => ({ file, tag: match[0] }));
    });

    expect(inputTags).toHaveLength(29);
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
