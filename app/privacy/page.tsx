import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { ROUTES, SUPPORT_EMAIL } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy policy · ForkWorkout",
  description:
    "How ForkWorkout handles your data: a local-first, account-free workout tracker that keeps your data on your device.",
};

const UPDATED = "July 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <Link
        href={ROUTES.landing}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to ForkWorkout
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          ForkWorkout is a free, <strong>local-first</strong> workout tracker. It
          has no account system and no backend server that stores your data. This
          policy explains what that means for your privacy.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
          <p className="mt-2">
            <strong>Nothing is sent to us.</strong> ForkWorkout has no servers
            that receive your information. Everything you create — workouts,
            exercises, sessions, history, body metrics and settings — is stored
            only in your browser&apos;s local storage on your own device.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Data on your device</h2>
          <p className="mt-2">
            Your data stays in your browser until you clear it. Clearing your
            browser storage, or using the in-app reset, permanently removes it.
            You can export a full JSON backup at any time from the History screen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Optional Google Drive backup</h2>
          <p className="mt-2">
            You may optionally connect Google Drive to back up and restore your
            data. This is entirely opt-in. When you use it:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              You sign in with Google directly; ForkWorkout never sees your Google
              password.
            </li>
            <li>
              A single file, <code>forkworkout-backup.json</code>, is written to
              <strong> your own</strong> Google Drive. It contains the workout data
              you chose to back up.
            </li>
            <li>
              We request the narrow <code>drive.file</code> permission, which lets
              the app access <em>only</em> the backup file it creates — never any
              other file in your Drive.
            </li>
            <li>
              Your data goes to your Google account, not to us. Disconnecting, or
              deleting the file in Drive, removes it. Google&apos;s handling of that
              file is governed by{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google&apos;s Privacy Policy
              </a>
              .
            </li>
          </ul>
          <p className="mt-2">
            ForkWorkout&apos;s use of information received from Google APIs adheres
            to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Tracking &amp; analytics</h2>
          <p className="mt-2">
            ForkWorkout does not use advertising or third-party analytics/tracking
            cookies. Standard hosting logs may be recorded by our host (Vercel) to
            serve and secure the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">Questions about this policy? Reach out anytime.</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <Mail className="size-4" />
            {SUPPORT_EMAIL}
          </a>
        </section>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        See also our{" "}
        <Link href={ROUTES.terms} className="text-primary hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
