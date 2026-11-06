/**
 * PreparationPanel.test.js — the athlete-facing preparation surface.
 *
 * The panel is driven with protocols built by the REAL policy, so what is
 * asserted is what an athlete would see. It pins: the protocol is shown as
 * frozen; each action reports the revision it was drawn from (duplicate-tap
 * safety lives in the store, the panel must hand it the revision); every exit
 * is offered by its true name; stopping the session is always reachable; and
 * every control is labelled for a screen reader.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { buildPreparationProtocol } from '@ak/inference';
import { PreparationPanel } from '../../src/components/PreparationPanel';

jest.setTimeout(60_000);

const protocolFor = (overrides = {}) => buildPreparationProtocol({
  tier: 'intermediate', accessContext: 'weight_room',
  slots: [
    { movementId: 7, movementName: 'Back Squat', pattern: 'squat', isCompound: true, externallyLoaded: true, target: { kind: 'reps', reps: 5 } },
    { movementId: 9, movementName: 'Romanian Deadlift', pattern: 'hinge', isCompound: true, externallyLoaded: true, target: { kind: 'reps', reps: 8 } },
  ],
  excludedMovements: new Map(), restrictedJoints: [], readinessReduced: false, budgetMin: 10,
  ...overrides,
});
const preparationOf = (protocol, overrides = {}) => ({
  sessionId: 5, instanceId: 'prep-5-1000-test', revision: 4, status: 'in_progress', protocol,
  items: protocol === null ? [] : protocol.items.map((item, index) => ({
    index, itemId: item.itemId, movementId: item.movementId, status: 'pending',
    performedAmount: null, performedLoadKg: null, substitutionText: null, reasonCode: null, extraWork: false,
  })),
  finishedAtMs: null,
  ...overrides,
});
const handlers = () => ({ onBegin: jest.fn(), onRecordItem: jest.fn(), onFinish: jest.fn(), onStopSession: jest.fn() });
const show = (preparation, props = handlers()) => {
  render(<PreparationPanel preparation={preparation} {...props} />);
  return props;
};

test('shows the frozen protocol: estimate, basis, every item with its dose, and the current step in full', () => {
  const protocol = protocolFor();
  show(preparationOf(protocol));
  expect(screen.getByText('Prepare for this session')).toBeTruthy();
  expect(screen.getByTestId('preparation-estimate').props.children).toMatch(/About \d+ minutes · full protocol/);
  expect(screen.getByTestId('preparation-status').props.children).toBe('In progress');
  expect(screen.getByText(/Session movements: squat, hinge\./)).toBeTruthy();
  protocol.items.forEach((item, index) => {
    expect(within(screen.getByTestId(`preparation-item-${index}`)).getByText(item.title)).toBeTruthy();
    expect(screen.getByTestId(`preparation-item-${index}-dose`).props.children.length).toBeGreaterThan(0);
  });
  // Only the current step is expanded: instruction, cue, stop instruction, easier option.
  const first = protocol.items[0];
  expect(screen.getByText(first.instruction)).toBeTruthy();
  expect(screen.getByText(first.cue)).toBeTruthy();
  expect(screen.getByText(first.stopInstruction)).toBeTruthy();
  expect(screen.getByText(`Easier option: ${first.regression}`)).toBeTruthy();
  expect(screen.queryByText(protocol.items[1].instruction)).toBeNull();
  expect(screen.getByText(/6 reps at about 40% of today's working load|5 reps at about 40% of today's working load/)).toBeTruthy();
});

// Android walk (#213): the app knows today's working load, so the ramp sets
// say it in kilograms (2.5 kg step), with the percentage as support.
describe('#213: ramp sets in kilograms when the working load is known', () => {
  const rampIndexes = (protocol) => protocol.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.stage === 'ramp');

  test('with a working load of 87.5 kg, the 40% and 80% ramp items show 35 kg and 70 kg', () => {
    const protocol = protocolFor();
    const ramps = rampIndexes(protocol);
    expect(ramps.map(({ item }) => item.dose.percentOfWorkingLoad)).toEqual([40, 80]);
    render(<PreparationPanel preparation={preparationOf(protocol)} {...handlers()}
      rampWorkingLoad={{ movementId: 7, movementName: 'Back Squat', workingLoadKg: 87.5 }} />);
    const [low, high] = ramps;
    const lowCard = within(screen.getByTestId(`preparation-item-${low.index}`));
    const highCard = within(screen.getByTestId(`preparation-item-${high.index}`));
    expect(lowCard.getByText('Preparation set: Back Squat, about 35 kg (40%)')).toBeTruthy();
    expect(highCard.getByText('Preparation set: Back Squat, about 70 kg (80%)')).toBeTruthy();
    expect(screen.getByTestId(`preparation-item-${low.index}-dose`).props.children).toBe("5 reps at about 35 kg (40% of today's working load)");
    expect(screen.getByTestId(`preparation-item-${high.index}-dose`).props.children).toBe("5 reps at about 70 kg (80% of today's working load)");
    expect(screen.queryByText(/Preparation set: Back Squat at about \d+% of today's working load/)).toBeNull();
  });

  test('with no working load, the ramp items keep the percentage text', () => {
    const protocol = protocolFor();
    const ramps = rampIndexes(protocol);
    render(<PreparationPanel preparation={preparationOf(protocol)} {...handlers()} rampWorkingLoad={null} />);
    for (const { item, index } of ramps) {
      expect(within(screen.getByTestId(`preparation-item-${index}`)).getByText(item.title)).toBeTruthy();
      expect(screen.getByTestId(`preparation-item-${index}-dose`).props.children)
        .toBe(`5 reps at about ${item.dose.percentOfWorkingLoad}% of today's working load`);
    }
    expect(screen.queryByText(/ kg/)).toBeNull();
  });

  test('a working load for a different movement is not applied to the ramp', () => {
    const protocol = protocolFor();
    render(<PreparationPanel preparation={preparationOf(protocol)} {...handlers()}
      rampWorkingLoad={{ movementId: 9, movementName: 'Romanian Deadlift', workingLoadKg: 87.5 }} />);
    expect(screen.queryByText(/ kg/)).toBeNull();
  });
});

test('before starting, one tap begins preparation and carries the rendered revision', () => {
  const props = show(preparationOf(protocolFor(), { status: 'pending', revision: 1 }));
  expect(screen.getByTestId('preparation-status').props.children).toBe('Not started');
  expect(screen.queryByTestId('preparation-finish')).toBeNull();
  fireEvent.press(screen.getByTestId('preparation-begin'));
  expect(props.onBegin).toHaveBeenCalledTimes(1);
  expect(props.onBegin).toHaveBeenCalledWith(1);
});

test('each item action reports exactly what the athlete did, with the revision', () => {
  const props = show(preparationOf(protocolFor()));
  fireEvent.press(screen.getByTestId('preparation-item-0-done'));
  expect(props.onRecordItem).toHaveBeenLastCalledWith(0, { status: 'done' }, 4);
  fireEvent.press(screen.getByTestId('preparation-item-0-skip'));
  expect(props.onRecordItem).toHaveBeenLastCalledWith(0, { status: 'skipped', reasonCode: 'athlete_choice' }, 4);
  fireEvent.press(screen.getByTestId('preparation-item-0-discomfort'));
  expect(props.onRecordItem).toHaveBeenLastCalledWith(0, { status: 'skipped', reasonCode: 'discomfort' }, 4);
});

test('"I did it differently" records the amount actually performed, or a named substitute', () => {
  const protocol = protocolFor();
  const props = show(preparationOf(protocol));
  fireEvent.press(screen.getByTestId('preparation-item-0-change'));
  expect(screen.getByTestId('preparation-item-0-editor')).toBeTruthy();
  expect(screen.getByText('Doing much more than written is recorded as extra work, not as preparation.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Decrease Seconds you did'));
  fireEvent.press(screen.getByTestId('preparation-item-0-save'));
  expect(props.onRecordItem).toHaveBeenLastCalledWith(
    0, { status: 'modified', performedAmount: 210, reasonCode: 'athlete_choice' }, 4);

  fireEvent.press(screen.getByTestId('preparation-item-0-change'));
  fireEvent.changeText(screen.getByTestId('preparation-item-0-instead'), '  easy rowing  ');
  fireEvent.press(screen.getByTestId('preparation-item-0-save'));
  expect(props.onRecordItem).toHaveBeenLastCalledWith(
    0, { status: 'substituted', substitutionText: 'easy rowing', performedAmount: 240, reasonCode: 'athlete_choice' }, 4);

  fireEvent.press(screen.getByTestId('preparation-item-0-change'));
  fireEvent.press(screen.getByTestId('preparation-item-0-cancel'));
  expect(screen.queryByTestId('preparation-item-0-editor')).toBeNull();
  expect(props.onRecordItem).toHaveBeenCalledTimes(2);
});

test('recorded items show what happened, including extra work, and the next item becomes current', () => {
  const protocol = protocolFor();
  const preparation = preparationOf(protocol);
  preparation.items[0] = { ...preparation.items[0], status: 'done', performedAmount: 240 };
  preparation.items[1] = { ...preparation.items[1], status: 'modified', performedAmount: 120, extraWork: true };
  preparation.items[2] = { ...preparation.items[2], status: 'withheld', reasonCode: 'restricted_at_execution' };
  show(preparation);
  expect(screen.getByTestId('preparation-item-0-recorded').props.children).toBe('Done as written');
  expect(screen.getByTestId('preparation-item-1-recorded').props.children).toBe('Changed: 120 seconds — recorded as extra work');
  expect(screen.getByTestId('preparation-item-2-recorded').props.children).toBe('Withheld: not available right now');
  expect(screen.queryByTestId('preparation-item-0-done')).toBeNull();
  expect(screen.getByTestId('preparation-item-3-done')).toBeTruthy();
});

test('every exit is offered by its true name, and "Finish" needs something recorded', () => {
  const protocol = protocolFor();
  const props = show(preparationOf(protocol));
  // Nothing recorded yet: finishing would claim preparation that did not happen.
  expect(screen.getByTestId('preparation-finish').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByTestId('preparation-already-warm'));
  expect(props.onFinish).toHaveBeenLastCalledWith('already_warm', 4);
  fireEvent.press(screen.getByTestId('preparation-skip'));
  expect(props.onFinish).toHaveBeenLastCalledWith('skipped', 4);
  fireEvent.press(screen.getByTestId('preparation-stop-session'));
  expect(props.onStopSession).toHaveBeenCalledTimes(1);
});

test('"Finish preparation" is enabled once an item is recorded and asks the store for the outcome', () => {
  const preparation = preparationOf(protocolFor());
  preparation.items[0] = { ...preparation.items[0], status: 'done', performedAmount: 240 };
  const props = show(preparation);
  expect(screen.getByTestId('preparation-finish').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByTestId('preparation-finish'));
  expect(props.onFinish).toHaveBeenCalledWith('finished', 4); // the store derives completed / modified
});

test('what was left out is listed with its reason', () => {
  const protocol = protocolFor({
    restrictedJoints: ['knee'],
    excludedMovements: new Map([[7, { reasonCode: 'support_hold', detail: 'it is on hold under your training support settings.' }]]),
  });
  show(preparationOf(protocol));
  fireEvent.press(screen.getByLabelText('Left out, and why'));
  expect(screen.getByText('Leg swings is withheld because it loads an area with an active niggle.')).toBeTruthy();
  expect(screen.getByText('Back Squat: it is on hold under your training support settings.')).toBeTruthy();
});

test('honest notes (time conflict, eased day) are announced', () => {
  const protocol = protocolFor({ readinessReduced: true, timeConflictNote: 'This session is over your 30-minute session limit.' });
  show(preparationOf(protocol));
  const notes = screen.getAllByTestId('preparation-note');
  expect(notes.map((note) => note.props.children)).toEqual(protocol.notes);
  expect(notes.every((note) => note.props.accessibilityRole === 'alert')).toBe(true);
});

test('a finished protocol offers no further action', () => {
  const protocol = protocolFor();
  const preparation = preparationOf(protocol, { status: 'modified', finishedAtMs: 9000 });
  show(preparation);
  expect(screen.getByTestId('preparation-status').props.children).toBe('Completed with changes');
  for (const id of ['preparation-begin', 'preparation-finish', 'preparation-already-warm', 'preparation-skip',
    'preparation-stop-session', 'preparation-item-0-done']) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
});

test('an unreadable frozen protocol is not guessed at: the athlete can still record an honest outcome or stop', () => {
  const props = show(preparationOf(null, { status: 'pending', revision: 1 }));
  expect(screen.getByText('Preparation details could not be shown')).toBeTruthy();
  fireEvent.press(screen.getByTestId('preparation-already-warm'));
  expect(props.onFinish).toHaveBeenLastCalledWith('already_warm', 1);
  fireEvent.press(screen.getByTestId('preparation-skip'));
  expect(props.onFinish).toHaveBeenLastCalledWith('skipped', 1);
  fireEvent.press(screen.getByTestId('preparation-stop-session'));
  expect(props.onStopSession).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('preparation-finish')).toBeNull();
});

test('accessibility: every control is labelled, headings are headings, and status changes are announced', () => {
  show(preparationOf(protocolFor()));
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThanOrEqual(8);
  for (const button of buttons) {
    expect(typeof button.props.accessibilityLabel).toBe('string');
    expect(button.props.accessibilityLabel.length).toBeGreaterThan(3);
  }
  // Item actions name the item, so "Done" is never ambiguous out of context.
  expect(screen.getByLabelText('Mark Easy movement and breathing done as written')).toBeTruthy();
  expect(screen.getByLabelText('Skip Easy movement and breathing because it does not feel right')).toBeTruthy();
  expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByTestId('preparation-status').props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByTestId('preparation-panel').props.accessibilityLabel).toBe('Preparation');
});
