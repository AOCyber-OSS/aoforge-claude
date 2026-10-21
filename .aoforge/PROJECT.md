---
kind: plugin
default_work: feature
org: AOCyberAI
github_repo: AOCyberAI/aoforge-claude
---

# AOForge

## What This Is

AOForge is a meta-prompting, context engineering, and spec-driven development system for Claude Code. It ships as a Claude Code plugin (`aoforge@aocyber`) installed via `/plugin` or the Claude Desktop plugin UI. Maintained by AO Cyber Systems. Until 3.0.0 (2026-10-09) it was named DevFlow (`devflow@aocyber`, repository `devflow-claude`).

## Core Value

AI workflow orchestration for Claude Code sessions — skills, hooks, MCP integration, planning state, and program-aware coordination across the AO-Cyber-Systems org.

## Current Milestone

None open. v1.6 Hardening & Release completed on 2026-10-21 (`.aoforge/MILESTONES.md`); the next milestone starts with `/aoforge:milestone new`.

## Requirements

Requirement IDs live in `.aoforge/REQUIREMENTS.md` while a milestone is open, and in `milestones/vX.Y-REQUIREMENTS.md` once it completes.

### Validated

The capability areas listed under `## Scope`: skills, subagents, hooks, `.aoforge/` templates and `aof-tools.cjs`; the program-aware coordination layer (v1.1+); the project lifecycle (v1.3+); self-measurement (v1.3+); GitHub as an opt-in system of record (v1.4+); and environment diagnosis and repair (v1.4+). v1.2 shipped 2026-07-22, v1.3 completed 2026-09-28, v1.4 completed 2026-10-05 (58/58 requirement IDs), v1.5 completed 2026-10-08 (35/36; EST-08 not met, accepted) and v1.6 completed 2026-10-21 (39/41; EST-11 not met and MEF-06 partial, both accepted). v1.5 added: the edit gate on Bash writes, objective-number correctness, state and merge plumbing, store-mode observability, Claude Code built-in adoption and the estimation engine. v1.6 added: the rename to AOForge (3.0.0) and the shim removal (3.1.0), stack packs (Flutter, Dart and web procedure out of core), measured model tiers and build-cell token cuts, handoff result injection, `/aoforge:adopt` for pre-rename projects, the `main` ruleset and the docs deploy (see `## Context`).

### Active

None until the next milestone is defined.

### Out of Scope

See `## Out of Scope` below.

## Scope

AOForge (repository `aoforge-claude`) owns:

- **Skills** (`/aoforge:*` slash commands): planning, building, debugging, verification, todos, intent resolution
- **Subagents**: planner, executor, verifier, debugger, etc.
- **Hooks**: SessionStart sync, gate-commits, gate-edits, gate-interactive, route-intent, statusline, verifiers
- **Templates** for `.aoforge/` artifacts (PROJECT, OBJECTIVE, ROADMAP, JOB, SUMMARY, STATE)
- **`aof-tools.cjs`**: central CLI used by skills/agents for state ops, objective ops, model resolution, GitHub integration, changelog generation, intent resolution
- **Program-aware coordination layer** (v1.1+): cross-repo awareness via GitHub Issues + Projects v2 substrate
- **Project lifecycle** (v1.3+):
  - per-project stack profile (`.aoforge/STACK.md`, `aof-tools stack`);
  - in-place upgrades of projects and global `~/.claude` state (`aof-tools upgrade`, migration registry, managed CLAUDE.md blocks);
  - unattended adoption of existing repos (`/aoforge:adopt`);
  - self-correcting documentation (command-reference checker, staleness advisories).
- **Self-measurement** (v1.3+): `aof-tools context|session-audit|transcript-export|override|telemetry`, `validate health` Checks 12–14
- **GitHub as system of record** (v1.4+, opt-in via `github.enabled` + `github.store`):
  - planning state lives in issues, TRD sub-issues, comments, the wiki and native milestones, written through an outbox, with `.aoforge/` as a rebuildable cache;
  - every planning write goes through an aof-tools verb;
  - one linked branch and PR per objective, enforced locally and by required checks, with `gh setup` to configure a repo;
  - in-place migration (0011, `/aoforge:gh-sync migrate`).
