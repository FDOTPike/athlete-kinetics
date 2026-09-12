import React from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import KeyboardAwareScrollView, {
  DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT,
  scrollFocusedInputIntoView,
} from '../../src/components/KeyboardAwareScrollView';

describe('KeyboardAwareScrollView contract', () => {
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
