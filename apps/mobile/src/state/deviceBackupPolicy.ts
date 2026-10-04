/**
 * deviceBackupPolicy.ts — keep athlete health data out of automatic device
 * backups on iOS, matching Android (AndroidManifest allowBackup="false").
 *
 * What lives in the app's own containers is health and training data: every
 * athlete's SQLite file and its journal/WAL siblings (Library on iOS), the
 * athlete registry, retained encrypted recovery backups and restore staging
 * files (Documents). The app's backup story is the athlete's OWN encrypted
 * export (BackupTransferPanel), not a silent iCloud copy of plaintext health
 * databases.
 *
 * The exclusion is set on the two DIRECTORIES, not on individual files: a
 * restore, rename or new athlete replaces files, and a replaced file would not
 * carry a per-file flag, whereas NSURLIsExcludedFromBackupKey on a directory
 * covers everything created inside it later. It is re-applied on every launch
 * (idempotent) so a container restored by the OS is re-protected. Failure never
 * blocks the app; it is logged with an `[ak-device-backup]` marker and the
 * result of this launch is kept (startupDeviceBackupExclusion) so the native
 * smoke can require 'excluded' on a real simulator.
 */
import { Platform } from 'react-native';

export type DeviceBackupExclusion = 'excluded' | 'not_applicable' | 'failed';

interface BlobUtilIos {
  fs: { dirs: { DocumentDir: string; LibraryDir?: string } };
  ios: { excludeFromBackupKey(path: string): Promise<void> };
}

let startupExclusion: Promise<DeviceBackupExclusion> | null = null;

/** Run once at app start: apply the exclusion, keep the outcome, and log a
 *  failure loudly (never thrown: health data stays usable either way). */
export function startDeviceBackupExclusion(): Promise<DeviceBackupExclusion> {
  startupExclusion = excludeAppDataFromDeviceBackup().then((result) => {
    if (result === 'failed') console.warn('[ak-device-backup] failed to exclude app data from device backup');
    return result;
  });
  return startupExclusion;
}

/** The outcome of this launch's exclusion, or null if it was never started. */
export function startupDeviceBackupExclusion(): Promise<DeviceBackupExclusion> | null {
  return startupExclusion;
}

export async function excludeAppDataFromDeviceBackup(): Promise<DeviceBackupExclusion> {
  if (Platform.OS !== 'ios') return 'not_applicable'; // Android: allowBackup="false"
  try {
    const blob = (require('react-native-blob-util') as { default: BlobUtilIos }).default;
    const directories = [blob.fs.dirs.DocumentDir, blob.fs.dirs.LibraryDir]
      .filter((dir): dir is string => typeof dir === 'string' && dir.length > 0);
    if (directories.length !== 2) return 'failed';
    for (const dir of directories) await blob.ios.excludeFromBackupKey(dir.replace(/\/$/, ''));
    return 'excluded';
  } catch {
    return 'failed';
  }
}
