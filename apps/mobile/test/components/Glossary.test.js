/**
 * Glossary.test.js — Red tests for Learning Glossary & InfoTip hardening (§7.2 Items 12–16).
 *
 * Demonstrates pre-fix contract violations before product edits:
 * - Item 12: Every currently rendered InfoTip resolves to a non-empty canonical entry;
 *            unknown tip keys fail closed in tests and never render an empty card.
 * - Item 13: Tip beside Undulating in RoutineTemplateBuilder opens explanation titled
 *            Undulating, not WAVE.
 * - Item 14: The existing Session RIR information sign opens a real, non-empty definition.
 * - Item 16: Glossary search matches term and alias case-insensitively (rir, reps in reserve,
 *            UnDuLaTiNg), and no-match query displays an honest empty state.
 * - §2.3: Canonical glossary inventory contains all required beginner vocabulary.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import InfoTip, { GLOSSARY } from '../../src/components/InfoTip';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: {
    bg: '#000',
    surface: '#15151A',
    line: '#26262E',
    text: '#F4F4F6',
    dim: '#86868F',
    green: '#2EE6A8',
    amber: '#FFB454',
    red: '#FF5D5D',
  },
  useStore: (selector) => selector(mockState),
  formatTeachingOnlyReason: (verdict) =>
    verdict === undefined
      ? 'Access cannot be verified right now.'
      : verdict.reasons?.includes('capability')
        ? 'Capability evidence is required.'
        : 'Teaching only.',
}));

let GlossaryScreen = null;
try {
  GlossaryScreen = require('../../src/screens/GlossaryScreen').default;
} catch {
  // Expected missing in W1 before W3 implementation
}

let glossaryModule = null;
try {
  glossaryModule = require('../../src/data/glossary');
} catch {
  // Expected missing in W1 before W3 implementation
}

describe('Learning Glossary & InfoTip Contracts (WO §7.2 Items 12–16)', () => {
  beforeEach(() => {
    mockState = {
      profile: {
        objective: 'strength',
        training_age: 'intermediate',
        session_duration_cap_min: 60,
        base_rpe_cap: 9,
      },
      movements: [],
      niggles: [],
      saveRoutineTemplate: jest.fn(),
      getMovementAvailabilityVerdicts: () => [],
      getRoutineRoleEligibleMovementIds: () => ({
        major: [],
        supplementary: [],
        accessory: [],
        conditional: [],
      }),
      getRoutinePlanningContract: () => ({
        liftFamilies: [],
        assistance: [],
      }),
      movementAvailabilityRevision: 0,
      activePriorExperienceMovementIds: [],
      confirmMovementPriorExperience: jest.fn(() => true),
      revokeMovementPriorExperience: jest.fn(() => true),
    };
  });

  // --- Item 14: Session RIR Information Sign ---------------------------------
  test('[Item 14] Session RIR information sign opens a real, non-empty definition', () => {
    render(<InfoTip term="RIR" />);
    const tipButton = screen.getByRole('button', { name: 'What does RIR mean?' });
    fireEvent.press(tipButton);

    // Modal card opens with title RIR
    expect(screen.getByText('RIR')).toBeOnTheScreen();

    // Must show a non-empty explanation of reps in reserve / clean reps
    // In current code: GLOSSARY['RIR'] is undefined, so the card body is empty ""
    const definitionText = screen.getByText(/reps in reserve|clean reps/i);
    expect(definitionText).toBeOnTheScreen();
  });

  // --- Item 12: InfoTip Fail-Closed & Canonical Resolution -------------------
  test('[Item 12] Unknown tip keys must fail closed in tests and never render an empty card', () => {
    // Contract: Unknown/dangling tip keys in InfoTip must fail during dev/tests
    // (throw new Error in __DEV__) and never render an empty card.
    // In current code: InfoTip does not throw, rendering a card with empty body.
    expect(() => {
      render(<InfoTip term="UNKNOWN_DANGLING_KEY" />);
    }).toThrow(/unknown|invalid|glossary/i);
  });

  test('[Item 12] Every currently rendered InfoTip resolves to a non-empty canonical entry', () => {
    // Inventory of all terms currently passed to InfoTip across the mobile app
    const renderedTerms = [
      '1RM', 'ACWR', 'APRE', 'ATP-PC', 'BUILD', 'CARRY', 'CONDITIONAL',
      'DELOAD', 'GPP', 'HINGE', 'HORIZONTAL PUSH', 'HRV', 'INTENSIFICATION',
      'LINEAR', 'LOAD', 'LUNGE', 'MAJOR', 'MICROCYCLE', 'OVERHEAD PRESS',
      'REALISE', 'ROW', 'RPE', 'RPE MAX', 'RPE START', 'SETS', 'SQUAT',
      'STEP', 'SUPPLEMENTARY', 'TONNAGE', 'VERTICAL PULL', 'UNDULATING', 'RIR',
    ];

    const missingOrEmpty = renderedTerms.filter((term) => {
      const def = GLOSSARY[term];
      return typeof def !== 'string' || def.trim().length === 0;
    });

    // In current code: 'UNDULATING' and 'RIR' are missing from GLOSSARY
    expect(missingOrEmpty).toEqual([]);
  });

  // --- Item 13: RoutineTemplateBuilder Undulating Tip -----------------------
  test('[Item 13] Tip beside Undulating in RoutineTemplateBuilder opens an explanation titled Undulating, not WAVE', () => {
    render(<RoutineTemplateBuilder />);

    // The loading method selector displays visible label "Undulating"
    expect(screen.getByText('Undulating')).toBeOnTheScreen();

    // The tip button beside "Undulating" must have accessibilityLabel matching visible label
    // In current code: accessibilityLabel is "What does WAVE mean?" because WAVE is passed to InfoTip
    const undulatingTip = screen.getByRole('button', { name: 'What does Undulating mean?' });
    expect(undulatingTip).toBeOnTheScreen();

    // Tapping the tip opens an explanation titled "Undulating", NOT "WAVE"
    fireEvent.press(undulatingTip);
    expect(screen.getAllByText('Undulating', { exact: true })).toHaveLength(2);
    expect(screen.queryByText('WAVE')).toBeNull();
  });

  // --- Item 16: Offline Glossary Search & Empty State -----------------------
  test('[Item 16] Glossary search matches term and alias case-insensitively and displays honest empty state', () => {
    // Contract requires offline GlossaryScreen component with case-insensitive search
    // In current code: GlossaryScreen does not exist yet in W1
    expect(GlossaryScreen).not.toBeNull();

    const { getByPlaceholderText, getByText, queryByText } = render(<GlossaryScreen />);
    expect(screen.getByTestId('glossary-screen').props.keyboardShouldPersistTaps).toBe('handled');
    const searchInput = getByPlaceholderText(/search/i);

    // 1. Case-insensitive search by term: "rir" -> matches "RIR"
    fireEvent.changeText(searchInput, 'rir');
    expect(getByText('RIR')).toBeOnTheScreen();

    // 2. Case-insensitive search by alias: "reps in reserve" -> matches "RIR"
    fireEvent.changeText(searchInput, 'reps in reserve');
    expect(getByText('RIR')).toBeOnTheScreen();

    // 3. Mixed-case search: "UnDuLaTiNg" -> matches "Undulating"
    fireEvent.changeText(searchInput, 'UnDuLaTiNg');
    expect(getByText(/Undulating/i)).toBeOnTheScreen();

    // 4. No-match query displays honest empty state
    fireEvent.changeText(searchInput, 'zzz_no_match_query');
    expect(getByText(/no matching terms|no terms found/i)).toBeOnTheScreen();
    expect(queryByText('RIR')).toBeNull();
  });

  // --- §2.3: Canonical Vocabulary Inventory ---------------------------------
  test('[§2.3] Canonical glossary module contains all required beginner vocabulary with aliases', () => {
    // Contract requires apps/mobile/src/data/glossary.ts defining typed canonical entries
    // In current code: data/glossary.ts does not exist yet in W1
    expect(glossaryModule).not.toBeNull();

    const requiredTerms = [
      'RPE', 'RIR', 'TARGET RPE', 'ACTUAL RPE', 'RPE CAP', 'RPE START', 'RPE MAX',
      '1RM', 'LOAD', 'SETS', 'REPS', 'TONNAGE', 'ACWR', 'ATP-PC', 'READINESS', 'HRV',
      'LINEAR', 'UNDULATING', 'STEP', 'APRE', 'DELOAD',
      'BLOCK', 'MICROCYCLE', 'MACROCYCLE', 'BUILD', 'INTENSIFICATION', 'REALISE',
      'STRENGTH', 'HYPERTROPHY', 'POWER', 'ENDURANCE', 'GPP', 'HYBRID', 'RETURN TO TRAINING',
      'MAJOR', 'SUPPLEMENTARY', 'ACCESSORY', 'CONDITIONAL',
      'SQUAT', 'LUNGE', 'HINGE', 'HORIZONTAL PUSH', 'ROW', 'OVERHEAD PRESS', 'VERTICAL PULL', 'CARRY',
    ];

    const entries = glossaryModule?.GLOSSARY_ENTRIES ?? glossaryModule?.glossary ?? [];
    const entryIds = entries.map((e) => e.id?.toUpperCase());
    for (const term of requiredTerms) {
      expect(entryIds).toContain(term);
    }
  });

  // --- Beginner Glossary Semantics (Post-Audit Remediation) -------------------
  describe('Beginner Glossary Semantics', () => {
    const getDef = (id) => {
      const entries = glossaryModule?.GLOSSARY_ENTRIES ?? [];
      const entry = entries.find((e) => e.id?.toUpperCase() === id.toUpperCase());
      return entry?.definition ?? '';
    };

    test('RPE explains perceived-effort rating without conflating with a cap or ceiling', () => {
      const def = getDef('RPE');
      expect(def).toMatch(/perceived[- ]effort|perceived physical effort|how hard/i);
      expect(def).not.toMatch(/\bcap\b|\bceiling\b/i);
    });

    test('TARGET RPE describes what the program asks the athlete to aim for without ceiling conflation', () => {
      const def = getDef('TARGET RPE');
      expect(def).toMatch(/aim for/i);
      expect(def).not.toMatch(/\bceiling\b|\bcap\b/i);
    });

    test('RPE CAP remains maximum permitted ceiling and clearly distinguishes from target RPE', () => {
      const def = getDef('RPE CAP');
      expect(def).toMatch(/ceiling|maximum permitted|upper boundary/i);
      expect(def).toMatch(/target rpe/i);
      expect(def).toMatch(/aim for/i);
    });

    test('LOAD defines exercise resistance first and identifies load multiplier as a separate adjustment', () => {
      const def = getDef('LOAD');
      const resistanceIdx = def.search(/weight|resistance/i);
      const multiplierIdx = def.search(/multiplier/i);
      expect(resistanceIdx).toBeGreaterThanOrEqual(0);
      expect(multiplierIdx).toBeGreaterThan(resistanceIdx);
      expect(def).toMatch(/separate|adjustment/i);
    });

    test('SETS defines group of repetitions followed by rest first and makes set-count adjustment secondary', () => {
      const def = getDef('SETS');
      const repsIdx = def.search(/group of (?:consecutive )?repetitions|group of reps/i);
      const restIdx = def.search(/rest/i);
      expect(repsIdx).toBeGreaterThanOrEqual(0);
      expect(restIdx).toBeGreaterThan(repsIdx);
      const adjustmentIdx = def.search(/adjustment|adjust/i);
      expect(adjustmentIdx).toBeGreaterThan(repsIdx);
    });

    test('LINEAR removes universal "best" language and describes working-week progression and deload', () => {
      const def = getDef('LINEAR');
      expect(def).not.toMatch(/\bbest\b|\boptimal\b|\bsuperior\b|\bideal\b/i);
      expect(def).toMatch(/working week|week to week|three working weeks/i);
      expect(def).toMatch(/deload/i);
    });
  });
});
