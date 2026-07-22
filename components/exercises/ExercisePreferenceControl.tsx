"use client";

import * as React from "react";
import { Ban, Heart, SlidersHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getExercisePreference,
  setExercisePreference,
  type ExercisePreference,
  type ExercisePreferenceReason,
} from "@/lib/storage/exercise-preferences";

const AVOID_REASONS: Array<{
  reason: ExercisePreferenceReason;
  label: string;
  description: string;
}> = [
  { reason: "dislike", label: "Not for me", description: "Avoid in future workouts" },
  { reason: "equipment", label: "Equipment unavailable", description: "Avoid this exercise" },
  { reason: "difficulty", label: "Too difficult", description: "Choose an easier alternative" },
  { reason: "discomfort", label: "Causes discomfort", description: "Exclude for your safety" },
  { reason: "temporary", label: "Skip for 7 days", description: "Automatically becomes neutral" },
  { reason: "other", label: "Other reason", description: "Avoid in future workouts" },
];

export function ExercisePreferenceControl({
  exerciseId,
  exerciseName,
  compact = false,
  onChange,
}: {
  exerciseId: string;
  exerciseName: string;
  compact?: boolean;
  onChange?: (preference: ExercisePreference | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [preference, setPreference] = React.useState<ExercisePreference | null>(null);

  React.useEffect(() => {
    setPreference(getExercisePreference(exerciseId));
  }, [exerciseId, open]);

  const save = (
    level: "prefer" | "neutral" | "avoid",
    reason?: ExercisePreferenceReason
  ) => {
    const expiresAt =
      reason === "temporary"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    const saved = setExercisePreference({
      exerciseId,
      exerciseName,
      level,
      reason,
      expiresAt,
    });
    if (!saved) {
      toast.error("Couldn't save this exercise preference.");
      return;
    }
    const next = getExercisePreference(exerciseId);
    setPreference(next);
    onChange?.(next);
    setOpen(false);
    toast.success(
      level === "prefer"
        ? `${exerciseName} will be suggested more often.`
        : level === "avoid"
          ? reason === "temporary"
            ? `${exerciseName} will be skipped for 7 days.`
            : `${exerciseName} will be left out of generated workouts.`
          : `${exerciseName} is neutral again.`
    );
  };

  const label =
    preference?.level === "prefer"
      ? "Preferred"
      : preference?.level === "avoid"
        ? "Avoided"
        : "Preference";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={preference ? "secondary" : "outline"}
          size={compact ? "xs" : "sm"}
          className={cn(
            "gap-1.5",
            preference?.level === "prefer" && "text-primary",
            preference?.level === "avoid" && "text-destructive"
          )}
          aria-label={`Set preference for ${exerciseName}. Current setting: ${label}`}
        >
          {preference?.level === "prefer" ? (
            <Heart className="size-3.5 fill-current" />
          ) : preference?.level === "avoid" ? (
            <Ban className="size-3.5" />
          ) : (
            <SlidersHorizontal className="size-3.5" />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        sticky="always"
        onInteractOutside={() => setOpen(false)}
        onEscapeKeyDown={() => setOpen(false)}
        className="z-[70] w-[min(20rem,calc(100vw-2rem))] touch-pan-y space-y-3 overflow-y-auto overscroll-contain p-3"
        style={{
          maxHeight:
            "min(var(--radix-popover-content-available-height), calc(100dvh - 1.5rem))",
        }}
      >
        <div>
          <p className="font-medium">Your preference</p>
          <p className="truncate text-xs text-muted-foreground">{exerciseName}</p>
        </div>

        <Button
          type="button"
          variant={preference?.level === "prefer" ? "secondary" : "ghost"}
          className="h-auto w-full justify-start py-2 text-left"
          onClick={() => save("prefer")}
        >
          <Heart className="size-4" />
          <span>
            <span className="block">Prefer this exercise</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Suggest it more often
            </span>
          </span>
        </Button>

        <div className="space-y-1">
          <p className="px-2 text-xs font-medium text-muted-foreground">Avoid because…</p>
          {AVOID_REASONS.map((item) => (
            <Button
              key={item.reason}
              type="button"
              variant={
                preference?.level === "avoid" && preference.reason === item.reason
                  ? "secondary"
                  : "ghost"
              }
              className="h-auto w-full justify-start py-2 text-left"
              onClick={() => save("avoid", item.reason)}
            >
              <Ban className="size-4" />
              <span>
                <span className="block">{item.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!preference}
          onClick={() => save("neutral")}
        >
          <Undo2 className="size-4" />
          Reset to neutral
        </Button>
      </PopoverContent>
    </Popover>
  );
}
