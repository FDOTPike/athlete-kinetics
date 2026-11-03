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
// Review (PR 115): the scan reads JSX through the TypeScript parser, not a
// regex, so a label written over several lines is still read, `wrap={true}`
// counts as wrapping, and the word "wrap" inside another prop does not. A file
// that does not parse, or a Chip whose label the scan cannot read, is a
// failure, not a skip.
const SENTENCE_SOURCES = ['—', 'SPORT_OUTCOME_LABEL', 'SPORT_EXPERIENCE_LABEL', 'I have trained', 'movement.name', 'GOAL_METRIC_INFO'];

const scanChips = (fileName, text) => {
  const ts = require('typescript');
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length > 0) return { unreadable: [`${fileName}: does not parse`], chips: [] };
  const chips = [];
  const unreadable = [];
  const visit = (node) => {
    const tag = ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? node : null;
    if (tag !== null && tag.tagName.getText(file) === 'Chip') {
      const line = file.getLineAndCharacterOfPosition(tag.getStart(file)).line + 1;
      const attrs = tag.attributes.properties;
      if (attrs.some((a) => ts.isJsxSpreadAttribute(a))) unreadable.push(`${fileName}:${line} props spread into a Chip`);
      const prop = (name) => attrs.find((a) => ts.isJsxAttribute(a) && a.name.getText(file) === name);
      const label = prop('label');
      if (label === undefined || label.initializer === undefined) {
        unreadable.push(`${fileName}:${line} Chip label not found`);
      } else {
        const wrapAttr = prop('wrap');
        // `wrap` alone or `wrap={true}` wraps; `wrap={false}` or anything else does not.
        const wraps = wrapAttr !== undefined && (wrapAttr.initializer === undefined
          || (ts.isJsxExpression(wrapAttr.initializer) && wrapAttr.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword));
        chips.push({ where: `${fileName}:${line}`, label: label.initializer.getText(file).replace(/\s+/g, ' '), wraps });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { unreadable, chips };
};

const chipsNeedingWrap = (fileName, text) => {
  const { unreadable, chips } = scanChips(fileName, text);
  const sentences = chips.filter((c) => SENTENCE_SOURCES.some((source) => c.label.includes(source)));
  return { unreadable, checked: sentences.length, missing: sentences.filter((c) => !c.wraps).map((c) => `${c.where} ${c.label}`) };
};

test('the scan reads multi-line labels, wrap={true}, and refuses what it cannot read', () => {
  const probe = [
    'const a = <Chip',
    '  label={`LONG — ${x}`}',
    '  selected onPress={f} />;',
    'const b = <Chip label="ONE — two" wrap={true} selected onPress={f} />;',
    'const c = <Chip label="THREE — four" accessibilityHint="wrap" selected onPress={f} />;',
    'const d = <Chip label="FIVE — six" wrap={false} selected onPress={f} />;',
    'const e = <Chip label="SHORT" selected onPress={f} />;',
  ].join('\n');
  const result = chipsNeedingWrap('probe.tsx', probe);
  expect(result.unreadable).toEqual([]);
  expect(result.checked).toBe(4);
  expect(result.missing.map((m) => m.split(' ')[0])).toEqual(['probe.tsx:1', 'probe.tsx:5', 'probe.tsx:6']);
  expect(chipsNeedingWrap('bad.tsx', 'const a = <Chip {...props} />;').unreadable).toEqual(['bad.tsx:1 props spread into a Chip', 'bad.tsx:1 Chip label not found']);
  expect(chipsNeedingWrap('broken.tsx', 'const a = <Chip label="x" ;').unreadable).toEqual(['broken.tsx: does not parse']);
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
  const unreadable = [];
  const missing = [];
  let checked = 0;
  for (const file of files) {
    const result = chipsNeedingWrap(path.relative(root, file), fs.readFileSync(file, 'utf8'));
    unreadable.push(...result.unreadable);
    missing.push(...result.missing);
    checked += result.checked;
  }
  expect(unreadable).toEqual([]);
  expect(checked).toBeGreaterThanOrEqual(10);
  expect(missing).toEqual([]);
});
