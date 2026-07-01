import type { SetUnit, Workout } from "./types";
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
  exercises: { name: string; sets: { reps: number; value: string; unit: SetUnit }[] }[];
};

// Helpers: N identical sets of a given unit.
const kg = (count: number, reps: number, weight: string) =>
  Array.from({ length: count }, () => ({ reps, value: weight, unit: "kg" as SetUnit }));
const bw = (count: number, reps: number) =>
  Array.from({ length: count }, () => ({ reps, value: "BW", unit: "bw" as SetUnit }));
const time = (count: number, duration: string) =>
  Array.from({ length: count }, () => ({ reps: 1, value: duration, unit: "time" as SetUnit }));

export const STARTER_TEMPLATES: WorkoutTemplate[] = [
  {
    key: "push",
    title: "Push Day",
    emoji: "💪",
    description: "Chest, shoulders & triceps",
    rest: "",
    exercises: [
      { name: "Barbell Bench Press - Medium Grip", sets: kg(4, 8, "60") },
      { name: "Barbell Incline Bench Press - Medium Grip", sets: kg(3, 10, "40") },
      { name: "Pushups", sets: bw(3, 15) },
      { name: "Triceps Pushdown", sets: kg(3, 12, "25") },
    ],
  },
  {
    key: "pull",
    title: "Pull Day",
    emoji: "🎯",
    description: "Back & biceps",
    rest: "",
    exercises: [
      { name: "Pullups", sets: bw(4, 8) },
      { name: "Barbell Deadlift", sets: kg(3, 5, "80") },
      { name: "Full Range-Of-Motion Lat Pulldown", sets: kg(3, 12, "45") },
      { name: "Alternate Hammer Curl", sets: kg(3, 12, "12") },
    ],
  },
  {
    key: "legs",
    title: "Leg Day",
    emoji: "🦵",
    description: "Quads, hamstrings & calves",
    rest: "",
    exercises: [
      { name: "Barbell Full Squat", sets: kg(4, 8, "70") },
      { name: "Leg Press", sets: kg(3, 12, "120") },
      { name: "Barbell Walking Lunge", sets: kg(3, 10, "30") },
      { name: "Barbell Seated Calf Raise", sets: kg(3, 15, "40") },
    ],
  },
  {
    key: "cardio",
    title: "Cardio Blast",
    emoji: "🏃",
    description: "Conditioning & core",
    rest: "",
    exercises: [
      { name: "Jogging, Treadmill", sets: time(1, "10min") },
      { name: "Battling Ropes", sets: time(3, "45s") },
      { name: "Bicycling, Stationary", sets: time(1, "15min") },
      { name: "Plank", sets: time(3, "60s") },
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
      sets: ex.sets.map((s) => ({ id: uuidv4(), reps: s.reps, value: s.value, unit: s.unit })),
    })),
  };
}

