# Health Apps Declaration ? draft

- **Health feature:** Yes. Select **Activity and Fitness** for workout planning and logging, including optional fitness-related measurements. Sleep is an input to readiness, not a dedicated sleep management service; review whether the actual Play form requires another category. `packages/core-db/src/schema/001_mechanical_input.sql:61`; `apps/mobile/src/state/biometricsCopy.ts:63`
- **Purpose:** Offline training guidance, session and set recording, and optional readiness inputs. Health Connect types and purpose are detailed in HEALTH_CONNECT_PERMISSIONS.md.
- **Medical device:** The product is intended as training guidance, not a medical device. The owner must confirm the applicable regulatory status and any jurisdiction-specific claims before submission. `apps/mobile/src/screens/ProfileScreen.tsx:408`
- **Diagnosis or treatment:** The app does not diagnose or replace medical advice. Some symptom reports halt a session or restrict exercises; safety guidance tells the athlete to stop when something feels unsafe and seek qualified advice when needed. It is not a guarantee of detecting every dangerous symptom. `apps/mobile/src/screens/SessionScreen.tsx:845`; `apps/mobile/src/screens/SessionScreen.tsx:665`; `apps/mobile/src/screens/ProfileScreen.tsx:409`
- **Privacy policy:** Publish the reviewed policy at a public URL and enter that URL in Play Console. `[OWNER CONTACT]` and effective date must be completed first.

Google requires this declaration even for closed testing. Check the live form and applicable policy before filing: [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291).
