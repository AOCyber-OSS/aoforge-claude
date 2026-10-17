---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "05"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/fixtures/D/capture.cjs
  - scripts/eval81/fixtures/D/recipe.json
  - scripts/eval81/fixtures/D/states.json
  - scripts/eval81/fixtures/D/labels.json
  - scripts/eval81/fixtures/D/png/
  - scripts/eval81/fixtures/D/png.cjs
  - scripts/eval81/fixtures/D/png.test.cjs
  - scripts/eval81/fixtures/D/proofs.test.cjs
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "Four docs-site surfaces each have about five labelled states (about 20 PNGs), mixing ok and broken, captured from this repository's Hugo site with headless Chrome on port 8091, plus objective 74's docs-home pair restored from commit 7a2a07ee"
    - "Every broken state is an ok baseline of the same surface and viewport with one recorded CSS injection, and its defect type is one of the engine's DEFECT_TYPES"
    - "states.json (what the judge is shown) carries only neutral state ids, the surface, the viewport, the expected-appearance text and the PNG path; labels.json (the answer key) carries label, defect type, expected severity, region and baseline, and is never shown"
    - "A proof test decodes each PNG and shows every broken state differs from its baseline inside its declared region by at least the declared share of pixels, that dimensions match the viewport, and that no shown name reveals a label"
  artifacts:
    - path: scripts/eval81/fixtures/D/capture.cjs
      provides: "reproducible capture: hugo build to scratch, static server on 8091, Chrome headless, CSS injection per recipe"
    - path: scripts/eval81/fixtures/D/png.cjs
      provides: "decodePng (8-bit RGB/RGBA, non-interlaced), regionDiffShare"
    - path: scripts/eval81/fixtures/D/labels.json
      provides: "test D answer key"
    - path: scripts/eval81/fixtures/D/states.json
      provides: "the states the judge sees"
  key_links:
    - from: scripts/eval81/fixtures/D/proofs.test.cjs
      to: scripts/eval81/fixtures/D/png.cjs
      via: "region pixel diff against the baseline"
      pattern: "regionDiffShare"
---

# TRD 81-05: Test D fixtures (labelled docs-site screenshots), answer key and defect proofs (UI judge)

<objective>
Capture the labelled screenshots test D judges: four surfaces of this repository's docs site, about five states
each, ok and broken, with objective 74's docs-home pair restored from git history. Record how every image was made,
keep labels out of everything the judge sees, and prove each broken state really differs from its ok baseline
where the label says.

Purpose: SC-2 for test D (4 UI surfaces with labelled states, committed before any live run).
Output: ~20 PNGs, the capture recipe and script, the shown states file, the answer key, a small PNG decoder with
tests, and the proof test. No model call.
</objective>

