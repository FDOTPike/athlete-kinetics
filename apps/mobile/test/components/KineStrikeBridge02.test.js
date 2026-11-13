import fs from 'fs';
import path from 'path';
import React from 'react';
import { DatabaseSync } from 'node:sqlite';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  SessionFeelPanel,
  KINESTRIKE_BRIDGE_DEFAULTS,
  KINESTRIKE_SUBCHIP_LABEL,
} from '../../src/components/SessionFeelPanel';
import { validateSessionFeel } from '@ak/inference';

const SCHEMA_DIR = path.join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema');

function openStateVectorDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  try {
    db.prepare('SELECT ln(2.0), sqrt(2.0)').get();
  } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  for (const file of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql']) {
    db.exec(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
  }
  return db;
}

const ruleOnly = () =>
  jest.fn((draft) => {
    const checked = validateSessionFeel(draft);
    return checked.ok ? null : checked.problem;
  });

describe('WO-KS-BRIDGE-02 Deliverable A: 078_kinestrike_telemetry.sql', () => {
  const migrationPath = path.join(SCHEMA_DIR, '078_kinestrike_telemetry.sql');
  const materializePath = path.join(SCHEMA_DIR, '004_state_vector_materialize.sql');

  test('creates state_vector_kinestrike with all 15 nullable KineStrike columns and preserves 004 materialization', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const db = openStateVectorDb();
    const sql078 = fs.readFileSync(migrationPath, 'utf8');
    db.exec(sql078);

    db.exec("INSERT INTO hrv_daily (date, rmssd_ms) VALUES ('2026-11-10', 62.0);");
    db.prepare(fs.readFileSync(materializePath, 'utf8')).run('2026-11-10');

    const row = db
      .prepare(
        `SELECT s.*,
                k.ks_foot, k.ks_strike_count, k.ks_gct_mean_ms, k.ks_gct_delta_pct,
                k.ks_peak_load_mean, k.ks_peak_load_cv, k.ks_heel_share_mean,
                k.ks_medial_share_mean, k.ks_lateral_share_mean, k.ks_toe_share_mean,
                k.ks_cop_x_mean, k.ks_impact_peak_g_max, k.ks_cod_count,
                k.ks_fall_warning_count, k.ks_fall_last_state
           FROM state_vector s
           LEFT JOIN state_vector_kinestrike k ON k.date = s.date
          WHERE s.date = '2026-11-10'`,
      )
      .get();
    expect(row).toBeDefined();
    expect(row.readiness_score).toBe(50);

    const expectedKsColumns = [
      'ks_foot',
      'ks_strike_count',
      'ks_gct_mean_ms',
      'ks_gct_delta_pct',
      'ks_peak_load_mean',
      'ks_peak_load_cv',
      'ks_heel_share_mean',
      'ks_medial_share_mean',
      'ks_lateral_share_mean',
      'ks_toe_share_mean',
      'ks_cop_x_mean',
      'ks_impact_peak_g_max',
      'ks_cod_count',
      'ks_fall_warning_count',
      'ks_fall_last_state',
    ];
    const tableCols = db
      .prepare('PRAGMA table_info(state_vector_kinestrike)')
      .all()
      .map((c) => c.name);
    expect(tableCols).toEqual(['date', ...expectedKsColumns]);

    for (const col of expectedKsColumns) {
      expect(Object.prototype.hasOwnProperty.call(row, col)).toBe(true);
      expect(row[col]).toBeNull();
    }
    db.close();
  });

  test('is idempotent on re-apply and preserves populated KineStrike telemetry columns across 004 materialization', () => {
    const db = openStateVectorDb();
    const sql078 = fs.readFileSync(migrationPath, 'utf8');
    db.exec(sql078);

    db.exec(`
      INSERT INTO state_vector_kinestrike (
        date, ks_foot, ks_strike_count, ks_gct_mean_ms, ks_gct_delta_pct, ks_peak_load_mean, ks_peak_load_cv,
        ks_heel_share_mean, ks_medial_share_mean, ks_lateral_share_mean, ks_toe_share_mean, ks_cop_x_mean,
        ks_impact_peak_g_max, ks_cod_count, ks_fall_warning_count, ks_fall_last_state
      ) VALUES (
        '2026-11-11', 'R', 128, 242.5, 6.8, 34.2, 0.14,
        0.30, 0.48, 0.22, 0.0, 0.46,
        4.2, 9, 0, 'IDLE'
      );
    `);

    const before = db.prepare("SELECT * FROM state_vector_kinestrike WHERE date = '2026-11-11'").get();
    // Re-apply 078 twice + run 004 materialization on the same date to prove zero clobbering
    expect(() => db.exec(sql078)).not.toThrow();
    expect(() => db.exec(sql078)).not.toThrow();
    db.exec("INSERT INTO hrv_daily (date, rmssd_ms) VALUES ('2026-11-11', 58.0);");
    db.prepare(fs.readFileSync(materializePath, 'utf8')).run('2026-11-11');

    const after = db.prepare("SELECT * FROM state_vector_kinestrike WHERE date = '2026-11-11'").get();
    expect(after).toEqual(before);
    db.close();
  });

  test('enforces STRICT types and domain CHECK constraints on KineStrike columns', () => {
    const db = openStateVectorDb();
    db.exec(fs.readFileSync(migrationPath, 'utf8'));
    db.exec("INSERT INTO state_vector_kinestrike (date) VALUES ('2026-11-11');");

    const invalidStatements = [
      "INSERT INTO state_vector_kinestrike (date) VALUES ('2026/11/12')",
      "UPDATE state_vector_kinestrike SET ks_foot = 'W' WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_strike_count = -1 WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_cod_count = -2 WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_fall_warning_count = -1 WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_medial_share_mean = 1.05 WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_cop_x_mean = -1.2 WHERE date = '2026-11-11'",
      "UPDATE state_vector_kinestrike SET ks_fall_last_state = 'SAFE' WHERE date = '2026-11-11'",
    ];
    for (const stmt of invalidStatements) {
      expect(() => db.exec(stmt)).toThrow();
    }
    db.close();
  });
});

