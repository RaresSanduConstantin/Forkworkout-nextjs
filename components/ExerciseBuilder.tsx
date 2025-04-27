import { useFieldArray, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";



type Props = {
  index: number;
  onRemove: () => void;
    exercisesLength: number;
};

const ExerciseBuilder = ({ index, onRemove, exercisesLength }: Props) => {
    const form = useFormContext();

  const { control } = useFormContext();
  const {
    fields: setFields,
    append: appendSet,
    remove: removeSet,
  } = useFieldArray({
    control,
    name: `exercises.${index}.sets`,
  });

  return (
    <div className="p-4 rounded-md bg-slate-100 space-y-3 border-2 border-slate-300">
      <FormField
        
        control={control}
        name={`exercises.${index}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex  justify-between">
              Exercise Name
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onRemove}
                disabled={exercisesLength === 1}
              >
                Remove Exercise
              </Button>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g. Push-Up" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        <div className="flex justify-between items-center pt-2 border-t-2 border-b-2 border-slate-300 pb-2">
          <span className="font-medium">Sets</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
                // SAFELY get last filled set from form values, not setFields
                const sets = form.getValues(`exercises.${index}.sets`) || [];
                const lastSet = sets[sets.length - 1];
            
                if (lastSet) {
                  appendSet({
                    reps: lastSet.reps,
                    value: lastSet.value,
                  });
                } else {
                  appendSet({ reps: 1, value: "" });
                }
              }}
          >
            + Add Set
          </Button>
        </div>

        {setFields.map((set, setIndex) => (
          <div key={set.id} className="flex items-center  gap-3">
            <FormField
              control={control}
              name={`exercises.${index}.sets.${setIndex}.reps`}
              render={({ field }) => (
                <FormItem className="w-1/2">
                  <FormLabel>Reps</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Reps" {...field} onChange={(e) => field.onChange(Number(e.target.value))}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            
         
            <FormField
              control={control}
              name={`exercises.${index}.sets.${setIndex}.value`}
              render={({ field }) => (
                <FormItem className="w-1/2">
                  <FormLabel>Weight / Time</FormLabel>
                  <FormControl>
                    <Input placeholder="10kg/1min/BW" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeSet(setIndex)}
              className="self-end border-2 border-slate-400 w-10 h-10 rounded-full flex items-center justify-center"
              aria-label="Remove set"
            >
              🗑️
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseBuilder;
