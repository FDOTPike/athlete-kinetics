import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';

export const DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT = 128;
export const KEYBOARD_TAP_BEHAVIOR = 'handled' as const;
export const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' as const : 'on-drag' as const;

type ScrollResponder = Pick<ScrollView, 'scrollResponderScrollNativeHandleToKeyboard'>;

export function scrollFocusedInputIntoView(
  scrollResponder: ScrollResponder | null,
  target: number,
  extraScrollHeight: number,
): void {
  scrollResponder?.scrollResponderScrollNativeHandleToKeyboard(
    target,
    extraScrollHeight,
    true,
  );
}

export interface KeyboardAwareScrollViewProps extends Omit<
  ScrollViewProps,
  'keyboardDismissMode' | 'keyboardShouldPersistTaps' | 'onFocus'
> {
  readonly extraScrollHeight?: number;
}

/**
 * Scroll contract for forms rendered inside the app shell's single
 * KeyboardAvoidingView. It does not add another keyboard-avoiding layer:
 * instead it preserves a scroll runway and asks the native ScrollView to keep
 * the focused control and caret above the resized keyboard viewport.
 */
const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      children,
      extraScrollHeight = DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT,
      testID,
      ...scrollProps
    },
    forwardedRef,
  ): React.JSX.Element {
    const scrollRef = useRef<ScrollView | null>(null);
    const lastFocusedTarget = useRef<number | null>(null);

    const setScrollRef = useCallback((node: ScrollView | null): void => {
      scrollRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef !== null) {
        forwardedRef.current = node;
      }
    }, [forwardedRef]);

    const scheduleFocusedScroll = useCallback((target: number): void => {
      requestAnimationFrame(() => {
        scrollFocusedInputIntoView(scrollRef.current, target, extraScrollHeight);
      });
    }, [extraScrollHeight]);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const showSubscription = Keyboard.addListener(showEvent, () => {
        if (lastFocusedTarget.current !== null) {
          scheduleFocusedScroll(lastFocusedTarget.current);
        }
      });
      return () => {
        showSubscription.remove();
      };
    }, [scheduleFocusedScroll]);

    const handleFocus: NonNullable<ScrollViewProps['onFocus']> = (event) => {
      const target = event.nativeEvent.target;
      if (typeof target === 'number') {
        lastFocusedTarget.current = target;
        scheduleFocusedScroll(target);
      }
    };

    return (
      <ScrollView
        {...scrollProps}
        ref={setScrollRef}
        testID={testID ?? 'keyboard-aware-scroll-view'}
        keyboardShouldPersistTaps={KEYBOARD_TAP_BEHAVIOR}
        keyboardDismissMode={KEYBOARD_DISMISS_MODE}
        onFocus={handleFocus}
      >
        {children}
        <View
          testID="keyboard-extra-scroll-space"
          style={{ height: extraScrollHeight }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </ScrollView>
    );
  },
);

export default KeyboardAwareScrollView;
