// Shared domain types for ForkWorkout.
// These describe the shapes persisted in LocalStorage. Existing user data may
// predate optional fields, so keep newly added fields optional for back-compat.

export type WorkoutSet = {
  id?: string;
  reps: number;
  value: string; // overloaded weight/time/BW, e.g. "10kg", "1min", "BW"
};

export type Exercise = {
  id?: string;
  name: string;
  sets: WorkoutSet[];
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
export type CompletedWorkout = {
  workoutId: string;
  title: string;
  date: string; // ISO timestamp
  dayKey?: string; // local YYYY-MM-DD
};

// Live workout session state (persisted so a refresh can resume progress).
export type SetStatus = "pending" | "done" | "skipped";

export type SessionSet = {
  id?: string;
  reps: number;
  value: string;
  status: SetStatus;
};

export type SessionExercise = {
  id?: string;
  name: string;
  sets: SessionSet[];
};

export type ActiveSession = {
  workoutId: string;
  title: string;
  exercises: SessionExercise[];
  startedAt: string;
};
