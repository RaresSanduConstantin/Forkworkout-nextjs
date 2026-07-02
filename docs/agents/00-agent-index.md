# ForkWorkout Agent Documentation Index

Use these files as local context for AI agents, Copilot, Cursor, Claude Code, or other local coding assistants.

## Recommended files to keep in the repository

```txt
AGENTS.md
.github/copilot-instructions.md
docs/agents/00-agent-index.md
docs/agents/01-project-context.md
docs/agents/02-project-structure.md
docs/agents/03-codebase-reading-protocol.md
docs/agents/04-bug-audit-checklist.md
docs/agents/05-shadcn-ui-guidelines.md
docs/agents/06-ux-revamp-brief.md
docs/agents/07-landing-page-spec.md
docs/agents/08-implementation-plan.md
docs/agents/09-testing-qa-checklist.md
docs/agents/10-agent-prompts.md
docs/specs/local-storage-and-state.md
docs/specs/workout-domain-model.md
docs/review/pr-review-template.md
```

## How to use this kit

1. Copy these files into the root of the ForkWorkout repository.
2. Ask the local agent to read `AGENTS.md` first.
3. Ask it to inspect the repository and produce a codebase map before editing.
4. Use the implementation plan to guide the revamp in small pull requests.
5. Use the QA checklist before merging.

## Best first prompt

```md
Read `AGENTS.md` and all files under `docs/agents`. Then inspect the repository. Do not edit yet. First produce a codebase map with routes, components, state utilities, LocalStorage keys, bugs/risks, and a recommended revamp plan.
```

## Best implementation prompt

```md
Using the plan from the codebase map, implement Phase 1 only: stability fixes, LocalStorage safety, hydration fixes, and obvious mobile UX bugs. Do not redesign the whole app yet. Use shadcn/ui only where it reduces risk or fixes inconsistent UI. After changes, report files changed, bugs fixed, and test steps.
```
