"use client";

import * as React from "react";
import { Download, Share } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// The install prompt event isn't in the standard lib types yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install app" button that adapts to the platform:
 * - Android / desktop Chromium: captures `beforeinstallprompt` and triggers the
 *   native install dialog on click.
 * - iOS Safari (no install API): points the user to the manual Add to Home
 *   Screen steps.
 * - Already installed / unsupported: hides itself (the written steps remain).
 */
export function InstallButton() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(nav.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="text-sm font-medium text-primary">
        ✓ Installed — open ForkWorkout from your home screen.
      </p>
    );
  }

  if (deferred) {
    return (
      <Button
        size="lg"
        className="gap-2"
        onClick={async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") toast.success("Installing ForkWorkout…");
          setDeferred(null);
        }}
      >
        <Download className="size-4" />
        Install app
      </Button>
    );
  }

  if (isIOS) {
    return (
      <Button
        size="lg"
        variant="outline"
        className="gap-2"
        onClick={() =>
          toast.info("Tap the Share button, then choose “Add to Home Screen”.")
        }
      >
        <Share className="size-4" />
        Add to Home Screen
      </Button>
    );
  }

  return null;
}
