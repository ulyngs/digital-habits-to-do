#!/usr/bin/env node
/**
 * Build Partner Center "What's new" plain text from changelog.md.
 *
 * User-facing Store notes (App Store–style): friendly intro, bullet list of
 * product changes only, then a fixed sign-off. Skips Version lines,
 * macOS-only / Mac App Store bullets, and release-engineering notes.
 *
 * Optional: a leading `>` blockquote in the version section is used as the
 * Store body instead of bullets (exact prose between "Hi folks," and the
 * sign-off).
 *
 * Usage:
 *   node scripts/changelog-to-store-whats-new.js <version> [changelog.md] > whats_new.txt
 *   node scripts/changelog-to-store-whats-new.js 2.7.7 --out whats_new.txt
 */

const fs = require('fs');
const path = require('path');

const MAX_CHARS = 10000;

const INTRO = `Hi folks,

This update comes with some helpful improvements!`;

const SIGNOFF = `Please keep suggesting improvements to the app - you can do so at https://github.com/ulyngs/redd-todo/issues

We hope you're enjoying ReDD To-Do!

- Ulrik, Tiago, & the Centre for Digital Habits Team
(digitalhabits.org)`;

function usage() {
  console.error(
    'usage: node scripts/changelog-to-store-whats-new.js <version> [changelog.md] [--out file]',
  );
  process.exit(1);
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

function isInternalBullet(plain) {
  if (/^version:\s*/i.test(plain)) return true;
  if (
    /\b(store submit|partner center|github release|github actions|msstore|release workflow)\b/i.test(
      plain,
    )
  ) {
    return true;
  }
  if (/\bci\b.*\b(submit|publish|release)\b/i.test(plain)) return true;
  // Windows Store listing — skip macOS / MAS-only notes
  if (/\(mac\s*app\s*store\)|\(macos\)/i.test(plain)) return true;
  return false;
}

/**
 * `**Title:** Body` or `**Title.** Body` → `- "Title": Body`
 */
function formatStoreBullet(rawBody) {
  const plain = stripMdInline(rawBody);
  if (!plain || isInternalBullet(plain)) return null;

  const titledColon = plain.match(/^([^:]+):\s+(.+)$/s);
  if (titledColon) {
    const title = titledColon[1].trim();
    const body = titledColon[2].trim();
    if (title && body) return `- "${title}": ${body}`;
  }

  const titledDot = plain.match(/^(.+?)\.\s+(.+)$/s);
  if (titledDot) {
    const title = titledDot[1].trim();
    const body = titledDot[2].trim();
    if (title && body) return `- "${title}": ${body}`;
  }

  return `- ${plain}`;
}

/** Leading `>` lines in the section → exact Store prose (no bullet list). */
function collectStoreProse(sectionLines) {
  const parts = [];
  for (const raw of sectionLines) {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(/^>\s?(.*)$/);
    if (!m) {
      if (parts.length) break; // only a leading blockquote
      continue;
    }
    parts.push(m[1]);
  }
  return parts.join('\n').trim();
}

function collectStoreBullets(sectionLines) {
  const bullets = [];
  for (let i = 0; i < sectionLines.length; i += 1) {
    const raw = sectionLines[i];
    const line = raw.replace(/\s+$/, '');

    if (/^>\s*/.test(line)) continue;
    if (/^#{2,6}\s+/.test(line)) continue;

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) continue;

    let body = bullet[1];
    while (i + 1 < sectionLines.length) {
      const next = sectionLines[i + 1];
      if (
        /^\s{2,}\S/.test(next) &&
        !/^\s*[-*]\s+/.test(next) &&
        !/^#{2,6}\s+/.test(next.trim())
      ) {
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

function buildWhatsNew(bullets, prose) {
  const signoff = SIGNOFF;
  const joiner = '\n\n';

  if (prose) {
    const text = `Hi folks,${joiner}${prose}${joiner}${signoff}`.trim();
    if (text.length > MAX_CHARS) {
      throw new Error(`Store prose What's new exceeds ${MAX_CHARS} characters.`);
    }
    return text;
  }

  if (!bullets.length) {
    throw new Error(
      'No user-facing changelog bullets for Store notes (only Version / macOS / internal lines?).',
    );
  }

  const intro = INTRO;
  const fixedLen = intro.length + signoff.length + joiner.length * 2;

  let list = bullets.join('\n');
  if (fixedLen + list.length > MAX_CHARS) {
    const budget = MAX_CHARS - fixedLen - '\n\n…'.length;
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
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      outPath = args[++i];
      if (!outPath) usage();
    } else {
      positional.push(args[i]);
    }
  }

  const version = positional[0];
  if (!version) usage();
  const changelogPath = path.resolve(positional[1] || 'changelog.md');

  const markdown = fs.readFileSync(changelogPath, 'utf8');
  const sectionLines = extractSection(markdown, version);
  const prose = collectStoreProse(sectionLines);
  const bullets = collectStoreBullets(sectionLines);
  const text = buildWhatsNew(bullets, prose);

  if (outPath) {
    fs.writeFileSync(outPath, `${text}\n`, 'utf8');
    console.error(`Wrote ${outPath} (${text.length} chars)`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

main();
