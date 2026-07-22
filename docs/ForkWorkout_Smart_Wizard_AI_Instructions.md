# ForkWorkout Smart Workout Wizard — AI Implementation Instructions

## Role

You are a senior TypeScript/React engineer working inside the existing ForkWorkout repository.

Your task is to improve the current workout wizard so that it becomes more useful, adaptive, and personalized **without adding runtime AI, natural-language input, accounts, servers, databases, or external APIs**.

The application must remain:

- Fully client-side
- Local-first
- Usable without signing in
- Usable without a backend
- Private by default
- Functional offline after the app assets are loaded
- Based on deterministic rules and the user's locally stored workout history

The word “smart” in this document means **rule-based personalization using local workout data**, not artificial intelligence inside the application.

---

# 1. Existing Context

The current `WorkoutWizard` already collects:

- Goal
- Sex/body-map preference
- Target muscles
- Equipment access
- Home equipment
- Experience
- Available workout time
- Latest saved bodyweight
- Previous exercise performance
- Suggested next exercise weight

It currently generates several workout variants by calling `generateWorkout()` with different seeds.

The existing implementation already uses modules similar to:

- `@/lib/exercises`
- `@/lib/workout-generator`
- `@/lib/workout`
- `@/lib/history-stats`
- `@/lib/storage/profile`
- `@/lib/storage/home-equipment`
- `@/lib/storage/body-storage`
- `@/lib/muscle-map`

Before changing anything, inspect the repository and identify:

1. The current `Workout` and exercise types
2. The workout-history storage format
3. How completed sets are stored
4. How exercise IDs and names are represented
5. How `suggestNextWeight()` works
6. How local-storage migrations are currently handled
7. How tests are structured
8. Whether the app already stores exercise feedback or workout completion state

Do not assume the uploaded wizard file is the only relevant code.

---

# 2. Non-Negotiable Constraints

## Do not add

- OpenAI or any other AI SDK
- Natural-language prompts
- Chat interfaces
- Server actions that persist user data remotely
- API routes for workout generation
- Authentication
- Cloud databases
- Analytics that transmit personal workout data
- Remote recommendation services
- Required internet access for generation
- Medical diagnosis functionality

## Keep all user data local

Persist personalization data using the project's existing local storage utilities.

Do not access `localStorage` directly from random UI components if the project already has storage abstractions.

New local data must:

- Use typed storage helpers
- Have safe defaults
- Handle malformed or missing data
- Include a schema version when appropriate
- Be backward compatible
- Avoid breaking existing saved workouts
- Be removable through the application's data-reset functionality, if one exists

## Preserve user control

The system may recommend a workout, but users must still be able to:

- Build a workout manually
- Change target muscles
- Replace an exercise
- Adjust sets, reps, rest, and weight
- Ignore recommendations
- Remove saved preferences
- Mark an exercise as usable again after previously avoiding it

---

# 3. Product Goal

Create a deterministic, local-first recommendation system that helps users answer:

> “What workout makes sense for me today?”

The result should use locally stored information such as:

- Recent workouts
- Completed working sets
- Time since each muscle was trained
- Current weekly training volume
- Exercise performance
- Exercise preferences
- Available equipment
- Available time
- Experience level
- Goal
- Daily readiness
- Muscle soreness
- Pain or movement restrictions explicitly entered by the user

The system should explain recommendations in plain language using predefined templates.

Example:

> Back and biceps are recommended because they have not been trained recently, while your chest and legs were trained in your last two sessions.

This explanation must be generated from deterministic data, not an AI model.

---

# 4. Implementation Principles

## 4.1 Deterministic first

Given the same:

- Exercise library
- User preferences
- Workout history
- Readiness state
- Generator strategy
- Seed

the generator should produce the same result.

Randomness may be used only as a small tie-breaker between similarly scored exercises.

## 4.2 Rules before variety

Exercise eligibility and safety rules must run before variety logic.

Order:

1. Exclude impossible exercises
2. Exclude user-blocked exercises
3. Exclude exercises conflicting with selected pain areas
4. Enforce equipment constraints
5. Score remaining exercises
6. Compose a balanced workout
7. Apply small deterministic variety
8. Validate time budget
9. Produce explanation metadata

## 4.3 Stable identifiers

Use stable exercise IDs for:

- History
- Preferences
- Performance
- Replacement logic
- Progression

Do not use exercise display names as the primary persistence key.