- **Environment diagnosis** (v1.4+): `aof-tools doctor` / `/aoforge:doctor`, and the codebase-aware stack drafter (`stack init|verify|report|mcp`)
- **Estimation** (v1.5+): `aof-tools calibrate` and `aof-tools estimate` (task to milestone, run state, status-line ETA, backtest), measured out of sample against real executions
- **Claude Code built-in integration** (v1.5+): task progress, plan mode, AskUserQuestion and the todo task list across skills and workflows, with a CI ratchet and a living inventory (`docs/built-in-integration-status.md`)
- **Stack packs** (3.1.0, v1.6): stack-specific procedure ships in pack plugins (`aoforge-stack-flutter`, `aoforge-stack-web`) that a project selects through its stack profile; core names no stack
- **Rename leftovers** (3.0.0 shims, removed in 3.1.0, v1.6): AOForge reads only AOForge names; the pre-rename layout and names are detected only to report them, and `/aoforge:adopt` moves a pre-rename project onto `.aoforge/`

## Out of Scope

- Local development platform (project registry, baseline stack, secrets, toolchain orchestration) — that's `devflow` (Go CLI/daemon)
- AI gateway, routing rules, model catalog — that's `aosentry`
- Identity, teams, projects, knowledge, agent control plane backend — that's `aodex`
- Native macOS UI — that's `aodex-flutter`

## Architectural Principles

### Plan org-aware, execute repo-focused

Planning consults the org's broader state (sibling repos, eden-libs reuse opportunities, the org Product Roadmap) to surface overlap, duplication risk, and shared-service opportunities. Execution stays a local heads-down loop with at most an async preamble pulling thin context.

The brains go at plan time where overlap/duplication/shared-service decisions actually matter; execution stays a local heads-down loop with at most a thin context preamble.

### Continue executing — no manual paste

When Claude hits a command it can't run itself (TTY-interactive, shell-flow, password-prompt), the system queues the handoff and Claude continues with parallel work. The `aoforge-watch` daemon (shipped v1.1 as `devflow-watch`, PTY-backed since v1.2) executes queued commands in the user's interactive shell — including TTY-interactive auth flows — and injects results back. The user never has to manually paste `! cmd`. Three known PTY architectural gaps (dispatch-wrapper isatty, wrapper stdin race, detector late-match) are documented for v1.3+.

### Measure it, don't assert it

Since v1.3, claims that AOForge is better are backed by repeatable measurements rather than stated:
- `session-audit` classifies blocking events;
- `context` measures context composition;
- every objective carries an independent VERIFICATION.md, and v1.3 retro-verified 27–34;
- since v1.5, gate defaults are set from measured false-positive rates (the Bash edit gate ships `warn` because its measured upper bound was 0.035 > 0.02), and the estimator is judged by an out-of-sample backtest with pre-registered thresholds. A failed measurement is reported as failed (EST-08), not tuned until it passes.

The fixes to AOForge's own gates count as done only when the post-release audit shows the blocking categories have collapsed.

### Ambient mode — routing is authoritative

Since v1.2, AOForge routing is enforcement, not advice: `route-intent.js` injects obligatory routing directives, `classify-session.js` classifies sessions at start, and `gate-edits.js` denies ambient edits by default (per-repo `gates.editGate: warn|strict|off` knob since obj 25). Skills arm a `.aoforge/.skill-active` marker to permit edits.

### Foundation first; adoption follows

AOForge provides the *mechanics* for coordination. Adopting those mechanics across the org's repos (issue templates, label taxonomy, sub-issue backfilling, draft-milestone promotion) is parallel program work, not part of AOForge's roadmap.

## Distribution

- Source of truth: `plugins/aoforge/` (skills, agents, hooks, runtime)
- Marketplace: `.claude-plugin/marketplace.json` (ships `aoforge`, the stack packs `aoforge-stack-flutter` and `aoforge-stack-web`, and the sibling plugins; the `devflow` pointer plugin was removed in 3.1.0)
- Installation: `/plugin marketplace add AOCyber-OSS/aoforge-claude` (the public mirror) then enable `aoforge@aocyber`. Source of truth: `AOCyberAI/aoforge-claude`; `oss-mirror.yml` pushes `main` and the tags to the mirror
- Version sync: `package.json`, `plugins/aoforge/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` must match on every release
- Releases: a `v*` tag triggers the changelog gate and `release.yml` (the GitHub release and the `aoforge--vX.Y.Z` alias the packs resolve core from); tag the merge commit on `main` (the marketplace installs from `main`, so a local or branch tag changes nothing for users)
- Runtime mirror: `sync-runtime` copies `plugins/aoforge/aoforge/` to `~/.claude/aoforge/` only when the plugin is newer (since quick 21). An older, still-running session can no longer downgrade it, but sessions started on a pre-2.11.0 plugin can until they are quit.

