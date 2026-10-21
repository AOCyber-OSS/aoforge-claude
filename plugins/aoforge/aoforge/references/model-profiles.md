# Model Profiles

Model profiles control which Claude model each AOForge agent uses. This allows balancing quality vs token spend.

> **Source of truth:** `aoforge/references/model-profiles.json` — the table below is derived from that file. To add a new agent or change tier assignments, edit the JSON; do not change `aof-tools.cjs`.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | frontmatter `effort` |
|-------|-----------|------------|----------|----------------------|
| `planner` | opus | opus | sonnet | xhigh |
| `roadmapper` | opus | sonnet | sonnet | high |
| `executor` | opus | sonnet | sonnet | xhigh |
| `objective-researcher` | opus | sonnet | haiku | — |
| `project-researcher` | opus | sonnet | haiku | — |
| `research-synthesizer` | sonnet | sonnet | haiku | — |
| `debugger` | opus | sonnet | sonnet | xhigh |
| `codebase-mapper` | sonnet | haiku | haiku | — |
| `verifier` | sonnet | sonnet | sonnet | — |
| `job-checker` | sonnet | sonnet | sonnet | — |
| `integration-checker` | sonnet | sonnet | haiku | — |
| `security-auditor` | opus | sonnet | sonnet | xhigh |

Agent keys are the bare agent names (`planner`, `executor`). `aof-tools resolve-model`
and every compound `init` command read only that spelling; any other name is an
unknown agent, which warns on stderr and falls back to `sonnet`. TRD 28-02 made the
table bind, and quick 40 removed the prefixed alias that fix had kept.

## Per-focus tiers and the verdict floor (TRD 76-06)

`focus{}` gives a spawn's focus its own tiers, overlaid on the agent's row when the spawn names it
(`resolve-model <agent> --focus <f>`; `init map-codebase` emits `mapper_models`, and `init
new-project` / `init new-milestone` emit `researcher_models`, one model per focus):

| Agent | Focus | `quality` | `balanced` | `budget` |
|-------|-------|-----------|------------|----------|
| `codebase-mapper` | `arch` | sonnet | sonnet | sonnet |
| `codebase-mapper` | `concerns` | sonnet | sonnet | sonnet |
| `project-researcher` | `architecture` | opus | sonnet | sonnet |
| `project-researcher` | `pitfalls` | opus | sonnet | haiku |