describe('WO-KS-BRIDGE-02 Deliverable B: SessionFeelPanel 1-Tap Pre-Selection & Sub-Chips', () => {
  test('exports exact owner-ratified KINESTRIKE_BRIDGE_DEFAULTS and KINESTRIKE_SUBCHIP_LABEL', () => {
    expect(KINESTRIKE_BRIDGE_DEFAULTS).toEqual({
      gctDeltaPctWarn: 6.0,
      zHrvFatigueMax: -0.50,
      copXMedialShiftWarn: 0.45,
      copXLateralGuardWarn: -0.35,
      peakLoadCvWarn: 0.18,
    });
    expect(KINESTRIKE_SUBCHIP_LABEL).toEqual({
      medial_shift: 'Forefoot medial shift (Big-Toe bias)',
      lateral_guard: 'Forefoot lateral shift (Small-Toe guarding)',
      gct_drift: 'Ground contact time drift',
    });
  });

  test('pre-highlights suggestedReasonCodes on first harder/stopped_early selection and renders ratified sub-chips', () => {
    const onSave = ruleOnly();
    const onClose = jest.fn();
    render(
      <SessionFeelPanel
        saved={null}
        note={null}
        suggestedReasonCodes={['pain', 'soreness']}
        suggestedKineStrikeSubChips={['medial_shift', 'gct_drift']}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    expect(screen.getByTestId('session-feel-kinestrike-subchips')).toBeOnTheScreen();
    expect(screen.getByTestId('session-feel-kinestrike-subchip-medial_shift')).toHaveTextContent(
      'Forefoot medial shift (Big-Toe bias)',
    );
    expect(screen.getByTestId('session-feel-kinestrike-subchip-gct_drift')).toHaveTextContent(
      'Ground contact time drift',
    );
    expect(screen.queryByTestId('session-feel-kinestrike-subchip-lateral_guard')).toBeNull();

    // 1-tap flow: tap "Harder than planned" -> suggested reasons ('pain' and 'tired' mapped from 'soreness') are pre-selected
    fireEvent.press(screen.getByTestId('session-feel-harder'));
    expect(screen.getByTestId('session-feel-reason-pain').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('session-feel-reason-tired').props.accessibilityState.selected).toBe(true);

    // Athlete can save directly in 1 tap or untoggle a pre-selected reason first
    fireEvent.press(screen.getByTestId('session-feel-reason-tired'));
    expect(screen.getByTestId('session-feel-reason-tired').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(onSave).toHaveBeenLastCalledWith({ feel: 'harder', reasons: ['pain'] }, '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('never overwrites an already-saved answer and ignores poisoned/unknown suggestion codes', () => {
    const onSave = ruleOnly();
    render(
      <SessionFeelPanel
        saved={{ feel: 'harder', reasons: ['time'] }}
        note="existing note"
        suggestedReasonCodes={['pain', 'invalid_reason']}
        suggestedKineStrikeSubChips={['invalid_subchip']}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('session-feel-kinestrike-subchips')).toBeNull();
    expect(screen.getByTestId('session-feel-reason-time').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('session-feel-reason-pain').props.accessibilityState.selected).toBe(false);
  });
});
