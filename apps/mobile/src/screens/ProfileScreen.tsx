/**
 * ProfileScreen.tsx — the 10-category athlete questionnaire (ATHLETE tab).
 *
 * Every answer is a hard input to the prescription chain's profile-clamp
 * layer, persisted to the single-row user_profile table on change (no save
 * button to forget). Keyboard-light: chips for enums, ±steppers for numbers;
 * free text only for injury/mobility notes.
 *
 * Law 1: Zero hex literals in screen files — use theme tokens.
 * Law 2: Selected chips = inverted white fill (textHi fill, ink0 text). NOT chalk.
 * Law 3: Zero red/amber/green anywhere.
 * Law 4: Touch targets >= 56pt.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BIG4_LIFTS,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  HISTORY_IMPORT_AI_PROMPT,
  HISTORY_IMPORT_EXAMPLE,
  OBJECTIVES,
  parseHistoryImport,
  TRAINING_AGES,
  type EquipmentItem,
  type HistoryParseResult,
  type UserProfile,
} from '@ak/inference';
import { theme } from '../theme/theme';
import { useStore } from '../state/useStore';
import { useSubViewBack } from '../navigation/navigation';
import { Chip, Stepper, QuietAction, Disclosure, ListRow } from '../components/ui';
import InfoTip from '../components/InfoTip';

const OUTCOME_LABELS: Record<string, string> = {
  followed_plan: 'Plan followed',
  adapted_session: 'Session adapted',
  stopped_safely: 'Session stopped safely',
  session_recorded: 'Session recorded',
};

const formatFinalizedDate = (ms: number): string => {
  if (ms <= 0) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// ---------------------------------------------------------------------------
// Primitives consuming frozen components from components/ui
// ---------------------------------------------------------------------------
interface ChipRowProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  /** Glossary key — renders an ⓘ tooltip next to the label. */
  tip?: string;
  /** When true, every chip renders disabled and onSelect is not called. */
  disabled?: boolean;
}
function ChipRow<T extends string>({ label, options, value, onSelect, tip, disabled = false }: ChipRowProps<T>): React.JSX.Element {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {tip !== undefined && <InfoTip term={tip} />}
      </View>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt.replace(/_/g, ' ').toUpperCase()}
            selected={opt === value}
            disabled={disabled}
            onPress={() => { if (!disabled) onSelect(opt); }}
            accessibilityLabel={`${label}: ${opt.replace(/_/g, ' ')}`}
          />
        ))}
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
      {tip !== undefined && (
        <View style={styles.fieldLabelRow}>
          <InfoTip term={tip} />
        </View>
      )}
      <Stepper
        label={label}
        value={display}
        onDecrement={onDec}
        onIncrement={onInc}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// One-rep-max row: type the number directly (a 300 kg deadlifter must not
