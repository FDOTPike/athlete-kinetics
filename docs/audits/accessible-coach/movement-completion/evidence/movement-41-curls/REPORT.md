# MOV-A11 Evidence Report — Specialised Curls (`movement-41-curls`)

- **Batch:** `MOV-A11`
- **Branch:** `movement/46-curls-2026-10-18`
- **Base Commit:** `20c29c8a314c4f7f522ae1a64427e734047fadec`
- **Source Commit:** `48f191ffd87f0de2a42ddce60ac83085ea324871`
- **Movements Authored (7):** `184`, `281`, `109`, `190`, `213`, `240`, `259`

## 1. Movement Biomechanics and Catalogue Quotes

### 184 — Drag Curl (`drag-curl`)
- **Instructions:** *"Stand tall holding a barbell against the front of the thighs with a shoulder-width underhand grip. Drag the bar straight up the torso, letting the elbows travel back behind the ribs as it rises. Lower along the same contact path; when the bar leaves the body, reduce the load."*
- **Cues:** *"Keep the bar touching the torso. Let the elbows drift back. Lower along the same line."*
- **Biomechanical Implementation:** Solved at every tick via 2-link arm inverse kinematics (`armReach: true`, `elbowPole: 180`) with both wrists pinned to the anterior torso contact line (`x = torsoFrontX + 0.25`) as `y` rises vertically from the upper thighs (`y = 43.3`) to the lower ribs (`y = 58.0`), driving the elbows backward behind the ribs (`elbow.x = -7.84 < hip.x - 5`) while preserving constant rigid-bar grip separation (`12.0` units across all ticks).

### 281 — Standing Dumbbell Reverse Curl (`standing-dumbbell-reverse-curl`)
- **Instructions:** *"Stand tall with a dumbbell in each hand, arms straight and palms facing down. Keeping the upper arms still, curl the dumbbells up to shoulder height with the palms still facing down. Pause, then lower slowly until the arms are straight."*
- **Cues:** *"Palms face down throughout. Upper arms stay still. Lower slowly."*
- **Biomechanical Implementation:** Standing oblique chain spec (`yawDeg: 34`) with `implement: 'bells'` and `palm: 'down'`, encoding pronated hand/thumb orientation and handle slant throughout the entire curl. Start elbow extension is `176.0 deg` (`>= 172 deg`), upper-arm drift is `0.0` units across all ticks, and peak wrist rises to shoulder height.

### 109 — Zottman Curl (`zottman-curl`)
- **Instructions:** *"Stand with dumbbells at the sides, curl with the palms turning up, and keep the upper arms quiet beside the ribs. At the top, rotate to palms-down while the elbows stay closed, then lower through the overhand grip. Turn back to neutral only at the bottom; this is lighter than the ego wants because the slow overhand descent is the part you came for."*
- **Cues:** *"Curl palms-up with quiet elbows. Turn the knuckles over at the top. Lower slowly through the overhand grip."*
- **Biomechanical Implementation:** Standing oblique chain spec (`yawDeg: 40`) with `implement: 'bells'` and `forearmTurn: true`, plus a forearm-and-bell close-up inset (`inset: { part: 'forearm' }`). The four phases of the cycle (`[0, 0.35, 0.55, 0.85, 1]`) drive:
  1. Concentric supinated curl (`t = 0.00 -> 0.35`, bell axis perpendicular to forearm axis, `dot = 0.000`).
  2. Top pronation turn (`t = 0.35 -> 0.55`, forearm rotates from palms-up to palms-down while elbows stay pinned at the sides).
  3. Slow overhand eccentric descent (`t = 0.55 -> 0.85`, bell axis aligned with pronated grip, `dot = 1.000`).
  4. Bottom turn back to neutral (`t = 0.85 -> 1.00`).

### 190 — Dumbbell Prone Incline Curl (`dumbbell-prone-incline-curl`)
- **Instructions:** *"Lie face down on an incline bench with the shoulders near the top and a dumbbell in each hand, arms hanging straight down and palms facing forward. Keeping the upper arms still, curl the dumbbells up until the elbows are fully bent. Lower slowly until the arms are straight again."*
- **Cues:** *"Chest stays on the bench. Upper arms hang straight down. Lower to a full stretch."*
- **Biomechanical Implementation:** Prone trunk supported on a `38 deg` incline bench (`trunk: 38`), shoulders positioned near the top of the pad, upper arms hanging vertically (`upperArm: [-90, 6]`, `|elbow.x - shoulder.x| = 0.00`), full bottom stretch (`elbowAngle = 180.0 deg >= 172 deg`), and zero upper-arm drift (`0.00` units) as the forearms curl to full flexion (`32.0 deg`).

