import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text, Pressable, View } from 'react-native';
import { NavigationProvider, useNavigation, useSubViewBack } from '../../src/navigation/navigation';

function TestNavConsumer({ onRef }) {
  const nav = useNavigation();
  onRef(nav);
  return (
    <View>
      <Text testID="current-tab">{nav.tab}</Text>
      <Pressable testID="btn-session" onPress={() => nav.setTab('session')}>
        <Text>Session</Text>
      </Pressable>
      <Pressable testID="btn-library" onPress={() => nav.setTab('library')}>
        <Text>Library</Text>
      </Pressable>
    </View>
  );
}

function SubViewConsumer({ active, onClose }) {
  useSubViewBack(active, onClose);
  return <Text>{active ? 'SubView Open' : 'SubView Closed'}</Text>;
}

describe('BackNavigation Model (Deterministic Stack & SubView Back)', () => {
  test('a) tab history stack pops in reverse order and returns true', () => {
    let navRef = null;
    render(
      <NavigationProvider initialTab="readiness">
        <TestNavConsumer onRef={(r) => (navRef = r)} />
      </NavigationProvider>
    );

    expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');

    // Switch readiness -> library
    act(() => {
      navRef.setTab('library');
    });
    expect(screen.getByTestId('current-tab').children[0]).toBe('library');

    // Switch library -> session
    act(() => {
      navRef.setTab('session');
    });
    expect(screen.getByTestId('current-tab').children[0]).toBe('session');

    // 1st goBack(): session -> library (returns true)
    let handled = false;
    act(() => {
      handled = navRef.goBack();
    });
    expect(handled).toBe(true);
    expect(screen.getByTestId('current-tab').children[0]).toBe('library');

    // 2nd goBack(): library -> readiness (returns true)
    act(() => {
      handled = navRef.goBack();
    });
    expect(handled).toBe(true);
    expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');

    // 3rd goBack(): at root tab ('readiness') -> returns false (allows native exit, no accidental exit mid-flow)
    act(() => {
      handled = navRef.goBack();
    });
    expect(handled).toBe(false);
    expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');
  });

  test('b) sub-view back handler takes priority over tab stack popping', () => {
    let navRef = null;
    let subViewOpen = true;
    const handleCloseSubView = jest.fn(() => {
      subViewOpen = false;
    });

    const TestTree = () => (
      <NavigationProvider initialTab="readiness">
        <TestNavConsumer onRef={(r) => (navRef = r)} />
        <SubViewConsumer active={subViewOpen} onClose={handleCloseSubView} />
      </NavigationProvider>
    );

    const { rerender } = render(<TestTree />);

    // Switch to library tab
    act(() => {
      navRef.setTab('library');
    });

    // Sub-view is active while on library tab.
    // Calling goBack() must pop the SUB-VIEW FIRST, remaining on 'library' tab.
    let handled = false;
    act(() => {
      handled = navRef.goBack();
    });

    expect(handled).toBe(true);
    expect(handleCloseSubView).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-tab').children[0]).toBe('library');

    // Rerender with subViewOpen = false
    rerender(<TestTree />);

    // Next goBack() pops the tab stack: library -> readiness
    act(() => {
      handled = navRef.goBack();
    });
    expect(handled).toBe(true);
    expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');
  });

  test('c) iOS PanResponder edge-swipe handler pops tab stack (fresh goBackRef)', () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    try {
      let navRef = null;
      render(
        <NavigationProvider initialTab="readiness">
          <TestNavConsumer onRef={(r) => (navRef = r)} />
        </NavigationProvider>
      );

      expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');

      // Switch readiness -> library
      act(() => {
        navRef.setTab('library');
      });
      expect(screen.getByTestId('current-tab').children[0]).toBe('library');

      // Test PanResponder edge gesture start & release handler
      const navContainer = screen.getByTestId('nav-container');
      const startResponder = navContainer.props.onStartShouldSetResponder;
      const releaseResponder = navContainer.props.onResponderRelease;

      let shouldSet = false;
      act(() => {
        if (startResponder) {
          shouldSet = startResponder({ nativeEvent: { pageX: 15 } });
        }
        if (releaseResponder) {
          releaseResponder({ nativeEvent: { pageX: 80 }, gestureState: { dx: 65, vx: 0.5 } });
        }
      });

      expect(shouldSet).toBe(true);
      expect(screen.getByTestId('current-tab').children[0]).toBe('readiness');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });
});
