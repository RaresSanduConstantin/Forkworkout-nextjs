"use client";

import * as React from "react";
import { Camera, Flashlight, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type CameraStatus = "starting" | "ready" | "capturing" | "error";

function cameraErrorMessage(reason: unknown): string {
  const name = reason instanceof DOMException ? reason.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow it in your browser settings, then try again or choose a gallery photo.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable rear camera was found. You can still choose a photo from your gallery.";
  }
  return "The camera could not be started. Try again or choose a photo from your gallery.";
}

export function FoodCameraPanel({
  active,
  disabled,
  onCaptured,
  guidance = "Keep the full meal inside the square.",
  captureShape = "square",
}: {
  active: boolean;
  disabled?: boolean;
  onCaptured: (file: File) => void;
  guidance?: string;
  captureShape?: "square" | "document";
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const trackRef = React.useRef<MediaStreamTrack | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [status, setStatus] = React.useState<CameraStatus>("starting");
  const [error, setError] = React.useState<string | null>(null);
  const [flashAvailable, setFlashAvailable] = React.useState(false);
  const [flashOn, setFlashOn] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    let disposed = false;
    const videoElement = videoRef.current;

    setStatus("starting");
    setError(null);
    setFlashAvailable(false);
    setFlashOn(false);

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera capture is not supported by this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (disposed || !videoElement) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        try {
          if (track?.getCapabilities) {
            const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
              torch?: boolean;
            };
            setFlashAvailable(Boolean(capabilities.torch));
          }
        } catch {
          setFlashAvailable(false);
        }
        videoElement.srcObject = stream;
        await videoElement.play();
        if (!disposed) setStatus("ready");
      } catch (reason) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        trackRef.current = null;
        if (videoElement) videoElement.srcObject = null;
        if (!disposed) {
          setStatus("error");
          setError(cameraErrorMessage(reason));
          setFlashAvailable(false);
          setFlashOn(false);
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      trackRef.current = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, [active, attempt]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || status !== "ready" || !video.videoWidth || !video.videoHeight) return;
    setStatus("capturing");
    try {
      const sourceWidth =
        captureShape === "document"
          ? video.videoWidth
          : Math.min(video.videoWidth, video.videoHeight);
      const sourceHeight =
        captureShape === "document"
          ? video.videoHeight
          : Math.min(video.videoWidth, video.videoHeight);
      const sourceX = (video.videoWidth - sourceWidth) / 2;
      const sourceY = (video.videoHeight - sourceHeight) / 2;
      const scale = Math.min(1, 1_600 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo capture is not supported by this browser.");
      context.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("The photo could not be captured.");
      onCaptured(new File([blob], `food-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be captured.");
      setStatus("ready");
    }
  };

  const toggleFlash = async () => {
    const track = trackRef.current;
    if (!track || !flashAvailable) return;
    try {
      const next = !flashOn;
      await track.applyConstraints({
        advanced: [
          { torch: next } as MediaTrackConstraintSet & { torch: boolean },
        ],
      });
      setFlashOn(next);
    } catch {
      setFlashAvailable(false);
      setFlashOn(false);
      setError("The flashlight is not available for this camera.");
    }
  };

  return (
    <div className="space-y-3">
      <div className={captureShape === "document" ? "relative aspect-[3/4] overflow-hidden rounded-2xl border bg-zinc-950" : "relative aspect-square overflow-hidden rounded-2xl border bg-zinc-950"}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview for taking a food photo"
          className={captureShape === "document" ? "size-full object-contain" : "size-full object-cover"}
        />
        <div className="pointer-events-none absolute inset-5 rounded-2xl border border-white/70" />

        {(status === "starting" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 p-6 text-center text-white">
            {status === "starting" ? (
              <>
                <Loader2 className="size-7 animate-spin" />
                <p className="text-sm">Starting camera…</p>
              </>
            ) : (
              <>
                <Camera className="size-8" />
                <p className="text-sm">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RefreshCw className="size-4" />
                  Try camera again
                </Button>
              </>
            )}
          </div>
        )}

      </div>

      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
        {guidance}
      </p>

      {error && status !== "error" && (
        <p className="text-center text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className={flashAvailable ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
        <Button
          type="button"
          size="lg"
          onClick={() => void capture()}
          disabled={disabled || status !== "ready"}
        >
          {status === "capturing" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {status === "capturing" ? "Capturing…" : "Take photo"}
        </Button>
        {flashAvailable && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void toggleFlash()}
            disabled={disabled || status !== "ready"}
          >
            <Flashlight className="size-4" />
            {flashOn ? "Flash off" : "Flash on"}
          </Button>
        )}
      </div>
    </div>
  );
}
