import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });
// The optional one-rep-max screen (issue #218) joins from SOME MILEAGE up; these
// tests are about other screens, so NEXT walks straight through it (it is
// covered in OnboardingMaxesStep.test.js).
const next = () => {
  pressLabel('Next');
  if (screen.queryByTestId('onboarding-maxes-step') !== null) pressLabel('Next');
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
  };
  useStore.setState({
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    runner: null,
    focus: null,
    goals: [],
    block: null,
    program: null,
    todayPlan: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

describe('OnboardingScreen review step provides an Edit target action when wantsTarget is enabled', () => {
  test('review step provides an Edit target action that navigates directly to the target step ("WHAT ARE WE AIMING FOR?")', () => {
    render(<OnboardingScreen />);

    // welcome -> goal -> focus
    next();
    next();
    press('focus-bundle-lower_body');
    press('onboarding-wants-target');

    // focus -> target (goal-editor)
    next();
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
    type('goal-outcome', 'Squat 100 kg for 5 reps');
    type('goal-method', 'Back squat, 5 reps to parallel');
    type('goal-baseline', '80');
    type('goal-target', '100');
    type('goal-reason', 'To be stronger for football');

    // target -> experience -> logistics -> equipment -> limits -> review
    next();
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();

    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
    const targetRow = screen.getByTestId('onboarding-summary-target-row');
    expect(targetRow.props.children)
      .toContain('TARGET — Squat 100 kg for 5 reps');
    expect(StyleSheet.flatten(targetRow.props.style)).toMatchObject({ flexShrink: 1 });

    const editLabels = screen.getAllByLabelText(/^Edit /).map((node) => node.props.accessibilityLabel);
    expect(editLabels).toContain('Edit target');
    expect(StyleSheet.flatten(screen.getByLabelText('Edit target').props.style)).toMatchObject({
      minWidth: 56,
      minHeight: 56,
    });

    pressLabel('Edit target');
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
    // Walk 1 (W1-1): NEXT after editing the target returns to the review,
    // like every other EDIT, instead of walking on to the experience step.
    next();
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
  });
});


describe('OnboardingScreen review effort ceiling', () => {
  test.each([
    ['beginner', /^NEW TO THIS\./, '8.5', 'Hard but controlled \u2014 a couple of reps always in reserve.'],
    ['intermediate', /^SOME MILEAGE\./, '9.0', 'Close to the limit on the biggest days.'],
  ])('%s shows the applicable ceiling', (age, label, ceiling, blurb) => {
    render(<OnboardingScreen />);
    next();
    next();
    next();
    pressLabel(label);
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();

    expect(screen.getByText(new RegExp(`Effort ceiling ${ceiling} \u2014 ${blurb}`))).toBeOnTheScreen();
    if (age === 'beginner') {
      expect(screen.getByText(/Your effort ceiling starts at 8\.5 and can change as your experience grows\./)).toBeOnTheScreen();
    }
  });
});

// Android walk 2026-11-03 (ux-5): EDIT on the review led into the middle of
// the questions, and NEXT walked through every later screen again. NEXT now
// returns to the review, unless the edit added a screen still to be answered.
describe('OnboardingScreen EDIT from review returns to the review', () => {
  const toReview = () => {
    next();
    next();
    next();
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
  };

  test('NEXT after an edit goes straight back to the review', () => {
    render(<OnboardingScreen />);
    toReview();
    pressLabel('Edit experience');
    expect(screen.queryByLabelText('START TRAINING')).toBeNull();
    next();
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
  });

  test('an edit that adds the target screen walks into it, then returns to the review', () => {
    render(<OnboardingScreen />);
    toReview();
    pressLabel('Edit focus');
    press('onboarding-wants-target');
    next();
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
    type('goal-outcome', 'Squat 100 kg for 5 reps');
    type('goal-method', 'Back squat, 5 reps to parallel');
    type('goal-baseline', '80');
    type('goal-target', '100');
    type('goal-reason', 'To be stronger for football');
    next();
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
  });

  test('BACK during an edit steps back one screen, and NEXT still returns to the review', () => {
    render(<OnboardingScreen />);
    toReview();
    pressLabel('Edit your week');
    pressLabel('Back');
    // One screen back from YOUR WEEK is the optional maxes screen (issue #218).
    expect(screen.getByTestId('onboarding-maxes-step')).toBeOnTheScreen();
    pressLabel('Next');
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
  });

  test('with a sport already answered, an edit that adds the target still walks into the target', () => {
    render(<OnboardingScreen />);
    next();
    next();
    press('onboarding-wants-sport');
    next();
    press('sport-family-basketball');
    press('sport-outcome-general_support');
    press('sport-experience-new');
    next();
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();
    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
    pressLabel('Edit focus');
    press('onboarding-wants-target');
    next();
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
  });

  test('without an edit, NEXT still walks one screen at a time', () => {
    render(<OnboardingScreen />);
    next();
    next();
    next();
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeOnTheScreen();
  });
});

// Walk 1 copy findings (W1-9, W1-12, W1-15).
describe('Onboarding wording found on the Android walk', () => {
  test('a blank name takes the first free "Athlete N", never a name another athlete has', () => {
    const { fallbackAthleteName } = require('../../src/screens/OnboardingScreen');
    const roster = [
      { id: 'a', name: 'Sam' }, { id: 'b', name: 'Athlete 1' }, { id: 'c', name: 'athlete 2' }, { id: 'new', name: 'New Athlete' },
    ];
    expect(fallbackAthleteName(roster, 'new')).toBe('Athlete 3');
    expect(fallbackAthleteName([{ id: 'default', name: 'Athlete 1' }], 'default')).toBe('Athlete 1');
    expect(fallbackAthleteName([], null)).toBe('Athlete 1');
  });

  test('STRENGTH + GRAPPLING says its BJJ days are planned and the sport step is for another sport', () => {
    const { HYBRID_SPORT_NOTE } = require('../../src/screens/OnboardingScreen');
    render(<OnboardingScreen />);
    next();
    pressLabel(/^STRENGTH \+ GRAPPLING/);
    next();
    expect(screen.getByTestId('onboarding-hybrid-sport-note').props.children).toBe(HYBRID_SPORT_NOTE);
    press('onboarding-wants-sport');
    next();
    expect(screen.getByTestId('onboarding-hybrid-sport-step-note')).toBeOnTheScreen();
  });

  test('other goals show no grappling note', () => {
    render(<OnboardingScreen />);
    next();
    next();
    expect(screen.queryByTestId('onboarding-hybrid-sport-note')).toBeNull();
  });

  test('one limitation note is singular', () => {
    const { limitationNotesLine } = require('../../src/screens/OnboardingScreen');
    expect(limitationNotesLine(1)).toBe('1 limitation note recorded for your reference.');
    expect(limitationNotesLine(2)).toBe('2 limitation notes recorded for your reference.');
  });

  test('the sport length error gives the range and points at no missing "Not sure" choice', () => {
    const { validateSportProfile: validateSportDraft, SPORT_SESSION_MINUTES_MAX } = require('@ak/inference');
    expect(typeof validateSportDraft).toBe('function');
    const result = validateSportDraft({
      sportId: 'muay_thai', otherSportName: null, outcomeId: 'general_support', experienceId: 'new',
      practiceSessionsPerWeek: null, matchesPerWeek: null, typicalSessionMinutes: 0, competitionDate: null,
    }, '2026-11-03');
    const message = (result.errors ?? []).find((error) => error.field === 'typicalSessionMinutes')?.message;
    expect(message).toBe(`Enter the usual length in minutes (1 to ${SPORT_SESSION_MINUTES_MAX}), or leave it empty.`);
  });

  test('no outcome offered to a Muay Thai athlete talks about a game', () => {
    const { SPORT_OUTCOMES_BY_SPORT, SPORT_OUTCOME_LABEL } = require('@ak/inference');
    // The sport answer needs an outcome, so an empty list is a failure too.
    expect(SPORT_OUTCOMES_BY_SPORT.muay_thai.length).toBeGreaterThan(0);
    for (const outcome of SPORT_OUTCOMES_BY_SPORT.muay_thai) {
      expect([outcome, /\bgame\b/i.test(SPORT_OUTCOME_LABEL[outcome])]).toEqual([outcome, false]);
    }
  });
});

describe('OnboardingScreen long option chips wrap instead of cutting their sentence', () => {
  test('focus bundles and the sport and target choices show their whole label', () => {
    const { Text } = require('react-native');
    render(<OnboardingScreen />);
    next();
    next();
    const ids = [
      ...screen.getAllByTestId(/^focus-bundle-/).map((node) => node.props.testID),
      'onboarding-wants-sport',
      'onboarding-wants-target',
    ];
    expect(ids.length).toBeGreaterThanOrEqual(6);
    for (const id of ids) {
      expect(screen.getByTestId(id).findByType(Text).props.numberOfLines).toBeUndefined();
    }
  });
});

// Android walk 2026-11-03 (ux-5): HOME BASIC claimed a pull-up bar its
// description did not mention. A preset's description names every item in it.
describe('OnboardingScreen HOME BASIC says what it adds', () => {
  const { EQUIPMENT_PRESETS, EQUIPMENT_ITEMS } = require('@ak/inference');
  const { GLOSSARY_ENTRIES: GLOSSARY } = require('../../src/data/glossary');
  // How each item reads in a preset description. Every equipment item has
  // an entry, so an item added to the preset cannot slip past unnamed.
  const SPOKEN = {
    barbell: 'barbell', squat_rack: 'rack', bench: 'bench', dumbbells: 'dumbbells', kettlebell: 'kettlebell',
    pullup_bar: 'pull-up bar', nordic_bench: 'nordic', bands: 'bands', cable_machine: 'cable', mats: 'mats', boards: 'boards',
  };
  // Whole words only: "mats" must not be found inside "formats".
  const namesWord = (text, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(text);
  };

  test('equipment names match as whole words', () => {
    expect(namesWord('bands and mats only', 'mats')).toBe(true);
    expect(namesWord('several formats', 'mats')).toBe(false);
    expect(namesWord('a pull-up bar.', 'pull-up bar')).toBe(true);
    expect(namesWord('cable-free', 'cable')).toBe(true);
    expect(namesWord('cables', 'cable')).toBe(false);
  });
  // Both directions: every preset item is named, and nothing outside the
  // preset is named.
  const expectNamesExactly = (text, preset) => {
    const lower = text.toLowerCase();
    for (const item of EQUIPMENT_ITEMS) {
      expect([item, namesWord(lower, SPOKEN[item])]).toEqual([item, EQUIPMENT_PRESETS[preset].includes(item)]);
    }
  };

  test('the HOME BASIC description names exactly the items of the preset', () => {
    expect(Object.keys(SPOKEN).sort()).toEqual([...EQUIPMENT_ITEMS].sort());
    expect(EQUIPMENT_PRESETS.home_basic.length).toBeGreaterThan(0);
    render(<OnboardingScreen />);
    for (let i = 0; i < 5; i += 1) next();
    expectNamesExactly(screen.getByLabelText(/^HOME BASIC\. /).props.accessibilityLabel, 'home_basic');
  });

  // Walk 1 (W1-2, W1-6): the glossary "i" text for HOME BASIC left out the
  // pull-up bar, and MINIMAL said "no equipment" while it selects bands and mats.
  test.each([['HOME BASIC', 'home_basic'], ['MINIMAL', 'minimal']])(
    '%s: the onboarding description and the glossary entry name exactly the preset',
    (label, preset) => {
      render(<OnboardingScreen />);
      for (let i = 0; i < 5; i += 1) next();
      expectNamesExactly(screen.getByLabelText(new RegExp(`^${label}\\. `)).props.accessibilityLabel, preset);
      const entry = GLOSSARY.find((term) => term.id === label);
      expect(entry).toBeDefined();
      expectNamesExactly(entry.definition, preset);
      expect(entry.definition.toLowerCase()).not.toContain('no equipment');
    },
  );
});

// Android walk 2026-11-03, W6-7: the progress dots gave a screen reader no
// "step N of M" (the label was set, but the view was not accessible).
test('the onboarding progress dots announce the step', () => {
  render(<OnboardingScreen />);
  const dots = screen.getByTestId('onboarding-progress');
  expect(dots.props.accessible).toBe(true);
  expect(dots.props.accessibilityLabel).toMatch(/^Step 1 of \d+$/);
  next();
  expect(screen.getByTestId('onboarding-progress').props.accessibilityLabel).toMatch(/^Step 2 of \d+$/);
});
