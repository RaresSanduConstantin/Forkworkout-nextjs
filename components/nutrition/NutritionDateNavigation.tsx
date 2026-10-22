"use client";

import * as React from "react";
import { format, isToday } from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { dayKeyToDate, toDayKey, weekDayKeys } from "@/lib/date/day-key";
import { cn } from "@/lib/utils";

export function NutritionDateNavigation({ dayKey, loggedDayKeys, onDayChange }: {
  dayKey: string;
  loggedDayKeys: Set<string>;
  onDayChange: (dayKey: string) => void;
}) {
  const selectedDate = dayKeyToDate(dayKey);
  const [month, setMonth] = React.useState(selectedDate);
  React.useEffect(() => setMonth(dayKeyToDate(dayKey)), [dayKey]);
  const moveDay = (delta: number) => {
    const next = dayKeyToDate(dayKey);
    next.setDate(next.getDate() + delta);
    onDayChange(toDayKey(next));
  };

  return (
    <div className="mb-4 rounded-xl border bg-card p-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className="size-11" onClick={() => moveDay(-1)} aria-label="Previous day">
          <ChevronLeft className="size-5" />
        </Button>
        <button type="button" className="min-h-11 min-w-0 rounded-md px-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onDayChange(toDayKey())} aria-label="Return to today">
          <span className="block truncate text-sm font-semibold">{isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}</span>
          <span className="block text-xs text-muted-foreground">{format(selectedDate, "MMMM d, yyyy")}</span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="size-11" onClick={() => moveDay(1)} aria-label="Next day">
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 border-t px-1 pt-2" aria-label="Nutrition logs for this week">
        {weekDayKeys(selectedDate).map((key) => {
          const date = dayKeyToDate(key);
          const hasLogs = loggedDayKeys.has(key);
          const isSelected = key === dayKey;
          return (
            <button key={key} type="button" className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isSelected && "bg-muted")} onClick={() => onDayChange(key)} aria-label={`${format(date, "EEEE, MMMM d")}: ${hasLogs ? "food logged" : "no food logged"}`} aria-current={isSelected ? "date" : undefined}>
              <span className={cn("font-medium text-muted-foreground", isSelected && "text-foreground")} aria-hidden="true">{format(date, "EEEEE")}</span>
              <span className={cn("flex size-7 items-center justify-center rounded-full border-2", hasLogs ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/35 text-muted-foreground", isSelected && "ring-2 ring-primary/30 ring-offset-2 ring-offset-card")} aria-hidden="true">{hasLogs ? <Check className="size-4" strokeWidth={3} /> : null}</span>
            </button>
          );
        })}
      </div>
      <Accordion type="single" collapsible className="mt-2 border-t">
        <AccordionItem value="calendar" className="border-0">
          <AccordionTrigger className="min-h-11 px-2 py-2 text-sm hover:no-underline"><span className="flex items-center gap-2"><CalendarDays className="size-4" /> Browse calendar</span></AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col items-center gap-3 pt-2">
              <Calendar
                mode="single"
                required
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={(date) => onDayChange(toDayKey(date))}
                weekStartsOn={1}
                className="w-full max-w-sm rounded-xl border [--cell-size:clamp(2rem,10vw,2.75rem)]"
                modifiers={{ logged: (date) => loggedDayKeys.has(toDayKey(date)) }}
                modifiersClassNames={{ logged: "rounded-md bg-emerald-500/15 font-semibold text-emerald-800 dark:text-emerald-200 [&_button]:font-semibold [&_button]:underline [&_button]:decoration-emerald-500 [&_button]:decoration-2 [&_button]:underline-offset-4" }}
                labels={{ labelDayButton: (date, modifiers) => `${format(date, "EEEE, MMMM d, yyyy")}${modifiers.selected ? ", selected" : ""}: ${loggedDayKeys.has(toDayKey(date)) ? "food logged" : "no food logged"}` }}
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-3 rounded-sm bg-emerald-500/30" /> Food logged · Choose a day to view its tracking.</p>
              {!isToday(selectedDate) && <Button type="button" variant="outline" onClick={() => onDayChange(toDayKey())}>Back to today</Button>}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
