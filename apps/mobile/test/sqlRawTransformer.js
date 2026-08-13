'use strict';

/**
 * sqlRawTransformer.js — jest raw loader for `.sql` modules.
 *
 * The app bundles schema files as raw strings via babel-plugin-inline-import
 * (apps/mobile/babel.config.js). The jest transform deliberately runs with
 * `babelrc: false, configFile: false`, so that plugin is absent under test and
 * a `.sql` import would otherwise be a parse error. This transformer
 * reproduces exactly the same contract — a `.sql` module's default export is
 * its file contents — which is what lets a component test boot the REAL
 * zustand store against the REAL production migration chain instead of a
 * hand-written schema subset.
 *
 * It is a test-only loader: it introduces no production behaviour and cannot
 * alter a migration, only hand its bytes to the production migration runner.
 */
const crypto = require('crypto');

module.exports = {
  process(sourceText) {
    return { code: `module.exports = ${JSON.stringify(sourceText)};\n` };
  },
  getCacheKey(sourceText) {
    return crypto.createHash('sha1')
      .update('sql-raw-transformer-v1')
      .update(sourceText)
      .digest('hex');
  },
};
