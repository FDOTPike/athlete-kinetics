/**
 * BlockScreen.tsx — the COACH tab: 4-week block grid + today's plan + the
 * pre-session safety gate. Replaces the vestigial single-session prescription
 * view (pattern picker + PRESCRIBE) — daily adjustments are computed from
 * persisted state automatically; this screen renders them.
 *
 * RN core components only (Jetsam envelope): the grid is Views in flex rows,
 * no calendar/chart libraries, zero animations.
 */
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  palette,
  useStore,
  type BlockSessionSummary,
  type TodaySlot,
} from '../state/useStore';
import InfoTip from '../components/InfoTip';

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

const FOCUS_ABBREV: Record<string, string> = {
  lower: 'LWR',
  upper: 'UPR',
  full: 'FUL',
  conditioning: 'CND',
  bjj: 'BJJ',
};
const PHASE_ABBREV: Record<string, string> = {
  accumulation: 'ACCUMULATE',
  intensification: 'INTENSIFY',
  realization: 'REALIZE',
  deload: 'DELOAD',
};

interface BlockScreenProps {
  /** Called after a session starts here so the shell can switch tabs. */
  onSessionStarted?: () => void;
}

export default function BlockScreen({ onSessionStarted }: BlockScreenProps): React.JSX.Element {
  const vector = useStore((s) => s.vector);
  const today = useStore((s) => s.today);
  const prescription = useStore((s) => s.prescription);
  const profileNotes = useStore((s) => s.profileNotes);
  const profile = useStore((s) => s.profile);
  const triageReady = useStore((s) => s.triageReady);
  const triaging = useStore((s) => s.triaging);
  const lastTriage = useStore((s) => s.lastTriage);
  const block = useStore((s) => s.block);
  const blockSessions = useStore((s) => s.blockSessions);
  const todayPlan = useStore((s) => s.todayPlan);
  const session = useStore((s) => s.session);
  const generateNewBlock = useStore((s) => s.generateNewBlock);
  const loadSessionSlots = useStore((s) => s.loadSessionSlots);
  const reportSubjective = useStore((s) => s.reportSubjective);
  const startSession = useStore((s) => s.startSession);

  const [reportText, setReportText] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [gateText, setGateText] = useState('');
  const [detail, setDetail] = useState<{ s: BlockSessionSummary; slots: TodaySlot[] } | null>(null);

  if (vector === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>NO STATE VECTOR</Text>
        <Text style={styles.dimText}>
          Coaching needs today&apos;s readiness data. Sync telemetry or load the demo athlete.
        </Text>
      </View>
    );
  }

  const current = prescription !== null && prescription.forDate === today ? prescription : null;
  const halted = lastTriage !== null && lastTriage.kind === 'matched' && lastTriage.directive.halt;

  const confirmRegenerate = (): void => {
    Alert.alert(
      'Regenerate block?',
      'The current 4-week block is archived and a new one starts today from your profile and equipment.',
      [
        { text: 'KEEP CURRENT', style: 'cancel' },
        { text: 'REGENERATE', style: 'destructive', onPress: generateNewBlock },
      ],
    );
  };

  const beginSession = (): void => {
    startSession();
    setGateOpen(false);
    setGateText('');
    if (onSessionStarted !== undefined) onSessionStarted();
  };

  const submitGateReport = (): void => {
    void reportSubjective(gateText).then(() => {
      setGateText('');
      const fresh = useStore.getState().lastTriage;
      const nowHalted = fresh !== null && fresh.kind === 'matched' && fresh.directive.halt;
      // A halting report keeps the gate closed — the STOP card explains why.
      if (!nowHalted) beginSession();
    });
  };

  const weekRows: { week: number; phase: string; cells: (BlockSessionSummary | null)[] }[] = [];
  if (block !== null) {
    for (let week = 1; week <= 4; week++) {
      const inWeek = blockSessions.filter((s) => s.weekIndex === week);
      weekRows.push({
        week,
        phase: inWeek.length > 0 ? inWeek[0].phase : 'accumulation',
        cells: [1, 2, 3, 4, 5, 6, 7].map(
          (day) => inWeek.find((s) => s.dayIndex === day) ?? null,
        ),
      });
    }
  }
  const nextPlanned = blockSessions.find((s) => s.sessionDate > today);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ---- today's operative adjustment (policy -> profile -> guardrail) ---- */}
      {halted && lastTriage !== null && lastTriage.kind === 'matched' && (
        <View style={styles.haltCard}>
          <Text style={styles.haltTitle}>STOP — SESSION OVER</Text>
          <Text style={styles.haltCue}>{lastTriage.directive.vector.coaching_cue}</Text>
          {lastTriage.directive.followUp !== null && (
            <Text style={styles.followUp}>{lastTriage.directive.followUp}</Text>
          )}
        </View>
      )}
      {current !== null && !halted && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultDate}>TODAY&apos;S ADJUSTMENT</Text>
            <View
              style={[
                styles.sourceBadge,
                { borderColor: current.source === 'policy' ? palette.green : palette.amber },
              ]}
            >
              <Text
                style={[
                  styles.sourceBadgeText,
                  { color: current.source === 'policy' ? palette.green : palette.amber },
                ]}
              >
                {current.source === 'guardrail'
                  ? 'GUARDRAIL'
                  : current.source === 'profile'
                    ? 'PROFILE'
                    : 'POLICY'}
              </Text>
            </View>
          </View>
          <View style={styles.bigRow}>
            <View style={styles.bigCell}>
              <Text style={styles.bigValue}>×{current.vector.load_modifier.toFixed(2)}</Text>
              <View style={styles.bigLabelRow}>
                <Text style={styles.bigLabel}>LOAD</Text>
                <InfoTip term="LOAD" />
              </View>
            </View>
            <View style={styles.bigCell}>
              <Text style={styles.bigValue}>{signed(current.vector.set_modifier)}</Text>
              <View style={styles.bigLabelRow}>
                <Text style={styles.bigLabel}>SETS</Text>
                <InfoTip term="SETS" />
              </View>
            </View>
            <View style={styles.bigCell}>
              <Text style={[styles.bigValue, current.vector.rpe_cap >= 10 && styles.bigValueDanger]}>
                {current.vector.rpe_cap.toFixed(1)}
              </Text>
              <View style={styles.bigLabelRow}>
                <Text style={styles.bigLabel}>RPE CAP</Text>
                <InfoTip term="RPE" />
              </View>
            </View>
          </View>
          <Text style={styles.cue}>{current.vector.coaching_cue}</Text>
          {profileNotes.map((note) => (
            <Text key={note} style={styles.profileNote}>
              {note}
            </Text>
          ))}
        </View>
      )}

      {/* ---- 4-week block ---- */}
      <Text style={[styles.sectionLabel, styles.sectionGap]}>4-WEEK BLOCK</Text>
      {block === null ? (
        <View>
          <Text style={styles.dimTextLeft}>
            No block yet. Generation is deterministic: your objective
            ({profile.objective.replace(/_/g, ' ')}), {profile.weekly_frequency} days/week,
            and your equipment inventory decide every session. Nothing leaves the phone.
          </Text>
          <Pressable
            onPress={generateNewBlock}
            accessibilityRole="button"
            accessibilityLabel="Generate a 4 week training block"
            style={({ pressed }) => [styles.generateBtn, pressed && styles.generateBtnPressed]}
          >
            <Text style={styles.generateBtnText}>GENERATE 4-WEEK BLOCK</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.blockMeta}>
            {block.objective.replace(/_/g, ' ').toUpperCase()} · started {block.startDate}
          </Text>
          {weekRows.map((row) => (
            <View key={row.week} style={styles.weekRow}>
              <View style={styles.weekLabelBox}>
                <Text style={styles.weekLabel}>W{row.week}</Text>
                <Text style={styles.weekPhase}>{PHASE_ABBREV[row.phase] ?? row.phase}</Text>
              </View>
              {row.cells.map((cell, i) => {
                if (cell === null) {
                  return (
                    <View key={i} style={[styles.dayCell, styles.dayCellRest]}>
                      <Text style={styles.dayCellRestText}>·</Text>
                    </View>
                  );
                }
                const isToday = cell.sessionDate === today;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDetail({ s: cell, slots: loadSessionSlots(cell.plannedSessionId) })}
                    accessibilityRole="button"
                    accessibilityLabel={`Week ${cell.weekIndex} ${cell.focus} session, ${cell.sessionDate}${cell.trained ? ', trained' : ''}`}
                    style={[
                      styles.dayCell,
                      cell.trained && styles.dayCellTrained,
                      isToday && styles.dayCellToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        cell.trained && styles.dayCellTextTrained,
                        isToday && styles.dayCellTextToday,
                      ]}
                    >
                      {FOCUS_ABBREV[cell.focus] ?? cell.focus.slice(0, 3).toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {detail !== null && (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>
                W{detail.s.weekIndex} · {detail.s.focus.toUpperCase()} · {detail.s.sessionDate}
                {detail.s.trained ? ' · TRAINED' : ''}
              </Text>
              {detail.slots.map((sl) => (
                <View key={sl.slotIndex} style={styles.slotRow}>
                  <Text style={styles.slotName} numberOfLines={1}>{sl.movementName}</Text>
                  <Text style={styles.slotData}>
                    {sl.sets}×{sl.reps} @ {sl.targetRpe.toFixed(1)}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() => setDetail(null)}
                accessibilityRole="button"
                accessibilityLabel="Close session detail"
                style={styles.detailClose}
              >
                <Text style={styles.detailCloseText}>CLOSE</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={confirmRegenerate}
            accessibilityRole="button"
            accessibilityLabel="Regenerate the training block"
            style={styles.regenBtn}
          >
            <Text style={styles.regenBtnText}>REGENERATE FROM PROFILE</Text>
          </Pressable>
        </View>
      )}

      {/* ---- today's plan / rest day ---- */}
      <Text style={[styles.sectionLabel, styles.sectionGap]}>TODAY&apos;S PLAN</Text>
      {todayPlan !== null ? (
        <View style={styles.todayCard}>
          <Text style={styles.todayFocus}>
            {todayPlan.focus.toUpperCase()} · {PHASE_ABBREV[todayPlan.phase] ?? todayPlan.phase}
          </Text>
          {todayPlan.slots.map((sl) => (
            <View key={sl.slotIndex} style={styles.slotRow}>
              <Text style={styles.slotName} numberOfLines={1}>{sl.movementName}</Text>
              <Text style={styles.slotData}>
                {sl.sets}×{sl.reps} @ {sl.targetRpe.toFixed(1)}
              </Text>
            </View>
          ))}
          {current !== null && !halted && (
            <Text style={styles.dimTextLeft}>
              Today&apos;s adjustment applies on top: ×{current.vector.load_modifier.toFixed(2)} load,
              {' '}{signed(current.vector.set_modifier)} sets, RPE cap {current.vector.rpe_cap.toFixed(1)}.
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>REST DAY</Text>
          <Text style={styles.dimTextLeft}>
            Recovery is training.
            {nextPlanned !== undefined
              ? ` Next session: ${nextPlanned.focus.toUpperCase()} on ${nextPlanned.sessionDate}.`
              : block === null
                ? ' Generate a block to get a plan.'
                : ' This block is complete — regenerate for the next one.'}
          </Text>
        </View>
      )}

      {/* ---- pre-session safety gate ---- */}
      {session !== null ? (
        <Pressable
          onPress={() => { if (onSessionStarted !== undefined) onSessionStarted(); }}
          accessibilityRole="button"
          accessibilityLabel="Session is live, open the session tab"
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
        >
          <Text style={styles.startBtnText}>SESSION LIVE — OPEN SESSION TAB</Text>
        </Pressable>
      ) : halted ? (
        <View style={styles.startBlocked}>
          <Text style={styles.startBlockedText}>
            STARTING IS BLOCKED — today&apos;s report ended training. Rest, and report again tomorrow.
          </Text>
        </View>
      ) : !gateOpen ? (
        <Pressable
          onPress={() => setGateOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Start a session, beginning with the body check-in"
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
        >
          <Text style={styles.startBtnText}>START SESSION</Text>
        </Pressable>
      ) : (
        <View style={styles.gatePanel}>
          <Text style={styles.gateTitle}>PRE-SESSION CHECK-IN</Text>
          <Text style={styles.dimTextLeft}>
            How does your body feel right now? Anything sore, painful, or off — say it
            before you load it.
          </Text>
          <TextInput
            style={styles.reportInput}
            value={gateText}
            onChangeText={setGateText}
            placeholder="e.g. left knee a bit stiff from Tuesday"
            placeholderTextColor={palette.dim}
            maxLength={500}
            multiline
            accessibilityLabel="Pre-session body check-in"
          />
          <Pressable
            disabled={gateText.trim().length === 0 || triaging}
            onPress={submitGateReport}
            accessibilityRole="button"
            accessibilityLabel="Submit the check-in and start the session"
            style={({ pressed }) => [
              styles.gateBtn,
              pressed && styles.gateBtnPressed,
              (gateText.trim().length === 0 || triaging) && styles.gateBtnDisabled,
            ]}
          >
            <Text style={styles.gateBtnText}>
              {triaging ? 'CHECKING…' : 'SUBMIT & START'}
            </Text>
          </Pressable>
          <Pressable
            disabled={triaging}
            onPress={beginSession}
            accessibilityRole="button"
            accessibilityLabel="Nothing to report, start the session"
            style={styles.gateClear}
          >
            <Text style={styles.gateClearText}>ALL CLEAR — START</Text>
          </Pressable>
          <Pressable
            onPress={() => setGateOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel starting a session"
            style={styles.gateCancel}
          >
            <Text style={styles.gateCancelText}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/* ---- ad-hoc subjective report (always-on safety layer) ---- */}
      <Text style={[styles.sectionLabel, styles.sectionGap]}>SUBJECTIVE REPORT</Text>
      {!triageReady && (
        <Text style={styles.dimTextLeft}>
          Semantic matching is unavailable in this build — injury-language safety
          checks remain fully active.
        </Text>
      )}
      <TextInput
        style={styles.reportInput}
        value={reportText}
        onChangeText={setReportText}
        placeholder="How does it feel? e.g. knee a bit sore, 3/10"
        placeholderTextColor={palette.dim}
        maxLength={500}
        multiline
        accessibilityLabel="Describe how your body feels today"
      />
      <Pressable
        disabled={reportText.trim().length === 0 || triaging}
        onPress={() => {
          void reportSubjective(reportText).then(() => setReportText(''));
        }}
        accessibilityRole="button"
        accessibilityLabel="Triage this report"
        style={({ pressed }) => [
          styles.triageBtn,
          pressed && styles.triageBtnPressed,
          (reportText.trim().length === 0 || triaging) && styles.triageBtnDisabled,
        ]}
      >
        <Text style={styles.triageBtnText}>{triaging ? 'MATCHING…' : 'TRIAGE'}</Text>
      </Pressable>

      {lastTriage !== null && lastTriage.kind === 'rejected' && (
        <View style={styles.rejectCard}>
          <Text style={styles.rejectTitle}>NOTED — NO CHANGE</Text>
          <Text style={styles.dimTextLeft}>
            That didn&apos;t match a known scenario, so the prescription is unchanged.
            It&apos;s logged. Rephrase with how it feels during movement if something is off.
          </Text>
        </View>
      )}
      {lastTriage !== null && lastTriage.kind === 'matched' && !lastTriage.directive.halt && (
        <View style={styles.matchCard}>
          <Text style={styles.matchTitle}>GUARDRAIL APPLIED</Text>
          <Text style={styles.matchCue}>{lastTriage.directive.vector.coaching_cue}</Text>
          {lastTriage.directive.followUp !== null && (
            <Text style={styles.followUp}>{lastTriage.directive.followUp}</Text>
          )}
          <Text style={styles.dimTextLeft}>
            The adjustment above now reflects this report, scaled to your training age.
            It stays in force for the rest of the day, even if the app restarts.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  sectionLabel: { color: palette.dim, fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  sectionGap: { marginTop: 26 },
  errorTitle: { color: palette.red, fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  dimText: { color: palette.dim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  dimTextLeft: { color: palette.dim, fontSize: 14, lineHeight: 20, marginTop: 8 },

  resultCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultDate: { color: palette.dim, fontSize: 13, letterSpacing: 2 },
  sourceBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sourceBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  bigRow: { flexDirection: 'row', marginBottom: 14 },
  bigCell: { flex: 1, alignItems: 'center' },
  bigValue: { color: palette.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigValueDanger: { color: palette.red },
  bigLabel: { color: palette.dim, fontSize: 11, letterSpacing: 2 },
  bigLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cue: { color: palette.text, fontSize: 15, lineHeight: 22 },
  profileNote: { color: palette.amber, fontSize: 13, lineHeight: 19, marginTop: 8 },

  blockMeta: { color: palette.dim, fontSize: 13, letterSpacing: 1, marginBottom: 10 },
  weekRow: { flexDirection: 'row', alignItems: 'stretch', gap: 4, marginBottom: 4 },
  weekLabelBox: { width: 78, justifyContent: 'center' },
  weekLabel: { color: palette.text, fontSize: 14, fontWeight: '800' },
  weekPhase: { color: palette.dim, fontSize: 9, letterSpacing: 0.5 },
  dayCell: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellRest: { backgroundColor: 'transparent', borderColor: palette.line },
  dayCellRestText: { color: palette.line, fontSize: 16 },
  dayCellTrained: { borderColor: palette.green, backgroundColor: '#10241D' },
  dayCellToday: { borderColor: palette.amber, borderWidth: 2 },
  dayCellText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  dayCellTextTrained: { color: palette.green },
  dayCellTextToday: { color: palette.amber },

  detailCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    marginTop: 10,
  },
  detailTitle: { color: palette.text, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  detailClose: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', marginTop: 4 },
  detailCloseText: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  slotName: { color: palette.text, fontSize: 15, fontWeight: '600', flexShrink: 1, paddingRight: 10 },
  slotData: { color: palette.dim, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  generateBtn: {
    height: 80,
    borderRadius: 16,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  generateBtnPressed: { backgroundColor: '#26C28F' },
  generateBtnText: { color: '#06251B', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  regenBtn: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  regenBtnText: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },

  todayCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  todayFocus: { color: palette.green, fontSize: 14, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  restCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  restTitle: { color: palette.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },

  startBtn: {
    height: 76,
    borderRadius: 16,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  startBtnPressed: { backgroundColor: '#26C28F' },
  startBtnText: { color: '#06251B', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  startBlocked: {
    backgroundColor: '#2A1416',
    borderWidth: 2,
    borderColor: palette.red,
    borderRadius: 12,
    padding: 14,
    marginTop: 22,
  },
  startBlockedText: { color: palette.red, fontSize: 14, fontWeight: '700', lineHeight: 20 },

  gatePanel: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.amber,
    padding: 14,
    marginTop: 22,
  },
  gateTitle: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  gateBtn: {
    height: 60,
    borderRadius: 12,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  gateBtnPressed: { backgroundColor: '#26C28F' },
  gateBtnDisabled: { backgroundColor: palette.line },
  gateBtnText: { color: '#06251B', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  gateClear: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  gateClearText: { color: palette.green, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  gateCancel: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: 4 },
  gateCancelText: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  reportInput: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    marginTop: 10,
    marginBottom: 10,
  },
  triageBtn: {
    height: 64,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  triageBtnPressed: { backgroundColor: '#10241D' },
  triageBtnDisabled: { borderColor: palette.line },
  triageBtnText: { color: palette.green, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  rejectCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  rejectTitle: { color: palette.dim, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  matchCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.amber,
    padding: 14,
  },
  matchTitle: { color: palette.amber, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  matchCue: { color: palette.text, fontSize: 16, lineHeight: 22, marginTop: 8 },
  haltCard: {
    backgroundColor: '#2A1416',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.red,
    padding: 16,
    marginBottom: 14,
  },
  haltTitle: { color: palette.red, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  haltCue: { color: palette.text, fontSize: 16, lineHeight: 22, marginTop: 8 },
  followUp: { color: palette.text, fontSize: 15, fontStyle: 'italic', marginTop: 8 },
});
