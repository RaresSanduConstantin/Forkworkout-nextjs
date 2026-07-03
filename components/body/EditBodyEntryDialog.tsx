"use client";

import * as React from "react";
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
import { NumberInput } from "@/components/ui/number-input";
import { updateBodyMetric } from "@/lib/storage/body-storage";
import type { BodyMeasurements, BodyMetricEntry } from "@/lib/types";

const parseNum = (s: string): number | undefined => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Edit a past body-metric entry's weight, measurements and note. */
export function EditBodyEntryDialog({
  entry,
  measures,
  onOpenChange,
  onSaved,
}: {
  entry: BodyMetricEntry | null;
  measures: { key: keyof BodyMeasurements; label: string }[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = React.useState("");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!entry) return;
    setWeight(entry.weightKg != null ? String(entry.weightKg) : "");
    const v: Record<string, string> = {};
    for (const m of measures) {
      const val = entry.measurements?.[m.key];
      if (val != null) v[m.key] = String(val);
    }
    setValues(v);
    setNote(entry.note ?? "");
  }, [entry, measures]);

  const save = () => {
    if (!entry) return;
    const weightKg = parseNum(weight);
    const measurements: BodyMeasurements = {};
    for (const m of measures) {
      const val = parseNum(values[m.key] ?? "");
      if (val !== undefined) measurements[m.key] = val;
    }
    const hasMeasures = Object.keys(measurements).length > 0;
    if (weightKg === undefined && !hasMeasures) {
      toast.error("Enter your weight or at least one measurement.");
      return;
    }
    const ok = updateBodyMetric(entry.id, {
      weightKg,
      measurements: hasMeasures ? measurements : undefined,
      note: note.trim() || undefined,
    });
    if (!ok) {
      toast.error("Couldn't update the entry.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success("Entry updated");
  };

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Edit entry</DialogTitle>
          <DialogDescription>Update this log entry. The date stays the same.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-weight" className="text-sm font-medium">
              Bodyweight (kg)
            </label>
            <NumberInput
              id="edit-weight"
              decimal
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Measurements (cm, optional)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {measures.map((m) => (
                <NumberInput
                  key={m.key}
                  decimal
                  value={values[m.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [m.key]: e.target.value }))
                  }
                  placeholder={m.label}
                  aria-label={m.label}
                />
              ))}
            </div>
          </div>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={200}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
