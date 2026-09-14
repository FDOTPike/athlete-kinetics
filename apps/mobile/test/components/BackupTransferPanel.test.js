import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BackupTransferPanel from '../../src/components/BackupTransferPanel';

let mockState;
jest.mock('../../src/state/backupStore', () => ({ useBackupStore: (selector) => selector(mockState) }));

beforeEach(() => {
  mockState = {
    status: 'idle', startupSafe: true, message: null, lastSuccessfulBackupAt: null, preview: null,
    recoveryAvailable: false,
    initialize: jest.fn(), createBackup: jest.fn(), chooseRestore: jest.fn(), reviewRecovery: jest.fn(), confirmRestore: jest.fn(), cancelRestore: jest.fn(),
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

test('offers a bounded password-gated path to review the previous encrypted recovery', () => {
  mockState.recoveryAvailable = true;
  render(<BackupTransferPanel />);
  expect(screen.getByText(/protected copy from the previous restore is available/)).toBeOnTheScreen();
  expect(screen.getByText(/password from that restore/)).toBeOnTheScreen();
  const action = screen.getByTestId('review-recovery-button');
  expect(action.props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Backup password, at least 12 characters'), 'previous-password');
  fireEvent.press(screen.getByTestId('review-recovery-button'));
  expect(mockState.reviewRecovery).toHaveBeenCalledWith('previous-password');
});

test('recovery-required startup state disables every backup and restore action', () => {
  mockState.startupSafe = false;
  mockState.recoveryAvailable = true;
  mockState.preview = {
    backupId: 'one', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Athlete 1'],
    databaseCount: 1, totalBytes: 1_048_576, replaceOnly: true,
  };
  render(<BackupTransferPanel />);
  fireEvent.changeText(screen.getByLabelText('Backup password, at least 12 characters'), 'previous-password');
  fireEvent.changeText(screen.getByLabelText('Confirm backup password'), 'previous-password');
  for (const id of ['create-backup-button', 'choose-restore-button', 'review-recovery-button', 'confirm-restore-button', 'cancel-restore-button']) {
    expect(screen.getByTestId(id).props.accessibilityState.disabled).toBe(true);
  }
});

test('previous-recovery preview states that no undo point is created instead of the portable recovery promise', () => {
  mockState.preview = {
    backupId: 'recovery', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Recovery A1', 'Recovery A2'],
    databaseCount: 2, totalBytes: 2_097_152, replaceOnly: true, source: 'retained_recovery',
  };
  render(<BackupTransferPanel />);
  expect(screen.getByText('This replaces current data with the previous recovery. It will not create another undo point.')).toBeOnTheScreen();
  expect(screen.queryByText(/creates and verifies an encrypted recovery backup/)).toBeNull();
  expect(screen.queryByText(/Replace only: this removes all current athlete data/)).toBeNull();
});

test('portable-backup preview keeps the recovery-backup promise without the no-undo warning', () => {
  mockState.preview = {
    backupId: 'portable', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Athlete 1'],
    databaseCount: 1, totalBytes: 1_048_576, replaceOnly: true, source: 'portable_backup',
  };
  render(<BackupTransferPanel />);
  expect(screen.getByText(/creates and verifies an encrypted recovery backup/)).toBeOnTheScreen();
  expect(screen.queryByText(/will not create another undo point/)).toBeNull();
});

test('an in-flight backup or restore keeps every action disabled', () => {
  mockState.status = 'working';
  mockState.recoveryAvailable = true;
  mockState.preview = {
    backupId: 'portable', createdAt: '2026-09-13T05:00:00.000Z', athleteNames: ['Athlete 1'],
    databaseCount: 1, totalBytes: 1_048_576, replaceOnly: true, source: 'portable_backup',
  };
  render(<BackupTransferPanel />);
  fireEvent.changeText(screen.getByLabelText('Backup password, at least 12 characters'), 'in-flight-password');
  fireEvent.changeText(screen.getByLabelText('Confirm backup password'), 'in-flight-password');
  for (const id of ['create-backup-button', 'choose-restore-button', 'review-recovery-button', 'confirm-restore-button', 'cancel-restore-button']) {
    expect(screen.getByTestId(id).props.accessibilityState.disabled).toBe(true);
  }
});