If existing history is name-based, add a safe compatibility layer or migration rather than deleting old history.

## 4.4 Graceful fallback

A recommendation must not fail simply because the user has little or no history.

For a new user:

- Use their selected goal
- Use experience level
- Use equipment
- Use time
- Use balanced movement-pattern rules
- Use conservative default loads
- Explain that the plan is based on their setup because no training history exists yet

---

# 5. Features to Implement

Implement these in phases. Complete and test each phase before moving to the next.

---

# Phase 1 — Exercise Feedback and Preferences

## Goal

Let users teach the application which exercises work for them.

## Required feedback options

After or during a workout, support:

- Prefer this exercise
- Neutral
- Avoid this exercise
- Equipment unavailable
- Too difficult
- Causes discomfort
- Temporary skip

Use simple predefined controls. Do not use free-text as the primary mechanism.

## Suggested types

```ts
export type ExercisePreferenceLevel =
  | "prefer"
  | "neutral"
  | "avoid";

export type ExercisePreferenceReason =
  | "dislike"
  | "equipment"
  | "difficulty"
  | "discomfort"
  | "temporary"
  | "other";

export interface ExercisePreference {
  exerciseId: string;
  level: ExercisePreferenceLevel;
  reason?: ExercisePreferenceReason;
  updatedAt: string;
  expiresAt?: string;
}
```

## Behaviour

- `prefer` should increase the exercise score.
- `avoid` should strongly reduce or exclude the exercise.
- `discomfort` should exclude the exercise by default.
- `temporary` may use an expiration date.
- Equipment-related exclusions should apply only when relevant.
- Users must be able to edit or remove a preference.
- Do not permanently hide an exercise without making the setting discoverable.

## Acceptance criteria

- Preferences survive page reload.
- Existing users with no preferences see no errors.
- Avoided exercises are not generated when alternatives exist.
- Preferred exercises appear more often without creating repetitive workouts.
- The user can reset an exercise to neutral.
- Storage corruption falls back safely.

---

# Phase 2 — Post-Exercise Difficulty Feedback

## Goal

Improve load progression using actual user feedback instead of only top weight.

## Required difficulty choices

After completing an exercise, allow:

- Easy
- Good
- Hard
- Failed
- Painful

Optional later enhancement:

- Reps in reserve using a small fixed scale

## Suggested types

```ts
export type ExerciseDifficulty =
  | "easy"
  | "good"
  | "hard"
  | "failed"
  | "painful";

export interface ExercisePerformanceFeedback {
  workoutId: string;
  exerciseId: string;
  completedAt: string;
  difficulty: ExerciseDifficulty;
  completedWorkingSets: number;
  plannedWorkingSets: number;
  topWeightKg?: number;
  completedReps?: number[];
}
```

## Progression rules

Use conservative deterministic rules.

Example baseline:

- Easy + all planned sets completed:
  - Increase suggested weight by the smallest valid increment.
- Good + all sets completed:
  - Keep weight or increase only when the top of the rep range was achieved.
- Hard + all sets completed:
  - Keep weight.
- Failed:
  - Keep or slightly reduce weight depending on missed volume.
- Painful:
  - Do not recommend progression.
  - Mark the exercise for review or temporary avoidance.
  - Do not interpret pain as normal muscular failure.

Respect equipment increments:

- Barbell plates
- Dumbbell increments
- Machine stack increments
- Bodyweight progression
- Timed exercises

Do not assume every load is measured in kilograms.

## Acceptance criteria

- Progression uses stable exercise IDs.
- Suggested weights never become `NaN`, negative, or infinite.
- Suggestions are rounded to realistic equipment increments.
- Painful feedback does not increase weight.
- Missing feedback falls back to existing history logic.
- Existing `suggestNextWeight()` behaviour is preserved until the replacement is validated.

---

# Phase 3 — Daily Readiness and Soreness

## Goal

Allow the workout to adapt to how the user feels today.

## Wizard input

Add a compact readiness section:

### Readiness

- Great
- Normal
- Tired
- Very tired

### Soreness

Allow users to select sore muscles using the existing muscle map.

### Pain or restriction

Keep this separate from soreness.

Users should be able to select muscles or regions that should not be trained today.

Use cautious wording:

- “Sore today”
- “Avoid today”
- Do not claim to diagnose injuries

## Suggested types

