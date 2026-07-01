"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Flag, PlayCircle } from "lucide-react";

import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { BottomActionBar } from "@/components/layout/BottomActionBar";
import { honkFont } from "@/lib/honkFont";
import { addCompletedWorkout } from "@/lib/storage/history-storage";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";

interface P90XWorkoutProps {
  workoutName?: string;
}

type PhaseKey = "phase1" | "phase2" | "phase3" | "recoveryWeek";

type Exercise = { name: string; videoUrl: string };

const EXERCISES: Record<string, Exercise> = {
  "1": { name: "Chest and Back", videoUrl: "https://drive.google.com/file/d/1oq-3-kDNLwYNXP26SCWVQhe2Gz6vmgCz/view?usp=sharing" },
  "2": { name: "Plyometrics", videoUrl: "https://drive.google.com/file/d/1S-ZRjxO9d9Heu-V686f9jXt--NnfBCly/view?usp=sharing" },
  "3": { name: "Shoulders and Arms", videoUrl: "https://drive.google.com/file/d/11gm5yEcIVfo2EJpzaVDUdSYaHDakfTOt/view?usp=sharing" },
  "4": { name: "Yoga X", videoUrl: "https://drive.google.com/file/d/1ztrHX-i2k4rQDu-ShYFZbSBn1iKdxG6c/view?usp=sharing" },
  "5": { name: "Legs and Back", videoUrl: "https://drive.google.com/file/d/1A30ZC6gghBSENauJkgx5F-_N3bhvlakn/view?usp=sharing" },
  "6": { name: "Kenpo X", videoUrl: "https://drive.google.com/file/d/1VX3H0zFsQDGyeV9JetIQH5hmA84zorTJ/view?usp=sharing" },
  "7": { name: "Core Synergistics", videoUrl: "https://drive.google.com/file/d/1tiDE4eeuatiRyLleb5aegeVvDlGZngE8/view?usp=sharing" },
  "8": { name: "X Stretch", videoUrl: "https://drive.google.com/file/d/1iridqEvh_lgHrkUvgvrwhphqlUoBIP_8/view?usp=sharing" },
  "9": { name: "Chest, Shoulders, and Triceps", videoUrl: "https://drive.google.com/file/d/1sMQMmw1dVP1CFI5WqdogdGa15xJg10vM/view?usp=sharing" },
  "10": { name: "Back and Biceps", videoUrl: "https://drive.google.com/file/d/11aoFEDClPmvjjVb6D0demCy7WSnHlZOf/view?usp=sharing" },
  "11": { name: "Cardio X", videoUrl: "https://drive.google.com/file/d/1bI002fGDXzps7JQAopmK6IPVjHd7ezND/view?usp=sharing" },
  "12": { name: "Ab Ripper X", videoUrl: "https://drive.google.com/file/d/1xykiAfHSoBIPHHiCcPSPfTTUNUF4Lnxv/view?usp=sharing" },
};

type Day = { day: number; label: string; videos: string[]; rest?: boolean };

const PHASES: Record<PhaseKey, { name: string; schedule: Day[] }> = {
  phase1: {
    name: "Phase 1 · Foundation",
    schedule: [
      { day: 1, label: "Chest & Back + Ab Ripper X", videos: ["1", "12"] },
      { day: 2, label: "Plyometrics", videos: ["2"] },
      { day: 3, label: "Shoulders & Arms + Ab Ripper X", videos: ["3", "12"] },
      { day: 4, label: "Yoga X", videos: ["4"] },
      { day: 5, label: "Legs & Back + Ab Ripper X", videos: ["5", "12"] },
      { day: 6, label: "Kenpo X", videos: ["6"] },
      { day: 7, label: "Rest or X Stretch", videos: ["8"], rest: true },
    ],
  },
  phase2: {
    name: "Phase 2 · Strength",
    schedule: [
      { day: 1, label: "Chest, Shoulders & Triceps + Ab Ripper X", videos: ["9", "12"] },
      { day: 2, label: "Plyometrics", videos: ["2"] },
      { day: 3, label: "Back & Biceps + Ab Ripper X", videos: ["10", "12"] },
      { day: 4, label: "Yoga X", videos: ["4"] },
      { day: 5, label: "Legs & Back + Ab Ripper X", videos: ["5", "12"] },
      { day: 6, label: "Kenpo X", videos: ["6"] },
      { day: 7, label: "Rest or X Stretch", videos: ["8"], rest: true },
    ],
  },
  phase3: {
    name: "Phase 3 · Peak",
    schedule: [
      { day: 1, label: "Chest, Shoulders & Triceps + Ab Ripper X", videos: ["9", "12"] },
      { day: 2, label: "Plyometrics", videos: ["2"] },
      { day: 3, label: "Back & Biceps + Ab Ripper X", videos: ["10", "12"] },
      { day: 4, label: "Yoga X", videos: ["4"] },
      { day: 5, label: "Legs & Back + Ab Ripper X", videos: ["5", "12"] },
      { day: 6, label: "Kenpo X", videos: ["6"] },
      { day: 7, label: "Rest or X Stretch", videos: ["8"], rest: true },
    ],
  },
  recoveryWeek: {
    name: "Recovery Week",
    schedule: [
      { day: 1, label: "Yoga X", videos: ["4"] },
      { day: 2, label: "Core Synergistics", videos: ["7"] },
      { day: 3, label: "Kenpo X", videos: ["6"] },
      { day: 4, label: "X Stretch", videos: ["8"] },
      { day: 5, label: "Cardio X", videos: ["11"] },
      { day: 6, label: "Yoga X", videos: ["4"] },
      { day: 7, label: "Rest Day or X Stretch", videos: ["8"], rest: true },
    ],
  },
};

