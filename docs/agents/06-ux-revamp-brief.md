# UX Revamp Brief

## UX Goal

Make ForkWorkout easier to understand, easier to start, and more enjoyable to use during an actual workout.

A user should be able to:

1. Land on the app and immediately understand the value.
2. Create a workout without confusion.
3. Start a workout quickly.
4. Track sets with minimal tapping.
5. See progress and feel motivated.
6. Return later and understand their history.

## Current Product Risk

The app may currently behave more like an immediate dashboard than a polished product entry point. The revamp should separate:

- Marketing/explanation for new users
- App dashboard for active users
- Live workout session for focused tracking

## Main UX Principles

### One primary action per screen

Every screen should have a clear main action.

Examples:

- Landing: `Start tracking`
- Empty dashboard: `Create your first workout`
- Workout card: `Start`
- Builder: `Save workout`
- Live session: `Complete set`
- History: `Start another workout`

### Empty states must guide users

Bad empty state:

```txt
No workouts yet.
```

Better empty state:

```txt
No workouts yet
Create your first routine and ForkWorkout will save it on this device.
[Create workout]
```

### Reduce setup friction

Workout creation should not feel like a form-heavy admin panel.

Improve with:

- Starter templates
- Exercise suggestions
- Default one exercise and one set
- Clear add/remove buttons
- Inline validation
- Sticky save button on mobile

### Live workout should be focused

During a workout, avoid distractions.

Prioritize:

- Current exercise
- Current set
- Progress
- Complete set button
- Skip option
- Rest timer

Hide or reduce:

- Editing complexity
- Long workout summaries
- Decorative landing visuals

### Make progress visible

Use progress indicators:

- Sets completed out of total
- Exercise number out of total
- Session progress bar
- Workout complete celebration
- Calendar highlight
- Streak summary

## Suggested User Journey

### New User Journey

1. User opens landing page.
2. Hero explains product.
3. CTA says `Create your first workout`.
4. User goes to workout builder.
5. Builder starts with one blank exercise and one blank set.
6. User saves workout.
7. User lands on workout detail or dashboard.
8. User taps `Start workout`.
9. Live session guides them through sets.
10. Completion saves history.
11. Dashboard shows progress/calendar update.

### Returning User Journey

1. User opens app dashboard.
2. Sees streak and saved workouts.
3. Taps `Start` on a workout.
4. Completes session.
5. Sees completion feedback and updated history.

## Landing Page UX

The landing page should answer:

- What is this?
- Why should I use it?
- Do I need an account?
- How fast can I start?
- What does it track?

Suggested sections:

1. Hero
2. Mobile product preview
3. Feature cards
4. How it works
5. Local-first/no account reassurance
6. Final CTA

## Dashboard UX

Dashboard should show:

- Greeting or motivational header
- Streak/activity summary
- Primary CTA
- Saved workout cards
- Recent activity
- Programs/templates if available

New users should see:

- Friendly empty state
- Create workout CTA
- Optional starter program CTA

## Workout Builder UX

Builder should have:

- Workout title field
- Exercises as cards
- Sets as rows
- Add exercise button
- Add set button
- Save action
- Clear validation

Mobile behavior:

- Use vertical layout.
- Keep actions large.
- Sticky bottom save button if useful.
- Avoid cramped tables.

## Live Session UX

Live session should have:

- Big current exercise name
- Current set details
- Progress bar
- Completed/skipped badges
- Large complete button
- Smaller skip button
- Rest timer drawer/dialog
- Finish screen

Recommended live session hierarchy:

```txt
Workout title
Progress: 7 of 18 sets
Current exercise
Set details
[Complete set]
[Skip]
Upcoming sets
```

## History UX

History should have:

- Calendar
- Streak summary
- Completed workout list
- Empty state
- Clear completed-day markers

Avoid making the calendar the only source of progress. Add summary cards too.

## Copy Tone

Use concise, motivating copy.

Examples:

- `Build your routine in minutes.`
- `Track every set without signing up.`
- `Your workouts stay saved on this device.`
- `Ready for your next session?`
- `Nice work — workout complete.`

Avoid generic or unclear copy:

- `Submit`
- `Click here`
- `Data saved`
- `Error occurred`

## UX Acceptance Criteria

- A new user knows what to do within 10 seconds.
- Workout creation works without reading instructions.
- A live workout can be completed with one hand on mobile.
- Empty states guide the next action.
- Destructive actions are confirmed.
- Calendar and history update immediately after completion.
- The UI feels consistent across screens.
