"use client";
import P90XWorkout from "@/components/P90XWorkout";
import StartWorkoutComponent from "@/components/StartWorkoutComponent";
import { useParams } from "next/navigation";

export default function StartWorkout() {
  // check if id is 1 then show P90X workout otherwise show default workout
  const params = useParams();
  const { id } = params;
  
  if( id === "1") {
    return <P90XWorkout />
  } else {
    return <StartWorkoutComponent />
  }
}