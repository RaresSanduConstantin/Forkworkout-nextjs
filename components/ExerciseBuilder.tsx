import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { Trash2, Plus, Info, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { ExerciseCombobox } from "./ExerciseCombobox";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import { SET_UNITS, unitPlaceholder, formatRestLabel, EXERCISE_REST_OPTIONS } from "@/lib/workout";
import type { SetUnit } from "@/lib/types";

const newSet = () => ({ id: uuidv4(), reps: 1, value: "", unit: "kg" as SetUnit });

function SetRow({
  exerciseIndex,
  setIndex,
  onRemove,
  disableRemove,
}: {
  exerciseIndex: number;
  setIndex: number;
  onRemove: () => void;
  disableRemove: boolean;
}) {
  const form = useFormContext();
  const { control, setValue } = form;
  const base = `exercises.${exerciseIndex}.sets.${setIndex}` as const;
  const unit = (useWatch({ control, name: `${base}.unit` }) as SetUnit) ?? "kg";

  const handleUnit = (next: string) => {
    if (!next) return; // ignore deselect from the toggle group
    const nextUnit = next as SetUnit;
    setValue(`${base}.unit`, nextUnit, { shouldValidate: true, shouldDirty: true });
    if (nextUnit === "bw") {
      setValue(`${base}.value`, "BW", { shouldValidate: true });
    } else if (unit === "bw") {
      setValue(`${base}.value`, "", { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-center text-sm font-medium text-muted-foreground">
          {setIndex + 1}
        </span>
        <FormField
          control={control}
          name={`${base}.reps`}
          render={({ field }) => (
            <FormItem className="w-16">
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  aria-label={`Reps for set ${setIndex + 1}`}
                  {...field}
                  value={field.value === undefined ? "" : field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <span className="text-sm text-muted-foreground">reps</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disableRemove}
          className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove set ${setIndex + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <ToggleGroup
        type="single"
        value={unit}
        onValueChange={handleUnit}
        variant="outline"
        size="sm"
        className="grid grid-cols-4"
      >
        {SET_UNITS.map((u) => (
          <ToggleGroupItem
            key={u.value}
            value={u.value}
            aria-label={u.label}
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {u.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {unit !== "bw" && (
        <FormField
          control={control}
          name={`${base}.value`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type={unit === "kg" ? "number" : "text"}
                  inputMode={unit === "kg" ? "decimal" : "text"}
                  min={unit === "kg" ? 0 : undefined}
                  placeholder={unitPlaceholder(unit)}
                  aria-label={unit === "kg" ? "Weight in kg" : "Duration"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

type Props = {
  index: number;
  onRemove: () => void;
  exercisesLength: number;
};

const ExerciseBuilder = ({ index, onRemove, exercisesLength }: Props) => {
  const form = useFormContext();
  const { control } = form;
  const [infoOpen, setInfoOpen] = React.useState(false);
  const exerciseName = (useWatch({ control, name: `exercises.${index}.name` }) as string) || "";
  const restValue = useWatch({ control, name: `exercises.${index}.rest` }) as string | undefined;
  const {
    fields: setFields,
    append: appendSet,
    remove: removeSet,
  } = useFieldArray({
    control,
    name: `exercises.${index}.sets`,
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <FormField
          control={control}
          name={`exercises.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center justify-between">
                <span>Exercise {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  disabled={exercisesLength === 1}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </FormLabel>
              <FormControl>
                <ExerciseCombobox
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="Search for an exercise..."
                  recommendForName={exerciseName}
                />
              </FormControl>
              <FormMessage />
              <div className="mt-1 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!exerciseName}
                  onClick={() => setInfoOpen(true)}
                >
                  <Info className="size-4 text-primary" />
                  How to do it!
                </Button>
                <Select
                  value={restValue === undefined || restValue === "" ? "default" : restValue}
                  onValueChange={(v) =>
                    form.setValue(
                      `exercises.${index}.rest`,
                      v === "default" ? undefined : v,
                      { shouldDirty: true }
                    )
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-auto gap-1.5"
                    aria-label="Rest timer for this exercise"
                  >
                    <Timer className="size-4 text-primary" />
                    <SelectValue>{formatRestLabel(restValue)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {EXERCISE_REST_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormItem>
          )}
        />

        <ExerciseInfoDialog
          exerciseName={exerciseName}
          open={infoOpen}
          onOpenChange={setInfoOpen}
        />

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sets</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => {
                // Duplicate the last set (incl. its unit) for faster entry.
                const sets = form.getValues(`exercises.${index}.sets`) || [];
                const lastSet = sets[sets.length - 1];
                appendSet(
                  lastSet
                    ? {
                        id: uuidv4(),
                        reps: lastSet.reps,
                        value: lastSet.value,
                        unit: lastSet.unit ?? "kg",
                      }
                    : newSet()
                );
              }}
            >
              <Plus className="size-4" />
              Add Set
            </Button>
          </div>

          {setFields.map((set, setIndex) => (
            <SetRow
              key={set.id}
              exerciseIndex={index}
              setIndex={setIndex}
              onRemove={() => removeSet(setIndex)}
              disableRemove={setFields.length === 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExerciseBuilder;
