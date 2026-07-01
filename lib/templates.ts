import type { Workout } from "./types";
import { v4 as uuidv4 } from "uuid";

// A ready-made workout users can add to their list with one tap. Exercise names
// intentionally match entries in public/json/exercises.json so the in-session
// info/image modals resolve.
export type WorkoutTemplate = {
  key: string;
  title: string;
  emoji: string;
  description: string;
  rest: string;
  exercises: { name: string; sets: { reps: number; value: string }[] }[];
};

// Helper: N identical sets.
const sets = (count: number, reps: number, value: string) =>
  Array.from({ length: count }, () => ({ reps, value }));

export const STARTER_TEMPLATES: WorkoutTemplate[] = [
  {
    key: "push",
    title: "Push Day",
    emoji: "💪",
    description: "Chest, shoulders & triceps",
    rest: "",
    exercises: [
      { name: "Barbell Bench Press - Medium Grip", sets: sets(4, 8, "60kg") },
      { name: "Barbell Incline Bench Press - Medium Grip", sets: sets(3, 10, "40kg") },
      { name: "Pushups", sets: sets(3, 15, "BW") },
      { name: "Triceps Pushdown", sets: sets(3, 12, "25kg") },
    ],
  },
  {
    key: "pull",
    title: "Pull Day",
    emoji: "🎯",
    description: "Back & biceps",
    rest: "",
    exercises: [
      { name: "Pullups", sets: sets(4, 8, "BW") },
      { name: "Barbell Deadlift", sets: sets(3, 5, "80kg") },
      { name: "Full Range-Of-Motion Lat Pulldown", sets: sets(3, 12, "45kg") },
      { name: "Alternate Hammer Curl", sets: sets(3, 12, "12kg") },
    ],
  },
  {
    key: "legs",
    title: "Leg Day",
    emoji: "🦵",
    description: "Quads, hamstrings & calves",
    rest: "",
    exercises: [
      { name: "Barbell Full Squat", sets: sets(4, 8, "70kg") },
      { name: "Leg Press", sets: sets(3, 12, "120kg") },
      { name: "Barbell Walking Lunge", sets: sets(3, 10, "30kg") },
      { name: "Barbell Seated Calf Raise", sets: sets(3, 15, "40kg") },
    ],
  },
  {
    key: "cardio",
    title: "Cardio Blast",
    emoji: "🏃",
    description: "Conditioning & core",
    rest: "",
    exercises: [
      { name: "Jogging, Treadmill", sets: sets(1, 1, "10min") },
      { name: "Battling Ropes", sets: sets(3, 1, "45s") },
      { name: "Bicycling, Stationary", sets: sets(1, 1, "15min") },
      { name: "Plank", sets: sets(3, 1, "60s") },
    ],
  },
];

/** Clones a template into a fresh, persistable Workout with stable IDs. */
export function instantiateTemplate(template: WorkoutTemplate): Workout {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: template.title,
    rest: template.rest,
    createdAt: now,
    updatedAt: now,
    exercises: template.exercises.map((ex) => ({
      id: uuidv4(),
      name: ex.name,
      sets: ex.sets.map((s) => ({ id: uuidv4(), reps: s.reps, value: s.value })),
    })),
  };
}
