'use strict';

// adopt-skill-contract.test.cjs (objective 37, TRD 09, ADP-04/ADP-05)
//
// Executable assertions over FOUR PROSE FILES that make up the unattended `/aoforge:adopt`
// pipeline. The skill and the workflow are not unit-testable behaviour on their own, but the
// CONTRACT they must satisfy is — routing, ordering, the never-ask guarantee, and the two small
// edits map-codebase and new-project need. Structure and path-resolution convention copied from
// `ui-spec-skill-contract.test.cjs` (34-08).
//
// Test list (outermost — the skill a user types — first):
//
//  1. SKILL.md frontmatter parses; `name === 'adopt'`; description contains `Triggers on:` and
//     the three trigger phrases; `argument-hint` is `[path]`.
//  2. allowed-tools contains Read, Bash, Write, Task and does not contain AskUserQuestion; no
//     `disable-model-invocation: true`.
//  3. The body references `@~/.claude/aoforge/workflows/adopt.md`, and
//     `plugins/aoforge/aoforge/workflows/adopt.md` exists with frontmatter `status: active`.
//  4. Step order in adopt.md: the first index of each marker is strictly increasing —
//     `adopt preflight`, `adopt begin`, `skill-active --start adopt`, `non-interactive`,
//     `.adopt-inferences.json`, `adopt scaffold`, `validate health`, `adopt report`,
//     `skill-active --end`, ` commit `.
//  5. Every line in adopt.md containing `aof-tools.cjs` also contains `--cwd "$TARGET"`.
//  6. Forbidden strings absent from adopt.md: `git push`, `git stash`, `git reset`,
//     `--no-verify`, `--no-gpg-sign`, `8080`. `AskUserQuestion` occurs exactly once, on a line
//     that also contains `Never`.
//  7. Route coverage: adopt.md mentions each route value `refuse`, `new-project`, `upgrade`,
//     `resume`, `adopt`, and the upgrade route mentions `upgrade --check`, `upgrade --apply` and
//     `changed_files`.
//  8. The kind rubric lists exactly intent.cjs `VALID_KINDS` (require it) and the confidence
//     words `high`, `medium`, `low`.
//  9. PROJECT.md section list in adopt.md: `## What This Is`, `## Core Value`,
//     `## Requirements`, `### Validated`, `### Active`, `### Out of Scope`, `## Constraints`.
// 10. map-codebase.md has a `<non_interactive_mode>` block naming `check_existing`,
//     `draft_stack_profile`, `scan_for_secrets`, `commit_codebase_map`, `offer_next`, and the
//     phrase `never delete`.
// 11. skills/map-codebase/SKILL.md argument-hint contains `--non-interactive`.
// 12. new-project.md's `## 2. Brownfield Offer` section mentions `/aoforge:adopt`; the file
//     contains `upgrade --register`.
// 13. (TRD 42-09) adopt.md step order: `scaffold` -> `confirm_stack_profile` -> `health`, and
//     `scaffold` hands off to `confirm_stack_profile`, which hands off to `health`.
//
// The migrate path (TRD 80-05; a pre-rename project moves onto `.aoforge/` as one recorded change):
//
// 14. Route coverage: adopt.md mentions `migrate` as a route value, the `migrate` `resume` steps
//     (`moved`, `scaffolded`, `reported`) and the refusal reasons `both-planning-dirs`,
//     `legacy-block-malformed` and `move-failed`.
// 15. Migrate path skips: the `begin` step says the migrate path does not run
//     `skill-active --start`; `map`, `infer_project` and `confirm_stack_profile` each say
//     "Skip on the migrate path"; the `health` step says the same and names `--repair` as never run.
// 16. Migrate stop: the `report` step names `commit_blocked`, says to skip `commit` and stop.
//     The `commit` step covers a re-run after the commit (`nothing_to_commit` goes on to `summary`).
// 17. Migrate summary: the `summary` step names `report_path`, `git merge aoforge/adopt`,
//     "Nothing was pushed" and `upgrade --check`.
// 18. SKILL.md: description and `<objective>` mention "pre-rename"; neither contains a legacy
//     spelling (built from LEGACY: planningDir, configKey, blockTag, slug).
// 19. Fresh-path invariance: every `aof-tools.cjs` command the workflow had before this TRD
//     (a fixed list) still appears, in the same relative order.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { LEGACY } = require('./legacy-names.cjs');

