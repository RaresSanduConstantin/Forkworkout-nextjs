import * as z from "zod";

export const workoutSchema = z.object({
  title: z.string().min(1, "Title is required").max(50, "Title must be less than 50 characters"),
  rest: z.string().optional(),
  exercises: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Exercise name is required").max(100, "Exercise name must be less than 100 characters"),
      rest: z.string().optional(),
      sets: z.array(
        z.object({
          id: z.string().optional(),
          reps: z.coerce.number({
            invalid_type_error: "",
            required_error: "",
          }).int("Whole reps only").min(1, "").max(100, "Reps must be between 1 and 100") ,
          unit: z.enum(["kg", "bw", "time", "km"]),
          value: z.string().min(1, "").max(20, "Max 20 chars"), // number for kg/km, "BW", or a time like "45s"
        })
      ).min(1, "At least one set is required"),
    })
  ).min(1, "Add at least one exercise"),
});

export type WorkoutSchema = z.infer<typeof workoutSchema>;

