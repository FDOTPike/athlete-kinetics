import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BackupTransferPanel from '../../src/components/BackupTransferPanel';

let mockState;
jest.mock('../../src/state/backupStore', () => ({ useBackupStore: (selector) => selector(mockState) }));

beforeEach(() => {
  mockState = {
    status: 'idle', message: null, lastSuccessfulBackupAt: null, preview: null,
    initialize: jest.fn(), createBackup: jest.fn(), chooseRestore: jest.fn(), confirmRestore: jest.fn(), cancelRestore: jest.fn(),
  };
});

test('explains encrypted all-athlete backup, off-phone storage, CSV separation, and replace-only restore', () => {
  mockState.preview = {
    backupId: 'one', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Athlete 1', 'Alex'],
    databaseCount: 2, totalBytes: 2_097_152, replaceOnly: true,
  };
  render(<BackupTransferPanel />);
  expect(screen.getByText(/includes every athlete, profile, plan, routine, workout, activity, health-support record/)).toBeOnTheScreen();
  expect(screen.getByText(/separate from readable CSV history export/)).toBeOnTheScreen();
  expect(screen.getByText(/copy kept only on this phone will not protect you/)).toBeOnTheScreen();
  expect(screen.getByText(/Replace only: this removes all current athlete data/)).toBeOnTheScreen();
  expect(screen.getByText(/creates and verifies an encrypted recovery backup/)).toBeOnTheScreen();
  expect(screen.getByText('Athletes: Athlete 1, Alex')).toBeOnTheScreen();
});

test('requires a confirmed 12-character password to create but not to open a restore picker', () => {
  render(<BackupTransferPanel />);
  const password = screen.getByLabelText('Backup password, at least 12 characters');
  const confirmation = screen.getByLabelText('Confirm backup password');
  const create = screen.getByTestId('create-backup-button');
  const restore = screen.getByTestId('choose-restore-button');
  expect(create.props.accessibilityState.disabled).toBe(true);
  expect(restore.props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(password, 'twelve-chars+');
  expect(screen.getByTestId('choose-restore-button').props.accessibilityState.disabled).toBe(false);
  expect(screen.getByTestId('create-backup-button').props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(confirmation, 'twelve-chars+');
  fireEvent.press(screen.getByTestId('create-backup-button'));
  expect(mockState.createBackup).toHaveBeenCalledWith('twelve-chars+');
  expect(mockState.chooseRestore).not.toHaveBeenCalled();
});

test('preview confirmation is explicit and cancellation never invokes restore', () => {
  mockState.preview = {
    backupId: 'one', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Athlete 1'],
    databaseCount: 1, totalBytes: 1_048_576, replaceOnly: true,
  };
  render(<BackupTransferPanel />);
  fireEvent.changeText(screen.getByLabelText('Backup password, at least 12 characters'), 'restore-passphrase');
  fireEvent.press(screen.getByTestId('cancel-restore-button'));
  expect(mockState.cancelRestore).toHaveBeenCalledTimes(1);
  expect(mockState.confirmRestore).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('confirm-restore-button'));
  expect(mockState.confirmRestore).toHaveBeenCalledWith('restore-passphrase');
});
