---
objective: 79-reconcile-and-release-3-1-0
trd: "10"
subsystem: release
tags: [release, merge, dry-run, tag, 3.1.0, approval-gates]
main_before: 9bb6983afc3cc348163744969651b99e0662e10c
merge_sha: f907f4fc0556bc306f6c095eb6ecdca3a3a14503
pushed_sha: 518cff9cc8f05e3625d61c1efc44220f36608bb6
pr: 138
tag: v3.1.0
tag_object: 648fea48c92c13e59d2e6713ad024790a1f31460
alias: aoforge--v3.1.0
release_run: 39622971971
dry_run_run: 39603698540
requires:
  - 79-09 SUMMARY (PR 138, PUSHED_SHA 518cff9c, five checks green)
provides:
  - "main at MERGE_SHA f907f4fc (parents 9bb6983a, 518cff9c; tree equals PUSHED_SHA; signed)"
  - "GitHub release v3.1.0, Latest, not draft, body equal to the CHANGELOG 3.1.0 section"
  - "aoforge--v3.1.0 on origin at f907f4fc, pushed by the release run"
  - "main's marketplace serves aoforge 3.1.0, aoforge-stack-flutter 1.0.0, aoforge-stack-web 1.0.0"
affects: []
tech-stack:
  added: []
  patterns: ["a tag push can start no workflow run; check for the run within a few minutes and re-push the identical tag object rather than releasing by hand"]
key-files:
  created: []
  modified: []
key-decisions:
  - "Four gates, four literal replies (2026-10-21): merge 'approved', dry run 'approved', tag and push 'approved', and 'Follow your options' for the stalled tag push (wait, then re-push the identical tag, then publish by hand only if that failed)."
  - "The CHANGELOG heading stays dated 2026-10-17 (the date chosen at the fold); the release published 2026-10-21."
  - "The first push of v3.1.0 (14:44:35 UTC) started no run in 18 minutes, with GitHub status green and no tag-create event in the repo feed. The remote tag was deleted and the same tag object 648fea48 pushed again at 15:03:34; the release run started at 15:08:16. The tag never pointed anywhere but f907f4fc, but it was deleted from origin for under a second: an exception to the TRD's 'no deleted tag' rule, approved by the reply above."
  - "No tag ruleset matches v3.1.0 (scripts/tag-rules.cjs: 0 rulesets), so the delete met nothing."
requirements-completed: [SC-5]
metrics:
  tasks: 4
  files: 0
---

# TRD 79-10 Summary: merge #138, dry run, tag and release 3.1.0

**3.1.0 is released: main at f907f4fc, release v3.1.0 Latest with the CHANGELOG notes, and the aoforge--v3.1.0 alias the stack packs resolve.**

## Gates

| Task | Reply | Result |
|---|---|---|
| 1. Merge #138 | approved | MERGE_SHA f907f4fc, parents 9bb6983a (MAIN_BEFORE) and 518cff9c; main runs: Unit suite 39595433235, CodeQL, oss-mirror 39595433290, Docs site 39595433242, all success (the docs deploy to Cloudflare Pages succeeded) |
| 2. Release dry run | approved | run 39603698540 on f907f4fc: pushed, saw and deleted aoforge--v0.0.0-dryrun-39603698540; no tag left, no release |
| 3. Tag and push v3.1.0 | approved | annotated tag 648fea48 at f907f4fc pushed 14:44:35 UTC; no run started; re-pushed (same object) 15:03:34 after "Follow your options" |
| 4. Verify | (read-only) | below |

## Verification

- Release run 39622971971 (push, v3.1.0): success. Log: `pushed aoforge--v3.1.0 at f907f4fc...`, `created release v3.1.0`, `{"action":"created","tag":"v3.1.0","kind":"core","alias":"aoforge--v3.1.0"}`.
- `gh release view v3.1.0`: title "Release 3.1.0: main, the AOForge line and the shim removal in one tree (objective 79)", not draft, not prerelease, published 2026-10-21T15:08:30Z; body (55,343 chars) equals `releaseNotes(CHANGELOG.md, "3.1.0")` at MERGE_SHA.
- `releases/latest`: v3.1.0.
- origin: `refs/tags/v3.1.0` 648fea48 -> f907f4fc; `refs/tags/aoforge--v3.1.0` f907f4fc.
- main's marketplace: aoforge 3.1.0, aoforge-stack-flutter 1.0.0, aoforge-stack-web 1.0.0; core plugin.json 3.1.0.
- oss-mirror run 39622971783 (push, v3.1.0): success. The public mirror AOCyber-OSS/aoforge-claude has v3.1.0 at f907f4fc but not aoforge--v3.1.0: the alias was pushed with the release run's GITHUB_TOKEN, which starts no mirror run, and the tag-triggered mirror run did not carry it.

## Follow-ups

- **Mirror the alias.** Marketplace users add `AOCyber-OSS/aoforge-claude`, so the packs' `aoforge >=3.1.0` resolves from the mirror. A `workflow_dispatch` of oss-mirror (or the next push to main) pushes aoforge--v3.1.0 there; it needs its own approval.
- **Planning-records PR.** Local commits after PUSHED_SHA on integrate/3.1.0 (cd623b3c, 5004641f, f0f28d45, 496bcb08, f7ee1731, 8c175a86, this SUMMARY) need a follow-up PR; its push and PR each need approval. 8c00db5c (the installed 3.0.0 plugin's SessionStart hook stamping config.json back to 3.0.0) must be reverted in that PR, not carried.
- **Stamp downgrade.** The 3.0.0 upgrade-project hook downgrades a newer project stamp and now commits it. Updating the installed plugin to 3.1.0 stops it here; an unguarded downgrade is a bug worth a todo.
- **Pack tags.** aoforge-stack-flutter--v1.0.0 and aoforge-stack-web--v1.0.0 only if the user wants separate pack releases.
- **OPS-03.** The docs deploy succeeded on the merge commit; the todo looks done and can be closed after a check of the live site.
- **First tag push started no run.** Worth one line in the release runbook: check for the run within five minutes.
- PR #130 untouched (OPEN). No force push, no branch deleted; the one tag delete is recorded above.
