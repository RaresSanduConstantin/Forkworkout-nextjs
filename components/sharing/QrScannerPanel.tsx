"use client";

import * as React from "react";
import {
  Camera,
  Flashlight,
  ImageUp,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ScannerStatus = "starting" | "scanning" | "found" | "error";

function cameraErrorMessage(reason: unknown): string {
  const name = reason instanceof DOMException ? reason.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow camera access in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera was found on this device.";
  }
  return "The camera could not be started. You can retry or choose a saved QR image.";
}

export function QrScannerPanel({
  active,
  onDetected,
}: {
  active: boolean;
  onDetected: (value: string) => boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const scannerRef = React.useRef<import("qr-scanner").default | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const onDetectedRef = React.useRef(onDetected);
  const [attempt, setAttempt] = React.useState(0);
  const [status, setStatus] = React.useState<ScannerStatus>("starting");
  const [error, setError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [flashAvailable, setFlashAvailable] = React.useState(false);
  const [flashOn, setFlashOn] = React.useState(false);

  React.useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  React.useEffect(() => {
    if (!active) return;
    let disposed = false;
    let scanner: import("qr-scanner").default | null = null;

    setStatus("starting");
    setError(null);
    setScanError(null);
    setFlashAvailable(false);
    setFlashOn(false);

    const start = async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (disposed || !videoRef.current) return;
        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (onDetectedRef.current(result.data)) {
              setStatus("found");
              setScanError(null);
              scanner?.stop();
            } else {
              setScanError("That QR code is not a ForkWorkout workout or program.");
            }
          },
          {
            preferredCamera: "environment",
            maxScansPerSecond: 8,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            onDecodeError: (reason) => {
              if (reason !== QrScanner.NO_QR_CODE_FOUND) {
                setScanError("The QR code could not be read. Hold the phone steady and try again.");
              }
            },
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (disposed) {
          scanner.destroy();
          return;
        }
        setStatus("scanning");
        const hasFlash = await scanner.hasFlash().catch(() => false);
        if (!disposed) setFlashAvailable(hasFlash);
      } catch (reason) {
        if (!disposed) {
          setStatus("error");
          setError(cameraErrorMessage(reason));
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      scannerRef.current = null;
      scanner?.destroy();
    };
  }, [active, attempt]);

  const toggleFlash = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.toggleFlash();
      setFlashOn(scanner.isFlashOn());
    } catch {
      setFlashAvailable(false);
    }
  };

  const scanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanError(null);
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
        alsoTryWithoutScanRegion: true,
      });
      if (!onDetectedRef.current(result.data)) {
        setScanError("That image does not contain a ForkWorkout QR code.");
      }
    } catch {
      setScanError("No readable QR code was found in that image.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-zinc-950">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview for scanning a ForkWorkout QR code"
          className="size-full object-cover"
        />
        {status !== "scanning" && status !== "found" && (
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
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-black/65 px-3 py-2 text-center text-xs text-white backdrop-blur-sm">
            <ScanLine className="mr-1 inline size-4" />
            Point the camera at a ForkWorkout QR code
          </div>
        )}
      </div>

      {(scanError || status === "found") && (
        <p
          className={`text-center text-sm ${status === "found" ? "text-primary" : "text-destructive"}`}
          role="status"
        >
          {status === "found" ? "Workout found. Opening…" : scanError}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {flashAvailable && (
          <Button type="button" variant="outline" onClick={toggleFlash}>
            <Flashlight className="size-4" />
            {flashOn ? "Turn flash off" : "Turn flash on"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className={flashAvailable ? "" : "sm:col-span-2"}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageUp className="size-4" />
          Scan saved image
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={scanImage}
      />
    </div>
  );
}
