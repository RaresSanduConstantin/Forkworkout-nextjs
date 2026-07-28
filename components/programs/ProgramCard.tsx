"use client";

import { Check, Pencil, Play, Share2, Trash2 } from "lucide-react";

import type { Workout, WorkoutProgram } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProgramCard({
  program,
  workouts,
  active,
  nextWorkout,
  onActivate,
  onStart,
  onEdit,
  onShare,
  onDelete,
}: {
  program: WorkoutProgram;
  workouts: Workout[];
  active: boolean;
  nextWorkout: Workout | null;
  onActivate: () => void;
  onStart: (id: string) => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const ordered = program.workoutIds
    .map((id) => workouts.find((workout) => workout.id === id))
    .filter((workout): workout is Workout => !!workout);

  return (
    <Card className={active ? "border-primary/40" : ""}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{program.title}</h3>
              {active && <Badge className="gap-1"><Check className="size-3" /> Active</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ordered.map((workout) => workout.title).join(" → ") || "No available workouts"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextWorkout && (
            <Button size="sm" className="gap-1.5" onClick={() => onStart(nextWorkout.id)}>
              <Play className="size-3.5" /> Start next
            </Button>
          )}
          {!active && (
            <Button size="sm" variant="secondary" onClick={onActivate}>Make active</Button>
          )}
          <Button size="icon-sm" variant="outline" onClick={onEdit} aria-label={`Edit ${program.title}`}>
            <Pencil className="size-4" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={onShare} aria-label={`Share ${program.title}`}>
            <Share2 className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${program.title}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
