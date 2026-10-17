'use strict';

/**
 * Test C synthetic codebase (TRD 81-06).
 *
 * buildSynthetic(dir) materialises `example.com/linkcheck`: a small stdlib-only Go service with a known set of
 * facts per mapper focus (tech, arch, quality, concerns), six real defects for the concerns focus, a five-commit
 * git history with a fixed author and fixed dates, and the minimal AOForge 3.1.0 planning tree (`.aoforge/config.json`
 * and `.aoforge/PROJECT.md`) that `aof-tools planning draft` needs.
 *
 * Every file is a string literal below and is written into the target directory, never stored as a real tree under
 * scripts/ (npm test globs scripts/, and a nested `.aoforge/` here would confuse tools that walk planning roots).
 * Go sources and the Makefile are written with two-space indentation and converted to tabs (gofmt / make syntax).
 *
 * SYNTHETIC_FACTS is the index from checklist item id to its evidence `{path, pattern, absent?}`, read from
 * checklists-synthetic.json so the two never drift. `pattern` is a JavaScript RegExp source applied with the `m`
 * flag to the file's text; when `path` is a directory it is applied to the directory's entry names; `absent: true`
 * means the pattern must NOT match.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const AUTHOR = { name: 'Linkcheck Maintainer', email: 'maintainer@example.invalid' };

/** Leading two-space indentation to tabs, for gofmt-formatted Go and make recipes. */
function tabs(text) {
  return text.replace(/^((?: {2})+)/gm, (m) => '\t'.repeat(m.length / 2));
}

const GO_MOD = `module example.com/linkcheck

go 1.23
`;

const MAIN_GO = tabs(`// Command linkcheck runs the link checking service.
package main

import (
  "context"
  "errors"
  "flag"
  "fmt"
  "log/slog"
  "net/http"
  "os"
  "os/signal"
  "syscall"
  "time"

  "example.com/linkcheck/internal/api"
  "example.com/linkcheck/internal/check"
  "example.com/linkcheck/internal/config"
  "example.com/linkcheck/internal/store"
)

func main() {
  debug := flag.Bool("debug", false, "log at debug level")
  flag.Parse()

  level := slog.LevelInfo
  if *debug {
    level = slog.LevelDebug
  }
  logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))

  if err := run(logger); err != nil {
    logger.Error("linkcheck stopped", "err", err)
    os.Exit(1)
  }
}

func run(logger *slog.Logger) error {
  cfg := config.Load()

  st, err := store.New(cfg.DataDir)
  if err != nil {
    return fmt.Errorf("open store: %w", err)
  }

  ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
  defer stop()

  pool := check.NewPool(st, logger)
  pool.Start(ctx)

  srv := &http.Server{
    Addr:              cfg.Addr,
    Handler:           api.New(st, pool, logger),
    ReadHeaderTimeout: 5 * time.Second,
  }

  go func() {
    <-ctx.Done()
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(shutdownCtx); err != nil {
      logger.Error("shutdown", "err", err)
    }
  }()

  logger.Info("listening", "addr", cfg.Addr, "data", cfg.DataDir, "workers", check.Workers)
  if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
    return fmt.Errorf("serve: %w", err)
  }
  pool.Wait()
  return nil
}
`);

const CONFIG_GO = tabs(`// Package config reads the service settings from the environment.
package config

import "os"

// Config holds the service settings.
type Config struct {
  Addr    string // listen address, from LINKCHECK_ADDR
  DataDir string // directory for check results, from LINKCHECK_DATA
}

// Load reads LINKCHECK_ADDR and LINKCHECK_DATA, falling back to defaults.
func Load() Config {
  return Config{
    Addr:    getenv("LINKCHECK_ADDR", ":9090"),
    DataDir: getenv("LINKCHECK_DATA", "data"),
  }
}

func getenv(key, fallback string) string {
  if v := os.Getenv(key); v != "" {
    return v
  }
  return fallback
}
`);

