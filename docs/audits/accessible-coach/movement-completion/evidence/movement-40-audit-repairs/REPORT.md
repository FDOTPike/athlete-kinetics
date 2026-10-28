# MOV-R1 — Audit Repairs for MOV-A01 to MOV-A04

- Branch: `movement/40-audit-repairs-2026-10-17`
- Base commit: `b2cf2d0f2c786894a4f8e218a9ab1d84355913e3`
- Source commit: `abfa57d31016af68b8993b7ba1b5391c27940f27`
- Baseline probe: `probe-cfbf952a10b8e0221bed2bdade59bdc946c41a10.json`

## Summary of Repairs (`MOV-R1.md`)

### 1. Seven Deadlifts (`2`, `46`, `176`, `257`, `78`, `258`, `290`) — Full Lockout at `ph = 1`
- Raised `poses[1].at[1]` (`root: 'neck'`) so the 2-bone leg IK solver reaches full knee extension (`176.29°` conventional / `176.26°` sumo on `hipJoint -> knee -> ankle`, `162.26°` / `165.02°` on midline `hip -> knee -> ankle`, up from `151.16°` / `142.34°` on `hipJoint -> knee -> ankle` and `144.49°` / `138.94°` on `hip -> knee -> ankle`).
- Conventional (`2`, `176`, `257`): `poses[1].at = [-1.8, 70.62]` (was `[-1.8, 69.2]`); Deficit (`46`): `poses[1].at = [-2.5, 70.62 + 3.3]` (was `[-2.5, 69.2 + 3.3]`); Sumo (`78`, `258`, `290`): `poses[1].at = [-1.8, 66.74]` (was `[-1.8, 64.5]`).

### 2. Four Stance/Bench Squats (`123`, `299`, `140`, `192`) — Toe Turn-Out
- Added `foot` yaw on both poses of `narrow-stance-squats` (`123`: `foot: [0, 15.5]`, `15.50°` vs `0.00°`), `wide-stance-barbell-squat` (`299`: `foot: [0, 28]`, `28.00°` vs `0.00°`), `barbell-squat-to-a-bench` (`140`: `foot: [0, 22]`, `22.00°` vs `0.00°`), and `dumbbell-squat-to-a-bench` (`192`: `foot: [0, 22]`, `22.00°` vs `0.00°`).

### 3. `81` Zercher Squat — Hands Clasped in Front
- Changed forearm azimuth from `[108, -28]` / `[112, -28]` to `[98, -44]` / `[102, -44]` so the painted hands clasp in front of the chest (`worldWristDist = 3.8401 <= 4.2240`, painted gap `-2.4212` dp vs `+2.8452` dp before).

### 4. `235` Kneeling Squat — Bottom Caption
- Replaced `captions[2]` with `'Sit the hips back toward the heels only as far as the trunk stays braced, and shorten the range if the ribs flare.'`.

### 5. `23` Nordic Curl & `202` Floor Glute-Ham Raise — Floor Catch & Push-Off Extension
- Lowered bottom (`ph = 1`) arms to painted floor contact (`screenHandGapToFloor = 0.0021` dp on both `23` and `202`, down from `3.2683` dp and `3.5683` dp) with `96.07°` (`23`) and `89.24°` (`202`) elbow angles.
- Extended the elbows across the initial push-off (`ph = 1` to `ph = 2`) from `96.07°` to `128.50°` (`+32.43°`) on `23` and from `89.24°` to `125.50°` (`+36.26°`) on `202` (up from `0.00°` extension in both), keeping all primitives above `y = 96.9` on every 33 ms tick.

### 6. `244` Natural Glute Ham Raise — Natural Elbow Angle on Band Hold
- Changed `forearm: 120` to `forearm: 65` (`upperArm: -60`), giving a `55.00°` elbow angle on near and far arms throughout the rep (up from `0.00°`).

### 7. `61` Good Morning — Centre of Mass Over the Foot
- Shifted bottom (`poses[1]`) `thigh` from `-54` to `-58` and `shin` from `-84` to `-91` so the body-only (`[0.12, 0.22, 0.45, 0.08, 0.13]`) and barbell-loaded (`[0.08, 0.14, 0.28, 0.05, 0.08, 0.37]`) horizontal centre of mass stays inside the `[ankle[0], toe[0]] = [4.000, 9.400]` support interval on every tick (`bodyOnlyComX = 4.920` at `ph = 1`, up from `3.393`; `loadedComX = 8.939` at `ph = 1`).

### 8. `94` Single-Leg Romanian Deadlift & `35` Barbell Hip Thrust — Captions
- `94` `captions[3]`: `'Drive the hips through to stand tall.'`.
- `35` `captions[0..2]`: `'Sit with your upper back against a bench, feet planted, and a padded bar over your hips.'`, `'Drive through your heels until your thighs and torso are level with the floor, finishing flat like a tabletop.'`, `'Tuck the pelvis and pause a full beat at the top in one straight line from knee to shoulder with vertical shins.'`.
