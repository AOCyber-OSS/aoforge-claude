'use strict';

// Hand-written agent outputs for the batch A (verifier) and batch B (job-checker) tests (TRD 81-09).
//
// Shapes follow the agents' own templates, so the scorers are proven on what the agents are told to write:
//   VERIFICATION.md  plugins/aoforge/agents/verifier.md "Publish VERIFICATION": frontmatter keys in the template's
//                    order (objective, verified, status, score, gaps, human_verification), gaps as
//                    [{truth, status, reason, artifacts: [{path, issue}], missing: []}], then the report body with
//                    a "### Gaps Summary" section.
//   checker return   plugins/aoforge/agents/job-checker.md <structured_returns>: `## VERIFICATION PASSED` or
//                    `## ISSUES FOUND`, `### Blockers (must fix)` and `### Warnings (should fix)` with items
//                    `**N. [dimension] description**`, `- Plan:`, `- Fix:`, then `### Structured Issues` holding a
//                    fenced YAML `issues:` list in the <issue_structure> format (job, dimension, severity,
//                    description, fix_hint).
//   run dir          what the runner (TRD 81-08) leaves per run under <root>/runs/<batch>/<id>/: record.json,
//                    outputs/outputs.json (the batch module's collect() return), stream.jsonl, work/ and tmp/.
//
// No generated data: every canned output is a literal a reader can check by eye against the answer keys
// (scripts/eval81/fixtures/A/answer-key.json, scripts/eval81/fixtures/B/answer-key.json). The comment above each
// canned output says which key entry it is written against and what it should score as.

const fs = require('fs');
const path = require('path');

