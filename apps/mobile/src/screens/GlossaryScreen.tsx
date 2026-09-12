/**
 * GlossaryScreen.tsx — Offline searchable reference for S&C terminology.
 *
 * Single source of truth is data/glossary.ts.
 * Supports case-insensitive searching across term, aliases, category, and definition.
 * Sub-view reachable from Athlete/Profile with zero root tab pollution.
 *
 * Law 1: Zero hex literals in screen files — use theme tokens.
 * Law 2: Selected chips = inverted white fill (textHi fill, ink0 text).
 * Law 3: Touch targets >= 56pt.
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  GLOSSARY_ENTRIES,
  searchGlossary,
  type GlossaryCategory,
  type GlossaryEntry,
} from '../data/glossary';
import { theme } from '../theme/theme';
import { Chip, QuietAction } from '../components/ui';
import KeyboardAwareScrollView, { KEYBOARD_TAP_BEHAVIOR } from '../components/KeyboardAwareScrollView';

export interface GlossaryScreenProps {
  readonly onClose?: () => void;
}

type FilterCategory = 'all' | GlossaryCategory;

const CATEGORY_CHIPS: readonly { readonly id: FilterCategory; readonly label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'effort', label: 'EFFORT' },
  { id: 'loading', label: 'LOADING' },
  { id: 'structure', label: 'STRUCTURE' },
  { id: 'metric', label: 'METRICS' },
  { id: 'goal', label: 'GOALS' },
  { id: 'role', label: 'ROLES' },
  { id: 'movement', label: 'PATTERNS' },
];

export default function GlossaryScreen({ onClose }: GlossaryScreenProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const searchResults = useMemo(() => {
    return searchGlossary(searchQuery);
  }, [searchQuery]);

  const displayedEntries = useMemo(() => {
    if (activeCategory === 'all') {
      return searchResults;
    }
    return searchResults.filter((entry) => entry.category === activeCategory);
  }, [searchResults, activeCategory]);

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="glossary-screen"
    >
      {onClose !== undefined && (
        <QuietAction
          label="← BACK TO ATHLETE"
          onPress={onClose}
          accessibilityLabel="Back to Athlete Profile"
        />
      )}

      <Text style={styles.eyebrow}>LEARNING & REFERENCE</Text>
      <Text style={styles.heading}>GLOSSARY</Text>
      <Text style={styles.subheading}>
        Offline reference for training concepts, loading methods, effort scales, and movement patterns.
      </Text>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search terminology, aliases, or definitions..."
          placeholderTextColor={theme.color.textLow}
          accessibilityLabel="Search glossary"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Category filter chips */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
          keyboardShouldPersistTaps={KEYBOARD_TAP_BEHAVIOR}
        >
          {CATEGORY_CHIPS.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={activeCategory === chip.id}
              onPress={() => setActiveCategory(chip.id)}
              accessibilityLabel={`Filter category: ${chip.label}`}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results Header / Count */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {displayedEntries.length} {displayedEntries.length === 1 ? 'TERM' : 'TERMS'}
        </Text>
      </View>

      {/* Entries List or Empty State */}
      {displayedEntries.length === 0 ? (
        <View style={styles.emptyContainer} testID="glossary-empty-state">
          <Text style={styles.emptyTitle}>No matching terms found</Text>
          <Text style={styles.emptyDetail}>
            No entries match &ldquo;{searchQuery}&rdquo; in {activeCategory === 'all' ? 'the glossary' : activeCategory}. Try a different search query or select another category.
          </Text>
        </View>
      ) : (
        <View style={styles.entriesList}>
          {displayedEntries.map((entry) => (
            <View key={entry.id} style={styles.card} testID={`glossary-card-${entry.id}`}>
              <View style={styles.cardHeader}>
                <Text style={styles.termTitle}>{entry.term}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{entry.category.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.definitionText}>{entry.definition}</Text>
              {entry.aliases && entry.aliases.length > 0 && (
                <Text style={styles.aliasesText}>
                  Aliases: {entry.aliases.join(', ')}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  content: {
    paddingHorizontal: theme.space[4], // 16
    paddingTop: theme.space[4],
    paddingBottom: theme.space[6], // 32
  },
  eyebrow: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    marginTop: theme.space[2],
  },
  heading: {
    ...theme.font.title,
    color: theme.color.textHi,
    marginTop: theme.space[1],
  },
  subheading: {
    ...theme.font.body,
    color: theme.color.textMid,
    marginTop: theme.space[1],
    marginBottom: theme.space[3],
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  searchInput: {
    flex: 1,
    minHeight: theme.touch.min,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.space[3],
    color: theme.color.textHi,
    ...theme.font.body,
  },
  clearButton: {
    width: theme.touch.min,
    height: theme.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.space[1],
  },
  clearButtonText: {
    ...theme.font.body,
    color: theme.color.textMid,
    fontWeight: '700',
  },
  chipRow: {
    marginBottom: theme.space[3],
  },
  chipScroll: {
    gap: theme.space[2],
  },
  metaRow: {
    marginBottom: theme.space[2],
  },
  metaText: {
    ...theme.font.label,
    color: theme.color.textLow,
  },
  entriesList: {
    gap: theme.space[3],
  },
  card: {
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    padding: theme.space[3],
    gap: theme.space[2],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space[2],
  },
  termTitle: {
    ...theme.font.cue,
    color: theme.color.textHi,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.chip,
    paddingHorizontal: theme.space[2],
    paddingVertical: 2,
    backgroundColor: theme.color.ink0,
  },
  badgeText: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    fontSize: 9,
    lineHeight: 12,
  },
  definitionText: {
    ...theme.font.body,
    color: theme.color.textMid,
    lineHeight: 22,
  },
  aliasesText: {
    ...theme.font.label,
    color: theme.color.textLow,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingVertical: theme.space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
  },
  emptyTitle: {
    ...theme.font.cue,
    color: theme.color.textMid,
    textAlign: 'center',
  },
  emptyDetail: {
    ...theme.font.body,
    color: theme.color.textLow,
    textAlign: 'center',
    maxWidth: 320,
  },
});
