#!/usr/bin/env node
/**
 * Build version check (electron-builder build metadata gotcha)
 *
 * Purpose: notify anyone (human or agent) running a local release build when
 * package.json version contains semver build metadata ("+Palmar"), because
 * electron-builder silently TRUNCATES the metadata in generated artifacts.
 *
 * Observed behavior (2026-08-29, electron-builder 26.15.3):
 *   - version "0.1.20+Palmar"  -> installer named "Tienda - App Setup 0.1.20.exe"
 *     and latest.yml reports version: 0.1.20. The "+Palmar" suffix is LOST.
 *   - The bundled app (src/app/version.ts) KEEPS the full "0.1.20+Palmar".
 *   - Prerelease suffixes ("-beta") are preserved; build metadata ("+") is not.
 *
 * Required manual step after building a "+" version:
 *   1. Rename the installer:  Tienda - App Setup 0.1.21.exe
 *                             -> Tienda - App Setup 0.1.21+Palmar.exe
 *   2. Rename the blockmap with the same name.
 *   3. Patch release/latest.yml: version + url/path to the "+" name (the
 *      sha512/size stay valid, only the name changes).
 *
 * This script ALWAYS exits 0: it is a notice, not a gate.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version ?? '0.0.0';

console.log(`[build-version-check] Building version: ${version}`);

const hasBuildMetadata = /\+/.test(version);
if (hasBuildMetadata) {
  console.warn(
    [
      '',
      '= WARNING ===============================================================',
      `package.json version "${version}" contains semver build metadata ("+").`,
      'electron-builder TRUNCATES the metadata in generated artifacts:',
      'the installer will be named WITHOUT the "+..." suffix and latest.yml',
      'will report the bare version, while the app UI keeps the full version.',
      '',
      'Manual step after the build:',
      '  1. Rename release/Tienda - App Setup <version-without-suffix>.exe',
      '     -> release/... Setup <full-version>.exe',
      '  2. Rename its .blockmap to match.',
      '  3. Patch release/latest.yml (version + url/path) to the "+" name.',
      '(sha512/size stay valid; only the file names change.)',
      '=======================================================================',
      '',
    ].join('\n'),
  );
} else {
  console.log('[build-version-check] Clean version — no rename needed.');
}