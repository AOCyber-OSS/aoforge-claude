---
work: feature
status: verifying
---

# Adopt migrates legacy projects

## Goal

A repository still on the pre-rename layout can be brought onto 3.1.0 from 3.1.0 itself: `/aoforge:adopt` detects a legacy `.planning/` project and moves it to `.aoforge/` (with its `devflow{}` config stamp and pre-rename CLAUDE.md block markers) as one recorded change on its `aoforge/adopt` branch, unattended and idempotent. Fresh and brownfield adoption keep working. This is the in-product path for the fleet repos left on `.planning/` (user decision 2026-10-17: leave the fleet to each repo; adopt migrates).

---
*Created: 2026-10-17 (auto-scaffold via bootstrapObjectiveMd)*
