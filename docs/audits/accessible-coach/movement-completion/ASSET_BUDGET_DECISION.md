# Asset capacity for the authorized300-movement scope

Decision: raise the aggregate offline preview-data guard from409600 raw/81920 gzip bytes to1048576 raw/196608 gzip bytes. Preserve65536 bytes per family, literal lazy family loaders, the262144-byte single-family Node clone regression guard and2097152-byte all-family clone guard. This is an asset capacity decision, not a native memory acceptance result.

At exact522f9f1c,136 records/133 drawable drafts already occupy399530 raw/60419 gzip bytes across45 families.162 originally missing nonexcluded movements remain. Linear projection of the measured aggregate to300 records is approximately881316 raw/133277 gzip bytes. The old prototype aggregate leaves10070 raw bytes, enough for only a few further source-specific actions. It cannot represent the requested full library without dropping source identity, physical distinctions or instructions. The new finite guards provide capacity for that scope without embedding image/video assets or adding a runtime dependency.

The app continues to read the small index and requested family through the existing static loader table. The offline merged authoring manifest does not become the app's startup data source. Current largest family is40322 bytes; a future family exceeding65536 must be split using its actual action/setup contract, preserving derivation ownership and route identity. Do not raise its limit merely to pass.

Validation remains required: exact split/deep-equality/route identity, measured raw/gzip and largest-family totals, existing single/all-family heap regressions, production component lifecycle and independent source-bound artifact reproduction. Final native Android/iOS playback and frame timing remain separate acceptance gates. Francis's4GBphone acceptance is deferred and has not passed. Do not use these byte guards as a phone-RAM claim or enable unapproved previews.

This bounded implementation decision follows the authorized complete-library scope and the work order's requirement to record any aggregate expansion. It does not change technique approvals, movement exclusions, shipped SQL, app state or stores.
