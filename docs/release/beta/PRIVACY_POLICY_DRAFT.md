# Privacy policy — draft

Effective date: [EFFECTIVE DATE]  
Contact: [OWNER CONTACT]

pikeMethods is an offline training app. Your information stays on the device unless you choose to export or otherwise hand it to someone. The release app does not send it to a server. A coach who receives your backup can open its contents with the password; agree how to transfer the file and password safely.

## What the app stores

The app keeps a separate local database for each athlete and a local list identifying the active athlete. Depending on what you enter and use, it stores athlete names and training preferences, goals, equipment and routines; programs, planned and completed sessions, sets, loads and effort; symptom reports, notes, activity and health-support information you choose to provide; and derived training and readiness records. It also stores local settings, database and recovery metadata. A backup can contain several athlete databases, not just the current athlete. Do not put anything in a note that you do not want saved or included in a backup.

## Health data

If you choose to connect Android Health Connect, the app reads sleep sessions, heart rate variability (RMSSD) and resting heart rate when available. On iOS it reads sleep and resting heart rate from Apple Health; it does not read Apple Health HRV. The app saves daily summaries locally. Sleep and, on Android, HRV can contribute to readiness; resting heart rate is retained with measured days and does not contribute to readiness. The app works without connecting health services. You can manage access in the relevant system settings.

## Backups, restore and deletion

You can create a password-protected encrypted backup and choose where to save it. Keep the password and backup safe; the chosen destination and any copies are under your control. Restore requires the password and a review before confirmation; it replaces all athlete data on the device with the backup. The app also retains an encrypted recovery copy during restore. Exported files and copies held by a coach or another recipient are not automatically deleted when you delete local data.

In Coach Mode a coach can keep and switch between several athletes' separate files on one device. A non-active, non-default athlete can be removed from the list and their database deleted. If file deletion fails, the app reports it; reinstalling can clear the remaining local file. The default athlete cannot be deleted in this way. Removing the app clears its app-local data, subject to platform behavior; separately saved exports and other copies must be deleted at their own locations. Health Connect and Apple Health retain their own records under their own settings.

## Evidence

| Claim | Code evidence |
| --- | --- |
| Release network permission removed; debug differs | `apps/mobile/android/app/src/main/AndroidManifest.xml:4-14` |
| Separate athlete files and local registry | `apps/mobile/src/state/useStore.ts:802`; `apps/mobile/src/state/athleteRegistry.ts:4` |
| Profile, goals, sessions and sets | `packages/core-db/src/schema/007_program_engine.sql:67`; `packages/core-db/src/schema/066_focus_and_goals.sql:162`; `packages/core-db/src/schema/001_mechanical_input.sql:61` |
| Symptoms, activity, notes and support information | `packages/core-db/src/schema/005_subjective_report.sql:8`; `packages/core-db/src/schema/064_accessible_coach_support.sql:197` |
| Health reads and daily storage | `packages/biometrics/src/healthConnect.ts:124`; `packages/biometrics/src/appleHealth.ts:317`; `apps/mobile/src/state/useStore.ts:5530` |
| Readiness and resting heart rate | `apps/mobile/src/state/biometricsCopy.ts:13`; `apps/mobile/src/state/biometricsCopy.ts:63` |
| Backup includes all athletes, encrypted export and restore | `apps/mobile/src/state/backupStore.ts:581`; `apps/mobile/src/state/backupStore.ts:1021`; `apps/mobile/src/state/backupStore.ts:1142`; `apps/mobile/src/state/backupStore.ts:1176` |
| Delete limits and failure | `apps/mobile/src/state/useStore.ts:975`; `apps/mobile/src/state/useStore.ts:3752`; `apps/mobile/src/state/useStore.ts:3779` |
| Android automatic backup disabled; iOS exclusion can fail | `apps/mobile/android/app/src/main/AndroidManifest.xml:24`; `apps/mobile/src/state/deviceBackupPolicy.ts:16` |
