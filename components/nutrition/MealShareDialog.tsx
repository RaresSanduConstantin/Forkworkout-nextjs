"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  ShareMethodTabs,
  type ShareMethod,
} from "@/components/sharing/ShareMethodTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildNutritionMealShareUrl,
  encodeNutritionMeal,
  mealItemsFromEntries,
} from "@/lib/nutrition/meal-share";
import type { NutritionEntry } from "@/lib/nutrition/types";
import { createCloudShare } from "@/lib/sharing/client";
import { deliverSharedReference } from "@/lib/sharing/delivery";
import { MAX_SHARE_PAYLOAD_BYTES } from "@/lib/sharing/types";

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

export function MealShareDialog({
  open,
  onOpenChange,
  mealName,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealName: string;
  entries: NutritionEntry[];
}) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [method, setMethod] = React.useState<ShareMethod>("link");
  const [message, setMessage] = React.useState("");
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);
  const [qrLoading, setQrLoading] = React.useState(false);
  const [qrError, setQrError] = React.useState<string | null>(null);
  const qrRequestRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    qrRequestRef.current += 1;
    setSelectedIds(new Set(entries.map((entry) => entry.id)));
    setMethod("link");
    setMessage("");
    setQrUrl(null);
    setQrLoading(false);
    setQrError(null);
  }, [entries, open]);

  const selectedEntries = entries.filter((entry) => selectedIds.has(entry.id));
  const selectedItems = mealItemsFromEntries(selectedEntries);

  const invalidateQr = () => {
    qrRequestRef.current += 1;
    setQrUrl(null);
    setQrLoading(false);
    setQrError(null);
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    invalidateQr();
  };

  const encodedMeal = () =>
    encodeNutritionMeal(mealName, selectedItems, message, MAX_SHARE_PAYLOAD_BYTES);

  const generateQr = async () => {
    if (!selectedItems.length) {
      setQrError("Choose at least one food to share.");
      return;
    }
    const encoded = encodedMeal();
    if (!encoded) {
      setQrError("This meal is too large to share (maximum 256 KB).");
      return;
    }
    const requestId = qrRequestRef.current + 1;
    qrRequestRef.current = requestId;
    setQrLoading(true);
    setQrError(null);
    setQrUrl(null);
    try {
      const url = await createCloudShare(
        { kind: "nutrition-meal", encoded },
        window.location.origin
      );
      if (qrRequestRef.current === requestId) setQrUrl(url);
    } catch (reason) {
      if (qrRequestRef.current === requestId) {
        setQrError(
          reason instanceof Error ? reason.message : "The QR code could not be created."
        );
      }
    } finally {
      if (qrRequestRef.current === requestId) setQrLoading(false);
    }
  };

  const changeMethod = (nextMethod: ShareMethod) => {
    setMethod(nextMethod);
    if (nextMethod === "qr" && !qrUrl && !qrLoading) void generateQr();
  };

  const updateMessage = (value: string) => {
    setMessage(value);
    invalidateQr();
  };

  const share = async () => {
    if (!selectedItems.length) {
      toast.error("Choose at least one food to share.");
      return;
    }
    const encoded = encodedMeal();
    if (!encoded) {
      toast.error("This meal is too large to share (maximum 256 KB).");
      return;
    }
    try {
      const result = await deliverSharedReference({
        reference: { kind: "nutrition-meal", encoded },
        legacyUrl: buildNutritionMealShareUrl(
          mealName,
          selectedItems,
          window.location.origin,
          message
        ),
        title: mealName,
        text: message.trim() || `Try my “${mealName}” meal in ForkWorkout`,
        origin: window.location.origin,
      });
      if (result.method === "clipboard") {
        toast.success(result.usedCloud ? "Short meal link copied" : "Meal link copied");
      } else if (result.method === "download") {
        toast.info("A portable meal share file was downloaded.");
      }
      if (result.method !== "cancelled") onOpenChange(false);
    } catch {
      toast.error("Couldn't share this meal.");
    }
  };

  const copyQrLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success("Meal share link copied");
    } catch {
      toast.error("Couldn't copy the meal link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-md flex-col overflow-hidden">
        <DialogHeader className="text-left">
          <DialogTitle>Share {mealName}</DialogTitle>
          <DialogDescription>
            Choose the foods to send. The recipient reviews and saves them as a reusable meal.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} of {entries.length} selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set(entries.map((entry) => entry.id)));
                invalidateQr();
              }}
            >
              Select all
            </Button>
          </div>
          <ul className="mb-4 max-h-52 divide-y overflow-y-auto rounded-xl border px-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleEntry(entry.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {number(entry.nutrients.caloriesKcal)} kcal
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <ShareMethodTabs
            method={method}
            onMethodChange={changeMethod}
            message={message}
            onMessageChange={updateMessage}
            messageId="nutrition-meal-share-message"
            messagePlaceholder="Optional note about this meal"
            shareLabel="Share meal"
            qrTitle={`QR code for ${mealName}`}
            onShare={() => void share()}
            onClose={() => onOpenChange(false)}
            qrUrl={qrUrl}
            qrLoading={qrLoading}
            qrError={qrError}
            onGenerateQr={() => void generateQr()}
            onCopyQrLink={() => void copyQrLink()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
