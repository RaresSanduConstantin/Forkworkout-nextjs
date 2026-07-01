"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Dumbbell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import CalendarComponent from "@/components/Calendar";
import { StreakSummary } from "@/components/history/StreakSummary";
import { VolumeChart } from "@/components/history/VolumeChart";
import { HistoryList } from "@/components/history/HistoryList";
import {
  getCompletedWorkouts,
  deleteCompletedWorkout,
} from "@/lib/storage/history-storage";
import { ROUTES } from "@/lib/routes";
import type { CompletedWorkout } from "@/lib/types";

const HistoryComponent = () => {
  const [entries, setEntries] = React.useState<CompletedWorkout[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CompletedWorkout | null>(null);
  // Bumped on mutations to force storage-reading children (calendar, streak) to refresh.
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    setEntries(getCompletedWorkouts());
    setLoaded(true);
  }, []);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCompletedWorkout(pendingDelete.date);
    setEntries(getCompletedWorkouts());
    setVersion((v) => v + 1);
    toast.success("Removed from history");
    setPendingDelete(null);
  };

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="mb-2 gap-1 px-2">
        <Link href={ROUTES.dashboard}>
          <ArrowLeft className="size-4" />
          Go Back
        </Link>
      </Button>

      <PageHeader
        title="History"
        description="Your completed workouts and streak, saved on this device."
      />

      <div className="space-y-8">
        <StreakSummary key={`streak-${version}`} />

        <VolumeChart entries={entries} />

        <CalendarComponent key={`cal-${version}`} />

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Recent activity</h2>
          </div>

          {loaded && entries.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="size-8" />}
              title="No completed workouts yet"
              description="Finish a workout and it will show up here, and your streak will start to grow."
              action={
                <Button asChild>
                  <Link href={ROUTES.dashboard}>Go to your workouts</Link>
                </Button>
              }
            />
          ) : (
            <HistoryList entries={entries} onDelete={setPendingDelete} />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Remove this workout from history?"
        description="This deletes the completed-workout record and updates your streak. It cannot be undone."
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </PageContainer>
  );
};

export default HistoryComponent;
