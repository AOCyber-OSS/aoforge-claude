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
- [x] Task 1: Fixture builder and the RED test list — (this commit)
- [ ] Task 2: Discovery, refusal and the move — next step: create plugins/aoforge/aoforge/bin/lib/legacy-migrate.cjs with planMigration, refusalFor, moveTrees, movesDone, ownsMigratePath and make tests 1-11 and 22 pass
- [ ] Task 3: Residue converters, rendering, ALLOW entry — next step: add renameStampKeyText, rewriteBlockText, rewriteIgnoreText, addExcludeCounterparts, convertResidue, renderMigrationSection, then the rename-guard ALLOW entry
