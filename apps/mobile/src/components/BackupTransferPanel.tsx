import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme/theme';
import { useBackupStore } from '../state/backupStore';
import { formatAthleteDateTime } from '../state/athleteDate';
import { backupLimitText, measureBackupSize, type BackupSizeEstimate } from '../state/backupCapacity';
import { QuietAction } from './ui';

const dateLabel = (value: string | null): string => value === null
  ? 'No confirmed backup saved yet.'
  : `Last confirmed save: ${formatAthleteDateTime(value)}`;

export interface BackupTransferPanelProps {
  /** The number of athletes on the phone; a change re-reads the backup total (#173). */
  athleteCount?: number;
}

/** m:ss for a run that can take minutes on a slow phone (#135). */
const elapsedLabel = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function BackupTransferPanel({ athleteCount }: BackupTransferPanelProps = {}): React.JSX.Element {
  const status = useBackupStore((state) => state.status);
  const message = useBackupStore((state) => state.message);
  const preview = useBackupStore((state) => state.preview);
  const startupSafe = useBackupStore((state) => state.startupSafe);
  const recoveryAvailable = useBackupStore((state) => state.recoveryAvailable);
  const lastSuccessfulBackupAt = useBackupStore((state) => state.lastSuccessfulBackupAt);
  const createBackup = useBackupStore((state) => state.createBackup);
  const chooseRestore = useBackupStore((state) => state.chooseRestore);
  const reviewRecovery = useBackupStore((state) => state.reviewRecovery);
  const confirmRestore = useBackupStore((state) => state.confirmRestore);
  const cancelRestore = useBackupStore((state) => state.cancelRestore);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // #173: the limit and the current total, re-read after each backup action
  // and whenever the athlete count changes (the panel stays mounted while
  // athletes are added or deleted on the Profile screen).
  const [sizeEstimate, setSizeEstimate] = useState<BackupSizeEstimate | null>(null);
  useEffect(() => {
    if (status === 'working') return undefined;
    let live = true;
    void measureBackupSize().then((estimate) => { if (live) setSizeEstimate(estimate); });
    return () => { live = false; };
  }, [status, athleteCount]);
  // #135: while a run is working, the athlete sees that it is still going and
  // how long it has taken. Key derivation can take minutes on a slow phone.
  const [runStart, setRunStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [statusArea, setStatusArea] = useState<'create' | 'restore'>('create');
  const working = status === 'working';
  const showStatusInRestore = preview !== null || statusArea === 'restore';
  const renderStatus = (): React.JSX.Element | null => (
    <>
      {working && (
        <View style={styles.progress} testID="backup-working-indicator">
          <ActivityIndicator color={theme.color.textMid} />
          <Text style={styles.body} testID="backup-working-elapsed">
            {`${message ?? 'Working…'} ${elapsedLabel(now - (runStart ?? now))}`}
          </Text>
        </View>
      )}
      {!working && message !== null && (
        <Text accessibilityLiveRegion="polite" style={styles.body} testID="backup-status-message">{message}</Text>
      )}
    </>
  );

  useEffect(() => {
    if (!working) {
      setRunStart(null);
      return undefined;
    }
    const started = Date.now();
    setRunStart(started);
    setNow(started);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [working]);

  // Announced once when the run starts; the ticking time is not announced.
  useEffect(() => {
    if (working) AccessibilityInfo.announceForAccessibility(message ?? 'Working.');
  }, [working]);
  const recoveryBlocked = startupSafe !== true;
  const strongEnough = password.length >= 12;
  const confirmed = strongEnough && password === confirmation;

  return (
    <View style={styles.section} testID="backup-transfer-section">
      <Text style={styles.heading}>BACK UP &amp; TRANSFER DATA</Text>
      <Text style={styles.body}>
        An encrypted backup includes each athlete&apos;s profile, plans, routines, workouts, activities, health-support records, preferences, and identifiers on this phone.
      </Text>
      <Text style={styles.body} testID="backup-limit">{backupLimitText(sizeEstimate)}</Text>
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
        onPress={() => { setStatusArea('create'); void createBackup(password); }}
        disabled={working || recoveryBlocked || !confirmed}
        accessibilityLabel="Create encrypted backup of all athletes and choose where to save it"
        testID="create-backup-button"
      />
      {!showStatusInRestore && renderStatus()}
      <QuietAction
        label="RESTORE ENCRYPTED BACKUP"
        onPress={() => { setStatusArea('restore'); void chooseRestore(password); }}
        disabled={working || recoveryBlocked || !strongEnough || preview !== null}
        accessibilityLabel="Choose and preview an encrypted backup to replace all data"
        testID="choose-restore-button"
      />
      {recoveryAvailable && (
        <>
          <Text style={styles.detail}>
            A protected copy from the previous restore is available. Review it using the password from that restore.
          </Text>
          <QuietAction
            label="REVIEW PREVIOUS DATA RECOVERY"
            onPress={() => { setStatusArea('restore'); void reviewRecovery(password); }}
            disabled={working || recoveryBlocked || !strongEnough || preview !== null}
            accessibilityLabel="Review the protected data recovery from the previous restore"
            testID="review-recovery-button"
          />
        </>
      )}
      {preview !== null && (
        <View style={styles.preview} testID="restore-preview">
          <Text style={styles.label}>RESTORE PREVIEW</Text>
          <Text style={styles.body}>Created {formatAthleteDateTime(preview.createdAt)}</Text>
          <Text style={styles.body}>{preview.databaseCount} athlete database{preview.databaseCount === 1 ? '' : 's'} · {Math.ceil(preview.totalBytes / 1_048_576)} MB</Text>
          <Text style={styles.body}>Athletes: {preview.athleteNames.join(', ')}</Text>
          {preview.source === 'retained_recovery' ? (
            <Text style={styles.warning}>
              This replaces current data with the previous recovery. It will not create another undo point.
            </Text>
          ) : (
            <Text style={styles.warning}>
              Replace only: this removes all current athlete data and replaces it with this backup. Nothing is merged.
              Before replacement, pikeMethods creates and verifies an encrypted recovery backup on this phone.
            </Text>
          )}
          <QuietAction
            label="CONFIRM REPLACE ALL DATA"
            onPress={() => { setStatusArea('restore'); void confirmRestore(); }}
            disabled={working || recoveryBlocked}
            accessibilityLabel="Confirm replace all current athlete data from this backup"
            testID="confirm-restore-button"
          />
          <QuietAction label="KEEP CURRENT DATA" onPress={() => { setStatusArea('restore'); cancelRestore(); }} disabled={working || recoveryBlocked} testID="cancel-restore-button" />
        </View>
      )}
      {showStatusInRestore && renderStatus()}
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
  progress: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  preview: { borderWidth: 1, borderColor: theme.color.line, padding: theme.space[4], gap: theme.space[3] },
  warning: { ...theme.font.body, color: theme.color.textHi },
});
