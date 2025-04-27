"use client"

import React, { useEffect, useState } from "react";
import { honkFont } from "@/lib/honkFont";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Dialog, DialogOverlay, DialogTitle, DialogContent, DialogDescription } from "@radix-ui/react-dialog";

type Workout = {
  id: string;
  title: string;
};

const WorkoutList = () => {
    const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("workouts");


    if (stored) {
      setWorkouts(JSON.parse(stored));
    }
  }, []);

  const handleEdit = (id: string) => {
    // logic to edit workout
    const workout = workouts.find((workout) => workout.id === id);
    if (workout) {
        router.push(`/create-workout/${id}`);
        }
    
  };

  const handleStart = (id: string) => {
    // logic to start workout
    console.log("Start workout", id);
    router.push(`/start-workout/${id}`);
  };

  const handleDeleteDialog = () => {
    setOpen(true);
  };


  const handleDelete = (id: string) => {
    const updatedWorkouts = workouts.filter((workout) => workout.id !== id);
    setWorkouts(updatedWorkouts);
    localStorage.setItem("workouts", JSON.stringify(updatedWorkouts));
    };
  return (
    <div className="flex flex-col items-center justify-center gap-5 bg-slate-50 mt-3 p-4 w-full max-w-xl mx-auto shadow">
      <h1 className="text-3xl">{honkFont("Your Workouts")}</h1>
      
      {workouts.length === 0 ? (
        <p className="text-gray-500">No workouts yet.</p>
      ) : (
        <ul className="w-full flex flex-col gap-4">
          {workouts.map((workout) => (
            <li
              key={workout.id}
              className="flex justify-between items-center p-2 bg-white rounded-lg shadow-md"
            >
                              <Button
                variant="outline"
                onClick={() => handleDeleteDialog()}
                className="text-red-600 text-sm"
              >
                ❌
              </Button>

              <span className="font-medium text-lg break-all">{workout.title}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleEdit(workout.id)}>
                  Edit
                </Button>
                <Button onClick={() => handleStart(workout.id)}>Start</Button>
              </div>
                    
      <Dialog
        open={open}
        onOpenChange={setOpen}
        
      >
        <DialogOverlay className="fixed inset-0 bg-black opacity-30" />
        <DialogContent className="bg-white rounded-lg p-6 shadow-lg fixed inset-0 m-auto max-w-md max-h-1/4">
          <DialogTitle className="text-lg font-semibold">
            Are you sure you want to delete this workout?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-gray-500">
            This action cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDelete(workout.id); // Pass the workout ID to delete
                setOpen(false);
              }}
            >
              Delete
            </Button>   
            </div>

        </DialogContent>
    </Dialog>
            </li>
            
          ))}
          
        </ul>
      )}

      {/* DIalog for delete workout */}


    </div>
  );
};

export default WorkoutList;
