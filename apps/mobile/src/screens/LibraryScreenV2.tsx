import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Chip, PrimaryButton, SecondaryButton } from '../components/ui';
import { useSubViewBack } from '../navigation/navigation';
import {
  formatTeachingOnlyReason,
  localToday,
  useStore,
  type Movement,
  type MovementAvailability,
} from '../state/useStore';
import { theme } from '../theme/theme';

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
  rotation: 'Core & Trunk Stability',
  locomotion: 'Locomotion & Conditioning',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: 'Bodyweight',
  barbell: 'Barbell',
  dumbbells: 'Dumbbells',
  kettlebell: 'Kettlebell',
  bands: 'Bands',
  cable_machine: 'Cable',
  pullup_bar: 'Pull-up bar',
  squat_rack: 'Squat rack',
  bench: 'Bench',
  mats: 'Mats',
  boards: 'Boards',
};

/** movement_scope (049): a training scope that cuts across `pattern`. */
const FULL_BODY_LABEL = 'Full body';

type AvailabilityView = 'available' | 'all';
type KindFilter = 'all' | 'compound' | 'isolation';
type ScopeFilter = 'all' | 'full_body';
type DifficultyFilter = 'all' | Movement['difficulty'];

const humanPattern = (pattern: string): string =>
  PATTERN_LABELS[pattern] ?? pattern.replace(/_/g, ' ').toUpperCase();

const equipmentLabel = (equipment: string): string =>
  EQUIPMENT_LABELS[equipment] ?? equipment.replace(/_/g, ' ');

const movementHasEquipment = (movement: Movement, equipment: string): boolean => {
  if (equipment === 'bodyweight') {
    return movement.supportedPrefixes.includes('Bodyweight');
  }
  return movement.required.includes(equipment);
};

interface MovementRowProps {
  item: Movement;
  availability?: MovementAvailability;
  onSelect: (id: number) => void;
}