const HANDLER_GO = tabs(`// Package api serves the HTTP interface for submitting and reading checks.
package api

import (
  "encoding/json"
  "errors"
  "io/fs"
  "log/slog"
  "net/http"
  "net/url"
  "time"

  "example.com/linkcheck/internal/check"
  "example.com/linkcheck/internal/store"
)

// maxBody limits the size of a request body.
const maxBody = 1 << 20

// Server holds the dependencies of the handlers.
type Server struct {
  store *store.FileStore
  pool  *check.Pool
  log   *slog.Logger
}

// New returns the HTTP handler of the service.
func New(st *store.FileStore, pool *check.Pool, logger *slog.Logger) http.Handler {
  s := &Server{store: st, pool: pool, log: logger}
  mux := http.NewServeMux()
  // TODO: rate limit
  mux.HandleFunc("POST /checks", s.createCheck)
  mux.HandleFunc("GET /checks/{id}", s.getCheck)
  mux.HandleFunc("GET /healthz", s.healthz)
  return mux
}

type createRequest struct {
  URL string \`json:"url"\`
}

func (s *Server) createCheck(w http.ResponseWriter, r *http.Request) {
  var req createRequest
  if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(&req); err != nil {
    s.writeError(w, http.StatusBadRequest, "body must be JSON with a url field")
    return
  }
  u, err := url.ParseRequestURI(req.URL)
  if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
    s.writeError(w, http.StatusBadRequest, "url must be an absolute http or https URL")
    return
  }

  id, err := check.NewID()
  if err != nil {
    s.log.Error("new id", "err", err)
    s.writeError(w, http.StatusInternalServerError, "could not create check")
    return
  }
  c := &check.Check{ID: id, URL: u.String(), Status: check.StatusPending, CreatedAt: time.Now().UTC()}
  if err := s.store.Save(c); err != nil {
    s.log.Error("save check", "id", id, "err", err)
    s.writeError(w, http.StatusInternalServerError, "could not create check")
    return
  }
  if !s.pool.Submit(id) {
    s.writeError(w, http.StatusServiceUnavailable, "queue full, try again later")
    return
  }
  s.writeJSON(w, http.StatusAccepted, c)
}

func (s *Server) getCheck(w http.ResponseWriter, r *http.Request) {
  id := r.PathValue("id")
  c, err := s.store.Load(id)
  if errors.Is(err, fs.ErrNotExist) {
    s.writeError(w, http.StatusNotFound, "no such check")
    return
  }
  if err != nil {
    s.log.Error("load check", "id", id, "err", err)
    s.writeError(w, http.StatusInternalServerError, "could not read check")
    return
  }
  s.writeJSON(w, http.StatusOK, c)
}

func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
  s.writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "completed": s.pool.Completed()})
}

func (s *Server) writeError(w http.ResponseWriter, code int, msg string) {
  s.writeJSON(w, code, map[string]string{"error": msg})
}

func (s *Server) writeJSON(w http.ResponseWriter, code int, v any) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(code)
  if err := json.NewEncoder(w).Encode(v); err != nil {
    s.log.Warn("write response", "err", err)
  }
}
`);

const CHECK_GO = tabs(`// Package check fetches URLs and records whether they answered.
package check

import (
  "crypto/rand"
  "encoding/hex"
  "fmt"
  "net/http"
  "time"
)

// Status is the state of a check.
type Status string

// Check states.
const (
  StatusPending Status = "pending"
  StatusDone    Status = "done"
  StatusFailed  Status = "failed"
)

// Check is one URL check and its result.
type Check struct {
  ID        string    \`json:"id"\`
  URL       string    \`json:"url"\`
  Status    Status    \`json:"status"\`
  Code      int       \`json:"code,omitempty"\`
  Error     string    \`json:"error,omitempty"\`
  CreatedAt time.Time \`json:"created_at"\`
  CheckedAt time.Time \`json:"checked_at"\`
}

// NewID returns a random 16-character hex id.
func NewID() (string, error) {
  b := make([]byte, 8)
  if _, err := rand.Read(b); err != nil {
    return "", fmt.Errorf("generate id: %w", err)
  }
  return hex.EncodeToString(b), nil
}

// Run fetches c.URL and records the response code on c.
func Run(c *Check) error {
  c.CheckedAt = time.Now().UTC()
  resp, err := http.Get(c.URL)
  if err != nil {
    c.Status = StatusFailed
    c.Error = err.Error()
    return fmt.Errorf("fetch %s: %w", c.URL, err)
  }
  defer resp.Body.Close()

  c.Code = resp.StatusCode
  if resp.StatusCode >= 400 {
    c.Status = StatusFailed
    c.Error = resp.Status
    return nil
  }
  c.Status = StatusDone
  return nil
}
`);

