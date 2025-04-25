"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { workoutSchema, WorkoutSchema } from "@/schema/workoutSchema";
import ExerciseBuilder from "./ExerciseBuilder";

import { honkFont } from "@/lib/honkFont";
import { motion } from "motion/react";
import React, { useEffect } from "react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid"; // for unique workout ID

import { useParams } from "next/navigation";

const CreateWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();
  const form = useForm<WorkoutSchema>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      title: "",
      rest: "",
      exercises: [],
    },
  });

  const {
    fields: exerciseFields,
    append: appendExercise,
    remove: removeExercise,
  } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  const hasInitialized = React.useRef(false);

  useEffect(() => {
    if (!hasInitialized.current && exerciseFields.length === 0) {
      appendExercise({ name: "", sets: [{ reps: 1, value: "" }] });
      hasInitialized.current = true;
    }
  }, [exerciseFields, appendExercise]);

  useEffect(() => {
    if (workoutId) {
      const stored = localStorage.getItem("workouts");
      if (stored) {
        const workouts = JSON.parse(stored);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workout = workouts.find((w: any) => w.id === workoutId);

        if (workout) {
            console.log("workout", workout);
          form.reset(workout);
        }
      }
    }
  }, [workoutId, form]);

  const onSubmit = (data: WorkoutSchema) => {
    const stored = localStorage.getItem("workouts");
    const workouts = stored ? JSON.parse(stored) : [];

    if (workoutId) {
      // Editing existing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = workouts.map((w: any) => {
        if (w.id === workoutId) {
            console.log("w", w);
            console.log("data", data);

            console.log({...data, ...w });
          return { ...w, ...data };
        } else {
          return w;
        }
      });
      localStorage.setItem("workouts", JSON.stringify(updated));
    } else {
      // Creating new
      const newWorkout = {
        id: uuidv4(),
        ...data,
      };
      const updated = [...workouts, newWorkout];
      localStorage.setItem("workouts", JSON.stringify(updated));
    }

    router.push("/");
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <Button
        type="button"
        className=" top-5 right-5 z-50 rounded-full  shadow-lg px-5 py-3"
        variant="ghost"
      >
        <Link href="/">
          <span>← Go Back</span>
        </Link>
      </Button>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-row items-center justify-center gap-5 bg-slate-50 mt-3">
            <h1 className="text-4xl font-bold text-center">
              {workoutId
                ? honkFont("Edit Workout")
                : honkFont("Create Workout")}
            </h1>
          </div>

          {/* Workout Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workout Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Push Day, Full Body..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rest (optional) */}
          <FormField
            control={form.control}
            name="rest"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rest Between Sets</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose rest period..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="20">20s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="45">45s</SelectItem>
                    <SelectItem value="60">1 min</SelectItem>
                    <SelectItem value="90">90s</SelectItem>
                    <SelectItem value="120">2 min</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Placeholder for exercises */}

          {exerciseFields.map((exercise, index) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
            >
              <ExerciseBuilder
                index={index}
                onRemove={() => removeExercise(index)}
                exercisesLength={exerciseFields.length}
              />
            </motion.div>
          ))}


          <div className=" bottom-0 left-0 w-full flex justify-center gap-4 bg-slate-50 p-4 border-t-2 border-slate-300">
            <Button
              type="button"
              className=" bottom-15 right-5 rounded-full bg-orange-400 text-white shadow-lg px-5 py-3"
              onClick={() =>
                appendExercise({
                  name: "",
                  sets: [{ reps: 1, value: "" }],
                })
              }
            >
              ➕ Add Exercise
            </Button>

            <Button
              type="submit"
              className=" bottom-5 right-5 rounded-full bg-black text-white shadow-lg px-5 py-3"
            >
              💾<span>Save Workout</span>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CreateWorkoutComponent;
