---
objective: 82-3-1-0-follow-ups
trd: "10"
subsystem: release
tags: [changelog, docs, requirements, todos, revalidation]
---

# Objective 82 TRD 10: Docs, records and re-validation Summary

## Progress
- [x] Task 0 (dispatch): eval81 score test reads the reverted P1 tier — c4855638
- [x] Task 1: CHANGELOG 3.1.0, guides, reference, CLAUDE.md, pack changelogs, site data — cfa364a5
- [x] Task 2: Objective 77 records, MEF-06 from evidence, the five todos — (this commit)
- [ ] Task 3: Re-validate integrate/3.1.0 (79-08's checks) and record the addendum — next step: list the test files with `git ls-files -co --exclude-standard` over npm test's four globs into the scratchpad, drop watcher-shell.test.cjs, and run the full suite in the background under the scratch HOME
