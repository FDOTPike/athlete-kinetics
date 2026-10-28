# Google Play Data safety — draft answers

Scope: the Android release build and this closed beta. Verify the final merged, signed artifact, dependencies, distribution and actual backup handover before submitting. Play's definitions concern off-device collection and certain third-party transfers, not all local storage. The coach will receive athlete backups by explicit athlete action; assess the actual transfer and any intermediaries against the user-initiated-action exception. Do not treat encryption alone as proof that the developer cannot read a file: the coach may receive its password.

| Question | Draft answer and evidence |
| --- | --- |
| Does the app collect or share any required user data types? | **No**, subject to the handover exception and final-build verification. Release removes INTERNET; export is user initiated and encrypted: `apps/mobile/android/app/src/main/AndroidManifest.xml:12`; `apps/mobile/src/state/backupStore.ts:1021` |
| Is all collected data encrypted in transit? | Not applicable if no data is declared collected. A user-selected destination or transfer may use other software; the app writes an encrypted file: `apps/mobile/src/state/backupStore.ts:1044` |
| Can users request deletion? | Not applicable as a collection question if no data is declared collected. Local removal is limited and exported copies persist: `apps/mobile/src/state/useStore.ts:975`; `apps/mobile/src/state/useStore.ts:3779` |
| Account creation and account deletion? | No app account creation identified; athlete registry is local: `apps/mobile/src/state/athleteRegistry.ts:4` |
| Data types, collected/shared, purpose, optionality, ephemeral processing | Not applicable under the proposed no-collection/no-sharing answer. Local health, fitness, symptoms and profile data are still stored: `apps/mobile/src/state/useStore.ts:5530`; `packages/core-db/src/schema/005_subjective_report.sql:8`; `packages/core-db/src/schema/007_program_engine.sql:67` |
| Security practices and optional badges | Do not claim an independent security review, family badge or other optional certification without separate evidence. Backup is encrypted at export: `apps/mobile/src/state/backupStore.ts:1024` |

If the actual handover does not qualify for Play's exception, revisit collection/sharing, each applicable data type, purpose and optionality with the owner before filing. This form covers all Play-distributed versions, including SDK behavior. [Google's form guidance](https://support.google.com/googleplay/android-developer/answer/10787469) defines collection, sharing and exceptions.
