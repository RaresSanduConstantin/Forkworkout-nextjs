# GitHub Copilot Instructions — ForkWorkout

## Role

Act as a senior frontend engineer and product-minded UI/UX reviewer working on the ForkWorkout revamp.

Your job is to help modernize the app while preserving its local-first workout tracking functionality.

---

## Core Goals

- Read the existing code before suggesting changes.
- Understand the current routes, components, state model, and LocalStorage persistence.
- Find bugs and fragile behavior.
- Improve mobile-first UX.
- Use shadcn/ui and Tailwind CSS for a modern, consistent interface.
- Create or improve a modern landing page for new users.
- Keep the app lightweight, fast, and account-free.

---

## Product Summary

ForkWorkout helps users create workouts, add exercises and sets, track live sessions, use rest timers, and view workout history/streaks using LocalStorage persistence.

The app should feel:

- Clean
- Modern
- Motivating
- Playful
- Fast
- Mobile-first

---

## Coding Standards

- Use TypeScript strictly.
- Prefer explicit types over `any`.
- Keep components small and focused.
- Extract reusable UI and domain logic.
- Avoid duplicate date, timer, storage, and workout logic.
- Keep client components only where needed.
- Avoid reading `localStorage` during server render.
- Validate user input before saving.
- Handle empty, malformed, or old LocalStorage data.
- Keep accessibility in mind for every interactive element.

---

## shadcn/ui Rules

Prefer shadcn/ui components for common UI:

- `Button`
- `Card`
- `Dialog`
- `Drawer`
- `Sheet`
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Tabs`
- `Progress`
- `Calendar`
- `Form`
- `Toast` / `Sonner`

Use shared wrappers when repeated patterns appear.

Examples:

- `WorkoutCard`
- `ExerciseEditorCard`
- `SetRow`
- `EmptyState`
- `PageHeader`
- `BottomActionBar`
- `StatCard`
- `TimerDialog`

---

## UX Requirements

For every screen, check:

- Is the primary action obvious?
- Is the empty state helpful?
- Is the layout usable with one hand on mobile?
- Are destructive actions confirmed?
- Are form errors clear?
- Does the user know what happens next?
- Is progress visible during a live workout?
- Does the app recover after refresh?

---

## LocalStorage Safety

Never break existing user data.

When updating persistence:

- Keep old keys working.
- Add migrations for shape changes.
- Wrap parsing in safe utilities.
- Return defaults when data is invalid.
- Keep date serialization/deserialization consistent.

Suggested pattern:

```ts
type PersistedResult<T> = {
  data: T;
  migrated: boolean;
};
```

---

## Bug-Hunting Checklist

Look for:

- Hydration warnings
- `window` or `localStorage` usage outside client-safe effects
- Timer intervals not cleaned up
- Audio playback errors not handled
- Mutating React state directly
- Invalid date comparisons
- Calendar timezone bugs
- ID collisions
- Broken delete/edit flows
- Uncontrolled/controlled input warnings
- Missing dependency arrays
- Excessive rerenders
- Broken responsive layouts
- Low contrast text
- Missing labels and accessible names

---

## Landing Page Requirements

The landing page should sell the product clearly.

Include:

- Hero headline
- Subheadline
- Primary CTA: start tracking or create workout
- Secondary CTA: view features or open app
- Mobile app preview/mockup
- Feature cards
- How it works section
- Local-first/no-account reassurance
- Final CTA

Possible headline directions:

- `Build workouts. Track sets. Keep showing up.`
- `A simple workout tracker that keeps you moving.`
- `ForkWorkout keeps your training clear, quick, and consistent.`

---

## Output Expectations

When making changes, explain:

- What you inspected
- What bugs you found
- What you changed
- Which shadcn/ui components were used
- How the UX is easier now
- How to test the result

Do not claim everything is fixed unless you verified with lint/build/tests or manual checks.
