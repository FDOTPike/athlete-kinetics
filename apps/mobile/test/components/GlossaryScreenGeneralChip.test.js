import React from 'react';
import { render, screen } from '@testing-library/react-native';
import GlossaryScreen from '../../src/screens/GlossaryScreen';
import { GLOSSARY_ENTRIES } from '../../src/data/glossary';

test('plan-6: GlossaryScreen provides a filter chip for every GlossaryCategory used by GLOSSARY_ENTRIES including general', () => {
  const generalEntries = GLOSSARY_ENTRIES.filter((entry) => entry.category === 'general');
  expect(generalEntries.length).toBeGreaterThan(0);

  render(<GlossaryScreen onClose={() => {}} />);

  // Entries with category: 'general' display a "GENERAL" badge on their cards,
  // so the category chip bar should expose a "GENERAL" filter chip alongside the other categories.
  expect(screen.getByRole('button', { name: 'Filter category: GENERAL' })).toBeOnTheScreen();
});
