# Changelog

All notable changes to the aoforge-stack-flutter stack pack. Released with tags named `aoforge-stack-flutter--vX.Y.Z`.

## [Unreleased]

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

- The UI judge starts at haiku on balanced and budget (`models.ui-evaluator` opus/haiku/haiku, was opus/sonnet/sonnet);
  a split vote still escalates one rung, now to sonnet. Objective 81 measured 18/20 against Sonnet's 20/20 (exactly the
  10-point bound) with a 40% split rate, and objective 82's live check (TRD 82-08) reverts this if escalation does not
  keep verdicts right at a cost below a Sonnet start. (objective 81 P1, TRD 82-03)
