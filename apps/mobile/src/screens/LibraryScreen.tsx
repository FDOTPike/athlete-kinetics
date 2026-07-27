/**
 * LibraryScreen — WO-UI-4 (§1k movement browser, §1l detail card).
 *
 * Pattern groups with horizontal/vertical subgroups, tier/equipment filters,
 * detailed movement card with coaching cues, instructions, video link-out,
 * and a vertical progression ladder with a chalk spine on the active rung.
 *
 * Law 1: Zero hex literals in screen files — use theme tokens.
 * Law 2: Active ladder rung = chalk spine (theme.color.chalk). Selected chips = inverted white fill.
 * Law 3: Zero red/amber/green anywhere.
 * Law 4: Touch targets >= 56pt.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../theme/theme';
import { localToday, useStore, type Movement } from '../state/useStore';
import { useSubViewBack } from '../navigation/navigation';
import { Chip } from '../components/ui/Chip';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SecondaryButton } from '../components/ui/SecondaryButton';
import { Disclosure } from '../components/ui/Disclosure';

const FILTER_TYPES = ['All', 'Barbell', 'Dumbbell', 'Bodyweight', 'Beginner', 'Compound'] as const;
type FilterType = (typeof FILTER_TYPES)[number];

const PATTERN_LABELS: Record<string, string> = {
  push_h: 'Horizontal Press',
  pull_h: 'Horizontal Pull',
  push_v: 'Vertical Press',
  pull_v: 'Vertical Pull',
  squat: 'Squat Pattern',
  hinge: 'Hinge Pattern',
  lunge: 'Lunge / Single Leg',
  carry: 'Carry & Conditioning',
  isolation: 'Isolation & Arms',
  core: 'Core & Trunk Stability',
};

function humanPattern(patternKey: string): string {
  if (PATTERN_LABELS[patternKey] !== undefined) {
    return PATTERN_LABELS[patternKey];
  }
  return patternKey.replace(/_/g, ' ').toUpperCase();
}

interface MovementRowProps {
  item: Movement;
  onSelect: (id: number) => void;
}

const MovementRow = React.memo(function MovementRow({ item, onSelect }: MovementRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={() => onSelect(item.movement_id)}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
      style={({ pressed }) => [
        styles.movementRow,
        pressed && styles.movementRowPressed,
      ]}
    >
      <View style={styles.movementInfo}>
        <Text style={styles.movementName}>{item.name}</Text>
        <Text style={styles.movementMeta}>
          {item.baseName} · {item.beginnerOk ? 'Beginner' : 'Intermediate'}
        </Text>
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  );
});

export interface LibraryScreenProps {
  initialMovementId?: number;
}

export default function LibraryScreen({ initialMovementId }: LibraryScreenProps): React.JSX.Element {
  const movements = useStore((s) => s.movements);
  const resolveGoalRung = useStore((s) => s.resolveGoalRung);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(initialMovementId ?? null);

  const handleSelectMovement = useCallback((id: number) => {
    setSelectedMovementId(id);
  }, []);

  useSubViewBack(selectedMovementId !== null, () => setSelectedMovementId(null));

  const selectedMovement = useMemo(() => {
    if (selectedMovementId === null) return null;
    return movements.find((m) => m.movement_id === selectedMovementId) ?? null;
  }, [movements, selectedMovementId]);

  // Filtered movements list
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Search query filter
      if (search.trim().length > 0) {
        const q = search.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesBase = m.baseName.toLowerCase().includes(q);
        const matchesPattern = m.pattern.toLowerCase().includes(q);
        const matchesCues = m.cues.toLowerCase().includes(q);
        if (!matchesName && !matchesBase && !matchesPattern && !matchesCues) {
          return false;
        }
      }

      // Filter chips
      if (activeFilter === 'Barbell') {
        return m.name.toLowerCase().includes('barbell') || m.required.includes('barbell');
      }
      if (activeFilter === 'Dumbbell') {
        return m.name.toLowerCase().includes('dumbbell') || m.required.includes('dumbbell');
      }
      if (activeFilter === 'Bodyweight') {
        return m.required.length === 0;
      }
      if (activeFilter === 'Beginner') {
        return m.beginnerOk;
      }
      if (activeFilter === 'Compound') {
        return m.is_compound;
      }

      return true;
    });
  }, [movements, search, activeFilter]);

  // Group by pattern
  const patternGroups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const m of filteredMovements) {
      const groupKey = m.pattern || 'other';
      const list = map.get(groupKey) ?? [];
      list.push(m);
      map.set(groupKey, list);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: humanPattern(key),
      items,
    }));
  }, [filteredMovements]);

  // Progression ladder for selected movement
  const progressionLadder = useMemo(() => {
    if (selectedMovement === null || selectedMovement.progressionGroup === null) return [];
    return movements
      .filter((m) => m.progressionGroup === selectedMovement.progressionGroup)
      .sort((a, b) => (a.progressionRank ?? Number.MAX_SAFE_INTEGER) - (b.progressionRank ?? Number.MAX_SAFE_INTEGER));
  }, [movements, selectedMovement]);
  const rungResolution = useMemo(
    () => selectedMovement !== null && selectedMovement.progressionGroup !== null
      ? resolveGoalRung(selectedMovement.progressionGroup, localToday())
      : null,
    [resolveGoalRung, selectedMovement],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="library-scroll"
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>pikeMethods</Text>
          <Text style={styles.title}>Movement Library</Text>
        </View>

        {selectedMovement !== null ? (
          /* ================= Detail Card View (§1l) ================= */
          <View style={styles.detailContainer}>
            <SecondaryButton
              label="← Back to list"
              onPress={() => setSelectedMovementId(null)}
              accessibilityLabel="Back to movement list"
              style={styles.backButton}
            />

            <View style={styles.detailCard}>
              <View style={styles.detailTitleRow}>
                <Text style={styles.detailName}>{selectedMovement.name}</Text>
                <Text style={styles.detailBase}>{selectedMovement.baseName}</Text>
              </View>

              {/* Attributes Chips */}
              <View style={styles.chipRow}>
                <Chip
                  label={selectedMovement.is_compound ? 'COMPOUND' : 'ISOLATION'}
                  selected={false}
                  onPress={() => {}}
                />
                <Chip
                  label={selectedMovement.beginnerOk ? 'BEGINNER OK' : 'INTERMEDIATE+'}
                  selected={false}
                  onPress={() => {}}
                />
                <Chip
                  label={selectedMovement.loggingMode.toUpperCase()}
                  selected={false}
                  onPress={() => {}}
                />
                {selectedMovement.required.map((req) => (
                  <Chip key={req} label={req.toUpperCase()} selected={false} onPress={() => {}} />
                ))}
              </View>

              {/* Coaching Cues Section (§1l) */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Coaching Cues</Text>
                {selectedMovement.cues.trim().length > 0 ? (
                  <View style={styles.cueBox}>
                    <Text style={styles.cueText}>{selectedMovement.cues}</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Standard technical execution cues apply.</Text>
                )}
              </View>

              {/* Instructions Section */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Execution Instructions</Text>
                {selectedMovement.instructions.trim().length > 0 ? (
                  <Text style={styles.bodyText}>{selectedMovement.instructions}</Text>
                ) : (
                  <Text style={styles.emptyText}>
                    Curated reference content. No special instructions recorded.
                  </Text>
                )}
              </View>

              {/* Video Link-Out Affordance (§1l) */}
              {selectedMovement.videoUrl.trim().length > 0 && (
                <SecondaryButton
                  label="Watch movement demonstration ↗"
                  onPress={() => {
                    void Linking.openURL(selectedMovement.videoUrl).catch(() => {});
                  }}
                  accessibilityLabel="Watch movement demonstration video"
                />
              )}

              {/* Vertical Progression Ladder (§1l) */}
              {progressionLadder.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>Progression Ladder</Text>
                <View style={styles.ladderContainer}>
                  {progressionLadder.map((ladderItem, index) => {
                    const isCurrent = ladderItem.name === rungResolution?.active.movementName;
                    return (
                      <Pressable
                        key={ladderItem.movement_id}
                        onPress={() => setSelectedMovementId(ladderItem.movement_id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCurrent }}
                        accessibilityLabel={`Select ${ladderItem.name} from progression ladder`}
                        style={[
                          styles.ladderRow,
                          isCurrent && styles.ladderRowActive,
                        ]}
                      >
                        <View style={styles.ladderContent}>
                          <Text style={[styles.ladderItemName, isCurrent && styles.ladderItemNameActive]}>
                            {ladderItem.name}
                          </Text>
                          <Text style={styles.ladderItemSub}>
                            {`Rung ${index + 1} of ${progressionLadder.length}`}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* ================= Browser View (§1k) ================= */
          <>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search 120+ movements..."
                placeholderTextColor={theme.color.textLow}
                style={styles.searchInput}
                accessibilityLabel="Search movements"
              />
            </View>

            {/* Tier & Equipment Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.filterScroll}
            >
              {FILTER_TYPES.map((filter) => {
                const isSelected = activeFilter === filter;
                return (
                  <Chip
                    key={filter}
                    label={filter}
                    selected={isSelected}
                    onPress={() => setActiveFilter(filter)}
                    accessibilityLabel={`Filter by ${filter}`}
                    style={styles.filterChip}
                  />
                );
              })}
            </ScrollView>

            {/* Pattern Groups */}
            {patternGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No matching movements</Text>
                <Text style={styles.emptyText}>
                  Try clearing your search query or choosing a different equipment filter.
                </Text>
                <PrimaryButton
                  label="Clear search"
                  onPress={() => {
                    setSearch('');
                    setActiveFilter('All');
                  }}
                  accessibilityLabel="Clear search and filters"
                />
              </View>
            ) : (
              patternGroups.map((group) => (
                <Disclosure
                  key={group.key}
                  label={group.label}
                  hint={`${group.items.length} movement${group.items.length === 1 ? '' : 's'}`}
                  defaultOpen={true}
                >
                  <View style={styles.movementList}>
                    {group.items.map((item) => (
                      <MovementRow
                        key={item.movement_id}
                        item={item}
                        onSelect={handleSelectMovement}
                      />
                    ))}
                  </View>
                </Disclosure>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.ink0,
  },
  scrollContent: {
    padding: theme.space[4],
    gap: theme.space[4],
    paddingBottom: theme.space[6], // 32 — matches other screens' tab-bar clearance
  },
  header: {
    marginBottom: theme.space[2],
  },
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  title: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  searchBox: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    paddingHorizontal: theme.space[3],
    height: theme.touch.min,
    justifyContent: 'center',
  },
  searchInput: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    padding: 0,
  },
  filterScroll: {
    gap: theme.space[2],
    paddingVertical: theme.space[1],
  },
  filterChip: {
    marginRight: theme.space[2],
  },
  movementList: {
    gap: theme.space[2],
  },
  movementRow: {
    minHeight: theme.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  movementRowPressed: {
    backgroundColor: theme.color.ink0,
  },
  movementInfo: {
    flex: 1,
    gap: theme.space[1],
  },
  movementName: {
    ...theme.font.body,
    fontWeight: '700',
    color: theme.color.textHi,
  },
  movementMeta: {
    ...theme.font.label,
    color: theme.color.textMid,
  },
  chevron: {
    ...theme.font.body,
    color: theme.color.textLow,
    marginLeft: theme.space[2],
  },
  emptyContainer: {
    padding: theme.space[6],
    alignItems: 'center',
    gap: theme.space[3],
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  emptyTitle: {
    ...theme.font.cue,
    color: theme.color.textHi,
  },
  emptyText: {
    ...theme.font.body,
    color: theme.color.textMid,
    textAlign: 'center',
  },
  bodyText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  detailContainer: {
    gap: theme.space[4],
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  detailCard: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space[4],
    gap: theme.space[4],
  },
  detailTitleRow: {
    gap: theme.space[1],
  },
  detailName: {
    ...theme.font.title,
    color: theme.color.textHi,
  },
  detailBase: {
    ...theme.font.eyebrow,
    color: theme.color.textMid,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  sectionBlock: {
    gap: theme.space[2],
  },
  sectionTitle: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
  },
  cueBox: {
    backgroundColor: theme.color.ink0,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space[3],
  },
  cueText: {
    ...theme.font.cue,
    color: theme.color.textHi,
  },
  ladderContainer: {
    gap: theme.space[2],
  },
  ladderRow: {
    minHeight: theme.touch.min,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    backgroundColor: theme.color.ink0,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    justifyContent: 'center',
  },
  ladderRowActive: {
    borderLeftWidth: 4,
    borderLeftColor: theme.color.chalk,
    backgroundColor: theme.color.ink1,
  },
  ladderContent: {
    gap: theme.space[1],
  },
  ladderItemName: {
    ...theme.font.body,
    color: theme.color.textMid,
  },
  ladderItemNameActive: {
    color: theme.color.textHi,
    fontWeight: '700',
  },
  ladderItemSub: {
    ...theme.font.label,
    color: theme.color.textLow,
  },
});
