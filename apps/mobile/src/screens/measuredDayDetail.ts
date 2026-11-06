/** Walk W4-12: a day with no sets read "0 kg load · 0 sets". Only a day with
 *  logged sets shows load and sets; the measures follow either way. */
export const measuredDayDetail = (row: {
  tonnageKg: number; setCount: number; bodyweightKg: number | null; restingHr?: number | null;
}): string => [
  row.setCount > 0 ? `${Math.round(row.tonnageKg)} kg load · ${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}` : 'No training logged',
  ...(row.bodyweightKg === null ? [] : [`${row.bodyweightKg.toFixed(1)} kg BW`]),
  ...(row.restingHr === null || row.restingHr === undefined ? [] : [`${Math.round(row.restingHr)} bpm resting HR`]),
].join(' · ');
