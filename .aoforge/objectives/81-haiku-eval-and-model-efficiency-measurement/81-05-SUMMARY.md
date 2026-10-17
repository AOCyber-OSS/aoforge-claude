---
objective: 81-haiku-eval-and-model-efficiency-measurement
job: "05"
subsystem: testing
tags: [eval, ui-judge, fixtures, screenshots, hugo, headless-chrome, png]

requires:
  - objective: 74-operations-decisions
    provides: the committed docs-home capture pair (commit 7a2a07ee) restored as d09 and d15
provides:
  - "20 labelled docs-site screenshots (7 ok, 13 broken) over 4 surfaces, neutral ids d01-d20"
  - "states.json (what the judge is shown) and labels.json (the answer key, never shown)"
  - "capture.cjs + recipe.json: the reproducible capture, pixel-exact on a full rebuild"
  - "png.cjs (decodePng, regionDiffShare, diffBounds) and the proof test"
affects: [81-10 batch spec and scorer D, 81-13 rehearsal and freeze, 81-16 live batch D]

tech-stack:
  added: []
  patterns:
    - "answer key split from shown data: the judge sees states.json only; labels.json carries label, defect type, severity, region, baseline, min_share"
    - "every broken state = the ok state of the same surface and viewport plus one recorded CSS injection"
    - "region proof: share of pixels in the declared region whose max RGB channel delta exceeds 24, floor 0.05"

key-files:
  created:
    - scripts/eval81/fixtures/D/capture.cjs
    - scripts/eval81/fixtures/D/recipe.json
    - scripts/eval81/fixtures/D/states.json
    - scripts/eval81/fixtures/D/labels.json
    - scripts/eval81/fixtures/D/png/ (d01.png .. d20.png)
    - scripts/eval81/fixtures/D/png.cjs
    - scripts/eval81/fixtures/D/png.test.cjs
    - scripts/eval81/fixtures/D/proofs.test.cjs
  modified: []

key-decisions:
  - "390 px states are captured through a 390x844 iframe wrapper because headless=new Chrome clamps its window to 500 px wide"
  - "states.json expected text avoids every label word, including the 'overlaps' and 'blank' of objective 74's wording, so test 6 can scan the whole file"
  - "region is the footprint of the injected defect; min_share = max(0.05, floor(0.9 x measured, 0.01)); a region whose text share fell below 0.05 was narrowed to where the text sits, the threshold was never lowered"
  - "d15 (74's broken home) carries defect_type overflow with also_defect_types [blank_empty]; labels otherwise hold one defect type"

patterns-established:
  - "Neutral ids: d01-d20 from a seeded shuffle (mulberry32, seed 81), PNG file stem equals the state id, expected text is one per surface and viewport"

requirements-completed: [SC-2]

verification:
  gates_defined: 1
  gates_passed: 1
  auto_fix_cycles: 1
  tdd_evidence: true
  test_pairing: true

duration: 12min
completed: 2026-10-17
tokens_input: 11653497
tokens_output: 94891
tokens_cache_read: 11456928
tokens_cache_write: 196419
token_model: "claude-sonnet-5-5"
tokens_source: "live"
---

# Objective 81 TRD 05: Test D fixtures (labelled docs-site screenshots), answer key and defect proofs Summary

**Twenty real captures of this repository's Hugo docs site (7 ok, 13 broken, four surfaces, two viewports, 1.7 MB) with a shown-states file, a separate answer key, a pixel-exact reproducible capture script and 36 passing tests that prove every broken state differs from its ok baseline where the label says.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-17T16:11:50Z
- **Completed:** 2026-10-17T16:24:00Z
- **Tasks:** 3 of 3 (Task 2 first, see Deviations)
- **Files modified:** 27 (7 source and data files, 20 PNGs); nothing outside `scripts/eval81/fixtures/D/` besides this SUMMARY

## Accomplishments

