/**
 * #173: backups hold at most MAX_AGGREGATE_DATABASE_BYTES of athlete data
 * (about five athletes; an empty athlete database is ~1.4 MB). The app says so
 * before a sixth athlete is added and on the backup screen. The cap, the
 * archive format and restore are unchanged.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import {
  ADD_ATHLETE_BACKUP_WARNING,
  addingAthleteExceedsBackupCap,
  backupLimitText,
  estimateFromSizes,
} from '../../src/state/backupCapacity';
import BackupTransferPanel from '../../src/components/BackupTransferPanel';

const EMPTY_ATHLETE_BYTES = 1_400_832; // measured in the Android walk (W4-1)
const athletes = (n) => Array.from({ length: n }, () => EMPTY_ATHLETE_BYTES);

let mockState;
let mockEstimate;
jest.mock('../../src/state/backupStore', () => ({ useBackupStore: (selector) => selector(mockState) }));
jest.mock('../../src/state/backupCapacity', () => ({
  ...jest.requireActual('../../src/state/backupCapacity'),
  measureBackupSize: jest.fn(async () => mockEstimate),
}));

beforeEach(() => {
  mockState = {
    status: 'idle', startupSafe: true, message: null, lastSuccessfulBackupAt: null, preview: null,
    recoveryAvailable: false,
    initialize: jest.fn(), createBackup: jest.fn(), chooseRestore: jest.fn(), reviewRecovery: jest.fn(), confirmRestore: jest.fn(), cancelRestore: jest.fn(),
  };
  mockEstimate = null;
});

describe('the warning before a sixth athlete', () => {
  test('five empty athletes: adding a sixth would go over the cap', () => {
    expect(addingAthleteExceedsBackupCap(estimateFromSizes(athletes(5)), 5)).toBe(true);
  });

  test('four empty athletes: adding a fifth stays under the cap', () => {
    expect(addingAthleteExceedsBackupCap(estimateFromSizes(athletes(4)), 4)).toBe(false);
  });

  test('when the sizes cannot be read, the count decides: warn from the sixth athlete', () => {
    expect(addingAthleteExceedsBackupCap(null, 4)).toBe(false);
    expect(addingAthleteExceedsBackupCap(null, 5)).toBe(true);
  });

  test('the warning says the athlete can still be added', () => {
    expect(ADD_ATHLETE_BACKUP_WARNING).toBe(
      'Backups cover up to about five athletes in this version. You can still add this athlete, '
      + 'but a backup will not be possible until a later version.',
    );
  });

  test('unreadable sizes give no estimate', () => {
    expect(estimateFromSizes([1024, Number.NaN])).toBeNull();
    expect(estimateFromSizes([-1])).toBeNull();
  });
});

describe('the backup screen states the limit and the current total', () => {
  test('the limit text names the cap and the total', () => {
    expect(backupLimitText(estimateFromSizes(athletes(3))))
      .toBe('Backups cover up to about five athletes in this version (8.0 MB of athlete data in all). '
        + 'This phone holds 3 athletes, 4.0 MB.');
    expect(backupLimitText(null))
      .toBe('Backups cover up to about five athletes in this version (8.0 MB of athlete data in all).');
    expect(backupLimitText(estimateFromSizes(athletes(7)))).toMatch(/That is over the limit, so a backup is not possible until a later version\.$/);
  });

  test('the panel replaces "includes every athlete" with the limit and the total', async () => {
    mockEstimate = estimateFromSizes(athletes(2));
    render(<BackupTransferPanel />);
    expect(screen.queryByText(/includes every athlete/)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('backup-limit'))
      .toHaveTextContent('Backups cover up to about five athletes in this version (8.0 MB of athlete data in all). This phone holds 2 athletes, 2.7 MB.'));
  });

  test('the panel still states the limit when the total cannot be read', async () => {
    mockEstimate = null;
    render(<BackupTransferPanel />);
    await waitFor(() => expect(screen.getByTestId('backup-limit'))
      .toHaveTextContent('Backups cover up to about five athletes in this version (8.0 MB of athlete data in all).'));
  });
});
