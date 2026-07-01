"use client";

import React from "react";
import { Calendar } from "./ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { getCompletedDayKeys } from "@/lib/storage/history-storage";
import { dayKeyToDate } from "@/lib/date/day-key";

const CalendarComponent = () => {
  const [month, setMonth] = React.useState<Date>(new Date());
  const [markedDates, setMarkedDates] = React.useState<Date[]>([]);

  React.useEffect(() => {
    // Use stable local day keys so completed workouts land on the correct
    // calendar day regardless of timezone.
    setMarkedDates(getCompletedDayKeys().map(dayKeyToDate));
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-4">
        <div className="w-full">
          <h2 className="text-xl font-semibold">Streak calendar</h2>
          <p className="text-sm text-muted-foreground">
            Every day you finish a workout lights up.
          </p>
        </div>

        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          weekStartsOn={1}
          showOutsideDays
          className="rounded-xl border p-3"
          modifiers={{ completed: markedDates }}
          modifiersClassNames={{
            completed:
              "rounded-md bg-gradient-to-br from-pink-500 to-orange-500 font-semibold text-white hover:opacity-90 aria-selected:opacity-100",
          }}
        />

        <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
          <span className="size-3 rounded-sm bg-gradient-to-br from-pink-500 to-orange-500" />
          Completed workout
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarComponent;