- **The fixture set.** Surfaces: home (5 states), ui-eval guide (5, at 1280x800 and 390x844), commands (5), troubleshooting (5, at both viewports). 7 ok and 13 broken: overflow 4, blank_empty 2, misalignment 2, overlap_zindex 2, contrast_legibility 2, broken_layout 1; severity high 9, medium 4 (d03, d08, d12 and d17 are the subtle ones). Objective 74's pair is restored byte-exact from commit 7a2a07ee as d09 (ok) and d15 (broken); they show v3.0.0 and are paired with each other, not with the fresh v3.1.0 home capture d16.
- **Reproducible capture.** `capture.cjs` builds the Hugo site to the scratchpad (never `docs:data` or `docs:build`), writes each variant as a copy of the built page with one `<style>` before `</head>`, serves port 8091 only, captures with headless Chrome and always stops the server. A second full rebuild into a clean directory produced all 20 PNGs identical at tolerance 0. No listener remained on 8091.
- **Answer key kept out of view.** `states.json` carries only `{id, surface, viewport, png}` per state plus one `expected` text per surface and viewport, with no label word anywhere. `labels.json` carries label, defect type, severity, region, baseline and min_share. The ids come from a seeded shuffle, so the order is neither ok-first nor grouped by surface.
- **Proof.** `png.cjs` is a dependency-free PNG decoder (8-bit, non-interlaced, colour types 0, 2, 4, 6; CRC checked) with `regionDiffShare` and `diffBounds`. `proofs.test.cjs` decodes every PNG and shows each broken state differs from its baseline inside its region by at least `min_share` (13 of 13), that sizes match the viewport, that no shown name reveals a label, that ids and enums agree with the engine's DEFECT_TYPES and SEVERITIES, and that the PNGs total 1,696,104 bytes (under 3 MB).

## Task Evidence

| Task | Verify Command | Exit Code | Status |
|---|---|---|---|
| 1: Capture script, recipe and screenshots | `ls scripts/eval81/fixtures/D/png \| wc -l` (20); `lsof -nP -iTCP:8091 -sTCP:LISTEN` (no listener, exit 1) | 0 / 1 (expected) | PASS |
| 2: PNG decoder and region diff | `node --test 'scripts/eval81/fixtures/D/png.test.cjs'` (19 pass) | 0 | PASS |
| 3: Proof test | `node --test 'scripts/eval81/fixtures/D/proofs.test.cjs'` (17 pass) | 0 | PASS |

## Task Commits

1. **Task 2 (RED): failing decoder tests** - `52f5e9d4` (test)
2. **Task 2 (GREEN): PNG decoder and region diff** - `22fd72b9` (feat)
3. **Task 1: capture script, recipe, states, labels, 20 PNGs** - `ebb274cf` (test)
4. **Task 3: proof test** - `e5634dc2` (test)

## Validation Gate Results

| Gate | Command | Exit Code | Status |
|---|---|---|---|
| test (TRD gate) | `node --test 'scripts/eval81/fixtures/D/*.test.cjs'` (36 pass; the directory form `node --test scripts/eval81/fixtures/D/` fails on Node 24, as sibling 81-01 reported) | 0 | PASS |
| site untouched | `git status --porcelain site/` (empty) | 0 | PASS |
| no forbidden port | `rg -n 8080 scripts/eval81` (no match) | 1 (no match, expected) | PASS |
| no listener left | `lsof -nP -iTCP:8091 -sTCP:LISTEN` | 1 (expected) | PASS |
| lint / build | no lint or build command in this repository's stack profile | n/a | not_available |

## TDD Evidence

| Phase | Command | Exit Code | Expected |
|---|---|---|---|
| RED | `node --test 'scripts/eval81/fixtures/D/png.test.cjs'` (png.cjs absent) | 1 | FAIL (correct) |
| GREEN | `node --test 'scripts/eval81/fixtures/D/png.test.cjs'` | 0 | PASS (correct, 19 tests) |

