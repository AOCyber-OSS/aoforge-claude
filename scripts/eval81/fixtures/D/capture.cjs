#!/usr/bin/env node
'use strict';
/**
 * Test D capture (TRD 81-05): reproduces the labelled docs-site screenshots.
 *
 * One-off and reproducible, NOT run by `npm test` (it needs hugo, Chrome and python3).
 * Everything it does is described by recipe.json:
 *   1. hugo builds this repository's site into --site-out (never into the checkout; it does not run
 *      `npm run docs:data` / `docs:build`, which rewrite the tracked site/data/aoforge.json).
 *   2. A broken variant is a copy of the route's built index.html written under <site-out>/__v/<id>/
 *      with one <style> inserted before </head> (and, for the unstyled variant, the stylesheet <link>
 *      tags removed). An ok state is captured from its real route.
 *   3. python3 -m http.server serves --site-out on 127.0.0.1:8091 only, and is always stopped.
 *   4. Headless Chrome captures each state at its viewport, device scale factor 1. Headless=new clamps the
 *      window to 500 CSS px wide (a 390 px window still lays the page out at 500), so a viewport narrower
 *      than that is captured through a wrapper page holding one iframe of exactly the viewport size: the
 *      page then lays out, and its media queries evaluate, at the true width.
 *   5. A `history` state is restored from git (objective 74's committed capture) with `git cat-file blob`.
 *
 * Usage:
 *   node capture.cjs --recipe recipe.json --site-out <scratch dir> --png-out <dir> [--only d07[,d08]]
 *                    [--skip-build] [--chrome <path>]
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIN_WINDOW_WIDTH = 500;
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function parseArgs(argv) {
  const out = { only: null, skipBuild: false, chrome: DEFAULT_CHROME };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--recipe') out.recipe = argv[++i];
    else if (a === '--site-out') out.siteOut = argv[++i];
    else if (a === '--png-out') out.pngOut = argv[++i];
    else if (a === '--only') out.only = argv[++i].split(',').filter(Boolean);
    else if (a === '--chrome') out.chrome = argv[++i];
    else if (a === '--skip-build') out.skipBuild = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  for (const k of ['recipe', 'siteOut', 'pngOut']) {
    if (!out[k]) throw new Error(`missing required --${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`);
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when something already answers on host:port. */
function portAnswers(host, port) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: '/', timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(host, port, tries) {
  for (let i = 0; i < tries; i++) {
    if (await portAnswers(host, port)) return true;
    await sleep(250);
  }
  return false;
}

/** The built index.html for a route like /docs/guides/ui-eval/. */
function builtPagePath(siteOut, route) {
  const rel = route.replace(/^\/+/, '').replace(/\/+$/, '');
  return path.join(siteOut, rel, 'index.html');
}

function variantHtml(html, state) {
  let out = html;
  if (state.strip_stylesheets) {
    out = out.replace(/<link\s+[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '');
  }
  if (state.css) {
    if (!out.includes('</head>')) throw new Error(`${state.id}: built page has no </head>`);
    out = out.replace('</head>', `<style>${state.css}</style></head>`);
  }
  return out;
}

function writeVariants(recipe, siteOut, ids) {
  for (const state of recipe.states) {
    if (ids && !ids.includes(state.id)) continue;
    if (state.history) continue;
    if (!isVariant(state)) continue; // ok state: captured from its real route
    const src = builtPagePath(siteOut, state.url);
    if (!fs.existsSync(src)) throw new Error(`${state.id}: no built page for ${state.url} (${src})`);
    const dest = path.join(siteOut, '__v', state.id, 'index.html');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, variantHtml(fs.readFileSync(src, 'utf8'), state));
  }
}

function isVariant(state) {
  return Boolean(state.css || state.strip_stylesheets);
}

function needsWrapper(state) {
  return state.viewport.width < MIN_WINDOW_WIDTH;
}

/** The page under test: the real route for an ok state, the written variant otherwise. */
function pageUrl(state, base) {
  if (!isVariant(state)) return base.replace(/\/$/, '') + state.url;
  return `${base}__v/${state.id}/`;
}

