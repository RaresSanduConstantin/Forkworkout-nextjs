import * as z from "zod";

export const workoutSchema = z.object({
  title: z.string().min(1, "Title is required").max(50, "Title must be less than 50 characters"),
  rest: z.string().optional(),
  exercises: z.array(
    z.object({
      name: z.string().min(1, "Exercise name is required").max(50, "Exercise name must be less than 50 characters"),
      sets: z.array(
        z.object({
          reps: z.number().min(1).max(100, "Reps must be between 1 and 100"),
          value: z.string().min(1, "").max(20, "Max 20 chars"), // like "BW", "10kg", "1min"
        })
      ).min(1, "At least one set is required"),
    })
  ).min(1, "Add at least one exercise"),
});

export type WorkoutSchema = z.infer<typeof workoutSchema>;