Tasks 1 and 3 are not `tdd="true"`. Task 1 carries a TDD-EXCEPTION (capture tool, proven by the Task 3 proof test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Headless Chrome cannot render a 390 px viewport**
- **Found during:** Task 1, first ok capture of the guide at 390x844
- **Issue:** `--headless=new` clamps the window to 500 CSS px wide (a page printed `innerWidth` 500 for `--window-size=390,844`), so the screenshot was a 500 px layout cropped to 390 px, with the header and text cut off.
- **Fix:** `capture.cjs` loads any state narrower than 500 px inside one iframe of exactly the viewport size on a wrapper page, so the page lays out and evaluates its media queries at 390 px. Recorded in `recipe.json`.
- **Files modified:** `scripts/eval81/fixtures/D/capture.cjs`, `recipe.json`
- **Commit:** `ebb274cf`

**2. [Rule 1 - Bug] Three injections did not show the defect they were written for**
- **Found during:** Task 1, looking at every PNG
- **Issue:** d05 (hero over header): `.hero{overflow:hidden}` clipped the moved headline at the header edge, a clipping defect, not an overlap. d17 (sidebar 40 px): `position:relative` kept the sticky `top` offset, which shifted the sidebar 84 px down as well as 40 px right. d06 (code block at 390): too subtle, the card still looked like a normal scrolling code block.
- **Fix:** d05 adds `.hero{overflow:visible}`; d17 adds `top:0`; d06 adds `white-space:nowrap` on the lede and paragraphs so text runs off the edge. All three recaptured and looked at again.
- **Commit:** `ebb274cf`

**3. [Rule 3 - Blocking] Expected text could not reuse objective 74's wording**
- **Found during:** Task 1, writing `states.json`
- **Issue:** 74's `expected` text contains "overlaps" and "blank", two of the label words test 6 forbids anywhere in `states.json`.
- **Fix:** reworded in the same style ("no element sits on top of another", "no large empty areas"). It is one text per surface and viewport, so it cannot differ between ok and broken states.

**4. [Ordering] Task 2 ran before Task 1**
- The decoder was needed to measure each region and `min_share` on the captures, so Task 2 (RED `52f5e9d4`, GREEN `22fd72b9`) was committed first. The tasks are independent; its "decoder reads every PNG captured in Task 1" criterion is covered by `proofs.test.cjs`. The TRD's single closing commit became per-task commits.

### Additions beyond the test list (all inside this TRD's files)

- `diffBounds` in `png.cjs` (bounding box of changed pixels, used to measure regions) with one test; extra decoder cases (each of the four filters, RGB, grayscale, split IDAT, palette and non-PNG refusal; `decodePng` also verifies each chunk's CRC); extra proof tests beyond list items 4-9 (baseline is an ok state of the same surface and viewport, one injection per broken state, interleaved ids, at least two medium states, port 8091 only).
- `also_defect_types: ["blank_empty"]` on d15 (74 recorded overflow and blank_empty for it).

### Notes for downstream TRDs (81-10, 81-13, 81-16)

- Region and `min_share` were measured on the committed PNGs. Two natural regions fell below the 0.05 floor on this dark theme (small text on a near-black ground), d12 (table body) and d17 (sidebar), so their regions cover only where the text sits; no threshold was lowered. d12 sits at the 0.05 floor on a measured 0.0607.
- The judge sees `states.json` plus the PNG; `expected` is looked up as `surfaces[surface].expected["<w>x<h>"]`. Surface ids: `home`, `ui-eval-guide`, `commands`, `troubleshooting`.
- Fonts come from Typekit at capture time; the committed PNGs are the record, and a rebuild reproduced them exactly on this machine and network.

## Post-TRD Verification

- Auto-fix cycles used: 1 (one recapture round fixed d05, d06, d17)
- Must-haves verified: 4/4 (about 20 labelled states incl. 74's pair; every broken state an ok baseline plus one recorded injection with an engine defect type; states.json neutral and labels.json separate; proof test decodes and compares)
- Gate failures: None

## Discovered commands

None. Every command came from the TRD (hugo, python3 http.server, Chrome headless, `node --test`); the stack profile (`general`) names no lint or build gate.

## Self-Check: PASSED

- Files found: capture.cjs, recipe.json, states.json, labels.json, png.cjs, png.test.cjs, proofs.test.cjs, png/d01.png .. d20.png (20)
- Commits found: 52f5e9d4, 22fd72b9, ebb274cf, e5634dc2
- Final test run: 36 tests, 36 pass, 0 fail

## Progress
- [x] Task 1: Capture script, recipe and the ~20 screenshots — ebb274cf
- [x] Task 2: PNG decoder and region diff — 52f5e9d4 (RED), 22fd72b9 (GREEN)
- [x] Task 3: Proof test and commit — e5634dc2
