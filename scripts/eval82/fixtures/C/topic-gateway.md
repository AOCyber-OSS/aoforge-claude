# Test C research topic (objective 82): LLM gateway

Written by hand on 2026-10-18 for TRD 82-06, before any batch C run of objective 82, from the topic text the TRD fixes.
The batch module (scripts/eval82/batches/C.cjs) reads the three sections below by their headings: `## Domain` fills
the workflow's `[domain]` placeholder, `## Project summary` fills `[PROJECT.md summary ...]`, and the greenfield
project's `.aoforge/PROJECT.md` gets `# <Project title>` followed by the same summary paragraph. The `gateway` lists
of checklists-82.json were written against this wording: do not edit it once a run has started.

## Domain

An LLM gateway service, written in Go, that sits between internal applications and several hosted model providers

## Project title

modelgate

## Project summary

modelgate is a service, written in Go, that sits between a company's internal applications and several hosted large-language-model providers. Applications call one HTTP API; modelgate authenticates each caller with a per-tenant API key, enforces per-tenant rate limits and monthly spend budgets, streams responses back as they arrive, records every request's token usage for cost accounting, keeps a searchable request log, and fails over to another provider when one is slow or down. It runs as several stateless instances behind a load balancer.
