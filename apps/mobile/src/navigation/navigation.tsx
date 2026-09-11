/**
 * navigation.tsx — Zero-dependency deterministic back navigation model.
 *
 * Maintains a tab history stack and an active sub-view back handler registry.
 * Android hardware BackHandler and iOS left-edge swipe call `goBack()`, which:
 * 1. Checks if an active sub-view handler consumes the back event (e.g. closes a modal/card/step).
 * 2. If no sub-view handles it, pops the tab history stack to switch to the previous tab.
 * 3. Only exits the app (returns false to Android BackHandler) when on the root tab ('readiness') with no sub-views open.
 *
 * State safety: navigation only alters UI visibility/stack; logged training history and store state are untouched.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, PanResponder, Platform, View, StyleSheet, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

export type Tab = 'readiness' | 'session' | 'coach' | 'library' | 'athlete';

export type BackHandlerFn = () => boolean;

interface NavigationContextValue {
  tab: Tab;
  setTab: (tab: Tab) => void;
  goBack: () => boolean;
  registerSubViewBack: (handler: BackHandlerFn) => () => void;
  tabHistory: Tab[];
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

const fallbackContext: NavigationContextValue = {
  tab: 'readiness',
  setTab: () => {},
  goBack: () => false,
  registerSubViewBack: () => () => {},
  tabHistory: ['readiness'],
};

export interface NavigationProviderProps {
  children: React.ReactNode;
  initialTab?: Tab;
}

export function NavigationProvider({ children, initialTab = 'readiness' }: NavigationProviderProps): React.JSX.Element {
  const [tabHistory, setTabHistory] = useState<Tab[]>([initialTab]);
  const subViewHandlersRef = useRef<Set<BackHandlerFn>>(new Set());

  const currentTab = tabHistory[tabHistory.length - 1] ?? initialTab;

  const setTab = (nextTab: Tab): void => {
    setTabHistory((prev) => {
      if (prev[prev.length - 1] === nextTab) return prev;
      const root = prev[0] ?? initialTab;
      if (nextTab === root) {
        return [root];
      }
      const filtered = prev.filter((t) => t !== nextTab && t !== root);
      return [root, ...filtered, nextTab];
    });
  };

  const tabHistoryRef = useRef(tabHistory);
  tabHistoryRef.current = tabHistory;

  const registerSubViewBack = (handler: BackHandlerFn): (() => void) => {
    subViewHandlersRef.current.add(handler);
    return () => {
      subViewHandlersRef.current.delete(handler);
    };
  };

  const goBack = (): boolean => {
    // 1. Try active sub-view handlers in reverse registration order
    const handlers = Array.from(subViewHandlersRef.current);
    for (let i = handlers.length - 1; i >= 0; i--) {
      const handled = handlers[i]!();
      if (handled) return true;
    }

    // 2. Try popping tab history if more than 1 tab in stack
    if (tabHistoryRef.current.length > 1) {
      setTabHistory((prev) => prev.slice(0, -1));
      return true;
    }

    // 3. At root tab with no sub-views -> return false (allows native exit on Android)
    return false;
  };

  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  // Hardware BackHandler on Android
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return goBack();
    });
    return () => subscription.remove();
  }, [tabHistory]);

  // iOS Edge Back-Swipe PanResponder (28pt left edge boundary)
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
        return Platform.OS === 'ios' && evt.nativeEvent.pageX <= 28;
      },
      onMoveShouldSetPanResponder: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Platform.OS === 'ios' && evt.nativeEvent.pageX <= 28 && gestureState.dx > 20;
      },
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const g = (evt as any)?.gestureState || gestureState;
        if (g && g.dx > 40 && g.vx > 0.15) {
          goBack();
        }
      },
    })
  ).current;

  return (
    <NavigationContext.Provider
      value={{
        tab: currentTab,
        setTab,
        goBack,
        registerSubViewBack,
        tabHistory,
      }}
    >
      <View testID="nav-container" style={styles.container} {...edgePanResponder.panHandlers}>
        {children}
      </View>
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  return ctx ?? fallbackContext;
}

/** Hook to register a sub-view back handler when condition is active */
export function useSubViewBack(condition: boolean, handler: () => void): void {
  const { registerSubViewBack } = useNavigation();

  useEffect(() => {
    if (!condition) return;
    const unregister = registerSubViewBack(() => {
      handler();
      return true;
    });
    return unregister;
  }, [condition, handler, registerSubViewBack]);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
