import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const manifestPath = join(__dirname, '../../android/app/src/main/AndroidManifest.xml');
const nativeDirectory = join(__dirname, '../../android/app/src/main/java/com/athletekinetics/speech');

test('speech stays offline and Android can discover the local TTS service', () => {
  const manifest = readFileSync(manifestPath, 'utf8');
  const internetDeclarations = manifest.match(/<uses-permission\b[^>]*android\.permission\.INTERNET[^>]*>/g) ?? [];

  expect(internetDeclarations.length).toBeGreaterThan(0);
  for (const declaration of internetDeclarations) {
    expect(declaration).toContain('tools:node="remove"');
  }
  expect(manifest).toContain('<action android:name="android.intent.action.TTS_SERVICE" />');

  const kotlin = readdirSync(nativeDirectory)
    .filter((name) => name.endsWith('.kt'))
    .map((name) => readFileSync(join(nativeDirectory, name), 'utf8'))
    .join('\n');
  expect(kotlin).toContain('package com.athletekinetics.speech');
  expect(kotlin).not.toContain('com.facebook.fbreact.specs.NativeSpeechCueSpec');
  expect(kotlin).not.toMatch(/KEY_FEATURE_NETWORK_SYNTHESIS|KEY_FEATURE_NETWORK_RETRIES_COUNT/);
  expect(kotlin).toContain('isNetworkConnectionRequired');
});
