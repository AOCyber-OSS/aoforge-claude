'use strict';

/**
 * Scorer for batch C of the objective-81 Haiku eval (TRD 81-11): turns the collected agent outputs and their blind
 * Sonnet grades into checklist recall, error rate, missing rate and fabrications per role and model.
 * `node scripts/eval81/score.cjs --batch C --root R --out <objective dir>` loads this module and calls
 * score({root, outDir}); score.cjs adds the spend block and writes results/C.json and results/C.md.
 *
 * Roles: `codebase-mapper:<focus>` (tech, arch, quality, concerns) and `project-researcher:<dimension>` (stack,
 * features, architecture, pitfalls). For each role and model the metrics are (81-DECISION-RULE.md section 3):
 *   recall   {k: items found,   n: checklist items over the scored runs}
 *   error    {k: items wrong,   n}      missing {k: items missing, n}
 *   fabrications {total, runs}  total = grader fabrications + mechanical path fabrications, runs = scored runs
 *   recall_by_codebase / fabrications_by_codebase (mapper roles): the same split by synthetic and fleet codebase
 * `planned` is set per role and model (the batch-level count covers all eight roles and cannot serve the 2/3-scored
 * check): 4 mapper runs per model and focus (2 codebases x 2 repeats; 2 when the fleet runs are omitted) and 2
 * researcher runs per model and dimension. `n_scored` is runs, `n` is checklist items.
 *
 * A run is scored only when its record is ok, its model ran as requested, no tool input mentions an answer key or
 * scripts/eval81 (contamination), it collected a document, its grader run is ok and returned exactly one valid verdict
 * for every checklist item. Anything else is `excluded` with its reason and is in no `n`. Item ids the grader invented
 * are ignored and counted in notes; they are never mapped to a real item.
 *
 * The mechanical path check (mapper runs only; a researcher has no codebase to check against): every back-ticked
 * token in the document outside code fences that looks like a repository path (contains `/`, or ends in a known
 * source or manifest extension, or is a well-known file name) must exist in the run's codebase, the pristine copy
 * rather than the agent's work directory. A path exists when it is a file or directory of the codebase or the tail of
 * one (a document may say `check/worker.go` for `internal/check/worker.go`). Ignored: URLs, absolute and home paths,
 * globs and placeholders, Go import paths (a host-looking first segment, or a standard-library root that is not a
 * directory of the codebase), MIME types, `I/O`-style capitals. Pre-registered as literal (a document saying "there
 * is no `go.sum`" counted too); POST-HOC 2 (TRD 81-14, user 2026-10-17) exempts negated claims: a path every mention of
 * which says it is absent is not counted (see negatedMention). Flagged and exempt paths are listed in
 * spotcheck/C-paths.md for a person to read.
 *
 * Results written under --out carry ids, counts and rates only. The spot-check sample (checklist text, quotes,
 * document context) and the path review go to <root>/spotcheck/ and are refused under --out.
 */

const fs = require('node:fs');
const path = require('node:path');

const C = require('../batches/C.cjs');
const synthetic = require('../fixtures/C/synthetic.cjs');
const { toolInputsMentioning } = require('../lib/result.cjs');

