/**
 * OnboardingScreen.tsx — first-run questionnaire (Phase 15 Step 2).
 *
 * The interview a real coach gives a new athlete: ONE decision per screen,
 * plain language, big targets, sensible defaults on everything. Answers are
 * held in a local draft and committed in a SINGLE completeOnboarding() call —
 * no partial profiles can ever be persisted by an abandoned wizard.
 *
 * Information-overload principle (rev4 plan, P15/P16): a BEGINNER is never
 * shown the programming-science decisions (energy system, periodization) —
 * those steps are skipped and safe defaults applied (hybrid + autoregulated,
 * which is also DEFAULT_PROFILE). Advanced athletes get every screen.
 *
 * Law 1: Zero hex literals in screen files — use theme tokens.
 * Law 2: Selected cards/chips = inverted white fill (textHi fill, ink0 text). NOT chalk.
 * Law 3: Zero red/amber/green anywhere.
 * Law 4: Touch targets >= 56pt.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DEFAULT_PROFILE,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  OBJECTIVES,
  TRAINING_AGES,
  defaultLoadPreference,
  transitionLoadPreference,
  type EnergySystem,
  type EquipmentItem,
  type LoadPreference,
  type Objective,
  type TrainingAge,
  type UserProfile,
} from '@ak/inference';
import { theme } from '../theme/theme';
import { useStore } from '../state/useStore';
import { useSubViewBack } from '../navigation/navigation';
import { Chip, Stepper, QuietAction, PrimaryButton } from '../components/ui';

// ---------------------------------------------------------------------------
// Copy: plain-language labels + one-liners for every enum the wizard shows.
// ---------------------------------------------------------------------------
const OBJECTIVE_COPY: Record<Objective, { label: string; blurb: string }> = {
  strength: { label: 'GET STRONGER', blurb: 'Lift heavier on the big lifts' },
  hypertrophy: { label: 'BUILD MUSCLE', blurb: 'Size first, the numbers follow' },
  power: { label: 'GET EXPLOSIVE', blurb: 'Speed and force for sport' },
  endurance: { label: 'LAST LONGER', blurb: 'Engine work, higher reps' },
  gpp: { label: 'ALL-ROUND FITNESS', blurb: 'Strong, capable, ready for anything' },
  hybrid: { label: 'STRENGTH + ENGINE', blurb: 'Lift heavy and stay conditioned' },
  rehab: { label: 'REBUILD', blurb: 'Coming back from an injury, carefully' },
  weight_loss: { label: 'LOSE WEIGHT', blurb: 'Drop fat while keeping muscle' },
};

const AGE_COPY: Record<TrainingAge, { label: string; blurb: string }> = {
  beginner: { label: 'NEW TO THIS', blurb: 'Under a year of consistent training, or returning after a long break' },
  intermediate: { label: 'SOME MILEAGE', blurb: '1–3 years — the basic lifts feel familiar' },
  advanced: { label: 'EXPERIENCED', blurb: '3+ years of structured training' },
  elite: { label: 'COMPETITIVE', blurb: 'Competing, or training at that level' },
};

const ENERGY_COPY: Record<EnergySystem, { label: string; blurb: string }> = {
  aerobic: { label: 'AEROBIC', blurb: 'Long, steady work — the endurance engine' },
  anaerobic: { label: 'ANAEROBIC', blurb: 'Hard rounds and repeats — grappling pace' },
  atp_pc: { label: 'PURE POWER', blurb: 'Short maximal efforts, full rest' },
  hybrid: { label: 'MIXED', blurb: 'A blend — the default for most athletes' },
};

const LOAD_PREFERENCE_COPY: Record<LoadPreference, { label: string; blurb: string }> = {
  auto: { label: 'COACH SUGGESTS', blurb: 'Targets come from your numbers and history. You can always adjust before logging.' },
  manual: { label: 'I CHOOSE', blurb: 'You set every load. Coach suggestions appear as reference only.' },
};

const EQUIPMENT_LABEL: Record<EquipmentItem, string> = {
  barbell: 'BARBELL', squat_rack: 'SQUAT RACK', bench: 'BENCH', dumbbells: 'DUMBBELLS',
  kettlebell: 'KETTLEBELL', pullup_bar: 'PULL-UP BAR', nordic_bench: 'NORDIC BENCH',
  bands: 'BANDS', cable_machine: 'CABLE MACHINE', mats: 'MATS',
};

/** Plain-language read of an RPE effort cap, shown live under the stepper. */
const effortBlurb = (rpe: number): string => {
  if (rpe <= 7.0) return 'Comfortable — always plenty left in the tank.';
  if (rpe <= 8.5) return 'Hard but controlled — a couple of reps always in reserve.';
  if (rpe <= 9.5) return 'Close to the limit on the biggest days.';
  return 'True max efforts allowed. Earn this one.';
};

