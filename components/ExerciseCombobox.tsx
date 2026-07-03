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
import {
  loadExerciseLibrary,
  getCachedLibrary,
  groupsForExerciseName,
  partitionByGroups,
  type LibraryExercise,
} from "@/lib/exercises";
import { CustomExerciseDialog } from "@/components/exercises/CustomExerciseDialog";
import { Plus } from "lucide-react";

interface ExerciseComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When set, exercises sharing this exercise's muscle groups are recommended first. */
  recommendForName?: string;
}

function ExerciseItem({
  exercise,
  selected,
  onSelect,
}: {
  exercise: LibraryExercise;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <CommandItem
      value={exercise.name}
      onSelect={() => onSelect(exercise.name)}
      className="flex items-start gap-2"
    >
      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{exercise.name}</div>
        <div className="text-xs text-muted-foreground">
          {[exercise.primaryMuscles?.join(", "), exercise.equipment, exercise.level]
            .filter(Boolean)
            .join(" • ")}
        </div>
      </div>
    </CommandItem>
  );
}

export function ExerciseCombobox({
  value,
  onChange,
  placeholder = "Search exercises...",
  recommendForName,
}: ExerciseComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [loading, setLoading] = React.useState(library.length === 0);
  const [search, setSearch] = React.useState("");
  const [customOpen, setCustomOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) {
        setLibrary(lib);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Start each open with a clean search so the recommended list is visible.
  React.useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const targetGroups = React.useMemo(
    () => (recommendForName ? groupsForExerciseName(library, recommendForName) : []),
    [library, recommendForName]
  );

  const matches = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (ex) =>
        ex.name?.toLowerCase().includes(q) ||
        ex.primaryMuscles?.some((m) => m?.toLowerCase().includes(q)) ||
        ex.equipment?.toLowerCase().includes(q) ||
        ex.category?.toLowerCase().includes(q)
    );
  }, [library, search]);

  const { recommended, rest } = React.useMemo(
    () => partitionByGroups(matches, targetGroups),
    [matches, targetGroups]
  );

  const recTop = recommended.slice(0, 30);
  const restTop = rest.slice(0, 50);

  const trimmed = search.trim();
  const showCustom =
    trimmed.length > 0 &&
    !library.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  // After a custom exercise is created: pull the refreshed (merged) library and
  // select it.
  const handleCreated = (name: string) => {
    loadExerciseLibrary().then((lib) => setLibrary(lib));
    onChange(name);
    setOpen(false);
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-[40px] w-full justify-between"
          title={value}
        >
          <span className="mr-2 flex-1 truncate text-left">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search exercises..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading exercises...</CommandEmpty>
            ) : (
              <>
                <CommandGroup heading="Create">
                  {showCustom && (
                    <CommandItem value={`__use__${trimmed}`} onSelect={() => select(trimmed)}>
                      Use “{trimmed}” as-is
                    </CommandItem>
                  )}
                  <CommandItem
                    value="__add_custom_exercise__"
                    onSelect={() => {
                      setOpen(false);
                      setCustomOpen(true);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 size-4" />
                    Add new exercise{trimmed ? ` “${trimmed}”` : ""}…
                  </CommandItem>
                </CommandGroup>
                {recTop.length === 0 && restTop.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No exercises found. Add it as a new exercise above.
                  </p>
                ) : (
                  <>
                    {recTop.length > 0 && (
                      <CommandGroup heading="Recommended">
                        {recTop.map((ex) => (
                          <ExerciseItem
                            key={`rec-${ex.name}`}
                            exercise={ex}
                            selected={value === ex.name}
                            onSelect={select}
                          />
                        ))}
                      </CommandGroup>
                    )}
                    {restTop.length > 0 && (
                      <CommandGroup heading={recTop.length > 0 ? "All exercises" : undefined}>
                        {restTop.map((ex) => (
                          <ExerciseItem
                            key={`all-${ex.name}`}
                            exercise={ex}
                            selected={value === ex.name}
                            onSelect={select}
                          />
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <CustomExerciseDialog
      open={customOpen}
      onOpenChange={setCustomOpen}
      initialName={trimmed}
      onCreated={handleCreated}
    />
    </>
  );
}
