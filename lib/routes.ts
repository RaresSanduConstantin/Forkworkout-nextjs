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
  credits: "/credits",
} as const;

// The four sections that show the bottom tab bar.
export const MAIN_TAB_ROUTES = ["/app", "/history", "/body", "/exercises"] as const;

/** Support inbox for user feedback. */
export const SUPPORT_EMAIL = "forkworkout@gmail.com";
export const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "ForkWorkout feedback"
)}`;

export function isMainTabRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (MAIN_TAB_ROUTES as readonly string[]).includes(pathname);
}
