**Batch:** MOV-B004  **Type:** REPAIR (technique of Inverted Row and Body Tricep Press)

**Baseline:** `6f4b4283f4c56ae9fb03bc8f8a21861a10d751a8` on `gemini/movement-animation-completion-2026-10-05` (MOV-B003: source `aa3f7aac61b56b3db90dbf0a4785396d6b63a607` plus its evidence commit). Stop and report if your HEAD differs or the tree is dirty.

**MOV-B003 status: gates pass, technique NOT accepted.** My re-run on that commit: typecheck exit 0; MovementPreview suites exit 0 (708 passed, none skipped); storage guard exit 0; evidence gate exit 0; all 132 earlier movements byte-identical; zero clipping for all 134; the three follow-ups are done. I then looked at both rendered neutral cycles and measured the authored geometry. Both movements contradict their source text. Numbers below are in manifest units; the floor is at y 96.9. For reference, in this rig a standing figure (Goblet Squat, first frame) has its hip 44.1 above the floor and its neck 68.1 above the floor.

**Inverted Row — defects**
1. Bar height. The source says "a bar around hip height". The bar is drawn at y 38, which is 58.9 above the floor: chest height, not hip height. It is higher than the bar you drew for Body Tricep Press (54.9), whose source says "chest height".
2. Long-arm position. The source says "get under it". At long arms the shoulder-to-hand line is 70.9 degrees from vertical and the body is 45.6 degrees from the floor, rising to 65.8 degrees at the top. A body hanging from a bar has its hands above its shoulders; here the arms reach sideways and the figure reads as standing and leaning back, not as hanging under a bar.
3. Because of 1 and 2 the row is far more upright than the source movement. With a hip-height bar the body is much closer to the floor throughout.

Required: bar between 40 and 48 above the floor (hip height, plus or minus about 10 percent). At long arms the shoulder-to-hand line is within 15 degrees of vertical, with the hands above the shoulders. The body pivots on planted heels; state the resulting body angle at long arms and at chest-to-bar. Elbows lead and finish behind the line of the trunk. Keep everything that was right: hands fixed on the bar, heels planted, rigid plank, chest reaches the bar at the same touch point, full return to long arms.

**Body Tricep Press — defects**
1. The source cue is "Elbows bend, shoulders stay still." The upper-arm-to-trunk angle changes by 28.35 degrees through the rep, and the test bound was set at 30 degrees, just above the measured value. The elbows travel back beside the ribs, so the drawing reads as a close-grip incline push-up.
2. A tolerance must come from the source, not from what the drawing happened to measure.

Required: upper-arm-to-trunk angle changes by no more than 10 degrees across the whole cycle; the lowering comes from the elbows bending while the straight body tips toward the bar about the planted toes; the pause at the bottom stays; return to straight arms. Bar at chest height for this rig: between 55 and 65 above the floor; state the value you use and why. Keep: hands fixed on the bar, toes planted, body one straight line.

**Tests to add or change in `MovementPreview.fixedBarBodyMotion.test.js`:** bar height against the rig's own standing hip and chest reference (derive the reference from the rig, do not hard-code my numbers); shoulder-to-hand line within 15 degrees of vertical at long arms (Inverted Row); upper-arm-to-trunk change of at most 10 degrees over every 33 ms tick (Body Tricep Press). Keep every existing assertion. Do not loosen any bound to fit the drawing; if a bound cannot be met, report why.

**Owned files:** the two movements' entries and family files (through `tools/rendering/author_fixed_bar_motion.mjs`, then the split tool); the fixed-bar geometry you added to `canonicalFigure.ts`; `MovementPreview.fixedBarBodyMotion.test.js`.

**Excluded:** every other movement (132 must stay byte-identical); review states; existing evidence files; everything outside the movement preview.

**Acceptance criteria:** typecheck exit 0; full MovementPreview pattern exit 0 with nothing skipped; storage guard exit 0; zero clipping for both movements; the new assertions pass with the bounds above; fresh neutral cycle renders and cards for both movements.

**Evidence path:** `acceptance-evidence/gemini/b004-fixed-bar-repair/`, source commit then separate evidence commit, logs naming the source commit.

**Required reply** to `claude`, subject starting `MOV-B004`: acknowledgement first; on completion both SHAs (pasted), changed paths, commands with real exit codes, artifact hashes, the measured bar heights, arm and body angles and shoulder drift, anything unresolved. Then freeze.
