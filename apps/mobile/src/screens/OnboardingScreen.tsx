/**
 * OnboardingScreen.tsx — first-run questionnaire, program-quality edition.
 *
 * The interview a real coach gives a new athlete, shortened to SEVEN screens
 * (work order §2.1): welcome, goal, experience, weekly logistics (days AND
 * session length together), equipment (presets first, customization collapsed
 * until asked), limitations (one explicit no/yes), review. Only five screens
 * ask a decision — welcome and review do not count.
 *
 * The programming-science decisions that used to be screens (effort ceiling,
 * energy focus, load preference) ride the REVIEW screen as disclosed coach
 * defaults with an optional fine-tuning area: they are shown honestly, stay
 * editable later in the ATHLETE tab, and no longer tax every first run. A
 * beginner never sees the load choice at all — coach auto, with the
 * first-use explanation — per WO_FOUR_MODE_LOAD.
 *
 * Answers are held in a local draft and committed in a SINGLE
 * completeOnboarding() call — no partial profiles can ever be persisted by an
 * abandoned wizard, and Android back navigation only walks the draft back.
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
  STANDARD_EQUIPMENT_ITEMS,
  SPECIALIST_EQUIPMENT_ITEMS,
  OBJECTIVES,
  TRAINING_AGES,
  defaultLoadPreference,
  transitionLoadPreference,
  effortCue,
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
  hybrid: { label: 'STRENGTH + GRAPPLING', blurb: 'Lift heavy and keep mat time first' },
  rehab: { label: 'RETURN TO TRAINING', blurb: 'Coming back carefully, no diagnosis' },
  weight_loss: { label: 'FAT-LOSS SUPPORT', blurb: 'Stay active and keep your muscle' },
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
  boards: 'BOARDS',
};

/** Plain-language read of an RPE effort cap, shown live under the stepper. */
const effortBlurb = (rpe: number): string => {
  if (rpe <= 7.0) return 'Comfortable — always plenty left in the tank.';
  if (rpe <= 8.5) return 'Hard but controlled — a couple of reps always in reserve.';
  if (rpe <= 9.5) return 'Close to the limit on the biggest days.';
  return 'True max efforts allowed. Earn this one.';
};

