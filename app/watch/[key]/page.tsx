"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { P90X_EXERCISES, getEmbedUrl } from "@/lib/p90x";

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const key = params.key as string;
  const ex = P90X_EXERCISES[key];
  const containerRef = React.useRef<HTMLDivElement>(null);

  const enterFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      const orientation = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
        | undefined;
      if (orientation?.lock) {
        try {
          await orientation.lock("landscape");
        } catch {
          /* orientation lock unsupported (e.g. iOS Safari) — ignore */
        }
      }
    } catch {
      /* fullscreen request denied — ignore */
    }
  };

  if (!ex) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
        <p>Video not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-2 text-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-1 text-white hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium">
          {ex.name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={enterFullscreen}
          className="gap-1 text-white hover:bg-white/10 hover:text-white"
        >
          <Maximize className="size-4" />
          Fullscreen
        </Button>
      </div>

      {/* Player fills the rest of the viewport */}
      <div ref={containerRef} className="relative flex-1 bg-black">
        {ex.videoSrc ? (
          <video
            src={ex.videoSrc}
            controls
            autoPlay
            playsInline
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <iframe
            src={getEmbedUrl(ex.videoUrl)}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen"
            title={ex.name}
            allowFullScreen
          />
        )}
      </div>

      {/* Footer hint + Drive fallback */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-xs text-white/70">
          Rotate your phone or tap Fullscreen for a bigger view.
        </p>
        {!ex.videoSrc && (
          <a
            href={ex.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-white/80 hover:text-white"
          >
            Open in Google Drive <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </main>
  );
}
