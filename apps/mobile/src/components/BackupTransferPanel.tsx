import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme/theme';
import { useBackupStore } from '../state/backupStore';
import { QuietAction } from './ui';

const dateLabel = (value: string | null): string => value === null
  ? 'No confirmed backup saved yet.'
  : `Last confirmed save: ${new Date(value).toLocaleString()}`;

export default function BackupTransferPanel(): React.JSX.Element {
  const status = useBackupStore((state) => state.status);
  const message = useBackupStore((state) => state.message);
  const preview = useBackupStore((state) => state.preview);
  const lastSuccessfulBackupAt = useBackupStore((state) => state.lastSuccessfulBackupAt);
  const createBackup = useBackupStore((state) => state.createBackup);
  const chooseRestore = useBackupStore((state) => state.chooseRestore);
  const confirmRestore = useBackupStore((state) => state.confirmRestore);
  const cancelRestore = useBackupStore((state) => state.cancelRestore);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const working = status === 'working';
  const strongEnough = password.length >= 12;
  const confirmed = strongEnough && password === confirmation;

  return (
    <View style={styles.section} testID="backup-transfer-section">
      <Text style={styles.heading}>BACK UP &amp; TRANSFER DATA</Text>
      <Text style={styles.body}>
        An encrypted backup includes every athlete, profile, plan, routine, workout, activity, health-support record, preference, and identifier on this phone.
        It is separate from readable CSV history export.
      </Text>
      <Text style={styles.body}>
        New phone: create a backup, save it somewhere you can reach from the new phone, install pikeMethods there, then choose Restore backup.
        A copy kept only on this phone will not protect you if the phone is lost.
      </Text>
      <Text style={styles.detail}>{dateLabel(lastSuccessfulBackupAt)}</Text>
      <Text style={styles.label}>BACKUP PASSWORD</Text>
      <Text style={styles.detail}>Use at least 12 characters. pikeMethods cannot recover this password.</Text>
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        maxLength={1024}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        accessibilityLabel="Backup password, at least 12 characters"
        placeholder="Backup password"
        placeholderTextColor={theme.color.textLow}
      />
      <TextInput
        disableFullscreenUI
        style={styles.input}
        value={confirmation}
        onChangeText={setConfirmation}
        maxLength={1024}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        accessibilityLabel="Confirm backup password"
        placeholder="Confirm password for creating a backup"
        placeholderTextColor={theme.color.textLow}
      />
      {!strongEnough && password.length > 0 && <Text style={styles.detail}>Password needs at least 12 characters.</Text>}
      {strongEnough && confirmation.length > 0 && password !== confirmation && <Text style={styles.detail}>Passwords do not match.</Text>}
      <QuietAction
        label="CREATE ENCRYPTED BACKUP"
        onPress={() => { void createBackup(password); }}
        disabled={working || !confirmed}
        accessibilityLabel="Create encrypted backup of all athletes and choose where to save it"
        testID="create-backup-button"
      />
      <QuietAction
        label="RESTORE ENCRYPTED BACKUP"
        onPress={() => { void chooseRestore(password); }}
        disabled={working || !strongEnough || preview !== null}
        accessibilityLabel="Choose and preview an encrypted backup to replace all data"
        testID="choose-restore-button"
      />
      {message !== null && (
        <Text accessibilityLiveRegion="polite" style={styles.body} testID="backup-status-message">{message}</Text>
      )}
      {preview !== null && (
        <View style={styles.preview} testID="restore-preview">
          <Text style={styles.label}>RESTORE PREVIEW</Text>
          <Text style={styles.body}>Created {new Date(preview.createdAt).toLocaleString()}</Text>
          <Text style={styles.body}>{preview.databaseCount} athlete database{preview.databaseCount === 1 ? '' : 's'} · {Math.ceil(preview.totalBytes / 1_048_576)} MB</Text>
          <Text style={styles.body}>Athletes: {preview.athleteNames.join(', ')}</Text>
          <Text style={styles.warning}>
            Replace only: this removes all current athlete data and replaces it with this backup. Nothing is merged.
            Before replacement, pikeMethods creates and verifies an encrypted recovery backup on this phone.
          </Text>
          <QuietAction
            label="CONFIRM REPLACE ALL DATA"
            onPress={() => { void confirmRestore(password); }}
            disabled={working || !strongEnough}
            accessibilityLabel="Confirm replace all current athlete data from this backup"
            testID="confirm-restore-button"
          />
          <QuietAction label="KEEP CURRENT DATA" onPress={cancelRestore} disabled={working} testID="cancel-restore-button" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: theme.space[6], gap: theme.space[3] },
  heading: { ...theme.font.eyebrow, color: theme.color.textHi },
  body: { ...theme.font.body, color: theme.color.textMid },
  detail: { ...theme.font.label, color: theme.color.textLow },
  label: { ...theme.font.label, color: theme.color.textHi },
  input: {
    ...theme.font.body,
    minHeight: theme.touch.min,
    color: theme.color.textHi,
    backgroundColor: theme.color.ink1,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.space[4],
  },
  preview: { borderWidth: 1, borderColor: theme.color.line, padding: theme.space[4], gap: theme.space[3] },
  warning: { ...theme.font.body, color: theme.color.textHi },
});
