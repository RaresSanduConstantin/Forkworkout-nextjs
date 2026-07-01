import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarCheck,
  Dumbbell,
  Flame,
  ListChecks,
  Timer,
  ShieldCheck,
  Search,
} from "lucide-react";

import ForkWorkoutImg from "@/public/Forkworkout.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { honkFont } from "@/lib/honkFont";
import { ROUTES } from "@/lib/routes";
import { STARTER_TEMPLATES } from "@/lib/templates";

const FEATURES = [
  {
    icon: Dumbbell,
    title: "Build workouts fast",
    body: "Create routines with exercises, sets, reps, and weight or time — in seconds.",
  },
  {
    icon: ListChecks,
    title: "Track sets live",
    body: "Mark each set done or skipped as you go, with clear progress at a glance.",
  },
  {
    icon: Timer,
    title: "Rest timer built in",
    body: "Automatic countdown between sets with a sound cue, skippable anytime.",
  },
  {
    icon: CalendarCheck,
    title: "Streaks & calendar",
    body: "Completed days light up your calendar so you keep showing up.",
  },
  {
    icon: Search,
    title: "Exercise library",
    body: "Search hundreds of exercises with instructions, muscles, and demos.",
  },
  {
    icon: ShieldCheck,
    title: "Local-first & private",
    body: "Everything is saved on your device. No account, no cloud, no tracking.",
  },
];

const STEPS = [
  { n: 1, title: "Create a workout", body: "Add exercises and sets with helpful suggestions." },
  { n: 2, title: "Start your session", body: "Complete or skip sets while the rest timer keeps pace." },
  { n: 3, title: "Keep your streak", body: "Finish up and watch your calendar and streak grow." },
];

function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      {/* Floating chips */}
      <div className="absolute -left-3 top-10 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-lg ring-1 ring-black/5">
        <span className="mr-1">🔥</span> 7 day streak
      </div>
      <div className="absolute -right-3 top-28 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-lg ring-1 ring-black/5">
        12 / 18 sets
      </div>
      <div className="absolute -right-2 bottom-16 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-lg ring-1 ring-black/5">
        <span className="mr-1">⏱️</span> Rest 00:45
      </div>

      {/* Phone frame */}
      <div className="rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 p-2 shadow-2xl">
        <div className="space-y-3 rounded-[1.5rem] bg-slate-50 p-4">
          <div className="text-center text-lg font-bold">
            {honkFont("Push Day")}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-pink-400 via-yellow-300 to-orange-400" />
          </div>
          {[
            { name: "Bench Press", done: true },
            { name: "Incline Press", done: true },
            { name: "Cable Fly", done: false },
          ].map((ex) => (
            <div
              key={ex.name}
              className={`flex items-center justify-between rounded-lg border p-2 text-sm ${
                ex.done ? "border-lime-500/60 bg-lime-50" : "bg-white"
              }`}
            >
              <span className="font-medium">{ex.name}</span>
              <span>{ex.done ? "✅" : "•••"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Image src={ForkWorkoutImg} alt="ForkWorkout" width={110} height={44} priority />
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboard}>Open app</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-orange-200/60 via-yellow-100/40 to-transparent blur-2xl"
        />
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-6 text-center md:text-left">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" /> No account · Local-first
            </Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Build workouts. Track sets.{" "}
              <span className="bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                Keep showing up.
              </span>
            </h1>
            <p className="mx-auto max-w-md text-lg text-muted-foreground md:mx-0">
              ForkWorkout is a fast, mobile-first workout tracker for creating
              routines, completing sets, timing rests, and keeping your streak
              alive — no account required.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <Button asChild size="lg" className="gap-2">
                <Link href={ROUTES.dashboard}>
                  Start tracking <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No login. Saved on your device. Ready when you are.
            </p>
          </div>

          <PhonePreview />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">Everything you need, nothing you don&apos;t</h2>
          <p className="mt-2 text-muted-foreground">
            A focused tracker that stays out of your way during a workout.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="h-full">
              <CardContent className="space-y-2 p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">How it works</h2>
          <p className="mt-2 text-muted-foreground">Three steps from zero to a tracked workout.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.n} className="h-full">
              <CardContent className="space-y-2 p-5">
                <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-orange-500 font-bold text-white">
                  {step.n}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Starter workouts showcase */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">Start with a ready-made routine</h2>
          <p className="mt-2 text-muted-foreground">
            Add a proven split in one tap, then tweak it to fit you.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STARTER_TEMPLATES.map((template) => (
            <Card key={template.key} className="h-full">
              <CardContent className="space-y-2 p-5">
                <span className="text-3xl" aria-hidden>
                  {template.emoji}
                </span>
                <h3 className="font-semibold">{template.title}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <Badge variant="secondary">{template.exercises.length} exercises</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button asChild size="lg" className="gap-2">
            <Link href={ROUTES.dashboard}>
              Browse starter workouts <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Local-first reassurance */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Card className="border-none bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 text-white">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Flame className="size-8" />
            <h2 className="text-2xl font-bold">Your data stays yours</h2>
            <p className="max-w-xl text-white/90">
              ForkWorkout saves everything locally in your browser. No sign-up, no
              servers, no ads. Clear your device and it&apos;s gone — that simple.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Programs teaser */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-semibold">Prefer a ready-made plan?</h3>
              <p className="text-sm text-muted-foreground">
                Kick off with a built-in program like P90X and start today.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={ROUTES.startWorkout("1")}>Try P90X</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          {honkFont("Ready to move?")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Create your first workout in under a minute. It&apos;s free and stays on
          your device.
        </p>
        <Button asChild size="lg" className="mt-6 gap-2">
          <Link href={ROUTES.newWorkout}>
            Create your first workout <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        ForkWorkout — an app that keeps you fit.
      </footer>
    </main>
  );
}
