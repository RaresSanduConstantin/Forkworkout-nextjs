"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STARTER_TEMPLATES, type WorkoutTemplate } from "@/lib/templates";

/** Grid of ready-made starter workouts (push / pull / legs / cardio). */
export function StarterWorkouts({
  onAdd,
}: {
  onAdd: (template: WorkoutTemplate) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {STARTER_TEMPLATES.map((template) => (
        <Card key={template.key} className="h-full">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>
                {template.emoji}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold leading-tight">{template.title}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
            </div>

            <Badge variant="secondary" className="w-fit">
              {template.exercises.length} exercises
            </Badge>

            <Button
              className="mt-auto w-full gap-1"
              variant="outline"
              onClick={() => onAdd(template)}
            >
              <Plus className="size-4" />
              Add workout
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
