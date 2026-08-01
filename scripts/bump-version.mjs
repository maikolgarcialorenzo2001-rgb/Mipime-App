/**
 * bump-version.mjs
 *
 * Helper to bump the app version without typing it manually:
 *   - increments the last numeric component of package.json#version,
 *     preserving any prerelease suffix (e.g. 0.1.12-beta → 0.1.13-beta);
 *   - updates the root "version" field in package.json AND package-lock.json;
 *   - runs scripts/sync-version.mjs to regenerate version.ts + index.html.
 *
 * Node built-ins only (fs, path, url, child_process).
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

function bumpVersion(version) {
  const suffixMatch = version.match(/^(.+?)(-.*)?$/);
  const core = suffixMatch[1];
  const suffix = suffixMatch[2] ?? '';
  const parts = core.split('.');
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  return `${parts.join('.')}${suffix}`;
}

const pkg = readJson('package.json');
const current = pkg.version;
const next = bumpVersion(current);

pkg.version = next;
writeJson('package.json', pkg);

const lock = readJson('package-lock.json');
lock.version = next;
if (lock.packages?.['']) {
  lock.packages[''].version = next;
}
writeJson('package-lock.json', lock);

console.log(`[bump-version] ${current} → ${next}`);

// Regenerate derived artifacts so version.ts and index.html stay in sync.
execFileSync(process.execPath, [join(root, 'scripts', 'sync-version.mjs')], {
  stdio: 'inherit',
});