const WORKER_GO = tabs(`package check

import (
  "context"
  "log/slog"
  "sync"
)

// Workers is the number of checks run at the same time.
const Workers = 4

// queueSize bounds the number of checks waiting for a worker.
const queueSize = 100

// Store persists checks. The store package implements it.
type Store interface {
  Load(id string) (*Check, error)
  Save(c *Check) error
}

// Pool runs queued checks on a fixed set of workers.
type Pool struct {
  queue     chan string
  store     Store
  log       *slog.Logger
  wg        sync.WaitGroup
  completed int
}

// NewPool returns a pool that loads and saves checks through st.
func NewPool(st Store, logger *slog.Logger) *Pool {
  return &Pool{
    queue: make(chan string, queueSize),
    store: st,
    log:   logger,
  }
}

// Start launches the workers. They stop when ctx is done.
func (p *Pool) Start(ctx context.Context) {
  for i := range Workers {
    p.wg.Add(1)
    go p.work(ctx, i)
  }
}

// Submit queues a check id. It reports false when the queue is full.
func (p *Pool) Submit(id string) bool {
  select {
  case p.queue <- id:
    return true
  default:
    return false
  }
}

// Completed returns the number of checks finished since start.
func (p *Pool) Completed() int {
  return p.completed
}

// Wait blocks until every worker has returned.
func (p *Pool) Wait() {
  p.wg.Wait()
}

func (p *Pool) work(ctx context.Context, n int) {
  defer p.wg.Done()
  for {
    select {
    case <-ctx.Done():
      return
    case id := <-p.queue:
      p.process(n, id)
    }
  }
}

func (p *Pool) process(n int, id string) {
  c, err := p.store.Load(id)
  if err != nil {
    p.log.Error("load check", "id", id, "err", err)
    return
  }
  if err := Run(c); err != nil {
    p.log.Warn("check failed", "id", id, "worker", n, "err", err)
  }
  if err := p.store.Save(c); err != nil {
    p.log.Error("save check", "id", id, "err", err)
    return
  }
  p.completed++
  p.log.Debug("check done", "id", id, "worker", n, "status", c.Status)
}
`);

const FILE_GO = tabs(`// Package store keeps checks as JSON files, one file per check.
package store

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"

  "example.com/linkcheck/internal/check"
)

// FileStore saves each check as <dir>/<id>.json.
type FileStore struct {
  dir string
}

// New returns a store rooted at dir, creating the directory if needed.
func New(dir string) (*FileStore, error) {
  if err := os.MkdirAll(dir, 0o755); err != nil {
    return nil, fmt.Errorf("create data dir %s: %w", dir, err)
  }
  return &FileStore{dir: dir}, nil
}

func (s *FileStore) path(id string) string {
  return filepath.Join(s.dir, id+".json")
}

// Save writes c to its file, replacing any earlier version.
func (s *FileStore) Save(c *check.Check) error {
  f, err := os.Create(s.path(c.ID))
  if err != nil {
    return fmt.Errorf("create check %s: %w", c.ID, err)
  }
  defer f.Close()

  if err := json.NewEncoder(f).Encode(c); err != nil {
    return fmt.Errorf("encode check %s: %w", c.ID, err)
  }
  return nil
}

// Load reads the check with the given id.
func (s *FileStore) Load(id string) (*check.Check, error) {
  data, err := os.ReadFile(s.path(id))
  if err != nil {
    return nil, fmt.Errorf("read check %s: %w", id, err)
  }
  var c check.Check
  if err := json.Unmarshal(data, &c); err != nil {
    return nil, fmt.Errorf("decode check %s: %w", id, err)
  }
  return &c, nil
}
`);

