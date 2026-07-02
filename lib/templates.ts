import type { SetType, SetUnit, Workout } from "./types";
import { v4 as uuidv4 } from "uuid";

// A ready-made workout users can add to their list with one tap. Exercise names
// intentionally match entries in public/json/exercises.json so the in-session
// info/image/video modals resolve. Templates now use warm-up sets, set types
// (drop/failure) and supersets to model real training.
type TemplateSet = { reps: number; value: string; unit: SetUnit; type?: SetType };
type TemplateExercise = {
  name: string;
  rest?: string; // per-exercise rest override (seconds as string)
  superset?: string; // shared label = grouped
  sets: TemplateSet[];
};
export type WorkoutTemplate = {
  key: string;
  title: string;
  emoji: string;
  description: string;
  rest: string; // workout default rest (seconds as string)
  exercises: TemplateExercise[];
};

// Set builders. Pass a `type` for warm-up / drop / failure sets.
const kg = (count: number, reps: number, weight: string, type?: SetType): TemplateSet[] =>
  Array.from({ length: count }, () => ({ reps, value: weight, unit: "kg" as SetUnit, type }));
const bw = (count: number, reps: number, type?: SetType): TemplateSet[] =>
  Array.from({ length: count }, () => ({ reps, value: "BW", unit: "bw" as SetUnit, type }));
const time = (count: number, duration: string, type?: SetType): TemplateSet[] =>
  Array.from({ length: count }, () => ({ reps: 1, value: duration, unit: "time" as SetUnit, type }));

export const STARTER_TEMPLATES: WorkoutTemplate[] = [
  {
    key: "push",
    title: "Push Day",
    emoji: "💪",
    description: "Chest, shoulders & triceps — warm-ups + a triceps superset",
    rest: "90",
    exercises: [
      {
        name: "Barbell Bench Press - Medium Grip",
        rest: "120",
        sets: [...kg(2, 10, "40", "warmup"), ...kg(3, 8, "60")],
      },
      {
        name: "Barbell Incline Bench Press - Medium Grip",
        rest: "90",
        sets: [...kg(1, 10, "30", "warmup"), ...kg(3, 10, "40")],
      },
      {
        name: "Pushups",
        rest: "30",
        superset: "A",
        sets: bw(3, 15),
      },
      {
        name: "Triceps Pushdown",
        rest: "60",
        superset: "A",
        sets: [...kg(2, 12, "25"), ...kg(1, 15, "18", "drop")],
      },
    ],
  },
  {
    key: "pull",
    title: "Pull Day",
    emoji: "🎯",
    description: "Back & biceps — warm-ups + a biceps superset",
    rest: "90",
    exercises: [
      {
        name: "Pullups",
        rest: "90",
        sets: [...bw(1, 5, "warmup"), ...bw(4, 8)],
      },
      {
        name: "Barbell Deadlift",
        rest: "150",
        sets: [...kg(2, 5, "50", "warmup"), ...kg(3, 5, "80")],
      },
      {
        name: "Full Range-Of-Motion Lat Pulldown",
        rest: "45",
        superset: "B",
        sets: kg(3, 12, "45"),
      },
      {
        name: "Alternate Hammer Curl",
        rest: "60",
        superset: "B",
        sets: [...kg(2, 12, "12"), ...kg(1, 10, "12", "failure")],
      },
    ],
  },
  {
    key: "legs",
    title: "Leg Day",
    emoji: "🦵",
    description: "Quads, hamstrings & calves — warm-ups, a drop set & a calf superset",
    rest: "120",
    exercises: [
      {
        name: "Barbell Full Squat",
        rest: "150",
        sets: [...kg(2, 8, "40", "warmup"), ...kg(4, 8, "70")],
      },
      {
        name: "Leg Press",
        rest: "90",
        sets: [...kg(3, 12, "120"), ...kg(1, 15, "80", "drop")],
      },
      {
        name: "Barbell Walking Lunge",
        rest: "45",
        superset: "C",
        sets: kg(3, 10, "30"),
      },
      {
        name: "Barbell Seated Calf Raise",
        rest: "60",
        superset: "C",
        sets: [...kg(2, 15, "40"), ...kg(1, 20, "40", "failure")],
      },
    ],
  },
  {
    key: "cardio",
    title: "Cardio Blast",
    emoji: "🏃",
    description: "Conditioning & core — intervals with short rests",
    rest: "30",
    exercises: [
      { name: "Jogging, Treadmill", rest: "0", sets: time(1, "5min", "warmup") },
      { name: "Battling Ropes", rest: "30", sets: time(3, "45s") },
      { name: "Bicycling, Stationary", rest: "30", sets: time(1, "15min") },
      { name: "Plank", rest: "30", sets: time(3, "60s") },
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
      rest: ex.rest,
      superset: ex.superset,
      sets: ex.sets.map((s) => ({
        id: uuidv4(),
        reps: s.reps,
        value: s.value,
        unit: s.unit,
        type: s.type,
      })),
    })),
  };
}
