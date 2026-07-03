"use client";

import * as React from "react";

import type { MuscleGroup } from "@/lib/exercises";

const HEAT = "#f97316"; // orange-500
const heatOpacity = (v: number) => 0.1 + Math.max(0, Math.min(1, v)) * 0.9;

/** Neutral (non-muscle) body parts. */
// Neutral parts use currentColor (svg text is muted-foreground).

function Region({
  group,
  intensity,
  children,
}: {
  group: MuscleGroup;
  intensity: Record<MuscleGroup, number>;
  children: React.ReactElement<React.SVGProps<SVGElement>>;
}) {
  return React.cloneElement(children, {
    fill: HEAT,
    fillOpacity: heatOpacity(intensity[group] ?? 0),
    stroke: "currentColor",
    strokeOpacity: 0.25,
    strokeWidth: 1,
  });
}

function FrontFigure({ intensity }: { intensity: Record<MuscleGroup, number> }) {
  const R = (g: MuscleGroup, el: React.ReactElement<React.SVGProps<SVGElement>>) => (
    <Region group={g} intensity={intensity}>
      {el}
    </Region>
  );
  return (
    <svg viewBox="0 0 100 210" className="h-full w-full text-muted-foreground" role="img" aria-label="Front muscle map">
      {/* head + neck (neutral) */}
      <circle cx={50} cy={16} r={11} fill="currentColor" fillOpacity={0.25} />
      <rect x={45} y={26} width={10} height={6} rx={2} fill="currentColor" fillOpacity={0.25} />
      {/* shoulders */}
      {R("Shoulders", <ellipse cx={29} cy={43} rx={12} ry={9} />)}
      {R("Shoulders", <ellipse cx={71} cy={43} rx={12} ry={9} />)}
      {/* chest */}
      {R("Chest", <rect x={32} y={39} width={36} height={20} rx={5} />)}
      {/* arms */}
      {R("Arms", <rect x={15} y={49} width={11} height={48} rx={5} />)}
      {R("Arms", <rect x={74} y={49} width={11} height={48} rx={5} />)}
      {/* core */}
      {R("Core", <rect x={36} y={60} width={28} height={35} rx={5} />)}
      {/* pelvis (neutral) */}
      <rect x={34} y={96} width={32} height={12} rx={4} fill="currentColor" fillOpacity={0.25} />
      {/* legs */}
      {R("Legs", <rect x={35} y={108} width={13} height={66} rx={6} />)}
      {R("Legs", <rect x={52} y={108} width={13} height={66} rx={6} />)}
      {/* lower legs (legs) */}
      {R("Legs", <rect x={36} y={176} width={11} height={26} rx={5} />)}
      {R("Legs", <rect x={53} y={176} width={11} height={26} rx={5} />)}
    </svg>
  );
}

function BackFigure({ intensity }: { intensity: Record<MuscleGroup, number> }) {
  const R = (g: MuscleGroup, el: React.ReactElement<React.SVGProps<SVGElement>>) => (
    <Region group={g} intensity={intensity}>
      {el}
    </Region>
  );
  return (
    <svg viewBox="0 0 100 210" className="h-full w-full text-muted-foreground" role="img" aria-label="Back muscle map">
      <circle cx={50} cy={16} r={11} fill="currentColor" fillOpacity={0.25} />
      <rect x={45} y={26} width={10} height={6} rx={2} fill="currentColor" fillOpacity={0.25} />
      {/* rear delts */}
      {R("Shoulders", <ellipse cx={29} cy={43} rx={12} ry={9} />)}
      {R("Shoulders", <ellipse cx={71} cy={43} rx={12} ry={9} />)}
      {/* upper + lower back */}
      {R("Back", <rect x={32} y={39} width={36} height={28} rx={5} />)}
      {R("Back", <rect x={38} y={67} width={24} height={22} rx={5} />)}
      {/* triceps */}
      {R("Arms", <rect x={15} y={49} width={11} height={48} rx={5} />)}
      {R("Arms", <rect x={74} y={49} width={11} height={48} rx={5} />)}
      {/* glutes + hamstrings (legs) */}
      {R("Legs", <rect x={34} y={90} width={32} height={16} rx={6} />)}
      {R("Legs", <rect x={35} y={107} width={13} height={67} rx={6} />)}
      {R("Legs", <rect x={52} y={107} width={13} height={67} rx={6} />)}
      {/* calves */}
      {R("Legs", <rect x={36} y={176} width={11} height={26} rx={5} />)}
      {R("Legs", <rect x={53} y={176} width={11} height={26} rx={5} />)}
    </svg>
  );
}

/** Stylized front/back body silhouette shaded by training intensity per group. */
export function BodyHeatmap({ intensity }: { intensity: Record<MuscleGroup, number> }) {
  return (
    <div className="flex items-end justify-center gap-6">
      <figure className="flex flex-col items-center gap-1">
        <div className="h-52 w-24">
          <FrontFigure intensity={intensity} />
        </div>
        <figcaption className="text-xs text-muted-foreground">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div className="h-52 w-24">
          <BackFigure intensity={intensity} />
        </div>
        <figcaption className="text-xs text-muted-foreground">Back</figcaption>
      </figure>
    </div>
  );
}
