import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ForkWorkout — An app that keeps you fit",
    template: "%s · ForkWorkout",
  },
  description:
    "A fast, mobile-first workout tracker for building routines, tracking sets, timing rests, and keeping your streak alive — no account required, saved on your device.",
  applicationName: "ForkWorkout",
  openGraph: {
    title: "ForkWorkout — An app that keeps you fit",
    description:
      "Build workouts, track sets, and keep showing up. Local-first, no account required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased bg-slate-50`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