// ─── Paths ──────────────────────────────────────────────────────────────────
// __dirname = plugins/aoforge/aoforge/bin/lib
const AOFORGE_ROOT = path.join(__dirname, '..', '..');       // plugins/aoforge/aoforge
const PLUGINS_ROOT = path.join(AOFORGE_ROOT, '..', '..');    // plugins/

const SKILL_MD = path.join(PLUGINS_ROOT, 'aoforge', 'skills', 'adopt', 'SKILL.md');
const ADOPT_WORKFLOW = path.join(AOFORGE_ROOT, 'workflows', 'adopt.md');
const MAP_CODEBASE_WORKFLOW = path.join(AOFORGE_ROOT, 'workflows', 'map-codebase.md');
const MAP_CODEBASE_SKILL = path.join(PLUGINS_ROOT, 'aoforge', 'skills', 'map-codebase', 'SKILL.md');
const NEW_PROJECT_WORKFLOW = path.join(AOFORGE_ROOT, 'workflows', 'new-project.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf-8');
}

/** The YAML frontmatter body (between the two `---` fences) of a markdown file's text. */
function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, 'file must have YAML frontmatter delimited by --- fences');
  return m[1];
}

/** A single scalar `key: value` line from a frontmatter body. */
function fmField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

/** A YAML list under `key:` (one `- item` per line). */
function fmList(fm, key) {
  const re = new RegExp(`^${key}:\\s*\\n((?:\\s*-\\s*.+\\n?)+)`, 'm');
  const m = fm.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/-\s*(.+)/g)].map((x) => x[1].trim());
}

// ═══════════════════════════════════════════════════════════════════════════
// 1-9: skills/adopt/SKILL.md + workflows/adopt.md
// ═══════════════════════════════════════════════════════════════════════════

test('1 - SKILL.md frontmatter: name, Triggers on:, three trigger phrases, argument-hint', () => {
  const fm = frontmatter(readFile(SKILL_MD));
  assert.strictEqual(fmField(fm, 'name'), 'adopt');
  assert.match(fm, /Triggers on:/);
  assert.match(fm, /adopt this repo/);
  assert.match(fm, /set up aoforge here/);
  assert.match(fm, /bootstrap this repo/);
  assert.strictEqual(fmField(fm, 'argument-hint'), '"[path]"');
});

test('2 - allowed-tools includes Read/Bash/Write/Task, excludes AskUserQuestion; no disable-model-invocation', () => {
  const fm = frontmatter(readFile(SKILL_MD));
  const tools = fmList(fm, 'allowed-tools');
  for (const t of ['Read', 'Bash', 'Write', 'Task']) {
    assert.ok(tools.includes(t), `allowed-tools must include ${t}; got ${JSON.stringify(tools)}`);
  }
  assert.ok(!tools.includes('AskUserQuestion'), 'allowed-tools must NOT include AskUserQuestion');
  assert.doesNotMatch(fm, /disable-model-invocation:\s*true/, 'must not carry disable-model-invocation: true');
});

test('3 - SKILL.md references workflows/adopt.md; adopt.md exists with status: active', () => {
  const skillMd = readFile(SKILL_MD);
  assert.match(skillMd, /@~\/\.claude\/aoforge\/workflows\/adopt\.md/);
  assert.ok(fs.existsSync(ADOPT_WORKFLOW), 'plugins/aoforge/aoforge/workflows/adopt.md must exist');
  const fm = frontmatter(readFile(ADOPT_WORKFLOW));
  assert.strictEqual(fmField(fm, 'status'), 'active');
});

const STEP_MARKERS = [
  'adopt preflight',
  'adopt begin',
  'skill-active --start adopt',
  'non-interactive',
  '.adopt-inferences.json',
  'adopt scaffold',
  'validate health',
  'adopt report',
  'skill-active --end',
  ' commit ',
];

