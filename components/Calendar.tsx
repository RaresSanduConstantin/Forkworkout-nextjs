"use client";

import React from "react";
import { Calendar } from "./ui/calendar";
import { honkFont } from "@/lib/honkFont";

const CalendarComponent = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

//   const handleDisable = (date: Date) => {
//     const today = new Date();
//     return date < today;
//     };


    const [markedDates, setMarkedDates] = React.useState<Date[]>([]);

React.useEffect(() => {
  const stored = localStorage.getItem("completedWorkouts");
  if (stored) {
    const parsed = JSON.parse(stored);

    const dates: Date[] = parsed.map((entry: { date: string }) =>
      new Date(entry.date)
    );

    setMarkedDates(dates);
  }
}, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 bg-slate-50 mt-3">
      <h1 className={`text-3xl text-center`}>{honkFont("Your streak calendar")}</h1>
      <Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-md border"
//   disabled={handleDisable}
  weekStartsOn={1}
  modifiers={{ completed: markedDates }}
  modifiersClassNames={{ completed: "bg-gradient-to-r from-pink-400 via-yellow-300 to-orange-400 text-black font-bold animate-popbeat" }}
/>
    </div>
  );
};

export default CalendarComponent;
