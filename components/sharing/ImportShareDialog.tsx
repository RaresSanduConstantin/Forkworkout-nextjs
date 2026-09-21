"use client";

import * as React from "react";
import { ClipboardPaste, Download, Link2, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { QrScannerPanel } from "@/components/sharing/QrScannerPanel";
import { getShareImportDestination } from "@/lib/sharing/import-destination";

export function ImportShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = React.useState("link");
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTab("link");
      setValue("");
    }
  }, [open]);

  const openShare = React.useCallback(
    (candidate: string, showError: boolean): boolean => {
      const destination = getShareImportDestination(candidate, window.location.origin);
      if (!destination) {
        if (showError) toast.error("That is not a valid ForkWorkout workout, program, or meal share.");
        return false;
      }
      onOpenChange(false);
      window.location.assign(destination);
      return true;
    },
    [onOpenChange]
  );

  const paste = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!clipboard.trim()) {
        toast.error("Your clipboard is empty.");
        return;
      }
      setValue(clipboard.trim());
    } catch {
      toast.info("Press and hold in the field, then choose Paste.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 max-w-sm flex-col overflow-hidden">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>Import shared item</DialogTitle>
          <DialogDescription>
            Paste a workout, program, or meal link, or scan its QR code. You&apos;ll review everything
            before it is added to this device.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 overflow-hidden">
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="link">
              <Link2 className="size-4" /> Link
            </TabsTrigger>
            <TabsTrigger value="scan">
              <ScanLine className="size-4" /> Scan QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="min-h-0 space-y-3 overflow-y-auto pt-2">
            <Textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://…/s/… or https://…/app#import=…"
              rows={4}
              wrap="soft"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Shared ForkWorkout link"
              className="h-28 min-h-28 min-w-0 max-w-full resize-none break-all [field-sizing:fixed] [overflow-wrap:anywhere]"
            />
            <Button type="button" variant="outline" className="w-full" onClick={paste}>
              <ClipboardPaste className="size-4" />
              Paste from clipboard
            </Button>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!value.trim()}
                onClick={() => openShare(value, true)}
              >
                <Download className="size-4" />
                Continue
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="scan" className="min-h-0 overflow-y-auto pt-2">
            <QrScannerPanel
              active={open && tab === "scan"}
              onDetected={(scannedValue) => openShare(scannedValue, false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