test('4 - adopt.md step order: marker first-index strictly increasing', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  const found = STEP_MARKERS.map((m) => ({ m, i: wf.indexOf(m) }));
  for (const { m, i } of found) assert.ok(i !== -1, `marker not found in adopt.md: ${JSON.stringify(m)}`);
  for (let k = 1; k < found.length; k++) {
    assert.ok(
      found[k].i > found[k - 1].i,
      `expected ${JSON.stringify(found[k].m)} (first at ${found[k].i}) to come after `
      + `${JSON.stringify(found[k - 1].m)} (first at ${found[k - 1].i})`,
    );
  }
});

test('5 - every aof-tools.cjs line in adopt.md carries --cwd "$TARGET"', () => {
  const lines = readFile(ADOPT_WORKFLOW).split('\n').filter((l) => l.includes('aof-tools.cjs'));
  assert.ok(lines.length > 0, 'adopt.md must contain aof-tools.cjs invocations — nothing to check otherwise');
  for (const l of lines) {
    assert.ok(l.includes('--cwd "$TARGET"'), `line missing --cwd "$TARGET": ${l}`);
  }
});

test('6 - forbidden strings absent; AskUserQuestion occurs exactly once, on a line with Never', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  for (const bad of ['git push', 'git stash', 'git reset', '--no-verify', '--no-gpg-sign', '8080']) {
    assert.ok(!wf.includes(bad), `forbidden string present in adopt.md: ${JSON.stringify(bad)}`);
  }
  const occurrences = [...wf.matchAll(/AskUserQuestion/g)];
  assert.strictEqual(occurrences.length, 1, `AskUserQuestion must occur exactly once; found ${occurrences.length}`);
  const line = wf.split('\n').find((l) => l.includes('AskUserQuestion'));
  assert.ok(line && line.includes('Never'), `the AskUserQuestion line must also contain "Never"; line was: ${line}`);
});

test('7 - route coverage: refuse/new-project/upgrade/resume/adopt + upgrade route mechanics', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  for (const r of ['refuse', 'new-project', 'upgrade', 'resume', 'adopt']) {
    assert.ok(wf.includes(r), `adopt.md must mention route value: ${r}`);
  }
  assert.match(wf, /upgrade --check/);
  assert.match(wf, /upgrade --apply/);
  assert.match(wf, /changed_files/);
});

test('8 - kind rubric lists exactly intent.cjs VALID_KINDS (in order); confidence words present', () => {
  const { VALID_KINDS } = require('./intent.cjs');
  const wf = readFile(ADOPT_WORKFLOW);
  const rubricKinds = [...wf.matchAll(/^- `([a-z-]+)` /gm)]
    .map((m) => m[1])
    .filter((k) => VALID_KINDS.includes(k));
  assert.deepStrictEqual(
    rubricKinds, VALID_KINDS,
    `kind rubric must list exactly ${JSON.stringify(VALID_KINDS)} in order; got ${JSON.stringify(rubricKinds)}`,
  );
  for (const w of ['high', 'medium', 'low']) {
    assert.match(wf, new RegExp(`\\b${w}\\b`), `confidence word missing: ${w}`);
  }
});

