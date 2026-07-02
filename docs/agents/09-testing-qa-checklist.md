# Testing and QA Checklist

Use this checklist before considering the ForkWorkout revamp complete.

## Commands

Verify actual scripts in `package.json` first.

Common commands to run if available:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Use the project's package manager. If the lockfile is `pnpm-lock.yaml`, use `pnpm`. If it is `yarn.lock`, use `yarn`. If it is `package-lock.json`, use `npm`.

## LocalStorage QA

Test with:

### Empty storage

1. Clear LocalStorage.
2. Refresh app.
3. Confirm no crash.
4. Confirm helpful empty states.
5. Create a new workout.

### Existing valid storage

1. Create workout.
2. Refresh.
3. Confirm workout remains.
4. Start workout.
5. Complete session.
6. Confirm history/calendar update.

### Corrupted storage

Manually set a relevant key to invalid JSON.

Expected:

- App does not crash.
- App resets or ignores invalid data safely.
- Console may warn in development but should not break UX.

### Old storage shape

If migrations were added, test old sample data.

Expected:

- Old workouts load.
- Data migrates safely.
- User does not lose workouts.

## Workout Creation QA

Test:

- Create workout with valid title.
- Create workout with empty title.
- Add exercise.
- Remove exercise.
- Add set.
- Remove set.
- Enter reps.
- Enter weight.
- Enter duration/time if supported.
- Try negative values.
- Try decimal weights.
- Save.
- Refresh.
- Edit workout.
- Delete workout.

Expected:

- Invalid inputs are handled clearly.
- No broken state after removing items.
- Saved data persists.
- Delete uses confirmation.

## Live Session QA

Test:

- Start workout.
- Complete first set.
- Skip a set.
- Complete all sets.
- Use rest timer.
- Skip rest timer.
- Navigate back mid-session.
- Refresh mid-session if session persistence exists.
- Finish workout.

Expected:

- Correct set is updated.
- Progress is accurate.
- Completed/skipped states are distinct.
- Timer starts/stops correctly.
- History is saved when workout finishes.

## Timer QA

Test:

- Open timer.
- Close timer.
- Reopen timer.
- Let timer reach zero.
- Skip timer.
- Navigate away while timer runs.

Expected:

- No duplicate intervals.
- Timer does not go negative.
- Sound does not fire repeatedly.
- No unhandled audio promise errors.

## Calendar and History QA

Test:

- Complete workout today.
- Confirm today is highlighted.
- Complete multiple workouts same day.
- Confirm day is not duplicated visually.
- Change month.
- Test month boundary if possible.
- Confirm history list matches completed sessions.

Expected:

- Correct day highlighted.
- Streak count is correct if implemented.
- History list is readable and accurate.

## Landing Page QA

Test:

- Hero visible on first load.
- Primary CTA routes correctly.
- Secondary CTA routes or scrolls correctly.
- Feature cards are readable.
- Mobile preview does not overflow.
- No-account/local-first message is visible.
- Final CTA routes correctly.

## Responsive QA

Test widths:

- 320px
- 375px
- 390px
- 430px
- 768px
- 1024px
- 1440px

Check:

- No horizontal scroll.
- Buttons are tappable.
- Forms are readable.
- Dialogs/drawers fit.
- Sticky elements do not hide content.
- Calendar fits.

## Accessibility QA

Check:

- Keyboard navigation
- Visible focus states
- Input labels
- Button labels
- Icon-only labels
- Dialog titles
- Dialog descriptions
- Color contrast
- Reduced motion
- Screen reader-friendly status text

## Browser QA

Test at least:

- Chrome
- Safari or mobile Safari if possible
- Firefox if possible

Pay attention to:

- Audio behavior
- LocalStorage availability
- CSS viewport units
- Font rendering
- Dialog/drawer behavior

## Final QA Report Format

```md
# QA Report

## Commands Run

## Manual Flows Tested

## Bugs Found

## Bugs Fixed

## Known Issues

## Screenshots / Notes
```
