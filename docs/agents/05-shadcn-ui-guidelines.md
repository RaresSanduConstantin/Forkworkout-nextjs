# shadcn/ui Guidelines for ForkWorkout

ForkWorkout should use shadcn/ui as the foundation for a consistent, modern interface.

## First Checks

Before adding components, verify:

- `components.json` exists
- Tailwind is configured
- CSS variables are configured
- `cn` utility exists
- Path aliases work
- Existing UI components are not duplicated unnecessarily

If shadcn/ui is not installed, initialize it using the project's package manager and existing conventions.

## Recommended shadcn/ui Components

Use these where appropriate:

```txt
button
card
input
textarea
label
select
dialog
drawer
sheet
badge
progress
tabs
calendar
separator
sonner
form
checkbox
switch
popover
command
```

Do not add every component at once. Add only what the current phase needs.

## ForkWorkout UI Patterns

### Page Header

Use for major pages.

Should include:

- Title
- Short description
- Optional stat or badge
- Optional primary action

Example use cases:

- Dashboard
- Workout builder
- Live workout
- History

### Workout Card

Use `Card` as the base.

Should include:

- Workout title
- Exercise count
- Set count
- Last completed, if available
- Primary action: Start
- Secondary action: Edit/View

### Exercise Editor Card

Use `Card` with clear form sections.

Should include:

- Exercise name input
- Set rows
- Add set button
- Remove exercise action with confirmation if needed

### Set Row

Use inputs with clear labels.

Should support:

- Reps
- Weight
- Duration/time
- Optional notes if currently supported

### Live Session Card

Use `Card`, `Progress`, `Badge`, and `Button`.

Should show:

- Current exercise
- Current set
- Set details
- Completed/skipped state
- Progress
- Primary action: Complete set
- Secondary action: Skip set

### Rest Timer Dialog / Drawer

On mobile, a `Drawer` may feel better than a centered dialog.

Should include:

- Big countdown
- Current rest label
- Skip button
- Add 15 seconds button, optional
- Reduce 15 seconds button, optional
- Sound toggle, optional

### Empty State

Use a shared component with:

- Small icon or illustration
- Clear title
- Helpful description
- Primary CTA

Examples:

- No workouts yet
- No history yet
- No programs available

## Visual Direction

Use a modern fitness-product style:

- Clean cards
- Soft shadows or borders
- Rounded corners
- Strong primary CTA
- Clear hierarchy
- Subtle gradients, not everywhere
- Motivational but readable copy

Suggested token direction:

```txt
Background: neutral base with subtle gradient accents
Primary: energetic green, lime, orange, or violet accent
Cards: high contrast against page background
Text: strong foreground, muted secondary copy
Status completed: success treatment
Status skipped: muted/warning treatment
Danger: clear destructive color
```

Do not hardcode too many one-off colors. Prefer CSS variables and Tailwind tokens.

## Dark Mode

If dark mode exists, preserve it.

If adding dark mode:

- Ensure contrast is strong.
- Test dialogs, drawers, inputs, and calendar.
- Avoid low-opacity text over gradients.

## Motion Guidelines

Use Framer Motion sparingly.

Good animation targets:

- Landing hero entrance
- Card hover on desktop
- Workout completion feedback
- Timer progress
- Empty state reveal

Avoid:

- Animating every list item on every render
- Long transitions
- Motion that blocks the user
- Motion that ignores reduced motion

## Accessibility Rules

Every shadcn/ui implementation must include:

- Proper labels
- Dialog titles
- Dialog descriptions where needed
- Accessible icon buttons
- Keyboard support
- Focus visibility
- Color contrast

## Example Component Usage Pattern

```tsx
<Card>
  <CardHeader>
    <CardTitle>Upper Body Strength</CardTitle>
    <CardDescription>5 exercises · 18 sets</CardDescription>
  </CardHeader>
  <CardContent>
    {/* workout summary */}
  </CardContent>
  <CardFooter className="gap-2">
    <Button>Start workout</Button>
    <Button variant="outline">Edit</Button>
  </CardFooter>
</Card>
```

Adapt this to the existing code style and imports.
