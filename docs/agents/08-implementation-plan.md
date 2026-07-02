# ForkWorkout Revamp Implementation Plan

This plan is designed for local coding agents. Work in phases and keep each phase reviewable.

## Phase 0 — Codebase Map

Do not edit yet.

Tasks:

- Read repo metadata.
- Map routes.
- Map components.
- Map LocalStorage usage.
- Map workout domain types.
- Map UX journeys.
- Identify bugs and risks.
- Check shadcn/ui setup.

Output:

```md
# Codebase Map
## Stack
## Routes
## Components
## Storage
## Domain Model
## UX Flows
## Bugs/Risks
## Recommended Plan
```

## Phase 1 — Stability and Safety

Goal: fix risks before redesigning.

Tasks:

- Centralize LocalStorage access.
- Add safe JSON parsing.
- Add defaults for missing/corrupted data.
- Prevent hydration issues.
- Fix timer cleanup.
- Fix obvious date/calendar bugs.
- Fix invalid state mutations.
- Add basic validation.

Acceptance criteria:

- App does not crash with empty LocalStorage.
- App does not crash with malformed LocalStorage.
- App does not produce hydration warnings from storage reads.
- Timer stops when closed/unmounted.
- Existing workouts still load.

## Phase 2 — shadcn/ui Foundation

Goal: establish consistent UI primitives.

Tasks:

- Verify or install shadcn/ui.
- Add missing primitives needed for current screens.
- Normalize `cn` utility.
- Add shared components:
  - `PageContainer`
  - `PageHeader`
  - `EmptyState`
  - `StatCard`
  - `BottomActionBar`
  - `ConfirmDialog`
- Align Tailwind tokens and CSS variables.

Acceptance criteria:

- UI primitives are imported consistently.
- No duplicate button/card implementations.
- Shared components reduce repeated styling.

## Phase 3 — Dashboard Revamp

Goal: make the app home clear and useful.

Tasks:

- Add clear dashboard header.
- Add streak/progress summary cards.
- Improve workout list cards.
- Add helpful empty state.
- Add clear CTA to create workout.
- Improve programs/templates section if retained.

Acceptance criteria:

- New user knows how to start.
- Returning user can start a workout quickly.
- Dashboard works on mobile and desktop.

## Phase 4 — Workout Builder Revamp

Goal: make workout creation easier.

Tasks:

- Improve workout title input.
- Use exercise cards.
- Use clear set rows.
- Add add/remove controls.
- Add inline validation.
- Add sticky save CTA on mobile if useful.
- Add starter suggestions/templates if already supported or easy to add.

Acceptance criteria:

- User can create a valid workout quickly.
- Invalid inputs show clear errors.
- Add/remove actions are obvious.
- Builder is comfortable on mobile.

## Phase 5 — Live Session Revamp

Goal: make workout tracking focused and thumb-friendly.

Tasks:

- Show progress clearly.
- Highlight current exercise and set.
- Make `Complete set` the dominant action.
- Keep `Skip` available but secondary.
- Improve rest timer modal/drawer.
- Add finish state and feedback.
- Confirm exit if session progress may be lost.

Acceptance criteria:

- User always knows what set they are on.
- User can complete a session easily on mobile.
- Timer behavior is predictable.
- Workout completion updates history/calendar.

## Phase 6 — History and Calendar Revamp

Goal: make progress motivating and understandable.

Tasks:

- Improve calendar visuals.
- Add streak summary.
- Add recent completed workouts list.
- Add empty state.
- Ensure completed days use stable day keys.

Acceptance criteria:

- Completed workouts appear on correct calendar day.
- Streak/progress is easy to understand.
- Empty history tells user how to create progress.

## Phase 7 — Landing Page

Goal: create a polished product entry point.

Tasks:

- Build modern landing page at `/`.
- Move app dashboard to `/app` if appropriate.
- Add hero, preview, features, how it works, local-first reassurance, final CTA.
- Use shadcn/ui and shared visual language.
- Ensure CTAs route correctly.

Acceptance criteria:

- Landing page explains product immediately.
- CTA starts the user journey.
- No account/local-first message is clear.
- Mobile layout is polished.

## Phase 8 — Polish, Accessibility, and Performance

Goal: make the revamp production-ready.

Tasks:

- Audit keyboard navigation.
- Audit screen reader labels.
- Audit reduced motion.
- Check color contrast.
- Check responsive widths.
- Remove dead code.
- Check bundle impact.
- Run lint/build/tests.

Acceptance criteria:

- No lint/build failures.
- Important interactive elements are accessible.
- No obvious mobile layout bugs.
- No unnecessary console errors.

## Suggested Pull Request Sequence

1. `chore/codebase-map-and-docs`
2. `fix/storage-hydration-timer-safety`
3. `feat/shadcn-ui-foundation`
4. `feat/dashboard-revamp`
5. `feat/workout-builder-revamp`
6. `feat/live-session-revamp`
7. `feat/history-calendar-revamp`
8. `feat/modern-landing-page`
9. `chore/final-polish-and-qa`

## Do Not Do

- Do not rewrite the full app in one PR.
- Do not remove local-first behavior.
- Do not add authentication.
- Do not add backend dependency.
- Do not break existing LocalStorage data.
- Do not use shadcn/ui inconsistently.
- Do not ignore mobile.