test('9 - PROJECT.md section list present in adopt.md', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  for (const h of ['## What This Is', '## Core Value', '## Requirements', '### Validated', '### Active', '### Out of Scope', '## Constraints']) {
    assert.ok(wf.includes(h), `adopt.md must name PROJECT.md section: ${h}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 10-12: map-codebase.md, map-codebase/SKILL.md, new-project.md
// ═══════════════════════════════════════════════════════════════════════════

test('10 - map-codebase.md has a <non_interactive_mode> block naming the five affected steps', () => {
  const md = readFile(MAP_CODEBASE_WORKFLOW);
  assert.match(md, /<non_interactive_mode>/, 'must have a <non_interactive_mode> section');
  for (const step of ['check_existing', 'draft_stack_profile', 'scan_for_secrets', 'commit_codebase_map', 'offer_next']) {
    assert.match(md, new RegExp(step), `<non_interactive_mode> block must name step: ${step}`);
  }
  assert.match(md, /never delete/, 'must state the never-delete guarantee for check_existing');
});

test('11 - map-codebase/SKILL.md argument-hint mentions --non-interactive', () => {
  const fm = frontmatter(readFile(MAP_CODEBASE_SKILL));
  const hint = fmField(fm, 'argument-hint');
  assert.ok(hint && hint.includes('--non-interactive'), `argument-hint must mention --non-interactive; got ${hint}`);
});

test('12 - new-project.md Brownfield Offer mentions /aoforge:adopt; file has upgrade --register', () => {
  const md = readFile(NEW_PROJECT_WORKFLOW);
  const start = md.indexOf('## 2. Brownfield Offer');
  assert.ok(start !== -1, 'new-project.md must have a "## 2. Brownfield Offer" section');
  const nextHeading = md.indexOf('\n## ', start + 1);
  const section = md.slice(start, nextHeading === -1 ? md.length : nextHeading);
  assert.match(section, /\/aoforge:adopt/, 'Brownfield Offer must mention /aoforge:adopt');
  assert.match(md, /upgrade --register/, 'new-project.md must call aof-tools upgrade --register');
});

test('13 - adopt.md: scaffold -> confirm_stack_profile -> health, each handing off to the next', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  const idx = (name) => wf.indexOf(`<step name="${name}">`);
  const order = ['scaffold', 'confirm_stack_profile', 'health'].map((n) => ({ n, i: idx(n) }));
  for (const { n, i } of order) assert.ok(i !== -1, `adopt.md must have a <step name="${n}"> step`);
  for (let k = 1; k < order.length; k++) {
    assert.ok(order[k].i > order[k - 1].i, `expected step ${order[k].n} after ${order[k - 1].n}`);
  }
  const body = (name) => wf.slice(idx(name), wf.indexOf('</step>', idx(name)));
  assert.match(body('scaffold'), /Continue to `confirm_stack_profile`/);
  assert.match(body('confirm_stack_profile'), /Continue to `health`/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 14-19: the migrate path (TRD 80-05)
// ═══════════════════════════════════════════════════════════════════════════

/** The text of one `<step name="...">` block of a workflow. */
function stepBody(wf, name) {
  const start = wf.indexOf(`<step name="${name}">`);
  assert.ok(start !== -1, `adopt.md must have a <step name="${name}"> step`);
  const end = wf.indexOf('</step>', start);
  assert.ok(end !== -1, `step ${name} must be closed`);
  return wf.slice(start, end);
}

test('14 - route coverage: migrate route, its resume steps and the three migrate refusals', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  const pre = stepBody(wf, 'preflight');
  assert.match(pre, /\*\*`migrate`\*\*/, 'preflight must list the `migrate` route as a route bullet');
  assert.match(pre, /`migration`/, 'the migrate route must name the `migration` list preflight returns');
  assert.match(pre, /`adopt\.mode`/, 'resume must name `adopt.mode`');
  for (const s of ['moved', 'scaffolded', 'reported']) {
    assert.ok(pre.includes(`\`${s}\``), `the migrate resume steps must name \`${s}\``);
  }
  for (const reason of ['both-planning-dirs', 'legacy-block-malformed', 'move-failed']) {
    assert.ok(pre.includes(reason), `preflight must name the refusal reason ${reason}`);
  }
});

test('15 - migrate path skips: begin skill marker, map, infer_project, confirm_stack_profile, health (never --repair)', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  const begin = stepBody(wf, 'begin');
  assert.match(begin, /migrate path/, 'begin must say what the migrate path does');
  assert.match(begin, /do not run `skill-active --start/, 'begin must say the migrate path does not run `skill-active --start`');
  for (const name of ['map', 'infer_project', 'confirm_stack_profile']) {
    assert.match(stepBody(wf, name), /Skip on the migrate path/, `step ${name} must say "Skip on the migrate path"`);
  }
  const health = stepBody(wf, 'health');
  const intro = health.slice(0, health.indexOf('```'));
  assert.match(intro, /Skip on the migrate path/, 'health must be skipped on the migrate path');
  assert.match(intro, /--repair/, 'health must name --repair in its migrate note');
  assert.match(intro, /never run/, 'health must say --repair is never run on the migrate path');
  const scaffold = stepBody(wf, 'scaffold');
  assert.match(scaffold, /migrate path/, 'scaffold must describe the migrate path');
  assert.match(scaffold, /migrated: <n> converted/, 'scaffold must name the migrate output line');
  assert.match(scaffold, /Continue to `report`/, 'the migrate path goes from scaffold to report');
});

