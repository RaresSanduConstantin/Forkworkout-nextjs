"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ReorderItem = { id: string; title: string };

function SortableRow({ item, index }: { item: ReorderItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex min-h-12 cursor-grab touch-none select-none items-center gap-2 rounded-lg border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
      aria-label={`Drag ${item.title} to reorder`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="w-5 shrink-0 text-center text-sm text-muted-foreground">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
    </li>
  );
}

export function SortableItemList({
  items,
  onMove,
}: {
  items: ReorderItem[];
  onMove: (from: number, to: number) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from !== -1 && to !== -1) onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {items.map((item, index) => (
            <SortableRow key={item.id} item={item} index={index} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/**
 * Drag-and-drop modal to reorder a list of items (exercise titles). Calls
 * `onMove(from, to)` for each reorder so the parent can apply it live.
 */
export function ReorderExercisesDialog({
  open,
  onOpenChange,
  items,
  onMove,
  title = "Reorder exercises",
  description = "Press and drag any row to change the order.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReorderItem[];
  onMove: (from: number, to: number) => void;
  title?: string;
  description?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          <SortableItemList items={items} onMove={onMove} />
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
