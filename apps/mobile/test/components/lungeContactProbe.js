/**
 * Drawn-primitive contact measurement for the Walking Lunge support/lead feet.
 * Pure logic: the rig functions are injected so the SAME measurement runs in
 * jest (TS source) and in the Node evidence tool (compiled build).
 */
const GROUND = 96.9;
const PHASES = [
  { name: 'near lead descent-bottom-drive', from: 'wl-10', bottom: 'wl-16', to: 'wl-19', lead: 'an', support: 'af' },
  { name: 'far lead descent-bottom-drive', from: 'wl-28', bottom: 'wl-34', to: 'wl-37', lead: 'af', support: 'an' },
];

export function measureLungeContacts(entry, bodyParams, rig) {
  const frames = entry.frames.map((frame) => frame.joints);
  const durations = rig.segmentDurations(frames.length, entry.segmentDurationsMs);
  const options = { view: entry.view, body: bodyParams, assetKey: entry.assetKey };
  const time = (index) => durations.slice(0, index).reduce((sum, ms) => sum + ms, 0);
  return PHASES.flatMap((phase) => {
    const indices = [phase.from, phase.bottom, phase.to]
      .map((id) => entry.frames.findIndex((frame) => frame.id === id));
    if (indices.some((index) => index < 0) || !(indices[0] < indices[1] && indices[1] < indices[2])) {
      throw new Error('Missing or unordered contact phase anchors');
    }
    return [phase.lead, phase.support].map((key) => {
      const tips = [], gaps = [];
      for (let ms = time(indices[0]); ms <= time(indices[2]); ms += 10) {
        const pose = rig.poseAtTime(frames, ms, durations);
        const ankle = rig.resolveFigureJoints(pose, options)[key];
        // A foot prim starts exactly at its ankle; shins end there. Color
        // disambiguates crossing feet without relying on prim indices.
        const color = key === 'an' ? 'textHi' : 'textLow';
        const feet = rig.layoutCanonicalFigure(pose, options).filter((p) => p.kind === 'bone'
          && p.x1 === ankle[0] && p.y1 === ankle[1] && p.color === color);
        if (feet.length !== 1) throw new Error(`Expected one drawn ${key} foot`);
        const foot = feet[0];
        tips.push([foot.x2, foot.y2]);
        // RN draws a rotated rounded bar of width w ending at (x2, y2); the
        // lower edge at the tip accounts for the half-width slope.
        const length = Math.hypot(foot.x2 - foot.x1, foot.y2 - foot.y1);
        const lowerEdge = Math.max(foot.y1, foot.y2)
          + foot.w / 2 * (1 - Math.abs(foot.y2 - foot.y1) / length);
        gaps.push(GROUND - lowerEdge);
      }
      return { phase: phase.name, foot: key, role: key === phase.lead ? 'lead' : 'support',
        samples: tips.length, fromMs: time(indices[0]), bottomMs: time(indices[1]), toMs: time(indices[2]),
        bottomTip: tips[Math.max(0, Math.round((time(indices[1]) - time(indices[0])) / 10))]?.[1] ?? null,
        tipDrift: +Math.max(...tips.map((tip) => Math.hypot(tip[0] - tips[0][0], tip[1] - tips[0][1]))).toFixed(3),
        minGap: +Math.min(...gaps).toFixed(3), maxGap: +Math.max(...gaps).toFixed(3), ground: GROUND };
    });
  });
}

export function assertLungeContacts(rows) {
  if (rows.length !== 4 || rows.some((row) => row.samples < 100)) throw new Error('Vacuous contact coverage');
  for (const row of rows) {
    if (row.tipDrift > 0.25) throw new Error(`${row.phase}/${row.foot}: drawn tip drift ${row.tipDrift}`);
    if (row.minGap < -0.25 || row.maxGap > 0.5) throw new Error(`${row.phase}/${row.foot}: floor gap ${row.minGap}..${row.maxGap}`);
  }
}