```ts
export type ReadinessLevel =
  | "great"
  | "normal"
  | "tired"
  | "very-tired";

export interface DailyTrainingState {
  date: string;
  readiness: ReadinessLevel;
  soreMuscles: MuscleTargetKey[];
  avoidMuscles: MuscleTargetKey[];
}
```

## Behaviour

Suggested modifiers:

- Great:
  - Standard or slightly higher volume
  - Allow progression when supported by history
- Normal:
  - Standard workout
- Tired:
  - Reduce working sets
  - Prefer lower-fatigue exercises
  - Avoid unnecessary intensity techniques
- Very tired:
  - Offer a short low-fatigue session
  - Offer mobility/recovery or rest as an explicit choice
- Sore muscle:
  - Reduce priority
  - Do not necessarily exclude
- Avoid muscle:
  - Exclude direct work
  - Exclude exercises where the muscle is a major secondary contributor when possible

Readiness should default to `normal`.

Daily state may be temporary and should not permanently modify the user's profile.

## Acceptance criteria

- Readiness changes workout volume predictably.
- Soreness and avoidance have visibly different effects.
- Avoided muscles are not directly trained.
- The UI remains fast and easy to complete.
- A user may skip this step and use defaults.
- Daily state does not overwrite long-term exercise preferences.

---

# Phase 4 — Local Training Summary

## Goal

Calculate what the user has recently trained.

Create a pure utility that derives training status from saved workout history.

## Suggested output

```ts
export interface MuscleTrainingStatus {
  muscle: MuscleTargetKey;
  completedSetsThisWeek: number;
  completedSetsLast7Days: number;
  lastTrainedAt?: string;
  hoursSinceLastTrained?: number;
  recentWorkoutCount: number;
}
```

## Counting rules

- Count working sets only.
- Do not count warm-up sets as normal training volume.
- Prefer completed sets.
- Decide how partially completed workouts are handled and document it.
- Use exercise-to-muscle mappings from the exercise library.
- If primary and secondary muscles exist:
  - Count primary muscles fully.
  - Count secondary muscles using a smaller configurable multiplier.
- Avoid double-counting malformed duplicate entries.
- Use the user's local date consistently.

## Week definition

Use one clearly documented approach:

- Rolling seven days, or
- Calendar week based on local time

Prefer calculating both:

- `completedSetsLast7Days`
- `completedSetsThisWeek`

## Acceptance criteria

- The calculation is a pure function.
- It has unit tests.
- Warm-up sets are excluded.
- Empty history produces zeroed status values.
- Invalid dates do not crash the app.
- Results are based only on local data.

---

# Phase 5 — Muscle Priority and Recovery Scoring

## Goal

Calculate which muscles are sensible to train today.

## Suggested type

```ts
export interface MusclePriorityScore {
  muscle: MuscleTargetKey;
  score: number;
  reasons: string[];
  blocked: boolean;
}
```

## Inputs

Use:

- Time since last trained
- Sets completed in the last seven days
- Experience level
- Goal
- Daily soreness
- Daily avoidance
- Recently repeated muscle groups
- User-selected target muscles in manual mode

## Important limitation

Do not pretend to know biological recovery precisely.

Use the score as a planning heuristic, not a medical measurement.

Avoid labels such as:

- Fully recovered
- Injury-free
- Safe to train

Prefer:

- Higher priority
- Trained recently
- Lower recent volume
- Avoided today

## Example scoring concept

```ts
priority =
  volumeDeficitScore +
  timeSinceTrainedScore +
  goalAlignmentScore -
  sorenessPenalty -
  recentFrequencyPenalty;
```

Blocked muscles should receive negative infinity or an explicit `blocked` flag.

Store configurable scoring constants in one place.

Do not scatter magic numbers across components.

## Acceptance criteria

- The same input always gives the same score.
- Reasons correspond to actual score components.
- Avoided muscles are blocked.
- New users receive sensible defaults.
- Scoring constants are documented.
- Unit tests cover high, medium, low, and blocked priority cases.

---

# Phase 6 — Intentional Workout Strategies

## Goal

Replace meaningless “Option 1”, “Option 2”, and “Option 3” variants with distinct purposes.

## Required strategies

### Balanced

- Mix compound and isolation work
- Balanced fatigue and variety
- Suitable default

### Progressive

- Prioritize exercises with useful history
- Prefer exercises where a clear progression is available
- Avoid changing every exercise at once

### Low Fatigue

