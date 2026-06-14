/**
 * SessionScreen.tsx — active set logging around a workout-overview plan nav.
 *
 * Interaction contract:
 *   * The whole session is visible at a glance: a compact horizontal nav of
 *     planned movements with logged/planned badges. Tap any slot to work it
 *     out of order; SWAP replaces the active slot's movement (logged sets
 *     stand as history); + ADD appends from the library (now an ExRx-grouped
 *     collapsible picker). No duplicates.
 *   * No keyboard, ever: reps/load/RPE are steppers with 64pt+ targets;
 *     values persist between sets because consecutive sets usually match.
 *   * LOG SET is one tap and synchronously durable (op-sqlite JSI insert). The
 *     implement-prefix selector concatenates onto the base name in the payload.
 *   * Long-press a logged row to EDIT (inline steppers) or hard-DELETE it; the
 *     001 mech_daily triggers keep the rollup correct on either path.
 *   * Zero animations; pressed state is a flat color change. RN core only.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  JOINTS,
  PATTERN_TO_CATEGORY,
  TAXONOMY_CATEGORIES,
  targetLoadKg,
  type DaySwapOption,
  type Joint,
  type MovementPattern,
  type MovementPrefix,
  type MovementPreference,
  type TaxonomyCategory,
} from '@ak/inference';
import {
  isMovementAvailable,
  palette,
  useStore,
  type LoggedSet,
  type Movement,
} from '../state/useStore';
import InfoTip from '../components/InfoTip';

// ---------------------------------------------------------------------------
// Stepper — the only numeric input primitive on this screen
// ---------------------------------------------------------------------------
interface StepperProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  /** Glossary key — renders an ⓘ tooltip next to the label. */
  tip?: string;
  /** Render the value in red (e.g. RPE at an absolute 10). */
  danger?: boolean;
}
function Stepper({ label, display, onDec, onInc, tip, danger }: StepperProps): React.JSX.Element {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperLabelRow}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {tip !== undefined && <InfoTip term={tip} />}
      </View>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={onDec}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text
          style={[styles.stepperValue, danger === true && styles.stepperValueDanger]}
          accessibilityRole="text"
          accessibilityLabel={`${label} ${display}${danger === true ? ', maximal effort' : ''}`}
        >
          {display}
        </Text>
        <Pressable
          onPress={onInc}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MiniStepper — compact variant for the inline edit seam (keeps the
// no-keyboard contract; three fit on one row inside a logged-set card).
// ---------------------------------------------------------------------------
interface MiniStepperProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
}
function MiniStepper({ label, display, onDec, onInc }: MiniStepperProps): React.JSX.Element {
  return (
    <View style={styles.miniStepper}>
      <Text style={styles.miniLabel}>{label}</Text>
      <View style={styles.miniRow}>
        <Pressable
          onPress={onDec}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [styles.miniBtn, pressed && styles.stepBtnPressed]}
        >
          <Text style={styles.miniBtnText}>−</Text>
        </Pressable>
        <Text style={styles.miniValue} accessibilityLabel={`${label} ${display}`}>
          {display}
        </Text>
        <Pressable
          onPress={onInc}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [styles.miniBtn, pressed && styles.stepBtnPressed]}
        >
          <Text style={styles.miniBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ThumbToggle — binary sentiment (👍 +1 / 👎 −1), tap an active one to clear
// back to neutral (0). Drives movement_preference via the store.
// ---------------------------------------------------------------------------
interface ThumbToggleProps {
  preference: MovementPreference;
  onSet: (next: MovementPreference) => void;
}
function ThumbToggle({ preference, onSet }: ThumbToggleProps): React.JSX.Element {
  const up = preference === 1;
  const down = preference === -1;
  return (
    <View style={styles.thumbWrap}>
      <Pressable
        onPress={() => onSet(up ? 0 : 1)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: up }}
        accessibilityLabel={up ? 'Prioritized — tap to clear' : 'Prioritize this movement'}
        style={[styles.thumb, up && styles.thumbUpOn]}
      >
        <Text style={styles.thumbText}>👍</Text>
      </Pressable>
      <Pressable
        onPress={() => onSet(down ? 0 : -1)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: down }}
        accessibilityLabel={down ? 'Avoided — tap to clear' : 'Avoid this movement'}
        style={[styles.thumb, down && styles.thumbDownOn]}
      >
        <Text style={styles.thumbText}>👎</Text>
      </Pressable>
    </View>
  );
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const shortName = (name: string): string => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

const CATEGORY_LABEL: Record<TaxonomyCategory, string> = {
  push: 'PUSH',
  row: 'ROW',
  hinge: 'HINGE',
  squat: 'SQUAT',
  core: 'CORE',
  unilateral: 'UNILATERAL',
  accessory: 'ACCESSORY',
  cardio: 'CARDIO',
};
/** Map a 001 movement.pattern onto its ExRx category (the engine's single
 *  source of truth). Unknown patterns fall into 'accessory'. */
const categoryOf = (pattern: string): TaxonomyCategory =>
  PATTERN_TO_CATEGORY[pattern as MovementPattern] ?? 'accessory';

