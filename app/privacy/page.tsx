import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { ROUTES, SUPPORT_EMAIL } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy policy · ForkWorkout",
  description:
    "How ForkWorkout handles your data: a local-first, account-free fitness tracker that keeps your data on your device.",
};

const UPDATED = "September 2026";

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
          ForkWorkout is a free, <strong>local-first</strong> fitness tracker. It
          has no account system or central personal-data database. This policy
          explains what that means for your privacy, including optional sharing
          and backup features that you choose to use.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
          <p className="mt-2">
            ForkWorkout has no account system or central profile database.
            Everything you create — workouts, exercises, sessions, history, body
            metrics, nutrition logs and settings — is stored on your device.
            ForkWorkout sends anonymous page-view information to Vercel Web
            Analytics. Your fitness data leaves your device only when you
            explicitly use one of the optional online, sharing, or backup
            features described below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Optional sharing</h2>
          <p className="mt-2">
            When you share a workout, program or meal, ForkWorkout creates a
            portable copy containing only the information shown in the share
            flow. Self-contained links keep that copy in the URL fragment. If you
            create a short link or QR code, your browser encrypts the copy first;
            the optional share service stores only encrypted text for a limited
            time, while the decryption key stays in the link fragment. A recipient
            must review and import the shared item before it is stored on their
            device.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Optional AI nutrition features</h2>
          <p className="mt-2">
            When you explicitly choose to analyze a food photo or nutrition label, ForkWorkout
            resizes it on your device and sends the prepared image, plus an
            optional weight and meal details you entered, through ForkWorkout&apos;s server to
            OpenAI. The OpenAI API key stays on the server. A random anonymous
            installation identifier and a hashed representation of your IP
            address are used only to enforce scan limits and protect the service
            from abuse. ForkWorkout requests that the model response is not
            stored, but OpenAI may retain limited API data under its own data
            controls and abuse-monitoring policies.
          </p>
          <p className="mt-2">
            If your optional meal details name a restaurant, brand or packaged
            product, the model may search public web pages for relevant menu or
            product information. Any sources used are linked in the estimate
            review. Do not include personal or sensitive information in meal
            details.
          </p>
          <p className="mt-2">
            When you explicitly generate AI meal ideas, ForkWorkout sends the
            calories and macros remaining for that day, your optional dietary
            preference and foods-on-hand text, and a limited list of known foods,
            saved meals, or recipes with their nutrition values. The model selects only from
            those candidates, and ForkWorkout recalculates every displayed total
            from the local food data. Your complete diary and body profile are
            not sent with this request.
          </p>
          <p className="mt-2">
            The photo and AI estimate are never added to your local diary
            automatically. You review and edit the estimated foods, weights,
            calories, macros and available detailed nutrients first; only the confirmed nutrition values are
            stored on your device. Read OpenAI&apos;s{" "}
            <a
              href="https://openai.com/policies/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              privacy policy
            </a>
            .
          </p>
          <p className="mt-2">
            The random installation identifier is kept separately from your
            workout and nutrition data, is not included in backups, and may
            remain when you use the in-app data reset so that resetting the app
            cannot bypass AI usage limits. Clearing all site data in your browser
            removes it.
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
          <h2 className="text-lg font-semibold text-foreground">Online food lookup</h2>
          <p className="mt-2">
            When you choose to scan or enter a barcode, that barcode is sent to
            Open Food Facts. When you explicitly tap Search online after entering
            a food name, the search phrase is sent through ForkWorkout&apos;s server
            to both USDA FoodData Central and Open Food Facts. The private USDA API
            key stays on the server. ForkWorkout does not send your nutrition
            diary, quantity, meal, body
            data or identity with that request. Product information is shown for
            confirmation and is cached on your device only after you save it, so it
            can be reused offline. Open Food Facts handles barcode and name-search
            requests under its{" "}
            <a
              href="https://world.openfoodfacts.org/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              privacy policy
            </a>
            , and USDA handles food-name searches under its{" "}
            <a
              href="https://www.usda.gov/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              privacy policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Embedded exercise videos</h2>
          <p className="mt-2">
            When you open the Video tab for an exercise, ForkWorkout may load an
            embedded video directly from YouTube or Instagram. The selected
            provider receives the technical information required to serve that
            embed, such as your IP address, browser details and any cookies that
            provider already stores in your browser. ForkWorkout does not require
            an Instagram login or send your workout history, body data or
            nutrition diary with the request. YouTube and Instagram handle the
            embedded content under their own privacy policies: Google&apos;s{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              privacy policy
            </a>{" "}
            for YouTube and Instagram&apos;s{" "}
            <a
              href="https://privacycenter.instagram.com/policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              privacy policy
            </a>
            .
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
              <strong> your own</strong> Google Drive. It contains the app data you
              chose to back up.
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
            ForkWorkout uses Vercel Web Analytics for anonymous, aggregated page
            views and basic traffic information such as the visited route,
            referrer, approximate location, device type, browser and operating
            system. It does not send workout, body or nutrition records, and it
            does not use advertising or third-party tracking cookies. Vercel may
            also record standard hosting logs to serve and secure the site. Read
            Vercel&apos;s{" "}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Web Analytics privacy information
            </a>
            .
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
