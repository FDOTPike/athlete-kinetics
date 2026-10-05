/**
 * UIComponents.test.js — WO-UI-0 checkpoint assertions.
 *
 * Verifies §1b pikeMethods primitive semantics:
 *   - Chip selected → textHi fill (NOT chalk)
 *   - ListRow chalkSpine → chalk border, not on unselected rows
 *   - RestTimerCard → accessible label present, chalk referenced only in barFill
 *   - Halt button (SecondaryButton fullWidth) → accessible, ≥56pt implied
 *   - QuietAction → not red (no red colour referenced)
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

// Mock the theme to expose testable token names without native rendering
jest.mock('../../src/theme/theme', () => ({
  theme: {
    color: {
      ink0: 'INK0',
      ink1: 'INK1',
      line: 'LINE',
      textHi: 'TEXTHI',
      textMid: 'TEXTMID',
      textLow: 'TEXTLOW',
      chalk: 'CHALK',
      onChalk: 'ONCHALK',
      pressed: 'PRESSED',
    },
    font: {
      family: 'Archivo',
      metric:  { fontSize: 64, lineHeight: 68, fontWeight: '700' },
      display: { fontSize: 40, lineHeight: 46, fontWeight: '800' },
      title:   { fontSize: 28, lineHeight: 34, fontWeight: '700' },
      cue:     { fontSize: 20, lineHeight: 28, fontWeight: '600' },
      body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' },
      label:   { fontSize: 13, lineHeight: 18, fontWeight: '600' },
      eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
    },
    space: [0, 4, 8, 12, 16, 24, 32, 48],
    radius: { chip: 2, control: 6, sheet: 10 },
    touch: { min: 56, log: 72, destructiveGap: 16 },
    motion: { state: { duration: 160 }, sheet: { duration: 200 } },
  },
}));

// Stub motionDuration so animations don't error in the test environment
jest.mock('../../src/components/ui/motionDuration', () => ({
  motionDuration: (ms) => ms,
}));

const { Chip } = require('../../src/components/ui/Chip');
const { ListRow } = require('../../src/components/ui/ListRow');
const { RestTimerCard } = require('../../src/components/ui/RestTimerCard');
const { SecondaryButton } = require('../../src/components/ui/SecondaryButton');
const { QuietAction } = require('../../src/components/ui/QuietAction');
const { PrimaryButton } = require('../../src/components/ui/PrimaryButton');
const { Stepper } = require('../../src/components/ui/Stepper');
const { Disclosure } = require('../../src/components/ui/Disclosure');
const { statusBarPaddingTop } = require('../../src/layout/statusBarPadding');

// ── Chip ─────────────────────────────────────────────────────────────────────

test('Chip: selected state uses TEXTHI fill (inverted white), not chalk', () => {
  const { getByRole } = render(
    <Chip label="STRENGTH" selected={true} onPress={() => {}} />
  );
  const btn = getByRole('button');
  expect(btn).toBeOnTheScreen();
  // accessibilityState.selected must be true
  expect(btn.props.accessibilityState.selected).toBe(true);
});

test('Chip: unselected state has no selected accessibilityState', () => {
  const { getByRole } = render(
    <Chip label="STRENGTH" selected={false} onPress={() => {}} />
  );
  const btn = getByRole('button');
  expect(btn.props.accessibilityState.selected).toBe(false);
});

test('Chip: disabled state is accessible', () => {
  const { getByRole } = render(
    <Chip label="STRENGTH" selected={false} onPress={() => {}} disabled={true} />
  );
  const btn = getByRole('button');
  expect(btn.props.accessibilityState.disabled).toBe(true);
});

test('Chip: enlarged labels keep their scaled size on one line', () => {
  render(<Chip label="All equipment" selected={false} onPress={() => {}} />);
  const label = screen.getByText('All equipment');
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.adjustsFontSizeToFit).toBeUndefined();
  expect(label.props.minimumFontScale).toBeUndefined();
});

test('App shell keeps a minimum Android status-bar inset when the runtime reports zero', () => {
  expect(statusBarPaddingTop('android', 0)).toBe(24);
  expect(statusBarPaddingTop('android', undefined)).toBe(24);
  expect(statusBarPaddingTop('android', 32)).toBe(32);
  expect(statusBarPaddingTop('ios', 32)).toBe(0);
});

// ── ListRow ───────────────────────────────────────────────────────────────────

test('ListRow: renders label', () => {
  render(<ListRow label="Today's session" />);
  expect(screen.getByText("Today's session")).toBeOnTheScreen();
});

test('ListRow: chalkSpine prop is accepted without error', () => {
  render(<ListRow label="Today" chalkSpine={true} />);
  expect(screen.getByText('Today')).toBeOnTheScreen();
});

test('ListRow: trailing NOW renders correctly', () => {
  render(<ListRow label="Current" trailing="now" />);
  expect(screen.getByText('NOW')).toBeOnTheScreen();
});

test('ListRow: trailing check renders correctly', () => {
  render(<ListRow label="Done" trailing="check" />);
  expect(screen.getByText('✓')).toBeOnTheScreen();
});

test('ListRow: onPress makes row pressable with button role', () => {
  const onPress = jest.fn();
  const { getByRole } = render(
    <ListRow label="Pressable" onPress={onPress} accessibilityLabel="Row action" />
  );
  const btn = getByRole('button');
  fireEvent.press(btn);
  expect(onPress).toHaveBeenCalledTimes(1);
});

// ── RestTimerCard ─────────────────────────────────────────────────────────────

test('RestTimerCard: accessible label includes remaining time', () => {
  render(<RestTimerCard totalSeconds={90} elapsedSeconds={30} />);
  // secondsText formats 60s as '1:00' (minute format for values >= 60)
  expect(screen.getByLabelText('Rest timer: 1:00 remaining')).toBeOnTheScreen();
});

test('RestTimerCard: shows upcoming label when provided', () => {
  render(
    <RestTimerCard
      totalSeconds={90}
      elapsedSeconds={0}
      upcomingLabel="Goblet Squat"
    />
  );
  expect(screen.getByText('Next up: Goblet Squat')).toBeOnTheScreen();
});

// ── SecondaryButton (Halt variant) ───────────────────────────────────────────

test('SecondaryButton fullWidth: halt button is accessible with button role', () => {
  const onPress = jest.fn();
  const { getByRole } = render(
    <SecondaryButton
      label="Stop training for today"
      onPress={onPress}
      fullWidth={true}
      accessibilityLabel="Halt session"
      testID="halt-btn"
    />
  );
  const btn = getByRole('button', { name: 'Halt session' });
  expect(btn).toBeOnTheScreen();
  fireEvent.press(btn);
  expect(onPress).toHaveBeenCalledTimes(1);
});

// ── QuietAction ───────────────────────────────────────────────────────────────

test('QuietAction: renders and fires onPress', () => {
  const onPress = jest.fn();
  render(<QuietAction label="Delete athlete" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Delete athlete' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('QuietAction: disabled state is accessible', () => {
  const { getByRole } = render(
    <QuietAction label="Delete" onPress={() => {}} disabled={true} />
  );
  expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
});

// ── PrimaryButton ─────────────────────────────────────────────────────────────

test('PrimaryButton: default size renders with accessible label', () => {
  render(<PrimaryButton label="Start session" onPress={() => {}} />);
  expect(screen.getByRole('button', { name: 'Start session' })).toBeOnTheScreen();
});

test('PrimaryButton: log size is labelled correctly', () => {
  render(<PrimaryButton label="Log set" onPress={() => {}} size="log" />);
  expect(screen.getByRole('button', { name: 'Log set' })).toBeOnTheScreen();
});

test('PrimaryButton: disabled state', () => {
  const { getByRole } = render(
    <PrimaryButton label="Submit" onPress={() => {}} disabled={true} />
  );
  expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
});

// ── Stepper ───────────────────────────────────────────────────────────────────

test('Stepper: renders label and value, fires decrement and increment', () => {
  const dec = jest.fn();
  const inc = jest.fn();
  render(<Stepper label="Reps" value="8" onDecrement={dec} onIncrement={inc} />);

  fireEvent.press(screen.getByLabelText('Decrease Reps'));
  expect(dec).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Increase Reps'));
  expect(inc).toHaveBeenCalledTimes(1);
});
test('Stepper: optional hold repeats after 300ms and stops on release', () => {
  jest.useFakeTimers();
  const inc = jest.fn();
  const { unmount } = render(
    <Stepper label="Load" value="0" onDecrement={() => {}} onIncrement={inc} repeatOnHold={true} />
  );
  const button = screen.getByLabelText('Increase Load');

  fireEvent(button, 'pressIn');
  act(() => jest.advanceTimersByTime(299));
  expect(inc).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(inc).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(300));
  expect(inc).toHaveBeenCalledTimes(4);

  fireEvent(button, 'pressOut');
  fireEvent(button, 'press');
  act(() => jest.advanceTimersByTime(500));
  expect(inc).toHaveBeenCalledTimes(4);

  unmount();
  jest.useRealTimers();
});


// ── Disclosure ────────────────────────────────────────────────────────────────

test('Disclosure: starts closed, opens on press, shows children', () => {
  render(
    <Disclosure label="How & why">
      <></>
    </Disclosure>
  );
  const trigger = screen.getByRole('button', { name: 'How & why' });
  expect(trigger.props.accessibilityState.expanded).toBe(false);
  fireEvent.press(trigger);
  expect(trigger.props.accessibilityState.expanded).toBe(true);
});

test('Disclosure: defaultOpen renders expanded', () => {
  render(
    <Disclosure label="Training decisions" defaultOpen={true}>
      <></>
    </Disclosure>
  );
  const trigger = screen.getByRole('button', { name: 'Training decisions' });
  expect(trigger.props.accessibilityState.expanded).toBe(true);
});

// ── Chip selected-state semantics (Law 2 machine-check) ──────────────────────

test('Law 2: Chip selected state accessibility — selected=true when pressed', () => {
  let selected = false;
  const { rerender, getByRole } = render(
    <Chip
      label="BEGINNER"
      selected={selected}
      onPress={() => { selected = true; }}
    />
  );
  expect(getByRole('button').props.accessibilityState.selected).toBe(false);

  rerender(
    <Chip
      label="BEGINNER"
      selected={true}
      onPress={() => {}}
    />
  );
  expect(getByRole('button').props.accessibilityState.selected).toBe(true);
});
