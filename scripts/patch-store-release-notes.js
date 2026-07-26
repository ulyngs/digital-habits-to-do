#!/usr/bin/env node
/**
 * Stamp What's new text into a Microsoft Store submission JSON from
 * `msstore submission get`, for `msstore submission update`.
 *
 * Usage:
 *   node scripts/patch-store-release-notes.js submission.json whats_new.txt patched.json [keepPackageFileName]
 *
 * When keepPackageFileName is set, every ApplicationPackages entry whose
 * FileName is not that package is marked FileStatus=PendingDelete.
 */

const fs = require('fs');
const { keyOf, extractJson } = require('./store-submission-json.js');

function patchReleaseNotes(submission, notes) {
  const listingsKey = keyOf(submission, 'listings');
  if (!listingsKey || typeof submission[listingsKey] !== 'object') return 0;

  let stamped = 0;
  for (const listing of Object.values(submission[listingsKey])) {
    if (!listing || typeof listing !== 'object') continue;
    const baseKey = keyOf(listing, 'baseListing');
    const target =
      baseKey && listing[baseKey] && typeof listing[baseKey] === 'object'
        ? listing[baseKey]
        : listing;
    const notesKey = keyOf(target, 'releaseNotes') || 'releaseNotes';
    target[notesKey] = notes;
    stamped += 1;
  }
  return stamped;
}

function markSupersededPackagesPendingDelete(submission, keepFileName) {
  const packagesKey = keyOf(submission, 'applicationPackages');
  if (!packagesKey || !Array.isArray(submission[packagesKey])) {
    return { marked: 0, kept: 0, names: [] };
  }

  const keepLower = keepFileName.toLowerCase();
  const markedNames = [];
  let kept = 0;

  for (const pkg of submission[packagesKey]) {
    if (!pkg || typeof pkg !== 'object') continue;
    const nameKey = keyOf(pkg, 'fileName');
    const name = nameKey ? String(pkg[nameKey] || '') : '';
    const statusKey = keyOf(pkg, 'fileStatus') || 'FileStatus';

    if (name && name.toLowerCase() === keepLower) {
      kept += 1;
      continue;
    }

    pkg[statusKey] = 'PendingDelete';
    markedNames.push(name || '(unnamed)');
  }

  return { marked: markedNames.length, kept, names: markedNames };
}

function main() {
  const [subPath, notesPath, outPath, keepPackageFileName] = process.argv.slice(2);
  if (!subPath || !notesPath || !outPath) {
    console.error(
      'usage: node scripts/patch-store-release-notes.js submission.json whats_new.txt patched.json [keepPackageFileName]',
    );
    process.exit(1);
  }

  const submission = extractJson(fs.readFileSync(subPath, 'utf8'));
  const notes = fs.readFileSync(notesPath, 'utf8').trim();
  if (!notes) {
    console.error('error: empty what\'s-new text');
    process.exit(1);
  }

  const stamped = patchReleaseNotes(submission, notes);
  if (!stamped) {
    console.error(
      'error: no listings structure in the submission JSON — dump it and adjust this script.',
    );
    process.exit(1);
  }
  console.log(`stamped releaseNotes on ${stamped} listing(s)`);

  if (keepPackageFileName) {
    const result = markSupersededPackagesPendingDelete(
      submission,
      keepPackageFileName,
    );
    console.log(
      `marked ${result.marked} package(s) PendingDelete; kept ${result.kept} matching ${keepPackageFileName}`,
    );
    for (const name of result.names) {
      console.log(`  PendingDelete: ${name}`);
    }
    if (result.kept === 0) {
      console.warn(
        `warning: keep package "${keepPackageFileName}" not found in ApplicationPackages — all existing packages marked PendingDelete (expected right after upload if names differ; verify after update).`,
      );
    }
  }

  fs.writeFileSync(outPath, `${JSON.stringify(submission, null, 2)}\n`, 'utf8');
}

main();