- Fewer demanding compound movements
- More stable or supported exercises
- Lower volume
- Useful for tired days or short sessions

## Suggested type

```ts
export type WorkoutStrategy =
  | "balanced"
  | "progressive"
  | "low-fatigue";
```

## UI labels

Use meaningful titles such as:

- Balanced Session
- Progression Focus
- Low-Fatigue Session

Display one short explanation for each.

## Acceptance criteria

- Strategies produce measurably different composition.
- They are not just different random seeds.
- Each strategy respects equipment and time.
- Each option includes a generated reason summary.
- The selected strategy is saved with the generated workout where practical.

---

# Phase 7 — Exercise Scoring

## Goal

Rank exercises using deterministic local data.

## Suggested scoring output

```ts
export interface ExerciseScore {
  exerciseId: string;
  score: number;
  reasons: string[];
  excluded: boolean;
  exclusionReason?: string;
}
```

## Eligibility checks

Exclude an exercise when:

- Required equipment is unavailable
- The user has blocked it for discomfort
- It conflicts with a muscle avoided today
- It is inappropriate for the configured experience level
- Its required load exceeds available home equipment
- Required metadata is invalid or missing in a way that makes generation unsafe

## Scoring signals

Possible positive signals:

- Direct target-muscle match
- High-priority muscle match
- User preference
- Clear progression opportunity
- Suitable movement pattern
- Suitable strategy
- Fits remaining time
- Useful exercise history

Possible negative signals:

- Recently repeated
- User marked difficult
- Muscle is sore
- Creates duplicate movement patterns
- Excessive setup time
- High fatigue on a tired day
- Poor fit for available load

## Example structure

```ts
function scoreExercise(
  exercise: LibraryExercise,
  context: SmartWorkoutContext
): ExerciseScore {
  const eligibility = checkEligibility(exercise, context);

  if (!eligibility.allowed) {
    return {
      exerciseId: exercise.id,
      score: Number.NEGATIVE_INFINITY,
      reasons: [],
      excluded: true,
      exclusionReason: eligibility.reason,
    };
  }

  const components = [
    scoreTargetMatch(exercise, context),
    scoreMusclePriority(exercise, context),
    scorePreference(exercise, context),
    scoreProgression(exercise, context),
    scoreVariety(exercise, context),
    scoreStrategyFit(exercise, context),
    scoreTimeFit(exercise, context),
  ];

  return combineExerciseScores(exercise.id, components);
}
```

## Acceptance criteria

- Scoring is isolated from React components.
- Every positive or negative adjustment can be explained.
- Exclusion happens before ranking.
- A tiny deterministic tie-breaker is allowed.
- Tests cover equipment, preference, repetition, soreness, and progression.

---

# Phase 8 — Movement-Pattern-Aware Composition

## Goal

Avoid generating several exercises that are technically different but functionally repetitive.

## Add or derive movement-pattern metadata

Suggested patterns:

```ts
export type MovementPattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "calf"
  | "elbow-flexion"
  | "elbow-extension"
  | "shoulder-isolation"
  | "core-flexion"
  | "core-extension"
  | "core-stability"
  | "rotation"
  | "cardio";
```

Do not automatically classify exercises from names at runtime.

Prefer adding reviewed metadata to the exercise library.

## Composition rules

Examples:

- Limit duplicate movement patterns.
- Place technically demanding compound exercises earlier.
- Place small isolation exercises later.
- Avoid multiple near-identical presses or curls.
- Keep direct muscle coverage aligned with the selected goal.
- Respect the strategy.
- Respect time.
- Respect experience level.

Make these rules configuration-driven.

## Acceptance criteria

- A generated workout does not contain obvious duplicate movements unless intentionally allowed.
- Exercise order is sensible.
- Beginner workouts avoid unnecessary complexity.
- Home workouts use the equipment actually saved by the user.
- Composition has unit tests using small fixture libraries.

---

# Phase 9 — Hard Time-Budget Generation

## Goal

Build the workout to fit the user's available time rather than only estimating it afterward.

## Include

- Warm-up allowance
- Working-set duration
- Rest duration
- Transition/setup time
- Unilateral exercise duration
- Superset savings when applicable
- Cooldown only if the product currently includes it

## Suggested types

```ts
export interface WorkoutTimeBudget {
  totalSeconds: number;
  warmupSeconds: number;
  workingSeconds: number;
  restSeconds: number;
  transitionSeconds: number;
}

export interface ExerciseTimeEstimate {
  exerciseId: string;
  totalSeconds: number;
  setSeconds: number;
  restSeconds: number;
  transitionSeconds: number;
}
```