/** Substitution-tier presentation. Colors mirror SUBSTITUTION_COLORS in the
 *  engine (green = regression, purple = day-swap, orange = triage); green
 *  reuses the palette, the other two are local since the dark theme has no
 *  purple/orange token. */
const TIER = {
  regression: { color: palette.green, hint: 'Easier · same pattern' },
  day_swap: { color: '#A98EFF', hint: 'Pull from a later day' },
  triage: { color: '#FF9F45', hint: 'Train around a niggle' },
} as const;

/** 'lower_back' -> 'LOWER BACK' for the joint picker. */
const jointLabel = (j: Joint): string => j.replace(/_/g, ' ').toUpperCase();

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SessionScreen(): React.JSX.Element {
  const movements = useStore((s) => s.movements);
  const session = useStore((s) => s.session);
  const sessionPlan = useStore((s) => s.sessionPlan);
  const activeMovementId = useStore((s) => s.activeMovementId);
  const profile = useStore((s) => s.profile);
  const lastTriage = useStore((s) => s.lastTriage);
  const block = useStore((s) => s.block);
  const todayPlan = useStore((s) => s.todayPlan);
  const oneRepMaxes = useStore((s) => s.oneRepMaxes);
  const lastEndedSessionId = useStore((s) => s.lastEndedSessionId);
  const saveSessionNote = useStore((s) => s.saveSessionNote);
  const startSession = useStore((s) => s.startSession);
  const selectMovement = useStore((s) => s.selectMovement);
  const addPlanSlot = useStore((s) => s.addPlanSlot);
  const swapMovement = useStore((s) => s.swapMovement);
  const setMovementPreference = useStore((s) => s.setMovementPreference);
  const substitution = useStore((s) => s.substitution);
  const openSubstitution = useStore((s) => s.openSubstitution);
  const closeSubstitution = useStore((s) => s.closeSubstitution);
  const applyRegression = useStore((s) => s.applyRegression);
  const applyDaySwap = useStore((s) => s.applyDaySwap);
  const niggles = useStore((s) => s.niggles);
  const reportNiggle = useStore((s) => s.reportNiggle);
  const logSet = useStore((s) => s.logSet);
  const deleteSet = useStore((s) => s.deleteSet);
  const editSet = useStore((s) => s.editSet);
  const endSession = useStore((s) => s.endSession);

  const [reps, setReps] = useState(5);
  const [loadKg, setLoadKg] = useState(100);
  const [rpe, setRpe] = useState(8);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  /** 'plan' = normal nav; 'add'/'swap' = picking from the library. */
  const [pickMode, setPickMode] = useState<'plan' | 'add' | 'swap'>('plan');
  /** Expanded ExRx categories in the picker; empty == all collapsed (the
   *  memory-efficient default — collapsed sections unmount their children). */
  const [expandedCats, setExpandedCats] = useState<Set<TaxonomyCategory>>(new Set());
  /** Selected implement prefix for the active movement (null == base name). */
  const [prefix, setPrefix] = useState<MovementPrefix | null>(null);
  /** Logged-set row whose long-press context seam is open. */
  const [menuSetId, setMenuSetId] = useState<number | null>(null);
  /** Logged-set row currently in inline-edit mode (mutually exclusive w/ menu). */
  const [editSetId, setEditSetId] = useState<number | null>(null);
  const [editReps, setEditReps] = useState(5);
  const [editLoad, setEditLoad] = useState(100);
  const [editRpe, setEditRpe] = useState(8);
  /** Report-niggle bottom sheet. */
  const [niggleOpen, setNiggleOpen] = useState(false);
  const [niggleRegion, setNiggleRegion] = useState<Joint | null>(null);
  const [niggleSeverity, setNiggleSeverity] = useState(4);
  // Elapsed-time readout against the profile's duration cap (display only).
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (session === null) return;
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [session]);
  // A new active movement resets the implement selection (a prefix from the
  // previous movement may not be in this one's supported set).
  useEffect(() => {
    setPrefix(null);
  }, [activeMovementId]);

  if (session === null) {
    // Instant start — no forced check-in (field-tested as friction). An
    // operative halt still blocks here AND inside the store action; a
    // plan-less start (no block / rest day) needs explicit confirmation.
    const startHalted =
      lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
    const requestStart = (): void => {
      if (block === null || todayPlan === null) {
        Alert.alert(
          block === null ? 'No training block yet' : 'Rest day',
          block === null
            ? 'Generate a 4-week block on COACH first so sessions follow a plan. Start an unplanned session anyway?'
            : 'Today is a rest day in your block. Start an unplanned session anyway?',
          [
            { text: 'CANCEL', style: 'cancel' },
            { text: 'START ANYWAY', onPress: startSession },
          ],
        );
        return;
      }
      startSession();
    };
    return (
      <View style={styles.center}>
        {startHalted ? (
          <View style={styles.haltBanner}>
            <Text style={styles.haltBannerText}>
              STOP — today&apos;s report ended training. Rest, and report again tomorrow.
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={requestStart}
            accessibilityRole="button"
            accessibilityLabel="Start a new workout session"
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
          >
            <Text style={styles.startBtnText}>START SESSION</Text>
          </Pressable>
        )}
        {lastEndedSessionId !== null && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>NOTES ON LAST SESSION</Text>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={(t) => { setNoteText(t); setNoteSaved(false); }}
              placeholder="e.g. grip was the limiter on pulls"
              placeholderTextColor={palette.dim}
              maxLength={1000}
              multiline
              accessibilityLabel="Free-text notes on the last session"
            />
            <Pressable
              disabled={noteText.trim().length === 0}
              onPress={() => { saveSessionNote(noteText); setNoteSaved(true); }}
              accessibilityRole="button"
              accessibilityLabel="Save the session note"
              style={[styles.noteSaveBtn, noteText.trim().length === 0 && styles.noteSaveBtnDisabled]}
            >
              <Text style={styles.noteSaveText}>{noteSaved ? 'SAVED' : 'SAVE NOTE'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const byId = new Map(movements.map((m) => [m.movement_id, m]));
  const activeMovement: Movement | null =
    activeMovementId !== null ? byId.get(activeMovementId) ?? null : null;
  const loggedFor = (movementId: number): number =>
    session.sets.filter((s) => s.movement_id === movementId).length;
  const tonnage = session.sets.reduce((a, s) => a + s.tonnage_kg, 0);
  const elapsedMin = Math.floor((nowMs - session.startedAtMs) / 60_000);
  const overTime = elapsedMin > profile.session_duration_cap_min;
  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;
  // Library pickers honor the strict equipment filter: a movement the
  // athlete's inventory cannot support is never offered.
  const inLibraryNotPlanned = movements.filter(
    (m) =>
      !sessionPlan.some((s) => s.movementId === m.movement_id) &&
      isMovementAvailable(m, profile.equipment_inventory),
  );
  // Hierarchical ExRx grouping: 8 categories, fixed engine order, empties hidden.
  const grouped: { category: TaxonomyCategory; items: Movement[] }[] = TAXONOMY_CATEGORIES
    .map((category) => ({
      category,
      items: inLibraryNotPlanned.filter((m) => categoryOf(m.pattern) === category),
    }))
    .filter((g) => g.items.length > 0);

  // Prefix-engine payload: the implement prepends onto the BASE name; with no
  // implement selected we log the movement's canonical name verbatim.
  const loggedName =
    activeMovement !== null
      ? prefix !== null
        ? `${prefix} ${activeMovement.baseName}`
        : activeMovement.name
      : '';

  const toggleCat = (c: TaxonomyCategory): void => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const commitPick = (m: Movement): void => {
    if (pickMode === 'swap' && activeMovementId !== null) {
      swapMovement(activeMovementId, m.movement_id);
    } else {
      addPlanSlot(m.movement_id);
    }
    setPickMode('plan');
  };

  const beginEdit = (item: LoggedSet): void => {
    setMenuSetId(null);
    setEditReps(item.reps);
    setEditLoad(item.load_kg);
    setEditRpe(item.rpe);
    setEditSetId(item.set_id);
  };

  // A day-swap is destructive (it deletes a future planned slot to conserve
  // volume), so it confirms first — showing the engine's own rationale.
  const confirmDaySwap = (option: DaySwapOption): void => {
    const targetId = substitution?.targetId ?? null;
    if (targetId === null) return;
    Alert.alert(
      'Pull forward?',
      `${option.rationale}\n\nThis replaces today's movement and removes that future slot.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'PULL FORWARD', onPress: () => applyDaySwap(targetId, option) },
      ],
    );
  };

  const openNiggle = (): void => {
    setNiggleRegion(null);
    setNiggleSeverity(4);
    setNiggleOpen(true);
  };

  const confirmEnd = (): void => {
    if (session.sets.length === 0) {
      // Accidental starts back out cleanly: an empty session is deleted,
      // never recorded — no rollups touched, no prescription penalty.
      Alert.alert(
        'Discard empty session?',
        'Nothing was logged. Discarding leaves no trace and no penalty.',
        [
          { text: 'KEEP LIFTING', style: 'cancel' },
          { text: 'DISCARD', style: 'destructive', onPress: endSession },
        ],
      );
      return;
    }
    Alert.alert(
      'End session?',
      `${session.sets.length} sets · ${Math.round(tonnage)} kg total`,
      [
        { text: 'KEEP LIFTING', style: 'cancel' },
        { text: 'END', style: 'destructive', onPress: endSession },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      {halted && (
        <View style={styles.haltBanner}>
          <Text style={styles.haltBannerText}>
            STOP — today&apos;s report ended this session. {lastTriage.directive.vector.coaching_cue}
          </Text>
        </View>
      )}

      {/* ---- workout overview nav / library picker ---- */}
      {pickMode === 'plan' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navStrip}
          contentContainerStyle={styles.navStripContent}
        >
          {sessionPlan.map((slot) => {
            const m = byId.get(slot.movementId);
            const logged = loggedFor(slot.movementId);
            const active = slot.movementId === activeMovementId;
            const done = logged >= slot.plannedSets;
            return (
              <Pressable
                key={slot.movementId}
                onPress={() => selectMovement(slot.movementId)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${m?.name ?? 'movement'}, ${logged} of ${slot.plannedSets} sets logged`}
                style={[styles.navSlot, active && styles.navSlotActive]}
              >
                <Text
                  style={[styles.navSlotName, active && styles.navSlotNameActive]}
                  numberOfLines={1}
                >
                  {shortName(m?.name ?? '?')}
                </Text>
                <Text style={[styles.navSlotBadge, done && styles.navSlotBadgeDone]}>
                  {logged}/{slot.plannedSets}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setPickMode('add')}
            accessibilityRole="button"
            accessibilityLabel="Add a movement to the plan"
            style={styles.navAction}
          >
            <Text style={styles.navActionText}>+ ADD</Text>
          </Pressable>
          {activeMovementId !== null && (
            <Pressable
              onPress={() => openSubstitution(activeMovementId)}
              accessibilityRole="button"
              accessibilityLabel="Find substitutions for the selected movement"
              style={styles.navAction}
            >
              <Text style={styles.navActionText}>SWAP</Text>
            </Pressable>
          )}
        </ScrollView>
      ) : (
        <View style={styles.pickPanel}>
          <Text style={styles.pickTitle} numberOfLines={1}>
            {pickMode === 'swap'
              ? `SWAP ${shortName(byId.get(activeMovementId ?? -1)?.name ?? '?')} FOR:`
              : 'ADD MOVEMENT:'}
          </Text>
          <ScrollView style={styles.pickScroll} keyboardShouldPersistTaps="handled">
            {grouped.map(({ category, items }) => {
              const open = expandedCats.has(category);
              return (
                <View key={category}>
                  <Pressable
                    onPress={() => toggleCat(category)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${CATEGORY_LABEL[category]}, ${items.length} movements, ${open ? 'expanded' : 'collapsed'}`}
                    style={styles.catHeader}
                  >
                    <Text style={styles.catChevron}>{open ? '▾' : '▸'}</Text>
                    <Text style={styles.catHeaderText}>{CATEGORY_LABEL[category]}</Text>
                    <Text style={styles.catCount}>{items.length}</Text>
                  </Pressable>
                  {open && (
                    <View style={styles.catBody}>
                      {items.map((m) => (
                        <View key={m.movement_id} style={styles.libRow}>
                          <Pressable
                            onPress={() => commitPick(m)}
                            accessibilityRole="button"
                            accessibilityLabel={`${pickMode === 'swap' ? 'Swap to' : 'Add'} ${m.name}`}
                            style={styles.libPick}
                          >
                            <Text style={styles.libName} numberOfLines={1}>{m.name}</Text>
                            <Text style={styles.libMeta}>{m.difficulty}</Text>
                          </Pressable>
                          <ThumbToggle
                            preference={m.preference}
                            onSet={(next) => setMovementPreference(m.movement_id, next)}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {grouped.length === 0 && (
              <Text style={styles.dimText}>
                Nothing left to offer — every movement your equipment supports is
                already in the plan. Add gear under ATHLETE to widen the pool.
              </Text>
            )}
          </ScrollView>
          <Pressable
            onPress={() => setPickMode('plan')}
            accessibilityRole="button"
            accessibilityLabel="Cancel picking"
            style={styles.pickCancel}
          >
            <Text style={styles.pickCancelText}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/* ---- planned target for the active movement (1RM translation) ---- */}
      {(() => {
        const slot = todayPlan !== null && activeMovementId !== null
          ? todayPlan.slots.find((sl) => sl.movementId === activeMovementId) ?? null
          : null;
        if (slot === null) return null;
        const oneRm = oneRepMaxes[slot.movementId] as number | undefined;
        const target = slot.overrideLoadKg ?? (oneRm !== undefined
          ? targetLoadKg(oneRm, slot.reps, slot.targetRpe)
          : null);
        return (
          <View style={styles.targetRow}>
            <Text style={styles.targetText}>
              TARGET {slot.sets}×{slot.reps} @ RPE {slot.targetRpe.toFixed(1)}
              {target !== null ? ` · ${target.toFixed(1)} kg` : ''}
            </Text>
            {slot.overrideReason !== null && (
              <Text style={styles.targetReason}>{slot.overrideReason}</Text>
            )}
          </View>
        );
      })()}

      {/* ---- prefix engine: implement dropdown preceding the base name ---- */}
      {activeMovement !== null && activeMovement.supportedPrefixes.length > 0 && (
        <View style={styles.prefixRow}>
          <Text style={styles.prefixLabel}>IMPLEMENT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.prefixChips}
            keyboardShouldPersistTaps="handled"
          >
            {activeMovement.supportedPrefixes.map((p) => {
              const on = prefix === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPrefix(on ? null : p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Implement ${p}${on ? ', selected' : ''}`}
                  style={[styles.prefixChip, on && styles.prefixChipOn]}
                >
                  <Text style={[styles.prefixChipText, on && styles.prefixChipTextOn]}>{p}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      {activeMovement !== null && (
        <Text style={styles.loggingName} numberOfLines={1}>
          LOGGING: {loggedName}
        </Text>
      )}

      {/* ---- input steppers ---- */}
      <Stepper
        label="REPS"
        display={String(reps)}
        onDec={() => setReps((v) => clamp(v - 1, 1, 50))}
        onInc={() => setReps((v) => clamp(v + 1, 1, 50))}
      />
      <Stepper
        label="LOAD KG"
        display={loadKg.toFixed(1)}
        onDec={() => setLoadKg((v) => clamp(v - 2.5, 0, 500))}
        onInc={() => setLoadKg((v) => clamp(v + 2.5, 0, 500))}
      />
      <Stepper
        label="RPE"
        display={rpe.toFixed(1)}
        tip="RPE"
        danger={rpe >= 10}
        onDec={() => setRpe((v) => clamp(v - 0.5, 5, 10))}
        onInc={() => setRpe((v) => clamp(v + 0.5, 5, 10))}
      />

      {/* ---- primary action ---- */}
      <Pressable
        disabled={activeMovementId === null}
        onPress={() => {
          if (activeMovementId !== null) logSet(activeMovementId, reps, loadKg, rpe, loggedName);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Log set: ${reps} reps at ${loadKg.toFixed(1)} kilograms, RPE ${rpe.toFixed(1)}`}
        style={({ pressed }) => [
          styles.logBtn,
          pressed && styles.logBtnPressed,
          activeMovementId === null && styles.logBtnDisabled,
        ]}
      >
        <Text style={styles.logBtnText}>
          {activeMovementId === null ? 'PICK A MOVEMENT' : 'LOG SET'}
        </Text>
      </Pressable>

      {/* ---- session log, newest first; long-press a row to edit/delete ---- */}
      <FlatList
        data={session.sets}
        keyExtractor={(s: LoggedSet) => String(s.set_id)}
        style={styles.setList}
        ListEmptyComponent={<Text style={styles.emptyText}>No sets logged yet.</Text>}
        renderItem={({ item }) => {
          if (editSetId === item.set_id) {
            return (
              <View style={styles.editPanel}>
                <Text style={styles.editTitle} numberOfLines={1}>
                  EDIT · {item.movement_name} · S{item.set_index}
                </Text>
                <View style={styles.editSteppers}>
                  <MiniStepper
                    label="REPS"
                    display={String(editReps)}
                    onDec={() => setEditReps((v) => clamp(v - 1, 1, 50))}
                    onInc={() => setEditReps((v) => clamp(v + 1, 1, 50))}
                  />
                  <MiniStepper
                    label="LOAD"
                    display={editLoad.toFixed(1)}
                    onDec={() => setEditLoad((v) => clamp(v - 2.5, 0, 500))}
                    onInc={() => setEditLoad((v) => clamp(v + 2.5, 0, 500))}
                  />
                  <MiniStepper
                    label="RPE"
                    display={editRpe.toFixed(1)}
                    onDec={() => setEditRpe((v) => clamp(v - 0.5, 5, 10))}
                    onInc={() => setEditRpe((v) => clamp(v + 0.5, 5, 10))}
                  />
                </View>
                <View style={styles.editActions}>
                  <Pressable
                    onPress={() => setEditSetId(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                    style={styles.editCancel}
                  >
                    <Text style={styles.editCancelText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { editSet(item.set_id, editReps, editLoad, editRpe); setEditSetId(null); }}
                    accessibilityRole="button"
                    accessibilityLabel="Save edited set"
                    style={styles.editSave}
                  >
                    <Text style={styles.editSaveText}>SAVE</Text>
                  </Pressable>
                </View>
              </View>
            );
          }
          const menuOpen = menuSetId === item.set_id;
          return (
            <Pressable
              onLongPress={() => setMenuSetId(item.set_id)}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${item.movement_name}, set ${item.set_index}, ${item.reps} reps at ${item.load_kg.toFixed(1)} kilograms, RPE ${item.rpe.toFixed(1)}`}
              accessibilityHint="Long-press to edit or delete this set"
              style={styles.setRowWrap}
            >
              <View style={styles.setRow}>
                <Text style={styles.setRowName} numberOfLines={1}>
                  {item.movement_name} · S{item.set_index}
                </Text>
                <Text style={styles.setRowData}>
                  {item.reps}×{item.load_kg.toFixed(1)} @ {item.rpe.toFixed(1)}
                </Text>
              </View>
              {menuOpen && (
                <View style={styles.rowMenu}>
                  <Pressable
                    onPress={() => beginEdit(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit set ${item.set_index} of ${item.movement_name}`}
                    style={styles.rowMenuBtn}
                  >
                    <Text style={styles.rowMenuBtnText}>EDIT</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { deleteSet(item.set_id); setMenuSetId(null); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete set ${item.set_index} of ${item.movement_name}`}
                    style={styles.rowMenuDelete}
                  >
                    <Text style={styles.rowMenuDeleteText}>🗑  DELETE</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMenuSetId(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close menu"
                    style={styles.rowMenuClose}
                  >
                    <Text style={styles.rowMenuCloseText}>✕</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* ---- footer: niggle report, tonnage, duration vs cap, end ---- */}
      <View style={styles.footer}>
        <Pressable
          onPress={openNiggle}
          accessibilityRole="button"
          accessibilityLabel={
            niggles.length > 0
              ? `Report a niggle. ${niggles.length} active today`
              : 'Report a niggle'
          }
          style={[styles.niggleBtn, niggles.length > 0 && styles.niggleBtnActive]}
        >
          <Text style={styles.niggleBtnIcon}>⚠</Text>
          {niggles.length > 0 && (
            <Text style={styles.niggleBtnCount}>{niggles.length}</Text>
          )}
        </Pressable>
        <View>
          <Text style={styles.footerLabel}>TONNAGE</Text>
          <Text style={styles.footerValue}>{Math.round(tonnage)} kg</Text>
        </View>
        <View>
          <Text style={styles.footerLabel}>TIME</Text>
          <Text style={[styles.footerValue, overTime && styles.footerOver]}>
            {elapsedMin}/{profile.session_duration_cap_min}m
          </Text>
        </View>
        <Pressable
          onPress={confirmEnd}
          accessibilityRole="button"
          accessibilityLabel="End the workout session"
          style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
        >
          <Text style={styles.endBtnText}>END</Text>
        </Pressable>
      </View>

      {/* ---- deterministic substitution sheet (SWAP) ---- */}
      {substitution !== null && (() => {
        const targetName = byId.get(substitution.targetId)?.name ?? 'movement';
        const reg = substitution.result.layer1Regression.options;
        const day = substitution.result.layer2DaySwap.options;
        const tri = substitution.result.layer3Triage.cluster;
        const haltAdvised = substitution.result.haltAdvised;
        const empty = reg.length === 0 && day.length === 0 && tri === null;
        return (
          <Modal visible transparent animationType="none" onRequestClose={closeSubstitution}>
            <Pressable
              style={styles.subBackdrop}
              onPress={closeSubstitution}
              accessibilityRole="button"
              accessibilityLabel="Dismiss substitutions"
            >
              {/* Inner Pressable swallows taps so the card doesn't dismiss. */}
              <Pressable style={styles.subCard} onPress={() => undefined}>
                <Text style={styles.subTitle} numberOfLines={2}>SUBSTITUTE {targetName}</Text>
                {haltAdvised && (
                  <View style={styles.subHalt}>
                    <Text style={styles.subHaltText}>
                      A niggle hit your halt threshold — too severe to train around.
                      Consider ending the session and reporting it on COACH.
                    </Text>
                  </View>
                )}
                <ScrollView style={styles.subScroll} keyboardShouldPersistTaps="handled">
                  {reg.length > 0 && (
                    <View style={styles.subTier}>
                      <View style={[styles.subTierBar, { backgroundColor: TIER.regression.color }]} />
                      <View style={styles.subTierBody}>
                        <Text style={[styles.subTierLabel, { color: TIER.regression.color }]}>
                          REGRESSION · {TIER.regression.hint}
                        </Text>
                        {reg.map((o) => (
                          <Pressable
                            key={o.movement_id}
                            onPress={() => applyRegression(substitution.targetId, o.movement_id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Regress to ${o.name}, ${o.difficulty}`}
                            style={styles.subOption}
                          >
                            <View style={styles.subOptionHead}>
                              <Text style={styles.subOptionName} numberOfLines={1}>{o.name}</Text>
                              <Text style={styles.subOptionTag}>{o.difficulty}</Text>
                            </View>
                            <Text style={styles.subOptionWhy} numberOfLines={2}>{o.rationale}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                  {day.length > 0 && (
                    <View style={styles.subTier}>
                      <View style={[styles.subTierBar, { backgroundColor: TIER.day_swap.color }]} />
                      <View style={styles.subTierBody}>
                        <Text style={[styles.subTierLabel, { color: TIER.day_swap.color }]}>
                          DAY SWAP · {TIER.day_swap.hint}
                        </Text>
                        {day.map((o) => (
                          <Pressable
                            key={o.plannedSlotId}
                            onPress={() => confirmDaySwap(o)}
                            accessibilityRole="button"
                            accessibilityLabel={`Pull ${o.name} forward from day ${o.fromDayIndex}`}
                            style={styles.subOption}
                          >
                            <View style={styles.subOptionHead}>
                              <Text style={styles.subOptionName} numberOfLines={1}>{o.name}</Text>
                              <Text style={styles.subOptionTag}>day {o.fromDayIndex} · −{o.setsConserved}</Text>
                            </View>
                            <Text style={styles.subOptionWhy} numberOfLines={2}>{o.rationale}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                  {tri !== null && (
                    <View style={styles.subTier}>
                      <View style={[styles.subTierBar, { backgroundColor: TIER.triage.color }]} />
                      <View style={styles.subTierBody}>
                        <Text style={[styles.subTierLabel, { color: TIER.triage.color }]}>
                          TRIAGE · {TIER.triage.hint}
                        </Text>
                        <Text style={styles.subOptionWhy}>{tri.rationale}</Text>
                        <View style={styles.triCluster}>
                          {tri.movements.map((m) => (
                            <Text key={m.movement_id} style={styles.triChip}>{m.name}</Text>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
                  {empty && (
                    <Text style={styles.subEmpty}>
                      No engine substitutions for this movement right now — its
                      pattern has no available regression and no later block day
                      offers the same category. Browse the full library instead.
                    </Text>
                  )}
                </ScrollView>
                <View style={styles.subActions}>
                  <Pressable
                    onPress={() => { closeSubstitution(); setPickMode('swap'); }}
                    accessibilityRole="button"
                    accessibilityLabel="Browse the full movement library"
                    style={styles.subBrowse}
                  >
                    <Text style={styles.subBrowseText}>BROWSE ALL</Text>
                  </Pressable>
                  <Pressable
                    onPress={closeSubstitution}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel substitution"
                    style={styles.subCancel}
                  >
                    <Text style={styles.subCancelText}>CANCEL</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}

      {/* ---- report-niggle sheet (the Layer 3 / guardrail severity source) ---- */}
      {niggleOpen && (
        <Modal visible transparent animationType="none" onRequestClose={() => setNiggleOpen(false)}>
          <Pressable
            style={styles.subBackdrop}
            onPress={() => setNiggleOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss niggle report"
          >
            <Pressable style={styles.niggleCard} onPress={() => undefined}>
              <Text style={styles.subTitle}>REPORT NIGGLE</Text>
              <Text style={styles.niggleHint}>Where does it hurt?</Text>
              <View style={styles.jointWrap}>
                {JOINTS.map((j) => {
                  const on = niggleRegion === j;
                  return (
                    <Pressable
                      key={j}
                      onPress={() => setNiggleRegion(j)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={jointLabel(j)}
                      style={[styles.jointChip, on && styles.jointChipOn]}
                    >
                      <Text style={[styles.jointChipText, on && styles.jointChipTextOn]}>
                        {jointLabel(j)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Stepper
                label="SEVERITY 1–10"
                display={String(niggleSeverity)}
                danger={niggleSeverity >= 8}
                onDec={() => setNiggleSeverity((v) => clamp(v - 1, 1, 10))}
                onInc={() => setNiggleSeverity((v) => clamp(v + 1, 1, 10))}
              />
              <Text style={styles.niggleScale}>
                3–5 reroutes a compound to accessories · 6+ also bars that joint
              </Text>
              <View style={styles.subActions}>
                <Pressable
                  onPress={() => setNiggleOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel niggle report"
                  style={styles.subCancel}
                >
                  <Text style={styles.subCancelText}>CANCEL</Text>
                </Pressable>
                <Pressable
                  disabled={niggleRegion === null}
                  onPress={() => {
                    if (niggleRegion !== null) {
                      reportNiggle(niggleRegion, niggleSeverity);
                      setNiggleOpen(false);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    niggleRegion === null
                      ? 'Pick a region first'
                      : `Report ${jointLabel(niggleRegion)} severity ${niggleSeverity}`
                  }
                  style={[styles.niggleReport, niggleRegion === null && styles.niggleReportDisabled]}
                >
                  <Text style={styles.niggleReportText}>REPORT</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  center: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    minHeight: 96,
    minWidth: 280,
    borderRadius: 18,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnPressed: { backgroundColor: '#26C28F' },
  startBtnText: { color: '#06251B', fontSize: 24, fontWeight: '800', letterSpacing: 2 },

  haltBanner: {
    backgroundColor: '#2A1416',
    borderWidth: 2,
    borderColor: palette.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  haltBannerText: { color: palette.red, fontSize: 14, fontWeight: '700', lineHeight: 20 },

  targetRow: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  targetText: {
    color: palette.green,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  targetReason: { color: palette.amber, fontSize: 12, lineHeight: 17, marginTop: 4 },

  noteBox: { alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 26 },
  noteLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  noteInput: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  noteSaveBtn: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  noteSaveBtnDisabled: { borderColor: palette.line },
  noteSaveText: { color: palette.green, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  navStrip: { flexGrow: 0, marginBottom: 8 },
  navStripContent: { gap: 8, paddingVertical: 4, alignItems: 'stretch' },
  navSlot: {
    minHeight: 60,
    minWidth: 92,
    maxWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: 'center',
  },
  navSlotActive: { borderColor: palette.green, backgroundColor: '#10241D' },
  navSlotName: { color: palette.dim, fontSize: 14, fontWeight: '700' },
  navSlotNameActive: { color: palette.green },
  navSlotBadge: {
    color: palette.dim,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  navSlotBadgeDone: { color: palette.green },
  navAction: {
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionText: { color: palette.amber, fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  pickPanel: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.amber,
    padding: 12,
    marginBottom: 8,
    // Bound the picker so a fully-expanded library never eats the logging UI.
    maxHeight: 280,
  },
  pickTitle: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  pickScroll: { flexGrow: 0 },
  pickCancel: { marginTop: 10, alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  pickCancelText: { color: palette.dim, fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  catChevron: { color: palette.amber, fontSize: 14, width: 18, fontWeight: '800' },
  catHeaderText: { color: palette.text, fontSize: 14, fontWeight: '800', letterSpacing: 1.5, flex: 1 },
  catCount: {
    color: palette.dim,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
  },
  catBody: { paddingVertical: 6, gap: 6 },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  libPick: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libName: { color: palette.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  libMeta: { color: palette.dim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginLeft: 8 },

  thumbWrap: { flexDirection: 'row', gap: 6 },
  thumb: {
    width: 48,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbUpOn: { borderColor: palette.green, backgroundColor: '#10241D' },
  thumbDownOn: { borderColor: palette.red, backgroundColor: '#2A1416' },
  thumbText: { fontSize: 20 },

  prefixRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  prefixLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2 },
  prefixChips: { gap: 8, alignItems: 'center', paddingRight: 4 },
  prefixChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixChipOn: { borderColor: palette.green, backgroundColor: '#10241D' },
  prefixChipText: { color: palette.dim, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  prefixChipTextOn: { color: palette.green },
  loggingName: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },

  stepper: { marginTop: 10 },
  stepperLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepperLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 72,
    height: 60,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: '#22222A' },
  stepBtnText: { color: palette.text, fontSize: 32, fontWeight: '700', lineHeight: 36 },
  stepperValue: {
    flex: 1,
    color: palette.text,
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepperValueDanger: { color: palette.red },

  logBtn: {
    height: 84,
    borderRadius: 16,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  logBtnPressed: { backgroundColor: '#26C28F' },
  logBtnDisabled: { backgroundColor: palette.line },
  logBtnText: { color: '#06251B', fontSize: 24, fontWeight: '800', letterSpacing: 3 },

  setList: { flex: 1, marginTop: 12 },
  emptyText: { color: palette.dim, textAlign: 'center', marginTop: 24, fontSize: 14 },
  dimText: { color: palette.dim, fontSize: 14, paddingVertical: 8 },
  setRowWrap: { marginBottom: 6 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  setRowName: { color: palette.dim, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  setRowData: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  rowMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  rowMenuBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMenuBtnText: { color: palette.amber, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  rowMenuDelete: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.red,
    backgroundColor: '#2A1416',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMenuDeleteText: { color: palette.red, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  rowMenuClose: {
    width: 48,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMenuCloseText: { color: palette.dim, fontSize: 18, fontWeight: '800' },

  editPanel: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.amber,
    padding: 12,
    marginBottom: 6,
  },
  editTitle: { color: palette.amber, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  editSteppers: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  miniStepper: { flex: 1 },
  miniLabel: { color: palette.dim, fontSize: 10, letterSpacing: 1.5, marginBottom: 4, textAlign: 'center' },
  miniRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniBtn: {
    width: 40,
    height: 44,
    borderRadius: 8,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: { color: palette.text, fontSize: 24, fontWeight: '700', lineHeight: 26 },
  miniValue: {
    flex: 1,
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  editCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelText: { color: palette.dim, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  editSave: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveText: { color: '#06251B', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  subBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  subCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  subTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  subScroll: { flexGrow: 0 },
  subHalt: {
    backgroundColor: '#2A1416',
    borderWidth: 1,
    borderColor: palette.red,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  subHaltText: { color: palette.red, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  subTier: { flexDirection: 'row', marginBottom: 14 },
  subTierBar: { width: 4, borderRadius: 2, marginRight: 10 },
  subTierBody: { flex: 1 },
  subTierLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  subOption: {
    minHeight: 56,
    backgroundColor: palette.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  subOptionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subOptionName: { color: palette.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  subOptionTag: {
    color: palette.dim,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  subOptionWhy: { color: palette.dim, fontSize: 12, lineHeight: 17, marginTop: 4 },
  triCluster: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  triChip: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  subEmpty: { color: palette.dim, fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  subActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  subBrowse: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBrowseText: { color: palette.amber, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  subCancel: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCancelText: { color: palette.dim, fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  niggleBtn: {
    minWidth: 52,
    minHeight: 52,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  niggleBtnActive: { borderColor: palette.amber, backgroundColor: '#2A210F' },
  niggleBtnIcon: { fontSize: 20, color: palette.amber },
  niggleBtnCount: {
    color: palette.amber,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  niggleCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.amber,
    padding: 16,
  },
  niggleHint: { color: palette.dim, fontSize: 13, marginBottom: 10 },
  jointWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  jointChip: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jointChipOn: { borderColor: palette.amber, backgroundColor: '#2A210F' },
  jointChipText: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  jointChipTextOn: { color: palette.amber },
  niggleScale: { color: palette.dim, fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 4 },
  niggleReport: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  niggleReportDisabled: { backgroundColor: palette.line },
  niggleReportText: { color: '#2A1A06', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  footerLabel: { color: palette.dim, fontSize: 11, letterSpacing: 2 },
  footerValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  footerOver: { color: palette.red },
  endBtn: {
    minHeight: 60,
    minWidth: 110,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtnPressed: { backgroundColor: '#2A1416' },
  endBtnText: { color: palette.red, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
});
