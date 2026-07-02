# Workout Domain Model Specification

This is a recommended domain model for ForkWorkout. The agent must inspect the current model before changing anything.

## Goals

The model should support:

- Workout creation
- Exercise editing
- Set editing
- Live session tracking
- Completed/skipped sets
- Workout history
- Calendar/streak display
- LocalStorage persistence

## Suggested Types

```ts
export type Workout = {
  id: string;
  title: string;
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
};

export type Exercise = {
  id: string;
  name: string;
  sets: WorkoutSet[];
};

export type WorkoutSet = {
  id: string;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  notes?: string;
};

export type SetStatus = 'pending' | 'completed' | 'skipped';

export type WorkoutSession = {
  id: string;
  workoutId: string;
  startedAt: string;
  currentExerciseId?: string;
  currentSetId?: string;
  setStatuses: Record<string, SetStatus>;
};

export type WorkoutHistoryEntry = {
  id: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: string;
  completedDayKey: string;
  completedSets: number;
  skippedSets: number;
  totalSets: number;
  durationSeconds?: number;
};
```

## Important Modeling Rules

### Use stable IDs

Every workout, exercise, and set should have a stable ID.

Avoid using array indexes as long-term identifiers because editing can reorder or remove items.

### Keep history snapshots stable

History should not break if the original workout is later edited or deleted.

Store enough snapshot data in history to display completed sessions:

- Workout title at completion time
- Completed date
- Set counts
- Duration, if available

### Avoid ambiguous set values

A set may use reps, weight, duration, or a combination.

Validate based on current app behavior.

Examples:

- Strength set: reps + weight
- Bodyweight set: reps
- Timed set: durationSeconds

### Support skipped sets

Skipped sets should be represented separately from completed sets.

Do not treat skipped sets as completed.

### Calculate progress from source of truth

Progress should derive from total sets and set statuses.

Example:

```ts
const completedOrSkipped = Object.values(setStatuses).filter(
  (status) => status === 'completed' || status === 'skipped'
).length;

const progress = completedOrSkipped / totalSets;
```

## Validation Rules

A valid workout should have:

- Non-empty title or generated default title
- At least one exercise
- Each exercise should have a non-empty name
- Each exercise should have at least one set
- Set values should be positive where provided

Input validation should be user-friendly, not hostile.

## Derived Values

Create utilities for:

- Total exercises
- Total sets
- Completed set count
- Skipped set count
- Remaining set count
- Current exercise/set
- Next exercise/set
- Session progress
- Workout duration
- Streak count

Keep derived logic out of UI components where possible.
