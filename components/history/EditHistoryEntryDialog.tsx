"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { toDayKey } from "@/lib/date/day-key";
import { updateCompletedWorkout } from "@/lib/storage/history-storage";
import type {
  CompletedExercise,
  CompletedSet,
  CompletedWorkout,
  SetStatus,
  SetType,
  SetUnit,
} from "@/lib/types";
import { inferUnit, setVolumeKg, SET_TYPES, SET_UNITS } from "@/lib/workout";

const pad = (value: number) => String(value).padStart(2, "0");

function toLocalDateTimeValue(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateFromLocalDateTimeValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function timeFromLocalDateTimeValue(value: string): string {
  return value.split("T")[1] ?? "";
}

function splitDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return { hours: "", minutes: "", seconds: "" };
  const whole = Math.round(seconds);
  return {
    hours: String(Math.floor(whole / 3600)),
    minutes: String(Math.floor((whole % 3600) / 60)),
    seconds: String(whole % 60),
  };
}

function cloneExercises(exercises?: CompletedExercise[]): CompletedExercise[] {
  return (exercises ?? []).map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

function optionalInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function derivedTotals(exercises: CompletedExercise[]) {
  let volume = 0;
  let totalReps = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.status !== "done" || set.type === "warmup") continue;
      totalReps += set.reps;
      volume += setVolumeKg(set.reps, set.value, set.unit);
    }
  }
  return {
    volume: volume > 0 ? Math.round(volume) : undefined,
    totalReps: totalReps > 0 ? totalReps : undefined,
  };
}

const STATUS_OPTIONS: Array<{ value: SetStatus; label: string }> = [
  { value: "done", label: "Done" },
  { value: "skipped", label: "Skipped" },
  { value: "pending", label: "Pending" },
];

