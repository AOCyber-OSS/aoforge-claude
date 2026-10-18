---
work: feature
---

# 3.1.0 follow-ups

## Goal

The follow-ups objectives 79-81 left are closed before 3.1.0 ships (user decision 2026-10-18: target 3.1.0 while the cutover freeze blocks the push). (1) Why 3.1.0's planner spends ~67% more tokens and its executors ~20% more on a small build than 3.0.0 (81-MEASUREMENT.md, E build cell) is found, fixed or explained, and re-measured with the objective 81 harness. (2) 3.1.0 agents stop guessing an absolute home path for `~` reads (the Read tool does not expand `~`): agents get an expanded runtime path, with a guard. (3) The five approved tier proposals are applied with their caveats: P1 ui-evaluator balanced/budget -> haiku with escalation on split votes and the escalation rate measured; P2 arch-only focus override codebase-mapper.arch -> sonnet; P3 codebase-mapper concerns budget -> sonnet; P4/P5 project-researcher architecture/pitfalls budget -> haiku with a follow-up measurement. (4) `tokens` gains `--also-root` like `calibrate`. (5) Objective 77's records (STK-01, PCK-01..04, Progress row) agree with its passed verification. MEF-06 is updated from evidence.

---
*Created: 2026-10-18 (auto-scaffold via bootstrapObjectiveMd)*