A focus entry never sits below its agent's row (`model-profiles.test.cjs` refuses it), and a
lower tier than a focus had before needs a recorded eval. Objective 81 recorded one
(`81-HAIKU-EVAL.md`), and the user approved five proposals on 2026-10-17 ("P3, P2-arch-only, P1,
P4, P5"), applied by objective 82 (TRD 82-03):

- **P2, `codebase-mapper` `arch` raised to sonnet on balanced and budget.** The architecture
  mapper alone: `tech` and `quality` stay on the shared `codebase-mapper` row (sonnet / haiku /
  haiku), and the quality profile's mapper tier is unchanged. Haiku made 3.00 fabrications per
  run against Sonnet's 0.75 (recall 41/46 against 39/46). Caveat: the refusal rests on three
  misnamed files in one Haiku fleet run.
- **P3, `codebase-mapper` `concerns` raised to sonnet on budget.** Haiku's concerns recall was
  21/38 against Sonnet's 26/38 (-13.2 points).
- **P4 and P5, `project-researcher` `architecture` and `pitfalls` lowered to haiku on budget.**
  This reversed 76-06's raise to sonnet and put both back on the agent's own `budget` tier.
  Recall was 21/22 (P4) and 22/22 (P5) on Haiku against 17/22 and 21/22 on Sonnet, with
  fabrications 0 against 0. Caveat: n = 2 runs per model, a weak endorsement.
  - **P4 measured by 82-08 and not applied:** an item was lost (hub HU-A01: Sonnet 2 of 2 runs,
    Haiku 0 of 2), so `architecture` is opus / sonnet / sonnet again (pooled recall 43/46 against
    45/46 and fabrications 0 against 0 held).
  - **P5 measured by 82-08 and kept:** no item lost, pooled recall 39/44 against Sonnet's 42/44
    (6.8 points, inside the 10-point bound), fabrications 0 against 0 per run.

P1 (the UI judge) lives in the stack pack that ships it, not in this table, and is described below.
**P1, P4 and P5 stayed only if they passed TRD 82-08's live measurement** against the rule
pre-registered in `82-CHECK-RULES.md` (TRD 82-06), on two new topics (`82-TIER-CHECKS.md`): P1 and
P4 were reverted, P5 was kept.

### UI judge start tier (stack pack)

A stack pack sets its own agents' tiers in its manifest `models{}` (`resolve-model` reads them from
the mirrored pack). The pack that ships the `ui-evaluator` vision judge sets it to opus / sonnet /
sonnet (`quality` / `balanced` / `budget`), so the judge starts at sonnet on balanced and budget. A
split vote escalates one rung up (sonnet to opus, `resolve-model ui-evaluator --escalate-from
sonnet`) through that pack's `ui-eval` skill, and opus is the ceiling. P1 (start at haiku,
escalate to sonnet; `81-HAIKU-EVAL.md`: Haiku 18/20 against Sonnet's 20/20 with a split rate of
8/20 against 2/20) was applied by TRD 82-03, measured by 82-08 and not applied:
broken_missed(Haiku start, final) = 1 of 13 broken states, and the pre-registered rule needs 0
(`82-TIER-CHECKS.md`; accuracy 19/20 against the Sonnet start's 18/20 and cost $0.13 against
$1.15 held; split rate 2/20, escalation rate 1/20). Caveat: all three Sonnet sessions also judged
that broken state (d17) ok, so the miss looks like a fixture or judge-prompt question rather than
a tier one, and 20 states is a small sample; revisiting P1 on a larger sample is a recorded todo.
`verdict_floor` is unchanged and does not list `ui-evaluator`.

## Tier → model id

`models{}` is live, not documentation: a stack pack's vision judge reads it and
sends the id to the Messages API. A stale id here is a runtime defect, not a
cosmetic one.

| Tier | Model id |
|------|----------|
| `opus` | `claude-opus-5-5` |
| `sonnet` | `claude-sonnet-5-5` |
| `haiku` | `claude-haiku-5-5` |

Doctor check 13 (`model-profiles`) and `validate health` W063 flag a pin that
`references/model-rates.json` shows superseded (a newer version of the same
family is priced there) or does not price at all, so the rate table and these
pins cannot drift apart silently.

The `opus` tier resolves to the Task alias `inherit`, so the agent keeps the
session model rather than pinning one.

## Why `effort` lives in frontmatter, not this table

`Task()` takes no effort argument — reasoning effort is declared in each agent's
own frontmatter, so it cannot vary by profile.

