"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Type for exercise data
type Exercise = {
  name: string;
  force: string;
  level: string;
  mechanic: string | null;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
};

interface ExerciseComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ExerciseCombobox({ 
  value, 
  onChange, 
  placeholder = "Search exercises..." 
}: ExerciseComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [exercises, setExercises] = React.useState<Exercise[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load exercises from JSON file
  React.useEffect(() => {
    const loadExercises = async () => {
      try {
        // Place your exercises.json file in the public folder
        const response = await fetch('/json/exercises.json');
        const data = await response.json();
        setExercises(data.exercises || []);
      } catch (error) {
        console.error('Failed to load exercises:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, []);

  // Filter exercises based on search
  const filteredExercises = React.useMemo(() => {
    if (!value) return exercises.slice(0,100); // Show first 50 by default
    
    const searchValue = value.toLowerCase();
    
    return exercises
      .filter((exercise) => {
        // Check exercise name
        const nameMatch = exercise.name?.toLowerCase().includes(searchValue);
        
        // Check primary muscles
        const muscleMatch = exercise.primaryMuscles?.some(muscle => 
          muscle?.toLowerCase().includes(searchValue)
        );
        
        // Check equipment (with null check)
        const equipmentMatch = exercise.equipment?.toLowerCase().includes(searchValue);
        
        // Check category
        const categoryMatch = exercise.category?.toLowerCase().includes(searchValue);
        
        return nameMatch || muscleMatch || equipmentMatch || categoryMatch;
      })
      .slice(0, 50); // Limit to 20 results
  }, [exercises, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
      <Button
  variant="outline"
  role="combobox"
  aria-expanded={open}
  className="w-full justify-between h-auto min-h-[40px]"
  title={value} // Shows full text on hover
>
  <span className="text-left truncate flex-1 mr-2">
    {value || placeholder}
  </span>
  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
</Button>
      </PopoverTrigger>
      <PopoverContent  className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command>
          <CommandInput 
            placeholder="Search exercises..." 
            value={value}
            onValueChange={onChange}
            
          />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading exercises...</CommandEmpty>
            ) : filteredExercises.length === 0 ? (
              <CommandEmpty>No exercises found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredExercises.map((exercise, index) => (
                  <CommandItem
                    key={exercise.name}
                    value={exercise.name}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start"
                  >
                    {/* break line between exercises */}
                    {(index > 0) ? (
                        <div className="w-full border-b border-gray-200 mb-2"></div>
                    ) : null}
                    <div className="flex items-center w-full">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === exercise.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{exercise.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {exercise.primaryMuscles.join(", ")} • {exercise.equipment} • {exercise.level}
                        </div>
                      </div>
                    </div>
        
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}