## Behaviour

- Stop adding exercises when the remaining budget is insufficient.
- Do not create a 45-minute plan for a 30-minute request.
- Allow a documented tolerance, for example ±10%.
- For short sessions:
  - Prefer fewer exercises
  - Prefer useful compounds
  - Reduce low-value isolation work
  - Use supersets only where sensible
- Do not automatically reduce rest below safe or usable values merely to fit more exercises.

## Acceptance criteria

- Generated duration stays within the documented tolerance.
- Time estimation is shared between generation and preview.
- Unilateral movements are not underestimated.
- Fifteen-minute sessions remain realistic.
- Tests cover 15, 30, 45, and 60 minutes.

---

# Phase 10 — “Recommended Today” Mode

## Goal

Make the primary smart experience one tap.

## Entry choices

At the start of the wizard, provide:

### Recommended Today

The application chooses target muscles using local history and today's readiness.

### Build Manually

Preserve the current muscle-selection flow.

Do not remove the current manual workflow.

## Recommended flow

1. Select or confirm available time
2. Select readiness
3. Optionally mark soreness or areas to avoid
4. Generate meaningful strategies
5. Show recommendation reasons
6. Let the user inspect and edit the workout

Use saved equipment, experience, goal, profile, and history as defaults.

## First-time user behaviour

When there is insufficient history:

- Explain that the plan is based on their goal, equipment, experience, and time.
- Do not show empty or misleading recovery claims.
- Generate a sensible balanced workout.
- Encourage feedback after the session.

## Acceptance criteria

- Existing manual generation remains available.
- A returning user can generate a recommendation with minimal input.
- A new user can still use the feature.
- Recommendation reasons are factual and template-based.
- No network request is made.
- No personal workout data leaves the browser.

---

# Phase 11 — Recommendation Explanations

## Goal

Explain why a workout was generated.

## Suggested metadata

```ts
export interface WorkoutRecommendationMetadata {
  strategy: WorkoutStrategy;
  title: string;
  summary: string;
  reasons: string[];
  warnings: string[];
  estimatedMinutes: number;
  historyConfidence: "none" | "low" | "medium" | "high";
}
```

## Example reasons

Only display a reason when supported by actual data:

- “Back has not been trained in your last three workouts.”
- “This session uses exercises you completed successfully before.”
- “Volume was reduced because you selected Tired.”
- “Shoulder exercises were excluded because you selected Avoid today.”
- “This plan fits your saved home equipment.”
- “There is not enough history yet, so this is based on your setup.”

## Do not display

- Unsupported recovery claims
- Medical advice
- Fabricated certainty
- Fake precision
- Claims about calorie burn unless the app has a validated calculation

## Acceptance criteria

- Reasons are derived from score components.
- The app never displays a reason that did not affect generation.
- Explanations update when the selected variant changes.
- Empty reason lists have a sensible fallback.

---

# 6. Proposed Architecture

Keep UI, scoring, history analysis, and persistence separate.

Suggested structure:

```text
src/
  lib/
    smart-workout/
      types.ts
      config.ts
      history-summary.ts
      muscle-priority.ts
      exercise-eligibility.ts
      exercise-scoring.ts
      composition.ts
      time-budget.ts
      progression.ts
      explanations.ts
      generate-smart-workout.ts
      __tests__/
    storage/
      exercise-preferences.ts
      daily-training-state.ts
      performance-feedback.ts
      smart-workout-settings.ts
```

Adapt this to the repository's actual folder conventions.

Do not create duplicate storage systems if equivalent utilities already exist.

## Main orchestration API

Aim for an API similar to:

```ts
export interface SmartWorkoutContext {
  targetMode: "recommended" | "manual";
  manuallySelectedMuscles: MuscleTargetKey[];
  goal: Goal;
  equipment: EquipmentAccess;
  homeEquipment?: ResolvedHomeEquipment;
  experience: Experience;
  availableMinutes: number;
  bodyweightKg?: number;
  readiness: ReadinessLevel;
  soreMuscles: MuscleTargetKey[];
  avoidMuscles: MuscleTargetKey[];
  history: WorkoutHistoryEntry[];
  preferences: ExercisePreference[];
  strategy: WorkoutStrategy;
}

export interface SmartWorkoutResult {
  workout: Workout;
  metadata: WorkoutRecommendationMetadata;
  diagnostics?: SmartWorkoutDiagnostics;
}

export function generateSmartWorkout(
  library: LibraryExercise[],
  context: SmartWorkoutContext,
  seed?: number
): SmartWorkoutResult;
```

