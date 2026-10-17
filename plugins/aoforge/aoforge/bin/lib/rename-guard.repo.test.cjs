'use strict';

// Test list (TRD 72-04, objective 72-install-and-naming-cleanup, INST-02). This is the repo gate
// that keeps the legacy product names out of the tree once the AOForge rename has landed. It
// spells no legacy name itself: every token it looks for is built from LEGACY in
// legacy-names.cjs, and what it skips and preserves comes from the rename codemod
// (scripts/aoforge-rename.cjs SKIP and PRESERVE), so the guard and the codemod share one
// definition.
//
// 1. Scan set = `git ls-files` minus the codemod's SKIP minus ALLOW. It is non-empty
//    (> 500 files) and includes plugins/aoforge/aoforge/bin/aof-tools.cjs and README.md.
// 2. Main gate: zero findings across the scan set for the legacy product word (any case, after
//    masking the codemod's PRESERVE tokens), the legacy CLI name, the legacy banner and (quick 40,
//    test 10, user-facing files only) a pre-plugin install-prefixed agent or skill name, in file
//    content and in the path itself. A failure lists `file:line token` and the ALLOW table.
// 3. Lines inside an ignore region (the rename-guard ignore-start ... ignore-end markers) are not
//    scanned; only files in IGNORE_REGION_FILES may contain such a region, and every region in
//    the repository is closed (an unclosed region throws).
// 3d. Every IGNORE_REGION_FILES entry is a tracked file in the scan set (TRD 72-17): an entry for a
//    file that is gone, or that the codemod's SKIP hides, is a dead or unguarded allowance.
// 3e. The migration guides (TRD 72-17, repo and site copies) are clean as written only because of
//    their regions (with the markers removed they have findings), and on a temp copy one legacy
//    word appended outside every region is exactly one finding on that line.
// 4. Every ALLOW entry has a reason of >= 20 chars and matches >= 1 tracked path; an entry with
//    `spans` (test 9) is a global RegExp that matches >= 1 span in a tracked file it names.
// 5. Sensitivity: a sample text with one of each token yields three findings; the preserved
//    product names (the ...ops product and the .cloud domain) yield none.
// 5b. Planning-tree exemption: in a scratch git repo with tracked `<new planning dir>/x.md` and
//    `<legacy planning dir>/x.md`, each containing the legacy product word, scanRepo yields zero findings for
//    both (the planning tree stays history after 72-21's move), while the same word in the
//    tracked live user guide yields one. (`docs/x.md` is design history under the codemod's
//    docs-history SKIP, so the live guide is the positive control.)
// 6. Token patterns are built from LEGACY: this file's own source contains no legacy literal.
// 8. Planning directory (TRD 72-06): the token set includes the legacy planning directory name
//    (`planningDir`, built from LEGACY.planningDir), counted only where the codemod would call it a
//    directory (not member access such as a config key); a sample line naming the legacy STATE.md
//    yields one finding; the tree passes with an ALLOW entry for the monorepo doctor only (TRD 79-01
//    removed the .gitignore entry with the last legacy ignore lines).
// 9. Span-scoped ALLOW (TRD 72-14): an entry with `spans` keeps its file in the scan set and masks
//    only those spans (a JSON file cannot hold an ignore region). Since TRD 78-02 removed the pointer
//    release, ALLOW holds no such entry, so a synthetic one is passed in: its spans are masked and
//    another legacy word on another line is still found; the same text under another path yields
//    every finding. Masking keeps line numbers.
// 10. Install-prefixed agent and skill names (quick 40): the `installName` token is LEGACY.installPrefix
//    followed by one of the tree's agent names (plugins/aoforge/agents/*.md) or skill directories
//    (plugins/aoforge/skills/*/), read lazily, as a whole word not followed by `-`. It applies only to
//    the user-facing set (agents, skills, workflows, references, templates, stack-profiles, live docs,
//    site/content, README.md, CLAUDE.md; never a test or a fixture). Live conventions (the worktrees
//    directory, the ws/ and exec/ branch prefixes), mkdtemp-style prefixes and globs never match; tests,
//    fixtures, code, CHANGELOG, docs history and the planning tree are out of scope. Test 6 also holds
//    the guard source to zero installName matches.
//
// Runtime model: read-only against the repository (5b writes only to its own tmp dir). Repo
// root is path.resolve(__dirname, '..', '..', '..', '..', '..'); a mirror install (no README.md
// there, no scripts/ directory) skips the whole file.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { NAMES, LEGACY } = require('./legacy-names.cjs');
const { globToRegExp } = require('./doc-refs.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const IS_AOFORGE_CHECKOUT =
  fs.existsSync(path.join(REPO_ROOT, 'README.md')) &&
  fs.existsSync(path.join(REPO_ROOT, 'scripts', 'aoforge-rename.cjs'));

/** The rename codemod (SKIP, PRESERVE, isSkipped). Loaded lazily: a mirror install has no scripts/. */
let _codemod = null;
function codemod() {
  if (!_codemod) _codemod = require(path.join(REPO_ROOT, 'scripts', 'aoforge-rename.cjs'));
  return _codemod;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── ALLOW (on top of the codemod's SKIP) ──────────────────────────────────────────
// Every entry: a reason of >= 20 chars, and a pattern that matches >= 1 tracked path (test 4).
// A dead entry is a bug, so it fails the gate rather than sitting there silently.
// An entry with `spans` (a /g RegExp, test 9) keeps its files in the scan set and masks only
// those spans: for a file that must name the old plugin in a few places and cannot hold an
// ignore region (JSON). Its spans must match in the file, or it is dead too.

const ALLOW = [
  {
    pattern: '**/legacy-names.cjs',
    reason: 'the one module that spells every legacy name; every other module builds them from LEGACY (3.1: detectors, gh rebrand, history readers)',
  },
  {
    pattern: '**/__fixtures__/legacy-*',
    reason: 'fixtures that build pre-rename projects, homes and GitHub artefacts as input',
  },
  {
    pattern: '**/*.legacy.test.*',
    reason: 'tests feed legacy names as input to prove 3.1 ignores or reports them',
  },
  {
    pattern: 'scripts/aoforge-rename*',
    reason: 'the rename codemod and its test spell the old names to find them',
  },
  {
    pattern: 'scripts/__fixtures__/legacy-*',
    reason: 'the codemod fixtures are a sample tree spelled with the old names',
  },
  {
    pattern: 'plugins/monorepo-standards/skills/monorepo-doctor/lib/doctor.js',
    reason: 'skips directories by name: its skip lists name the legacy planning and product directories beside the new ones',
  },
  // TRD 78-02 removed the pointer release of the old plugin and, with it, its four entries here (the plugin
  // directory, its generator, and the span-scoped marketplace and package.json entries). TRD 79-01 removed the
  // .gitignore entry: the main reconcile moved the last legacy planning records, so no legacy ignore line is left.
];

// ─── ignore regions ───────────────────────────────────────────────────────────────
// Built from parts so this file does not itself carry a region marker.

const IGNORE_START = ['rename-guard', 'ignore-start'].join(':');
const IGNORE_END = ['rename-guard', 'ignore-end'].join(':');

/** The 3.0.0 migration guide (TRD 72-17): it names every old spelling, each inside an ignore region. */
const MIGRATION_GUIDES = ['docs/MIGRATING-TO-AOFORGE.md', 'site/content/docs/getting-started/migrating-to-aoforge.md'];

/**
 * The only files allowed to hold an ignore region. `site/static/_redirects` (TRD 72-17) spells the
 * old CLI reference URL so the docs site can redirect it (`#` comments carry the markers).
 * CLAUDE.md held the objective 72 transition note until TRD 72-22 removed it, and with it this entry.
 */
const IGNORE_REGION_FILES = ['docs/USER-GUIDE.md', 'site/static/_redirects', ...MIGRATION_GUIDES];

class RenameGuardError extends Error {}

/** 0-based indices of the lines inside an ignore region, markers included. Throws on an unclosed region. */
function ignoredLines(lines) {
  const ignored = new Set();
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    const hasStart = lines[i].includes(IGNORE_START);
    const hasEnd = lines[i].includes(IGNORE_END);
    if (open === -1 && hasStart) {
      ignored.add(i);
      open = hasEnd ? -1 : i;
      continue;
    }
    if (open !== -1) {
      ignored.add(i);
      if (hasEnd) open = -1;
    } else if (hasEnd) {
      throw new RenameGuardError(`${IGNORE_END} without ${IGNORE_START} at line ${i + 1}`);
    }
  }
  if (open !== -1) {
    throw new RenameGuardError(`unclosed ${IGNORE_START} (no ${IGNORE_END}) starting at line ${open + 1}`);
  }
  return ignored;
}

// ─── pre-plugin install-prefixed agent and skill names (quick 40, test 10) ───────────
// The pre-plugin install put every agent and skill under LEGACY.installPrefix. A user-facing file that
// still names one points the reader at a name nothing resolves any more. The token is scoped to the
// user-facing set: tests, fixtures, code under bin/ and hooks/, history and the planning tree keep their
// prefixed inputs, mkdtemp prefixes and detectors on purpose, so the token never applies there.

const INSTALL_NAME_SCOPE = [
  'plugins/aoforge/agents/**',
  'plugins/aoforge/skills/**',
  'plugins/aoforge/aoforge/workflows/**',
  'plugins/aoforge/aoforge/references/**',
  'plugins/aoforge/aoforge/templates/**',
  'plugins/aoforge/aoforge/stack-profiles/**',
  'docs/**',
  'site/content/**',
  'README.md',
  'CLAUDE.md',
].map(globToRegExp);

/** Whether `rel` is a user-facing file the installName token applies to (tests and fixtures never are). */
function inInstallNameScope(rel) {
  return (
    INSTALL_NAME_SCOPE.some((re) => re.test(rel)) &&
    !/\.test\.[^/]*$/.test(rel) &&
    !/(^|\/)__fixtures__\//.test(rel)
  );
}

/**
 * Every agent (plugins/aoforge/agents/*.md) and skill (plugins/aoforge/skills/<dir>) name in the tree,
 * longest first. Read lazily, on the first in-scope scan: a mirror install loads this module with no
 * plugins/ tree.
 */
let _agentAndSkillNames = null;
function agentAndSkillNames() {
  if (!_agentAndSkillNames) {
    const root = path.join(REPO_ROOT, 'plugins', 'aoforge');
    const agents = fs
      .readdirSync(path.join(root, 'agents'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -'.md'.length));
    const skills = fs
      .readdirSync(path.join(root, 'skills'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    _agentAndSkillNames = [...new Set([...agents, ...skills])].sort((a, b) => b.length - a.length || a.localeCompare(b));
  }
  return _agentAndSkillNames;
}

/**
 * The prefix, then one of the names, as a whole word. The trailing `-` exclusion keeps mkdtemp-style
 * prefixes (the prefix, a name and a dash) out; a directory such as the worktrees root is no name.
 */
let _installNameRe = null;
function installNameRe() {
  if (!_installNameRe) {
    const names = agentAndSkillNames().map(esc).join('|');
    _installNameRe = new RegExp(`(?<![A-Za-z0-9_])${esc(LEGACY.installPrefix)}(?:${names})(?![A-Za-z0-9_-])`, 'g');
  }
  return _installNameRe;
}

// ─── tokens (built from LEGACY, test 6) ───────────────────────────────────────────

const TOKENS = [
  { id: 'product', re: new RegExp(esc(LEGACY.slug), 'gi') },
  { id: 'cli', re: new RegExp(esc(LEGACY.cli), 'gi') },
  { id: 'banner', re: new RegExp(esc(LEGACY.banner), 'g') },
  // TRD 72-06: the legacy planning directory, not followed by an identifier character (a longer
  // identifier is another word). Member access is filtered below with the codemod's occurrenceKind.
  { id: 'planningDir', re: new RegExp(`${esc(LEGACY.planningDir)}(?![A-Za-z0-9_])`, 'g'), directoryOnly: true },
  // Quick 40: a pre-plugin install-prefixed agent or skill name, only in the user-facing set (`scope`).
  {
    id: 'installName',
    get re() {
      return installNameRe();
    },
    scope: inInstallNameScope,
  },
];

/** Kinds of a planning-directory occurrence that name the directory (codemod occurrenceKind). */
const DIRECTORY_KINDS = new Set(['path', 'regex']);

/** Swap every span the codemod preserves (or leaves for a human) in `rel` for same-length filler. */
function maskPreserved(text, rel) {
  const { PRESERVE } = codemod();
  const fill = (m) => '\u0000'.repeat(m.length);
  for (const p of PRESERVE.manual) {
    if (p.rules && p.rules !== 'names') continue;
    if (p.files && !p.files(rel)) continue;
    text = text.replace(p.re, fill);
  }
  for (const p of PRESERVE.scoped) {
    if (p.files && !p.files(rel)) continue;
    text = text.replace(p.re, fill);
  }
  for (const p of PRESERVE.global) text = text.replace(p.re, fill);
  return text;
}

/** The word around a match, for a readable finding. */
function wordAt(line, index, length) {
  let s = index;
  let e = index + length;
  while (s > 0 && /[\w.~/@:-]/.test(line[s - 1])) s--;
  while (e < line.length && /[\w.~/@:-]/.test(line[e])) e++;
  return line.slice(s, e);
}

/**
 * Every legacy token in `text`, the content of `rel`: [{ line, token }], 1-based lines.
 * Ignore regions are skipped; preserved spans are masked first.
 */
function scanText(text, rel = '') {
  const lines = maskPreserved(text, rel).split('\n');
  const ignored = ignoredLines(lines);
  // A scoped token (installName) applies only to the files its scope names; outside them its pattern is never built.
  const tokens = TOKENS.filter((t) => !t.scope || t.scope(rel));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (ignored.has(i)) continue;
    for (const t of tokens) {
      for (const m of lines[i].matchAll(t.re)) {
        if (t.directoryOnly && !DIRECTORY_KINDS.has(codemod().occurrenceKind(lines[i], m.index))) continue;
        out.push({ line: i + 1, token: wordAt(lines[i], m.index, m[0].length) });
      }
    }
  }
  return out;
}

/** Legacy tokens in the path itself (line 0). */
function scanPath(rel) {
  return scanText(rel, rel).map((f) => ({ line: 0, token: f.token }));
}

// ─── scan set ─────────────────────────────────────────────────────────────────────

/** Tracked regular files under `root`, posix paths. */
function trackedFiles(root) {
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 });
  if (r.error || r.status !== 0) {
    throw new Error(`git ls-files failed in ${root}: ${r.error ? r.error.message : String(r.stderr).trim()}`);
  }
  return r.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((f) => {
      try {
        return fs.lstatSync(path.join(root, f)).isFile();
      } catch {
        return false;
      }
    });
}

const allowRes = (allow) => allow.map((a) => globToRegExp(a.pattern));

/** `git ls-files` minus the codemod's SKIP minus the whole-file entries of `allow`. */
function scanSet(root, { allow = ALLOW } = {}) {
  const { isSkipped } = codemod();
  const res = allowRes(allow.filter((a) => !a.spans));
  return trackedFiles(root).filter((rel) => !isSkipped(rel) && !res.some((re) => re.test(rel)));
}

/**
 * `text` with every span a span-scoped `allow` entry names for `rel` swapped for same-length
 * filler; line breaks are kept, so line numbers stay true (test 9c).
 */
function maskAllowedSpans(text, rel, allow = ALLOW) {
  for (const a of allow) {
    if (!a.spans || !globToRegExp(a.pattern).test(rel)) continue;
    text = text.replace(a.spans, (m) => m.replace(/[^\n]/g, '\u0000'));
  }
  return text;
}

/** Every legacy token in the content of one scanned file, after its span-scoped allowances. */
function scanFile(text, rel, allow = ALLOW) {
  return scanText(maskAllowedSpans(text, rel, allow), rel);
}

/** Text of a file, or null when it is binary or not valid UTF-8 (the codemod skips those too). */
function readText(root, rel) {
  const buf = fs.readFileSync(path.join(root, rel));
  if (buf.includes(0)) return null;
  const text = buf.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buf) ? text : null;
}

