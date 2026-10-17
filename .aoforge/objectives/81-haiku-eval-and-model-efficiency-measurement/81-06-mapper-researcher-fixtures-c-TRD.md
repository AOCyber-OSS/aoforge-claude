---
objective: 81-haiku-eval-and-model-efficiency-measurement
trd: "06"
type: standard
wave: 1
depends_on: []
files_modified:
  - scripts/eval81/fixtures/C/synthetic.cjs
  - scripts/eval81/fixtures/C/checklists-synthetic.json
  - scripts/eval81/fixtures/C/fleet-commitment.json
  - scripts/eval81/fixtures/C/researcher-topic.md
  - scripts/eval81/fixtures/C/checklists-researcher.json
  - scripts/eval81/fixtures/C/grader-prompt.md
  - scripts/eval81/fixtures/C/grader-schema.json
  - scripts/eval81/fixtures/C/proofs.test.cjs
  - .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/.gitignore
autonomous: true
requirements: [SC-2]
must_haves:
  truths:
    - "buildSynthetic(dir) materialises a small stdlib-only Go service with known facts for each mapper focus (tech, arch, quality, concerns), including six real concerns, and a minimal 3.1.0 `.aoforge/` so `planning draft` works in it"
    - "checklists-synthetic.json holds a reference checklist per focus whose every item names the file and pattern that proves it; a proof test checks each one against a fresh build"
    - "A read-only clone of one private fleet Go repository is pinned by commit; its four focus checklists are written before any run and kept untracked under the objective's private/ directory; only their sha256, item counts and an alias are committed"
    - "One fixed research topic and a checklist per research dimension (stack, features, architecture, pitfalls) are committed, worded so they stay true regardless of the exact current library versions"
    - "The grader prompt and its JSON schema are committed: the grader sees the checklist and the document, never which model wrote it, and returns found | wrong | missing per item plus fabrications"
  artifacts:
    - path: scripts/eval81/fixtures/C/synthetic.cjs
      provides: "buildSynthetic(dir), SYNTHETIC_FACTS"
    - path: scripts/eval81/fixtures/C/checklists-synthetic.json
      provides: "mapper reference checklists, synthetic codebase"
    - path: scripts/eval81/fixtures/C/fleet-commitment.json
      provides: "sha256 commitment for the private fleet checklists"
    - path: scripts/eval81/fixtures/C/checklists-researcher.json
      provides: "researcher reference checklists"
    - path: scripts/eval81/fixtures/C/grader-prompt.md
      provides: "fixed Sonnet grader prompt"
  key_links:
    - from: scripts/eval81/fixtures/C/proofs.test.cjs
      to: scripts/eval81/fixtures/C/fleet-commitment.json
      via: "sha256 of private/fleet-checklists.json when the private file is present"
      pattern: "sha256"
---

# TRD 81-06: Test C fixtures (mapper codebases, researcher topic, reference checklists, grader)

<objective>
Prepare everything test C needs before any run: a synthetic codebase with known facts, a pinned read-only copy of
one fleet repository, a reference checklist per mapper focus for each codebase, one research topic with a checklist
per research dimension, and the fixed grader prompt and schema that will score the outputs.

Purpose: SC-2 for test C (reference checklists written before runs). The fleet repository is private while this
repository is public, so its checklists stay on this machine and only a hash commitment is published.
Output: committed builder, checklists, commitment, topic, grader prompt and schema, and a proof test; an untracked
private checklist file. No model call.
</objective>

<file_tree>
scripts/eval81/fixtures/C/
├── synthetic.cjs                ← CREATE
├── checklists-synthetic.json    ← CREATE
├── fleet-commitment.json        ← CREATE (hash only)
├── researcher-topic.md          ← CREATE
├── checklists-researcher.json   ← CREATE
├── grader-prompt.md             ← CREATE
├── grader-schema.json           ← CREATE
└── proofs.test.cjs              ← CREATE
.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/
├── .gitignore                   ← CREATE (content: "*")
└── fleet-checklists.json        ← CREATE (untracked; never committed)
</file_tree>

<execution_context>
@~/.claude/aoforge/workflows/execute-trd.md
@~/.claude/aoforge/templates/summary.md
</execution_context>

<embedded_context>

<codebase_examples>
Mapper focus outputs (`plugins/aoforge/aoforge/workflows/map-codebase.md` spawn_agents): tech -> STACK.md,
INTEGRATIONS.md; arch -> ARCHITECTURE.md, STRUCTURE.md; quality -> CONVENTIONS.md, TESTING.md, PATTERNS.md;
concerns -> CONCERNS.md. Each spawn writes drafts through `aof-tools planning draft codebase/<NAME>.md`. A checklist
for a focus is scored against the concatenation of that focus's documents.

