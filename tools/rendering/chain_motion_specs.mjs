// What each chain movement shows and says: the phase at each keyframe (0 is
// the movement's first pose in CHAIN_MOVEMENTS, 1 its second, and so on), how
// long each gap takes, and the caption under each keyframe. Captions and
// timings come from the movement's own catalogue text.
export const CHAIN_SPECS = [
  {
    id: 219,
    slug: 'incline-dumbbell-curl',
    equipment: 'dumbbells',
    phases: [0, 0.5, 1, 1, 0],
    // "Pause, then lower slowly until the arms are straight."
    segments: [600, 600, 600, 1900],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down and palms facing forward.',
      'Keeping the upper arms still, curl the dumbbells up.',
      'Curl to shoulder height.',
      'Pause at the top.',
      'Lower slowly until the arms are straight.',
    ],
    reason: 'Source-bound side-view draft. Sitting back on an incline bench with the back and head on the pad; the upper arms hang straight down and do not move while the forearms curl the dumbbells to shoulder height, pause, and lower more slowly to straight arms. The palms-forward grip is shown by the bells reading end-on. Not drawn: the bench angle is not given by the source, so 60 degrees is a drawing choice.',
    summary: 'Sitting back on an incline bench, curl the dumbbells to shoulder height with the upper arms hanging still, pause, then lower slowly to straight arms.',
  },
  {
    id: 221,
    slug: 'incline-hammer-curls',
    equipment: 'dumbbells',
    phases: [0, 0.5, 1, 1, 0],
    // "Pause at the top, then lower slowly until the arms are straight."
    segments: [650, 650, 700, 2000],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down and palms facing each other.',
      'Keeping the upper arms still and the palms facing in, bend the elbows.',
      'Curl the dumbbells up.',
      'Pause at the top.',
      'Lower slowly until the arms are straight.',
    ],
    reason: 'Source-bound side-view draft. Sitting back on an incline bench; the upper arms hang straight down and stay still while the elbows bend, with the palms facing each other for the whole rep, so each dumbbell is seen along its length and stays square to the forearm. A pause at the top, then a slower lowering to straight arms. Not drawn: the bench angle is not given by the source, so 60 degrees is a drawing choice.',
    summary: 'Sitting back on an incline bench with palms facing in, curl the dumbbells up with the upper arms hanging still, pause, then lower slowly to straight arms.',
  },
  {
    id: 207,
    slug: 'front-incline-dumbbell-raise',
    equipment: 'dumbbells',
    phases: [0, 0.5, 1, 1, 0],
    // "Squeeze for a second, then lower back to the start."
    segments: [600, 600, 1000, 1600],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms straight in front, palms down, dumbbells just above the thighs.',
      'Keeping the elbows locked, raise the dumbbells straight up.',
      'Raise until the dumbbells are slightly above shoulder height.',
      'Squeeze for a second. Keep the head resting on the bench.',
      'Lower back to the start.',
    ],
    reason: 'Source-bound side-view draft. Reclined on a bench set at 45 degrees, inside the 30 to 60 degrees the source allows, with the head resting on the pad; the arms stay locked straight and lift the dumbbells from just above the thighs to slightly above shoulder height, hold for one second, and lower. The palms-down grip is shown by the bells reading end-on.',
    summary: 'Reclined on an incline bench, raise the dumbbells with locked arms from just above the thighs to slightly above shoulder height, squeeze for a second, then lower.',
  },
  {
    id: 155,
    slug: 'cable-incline-triceps-extension',
    equipment: 'cable_machine',
    phases: [0, 0.5, 1, 1, 0],
    // "Pause, then let the bar return slowly until the elbows are bent again."
    segments: [600, 600, 600, 1900],
    captions: [
      'Lie back on an incline bench facing away from a high pulley and take the bar overhead with a narrow overhand grip, elbows tucked in and bent.',
      'Keeping the upper arms still, straighten the elbows.',
      'Straighten until the arms are fully extended.',
      'Pause and squeeze the triceps.',
      'Let the bar return slowly until the elbows are bent again.',
    ],
    reason: 'Source-bound side-view draft. Lying back on an incline bench facing away from a high pulley; the upper arms stay fixed beside the head while the elbows straighten from a right angle to fully extended, pause, and bend again more slowly. The pulley is placed where the forearms point at the start, so the cable only lengthens as the arms extend. Not drawn: the narrow overhand grip, which a side view cannot show; the bar reads end-on at the hands.',
    summary: 'Lying back on an incline bench facing away from a high pulley, straighten the elbows with the upper arms fixed beside the head, pause, then let the bar return slowly.',
  },
];