const CHECK_TEST_GO = tabs(`package check

import (
  "net/http"
  "net/http/httptest"
  "testing"
)

func TestRun(t *testing.T) {
  srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/ok":
      w.WriteHeader(http.StatusOK)
    case "/gone":
      w.WriteHeader(http.StatusNotFound)
    default:
      w.WriteHeader(http.StatusInternalServerError)
    }
  }))
  defer srv.Close()

  tests := []struct {
    name       string
    path       string
    wantStatus Status
    wantCode   int
  }{
    {name: "ok", path: "/ok", wantStatus: StatusDone, wantCode: http.StatusOK},
    {name: "not found", path: "/gone", wantStatus: StatusFailed, wantCode: http.StatusNotFound},
    {name: "server error", path: "/boom", wantStatus: StatusFailed, wantCode: http.StatusInternalServerError},
  }
  for _, tc := range tests {
    t.Run(tc.name, func(t *testing.T) {
      c := &Check{ID: "0123456789abcdef", URL: srv.URL + tc.path, Status: StatusPending}
      if err := Run(c); err != nil {
        t.Fatalf("Run: %v", err)
      }
      if c.Status != tc.wantStatus {
        t.Errorf("status = %q, want %q", c.Status, tc.wantStatus)
      }
      if c.Code != tc.wantCode {
        t.Errorf("code = %d, want %d", c.Code, tc.wantCode)
      }
    })
  }
}

func TestRunUnreachable(t *testing.T) {
  srv := httptest.NewServer(http.NotFoundHandler())
  addr := srv.URL
  srv.Close()

  c := &Check{ID: "0123456789abcdef", URL: addr, Status: StatusPending}
  if err := Run(c); err == nil {
    t.Fatal("Run: want an error for a closed server")
  }
  if c.Status != StatusFailed {
    t.Errorf("status = %q, want %q", c.Status, StatusFailed)
  }
}

func TestNewID(t *testing.T) {
  a, err := NewID()
  if err != nil {
    t.Fatalf("NewID: %v", err)
  }
  b, err := NewID()
  if err != nil {
    t.Fatalf("NewID: %v", err)
  }
  if len(a) != 16 || a == b {
    t.Errorf("NewID = %q, %q; want two different 16-character ids", a, b)
  }
}
`);

const FILE_TEST_GO = tabs(`package store

import (
  "errors"
  "io/fs"
  "testing"
  "time"

  "example.com/linkcheck/internal/check"
)

func TestSaveLoad(t *testing.T) {
  s, err := New(t.TempDir())
  if err != nil {
    t.Fatalf("New: %v", err)
  }
  want := &check.Check{
    ID:        "0123456789abcdef",
    URL:       "https://example.com/",
    Status:    check.StatusDone,
    Code:      200,
    CreatedAt: time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC),
  }
  if err := s.Save(want); err != nil {
    t.Fatalf("Save: %v", err)
  }
  got, err := s.Load(want.ID)
  if err != nil {
    t.Fatalf("Load: %v", err)
  }
  if got.URL != want.URL || got.Status != want.Status || got.Code != want.Code || !got.CreatedAt.Equal(want.CreatedAt) {
    t.Errorf("Load = %+v, want %+v", got, want)
  }
}

func TestLoadMissing(t *testing.T) {
  s, err := New(t.TempDir())
  if err != nil {
    t.Fatalf("New: %v", err)
  }
  if _, err := s.Load("0000000000000000"); !errors.Is(err, fs.ErrNotExist) {
    t.Errorf("Load error = %v, want fs.ErrNotExist", err)
  }
}
`);

const MAKEFILE = tabs(`BINARY := bin/linkcheck

.PHONY: build test lint

build:
  go build -o $(BINARY) ./cmd/linkcheck

test:
  go test ./...

lint:
  go vet ./...
`);

const CI_YML = `name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: go vet ./...
      - run: go test ./...
`;

const DOCKERFILE = `FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -o /out/linkcheck ./cmd/linkcheck

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/linkcheck /linkcheck
ENV LINKCHECK_ADDR=:9090 LINKCHECK_DATA=/data
VOLUME /data
EXPOSE 9090
ENTRYPOINT ["/linkcheck"]
`;

const GITIGNORE = `/bin/
/data/
`;

