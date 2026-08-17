import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
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
  formatTeachingOnlyReason: (verdict) => verdict === undefined
    ? 'Access cannot be verified right now.'
    : verdict.reasons.includes('capability') ? 'Capability evidence is required.' : 'Teaching only.',
}));

const sampleMovements = [
  {
    movement_id: 1,
    name: 'Competition Barbell Squat',
    baseName: 'Squat',
    pattern: 'squat',
    instructions: 'Descend with control until hips pass below knees.',
    cues: 'Brace core and drive through midfoot.',
    targetMuscles: ['quadriceps', 'glutes'],
    difficulty: 'Advanced',
    is_compound: true,
    required: ['barbell'],
    supportedPrefixes: ['Barbell'],
  },
  {
    movement_id: 2,
    name: 'Undetailed Movement',
    baseName: 'Undetailed',
    pattern: 'squat',
    instructions: '',
    cues: '',
    targetMuscles: [],
    difficulty: 'Beginner',
    is_compound: true,
    required: [],
    supportedPrefixes: [],
  },
];

const available = (movementId) => ({
  movementId,
  state: 'available',
  reasons: [],
  effectiveContext: 'weight_room',
  capabilitySource: 'not_required',
  blockingPrerequisiteMovementIds: [],
  confirmationWouldClear: false,
  separateAttestationRequired: false,
});

describe('LearningLayer (Work Order B)', () => {
  test('EVERY GLOSSARY key has a non-empty definition string', () => {
    const keys = Object.keys(GLOSSARY);
    expect(keys.length).toBeGreaterThanOrEqual(30);
    for (const key of keys) {
      expect(typeof GLOSSARY[key]).toBe('string');
      expect(GLOSSARY[key].trim().length).toBeGreaterThan(0);
    }
  });

  test('every term rendered with an InfoTip in apps/mobile/src has a matching GLOSSARY key', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const termRegex = /<InfoTip\s+term=(?:["']([^"']+)["']|\{["']([^"']+)["']\})/g;
    const foundTerms = new Set();

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(tsx|jsx|ts|js)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          let match;
          while ((match = termRegex.exec(content)) !== null) {
            const term = match[1] || match[2];
            if (term) foundTerms.add(term);
          }
        }
      }
    }

    scanDir(srcDir);
    expect(foundTerms.size).toBeGreaterThan(0);
    for (const term of foundTerms) {
      expect(GLOSSARY[term]).toBeDefined();
      expect(GLOSSARY[term].trim().length).toBeGreaterThan(0);
    }
  });

  test('tapping an InfoTip opens modal with exact GLOSSARY definition and closes on dismiss', () => {
    render(<InfoTip term="DELOAD" />);

    // Initially modal body is not visible
    expect(screen.queryByText(GLOSSARY.DELOAD)).toBeNull();

    // Tap the info icon
    fireEvent.press(screen.getByLabelText('What does DELOAD mean?'));

    // Modal opens showing term title and verbatim body
    expect(screen.getByText('DELOAD')).toBeOnTheScreen();
    expect(screen.getByText(GLOSSARY.DELOAD)).toBeOnTheScreen();
    expect(screen.getByText('tap anywhere to close')).toBeOnTheScreen();

    // Dismiss
    fireEvent.press(screen.getByLabelText('Dismiss explanation'));
    expect(screen.queryByText(GLOSSARY.DELOAD)).toBeNull();
  });

  test('the picker shows cues, instructions, muscles and difficulty for a detailed movement, empty string for undetailed, and allows selection from detail view', () => {
    mockState = {
      profile: {
        training_age: 'advanced',
        objective: 'strength',
        session_duration_cap_min: 60,
        base_rpe_cap: 9.5,
      },
      movements: sampleMovements,
      niggles: [],
      movementAvailabilityRevision: 1,
      activePriorExperienceMovementIds: [],
      getMovementAvailabilityVerdicts: () => [available(1), available(2)],
      getRoutineRoleEligibleMovementIds: () => ({
        major: new Set([1, 2]),
        supplementary: new Set([1, 2]),
        conditional: new Set(),
        accessory: new Set([1, 2]),
      }),
      getRoutinePlanningContract: () => ({
        liftFamilies: [
          { movementId: 1, family: 'squat', stressCoefficient: 1, preferredPurpose: null },
          { movementId: 2, family: 'squat', stressCoefficient: 1, preferredPurpose: null },
        ],
        assistance: [],
      }),
      saveRoutineTemplate: jest.fn(),
      confirmMovementPriorExperience: jest.fn(),
      revokeMovementPriorExperience: jest.fn(),
    };

    const { getByTestId } = render(<RoutineTemplateBuilder />);

    // Open movement picker for slot 1
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));

    // Toggle details for movement 1 (Competition Barbell Squat)
    fireEvent.press(getByTestId('toggle-movement-detail-1'));

    // Section headers and content
    expect(screen.getByText('Coaching cues')).toBeOnTheScreen();
    expect(screen.getByText('Brace core and drive through midfoot.')).toBeOnTheScreen();
    expect(screen.getByText('How to do it')).toBeOnTheScreen();
    expect(screen.getByText('Descend with control until hips pass below knees.')).toBeOnTheScreen();
    expect(screen.getByText('Works')).toBeOnTheScreen();
    expect(screen.getByText('quadriceps, glutes')).toBeOnTheScreen();
    expect(screen.getByText('Difficulty')).toBeOnTheScreen();
    expect(screen.getByText('Advanced')).toBeOnTheScreen();

    // Toggle details for movement 2 (Undetailed Movement)
    fireEvent.press(getByTestId('toggle-movement-detail-2'));
    expect(screen.getByText('No notes for this movement yet.')).toBeOnTheScreen();

    // Selecting from detail view selects the movement
    fireEvent.press(getByTestId('select-from-detail-2'));

    // Picker closes and slot 1 shows Undetailed Movement
    expect(screen.getAllByText('Undetailed Movement').length).toBeGreaterThan(0);
  });
});

