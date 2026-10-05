# Dependency audit triage — 4 October 2026

`npm audit` on the integration branch reported **66** findings (1 critical,
58 high, 6 moderate, 1 low). `npm audit fix --force` was **not** used: every
remaining fix it offers is a semver-major change (jest 30, React Native 0.87,
an ancient `@xenova/transformers` 1.4.2, `react-native-health-connect` 1.0.2
downgrade), none of which is a security fix for this app.

## What actually ships

Reachability was measured, not assumed. Release Metro bundles were built for
both platforms with source maps
(`react-native bundle --dev false --minify true`), and every `node_modules`
package present in the shipped JavaScript was listed from the source map:

- Android: 31 packages; iOS: 32 packages.
- Only **two** audited packages appear in the shipped JS: `react-native` and
  `react-native-health-connect`. Neither has an advisory of its own:
  - `react-native` is flagged only through `@react-native/community-cli-plugin`
    (CLI/Metro dev server), `babel-jest` and `jest-environment-node` —
    build/test tooling that npm lists as dependencies but Metro does not bundle.
  - `react-native-health-connect` is flagged only through its Expo config
    plugin (`@expo/config-plugins` → `@expo/plist`/`xcode`/`uuid`), which runs
    at prebuild time, not in the app.
- Native code is not covered by npm advisories; the native libraries are the
  pinned pods/AARs of the packages above, op-sqlite, onnxruntime-react-native,
  HealthKit/Nitro and blob-util.

So **no audited vulnerability is present in the shipped app**. All 66 findings
are in build, test or developer tooling.

## Applied (semver-compatible, lockfile only)

`npm update` within the existing ranges, build/test tooling only:
`@xmldom/xmldom` 0.8.15 / 0.9.12, `brace-expansion` (1.1.21, 2.1.7, 5.0.12),
`shell-quote` 1.12.0, `qs` 6.16.0, `js-yaml` 3.15.2 / 4.3.2, `joi` 17.13.8,
`browserslist` 4.29.3 (+ `caniuse-lite`, `electron-to-chromium`,
`node-releases`, `update-browserslist-db`, `baseline-browser-mapping`),
`body-parser` 2.3.0 (`content-type` deduplicated).

Result: **57** findings (1 critical, 52 high, 4 moderate, 0 low). Typecheck,
the release iOS bundle and the affected jest suites pass on the new lockfile;
CI re-runs every gate on it.

## Deferred, with reasons

| Finding | Where | Why deferred | What closes it |
| --- | --- | --- | --- |
| `protobufjs` 6.11.6 (critical) | dev only: `@xenova/transformers` → `onnxruntime-web` 1.14 → `onnx-proto` | Not shipped. Not loaded on any path this repo runs: in Node `@xenova/transformers` uses `onnxruntime-node`, and `onnxruntime-web`'s Node entry (`dist/ort-web.node.js`) never requires `onnx-proto`. Overriding it to 7.6.x crosses a major version of a library `onnx-proto` was built against, with no code path to test it. | Remove `@xenova/transformers` from the dev toolchain (only `scripts/embed-codebase.mjs` and the parity gates use it), or move to `@huggingface/transformers` v3, then re-run the embedder parity gates. |
| `onnxruntime-node` 1.26 → 1.30, `adm-zip` | dev only (embedder parity/verification) | The ORT version determines the reference embedding numerics the parity gates compare against; the embedder gates cannot run in this sandbox (Hugging Face is blocked). | Bump in CI where `fetch:embedder` and `verify:embedder` run, and accept only if parity holds. |
| `react-native-health-connect` 3.5.3 → 3.6.0 (+ `@expo/config-plugins` 58) | **shipped native module** (Android) | A minor bump of a shipped native module needs an Android device check of the Health Connect permission and read flow. The advisory is in its prebuild config plugin, not in the app. | Bump with an Android device acceptance run. |
| `@react-native-community/cli` 20.1 → 20.2 | build tooling | Low value; the remaining CLI/Metro/jest advisories need React Native or jest majors anyway. | Next React Native upgrade. |
| `image-size` (via Metro) | build tooling (reads local image assets) | Fixed only in 2.0.3; Metro pins `^1.0.2`. | Metro/React Native upgrade. |
| jest 29 chain, `braces`/`micromatch`, Metro chain, RN CLI chain | test/build tooling | Fix requires jest 30 / React Native 0.87 (majors). | Planned toolchain upgrade, not a release blocker. |