type StepKey =
  | 'welcome' | 'goal' | 'experience' | 'schedule' | 'time' | 'effort'
  | 'loads' | 'science' | 'body' | 'equipment' | 'summary';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function OnboardingScreen(): React.JSX.Element {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const loadDemoAthlete = useStore((s) => s.loadDemoAthlete);
  const athletes = useStore((s) => s.athletes);
  const activeAthleteId = useStore((s) => s.activeAthleteId);

  const registryName = athletes.find((a) => a.id === activeAthleteId)?.name ?? '';
  const [draft, setDraft] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [name, setName] = useState(registryName === 'Athlete 1' ? '' : registryName);
  const [injuryText, setInjuryText] = useState('');
  const [mobilityText, setMobilityText] = useState('');
  const [stepIdx, setStepIdx] = useState(0);
  // Four-mode load selection (WO_FOUR_MODE_LOAD): the durable two-way
  // preference rides the wizard as draft state and commits in the same
  // transaction as the profile. `loadPreferenceExplicit` flips true ONLY when
  // the athlete presses a chip on the loads step — a value that came from a
  // tier default is not explicit and re-derives on tier change.
  const [loadPreference, setLoadPreference] = useState<LoadPreference>(defaultLoadPreference(DEFAULT_PROFILE.training_age));
  const [loadPreferenceExplicit, setLoadPreferenceExplicit] = useState(false);

  useSubViewBack(stepIdx > 0, () => setStepIdx((i) => Math.max(0, i - 1)));

  const patch = (p: Partial<UserProfile>): void => setDraft((d) => ({ ...d, ...p }));

  const selectTrainingAge = (age: TrainingAge): void => {
    const prior = draft.training_age;
    patch({ training_age: age });
    setLoadPreference((current) => transitionLoadPreference(prior, age, current, loadPreferenceExplicit));
    if (age === 'beginner') setLoadPreferenceExplicit(false);
  };

  const chooseLoadPreference = (preference: LoadPreference): void => {
    setLoadPreference(preference);
    setLoadPreferenceExplicit(true);
  };

  const steps: StepKey[] = useMemo(
    () =>
      draft.training_age === 'beginner'
        ? ['welcome', 'goal', 'experience', 'schedule', 'time', 'effort', 'body', 'equipment', 'summary']
        : ['welcome', 'goal', 'experience', 'schedule', 'time', 'effort', 'loads', 'science', 'body', 'equipment', 'summary'],
    [draft.training_age],
  );
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = step === 'summary';

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

  const finish = (): void => {
    completeOnboarding(
      { ...draft, injury_flags: parseNotes(injuryText), mobility_limits: parseNotes(mobilityText) },
      name.trim().length > 0 ? name : 'Athlete 1',
      loadPreference,
      loadPreferenceExplicit,
    );
  };

  const finishWithDemo = (): void => {
    loadDemoAthlete();
    completeOnboarding({}, name.trim().length > 0 ? name : 'Demo Athlete');
  };

  const toggleEquipment = (item: EquipmentItem): void => {
    const owned = new Set(draft.equipment_inventory);
    if (owned.has(item)) owned.delete(item);
    else owned.add(item);
    patch({ equipment_inventory: EQUIPMENT_ITEMS.filter((i) => owned.has(i)) });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>pikeMethods</Text>

      {/* Progress dots (P4 ruling: keep as-is with chalk on current dot) */}
      <View style={styles.dots} accessibilityLabel={`Step ${stepIdx + 1} of ${steps.length}`}>
        {steps.map((k, i) => (
          <View key={k} style={[styles.dot, i === stepIdx && styles.dotActive, i < stepIdx && styles.dotDone]} />
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        {step === 'welcome' && (
          <View>
            <Text style={styles.h1}>YOUR COACH.{'\n'}IN YOUR POCKET.{'\n'}OFFLINE.</Text>
            <Text style={styles.p}>
              A few quick questions build your profile. Everything stays on this
              phone — no account, no cloud, nothing leaves the device.
            </Text>
            <Text style={styles.fieldLabel}>WHAT SHOULD I CALL YOU?</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.color.textLow}
              maxLength={24}
              accessibilityLabel="Your name"
            />
            <QuietAction
              label="Just exploring? Load the demo athlete →"
              onPress={finishWithDemo}
              accessibilityLabel="Skip the questionnaire and load the demo athlete"
              style={styles.demoLink}
            />
          </View>
        )}

        {step === 'goal' && (
          <View style={styles.cardGroup}>
            <Text style={styles.h2}>WHAT ARE WE TRAINING FOR?</Text>
            {OBJECTIVES.map((o) => (
              <Chip
                key={o}
                label={`${OBJECTIVE_COPY[o].label} — ${OBJECTIVE_COPY[o].blurb}`}
                selected={draft.objective === o}
                onPress={() => patch({ objective: o })}
                accessibilityLabel={`${OBJECTIVE_COPY[o].label}. ${OBJECTIVE_COPY[o].blurb}`}
                style={styles.cardChip}
              />
            ))}
          </View>
        )}

        {step === 'experience' && (
          <View style={styles.cardGroup}>
            <Text style={styles.h2}>HOW LONG HAVE YOU BEEN TRAINING?</Text>
            <Text style={styles.pDim}>Be honest — the coach calibrates everything to this.</Text>
            {TRAINING_AGES.map((a) => (
              <Chip
                key={a}
                label={`${AGE_COPY[a].label} — ${AGE_COPY[a].blurb}`}
                selected={draft.training_age === a}
                onPress={() => selectTrainingAge(a)}
                accessibilityLabel={`${AGE_COPY[a].label}. ${AGE_COPY[a].blurb}`}
                style={styles.cardChip}
              />
            ))}
          </View>
        )}

        {step === 'schedule' && (
          <View>
            <Text style={styles.h2}>YOUR WEEK</Text>
            <Stepper
              label="TRAINING DAYS PER WEEK"
              value={String(draft.weekly_frequency)}
              onDecrement={() => patch({ weekly_frequency: Math.max(1, draft.weekly_frequency - 1) })}
              onIncrement={() => patch({ weekly_frequency: Math.min(7, draft.weekly_frequency + 1) })}
              style={styles.stepperBlock}
            />
            <Stepper
              label="MAX SESSIONS IN ONE DAY"
              value={String(draft.max_sessions_per_day)}
              onDecrement={() => patch({ max_sessions_per_day: Math.max(1, draft.max_sessions_per_day - 1) })}
              onIncrement={() => patch({ max_sessions_per_day: Math.min(3, draft.max_sessions_per_day + 1) })}
              style={styles.stepperBlock}
            />
            <Text style={styles.pDim}>
              The coach treats these as hard limits — extra work past them gets
              damped, not rewarded.
            </Text>
          </View>
        )}

        {step === 'time' && (
          <View>
            <Text style={styles.h2}>HOW LONG IS A SESSION?</Text>
            <Stepper
              label="MINUTES, TOPS"
              value={`${draft.session_duration_cap_min} min`}
              onDecrement={() => patch({ session_duration_cap_min: Math.max(15, draft.session_duration_cap_min - 15) })}
              onIncrement={() => patch({ session_duration_cap_min: Math.min(240, draft.session_duration_cap_min + 15) })}
              style={styles.stepperBlock}
            />
            <Text style={styles.pDim}>A realistic ceiling beats an optimistic one.</Text>
          </View>
        )}

        {step === 'effort' && (
          <View>
            <Text style={styles.h2}>HOW HARD SHOULD HARD DAYS GET?</Text>
            <Text style={styles.pDim}>
              Effort is measured 5–10 (RPE): 10 means nothing left, 8 means about
              two more reps were in you. This is a ceiling the coach can never
              prescribe past.
            </Text>
            <Stepper
              label="EFFORT CEILING (RPE)"
              value={draft.base_rpe_cap.toFixed(1)}
              onDecrement={() => patch({ base_rpe_cap: Math.max(5, draft.base_rpe_cap - 0.5) })}
              onIncrement={() => patch({ base_rpe_cap: Math.min(10, draft.base_rpe_cap + 0.5) })}
              style={styles.stepperBlock}
            />
            <Text style={styles.p}>{effortBlurb(draft.base_rpe_cap)}</Text>
            {draft.training_age === 'beginner' && draft.base_rpe_cap > 8.5 && (
              <Text style={styles.note}>
                Heads up: while you&apos;re new, the coach caps effort at 8.5 anyway —
                you&apos;ll grow into the rest.
              </Text>
            )}
          </View>
        )}

        {step === 'loads' && (
          <View style={styles.cardGroup} testID="onboarding-loads-step">
            <Text style={styles.h2}>WHO PICKS THE WEIGHTS?</Text>
            <Text style={styles.pDim}>
              You can change this later in the ATHLETE tab when no session is active.
            </Text>
            {(['auto', 'manual'] as const).map((p) => (
              <Chip
                key={p}
                testID={p === 'auto' ? 'onboarding-loads-auto' : 'onboarding-loads-manual'}
                label={`${LOAD_PREFERENCE_COPY[p].label} — ${LOAD_PREFERENCE_COPY[p].blurb}`}
                selected={loadPreference === p}
                onPress={() => chooseLoadPreference(p)}
                accessibilityLabel={p === 'auto'
                  ? 'Coach suggests. Targets come from your numbers and history.'
                  : 'I choose. You set every load, with coach suggestions as reference.'}
                style={styles.cardChip}
              />
            ))}
          </View>
        )}

        {step === 'science' && (
          <View style={styles.cardGroup}>
            <Text style={styles.h2}>THE SCIENCE BITS</Text>
            <Text style={styles.fieldLabel}>ENERGY FOCUS</Text>
            {ENERGY_SYSTEMS.map((e) => (
              <Chip
                key={e}
                label={`${ENERGY_COPY[e].label} — ${ENERGY_COPY[e].blurb}`}
                selected={draft.target_energy_system === e}
                onPress={() => patch({ target_energy_system: e })}
                accessibilityLabel={`${ENERGY_COPY[e].label}. ${ENERGY_COPY[e].blurb}`}
                style={styles.cardChip}
              />
            ))}
          </View>
        )}

        {step === 'body' && (
          <View>
            <Text style={styles.h2}>ANYTHING I SHOULD KNOW?</Text>
            <Text style={styles.pDim}>
              One per line, like &quot;knee: old ACL, careful with deep squats&quot;.
              Leave empty if nothing applies — you can add these any time.
            </Text>
            <Text style={styles.fieldLabel}>PAST INJURIES</Text>
            <TextInput
              style={styles.notesInput}
              value={injuryText}
              onChangeText={setInjuryText}
              multiline
              placeholder="shoulder: dislocated 2023"
              placeholderTextColor={theme.color.textLow}
              accessibilityLabel="Past injuries, one per line as region colon note"
            />
            <Text style={styles.fieldLabel}>MOBILITY LIMITS</Text>
            <TextInput
              style={styles.notesInput}
              value={mobilityText}
              onChangeText={setMobilityText}
              multiline
              placeholder="ankles: can't hit depth without heel lift"
              placeholderTextColor={theme.color.textLow}
              accessibilityLabel="Mobility limits, one per line as region colon note"
            />
          </View>
        )}

        {step === 'equipment' && (
          <View>
            <Text style={styles.h2}>WHAT CAN YOU GET YOUR HANDS ON?</Text>
            <View style={styles.presetRow}>
              {(['full_gym', 'home_basic', 'minimal'] as const).map((p) => (
                <Chip
                  key={p}
                  label={p.replace('_', ' ').toUpperCase()}
                  selected={false}
                  onPress={() => patch({ equipment_inventory: [...EQUIPMENT_PRESETS[p]] })}
                  accessibilityLabel={`Preset: ${p.replace('_', ' ')}`}
                />
              ))}
            </View>
            <View style={styles.chipWrap}>
              {EQUIPMENT_ITEMS.map((item) => {
                const owned = draft.equipment_inventory.includes(item);
                return (
                  <Chip
                    key={item}
                    label={EQUIPMENT_LABEL[item]}
                    selected={owned}
                    onPress={() => toggleEquipment(item)}
                    accessibilityLabel={`${EQUIPMENT_LABEL[item]}: ${owned ? 'owned' : 'not owned'}`}
                  />
                );
              })}
            </View>
            <Text style={styles.pDim}>
              The coach only ever prescribes movements your equipment allows.
            </Text>
          </View>
        )}

        {step === 'summary' && (
          <View>
            <Text style={styles.h2}>
              {name.trim().length > 0 ? `READY, ${name.trim().toUpperCase()}.` : 'READY.'}
            </Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryRow}>GOAL — {OBJECTIVE_COPY[draft.objective].label}</Text>
              <Text style={styles.summaryRow}>EXPERIENCE — {AGE_COPY[draft.training_age].label}</Text>
              <Text style={styles.summaryRow}>
                WEEK — {draft.weekly_frequency} days, ≤{draft.session_duration_cap_min} min
              </Text>
              <Text style={styles.summaryRow}>EFFORT CEILING — RPE {draft.base_rpe_cap.toFixed(1)}</Text>
              <Text style={styles.summaryRow}>
                EQUIPMENT — {draft.equipment_inventory.length}/{EQUIPMENT_ITEMS.length} items
              </Text>
              {draft.training_age === 'beginner' && (
                <Text style={styles.summaryRow}>PROGRAMMING — handled by your coach (auto)</Text>
              )}
              <Text style={styles.summaryRow} testID="onboarding-summary-loads-row">
                {draft.training_age === 'beginner'
                  ? 'LOADS — you choose the first; next time starts from what you logged'
                  : loadPreference === 'auto'
                    ? 'LOADS — coach suggests'
                    : 'LOADS — you choose'}
              </Text>
            </View>
            <Text style={styles.pDim}>
              Change any of this later in the ATHLETE tab. Your first prescription
              is waiting on the READY tab.
            </Text>
            <PrimaryButton
              label="START TRAINING"
              onPress={finish}
              accessibilityLabel="Finish setup and start training"
              style={styles.startBtn}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer: BACK / NEXT */}
      <View style={styles.footer}>
        <QuietAction
          label="BACK"
          onPress={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          accessibilityLabel="Back"
        />
        {!isLast && (
          <PrimaryButton
            label="NEXT"
            onPress={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
            accessibilityLabel="Next"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.ink0 },
  wordmark: {
    ...theme.font.eyebrow,
    color: theme.color.textLow,
    paddingHorizontal: theme.space[4],
    paddingTop: theme.space[4],
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.space[2], paddingVertical: theme.space[3] },
  dot: { width: 8, height: 8, borderRadius: theme.radius.chip, backgroundColor: theme.color.line },
  dotActive: { backgroundColor: theme.color.chalk },
  dotDone: { backgroundColor: theme.color.textMid },
  body: { flex: 1 },
  bodyContent: { padding: theme.space[4], paddingBottom: theme.space[5] },
  h1: { ...theme.font.title, color: theme.color.textHi, fontSize: 28, lineHeight: 36, marginBottom: theme.space[3] },
  h2: { ...theme.font.title, color: theme.color.textHi, fontSize: 20, marginBottom: theme.space[3] },
  p: { ...theme.font.body, color: theme.color.textHi, marginBottom: theme.space[3] },
  pDim: { ...theme.font.body, color: theme.color.textMid, marginBottom: theme.space[3] },
  note: { ...theme.font.body, color: theme.color.textMid, marginTop: theme.space[2] },
  fieldLabel: { ...theme.font.eyebrow, color: theme.color.textLow, marginTop: theme.space[3], marginBottom: theme.space[2] },
  nameInput: {
    backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, borderRadius: theme.radius.control,
    color: theme.color.textHi, ...theme.font.body, minHeight: theme.touch.min, paddingHorizontal: theme.space[3],
  },
  demoLink: { marginTop: theme.space[3] },
  cardGroup: { gap: theme.space[2] },
  cardChip: { marginBottom: theme.space[1] },
  stepperBlock: { marginBottom: theme.space[4] },
  notesInput: {
    backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, borderRadius: theme.radius.control,
    color: theme.color.textHi, ...theme.font.body, minHeight: 88, padding: theme.space[3], textAlignVertical: 'top',
  },
  presetRow: { flexDirection: 'row', gap: theme.space[2], marginBottom: theme.space[3] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
  summaryBox: {
    backgroundColor: theme.color.ink1, borderWidth: 1, borderColor: theme.color.line, borderRadius: theme.radius.control,
    padding: theme.space[4], marginBottom: theme.space[4], gap: theme.space[2],
  },
  summaryRow: { ...theme.font.body, color: theme.color.textHi, fontWeight: '600' },
  startBtn: {
    marginTop: theme.space[2],
  },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.space[3],
    paddingBottom: Platform.OS === 'ios' ? theme.space[4] : theme.space[3],
    borderTopWidth: 1, borderTopColor: theme.color.line,
  },
});
