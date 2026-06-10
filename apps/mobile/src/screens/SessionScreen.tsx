/**
 * SessionScreen.tsx — active set logging, built for mid-session speed.
 *
 * Interaction contract:
 *   * No keyboard, ever: reps/load/RPE are steppers with 64pt+ targets that
 *     work with chalked or sweaty hands; values persist between sets because
 *     consecutive sets are usually identical.
 *   * LOG SET is one tap and synchronously durable (op-sqlite JSI insert hits
 *     the WAL before the press state clears); mech_daily updates via trigger.
 *   * Zero animations. Pressed state is a flat color change only.
 */
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette, useStore, type LoggedSet, type Movement } from '../state/useStore';

// ---------------------------------------------------------------------------
// Stepper — the only input primitive on this screen
// ---------------------------------------------------------------------------
interface StepperProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
}
function Stepper({ label, display, onDec, onInc }: StepperProps): React.JSX.Element {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
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
          style={styles.stepperValue}
          accessibilityRole="text"
          accessibilityLabel={`${label} ${display}`}
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
// Screen
// ---------------------------------------------------------------------------
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export default function SessionScreen(): React.JSX.Element {
  const movements = useStore((s) => s.movements);
  const session = useStore((s) => s.session);
  const startSession = useStore((s) => s.startSession);
  const logSet = useStore((s) => s.logSet);
  const endSession = useStore((s) => s.endSession);

  const [movementId, setMovementId] = useState<number | null>(
    movements.length > 0 ? movements[0].movement_id : null,
  );
  const [reps, setReps] = useState(5);
  const [loadKg, setLoadKg] = useState(100);
  const [rpe, setRpe] = useState(8);

  // ---- idle state: one giant start target ---------------------------------
  if (session === null) {
    return (
      <View style={styles.center}>
        <Pressable
          onPress={startSession}
          accessibilityRole="button"
          accessibilityLabel="Start a new workout session"
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
        >
          <Text style={styles.startBtnText}>START SESSION</Text>
        </Pressable>
      </View>
    );
  }

  const canLog = movementId !== null;
  const tonnage = session.sets.reduce((a, s) => a + s.tonnage_kg, 0);

  const confirmEnd = (): void => {
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
      {/* movement selector: large chips, horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripContent}
      >
        {movements.map((m: Movement) => {
          const active = m.movement_id === movementId;
          return (
            <Pressable
              key={m.movement_id}
              onPress={() => setMovementId(m.movement_id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Select ${m.name}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* input steppers */}
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
        onDec={() => setRpe((v) => clamp(v - 0.5, 5, 10))}
        onInc={() => setRpe((v) => clamp(v + 0.5, 5, 10))}
      />

      {/* primary action */}
      <Pressable
        disabled={!canLog}
        onPress={() => {
          if (movementId !== null) logSet(movementId, reps, loadKg, rpe);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Log set: ${reps} reps at ${loadKg.toFixed(1)} kilograms, RPE ${rpe.toFixed(1)}`}
        style={({ pressed }) => [
          styles.logBtn,
          pressed && styles.logBtnPressed,
          !canLog && styles.logBtnDisabled,
        ]}
      >
        <Text style={styles.logBtnText}>LOG SET</Text>
      </Pressable>

      {/* session log, newest first */}
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

      {/* footer: running tonnage + end */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>TONNAGE</Text>
          <Text style={styles.footerValue}>{Math.round(tonnage)} kg</Text>
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

  chipStrip: { flexGrow: 0, marginBottom: 8 },
  chipStripContent: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: palette.green, backgroundColor: '#10241D' },
  chipText: { color: palette.dim, fontSize: 16, fontWeight: '700' },
  chipTextActive: { color: palette.green },

  stepper: { marginTop: 10 },
  stepperLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2, marginBottom: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 72,
    height: 64,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: '#22222A' },
  stepBtnText: { color: palette.text, fontSize: 34, fontWeight: '700', lineHeight: 38 },
  stepperValue: {
    flex: 1,
    color: palette.text,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  logBtn: {
    height: 88,
    borderRadius: 16,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  logBtnPressed: { backgroundColor: '#26C28F' },
  logBtnDisabled: { backgroundColor: palette.line },
  logBtnText: { color: '#06251B', fontSize: 26, fontWeight: '800', letterSpacing: 3 },

  setList: { flex: 1, marginTop: 14 },
  emptyText: { color: palette.dim, textAlign: 'center', marginTop: 24, fontSize: 14 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 10,
    paddingVertical: 14,
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
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  endBtn: {
    minHeight: 64,
    minWidth: 120,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtnPressed: { backgroundColor: '#2A1416' },
  endBtnText: { color: palette.red, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
});
