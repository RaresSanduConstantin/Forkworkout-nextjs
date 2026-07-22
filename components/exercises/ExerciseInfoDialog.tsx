"use client";

import * as React from "react";
import Image from "next/image";
import { Dumbbell, ExternalLink, ListChecks, PlayCircle, Target } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import {
  loadExerciseLibrary,
  getCachedLibrary,
  type LibraryExercise,
} from "@/lib/exercises";
import { getExerciseVideoId } from "@/lib/exercise-videos";

const formatNameForUrl = (name: string) =>
  name.replace(/[\/\s]+/g, "_").replace(/^_+|_+$/g, "");

const getImageUrls = (name: string) => {
  const formatted = formatNameForUrl(name);
  return [
    `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formatted}/images/0.jpg`,
    `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formatted}/images/1.jpg`,
  ];
};

/**
 * "How to do it" dialog for an exercise: images, level/equipment, muscles, and
 * step-by-step instructions. Looks the exercise up in the shared JSON library
 * by name. Reused by the workout builder and the live session.
 */
export function ExerciseInfoDialog({
  exerciseName,
  open,
  onOpenChange,
}: {
  exerciseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [tab, setTab] = React.useState("how-to");

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) setLibrary(lib);
    });
    return () => {
      active = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (open) setTab("how-to");
  }, [open, exerciseName]);

  const details = React.useMemo(
    () =>
      library.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase()) ?? null,
    [library, exerciseName]
  );
  const videoId = getExerciseVideoId(exerciseName);
  const openSearch = (url: string) =>
    window.open(url, "_blank", "noopener,noreferrer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b p-6 pb-4 text-left">
          <DialogTitle className="text-xl">{exerciseName || "Exercise"}</DialogTitle>
        <DialogDescription>Instructions, muscles worked, images, and video guidance.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="min-h-0 flex-1 gap-0 overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 grid w-auto shrink-0 grid-cols-2">
            <TabsTrigger value="how-to">
              <ListChecks className="size-4" /> How to
            </TabsTrigger>
            <TabsTrigger value="video">
              <PlayCircle className="size-4" /> Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="how-to" className="min-h-0 overflow-y-auto p-6">
            {details ? (
              <div className="space-y-5">
              {(!details.custom || details.sourceName) && (
                <Carousel className="w-full">
                  <CarouselContent>
                    {getImageUrls(exerciseName).map((imageUrl, index) => (
                      <CarouselItem key={index}>
                        <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={imageUrl}
                            alt={`${exerciseName} demonstration ${index + 1}`}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        </AspectRatio>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </Carousel>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="capitalize">{details.level}</Badge>
                <Badge variant="secondary" className="capitalize">{details.category}</Badge>
                <Badge variant="secondary" className="gap-1 capitalize">
                  <Dumbbell className="size-3" />
                  {details.equipment || "No equipment"}
                </Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <Target className="size-4 text-primary" /> Primary muscles
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {details.primaryMuscles.map((m) => (
                      <Badge key={m} className="capitalize">{m}</Badge>
                    ))}
                  </div>
                </div>

                {details.secondaryMuscles.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                      <Target className="size-4 text-muted-foreground" /> Secondary muscles
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {details.secondaryMuscles.map((m) => (
                        <Badge key={m} variant="outline" className="capitalize">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <ListChecks className="size-4 text-primary" /> Instructions
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {details.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Dumbbell className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {exerciseName
                    ? "No detailed information available for this exercise."
                    : "Pick an exercise to see how to do it."}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="min-h-0 overflow-y-auto p-6">
            {tab === "video" && videoId ? (
              <div className="space-y-3">
                <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe
                    key={`${videoId}-${open}`}
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                    title={`${exerciseName} demonstration video`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() =>
                    openSearch(
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${exerciseName} exercise form`
                      )}`
                    )
                  }
                >
                  Search more on YouTube
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            ) : tab === "video" ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-4 text-center">
                  <PlayCircle className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No saved demo yet. Search for form guidance in a new tab.
                  </p>
                </div>
                <Button
                  className="w-full justify-between bg-red-600 text-white hover:bg-red-700"
                  onClick={() =>
                    openSearch(
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${exerciseName} exercise form #shorts`
                      )}`
                    )
                  }
                >
                  YouTube videos
                  <ExternalLink className="size-4" />
                </Button>
                <Button
                  className="w-full justify-between bg-neutral-900 text-white hover:bg-neutral-800"
                  onClick={() =>
                    openSearch(
                      `https://www.tiktok.com/search?q=${encodeURIComponent(
                        `${exerciseName} exercise form`
                      )}`
                    )
                  }
                >
                  TikTok videos
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t p-4">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
