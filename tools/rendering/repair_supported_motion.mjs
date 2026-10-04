// Source-bound authoring repairs. All entries remain pending independent review.
import fs from 'node:fs';
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const get = id => {
  const entry = manifest.entries.find(e => e.movementId === id);
  if (!entry?.frames?.length || entry.derivesFrom !== undefined) throw Error(`Missing owned frames for${id}`);
  return entry;
};
for (const id of [53, 82, 138, 163]) {
  const entry = get(id);
  const first = structuredClone(entry.frames[0].joints);
  // Standing height with long, quiet legs; the previous start was a squat.
  first.hd = [45.6, 18.6]; first.nk = [45.3, 27.6]; first.hp = [44.4, 51.5];
  first.kn = [44.2, 73.75]; first.an = [44, 96];
  first.kf = [...first.kn]; first.af = [...first.an];
  first.ef = [...first.el];
  first.wf = [...first.wr];
  const elevations = [0, 2.2, 4.5, 4.5, 2.2, 0];
  entry.frames.forEach((frame, i) => {
    frame.joints = { ...structuredClone(first), se: elevations[i] };
  });
  entry.segmentDurationsMs = [420, 380, 1000, 650, 650];
  entry.reason = 'Draft repair: stationary head, trunk, pelvis and leg anchors; the separate shoulder girdle translates the extended arms and load. Peak hold is1000ms. Independent source/render review required.';
  entry.summary = 'Raise and lower the shoulders with long arms and a quiet body.';
  entry.status = 'pending';
  if (id === 163) {
    entry.instructions = 'Stand close to a low pulley holding its straight bar in front of the thighs with a shoulder-width overhand grip. Keep the arms extended and raise only the shoulders. Hold for one second, then lower to the start with the body still.';
    entry.cues = 'Palms face down on the cable bar. Arms stay extended. Only the shoulders lift the load.';
    entry.frames[0].caption = 'Hold the low-cable straight bar in front with palms facing down.';
    entry.frames[1].caption = 'Raise the shoulders with the arms extended.';
    entry.frames[2].caption = 'Lift only through the shoulders; keep the body still.';
    entry.frames[3].caption = 'Hold the shoulder contraction for a full second.';
    entry.frames[4].caption = 'Lower the shoulders with the arms still long.';
    entry.frames[5].caption = 'Return to the same quiet standing start.';
  }
}
for (const id of [92, 158, 253]) {
  const entry = get(id);
  const pose = { hd: [44, 23], nk: [44, 32], hp: [30, 60],
    el: [50.25, 42.825], wr: [54.35, 54.1], ef: [50.25, 42.825], wf: [54.35, 54.1],
    kn: [45, 78], an: [50, 96], kf: [45, 78], af: [50, 96] };
  entry.view = 'side';
  entry.viewBox = [10, 8, 72, 94];
  const captions = [
    id === 253 ? 'Support the upper arms on the pad; hold the dumbbells with palms facing each other.'
      : id === 158 ? 'Support the upper arms on the pad and hold the low-cable bar.'
      : 'Support the upper arms on the pad and hold the bar with palms facing up.',
    'Curl through the elbows while the upper arms stay on the pad.',
    'Bring the load toward the shoulders without lifting the elbows.',
    'Hold the top with the shoulders and upper arms quiet.',
    'Lower on a three-count to the same natural long-arm start.',
  ];
  const bearings = [50, 0, -90, -90, 50];
  entry.frames = bearings.map((ca, i) => ({ id: `p${i + 1}`, caption: captions[i], joints: { ...structuredClone(pose), ca } }));
  entry.segmentDurationsMs = [650, 650, 1000, 3000];
  entry.reason = 'Source-bound draft repair: side view exposes the supported elbow arc; fixed upper arms on a connected sloped pad,12-unit circular forearm path,1000ms peak and3000ms full return.253 neutral grip and setup are bound to the frozen repo import; independent exact-source technique and native runtime acceptance remain pending.';
  entry.summary = 'Curl with supported upper arms, then return slowly to the start.';
  entry.status = 'pending';
}

const raise = get(143);
const yaw = 45 * Math.PI / 180;
const raisePose = { hd: [60 + 9 * Math.cos(yaw), 55], nk: [60, 55], hp: [60 - 23.92 * Math.cos(yaw), 55],
  el: [50, 67.5], wr: [53, 79.09], ef: [70, 67.5], wf: [67, 79.09],
  kn: [43, 76], an: [40, 96], kf: [43, 76], af: [40, 96] };
raise.view = 'oblique';
raise.viewBox = [8, 12, 96, 90];
raise.frames = [0, 45, 90, 90, 0].map((ra, i) => ({ id: `p${i + 1}`, joints: { ...structuredClone(raisePose), ra }, caption: [
  'Keep the forehead on the bench and let the dumbbells hang under the shoulders.',
  'Raise the arms out to the sides with one small, fixed elbow bend.',
  'Bring the upper arms level with the floor while the torso stays still.',
  'Hold the lateral raise for one second with the forehead supported.',
  'Lower both arms along the same lateral arc to the hanging start.',
][i] }));
raise.segmentDurationsMs = [900, 900, 1000, 2400];
raise.reason = 'Independent draft repair: world-transverse shoulder abduction at fixed15deg elbow flexion; projected45deg oblique camera. World arm lengths12.5/12 are exposed by the production solver for independent inspection. Quiet horizontal trunk and per-body forehead/pad surface contact. No row or front-raise alias.';
raise.summary = 'Raise the arms out to the sides with the forehead supported.';
raise.status = 'pending';
fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);
