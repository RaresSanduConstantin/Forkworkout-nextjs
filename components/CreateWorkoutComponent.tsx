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
import { PageContainer } from "@/components/layout/PageContainer";
import { BottomActionBar } from "@/components/layout/BottomActionBar";
import { WorkoutWizard } from "@/components/workouts/WorkoutWizard";

import { honkFont } from "@/lib/honkFont";
import { motion, MotionConfig } from "motion/react";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Sparkles } from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { getWorkoutById, upsertWorkout } from "@/lib/storage/workout-storage";
import { WORKOUT_REST_OPTIONS } from "@/lib/workout";
import { ROUTES } from "@/lib/routes";
import type { Workout } from "@/lib/types";

const newSet = () => ({ id: uuidv4(), reps: 1, value: "", unit: "kg" as const });
const newExercise = () => ({ id: uuidv4(), name: "", sets: [newSet()] });

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
    move: moveExercise,
    insert: insertExercise,
  } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  // Duplicate an exercise (with fresh ids) directly below the original.
  const duplicateExercise = (index: number) => {
    const ex = form.getValues(`exercises.${index}`);
    insertExercise(index + 1, {
      ...ex,
      id: uuidv4(),
      sets: (ex.sets ?? []).map((s) => ({ ...s, id: uuidv4() })),
    });
  };

  const hasInitialized = React.useRef(false);
  const [showWizard, setShowWizard] = useState(false);

  const handleGenerated = (workout: Workout) => {
    hasInitialized.current = true;
    form.reset(workout);
    toast.success("Draft created — review and save it");
  };

  useEffect(() => {
    if (!hasInitialized.current && exerciseFields.length === 0) {
      appendExercise(newExercise());
      hasInitialized.current = true;
    }
  }, [exerciseFields, appendExercise]);

  useEffect(() => {
    if (workoutId) {
      const workout = getWorkoutById(workoutId);
      if (workout) {
        hasInitialized.current = true;
        form.reset(workout);
      }
    }
  }, [workoutId, form]);

  const onSubmit = (data: WorkoutSchema) => {
    const now = new Date().toISOString();

    if (workoutId) {
      // Editing existing — preserve id/createdAt, refresh updatedAt. Editing a
      // shared workout makes it your own, so drop the shared marker.
      const existing = getWorkoutById(workoutId);
      const updated: Workout = {
        ...(existing ?? { id: workoutId, exercises: [] }),
        ...data,
        id: workoutId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        shared: undefined,
        sharedMessage: undefined,
      };
      upsertWorkout(updated);
    } else {
      const newWorkout: Workout = {
        id: uuidv4(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      upsertWorkout(newWorkout);
    }

    toast.success(workoutId ? "Workout updated" : "Workout saved");
    router.push(ROUTES.dashboard);
  };

  const onInvalid = () => {
    toast.error("Please fix the highlighted fields before saving.");
  };

  return (
    <PageContainer hasBottomBar>
      <Button asChild variant="ghost" size="sm" className="mb-2 gap-1 px-2">
        <Link href={ROUTES.dashboard}>
          <ArrowLeft className="size-4" />
          Go Back
        </Link>
      </Button>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-6"
        >
          <h1 className="text-center text-4xl font-bold">
            {workoutId ? honkFont("Edit Workout") : honkFont("Create Workout")}
          </h1>

          {!workoutId && (
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => setShowWizard(true)}
            >
              <Sparkles className="size-4" />
              Help me create a workout
            </Button>
          )}

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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose rest period..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72">
                    {WORKOUT_REST_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Exercises */}
          <MotionConfig reducedMotion="user">
            <div className="space-y-4">
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
                    onMoveUp={index > 0 ? () => moveExercise(index, index - 1) : undefined}
                    onMoveDown={
                      index < exerciseFields.length - 1
                        ? () => moveExercise(index, index + 1)
                        : undefined
                    }
                    onDuplicate={() => duplicateExercise(index)}
                  />
                </motion.div>
              ))}
            </div>
          </MotionConfig>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-dashed"
            onClick={() => appendExercise(newExercise())}
          >
            <Plus className="size-4" />
            Add Exercise
          </Button>

          <BottomActionBar>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push(ROUTES.dashboard)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2">
              <Save className="size-4" />
              Save Workout
            </Button>
          </BottomActionBar>
        </form>
      </Form>

      <WorkoutWizard open={showWizard} onOpenChange={setShowWizard} onGenerate={handleGenerated} />
    </PageContainer>
  );
};

export default CreateWorkoutComponent;
