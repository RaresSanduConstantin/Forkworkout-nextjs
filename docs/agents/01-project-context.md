# ForkWorkout Project Context

## Product Name

**ForkWorkout: An app that keeps you fit**

## Demo

Production demo: `https://forkworkout.vercel.app/`

## Product Overview

ForkWorkout is a simple, mobile-first workout tracking app designed to help users stay motivated and consistent with their fitness goals.

It features:

- Smooth user experience
- Playful visuals
- Lightweight persistence
- No account required
- Fast workout creation
- Live workout tracking
- Calendar and streak visibility

The app should make it easy for users to track exercises, reps, completed sets, skipped sets, and completed workout days.

## Original Build Goal

ForkWorkout was built as an opportunity to focus on clean, mobile-centric design and delightful UX.

The original goal was:

- Keep the app fast
- Keep the app intuitive
- Keep the app playful
- Use bright gradients, fun fonts, and a colorful UI
- Persist user data client-side using `localStorage`
- Let users start tracking immediately without authentication

## Current Revamp Goal

The revamp should evolve ForkWorkout from a fun prototype into a more polished, modern, product-like app.

The app should still feel playful, but it should be easier to understand and more visually refined.

## Tech Stack

Expected stack:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- LocalStorage
- Framer Motion
- Custom utilities for timers, animations, and workout management

The agent must verify the actual stack in `package.json` before making changes.

## Core Features

### Workout Creation

Users can create workouts with:

- Workout title
- Exercises
- Sets
- Reps
- Weight
- Time/duration values where relevant

### Dynamic Exercise Builder

Users should be able to:

- Add exercises
- Edit exercises
- Remove exercises
- Add sets
- Edit sets
- Remove sets
- Use pre-filled suggestions where available

### Live Workout Tracker

Users should be able to:

- Start a workout
- See the current exercise
- See current set progress
- Mark sets as completed
- Mark sets as skipped
- Move through the session clearly
- Finish the workout

### Rest Timer Modal

The timer should:

- Appear between sets where relevant
- Count down clearly
- Be skippable
- Handle sound notifications safely
- Clean up intervals on close/navigation
- Respect reduced motion preferences for animations

### Workout History

The app should:

- Save completed workouts
- Show completed workout days
- Highlight workout history in a calendar
- Make streak/progress easy to understand

### Calendar Integration

Calendar should show:

- Completed days
- Current streak, if implemented
- Recent activity
- Empty state when no workouts exist

### Animations and Sounds

Animations and sounds should:

- Provide useful feedback
- Not block the user
- Not make the app feel noisy
- Not hurt performance
- Respect accessibility preferences

## Challenges to Address

### Mobile UX

The app must remain comfortable on small screens.

Key checks:

- Tap targets are large enough.
- Forms are not cramped.
- Primary actions are reachable.
- Live workout actions are clear.
- Bottom actions do not hide content.

### State Management

Workout session state can be complex.

The agent should carefully inspect:

- How workouts are created
- How sessions are started
- How set completion is stored
- How skipped sets are stored
- How completed workouts are saved
- How dates are recorded
- How LocalStorage is read/written

### Calendar Dates

Date bugs are common.

The agent should verify:

- Timezone handling
- Date serialization
- Day comparison logic
- Month navigation
- Calendar highlighting
- Duplicate history entries

### Color Font and Visual Rendering

If custom fonts or color fonts exist, verify:

- Cross-browser rendering
- Mobile rendering
- Fallback fonts
- Readability
- Layout shifts

## Desired Product Personality

ForkWorkout should feel:

- Modern
- Friendly
- Motivating
- Energetic
- Clean
- Slightly playful
- Simple to use

Avoid:

- Childish visuals
- Too many competing colors
- Low-contrast gradients
- Confusing decorative elements
- Over-animated flows
