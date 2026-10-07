// What each chain movement shows and says: the phase at each keyframe (0 is
// the movement's first pose in CHAIN_MOVEMENTS, 1 its second, and so on), how
// long each gap takes, and the caption under each keyframe. Captions and
// timings come from the movement's own catalogue text. Every gap is eased in
// and out, so a continuous movement is ONE gap: a keyframe half-way up would
// make the limb hesitate there.
export const CHAIN_SPECS = [
  {
    id: 219,
    slug: 'incline-dumbbell-curl',
    equipment: 'dumbbells',
    phases: [0, 1, 1, 0, 0],
    // "Pause, then lower slowly until the arms are straight."
    segments: [1200, 600, 1900, 500],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down and palms facing forward.',
      'Keeping the upper arms still, curl the dumbbells up to shoulder height.',
      'Pause at the top.',
      'Lower slowly until the arms are straight.',
      'Back stays on the bench. Lower to a full stretch.',
    ],
    reason: 'Source-bound side-view draft. Sitting back on an incline bench with the back and head on the pad; the upper arms hang straight down and do not move while the forearms curl the dumbbells to shoulder height, pause, and lower more slowly to straight arms. The palms-forward grip is shown by the bells reading end-on. Not drawn: the bench angle is not given by the source, so 60 degrees is a drawing choice.',
    summary: 'Sitting back on an incline bench, curl the dumbbells to shoulder height with the upper arms hanging still, pause, then lower slowly to straight arms.',
  },
  {
    id: 221,
    slug: 'incline-hammer-curls',
    equipment: 'dumbbells',
    phases: [0, 1, 1, 0, 0],
    // "Pause at the top, then lower slowly until the arms are straight."
    segments: [1300, 700, 2000, 500],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down and palms facing each other.',
      'Keeping the upper arms still and the palms facing in, bend the elbows to curl the dumbbells up.',
      'Pause at the top.',
      'Lower slowly until the arms are straight.',
      'Palms face each other throughout. Upper arms hang still.',
    ],
    reason: 'Source-bound side-view draft. Sitting back on an incline bench; the upper arms hang straight down and stay still while the elbows bend, with the palms facing each other for the whole rep, so each dumbbell is seen along its length and stays square to the forearm. A pause at the top, then a slower lowering to straight arms. Not drawn: the bench angle is not given by the source, so 60 degrees is a drawing choice.',
    summary: 'Sitting back on an incline bench with palms facing in, curl the dumbbells up with the upper arms hanging still, pause, then lower slowly to straight arms.',
  },
  {
    id: 207,
    slug: 'front-incline-dumbbell-raise',
    equipment: 'dumbbells',
    phases: [0, 1, 1, 0, 0],
    // "Squeeze for a second, then lower back to the start."
    segments: [1200, 1000, 1600, 500],
    captions: [
      'Sit back on an incline bench with a dumbbell in each hand, arms straight in front, palms down, dumbbells just above the thighs.',
      'Keeping the elbows locked, raise the dumbbells straight up until they are slightly above shoulder height.',
      'Squeeze for a second. Keep the head resting on the bench.',
      'Lower back to the start.',
      'Keep the elbows locked straight.',
    ],
    reason: 'Source-bound side-view draft. Reclined on a bench set at 45 degrees, inside the 30 to 60 degrees the source allows, with the head resting on the pad; the arms stay locked straight and lift the dumbbells from just above the thighs to slightly above shoulder height, hold for one second, and lower. The palms-down grip is shown by the bells reading end-on.',
    summary: 'Reclined on an incline bench, raise the dumbbells with locked arms from just above the thighs to slightly above shoulder height, squeeze for a second, then lower.',
  },
  {
    id: 155,
    slug: 'cable-incline-triceps-extension',
    equipment: 'cable_machine',
    phases: [0, 1, 1, 0, 0],
    // "Pause, then let the bar return slowly until the elbows are bent again."
    segments: [1200, 600, 1900, 500],
    captions: [
      'Lie back on an incline bench facing away from a high pulley and take the bar overhead with a narrow overhand grip, elbows tucked in and bent.',
      'Keeping the upper arms still, straighten the elbows until the arms are fully extended.',
      'Pause and squeeze the triceps.',
      'Let the bar return slowly until the elbows are bent again.',
      'Upper arms stay still. Squeeze the triceps at full extension.',
    ],
    reason: 'Source-bound side-view draft. Lying back on an incline bench facing away from a high pulley; the upper arms stay fixed beside the head while the elbows straighten from a right angle to fully extended, pause, and bend again more slowly. The pulley is placed where the forearms point at the start, so the cable only lengthens as the arms extend. Not drawn: the narrow overhand grip, which a side view cannot show; the bar reads end-on at the hands.',
    summary: 'Lying back on an incline bench facing away from a high pulley, straighten the elbows with the upper arms fixed beside the head, pause, then let the bar return slowly.',
  },
  {
    id: 179,
    slug: 'decline-dumbbell-triceps-extension',
    equipment: 'dumbbells',
    phases: [0, 1, 1, 0, 0],
    // "Lower slowly beside the ears."
    segments: [1700, 250, 1100, 500],
    captions: [
      'Secure the legs on a decline bench, lie back and hold a dumbbell in each hand above the chest, palms facing each other and arms straight.',
      'Keeping the upper arms still and the elbows in, bend the elbows to lower the dumbbells beside the ears.',
      'Upper arms stay still. Elbows point at the ceiling.',
      'Straighten the elbows to return the dumbbells above the chest.',
      'Arms straight above the chest again.',
    ],
    reason: 'Source-bound side-view draft. Lying back on a decline bench, head at the low end, knees over the high end and ankles hooked under a roller; the upper arms point up from the lying chest, 15 degrees back from plumb, and do not move while the elbows bend to bring the dumbbells down beside the ears, slowly, and straighten again. The palms-in grip is shown by each bell being seen along its length, square to the forearm. Not drawn: the decline angle is not given by the source, so 20 degrees is a drawing choice.',
    summary: 'Lying back on a decline bench with the legs secured, lower the dumbbells beside the ears by bending only the elbows, then straighten the arms above the chest.',
  },
  {
    id: 180,
    slug: 'decline-ez-bar-triceps-extension',
    equipment: 'barbell',
    phases: [0, 1, 1, 0, 0],
    // "Lower slowly toward the forehead."
    segments: [1600, 250, 1000, 500],
    captions: [
      'Secure the legs on a decline bench, lie back and hold the EZ bar above the chest with a grip slightly narrower than shoulder width, arms straight.',
      'Keeping the upper arms still, bend the elbows to lower the bar toward the forehead.',
      'Upper arms stay still, elbows in, bar just above the forehead.',
      'Straighten the elbows to return the bar above the chest.',
      'Arms straight above the chest again.',
    ],
    reason: 'Source-bound side-view draft. Lying back on a decline bench with the legs secured under a roller; the upper arms point up from the lying chest, 15 degrees back from plumb, and stay still while the elbows bend to lower the EZ bar toward the forehead, slowly, stopping just above it, and straighten again. The bar is one implement through both hands and reads end-on with its cambered shaft. Not drawn: the grip width, which a side view cannot show; the decline angle is not given by the source, so 20 degrees is a drawing choice.',
    summary: 'Lying back on a decline bench with the legs secured, lower the EZ bar toward the forehead by bending only the elbows, then straighten the arms above the chest.',
  },
  {
    id: 156,
    slug: 'cable-lying-triceps-extension',
    equipment: 'cable_machine',
    phases: [0, 1, 1, 0, 0],
    // "Lower slowly to the forehead line." ... "return the bar above the chest and pause."
    segments: [1600, 250, 1000, 700],
    captions: [
      'Lie on a flat bench with your head toward a low pulley and hold the bar with a narrow overhand grip, arms straight above the chest.',
      'Keeping the upper arms still and the elbows in, bend the elbows to lower the bar until it is just above the forehead.',
      'Elbows in, upper arms pointing at the ceiling.',
      'Straighten the elbows to return the bar above the chest.',
      'Pause with the arms straight above the chest.',
    ],
    reason: 'Source-bound side-view draft. Lying on a flat bench with the head toward a low pulley, feet on the floor; the upper arms point at the ceiling and stay there while the elbows bend to lower the bar to just above the forehead, then straighten, with a pause at the top. The cable runs from the pulley past the end of the bench to the bar without crossing the bench or the head, and only lengthens as the arms straighten. Not drawn: the narrow overhand grip, which a side view cannot show.',
    summary: 'Lying on a flat bench with the head toward a low pulley, lower the bar to just above the forehead by bending only the elbows, then straighten the arms and pause.',
  },
  {
    id: 237,
    slug: 'low-cable-triceps-extension',
    equipment: 'cable_machine',
    phases: [0, 1, 1, 0, 0],
    // "Squeeze, then let the elbows bend slowly back to a right angle."
    segments: [1100, 600, 1900, 500],
    captions: [
      'Lie face up on the bench of a seated row station, head toward the pulley, holding the rope ends with palms facing each other, upper arms pointing at the ceiling and elbows bent to a right angle.',
      'Keeping the upper arms still, straighten the elbows until the forearms are vertical.',
      'Squeeze with the forearms vertical.',
      'Let the elbows bend slowly back to a right angle.',
      'Upper arms point at the ceiling. Only the forearms move.',
    ],
    reason: 'Source-bound side-view draft. Face up on the low bench of a seated row station with the head toward the low pulley and a rope in the hands; the upper arms point at the ceiling and stay there while the forearms go from level, elbows at a right angle, to vertical, hold, and return slowly to a right angle and no further. The cable only lengthens as the arms straighten. Not drawn: the palms-in grip on the rope ends, which a side view cannot show.',
    summary: 'Face up on a row-station bench with the head toward the low pulley, straighten the elbows until the forearms are vertical, squeeze, then let them bend slowly back to a right angle.',
  },
];
