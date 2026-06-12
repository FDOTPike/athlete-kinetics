/**
 * SessionScreen.tsx — active set logging around a workout-overview plan nav.
 *
 * Interaction contract:
 *   * The whole session is visible at a glance: a compact horizontal nav of
 *     planned movements with logged/planned badges. Tap any slot to work it
 *     out of order; SWAP replaces the active slot's movement (logged sets
 *     stand as history); + ADD appends from the library. No duplicates.
 *   * No keyboard, ever: reps/load/RPE are steppers with 64pt+ targets;
 *     values persist between sets because consecutive sets usually match.
 *   * LOG SET is one tap and synchronously durable (op-sqlite JSI insert).
 *   * Zero animations; pressed state is a flat color change. RN core only.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { targetLoadKg } from '@ak/inference';
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

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const shortName = (name: string): string => (name.length > 12 ? `${name.slice(0, 11)}…` : name);

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
  const logSet = useStore((s) => s.logSet);
  const endSession = useStore((s) => s.endSession);

  const [reps, setReps] = useState(5);
  const [loadKg, setLoadKg] = useState(100);
  const [rpe, setRpe] = useState(8);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  /** 'plan' = normal nav; 'add'/'swap' = picking from the library. */
  const [pickMode, setPickMode] = useState<'plan' | 'add' | 'swap'>('plan');
  // Elapsed-time readout against the profile's duration cap (display only).
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (session === null) return;
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [session]);

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
              onPress={() => setPickMode('swap')}
              accessibilityRole="button"
              accessibilityLabel="Swap the selected movement"
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
          <View style={styles.pickWrap}>
            {inLibraryNotPlanned.map((m: Movement) => (
              <Pressable
                key={m.movement_id}
                onPress={() => {
                  if (pickMode === 'swap' && activeMovementId !== null) {
                    swapMovement(activeMovementId, m.movement_id);
                  } else {
                    addPlanSlot(m.movement_id);
                  }
                  setPickMode('plan');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${pickMode === 'swap' ? 'Swap to' : 'Add'} ${m.name}`}
                style={styles.pickChip}
              >
                <Text style={styles.pickChipText}>{m.name}</Text>
              </Pressable>
            ))}
            {inLibraryNotPlanned.length === 0 && (
              <Text style={styles.dimText}>
                Nothing left to offer — every movement your equipment supports is
                already in the plan. Add gear under ATHLETE to widen the pool.
              </Text>
            )}
          </View>
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
          if (activeMovementId !== null) logSet(activeMovementId, reps, loadKg, rpe);
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

      {/* ---- session log, newest first ---- */}
      <FlatList
        data={session.sets}
        keyExtractor={(s: LoggedSet) => String(s.set_id)}
        style={styles.setList}
        ListEmptyComponent={<Text style={styles.emptyText}>No sets logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <Text style={styles.setRowName} numberOfLines={1}>
              {item.movement_name} · S{item.set_index}
            </Text>
            <Text style={styles.setRowData}>
              {item.reps}×{item.load_kg.toFixed(1)} @ {item.rpe.toFixed(1)}
            </Text>
          </View>
        )}
      />

      {/* ---- footer: tonnage, duration vs cap, end ---- */}
      <View style={styles.footer}>
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
  },
  pickTitle: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  pickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickChipText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  pickCancel: { marginTop: 10, alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  pickCancelText: { color: palette.dim, fontSize: 14, fontWeight: '800', letterSpacing: 1 },

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
  dimText: { color: palette.dim, fontSize: 14 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  setRowName: { color: palette.dim, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  setRowData: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

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
