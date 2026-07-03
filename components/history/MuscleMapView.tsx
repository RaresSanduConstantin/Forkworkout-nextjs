"use client";

import * as React from "react";

import type { MuscleMapWidget } from "@abdofallah/musclemap-js";
import type { MuscleHighlight } from "@/lib/muscle-map";

/**
 * Renders the MuscleMapJS front + back body maps with red highlights whose
 * opacity encodes training intensity (primary muscles solid, secondary pale,
 * ramping with volume). Instantiated client-side on canvas; cleaned up on
 * unmount.
 */
export function MuscleMapView({
  highlights,
  gender = "male",
}: {
  highlights: MuscleHighlight[];
  gender?: "male" | "female";
}) {
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const frontMap = React.useRef<MuscleMapWidget | null>(null);
  const backMap = React.useRef<MuscleMapWidget | null>(null);
  const highlightsRef = React.useRef(highlights);
  highlightsRef.current = highlights;

  React.useEffect(() => {
    let mounted = true;
    let cleanup = () => {};
    import("@abdofallah/musclemap-js").then(({ MuscleMapWidget: Widget }) => {
      if (!mounted || !frontRef.current || !backRef.current) return;
      frontMap.current = new Widget(frontRef.current, {
        side: "front",
        gender,
        interactive: false,
        multiSelect: false,
      });
      backMap.current = new Widget(backRef.current, {
        side: "back",
        gender,
        interactive: false,
        multiSelect: false,
      });
      frontMap.current.setHighlightData(highlightsRef.current);
      backMap.current.setHighlightData(highlightsRef.current);
      cleanup = () => {
        frontMap.current?.destroy();
        backMap.current?.destroy();
        frontMap.current = null;
        backMap.current = null;
      };
    });
    return () => {
      mounted = false;
      cleanup();
    };
  }, [gender]);

  // Re-shade when highlights change (e.g. a set is completed live).
  React.useEffect(() => {
    frontMap.current?.setHighlightData(highlights);
    backMap.current?.setHighlightData(highlights);
  }, [highlights]);

  return (
    <div className="flex items-end justify-center gap-4">
      <figure className="flex flex-col items-center gap-1">
        <div ref={frontRef} className="h-56 w-28" />
        <figcaption className="text-xs text-muted-foreground">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div ref={backRef} className="h-56 w-28" />
        <figcaption className="text-xs text-muted-foreground">Back</figcaption>
      </figure>
    </div>
  );
}