const getEmbedUrl = (shareUrl: string) => {
  const fileId = shareUrl.match(/\/d\/([^/]+)/)?.[1];
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : shareUrl;
};

function VideoBlock({ exerciseKey }: { exerciseKey: string }) {
  const ex = EXERCISES[exerciseKey];
  if (!ex) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{ex.name}</h4>
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md bg-muted">
        <iframe
          src={getEmbedUrl(ex.videoUrl)}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          title={ex.name}
          loading="lazy"
          allowFullScreen
        />
      </AspectRatio>
      <a
        href={ex.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Open in Google Drive <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

const P90XWorkout: React.FC<P90XWorkoutProps> = ({ workoutName = "P90X" }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PhaseKey>("phase1");

  const handleFinish = () => {
    addCompletedWorkout({ workoutId: "1", title: workoutName });
    toast.success("Workout complete! 🎉");
    router.push(ROUTES.dashboard);
  };

  const renderPhase = (phaseKey: PhaseKey) => {
    const phase = PHASES[phaseKey];
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{phase.name}</h2>
        <p className="text-sm text-muted-foreground">
          Tap any day to watch its workout videos.
        </p>
        <Accordion type="single" collapsible className="w-full">
          {phase.schedule.map((d) => (
            <AccordionItem key={d.day} value={`${phaseKey}-day-${d.day}`}>
              <AccordionTrigger className="gap-3 hover:no-underline">
                <span className="flex flex-1 items-center gap-3 text-left">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-sm font-bold text-white">
                    {d.day}
                  </span>
                  <span className="text-sm font-medium">{d.label}</span>
                  {d.rest ? (
                    <Badge variant="secondary" className="ml-auto">
                      Rest
                    </Badge>
                  ) : (
                    <PlayCircle className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-1">
                {d.videos.map((key) => (
                  <VideoBlock key={key} exerciseKey={key} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  };

  return (
    <PageContainer hasBottomBar>
      <Button asChild variant="ghost" size="sm" className="mb-2 gap-1 px-2">
        <Link href={ROUTES.dashboard}>
          <ArrowLeft className="size-4" />
          Go Back
        </Link>
      </Button>

      <PageHeader
        title={honkFont(workoutName)}
        description="The classic 90-day program — pick a phase, then tap a day to watch."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PhaseKey)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="phase1">Phase 1</TabsTrigger>
          <TabsTrigger value="phase2">Phase 2</TabsTrigger>
          <TabsTrigger value="phase3">Phase 3</TabsTrigger>
          <TabsTrigger value="recoveryWeek">Recovery</TabsTrigger>
        </TabsList>
        <TabsContent value="phase1" className="mt-4">{renderPhase("phase1")}</TabsContent>
        <TabsContent value="phase2" className="mt-4">{renderPhase("phase2")}</TabsContent>
        <TabsContent value="phase3" className="mt-4">{renderPhase("phase3")}</TabsContent>
        <TabsContent value="recoveryWeek" className="mt-4">{renderPhase("recoveryWeek")}</TabsContent>
      </Tabs>

      <BottomActionBar>
        <Button variant="outline" className="flex-1" onClick={() => router.push(ROUTES.dashboard)}>
          Cancel
        </Button>
        <Button className="flex-1 gap-2" onClick={handleFinish}>
          <Flag className="size-4" />
          Finish Workout
        </Button>
      </BottomActionBar>
    </PageContainer>
  );
};

export default P90XWorkout;
