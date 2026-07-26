#!/usr/bin/env node
/**
 * Ensure a Store package (.msix / .msixbundle / …) exists under for-distribution.
 *
 * Usage:
 *   node scripts/verify-windows-store-artifacts.js [target-triple]
 * Default target: x86_64-pc-windows-msvc
 */

const fs = require('fs');
const path = require('path');

const STORE_EXTS = [
  '.appx',
  '.msix',
  '.appxbundle',
  '.msixbundle',
  '.appxupload',
  '.msixupload',
];

const repoRoot = path.resolve(__dirname, '..');
const targetTriple = process.argv[2] || 'x86_64-pc-windows-msvc';
const targetDir = path.join(repoRoot, 'for-distribution', targetTriple);

function listFilesRecursively(rootDir) {
  const files = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(rootDir);
  return files;
}

if (!fs.existsSync(targetDir)) {
  console.error(`[build:win-store] Missing distribution directory: ${targetDir}`);
  process.exit(1);
}

const files = listFilesRecursively(targetDir);
const storeArtifacts = files.filter((filePath) => {
  const lower = filePath.toLowerCase();
  return STORE_EXTS.some((ext) => lower.endsWith(ext));
});

if (storeArtifacts.length === 0) {
  console.error(
    '[build:win-store] No Microsoft Store package found (.msix / .msixupload, etc.).\n' +
      `Looked under ${path.relative(repoRoot, targetDir)}\n` +
      'Run scripts/build-msix.ps1 after the Tauri Windows build.',
  );
  process.exit(1);
}

console.log('[build:win-store] Microsoft Store package(s) found:');
storeArtifacts.forEach((artifact) => {
  console.log(`  - ${path.relative(repoRoot, artifact)}`);
});