const MovementRow = React.memo(function MovementRow({
  item,
  availability,
  onSelect,
}: MovementRowProps): React.JSX.Element {
  const teachingOnly = availability?.state !== 'available';
  return (
    <Pressable
      onPress={() => onSelect(item.movement_id)}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
      style={({ pressed }) => [styles.movementRow, pressed && styles.movementRowPressed]}
    >
      <View style={styles.movementInfo}>
        <Text style={styles.movementName}>{item.name}</Text>
        <Text style={styles.movementMeta}>{`${item.baseName} · ${item.difficulty}`}</Text>
        {item.scope === 'full_body' && (
          <Text
            style={styles.scopeBadge}
            accessibilityLabel={`${item.name} is a full body movement`}
          >
            {FULL_BODY_LABEL.toUpperCase()}
          </Text>
        )}
        {teachingOnly && (
          <Text style={styles.teachingOnlyBadge}>
            {formatTeachingOnlyReason(availability)}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  );
});

export interface LibraryScreenProps {
  initialMovementId?: number;
}

export default function LibraryScreenV2({ initialMovementId }: LibraryScreenProps): React.JSX.Element {
  const movements = useStore((state) => state.movements);
  const profile = useStore((state) => state.profile);
  const trainingAge = profile.training_age;
  const niggles = useStore((state) => state.niggles);
  const resolveGoalRung = useStore((state) => state.resolveGoalRung);
  const getMovementAvailabilityVerdicts = useStore((state) => state.getMovementAvailabilityVerdicts);
  const movementAvailabilityRevision = useStore((state) => state.movementAvailabilityRevision);

  const availabilityMap = useMemo(() => {
    const map = new Map<number, MovementAvailability>();
    for (const verdict of getMovementAvailabilityVerdicts('library')) {
      map.set(verdict.movementId, verdict);
    }
    return map;
  }, [getMovementAvailabilityVerdicts, movementAvailabilityRevision, movements, niggles, profile]);

  const [search, setSearch] = useState('');
  const [availabilityView, setAvailabilityView] = useState<AvailabilityView>(
    trainingAge === 'beginner' ? 'available' : 'all',
  );
  const [patternFilter, setPatternFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(initialMovementId ?? null);

  useEffect(() => {
    setAvailabilityView(trainingAge === 'beginner' ? 'available' : 'all');
  }, [trainingAge]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setPatternFilter(null);
    setEquipmentFilter(null);
    setDifficultyFilter('all');
    setKindFilter('all');
    setScopeFilter('all');
  }, []);

  const handleSelectMovement = useCallback((id: number) => setSelectedMovementId(id), []);
  useSubViewBack(selectedMovementId !== null, () => setSelectedMovementId(null));

  const selectedMovement = useMemo(
    () => selectedMovementId === null
      ? null
      : movements.find((movement) => movement.movement_id === selectedMovementId) ?? null,
    [movements, selectedMovementId],
  );

  const patternOptions = useMemo(
    () => [...new Set(movements.map((movement) => movement.pattern))]
      .sort((a, b) => humanPattern(a).localeCompare(humanPattern(b))),
    [movements],
  );

  const equipmentOptions = useMemo(() => {
    const values = new Set(movements.flatMap((movement) => movement.required));
    if (movements.some((movement) => movement.supportedPrefixes.includes('Bodyweight'))) {
      values.add('bodyweight');
    }
    return [...values].sort((a, b) => equipmentLabel(a).localeCompare(equipmentLabel(b)));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return movements.filter((movement) => {
      const availability = availabilityMap.get(movement.movement_id);
      if (availabilityView === 'available' && availability?.state !== 'available') return false;
      if (patternFilter !== null && movement.pattern !== patternFilter) return false;
      if (equipmentFilter !== null && !movementHasEquipment(movement, equipmentFilter)) return false;
      if (difficultyFilter !== 'all' && movement.difficulty !== difficultyFilter) return false;
      if (kindFilter === 'compound' && !movement.is_compound) return false;
      if (kindFilter === 'isolation' && movement.is_compound) return false;
      if (scopeFilter === 'full_body' && movement.scope !== 'full_body') return false;
      if (query.length === 0) return true;
      return [
        movement.name,
        movement.baseName,
        movement.pattern,
        movement.cues,
        ...movement.targetMuscles,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [
    availabilityMap,
    availabilityView,
    difficultyFilter,
    equipmentFilter,
    kindFilter,
    movements,
    patternFilter,
    scopeFilter,
    search,
  ]);

  const sections = useMemo(() => {
    const grouped = new Map<string, Movement[]>();
    for (const movement of filteredMovements) {
      const list = grouped.get(movement.pattern) ?? [];
      list.push(movement);
      grouped.set(movement.pattern, list);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => humanPattern(a).localeCompare(humanPattern(b)))
      .map(([pattern, data]) => ({ pattern, title: humanPattern(pattern), data }));
  }, [filteredMovements]);

  const progressionLadder = useMemo(() => {
    if (selectedMovement?.progressionGroup === null || selectedMovement === null) return [];
    return movements
      .filter((movement) => movement.progressionGroup === selectedMovement.progressionGroup)
      .sort((a, b) => (a.progressionRank ?? Number.MAX_SAFE_INTEGER)
        - (b.progressionRank ?? Number.MAX_SAFE_INTEGER));
  }, [movements, selectedMovement]);

  const rungResolution = useMemo(
    () => selectedMovement?.progressionGroup
      ? resolveGoalRung(selectedMovement.progressionGroup, localToday())
      : null,
    [resolveGoalRung, selectedMovement],
  );

  if (selectedMovement !== null) {
    const availability = availabilityMap.get(selectedMovement.movement_id);
    const externalFallback = selectedMovement.media?.status === 'external_fallback'
      ? selectedMovement.media.fallbackUrl
      : null;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} testID="library-detail-scroll">
          <View style={styles.header}>
            <Text style={styles.wordmark}>pikeMethods</Text>
            <Text style={styles.title}>Movement Library</Text>
          </View>
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
            {availability?.state !== 'available' && (
              <View style={styles.teachingOnlyBanner}>
                <Text style={styles.teachingOnlyBannerText}>
                  {formatTeachingOnlyReason(availability)}
                </Text>
              </View>
            )}
            <View style={styles.chipRow}>
              <Chip
                label={selectedMovement.is_compound ? 'COMPOUND' : 'ISOLATION'}
                selected={false}
                onPress={() => {}}
              />
              <Chip
                label={`${selectedMovement.difficulty.toUpperCase()}${selectedMovement.beginnerOk && selectedMovement.difficulty !== 'Beginner' ? ' · BEGINNER OK' : ''}`}
                selected={false}
                onPress={() => {}}
              />
              <Chip label={selectedMovement.loggingMode.toUpperCase()} selected={false} onPress={() => {}} />
              {selectedMovement.scope === 'full_body' && (
                <Chip
                  label={FULL_BODY_LABEL.toUpperCase()}
                  selected={false}
                  onPress={() => {}}
                  accessibilityLabel={`${selectedMovement.name} is a full body movement`}
                />
              )}
              {selectedMovement.required.map((requirement) => (
                <Chip
                  key={requirement}
                  label={equipmentLabel(requirement).toUpperCase()}
                  selected={false}
                  onPress={() => {}}
                />
              ))}
            </View>
            {selectedMovement.targetMuscles.length > 0 && (
              <Text style={styles.targetMuscles}>
                {`Targets: ${selectedMovement.targetMuscles.map((muscle) => muscle.replace(/_/g, ' ')).join(', ')}`}
              </Text>
            )}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Coaching Cues</Text>
              <View style={styles.cueBox}>
                <Text style={selectedMovement.cues.trim().length > 0 ? styles.cueText : styles.emptyText}>
                  {selectedMovement.cues.trim().length > 0
                    ? selectedMovement.cues
                    : 'Curated coaching cues are not yet recorded.'}
                </Text>
              </View>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Execution Instructions</Text>
              <Text style={selectedMovement.instructions.trim().length > 0 ? styles.bodyText : styles.emptyText}>
                {selectedMovement.instructions.trim().length > 0
                  ? selectedMovement.instructions
                  : 'Curated execution instructions are not yet recorded.'}
              </Text>
            </View>
            {externalFallback !== null ? (
              <SecondaryButton
                label="Watch movement demonstration ↗"
                onPress={() => { void Linking.openURL(externalFallback).catch(() => {}); }}
                accessibilityLabel="Watch movement demonstration video"
              />
            ) : selectedMovement.media?.status === 'planned' ? (
              <Text style={styles.mediaStatus} accessibilityLabel="Movement demonstration planned">
                Demonstration planned
              </Text>
            ) : null}
            {progressionLadder.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Progression Ladder</Text>
                <View style={styles.ladderContainer}>
                  {progressionLadder.map((movement, index) => {
                    const current = movement.name === rungResolution?.active.movementName;
                    return (
                      <Pressable
                        key={movement.movement_id}
                        onPress={() => setSelectedMovementId(movement.movement_id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: current }}
                        accessibilityLabel={`Select ${movement.name} from progression ladder`}
                        style={[styles.ladderRow, current && styles.ladderRowActive]}
                      >
                        <Text style={[styles.ladderItemName, current && styles.ladderItemNameActive]}>
                          {movement.name}
                        </Text>
                        <Text style={styles.ladderItemSub}>
                          {`Rung ${index + 1} of ${progressionLadder.length}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>pikeMethods</Text>
        <Text style={styles.title}>Movement Library</Text>
        <Text style={styles.countText}>{`${filteredMovements.length} of ${movements.length} movements`}</Text>
      </View>
      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${movements.length} movements...`}
          placeholderTextColor={theme.color.textLow}
          style={styles.searchInput}
          accessibilityLabel="Search movements"
        />
      </View>
      <Text style={styles.filterLabel}>Availability</Text>
      <View style={styles.toggleRow}>
        <Chip
          label="Available"
          selected={availabilityView === 'available'}
          onPress={() => setAvailabilityView('available')}
          accessibilityLabel="Show available movements"
        />
        <Chip
          label="All / Learn"
          selected={availabilityView === 'all'}
          onPress={() => setAvailabilityView('all')}
          accessibilityLabel="Show all movements for learning"
        />
      </View>
      <Text style={styles.filterLabel}>Pattern</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <Chip
          label="All patterns"
          selected={patternFilter === null}
          onPress={() => setPatternFilter(null)}
          accessibilityLabel="Clear pattern filter"
        />
        {patternOptions.map((pattern) => (
          <Chip
            key={pattern}
            label={humanPattern(pattern)}
            selected={patternFilter === pattern}
            onPress={() => setPatternFilter(patternFilter === pattern ? null : pattern)}
            accessibilityLabel={`Filter pattern by ${humanPattern(pattern)}`}
          />
        ))}
      </ScrollView>
      <Text style={styles.filterLabel}>Equipment</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <Chip
          label="All equipment"
          selected={equipmentFilter === null}
          onPress={() => setEquipmentFilter(null)}
          accessibilityLabel="Clear equipment filter"
        />
        {equipmentOptions.map((equipment) => (
          <Chip
            key={equipment}
            label={equipmentLabel(equipment)}
            selected={equipmentFilter === equipment}
            onPress={() => setEquipmentFilter(equipmentFilter === equipment ? null : equipment)}
            accessibilityLabel={`Filter equipment by ${equipmentLabel(equipment)}`}
          />
        ))}
      </ScrollView>
      <Text style={styles.filterLabel}>Difficulty</Text>
      <View style={styles.wrapRow}>
        {(['all', 'Beginner', 'Intermediate', 'Advanced'] as const).map((difficulty) => (
          <Chip
            key={difficulty}
            label={difficulty === 'all' ? 'All tiers' : difficulty}
            selected={difficultyFilter === difficulty}
            onPress={() => setDifficultyFilter(difficulty)}
            accessibilityLabel={difficulty === 'all' ? 'Clear tier filter' : `Filter tier by ${difficulty}`}
          />
        ))}
      </View>
      <Text style={styles.filterLabel}>Movement type</Text>
      <View style={styles.wrapRow}>
        {(['all', 'compound', 'isolation'] as const).map((kind) => (
          <Chip
            key={kind}
            label={kind === 'all' ? 'All types' : kind === 'compound' ? 'Compound' : 'Isolation'}
            selected={kindFilter === kind}
            onPress={() => setKindFilter(kind)}
            accessibilityLabel={kind === 'all' ? 'Clear movement type filter' : `Filter type by ${kind}`}
          />
        ))}
      </View>
      <Text style={styles.filterLabel}>Training scope</Text>
      <View style={styles.wrapRow}>
        {(['all', 'full_body'] as const).map((scope) => (
          <Chip
            key={scope}
            label={scope === 'all' ? 'Any scope' : FULL_BODY_LABEL}
            selected={scopeFilter === scope}
            onPress={() => setScopeFilter(scope)}
            accessibilityLabel={scope === 'all' ? 'Clear training scope filter' : `Filter scope by ${FULL_BODY_LABEL}`}
          />
        ))}
      </View>
      <SecondaryButton label="Clear filters" onPress={clearFilters} accessibilityLabel="Clear search and filters" />
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.movement_id)}
        renderItem={({ item }) => (
          <MovementRow
            item={item}
            availability={availabilityMap.get(item.movement_id)}
            onSelect={handleSelectMovement}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
            <Text style={styles.sectionHeaderCount}>{`${section.data.length} movement${section.data.length === 1 ? '' : 's'}`}</Text>
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No matching movements</Text>
            <Text style={styles.emptyText}>Try clearing search or one of the independent filters.</Text>
            <PrimaryButton label="Clear filters" onPress={clearFilters} accessibilityLabel="Clear search and filters" />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        testID="library-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.ink0 },
  listContent: { padding: theme.space[4], paddingBottom: theme.space[6], gap: theme.space[2] },
  scrollContent: { padding: theme.space[4], paddingBottom: theme.space[6], gap: theme.space[4] },
  listHeader: { gap: theme.space[3], marginBottom: theme.space[3] },
  header: { marginBottom: theme.space[2] },
  wordmark: { ...theme.font.eyebrow, color: theme.color.textLow },
  title: { ...theme.font.title, color: theme.color.textHi },
  countText: { ...theme.font.label, color: theme.color.textMid, marginTop: theme.space[1] },
  searchBox: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    paddingHorizontal: theme.space[3],
    height: theme.touch.min,
    justifyContent: 'center',
  },
  searchInput: { ...theme.font.body, fontFamily: theme.font.family, color: theme.color.textHi, padding: 0 },
  filterLabel: { ...theme.font.eyebrow, color: theme.color.textMid },
  filterScroll: { gap: theme.space[2], paddingVertical: theme.space[1] },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: theme.space[3],
    paddingBottom: theme.space[1],
    backgroundColor: theme.color.ink0,
  },
  sectionHeaderTitle: { ...theme.font.cue, color: theme.color.textHi },
  sectionHeaderCount: { ...theme.font.label, color: theme.color.textLow },
  movementRow: {
    minHeight: theme.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    marginBottom: theme.space[2],
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  movementRowPressed: { backgroundColor: theme.color.ink0 },
  movementInfo: { flex: 1, gap: theme.space[1] },
  movementName: { ...theme.font.body, fontWeight: '700', color: theme.color.textHi },
  movementMeta: { ...theme.font.label, color: theme.color.textMid },
  teachingOnlyBadge: { ...theme.font.label, color: theme.color.textLow },
  scopeBadge: { ...theme.font.label, color: theme.color.chalk },
  chevron: { ...theme.font.cue, color: theme.color.textMid, marginLeft: theme.space[3] },
  emptyContainer: { alignItems: 'center', gap: theme.space[3], paddingVertical: theme.space[6] },
  emptyTitle: { ...theme.font.cue, color: theme.color.textHi },
  emptyText: { ...theme.font.body, color: theme.color.textMid, textAlign: 'center' },
  backButton: { alignSelf: 'flex-start' },
  detailCard: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.sheet,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space[4],
    gap: theme.space[4],
  },
  detailTitleRow: { gap: theme.space[1] },
  detailName: { ...theme.font.title, color: theme.color.textHi },
  detailBase: { ...theme.font.label, color: theme.color.textMid },
  teachingOnlyBanner: { borderLeftWidth: 4, borderLeftColor: theme.color.textMid, paddingLeft: theme.space[3] },
  teachingOnlyBannerText: { ...theme.font.body, color: theme.color.textMid },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  targetMuscles: { ...theme.font.label, color: theme.color.textMid },
  sectionBlock: { gap: theme.space[2] },
  sectionTitle: { ...theme.font.cue, color: theme.color.textHi },
  cueBox: { borderLeftWidth: 4, borderLeftColor: theme.color.chalk, paddingLeft: theme.space[3] },
  cueText: { ...theme.font.body, color: theme.color.textHi },
  bodyText: { ...theme.font.body, color: theme.color.textMid },
  mediaStatus: { ...theme.font.label, color: theme.color.textMid },
  ladderContainer: { gap: theme.space[2] },
  ladderRow: {
    minHeight: theme.touch.min,
    justifyContent: 'center',
    paddingVertical: theme.space[2],
    paddingLeft: theme.space[3],
    borderLeftWidth: 1,
    borderLeftColor: theme.color.line,
  },
  ladderRowActive: { borderLeftWidth: 4, borderLeftColor: theme.color.chalk },
  ladderItemName: { ...theme.font.body, color: theme.color.textMid },
  ladderItemNameActive: { color: theme.color.textHi, fontWeight: '700' },
  ladderItemSub: { ...theme.font.label, color: theme.color.textLow },
});
