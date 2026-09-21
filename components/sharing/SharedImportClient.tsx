"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CloudDownload, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveCloudShare } from "@/lib/sharing/client";
import { storeShareHandoff } from "@/lib/sharing/handoff";
import { buildSharedImportUrl } from "@/lib/storage/share-link";
import { ROUTES } from "@/lib/routes";

export function SharedImportClient({ id }: { id: string }) {
  const [attempt, setAttempt] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(null);
      const key = new URLSearchParams(window.location.hash.slice(1)).get("key");
      if (!key) {
        setError("This share link is incomplete because its decryption key is missing.");
        return;
      }
      try {
        const sourceUrl = window.location.href;
        const reference = await resolveCloudShare(id, key);
        if (cancelled) return;
        const handoffId = storeShareHandoff({ reference, sourceUrl });
        const destination =
          reference.kind === "nutrition-meal" ? ROUTES.nutrition : ROUTES.dashboard;
        if (handoffId) {
          window.location.replace(`${destination}?shareHandoff=${handoffId}`);
        } else {
          // SessionStorage can be unavailable in strict privacy modes. The
          // payload stays inside this browser tab, so a legacy fragment is a
          // safe compatibility fallback and is never sent through messaging.
          window.location.replace(buildSharedImportUrl(reference, window.location.origin));
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Cloud sharing is temporarily unavailable."
          );
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt, id]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {error ? (
              <AlertTriangle className="size-6" />
            ) : (
              <CloudDownload className="size-6" />
            )}
          </div>
          <CardTitle>{error ? "Couldn’t open this share" : "Opening shared item"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {error ? (
            <>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" asChild>
                  <Link href={ROUTES.history}>Go to History</Link>
                </Button>
                <Button onClick={() => setAttempt((value) => value + 1)}>
                  <RefreshCw className="size-4" />
                  Try again
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Securely downloading and decrypting…
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
