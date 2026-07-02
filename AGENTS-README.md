# ForkWorkout Local Agent Markdown Kit

This package contains Markdown instruction files for local AI coding agents that will help revamp ForkWorkout.

## What is included

- `AGENTS.md` — main repo-level agent instructions
- `.github/copilot-instructions.md` — GitHub Copilot instructions
- `docs/agents/*` — detailed agent guidance for structure, bug audits, shadcn/ui, UX, landing page, QA, and implementation
- `docs/specs/*` — LocalStorage/state and workout domain specifications
- `docs/review/pr-review-template.md` — PR review template for the revamp

## How to use

Copy the contents of this folder into the root of your ForkWorkout repository.

Then ask your local agent:

```md
Read `AGENTS.md`, `.github/copilot-instructions.md`, and everything under `docs/agents`. Inspect the repository first and produce a codebase map before editing.
```

## Recommended first task

Do not start with the redesign. Start with a codebase audit and stability pass.

Suggested sequence:

1. Codebase map
2. Bug audit
3. LocalStorage/hydration/timer fixes
4. shadcn/ui foundation
5. Dashboard revamp
6. Workout builder revamp
7. Live session revamp
8. History/calendar revamp
9. Landing page
10. Final QA
