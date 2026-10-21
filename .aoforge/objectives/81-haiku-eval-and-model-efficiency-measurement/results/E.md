# Batch E results

Scored at 2026-10-17T21:15:11.455Z. Planned runs: 3.0.0 5, 3.1.0 5.

No per-role model metrics in this result; see the batch's own report.

## Notes

- Session model opus, profile balanced, the same for both versions.
- 3.1.0 runs include the SessionStart upgrade hook's commit (chore(aoforge): upgrade project to v3.1.0): 5 of 5 recorded 3.1.0 runs.
- Role cells count only runs that ended ok, per spawn; n is spawns (runs).
- model_ran is not used for E: subagents run on their profile tiers by design.
- Pilot cost check (TRD 81-17 Task 2): the CLI reported cost includes subagent spend. q31-r1 reported 1.7785529 vs transcript 1.778553 (main 0.470068, subagents 1.308485); q30-r1 2.0646968 vs 2.064697 (0.45385, 1.610847); b31-r1 5.0873121 vs 5.082792 (0.631361, 4.451431); b30-r1 4.8968957 vs 4.848856 (0.6091, 4.239755). Reported >= 0.95 x transcript on all four; the ledger charged max(reported, transcript) on all ten runs. Overshoot 0 on every run (max charged/cap: quick 0.34, build 0.34), so whether --max-budget-usd bounds subagent spend is untested.
- Post-hoc 3 (81-PREREG 9.3): the four pilots ran with the session cwd under the session scratchpad; the other six under the opaque sandbox root /private/tmp/claude-501/e81-<hex>. One quick and one build run per version fall in each group.
- Out-of-sandbox reads by the 3.1.0 build executor (TRD 01-01, sonnet, spawn depth 2), both resolving ~/.claude/aoforge/references/tdd.md by guessing a home: b31-r1 Read /Users/<real user>/... (denied by the deny list, escape_attempt true); b31-r2 Read /Users/aocyber/... (a non-existent path, File does not exist, not denied). Both then read the sandbox copy. No 3.0.0 run did this.
- Executor model per quick run: 3.1.0 sonnet 3/3; 3.0.0 sonnet 2/3 and opus 1/3 (q30-r1 spawned the executor with no model). Build verifiers: 3.0.0 runs spawned 2 each (one sonnet from the executing agent, one opus from the orchestrator); 3.1.0 b31-r1 1, b31-r2 2 (both sonnet).

Spend: spent $28.07 of the batch; ledger total $32.63 (status complete, 10 runs).
