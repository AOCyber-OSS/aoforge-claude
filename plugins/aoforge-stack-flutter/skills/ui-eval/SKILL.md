---
name: ui-eval
description: |
  Run the UI visual-evaluation pipeline on a Flutter surface or objective: capture each declared UI state and score it. Two judges produce a BINDING gate: --judge session (fresh subagents of this Claude Code session look at each screenshot; no API key, the default when no key is set) and --judge live (the engine calls the Anthropic API; the default when ANTHROPIC_API_KEY is set). --judge labels is an ADVISORY offline label-echo lookup that can never clear a surface from human verification.
  Use when the user wants to visually evaluate, judge, or dogfood a UI surface's rendered states.
  Triggers on: "visual eval", "evaluate the UI", "ui-eval", "judge the screens", "check the visuals", "does this screen look right?"
argument-hint: "[objective number or manifest path] [--judge session|live|labels]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_snapshot
  - mcp__plugin_playwright_playwright__browser_take_screenshot
  - mcp__plugin_playwright_playwright__browser_click
  - mcp__plugin_playwright_playwright__browser_wait_for
  - mcp__plugin_playwright_playwright__browser_close
---
<objective>
Judge the visual correctness of a Flutter UI surface (or whole objective) by capturing each declared state and scoring it through the already-shipped visual-eval engine — session or live (binding) or labels (advisory).

Purpose: a `gate: 'binding'` clean pass (a real vision comparison: `--judge session` or `--judge live`) is the ONLY result that may drop a surface off the verifier's Step 9 human-verification list; a real defect lands as a `gaps:` entry with screenshot evidence regardless of gate. The default `gate: 'advisory'` path (offline label-echo, no network) is a labels lookup for dogfooding and fast iteration — it surfaces defects it can detect from the label, but a clean advisory pass NEVER clears human verification (aodex#485: an unjudged/label-only pass must not be mistaken for a machine-verified one). Standalone-invocable for dogfooding a single surface.

Output: per-state `*.judge.json` + `ui-eval-report.json` under `.aoforge/objectives/<obj>/evidence/ui_eval/`, plus a verdict rollup.
</objective>

<execution_context>
@~/.claude/aoforge/stacks/flutter/workflows/ui-eval.md
</execution_context>

<context>
Objective or manifest: $ARGUMENTS (optional)
- If an objective number is provided: evaluate that objective's UI surfaces (e.g., "4").
- If a manifest path is provided: evaluate exactly that surface manifest (single-surface dogfood).
- If not provided: locate the active objective's ui_eval manifest; if none, report SKIPPED cleanly.

The scoring engine is already shipped (`plugins/aoforge/aoforge/bin/lib/flutter-ui-eval.cjs`) with the
`ui-evaluator` model profile and the aof-tools arms
`verify flutter-ui-eval <manifest> [--raw] [--judge live|session|labels]` / `flutter-ui eval <manifest> [--raw] [--judge live|session|labels]`.
Both emit a `scoreRun` rollup
`{ verdict: 'pass'|'pass-with-reviews'|'fail', gate: 'binding'|'advisory', counts, reviews[], fails[], unjudged[], states[] }`.
`gate` is the run's STANDING, not its outcome: `'binding'` ONLY from `--judge live` (the engine's own
Anthropic vision call per sample) or `--judge session --score` (bound answers from session subagents);
`'advisory'` on the default (no `--judge`, or
`--judge labels`) offline label-echo path (network:false) — a labels lookup, never a visual gate,
regardless of how clean its verdict is. An unrecognised `--judge` value is rejected with a usage
error rather than silently falling through to the offline path. This skill consumes that engine;
it does not re-implement scoring and does not pick a vision model id.

Project state (digest; `node ~/.claude/aoforge/bin/aof-tools.cjs state get` prints the full file):
!`node ~/.claude/aoforge/bin/aof-tools.cjs state digest --raw 2>/dev/null`
Roadmap (digest; `node ~/.claude/aoforge/bin/aof-tools.cjs roadmap get-objective <N>` prints one objective in full):
!`node ~/.claude/aoforge/bin/aof-tools.cjs roadmap digest --raw 2>/dev/null`
</context>

<process>
Execute the ui-eval workflow from @~/.claude/aoforge/stacks/flutter/workflows/ui-eval.md end-to-end.
Preserve the verdict→action mapping (fail→gaps, review/unjudged→notes, `gate: 'binding'` pass only→
drop-from-human-verify; a `gate: 'advisory'` pass ALWAYS stays on the human-verification list) and
the SKIPPED fall-through on a missing/invalid manifest (never a hard fail).

