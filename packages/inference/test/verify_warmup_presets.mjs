/**
 * verify_warmup_presets.mjs — personalised warm-up presets & engine gate.
 *
 * Pins:
 *   [1] ratified bounds and verbatim WP-01..WP-29 copy constants;
 *   [2] draft validation bounds (24 presets, 12 items, 1..5 sets, 1..100 reps,
 *       5..1800 s, trimmed lengths, source-kind invariants);
 *   [3] session-type resolution precedence (override > specific > default > auto);
 *   [4] personalised protocol builder: null passthrough, all 3 purposes, all 4
 *       source kinds, includeRampSets true/false, safety/hold/capability
 *       withholding, all-withheld raise fallback, 240-char cueNote & max-dose
 *       parsePreparationProtocol round-trip, and WP-29 non-blocking over-cap note.
 *
 * Run: npm run verify:preparation
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prep = require('./.build/preparationPolicy.js');
const wp = require('./.build/warmupPresets.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const baseInput = (overrides = {}) => ({
  tier: 'intermediate',
  accessContext: 'weight_room',
  slots: [
    {
      movementId: 1,
      movementName: 'Competition Squat',
      pattern: 'squat',
      isCompound: true,
      externallyLoaded: true,
      target: { kind: 'reps', reps: 5 },
    },
  ],
  excludedMovements: new Map(),
  restrictedJoints: [],
  readinessReduced: false,
  budgetMin: 10,
  ...overrides,
});

const item = (overrides = {}) => ({
  itemOrder: 0,
  sourceKind: 'catalog_drill',
  catalogDrillId: 'mobilise.leg_swings',
  prehabTargetId: null,
  movementId: null,
  title: 'Leg swings',
  sets: 1,
  doseKind: 'time',
  doseAmount: 30,
  perSide: true,
  cueNote: null,
  ...overrides,
});

const preset = (overrides = {}) => ({
  presetId: 1,
  name: 'Lower body prehab',
  purpose: 'prehab',
  weaknessTarget: 'knee_patellar',
  includeRampSets: true,
  createdAtMs: 1000,
  updatedAtMs: 1000,
  items: [item()],
  ...overrides,
});

// --- [1] ratified constants and verbatim copy --------------------------------
console.log('[1] ratified constants and verbatim copy');
{
  check('ratified numeric bounds match RATIFIED_WARMUP_PRESETS_MANIFEST',
    wp.MAX_WARMUP_PRESETS === 24
      && wp.MAX_WARMUP_PRESET_ITEMS === 12
      && wp.PRESET_NAME_MIN_LEN === 1
      && wp.PRESET_NAME_MAX_LEN === 60
      && wp.CUSTOM_DRILL_TITLE_MIN_LEN === 1
      && wp.CUSTOM_DRILL_TITLE_MAX_LEN === 120
      && wp.CUE_NOTE_MAX_LEN === 240
      && wp.PRESET_ITEM_SETS_MIN === 1
      && wp.PRESET_ITEM_SETS_MAX === 5
      && wp.DEFAULT_PRESET_ITEM_SETS === 1
      && wp.PRESET_DOSE_REPS_MIN === 1
      && wp.PRESET_DOSE_REPS_MAX === 100
      && wp.DEFAULT_PRESET_DOSE_REPS === 10
      && wp.PRESET_DOSE_SECONDS_MIN === 5
      && wp.PRESET_DOSE_SECONDS_MAX === 1800
      && wp.DEFAULT_PRESET_DOSE_SECONDS === 30
      && wp.DEFAULT_INCLUDE_RAMP_SETS === true);

  check('purposes, session types, and prehab labels are complete',
    wp.WARMUP_PURPOSES.join(',') === 'gpp,prehab,rehab'
      && wp.WARMUP_SESSION_TYPES.length === 11
      && wp.WARMUP_SESSION_TYPE_LABEL.default === 'Default (all sessions)'
      && wp.WARMUP_SESSION_TYPE_LABEL.bjj === 'Sport & grappling'
      && wp.WARMUP_SESSION_TYPE_LABEL.free_form === 'Unplanned session'
      && wp.PREHAB_TARGET_LABEL.elbow_tendon === 'Elbow tendon'
      && wp.PREHAB_TARGET_LABEL.low_back_core === 'Lower back & trunk');

  check('WP-01..WP-29 copy entries are present and exact',
    wp.WARMUP_COPY['WP-01'] === 'WARM-UP PRESETS'
      && wp.WARMUP_COPY['WP-11'](3) === 'WARM-UP ITEMS (3 of 12)'
      && wp.WARMUP_COPY['WP-17'].presetCap === 'Up to 24 warm-up presets can be saved. Delete one to add another.'
      && wp.WARMUP_COPY['WP-19'] === 'Automatic warm-up'
      && wp.WARMUP_COPY['WP-21'](null) === 'Warm-up: Automatic warm-up'
      && wp.WARMUP_COPY['WP-21']('GPP') === 'Warm-up: GPP'
      && wp.WARMUP_COPY['WP-26'] === 'Move smoothly and stay within a comfortable range.'
      && wp.WARMUP_COPY['WP-29'](52, 12, 45)
        === 'This session is estimated at about 52 minutes including your 12-minute warm-up preset, which is over your 45-minute session limit. Your saved warm-up items were kept as written.');

  check('PREPARATION_CATALOG_DRILLS exposes the 8 built-in drills cleanly',
    Array.isArray(prep.PREPARATION_CATALOG_DRILLS)
      && prep.PREPARATION_CATALOG_DRILLS.length === 8
      && prep.PREPARATION_CATALOG_DRILLS.some((d) => d.itemId === 'raise.easy_movement'));
}

// --- [2] draft validation bounds ---------------------------------------------
console.log('[2] draft validation bounds');
{
  const validDraft = {
    name: '  Shoulder Prehab  ',
    purpose: 'prehab',
    weaknessTarget: 'shoulder_cuff',
    includeRampSets: true,
    items: [item({ cueNote: '  Keep shoulders down  ' })],
  };
  const ok = wp.validateWarmupPresetDraft(validDraft, 0, false);
  check('valid draft normalises trimmed name and cueNote',
    ok.ok === true && ok.value.name === 'Shoulder Prehab' && ok.value.items[0].cueNote === 'Keep shoulders down');

  check('rejects missing name with exact WP-17 message',
    wp.validateWarmupPresetDraft({ ...validDraft, name: '   ' }, 0, false).error === wp.WARMUP_COPY['WP-17'].missingName);
  check('rejects name > 60 chars',
    wp.validateWarmupPresetDraft({ ...validDraft, name: 'a'.repeat(61) }, 0, false).ok === false);
  check('rejects empty items with exact WP-17 message',
    wp.validateWarmupPresetDraft({ ...validDraft, items: [] }, 0, false).error === wp.WARMUP_COPY['WP-17'].emptyItems);
  check('rejects > 12 items with exact WP-17 message',
    wp.validateWarmupPresetDraft({
      ...validDraft,
      items: Array.from({ length: 13 }, (_, idx) => item({ itemOrder: idx })),
    }, 0, false).error === wp.WARMUP_COPY['WP-17'].itemCap);
  check('rejects 25th new preset with exact WP-17 message, allows updating at 24',
    wp.validateWarmupPresetDraft(validDraft, 24, false).error === wp.WARMUP_COPY['WP-17'].presetCap
      && wp.validateWarmupPresetDraft(validDraft, 24, true).ok === true);
  check('rejects missing custom title with exact WP-17 message',
    wp.validateWarmupPresetDraft({
      ...validDraft,
      items: [item({ sourceKind: 'custom_physio', catalogDrillId: null, title: '  ' })],
    }, 0, false).error === wp.WARMUP_COPY['WP-17'].missingCustomTitle);
  check('rejects title > 120 chars and cueNote > 240 chars',
    wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ title: 'x'.repeat(121) })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ cueNote: 'x'.repeat(241) })] }, 0, false).ok === false);
  check('enforces sets 1..5, reps 1..100, seconds 5..1800',
    wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ sets: 0 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ sets: 6 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ sets: 5 })] }, 0, false).ok === true
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'reps', doseAmount: 0 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'reps', doseAmount: 101 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'reps', doseAmount: 100 })] }, 0, false).ok === true
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'time', doseAmount: 4 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'time', doseAmount: 1801 })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ doseKind: 'time', doseAmount: 1800 })] }, 0, false).ok === true);
  check('rejects malformed source-kind cross fields',
    wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ catalogDrillId: 'missing.drill' })] }, 0, false).ok === false
      && wp.validateWarmupPresetDraft({ ...validDraft, items: [item({ sourceKind: 'library_movement', catalogDrillId: null, movementId: null })] }, 0, false).ok === false);
}

// --- [3] session-type resolution precedence ----------------------------------
console.log('[3] session-type resolution precedence');
{
  const pDefault = preset({ presetId: 1, name: 'Default GPP' });
  const pLower = preset({ presetId: 2, name: 'Lower' });
  const pOverride = preset({ presetId: 3, name: 'Override' });
  const presets = [pDefault, pLower, pOverride];
  const assignments = { default: 1, lower: 2 };

  check('standard_auto override forces null (automatic warm-up)',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: assignments,
      sessionType: 'lower',
      sessionOverride: { mode: 'standard_auto', presetId: null },
    }) === null);
  check('preset override beats specific session type and default',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: assignments,
      sessionType: 'lower',
      sessionOverride: { mode: 'preset', presetId: 3 },
    })?.presetId === 3);
  check('deleted override preset falls back to specific session type',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: assignments,
      sessionType: 'lower',
      sessionOverride: { mode: 'preset', presetId: 999 },
    })?.presetId === 2);
  check('specific session type beats default',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: assignments,
      sessionType: 'lower',
      sessionOverride: null,
    })?.presetId === 2);
  check('unassigned session type falls back to default',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: assignments,
      sessionType: 'push',
      sessionOverride: null,
    })?.presetId === 1);
  check('unassigned without default resolves to null',
    wp.resolveActiveWarmupPreset({
      presets,
      sessionTypeAssignments: {},
      sessionType: 'push',
      sessionOverride: null,
    }) === null);
}

// --- [4] personalised protocol builder ---------------------------------------
console.log('[4] personalised protocol builder');
{
  const input = baseInput();
  check('null preset returns buildPreparationProtocol unchanged',
    JSON.stringify(wp.buildPersonalisedPreparationProtocol({ ...input, preset: null }))
      === JSON.stringify(prep.buildPreparationProtocol(input)));

  const longCue = 'c'.repeat(240);
  const fullPreset = preset({
    purpose: 'rehab',
    weaknessTarget: 'hip_groin',
    includeRampSets: true,
    items: [
      item({ itemOrder: 0, sourceKind: 'catalog_drill', catalogDrillId: 'mobilise.arm_circles', title: 'Arm circles', sets: 2, doseKind: 'time', doseAmount: 30, perSide: false, cueNote: longCue }),
      item({ itemOrder: 1, sourceKind: 'prehab_target', catalogDrillId: null, prehabTargetId: 'hip_groin', movementId: null, title: 'Hip adductor isometric', sets: 3, doseKind: 'time', doseAmount: 45, perSide: true, cueNote: 'Keep pain <= 3/10' }),
      item({ itemOrder: 2, sourceKind: 'library_movement', catalogDrillId: null, prehabTargetId: null, movementId: 28, title: 'Bodyweight Squat', sets: 2, doseKind: 'reps', doseAmount: 10, perSide: false, cueNote: null }),
      item({ itemOrder: 3, sourceKind: 'custom_physio', catalogDrillId: null, prehabTargetId: null, movementId: null, title: 'Banded wall slide', sets: 1, doseKind: 'reps', doseAmount: 12, perSide: false, cueNote: '3s lowering' }),
    ],
  });
  const movementCatalog = new Map([[28, { name: 'Bodyweight Squat', pattern: 'squat' }]]);
  const built = wp.buildPersonalisedPreparationProtocol({ ...input, preset: fullPreset, movementCatalog });
  check('personalised protocol carries athlete-warmup-preset policy identity and WP-23/WP-24 basis',
    built.policyId === 'athlete-warmup-preset'
      && built.policyRevision === 1
      && built.basis.includes('Warm-up preset: Lower body prehab (Rehab or physio).')
      && built.basis.includes('Target area: Hip & groin.')
      && built.basis.includes('First movement prepared: Competition Squat.'));
  check('all 4 source kinds plus rehearse + 40/80 ramp sets are emitted in order',
    built.items.length === 7
      && built.items[0].itemId === 'mobilise.arm_circles'
      && built.items[0].title === 'Arm circles (2 sets)'
      && built.items[1].sourceRefs.includes('prehab_catalog')
      && built.items[2].sourceRefs.includes('athlete_preset')
      && built.items[3].sourceRefs.includes('clinician_physio')
      && built.items[4].stage === 'rehearse'
      && built.items[5].stage === 'ramp'
      && built.items[6].stage === 'ramp');
  check('240-char cueNote round-trips through parsePreparationProtocol',
    JSON.stringify(prep.parsePreparationProtocol(JSON.stringify(built))) === JSON.stringify(built));

  const noRamp = wp.buildPersonalisedPreparationProtocol({
    ...input,
    preset: preset({ purpose: 'gpp', weaknessTarget: null, includeRampSets: false, items: [item({ sourceKind: 'catalog_drill', catalogDrillId: 'mobilise.arm_circles', title: 'Arm circles', perSide: false })] }),
  });
  check('includeRampSets=false emits no rehearse or ramp items',
    noRamp.items.length === 1 && !noRamp.items.some((it) => it.stage === 'rehearse' || it.stage === 'ramp'));

  // Withholding on restrictedJoints + held movement + excluded movement
  const gated = wp.buildPersonalisedPreparationProtocol({
    ...input,
    restrictedJoints: ['knee'],
    excludedMovements: new Map([[28, { reasonCode: 'support_hold', detail: 'Physio hold active' }]]),
    preset: preset({
      includeRampSets: false,
      items: [
        item({ itemOrder: 0, sourceKind: 'catalog_drill', catalogDrillId: 'mobilise.leg_swings', title: 'Leg swings' }),
        item({ itemOrder: 1, sourceKind: 'library_movement', catalogDrillId: null, movementId: 135, title: 'Held raise' }),
        item({ itemOrder: 2, sourceKind: 'library_movement', catalogDrillId: null, movementId: 28, title: 'Bodyweight Squat' }),
      ],
    }),
  });
  check('all-items-withheld preset falls back to safe raise.easy_movement and records all 3 omissions',
    gated.items.length === 1
      && gated.items[0].itemId === 'raise.easy_movement'
      && gated.omitted.length === 3
      && gated.omitted.some((o) => o.reasonCode === 'safety')
      && gated.omitted.some((o) => o.reasonCode === 'movement_hold')
      && gated.omitted.some((o) => o.reasonCode === 'support_hold')
      && JSON.stringify(prep.parsePreparationProtocol(JSON.stringify(gated))) === JSON.stringify(gated));

  // WP-29 non-blocking over-cap note without dropping items
  const overCap = wp.buildPersonalisedPreparationProtocol({
    ...input,
    mainWorkMin: 40,
    capMin: 45,
    readinessReduced: true,
    preset: preset({
      includeRampSets: false,
      items: [
        item({ itemOrder: 0, sourceKind: 'catalog_drill', catalogDrillId: 'raise.easy_movement', title: 'Easy movement', doseKind: 'time', doseAmount: 360, sets: 1, perSide: false }),
        item({ itemOrder: 1, sourceKind: 'custom_physio', catalogDrillId: null, title: 'Physio drill', doseKind: 'time', doseAmount: 240, sets: 1, perSide: false }),
      ],
    }),
  });
  check('over-cap preset adds WP-29 note without dropping any item',
    overCap.items.length === 2
      && overCap.omitted.filter((o) => o.reasonCode === 'time').length === 0
      && overCap.notes.some((n) => /kept as written\./.test(n))
      && overCap.notes.some((n) => /eased/.test(n)));

  // Max-bound 5 sets x 1800s round-trips safely
  const maxDose = wp.buildPersonalisedPreparationProtocol({
    ...input,
    preset: preset({
      includeRampSets: false,
      items: [item({ sourceKind: 'custom_physio', catalogDrillId: null, title: 'Long aerobic flush', sets: 5, doseKind: 'time', doseAmount: 1800, perSide: false })],
    }),
  });
  check('max-bound 5x1800s preset still round-trips through parsePreparationProtocol',
    JSON.stringify(prep.parsePreparationProtocol(JSON.stringify(maxDose))) === JSON.stringify(maxDose));

  check('formatPresetItemDose formats WP-25 for sets > 1 and bare dose for sets === 1',
    wp.formatPresetItemDose(item({ sets: 3, doseKind: 'reps', doseAmount: 12, perSide: true })) === '3 sets · 12 reps each side'
      && wp.formatPresetItemDose(item({ sets: 1, doseKind: 'time', doseAmount: 30, perSide: false })) === '30 seconds');
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
