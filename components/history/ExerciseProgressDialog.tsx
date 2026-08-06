"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExerciseProgressChart } from "@/components/history/ExerciseProgressChart";
import { getExerciseHistory } from "@/lib/history-stats";

/** Progress chart for a single exercise across all completed sessions. */
export function ExerciseProgressDialog({
  name,
  onOpenChange,
}: {
  name: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const stats = React.useMemo(() => (name ? getExerciseHistory(name) : []), [name]);

  return (
    <Dialog open={name !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] overflow-hidden sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="break-words pr-6">{name}</DialogTitle>
          <DialogDescription>
            {stats.length > 0
              ? `${stats.length} ${stats.length === 1 ? "session" : "sessions"} tracked`
              : "No history yet"}
          </DialogDescription>
        </DialogHeader>

        {name && <ExerciseProgressChart name={name} range="all" />}
      </DialogContent>
    </Dialog>
  );
}
