"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Dumbbell, Flame, Plus, Trophy } from "lucide-react";

import { honkFont } from "@/lib/honkFont";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { StarterWorkouts } from "@/components/workouts/StarterWorkouts";
import { getWorkouts, deleteWorkout, upsertWorkout } from "@/lib/storage/workout-storage";
import { getCompletedDayKeys, getCompletedWorkouts } from "@/lib/storage/history-storage";
import { computeStreak } from "@/lib/date/streak";
import { instantiateTemplate, type WorkoutTemplate } from "@/lib/templates";
import { ROUTES } from "@/lib/routes";
import type { Workout } from "@/lib/types";
import { toast } from "sonner";

const WorkoutList = () => {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);

  useEffect(() => {
    setWorkouts(getWorkouts());
    setStreak(computeStreak(getCompletedDayKeys()));
    setTotalCompleted(getCompletedWorkouts().length);
  }, []);

  const handleEdit = (id: string) => router.push(ROUTES.editWorkout(id));
  const handleStart = (id: string) => router.push(ROUTES.startWorkout(id));

  const handleAddTemplate = (template: WorkoutTemplate) => {
    const workout = instantiateTemplate(template);
    upsertWorkout(workout);
    setWorkouts((prev) => [...prev, workout]);
    toast.success(`Added “${workout.title}”`, {
      action: {
        label: "Start",
        onClick: () => router.push(ROUTES.startWorkout(workout.id)),
      },
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteWorkout(pendingDelete.id);
    setWorkouts((prev) => prev.filter((w) => w.id !== pendingDelete.id));
    toast.success(`Deleted “${pendingDelete.title || "workout"}”`);
    setPendingDelete(null);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 space-y-8">
      {/* Progress summary */}
      <div className="space-y-3">
        <Link href={ROUTES.history} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Day streak"
              value={streak}
              icon={<Flame className="size-5" />}
            />
            <StatCard
              label="Workouts done"
              value={totalCompleted}
              icon={<Trophy className="size-5" />}
            />
          </div>
        </Link>
        <Button
          asChild
          variant="outline"
          className="w-full gap-2"
        >
          <Link href={ROUTES.history}>
            <CalendarDays className="size-4" />
            View calendar &amp; history
          </Link>
        </Button>
      </div>

      {/* Your workouts */}
      <section className="space-y-4">
        <h2 className="text-3xl">{honkFont("Your Workouts")}</h2>

        {workouts.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="size-8" />}
            title="No workouts yet"
            description="Create your first routine and ForkWorkout will save it on this device — no account needed."
            action={
              <Button className="gap-2" onClick={() => router.push(ROUTES.newWorkout)}>
                <Plus className="size-4" />
                Create your first workout
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {workouts.map((workout) => (
              <li key={workout.id}>
                <WorkoutCard
                  workout={workout}
                  onStart={handleStart}
                  onEdit={handleEdit}
                  onDelete={() => setPendingDelete(workout)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Starter workouts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-3xl">{honkFont("Starter Workouts")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New here? Add a ready-made routine and tweak it to fit you.
          </p>
        </div>
        <StarterWorkouts onAdd={handleAddTemplate} />
      </section>

      {/* Programs */}
      <section className="space-y-4">
        <h2 className="text-3xl">{honkFont("Programs")}</h2>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-lg font-semibold">P90X</p>
              <p className="text-sm text-muted-foreground">
                A classic 90-day program template
              </p>
            </div>
            <Button onClick={() => handleStart("1")}>Start</Button>
          </CardContent>
        </Card>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this workout?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default WorkoutList;
