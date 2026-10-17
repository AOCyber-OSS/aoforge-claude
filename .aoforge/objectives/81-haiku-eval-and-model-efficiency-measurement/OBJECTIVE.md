---
work: feature
---

# Haiku eval and model-efficiency measurement

## Goal

Close 76-06 and 76-08 with measured evidence. 76-06: Haiku 5.5 vs Sonnet 5.5 on seeded fixtures with answer keys committed before any run, for the verifier's verdict (test A), the job-checker (B), the codebase-mapper and objective-researcher (C) and the UI judge (D). 76-08: the same fixed workload (a `/aoforge:quick` change x3, a small 2-TRD `/aoforge:build` x2) under the 3.0.0 and 3.1.0 plugins, with per-role prompt size, tokens, cost, wall time and outcome (test E), plus a free static resident-prompt comparison. All live runs are headless `claude -p` sessions in a throwaway HOME with `--plugin-dir`, `--model` and a per-run `--max-budget-usd`, authenticated by the user's subscription token (`CLAUDE_CODE_OAUTH_TOKEN`, read from a scratch file), never touching the real ~/.claude, this checkout's working tree or any fleet repo (user decisions 2026-10-17).

---
*Created: 2026-10-17 (auto-scaffold via bootstrapObjectiveMd)*
