---
objective: 80-adopt-migrates-legacy-projects
trd: "07"
subsystem: adopt
tags: [adopt, legacy-migration, simulated-run, fleet]
status: checkpoint
---

# Objective 80 TRD 07: Simulated /aoforge:adopt on read-only copies of real fleet repositories (checkpoint)

## Progress
- [x] Task 1: Clone read-only and follow /aoforge:adopt on both clones — (this commit)
- [ ] Task 2: Checks, comparisons, source-untouched proof, SUMMARY — next step: run `adopt-e2e-assert.cjs check --mode migrate` on the aodex and smartwellness adopt clones under the fake HOME, then validate health at every planning root of the four clones.

## Task 1 evidence

Work area: `<S>/80-07/` with `<S>` = the session scratchpad; fake HOME `<S>/80-07/home`.

| Clone | Source HEAD | Branch at clone | Adopt commit | Tree |
|---|---|---|---|---|
| aodex | c42149326a226aca6a298385c4b694c6104ab798 | fix/ci-listtile-material | ada03a49 on aoforge/adopt | clean |
| smartwellness | 23271c475cab19cd6289716975e9c707eda08a52 | df/riverpod3-bump | 0b3d2d2 on aoforge/adopt | clean |
| aodex-hand | same as aodex | - | d3cc1c52 "hand migration" | clean |
| smartwellness-hand | same as smartwellness | - | 8de0805 "hand migration" | clean |
