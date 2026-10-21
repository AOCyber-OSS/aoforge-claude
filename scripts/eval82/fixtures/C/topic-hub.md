# Test C research topic (objective 82): desktop hub for a local daemon

Written by hand on 2026-10-18 for TRD 82-06, before any batch C run of objective 82, from the topic text the TRD fixes.
The batch module (scripts/eval82/batches/C.cjs) reads the three sections below by their headings: `## Domain` fills
the workflow's `[domain]` placeholder, `## Project summary` fills `[PROJECT.md summary ...]`, and the greenfield
project's `.aoforge/PROJECT.md` gets `# <Project title>` followed by the same summary paragraph. The `hub` lists of
checklists-82.json were written against this wording: do not edit it once a run has started.

## Domain

A macOS desktop application, written in Flutter, that controls a local developer-platform daemon

## Project title

devhub

## Project summary

devhub is a macOS desktop application, written in Flutter, that controls a developer-platform daemon running on the same machine. It shows the status of the local services the daemon manages, starts and stops them, streams their logs live, and edits the daemon's settings. The daemon exposes a local API; it can be restarted or upgraded while devhub is open, and devhub must keep working through that. devhub ships signed and notarized, starts at login and lives in the menu bar.