Project-researcher dimensions (`plugins/aoforge/aoforge/workflows/new-project.md` ~lines 596-760): stack, features,
architecture, pitfalls, each writing `research/<DIM>.md` through `planning draft` + `doc put`.

`node plugins/aoforge/aoforge/bin/aof-tools.cjs codebase facts --focus all --root <dir> --raw` gives language-neutral
facts (manifests, languages, layout, tests, markers, imports); use it on the fleet clone to orient before reading.

The fleet repository (read-only source): `/Users/justin/dev/aoedge`, Go, HEAD d125b8f at planning time, ~677 tracked
files of which 231 are a legacy `.planning/` tree and a `.claude/` directory. It is PRIVATE; this repository is
PUBLIC (`gh repo view` visibility checked 2026-10-17).
</codebase_examples>

<anti_patterns>
- Never write to `/Users/justin/dev/aoedge`, never run a git command there that takes a lock: clone with
  `git --no-optional-locks clone --no-hardlinks /Users/justin/dev/aoedge <scratch>/eval81/fleet/aoedge`, then remove
  the clone's `origin` remote. Record HEAD and `git status --porcelain` of the source before and after; they must
  match.
- Nothing about the fleet repository's contents goes into a committed file: not checklist text, not paths, not
  names of its packages. Committed files call it `fleet-go-service`.
- No generated text (`no_llm_test_data`): write every checklist item yourself from the code you read (fleet) or the
  code you wrote (synthetic), and the researcher checklists from established, citable practice.
- Do not make the synthetic codebase depend on third-party Go modules: a mapper that runs `go build` would download
  modules into the sandbox; stdlib only, and it must compile with `go build ./...` when Go is present.
- No word in the synthetic codebase that reveals a plant ("planted", "concern", "eval", "fixture").
</anti_patterns>

<error_recovery>
- Source HEAD or porcelain changed after cloning: stop, report, do not continue (the clone command must not have
  touched it; investigate before any further access).
- Go not installed: the proof test skips its `go build` case with a message; all other cases still run.
- The private file is absent (CI, another machine): the commitment case skips with "private fleet checklist not
  present on this machine"; it never fails CI.
</error_recovery>

</embedded_context>

<context>
@.aoforge/ROADMAP.md (Objective 81 section only)
@plugins/aoforge/agents/codebase-mapper.md
@plugins/aoforge/agents/project-researcher.md
@plugins/aoforge/aoforge/workflows/map-codebase.md (spawn_agents step)

Scratch: `/private/tmp/claude-501/-Users-justin-dev-aoforge-claude/29d3d902-73eb-439c-9c64-ba469a668a6e/scratchpad/eval81/`.
One plain command per Bash call. Never port 8080.
</context>

<gotchas>
- The fleet copy is on the legacy `.planning/` layout, which 3.1.0 refuses; the mapper's `planning draft` would fail
  there. The C batch spec (81-11) prepares each run's copy: delete `.planning/` and `.claude/` (a project
  `.claude/settings.json` would load hooks and permissions into the run) and add the same minimal `.aoforge/`
  (config.json with the 3.1.0 stamp, PROJECT.md `kind: api`) that the synthetic build adds. Write the fleet
  checklists against that prepared view (code only).
- Checklist items must be checkable from the documents a mapper writes, phrased as facts with `accept_any` phrases
  for the grader, for example `{id: "tech-03", statement: "Configuration comes from environment variables
  LINKCHECK_ADDR and LINKCHECK_DATA", evidence: {path: "internal/config/config.go", pattern: "LINKCHECK_ADDR"},
  accept_any: ["LINKCHECK_ADDR", "environment variable"]}`.
- Researcher items must survive version drift: "names a pure-Go SQLite driver (no cgo) or explains the cgo
  trade-off" rather than a pinned version.
- 8-12 items per focus or dimension: enough for a recall rate, small enough for the grader's ~$5 budget.
</gotchas>

## Synthetic codebase specification

Module `example.com/linkcheck`, `go 1.23`, stdlib only. Files: `cmd/linkcheck/main.go` (flag parsing, starts the
server and a worker pool), `internal/config/config.go` (env `LINKCHECK_ADDR` default `:9090`, `LINKCHECK_DATA`),
`internal/api/handler.go` (net/http mux: `POST /checks`, `GET /checks/{id}`, `GET /healthz`; Go 1.22 pattern
routing), `internal/check/check.go` + `worker.go` (fixed pool of 4 workers, channel queue), `internal/store/file.go`
(JSON file store, one file per check id), tests `internal/check/check_test.go` (table-driven, `httptest.Server`) and
`internal/store/file_test.go`, `log/slog` JSON logging, errors wrapped with `fmt.Errorf("...: %w", err)`,
`Makefile` (build, test, lint with `go vet`), `.github/workflows/ci.yml` (setup-go, `go test ./...`), `Dockerfile`
(multi-stage, distroless static), `README.md`. Six real concerns: `http.Get` with the default client (no timeout)
in check.go; `store.Load(id)` builds a path from the request id with no validation (path traversal); a write
without locking shared by workers (data race); an ignored `Close` error; no tests for `internal/api`; a `// TODO:
rate limit` in handler.go with no limiter. Plus `.aoforge/config.json` (3.1.0 stamp as in 81-03) and
`.aoforge/PROJECT.md` (`kind: api`, one paragraph).

