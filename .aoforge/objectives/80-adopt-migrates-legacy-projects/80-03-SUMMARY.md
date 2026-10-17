---
objective: 80-adopt-migrates-legacy-projects
trd: "03"
subsystem: adopt
tags: [adopt, legacy-migration, scaffold, report, commit-files]
status: checkpoint
---

# Objective 80 TRD 03: Migrate scaffold and report Summary

## Progress
- [x] Task 1: RED tests for migrate scaffold/report/commit — be8baf70
- [x] Task 2: Migrate scaffold — (this commit)
- [ ] Task 3: Migrate report and compact commit files — next step: add `reportMigrate` to lib/adopt.cjs (health per root, upgrade.check per root, renderMigrateReport, computeMigrateCommitFiles with the info/exclude transient guard) and branch to it from `report`; add the `report: <n> to review` CLI line
