import { useFieldArray, useFormContext } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { ExerciseCombobox } from "./ExerciseCombobox";

type Props = {
  index: number;
  onRemove: () => void;
  exercisesLength: number;
};

const ExerciseBuilder = ({ index, onRemove, exercisesLength }: Props) => {
  const form = useFormContext();
  const { control } = form;
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
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
                // Duplicate the last set's values for faster entry.
                const sets = form.getValues(`exercises.${index}.sets`) || [];
                const lastSet = sets[sets.length - 1];
                appendSet(
                  lastSet
                    ? { id: uuidv4(), reps: lastSet.reps, value: lastSet.value }
                    : { id: uuidv4(), reps: 1, value: "" }
                );
              }}
            >
              <Plus className="size-4" />
              Add Set
            </Button>
          </div>

          {setFields.map((set, setIndex) => (
            <div key={set.id} className="flex items-end gap-3">
              <span
                className="mb-2 w-5 shrink-0 text-center text-sm font-medium text-muted-foreground"
                aria-hidden
              >
                {setIndex + 1}
              </span>
              <FormField
                control={control}
                name={`exercises.${index}.sets.${setIndex}.reps`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Reps</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        step={1}
                        placeholder="Reps"
                        {...field}
                        value={field.value === undefined ? "" : field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`exercises.${index}.sets.${setIndex}.value`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Weight / Time</FormLabel>
                    <FormControl>
                      <Input placeholder="10kg / 1min / BW" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSet(setIndex)}
                disabled={setFields.length === 1}
                className="mb-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove set ${setIndex + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExerciseBuilder;
