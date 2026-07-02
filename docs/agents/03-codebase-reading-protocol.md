# Codebase Reading Protocol

Before editing ForkWorkout, the agent must inspect the repository and produce a short codebase map.

## Step 1 — Project Metadata

Read:

- `package.json`
- lockfile
- `next.config.*`
- `tsconfig.json`
- Tailwind config
- `postcss.config.*`
- `components.json`
- `README.md`

Document:

- Framework version
- React version
- Styling setup
- shadcn/ui status
- Available scripts
- Test setup
- Lint setup

## Step 2 — Route Map

Inspect `app/` or `src/app/`.

Document every route:

```md
| Route | File | Purpose | Client/Server | Notes |
|---|---|---|---|---|
```

Pay attention to:

- `use client`
- Layout nesting
- Route groups
- Dynamic routes
- Redirects
- Metadata
- Loading/error files

## Step 3 — Component Map

Inspect components.

Document:

```md
| Component | File | Used By | Purpose | Risk |
|---|---|---|---|---|
```

Look for:

- Large components that need splitting
- Duplicate UI patterns
- Components mixing UI and persistence
- Components reading LocalStorage directly
- Components with complex state

## Step 4 — State and Persistence Map

Find all usage of:

- `localStorage`
- `sessionStorage`
- `JSON.parse`
- `JSON.stringify`
- workout IDs
- date serialization
- session state
- history state

Document:

```md
| Storage Key | Data Shape | Read From | Written From | Migration Needed? |
|---|---|---|---|---|
```

## Step 5 — Domain Model Map

Find or infer:

- Workout type
- Exercise type
- Set type
- Session type
- History entry type
- Program/template type

Document:

```md
| Model | Fields | Optional Fields | Problems |
|---|---|---|---|
```

## Step 6 — UX Journey Map

Manually trace these journeys in code:

1. User lands on app
2. User creates first workout
3. User adds exercises and sets
4. User starts workout
5. User completes/skips set
6. User uses/skips rest timer
7. User finishes workout
8. User returns to history/calendar

Document friction:

```md
| Journey Step | Current Behavior | Problem | Suggested Fix |
|---|---|---|---|
```

## Step 7 — Bug Risk Map

Look specifically for:

- Hydration issues
- LocalStorage parse crashes
- State mutation
- Timer cleanup bugs
- Date bugs
- Broken empty states
- Broken form validation
- Responsive layout bugs
- Accessibility issues

Document:

```md
| Risk | File | Why It Matters | Suggested Fix |
|---|---|---|---|
```

## Step 8 — shadcn/ui Readiness

Check:

- Is `components.json` present?
- Is `cn` utility present?
- Where are UI components stored?
- Are path aliases configured?
- Are Tailwind CSS variables configured?
- Is dark mode configured?

Document missing setup before using shadcn/ui heavily.

## Required Output Before Editing

Before making changes, produce:

```md
# ForkWorkout Codebase Map

## Stack

## Routes

## Components

## State and Storage

## Domain Models

## UX Journeys

## Bugs and Risks

## shadcn/ui Status

## Recommended Implementation Plan
```

Only after this map should the agent start editing.