For deep judgement (capture + score + evidence write + ≤300-token rollup), spawn the agent; otherwise run the
workflow steps inline for a quick single-surface dogfood. Resolve its model first (`{runtime_root}` in the prompt
is what `RUNTIME_ROOT=$(echo ~/.claude/aoforge) && echo "$RUNTIME_ROOT"` prints):

```bash
UI_EVALUATOR_MODEL=$(node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model ui-evaluator --raw)
```

**Pick the judge, then write it into every command and prompt** (a run's meaning must be readable off its
command, objective 32): `--judge <mode>` in `$ARGUMENTS` wins; otherwise `live` when `ANTHROPIC_API_KEY` or
`ANTHROPIC_AUTH_TOKEN` is set, else `session`. `labels` only when asked for. Check with
`[ -n "$ANTHROPIC_API_KEY$ANTHROPIC_AUTH_TOKEN" ] && echo live || echo session`.

```
Task(
  subagent_type="aoforge-stack-flutter:ui-evaluator",
  model="{UI_EVALUATOR_MODEL}",
  prompt="Manifest: {resolved manifest path}. Judge: {session | live | labels}.
  AOForge runtime: {runtime_root}
  ",
  description="UI visual eval"
)
```

**Session judge (`Judge: session`).** Subagents cannot spawn, so this skill runs the judges:
1. The ui-evaluator captures, runs `--judge session --prepare` and returns `## JUDGE REQUESTS READY` (requests
   file, responses dir, judge tier, batches). Read `batches[]` with
   `node -e 'const d=require(process.argv[1]);for(const b of d.batches)console.log(b.batch_id,b.request_file)' "{Requests}"`.
2. Spawn ONE FRESH `ui-judge` per batch, all in one message (they are independent). Never reuse a judge
   subagent, never hand one judge two batches, and never answer a request yourself: each batch holds one
   sample of each state, so N batches give each state N independent looks and the flake vote means something.
   ```
   Task(
     subagent_type="aoforge-stack-flutter:ui-judge",
     model="{judge tier from the block}",
     prompt="Batch file: {request_file}. Read every screenshot it names with the Read tool before answering it.",
     description="UI judge {batch_id}"
   )
   ```
3. Re-spawn the ui-evaluator with the same prompt plus `Responses: {Responses dir}`. It scores
   (`--judge session --score --responses <dir>`), writes the evidence and returns UI-EVAL COMPLETE. A batch
   that returned no file, or answers that do not bind, leave their states `unjudged` (on human verification),
   never passed. Re-run only the failed batches' judges (fresh subagents) if you want them judged.

The prepare and score steps are plain CLI calls, so an inline run uses the same three commands. The verifier
(a subagent) cannot drive session judging; it consumes the evidence this skill writes.

**What a session `binding` gate does and does not prove.** The engine makes no model call on this path: it
trusts that the `ui-judge` subagents looked. It enforces what it can check: every answer names its request's
nonce and the PNG's sha256 (no stale, replayed or cross-state answers; a screenshot changed after prepare voids
its votes), arrives in the file of the batch that was handed that request (no subagent casts two votes for one
state), passes the same schema and `validateJudgeResult` as live, and every sample of a state must be present.
It cannot prove a subagent opened the image, or that the orchestrating session did not write an answer file
itself. Each state's `judged_by[]` records the batch and the model the subagent reported. The live path's
trust is in whoever holds the key and runs it; this path adds trust in the session following this skill. Use
`--judge live` where an independent API call is required (for example CI).

**If the agent returns `## ESCALATION REQUESTED`** (split live votes; objective 76 MEF-06, quick 42): run

```bash
node ~/.claude/aoforge/bin/aof-tools.cjs resolve-model ui-evaluator --escalate-from "{Judge tier from the block}"
```

and read the full JSON. `--escalate-from` takes the judge's tier (`sonnet`), not the Task model alias. A session
run escalates the same way: the re-spawned evaluator re-prepares with `--judge-tier`, and the judges are
spawned on that tier.
- `ceiling: false` and this run has not escalated yet: re-spawn once with `model="{model from the escalation result}"`,
  add `--judge-tier {tier from the escalation result}` to the prompt next to `Judge: live` (or `Judge: session`), put the block verbatim
  in `<prior_attempt>`, and log `Escalated: ui-evaluator {from} → {tier} (split-votes)`.
- `ceiling: true`, `unknown_agent: true` (the pack's models are not mirrored; point to `/aoforge:doctor`), or the
  run already escalated once: report the first rollup as final, keep the split states on human verification,
  and show the block's last section.

Inline runs (no spawn) follow the same rule on the score step's `tier_escalation`: when `requested` is true,
resolve the next rung the same way and re-run the score step once with `--judge live --judge-tier {tier}`.
</process>
