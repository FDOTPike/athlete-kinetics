/**
 * ProfileScreen.tsx — the 10-category athlete questionnaire (ATHLETE tab).
 *
 * Every answer is a hard input to the prescription chain's profile-clamp
 * layer, persisted to the single-row user_profile table on change (no save
 * button to forget). Keyboard-light: chips for enums, ±steppers for numbers;
 * free text only for injury/mobility notes.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  OBJECTIVES,
  PROGRESSION_METHODS,
  TRAINING_AGES,
  type EquipmentItem,
  type UserProfile,
} from '@ak/inference';
import { palette, useStore } from '../state/useStore';
import InfoTip from '../components/InfoTip';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
interface ChipRowProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  /** Glossary key — renders an ⓘ tooltip next to the label. */
  tip?: string;
}
function ChipRow<T extends string>({ label, options, value, onSelect, tip }: ChipRowProps<T>): React.JSX.Element {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {tip !== undefined && <InfoTip term={tip} />}
      </View>
      <View style={styles.chipWrap}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${opt.replace(/_/g, ' ')}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface NumberRowProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  tip?: string;
}
function NumberRow({ label, display, onDec, onInc, tip }: NumberRowProps): React.JSX.Element {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {tip !== undefined && <InfoTip term={tip} />}
      </View>
      <View style={styles.numberRow}>
        <Pressable
          onPress={onDec}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
        >
          <Text style={styles.numBtnText}>−</Text>
        </Pressable>
        <Text style={styles.numValue} accessibilityLabel={`${label} ${display}`}>
          {display}
        </Text>
        <Pressable
          onPress={onInc}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
        >
          <Text style={styles.numBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function ProfileScreen(): React.JSX.Element {
  const profile = useStore((s) => s.profile);
  const saveProfile = useStore((s) => s.saveProfile);

  // Free-text notes are committed on end-editing, not per keystroke.
  const [injuryText, setInjuryText] = useState(
    profile.injury_flags.map((f) => `${f.region}: ${f.note}`).join('\n'),
  );
  const [mobilityText, setMobilityText] = useState(
    profile.mobility_limits.map((f) => `${f.region}: ${f.note}`).join('\n'),
  );

  const parseNotes = (text: string): UserProfile['injury_flags'] =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const idx = line.indexOf(':');
        return idx > 0
          ? { region: line.slice(0, idx).trim(), note: line.slice(idx + 1).trim() }
          : { region: line, note: '' };
      });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>ATHLETE PROFILE</Text>
      <Text style={styles.subheading}>
        These answers are hard limits on every prescription — the coach can tighten
        them day to day, never exceed them.
      </Text>

      <ChipRow
        label="1 · OBJECTIVE"
        tip="GPP"
        options={OBJECTIVES}
        value={profile.objective}
        onSelect={(objective) => saveProfile({ objective })}
      />
      <ChipRow
        label="2 · TRAINING AGE"
        options={TRAINING_AGES}
        value={profile.training_age}
        onSelect={(training_age) => saveProfile({ training_age })}
      />
      <NumberRow
        label="3 · TRAINING DAYS PER WEEK"
        display={String(profile.weekly_frequency)}
        onDec={() => saveProfile({ weekly_frequency: profile.weekly_frequency - 1 })}
        onInc={() => saveProfile({ weekly_frequency: profile.weekly_frequency + 1 })}
      />
      <NumberRow
        label="4 · MAX SESSIONS PER DAY"
        display={String(profile.max_sessions_per_day)}
        onDec={() => saveProfile({ max_sessions_per_day: profile.max_sessions_per_day - 1 })}
        onInc={() => saveProfile({ max_sessions_per_day: profile.max_sessions_per_day + 1 })}
      />
      <NumberRow
        label="5 · SESSION DURATION CAP (MIN)"
        display={String(profile.session_duration_cap_min)}
        onDec={() => saveProfile({ session_duration_cap_min: profile.session_duration_cap_min - 15 })}
        onInc={() => saveProfile({ session_duration_cap_min: profile.session_duration_cap_min + 15 })}
      />
      <NumberRow
        label="6 · BASE EFFORT CEILING (RPE)"
        tip="RPE"
        display={profile.base_rpe_cap.toFixed(1)}
        onDec={() => saveProfile({ base_rpe_cap: profile.base_rpe_cap - 0.5 })}
        onInc={() => saveProfile({ base_rpe_cap: profile.base_rpe_cap + 0.5 })}
      />
      <ChipRow
        label="7 · TARGET ENERGY SYSTEM"
        tip="ATP-PC"
        options={ENERGY_SYSTEMS}
        value={profile.target_energy_system}
        onSelect={(target_energy_system) => saveProfile({ target_energy_system })}
      />
      <ChipRow
        label="8 · PROGRESSION METHODOLOGY"
        options={PROGRESSION_METHODS}
        value={profile.progression_methodology}
        onSelect={(progression_methodology) => saveProfile({ progression_methodology })}
      />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>9 · HISTORICAL INJURIES (one per line, &quot;region: note&quot;)</Text>
        <TextInput
          style={styles.notesInput}
          value={injuryText}
          onChangeText={setInjuryText}
          onEndEditing={() => saveProfile({ injury_flags: parseNotes(injuryText) })}
          placeholder="knee: old MCL strain 2024"
          placeholderTextColor={palette.dim}
          multiline
          accessibilityLabel="Historical injuries, one per line"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>10 · MOBILITY LIMITS (one per line)</Text>
        <TextInput
          style={styles.notesInput}
          value={mobilityText}
          onChangeText={setMobilityText}
          onEndEditing={() => saveProfile({ mobility_limits: parseNotes(mobilityText) })}
          placeholder="ankle: limited dorsiflexion"
          placeholderTextColor={palette.dim}
          multiline
          accessibilityLabel="Mobility limitations, one per line"
        />
      </View>
      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>EQUIPMENT INVENTORY</Text>
        </View>
        <Text style={styles.fieldHint}>
          Workouts only ever prescribe movements your equipment can support.
        </Text>
        <View style={styles.chipWrap}>
          {(Object.keys(EQUIPMENT_PRESETS) as (keyof typeof EQUIPMENT_PRESETS)[]).map((preset) => (
            <Pressable
              key={preset}
              onPress={() => saveProfile({ equipment_inventory: [...EQUIPMENT_PRESETS[preset]] })}
              accessibilityRole="button"
              accessibilityLabel={`Use ${preset.replace(/_/g, ' ')} equipment preset`}
              style={styles.presetChip}
            >
              <Text style={styles.presetChipText}>{preset.replace(/_/g, ' ').toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.chipWrap, styles.inventoryWrap]}>
          {EQUIPMENT_ITEMS.map((item: EquipmentItem) => {
            const owned = profile.equipment_inventory.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() =>
                  saveProfile({
                    equipment_inventory: owned
                      ? profile.equipment_inventory.filter((i) => i !== item)
                      : [...profile.equipment_inventory, item],
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: owned }}
                accessibilityLabel={`${item.replace(/_/g, ' ')}, ${owned ? 'owned' : 'not owned'}`}
                style={[styles.chip, owned && styles.chipActive]}
              >
                <Text style={[styles.chipText, owned && styles.chipTextActive]}>
                  {item.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 48 },
  heading: { color: palette.text, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  subheading: { color: palette.dim, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 18 },
  field: { marginBottom: 18 },
  fieldLabel: { color: palette.dim, fontSize: 12, letterSpacing: 1.5 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fieldHint: { color: palette.dim, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  presetChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: { color: palette.amber, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  inventoryWrap: { marginTop: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: palette.green, backgroundColor: '#10241D' },
  chipText: { color: palette.dim, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: palette.green },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numBtn: {
    width: 64,
    height: 56,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnPressed: { backgroundColor: '#22222A' },
  numBtnText: { color: palette.text, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  numValue: {
    flex: 1,
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  notesInput: {
    minHeight: 72,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
});
