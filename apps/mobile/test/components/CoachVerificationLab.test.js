import {
  runCoachVerificationLab,
  serializeRedactedCoachReport,
} from '../../src/diagnostics/coachVerificationLab';

const profile = {
  objective: 'strength',
  training_age: 'intermediate',
  weekly_frequency: 4,
  max_sessions_per_day: 1,
  session_duration_cap_min: 75,
  base_rpe_cap: 8.5,
  target_energy_system: 'hybrid',
  progression_methodology: 'autoregulated',
  injury_flags: [],
  mobility_limits: [],
  equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
};

const patterns = [
  'squat', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v',
  'lunge', 'carry', 'rotation', 'isolation', 'locomotion',
];

const movements = patterns.map((pattern, index) => ({
  movement_id: index + 1,
  name: `Diagnostic ${pattern}`,
  pattern,
  is_compound: pattern !== 'isolation',
  required: [],
  difficulty: 'Beginner',
  beginner_ok: false,
  capability_available: true,
}));

const evidence = Array.from({ length: 90 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 12));
  date.setUTCDate(date.getUTCDate() - index);
  return {
    date: date.toISOString().slice(0, 10),
    tonnageKg: index < 14 ? 100 : 0,
    setCount: index < 14 ? 2 : 0,
    bodyweightKg: index % 7 === 0 ? 82.5 : null,
    hrvRmssdMs: index % 2 === 0 ? 48 : null,
    restingHr: null,
    sleepMinutes: index % 3 === 0 ? 430 : null,
  };
});

const input = {
  profile,
  vector: null,
  movements,
  evidence,
  today: '2026-08-12',
  generatedAtMs: 1786500000000,
  profileContext: { sessionsToday: 0, trainedDaysLast7: 3 },
};

describe('Coach Verification Lab pure sandbox', () => {
  test('runs all real-engine scenarios deterministically without mutating its inputs', () => {
    const before = JSON.stringify(input);
    const first = runCoachVerificationLab(input);
    const second = runCoachVerificationLab(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.modules.map((module) => module.id)).toEqual([
      'prescription', 'schemas', 'adaptation', 'load_selection', 'routing', 'session',
    ]);
    expect(first.attention).toBe(0);
    expect(first.passed).toBe(6);
  });

  test('summarizes 14/30/90-day evidence without fabricating missing readings', () => {
    const report = runCoachVerificationLab(input);
    expect(report.evidence.map((item) => item.days)).toEqual([14, 30, 90]);
    expect(report.evidence[0]).toMatchObject({
      sampleDays: 14,
      trainingDays: 14,
      setCount: 28,
      tonnageKg: 1400,
      bodyweightDays: 2,
      hrvDays: 7,
      sleepDays: 5,
    });
  });

  test('share export omits raw evidence, names, database identifiers, and health readings', () => {
    const exportText = serializeRedactedCoachReport(runCoachVerificationLab(input));
    expect(exportText).toContain('Names, free text, database identifiers');
    expect(exportText).not.toContain('Diagnostic squat');
    expect(exportText).not.toContain('athlete_kinetics.db');
    expect(exportText).not.toContain('82.5');
    expect(exportText).not.toContain('430');
    expect(exportText).not.toContain('hrvRmssdMs');
  });
});
