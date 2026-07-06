"use client";

import * as React from "react";
import { Search, Info, Target } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadExerciseLibrary,
  getCachedLibrary,
  MUSCLE_GROUPS,
  groupsForExercise,
  libMusclesForTargets,
  TARGET_BY_KEY,
  type LibraryExercise,
  type MuscleGroup,
  type MuscleTargetKey,
} from "@/lib/exercises";
import { MuscleMapPicker } from "@/components/workouts/MuscleMapPicker";
import { useMannequinGender } from "@/lib/use-body-gender";

const MAX_RESULTS = 80;

const chipClass =
  "!flex-none !rounded-md !border-l px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

/**
 * Searchable, filterable browser over the full exercise library (built-in +
 * custom). Filter by name, muscle and equipment. Muscle filtering can be a
 * coarse group (chips) or a specific muscle (`muscleFilter` / the body map),
 * which matches the exercise's PRIMARY muscle so e.g. "triceps" doesn't return
 * biceps curls. When `onPick` is given, tapping an exercise selects it;
 * otherwise an info button opens the how-to dialog via `onInfo`.
 */
export function ExerciseLibraryBrowser({
  onPick,
  onInfo,
  initialGroup,
  muscleFilter,
  hideGroupFilter = false,
  enableMuscleMap = false,
}: {
  onPick?: (name: string) => void;
  onInfo?: (name: string) => void;
  initialGroup?: MuscleGroup | null;
  /** Controlled specific-muscle filter (matches primary muscle). */
  muscleFilter?: MuscleTargetKey | null;
  hideGroupFilter?: boolean;
  enableMuscleMap?: boolean;
}) {
  const gender = useMannequinGender();
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [search, setSearch] = React.useState("");
  const [group, setGroup] = React.useState<MuscleGroup | "">(initialGroup ?? "");
  const [equipment, setEquipment] = React.useState<string>("");
  const [showMap, setShowMap] = React.useState(false);
  const [mapKey, setMapKey] = React.useState<MuscleTargetKey | null>(null);

  // The active fine-grained muscle: the controlled prop wins, else the map tap.
  const activeMuscle = muscleFilter ?? mapKey;

  React.useEffect(() => {
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) setLibrary(lib);
    });
    return () => {
      active = false;
    };
  }, []);

  // Distinct equipment values present in the library (for the filter dropdown).
  const equipmentOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const ex of library) if (ex.equipment) set.add(ex.equipment.toLowerCase());
    return [...set].sort();
  }, [library]);

  const results = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    // A specific muscle filters by PRIMARY muscle (precise); a coarse group
    // falls back to any-muscle-in-group.
    const muscleLib = activeMuscle ? libMusclesForTargets([activeMuscle]) : null;
    const filtered = library.filter((ex) => {
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      if (muscleLib) {
        if (!(ex.primaryMuscles ?? []).some((m) => muscleLib.has(m.toLowerCase()))) return false;
      } else if (group && !groupsForExercise(ex).includes(group)) {
        return false;
      }
      if (equipment && (ex.equipment ?? "").toLowerCase() !== equipment) return false;
      return true;
    });
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [library, search, group, equipment, activeMuscle]);

  const shown = results.slice(0, MAX_RESULTS);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="pl-9"
          aria-label="Search exercises"
        />
      </div>

      {enableMuscleMap && (
        <div className="space-y-3">
          <Button
            type="button"
            variant={showMap ? "secondary" : "outline"}
            className="w-full gap-2"
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
          >
            <Target className="size-4" />
            {showMap ? "Hide body map" : "Search by muscle"}
          </Button>
          {showMap && (
            <>
              <MuscleMapPicker
                value={mapKey ? [mapKey] : []}
                onToggle={(key) => {
                  setMapKey((cur) => (cur === key ? null : key));
                  setGroup(""); // a specific muscle supersedes the coarse group
                }}
                gender={gender}
              />
              {mapKey && (
                <p className="text-center text-xs text-muted-foreground">
                  Showing {TARGET_BY_KEY.get(mapKey)?.label} exercises
                </p>
              )}
            </>
          )}
        </div>
      )}

      <ToggleGroup
        type="single"
        value={group}
        onValueChange={(v) => {
          setGroup((v as MuscleGroup) || "");
          setMapKey(null); // picking a coarse group clears the specific-muscle filter
        }}
        variant="outline"
        className={`flex flex-wrap justify-start gap-2 ${hideGroupFilter ? "hidden" : ""}`}
      >
        {MUSCLE_GROUPS.map((g) => (
          <ToggleGroupItem key={g} value={g} className={chipClass}>
            {g}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-center gap-2">
        <Select value={equipment || "all"} onValueChange={(v) => setEquipment(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full" aria-label="Filter by equipment">
            <SelectValue placeholder="Any equipment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any equipment</SelectItem>
            {equipmentOptions.map((eq) => (
              <SelectItem key={eq} value={eq} className="capitalize">
                {eq}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {results.length} exercise{results.length === 1 ? "" : "s"}
        {results.length > MAX_RESULTS && ` (showing ${MAX_RESULTS} — refine to see more)`}
      </p>

      <ul className="space-y-2">
        {shown.map((ex) => (
          <li key={ex.name}>
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <button
                type="button"
                onClick={() => onPick?.(ex.name)}
                disabled={!onPick}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
              >
                <p className="break-words font-medium">{ex.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ex.primaryMuscles.slice(0, 3).map((m) => (
                    <Badge key={m} variant="secondary" className="capitalize">
                      {m}
                    </Badge>
                  ))}
                  {ex.equipment && (
                    <Badge variant="outline" className="capitalize">
                      {ex.equipment}
                    </Badge>
                  )}
                </div>
              </button>
              {onInfo && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`How to do ${ex.name}`}
                  onClick={() => onInfo(ex.name)}
                >
                  <Info className="size-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">
            No exercises match your filters.
          </li>
        )}
      </ul>
    </div>
  );
}
