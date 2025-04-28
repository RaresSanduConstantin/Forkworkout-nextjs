"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { honkFont } from "@/lib/honkFont";
import { useParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Image from "next/image";
import ClockImage from "@/public/clock.png";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import Link from "next/link";

const restStartSound = new Audio("/sounds/rest-start.mp3");
const restEndSound = new Audio("/sounds/rest-end.mp3");

type RepStatus = "pending" | "done" | "skipped";

type SetWithStatus = {
  reps: number;
  value: string;
  status: RepStatus;
};

type ExerciseSession = {
  name: string;
  sets: SetWithStatus[];
};

type WorkoutSession = {
  id: string;
  title: string;
  exercises: ExerciseSession[];
};

const StartWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);

  const [resting, setResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!resting) return;

    if (countdown === 0) {
      restEndSound.play();
      setResting(false);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, resting]);

  useEffect(() => {
    const stored = localStorage.getItem("workouts");
    if (stored) {
      const workouts = JSON.parse(stored);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = workouts.find((w: any) => w.id === workoutId);
      if (found) {
        console.log("found.restasdasdasdasda", found);
        setRestSeconds(found.rest);
        const session: WorkoutSession = {
          ...found,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exercises: found.exercises.map((ex: any) => ({
            ...ex,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sets: ex.sets.map((s: any) => ({ ...s, status: "pending" })),
          })),
        };
        setWorkout(session);
      }
    }
  }, [workoutId]);

  const markSet = (exIdx: number, setIdx: number, status: RepStatus) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].sets[setIdx].status = status;
    setWorkout(updated);
  };

  const handleFinish = () => {
    const date = new Date().toISOString();

    const completed = {
      workoutId: workout?.id,
      title: workout?.title,
      date,
    };

    const prev = localStorage.getItem("completedWorkouts");
    const data = prev ? JSON.parse(prev) : [];

    data.push(completed);
    localStorage.setItem("completedWorkouts", JSON.stringify(data));

    router.push("/"); // Back to home after finish
  };

  if (!workout) {
    return <div className="p-6 text-center">Loading workout...</div>;
  }

  const handleSuccess = (exIdx: number, setIdx: number) => {
    markSet(exIdx, setIdx, "done");
    const restValue = restSeconds;

    if (!restValue) {
      setRestSeconds(0);
      setCountdown(0);
      setResting(false);
      return;
    } else {
      const seconds =
        typeof restValue === "string" ? parseInt(restValue) : restValue;

      setRestSeconds(seconds);
      setCountdown(seconds);
      setResting(true);

      restStartSound.play();
      return;
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <Button
        type="button"
        className=" top-5 right-5 z-50 rounded-full  shadow-lg px-5 py-3"
        variant="ghost"
      >
        <Link href="/">
          <span>← Go Back</span>
        </Link>
      </Button>
      <h1 className="text-4xl font-bold text-center break-all">
        {honkFont(workout.title)}
      </h1>

      {workout.exercises.map((exercise, exIdx) => (
        <div key={exIdx} className="bg-slate-100 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg break-all">{exercise.name}</h2>
            <Link
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                exercise.name + " exercise #shorts"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:text-red-800"
            >
              <Image src="/youtube.png" alt="YouTube" width={24} height={24}/>
            </Link>
          </div>
          {exercise.sets.map((set, setIdx) => {
            const status = set.status;

            const doneStyles =
              "bg-gradient-to-r from-green-400 via-green-300 to-lime-300 shadow-lg animate-popbeat";
            const skippedStyles = "bg-gray-300 text-gray-600 animate-pulse";
            const pendingStyles = "bg-white";

            const containerClasses = `
                      flex items-center justify-between p-3 rounded-lg
                      ${
                        status === "done"
                          ? doneStyles
                          : status === "skipped"
                          ? skippedStyles
                          : pendingStyles
                      }
                    `;

            return (
              <div key={setIdx} className={containerClasses}>
                <Button
                  variant="outline"
                  onClick={() => markSet(exIdx, setIdx, "skipped")}
                  className="text-red-600 text-xl"
                >
                  ❌
                </Button>
                <span>
                  {set.reps} reps – {set.value}
                </span>
                <div className="flex gap-2"></div>

                <Button
                  variant="outline"
                  onClick={() => handleSuccess(exIdx, setIdx)}
                  className="text-green-600 text-xl"
                >
                  ✅
                </Button>
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          //   className="bg-gray-300 px-4 py-2 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          onClick={handleFinish}
          //   className="bg-green-500 text-white px-4 py-2 rounded-lg"
        >
          Finish Workout
        </Button>
      </div>

      <Dialog open={resting} onOpenChange={(open) => setResting(open)}>
        <DialogContent className="text-center space-y-4">
          <DialogDescription aria-describedby="rest-time" />
          <DialogTitle aria-description="Modal" className="text-2xl font-bold">
            {honkFont("Rest Time")}
          </DialogTitle>
          <Image src={ClockImage} alt="Rest Clock" className="w-28 mx-auto" />

          <div className="text-4xl font-mono text-blue-600">{countdown}s</div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StartWorkoutComponent;
