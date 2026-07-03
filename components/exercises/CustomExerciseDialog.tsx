"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SELECTABLE_MUSCLES } from "@/lib/muscle-map";
import { addCustomExercise, upsertCustomExercise, type CustomExercise } from "@/lib/storage/custom-exercises";
import { extractYouTubeId } from "@/lib/exercise-videos";
import type { SetUnit } from "@/lib/types";

const UNIT_OPTIONS: { value: SetUnit; label: string }[] = [
  { value: "kg", label: "Weight (kg)" },
  { value: "bw", label: "Bodyweight" },
  { value: "time", label: "Time / duration" },
  { value: "km", label: "Distance (km)" },
];

const CATEGORY_OPTIONS = [
  "strength",
  "cardio",
  "stretching",
  "plyometrics",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
];

const chipItemClass =
  "!flex-none !rounded-md !border-l px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

/** Modal to create or edit a user-defined exercise, merged into the local library. */
export function CustomExerciseDialog({
  open,
  onOpenChange,
  initialName = "",
  editing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  /** When set, the dialog edits this exercise (prefilled; rename allowed). */
  editing?: CustomExercise | null;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = React.useState(initialName);
  const [unit, setUnit] = React.useState<SetUnit>("kg");
  const [primary, setPrimary] = React.useState<string[]>([]);
  const [secondary, setSecondary] = React.useState<string[]>([]);
  const [category, setCategory] = React.useState("strength");
  const [equipment, setEquipment] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");

  const matchMuscles = (stored: string[]) =>
    SELECTABLE_MUSCLES.filter((m) =>
      stored.some((s) => s.toLowerCase() === m.value.toLowerCase())
    ).map((m) => m.value);

  // Prefill from the exercise being edited, or reset to the typed name.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setUnit(editing.defaultUnit);
      setPrimary(matchMuscles(editing.primaryMuscles));
      setSecondary(matchMuscles(editing.secondaryMuscles));
      setCategory(editing.category || "strength");
      setEquipment(editing.equipment ?? "");
      setInstructions(editing.instructions.join("\n"));
      setVideoUrl(editing.videoUrl ?? "");
    } else {
      setName(initialName);
      setUnit("kg");
      setPrimary([]);
      setSecondary([]);
      setCategory("strength");
      setEquipment("");
      setInstructions("");
      setVideoUrl("");
    }
  }, [open, initialName, editing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give your exercise a name.");
      return;
    }
    if (trimmed.length > 100) {
      toast.error("Exercise name must be under 100 characters.");
      return;
    }
    if (videoUrl.trim() && !extractYouTubeId(videoUrl)) {
      toast.error("That doesn't look like a valid YouTube link.");
      return;
    }
    const payload = {
      name: trimmed,
      defaultUnit: unit,
      category,
      equipment: equipment.trim() || null,
      // Specific muscles power the accurate body heatmap (primary vs secondary).
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      instructions: instructions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      videoUrl: videoUrl.trim() || undefined,
    };
    const created = editing
      ? upsertCustomExercise(editing.name, payload)
      : addCustomExercise(payload);
    if (!created) {
      toast.error("Couldn't save — storage may be full.");
      return;
    }
    toast.success(
      editing ? `Updated “${created.name}”` : `Added “${created.name}” to your exercises`
    );
    onOpenChange(false);
    onCreated(created.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            {editing ? "Edit exercise" : "Add a custom exercise"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your exercise. Changes apply everywhere it's used."
              : "Create an exercise that isn't in the library (e.g. swimming). Saved on this device only — deleting your data removes it unless you choose to keep it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cx-name">Name</Label>
            <Input
              id="cx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Swimming"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-unit">Measured in</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as SetUnit)}>
              <SelectTrigger id="cx-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This decides how it&apos;s tracked (weight, reps, time or distance) in your history.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Primary muscles</Label>
            <p className="text-xs text-muted-foreground">
              The main muscles this exercise targets — shown solid red on your body heatmap.
            </p>
            <ToggleGroup
              type="multiple"
              value={primary}
              onValueChange={setPrimary}
              variant="outline"
              className="flex flex-wrap justify-start gap-2"
            >
              {SELECTABLE_MUSCLES.map((m) => (
                <ToggleGroupItem key={m.value} value={m.value} className={chipItemClass}>
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Secondary muscles (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Assisting muscles — shown a paler red.
            </p>
            <ToggleGroup
              type="multiple"
              value={secondary}
              onValueChange={setSecondary}
              variant="outline"
              className="flex flex-wrap justify-start gap-2"
            >
              {SELECTABLE_MUSCLES.map((m) => (
                <ToggleGroupItem key={m.value} value={m.value} className={chipItemClass}>
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cx-category">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cx-category" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cx-equipment">Equipment (optional)</Label>
              <Input
                id="cx-equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. pool"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-instructions">How to do it (optional)</Label>
            <Textarea
              id="cx-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="One step per line…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-video">YouTube video URL (optional)</Label>
            <Input
              id="cx-video"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              inputMode="url"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1" onClick={handleSave}>
            <Plus className="size-4" />
            {editing ? "Save changes" : "Add exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
