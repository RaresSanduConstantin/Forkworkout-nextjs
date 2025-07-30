"use client";
import React from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { honkFont } from "@/lib/honkFont";
import { useRouter } from "next/navigation";

interface P90XWorkoutProps {
  workoutName?: string;
}

const P90XWorkout: React.FC<P90XWorkoutProps> = ({ workoutName = "P90X" }) => {
  const router = useRouter();
  const handleFinish = () => {
    const date = new Date().toISOString();

    const completed = {
      workoutId: "1", // Assuming P90X has a fixed ID of 1
      workoutName: workoutName,
      date,
    };

    const prev = localStorage.getItem("completedWorkouts");
    const data = prev ? JSON.parse(prev) : [];

    data.push(completed);
    localStorage.setItem("completedWorkouts", JSON.stringify(data));

    router.push("/"); // Back to home after finish
  };

  const workoutExercises = [
    {
      key: "1",
      name: "Chest and Back",
      videoUrl:
        "https://drive.google.com/file/d/1oq-3-kDNLwYNXP26SCWVQhe2Gz6vmgCz/view?usp=sharing",
    },
    {
      key: "2",
      name: "Plyometrics",
      videoUrl:
        "https://drive.google.com/file/d/1S-ZRjxO9d9Heu-V686f9jXt--NnfBCly/view?usp=sharing",
    },
    {
      key: "3",
      name: "Shoulders and Arms",
      videoUrl:
        "https://drive.google.com/file/d/11gm5yEcIVfo2EJpzaVDUdSYaHDakfTOt/view?usp=sharing",
    },
    {
      key: "4",
      name: "Yoga X",
      videoUrl:
        "https://drive.google.com/file/d/1ztrHX-i2k4rQDu-ShYFZbSBn1iKdxG6c/view?usp=sharing",
    },
    {
      key: "5",
      name: "Legs and Back",
      videoUrl:
        "https://drive.google.com/file/d/1A30ZC6gghBSENauJkgx5F-_N3bhvlakn/view?usp=sharing",
    },
    {
      key: "6",
      name: "Kenpo X",
      videoUrl:
        "https://drive.google.com/file/d/1VX3H0zFsQDGyeV9JetIQH5hmA84zorTJ/view?usp=sharing",
    },
    {
      key: "7",
      name: "Core Synergistics",
      videoUrl:
        "https://drive.google.com/file/d/1tiDE4eeuatiRyLleb5aegeVvDlGZngE8/view?usp=sharing",
    },
    {
      key: "8",
      name: "X Stretch",
      videoUrl:
        "https://drive.google.com/file/d/1iridqEvh_lgHrkUvgvrwhphqlUoBIP_8/view?usp=sharing",
    },
    {
      key: "9",
      name: "Chest, Shoulders, and Triceps",
      videoUrl:
        "https://drive.google.com/file/d/1sMQMmw1dVP1CFI5WqdogdGa15xJg10vM/view?usp=sharing",
    },
    {
      key: "10",
      name: "Back and Biceps",
      videoUrl:
        "https://drive.google.com/file/d/11aoFEDClPmvjjVb6D0demCy7WSnHlZOf/view?usp=sharing",
    },
    {
      key: "11",
      name: "Cardio X",
      videoUrl:
        "https://drive.google.com/file/d/1bI002fGDXzps7JQAopmK6IPVjHd7ezND/view?usp=sharing",
    },
    {
      key: "12",
      name: "Ab Ripper X",
      videoUrl:
        "https://drive.google.com/file/d/1xykiAfHSoBIPHHiCcPSPfTTUNUF4Lnxv/view?usp=sharing",
    },
  ];

  // Convert Google Drive share URL to embed URL
  const getEmbedUrl = (shareUrl: string) => {
    const fileId = shareUrl.match(/\/d\/(.*?)\/view/)?.[1];
    return fileId
      ? `https://drive.google.com/file/d/${fileId}/preview`
      : shareUrl;
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
        {honkFont(workoutName)}
      </h1>

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
    </div>
  );
};

export default P90XWorkout;