## Org Context

- Organization: `AOCyberAI`
- Master roadmap: GitHub Project ID `PVT_kwDOFEhtQc4BnqOy` ("Product Roadmap")
  - Custom fields: Status (Todo/In Progress/Done), Product (8 product lines), Quarter (Q1 2026 → Q4 2027)
- Repos in the AO-Cyber-Systems org AOForge coordinates with:
  - `aodex` (Rails API + Go port — agent control plane, knowledge, MCP)
  - `aosentry` (Go — AI gateway, routing rules, local model catalog)
  - `aodex-flutter` (Flutter macOS app — Hub UI)
  - `eden-libs` (shared SDK across products)
  - `devflow` (Go CLI/daemon — local dev platform; sibling, not subordinate)
  - `eden-biz`, `aocyber-cloud`, `eden-ui`, etc.

## Repo Layout

```
aoforge-claude/
├── .aoforge/                    # planning state (this directory tree)
├── .claude-plugin/              # marketplace metadata
├── plugins/aoforge/             # plugin source — single source of truth for distribution
│   ├── .claude-plugin/plugin.json
│   ├── skills/<name>/SKILL.md
│   ├── agents/<agent>.md
│   ├── hooks/{hooks.json,*.js}
│   └── aoforge/                 # runtime mirrored to ~/.claude/aoforge/ on session start
│       ├── bin/aof-tools.cjs
│       ├── workflows/<name>.md
│       ├── references/<name>.md
│       └── templates/<name>.md
├── plugins/aoforge-stack-*/     # stack packs (flutter, web): stack-specific procedure, selected per project
├── docs/                        # design proposals, implementation plans
├── CHANGELOG.md
└── package.json
```

## Constraints

- All hooks must be idempotent and fast (<200ms typical) — they run on every relevant tool call
- Distribution is via Claude Code plugin marketplace; no npm publish
- Three version files must stay in sync on every release
- Plugin must work with both interactive Claude Code sessions and background subagent execution
- Milestone names (v1.1, v1.2) are planning nomenclature, NOT release versions — release tags follow the plugin's own semver (v2.x); never tag a bare `v1.2`-style milestone name (release-on-tag CI triggers on `v*`)

## Context

v1.6 Hardening & Release completed on 2026-10-21 with 18 objectives (65–82). It shipped plugin 2.14.0 (the v1.5 work, Objective 65), 3.0.0 (the rename to AOForge, 2026-10-09, tag `v3.0.0` b4a9d870) and 3.1.0 (2026-10-21, tag `v3.1.0` on `main` f907f4fc, alias `aoforge--v3.1.0`, mirrored to `AOCyber-OSS/aoforge-claude`). v1.5 (55–64) completed 2026-10-08, v1.4 (42–54) 2026-10-05, v1.3 (27–41) 2026-09-28, and v1.2 shipped 2026-07-22.

Test suite (3.1.0 re-validation): 13,773 tests, 13,746 pass, 0 fail, 27 skipped (`watcher-shell.test.cjs` runs in the node:26 CI gate; it hangs on a fish child locally).

The repository moved in the GitHub org cutover (2026-10-17/18) from `AO-Cyber-Systems/aoforge-claude` to `AOCyberAI/aoforge-claude`; the legacy org became `AOCyber-OSS` and holds the public mirror. The `main` ruleset was restored after the move as 25541130 (`.github/rulesets/main.json`).

Operations decisions (Objective 74), all closed:
- the live visual judge runs locally only on the user's own credential; no Anthropic credential in GitHub (OPS-01);
- `main` changes only through a PR with `test (npm test, gated)` green (OPS-02);
- the docs site deploys from `main` to the Cloudflare Pages project `aoforge-docs` in the AOCyber Systems account, which also serves devflow.cloud and www.devflow.cloud (OPS-03, met 2026-10-21).

Estimation: EST-11, the prospective retest of EST-08's criterion, was not met (75-RETEST); minutes still run high. MEF-06 is partial by design: escalation is in place and the start tiers were changed only where the pre-registered live checks kept them (objective 82).

DECISION-001 (edit-gate posture) was resolved in v1.5 (Objective 60, option-a, with a measured `warn` default). Objective 26 (GitHub issue auto-build monitor) was killed on 2026-10-01 (GMD-04).

---
*Last updated: 2026-10-21 after the v1.6 milestone*
