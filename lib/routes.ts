// Central route definitions. The marketing landing lives at `/`, while the
// interactive app dashboard lives at `/app`.
export const ROUTES = {
  landing: "/",
  dashboard: "/app",
  history: "/history",
  body: "/body",
  exercises: "/exercises",
  newWorkout: "/create-workout",
  editWorkout: (id: string) => `/create-workout/${id}`,
  startWorkout: (id: string) => `/start-workout/${id}`,
} as const;