### 213 — High Cable Curls (`high-cable-curls`)
- **Instructions:** *"Stand between two high pulleys holding a handle in each hand, upper arms out to the sides at shoulder height and palms facing you. Keeping the upper arms still, curl the handles in toward the ears. Squeeze, then straighten the arms slowly."*
- **Cues:** *"Upper arms level with the floor. Curl the hands to the ears. Straighten slowly."*
- **Biomechanical Implementation:** Front-oblique stance (`yawDeg: 85`, `originX: 50`) centered between dual high cable columns (`cableOrigin: [92, 92]` and `cableOriginFar: [8, 92]`). Upper arms are held out to the sides level with the floor (`|elbow.y - shoulder.y| = 0.00`) with zero elbow drift while the forearms curl inward from extended (`165.0 deg`) toward the ears (`distToHead = 6.99` units at peak).

### 240 — Lying Cable Curl (`lying-cable-curl`)
- **Instructions:** *"Lie on your back facing a low pulley with the feet braced against the base of the machine and the legs straight, holding the bar with a shoulder-width underhand grip and the arms almost straight. Keeping the upper arms still and the elbows close to the body, curl the bar toward the chest. Squeeze, then lower the bar slowly to the start."*
- **Cues:** *"Elbows stay close to the body. Upper arms stay still. Lower slowly."*
- **Biomechanical Implementation:** Supine figure on floor mat (`trunk: 0`) with straight legs (`kneeAngle = 178.0 deg >= 172 deg`) and feet braced against the low-pulley machine base (`x = 76.2`), holding a rigid straight bar (`implement: 'bar'`, `palm: 'up'`) attached to a low pulley (`cableOrigin: [82, 22]`). Arms start almost straight (`158.0 deg`), upper arms remain stationary beside the torso (`drift = 0.00`), and the bar curls toward the chest.

### 259 — Reverse Barbell Preacher Curls (`reverse-barbell-preacher-curls`)
- **Instructions:** *"Hold an EZ bar with a shoulder-width, palms-down grip and rest the upper arms on the preacher bench pad with the arms extended. Keeping the upper arms on the pad, curl the bar up to shoulder height. Squeeze, then lower slowly until the arms are extended."*
- **Cues:** *"Palms face down throughout. Upper arms stay on the pad. Lower slowly."*
- **Biomechanical Implementation:** Seated behind the angled preacher pad (`prop: 'preacher'`) holding a cambered EZ-bar (`implement: 'ez'`) with a pronated grip (`palm: 'down'`). Upper arms stay fixed on the preacher pad (`upperArm: [-42, 10]`, `drift = 0.00` across all ticks), starting extended (`170.0 deg`) and curling the EZ-bar up to shoulder height (`wrist.y = 66.85` vs `shoulder.y = 69.90`) with constant rigid grip spacing (`8.00` units).

## 2. Gate Results (`48f191ffd87f0de2a42ddce60ac83085ea324871`)

- **`typecheck.log`:** `exit code: 0`
- **`jest-movement-preview.log`:** `Test Suites: 64 passed, 64 total`, `Tests: 3688 passed, 3688 total`, `exit code: 0`
- **`storage-guard.log`:** `records: 238, families: 75, rawBytes: 682634, gzipBytes: 112333, pass: true`, `exit code: 0`
- **`evidence-gate.log`:** `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`, `exit code: 0`
- **`rendered-output-probe.log`:**
  - `movements measured: 232 (baseline 225)`
  - `added: 184 Drag Curl; 281 Standing Dumbbell Reverse Curl; 109 Zottman Curl; 190 Dumbbell Prone Incline Curl; 213 High Cable Curls; 240 Lying Cable Curl; 259 Reverse Barbell Preacher Curls`
  - `removed: none`
  - `changed, NOT expected: none`
  - `movements with overflow above 1e-6 dp: none`
  - `exit code: 0 (probe run exit 0)`
