/**
 * bump-version.mjs
 *
 * Helper to bump the app version without typing it manually:
 *   - increments the last numeric component of package.json#version,
 *     preserving any prerelease suffix (e.g. 0.1.12-beta → 0.1.13-beta);
 *   - `--release` promotes to a clean SEMVER release: strips any prerelease
 *     suffix (e.g. 0.1.16-beta → 0.1.17). An optional build-metadata tag may
 *     follow the flag (e.g. `--release +Palmar` → 0.1.20+Palmar);
 *   - updates the root "version" field in package.json AND package-lock.json;
 *   - runs scripts/sync-version.mjs to regenerate version.ts + index.html.
 *
 * Node built-ins only (fs, path, url, child_process).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, obj) {
  writeFileSync(join(root, relativePath), `${JSON.stringify(obj, null, 2)}\n`);
}

function bumpVersion(version, { release = false, meta = '' } = {}) {
  // Separa: core numérico (0.1.16), prerelease (-beta) y metadata de build (+x).
  const match = version.match(/^([^+]+?)(-[^+]*)?(\+.*)?$/);
  const core = match[1];
  const prerelease = match[2] ?? '';
  const parts = core.split('.');
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);

  if (release) {
    // Promoción a release: sin prerelease; metadata semver opcional (ej: +Palmar).
    return meta ? `${parts.join('.')}+${meta.replace(/^\+/, '')}` : parts.join('.');
  }
  return `${parts.join('.')}${prerelease}`;
}

// ── Argumentos ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const releaseIdx = args.indexOf('--release');
const release = releaseIdx !== -1;
const meta = release && args[releaseIdx + 1]?.startsWith('+') ? args[releaseIdx + 1] : '';

const pkg = readJson('package.json');
const current = pkg.version;
const next = bumpVersion(current, { release, meta });

pkg.version = next;
writeJson('package.json', pkg);

// package-lock.json was removed from the repo (migrated to bun.lock, 2026-08-08).
// Keep the old behavior when the lock file exists, skip it silently otherwise.
if (existsSync(join(root, 'package-lock.json'))) {
  const lock = readJson('package-lock.json');
  lock.version = next;
  if (lock.packages?.['']) {
    lock.packages[''].version = next;
  }
  writeJson('package-lock.json', lock);
}

console.log(`[bump-version] ${current} → ${next}`);

// Regenerate derived artifacts so version.ts and index.html stay in sync.
execFileSync(process.execPath, [join(root, 'scripts', 'sync-version.mjs')], {
  stdio: 'inherit',
});
