"use client";

import * as React from "react";
import {
  Camera,
  Flashlight,
  ImageUp,
  Keyboard,
  Loader2,
  RefreshCw,
  ScanBarcode,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidGtin, normalizeBarcode } from "@/lib/nutrition/barcodes";

type ScannerStatus = "starting" | "scanning" | "found" | "error";

function cameraErrorMessage(reason: unknown): string {
  const name = reason instanceof DOMException ? reason.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow it in your browser settings, or use a saved image or code.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable rear camera was found on this device.";
  }
  return "The camera could not be started. You can retry, choose an image, or enter the code.";
}

async function createFoodBarcodeReader() {
  const { BarcodeFormat, BrowserMultiFormatOneDReader } = await import(
    "@zxing/browser"
  );
  const { DecodeHintType } = await import("@zxing/library");
  const formats = [
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ];
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatOneDReader(hints, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 1_000,
  });
}

export function BarcodeScannerPanel({
  active,
  lookupLoading,
  lookupError,
  onDetected,
}: {
  active: boolean;
  lookupLoading: boolean;
  lookupError: string | null;
  onDetected: (barcode: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<import("@zxing/browser").IScannerControls | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const onDetectedRef = React.useRef(onDetected);
  const handledRef = React.useRef(false);
  const [attempt, setAttempt] = React.useState(0);
  const [status, setStatus] = React.useState<ScannerStatus>("starting");
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [flashAvailable, setFlashAvailable] = React.useState(false);
  const [flashOn, setFlashOn] = React.useState(false);
  const [manualCode, setManualCode] = React.useState("");

  React.useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const acceptCode = React.useCallback((rawValue: string) => {
    const barcode = normalizeBarcode(rawValue);
    if (!isValidGtin(barcode)) {
      setScanError("That doesn't look like a valid EAN or UPC barcode.");
      return false;
    }
    if (handledRef.current) return true;
    handledRef.current = true;
    setStatus("found");
    setScanError(null);
    controlsRef.current?.stop();
    onDetectedRef.current(barcode);
    return true;
  }, []);

  React.useEffect(() => {
    if (!active) return;
    let disposed = false;
    let controls: import("@zxing/browser").IScannerControls | null = null;

    handledRef.current = false;
    setStatus("starting");
    setCameraError(null);
    setScanError(null);
    setFlashAvailable(false);
    setFlashOn(false);

    const start = async () => {
      try {
        const reader = await createFoodBarcodeReader();
        if (disposed || !videoRef.current) return;
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              advanced: [
                { focusMode: "continuous" } as MediaTrackConstraintSet,
              ],
            },
            audio: false,
          },
          videoRef.current,
          (result) => {
            if (result) acceptCode(result.getText());
          }
        );
        if (disposed) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setFlashAvailable(typeof controls.switchTorch === "function");
        setStatus("scanning");
      } catch (reason) {
        if (!disposed) {
          setStatus("error");
          setCameraError(cameraErrorMessage(reason));
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      controlsRef.current = null;
      controls?.stop();
    };
  }, [acceptCode, active, attempt]);

  const toggleFlash = async () => {
    const controls = controlsRef.current;
    if (!controls?.switchTorch) return;
    try {
      const next = !flashOn;
      await controls.switchTorch(next);
      setFlashOn(next);
    } catch {
      setFlashAvailable(false);
      setFlashOn(false);
    }
  };

  const scanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanError(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const reader = await createFoodBarcodeReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      acceptCode(result.getText());
    } catch {
      setScanError("No readable EAN or UPC barcode was found in that image.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const submitManualCode = (event: React.FormEvent) => {
    event.preventDefault();
    acceptCode(manualCode);
  };

  return (
    <div className="grid gap-3 landscape:grid-cols-[minmax(0,1.45fr)_minmax(15rem,1fr)] landscape:items-start">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-zinc-950 sm:aspect-video">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview for scanning a food barcode"
          className="absolute inset-0 size-full object-contain"
          style={{ objectFit: "contain" }}
        />
        <div className="pointer-events-none absolute inset-x-[3%] top-1/2 h-[35%] -translate-y-1/2 rounded-xl border-2 border-white/90 bg-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]">
          <span className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-red-400/90 shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
        </div>

        {(status === "starting" || status === "error" || lookupLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 p-6 text-center text-white">
            {status === "starting" || lookupLoading ? (
              <>
                <Loader2 className="size-7 animate-spin" />
                <p className="text-sm">
                  {lookupLoading ? "Looking up product…" : "Starting camera…"}
                </p>
              </>
            ) : (
              <>
                <Camera className="size-8" />
                <p className="text-sm">{cameraError}</p>
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

        {status === "scanning" && !lookupLoading && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-black/65 px-3 py-2 text-center text-xs text-white backdrop-blur-sm">
            <ScanBarcode className="mr-1 inline size-4" />
            Keep the full barcode visible; the frame is only a guide
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          The full camera frame stays visible in portrait and landscape. Keep the entire barcode inside the preview; the guide is optional.
        </p>

        {(scanError || lookupError) && (
          <p className="text-center text-sm text-destructive" role="status">
            {scanError ?? lookupError}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {flashAvailable && (
            <Button type="button" variant="outline" onClick={() => void toggleFlash()}>
              <Flashlight className="size-4" />
              {flashOn ? "Turn flash off" : "Turn flash on"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={flashAvailable ? "" : "sm:col-span-2"}
            onClick={() => fileInputRef.current?.click()}
            disabled={lookupLoading}
          >
            <ImageUp className="size-4" />
            Scan saved image
          </Button>
        </div>

        <form className="flex gap-2" onSubmit={submitManualCode}>
          <div className="relative min-w-0 flex-1">
            <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              className="pl-9 tabular-nums"
              placeholder="Enter barcode number"
              inputMode="numeric"
              autoComplete="off"
              disabled={lookupLoading}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={lookupLoading}>
            Look up
          </Button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={scanImage}
        />
      </div>
    </div>
  );
}
