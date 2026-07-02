# Recommended Project Structure

This file describes a recommended target structure for the ForkWorkout revamp.

The agent must inspect the real repository first and adapt this structure to the existing app. Do not blindly move files if the current structure works.

## Preferred High-Level Structure

```txt
forkworkout/
  app/ or src/app/
    page.tsx
    layout.tsx
    globals.css
    app/
      page.tsx
      workouts/
        new/
          page.tsx
        [workoutId]/
          page.tsx
      session/
        [workoutId]/
          page.tsx
      history/
        page.tsx
      programs/
        page.tsx
  components/
    ui/
    layout/
    landing/
    workouts/
    session/
    history/
    shared/
  hooks/
  lib/
    storage/
    workout/
    date/
    sound/
    animation/
    utils.ts
  types/
  constants/
  docs/
    agents/
    specs/
    review/
```

## Route Responsibilities

### `/`

Modern landing page.

Purpose:

- Explain what ForkWorkout does.
- Show product value immediately.
- Guide users to create or open workouts.
- Communicate no account/local-first benefit.

Should not feel like a raw dashboard unless that is a deliberate product decision.

### `/app`

Main app dashboard.

Purpose:

- Show current streak/progress summary.
- Show saved workouts.
- Show quick start actions.
- Show recent history.
- Show empty state for new users.

### `/app/workouts/new`

Workout builder.

Purpose:

- Create a workout quickly.
- Add exercises and sets.
- Validate input.
- Save locally.

### `/app/workouts/[workoutId]`

Workout detail and edit screen.

Purpose:

- View workout structure.
- Edit title/exercises/sets.
- Start workout.
- Delete workout with confirmation.

### `/app/session/[workoutId]`

Live workout session.

Purpose:

- Guide user set by set.
- Show progress.
- Let user complete or skip sets.
- Show rest timer.
- Finish and save workout history.

### `/app/history`

History and calendar.

Purpose:

- Show workout days.
- Show streaks.
- Show completed workout sessions.
- Let users understand progress.

### `/app/programs`

Optional programs/suggestions.

Purpose:

- Show starter programs such as P90X or other routines.
- Let users start from a template.

## Component Organization

### `components/ui/`

Generated shadcn/ui primitives.

Do not mix domain logic here.

Examples:

```txt
components/ui/button.tsx
components/ui/card.tsx
components/ui/dialog.tsx
components/ui/input.tsx
components/ui/badge.tsx
components/ui/progress.tsx
```

### `components/layout/`

App-level layout components.

Examples:

```txt
AppShell.tsx
MobileNav.tsx
TopBar.tsx
PageContainer.tsx
BottomActionBar.tsx
```

### `components/landing/`

Landing page sections.

Examples:

```txt
LandingHero.tsx
LandingFeatureGrid.tsx
LandingHowItWorks.tsx
LandingPreview.tsx
LandingCTA.tsx
```

### `components/workouts/`

Workout creation and management components.

Examples:

```txt
WorkoutCard.tsx
WorkoutForm.tsx
ExerciseBuilder.tsx
ExerciseEditorCard.tsx
SetRow.tsx
WorkoutTemplateCard.tsx
DeleteWorkoutDialog.tsx
```

### `components/session/`

Live workout components.

Examples:

```txt
LiveSessionView.tsx
SessionProgress.tsx
CurrentExerciseCard.tsx
SetTrackerList.tsx
RestTimerDialog.tsx
FinishWorkoutDialog.tsx
```

### `components/history/`

History/calendar components.

Examples:

```txt
WorkoutCalendar.tsx
StreakSummary.tsx
HistoryList.tsx
HistoryEmptyState.tsx
```

### `components/shared/`

Reusable non-shadcn app components.

Examples:

```txt
EmptyState.tsx
SectionHeader.tsx
StatCard.tsx
LoadingState.tsx
ErrorState.tsx
ConfirmDialog.tsx
```

## Logic Organization

### `lib/storage/`

LocalStorage utilities.

Examples:

```txt
keys.ts
safe-storage.ts
migrations.ts
workout-storage.ts
history-storage.ts
```

Responsibilities:

- Safe JSON parsing
- Versioning
- Migration
- Defaults
- SSR-safe access

### `lib/workout/`

Workout domain logic.

Examples:

```txt
workout-factory.ts
workout-validation.ts
session-progress.ts
workout-history.ts
exercise-suggestions.ts
```

Responsibilities:

- Create workouts
- Validate workouts
- Compute session progress
- Compute completed/skipped counts
- Avoid React-specific logic

### `lib/date/`

Date and calendar utilities.

Examples:

```txt
calendar.ts
date-key.ts
streak.ts
```

Responsibilities:

- Convert dates to stable day keys
- Compare calendar days safely
- Compute streaks
- Avoid timezone bugs

### `hooks/`

React hooks for client behavior.

Examples:

```txt
useLocalStorageState.ts
useWorkouts.ts
useWorkoutHistory.ts
useRestTimer.ts
useSound.ts
useReducedMotion.ts
```

Hooks should be thin wrappers over tested utility logic.

## Type Organization

Use either `types/` or colocated domain types.

Suggested:

```txt
types/workout.ts
types/session.ts
types/history.ts
types/storage.ts
```

Keep types explicit and reusable.

## Naming Guidelines

Use clear names:

- `Workout`
- `Exercise`
- `WorkoutSet`
- `WorkoutSession`
- `WorkoutHistoryEntry`
- `SetStatus`
- `WorkoutTemplate`

Avoid vague names:

- `Item`
- `Data`
- `Thing`
- `Info`
- `Obj`

## Refactor Strategy

Preferred path:

1. Add safe utilities first.
2. Add shared UI components.
3. Refactor one screen at a time.
4. Keep behavior stable.
5. Run tests/build after each meaningful phase.

Avoid:

- Rewriting all routes in one step.
- Changing data model and UI at the same time.
- Moving files without updating imports and tests.
- Removing old storage support.