const README = `# linkcheck

linkcheck is a small HTTP service that checks whether links still answer. Submit a URL and a background worker
fetches it and records the response code.

## Running

    make build
    LINKCHECK_ADDR=:9090 LINKCHECK_DATA=./data ./bin/linkcheck

| Variable | Default | Meaning |
|---|---|---|
| \`LINKCHECK_ADDR\` | \`:9090\` | Listen address |
| \`LINKCHECK_DATA\` | \`data\` | Directory for check results |

Pass \`-debug\` for debug logging. Logs are JSON on stdout.

## API

- \`POST /checks\` with \`{"url": "https://example.com/"}\` queues a check and returns \`202 Accepted\` with the check.
- \`GET /checks/{id}\` returns the check: \`status\` is \`pending\`, \`done\` or \`failed\`, and \`code\` is the HTTP
  status the URL answered with.
- \`GET /healthz\` reports \`{"status": "ok"}\` and the number of completed checks.

## Development

    make test   # go test ./...
    make lint   # go vet ./...
`;

/**
 * The 3.1.0 `templates/config.json` copied here (pinned, so a later template change cannot alter the build) plus
 * the 3.1.0 stamp. Every template section must be present or migration 0001 is pending and the SessionStart upgrade
 * hook would rewrite and commit config.json inside a run.
 */
const AOFORGE_CONFIG = `${JSON.stringify(
  {
    mode: 'yolo',
    depth: 'standard',
    job_checker_enabled: true,
    workflow: {
      research: true,
      job_check: true,
      verifier: true,
      auto_advance: true,
      verifier_checkpoints: false,
      decision_queue: false,
    },
    planning: { commit_docs: true, search_gitignored: false },
    parallelization: {
      enabled: true,
      job_level: true,
      task_level: false,
      skip_checkpoints: true,
      max_concurrent_agents: 3,
      min_jobs_for_parallel: 2,
    },
    gates: {
      confirm_project: true,
      confirm_objectives: true,
      confirm_roadmap: true,
      confirm_breakdown: true,
      confirm_job: true,
      execute_next_job: true,
      issues_review: true,
      confirm_transition: true,
      editGate: 'strict',
    },
    safety: { always_confirm_destructive: true, always_confirm_external_services: true },
    workstreams: { worktree_prefix: '../{project}-ws-', branch_prefix: 'df/ws-', merge_strategy: 'squash' },
    github: {
      enabled: false,
      store: false,
      mirror_only: false,
      repo: '',
      milestone_prefix: 'v',
      project_cache_ttl_minutes: 360,
      app_login: '',
      app_id: '',
      checks_workflow: '',
      labels: {
        objective: 'aoforge:objective',
        in_progress: 'aoforge:in-progress',
        gaps: 'aoforge:gaps',
        trd: 'aoforge:trd',
        decision: 'aoforge:decision',
      },
      wiki: { remote: '' },
      pr: { merge_method: 'squash' },
    },
    awareness: {
      cache_ttl_minutes: 10,
      peer_stale_days: 30,
      branch_patterns: ['feature/*', 'df/*', 'fix/*', 'proposal/*'],
      org_project_id: 'PVT_kwDODwqLrc4BRsOP',
      sibling_repos: [],
      eden_libs_path: null,
    },
    daemon: {
      notifications: false,
      notify_on_start: true,
      notify_on_complete: true,
      auto_launch: false,
      multi_project: false,
      cross_shell: [],
      status_line: false,
    },
    aoforge: {
      version: '3.1.0',
      migrations_applied: ['0001', '0004', '0007', '0009', '0012', '0013'],
      upgraded_at: '2026-10-01T09:00:00.000Z',
    },
  },
  null,
  2,
)}\n`;

/**
 * The minimal AOForge 3.1.0 planning tree that `planning draft` needs: the stamped config and a PROJECT.md with
 * `kind: api`. The fleet copy gets the same tree with FLEET_PROJECT (TRD 81-11 prepares it per run).
 */
function minimalAoforge({ title, paragraph }) {
  return {
    '.aoforge/config.json': AOFORGE_CONFIG,
    '.aoforge/PROJECT.md': `---\nkind: api\ndefault_work: feature\n---\n\n# ${title}\n\n${paragraph}\n`,
  };
}

const SYNTHETIC_PROJECT = {
  title: 'linkcheck',
  paragraph: [
    'linkcheck is a small HTTP service, written in Go with only the standard library, that accepts URLs, checks them in',
    'the background and reports whether each one answered. A publishing pipeline calls it to find broken links before a',
    'page goes live.',
  ].join('\n'),
};

