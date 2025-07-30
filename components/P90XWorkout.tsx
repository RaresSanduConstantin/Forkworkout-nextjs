"use client";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { honkFont } from "@/lib/honkFont";
import { useRouter } from "next/navigation";

interface P90XWorkoutProps {
  workoutName?: string;
}

const P90XWorkout: React.FC<P90XWorkoutProps> = ({ workoutName = "P90X" }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"phase1" | "phase2" | "phase3" | "videos">("phase1");

  const handleFinish = () => {
    const date = new Date().toISOString();

    const completed = {
      workoutId: "1",
      workoutName: workoutName,
      date,
    };

    const prev = localStorage.getItem("completedWorkouts");
    const data = prev ? JSON.parse(prev) : [];

    data.push(completed);
    localStorage.setItem("completedWorkouts", JSON.stringify(data));

    router.push("/");
  };

  const workoutExercises = [
    {
      key: "1",
      name: "Chest and Back",
      videoUrl: "https://drive.google.com/file/d/1oq-3-kDNLwYNXP26SCWVQhe2Gz6vmgCz/view?usp=sharing",
    },
    {
      key: "2",
      name: "Plyometrics",
      videoUrl: "https://drive.google.com/file/d/1S-ZRjxO9d9Heu-V686f9jXt--NnfBCly/view?usp=sharing",
    },
    {
      key: "3",
      name: "Shoulders and Arms",
      videoUrl: "https://drive.google.com/file/d/11gm5yEcIVfo2EJpzaVDUdSYaHDakfTOt/view?usp=sharing",
    },
    {
      key: "4",
      name: "Yoga X",
      videoUrl: "https://drive.google.com/file/d/1ztrHX-i2k4rQDu-ShYFZbSBn1iKdxG6c/view?usp=sharing",
    },
    {
      key: "5",
      name: "Legs and Back",
      videoUrl: "https://drive.google.com/file/d/1A30ZC6gghBSENauJkgx5F-_N3bhvlakn/view?usp=sharing",
    },
    {
      key: "6",
      name: "Kenpo X",
      videoUrl: "https://drive.google.com/file/d/1VX3H0zFsQDGyeV9JetIQH5hmA84zorTJ/view?usp=sharing",
    },
    {
      key: "7",
      name: "Core Synergistics",
      videoUrl: "https://drive.google.com/file/d/1tiDE4eeuatiRyLleb5aegeVvDlGZngE8/view?usp=sharing",
    },
    {
      key: "8",
      name: "X Stretch",
      videoUrl: "https://drive.google.com/file/d/1iridqEvh_lgHrkUvgvrwhphqlUoBIP_8/view?usp=sharing",
    },
    {
      key: "9",
      name: "Chest, Shoulders, and Triceps",
      videoUrl: "https://drive.google.com/file/d/1sMQMmw1dVP1CFI5WqdogdGa15xJg10vM/view?usp=sharing",
    },
    {
      key: "10",
      name: "Back and Biceps",
      videoUrl: "https://drive.google.com/file/d/11aoFEDClPmvjjVb6D0demCy7WSnHlZOf/view?usp=sharing",
    },
    {
      key: "11",
      name: "Cardio X",
      videoUrl: "https://drive.google.com/file/d/1bI002fGDXzps7JQAopmK6IPVjHd7ezND/view?usp=sharing",
    },
    {
      key: "12",
      name: "Ab Ripper X",
      videoUrl: "https://drive.google.com/file/d/1xykiAfHSoBIPHHiCcPSPfTTUNUF4Lnxv/view?usp=sharing",
    },
  ];

  const getEmbedUrl = (shareUrl: string) => {
    const fileId = shareUrl.match(/\/d\/(.*?)\/view/)?.[1];
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : shareUrl;
  };

  const phases = {
    phase1: {
      name: "Phase 1 - Foundation",
      schedule: [
        { day: 1, workouts: ["chest-back", "ab-ripper"], label: "Chest & Back + Ab Ripper X" },
        { day: 2, workouts: ["plyometrics"], label: "Plyometrics" },
        { day: 3, workouts: ["shoulders-arms", "ab-ripper"], label: "Shoulders & Arms + Ab Ripper X" },
        { day: 4, workouts: ["yoga"], label: "Yoga X" },
        { day: 5, workouts: ["legs-back", "ab-ripper"], label: "Legs & Back + Ab Ripper X" },
        { day: 6, workouts: ["kenpo"], label: "Kenpo X" },
        { day: 7, workouts: ["stretch"], label: "Rest or X Stretch" },
      ]
    },
    phase2: {
      name: "Phase 2 - Strength",
      schedule: [
        { day: 1, workouts: ["chest-shoulders-triceps", "ab-ripper"], label: "Chest, Shoulders & Triceps + Ab Ripper X" },
        { day: 2, workouts: ["plyometrics"], label: "Plyometrics" },
        { day: 3, workouts: ["back-biceps", "ab-ripper"], label: "Back & Biceps + Ab Ripper X" },
        { day: 4, workouts: ["yoga"], label: "Yoga X" },
        { day: 5, workouts: ["legs-back", "ab-ripper"], label: "Legs & Back + Ab Ripper X" },
        { day: 6, workouts: ["kenpo"], label: "Kenpo X" },
        { day: 7, workouts: ["stretch"], label: "Rest or X Stretch" },
      ]
    },
    phase3: {
      name: "Phase 3 - Peak",
      schedule: [
        { day: 1, workouts: ["chest-shoulders-triceps", "ab-ripper"], label: "Chest, Shoulders & Triceps + Ab Ripper X" },
        { day: 2, workouts: ["plyometrics"], label: "Plyometrics" },
        { day: 3, workouts: ["back-biceps", "ab-ripper"], label: "Back & Biceps + Ab Ripper X" },
        { day: 4, workouts: ["yoga"], label: "Yoga X" },
        { day: 5, workouts: ["legs-back", "ab-ripper"], label: "Legs & Back + Ab Ripper X" },
        { day: 6, workouts: ["kenpo"], label: "Kenpo X" },
        { day: 7, workouts: ["stretch"], label: "Rest or X Stretch" },
      ]
    }
  };

  const TabButton = ({ 
    tabKey, 
    children, 
    isActive 
  }: { 
    tabKey: typeof activeTab, 
    children: React.ReactNode, 
    isActive: boolean 
  }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive 
          ? "bg-red-600 text-white shadow-md" 
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );

  const renderPhaseTable = (phase: typeof phases.phase1) => (
    <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
      <h2 className="text-2xl font-bold text-red-800 mb-4 text-center">
        {phase.name}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-red-600 text-white">
              <th className="border border-red-400 p-2 text-left">Day</th>
              <th className="border border-red-400 p-2 text-left">Workout</th>
            </tr>
          </thead>
          <tbody>
            {phase.schedule.map((dayWorkout, index) => (
              <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-red-100"}>
                <td className="border border-red-300 p-2 font-semibold">
                  {dayWorkout.day}
                </td>
                <td className="border border-red-300 p-2">
                  {dayWorkout.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderVideos = () => (
    <div className="space-y-4">
      {workoutExercises.map((exercise) => (
        <div
          key={exercise.key}
          className="bg-slate-100 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg break-all">{exercise.name}</h2>
          </div>

          <div className="w-full h-96 bg-gray-200 rounded-md overflow-hidden">
            <iframe
              src={getEmbedUrl(exercise.videoUrl)}
              width="100%"
              height="100%"
              allow="autoplay;"
              className="border-0"
              title={exercise.name}
              allowFullScreen={true}
            ></iframe>
          </div>
          
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <Button
        type="button"
        className="top-5 right-5 z-50 rounded-full shadow-lg px-5 py-3"
        variant="ghost"
      >
        <Link href="/">
          <span>← Go Back</span>
        </Link>
      </Button>
      
      <h1 className="text-4xl font-bold text-center break-all text-red-600">
        {honkFont(workoutName)}
      </h1>

      {/* Custom Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex space-x-2 bg-gray-50 p-2 rounded-lg">
          <TabButton tabKey="phase1" isActive={activeTab === "phase1"}>
            Phase 1
          </TabButton>
          <TabButton tabKey="phase2" isActive={activeTab === "phase2"}>
            Phase 2
          </TabButton>
          <TabButton tabKey="phase3" isActive={activeTab === "phase3"}>
            Phase 3
          </TabButton>

        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "phase1" && renderPhaseTable(phases.phase1)}
        {activeTab === "phase2" && renderPhaseTable(phases.phase2)}
        {activeTab === "phase3" && renderPhaseTable(phases.phase3)}
      
      </div>
      {renderVideos()}

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Button
          variant="default"
          onClick={handleFinish}
          className="bg-red-600 hover:bg-red-700"
        >
          Finish Workout
        </Button>
      </div>
    </div>
  );
};

export default P90XWorkout;