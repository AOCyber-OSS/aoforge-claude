# Test C research topic

Every project-researcher run of test C uses this one topic, unchanged. The batch spec (TRD 81-11) reads the three
sections below by their headings: `## Domain` fills the workflow's `[domain]` placeholder, `## Project summary` fills
`[PROJECT.md summary ...]`, and the greenfield project's `.aoforge/PROJECT.md` gets `# <Project title>` followed by
the same summary paragraph. checklists-researcher.json was written against this wording, before any run: do not
edit it once a run has started.

## Domain

A command-line tool, written in Go, that keeps a local full-text search index of a folder of Markdown notes and updates it when files change

## Project title

notesearch

## Project summary

notesearch is a command-line tool, written in Go, that keeps a local full-text search index of a folder of Markdown notes and updates it when files change. A user points it at a notes folder once; it builds the index, a watch mode keeps the index current while notes are created, edited, renamed or deleted, and a search command returns ranked results quickly for folders of tens of thousands of notes. It ships as a single binary for macOS, Linux and Windows, runs entirely on the user's machine with no server or network service, and never modifies the notes themselves.