Diagnostics should be available in development only and must not expose anything remotely.

---

# 7. Local Storage Design

Before adding storage, inspect existing conventions.

Suggested keys only if no established equivalent exists:

```text
forkworkout.exercise-preferences.v1
forkworkout.performance-feedback.v1
forkworkout.smart-settings.v1
forkworkout.daily-training-state.v1
```

## Storage requirements

Every reader must:

- Catch JSON parse errors
- Validate shape
- Return safe defaults
- Ignore unknown fields
- Avoid throwing during render
- Support version upgrades

Every writer must:

- Serialize only required data
- Avoid storing derived data when it can be recalculated
- Avoid unbounded growth
- Prune old temporary daily state
- Consider limiting detailed feedback history while preserving useful summaries

Use local dates carefully.

Do not rely on UTC-only date slicing for “today” if the rest of the application uses local time.

---

# 8. UX Requirements

## Keep the wizard lightweight

Do not turn the wizard into a long survey.

Use progressive disclosure:

1. Mode
2. Goal/setup defaults
3. Time
4. Readiness
5. Optional soreness/avoidance
6. Results

Hide advanced controls unless requested.

## Result cards should show

- Strategy name
- Exercise count
- Estimated duration
- Main muscles
- One or two recommendation reasons
- Exercises and set summaries
- Any warning or limitation

## Provide useful actions

- Use this workout
- Replace exercise
- Regenerate this strategy
- Back
- Edit manually

## Loading and error states

Improve the current wizard:

- Track exercise-library loading
- Disable generation until the library is ready
- Display a retry action on load failure
- Validate numeric equipment input
- Prevent duplicate generation clicks
- Handle an empty eligible exercise list
- Avoid silently producing an invalid workout

---

# 9. Validation Rules

Add reusable validation helpers.

Validate:

- Minutes
- Weight values
- Equipment maximums
- Exercise IDs
- Set counts
- Rep counts
- Rest times
- Date strings
- Stored preference values
- Strategy values
- Readiness values

Never pass `NaN` into workout generation.

Example helper:

```ts
export function parseOptionalPositiveNumber(
  value: string
): number | undefined {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}
```

Use the project's existing validation library if one is already installed.

---

# 10. Testing Requirements

## Unit tests

Required for:

- Storage parsing and migration
- Weekly muscle-volume calculations
- Recovery/priority scoring
- Exercise eligibility
- Exercise scoring
- Time estimation
- Workout composition
- Progression rules
- Explanation generation

## Test fixtures

Create small exercise-library fixtures with:

- Compound and isolation exercises
- Different equipment requirements
- Primary and secondary muscles
- Multiple movement patterns
- Beginner and advanced exercises
- Timed and bodyweight exercises

## Critical scenarios

Test at least:

1. Brand-new user with no history
2. Returning gym user
3. Home user with limited dumbbells
4. User with an avoided exercise
5. User with shoulder avoidance
6. Tired user requesting 15 minutes
7. User requesting progression
8. User with malformed storage
9. User with renamed exercise but stable ID
10. No eligible exercises
11. Partially completed previous workout
12. Warm-up sets excluded from weekly volume

## Component tests

Test:

- Switching between recommended and manual modes
- Readiness defaults
- Soreness selection
- Avoid-today selection
- Meaningful strategy labels
- Library loading state
- Generation error state
- Preference reset
- Choosing a generated workout

## End-to-end checks

Confirm:

- Refresh preserves settings
- No network request is required for recommendation
- Existing saved workouts still load
- Existing manual workflow still works
- Resetting local data returns the app to clean defaults

---

# 11. Performance Requirements

All calculations happen locally and should feel immediate.

Guidelines:

- Derive history summaries once per generation, not once per exercise.
- Build maps keyed by stable exercise ID.
- Memoize expensive UI-only calculations where appropriate.
- Keep core generator utilities pure.
- Do not repeatedly parse all local storage during render.
- Avoid large duplicated history records.
- Avoid introducing a state-management library unless the repository already uses one and it is justified.

Target: generation should feel instant for a normal local exercise library and history size.

