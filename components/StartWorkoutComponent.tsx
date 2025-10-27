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
import { Info } from 'lucide-react'
import { ExerciseCombobox } from "./ExerciseCombobox";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// const restStartSound = new Audio("/sounds/rest-start.mp3");
// const restEndSound = new Audio("/sounds/rest-end.mp3");

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

// Type for exercise details from JSON
type ExerciseDetails = {
  name: string;
  force: string;
  level: string;
  mechanic: string | null;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
};


const StartWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);

  const [resting, setResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [countdown, setCountdown] = useState(30);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>("");

    // New state for info modal
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [exerciseDetails, setExerciseDetails] = useState<ExerciseDetails | null>(null);
    const [exercises, setExercises] = useState<ExerciseDetails[]>([]);

      // Load exercises on component mount
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const response = await fetch('/json/exercises.json');
        const data = await response.json();
        setExercises(data.exercises || []);
      } catch (error) {
        console.error('Failed to load exercises:', error);
      }
    };

    loadExercises();
  }, []);
  

  const openVideoModal = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setShowVideoModal(true);
  };

  const openInfoModal = (exerciseName: string) => {
    const exercise = exercises.find(ex => 
      ex.name.toLowerCase() === exerciseName.toLowerCase()
    );
    setExerciseDetails(exercise || null);
    setSelectedExercise(exerciseName);
    setShowInfoModal(true);
  };

  // Helper function to format exercise name for image URL
  const formatExerciseNameForUrl = (name: string) => {
    return name.replace(/[\/\s]+/g, '_').replace(/^_+|_+$/g, '');
  };

  // Helper function to get image URLs
  const getExerciseImageUrls = (exerciseName: string) => {
    const formattedName = formatExerciseNameForUrl(exerciseName);
    return [
      `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formattedName}/images/0.jpg`,
      `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formattedName}/images/1.jpg`
    ];
  };

  useEffect(() => {
    if (!resting) return;

    if (countdown === 0) {
      // restEndSound.play();
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

  const updateSetReps = (exIdx: number, setIdx: number, reps: number) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].sets[setIdx].reps = reps;
    setWorkout(updated);
  };

  const updateSetValue = (exIdx: number, setIdx: number, value: string) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].sets[setIdx].value = value;
    setWorkout(updated);
  };

  const addExercise = () => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises.push({
      name: `New Exercise ${updated.exercises.length + 1}`,
      sets: [{ reps: 1, value: "", status: "pending" }],
    });
    setWorkout(updated);
  };

  const addSet = (exIdx: number) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].sets.push({
      reps: 1,
      value: "",
      status: "pending",
    });
    setWorkout(updated);
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].sets.splice(setIdx, 1);
    setWorkout(updated);
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    if (!workout) return;
    const updated = { ...workout };
    updated.exercises[exIdx].name = name;
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

    // Save updated workout back to localStorage
    const stored = localStorage.getItem("workouts");
    if (stored) {
      const workouts = JSON.parse(stored);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workoutIndex = workouts.findIndex((w: any) => w.id === workoutId);
      if (workoutIndex !== -1) {
        workouts[workoutIndex] = {
          ...workouts[workoutIndex],
          exercises: workout?.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((set) => ({
              reps: set.reps,
              value: set.value,
            })),
          })),
        };
        localStorage.setItem("workouts", JSON.stringify(workouts));
      }
    }

    router.push("/"); // Back to home after finish
  };

  if (!workout) {
    // go back to home if no workout found
    
    return <div className="p-6 text-center h-full flex flex-col items-center justify-center mt-20 gap-5">

      <h1 className="text-2xl font-semibold">{honkFont("No Workout Foundationd")}</h1>
      <p className="mt-4 text-gray-600">Please go back and select a workout to start.</p>
      <Button
        variant="default"
        onClick={() => router.push("/")}
        className="mt-6"
      >
        Go Back Home
      </Button>
    </div>;
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

      // restStartSound.play();
      return;
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-6 relative">
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
          <ExerciseCombobox
                value={exercise.name}
                onChange={(value) => updateExerciseName(exIdx, value)}
                placeholder="Search for an exercise..."
              />
          </div>
          <div className="flex items-center justify-end space-x-2">

          <button
              onClick={() => openInfoModal(exercise.name)}
              className=" hover:text-gray-800"
            >
              <Info className="h-5 w-5" />
            </button>

            <button
              onClick={() => openVideoModal(exercise.name)}
              className="text-red-600 hover:text-red-800"
            >
              <Image src="/youtube.png" alt="YouTube" width={24} height={24} />
            </button>
          </div>
          {exercise.sets.map((set, setIdx) => {
            const status = set.status;

            const doneStyles =
              "bg-lime-500 shadow-lg";
            const skippedStyles = "bg-red-400 text-gray-600";
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
                  onClick={() => removeSet(exIdx, setIdx)}
                  className="text-red-600 text-xs bg-accent"
                >
                  ❌
                </Button>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) =>
                      updateSetReps(
                        exIdx,
                        setIdx,
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-12 p-1 text-center border rounded bg-white"
                    min="0"
                  />
                  <span className="text-sm">reps –</span>
                  <input
                    type="text"
                    value={set.value}
                    onChange={(e) =>
                      updateSetValue(exIdx, setIdx, e.target.value)
                    }
                    className="w-16 p-1 text-center border rounded bg-white"
                    placeholder="kg"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => handleSuccess(exIdx, setIdx)}
                  className="text-green-600 text-xs bg-accent"
                >
                  ✅
                </Button>
              </div>
            );
          })}

          {/* Add Set Button */}
          <Button
            variant="outline"
            onClick={() => addSet(exIdx)}
            className="w-full text-blue-600 border-dashed"
          >
            ➕ Add Set
          </Button>
        </div>
      ))}

        {/* Exercise Info Modal */}
        <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-xl font-bold mb-4">
            {selectedExercise}
          </DialogTitle>
          <div className="space-y-4">
            {exerciseDetails ? (
              <>
                {/* Exercise Images */}
                <div className="w-full">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {getExerciseImageUrls(selectedExercise).map((imageUrl, index) => (
                        <CarouselItem key={index}>
                          <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
                            <Image
                              src={imageUrl}
                              alt={`${selectedExercise} demonstration ${index + 1}`}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                // Show placeholder text when image fails to load
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="flex items-center justify-center h-full text-gray-500">
                                      <span>Image ${index + 1} not available</span>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </Carousel>
                </div>

                {/* Exercise Details */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {exerciseDetails.level}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {exerciseDetails.category}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                      {exerciseDetails.equipment || "No equipment"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm">Primary Muscles:</h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {exerciseDetails.primaryMuscles.join(", ")}
                    </p>
                  </div>

                  {exerciseDetails.secondaryMuscles.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm">Secondary Muscles:</h4>
                      <p className="text-sm text-gray-600 capitalize">
                        {exerciseDetails.secondaryMuscles.join(", ")}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-sm">Instructions:</h4>
                    <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                      {exerciseDetails.instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-600">No detailed information available for this exercise.</p>
            )}

            <Button onClick={() => setShowInfoModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-bold mb-4">
            {selectedExercise} Videos
          </DialogTitle>
          <div className="space-y-4">
            <p className="text-gray-600">
              Find exercise reel and demonstrations
            </p>
            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/results?search_query=${encodeURIComponent(
                      selectedExercise + " exercise form #shorts"
                    )}`,
                    "_blank"
                  )
                }
                className="w-full"
              >
                🎥 Search YouTube Reel
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://www.tiktok.com/search?q=${encodeURIComponent(
                      selectedExercise + " exercise form"
                    )}`,
                    "_blank"
                  )
                }
                className="w-full bg-gray-600 text-white hover:bg-gray-800"
              >
                🎵 TikTok Videos
              </Button>
            </div>
            <Button onClick={() => setShowVideoModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end mt-6">
            {/* Add Exercise Button - Fixed Position */}
            <Button
        type="button"
        className="  rounded-full bg-orange-400 text-white shadow-lg px-5 py-2"
        onClick={addExercise}
      >
        ➕ Add Exercise
      </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Button variant="default" onClick={handleFinish}>
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
