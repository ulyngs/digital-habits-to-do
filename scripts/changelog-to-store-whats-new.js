#!/usr/bin/env node
/**
 * Build store "What's new" plain text from changelog.md.
 *
 * User-facing Store notes (App Store–style): fixed friendly intro, bullet list
 * of product changes, then a fixed sign-off. Skips Version lines, empty
 * platform scaffolding, and release-engineering notes (CI / Store submit / …).
 *
 * Usage:
 *   node scripts/changelog-to-store-whats-new.js <version> --platform windows --out whats_new.txt
 *   node scripts/changelog-to-store-whats-new.js <version> --platform macos --out whats_new_mas.txt
 *   node scripts/changelog-to-store-whats-new.js <version> --platform linux --out whats_new_linux.txt
 *
 * Platform filters:
 *   windows — shared bullets + #### Windows (or ##### Windows)
 *   macos   — shared bullets + #### macOS
 *   linux   — shared bullets + #### Linux
 *
 * Shared = bullets under the version section before any platform heading, and
 * under thematic `###` sections that are not platform names (e.g. FOCUS MODE).
 * There is no #### DESKTOP layer — ReDD To-Do is desktop-only; shared notes
 * live in the main version body.
 *
 * Character limits: Partner Center 10,000; App Store Connect "What's New" 4,000.
 */

const fs = require('fs');
const path = require('path');

const PLATFORMS = {
  windows: { maxChars: 10000 },
  macos: { maxChars: 4000 },
  mac: { maxChars: 4000 }, // alias
  linux: { maxChars: 10000 },
};

const INTRO = `Hi folks,

This update comes with some helpful improvements!`;

const SIGNOFF = `Please keep suggesting improvements to the app - you can do so at https://github.com/ulyngs/redd-todo/issues

We hope you're enjoying ReDD To-Do!

- Ulrik, Tiago, & the Centre for Digital Habits Team
(digitalhabits.org)`;

function usage() {
  console.error(
    'usage: node scripts/changelog-to-store-whats-new.js <version> [changelog.md] --platform windows|macos|linux [--empty-ok] [--out file]',
  );
  process.exit(1);
}

function normalizePlatform(raw) {
  const p = (raw || '').toLowerCase();
  if (p === 'mac' || p === 'macos' || p === 'osx') return 'macos';
  if (p === 'win' || p === 'windows') return 'windows';
  if (p === 'linux') return 'linux';
  return null;
}

function extractSection(changelog, version) {
  const tag = version.startsWith('v') ? version : `v${version}`;
  const lines = changelog.split(/\r?\n/);
  let found = false;
  const section = [];
  for (const line of lines) {
    if (/^## v\d/.test(line)) {
      if (found) break;
      if (line === `## ${tag}` || line.startsWith(`## ${tag} `)) {
        found = true;
        continue;
      }
    }
    if (found) section.push(line);
  }
  if (!found || section.every((l) => !l.trim())) {
    throw new Error(`No changelog section for ${tag} — add ## ${tag} first.`);
  }
  return section;
}

function stripMdInline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** True for bullets that belong in the engineering changelog, not Store notes. */
function isInternalBullet(plain) {
  if (/^version:\s*/i.test(plain)) return true;
  if (
    /\b(store submit|partner center|github release|github actions|msstore|release workflow|mac app store submission|app store connect)\b/i.test(
      plain,
    )
  ) {
    return true;
  }
  if (/\bci\b.*\b(submit|publish|release)\b/i.test(plain)) return true;
  return false;
}

/**
 * Format a changelog bullet for Store notes.
 * `**Title.** Body` → `- "Title": Body`
 */
function formatStoreBullet(rawBody) {
  const plain = stripMdInline(rawBody);
  if (!plain || isInternalBullet(plain)) return null;

  const titled = plain.match(/^(.+?)\.\s+(.+)$/s);
  if (titled) {
    const title = titled[1].trim();
    const body = titled[2].trim();
    if (title && body) return `- "${title}": ${body}`;
  }
  return `- ${plain}`;
}

function platformFromTitle(title) {
  if (/^windows$|\bwindows\b/i.test(title) && !/mac|linux/i.test(title)) return 'windows';
  if (/^macos$|^mac$|\bmacos\b/i.test(title)) return 'macos';
  if (/^linux$|\blinux\b/i.test(title)) return 'linux';
  return null;
}