// tap +2.5 a hundred times); ± buttons remain for fine adjustment.
// ---------------------------------------------------------------------------
interface OneRmRowProps {
  label: string;
  valueKg: number | undefined;
  onChange: (kg: number | null) => void;
}
function OneRmRow({ label, valueKg, onChange }: OneRmRowProps): React.JSX.Element {
  const [text, setText] = useState(valueKg !== undefined ? valueKg.toFixed(1) : '');
  useEffect(() => {
    setText(valueKg !== undefined ? valueKg.toFixed(1) : '');
  }, [valueKg]);
  const commitText = (): void => {
    const parsed = Number.parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 20) {
      onChange(null); // empty/garbage/sub-20 clears the max
      setText('');
      return;
    }
    onChange(parsed); // store snaps to 2.5 and clamps 20..500
  };
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <Pressable
          onPress={() => { if (valueKg !== undefined) onChange(valueKg - 2.5 < 20 ? null : valueKg - 2.5); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label} one rep max`}
          style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
        >
          <Text style={styles.numBtnText}>−</Text>
        </Pressable>
        <TextInput
          style={styles.oneRmInput}
          value={text}
          onChangeText={setText}
          onEndEditing={commitText}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={theme.color.textLow}
          maxLength={6}
          accessibilityLabel={`${label} one rep max in kilograms, type to set`}
        />
        <Pressable
          onPress={() => onChange((valueKg ?? 57.5) + 2.5)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label} one rep max`}
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
  const uiPreferences = useStore((s) => s.uiPreferences);
  const saveUiPreferences = useStore((s) => s.saveUiPreferences);
  const loadPreference = useStore((s) => s.loadPreference);
  const saveLoadPreference = useStore((s) => s.saveLoadPreference);
  const bandLadder = useStore((s) => s.bandLadder);
  const saveBandLevel = useStore((s) => s.saveBandLevel);
  const deleteBandLevel = useStore((s) => s.deleteBandLevel);
  const movements = useStore((s) => s.movements);
  const oneRepMaxes = useStore((s) => s.oneRepMaxes);
  const saveOneRepMax = useStore((s) => s.saveOneRepMax);
  const biometricsStatus = useStore((s) => s.biometricsStatus);
  const syncBiometrics = useStore((s) => s.syncBiometrics);
  const requestBiometricsAccess = useStore((s) => s.requestBiometricsAccess);
  const profileSlots = useStore((s) => s.profileSlots);
  const switchProfile = useStore((s) => s.switchProfile);
  const wipeActiveBlockState = useStore((s) => s.wipeActiveBlockState);
  const session = useStore((s) => s.session);
  const athletes = useStore((s) => s.athletes);
  const activeAthleteId = useStore((s) => s.activeAthleteId);
  const switchAthlete = useStore((s) => s.switchAthlete);
  const createAthlete = useStore((s) => s.createAthlete);
  const renameAthleteEntry = useStore((s) => s.renameAthleteEntry);
  const deleteAthlete = useStore((s) => s.deleteAthlete);
  const loadRecentOutcomes = useStore((s) => s.loadRecentOutcomes);
  const today = useStore((s) => s.today);
  const importHistory = useStore((s) => s.importHistory);
  const saveBodyweight = useStore((s) => s.saveBodyweight);
  const loadMeasuredHistory = useStore((s) => s.loadMeasuredHistory);

  // Hydrate recent outcomes in effect (never query directly in render body!)
  const [recentOutcomes, setRecentOutcomes] = useState<{ outcomeKind: string; finalizedAtMs: number }[]>([]);
  useEffect(() => {
    setRecentOutcomes(loadRecentOutcomes(20));
  }, [activeAthleteId, session, loadRecentOutcomes]);

  useEffect(() => {
    setRecentMeasures(loadMeasuredHistory(14));
  }, [activeAthleteId, loadMeasuredHistory]);
  // In-canvas double-confirm states (P2 & P5)
  const [confirmingDeleteAthleteId, setConfirmingDeleteAthleteId] = useState<string | null>(null);
  const [confirmingWipeBlock, setConfirmingWipeBlock] = useState(false);
  const [confirmingSwitchProfileId, setConfirmingSwitchProfileId] = useState<number | null>(null);
  const [confirmingDeleteBandLevel, setConfirmingDeleteBandLevel] = useState<number | null>(null);
  const [historyText, setHistoryText] = useState('');
  const [historyPreview, setHistoryPreview] = useState<HistoryParseResult | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [importVerified, setImportVerified] = useState(false);
  const [includeImportReadiness, setIncludeImportReadiness] = useState(false);
  const [recentMeasures, setRecentMeasures] = useState<ReturnType<typeof loadMeasuredHistory>>([]);
  const [bodyweightText, setBodyweightText] = useState('');

  const hasConfirm = confirmingDeleteAthleteId !== null || confirmingWipeBlock || confirmingSwitchProfileId !== null || confirmingDeleteBandLevel !== null;
  useSubViewBack(hasConfirm, () => {
    if (confirmingDeleteAthleteId !== null) setConfirmingDeleteAthleteId(null);
    else if (confirmingWipeBlock) setConfirmingWipeBlock(false);
    else if (confirmingSwitchProfileId !== null) setConfirmingSwitchProfileId(null);
    else if (confirmingDeleteBandLevel !== null) setConfirmingDeleteBandLevel(null);
  });

  // Coach Mode local UI state (collapsed by default — a beginner never needs it).
  const [coachOpen, setCoachOpen] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [editAthleteName, setEditAthleteName] = useState('');

  const nextBandLevel = Math.min(20, (bandLadder.length > 0 ? bandLadder[bandLadder.length - 1]!.level : 0) + 1);

  // Free-text notes are committed on end-editing, not per keystroke.
  const [injuryText, setInjuryText] = useState(
    profile.injury_flags.map((f) => `${f.region}: ${f.note}`).join('\n'),
  );
  const [mobilityText, setMobilityText] = useState(
    profile.mobility_limits.map((f) => `${f.region}: ${f.note}`).join('\n'),
  );
  const activeSlotId = profileSlots.find((p) => p.isActive)?.slotId ?? null;
  useEffect(() => {
    setInjuryText(profile.injury_flags.map((f) => `${f.region}: ${f.note}`).join('\n'));
    setMobilityText(profile.mobility_limits.map((f) => `${f.region}: ${f.note}`).join('\n'));
  }, [activeSlotId]);

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.wordmark}>pikeMethods</Text>
      <Text style={styles.heading}>ATHLETE PROFILE</Text>
      <Text style={styles.subheading}>
        These answers are hard limits on every prescription — the coach can tighten
        them day to day, never exceed them.
      </Text>

      <View
        accessible
        accessibilityLabel="Training guidance safety notice. pikeMethods provides training guidance, not medical advice. It is not a medical device. Stop if something feels unsafe and seek qualified professional advice when needed."
        style={styles.safetyNotice}
        testID="training-guidance-safety-notice"
      >
        <Text style={styles.safetyTitle}>TRAINING GUIDANCE</Text>
        <Text style={styles.safetyText}>
          pikeMethods provides training guidance, not medical advice. It is not a medical device.
          Stop if something feels unsafe and seek qualified professional advice when needed.
        </Text>
      </View>

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
        disabled={session !== null}
        onSelect={(training_age) => saveProfile({ training_age })}
      />
      {session !== null && (
        <Text style={styles.fieldHint}>
          Training age cannot change during a session because it can change load authority.
        </Text>
      )}
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


      <View style={styles.field}>
        <Text style={styles.fieldLabel}>8 · HISTORICAL INJURIES (one per line, &quot;region: note&quot;)</Text>
        <TextInput
          style={styles.notesInput}
          value={injuryText}
          onChangeText={(t) => {
            setInjuryText(t);
            saveProfile({ injury_flags: parseNotes(t) });
          }}
          placeholder="knee: old MCL strain 2024"
          placeholderTextColor={theme.color.textLow}
          multiline
          accessibilityLabel="Historical injuries, one per line"
        />
        <Text style={styles.fieldHint}>
          Example — knee: old MCL strain 2024. Saved as you type.
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>9 · MOBILITY LIMITS (one per line)</Text>
        <TextInput
          style={styles.notesInput}
          value={mobilityText}
          onChangeText={(t) => {
            setMobilityText(t);
            saveProfile({ mobility_limits: parseNotes(t) });
          }}
          placeholder="ankle: limited dorsiflexion"
          placeholderTextColor={theme.color.textLow}
          multiline
          accessibilityLabel="Mobility limitations, one per line"
        />
        <Text style={styles.fieldHint}>
          Example — ankle: limited dorsiflexion. Saved as you type.
        </Text>
      </View>
      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>BIOMETRICS — HEALTH CONNECT</Text>
          <InfoTip term="HRV" />
        </View>
        <Text style={styles.fieldHint}>
          {biometricsStatus === 'ready'
            ? 'Connected. Overnight HRV, resting heart rate, and sleep feed your readiness score automatically — synced when the app comes to the foreground.'
            : biometricsStatus === 'idle'
              ? 'Health Connect is available. Tap CONNECT to grant read access to overnight HRV, resting heart rate, and sleep — the coach works fully without it.'
              : biometricsStatus === 'denied'
                ? 'Permission not granted. The coach still works fully from training data and your reports. Tap TRY AGAIN, or grant read access in Health Connect settings.'
                : biometricsStatus === 'unavailable'
                  ? 'Health Connect is not available on this device. The coach runs on training data and your reports — nothing else changes.'
                  : 'Checking Health Connect…'}
        </Text>
        {(biometricsStatus === 'idle' || biometricsStatus === 'denied') && (
          <Chip
            label={biometricsStatus === 'idle' ? 'CONNECT' : 'TRY AGAIN'}
            selected={false}
            onPress={() => { void requestBiometricsAccess(); }}
            accessibilityLabel="Connect Health Connect and grant read permissions"
          />
        )}
        {biometricsStatus === 'ready' && (
          <Chip
            label="SYNC NOW"
            selected={false}
            onPress={() => { void syncBiometrics(); }}
            accessibilityLabel="Sync biometrics from Health Connect now"
          />
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>ONE-REP MAXES (KG)</Text>
          <InfoTip term="1RM" />
        </View>
        <Text style={styles.fieldHint}>
          With a max set, SESSION shows real target kilograms for every planned
          lift. Type the number directly (snapped to 2.5 kg); ± fine-tunes.
          Clear it by typing 0.
        </Text>
        {BIG4_LIFTS.map(({ name, label }) => {
          const m = movements.find((x) => x.name === name);
          if (m === undefined) return null;
          return (
            <OneRmRow
              key={name}
              label={label}
              valueKg={oneRepMaxes[m.movement_id] as number | undefined}
              onChange={(kg) => saveOneRepMax(m.movement_id, kg)}
            />
          );
        })}
      </View>

      <View style={styles.mgmtSection}>
        <Text style={styles.mgmtHeading}>SESSION &amp; DISPLAY</Text>
        <Text style={styles.fieldHint}>
          These choices stay with this profile slot. Session mode changes start with your next session.
        </Text>
        <Text style={styles.fieldLabel}>SESSION MODE</Text>
        <View style={styles.chipWrap}>
          {([
            { value: null, label: 'USE TIER DEFAULT' },
            { value: 'guided' as const, label: 'GUIDED' },
            { value: 'self_directed' as const, label: 'SELF-DIRECTED' },
          ]).map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={uiPreferences.sessionModeOverride === option.value}
              onPress={() => saveUiPreferences({ sessionModeOverride: option.value })}
              accessibilityLabel={`${option.label}`}
            />
          ))}
        </View>
        <Text style={[styles.fieldLabel, styles.preferenceLabel]}>READINESS DETAIL</Text>
        <View style={styles.chipWrap}>
          {(['summary', 'full'] as const).map((value) => (
            <Chip
              key={value}
              label={value.toUpperCase()}
              selected={uiPreferences.readinessDetail === value}
              onPress={() => saveUiPreferences({ readinessDetail: value })}
              accessibilityLabel={`${value} readiness detail`}
            />
          ))}
        </View>
        <Text style={[styles.fieldLabel, styles.preferenceLabel]}>REST TIMER</Text>
        <Chip
          label={uiPreferences.restTimerEnabled ? 'ON' : 'OFF'}
          selected={uiPreferences.restTimerEnabled}
          onPress={() => saveUiPreferences({ restTimerEnabled: !uiPreferences.restTimerEnabled })}
          accessibilityLabel={`Rest timer ${uiPreferences.restTimerEnabled ? 'on' : 'off'}`}
        />
        <Text style={[styles.fieldLabel, styles.preferenceLabel]}>APP TEXT SIZE</Text>
        <View style={styles.chipWrap}>
          {(['system', 'large', 'extra_large'] as const).map((value) => (
            <Chip
              key={value}
              label={value.replace(/_/g, ' ').toUpperCase()}
              selected={uiPreferences.textScale === value}
              onPress={() => saveUiPreferences({ textScale: value })}
              accessibilityLabel={`${value.replace(/_/g, ' ')} text size`}
            />
          ))}
        </View>
        {profile.training_age !== 'beginner' && (
          <View testID="profile-load-selection-row">
            <Text style={[styles.fieldLabel, styles.preferenceLabel]}>LOAD SELECTION</Text>
            <View style={styles.chipWrap}>
              <Chip
                testID="profile-load-pref-auto"
                label="COACH SUGGESTS"
                selected={loadPreference === 'auto'}
                disabled={session !== null}
                onPress={() => saveLoadPreference('auto')}
                accessibilityLabel="Coach suggests loads from your numbers and history"
              />
              <Chip
                testID="profile-load-pref-manual"
                label="I CHOOSE"
                selected={loadPreference === 'manual'}
                disabled={session !== null}
                onPress={() => saveLoadPreference('manual')}
                accessibilityLabel="You choose every load yourself, with coach suggestions as reference"
              />
            </View>
            <Text style={styles.fieldHint}>
              {session !== null
                ? 'Finish the active session before changing load selection.'
                : 'Coach suggests loads from your numbers and history, or you choose every load yourself. Applies to your next session.'}
            </Text>
          </View>
        )}
        <Text style={styles.fieldHint}>
          Your device accessibility text size is always respected; this adds an optional app preference on top.
        </Text>
      </View>

      <View style={styles.mgmtSection}>
        <Text style={styles.mgmtHeading}>BAND LADDER</Text>
        <Text style={styles.fieldHint}>
          Name bands in the order they feel harder. The app records the level, never invents kilograms.
        </Text>
        {bandLadder.map((band) => (
          <View key={band.level} style={styles.bandRow}>
            <Text style={styles.bandLevel}>LEVEL {band.level}</Text>
            <TextInput
              defaultValue={band.label}
              onEndEditing={(event) => saveBandLevel(band.level, event.nativeEvent.text)}
              maxLength={48}
              style={styles.bandInput}
              accessibilityLabel={`Band level ${band.level} label`}
            />
            {confirmingDeleteBandLevel === band.level ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  Remove band level {band.level} ({band.label})?
                </Text>
                <QuietAction
                  label={`Confirm remove level ${band.level}`}
                  onPress={() => {
                    deleteBandLevel(band.level);
                    setConfirmingDeleteBandLevel(null);
                  }}
                  style={styles.confirmActionIsolated}
                />
                <QuietAction
                  label="Keep band level"
                  onPress={() => setConfirmingDeleteBandLevel(null)}
                />
              </View>
            ) : (
              <QuietAction
                label="REMOVE"
                onPress={() => setConfirmingDeleteBandLevel(band.level)}
                accessibilityLabel={`Remove band level ${band.level}`}
              />
            )}
          </View>
        ))}
        {nextBandLevel <= 20 && (
          <Chip
            label="ADD BAND LEVEL"
            selected={false}
            onPress={() => saveBandLevel(nextBandLevel, `Band ${nextBandLevel}`)}
            accessibilityLabel={`Add band level ${nextBandLevel}`}
          />
        )}
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
            <Chip
              key={preset}
              label={preset.replace(/_/g, ' ').toUpperCase()}
              selected={false}
              onPress={() => saveProfile({ equipment_inventory: [...EQUIPMENT_PRESETS[preset]] })}
              accessibilityLabel={`Use ${preset.replace(/_/g, ' ')} equipment preset`}
            />
          ))}
        </View>
        <View style={[styles.chipWrap, styles.inventoryWrap]}>
          {EQUIPMENT_ITEMS.map((item: EquipmentItem) => {
            const owned = profile.equipment_inventory.includes(item);
            return (
              <Chip
                key={item}
                label={item.replace(/_/g, ' ').toUpperCase()}
                selected={owned}
                onPress={() =>
                  saveProfile({
                    equipment_inventory: owned
                      ? profile.equipment_inventory.filter((i) => i !== item)
                      : [...profile.equipment_inventory, item],
                  })
                }
                accessibilityLabel={`${item.replace(/_/g, ' ')}, ${owned ? 'owned' : 'not owned'}`}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.mgmtSection}>
        <Text style={styles.mgmtHeading}>HISTORY &amp; MEASUREMENTS</Text>
        <Text style={styles.fieldHint}>
          Training history stays on this device. Imported sessions always appear in the timeline; only an explicitly verified import can support capability guidance. Recent imports stay outside readiness until you explicitly mark their load history complete.
        </Text>
        <Text style={styles.fieldLabel}>BODYWEIGHT TODAY (KG)</Text>
        <View style={styles.numberRow}>
          <TextInput
            style={styles.oneRmInput}
            value={bodyweightText}
            onChangeText={setBodyweightText}
            onEndEditing={() => {
              const value = Number.parseFloat(bodyweightText.replace(',', '.'));
              saveBodyweight(today, Number.isFinite(value) && value >= 20 ? value : null);
              setRecentMeasures(loadMeasuredHistory(14));
            }}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="Bodyweight today in kilograms"
          />
        </View>
        <Text style={styles.fieldHint}>Enter a measured value; blank clears today&apos;s manual entry.</Text>
        {recentMeasures.length > 0 && (
          <View style={styles.measureRows}>
            {recentMeasures.slice(0, 7).map((row) => (
              <ListRow
                key={row.date}
                label={row.date}
                detail={`${Math.round(row.tonnageKg)} kg load · ${row.setCount} sets${row.bodyweightKg === null ? '' : ` · ${row.bodyweightKg.toFixed(1)} kg BW`}`}
                style={styles.clinicalRow}
              />
            ))}
          </View>
        )}
        <Disclosure label="IMPORT TRAINING HISTORY">
          <Text style={styles.fieldHint}>
            Paste AK_HISTORY_V1 text, preview it, then explicitly choose whether the records are verified. Unknown movement names must be corrected before import.
          </Text>
          <Text selectable style={styles.importExampleBlock}>
            {HISTORY_IMPORT_EXAMPLE}
          </Text>
          <TextInput
            style={styles.importInput}
            value={historyText}
            onChangeText={(value) => { setHistoryText(value); setHistoryPreview(null); setHistoryNotice(null); }}
            multiline
            autoCapitalize="none"
            placeholder="Paste formatted history text here..."
            placeholderTextColor={theme.color.textLow}
            accessibilityLabel="Paste AK history import text"
          />
          <View style={styles.chipWrap}>
            <Chip
              label="PREVIEW"
              selected={false}
              onPress={() => setHistoryPreview(parseHistoryImport(historyText, movements.map((movement) => ({ movementId: movement.movement_id, name: movement.name }))))}
              accessibilityLabel="Preview history import without saving"
            />
            <Chip
              label={importVerified ? 'VERIFIED' : 'UNVERIFIED'}
              selected={importVerified}
              onPress={() => {
                setImportVerified(!importVerified);
                if (importVerified) setIncludeImportReadiness(false);
              }}
              accessibilityLabel="Toggle whether imported history is verified"
            />
            {importVerified && (
              <Chip
                label={includeImportReadiness ? 'LOAD COMPLETE' : 'EXCLUDE FROM READINESS'}
                selected={includeImportReadiness}
                onPress={() => setIncludeImportReadiness(!includeImportReadiness)}
                accessibilityLabel="Confirm this imported recent load history is complete for readiness"
              />
            )}
          </View>
          {historyPreview !== null && (
            <View style={styles.importPreview}>
              <Text style={styles.fieldHint}>
                {historyPreview.sessions.length} sessions · {historyPreview.errors.length} errors · {historyPreview.warnings.length} warnings
              </Text>
              {historyPreview.unknownMovementNames.length > 0 && (
                <Text style={styles.fieldHint}>Unknown: {historyPreview.unknownMovementNames.join(', ')}</Text>
              )}
              {historyPreview.errors.slice(0, 3).map((issue) => (
                <Text key={`${issue.line}-${issue.message}`} style={styles.fieldHint}>Line {issue.line}: {issue.message}</Text>
              ))}
              <Chip
                label="COMMIT IMPORT"
                selected={false}
                onPress={() => {
                  const result = importHistory(historyText, importVerified, includeImportReadiness);
                  setHistoryPreview(result.preview);
                  setHistoryNotice(result.committed
                    ? 'History imported. It is visible in the local timeline.'
                    : result.duplicate ? 'This exact import was already recorded.' : 'Import was not saved. Correct the preview issues first.');
                  if (result.committed) setRecentMeasures(loadMeasuredHistory(14));
                }}
                accessibilityLabel="Commit reviewed history import"
              />
            </View>
          )}
          {historyNotice !== null && <Text style={styles.fieldHint}>{historyNotice}</Text>}
          <Text selectable style={styles.fieldHint}>External-AI prompt: {HISTORY_IMPORT_AI_PROMPT}</Text>
        </Disclosure>
      </View>
      {/* ---- Training-Decisions Disclosure (P3: recent 20 outcomes, ink.1 hairlines) ---- */}
      <View style={styles.mgmtSection}>
        <Disclosure label="TRAINING-DECISIONS DISCLOSURE">
          {recentOutcomes.length === 0 ? (
            <Text style={styles.fieldHint}>No finalized session outcomes recorded yet.</Text>
          ) : (
            recentOutcomes.map((row, i) => (
              <ListRow
                key={`${row.finalizedAtMs}-${i}`}
                label={OUTCOME_LABELS[row.outcomeKind] ?? 'Session recorded'}
                detail={formatFinalizedDate(row.finalizedAtMs)}
                style={styles.clinicalRow}
              />
            ))
          )}
        </Disclosure>
      </View>

      {/* ---- Profile Management (local multi-tenancy + state wipe) ---- */}
      <View style={styles.mgmtSection}>
        <Text style={styles.mgmtHeading}>PROFILE MANAGEMENT</Text>
        <Text style={styles.fieldHint}>
          Switch the active profile to test how the coach plans for a different
          athlete. Switching saves the current profile, loads the chosen one, and
          WIPES the active block + today&apos;s reports so a fresh block generates.
          Logged training history is kept.
        </Text>
        <View style={styles.chipWrap}>
          {profileSlots.map((slot) => {
            const isConfirming = confirmingSwitchProfileId === slot.slotId;
            return (
              <View key={slot.slotId} style={styles.slotBlock}>
                <Chip
                  label={`${slot.name.toUpperCase()}${slot.isActive ? ' ✓' : ''}`}
                  selected={slot.isActive}
                  onPress={() => {
                    if (!slot.isActive) {
                      setConfirmingSwitchProfileId(isConfirming ? null : slot.slotId);
                    }
                  }}
                  accessibilityLabel={`${slot.name} profile${slot.isActive ? ', active' : ''}`}
                />
                {isConfirming && (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>
                      Switch to {slot.name}? Saves current profile, loads this one, and wipes active block.
                    </Text>
                    <QuietAction
                      label={`Confirm switch to ${slot.name}`}
                      onPress={() => {
                        switchProfile(slot.slotId);
                        setConfirmingSwitchProfileId(null);
                      }}
                      style={styles.confirmActionIsolated}
                    />
                    <QuietAction
                      label="Cancel switch"
                      onPress={() => setConfirmingSwitchProfileId(null)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {session !== null ? (
          <Text style={styles.fieldHint}>End the active session before deleting the block.</Text>
        ) : !confirmingWipeBlock ? (
          <QuietAction
            label="DELETE CURRENT BLOCK & STATE"
            onPress={() => setConfirmingWipeBlock(true)}
            accessibilityLabel="Delete the current block and today's state"
            style={styles.wipeAction}
          />
        ) : (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              Hard-deletes the active 4-week block and today&apos;s injury reports/niggles so you can regenerate a fresh block. Logged sessions and history are kept. This cannot be undone.
            </Text>
            <QuietAction
              label="Confirm delete current block & state"
              onPress={() => {
                wipeActiveBlockState();
                setConfirmingWipeBlock(false);
              }}
              style={styles.confirmActionIsolated}
            />
            <QuietAction
              label="Keep current block"
              onPress={() => setConfirmingWipeBlock(false)}
            />
          </View>
        )}
      </View>

      {/* ---- Coach Mode (Phase 15): one database file per athlete ---- */}
      <View style={styles.mgmtSection}>
        <Pressable
          onPress={() => setCoachOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: coachOpen }}
          accessibilityLabel={`Coach mode, ${athletes.length} athletes, ${coachOpen ? 'expanded' : 'collapsed'}`}
          style={styles.coachHeader}
        >
          <Text style={styles.mgmtHeading}>COACH MODE</Text>
          <Text style={styles.coachToggle}>
            {athletes.length} {coachOpen ? '▾' : '▸'}
          </Text>
        </Pressable>
        {coachOpen && (
          <View>
            <Text style={styles.fieldHint}>
              Every athlete here owns a fully separate training database —
              sessions, readiness, blocks, and profile never mix. Unlike the
              profile switch above, NOTHING is shared. Built for coaching (or
              testing) several people on one phone.
            </Text>
            {athletes.map((a) => {
              const isActive = a.id === activeAthleteId;
              const deletable = !isActive && a.id !== 'default';
              const isConfirmingDelete = confirmingDeleteAthleteId === a.id;
              if (editingAthleteId === a.id) {
                return (
                  <View key={a.id} style={styles.athleteRow}>
                    <TextInput
                      style={styles.athleteEditInput}
                      value={editAthleteName}
                      onChangeText={setEditAthleteName}
                      maxLength={24}
                      autoFocus
                      accessibilityLabel={`New name for ${a.name}`}
                    />
                    <QuietAction
                      label="SAVE"
                      onPress={() => {
                        renameAthleteEntry(a.id, editAthleteName);
                        setEditingAthleteId(null);
                      }}
                      accessibilityLabel="Save name"
                    />
                    <QuietAction
                      label="CANCEL"
                      onPress={() => setEditingAthleteId(null)}
                      accessibilityLabel="Cancel rename"
                    />
                  </View>
                );
              }
              return (
                <View key={a.id} style={styles.athleteBlock}>
                  <View style={styles.athleteRow}>
                    <Pressable
                      style={styles.athleteMain}
                      disabled={isActive}
                      onPress={() => switchAthlete(a.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Athlete ${a.name}${isActive ? ', active' : ', tap to switch'}`}
                    >
                      <Text style={[styles.athleteName, isActive && styles.athleteNameActive]}>
                        {a.name.toUpperCase()}{isActive ? '  ✓ ACTIVE' : ''}
                      </Text>
                    </Pressable>
                    <QuietAction
                      label="RENAME"
                      onPress={() => {
                        setEditingAthleteId(a.id);
                        setEditAthleteName(a.name);
                      }}
                      accessibilityLabel={`Rename ${a.name}`}
                    />
                    {deletable && (
                      <QuietAction
                        label="DELETE"
                        onPress={() => setConfirmingDeleteAthleteId(isConfirmingDelete ? null : a.id)}
                        accessibilityLabel={`Delete ${a.name} and their database`}
                      />
                    )}
                  </View>
                  {isConfirmingDelete && (
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmText}>
                        Confirm delete — this removes {a.name} AND their entire training database. This cannot be undone.
                      </Text>
                      <QuietAction
                        label={`Confirm delete ${a.name}`}
                        onPress={() => {
                          deleteAthlete(a.id);
                          setConfirmingDeleteAthleteId(null);
                        }}
                        style={styles.confirmActionIsolated}
                      />
                      <QuietAction
                        label="Keep athlete"
                        onPress={() => setConfirmingDeleteAthleteId(null)}
                      />
                    </View>
                  )}
                </View>
              );
            })}
            <View style={styles.athleteRow}>
              <TextInput
                style={styles.athleteEditInput}
                value={newAthleteName}
                onChangeText={setNewAthleteName}
                placeholder="New athlete's name"
                placeholderTextColor={theme.color.textLow}
                maxLength={24}
                accessibilityLabel="New athlete's name"
              />
              <QuietAction
                label="ADD ATHLETE"
                onPress={() => {
                  const trimmed = newAthleteName.trim();
                  createAthlete(trimmed.length > 0 ? trimmed : 'New Athlete');
                  setNewAthleteName('');
                }}
                accessibilityLabel="Add a new athlete"
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ink0 },
  content: { padding: theme.space[4], paddingBottom: theme.space[6] }, // 32 — matches other screens
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    marginBottom: theme.space[1],
  },
  heading: { ...theme.font.title, color: theme.color.textHi },
  safetyNotice: {
    backgroundColor: theme.color.ink1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    marginBottom: theme.space[4],
    padding: theme.space[3],
  },
  safetyTitle: { ...theme.font.eyebrow, color: theme.color.textHi, marginBottom: theme.space[1] },
  safetyText: { ...theme.font.label, color: theme.color.textMid },
  mgmtSection: {
    marginTop: theme.space[3],
    paddingTop: theme.space[4],
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
  },
  mgmtHeading: { ...theme.font.cue, color: theme.color.textHi, marginBottom: theme.space[2] },
  subheading: { ...theme.font.body, color: theme.color.textMid, marginTop: theme.space[1], marginBottom: theme.space[4] },
  field: { marginBottom: theme.space[4] },
  fieldLabel: { ...theme.font.eyebrow, color: theme.color.textLow },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space[2] },
  fieldHint: { ...theme.font.label, color: theme.color.textMid, marginBottom: theme.space[2] },
  inventoryWrap: { marginTop: theme.space[2] },
  preferenceLabel: { marginTop: theme.space[4], marginBottom: theme.space[2] },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2], marginBottom: theme.space[2] },
  bandLevel: { width: 68, ...theme.font.label, color: theme.color.textLow },
  bandInput: {
    flex: 1, minHeight: theme.touch.min, borderRadius: theme.radius.control, backgroundColor: theme.color.ink1,
    borderWidth: 1, borderColor: theme.color.line, color: theme.color.textHi, ...theme.font.body, paddingHorizontal: theme.space[3],
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  numBtn: {
    width: theme.touch.min,
    height: theme.touch.min,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnPressed: { backgroundColor: theme.color.ink0 },
  numBtnText: { color: theme.color.textHi, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  oneRmInput: {
    flex: 1,
    minHeight: theme.touch.min,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textHi,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: theme.space[1],
  },
  notesInput: {
    minHeight: 72,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textHi,
    ...theme.font.body,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    textAlignVertical: 'top',
  },
  measureRows: { marginTop: theme.space[2], borderTopWidth: 1, borderTopColor: theme.color.line },
  importInput: {
    minHeight: 144,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textHi,
    ...theme.font.label,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    textAlignVertical: 'top',
    marginBottom: theme.space[2],
  },
  importExampleBlock: {
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textMid,
    ...theme.font.label,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    marginBottom: theme.space[2],
  },
  importPreview: { marginTop: theme.space[2], gap: theme.space[2] },  coachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: theme.touch.min,
  },
  coachToggle: { ...theme.font.body, color: theme.color.textMid },
  athleteBlock: { marginBottom: theme.space[2] },
  athleteRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2], marginBottom: theme.space[2] },
  athleteMain: {
    flex: 1,
    minHeight: theme.touch.min,
    justifyContent: 'center',
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  athleteName: { ...theme.font.body, color: theme.color.textMid },
  athleteNameActive: { color: theme.color.textHi, fontWeight: '700' },
  athleteEditInput: {
    flex: 1,
    minHeight: theme.touch.min,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    color: theme.color.textHi,
    ...theme.font.body,
    paddingHorizontal: theme.space[3],
  },
  wipeAction: {
    marginTop: theme.space[3],
  },
  slotBlock: {
    marginBottom: theme.space[2],
  },
  confirmBox: {
    backgroundColor: theme.color.ink1,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: theme.space[4], // 16pt padding
    marginTop: theme.space[4], // >=16pt isolation
    marginBottom: theme.space[4], // >=16pt isolation
    gap: theme.space[4], // >=16pt isolation between elements inside confirm box
  },
  confirmText: {
    ...theme.font.body,
    color: theme.color.textHi,
  },
  confirmActionIsolated: {
    marginTop: theme.space[4], // >=16pt isolation per Law 4 & F2 spec
  },
  clinicalRow: {
    borderBottomColor: theme.color.ink1,
  },
});
