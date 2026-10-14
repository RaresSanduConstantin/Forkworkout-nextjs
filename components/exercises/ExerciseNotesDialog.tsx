"use client";

import { useId, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getExerciseNote, MAX_EXERCISE_NOTE_LENGTH, setExerciseNote,
  type ExerciseNote,
} from "@/lib/storage/exercise-notes";

export function ExerciseNotesDialog({
  exerciseId,
  exerciseName,
  hasNote,
  onSaved,
}: {
  exerciseId: string;
  exerciseName: string;
  hasNote: boolean;
  onSaved: (note: ExerciseNote) => void;
}) {
  const inputId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) setDraft(getExerciseNote(exerciseId));
    setOpen(nextOpen);
  };

  const save = () => {
    const note = setExerciseNote(exerciseId, draft);
    if (!note) {
      toast.error("Couldn't save your notes. Please try again.");
      return;
    }
    onSaved(note);
    setOpen(false);
    toast.success(note.text ? "Exercise notes saved" : "Exercise notes cleared");
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!exerciseName.trim()}
          aria-label={`Notes for ${exerciseName}${hasNote ? " (saved)" : ""}`}
        >
          <StickyNote className="size-4 text-primary" aria-hidden="true" />
          Notes
          {hasNote && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Exercise notes</DialogTitle>
            <DialogDescription className="break-words">
              {exerciseName} · Saved on this device for future workouts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Setup & reminders</Label>
            <Textarea
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_EXERCISE_NOTE_LENGTH}
              rows={5}
              className="min-h-32 resize-y text-base"
              placeholder={"Seat: 4\nBackrest: 2\nUse the narrow handles"}
            />
            <p className="text-xs text-muted-foreground">
              Keep machine settings or technique cues here. To clear a note, empty it and save.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit">Save notes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
