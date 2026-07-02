# Ready-to-Use Local Agent Prompts

Use these prompts with your local coding agent.

## 1. Codebase Map Prompt

```md
Read `AGENTS.md`, `.github/copilot-instructions.md`, and all files in `docs/agents`. Then inspect the repository.

Do not edit files yet.

Produce a codebase map that includes:

- Tech stack and package scripts
- Route map
- Component map
- LocalStorage keys and data shapes
- Workout/session/history domain model
- shadcn/ui setup status
- UX journey map
- Bugs and risks found
- Recommended phased implementation plan
```

## 2. Bug Audit Prompt

```md
Using `docs/agents/04-bug-audit-checklist.md`, audit the ForkWorkout codebase for bugs.

Focus especially on:

- LocalStorage safety
- Hydration issues
- Timer cleanup
- Workout session state
- Calendar/date logic
- Mobile layout problems
- Accessibility issues

Do not redesign yet. Produce a bug report with file locations, impact, root cause, and proposed fixes.
```

## 3. Stability Fix Prompt

```md
Implement the stability fixes from the bug audit.

Rules:

- Preserve existing functionality.
- Do not change the visual design yet unless required by a bug.
- Do not break existing LocalStorage data.
- Add safe parsing and defaults.
- Fix hydration issues.
- Fix timer cleanup bugs.
- Fix date/calendar bugs if found.

After editing, report:

- Files changed
- Bugs fixed
- Migration behavior, if any
- Commands run
- Manual test steps
```

## 4. shadcn/ui Foundation Prompt

```md
Inspect the current shadcn/ui setup.

If shadcn/ui is missing or incomplete, add the minimum setup needed for the revamp.

Then create shared app components using shadcn/ui primitives:

- PageContainer
- PageHeader
- EmptyState
- StatCard
- BottomActionBar
- ConfirmDialog

Do not refactor all screens yet. Keep this PR focused on UI foundation.
```

## 5. Dashboard Revamp Prompt

```md
Revamp the ForkWorkout dashboard using the shadcn/ui foundation.

Goals:

- Clear page header
- Helpful new-user empty state
- Saved workout cards
- Streak/progress summary
- Clear create workout CTA
- Better mobile layout

Preserve all current dashboard functionality and LocalStorage behavior.
```

## 6. Workout Builder Revamp Prompt

```md
Revamp the workout creation/editing experience.

Goals:

- Make the builder easier on mobile.
- Use exercise cards and clear set rows.
- Add inline validation.
- Make add/remove actions obvious.
- Keep save action easy to reach.
- Preserve existing persisted data.

Use shadcn/ui components where appropriate.
```

## 7. Live Workout Session Prompt

```md
Revamp the live workout tracker.

Goals:

- Focus the screen on current exercise and set.
- Show progress clearly.
- Make Complete Set the main action.
- Keep Skip available as secondary.
- Improve rest timer modal/drawer.
- Make finish flow clear and motivating.
- Ensure workout completion updates history/calendar.

Check timer cleanup and state correctness carefully.
```

## 8. Landing Page Prompt

```md
Create a modern landing page for ForkWorkout using `docs/agents/07-landing-page-spec.md`.

Goals:

- Hero with strong headline and CTA
- Mobile product preview
- Feature cards
- How it works section
- Local-first/no-account reassurance
- Final CTA

Use shadcn/ui and Tailwind CSS. Make the page mobile-first, polished, and consistent with the revamped app.

If the current root route is the app dashboard, move the dashboard to `/app` only if it can be done safely. Otherwise, create the landing page in the safest route structure and explain the tradeoff.
```

## 9. Final Polish Prompt

```md
Run a final polish pass using `docs/agents/09-testing-qa-checklist.md`.

Check:

- Mobile responsiveness
- Accessibility
- LocalStorage safety
- Timer behavior
- Calendar/history correctness
- Landing page CTA routing
- Lint/build/typecheck/test commands

Fix high-confidence issues. Report remaining risks honestly.
```
