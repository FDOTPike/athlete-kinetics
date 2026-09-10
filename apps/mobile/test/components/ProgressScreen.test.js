/**
 * ProgressScreen.test.js — Audit R1 R2 contracts (D5) for the Progress surface.
 *
 * Pinned here:
 * 1. An unknown outcome kind renders "Outcome unavailable" — never relabelled
 *    as a recorded session (D5).
 * 2. Recent-session dates include the year (D5) — a prior-year date must show
 *    its year, so an old session cannot masquerade as recent.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProgressScreen from '../../src/screens/ProgressScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

// Deterministic locale so the year assertion is stable.
const SpyDate = Date;
const REAL_TZ_OFFSET = new SpyDate('2026-09-10T00:00:00Z').getTimezoneOffset();

const state = (overrides = {}) => ({
  session: null,
  loadRecentOutcomes: jest.fn(() => []),
  loadMeasuredHistory: jest.fn(() => []),
  ...overrides,
});

beforeEach(() => { mockState = state(); });

describe('Progress truth (D5)', () => {
  test('an unknown outcome kind renders "Outcome unavailable"', () => {
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'mystery_kind', finalizedAtMs: new SpyDate('2026-08-01T12:00:00Z').getTime() },
      ]),
    });
    render(<ProgressScreen />);
    expect(screen.getByText('Outcome unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('Session recorded')).toBeNull();
  });

  test('a date from a prior year includes the year', () => {
    const priorYear = new SpyDate('2024-11-03T12:00:00Z').getTime();
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'followed_plan', finalizedAtMs: priorYear },
      ]),
    });
    render(<ProgressScreen />);
    const detail = screen.getByText(/2024/);
    expect(detail).toBeOnTheScreen();
    expect(detail.props.children).toContain('2024');
  });

  test('known kinds keep their labels and render with year-ful dates', () => {
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'followed_plan', finalizedAtMs: new SpyDate('2025-03-09T12:00:00Z').getTime() },
      ]),
    });
    render(<ProgressScreen />);
    expect(screen.getByText('Plan followed')).toBeOnTheScreen();
    expect(screen.getByText(/2025/)).toBeOnTheScreen();
  });
});
