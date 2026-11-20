import { ENERGY_SYSTEMS, EQUIPMENT_PRESETS } from '@ak/inference';
import { ENERGY_SYSTEM_TIP, oneRmClampNote, presetMatches, resetConfirmText, resetScopeText } from '../../src/screens/ProfileScreen';
import { measuredDayDetail } from '../../src/screens/measuredDayDetail';
import { getGlossaryEntry } from '../../src/data/glossary';

// Android walk 2026-11-03, W4-7: typing 999 became 500.0 with no word.
test('a one-rep max above 500 kg says it was saved as 500 kg', () => {
  expect(oneRmClampNote(999)).toMatch(/^Saved as 500\.0 kg/);
  expect(oneRmClampNote(500)).toBeNull();
  expect(oneRmClampNote(140)).toBeNull();
});

// W4-12: days with no sets read "0 kg load · 0 sets".
test('a day with no sets says no training was logged, and keeps its measures', () => {
  expect(measuredDayDetail({ tonnageKg: 0, setCount: 0, bodyweightKg: 72.4, restingHr: 51 }))
    .toBe('No training logged · 72.4 kg BW · 51 bpm resting HR');
  expect(measuredDayDetail({ tonnageKg: 0, setCount: 0, bodyweightKg: null })).toBe('No training logged');
  expect(measuredDayDetail({ tonnageKg: 1234.4, setCount: 12, bodyweightKg: null, restingHr: null }))
    .toBe(`${(1234).toLocaleString()} kg lifted in total · 12 sets`);
  expect(measuredDayDetail({ tonnageKg: 0, setCount: 1, bodyweightKg: null })).toBe('0 kg lifted in total · 1 set');
});

// W4-9: the energy system "i" always explained ATP-PC.
test('the energy system "i" explains only the chosen system, and only with a glossary entry', () => {
  expect(ENERGY_SYSTEM_TIP).toEqual({ atp_pc: 'ATP-PC' });
  for (const system of ENERGY_SYSTEMS) {
    const tip = ENERGY_SYSTEM_TIP[system];
    if (tip !== undefined) expect([system, getGlossaryEntry(tip)?.term]).toEqual([system, tip]);
  }
  expect(ENERGY_SYSTEM_TIP.atp_pc).toBe('ATP-PC');
  expect(ENERGY_SYSTEM_TIP.aerobic).toBeUndefined();
});

// W4-6 & #302 194f: reset did not say whose data it removes, and must list
// one-rep maxes, reports from every date, and "Their other profile settings".
test('reset names the athlete whose data it removes', () => {
  expect(resetScopeText('Kim')).toContain("This removes Kim's training history");
  expect(resetScopeText('Kim')).toContain('one-rep maxes');
  expect(resetScopeText('Kim')).toContain('reports from every date');
  expect(resetScopeText('Kim')).toContain('Their other profile settings');
  expect(resetScopeText('Kim')).toContain('other athletes are not changed');
  expect(resetScopeText(undefined)).toContain("this athlete's");
  expect(resetConfirmText('Kim')).toBe("This cannot be undone. Reset Kim's training data?");
});

// W4-4: no preset ever showed as chosen.
test('a preset shows as chosen only when the standard equipment is exactly that preset', () => {
  const home = [...EQUIPMENT_PRESETS.home_basic];
  expect(presetMatches(home, EQUIPMENT_PRESETS.home_basic)).toBe(true);
  expect(presetMatches([...home].reverse(), EQUIPMENT_PRESETS.home_basic)).toBe(true);
  expect(presetMatches([...home, 'boards'], EQUIPMENT_PRESETS.home_basic)).toBe(true);
  expect(presetMatches([...home, 'bench'], EQUIPMENT_PRESETS.home_basic)).toBe(false);
  expect(presetMatches(home.slice(1), EQUIPMENT_PRESETS.home_basic)).toBe(false);
  expect(presetMatches(home, EQUIPMENT_PRESETS.full_gym)).toBe(false);
});
