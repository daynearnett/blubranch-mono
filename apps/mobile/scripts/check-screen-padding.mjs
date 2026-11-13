#!/usr/bin/env node
// Static check: every screen under app/ has a horizontal gutter on its root
// content container.
//
// Why a script and not a test: apps/mobile has no test runner wired up
// (package.json's "test" is `jest --passWithNoTests` and jest isn't even a
// dependency), and the thing we want to assert — "nothing renders flush to
// the device edge" — is a styling fact a unit test wouldn't catch anyway.
//
// What it checks: for each screen file, find the style object attached to the
// root scroll/list content container (contentContainerStyle={styles.X}) or,
// failing that, the screen's outermost padded container, and require it to
// carry a horizontal padding. Two gutter families are allowed:
//
//   16 (layout.screenPaddingH / spacing.lg) — in-app screens
//   24 (spacing.xl)                         — onboarding, auth, legal
//
// Run: pnpm --filter mobile check:padding

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', 'app');

/**
 * Screens that are deliberately full-bleed at the root. Each row's own
 * paddingHorizontal supplies the gutter, so the container must NOT add one —
 * otherwise the full-width dividers and unread highlights get inset and the
 * list stops reading as a list.
 */
const FULL_BLEED = new Set([
  'app/(app)/messages.tsx', // conversation rows: full-width unread background
  'app/(app)/post/[id].tsx', // comment rows under a full-width 8px divider
  'app/(auth)/welcome.tsx', // horizontal pager: each slide is SCREEN_WIDTH, padded itself
]);

/** Files that render no screen content of their own. */
const isNonScreen = (rel) =>
  rel.endsWith('_layout.tsx') || rel.endsWith('app/index.tsx');

/**
 * Screens whose entire body is one component that owns the gutter. The check
 * follows the component, not the screen, so record the pairing here.
 */
const DELEGATES = {
  'app/(app)/jobs/[id].tsx': 'src/components/job-detail-body.tsx',
  'app/legal/privacy.tsx': 'src/components/legal-document-view.tsx',
  'app/legal/terms.tsx': 'src/components/legal-document-view.tsx',
  'app/(auth)/signup-name.tsx': 'src/components/signup-shell.tsx',
  'app/(auth)/signup-email.tsx': 'src/components/signup-shell.tsx',
  'app/(auth)/signup-verify.tsx': 'src/components/signup-shell.tsx',
  'app/(auth)/signup-location.tsx': 'src/components/signup-shell.tsx',
  'app/(auth)/signup-trade.tsx': 'src/components/signup-shell.tsx',
  'app/(auth)/signup-import.tsx': 'src/components/signup-shell.tsx',
};

const GUTTER_RE =
  /padding(?:Horizontal)?:\s*(?:layout\.screenPaddingH|spacing\.(?:lg|xl|xxl)|1[4-9]|2[0-9]|3[0-2])\b/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Pull the body of `name: { ... }` out of a StyleSheet.create block. Good
 * enough for this codebase's flat, hand-written style objects.
 */
function styleBody(source, name) {
  const start = source.search(new RegExp(`\\n\\s*${name}:\\s*\\{`));
  if (start === -1) return null;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * The style name of the ROOT content container — the first
 * `contentContainerStyle={styles.X}` in source order, since the outermost
 * scrollable appears first in the JSX.
 *
 * Only the first: a screen can have inner scrollables (the Jobs tab's
 * horizontal trade-pill row, for one) that legitimately carry their own
 * padding, and accepting any of them would let the root go unpadded.
 */
function rootStyleNames(source) {
  const first = source.match(/contentContainerStyle=\{styles\.(\w+)\}/);
  if (first) return [first[1]];
  // Screens with no ScrollView still have an outer padded View.
  return ['content', 'body', 'scroll', 'list', 'container'].filter((c) => styleBody(source, c));
}

const failures = [];
const checked = [];

for (const file of walk(appDir).sort()) {
  const rel = relative(join(here, '..'), file).replaceAll('\\', '/');
  if (isNonScreen(rel) || FULL_BLEED.has(rel)) continue;

  const target = DELEGATES[rel] ? join(here, '..', DELEGATES[rel]) : file;
  const source = readFileSync(target, 'utf8');
  const names = rootStyleNames(source);

  const hit = names.find((n) => {
    const body = styleBody(source, n);
    return body && GUTTER_RE.test(body);
  });

  checked.push(rel);
  if (!hit) {
    failures.push({
      rel,
      via: DELEGATES[rel],
      names: names.length ? names.join(', ') : '(no root container style found)',
    });
  }
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} screen(s) with no side padding:\n`);
  for (const f of failures) {
    console.error(`  ${f.rel}${f.via ? `  (via ${f.via})` : ''}`);
    console.error(`      looked at: ${f.names}`);
  }
  console.error(
    '\nAdd a horizontal gutter to the root content container:\n' +
      '  in-app screens      → layout.screenPaddingH (16)\n' +
      '  onboarding / legal  → spacing.xl (24)\n' +
      "If the screen is meant to be full-bleed (rows carry their own gutter),\n" +
      'add it to FULL_BLEED in this script with a one-line reason.\n',
  );
  process.exit(1);
}

console.log(`✓ ${checked.length} screens have a side gutter (${FULL_BLEED.size} full-bleed by design)`);
