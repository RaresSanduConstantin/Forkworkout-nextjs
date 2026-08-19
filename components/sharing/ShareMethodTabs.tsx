"use client";

import * as React from "react";
import { Copy, Link2, Loader2, QrCode, RefreshCw, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export type ShareMethod = "link" | "qr";

export function ShareMethodTabs({
  method,
  onMethodChange,
  message,
  onMessageChange,
  messageId,
  messagePlaceholder,
  shareLabel,
  qrTitle,
  onShare,
  onClose,
  qrUrl,
  qrLoading,
  qrError,
  onGenerateQr,
  onCopyQrLink,
}: {
  method: ShareMethod;
  onMethodChange: (method: ShareMethod) => void;
  message: string;
  onMessageChange: (message: string) => void;
  messageId: string;
  messagePlaceholder: string;
  shareLabel: string;
  qrTitle: string;
  onShare: () => void;
  onClose: () => void;
  qrUrl: string | null;
  qrLoading: boolean;
  qrError: string | null;
  onGenerateQr: () => void;
  onCopyQrLink: () => void;
}) {
  return (
    <Tabs
      value={method}
      onValueChange={(value) => onMethodChange(value as ShareMethod)}
      className="min-h-0"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="link">
          <Link2 className="size-4" /> Share link
        </TabsTrigger>
        <TabsTrigger value="qr">
          <QrCode className="size-4" /> QR code
        </TabsTrigger>
      </TabsList>

      <TabsContent value="link" className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor={messageId} className="text-sm font-medium">
            Add a message (optional)
          </label>
          <Textarea
            id={messageId}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={messagePlaceholder}
            rows={3}
            maxLength={280}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={onShare}>
            <Share2 className="size-4" />
            {shareLabel}
          </Button>
        </DialogFooter>
      </TabsContent>

      <TabsContent value="qr" className="space-y-4 pt-2">
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border bg-muted/30 p-4 text-center">
          {qrLoading ? (
            <>
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">Creating secure QR code…</p>
              <p className="mt-1 text-xs text-muted-foreground">This normally takes a moment.</p>
            </>
          ) : qrUrl ? (
            <>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG
                  value={qrUrl}
                  title={qrTitle}
                  size={224}
                  level="M"
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                  className="h-auto max-w-full"
                />
              </div>
              <p className="mt-3 text-sm font-medium">Ready to scan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open Import on another phone and choose Scan QR. This code expires with the
                share link.
              </p>
            </>
          ) : (
            <>
              <QrCode className="size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {qrError ?? "Create a QR code for this share."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                QR sharing needs an internet connection and the short-link service.
              </p>
              <Button type="button" className="mt-4" onClick={onGenerateQr}>
                {qrError ? <RefreshCw className="size-4" /> : <QrCode className="size-4" />}
                {qrError ? "Try again" : "Generate QR code"}
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!qrUrl}
            onClick={onCopyQrLink}
          >
            <Copy className="size-4" /> Copy link
          </Button>
        </DialogFooter>
      </TabsContent>
    </Tabs>
  );
}
