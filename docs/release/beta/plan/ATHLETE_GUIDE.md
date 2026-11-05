# Athlete guide — fourteen-day Android beta

Coach/contact: ____________________  Dates: ____________________

**Install with the owner.** Sign the information/consent form first. Use only the owner's confirmed Play closed-test invitation and build instructions. If the owner supplies an APK for supervised testing, verify its source with the owner and follow the phone's install prompts. Keep your existing data backed up; do not uninstall or clear storage to solve a problem. Let the owner set up your athlete and Coach Mode arrangement. Check the correct athlete before training. Only owner-signed beginner previews belong in this beta.

**Log every set you actually perform.** Follow your coached plan. Enter the actual reps or duration and load; record skips honestly. Do not add training for the test. If the app shows a load you change, log what you lifted. Tell the owner about a wrong plan, lost set or failed resume.

**Answer effort honestly.** Use the on-screen effort question after a set. Give your own answer; do not change it to make an estimate appear. Ask the owner if unsure. The screen explains the effort scale and offers its effort-entry controls (`apps/mobile/src/screens/SessionScreen.tsx:1111`).

**Finish with session feel.** Say whether it went as planned, was harder/easier or stopped early; select the reasons when asked and optionally add a short note. The recorded choices are session-wide (`origin/master:packages/core-db/src/schema/070_session_feel.sql:26`). A note is not an alert to your coach.

**Question box, when enabled.** Intended beta behaviour: type a training question; see a single fixed glossary card, a no-answer message or a symptom referral. It is not a conversation, diagnosis or live coach inbox. Questions and shown responses stay in a local log for the backup review. The owner must confirm this separately built feature and its backup inclusion before the beta starts. Contact the owner directly if the answer is unhelpful. Do not put other people's information in the box.

**Stop and contact the owner the same day** for any app halt or injury report. Stop for concerning symptoms. Get appropriate professional/urgent help when needed; do not wait for the question box, weekly backup or coach response. Never continue a halted session for testing.

**Hand over the encrypted backup.** Proposed schedule: setup check, day 7, day 14 or withdrawal. In the athlete/profile screen open the backup section (`apps/mobile/src/screens/ProfileScreen.tsx:978`). Enter and confirm a password of at least 12 characters, then tap **CREATE ENCRYPTED BACKUP** and choose local phone storage (`apps/mobile/src/components/BackupTransferPanel.tsx:44`, `apps/mobile/src/components/BackupTransferPanel.tsx:75`). This includes **every athlete and health record on the phone**, not only this beta (`apps/mobile/src/components/BackupTransferPanel.tsx:35`). Resolve anyone else's records with the owner before exporting. Hand the saved file to the owner in person using USB/offline transfer; give the password separately in person. Wait for receipt/readability confirmation. Do not use cloud upload or send the password in a message. Do not tap Restore to export: restore replaces current data (`apps/mobile/src/components/BackupTransferPanel.tsx:118`).

You can ask questions or withdraw without affecting ordinary coaching. Keep your signed consent form for the data-handling details.
