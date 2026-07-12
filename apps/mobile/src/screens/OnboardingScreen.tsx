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
 * House rules: keyboard only where unavoidable (name, injury notes), no
 * animations, accessibility roles/labels everywhere, ≥56pt targets.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DEFAULT_PROFILE,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  OBJECTIVES,
  PROGRESSION_METHODS,
  TRAINING_AGES,
  type EnergySystem,
  type EquipmentItem,
  type Objective,
  type ProgressionMethod,
  type TrainingAge,
  type UserProfile,
} from '@ak/inference';
import { palette, useStore } from '../state/useStore';

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

const PROGRESSION_COPY: Record<ProgressionMethod, { label: string; blurb: string }> = {
  linear: { label: 'LINEAR', blurb: 'Add a little every week, simple and steady' },
  undulating: { label: 'UNDULATING', blurb: 'Heavy, light, and medium days mixed through the week' },
  conjugate: { label: 'CONJUGATE', blurb: 'Rotating max-effort and speed work' },
  autoregulated: { label: 'AUTO (COACHED)', blurb: 'The coach adjusts to your readiness day by day — recommended' },
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
  | 'science' | 'body' | 'equipment' | 'summary';

// ---------------------------------------------------------------------------
// Primitives (wizard-local: bigger cards than ProfileScreen's chips — one
// decision per screen earns the room).
// ---------------------------------------------------------------------------
interface CardProps {
  label: string;
  blurb: string;
  active: boolean;
  onPress: () => void;
}
function OptionCard({ label, blurb, active, onPress }: CardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}. ${blurb}`}
      style={[styles.card, active && styles.cardActive]}
    >
      <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>{label}</Text>
      <Text style={styles.cardBlurb}>{blurb}</Text>
    </Pressable>
  );
}

interface StepperProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
}
function BigStepper({ label, display, onDec, onInc }: StepperProps): React.JSX.Element {
  return (
    <View style={styles.stepperBlock}>
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
        <Text style={styles.stepValue} accessibilityLabel={`${label}: ${display}`}>{display}</Text>
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

  const patch = (p: Partial<UserProfile>): void => setDraft((d) => ({ ...d, ...p }));

  // The beginner path skips the programming-science screen entirely; the
  // draft keeps DEFAULT_PROFILE's hybrid + autoregulated (the coach decides).
  const steps: StepKey[] = useMemo(
    () =>
      draft.training_age === 'beginner'
        ? ['welcome', 'goal', 'experience', 'schedule', 'time', 'effort', 'body', 'equipment', 'summary']
        : ['welcome', 'goal', 'experience', 'schedule', 'time', 'effort', 'science', 'body', 'equipment', 'summary'],
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
      {/* Progress dots — position, not percent; no numbers to misread. */}
      <View style={styles.dots} accessibilityLabel={`Step ${stepIdx + 1} of ${steps.length}`}>
        {steps.map((k, i) => (
          <View key={k} style={[styles.dot, i === stepIdx && styles.dotActive, i < stepIdx && styles.dotDone]} />
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
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
              placeholderTextColor={palette.dim}
              maxLength={24}
              accessibilityLabel="Your name"
            />
            <Pressable
              onPress={finishWithDemo}
              accessibilityRole="button"
              accessibilityLabel="Skip the questionnaire and load the demo athlete"
              style={styles.demoLink}
            >
              <Text style={styles.demoLinkText}>Just exploring? Load the demo athlete →</Text>
            </Pressable>
          </View>
        )}

        {step === 'goal' && (
          <View>
            <Text style={styles.h2}>WHAT ARE WE TRAINING FOR?</Text>
            {OBJECTIVES.map((o) => (
              <OptionCard
                key={o}
                label={OBJECTIVE_COPY[o].label}
                blurb={OBJECTIVE_COPY[o].blurb}
                active={draft.objective === o}
                onPress={() => patch({ objective: o })}
              />
            ))}
          </View>
        )}

        {step === 'experience' && (
          <View>
            <Text style={styles.h2}>HOW LONG HAVE YOU BEEN TRAINING?</Text>
            <Text style={styles.pDim}>Be honest — the coach calibrates everything to this.</Text>
            {TRAINING_AGES.map((a) => (
              <OptionCard
                key={a}
                label={AGE_COPY[a].label}
                blurb={AGE_COPY[a].blurb}
                active={draft.training_age === a}
                onPress={() => patch({ training_age: a })}
              />
            ))}
          </View>
        )}

        {step === 'schedule' && (
          <View>
            <Text style={styles.h2}>YOUR WEEK</Text>
            <BigStepper
              label="TRAINING DAYS PER WEEK"
              display={String(draft.weekly_frequency)}
              onDec={() => patch({ weekly_frequency: Math.max(1, draft.weekly_frequency - 1) })}
              onInc={() => patch({ weekly_frequency: Math.min(7, draft.weekly_frequency + 1) })}
            />
            <BigStepper
              label="MAX SESSIONS IN ONE DAY"
              display={String(draft.max_sessions_per_day)}
              onDec={() => patch({ max_sessions_per_day: Math.max(1, draft.max_sessions_per_day - 1) })}
              onInc={() => patch({ max_sessions_per_day: Math.min(3, draft.max_sessions_per_day + 1) })}
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
            <BigStepper
              label="MINUTES, TOPS"
              display={`${draft.session_duration_cap_min} min`}
              onDec={() => patch({ session_duration_cap_min: Math.max(15, draft.session_duration_cap_min - 15) })}
              onInc={() => patch({ session_duration_cap_min: Math.min(240, draft.session_duration_cap_min + 15) })}
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
            <BigStepper
              label="EFFORT CEILING (RPE)"
              display={draft.base_rpe_cap.toFixed(1)}
              onDec={() => patch({ base_rpe_cap: Math.max(5, draft.base_rpe_cap - 0.5) })}
              onInc={() => patch({ base_rpe_cap: Math.min(10, draft.base_rpe_cap + 0.5) })}
            />
            <Text style={styles.p}>{effortBlurb(draft.base_rpe_cap)}</Text>
            {draft.training_age === 'beginner' && draft.base_rpe_cap > 8.5 && (
              <Text style={styles.note}>
                Heads up: while you're new, the coach caps effort at 8.5 anyway —
                you'll grow into the rest.
              </Text>
            )}
          </View>
        )}

        {step === 'science' && (
          <View>
            <Text style={styles.h2}>THE SCIENCE BITS</Text>
            <Text style={styles.fieldLabel}>ENERGY FOCUS</Text>
            {ENERGY_SYSTEMS.map((e) => (
              <OptionCard
                key={e}
                label={ENERGY_COPY[e].label}
                blurb={ENERGY_COPY[e].blurb}
                active={draft.target_energy_system === e}
                onPress={() => patch({ target_energy_system: e })}
              />
            ))}
            <Text style={styles.fieldLabel}>PROGRESSION STYLE</Text>
            {PROGRESSION_METHODS.map((m) => (
              <OptionCard
                key={m}
                label={PROGRESSION_COPY[m].label}
                blurb={PROGRESSION_COPY[m].blurb}
                active={draft.progression_methodology === m}
                onPress={() => patch({ progression_methodology: m })}
              />
            ))}
          </View>
        )}

        {step === 'body' && (
          <View>
            <Text style={styles.h2}>ANYTHING I SHOULD KNOW?</Text>
            <Text style={styles.pDim}>
              One per line, like "knee: old ACL, careful with deep squats".
              Leave empty if nothing applies — you can add these any time.
            </Text>
            <Text style={styles.fieldLabel}>PAST INJURIES</Text>
            <TextInput
              style={styles.notesInput}
              value={injuryText}
              onChangeText={setInjuryText}
              multiline
              placeholder="shoulder: dislocated 2023"
              placeholderTextColor={palette.dim}
              accessibilityLabel="Past injuries, one per line as region colon note"
            />
            <Text style={styles.fieldLabel}>MOBILITY LIMITS</Text>
            <TextInput
              style={styles.notesInput}
              value={mobilityText}
              onChangeText={setMobilityText}
              multiline
              placeholder="ankles: can't hit depth without heel lift"
              placeholderTextColor={palette.dim}
              accessibilityLabel="Mobility limits, one per line as region colon note"
            />
          </View>
        )}

        {step === 'equipment' && (
          <View>
            <Text style={styles.h2}>WHAT CAN YOU GET YOUR HANDS ON?</Text>
            <View style={styles.presetRow}>
              {(['full_gym', 'home_basic', 'minimal'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => patch({ equipment_inventory: [...EQUIPMENT_PRESETS[p]] })}
                  accessibilityRole="button"
                  accessibilityLabel={`Preset: ${p.replace('_', ' ')}`}
                  style={styles.presetBtn}
                >
                  <Text style={styles.presetText}>{p.replace('_', ' ').toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chipWrap}>
              {EQUIPMENT_ITEMS.map((item) => {
                const owned = draft.equipment_inventory.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleEquipment(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: owned }}
                    accessibilityLabel={`${EQUIPMENT_LABEL[item]}: ${owned ? 'owned' : 'not owned'}`}
                    style={[styles.chip, owned && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, owned && styles.chipTextActive]}>
                      {EQUIPMENT_LABEL[item]}
                    </Text>
                  </Pressable>
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
            </View>
            <Text style={styles.pDim}>
              Change any of this later in the ATHLETE tab. Your first prescription
              is waiting on the READY tab.
            </Text>
            <Pressable
              onPress={finish}
              accessibilityRole="button"
              accessibilityLabel="Finish setup and start training"
              style={styles.startBtn}
            >
              <Text style={styles.startBtnText}>START TRAINING</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Footer: BACK / NEXT (the summary screen owns its own final CTA). */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.navBtn, stepIdx === 0 && styles.navBtnDisabled]}
        >
          <Text style={[styles.navText, stepIdx === 0 && styles.navTextDisabled]}>BACK</Text>
        </Pressable>
        {!isLast && (
          <Pressable
            onPress={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={[styles.navBtn, styles.navBtnPrimary]}
          >
            <Text style={styles.navTextPrimary}>NEXT</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.line },
  dotActive: { backgroundColor: palette.green },
  dotDone: { backgroundColor: palette.dim },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 32 },
  h1: { color: palette.text, fontSize: 30, fontWeight: '800', letterSpacing: 1.5, lineHeight: 38, marginBottom: 16 },
  h2: { color: palette.text, fontSize: 22, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  p: { color: palette.text, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  pDim: { color: palette.dim, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  note: { color: palette.amber, fontSize: 14, lineHeight: 20, marginTop: 12 },
  fieldLabel: { color: palette.dim, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 12, marginBottom: 8 },
  nameInput: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 10,
    color: palette.text, fontSize: 18, minHeight: 56, paddingHorizontal: 16,
  },
  demoLink: { minHeight: 56, justifyContent: 'center', marginTop: 20 },
  demoLinkText: { color: palette.dim, fontSize: 14, textDecorationLine: 'underline' },
  card: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12,
    padding: 16, marginBottom: 10, minHeight: 64,
  },
  cardActive: { borderColor: palette.green },
  cardLabel: { color: palette.text, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  cardLabelActive: { color: palette.green },
  cardBlurb: { color: palette.dim, fontSize: 13, lineHeight: 18, marginTop: 4 },
  stepperBlock: { marginBottom: 20 },
  stepperLabel: { color: palette.dim, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 64, height: 64, borderRadius: 12, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnPressed: { borderColor: palette.green },
  stepBtnText: { color: palette.text, fontSize: 28, fontWeight: '700' },
  stepValue: { color: palette.text, fontSize: 26, fontWeight: '800', flex: 1, textAlign: 'center' },
  notesInput: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 10,
    color: palette.text, fontSize: 15, minHeight: 88, padding: 12, textAlignVertical: 'top',
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetBtn: {
    flex: 1, minHeight: 56, borderRadius: 10, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  presetText: { color: palette.text, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 56, paddingHorizontal: 14, borderRadius: 10, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { borderColor: palette.green },
  chipText: { color: palette.dim, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  chipTextActive: { color: palette.green },
  summaryBox: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12,
    padding: 16, marginBottom: 16, gap: 10,
  },
  summaryRow: { color: palette.text, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  startBtn: {
    minHeight: 64, borderRadius: 12, backgroundColor: palette.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  startBtnText: { color: palette.bg, fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: palette.line,
  },
  navBtn: {
    flex: 1, minHeight: 60, borderRadius: 12, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnPrimary: { backgroundColor: palette.green, borderColor: palette.green },
  navText: { color: palette.text, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  navTextDisabled: { color: palette.dim },
  navTextPrimary: { color: palette.bg, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
});
