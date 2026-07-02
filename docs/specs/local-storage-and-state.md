# LocalStorage and State Specification

ForkWorkout is local-first. User data is stored in the browser using LocalStorage.

This file defines how agents should approach persistence during the revamp.

## Persistence Principles

- No account is required.
- No backend is required.
- Workouts and history should persist across refreshes.
- Existing user data must not be broken.
- Corrupted data must not crash the app.
- Storage reads must be safe for Next.js rendering.

## SSR and Hydration Rule

Never read `localStorage` during server render.

Unsafe:

```ts
const workouts = JSON.parse(localStorage.getItem('workouts') ?? '[]');
```

Safer approach:

- Render a client-safe initial state.
- Read storage in `useEffect`.
- Show a loading/skeleton state if needed.
- Centralize persistence in hooks/utilities.

## Recommended Storage Keys

The agent must inspect existing keys first.

If new keys are needed, prefer namespaced keys:

```txt
forkworkout:workouts
forkworkout:history
forkworkout:active-session
forkworkout:settings
forkworkout:storage-version
```

Do not rename existing keys without migration.

## Recommended Data Versioning

Use a version field if changing persisted shapes.

Example:

```ts
type ForkWorkoutStorageEnvelope<T> = {
  version: number;
  data: T;
};
```

If existing data is raw arrays/objects, support both old and new formats.

## Safe Parse Utility

Recommended behavior:

```ts
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}
```

Improve this with runtime validation if the project already uses or can safely add a validation library.

## Workout State Requirements

Workout data should support:

- Workout ID
- Title
- Exercises
- Sets
- Created timestamp
- Updated timestamp

Exercise data should support:

- Exercise ID
- Name
- Sets

Set data should support:

- Set ID
- Reps, optional
- Weight, optional
- Duration/time, optional
- Notes, optional if currently supported

## Session State Requirements

Live session state should support:

- Workout ID
- Started timestamp
- Current exercise index or ID
- Current set index or ID
- Completed set IDs
- Skipped set IDs
- Finished timestamp, optional

Avoid relying only on array indexes if exercises/sets can be edited during an active session.

## History Requirements

Workout history should support:

- History entry ID
- Workout ID
- Workout title at completion time
- Completed timestamp
- Local day key, such as `YYYY-MM-DD`
- Completed set count
- Skipped set count
- Total set count
- Duration, optional

Store both timestamp and day key if calendar uses day-level grouping.

## Date Key Rule

For calendar day comparison, use a stable day key:

```txt
YYYY-MM-DD
```

Generate this from local date when the workout is completed.

Do not compare full ISO timestamps when only the calendar day matters.

## Migration Strategy

When changing shape:

1. Detect old shape.
2. Convert to new shape.
3. Save migrated shape.
4. Keep fallback path for invalid data.
5. Do not delete old data until migration succeeds.

## Error Handling

If storage fails:

- App should continue in memory if possible.
- Show helpful message only if the user action failed.
- Avoid noisy user-facing errors for recoverable startup parsing.

## Acceptance Criteria

- Empty LocalStorage works.
- Corrupted LocalStorage does not crash.
- Existing workouts still load.
- Completed workouts persist.
- Calendar reflects completed workout days.
- Storage reads do not cause hydration warnings.
