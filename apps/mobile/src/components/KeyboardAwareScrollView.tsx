import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type HostInstance,
  type LayoutChangeEvent,
  type ScrollViewProps,
  View,
} from 'react-native';
import { theme } from '../theme/theme';

export const DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT = 128;
export const KEYBOARD_TAP_BEHAVIOR = 'handled' as const;
export const KEYBOARD_DISMISS_MODE = Platform.OS === 'ios' ? 'interactive' as const : 'on-drag' as const;

export interface ShellKeyboardAvoidance {
  readonly behavior: 'padding';
  readonly enabled: boolean;
}

/**
 * Settings for the app shell's single KeyboardAvoidingView.
 *
 * Both platforms use 'padding'. On Android the window is not resized for the
 * keyboard here, so the shell must lift its own content. 'height' changed the
 * view's own size, and that re-triggered the keyboard measurement: after the
 * keyboard closed, the onboarding footer jumped between two heights about 30
 * times a second and taps missed (Android walk 2026-11-03, fn-1).
 *
 * The keyboard-hidden event on Android still reports an overlap, which left a
 * band of padding below the footer. So on Android the view is enabled only
 * while the keyboard is shown; disabled, it renders no padding. iOS is
 * unchanged.
 */
export function shellKeyboardAvoidance(os: string, keyboardShown: boolean): ShellKeyboardAvoidance {
  return { behavior: 'padding', enabled: os === 'ios' ? true : keyboardShown };
}

/** True while the software keyboard is shown (Android did-show / did-hide events). */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

export type FocusedScrollTarget = number | HostInstance;

type ScrollResponder = Pick<ScrollView, 'scrollResponderScrollNativeHandleToKeyboard'> & {
  scrollTo?: ScrollView['scrollTo'];
  getNativeScrollRef?: ScrollView['getNativeScrollRef'];
  getInnerViewRef?: () => HostInstance | null;
};

type FocusEvent = Parameters<NonNullable<ScrollViewProps['onFocus']>>[0];

function isHostInstance(value: unknown): value is HostInstance {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as HostInstance).measureLayout === 'function'
    && typeof (value as HostInstance).measureInWindow === 'function'
  );
}

/**
 * Resolves the focused input target across Paper, Fabric, and Jest mocks.
 * On React Native Fabric (iOS), TextInputEventEmitter omits metrics.target so
 * event.nativeEvent.target arrives as 0; TextInput.State.currentlyFocusedInput()
 * provides the active HostInstance directly.
 */
export function resolveFocusedScrollTarget(event: FocusEvent): FocusedScrollTarget | null {
  const focusedInput = TextInput.State.currentlyFocusedInput?.() ?? null;
  if (focusedInput !== null && focusedInput !== undefined) {
    return focusedInput;
  }
  const nativeTarget = event.nativeEvent?.target;
  if (typeof nativeTarget === 'number' && nativeTarget > 0) {
    return nativeTarget;
  }
  if (isHostInstance(event.target)) {
    return event.target;
  }
  return null;
}

/**
 * Ensures the focused HostInstance fits within the ScrollView's actual layout
 * viewport (accounting for headers above and sticky footers below that native
 * ScrollView.scrollResponderScrollNativeHandleToKeyboard does not subtract).
 */
export function ensureFocusedInputInViewport(
  scrollResponder: ScrollResponder | null,
  target: FocusedScrollTarget,
  clearance: number = theme.space[4],
): void {
  if (scrollResponder === null || typeof target === 'number') return;
  const nativeScroll = scrollResponder.getNativeScrollRef?.();
  const innerView = scrollResponder.getInnerViewRef?.();
  if (
    nativeScroll == null
    || innerView == null
    || typeof scrollResponder.scrollTo !== 'function'
    || typeof nativeScroll.measureInWindow !== 'function'
    || typeof innerView.measureInWindow !== 'function'
    || typeof target.measureLayout !== 'function'
  ) {
    return;
  }

  nativeScroll.measureInWindow((_sx, sy, _sw, viewportHeight) => {
    if (viewportHeight <= 0) return;
    innerView.measureInWindow((_cx, cy) => {
      const currentScrollY = sy - cy;
      target.measureLayout(
        innerView,
        (_left, topInContent, _width, inputHeight) => {
          if (inputHeight <= 0) return;
          const margin = Math.max(0, Math.min(clearance, (viewportHeight - inputHeight) / 2));
          const inputTopInViewport = topInContent - currentScrollY;
          const inputBottomInViewport = inputTopInViewport + inputHeight;
          if (inputBottomInViewport > viewportHeight - margin) {
            const nextScrollY = Math.max(0, topInContent + inputHeight - (viewportHeight - margin));
            scrollResponder.scrollTo?.({ x: 0, y: nextScrollY, animated: true });
          } else if (inputTopInViewport < margin) {
            const nextScrollY = Math.max(0, topInContent - margin);
            scrollResponder.scrollTo?.({ x: 0, y: nextScrollY, animated: true });
          }
        },
        () => undefined,
      );
    });
  });
}

