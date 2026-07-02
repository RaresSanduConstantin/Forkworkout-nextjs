// Shared domain types for ForkWorkout.
// These describe the shapes persisted in LocalStorage. Existing user data may
// predate optional fields, so keep newly added fields optional for back-compat.

// How a set's load is measured:
// - "kg":  weight in kilograms (value holds the number, e.g. "60")
// - "bw":  bodyweight (value is "BW")
// - "time": duration (value holds a string, e.g. "45s", "1min")
// - "km":  distance in kilometres (value holds the number, e.g. "5")
export type SetUnit = "kg" | "bw" | "time" | "km";

// How a set counts toward stats. Undefined = "working" (the default). Warmup
// sets are excluded from volume, PRs, 1RM and rep totals.
export type SetType = "warmup" | "working" | "drop" | "failure";

export type WorkoutSet = {
  id?: string;
  reps: number;
  value: string; // meaning depends on `unit` (see SetUnit)
  unit?: SetUnit;
  type?: SetType;
};

export type Exercise = {
  id?: string;
  name: string;
  sets: WorkoutSet[];
  rest?: string; // per-exercise rest override (seconds as string); falls back to Workout.rest
  superset?: string; // optional superset group label (e.g. "A"); shared label = grouped
};

export type Workout = {
  id: string;
  title: string;
  rest?: string;
  exercises: Exercise[];
  createdAt?: string;
  updatedAt?: string;
};

// A completed workout entry as stored in the `completedWorkouts` key.
// `title` is the canonical name field; legacy P90X entries used `workoutName`.
// `dayKey` (YYYY-MM-DD, local) is added going forward for correct calendar
// grouping; older entries only have the ISO `date`.
export type CompletedSet = {
  reps: number;
  value: string;
  unit?: SetUnit;
  status: SetStatus;
  type?: SetType;
  rpe?: number; // optional rate of perceived exertion (1–10)
};

export type CompletedExercise = {
  name: string;
  sets: CompletedSet[];
};

export type CompletedWorkout = {
  workoutId: string;
  title: string;
  date: string; // ISO timestamp
  dayKey?: string; // local YYYY-MM-DD
  volume?: number; // total kg lifted in the session (reps × weight over done sets)
  durationSec?: number; // how long the session took
  totalReps?: number; // Σ reps of completed (done) sets
  exercises?: CompletedExercise[]; // snapshot of what was performed
  notes?: string; // free-text session notes ("felt heavy")
  rpe?: number; // overall session RPE (1–10)
};

// Live workout session state (persisted so a refresh can resume progress).
export type SetStatus = "pending" | "done" | "skipped";

export type SessionSet = {
  id?: string;
  reps: number;
  value: string;
  unit?: SetUnit;
  status: SetStatus;
  type?: SetType;
  rpe?: number;
};

export type SessionExercise = {
  id?: string;
  name: string;
  sets: SessionSet[];
  rest?: string; // per-exercise rest override
  superset?: string; // optional superset group label
};

export type ActiveSession = {
  workoutId: string;
  title: string;
  exercises: SessionExercise[];
  startedAt: string;
};

