# Landing Page Specification

## Goal

Create a modern landing page for ForkWorkout that clearly communicates the product and guides users into the app.

The landing page should feel like a polished mobile fitness product, not just a dashboard.

## Primary Audience

People who want a simple workout tracker without accounts, complex setup, or heavy fitness platform features.

## Main Message

ForkWorkout helps users build workouts, track sets, and stay consistent without needing an account.

## Suggested Page Structure

```txt
Hero
Product Preview
Feature Cards
How It Works
Local-First Reassurance
Programs/Workout Templates Teaser
Final CTA
```

## Hero Section

### Goal

Explain the product in one glance.

### Content

Possible headline:

```txt
Build workouts. Track sets. Keep showing up.
```

Possible subheadline:

```txt
ForkWorkout is a fast, mobile-first workout tracker for creating routines, completing sets, timing rests, and keeping your streak alive — no account required.
```

Primary CTA:

```txt
Start tracking
```

Secondary CTA:

```txt
See how it works
```

Trust/support text:

```txt
No login. Saved on your device. Ready when you are.
```

### Visual Direction

- Large clean headline
- Gradient accent background
- Phone-like app preview card
- Floating stat chips
- Strong CTA
- Mobile-first layout

Suggested visual elements:

- Streak chip: `7 day streak`
- Progress chip: `12 / 18 sets`
- Timer chip: `Rest 00:45`
- Workout card preview

## Product Preview Section

Show a mock preview of the app.

Suggested preview content:

```txt
Today’s workout
Upper Body Strength
12 of 18 sets complete
Current: Dumbbell Press · Set 3
[Complete set]
```

This can be built using real components or static landing components.

## Feature Cards

Use 3 to 6 cards.

Recommended cards:

### Create routines fast

```txt
Add exercises, sets, reps, and weights in a clean builder designed for mobile.
```

### Track every set

```txt
Complete or skip sets during a focused live workout session.
```

### Rest without guessing

```txt
Use a playful countdown timer between sets and jump back in when ready.
```

### Keep your streak alive

```txt
Completed workouts light up your calendar so consistency is easy to see.
```

### No account needed

```txt
Your workouts are saved locally on your device, so you can start immediately.
```

### Playful but focused

```txt
Smooth animations and feedback keep the experience motivating without slowing you down.
```

## How It Works Section

Use 3 steps.

### Step 1

```txt
Create a workout
Add your exercises and sets in minutes.
```

### Step 2

```txt
Start your session
Follow the live tracker and complete each set.
```

### Step 3

```txt
Build consistency
Finish workouts and watch your calendar fill up.
```

## Local-First Reassurance Section

Communicate clearly:

- No login required
- No backend needed
- Data saved on device
- Fast startup

Suggested copy:

```txt
No account wall. No complicated setup. ForkWorkout stores your routines on this device so you can open the app and start training immediately.
```

Also mention limitation honestly if useful:

```txt
Because it is local-first, data is tied to this browser/device unless export or sync is added later.
```

## Programs/Templates Teaser

If the app has program templates such as P90X, show them as optional starting points.

Suggested copy:

```txt
Start from scratch or pick a program template when you want structure.
```

## Final CTA

Suggested headline:

```txt
Ready to log your next workout?
```

CTA:

```txt
Create your first workout
```

## Design Requirements

- Mobile-first
- Strong contrast
- shadcn/ui cards and buttons
- Responsive layout
- Smooth but subtle animations
- No cluttered hero
- CTA visible above the fold
- Good Lighthouse/accessibility baseline

## Suggested Component Breakdown

```txt
components/landing/LandingPage.tsx
components/landing/LandingHero.tsx
components/landing/LandingPreview.tsx
components/landing/FeatureGrid.tsx
components/landing/HowItWorks.tsx
components/landing/LocalFirstSection.tsx
components/landing/LandingFinalCTA.tsx
```

## shadcn/ui Components to Use

- `Button`
- `Card`
- `Badge`
- `Progress`
- `Separator`

Optional:

- `Tabs` if preview switches between Builder/Session/History
- `Accordion` for FAQ

## Landing Page Acceptance Criteria

- User understands the app without scrolling.
- Primary CTA is visible above the fold.
- Page works well on 320px wide screens.
- Copy communicates no-account local-first behavior.
- Feature cards match real app features.
- Visual design matches the revamped app UI.
- CTA routes to the correct app flow.
