import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Credits & licenses · ForkWorkout",
  description:
    "The open datasets, libraries and assets that ForkWorkout is built on, and their licenses.",
};

type Credit = {
  title: string;
  used: string;
  license: string;
  href?: string;
};

const CREDITS: Credit[] = [
  {
    title: "Exercise data & images",
    used: "The exercise library, muscle info, instructions and demo images.",
    license: "The Unlicense (public domain)",
    href: "https://github.com/wrkout/exercises.json",
  },
  {
    title: "Muscle map",
    used: "The interactive body map used to pick and visualize muscles.",
    license: "MIT",
    href: "https://github.com/abdofallah/musclemap-js",
  },
  {
    title: "Icons",
    used: "Lucide — the icon set used throughout the app.",
    license: "ISC",
    href: "https://lucide.dev",
  },
  {
    title: "Display font",
    used: "Outfit, used for headings.",
    license: "SIL Open Font License",
    href: "https://fonts.google.com/specimen/Outfit",
  },
  {
    title: "Sound effects",
    used: "The rest-timer start/end cues, from a free sound library.",
    license: "Free / royalty-free",
  },
  {
    title: "Framework",
    used: "Built with Next.js and React.",
    license: "MIT",
    href: "https://nextjs.org",
  },
];

export default function CreditsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <Link
        href={ROUTES.landing}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to ForkWorkout
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Credits &amp; licenses</h1>
      <p className="mt-2 text-muted-foreground">
        ForkWorkout is a free, local-first workout tracker. It stands on some
        excellent open projects and datasets — thank you to their authors.
      </p>

      <ul className="mt-6 space-y-3">
        {CREDITS.map((c) => (
          <li key={c.title}>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="font-semibold">{c.title}</h2>
                  <span className="text-xs font-medium text-muted-foreground">{c.license}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.used}</p>
                {c.href && (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {c.href.replace(/^https?:\/\//, "")}
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        Everything you log stays on your device — no account, no servers, no tracking.
      </p>
    </main>
  );
}