type StepKey =
  | 'welcome' | 'goal' | 'experience' | 'logistics' | 'equipment' | 'limits' | 'review';

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
  // The limitations gate: null = unanswered, false = "no, nothing to note",
  // true = "yes" (reveals the note fields). Choosing no clears both drafts.
  const [limitsAnswered, setLimitsAnswered] = useState<boolean | null>(null);
  // Equipment customization stays collapsed until the athlete asks for it;
  // presets come first and never grant specialist items.
  const [showCustomEquipment, setShowCustomEquipment] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  // Four-mode load selection (WO_FOUR_MODE_LOAD): the durable two-way
  // preference rides the wizard as draft state and commits in the same
  // transaction as the profile. `loadPreferenceExplicit` flips true ONLY when
  // the athlete presses a chip in the review fine-tuning area — a value that
  // came from a tier default is not explicit and re-derives on tier change.
  const [loadPreference, setLoadPreference] = useState<LoadPreference>(defaultLoadPreference(DEFAULT_PROFILE.training_age));
  const [loadPreferenceExplicit, setLoadPreferenceExplicit] = useState(false);
  // Set when a demo load was refused because real history exists; explains the
  // refusal and keeps the wizard on the current step.
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

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

  // Seven screens for EVERY athlete — the shortening is the point (WO §2.1).
  const steps: StepKey[] = useMemo(
    () => ['welcome', 'goal', 'experience', 'logistics', 'equipment', 'limits', 'review'],
    [],
  );
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = step === 'review';

  /** Truthful preset state: a preset chip reads selected only when the draft
   *  inventory is exactly that preset's bundle. */
  const presetSelected = (preset: 'full_gym' | 'home_basic' | 'minimal'): boolean => {
    const bundle = EQUIPMENT_PRESETS[preset];
    return bundle.length === draft.equipment_inventory.length
      && bundle.every((item) => draft.equipment_inventory.includes(item));
  };

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
    const result = loadDemoAthlete();
    if (result === 'blocked_existing_data') {
      // Existing history was preserved — stay here and say so. Onboarding is
      // NOT completed; normal setup remains available.
      setDemoNotice('Your existing training history was preserved, so the demo was not loaded. You can complete the normal setup instead.');
      return;
    }
    setDemoNotice(null);
    completeOnboarding({}, name.trim().length > 0 ? name : 'Demo Athlete');
  };

  const toggleEquipment = (item: EquipmentItem): void => {
    const owned = new Set(draft.equipment_inventory);
    if (owned.has(item)) owned.delete(item);
    else owned.add(item);
    patch({ equipment_inventory: EQUIPMENT_ITEMS.filter((i) => owned.has(i)) });
  };

  const answerLimits = (hasLimits: boolean): void => {
    setLimitsAnswered(hasLimits);
    // "No" is an explicit clearing of both draft note lists, not a skip.
    if (!hasLimits) {
      setInjuryText('');
      setMobilityText('');
    }
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
            {demoNotice !== null && (
              <Text style={styles.p} accessibilityLiveRegion="polite">
                {demoNotice}
              </Text>
            )}
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

        {step === 'logistics' && (
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
              label="MINUTES IN A SESSION, TOPS"
              value={`${draft.session_duration_cap_min} min`}
              onDecrement={() => patch({ session_duration_cap_min: Math.max(15, draft.session_duration_cap_min - 15) })}
              onIncrement={() => patch({ session_duration_cap_min: Math.min(240, draft.session_duration_cap_min + 15) })}
              style={styles.stepperBlock}
            />
            <Text style={styles.pDim}>
              A realistic ceiling beats an optimistic one. The coach treats these
              as hard limits — extra work past them gets damped, not rewarded.
            </Text>
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
                  selected={presetSelected(p)}
                  onPress={() => patch({ equipment_inventory: [...EQUIPMENT_PRESETS[p]] })}
                  accessibilityLabel={`Preset: ${p.replace('_', ' ')}${presetSelected(p) ? ', selected' : ''}`}
                />
              ))}
            </View>
            <Text style={styles.pDim}>
              Pick the closest setup. Need something more specific? Customize below.
            </Text>
            <QuietAction
              label={showCustomEquipment ? 'Hide customization' : 'Customize your setup'}
              onPress={() => setShowCustomEquipment((v) => !v)}
              accessibilityLabel={showCustomEquipment ? 'Hide equipment customization' : 'Customize equipment'}
            />
            {showCustomEquipment && (
              <View>
                <View style={styles.chipWrap}>
                  {STANDARD_EQUIPMENT_ITEMS.map((item) => {
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
                {/* Specialist equipment is a SEPARATE, explicit opt-in: no preset and
                    no default ever grants it, so movements needing it stay
                    teaching-only until it is deliberately selected here. */}
                <Text style={styles.fieldLabel}>SPECIALIST</Text>
                <View style={styles.chipWrap}>
                  {SPECIALIST_EQUIPMENT_ITEMS.map((item) => {
                    const owned = draft.equipment_inventory.includes(item);
                    return (
                      <Chip
                        key={item}
                        label={EQUIPMENT_LABEL[item]}
                        selected={owned}
                        onPress={() => toggleEquipment(item)}
                        accessibilityLabel={`Specialist equipment ${EQUIPMENT_LABEL[item]}: ${owned ? 'owned' : 'not owned'}`}
                      />
                    );
                  })}
                </View>
                <Text style={styles.pDim}>
                  The coach only ever prescribes movements your equipment allows.
                  Specialist items stay off unless you turn them on.
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 'limits' && (
          <View>
            <Text style={styles.h2}>ANYTHING I SHOULD TRAIN AROUND?</Text>
            <Text style={styles.pDim}>
              Old injuries or mobility limits the coach should respect. This never
              replaces medical advice.
            </Text>
            <View style={styles.cardGroup}>
              <Chip
                label="NO — NOTHING TO NOTE"
                selected={limitsAnswered === false}
                onPress={() => answerLimits(false)}
                accessibilityLabel="No, nothing to note"
                style={styles.cardChip}
              />
              <Chip
                label="YES — LET ME ADD NOTES"
                selected={limitsAnswered === true}
                onPress={() => answerLimits(true)}
                accessibilityLabel="Yes, let me add notes"
                style={styles.cardChip}
              />
            </View>
            {limitsAnswered === true && (
              <View>
                <Text style={styles.fieldLabel}>PAST INJURIES</Text>
                <Text style={styles.pDim}>One per line, like &quot;knee: old ACL, careful with deep squats&quot;.</Text>
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
          </View>
        )}

        {step === 'review' && (
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
              <Text style={styles.summaryRow}>
                EQUIPMENT — {draft.equipment_inventory.length}/{EQUIPMENT_ITEMS.length} items
              </Text>
              <Text style={styles.summaryRow} testID="onboarding-summary-limits-row">
                LIMITATIONS — {(parseNotes(injuryText).length + parseNotes(mobilityText).length) > 0
                  ? `${parseNotes(injuryText).length + parseNotes(mobilityText).length} noted`
                  : 'none noted'}
              </Text>
              <Text style={styles.summaryRow} testID="onboarding-summary-loads-row">
                {draft.training_age === 'beginner'
                  ? 'LOADS — you choose the first; next time starts from what you logged'
                  : loadPreference === 'auto'
                    ? 'LOADS — coach suggests'
                    : 'LOADS — you choose'}
              </Text>
            </View>

            {/* Coach defaults, disclosed honestly. Every value here is a safe
                default the athlete can change later in the ATHLETE tab; the
                fine-tuning area below is optional. */}
            <Text style={styles.fieldLabel}>COACH DEFAULTS — EDIT ANYTIME IN ATHLETE / PROFILE</Text>
            <Text style={styles.pDim}>
              Effort ceiling RPE {draft.base_rpe_cap.toFixed(1)} — {effortBlurb(draft.base_rpe_cap)}
              {'\n'}Up to {draft.max_sessions_per_day} session{draft.max_sessions_per_day === 1 ? '' : 's'} a day
              {'\n'}Energy focus: {ENERGY_COPY[draft.target_energy_system].label}
            </Text>

            {draft.training_age !== 'beginner' && (
              <View style={styles.fineTune} testID="onboarding-loads-step">
                <Text style={styles.fieldLabel}>WHO PICKS THE WEIGHTS? (OPTIONAL)</Text>
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
            {draft.training_age === 'beginner' && (
              <Text style={styles.pDim}>
                While you&apos;re new, the coach picks the weights and caps effort at
                8.5 — you&apos;ll grow into the rest.
              </Text>
            )}

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
  fineTune: { marginBottom: theme.space[3] },
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