<file_tree>
scripts/eval81/fixtures/D/
├── capture.cjs        ← CREATE (one-off, reproducible; not run by npm test)
├── recipe.json        ← CREATE (per state: url, viewport, injected CSS or history source)
├── states.json        ← CREATE (shown to the judge)
├── labels.json        ← CREATE (answer key)
├── png/d01.png ... d20.png   ← CREATE
├── png.cjs (+ png.test.cjs)  ← CREATE
└── proofs.test.cjs    ← CREATE
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Objective 74's capture recipe (from `git cat-file -p 7a2a07ee:scripts/__fixtures__/visual-judge/manifest.json`), reuse
it exactly:
- Build: `hugo --source site --minify --baseURL http://127.0.0.1:8091/ --destination <scratch>/site-8091`
- Serve: `python3 -m http.server 8091 --bind 127.0.0.1 --directory <scratch>/site-8091` (background; stop it after)
- Capture: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu
  --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,800 --screenshot=<png> <url>`
- A broken variant is a copy of the built page's `index.html` under a new path with one `<style>` inserted before
  `</head>`.
- Expected text pattern (keep this style, one per surface and viewport): "The AOForge documentation home page: the
  site header with the AOForge brand and navigation links, a large headline and introductory text that fit inside
  the viewport, and readable content sections below. Nothing is cut off at the viewport edge, nothing overlaps,
  and there are no large blank regions."

Restore objective 74's pair (reachable commit 7a2a07ee; the files are not on this tree):
`git cat-file blob 7a2a07ee:scripts/__fixtures__/visual-judge/docs-home.png` and `...docs-home-broken.png`
(write them through a node script into `png/`, renamed to neutral ids).

The engine's taxonomy (`plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs` lines 39-48): DEFECT_TYPES overflow,
blank_empty, misalignment, contrast_legibility, broken_layout, overlap_zindex (read the file for the full list);
SEVERITIES low, medium, high.

Docs pages that exist (`site/content/docs/`): `_index.md`, `guides/ui-eval.md`, `commands/`, `troubleshooting.md`,
`getting-started/`, `reference/`.
</codebase_examples>

<anti_patterns>
- Never port 8080. The server binds 127.0.0.1:8091 only, and is stopped when capture ends.
- Never run `npm run docs:data` or `npm run docs:build`: they rewrite tracked `site/data/aoforge.json` in this
  checkout. Run `hugo` directly with `--destination` under the scratchpad.
- No label in anything shown: PNG names are `d01.png`..`d20.png` assigned in a fixed shuffled order (not ok-first),
  state ids equal the file stem, and `expected` text is the same for every state of one surface and viewport.
- No generated images or text: every image is a real capture or objective 74's real capture.
- Do not commit the scratch site build.
</anti_patterns>

<error_recovery>
- Port 8091 busy: stop the earlier server you started (find it with `lsof -nP -iTCP:8091 -sTCP:LISTEN`); if it is
  not yours, stop and report rather than picking another port.
- Chrome writes a blank PNG (page not rendered in time): add `--virtual-time-budget=5000` and recapture.
- A broken variant that does not visibly change its region (proof fails): strengthen the CSS for that state and
  recapture; never lower the threshold below 0.05.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@.aoforge/objectives/74-operations-decisions/74-01-SUMMARY.md (the fixture section only)
@plugins/aoforge-stack-flutter/lib/flutter-ui-eval.cjs (lines 39-48 taxonomy; 163-178 aggregateVotes; 475-500 visionPerceptualSchema)

Scratch for the build and server: `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/d-capture/`.
One plain command per Bash call.
</context>

<gotchas>
- Test D is judged through a Claude Code session, not the engine's `--judge live` Messages call (that needs an API
  key, user decision 2026-10-17). The judge prompt in 81-10 reuses the engine's per-state text and schema, so
  `expected` here must read like the engine manifest's `expected`.
- The 74 home capture (commit 37381120) predates today's site; it is a valid ok state of the home surface but is
  NOT the pixel baseline for the new home variants. Each broken state names its own baseline in labels.json:
  74's broken image uses 74's ok image; fresh broken images use the fresh ok capture of the same viewport.
- Keep the PNGs small (1280x800 and 390x844 only, device scale 1): total under 3 MB. Report the total in the SUMMARY.
- Mix the severities: include at least two subtle broken states (expected severity medium, for example a
  contrast drop or a 40 px misalignment) so the comparison is not saturated by blatant breakage.
</gotchas>

## State plan (target; adjust ids after shuffling, keep the counts)

| Surface (route) | Viewport | ok states | broken states (defect type, expected severity) |
|-----------------|----------|-----------|-----------------------------------------------|
| home (`/`) | 1280x800 | fresh capture; 74 docs-home | 74 docs-home-broken (overflow + blank_empty, high); hero text over header (overlap_zindex, high); body text colour near background (contrast_legibility, medium) |
| ui-eval guide (`/docs/guides/ui-eval/`) | 1280x800 and 390x844 | 1280 capture; 390 capture | code block forced wide and clipped at 390 (overflow, high); main content hidden leaving a blank page (blank_empty, high); sidebar shifted 40 px over text at 1280 (misalignment, medium) |
| commands (`/docs/commands/`) | 1280x800 | fresh capture | stylesheet links removed, unstyled page (broken_layout, high); header fixed over the first content block (overlap_zindex, high); table cells nowrap overflowing the viewport (overflow, high) |
| troubleshooting (`/docs/troubleshooting/`) | 1280x800 | fresh capture | a white block covering half the content (blank_empty, high); headings clipped by a fixed height with overflow hidden (overflow, medium); content column offset to the right edge (misalignment, high) |

About 6-7 ok and 13-14 broken; record the final counts in labels.json `counts`.

## Test list

Outermost first.
png.cjs
1. decodePng on a hand-built 2x2 RGBA PNG (built in the test from raw rows with zlib.deflateSync and filter 0) returns
   width 2, height 2 and the exact pixels; filter types 1-4 rows decode to the same pixels.
2. decodePng rejects an interlaced or 16-bit PNG with a clear error.
3. regionDiffShare(a, b, region, tol) = share of pixels in the region whose max channel delta exceeds tol; 0 for
   identical images; 1 when the region is fully changed; throws on size mismatch.
proofs
4. Every PNG in states.json exists, decodes, and has the viewport's width and height.
5. Every broken state's regionDiffShare against its baseline is >= its labels.json `min_share` (>= 0.05) and its
   whole-image share is > 0.
6. states.json and the PNG file names contain no label words (ok, broken, fail, pass, overflow, blank, defect,
   contrast, misalign, overlap) and no surface's `expected` text differs between its states of one viewport.
7. labels.json and states.json list the same ids; labels use only engine DEFECT_TYPES and SEVERITIES; counts match.
8. recipe.json has an entry per state (url + viewport + css, or `history: "7a2a07ee:<path>"`).
9. Total PNG bytes < 3 MB.

<tasks>

<task type="auto">
  <name>Task 1: Capture script, recipe and the ~20 screenshots</name>
  <files>scripts/eval81/fixtures/D/capture.cjs, scripts/eval81/fixtures/D/recipe.json, scripts/eval81/fixtures/D/states.json, scripts/eval81/fixtures/D/labels.json, scripts/eval81/fixtures/D/png/</files>
  <action>
<!-- TDD-EXCEPTION: capture.cjs is a one-off reproducible capture tool driven by recipe.json; its output is proven by proofs.test.cjs in Task 3, which is the test of record. -->
Write `capture.cjs` (CLI: `--recipe <recipe.json> --site-out <scratch dir> --png-out <dir> [--only d07]`): run hugo
to `--site-out`, write each variant page (copy of the route's built `index.html` with the recipe's `<style>` before
`</head>`) under `<site-out>/__v/<id>/index.html`, start `python3 -m http.server 8091 --bind 127.0.0.1` in the
site dir, capture each state with the Chrome command above at its viewport, restore the two 74 images with
`git cat-file blob`, then stop the server (always, in a finally). Author recipe.json by hand to the state plan, run
the script, LOOK at every PNG (Read tool) and confirm each ok image looks right and each broken image shows its
defect where the recipe says. Then write states.json (surfaces with `expected` per viewport; states `{id, surface,
viewport, png}`) and labels.json (`{batch: "D", counts, states: [{id, surface, viewport, label: "ok" | "broken",
defect_type, severity, region: {x, y, w, h}, baseline, min_share}]}`), with `region` measured on the image.
  </action>
  <verify>ls scripts/eval81/fixtures/D/png | wc -l reports the planned count; `lsof -nP -iTCP:8091 -sTCP:LISTEN` shows no listener after the run.</verify>
  <done>About 20 neutral-named PNGs, each looked at; recipe, states and labels written; server stopped; this checkout's tracked files unchanged apart from the new D files.</done>
  <recovery>If hugo fails on this tree, record the error and capture from the last hugo-buildable commit via `git worktree add --detach` into the scratchpad (remove the worktree afterwards); name the commit in recipe.json.</recovery>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PNG decoder and region diff</name>
  <files>scripts/eval81/fixtures/D/png.cjs, scripts/eval81/fixtures/D/png.test.cjs</files>
  <action>
RED first per test list 1-3. `decodePng(buffer)` → `{width, height, channels, data}` for 8-bit, non-interlaced,
colour types 2 and 6 (and 0 grayscale if cheap); parse chunks, concatenate IDAT, `zlib.inflateSync`, unfilter (None,
Sub, Up, Average, Paeth). `regionDiffShare(a, b, {x, y, w, h}, tol = 24)`. Pure node, no dependency.
  </action>
  <verify>node --test scripts/eval81/fixtures/D/png.test.cjs</verify>
  <done>Test list 1-3 pass; the decoder reads every PNG captured in Task 1.</done>
  <recovery>If Chrome emits a colour type the decoder lacks, add it with a hand-built test case.</recovery>
</task>

<task type="auto">
  <name>Task 3: Proof test and commit</name>
  <files>scripts/eval81/fixtures/D/proofs.test.cjs</files>
  <action>
Write proofs per test list 4-9 (pure file reads; no Chrome, no hugo, so it runs in CI). Commit all D files with
`node ~/.claude/aoforge/bin/aof-tools.cjs commit "test(81-05): add test D labelled docs screenshots, answer key and proofs" --files scripts/eval81/fixtures/D`.
  </action>
  <verify>node --test scripts/eval81/fixtures/D/proofs.test.cjs</verify>
  <done>Test list 4-9 pass; the commit contains only `scripts/eval81/fixtures/D/**`.</done>
  <recovery>If case 5 fails for a state, recapture it with stronger CSS (Task 1) rather than relaxing min_share.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/fixtures/D/</test>
</validation_gates>

<verification>
- `git status --porcelain site/` is empty after the TRD (the site sources and site/data untouched).
- No process listens on 8091 at the end; 8080 never appears in capture.cjs (`rg -n 8080 scripts/eval81` is empty).
</verification>

<success_criteria>
About 20 real labelled screenshots over 4 surfaces, each broken state proven to differ from its ok baseline where
labelled, labels kept out of what the judge sees, all committed before any live run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-05-SUMMARY.md`
</output>
