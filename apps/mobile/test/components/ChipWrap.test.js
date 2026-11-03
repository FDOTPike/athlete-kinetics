// Android walk 2026-11-03 (ux-5): onboarding option chips cut their own
// sentences short at the default font size ("…No extra emphasis. Train ev…",
// "…a number and a date…"), because every Chip was limited to one line.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../src/components/ui/Chip';

const labelOf = (testID) => screen.getByTestId(testID).findByType(Text);

test('a Chip stays on one line by default', () => {
  render(<Chip testID="c" label="SHORT" selected={false} onPress={() => {}} />);
  expect(labelOf('c').props.numberOfLines).toBe(1);
});

test('a Chip asked to wrap shows its whole label, centred', () => {
  render(<Chip testID="c" wrap label="BALANCED WHOLE BODY — No extra emphasis. Train everything evenly." selected={false} onPress={() => {}} />);
  const label = labelOf('c');
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.children).toBe('BALANCED WHOLE BODY — No extra emphasis. Train everything evenly.');
  expect(StyleSheet.flatten(label.props.style).textAlign).toBe('center');
});

// Walk W6-1: the first fix gave `wrap` to some chips only. Loads ("COACH
// SUGGESTS — Targets come fr..."), sports ("FIELD HOCKEY — Played on g."),
// outcomes, "I have trained … before" were still cut at large text. Every
// chip whose label is a sentence must wrap: any label with " — ", and the
// label sources below, which hold sentence-length or data-length names.
test('every Chip with a sentence-length label is asked to wrap', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '../../src');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx')) files.push(full);
    }
  };
  walk(root);
  const SENTENCE_SOURCES = ['—', 'SPORT_OUTCOME_LABEL', 'SPORT_EXPERIENCE_LABEL', 'I have trained', 'movement.name', 'GOAL_METRIC_INFO'];
  const missing = [];
  let checked = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/<Chip\b([\s\S]*?)\/>/g)) {
      const block = match[1];
      const label = /label=(\{[^\n]*\}|"[^"]*")/.exec(block)?.[1] ?? '';
      if (!SENTENCE_SOURCES.some((source) => label.includes(source))) continue;
      checked += 1;
      if (!/(^|\s)wrap(\s|$)/.test(block)) {
        const line = text.slice(0, match.index).split('\n').length;
        missing.push(`${path.relative(root, file)}:${line} ${label}`);
      }
    }
  }
  expect(checked).toBeGreaterThanOrEqual(10);
  expect(missing).toEqual([]);
});