test('16 - migrate stop: report names commit_blocked, skips `commit` and stops; commit covers a re-run', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  const report = stepBody(wf, 'report');
  assert.match(report, /commit_blocked/, 'report must name commit_blocked');
  assert.match(report, /skip `commit`/, 'report must say to skip `commit` when the commit is blocked');
  assert.match(report, /stop/, 'report must say to stop when the commit is blocked');
  assert.match(report, /\bfix\b/, 'report must print the blocked commit\'s fix');
  const commit = stepBody(wf, 'commit');
  assert.match(commit, /migrate path/, 'commit must say how the migrate path differs');
  assert.match(commit, /nothing_to_commit/, 'commit must go on to `summary` when a re-run finds the change already recorded');
});

test('17 - migrate summary: report_path, git merge aoforge/adopt, Nothing was pushed, upgrade --check', () => {
  const summary = stepBody(readFile(ADOPT_WORKFLOW), 'summary');
  assert.match(summary, /migrate path/, 'summary must describe the migrate path');
  for (const needle of ['report_path', 'git merge aoforge/adopt', 'Nothing was pushed', 'upgrade --check']) {
    assert.ok(summary.includes(needle), `summary step must contain ${JSON.stringify(needle)}`);
  }
});

test('18 - SKILL.md: description and <objective> say pre-rename and spell no legacy name', () => {
  const md = readFile(SKILL_MD);
  const fm = frontmatter(md);
  const descMatch = fm.match(/^description:\s*\|\n((?:[ \t]+.*\n?)+)/m);
  assert.ok(descMatch, 'SKILL.md must have a block description');
  const description = descMatch[1];
  const objective = (md.match(/<objective>([\s\S]*?)<\/objective>/) || [])[1];
  assert.ok(objective, 'SKILL.md must have an <objective> block');
  const legacy = [LEGACY.planningDir, LEGACY.configKey, LEGACY.blockTag, LEGACY.slug];
  for (const [label, text] of [['description', description], ['<objective>', objective]]) {
    assert.match(text, /pre-rename/, `${label} must mention a pre-rename project`);
    for (const l of legacy) {
      assert.ok(!text.toLowerCase().includes(l.toLowerCase()), `${label} must not spell the legacy name ${JSON.stringify(l)}`);
    }
  }
  assert.match(objective, /\.aoforge\//, '<objective> must say the project moves onto .aoforge/');
});

// The aof-tools.cjs commands adopt.md had before the migrate path, in document order. A match is the
// text after `aof-tools.cjs --cwd "$TARGET" `; each must be found after the previous one.
const FRESH_PATH_COMMANDS = [
  'adopt preflight',
  'upgrade --check',
  'upgrade --apply',
  'commit`',
  'adopt begin',
  'skill-active --start adopt',
  'planning draft PROJECT.md',
  'doc put PROJECT.md',
  'adopt scaffold',
  'stack verify --run --raw',
  'validate health --raw',
  'validate health --repair',
  'adopt report',
  'skill-active --end',
  'commit "<commit_message>" --files <commit_files...>',
];

test('19 - fresh-path invariance: the pre-existing aof-tools.cjs commands all remain, in order', () => {
  const wf = readFile(ADOPT_WORKFLOW);
  let from = 0;
  for (const cmd of FRESH_PATH_COMMANDS) {
    const needle = `aof-tools.cjs --cwd "$TARGET" ${cmd}`;
    const at = wf.indexOf(needle, from);
    assert.ok(at !== -1, `fresh-path command missing or out of order: ${JSON.stringify(needle)}`);
    from = at + needle.length;
  }
});
