'use strict';

// adopt-e2e-assert.cjs — structural E2E checker for the deterministic `/aoforge:adopt` pipeline
// (objective 37, TRD 08, ADP-06 part). NOT adopt-fixtures.cjs (that stays 37-01-owned) — this is
// the reusable assertion helper that 37-11/12/13's simulated agent runs also spawn.
//
// CLI:
//   check <root> --home <home> [--df <aof-tools path>] [--mode adopt|migrate]
//       -> {ok, checks:[{id, ok, detail}, ...]} on stdout; exit 0 iff every check is ok.
//          `adopt` (the default) checks a brownfield adopt; `migrate` checks the move of a pre-rename project
//          (objective 80); any other mode is a usage error.
//   snapshot <root> --out <file>
//       -> writes a content-hash snapshot of <root> (git-tree-agnostic) to <file>; exit 0.
//   compare <root> --before <file>
//       -> {ok, changed:[...]} on stdout; exit 0 iff unchanged (changed is empty), else exit 1.
//   (no args, or an unrecognized subcommand such as --help)
//       -> usage on stderr, exit 1, touches nothing.
//
// Library: runChecks({root, home, df, mode = 'adopt'}) -> {ok, checks}
//
// `adopt` mode runs the brownfield checks (branch_is_adopt, one_commit, tree_clean, not_pushed, health_no_errors,
// stack_valid, roadmap_zero_objectives, claude_block_versioned, stamp_current, report_needs_review,
// project_kind_valid, commit_contents, no_secrets). `migrate` mode runs the four shared checks (on_adopt_branch,
// one_commit, tree_clean, not_pushed) and four of its own: no_legacy_layout, history_kept, report_lists_migration,
// stamp_current. It finds leftovers through legacy-migrate's plan and planning-layout's finding codes and reads the
// stamp keys from legacy-names, so no pre-rename spelling appears in this file.
//
// Never touches a real repository — every git/aof-tools call runs against the `root` and `home`
// the caller supplies, with HOME replaced (`gitEnv`, reused from upgrade-fixtures.cjs) so nothing
// here can read or write the real ~/.claude.

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const adopt = require('../adopt.cjs');
const legacyMigrate = require('../legacy-migrate.cjs');
const planningLayout = require('../planning-layout.cjs');
const { NAMES, LEGACY } = require('../legacy-names.cjs');
const managedBlock = require('../managed-block.cjs');
const stackProfile = require('../stack-profile.cjs');
const upgrade = require('../upgrade.cjs');
const helpers = require('../helpers.cjs');
const { extractFrontmatter } = require('../frontmatter.cjs');
const { VALID_KINDS, VALID_WORKS } = require('../intent.cjs');
const { snapshot: hashSnapshot, diffSnapshots, gitEnv } = require('./upgrade-fixtures.cjs');

const DEFAULT_DF = path.join(__dirname, '..', '..', 'aof-tools.cjs');

const MODES = ['adopt', 'migrate'];

const CODEBASE_DOC_NAMES = [
  'STACK', 'INTEGRATIONS', 'ARCHITECTURE', 'STRUCTURE',
  'CONVENTIONS', 'TESTING', 'PATTERNS', 'CONCERNS',
];

// Verbatim from workflows/map-codebase.md:304 (adopt.cjs's own SECRET_PATTERNS, duplicated here
// deliberately — this checker must stand alone, with no coupling to adopt.cjs internals beyond
// its public exports).
const SECRET_PATTERNS = [
  { kind: 'openai-key', re: /sk-[a-zA-Z0-9]{20,}/g },
  { kind: 'stripe-live', re: /sk_live_[a-zA-Z0-9]+/g },
  { kind: 'stripe-test', re: /sk_test_[a-zA-Z0-9]+/g },
  { kind: 'github-pat', re: /ghp_[a-zA-Z0-9]{36}/g },
  { kind: 'github-oauth', re: /gho_[a-zA-Z0-9]{36}/g },
  { kind: 'gitlab-pat', re: /glpat-[a-zA-Z0-9_-]+/g },
  { kind: 'aws-access-key', re: /AKIA[A-Z0-9]{16}/g },
  { kind: 'slack-token', re: /xox[baprs]-[a-zA-Z0-9-]+/g },
  { kind: 'private-key', re: /-----BEGIN.*PRIVATE KEY/g },
  { kind: 'jwt', re: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\./g },
];

// ─── git plumbing (mirrors adopt.cjs's own — never a shell string) ─────────

