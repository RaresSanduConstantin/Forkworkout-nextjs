"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  return {
    hour: match?.[1] ?? "",
    minute: match?.[2] ?? "",
    second: match?.[3] ?? "00",
  };
}

/** A compact 24-hour picker composed from the app's shadcn Select primitive. */
function TimePicker({
  value,
  onValueChange,
  disabled,
  className,
  "aria-labelledby": ariaLabelledBy,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-labelledby"?: string;
}) {
  const { hour, minute, second } = parseTime(value);

  const update = (nextHour: string, nextMinute: string) => {
    onValueChange(`${nextHour || "00"}:${nextMinute || "00"}:${second}`);
  };

  return (
    <div
      data-slot="time-picker"
      role="group"
      aria-labelledby={ariaLabelledBy}
      className={cn("flex min-w-0 items-center gap-1.5", className)}
    >
      <Select
        value={hour || undefined}
        onValueChange={(nextHour) => update(nextHour, minute)}
        disabled={disabled}
      >
        <SelectTrigger className="min-w-0 flex-1 tabular-nums" aria-label="Hour">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-64 min-w-[var(--radix-select-trigger-width)]">
          {HOURS.map((option) => (
            <SelectItem key={option} value={option} className="tabular-nums">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden="true" className="font-medium text-muted-foreground">
        :
      </span>

      <Select
        value={minute || undefined}
        onValueChange={(nextMinute) => update(hour, nextMinute)}
        disabled={disabled}
      >
        <SelectTrigger className="min-w-0 flex-1 tabular-nums" aria-label="Minute">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent
          align="end"
          className="max-h-64 min-w-[var(--radix-select-trigger-width)]"
        >
          {MINUTES.map((option) => (
            <SelectItem key={option} value={option} className="tabular-nums">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { TimePicker };
