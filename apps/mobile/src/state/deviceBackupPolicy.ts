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
 * blocks the app; the result is reported for diagnostics only.
 */
import { Platform } from 'react-native';

export type DeviceBackupExclusion = 'excluded' | 'not_applicable' | 'failed';

interface BlobUtilIos {
  fs: { dirs: { DocumentDir: string; LibraryDir?: string } };
  ios: { excludeFromBackupKey(path: string): Promise<void> };
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