## Test list

1. buildSynthetic builds deterministically (same files and contents twice); it contains no revealing word.
2. Every checklists-synthetic.json item's `evidence.path` exists in the build and matches `evidence.pattern`.
3. Each focus (tech, arch, quality, concerns) has 8-12 items with unique ids; concerns lists all six concerns.
4. With Go on PATH, `go build ./...` and `go vet ./...` succeed in the build (offline: `GOFLAGS=-mod=mod`,
   `GOPROXY=off`, a temp GOPATH/GOCACHE); skipped with a message when Go is absent.
5. fleet-commitment.json has `alias: "fleet-go-service"`, `source_commit` (40 hex), `sha256` (64 hex) and
   `items_per_focus`; when `private/fleet-checklists.json` exists its sha256 and per-focus counts equal the
   commitment; otherwise the case skips.
6. No committed C file contains the fleet repository's name, path or module path (`rg` over
   `scripts/eval81/fixtures/C` for `aoedge` and `aocybersystems` finds nothing).
7. checklists-researcher.json has the four dimensions, 8-12 items each, each with `statement` and `accept_any`.
8. grader-schema.json is valid JSON with required `items[{id, verdict in found|wrong|missing, evidence}]` and
   `fabrications[{claim, why}]`; grader-prompt.md contains `{{CHECKLIST}}` and `{{DOCUMENT}}` and no model name.
9. `private/.gitignore` contains `*`, and `git check-ignore` reports `private/fleet-checklists.json` ignored.

<tasks>

<task type="auto">
  <name>Task 1: Synthetic codebase builder and its checklists</name>
  <files>scripts/eval81/fixtures/C/synthetic.cjs, scripts/eval81/fixtures/C/checklists-synthetic.json</files>
  <action>
Write `synthetic.cjs` exporting `buildSynthetic(dir)` (files as string literals per the specification; a local
deterministic git commit helper as in 81-03 so the mapper sees a history) and `SYNTHETIC_FACTS` (an index from item
id to evidence, mirrored in the checklist file). Write the four focus checklists by hand from the code you wrote,
8-12 items each, every item with `{id, focus, statement, evidence: {path, pattern}, accept_any}`.
  </action>
  <verify>node -e "const s=require('./scripts/eval81/fixtures/C/synthetic.cjs');const fs=require('fs'),os=require('os'),p=require('path');const d=fs.mkdtempSync(p.join(os.tmpdir(),'c-'));s.buildSynthetic(d);console.log(fs.readdirSync(d).join(','))" with TMPDIR under the session scratchpad</verify>
  <done>The build has cmd, internal, Makefile, Dockerfile, .github, .aoforge and a git history; four focus checklists written.</done>
  <recovery>If `go build` fails, fix the Go source (stdlib only) before writing the checklist items that cite it.</recovery>
</task>

<task type="auto">
  <name>Task 2: Fleet clone and private checklists, researcher topic and checklists, grader prompt and schema</name>
  <files>scripts/eval81/fixtures/C/fleet-commitment.json, scripts/eval81/fixtures/C/researcher-topic.md, scripts/eval81/fixtures/C/checklists-researcher.json, scripts/eval81/fixtures/C/grader-prompt.md, scripts/eval81/fixtures/C/grader-schema.json, .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/.gitignore</files>
  <action>
Fleet (read-only source): record `git -C /Users/justin/dev/aoedge --no-optional-locks rev-parse HEAD` and `git -C
/Users/justin/dev/aoedge --no-optional-locks status --porcelain` into the scratch dir; clone with
`git --no-optional-locks clone --no-hardlinks /Users/justin/dev/aoedge <scratch>/eval81/fleet/aoedge`; remove the
clone's origin; delete `.planning/` and `.claude/` from the clone; add the minimal `.aoforge/`. Orient with
`codebase facts --focus all --root <clone> --raw`, read narrowly (`rg -n`, offset/limit), and write four focus
checklists (8-12 items each, same item shape, evidence paths relative to the clone) into
`.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json` together with
`{source_path, source_commit, prepared: ["removed .planning/", "removed .claude/", "added .aoforge/"]}`. Write
`private/.gitignore` containing `*` first. Commit only the hash: `fleet-commitment.json` = `{alias:
"fleet-go-service", language: "go", source_commit, sha256 (of the private file's bytes), items_per_focus}`. Re-check
the source HEAD and porcelain; they must equal the recorded values.