/** Every finding across the scan set of `root`: [{ file, line, token }]. */
function scanRepo(root, opts = {}) {
  const allow = opts.allow || ALLOW;
  const findings = [];
  for (const rel of scanSet(root, { allow })) {
    for (const f of scanPath(rel)) findings.push({ file: rel, ...f });
    const text = readText(root, rel);
    if (text === null) continue;
    for (const f of scanFile(text, rel, allow)) findings.push({ file: rel, ...f });
  }
  return findings;
}

const MAX_LISTED = 300;

function formatFailure(findings) {
  const listed = findings.slice(0, MAX_LISTED).map((f) => `  ${f.file}:${f.line}  ${f.token}`);
  if (findings.length > MAX_LISTED) listed.push(`  ... and ${findings.length - MAX_LISTED} more`);
  return [
    `${findings.length} legacy name(s) in the tree (rename them, or, only for a file that must spell the`,
    'old name, add a justified ALLOW entry):',
    ...listed,
    '',
    'ALLOW (on top of the codemod SKIP):',
    ...ALLOW.map((a) => `  ${a.pattern} — ${a.reason}`),
  ].join('\n');
}

// ─── tests ────────────────────────────────────────────────────────────────────────

describe('rename-guard.repo.test.cjs', { skip: IS_AOFORGE_CHECKOUT ? false : 'not an AOForge source checkout' }, () => {
  test('1: scan set is non-empty (> 500 files) and includes the named anchors', () => {
    const files = scanSet(REPO_ROOT);
    assert.ok(files.length > 500, `expected > 500 files in the scan set, got ${files.length}`);
    assert.ok(files.includes('README.md'), 'scan set must include README.md');
    assert.ok(
      files.includes('plugins/aoforge/aoforge/bin/aof-tools.cjs'),
      'scan set must include plugins/aoforge/aoforge/bin/aof-tools.cjs',
    );
  });

  test('2: zero legacy names across the scan set (content and paths)', () => {
    const findings = scanRepo(REPO_ROOT);
    assert.equal(findings.length, 0, formatFailure(findings));
  });

  describe('3: ignore regions', () => {
    test('3a: lines inside a region are not scanned; lines outside are', () => {
      const text = [
        `before ${LEGACY.product}`,
        `<!-- ${IGNORE_START} -->`,
        `inside ${LEGACY.product} and ${LEGACY.cli}`,
        `<!-- ${IGNORE_END} -->`,
        `after ${LEGACY.cli}`,
      ].join('\n');
      const found = scanText(text, 'docs/USER-GUIDE.md');
      assert.deepEqual(
        found.map((f) => f.line),
        [1, 5],
      );
    });

    test('3b: an unclosed region throws', () => {
      assert.throws(() => scanText(`${IGNORE_START}\n${LEGACY.product}\n`, 'x.md'), RenameGuardError);
      assert.throws(() => scanText(`${IGNORE_END}\n`, 'x.md'), RenameGuardError);
    });

    test('3c: only IGNORE_REGION_FILES hold a region, and every region is closed', () => {
      const holders = [];
      for (const rel of scanSet(REPO_ROOT)) {
        const text = readText(REPO_ROOT, rel);
        if (text === null) continue;
        if (!text.includes(IGNORE_START) && !text.includes(IGNORE_END)) continue;
        holders.push(rel);
        assert.doesNotThrow(() => ignoredLines(text.split('\n')), `${rel}: region not closed`);
      }
      const stray = holders.filter((rel) => !IGNORE_REGION_FILES.includes(rel));
      assert.deepEqual(stray, [], `ignore regions outside IGNORE_REGION_FILES: ${stray.join(', ')}`);
    });

    test('3d: every IGNORE_REGION_FILES entry is a tracked file the guard scans', () => {
      const scanned = new Set(scanSet(REPO_ROOT));
      const missing = IGNORE_REGION_FILES.filter((rel) => !scanned.has(rel));
      assert.deepEqual(
        missing,
        [],
        `IGNORE_REGION_FILES entries that are not tracked or not scanned (a dead or unguarded entry): ${missing.join(', ')}`,
      );
    });

    describe('3e: the migration guides (TRD 72-17): a legacy name outside a region still fails', () => {
      for (const rel of MIGRATION_GUIDES) {
        test(rel, () => {
          const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
          const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-guard-guide-'));
          try {
            const git = (...args) => {
              const r = spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
              assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
            };
            const write = (body) => {
              fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
              fs.writeFileSync(path.join(tmp, rel), body);
            };
            git('init', '-q');

            // As written: clean, and only because of its regions.
            write(text);
            git('add', '--', rel);
            assert.deepEqual(scanRepo(tmp, { allow: [] }), [], `${rel} as written has findings`);
            const unmarked = text
              .split('\n')
              .filter((l) => !l.includes(IGNORE_START) && !l.includes(IGNORE_END))
              .join('\n');
            assert.ok(scanText(unmarked, rel).length > 0, `${rel} names no legacy spelling inside a region`);

            // One legacy word appended outside every region: exactly that line is a finding.
            const stray = `${text.replace(/\n*$/, '\n')}\nA stray ${LEGACY.product} mention.\n`;
            write(stray);
            git('add', '--', rel);
            const lastLine = stray.split('\n').length - 1;
            assert.deepEqual(
              scanRepo(tmp, { allow: [] }).map((f) => `${f.file}:${f.line}`),
              [`${rel}:${lastLine}`],
            );
          } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
          }
        });
      }
    });
  });

  test('4: every ALLOW entry has a reason >= 20 chars and matches >= 1 tracked path', () => {
    const tracked = trackedFiles(REPO_ROOT);
    for (const entry of ALLOW) {
      assert.ok(
        typeof entry.reason === 'string' && entry.reason.length >= 20,
        `ALLOW ${entry.pattern}: reason must be >= 20 chars`,
      );
      const re = globToRegExp(entry.pattern);
      assert.ok(
        tracked.some((rel) => re.test(rel)),
        `ALLOW ${entry.pattern} matches no tracked path (a dead entry)`,
      );
      if (entry.spans === undefined) continue;
      assert.ok(entry.spans instanceof RegExp && entry.spans.global, `ALLOW ${entry.pattern}: spans must be a /g RegExp`);
      const files = tracked.filter((rel) => re.test(rel));
      assert.ok(
        files.some((rel) => new RegExp(entry.spans.source, entry.spans.flags).test(readText(REPO_ROOT, rel) || '')),
        `ALLOW ${entry.pattern}: spans ${entry.spans} match nothing in the file (a dead entry)`,
      );
    }
  });

  describe('5: sensitivity', () => {
    test('5a: one of each token yields three findings', () => {
      const text = [`Uses ${LEGACY.product} here.`, `Run ${LEGACY.cli} state load.`, `${LEGACY.banner} DONE`].join(
        '\n',
      );
      const found = scanText(text, 'README.md');
      assert.equal(found.length, 3, JSON.stringify(found));
      assert.deepEqual(
        found.map((f) => f.line),
        [1, 2, 3],
      );
    });

    test('5b: the preserved product names yield none', () => {
      const text = [`${LEGACY.slug}ops repo`, `${LEGACY.slug}.cloud domain`].join('\n');
      assert.deepEqual(scanText(text, 'README.md'), []);
    });

    test('5c: the planning tree is exempt under both names; the live guide is not', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-guard-'));
      try {
        const git = (...args) => {
          const r = spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
          assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
        };
        git('init', '-q');
        const files = [`${NAMES.planningDir}/x.md`, `${LEGACY.planningDir}/x.md`, 'docs/x.md', 'docs/USER-GUIDE.md'];
        for (const rel of files) {
          fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
          fs.writeFileSync(path.join(tmp, rel), `A ${LEGACY.product} note.\n`);
        }
        git('add', '--', ...files);
        const findings = scanRepo(tmp, { allow: [] });
        assert.deepEqual(
          findings.map((f) => `${f.file}:${f.line}`),
          ['docs/USER-GUIDE.md:1'],
        );
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  test('6: this file spells no legacy name (tokens are built from LEGACY)', () => {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.equal(new RegExp(esc(LEGACY.slug), 'i').test(src), false, 'legacy product word in the guard source');
    assert.equal(src.toLowerCase().includes(LEGACY.cli.toLowerCase()), false, 'legacy CLI name in the guard source');
    assert.equal(src.includes(LEGACY.banner), false, 'legacy banner in the guard source');
    assert.deepEqual(scanText(src, path.relative(REPO_ROOT, __filename)), [], 'legacy planning directory in the guard source');
    // Quick 40: the guard source is out of the installName scope, so it is held to the pattern directly.
    assert.deepEqual(
      [...src.matchAll(installNameRe())].map((m) => m[0]),
      [],
      'install-prefixed agent or skill name in the guard source',
    );
  });

  describe('8: the legacy planning directory (TRD 72-06)', () => {
    test('8a: the token set holds the planning directory token, built from LEGACY', () => {
      const t = TOKENS.find((x) => x.id === 'planningDir');
      assert.ok(t, 'a planningDir token');
      assert.ok(t.re.source.startsWith(esc(LEGACY.planningDir)), t.re.source);
    });

    test('8b: a sample line naming the legacy STATE.md yields one finding', () => {
      const found = scanText(`cat ${LEGACY.planningDir}/STATE.md\n`, 'README.md');
      assert.deepEqual(found, [{ line: 1, token: `${LEGACY.planningDir}/STATE.md` }]);
    });

    test('8c: member access and longer identifiers are not the directory', () => {
      const prop = LEGACY.planningDir.slice(1);
      const text = [`cfg.${prop}.commit_docs`, `opts.${prop}Dir`, `${NAMES.planningDir}/STATE.md`].join('\n');
      assert.deepEqual(scanText(text, 'x.cjs'), []);
    });

    test('8d: a regex naming the legacy directory is a finding', () => {
      const found = scanText(`const RE = /\\${LEGACY.planningDir}\\//;\n`, 'x.cjs');
      assert.equal(found.length, 1, JSON.stringify(found));
    });
  });

  // TRD 78-02: ALLOW holds no span-scoped entry any more (the pointer release's marketplace and package.json entries
  // went with it), so the mechanism is tested with a synthetic one, passed in as `allow`.
  describe('9: span-scoped ALLOW (TRD 72-14, synthetic entry since TRD 78-02)', () => {
    const FIXTURE = 'fixture.json';
    const SPAN_ALLOW = [
      {
        pattern: FIXTURE,
        spans: new RegExp(
          `"(?:name|source)": "(?:\\./plugins/)?${esc(LEGACY.slug)}"` +
            `|"description": "${esc(LEGACY.product)} is now ${esc(NAMES.product)}[^"\\n]*"`,
          'g',
        ),
        reason: 'a synthetic span-scoped entry: the span mechanism stays covered with no such entry in ALLOW',
      },
    ];
    const sample = [
      '{',
      `  "name": "${LEGACY.slug}",`,
      `  "description": "${LEGACY.product} is now ${NAMES.product}: install ${NAMES.plugin}.",`,
      '  "version": "3.0.0",',
      `  "source": "./plugins/${LEGACY.slug}",`,
      `  "category": "uses ${LEGACY.cli}"`,
      '}',
    ].join('\n');

    test('9a: the spans are masked and the file stays in the scan set; another legacy word is still found', () => {
      assert.equal(ALLOW.some((a) => a.spans !== undefined), false, 'ALLOW itself holds no span-scoped entry');
      assert.deepEqual(
        scanFile(sample, FIXTURE, SPAN_ALLOW).map((f) => f.line),
        [6],
      );
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-guard-spans-'));
      try {
        const git = (...args) => {
          const r = spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
          assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
        };
        git('init', '-q');
        fs.writeFileSync(path.join(tmp, FIXTURE), sample);
        git('add', '--', FIXTURE);
        assert.ok(scanSet(tmp, { allow: SPAN_ALLOW }).includes(FIXTURE), 'a span-scoped file stays in the scan set');
        assert.deepEqual(
          scanRepo(tmp, { allow: SPAN_ALLOW }).map((f) => `${f.file}:${f.line}`),
          [`${FIXTURE}:6`],
        );
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('9b: the same text under another path yields every finding', () => {
      assert.deepEqual(
        scanFile(sample, 'x.json', SPAN_ALLOW).map((f) => f.line),
        [2, 3, 5, 6],
      );
    });

    test('9c: masking keeps the text length and its line breaks', () => {
      const masked = maskAllowedSpans(sample, FIXTURE, SPAN_ALLOW);
      assert.notEqual(masked, sample, 'the spans were masked');
      assert.equal(masked.length, sample.length);
      assert.equal(masked.split('\n').length, sample.split('\n').length);
    });
  });

  describe('10: pre-plugin install-prefixed agent and skill names (quick 40)', () => {
    const P = LEGACY.installPrefix;
    const IN_SCOPE = 'plugins/aoforge/aoforge/references/x.md';

    test('10a: an agent name, a backticked agent name and a skill path in scope are three findings', () => {
      const text = [`${P}planner`, `\`${P}verifier\``, `${P}plan-objective/SKILL.md`].join('\n');
      assert.deepEqual(scanText(text, IN_SCOPE), [
        { line: 1, token: `${P}planner` },
        { line: 2, token: `${P}verifier` },
        { line: 3, token: `${P}plan-objective/SKILL.md` },
      ]);
    });

    test('10b: live conventions and look-alikes in scope are no finding', () => {
      const text = [
        `.${P}worktrees/<repo>/<id>`,
        'df/ws-auth',
        'df/exec-79-07-claude-md',
        `${P}quick-abc`,
        `${P}*`,
        `legacy-${P}install`,
      ].join('\n');
      assert.deepEqual(scanText(text, IN_SCOPE), []);
    });

    test('10c: tests, fixtures and ignore regions are out of scope; the live guide outside a region is not', () => {
      const line = `${P}planner`;
      assert.deepEqual(scanText(line, 'plugins/aoforge/aoforge/bin/lib/x.test.cjs'), []);
      assert.deepEqual(scanText(line, 'plugins/aoforge/skills/x/__fixtures__/y.md'), []);
      const guide = [`<!-- ${IGNORE_START} -->`, line, `<!-- ${IGNORE_END} -->`].join('\n');
      assert.deepEqual(scanText(guide, 'docs/USER-GUIDE.md'), []);
      assert.deepEqual(
        scanText(`${guide}\n${line}`, 'docs/USER-GUIDE.md').map((f) => f.line),
        [4],
      );
    });

    test('10d: scanRepo finds the name only in the user-facing files of a scratch repo', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-guard-install-'));
      try {
        const git = (...args) => {
          const r = spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
          assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
        };
        git('init', '-q');
        const files = [
          'CHANGELOG.md',
          'docs/x.md',
          `${NAMES.planningDir}/x.md`,
          'plugins/aoforge/aoforge/bin/lib/a.test.cjs',
          'plugins/aoforge/aoforge/references/a.md',
          'site/content/a.md',
        ];
        for (const rel of files) {
          fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
          fs.writeFileSync(path.join(tmp, rel), `A ${P}planner note.\n`);
        }
        git('add', '--', ...files);
        assert.deepEqual(
          scanRepo(tmp, { allow: [] }).map((f) => `${f.file}:${f.line}`),
          ['plugins/aoforge/aoforge/references/a.md:1', 'site/content/a.md:1'],
        );
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('10e: the names come from the tree and the pattern from LEGACY.installPrefix', () => {
      const names = agentAndSkillNames();
      const root = path.join(REPO_ROOT, 'plugins', 'aoforge');
      const agents = fs.readdirSync(path.join(root, 'agents')).filter((f) => f.endsWith('.md'));
      const skills = fs
        .readdirSync(path.join(root, 'skills'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const f of agents) assert.ok(names.includes(f.slice(0, -'.md'.length)), `agent ${f} is in the name list`);
      for (const d of skills) assert.ok(names.includes(d), `skill ${d} is in the name list`);
      assert.ok(names.length >= 40, `expected >= 40 names, got ${names.length}`);
      for (const n of ['planner', 'job-checker', 'plan-objective', 'objective']) assert.ok(names.includes(n), n);
      const t = TOKENS.find((x) => x.id === 'installName');
      assert.ok(t && typeof t.scope === 'function', 'a scoped installName token');
      assert.ok(t.re.source.startsWith(`(?<![A-Za-z0-9_])${esc(LEGACY.installPrefix)}`), t.re.source);
    });
  });
});
