import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NewBlockChooserScreen from '../../src/screens/NewBlockChooserScreen';
import { splitExplainer, SPLIT_EXPLAINER_FOOTER } from '@ak/inference';

describe('NewBlockChooserScreen', () => {
  test('renders two mode options, Auto then Custom, with exact approved copy and no Guided card', () => {
    const onSelectAuto = jest.fn();
    const onSelectCustom = jest.fn();
    const onCancel = jest.fn();

    render(
      <NewBlockChooserScreen
        onSelectAuto={onSelectAuto}
        onSelectCustom={onSelectCustom}
        onCancel={onCancel}
      />,
    );

    // Screen title and intro line
    expect(screen.getByText('Start a new block')).toBeOnTheScreen();
    expect(screen.getByText('Pick how much you want the coach to decide.')).toBeOnTheScreen();

    // Mode 1: Auto
    expect(screen.getByText('Auto')).toBeOnTheScreen();
    expect(screen.getByText(
      "The coach builds the whole block from your goal, history and equipment. Fastest, and the default if you're not sure.",
    )).toBeOnTheScreen();

    // Mode 2: Custom
    expect(screen.getByText('Custom')).toBeOnTheScreen();
    expect(screen.getByText(
      "You choose every movement, day by day. Full control — you'll need to know what you're doing.",
    )).toBeOnTheScreen();

    // Exactly two modes, in order: Auto, then Custom (issue #134)
    // Every mode card is labelled "<Mode>: <blurb>", enabled or not.
    const modeLabels = screen.queryAllByLabelText(/^[A-Z][a-z]+: /)
      .map(card => card.props.accessibilityLabel);
    expect(modeLabels).toHaveLength(2);
    expect(modeLabels[0]).toMatch(/^Auto: /);
    expect(modeLabels[1]).toMatch(/^Custom: /);

    // The Guided card is hidden for the beta: no "Coming soon" anywhere
    expect(screen.queryByText('Guided')).toBeNull();
    expect(screen.queryByText(
      "The coach drafts a week, you swap anything you don't like, then confirm.",
    )).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
    expect(screen.queryByLabelText(/coming soon/i)).toBeNull();

    // Auto and Custom are enabled
    fireEvent.press(screen.getByText('Auto'));
    expect(onSelectAuto).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Custom'));
    expect(onSelectCustom).toHaveBeenCalledTimes(1);
  });

  test('split explainer for a rehab profile renders the approved rehab string', () => {
    const rehabExplainer = splitExplainer('rehab', 5);
    expect(rehabExplainer).toBe(
      'Every day is full-body and effort is capped at RPE 7. Rehab keeps volume low and frequency steady rather than loading any one pattern hard.',
    );
  });

  test('split explainer for a strength profile renders the approved strength string', () => {
    const strengthExplainer = splitExplainer('strength', 5);
    expect(strengthExplainer).toBe(
      'Alternating lower and upper days across 5 sessions, so each half recovers while the other works.',
    );
    expect(SPLIT_EXPLAINER_FOOTER).toBe('You can change any day below.');
  });
});