/** Edits a completed session while preserving its original storage identity. */
export function EditHistoryEntryDialog({
  open,
  entry,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  entry: CompletedWorkout | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [completedAt, setCompletedAt] = React.useState("");
  const [durationHours, setDurationHours] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("");
  const [durationSeconds, setDurationSeconds] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [rpe, setRpe] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [avgHeartRate, setAvgHeartRate] = React.useState("");
  const [maxHeartRate, setMaxHeartRate] = React.useState("");
  const [exercises, setExercises] = React.useState<CompletedExercise[]>([]);
  const [exerciseDataChanged, setExerciseDataChanged] = React.useState(false);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || !entry) return;
    const duration = splitDuration(entry.durationSec);
    setTitle(entry.title);
    setCompletedAt(toLocalDateTimeValue(entry.date));
    setDurationHours(duration.hours);
    setDurationMinutes(duration.minutes);
    setDurationSeconds(duration.seconds);
    setNotes(entry.notes ?? "");
    setRpe(entry.rpe != null ? String(entry.rpe) : "");
    setCalories(entry.calories != null ? String(entry.calories) : "");
    setAvgHeartRate(entry.avgHeartRate != null ? String(entry.avgHeartRate) : "");
    setMaxHeartRate(entry.maxHeartRate != null ? String(entry.maxHeartRate) : "");
    setExercises(cloneExercises(entry.exercises));
    setExerciseDataChanged(false);
    setDatePickerOpen(false);
  }, [open, entry]);

  const completionDate = dateFromLocalDateTimeValue(completedAt);
  const completionTime = timeFromLocalDateTimeValue(completedAt);

  const totals = React.useMemo(() => derivedTotals(exercises), [exercises]);
  const displayedTotals =
    !exerciseDataChanged && exercises.length === 0
      ? { volume: entry?.volume, totalReps: entry?.totalReps }
      : totals;

  const updateExercise = (
    exerciseIndex: number,
    updater: (exercise: CompletedExercise) => CompletedExercise
  ) => {
    setExerciseDataChanged(true);
    setExercises((current) =>
      current.map((exercise, index) =>
        index === exerciseIndex ? updater(exercise) : exercise
      )
    );
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    updater: (set: CompletedSet) => CompletedSet
  ) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, index) =>
        index === setIndex ? updater(set) : set
      ),
    }));
  };

  const removeExercise = (exerciseIndex: number) => {
    setExerciseDataChanged(true);
    setExercises((current) => current.filter((_exercise, index) => index !== exerciseIndex));
  };

  const addExercise = () => {
    setExerciseDataChanged(true);
    setExercises((current) => [
      ...current,
      {
        name: "",
        sets: [{ reps: 1, value: "", unit: "kg", status: "done" }],
      },
    ]);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((_set, index) => index !== setIndex),
    }));
  };

  const addSet = (exerciseIndex: number) => {
    updateExercise(exerciseIndex, (exercise) => {
      const previous = exercise.sets.at(-1);
      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            reps: previous?.reps ?? 1,
            value: previous?.value ?? "",
            unit: previous?.unit ?? inferUnit(previous?.value ?? ""),
            status: "done",
            type: previous?.type,
          },
        ],
      };
    });
  };

  const save = () => {
    if (!entry) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Enter a workout title.");
      return;
    }

    const parsedDate = new Date(completedAt);
    if (!completedAt || !Number.isFinite(parsedDate.getTime())) {
      toast.error("Enter a valid completion date and time.");
      return;
    }
    if (parsedDate.getTime() > Date.now() + 60_000) {
      toast.error("The completion time cannot be in the future.");
      return;
    }

    const hours = optionalInteger(durationHours) ?? 0;
    const minutes = optionalInteger(durationMinutes) ?? 0;
    const seconds = optionalInteger(durationSeconds) ?? 0;
    if (minutes > 59 || seconds > 59) {
      toast.error("Duration minutes and seconds must be between 0 and 59.");
      return;
    }
    const durationSec = hours * 3600 + minutes * 60 + seconds;

    const parsedRpe = optionalInteger(rpe);
    const parsedCalories = optionalInteger(calories);
    const parsedAvgHeartRate = optionalInteger(avgHeartRate);
    const parsedMaxHeartRate = optionalInteger(maxHeartRate);
    if (parsedRpe !== undefined && (parsedRpe < 1 || parsedRpe > 10)) {
      toast.error("Workout RPE must be between 1 and 10.");
      return;
    }
    if (parsedCalories !== undefined && parsedCalories <= 0) {
      toast.error("Calories must be greater than zero.");
      return;
    }
    if (
      (parsedAvgHeartRate !== undefined &&
        (parsedAvgHeartRate < 1 || parsedAvgHeartRate > 300)) ||
      (parsedMaxHeartRate !== undefined &&
        (parsedMaxHeartRate < 1 || parsedMaxHeartRate > 300))
    ) {
      toast.error("Heart rate must be between 1 and 300 bpm.");
      return;
    }
    if (
      parsedAvgHeartRate !== undefined &&
      parsedMaxHeartRate !== undefined &&
      parsedAvgHeartRate > parsedMaxHeartRate
    ) {
      toast.error("Average heart rate cannot be higher than maximum heart rate.");
      return;
    }

    for (const [exerciseIndex, exercise] of exercises.entries()) {
      if (!exercise.name.trim()) {
        toast.error(`Enter a name for exercise ${exerciseIndex + 1}.`);
        return;
      }
      for (const [setIndex, set] of exercise.sets.entries()) {
        if (!Number.isFinite(set.reps) || set.reps < 1) {
          toast.error(`${exercise.name}: set ${setIndex + 1} needs at least one rep.`);
          return;
        }
        if (
          set.status === "done" &&
          (set.unit ?? inferUnit(set.value)) !== "bw" &&
          !set.value.trim()
        ) {
          toast.error(`${exercise.name}: enter a value for set ${setIndex + 1}.`);
          return;
        }
        if (set.rpe !== undefined && (set.rpe < 1 || set.rpe > 10)) {
          toast.error(`${exercise.name}: set RPE must be between 1 and 10.`);
          return;
        }
      }
    }

    const nextTotals = exerciseDataChanged
      ? totals
      : { volume: entry.volume, totalReps: entry.totalReps };
    const next: CompletedWorkout = {
      ...entry,
      title: trimmedTitle,
      date: parsedDate.toISOString(),
      dayKey: toDayKey(parsedDate),
      durationSec: durationSec > 0 ? durationSec : undefined,
      volume: nextTotals.volume,
      totalReps: nextTotals.totalReps,
      exercises: exerciseDataChanged
        ? exercises.length > 0
          ? exercises.map((exercise) => ({
              name: exercise.name.trim(),
              sets: exercise.sets.map((set) => ({ ...set })),
            }))
          : undefined
        : entry.exercises,
      notes: notes.trim() || undefined,
      rpe: parsedRpe,
      calories: parsedCalories,
      avgHeartRate: parsedAvgHeartRate,
      maxHeartRate: parsedMaxHeartRate,
    };

    if (!updateCompletedWorkout(entry.date, next)) {
      toast.error("Couldn't update this workout. It may have been removed.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success("Workout history updated");
  };

  return (
    <Dialog open={open && entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b p-5 pr-12 text-left sm:p-6 sm:pr-12">
          <DialogTitle>Edit completed workout</DialogTitle>
          <DialogDescription>
            Correct session details or performed sets. Volume and rep totals update automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold">Session details</legend>
            <div className="space-y-1.5">
              <label htmlFor="history-edit-title" className="text-sm font-medium">
                Workout title
              </label>
              <Input
                id="history-edit-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="history-edit-date">Completed date</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="history-edit-date"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {completionDate ? (
                        format(completionDate, "PPP")
                      ) : (
                        <span className="text-muted-foreground">Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={completionDate}
                      defaultMonth={completionDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setCompletedAt(
                          `${toDayKey(date)}T${completionTime || "00:00:00"}`
                        );
                        setDatePickerOpen(false);
                      }}
                      disabled={{ after: new Date() }}
                      weekStartsOn={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label id="history-edit-time-label">Completed time</Label>
                <TimePicker
                  value={completionTime}
                  aria-labelledby="history-edit-time-label"
                  onValueChange={(time) => {
                    const datePart = completionDate
                      ? toDayKey(completionDate)
                      : toDayKey();
                    setCompletedAt(`${datePart}T${time}`);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Duration</span>
              <div className="grid grid-cols-3 gap-2">
                <NumberInput
                  value={durationHours}
                  onChange={(event) => setDurationHours(event.target.value)}
                  placeholder="Hours"
                  aria-label="Duration hours"
                />
                <NumberInput
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  placeholder="Minutes"
                  aria-label="Duration minutes"
                />
                <NumberInput
                  value={durationSeconds}
                  onChange={(event) => setDurationSeconds(event.target.value)}
                  placeholder="Seconds"
                  aria-label="Duration seconds"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="history-edit-rpe" className="text-sm font-medium">RPE</label>
                <NumberInput
                  id="history-edit-rpe"
                  value={rpe}
                  onChange={(event) => setRpe(event.target.value)}
                  placeholder="1–10"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="history-edit-calories" className="text-sm font-medium">Calories</label>
                <NumberInput
                  id="history-edit-calories"
                  value={calories}
                  onChange={(event) => setCalories(event.target.value)}
                  placeholder="kcal"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="history-edit-avg-bpm" className="text-sm font-medium">Avg BPM</label>
                <NumberInput
                  id="history-edit-avg-bpm"
                  value={avgHeartRate}
                  onChange={(event) => setAvgHeartRate(event.target.value)}
                  placeholder="bpm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="history-edit-max-bpm" className="text-sm font-medium">Max BPM</label>
                <NumberInput
                  id="history-edit-max-bpm"
                  value={maxHeartRate}
                  onChange={(event) => setMaxHeartRate(event.target.value)}
                  placeholder="bpm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="history-edit-notes" className="text-sm font-medium">Notes</label>
              <Textarea
                id="history-edit-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="How did the session go?"
                maxLength={500}
                rows={3}
              />
            </div>
          </fieldset>

          <section className="space-y-3 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Performed exercises</h3>
                <p className="text-xs text-muted-foreground">
                  Only done, non-warm-up sets count toward totals and records.
                </p>
              </div>
              <div className="flex gap-1.5">
                <Badge variant="secondary">{displayedTotals.volume ?? 0} kg</Badge>
                <Badge variant="secondary">{displayedTotals.totalReps ?? 0} reps</Badge>
              </div>
            </div>

            {exercises.map((exercise, exerciseIndex) => (
              <div key={exerciseIndex} className="space-y-3 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={exercise.name}
                    onChange={(event) =>
                      updateExercise(exerciseIndex, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder={`Exercise ${exerciseIndex + 1}`}
                    aria-label={`Exercise ${exerciseIndex + 1} name`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeExercise(exerciseIndex)}
                    aria-label={`Remove ${exercise.name || `exercise ${exerciseIndex + 1}`}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {exercise.sets.map((set, setIndex) => {
                  const unit = set.unit ?? inferUnit(set.value);
                  return (
                    <div key={setIndex} className="space-y-3 rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Set {setIndex + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeSet(exerciseIndex, setIndex)}
                          aria-label={`Remove set ${setIndex + 1} from ${exercise.name || "exercise"}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <NumberInput
                          value={String(set.reps)}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              reps: Number.parseInt(event.target.value, 10) || 0,
                            }))
                          }
                          placeholder="Reps"
                          aria-label={`${exercise.name || "Exercise"} set ${setIndex + 1} reps`}
                        />
                        <Select
                          value={unit}
                          onValueChange={(value: SetUnit) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              unit: value,
                              value:
                                value === "bw"
                                  ? "BW"
                                  : current.value === "BW"
                                  ? ""
                                  : current.value,
                            }))
                          }
                        >
                          <SelectTrigger aria-label={`${exercise.name || "Exercise"} set unit`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SET_UNITS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={unit === "bw" ? "BW" : set.value}
                          disabled={unit === "bw"}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              value: event.target.value,
                            }))
                          }
                          placeholder={unit === "time" ? "e.g. 45s" : "Value"}
                          aria-label={`${exercise.name || "Exercise"} set value`}
                        />
                        <NumberInput
                          value={set.rpe != null ? String(set.rpe) : ""}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              rpe: optionalInteger(event.target.value),
                            }))
                          }
                          placeholder="Set RPE"
                          aria-label={`${exercise.name || "Exercise"} set RPE`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={set.status}
                          onValueChange={(value: SetStatus) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              status: value,
                            }))
                          }
                        >
                          <SelectTrigger aria-label={`${exercise.name || "Exercise"} set status`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={set.type ?? "working"}
                          onValueChange={(value: SetType) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              type: value,
                            }))
                          }
                        >
                          <SelectTrigger aria-label={`${exercise.name || "Exercise"} set type`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SET_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={set.excludeFromPR ?? false}
                          onChange={(event) =>
                            updateSet(exerciseIndex, setIndex, (current) => ({
                              ...current,
                              excludeFromPR: event.target.checked || undefined,
                            }))
                          }
                          className="size-4 accent-primary"
                        />
                        Exclude this set from personal records
                      </label>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => addSet(exerciseIndex)}
                >
                  <Plus className="size-4" />
                  Add set
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={addExercise}
            >
              <Plus className="size-4" />
              Add exercise
            </Button>
          </section>
        </div>

        <DialogFooter className="border-t p-4 sm:p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