/** Neutral on purpose: it says nothing about the private code it sits beside. */
const FLEET_PROJECT = {
  title: 'service',
  paragraph: 'An existing Go service. This file declares the project kind for the planning tools.',
};

/** The commit sequence: each entry adds its files to the tree, in order. */
const COMMITS = [
  {
    message: 'feat: link checking service with a file store',
    date: '2026-09-01T09:00:00Z',
    files: {
      'go.mod': GO_MOD,
      'cmd/linkcheck/main.go': MAIN_GO,
      'internal/config/config.go': CONFIG_GO,
      'internal/api/handler.go': HANDLER_GO,
      'internal/check/check.go': CHECK_GO,
      'internal/check/worker.go': WORKER_GO,
      'internal/store/file.go': FILE_GO,
    },
  },
  {
    message: 'test: cover check runs and the file store',
    date: '2026-09-02T14:30:00Z',
    files: {
      'internal/check/check_test.go': CHECK_TEST_GO,
      'internal/store/file_test.go': FILE_TEST_GO,
    },
  },
  {
    message: 'build: add Makefile, CI workflow and Dockerfile',
    date: '2026-09-03T11:15:00Z',
    files: {
      Makefile: MAKEFILE,
      '.github/workflows/ci.yml': CI_YML,
      Dockerfile: DOCKERFILE,
      '.gitignore': GITIGNORE,
    },
  },
  {
    message: 'docs: add README',
    date: '2026-09-04T10:00:00Z',
    files: { 'README.md': README },
  },
  {
    message: 'chore: add project planning config',
    date: '2026-10-01T09:00:00Z',
    files: minimalAoforge(SYNTHETIC_PROJECT),
  },
];

/** Every file of the build as {relPath: content}, in commit order. */
function syntheticFiles() {
  const out = {};
  for (const commit of COMMITS) Object.assign(out, commit.files);
  return out;
}

function gitEnv(isoDate) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: 'C',
    TZ: 'UTC',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
  };
}

/** Run git in dir with the deterministic env; never reads the user's git config. Throws on failure. */
function git(dir, args, isoDate) {
  const r = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', '-c', 'core.autocrlf=false', ...args],
    { cwd: dir, env: gitEnv(isoDate), encoding: 'utf8' },
  );
  if (r.error) throw new Error(`git ${args[0]} could not start: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`git ${args[0]} failed (exit ${r.status}): ${r.stderr.trim()}`);
  return r.stdout;
}

/** Write files and commit them with a fixed author, date and message. */
function gitCommit(dir, files, message, isoDate) {
  const rels = Object.keys(files);
  for (const rel of rels) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel]);
  }
  git(dir, ['add', '--', ...rels], isoDate);
  git(dir, ['commit', '-q', '--no-verify', '-m', message], isoDate);
}

/**
 * Materialise the synthetic codebase into dir (created when missing; must be empty).
 * Returns {dir, head, files} where head is the final commit id and files the sorted relative paths.
 */
function buildSynthetic(dir) {
  if (typeof dir !== 'string' || dir === '') throw new TypeError('buildSynthetic(dir): dir must be a path');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length > 0) throw new Error(`buildSynthetic: ${dir} is not empty`);
  git(dir, ['init', '-q'], COMMITS[0].date);
  for (const commit of COMMITS) gitCommit(dir, commit.files, commit.message, commit.date);
  const head = git(dir, ['rev-parse', 'HEAD'], COMMITS[0].date).trim();
  return { dir, head, files: Object.keys(syntheticFiles()).sort() };
}

const CHECKLIST_PATH = path.join(__dirname, 'checklists-synthetic.json');

function loadFacts() {
  const doc = JSON.parse(fs.readFileSync(CHECKLIST_PATH, 'utf8'));
  const facts = {};
  for (const items of Object.values(doc.checklists)) {
    for (const item of items) facts[item.id] = Object.freeze({ ...item.evidence });
  }
  return Object.freeze(facts);
}

const SYNTHETIC_FACTS = loadFacts();

module.exports = {
  buildSynthetic,
  syntheticFiles,
  minimalAoforge,
  SYNTHETIC_FACTS,
  SYNTHETIC_PROJECT,
  FLEET_PROJECT,
  COMMITS,
  AUTHOR,
};