function wrapperHtml(state, target) {
  const { width, height } = state.viewport;
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;padding:0;background:#0a0a0a;overflow:hidden}' +
    `iframe{display:block;border:0;width:${width}px;height:${height}px}` +
    `</style></head><body><iframe src="${target}" width="${width}" height="${height}"></iframe></body></html>`
  );
}

function writeWrappers(recipe, siteOut, base, ids) {
  for (const state of recipe.states) {
    if (ids && !ids.includes(state.id)) continue;
    if (state.history || !needsWrapper(state)) continue;
    const dest = path.join(siteOut, '__w', state.id, 'index.html');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, wrapperHtml(state, pageUrl(state, base)));
  }
}

function captureUrl(state, base) {
  return needsWrapper(state) ? `${base}__w/${state.id}/` : pageUrl(state, base);
}

function runChrome(chrome, profileDir, state, url, pngPath) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    `--window-size=${state.viewport.width},${state.viewport.height}`,
    `--screenshot=${pngPath}`,
  ];
  if (state.virtual_time_budget) args.push(`--virtual-time-budget=${state.virtual_time_budget}`);
  args.push(url);
  const res = spawnSync(chrome, args, { encoding: 'utf8', timeout: 90000 });
  if (res.status !== 0 || !fs.existsSync(pngPath)) {
    throw new Error(`${state.id}: chrome failed (status ${res.status}): ${(res.stderr || '').slice(-400)}`);
  }
}

function restoreFromHistory(state, pngPath) {
  const res = spawnSync('git', ['--no-optional-locks', '-C', REPO_ROOT, 'cat-file', 'blob', state.history], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`${state.id}: git cat-file blob ${state.history} failed: ${String(res.stderr).slice(0, 300)}`);
  }
  fs.writeFileSync(pngPath, res.stdout);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipe = JSON.parse(fs.readFileSync(args.recipe, 'utf8'));
  const port = recipe.port || 8091;
  if (port !== 8091) throw new Error(`test D captures on port 8091 only (recipe asks for ${port})`);
  const host = '127.0.0.1';
  const siteOut = path.resolve(args.siteOut);
  const pngOut = path.resolve(args.pngOut);
  const profileDir = path.join(path.dirname(siteOut), 'chrome-profile');
  fs.mkdirSync(pngOut, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });

  if (!args.skipBuild) {
    const build = spawnSync(
      'hugo',
      ['--source', path.join(REPO_ROOT, 'site'), '--minify', '--baseURL', `http://${host}:${port}/`, '--destination', siteOut],
      { encoding: 'utf8', timeout: 180000 },
    );
    if (build.status !== 0) throw new Error(`hugo failed: ${(build.stderr || build.stdout || '').slice(-600)}`);
  }
  writeVariants(recipe, siteOut, args.only);
  writeWrappers(recipe, siteOut, `http://${host}:${port}/`, args.only);

  if (await portAnswers(host, port)) {
    throw new Error(`port ${port} already answers; stop that server (lsof -nP -iTCP:${port} -sTCP:LISTEN) and re-run`);
  }
  let server = null;
  try {
    const needsServer = recipe.states.some((s) => !s.history && (!args.only || args.only.includes(s.id)));
    if (needsServer) {
      server = spawn('python3', ['-m', 'http.server', String(port), '--bind', host, '--directory', siteOut], {
        stdio: 'ignore',
      });
      if (!(await waitForServer(host, port, 40))) throw new Error('static server did not come up');
    }
    for (const state of recipe.states) {
      if (args.only && !args.only.includes(state.id)) continue;
      const pngPath = path.join(pngOut, `${state.id}.png`);
      if (state.history) {
        restoreFromHistory(state, pngPath);
      } else {
        runChrome(args.chrome, profileDir, state, captureUrl(state, `http://${host}:${port}/`), pngPath);
      }
      process.stdout.write(`captured ${state.id} -> ${pngPath}\n`);
    }
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

main().catch((err) => {
  process.stderr.write(`capture failed: ${err.message}\n`);
  process.exitCode = 1;
});
