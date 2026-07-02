# ForkWorkout Bug Audit Checklist

Use this checklist while inspecting and revamping the app.

## Hydration and Client Safety

Check for:

- `localStorage` used during render
- `window` used during render
- `document` used during render
- Browser-only APIs used in server components
- Date-generated values that differ between server/client
- Random IDs generated during server render
- Hydration warnings in console

Fix patterns:

- Move browser-only reads into `useEffect`.
- Use client components only where necessary.
- Use stable IDs stored in data rather than generated on every render.
- Render loading/skeleton states until client data is hydrated.

## LocalStorage Bugs

Check for:

- Unsafe `JSON.parse`
- No fallback for corrupted data
- No storage version
- No migration strategy
- Inconsistent storage keys
- Saving partial invalid workout data
- Deleting the wrong workout/history entry
- Duplicate history entries

Fix patterns:

- Centralize storage utilities.
- Add safe parsing.
- Validate data before saving.
- Use typed defaults.
- Add migrations when changing data shape.

## Workout Builder Bugs

Check for:

- Empty workout titles accepted without useful default
- Empty exercise names
- Sets with invalid reps/weight/time
- Negative numbers
- Decimal handling for weights
- Removing last exercise causing broken state
- Removing last set causing broken state
- Duplicate IDs
- Inputs losing focus on state update
- Controlled/uncontrolled input warnings

Fix patterns:

- Validate form data.
- Use stable IDs.
- Keep at least one exercise and one set unless UX clearly allows empty drafts.
- Show inline errors.
- Provide helpful placeholders and suggestions.

## Live Session Bugs

Check for:

- Set completion state lost on refresh
- Skip/complete actions targeting wrong set
- Progress percentage incorrect
- Finish enabled too early or too late
- Back navigation loses session unexpectedly
- User cannot resume a workout
- Completed and skipped states overlap
- Mutating nested session state directly

Fix patterns:

- Store session progress explicitly.
- Use immutable updates.
- Compute progress from source-of-truth state.
- Confirm exit if session is in progress.

## Rest Timer Bugs

Check for:

- Multiple intervals running
- Interval not cleared on unmount
- Timer continues after modal closes
- Timer goes negative
- Sound fires multiple times
- Sound fails and throws unhandled promise rejection
- Timer starts unexpectedly
- Timer impossible to skip

Fix patterns:

- Use a dedicated `useRestTimer` hook.
- Clear intervals in cleanup.
- Clamp time at zero.
- Wrap audio playback in safe `try/catch` or `.catch()`.
- Respect user interaction requirements for audio.

## Calendar and Date Bugs

Check for:

- Date comparisons using full ISO timestamps when day-level comparison is needed
- Timezone causing workouts to appear on previous/next day
- Month navigation off by one
- Week starts inconsistent with UI labels
- Duplicate completed days
- Streak count wrong around midnight
- Calendar not updated after finishing workout

Fix patterns:

- Use a stable local day key like `YYYY-MM-DD`.
- Store completed day separately from full timestamp.
- Keep date utilities centralized.
- Test around month boundaries.

## Responsive Layout Bugs

Check on:

- 320px width
- 375px width
- 390px width
- 430px width
- Tablet width
- Desktop width

Look for:

- Horizontal scroll
- Buttons too small
- Inputs clipped by keyboard
- Sticky buttons covering content
- Cards too cramped
- Modals too tall
- Calendar overflow
- Text unreadable over gradients

Fix patterns:

- Mobile-first layouts.
- Use `min-h-dvh` instead of fragile viewport sizing where appropriate.
- Add safe bottom padding when using sticky action bars.
- Use responsive grids.

## Accessibility Bugs

Check for:

- Buttons without accessible names
- Icon-only buttons without labels
- Inputs without labels
- Dialogs missing titles/descriptions
- Color-only status indicators
- Low contrast text
- Missing focus styles
- Keyboard traps
- Animations ignoring reduced motion

Fix patterns:

- Use semantic elements.
- Add labels and `aria-label` where needed.
- Use shadcn/ui dialog primitives correctly.
- Add visible focus states.
- Use text + color for status.

## Performance Bugs

Check for:

- Heavy animation on every render
- Large arrays recomputed repeatedly
- Unmemoized expensive date calculations
- Excessive client components
- Unnecessary rerenders from large shared state
- Large images without optimization

Fix patterns:

- Memoize expensive derived values.
- Split components.
- Keep server components where useful.
- Use optimized images.
- Avoid animation spam.

## Required Bug Report Format

```md
## Bug

### Location

### Current Behavior

### Expected Behavior

### Impact

### Root Cause

### Fix

### Test Steps
```
