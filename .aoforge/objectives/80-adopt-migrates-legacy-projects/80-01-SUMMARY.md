---
objective: 80-adopt-migrates-legacy-projects
trd: "01"
subsystem: adopt
tags: [adopt, legacy-migration, rename]
requirements-completed: []
---

# Objective 80 TRD 01: Legacy migrator module Summary

**In progress: checkpoint draft (a SUMMARY without `## Self-Check` is a checkpoint, not a completed run).**

## Progress
- [x] Task 1: Fixture builder and the RED test list — aa4ee790
- [x] Task 2: Discovery, refusal and the move — (this commit)
- [ ] Task 3: Residue converters, rendering, ALLOW entry — next step: add convertResidue and renderMigrationSection to plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs (the pure helpers already exist), then the ALLOW entry in rename-guard.repo.test.cjs and the two header comments
