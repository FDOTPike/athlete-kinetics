# Final-audit major RPE ceiling correction

Date: 2026-08-14
Audit baseline: `4a956793474c8de962dc2b407f11a1b8a5b2f05e`
Checkpoint: the single local commit containing this file (reported in the
owner handoff)
Status: corrected and fully verified

## Audit finding and correction

The final independent audit reported one P1 defect and no P0/P2 defects. The
defect was reproducible: projecting authored major peaks of `5.25`, `7.25`, or
`8.75` onto the existing half-step weekly curve rounded the persisted maximum
up to `5.5`, `7.5`, or `9` respectively. Freeze consumes that projection after
the microcycle's non-increasing invariant, so the later rounding could exceed
the authored RPE.

`projectRoutineMajorRpe` now retains the existing rounded weekly projection
while explicitly capping its maximum at the exact authored peak. No projected
week can exceed that peak. Exact half-step behavior, RPE caps, deload behavior,
and the prior projected-start behavior remain unchanged.

Regression coverage now proves all of the following:

- quarter-step authored peaks remain ceilings across LINEAR, WAVE, STEP, and
  APRE projections;
- every projected week and `routineMajorRpeForWeek` result is non-increasing
  relative to the authored peak; and
- a real week-three freeze persists `8.75`, rather than `9`, for an authored
  `8.75` Competition Bench Press prescription.

No schema, migration, seed, model, tokenizer, vector, or Android-native source
file changed.

## Verification evidence

- `npm run typecheck`: PASS.
- `npm run verify:pipeline`: PASS, 51 checks.
- `npm run verify:store`: PASS, SQL 540/540 and routine templates 16/16.
- Targeted `SessionAccessBoundary.test.js`: PASS, 12/12 tests.
- `npm run verify:all`: PASS, all 20 repository gates plus typecheck;
  components 11 suites / 179 tests / 0 snapshots.
- Production Android Metro bundle: PASS, 2,921,305 bytes,
  SHA-256 `69df4fbb0c0d717db817c9053067447d75e6e10b17bdb12d9317929ff9228824`.
- Android `verifyOnnxRuntimePackagingContract`, `assembleDebug`, and
  `bundleDebug`: BUILD SUCCESSFUL; generated APK and AAB both passed the
  packaging verifier.
- Debug APK: 244,935,258 bytes, SHA-256
  `681fa62a989d1c5ba93b704280fc36a85c37294641c5ab96c2bab68149e1149a`.
- Debug AAB: 99,247,354 bytes, SHA-256
  `3d75bbc0fc02a87bb208bb20e1ad07a09f65d0f789356015d514f7426861999f`.
- Packaged ONNX source asset: 22,972,370 bytes, SHA-256
  `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`.
- Pixel 9 Pro device check: streamed install PASS; cold launch PASS in 510 ms;
  process remained alive; Hermes reported `Running "AthleteKinetics"`; no
  fatal exception, AndroidRuntime crash, or script-load error appeared.
- `git diff --check`: run immediately before checkpointing and reported in the
  owner handoff.

## Known limitations retained from the read-only audit

The auditor classified the following as residual risks rather than defects,
so this bounded correction intentionally does not alter them: the Transformers
`localModelPath` fallback contract, migration-054 cutoff fail-closed tradeoff,
movement-name matching in seeded migration logic, the implicit per-day
duration bound, worst-case analyzer cost, uncalibrated family coefficients,
and debug-only native device evidence. None contradicts this correction's
authored-RPE ceiling claim.

No push, upload, publication, release authorization, or release signing was
performed.
