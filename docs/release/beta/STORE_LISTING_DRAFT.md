# Store listing — draft

**App name:** pikeMethods

**Short description (under 80 characters):** Plan training, log sessions and track your progress offline.

**Full description:**

Plan your training and record your work with pikeMethods. Set up your goals, equipment and schedule, then follow your sessions and log sets as you go.

Review your training history and adjust your plan as your needs change. Optionally connect Health Connect to include available sleep and heart rate variability in readiness and keep resting heart rate with your measured days. The app works without a health connection.

Coach Mode keeps separate athlete files on one device. You can create an encrypted backup and choose where to save it. Your training information stays on your device unless you choose to export it.

pikeMethods provides training guidance, is not a medical device and does not diagnose, treat, cure, or prevent any medical condition; stop if something feels unsafe and consult a qualified healthcare professional for medical advice, diagnosis, or treatment.

**Screenshot shot list:** Capture the real Android release build with fictional data, no personal health details, after branch integration and owner review.

1. Onboarding: goals and training experience filled in.
2. Profile: equipment and schedule configured.
3. Today: a planned training day ready to start.
4. Session: one exercise with a set ready to log.
5. Session: logged set and next step.
6. Progress: fictional training history.
7. Profile: Coach Mode showing fictional athlete names.
8. Profile: encrypted backup controls, with no password visible.

**Icon brief:** A simple, distinctive movement or training symbol on a dark, solid field; no text, medical symbols or third-party marks. Keep the foreground within the 66dp central safe zone on the 108dp adaptive icon grid. Two editable candidates are in `icon/`; verify legibility at launcher size.

**Feature evidence:** `apps/mobile/src/screens/OnboardingScreen.tsx:1`; `apps/mobile/src/screens/SessionScreen.tsx:1`; `apps/mobile/src/screens/ProgressScreen.tsx:1`; `apps/mobile/src/state/biometricsCopy.ts:63`; `apps/mobile/src/state/useStore.ts:802`; `apps/mobile/src/state/backupStore.ts:1021`