**Haiku 4.5 rejects the `effort` parameter.** Any agent that can resolve to the
`haiku` tier in *any* profile therefore must not declare `effort`, or that run
fails. Only these never reach haiku and can carry it: `planner`,
`roadmapper`, `executor`, `debugger`, `security-auditor`, and since TRD 76-06 `verifier` and
`job-checker`. Stack pack agents (a pack's visual judge, for example) take their
tiers from the pack manifest's `models`, not this table.
`model-profiles.test.cjs` enforces this.

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical objectives

## Resolution Logic

Orchestrators resolve the model before spawning, through one resolver (`resolveAgentModel` in `lib/init.cjs`):
`aof-tools resolve-model <agent> [--objective N] [--focus f] [--escalate-from m] --raw` and every compound init
command call it, so they cannot disagree. Pass the result as the Task model.

The profile comes first: OBJECTIVE.md/TRD override > config `model_profile` > `"auto"` → the (kind, work)
defaults-table cell > `balanced`. Then the tier, highest first (the JSON names the winner in `tier_source`):

1. `--escalate-from <model the attempt ran on>`: one rung above that model, whatever supplied it, an override
   included. `tier_source: escalation`.
2. `model_overrides[agent]`: a tier, `inherit` or a concrete model id. It applies on every profile and focus, and
   to an agent missing from the table too. It is **not floored**. `tier_source: model_overrides`.
3. The project's `agent_models[agent][profile]`. `tier_source: agent_models`.
4. The `focus{}` tier for `--focus`. `tier_source: focus`.
5. The package table row, then its `balanced` entry, then `sonnet`. `tier_source: table`.

Over 3-5 the verdict floor raises `verifier` and `job-checker` to `verdict_floor.tier`
(`tier_source: verdict_floor`). The `opus` tier resolves to the `inherit` alias.

`"auto"` is opt-in on purpose: neither adopt nor the config template writes `model_profile`, and the
table puts every feature and port objective on `quality` (TRD 76-01).

## Per-Agent Overrides

Override specific agents without changing the entire profile using `agent_models` in `.aoforge/config.json`. Partial overrides are supported — only specified agents/tiers are replaced:

```json
{
  "model_profile": "balanced",
  "agent_models": {
    "planner": { "quality": "sonnet" },
    "executor": { "balanced": "opus", "budget": "sonnet" }
  }
}
```

Keys are the bare agent names, the only spelling read. An `agent_models` tier beats the focus tier and the package
default, and stays under the verdict floor. Valid tier values: `opus`, `sonnet`, `haiku`.

`model_overrides` is a flat per-agent pin (a tier, `inherit` or a model id) that wins over the profile and is not
floored:

```json
{ "model_overrides": { "debugger": "haiku" } }
```

`--escalate-from` still goes one rung above it.

## Switching Profiles

Runtime: `/aoforge:set-profile <profile>`

Per-project default: Set in `.aoforge/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Complexity-Based Overrides

Beyond static profiles, workflows can dynamically adjust model selection based on task complexity. These overrides augment — never replace — the profile system.

### When to Downgrade

| Scenario | From | To | Rationale |
|----------|------|----|-----------|
| Well-known domain research | profile model | haiku | Standard stack/feature research is pattern matching, not reasoning |
| Gap-closure planning (`--gaps`) | profile model | sonnet | Fixes are scoped and diagnosed — less architectural reasoning needed |
| Re-verification after fixes | profile model | sonnet | Checking known items against codebase, not open-ended analysis |
| Research synthesis (< 3000 words input) | profile model | haiku | Small input = simple aggregation task |

### When to Upgrade

| Scenario | From | To | Rationale |
|----------|------|----|-----------|
| 3rd revision attempt (job-checker loop) | profile model | opus | Repeated failures suggest subtlety that needs stronger reasoning |
| Complex debugging (3+ hypotheses failed) | profile model | opus | Deep investigation requires more capable model |
| Complex execution (> 5 tasks, > 8 files) | profile model | opus | Large plans benefit from stronger context management |

### Application Pattern

Orchestrators assess complexity before spawning agents:

```
1. Evaluate complexity indicators (task_count, files_modified, iteration_count, input_size)
2. Check override conditions from tables above
3. If override applies: pass adjusted model to Task() call
4. Log override: "Model override: {agent} {profile_model} → {override_model} (reason: {reason})"
```

### Safety Rules

- **Never downgrade executor below sonnet** — code-writing agents need sufficient reasoning
- **Never downgrade planner below sonnet** — architecture decisions require reasoning
- **Overrides are per-spawn, not persistent** — each spawn re-evaluates complexity
- **User model_overrides in config.json take precedence** over complexity-based overrides

## Design Rationale

**Why Opus for planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for executor?**
Executors follow explicit JOB.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the objective promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**Why `inherit` instead of passing `opus` directly?**
Claude Code's `"opus"` alias maps to a specific model version. Organizations may block older opus versions while allowing newer ones. AOForge returns `"inherit"` for opus-tier agents, causing them to use whatever opus version the user has configured in their session. This avoids version conflicts and silent fallbacks to Sonnet.