const SEED = 81;
const SAMPLE_K = 6;
const MODELS = ['haiku', 'sonnet'];
const ROLE_ORDER = [...C.FOCI.map((f) => `codebase-mapper:${f}`), ...C.DIMENSIONS.map((d) => `project-researcher:${d}`)];
// A tool input that mentions one of these means the run looked at an answer key (81-DECISION-RULE.md, contamination).
const CONTAMINATION = [/scripts[\\/]eval81/, /answer-key/, /checklists-(?:synthetic|researcher)/, /fleet-checklists/, /fleet-commitment/, /81-DECISION-RULE/];
const FIXTURE_LABEL = { synthetic: 'synthetic', fleet: 'fleet', greenfield: 'topic' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// --- the mechanical path check ----------------------------------------------------------------------------------

const SOURCE_EXT = new Set(['go', 'mod', 'sum', 'md', 'yml', 'yaml', 'json', 'toml', 'ts', 'tsx', 'js', 'jsx', 'cjs', 'mjs', 'py', 'rs',
  'sh', 'mk', 'txt', 'cfg', 'ini', 'env', 'sql', 'proto', 'html', 'css', 'scss', 'c', 'h', 'cc', 'cpp', 'hpp', 'java', 'kt', 'swift', 'rb',
  'php', 'lock', 'gradle', 'xml', 'tmpl', 'tpl', 'gohtml', 'dart', 'vue', 'svelte', 'conf', 'service', 'plist']);
const KNOWN_NAMES = new Set(['Makefile', 'Dockerfile', 'Jenkinsfile', 'Procfile', 'Rakefile', 'Gemfile', 'LICENSE', 'CODEOWNERS', 'Taskfile']);
const STDLIB_ROOTS = new Set(['archive', 'bufio', 'bytes', 'cmp', 'compress', 'container', 'context', 'crypto', 'database', 'debug', 'embed',
  'encoding', 'errors', 'expvar', 'flag', 'fmt', 'go', 'hash', 'html', 'image', 'index', 'io', 'iter', 'log', 'maps', 'math', 'mime', 'net', 'os',
  'path', 'plugin', 'reflect', 'regexp', 'runtime', 'slices', 'sort', 'strconv', 'strings', 'sync', 'syscall', 'testing', 'text', 'time',
  'unicode', 'unique', 'unsafe']);
const MIME_ROOTS = new Set(['application', 'text', 'image', 'audio', 'video', 'multipart', 'message', 'model', 'font']);
const HOST_RE = /^(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|ai|in|co|me|us|uk|de|sh|app|xyz)$/i;

/** {all: Set of every path and path tail, top: Set of top-level names} for a list of file paths (forward slashes). */
function indexFromFiles(files) {
  const all = new Set();
  const top = new Set();
  const addWithTails = (p) => {
    const segs = p.split('/');
    for (let i = 0; i < segs.length; i += 1) all.add(segs.slice(i).join('/'));
  };
  for (const file of [...files, '.git']) {
    const segs = file.split('/');
    top.add(segs[0]);
    for (let i = 1; i <= segs.length; i += 1) addWithTails(segs.slice(0, i).join('/'));
  }
  return { all, top };
}

/** indexFromFiles over every file under dir; `.git` contents are skipped (symlinks are listed, not followed). */
function indexFromDir(dir) {
  const files = [];
  const walk = (abs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (rel === '' && entry.name === '.git') continue;
      if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
      else files.push(childRel);
    }
  };
  walk(dir, '');
  return indexFromFiles(files);
}

/** Inline code spans outside fenced blocks: [{span, line}]. */
function codeSpans(text) {
  const out = [];
  let inFence = false;
  for (const line of String(text).split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) out.push({ span: m[1].trim(), line, at: m.index, raw: m[0] });
  }
  return out;
}