---

# 12. Accessibility Requirements

- All toggle groups must be keyboard accessible.
- Selected state must not rely only on color.
- Muscle-map selections need accessible labels or equivalent chip controls.
- Error messages should be announced appropriately.
- Buttons must have clear names.
- Loading state must be communicated.
- Dialog focus behaviour must remain correct.
- Touch targets should remain comfortable on mobile.

---

# 13. Privacy Requirements

ForkWorkout's local-only nature is a product feature.

Do not add telemetry that includes:

- Workout history
- Weight
- Sex
- Exercise performance
- Soreness
- Pain or avoided muscles
- Preferences

Add a short UI note where appropriate:

> Your workout history and recommendations stay in this browser.

Do not overstate security. Local browser data may still be accessible to someone using the same browser profile or device.

---

# 14. Safety and Wording

The application is not a medical professional.

Use cautious product language.

Preferred:

- “Avoid today”
- “You marked this area as uncomfortable”
- “Consider choosing a lighter session”
- “Stop if an exercise causes pain”

Avoid:

- “This exercise is safe for your injury”
- “You are fully recovered”
- “This will prevent injury”
- “This pain is normal”
- “Medical recommendation”

When the user selects `painful`, the app should avoid increasing load and should make it easy to replace or exclude the exercise.

---

# 15. Refactoring the Current Wizard

The current component should not become responsible for all recommendation logic.

Refactor gradually:

## Keep in the component

- Dialog state
- Form state
- Step navigation
- User interactions
- Rendering
- Calling the generator
- Displaying results

## Move out of the component

- History aggregation
- Muscle priority
- Exercise eligibility
- Exercise scoring
- Time budgeting
- Workout composition
- Progression
- Explanation generation
- Storage parsing

## Improve current generation

Replace the pattern of generating three variants only by rotating a seed.

Instead:

```ts
const strategies: WorkoutStrategy[] = [
  "balanced",
  "progressive",
  "low-fatigue",
];

const variants = strategies
  .map((strategy, index) =>
    generateSmartWorkout(
      library,
      {
        ...context,
        strategy,
      },
      index
    )
  )
  .filter((result) => result.workout.exercises.length > 0);
```

Seeds may still provide minor variety within a strategy, but the strategy must be the main reason options differ.

---

# 16. Delivery Plan

Work in small reviewable changes.

## Milestone 1

- Inspect repository
- Document current data flow
- Add stable storage utilities
- Add exercise preferences
- Add tests

## Milestone 2

- Add post-exercise difficulty feedback
- Upgrade progression logic
- Preserve old history fallback
- Add tests

## Milestone 3

- Add readiness, soreness, and avoid-today controls
- Add local daily state
- Add tests

## Milestone 4

- Add history summary
- Add muscle-priority scoring
- Add recommendation explanations
- Add tests

## Milestone 5

- Add strategy-based exercise scoring
- Add movement-pattern composition
- Add hard time budgeting
- Add tests

## Milestone 6

- Add Recommended Today mode
- Update result cards
- Add edit/replace actions
- Add component and end-to-end tests

Do not attempt a single large rewrite.

---

# 17. Definition of Done

The feature is complete when:

- The app remains fully local-first.
- No runtime AI is present.
- No account or backend is required.
- Manual workout generation still works.
- Returning users receive history-based recommendations.
- New users receive sensible setup-based recommendations.
- Exercise preferences affect future workouts.
- Difficulty feedback affects progression.
- Soreness and avoid-today selections affect generation differently.
- Options have meaningful strategies.
- Generated workouts fit the requested time within a documented tolerance.
- Exercise selection respects equipment and stable IDs.
- Recommendations include truthful deterministic explanations.
- Existing stored data remains usable.
- Malformed local storage does not break the wizard.
- Core logic has unit tests.
- The mobile UX remains simple.

---

# 18. First Task for the Coding Assistant

Begin by inspecting the repository. Do not implement immediately.

Produce a short implementation report containing:

1. Current workout-generation flow
2. Current local-storage modules and schemas
3. Current workout-history structure
4. Whether stable exercise IDs exist
5. Current progression algorithm
6. Current exercise metadata gaps
7. Files that should be modified
8. Proposed migration risks
9. Recommended first milestone
10. Any assumptions that must be verified in code

After the report, implement **Phase 1 only** in a small, reviewable change.

Do not proceed to later phases until Phase 1 is working and tested.
