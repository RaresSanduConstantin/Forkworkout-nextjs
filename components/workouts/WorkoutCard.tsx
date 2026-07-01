"use client";

import * as React from "react";
import { Dumbbell, Layers, Pencil, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Workout } from "@/lib/types";

/** Summarizes a saved workout with primary (Start) and secondary actions. */
export function WorkoutCard({
  workout,
  onStart,
  onEdit,
  onDelete,
}: {
  workout: Workout;
  onStart: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const exerciseCount = workout.exercises.length;
  const setCount = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-lg font-semibold">
            {workout.title || "Untitled workout"}
          </h3>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${workout.title || "workout"}`}
            onClick={() => onDelete(workout.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Dumbbell className="size-3" />
            {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Layers className="size-3" />
            {setCount} {setCount === 1 ? "set" : "sets"}
          </Badge>
        </div>

        <div className="mt-1 flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => onStart(workout.id)}>
            <Play className="size-4" />
            Start
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => onEdit(workout.id)}
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
