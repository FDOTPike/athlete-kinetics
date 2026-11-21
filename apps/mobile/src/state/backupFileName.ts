/** The person-facing backup file name, dated by the athlete's own calendar
 *  day. The UTC date named a backup made at 01:52 on 3 Nov in Sydney
 *  "2026-11-02" (Android walk 2026-11-03, fn-6).
 *  Kept free of imports so a test can load it in a process started in another
 *  time zone (test/components/BackupFileName.test.js). */
export function backupFileNameFor(now: Date): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `pikeMethods-${day}.pmbak`;
}