/**
 * Track which platform the current changelog subsection applies to.
 *
 *   (top of ## vX.Y.Z / thematic ### FOCUS …)  → shared
 *   ### BY PLATFORM                             → by-platform scaffold
 *   #### Windows / #### macOS / #### Linux      → that platform only
 *   ##### Windows / … (if nested)               → that platform only
 */
function scopeForHeading(level, title, current) {
  const platform = platformFromTitle(title);
  if (platform) return platform;

  if (level === 3) {
    return /by platform/i.test(title) ? 'by-platform' : 'shared';
  }
  // Non-platform h4+ under BY PLATFORM: stay in scaffold (ignore bullets)
  if (current === 'by-platform') return 'by-platform';
  return 'shared';
}

function scopeMatchesPlatform(scope, platform) {
  if (scope === 'shared') return true;
  if (scope === 'by-platform') return false;
  return scope === platform;
}

function collectStoreBullets(sectionLines, platform) {
  const bullets = [];
  let scope = 'shared';
  for (let i = 0; i < sectionLines.length; i += 1) {
    const raw = sectionLines[i];
    const line = raw.replace(/\s+$/, '');

    // Ignore leftover blockquotes from older entries — Store intro is fixed.
    if (/^>\s*/.test(line)) continue;

    const heading = line.match(/^(#{3,6})\s+(.*)$/);
    if (heading) {
      scope = scopeForHeading(heading[1].length, heading[2], scope);
      continue;
    }
    if (/^#{2,6}\s+/.test(line)) continue;

    if (!scopeMatchesPlatform(scope, platform)) continue;

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) continue;

    let body = bullet[1];
    while (i + 1 < sectionLines.length) {
      const next = sectionLines[i + 1];
      if (/^\s{2,}\S/.test(next) && !/^\s*[-*]\s+/.test(next) && !/^#{2,6}\s+/.test(next.trim())) {
        body = `${body} ${next.trim()}`;
        i += 1;
        continue;
      }
      break;
    }

    const formatted = formatStoreBullet(body);
    if (formatted) bullets.push(formatted);
  }
  return bullets;
}

function buildWhatsNew(bullets, maxChars, emptyOk) {
  if (!bullets.length) {
    if (emptyOk) return '';
    throw new Error(
      'No user-facing changelog bullets for Store notes (only Version / other-platform / internal lines?).',
    );
  }

  const intro = INTRO;
  const signoff = SIGNOFF;
  const joiner = '\n\n';
  const fixedLen = intro.length + signoff.length + joiner.length * 2;

  let list = bullets.join('\n');
  if (fixedLen + list.length > maxChars) {
    const budget = maxChars - fixedLen - '\n\n…'.length;
    const kept = [];
    let used = 0;
    for (const b of bullets) {
      const add = (kept.length ? 1 : 0) + b.length;
      if (used + add > budget) break;
      kept.push(b);
      used += add;
    }
    if (!kept.length) {
      kept.push(`${bullets[0].slice(0, Math.max(40, budget - 1))}…`);
    }
    list = `${kept.join('\n')}\n…`;
  }

  return `${intro}${joiner}${list}${joiner}${signoff}`.trim();
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  let outPath = null;
  let platform = null;
  let emptyOk = false;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      outPath = args[++i];
      if (!outPath) usage();
    } else if (args[i] === '--empty-ok') {
      emptyOk = true;
    } else if (args[i] === '--platform') {
      platform = normalizePlatform(args[++i]);
      if (!platform) usage();
    } else {
      positional.push(args[i]);
    }
  }

  // Default to windows so Partner Center never silently picks up macOS/Linux bullets.
  if (!platform) platform = 'windows';

  const version = positional[0];
  if (!version) usage();
  const changelogPath = path.resolve(positional[1] || 'changelog.md');
  const maxChars = PLATFORMS[platform].maxChars;

  const markdown = fs.readFileSync(changelogPath, 'utf8');
  const sectionLines = extractSection(markdown, version);
  const bullets = collectStoreBullets(sectionLines, platform);
  const text = buildWhatsNew(bullets, maxChars, emptyOk);

  if (outPath) {
    fs.writeFileSync(outPath, text ? `${text}\n` : '', 'utf8');
    console.error(
      text
        ? `Wrote ${outPath} (${text.length} chars, platform=${platform})`
        : `Wrote ${outPath} (empty — no ${platform}-facing changes)`,
    );
  } else {
    process.stdout.write(text ? `${text}\n` : '');
  }
}

main();