function git(root, env, args) {
  try {
    const out = execFileSync('git', ['-C', root, ...args], {
      env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e && typeof e.stdout === 'string') ? e.stdout : '' };
  }
}

function runDf(dfPath, args, root, home) {
  const r = spawnSync(process.execPath, [dfPath, '--cwd', root, ...args], {
    cwd: root, encoding: 'utf-8', timeout: 30000, env: gitEnv(home),
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* left null on parse failure */ }
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', json };
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

function scanForSecrets(label, text, hits) {
  if (text === null) return;
  for (const { kind, re } of SECRET_PATTERNS) {
    const rx = new RegExp(re.source, 'g');
    if (rx.test(text)) hits.push(`${label}:${kind}`);
  }
}

// ─── migrate mode (objective 80) ───────────────────────────────────────────

/** Finding codes of `validate health` at `dir` (errors, warnings and info), or null when it printed no JSON. */
function healthCodes(dfPath, dir, home) {
  const health = runDf(dfPath, ['validate', 'health', '--raw'], dir, home);
  if (!health.json) return null;
  return ['errors', 'warnings', 'info']
    .flatMap((k) => (Array.isArray(health.json[k]) ? health.json[k] : []))
    .map((f) => f.code);
}

/** The text of the `## <heading>` section of a report, or null when the heading is absent. */
function reportSection(text, heading) {
  const start = text.indexOf(`\n${heading}\n`);
  if (start === -1) return null;
  const rest = text.slice(start + 1);
  const next = rest.indexOf('\n## ', heading.length);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * The four checks only a migrate adopt has (after the shared four): no pre-rename layout left, history followed the
 * move, the report lists the migration, and the stamp key is current. `marker` is the adopt marker (or null).
 */
function migrateChecks({ root, home, dfPath, env, marker, add }) {
  // no_legacy_layout — the migrator finds nothing to do or refuse, and validate health reports no layout code at any
  // planning root (the codes are planning-layout's own, so no spelling of the old names is needed here).
  const plan = legacyMigrate.planMigration(root, { env });
  const refusal = legacyMigrate.refusalFor(plan);
  const layoutCodes = new Set([planningLayout.CODE, planningLayout.CONFIG_CODE, planningLayout.CLAUDE_MD_CODE]);
  const left = [];
  for (const dir of plan.roots.length > 0 ? plan.roots : ['']) {
    const codes = healthCodes(dfPath, dir ? path.join(root, dir) : root, home);
    if (codes === null) left.push(`${dir || '.'}: validate health printed no JSON`);
    else for (const code of codes.filter((c) => layoutCodes.has(c))) left.push(`${dir || '.'}: ${code}`);
  }
  const layoutOk = !plan.applies && refusal === null && left.length === 0;
  add('no_legacy_layout', layoutOk,
    layoutOk ? `planMigration applies false at ${plan.roots.length} root(s); no ${[...layoutCodes].join('/')} finding`
      : `applies=${plan.applies} refusal=${refusal ? refusal.reason : 'none'} moves=${plan.moves.length} findings: ${left.join(', ') || 'none'}`);

  // history_kept — for every tracked tree the marker recorded as moved, one renamed file's `git log --follow` goes
  // back past the adopt commit (an untracked tree has no history to follow).
  const moves = marker && marker.plan && Array.isArray(marker.plan.moves) ? marker.plan.moves : [];
  const tracked = moves.filter((m) => m.tracked);
  let historyOk = true;
  let historyDetail;
  if (!marker || !marker.base_sha) {
    historyOk = false;
    historyDetail = 'no adopt marker (or missing base_sha) found';
  } else if (tracked.length === 0) {
    historyDetail = 'no tracked planning tree was moved';
  } else {
    const diff = git(root, env, ['diff', '--find-renames', '--name-status', marker.base_sha, adopt.ADOPT_BRANCH]);
    const renamed = diff.ok
      ? diff.out.split('\n').filter((l) => /^R\d*\t/.test(l)).map((l) => l.split('\t')[2])
      : [];
    const notes = [];
    for (const mv of tracked) {
      const file = renamed.find((f) => f.startsWith(`${mv.to}/`));
      if (!file) {
        historyOk = false;
        notes.push(`${mv.to}: no renamed file in the adopt commit`);
        continue;
      }
      const log = git(root, env, ['log', '--follow', '--format=%H', adopt.ADOPT_BRANCH, '--', file]);
      const n = log.ok ? log.out.split('\n').filter(Boolean).length : 0;
      if (n < 2) historyOk = false;
      notes.push(`${file}: ${n} commit(s)`);
    }
    historyDetail = notes.join('; ');
  }
  add('history_kept', historyOk, historyDetail);

  // report_lists_migration — ADOPT-REPORT.md (at the marker's report path) has `## Migration`, and the section has a
  // row for every planning tree the marker recorded as moved.
  const reportRel = marker && marker.report_path;
  const reportText = reportRel ? safeRead(path.join(root, reportRel)) : null;
  let reportOk = false;
  let reportDetail;
  if (!reportRel) {
    reportDetail = 'no adopt marker (or missing report_path) found';
  } else if (reportText === null) {
    reportDetail = `${reportRel} not found`;
  } else {
    const migration = reportSection(reportText, '## Migration');
    if (migration === null) {
      reportDetail = `${reportRel} has no "## Migration" section`;
    } else {
      const missing = moves.filter((m) => !migration.includes(m.to)).map((m) => m.to);
      reportOk = missing.length === 0;
      reportDetail = reportOk ? `${reportRel}: ## Migration lists ${moves.length} moved tree(s)`
        : `${reportRel}: no row for ${missing.join(', ')}`;
    }
  }
  add('report_lists_migration', reportOk, reportDetail);

  // stamp_current — no planning root's config.json still carries the old stamp key, and one the migration converted
  // carries the new key. (A config with neither is unstamped, which the next upgrade fixes; it is not a leftover.)
  const record = marker && marker.migration && Array.isArray(marker.migration.stamps) ? marker.migration.stamps : [];
  const converted = new Set(record.filter((s) => s.action).map((s) => s.file));
  const stampProblems = [];
  let stampsSeen = 0;
  for (const dir of plan.roots) {
    const rel = [dir, NAMES.planningDir, 'config.json'].filter(Boolean).join('/');
    const text = safeRead(path.join(root, rel));
    if (text === null) continue;
    stampsSeen += 1;
    let cfg;
    try { cfg = JSON.parse(text); } catch { stampProblems.push(`${rel}: not valid JSON`); continue; }
    const holds = (key) => !!cfg && typeof cfg === 'object' && Object.prototype.hasOwnProperty.call(cfg, key);
    if (holds(LEGACY.configKey)) stampProblems.push(`${rel}: still has the "${LEGACY.configKey}" key`);
    if (converted.has(rel) && !holds(NAMES.configKey)) stampProblems.push(`${rel}: converted but has no "${NAMES.configKey}" key`);
  }
  add('stamp_current', stampProblems.length === 0,
    stampProblems.length === 0 ? `${stampsSeen} config.json file(s): "${NAMES.configKey}" key, no "${LEGACY.configKey}" key`
      : stampProblems.join('; '));
}

// ─── runChecks({root, home, df, mode}) -> {ok, checks} ─────────────────────

function runChecks({ root, home, df, mode = 'adopt' }) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode ${JSON.stringify(mode)} (expected ${MODES.join(' or ')})`);
  const dfPath = df || DEFAULT_DF;
  const env = gitEnv(home);
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });

  // branch_is_adopt (migrate mode: on_adopt_branch)
  const branchRes = git(root, env, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchRes.ok ? branchRes.out.trim() : null;
  add(mode === 'migrate' ? 'on_adopt_branch' : 'branch_is_adopt', branch === adopt.ADOPT_BRANCH,
    `HEAD branch: ${branch || '(git error)'}`);

  const { marker } = adopt.readMarker(root, env);

  // one_commit — git rev-list --count <marker.base_sha>..aoforge/adopt === 1
  if (marker && marker.base_sha) {
    const cnt = git(root, env, ['rev-list', '--count', `${marker.base_sha}..${adopt.ADOPT_BRANCH}`]);
    const n = cnt.ok ? parseInt(cnt.out.trim(), 10) : NaN;
    add('one_commit', n === 1, `commit count since base_sha: ${cnt.ok ? cnt.out.trim() : '(git error)'}`);
  } else {
    add('one_commit', false, 'no adopt marker (or missing base_sha) found');
  }

  // tree_clean
  const status = git(root, env, ['status', '--porcelain']);
  const clean = status.ok && status.out.trim() === '';
  add('tree_clean', clean, clean ? 'clean' : `dirty:\n${status.out.trim()}`);

  // not_pushed — no upstream on aoforge/adopt, and no remote ref contains HEAD
  const upstream = git(root, env, ['rev-parse', '--abbrev-ref', `${adopt.ADOPT_BRANCH}@{upstream}`]);
  const remoteContains = git(root, env, ['branch', '-r', '--contains', 'HEAD']);
  const notPushed = !upstream.ok && (!remoteContains.ok || remoteContains.out.trim() === '');
  add('not_pushed', notPushed,
    notPushed ? 'no upstream; no remote branch contains HEAD'
      : `upstream=${upstream.ok ? upstream.out.trim() : '(none)'} remote-contains=${remoteContains.out.trim()}`);

  if (mode === 'migrate') {
    migrateChecks({ root, home, dfPath, env, marker, add });
    return { ok: checks.every((c) => c.ok), checks };
  }

  // health_no_errors
  const health = runDf(dfPath, ['validate', 'health', '--raw'], root, home);
  const healthErrors = health.json && Array.isArray(health.json.errors) ? health.json.errors : null;
  add('health_no_errors', !!health.json && healthErrors !== null && healthErrors.length === 0,
    health.json ? `errors: ${JSON.stringify(healthErrors)}` : `validate health returned no JSON: ${health.stdout || health.stderr}`);

  // stack_valid
  let stackValid;
  try {
    stackValid = stackProfile.validateProfile({ projectRoot: root, userHome: home });
  } catch (e) {
    stackValid = { ok: false, errors: [e.message] };
  }
  add('stack_valid', !!(stackValid && stackValid.ok),
    stackValid && stackValid.ok ? 'ok' : `errors: ${JSON.stringify(stackValid && stackValid.errors)}`);

  // roadmap_zero_objectives
  const objectivesDir = path.join(root, '.aoforge', 'objectives');
  let objCount = 0;
  try { objCount = fs.readdirSync(objectivesDir).length; } catch { objCount = 0; }
  add('roadmap_zero_objectives', objCount === 0, `${objCount} entries under .aoforge/objectives`);

  // claude_block_versioned — exactly one AOFORGE block, and it carries a version
  const claudePath = path.join(root, 'CLAUDE.md');
  const claudeText = safeRead(claudePath) || '';
  let block = null;
  let blockError = null;
  try {
    block = managedBlock.read(claudeText);
  } catch (e) {
    blockError = e.message;
  }
  let claudeVersioned = false;
  let claudeDetail;
  if (blockError) {
    claudeDetail = blockError; // e.g. "multiple AOFORGE blocks (...); refusing to edit"
  } else if (!block) {
    claudeDetail = 'no AOFORGE block found in CLAUDE.md';
  } else if (block.meta.legacy || !block.meta.v) {
    claudeDetail = 'AOFORGE block has no version (legacy marker)';
  } else {
    claudeVersioned = true;
    claudeDetail = `v=${block.meta.v} src=${block.meta.src}`;
  }
  add('claude_block_versioned', claudeVersioned, claudeDetail);

  // stamp_current
  const stamp = upgrade.readStamp(root);
  const currentVersion = helpers.pluginVersion();
  add('stamp_current', !!stamp && stamp.version === currentVersion,
    stamp ? `stamp version ${stamp.version}, expected ${currentVersion}` : 'no aoforge stamp in .aoforge/config.json');

  // report_needs_review — heading present + every low/medium marker.inferences field appears
  const reportPath = path.join(root, '.aoforge', 'ADOPT-REPORT.md');
  const reportText = safeRead(reportPath);
  let needsReviewOk = false;
  let needsReviewDetail;
  if (reportText === null) {
    needsReviewDetail = '.aoforge/ADOPT-REPORT.md not found';
  } else {
    const headingIdx = reportText.indexOf('## Needs review');
    if (headingIdx === -1) {
      needsReviewDetail = 'missing "## Needs review" heading';
    } else {
      const nextHeadingIdx = reportText.indexOf('\n## ', headingIdx + 1);
      const section = nextHeadingIdx === -1 ? reportText.slice(headingIdx) : reportText.slice(headingIdx, nextHeadingIdx);
      const fields = (marker && Array.isArray(marker.inferences) ? marker.inferences : [])
        .filter((i) => i && (i.confidence === 'low' || i.confidence === 'medium'))
        .map((i) => i.field);
      const missing = fields.filter((f) => !section.includes(f));
      needsReviewOk = missing.length === 0;
      needsReviewDetail = needsReviewOk
        ? `heading present; ${fields.length} low/medium field(s) accounted for`
        : `fields missing from "## Needs review" section: ${missing.join(', ')}`;
    }
  }
  add('report_needs_review', needsReviewOk, needsReviewDetail);

  // project_kind_valid
  const pmPath = path.join(root, '.aoforge', 'PROJECT.md');
  const pmText = safeRead(pmPath);
  let kindOk = false;
  let kindDetail = '.aoforge/PROJECT.md not found';
  if (pmText !== null) {
    const fm = extractFrontmatter(pmText);
    const kindValid = VALID_KINDS.includes(fm.kind);
    const workValid = VALID_WORKS.includes(fm.default_work);
    kindOk = kindValid && workValid;
    kindDetail = `kind=${JSON.stringify(fm.kind)} default_work=${JSON.stringify(fm.default_work)}`;
  }
  add('project_kind_valid', kindOk, kindDetail);

  // commit_contents — the one commit touches only .aoforge/** + CLAUDE.md
  let commitOk = false;
  let commitDetail = 'no marker/base_sha';
  if (marker && marker.base_sha) {
    const diff = git(root, env, ['diff', '--name-only', marker.base_sha, adopt.ADOPT_BRANCH]);
    if (diff.ok) {
      const files = diff.out.split('\n').map((l) => l.trim()).filter(Boolean);
      const bad = files.filter((f) => !(f === 'CLAUDE.md' || f.startsWith('.aoforge/')));
      commitOk = files.length > 0 && bad.length === 0;
      commitDetail = commitOk
        ? `${files.length} file(s), all under .aoforge/ or CLAUDE.md`
        : `files outside .aoforge/**+CLAUDE.md: ${bad.join(', ')}`;
    } else {
      commitDetail = 'git diff failed';
    }
  }
  add('commit_contents', commitOk, commitDetail);

  // no_secrets — the redaction-owned surface only: codebase docs, PROJECT.md, ADOPT-REPORT.md,
  // and the CLAUDE.md AOFORGE block content (never the whole file — text outside the block is
  // deliberately left untouched by adopt report, so it is not part of this contract).
  const secretHits = [];
  scanForSecrets('.aoforge/ADOPT-REPORT.md', reportText, secretHits);
  scanForSecrets('.aoforge/PROJECT.md', pmText, secretHits);
  for (const name of CODEBASE_DOC_NAMES) {
    const rel = `.aoforge/codebase/${name}.md`;
    scanForSecrets(rel, safeRead(path.join(root, rel)), secretHits);
  }
  const blockContent = block && !blockError ? block.content : '';
  scanForSecrets('CLAUDE.md (AOFORGE block)', blockContent, secretHits);
  add('no_secrets', secretHits.length === 0, secretHits.length === 0 ? 'clean' : `matches: ${secretHits.join(', ')}`);

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = args[i + 1];
      i += 1;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function usage() {
  process.stderr.write(
    'Usage: adopt-e2e-assert.cjs check <root> --home <home> [--df <aof-tools path>] [--mode adopt|migrate]\n' +
    '       adopt-e2e-assert.cjs snapshot <root> --out <file>\n' +
    '       adopt-e2e-assert.cjs compare <root> --before <file>\n'
  );
}

function cmdCheck(args) {
  const { flags, positional } = parseArgs(args);
  const root = positional[0];
  if (!root || !flags.home) { usage(); process.exitCode = 1; return; }
  const mode = flags.mode === undefined ? 'adopt' : flags.mode;
  if (!MODES.includes(mode)) { usage(); process.exitCode = 1; return; }
  const result = runChecks({
    root: path.resolve(root),
    home: path.resolve(flags.home),
    df: flags.df ? path.resolve(flags.df) : DEFAULT_DF,
    mode,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.ok ? 0 : 1;
}

function cmdSnapshot(args) {
  const { flags, positional } = parseArgs(args);
  const root = positional[0];
  if (!root || !flags.out) { usage(); process.exitCode = 1; return; }
  const outPath = path.resolve(flags.out);
  const snap = hashSnapshot(path.resolve(root));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snap), 'utf-8');
  process.stdout.write(JSON.stringify({ ok: true, out: outPath }) + '\n');
  process.exitCode = 0;
}

function cmdCompare(args) {
  const { flags, positional } = parseArgs(args);
  const root = positional[0];
  if (!root || !flags.before) { usage(); process.exitCode = 1; return; }
  const before = JSON.parse(fs.readFileSync(path.resolve(flags.before), 'utf-8'));
  const after = hashSnapshot(path.resolve(root));
  const changed = diffSnapshots(before, after);
  const result = { ok: changed.length === 0, changed };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.ok ? 0 : 1;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'check') return cmdCheck(rest);
  if (cmd === 'snapshot') return cmdSnapshot(rest);
  if (cmd === 'compare') return cmdCompare(rest);
  usage();
  process.exitCode = 1;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { runChecks, main };