Researcher: `researcher-topic.md` = the fixed topic: "A command-line tool, written in Go, that keeps a local
full-text search index of a folder of Markdown notes and updates it when files change", plus the PROJECT.md
paragraph the runs will use. `checklists-researcher.json`: 8-12 items per dimension. Stack, for example: a pure-Go
SQLite driver with FTS5 or the cgo trade-off; fsnotify for watching; a CommonMark parser such as goldmark; a
current supported Go release. Features: initial index build, incremental update, ranked search with snippets,
front-matter tags, ignore patterns. Architecture: watcher -> debounced queue -> parser -> single-writer indexer;
FTS5 virtual table beside a content table; batched transactions; WAL for concurrent readers. Pitfalls: fsnotify is
not recursive (add subdirectories, handle new ones); editors save by rename (handle Rename/Create); debounce bursts;
tokenizer choice for non-English text (`unicode61 remove_diacritics`); cgo cross-compilation; file-descriptor limits
on large trees.

Grader: `grader-prompt.md` with placeholders `{{TASK}}` (one line: "codebase map, focus tech" or "project research,
dimension pitfalls"), `{{CHECKLIST}}`, `{{DOCUMENT}}`; instructions: mark each item found (stated correctly), wrong
(stated but contradicts the item) or missing; quote the evidence sentence; list fabrications (specific claims about
files, dependencies, commands or behaviour the document asserts that the checklist and the document's own cited
evidence cannot support); return JSON only. `grader-schema.json` per test list 8.
  </action>
  <verify>git check-ignore -v .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/fleet-checklists.json reports the private .gitignore; the source HEAD and porcelain files recorded before and after are identical (compare with `cmp`).</verify>
  <done>Private checklists on disk and ignored; only the hash commitment, topic, researcher checklists, grader prompt and schema are tracked; the fleet source is untouched.</done>
  <recovery>If the source changed between the two checks for a reason unrelated to this TRD (the user working there), record both states, re-clone at the recorded commit with `git -C <clone> checkout <sha>`, and note it in the SUMMARY.</recovery>
</task>

<task type="auto">
  <name>Task 3: Proof test and commit</name>
  <files>scripts/eval81/fixtures/C/proofs.test.cjs</files>
  <action>
<!-- TDD-EXCEPTION: fixture builders and reference checklists are test infrastructure; these proofs are the tests. -->
Write proofs per test list 1-9. Commit the tracked C files and the private `.gitignore` (the ignored checklist is
not added) with `node ~/.claude/aoforge/bin/aof-tools.cjs commit "test(81-06): add test C codebases, checklists, research topic and grader" --files scripts/eval81/fixtures/C .aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/private/.gitignore`.
If the `*` rule keeps the `.gitignore` itself out of `git add`, commit without it and state in the SUMMARY that the
private directory is ignored by its own untracked `.gitignore` (the private file stays ignored either way: verify
with `git status --porcelain --ignored`).
  </action>
  <verify>node --test scripts/eval81/fixtures/C/proofs.test.cjs; `git show --stat HEAD` lists no file under private/ other than possibly .gitignore.</verify>
  <done>Test list 1-9 pass (5 and 4 may skip with their messages); the private checklist is untracked.</done>
  <recovery>If case 6 finds a leaked fleet name in a committed file, remove it, amend nothing already pushed (nothing is pushed in this objective), and re-commit.</recovery>
</task>

</tasks>

<validation_gates>
<test>node --test scripts/eval81/fixtures/C/proofs.test.cjs</test>
<test>node --test plugins/aoforge/aoforge/bin/lib/rename-guard.repo.test.cjs</test>
</validation_gates>

<verification>
- `rg -n -i -e aoedge -e aocybersystems scripts/eval81` finds nothing. (The repository name already appears in
  older tracked planning files, so planning prose such as this TRD and the SUMMARY may name the source path; no
  committed file may quote checklist contents or describe the private code.)
- The fleet source's HEAD and porcelain are unchanged.
</verification>

<success_criteria>
Mapper checklists for two codebases (one public synthetic, one private fleet copy committed by hash), researcher
checklists for four dimensions, and a fixed blind grader, all in place before any run.
</success_criteria>

<output>
After completion, create `.aoforge/objectives/81-haiku-eval-and-model-efficiency-measurement/81-06-SUMMARY.md`
</output>
