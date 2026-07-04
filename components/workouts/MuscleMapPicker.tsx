"use client";

import * as React from "react";

import type { Muscle, MuscleMapWidget } from "@abdofallah/musclemap-js";
import type { MuscleTargetKey } from "@/lib/exercises";
import { HEAT_COLOR, TARGET_TO_SDK, SDK_TO_TARGET } from "@/lib/muscle-map";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SELECTED_OPACITY = 0.85;

/**
 * Interactive body map for picking individual target muscles. Shows one large
 * body at a time (Front/Back toggle) so muscles are big, thumb-friendly tap
 * targets. Tapping a muscle toggles just that muscle (e.g. triceps, not the
 * whole arm), rendered as a red overlay we fully control. Stays in sync with the
 * muscle chips via the shared `value`; sub-muscle taps resolve to their parent.
 */
export function MuscleMapPicker({
  value,
  onToggle,
  gender = "male",
}: {
  value: MuscleTargetKey[];
  onToggle: (key: MuscleTargetKey) => void;
  gender?: "male" | "female";
}) {
  const [side, setSide] = React.useState<"front" | "back">("front");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MuscleMapWidget | null>(null);
  const ready = React.useRef(false);

  // Always call the latest handler / read latest value without rebinding.
  const toggleRef = React.useRef(onToggle);
  toggleRef.current = onToggle;
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // When true, the next `value`-effect repaint is skipped because a map tap
  // already painted synchronously (avoids a redundant full canvas redraw).
  const paintedByTap = React.useRef(false);

  const applyHighlights = React.useCallback((keys: MuscleTargetKey[]) => {
    const data = keys.flatMap((k) =>
      TARGET_TO_SDK[k].map((muscle) => ({ muscle, color: HEAT_COLOR, opacity: SELECTED_OPACITY }))
    );
    mapRef.current?.setHighlightData(data);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let cleanup = () => {};
    import("@abdofallah/musclemap-js").then(({ MuscleMapWidget: Widget, getParentGroup }) => {
      if (!mounted || !containerRef.current) return;
      const handleClick = (muscle: Muscle) => {
        const base = getParentGroup(muscle) ?? muscle;
        const key = SDK_TO_TARGET[base];
        // The SDK paints its own selection from `selectedMuscles`, which the
        // renderer draws OVER our highlight — so clear it every tap.
        if (mapRef.current?.getSelectedMuscles().length) mapRef.current.clearSelection();
        if (!key) return;
        const cur = valueRef.current;
        const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
        // Paint immediately for snappy feedback, and skip the value-effect's
        // duplicate repaint that the state update below will trigger.
        paintedByTap.current = true;
        applyHighlights(next);
        toggleRef.current(key);
      };
      mapRef.current = new Widget(containerRef.current, {
        side,
        gender,
        interactive: true,
        multiSelect: true,
        onMuscleClick: handleClick,
      });
      ready.current = true;
      applyHighlights(valueRef.current);
      cleanup = () => {
        mapRef.current?.destroy();
        mapRef.current = null;
        ready.current = false;
      };
    });
    return () => {
      mounted = false;
      cleanup();
    };
    // gender/side re-create the widget; handlers read latest state via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, side]);

  // Re-paint when the selection changes from the chips (map taps paint eagerly).
  React.useEffect(() => {
    if (paintedByTap.current) {
      paintedByTap.current = false;
      return;
    }
    if (ready.current) applyHighlights(value);
  }, [value, applyHighlights]);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <ToggleGroup
        type="single"
        value={side}
        onValueChange={(v) => v && setSide(v as "front" | "back")}
        variant="outline"
        className="flex justify-center gap-2"
      >
        <ToggleGroupItem
          value="front"
          className="!flex-none !rounded-md !border-l px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          Front
        </ToggleGroupItem>
        <ToggleGroupItem
          value="back"
          className="!flex-none !rounded-md !border-l px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          Back
        </ToggleGroupItem>
      </ToggleGroup>
      <div ref={containerRef} className="mx-auto aspect-[1/2] w-full max-w-[240px] cursor-pointer" />
      <p className="text-center text-xs text-muted-foreground">
        Tap muscles to target them{value.length > 0 ? ` · ${value.length} selected` : ""}
      </p>
    </div>
  );
}