/** A back-ticked token as a repository-path candidate ({path, segs, hasExt}), or null when it is not one. */
function pathCandidate(span) {
  let s = span;
  if (s === '' || /\s/.test(s)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^mailto:/i.test(s)) return null;
  if (/^[/~$@#%&*+=<>|\\-]/.test(s)) return null;
  s = s.replace(/^\.\//, '');
  if (s.startsWith('../')) return null;
  s = s.replace(/(?::\d+(?:[:-]\d+)?|#L?\d+(?:-L?\d+)?)$/, '');
  s = s.replace(/[.,;]+$/, '').replace(/\/+$/, '');
  if (s === '' || /[*{}<>()[\]=,|$?!;'"\\^&:@]/.test(s) || s.includes('...') || s.includes('\u2026')) return null;
  const segs = s.split('/');
  if (segs.some((g) => g === '')) return null;
  const base = segs[segs.length - 1];
  const ext = base.lastIndexOf('.') > 0 ? base.slice(base.lastIndexOf('.') + 1) : '';
  const hasExt = ext !== '' && SOURCE_EXT.has(ext);
  if (segs.length === 1) {
    if (!hasExt && !KNOWN_NAMES.has(base)) return null;
  } else {
    if (segs.every((g) => /^\d+$/.test(g))) return null;
    if (segs.every((g) => /^[A-Z0-9]+$/.test(g))) return null;
    if (HOST_RE.test(segs[0])) return null;
  }
  return { path: s, segs, hasExt };
}

// Negated claims, POST-HOC 2 (TRD 81-14, user 2026-10-17: "the mapper fabrication check exempts negated claims (e.g.
// 'there is no go.sum')"). A mention of a path is negated when, on its line and with every other code span masked,
//   - the last negator before it (no, not, without, lack(s/ing), missing, absent, never, nor, neither) is followed only
//     by up to four filler words (a, the, any, file, directory, lock, or, ...), as in "there is no `go.sum`", "no lock
//     file (`yarn.lock`)", "Missing: `CHANGELOG.md`", "No `a` or `b` is checked in"; or
//   - it is directly followed by an absence phrase: "does not exist", "doesn't exist", "is absent", "is missing",
//     "is not present / there / checked in / committed / tracked / included / found", "(missing)", "not found".
// A path is exempt only when EVERY mention of it is negated; one asserted mention still makes it a fabrication.
const SPAN_MASK = 'xspanx';
const NEGATORS = /\b(?:no|not|without|lacks?|lacking|missing|absent|never|nor|neither)\b/gi;
const NEGATION_FILLERS = new Set(['a', 'an', 'the', 'any', 'such', 'single', 'separate', 'file', 'files', 'directory',
  'directories', 'dir', 'folder', 'lock', 'lockfile', 'checksum', 'manifest', 'module', 'committed', 'checked-in',
  'top-level', 'root', 'yet', 'or', 'and', 'nor', SPAN_MASK]);
const ABSENT_AFTER = new RegExp([
  '^[\\s)\\]"\'’,:;–—-]*\\(?\\s*(?:(?:file|directory|folder|dir)\\s+)?(?:',
  '(?:is|are|was|were)\\s+(?:absent|missing|not\\s+(?:present|there|checked\\s+in|committed|tracked|included|found|in\\s+the\\s+repo(?:sitory)?))',
  '|(?:isn|aren|wasn|weren)[\'’]t\\s+(?:present|there|checked\\s+in|committed|tracked|included|found)',
  '|(?:does|do|did)\\s+not\\s+exist|(?:doesn|don|didn)[\'’]t\\s+exist',
  '|absent\\b|missing\\b|not\\s+found)',
].join(''), 'i');

const maskSpans = (s) => s.replace(/`[^`]+`/g, ` ${SPAN_MASK} `);

/** Is the code span at line[at, at + length) a negated mention (the path named only to say it is absent)? */
function negatedMention(line, at, length) {
  const before = maskSpans(line.slice(0, at)).slice(-160);
  let last = null;
  for (const m of before.matchAll(NEGATORS)) last = m;
  if (last) {
    const words = before.slice(last.index + last[0].length).split(/[\s,:;()[\]"'’]+/).filter(Boolean).map((w) => w.toLowerCase());
    if (words.length <= 4 && words.every((w) => NEGATION_FILLERS.has(w))) return true;
  }
  return ABSENT_AFTER.test(maskSpans(line.slice(at + length)));
}

/**
 * The path check of a document: {flagged: [{path, line}], exempt: [{path, line}]} over the distinct back-ticked
 * repository paths that are not in the codebase index. `exempt` holds the paths every mention of which is negated
 * (post-hoc 2); `flagged` the rest, which count as fabrications.
 */
function pathCheck(text, index) {
  const byPath = new Map();
  for (const { span, line, at, raw } of codeSpans(text)) {
    const c = pathCandidate(span);
    if (!c) continue;
    if (c.segs.length > 1 && !c.hasExt && !index.top.has(c.segs[0]) && (STDLIB_ROOTS.has(c.segs[0]) || MIME_ROOTS.has(c.segs[0]))) continue;
    if (index.all.has(c.path)) continue;
    const negated = negatedMention(line, at, raw.length);
    const shown = line.trim().slice(0, 200);
    const cur = byPath.get(c.path);
    if (!cur) byPath.set(c.path, { path: c.path, line: shown, negated });
    else if (cur.negated && !negated) Object.assign(cur, { line: shown, negated: false });
  }
  const all = [...byPath.values()];
  return {
    flagged: all.filter((p) => !p.negated).map(({ path: p, line }) => ({ path: p, line })),
    exempt: all.filter((p) => p.negated).map(({ path: p, line }) => ({ path: p, line })),
  };
}

/** [{path, line}] for every distinct back-ticked repository path in text that is not in the codebase index and is
 * not exempt as a negated claim. */
function missingPaths(text, index) {
  return pathCheck(text, index).flagged;
}

/** The distinct back-ticked repository paths of text that the codebase index does not contain. */
function pathFabrications(text, index) {
  return missingPaths(text, index).map((f) => f.path);
}

// --- evaluating the runs ----------------------------------------------------------------------------------------

const normalizeSpace = (s) => s.replace(/\s+/g, ' ').trim();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where a quote sits in a document ({index, length}), whitespace-insensitively; null when it is not there. */
function locateQuote(document, quote) {
  const q = quote.trim();
  if (q === '') return null;
  const exact = document.indexOf(q);
  if (exact >= 0) return { index: exact, length: q.length };
  const m = new RegExp(escapeRegExp(normalizeSpace(q)).replace(/ /g, '\\s+')).exec(document);
  return m ? { index: m.index, length: m[0].length } : null;
}

function costOf(record) {
  if (finite(record.cost_usd)) return record.cost_usd;
  return finite(record.charged_usd) ? record.charged_usd : 0;
}

function wallOf(record) {
  if (finite(record.wall_ms)) return record.wall_ms;
  return finite(record.duration_ms) ? record.duration_ms : null;
}

function isContaminated(found) {
  if (found.record.contaminated === true) return true;
  let stream;
  try {
    stream = fs.readFileSync(path.join(found.dir, 'stream.jsonl'), 'utf8');
  } catch {
    return false;
  }
  return toolInputsMentioning(stream, CONTAMINATION).length > 0;
}

/** One verdict per checklist item from a grader answer, or the reason it cannot be used. */
function resolveVerdicts(graded, checklist) {
  const ids = new Set(checklist.map((i) => i.id));
  const verdicts = new Map();
  let unknown = 0;
  for (const item of graded.items) {
    if (!ids.has(item.id)) {
      unknown += 1;
      continue;
    }
    if (verdicts.has(item.id)) return { ok: false, reason: `ungraded: the grader gave two verdicts for ${item.id}` };
    verdicts.set(item.id, { verdict: item.verdict, evidence: item.evidence });
  }
  const left = checklist.filter((i) => !verdicts.has(i.id)).length;
  if (left > 0) return { ok: false, reason: `ungraded: the grader left ${left} of ${checklist.length} items without a verdict` };
  return { ok: true, verdicts, unknown };
}

/**
 * Join every planned agent run with its grader run.
 * @returns {{root, entries, evals, includeFleet, note}} evals: one per planned run, in plan order:
 *   {entry, status: 'scored'|'excluded', reason, contaminated, record, graderRecord, document, checklist, verdicts,
 *    counts{found, wrong, missing, items}, fab{grader, mechanical, paths[]}, unknown, quotes{checked, missing}, usedWork}
 */
function evaluate({ root, repo, privateFile, commitmentFile } = {}) {
  if (typeof root !== 'string' || root === '') throw new TypeError('score C: root is required');
  const batch = C.makeBatch({ repo, privateFile, commitmentFile });
  const note = C.readPlanNote(root);
  const includeFleet = !(note && note.include_fleet === false);
  const priv = includeFleet ? batch.loadPrivate({}) : null;
  const entries = C.plan({ includeFleet });

  const indexes = {};
  const indexFor = (entry, runDir) => {
    if (entry.codebase === 'synthetic') {
      if (!indexes.synthetic) indexes.synthetic = indexFromFiles(Object.keys(synthetic.syntheticFiles()));
      return { index: indexes.synthetic, usedWork: false };
    }
    const prepared = path.join(root, 'cache', 'C', 'fleet-prepared');
    if (fs.existsSync(prepared)) {
      if (!indexes.fleet) indexes.fleet = indexFromDir(prepared);
      return { index: indexes.fleet, usedWork: false };
    }
    return { index: indexFromDir(path.join(runDir, 'work')), usedWork: true };
  };

  const evals = entries.map((entry) => {
    const ev = { entry, status: 'excluded', reason: null, contaminated: false, record: null, graderRecord: null };
    const found = C.readRunRecord(root, entry.id);
    if (!found) return { ...ev, reason: 'no record: the run did not happen' };
    ev.record = found.record;
    ev.contaminated = isContaminated(found);
    if (ev.contaminated) return { ...ev, reason: 'contaminated: a tool input mentions an answer key or scripts/eval81' };
    if (found.record.status !== 'ok') return { ...ev, reason: `status ${found.record.status}` };
    if (found.record.model_ran === false) return { ...ev, reason: 'model_ran false: the run did not use the requested model' };
    // Post-hoc 4 (TRD 81-18): still impaired after its one re-run, so not a model error; reported apart.
    if (found.record.impaired === true) {
      return { ...ev, impaired: true, reason: 'impaired: a permission denial blocked the agent\'s own runtime files (~/.claude) on its final attempt; excluded from the model rates (post-hoc 4)' };
    }
    const document = found.outputs && typeof found.outputs.document === 'string' ? found.outputs.document : '';
    if (document.trim() === '') return { ...ev, reason: 'no document collected: the agent wrote none of its documents' };

    const gfound = C.readRunRecord(root, `C-grade-${entry.id}`);
    if (!gfound) return { ...ev, reason: 'ungraded: the grader run has not been done' };
    ev.graderRecord = gfound.record;
    if (gfound.record.status !== 'ok') return { ...ev, reason: `ungraded: grader status ${gfound.record.status}` };
    let graded = gfound.outputs && gfound.outputs.graded ? gfound.outputs.graded : null;
    if (!graded) graded = C.collect({ id: `C-grade-${entry.id}`, fixture: { kind: 'grader' } }, '', { record: gfound.record }).graded;
    if (!graded) return { ...ev, reason: 'ungraded: the grader returned no structured output' };

    const checklist = C.checklistFor(entry, priv);
    const resolved = resolveVerdicts(graded, checklist);
    if (!resolved.ok) return { ...ev, reason: resolved.reason };

    const counts = { found: 0, wrong: 0, missing: 0, items: checklist.length };
    const quotes = { checked: 0, missing: 0 };
    for (const item of checklist) {
      const v = resolved.verdicts.get(item.id);
      counts[v.verdict] += 1;
      if (v.verdict !== 'missing' && v.evidence.trim() !== '') {
        quotes.checked += 1;
        if (!locateQuote(document, v.evidence)) quotes.missing += 1;
      }
    }
    let flagged = [];
    let exempt = [];
    let usedWork = false;
    if (entry.kind === 'mapper') {
      const where = indexFor(entry, found.dir);
      usedWork = where.usedWork;
      ({ flagged, exempt } = pathCheck(document, where.index));
    }
    return {
      ...ev,
      status: 'scored',
      document,
      checklist,
      verdicts: resolved.verdicts,
      counts,
      fab: { grader: graded.fabrications.length, mechanical: flagged.length, paths: flagged, exempt },
      unknown: resolved.unknown,
      quotes,
      usedWork,
    };
  });
  return { root, entries, evals, includeFleet, note };
}

// --- the batch result --------------------------------------------------------------------------------------------

function aggregate({ entries, evals, includeFleet }) {
  const codebases = includeFleet ? ['synthetic', 'fleet'] : ['synthetic'];
  const roles = {};
  for (const role of ROLE_ORDER) {
    const mapper = role.startsWith('codebase-mapper:');
    const models = {};
    const plannedByModel = {};
    for (const model of MODELS) {
      const planned = entries.filter((e) => e.role === role && e.model === model).length;
      plannedByModel[model] = planned;
      const scored = evals.filter((ev) => ev.status === 'scored' && ev.entry.role === role && ev.entry.model === model);
      const sum = (rows, f) => rows.reduce((acc, ev) => acc + f(ev), 0);
      const items = sum(scored, (ev) => ev.counts.items);
      const fabOf = (ev) => ev.fab.grader + ev.fab.mechanical;
      const metrics = {
        recall: { k: sum(scored, (ev) => ev.counts.found), n: items },
        error: { k: sum(scored, (ev) => ev.counts.wrong), n: items },
        missing: { k: sum(scored, (ev) => ev.counts.missing), n: items },
        fabrications: { total: sum(scored, fabOf), runs: scored.length },
      };
      if (mapper) {
        metrics.recall_by_codebase = {};
        metrics.fabrications_by_codebase = {};
        for (const cb of codebases) {
          const sub = scored.filter((ev) => ev.entry.codebase === cb);
          metrics.recall_by_codebase[cb] = { k: sum(sub, (ev) => ev.counts.found), n: sum(sub, (ev) => ev.counts.items) };
          metrics.fabrications_by_codebase[cb] = { total: sum(sub, fabOf), runs: sub.length };
        }
      }
      const walls = scored.map((ev) => wallOf(ev.record)).filter(finite);
      models[model] = {
        n_scored: scored.length,
        n_impaired: evals.filter((ev) => ev.impaired === true && ev.entry.role === role && ev.entry.model === model).length,
        planned,
        metrics,
        cost_usd: round6(sum(scored, (ev) => costOf(ev.record))),
        grader_cost_usd: round6(sum(scored, (ev) => costOf(ev.graderRecord))),
        mean_wall_ms: walls.length > 0 ? Math.round(walls.reduce((a, b) => a + b, 0) / walls.length) : null,
      };
    }
    roles[role] = { primary: 'recall', planned: plannedByModel, models };
  }
  return roles;
}

function buildResult(ev) {
  const { entries, evals, includeFleet, note } = ev;
  const roles = aggregate(ev);
  const planned = Object.fromEntries(MODELS.map((m) => [m, entries.filter((e) => e.model === m).length]));
  const runs = [];
  const excluded = [];
  for (const e of evals) {
    const base = { id: e.entry.id, model: e.entry.model, role: e.entry.role, fixture: FIXTURE_LABEL[e.entry.codebase] };
    if (e.status === 'scored') {
      runs.push({
        ...base,
        verdict: 'graded',
        outcome: `found ${e.counts.found}, wrong ${e.counts.wrong}, missing ${e.counts.missing} of ${e.counts.items}`,
        contaminated: false,
        found: e.counts.found,
        wrong: e.counts.wrong,
        missing: e.counts.missing,
        items: e.counts.items,
        grader_fabrications: e.fab.grader,
        path_fabrications: e.fab.mechanical,
      });
    } else {
      if (e.contaminated) runs.push({ ...base, verdict: null, outcome: 'excluded', contaminated: true });
      excluded.push({ id: e.entry.id, reason: e.reason, model: e.entry.model, role: e.entry.role });
    }
  }

  const scored = evals.filter((e) => e.status === 'scored');
  const notes = [];
  if (note && note.reduction) notes.push(`Recorded reduction: ${note.reduction}.`);
  notes.push('The mechanical path check applies to codebase-mapper runs only; a project-researcher run has no codebase to check against.');
  notes.push('The mechanical path check exempts negated claims (81-DECISION-RULE.md, post-hoc 2): a back-ticked path that is not in the codebase counts unless every mention of it says it is absent ("there is no `go.sum`"); flagged and exempt paths are listed in the eval root (spotcheck/C-paths.md).');
  const unknown = scored.reduce((a, e) => a + e.unknown, 0);
  if (unknown > 0) notes.push(`${unknown} grader verdicts named unknown item ids and were ignored (${scored.filter((e) => e.unknown > 0).length} runs).`);
  const quotes = scored.reduce((a, e) => ({ checked: a.checked + e.quotes.checked, missing: a.missing + e.quotes.missing }), { checked: 0, missing: 0 });
  if (quotes.checked > 0) notes.push(`grader evidence quotes not found verbatim in the document: ${quotes.missing} of ${quotes.checked} (checked mechanically for every found or wrong verdict).`);
  const usedWork = scored.filter((e) => e.usedWork).length;
  if (usedWork > 0) notes.push(`${usedWork} fleet runs were path-checked against their own work copy because the prepared fleet tree was not in the eval root.`);
  const graderCost = round6(scored.reduce((a, e) => a + costOf(e.graderRecord), 0));
  notes.push(`Grader spend on the ${scored.length} scored runs: $${graderCost.toFixed(2)} (also included in the ledger).`);
  const impaired = evals.filter((e) => e.impaired === true).map((e) => ({
    id: e.entry.id,
    model: e.entry.model,
    role: e.entry.role,
    fixture: FIXTURE_LABEL[e.entry.codebase],
    impaired_by: e.record && e.record.access && Array.isArray(e.record.access.impaired_by) ? e.record.access.impaired_by : [],
  }));
  const byModel = MODELS.map((m) => `${m} ${impaired.filter((x) => x.model === m).length}`).join(', ');
  notes.push(`Post-hoc 4: ${impaired.length} run${impaired.length === 1 ? '' : 's'} impaired on the final attempt (a permission denial blocked the agent's own ~/.claude runtime files, after one re-run); excluded from the model rates and listed in \`impaired\` (${byModel}).`);
  return { batch: 'C', scored_at: new Date().toISOString(), planned, roles, runs, excluded, impaired, notes, include_fleet: includeFleet };
}

// --- the spot-check sample ---------------------------------------------------------------------------------------

/** mulberry32: a small seeded generator, so the sample is the same every time. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function spotDir(root, outDir) {
  const dir = path.resolve(root, 'spotcheck');
  if (outDir) {
    const out = path.resolve(outDir);
    if (dir === out || dir.startsWith(out + path.sep)) {
      throw new Error(`spot-check: ${dir} is under --out (${out}); the sample holds checklist text and never goes in a committed directory`);
    }
  }
  return dir;
}

/** Every graded (run, item) pair in plan order then checklist order. */
function candidatesOf(evals) {
  const out = [];
  for (const ev of evals) {
    if (ev.status !== 'scored') continue;
    for (const item of ev.checklist) {
      const v = ev.verdicts.get(item.id);
      out.push({ ev, item, verdict: v.verdict, evidence: v.evidence });
    }
  }
  return out;
}

function quoted(lines) {
  return lines.map((l) => `> ${l}`).join('\n');
}

function sampleText({ picks, seed, k, total }) {
  const lines = [
    `# Test C spot check: grader verdicts (seed ${seed}, ${picks.length} of ${total} graded checklist items)`,
    '',
    'This file holds checklist statements, quotes and document text. It stays in the eval root; do not commit it.',
    '',
    'For each sample, read the document context and decide whether the grader\'s verdict is right. Samples are drawn with a',
    `fixed seed (${seed}), round-robin over the verdicts found, wrong and missing (up to ${k}). The producing model is not shown;`,
    'the key at the end maps each sample to its run.',
    '',
  ];
  picks.forEach((p, i) => {
    const quote = p.verdict === 'missing' ? null : locateQuote(p.ev.document, p.evidence);
    lines.push(`## S${i + 1}: ${p.ev.entry.role}, item ${p.item.id}`, '');
    lines.push(`- Checklist item: ${p.item.statement}`);
    lines.push(`- Accepted phrasings: ${(p.item.accept_any || []).join('; ') || '(none)'}`);
    lines.push(`- Grader verdict: ${p.verdict}`);
    if (p.verdict === 'missing') {
      const phrases = (p.item.accept_any || []).map((x) => x.toLowerCase()).filter((x) => x !== '');
      const hits = p.ev.document.split('\n').filter((l) => phrases.some((x) => l.toLowerCase().includes(x))).slice(0, 5);
      lines.push('- Document lines mentioning an accepted phrase (up to 5):');
      if (hits.length === 0) lines.push('  (none)');
      else lines.push(quoted(hits.map((h) => h.trim().slice(0, 300))));
    } else {
      lines.push(`- Grader quote: "${p.evidence}"`);
      if (!quote) {
        lines.push('- QUOTE NOT FOUND in the document');
      } else {
        lines.push('- Document context:');
        const at = p.ev.document.slice(Math.max(0, quote.index - 300), Math.min(p.ev.document.length, quote.index + quote.length + 300));
        lines.push(quoted(at.split('\n')));
      }
    }
    lines.push('');
  });
  lines.push('## Key', '', '| Sample | Run | Model | Role | Codebase |', '|---|---|---|---|---|');
  picks.forEach((p, i) => lines.push(`| S${i + 1} | ${p.ev.entry.id} | ${p.ev.entry.model} | ${p.ev.entry.role} | ${FIXTURE_LABEL[p.ev.entry.codebase]} |`));
  return `${lines.join('\n')}\n`;
}

function pathReviewText(evals) {
  const lines = ['# Test C: back-ticked paths that are not in the codebase', '',
    'The mechanical path check counted the "flagged" paths as fabrications (mapper runs). The "exempt" paths were named only to say they are absent and did not count (post-hoc 2, negated claims). Read both: a flagged path that is really a negation, or an exempt one that is really asserted, is a misreading of the check. Stays in the eval root; do not commit.', ''];
  let any = false;
  for (const ev of evals) {
    const exempt = ev.status === 'scored' && Array.isArray(ev.fab.exempt) ? ev.fab.exempt : [];
    if (ev.status !== 'scored' || (ev.fab.paths.length === 0 && exempt.length === 0)) continue;
    any = true;
    lines.push(`## ${ev.entry.id} (${ev.entry.role}, ${ev.entry.model}, ${FIXTURE_LABEL[ev.entry.codebase]})`, '');
    for (const f of ev.fab.paths) lines.push(`- flagged \`${f.path}\`  in: ${f.line}`);
    for (const f of exempt) lines.push(`- exempt \`${f.path}\`  in: ${f.line}`);
    lines.push('');
  }
  if (!any) lines.push('(no flagged paths)', '');
  return `${lines.join('\n')}\n`;
}

function writeSpotChecks(ev, { root, outDir, seed = SEED, k = SAMPLE_K }) {
  const dir = spotDir(root, outDir);
  const candidates = candidatesOf(ev.evals);
  const rng = mulberry32(seed);
  const classes = { found: [], wrong: [], missing: [] };
  for (const c of candidates) classes[c.verdict].push(c);
  for (const verdict of ['found', 'wrong', 'missing']) shuffle(classes[verdict], rng);
  const chosen = [];
  while (chosen.length < k && Object.values(classes).some((list) => list.length > 0)) {
    for (const verdict of ['found', 'wrong', 'missing']) {
      if (chosen.length < k && classes[verdict].length > 0) chosen.push(classes[verdict].shift());
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'C.md');
  fs.writeFileSync(file, sampleText({ picks: chosen, seed, k, total: candidates.length }));
  fs.writeFileSync(path.join(dir, 'C-paths.md'), pathReviewText(ev.evals));
  return {
    file,
    seed,
    k,
    candidates: candidates.length,
    picks: chosen.map((p, i) => ({ label: `S${i + 1}`, run_id: p.ev.entry.id, item_id: p.item.id, verdict: p.verdict, role: p.ev.entry.role, model: p.ev.entry.model })),
  };
}

/**
 * A seeded sample of graded (run, item) pairs for a person to check by hand, written to <root>/spotcheck/C.md
 * (and the flagged-path review to C-paths.md). Round-robin over the verdicts found, wrong and missing so the rarer
 * verdicts are looked at too. Never written under outDir.
 * @returns {{file, seed, k, candidates, picks: [{label, run_id, item_id, verdict, role, model}]}}
 */
function spotCheckSample({ root, outDir, seed = SEED, k = SAMPLE_K, repo, privateFile, commitmentFile } = {}) {
  return writeSpotChecks(evaluate({ root, repo, privateFile, commitmentFile }), { root, outDir, seed, k });
}

/**
 * score({root, outDir}) -> the batch C result (81-02 contract). outDir is only used to refuse writing spot checks
 * under it; the scoring CLI writes the result. repo / privateFile / commitmentFile let tests bind other paths.
 */
function score({ root, outDir, repo, privateFile, commitmentFile } = {}) {
  const ev = evaluate({ root, repo, privateFile, commitmentFile });
  const result = buildResult(ev);
  try {
    writeSpotChecks(ev, { root, outDir });
    result.notes.push('A seeded spot-check sample of grader verdicts and the flagged-path review were written to the eval root (spotcheck/C.md and spotcheck/C-paths.md), not to --out: check them by hand.');
  } catch (err) {
    result.notes.push(`The spot-check files were not written: ${err.message}`);
  }
  return result;
}

module.exports = {
  score,
  spotCheckSample,
  evaluate,
  indexFromFiles,
  indexFromDir,
  pathFabrications,
  missingPaths,
  pathCheck,
  negatedMention,
  SEED,
  SAMPLE_K,
  ROLE_ORDER,
};
