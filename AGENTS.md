# AGENTS.md — ForkWorkout Revamp Instructions

## Mission

You are working on **ForkWorkout: An app that keeps you fit**.

ForkWorkout is a simple, mobile-first workout tracking app that helps users stay motivated and consistent. It should remain fast, playful, and lightweight, with local-first persistence and no account requirement.

The revamp has four goals:

1. **Read and understand the existing codebase before changing anything.**
2. **Find and fix bugs, UX friction, state issues, accessibility gaps, and responsive layout problems.**
3. **Modernize the UI using Tailwind CSS and shadcn/ui.**
4. **Create a modern landing page and a clearer product journey for users.**

Do not treat this as a simple visual redesign. Treat it as a full product polish pass: structure, UX, code quality, state safety, accessibility, performance, and maintainability.

---

## Product Context

ForkWorkout is a workout tracking app with:

- Workout creation
- Dynamic exercise builder
- Sets with reps, weights, durations, or time-based values
- Live workout tracker
- Completed/skipped set state
- Rest timer modal
- Sound feedback
- Workout history
- Calendar/streak visualization
- LocalStorage persistence
- Mobile-first UI
- Playful animations

The app should continue to work without authentication or backend dependency.

---

## Tech Stack Assumptions

Verify these in the repository before acting:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- LocalStorage persistence

If the repository differs from this stack, adapt to the existing implementation and document the difference in your notes.

---

## Non-Negotiable Rules

### Codebase reading comes first

Before editing, inspect at minimum:

- `package.json`
- `next.config.*`
- `tsconfig.json`
- Tailwind config
- `components.json` if shadcn/ui is already installed
- App routes under `app/` or `src/app/`
- Existing components
- Workout state/types/utilities
- LocalStorage keys and persistence code
- Existing animation and timer utilities
- Existing tests, if any

Create a quick internal map of:

- Routes
- Core components
- Data models
- Storage keys
- User journeys
- Known risks

### Preserve user data

LocalStorage data may already exist in users' browsers. Never rename storage keys or change data shape without a migration.

When modifying persisted structures:

- Keep backwards compatibility where possible.
- Add a migration utility when shape changes are necessary.
- Handle corrupted, empty, or old data gracefully.
- Never crash the app because LocalStorage contains unexpected data.

### Preserve existing functionality

The revamp must not remove core features:

- Creating workouts
- Editing exercises and sets
- Starting a workout
- Completing/skipping sets
- Rest timer behavior
- Workout history
- Calendar/streak display
- Program/workout discovery, if currently present

If functionality is broken today, fix it rather than deleting it.

### Use shadcn/ui correctly

Use shadcn/ui for reusable UI primitives:

- Button
- Card
- Dialog / Drawer
- Sheet
- Input
- Textarea
- Select
- Tabs
- Badge
- Progress
- Calendar, if appropriate
- Toast / Sonner
- Form primitives where useful

Do not hand-roll common primitives if a shadcn/ui component already fits.

### Keep the app mobile-first

Design for phone screens first, then tablet and desktop.

All primary actions must be thumb-friendly:

- Large tap targets
- Clear primary CTA
- Sticky or easily reachable session actions
- No tiny icon-only destructive actions without confirmation or labels
- No important content hidden off-screen

### Make UX easier

Reduce cognitive load. Users should immediately understand:

- What the app does
- How to create their first workout
- How to start a workout
- What to do during a live session
- How their history/streak is tracked

### Keep the tone playful but modern

ForkWorkout can feel fun and motivating, but not childish or cluttered.

Preferred vibe:

- Fresh
- Energetic
- Clean
- Mobile-app-like
- Fitness focused
- Slightly playful

Avoid:

- Overloaded gradients everywhere
- Low contrast text
- Excessive animation
- Confusing decorative UI
- Desktop-only layouts

---

## Recommended Target Information Architecture

Suggested route structure. Adapt to the existing app if needed.

```txt
/
  Landing page
/app
  Main dashboard
/app/workouts/new
  Workout builder
/app/workouts/[id]
  Workout detail/edit
/app/session/[workoutId]
  Live workout tracker
/app/history
  Workout history and calendar
/app/programs
  Suggested programs, if retained
```

If moving existing routes would be too risky, keep current routes and improve the structure internally. Prefer incremental refactors.

---

## Revamp Priorities

### Priority 1 — Stability and bug audit

Find and fix:

- Hydration issues caused by LocalStorage reads during render
- Broken mobile layouts
- Timer cleanup bugs
- Stale state bugs during workout sessions
- Date/calendar timezone bugs
- Missing empty states
- Broken edit/delete flows
- Missing confirmation for destructive actions
- Invalid exercise/set inputs
- Animation performance issues
- Accessibility issues

### Priority 2 — Product journey

Improve these flows:

1. First visit
2. Create first workout
3. Add exercises and sets
4. Start workout
5. Complete sets
6. Rest between sets
7. Finish workout
8. View progress and streak
9. Return later and continue using app

### Priority 3 — UI system

Create a consistent design system using:

- shadcn/ui primitives
- Tailwind design tokens
- Shared layout components
- Shared empty states
- Shared section headers
- Shared workout cards
- Shared action bars
- Shared form patterns

### Priority 4 — Landing page

Create a modern landing page that explains the app and gets users into the product quickly.

Landing page must include:

- Hero section
- Strong headline
- Product value proposition
- Primary CTA to start tracking
- Secondary CTA to view demo/app area, if useful
- Feature cards
- How it works
- Mobile preview/mockup area
- Trust/no-account/local-first reassurance
- Final CTA

---

## Quality Bar

A good result should feel like a polished mobile fitness product.

Checklist:

- App looks modern on mobile, tablet, and desktop.
- User can understand the app in under 10 seconds.
- First workout creation is obvious.
- Empty states are helpful and action-oriented.
- shadcn/ui components are used consistently.
- LocalStorage is safe and resilient.
- No crashes on refresh.
- No hydration warnings.
- Inputs are validated.
- Timer behavior is reliable.
- Calendar dates are correct.
- Animations are smooth and respectful of reduced motion preferences.
- UI has good color contrast.
- Code is organized, typed, and maintainable.

---

## Suggested Working Method

Work in small, reviewable steps:

1. Inspect and map current code.
2. Identify bugs and risky areas.
3. Improve project structure without changing behavior.
4. Add or normalize shadcn/ui setup.
5. Build shared UI primitives.
6. Refactor core screens.
7. Add the landing page.
8. Improve UX flows and empty states.
9. Add tests and manual QA notes.
10. Run lint/build/tests and fix failures.

Do not perform a large rewrite unless the current code is too broken to safely evolve.

---

## Communication Style for Agent Output

When reporting work, use this format:

```md
## Summary
- What changed

## Codebase Understanding
- Routes inspected
- State/persistence inspected
- Components inspected

## Bugs Found
- Bug
- Impact
- Fix

## UX Improvements
- Before
- After

## shadcn/ui Usage
- Components added/used

## Testing
- Commands run
- Manual checks performed

## Risks / Follow-ups
- Remaining concerns
```
