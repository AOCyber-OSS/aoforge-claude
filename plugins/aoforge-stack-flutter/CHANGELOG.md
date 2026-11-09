# Changelog

All notable changes to the aoforge-stack-flutter stack pack. Released with tags named `aoforge-stack-flutter--vX.Y.Z`.

## [Unreleased]

### Added

- `verify flutter-ui-eval --judge session`: the binding visual judge without an API key. The Claude Code session's
  own subagents look at the screenshots and the engine makes no model call. It runs in two steps.
  `--prepare` writes `judge-requests.json` and one `judge-batches/<batch_id>.request.json` per batch, with one
  request per state and sample. Each request carries the absolute PNG path, its sha256, the expected anchor, the
  live prompt (shared `visionPromptText`), the answer schema and a random nonce. Batches are sample-major, so no
  batch holds one state twice. `--score --responses <file|dir>` accepts an answer only from the batch that was
  handed its request, and only when it echoes that request's nonce and sha256. It re-hashes the PNG and validates
  the verdict through `validateJudgeResult` with no coercion. A state counts only when every one of its samples is
  valid; otherwise it is `unjudged`, never a pass. Valid states are voted with the same `aggregateVotes` and
  `scoreState` as live. The rollup carries `gate: 'binding'`, `judge: 'session'`, `network: false`, the models the
  judges reported, `response_errors[]` and each state's `judged_by[]` (batch, model). `--judge-tier` now applies to
  session as well as live. Session step flags are a usage error on any other `--judge`.
- The `ui-judge` agent: one fresh, Read-and-Write-only subagent per batch. It Reads each PNG, answers in the schema
  and writes its batch's response file.
- `/aoforge-stack-flutter:ui-eval` picks the judge explicitly and writes it into every command. An explicit
  `--judge` wins; otherwise the skill uses `live` when an Anthropic credential is set and `session` when none is.
  The skill spawns the judges between the ui-evaluator's prepare spawn (`## JUDGE REQUESTS READY`) and its scoring
  re-spawn, because subagents cannot spawn. SKILL.md states what the session gate cannot prove: that a judge opened
  the image, or that the session did not write an answer itself.
- The verifier fragment's Step 8c re-scores a session run's saved answers offline when they are on disk. Step 8c
  and Step 9 treat a session `binding` pass like a live one.

### Changed

- `--judge live` is unchanged in behaviour. Its prompt text now comes from `visionPromptText`, byte for byte the
  same, and the per-state input resolution moved into `resolveStateInput`, which all three judges share.

## [1.0.0] - 2026-10-17

### Added

- First release: extracted from core AOForge by objective 77 (the stack pack contract). Requires aoforge >= 3.1.0.
- The pack declares the web pack as a soft dependency for platform `web` (`soft_depends`), so a Flutter project whose
  runtime or TRD `platform` includes `web` also selects aoforge-stack-web. When the web pack is not active, the
  verifier fragment records Flutter web surfaces as `? SKIPPED` and sends them to human verification (quick 38).
- Moved from core (quick 39): the planner fragment's `## TRD frontmatter for type: ui` (the YAML example and field
  table core's TRD template used to carry; `provider` is accepted and scored like `other`), Step 9's complete UAT
  generation rules in the verifier fragment (row sources, per-platform expansion, state text, format, refusal and
  later edits), and the profile's `## Testing` layer cells, outside-in route, codegen note and web `pumpAndSettle`
  gotcha.
- The `flutter` and `dart` profiles name this pack as their home and the path its SessionStart hook mirrors them to
  (`~/.claude/aoforge/stacks/aoforge-stack-flutter/profiles/<name>.md`); they said "bundled with AOForge". The header
  comment of the vendored `hooks/sync-pack.cjs` names `stack-packs.test.cjs`, the test that keeps it byte-identical
  across packs (objective 79).
- `verify flutter-ui-eval --judge live --judge-tier haiku|sonnet|opus` sets the rung the live vision calls use. The
  flag is valid only with `--judge live`, and an unknown or missing value is a usage error (exit 1). Live rollups
  report `judge_tier`.
- Every scored rollup carries `tier_escalation` `{requested, trigger, from_tier, states}`. Only a live run whose
  expect:pass reviews include a split vote (`flake: true`) requests escalation (`trigger: 'split-votes'`); credential,
  network or refusal reviews, advisory (labels) runs and expect:fail states never do. The engine never escalates
  itself.
- The ui-evaluator agent returns `## ESCALATION REQUESTED` on that signal, and `/aoforge:ui-eval` re-spawns it once,
  one rung up, from `resolve-model ui-evaluator --escalate-from <judge tier>` with `--judge-tier` set. At the ceiling
  it reports the first rollup and the split states stay on human verification. (objective 76 SC6 / MEF-06, quick 42)

### Changed

- The UI judge start tier stays at sonnet on balanced and budget (`models.ui-evaluator` opus/sonnet/sonnet). Objective
  81's proposal P1 (start at haiku, escalate a split vote to sonnet) was applied by TRD 82-03, measured by 82-08 and
  not applied: broken_missed(Haiku start, final) = 1 of 13 broken states, and the pre-registered rule needs 0
  (accuracy 19/20 against the Sonnet start's 18/20 and cost $0.13 against $1.15 held). (objective 81 P1, TRDs 82-03
  and 82-08)
- The pack's agent material (the executor, planner and verifier fragments and the `flutter` and `dart` profiles) names
  runtime files `<runtime>/<rel>`, and `/aoforge-stack-flutter:ui-eval` hands the ui-evaluator spawn `AOForge runtime:
  {runtime_root}`, so no agent builds a home directory path itself (core's `runtime-path-reads.repo.test.cjs` covers
  the pack). (objective 82, TRD 82-11)