export function scrollFocusedInputIntoView(
  scrollResponder: ScrollResponder | null,
  target: FocusedScrollTarget,
  extraScrollHeight: number,
): void {
  scrollResponder?.scrollResponderScrollNativeHandleToKeyboard(
    target,
    extraScrollHeight,
    true,
  );
  ensureFocusedInputInViewport(scrollResponder, target);
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
 * the focused control and caret above the resized keyboard viewport and any
 * sibling footer below the ScrollView.
 */
const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      children,
      extraScrollHeight = DEFAULT_KEYBOARD_EXTRA_SCROLL_HEIGHT,
      testID,
      onBlur,
      onLayout,
      ...scrollProps
    },
    forwardedRef,
  ): React.JSX.Element {
    const scrollRef = useRef<ScrollView | null>(null);
    const lastFocusedTarget = useRef<FocusedScrollTarget | null>(null);
    const isFocusedRef = useRef(false);
    const viewportHeightRef = useRef<number | null>(null);

    const setScrollRef = useCallback((node: ScrollView | null): void => {
      scrollRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef !== null) {
        forwardedRef.current = node;
      }
    }, [forwardedRef]);

    const scheduleFocusedScroll = useCallback((target: FocusedScrollTarget): void => {
      requestAnimationFrame(() => {
        scrollFocusedInputIntoView(scrollRef.current, target, extraScrollHeight);
      });
    }, [extraScrollHeight]);

    useEffect(() => {
      // On iOS, KeyboardAvoidingView resolves prefersCrossFadeTransitions()
      // asynchronously after keyboardWillShow, so also re-check at keyboardDidShow.
      const showEvents = Platform.OS === 'ios'
        ? (['keyboardWillShow', 'keyboardDidShow'] as const)
        : (['keyboardDidShow'] as const);
      const showSubscriptions = showEvents.map((showEvent) =>
        Keyboard.addListener(showEvent, () => {
          if (lastFocusedTarget.current !== null && isFocusedRef.current) {
            scheduleFocusedScroll(lastFocusedTarget.current);
          }
        }),
      );
      const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        if (lastFocusedTarget.current !== null) {
          scheduleFocusedScroll(lastFocusedTarget.current);
        }
      });
      return () => {
        for (const subscription of showSubscriptions) {
          subscription.remove();
        }
        hideSubscription.remove();
      };
    }, [scheduleFocusedScroll]);

    const handleFocus: NonNullable<ScrollViewProps['onFocus']> = (event) => {
      const target = resolveFocusedScrollTarget(event);
      if (target !== null) {
        lastFocusedTarget.current = target;
        isFocusedRef.current = true;
        scheduleFocusedScroll(target);
      }
    };

    const handleBlur: NonNullable<ScrollViewProps['onBlur']> = (event) => {
      isFocusedRef.current = false;
      onBlur?.(event);
    };

    const handleLayout = (event: LayoutChangeEvent): void => {
      const nextHeight = event.nativeEvent.layout.height;
      const prevHeight = viewportHeightRef.current;
      viewportHeightRef.current = nextHeight;
      if (
        prevHeight !== null
        && nextHeight < prevHeight
        && isFocusedRef.current
        && lastFocusedTarget.current !== null
      ) {
        scheduleFocusedScroll(lastFocusedTarget.current);
      }
      onLayout?.(event);
    };

    return (
      <ScrollView
        {...scrollProps}
        ref={setScrollRef}
        testID={testID ?? 'keyboard-aware-scroll-view'}
        keyboardShouldPersistTaps={KEYBOARD_TAP_BEHAVIOR}
        keyboardDismissMode={KEYBOARD_DISMISS_MODE}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onLayout={handleLayout}
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