/** A YAML double-quoted scalar (yaml-lite honours \" and \\). */
function yq(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ─── VERIFICATION.md (batch A) ─────────────────────────────────────────────────────────────────────────────

function gapYaml(gap) {
  const lines = [
    `  - truth: ${yq(gap.truth)}`,
    `    status: ${gap.status || 'failed'}`,
    `    reason: ${yq(gap.reason)}`,
  ];
  const artifacts = gap.artifacts || [];
  if (artifacts.length) {
    lines.push('    artifacts:');
    for (const a of artifacts) lines.push(`      - path: ${yq(a.path)}`, `        issue: ${yq(a.issue)}`);
  }
  const missing = gap.missing || [];
  if (missing.length) {
    lines.push('    missing:');
    for (const m of missing) lines.push(`      - ${yq(m)}`);
  }
  return lines;
}

function defaultBody({ objective, status, score, gaps }) {
  const title = objective.replace(/^\d+-/, '').replace(/-/g, ' ');
  const lines = [
    `# Objective 1: ${title} Verification Report`,
    '',
    `**Verified:** 2026-10-17T12:00:00Z`,
    `**Status:** ${status}`,
    '**Re-verification:** No — initial verification',
    '',
    '## Goal Achievement',
    '',
    `**Score:** ${score}`,
    '',
    '### Gaps Summary',
    '',
  ];
  if (gaps.length === 0) lines.push('None.');
  for (const g of gaps) lines.push(`- ${g.truth}: ${g.reason}`);
  lines.push('', '---', '', '_Verified: 2026-10-17T12:00:00Z_', '_Verifier: Claude (verifier)_');
  return lines.join('\n');
}

/**
 * verificationMd({objective, status, score, gaps, human, body, verified}) -> VERIFICATION.md text.
 * `body` replaces the default report body (which carries a "### Gaps Summary" listing each gap).
 */
function verificationMd({
  objective = '01-slug-command',
  status,
  score = '3/3 must-haves verified',
  gaps = [],
  human = [],
  body = null,
  verified = '2026-10-17T12:00:00Z',
} = {}) {
  const fm = ['---', `objective: ${objective}`, `verified: ${verified}`, `status: ${status}`, `score: ${yq(score)}`];
  if (gaps.length) {
    fm.push('gaps:');
    for (const g of gaps) fm.push(...gapYaml(g));
  }
  if (human.length) {
    fm.push('human_verification:');
    for (const h of human) {
      fm.push(`  - test: ${yq(h.test)}`, `    expected: ${yq(h.expected)}`, `    why_human: ${yq(h.why_human)}`);
    }
  }
  fm.push('---');
  const text = body === null ? defaultBody({ objective, status, score, gaps }) : body;
  return `${fm.join('\n')}\n\n${text}\n`;
}

// A1 or A4 (textkit, slug command): every truth verified.
function vPassed() {
  return verificationMd({ status: 'passed', score: '3/3 must-haves verified' });
}

// A4: names the planted artifact (must_mention "slugify") with an any_of token ("hard-coded") in one gap entry.
// On A4 this scores `detected`; on its clean twin A1 it scores `false_fail`.
function vGapsSlugify() {
  return verificationMd({
    status: 'gaps_found',
    score: '2/3 must-haves verified',
    gaps: [{
      truth: '`textkit slug <text>` prints the lowercase, hyphenated slug of its input',
      reason: 'src/slugify.js returns a hard-coded value: every input prints hello-world',
      artifacts: [{ path: 'src/slugify.js', issue: 'slugify ignores its argument and returns the same string' }],
      missing: ['derive the slug from the input text'],
    }],
  });
}

// gaps_found with a gap unrelated to any plant: it never mentions slugify, report.js or kelvin.
// On A4 this scores `detected_unnamed`; on a clean fixture it scores `false_fail`.
function vGapsUnrelated() {
  return verificationMd({
    status: 'gaps_found',
    score: '2/3 must-haves verified',
    gaps: [{
      truth: 'README.md documents how to run the command',
      reason: 'README.md has one line and no usage example',
      artifacts: [{ path: 'README.md', issue: 'no usage section' }],
      missing: ['a usage example in README.md'],
    }],
  });
}

// human_needed: an abstention on any fixture (never a pass, never a detection).
function vHumanNeeded() {
  return verificationMd({
    status: 'human_needed',
    score: '3/3 must-haves verified',
    human: [{
      test: 'Run the command on a few real titles',
      expected: 'Readable slugs',
      why_human: 'Readability is a judgement call',
    }],
  });
}

// A5 (notes, tag report): names report.js (must_mention) as missing (any_of "does not exist", "MODULE_NOT_FOUND").
function vGapsReportMissing() {
  return verificationMd({
    objective: '01-tag-report',
    status: 'gaps_found',
    score: '1/3 must-haves verified',
    gaps: [{
      truth: '`notes report` prints each tag with its count, sorted by tag',
      reason: 'src/report.js does not exist; the report command fails with MODULE_NOT_FOUND',
      artifacts: [{ path: 'src/report.js', issue: 'missing, though the SUMMARY lists it as created' }],
      missing: ['src/report.js exporting formatReport', 'test/report.test.js'],
    }],
  });
}

// A6 (tempconv, Kelvin command): names kelvin (must_mention) and the CLI wiring (any_of "cli", "wired").
function vGapsKelvinUnwired() {
  return verificationMd({
    objective: '01-kelvin-command',
    status: 'gaps_found',
    score: '2/3 must-haves verified',
    gaps: [{
      truth: '`tempconv k 0` prints 273.15',
      reason: 'toKelvin exists in src/kelvin.js but the k command is never wired into src/cli.js',
      artifacts: [{ path: 'src/cli.js', issue: 'no k branch; prints usage and exits 1' }],
      missing: ['route the k command to toKelvin in src/cli.js'],
    }],
  });
}

// A4: the frontmatter gaps list is empty and the gap is named only in the body's "### Gaps Summary" section
// (the decision rule's "or the gaps section"). Scores `detected`.
function vGapsBodyOnly() {
  return verificationMd({
    status: 'gaps_found',
    score: '2/3 must-haves verified',
    body: [
      '# Objective 1: slug command Verification Report',
      '',
      '**Status:** gaps_found',
      '',
      '### Observable Truths',
      '',
      '| # | Truth | Status | Evidence |',
      '| --- | --- | --- | --- |',
      '| 1 | slug prints a slug of its input | FAILED | every input prints hello-world |',
      '',
      '### Gaps Summary',
      '',
      'The slugify function is a placeholder: it returns the same string for every input.',
      '',
      '## Notes',
      '',
      'Nothing else.',
    ].join('\n'),
  });
}

// A4: frontmatter yaml-lite cannot parse (a block scalar), so the scorer falls back to the raw text. The status line
// and the gap text are still there; scores `detected`.
function vMalformedFrontmatter() {
  return [
    '---',
    'objective: 01-slug-command',
    'status: gaps_found',
    'gaps:',
    '  - truth: |',
    '      slug prints the slug of its input',
    '    reason: slugify always returns hello-world (a constant)',
    '---',
    '',
    '# Objective 1: slug command Verification Report',
    '',
  ].join('\n');
}

// ─── Job-checker return (batch B) ──────────────────────────────────────────────────────────────────────────

function issueItems(issues) {
  const out = [];
  issues.forEach((issue, i) => {
    out.push(`**${i + 1}. [${issue.dimension}] ${issue.description}**`);
    out.push(`- Plan: ${issue.plan}`);
    if (issue.task !== undefined) out.push(`- Task: ${issue.task}`);
    out.push(`- Fix: ${issue.fix}`, '');
  });
  return out;
}

function issuesYaml(issues) {
  const lines = ['issues:'];
  for (const issue of issues) {
    lines.push(
      `  - job: ${yq(issue.plan)}`,
      `    dimension: ${issue.dimension}`,
      `    severity: ${issue.severity}`,
      `    description: ${yq(issue.description)}`,
    );
    if (issue.task !== undefined) lines.push(`    task: ${issue.task}`);
    lines.push(`    fix_hint: ${yq(issue.fix)}`);
  }
  return lines;
}

/**
 * checkerReturn({verdict, objective, blockers, warnings, info, yaml, markdown}) -> the job-checker's return text.
 *   verdict   'passed' | 'issues' | 'none' (no heading at all)
 *   yaml      'list' (default: every issue repeated in the Structured Issues block), 'none' (no block),
 *             'malformed' (a block yaml-lite cannot parse)
 *   markdown  false leaves the Blockers/Warnings sections out (the issues live only in the YAML block)
 */
function checkerReturn({
  verdict,
  objective = '02-export-formats',
  plans = 3,
  blockers = [],
  warnings = [],
  info = [],
  yaml = 'list',
  markdown = true,
} = {}) {
  if (verdict === 'passed') {
    return [
      '## VERIFICATION PASSED',
      '',
      `**Objective:** ${objective}`,
      `**Plans verified:** ${plans}`,
      '**Confidence:** 8/10 (lowest plan: 7/10)',
      '',
      'Plans verified. Run `/aoforge:execute-objective 2` to proceed.',
      '',
    ].join('\n');
  }
  const lines = [];
  if (verdict === 'issues') lines.push('## ISSUES FOUND', '');
  else lines.push('Checked the plans for objective 2.', '');
  lines.push(
    `**Objective:** ${objective}`,
    `**Issues:** ${blockers.length} blocker(s), ${warnings.length} warning(s), ${info.length} info`,
    '**Confidence:** 6/10',
    '',
  );
  if (markdown) {
    lines.push('### Blockers (must fix)', '');
    if (blockers.length) lines.push(...issueItems(blockers));
    else lines.push('None.', '');
    lines.push('### Warnings (should fix)', '');
    if (warnings.length) lines.push(...issueItems(warnings));
    else lines.push('None.', '');
  }
  const all = [
    ...blockers.map((b) => ({ ...b, severity: 'blocker' })),
    ...warnings.map((w) => ({ ...w, severity: 'warning' })),
    ...info.map((n) => ({ ...n, severity: 'info' })),
  ];
  if (yaml !== 'none') {
    lines.push('### Structured Issues', '', '```yaml');
    if (yaml === 'malformed') {
      lines.push('issues:', '  - job: "02-01', '    dimension: [dependency_correctness', '      severity: blocker');
    } else {
      lines.push(...issuesYaml(all));
    }
    lines.push('```', '');
  }
  lines.push(`${blockers.length} blocker(s) require revision.`, '');
  return lines.join('\n');
}

// The B3 defect (must_mention "cli.js", any_of "same wave"/"both modify"/"conflict"), worded as a blocker.
const OVERLAP = {
  dimension: 'dependency_correctness',
  description: '02-01 and 02-02 both modify src/cli.js in the same wave',
  plan: '02-01, 02-02',
  fix: 'Make 02-02 depend on 02-01 and move it to wave 2',
};

// The same defect worded as a warning.
const OVERLAP_WARNING = {
  dimension: 'key_links_planned',
  description: 'Wave 1 plans 02-01 and 02-02 edit src/cli.js in parallel and may conflict',
  plan: '02-01, 02-02',
  fix: 'Sequence the two edits to src/cli.js',
};

// A blocker about nothing any key plants: it names no plan file of a plant, no cli.js, no wave and no format.
const UNRELATED = {
  dimension: 'verification_derivation',
  description: 'The must_haves truths of 02-03 restate tasks instead of user-observable behaviour',
  plan: '02-03',
  fix: 'Rewrite the truths as observable outcomes',
};

// A generic warning that matches no key entry.
const MINOR = {
  dimension: 'scope_sanity',
  description: 'Plan 02-03 has three tasks; consider splitting the tests into their own task',
  plan: '02-03',
  fix: 'Optional: split the test task',
};

// The B6 defect: no `must_mention`, any_of "unknown format" / "criterion 3".
const SC_MISSING = {
  dimension: 'requirement_coverage',
  description: 'Success criterion 3 (an unknown format exits with code 2) has no covering task; unknown format handling is not planned',
  plan: '02-03',
  fix: 'Add unknown format handling and its test to 02-03',
};

// The B4 defect: must_mention "02-02", any_of "verify".
const NO_VERIFY = {
  dimension: 'task_completeness',
  description: 'Task 1 of 02-02 has no <verify> element',
  plan: '02-02',
  task: 1,
  fix: 'Add a verify command to task 1',
};

// The B5 defect: must_mention "02-04", any_of "wave"/"depend".
const LATER_WAVE = {
  dimension: 'dependency_correctness',
  description: '02-02 is in wave 1 but depends on 02-04, which is in wave 2',
  plan: '02-02',
  fix: 'Move 02-02 to wave 3 or drop the dependency on 02-04',
};

// B1 or B2 (consistent): `missed_as_pass` on a planted set, `correct_pass` on a clean one.
function cPassed() {
  return checkerReturn({ verdict: 'passed' });
}

// B3: one blocker naming cli.js and "same wave". `detected` on B3.
function cOverlapBlocker() {
  return checkerReturn({ verdict: 'issues', blockers: [OVERLAP] });
}

// B3: the defect only as a warning (plus no blockers). Still `detected` on B3 (a warning counts).
function cOverlapWarningOnly() {
  return checkerReturn({ verdict: 'issues', warnings: [OVERLAP_WARNING] });
}

// One unrelated blocker: `missed` with unrelated_blockers 1 on a planted set, `false_alarm` on a clean one.
function cUnrelatedBlocker() {
  return checkerReturn({ verdict: 'issues', blockers: [UNRELATED] });
}

// Warnings only, matching nothing: `correct_pass` on a clean set, `missed` (unrelated_blockers 0) on a planted one.
function cWarningsOnly() {
  return checkerReturn({ verdict: 'issues', warnings: [MINOR] });
}

// B6: the uncovered success criterion as a blocker. `detected` on B6 through an any_of phrase alone.
function cScMissing() {
  return checkerReturn({ verdict: 'issues', blockers: [SC_MISSING] });
}

// B4: the missing verify element as a blocker. `detected` on B4 (a precheck-flagged defect).
function cMissingVerify() {
  return checkerReturn({ verdict: 'issues', objective: '02-batch-conversion', plans: 4, blockers: [NO_VERIFY] });
}

// B5: the later-wave dependency as a blocker. `detected` on B5 (judgment-only).
function cLaterWave() {
  return checkerReturn({ verdict: 'issues', objective: '02-batch-conversion', plans: 4, blockers: [LATER_WAVE] });
}

// B3: the defect only in the Structured Issues YAML (no Markdown sections). `detected` from the YAML list.
function cOverlapYamlOnly() {
  return checkerReturn({ verdict: 'issues', blockers: [OVERLAP], markdown: false });
}

// B3: the Markdown blocker plus an unparseable YAML block. `detected` from the Markdown sections (the fallback).
function cOverlapMalformedYaml() {
  return checkerReturn({ verdict: 'issues', blockers: [OVERLAP], yaml: 'malformed' });
}

// No `##` verdict heading at all: verdict `none`, scored as an abstention.
function cNoHeading() {
  return checkerReturn({ verdict: 'none', blockers: [OVERLAP] });
}

// ─── Run records and run dirs ──────────────────────────────────────────────────────────────────────────────

/**
 * okRecord({id, batch, model, ...}) -> a RunRecord (TRD 81-01 contract) for a finished run. Every number is given by
 * the caller; the defaults are the literal values below.
 */
function okRecord({
  id,
  batch,
  model,
  status = 'ok',
  model_ran = true,
  cost_usd = 0.4,
  charged_usd = cost_usd,
  wall_ms = 60000,
  first_turn_input = 40000,
  result_text = 'done',
  ...rest
}) {
  return {
    id,
    batch,
    role: batch === 'A' ? 'verifier' : 'job-checker',
    model,
    plugin: '3.1.0',
    agent: batch === 'A' ? 'aoforge:verifier' : 'aoforge:job-checker',
    status,
    cost_usd,
    charged_usd,
    cost_source: 'reported',
    model_ran,
    wall_ms,
    first_turn_input,
    result_text,
    ...rest,
  };
}

/**
 * runDir(root, batch, id, {record, outputs, stream, workFiles, tmpFiles}) -> the run dir, written the way the runner
 * leaves it: <root>/runs/<batch>/<id>/record.json, outputs/outputs.json (collect()'s return), stream.jsonl, and
 * optional files under work/ and tmp/ (relative path -> text).
 */
function runDir(root, batch, id, { record, outputs, stream, workFiles = {}, tmpFiles = {} } = {}) {
  const dir = path.join(root, 'runs', batch, id);
  fs.mkdirSync(path.join(dir, 'work'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tmp'), { recursive: true });
  if (record !== undefined) fs.writeFileSync(path.join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
  if (outputs !== undefined) {
    fs.mkdirSync(path.join(dir, 'outputs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'outputs', 'outputs.json'), `${JSON.stringify(outputs, null, 2)}\n`);
  }
  if (stream !== undefined) fs.writeFileSync(path.join(dir, 'stream.jsonl'), stream);
  for (const [base, files] of [['work', workFiles], ['tmp', tmpFiles]]) {
    for (const [rel, text] of Object.entries(files)) {
      const abs = path.join(dir, base, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
    }
  }
  return dir;
}

module.exports = {
  verificationMd,
  vPassed,
  vGapsSlugify,
  vGapsUnrelated,
  vHumanNeeded,
  vGapsReportMissing,
  vGapsKelvinUnwired,
  vGapsBodyOnly,
  vMalformedFrontmatter,
  checkerReturn,
  cPassed,
  cOverlapBlocker,
  cOverlapWarningOnly,
  cUnrelatedBlocker,
  cWarningsOnly,
  cScMissing,
  cMissingVerify,
  cLaterWave,
  cOverlapYamlOnly,
  cOverlapMalformedYaml,
  cNoHeading,
  okRecord,
  runDir,
};
