# ForkWorkout PR Review Template

Use this template when reviewing revamp changes.

## Summary

- What changed?
- Why was it changed?

## Product / UX Review

- Is the primary user journey easier?
- Is the primary action clear on every changed screen?
- Are empty states helpful?
- Is the mobile experience comfortable?
- Does the UI feel consistent with the new design direction?

## shadcn/ui Review

- Are shadcn/ui primitives used where appropriate?
- Are components imported consistently?
- Are custom wrappers reusable?
- Is there duplicated styling that should be extracted?

## State and Persistence Review

- Does this preserve existing LocalStorage data?
- Are storage reads client-safe?
- Is JSON parsing safe?
- Are migrations needed?
- Are dates stored/compared safely?

## Workout Logic Review

- Can users create workouts?
- Can users edit workouts?
- Can users start sessions?
- Can users complete/skip sets?
- Does history update after finishing?
- Does the calendar update correctly?

## Accessibility Review

- Are inputs labeled?
- Are icon buttons accessible?
- Do dialogs/drawers have titles?
- Is focus visible?
- Is contrast acceptable?
- Is motion respectful of reduced-motion settings?

## Testing

Commands run:

```bash
# paste commands here
```

Manual flows tested:

- [ ] New user empty state
- [ ] Create workout
- [ ] Edit workout
- [ ] Delete workout
- [ ] Start workout
- [ ] Complete set
- [ ] Skip set
- [ ] Rest timer
- [ ] Finish workout
- [ ] History/calendar update
- [ ] Landing page CTA
- [ ] Mobile 320px layout
- [ ] Desktop layout

## Risks

- What could still break?
- What should be checked manually?
- What should be follow-up work?

## Reviewer Decision

- [ ] Approve
- [ ] Approve with comments
- [ ] Request changes
