import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { ROUTES, SUPPORT_EMAIL } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms of Service · ForkWorkout",
  description:
    "The simple terms for using ForkWorkout, a free, local-first workout tracker.",
};

const UPDATED = "July 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <Link
        href={ROUTES.landing}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to ForkWorkout
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          ForkWorkout is a free, local-first workout tracker provided as-is. By
          using it, you agree to these simple terms.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Use of the app</h2>
          <p className="mt-2">
            ForkWorkout is free to use for personal fitness tracking. There is no
            account, and your data is stored on your own device. You are
            responsible for keeping your own backups (for example via the JSON
            export or the optional Google Drive backup).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Health disclaimer</h2>
          <p className="mt-2">
            ForkWorkout is an informational tool, not medical or professional
            fitness advice. Exercise carries inherent risks. Consult a qualified
            professional before starting any program, and stop if you feel unwell.
            You use the app and perform any exercises at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">No warranty</h2>
          <p className="mt-2">
            The app is provided &quot;as is&quot; without warranties of any kind.
            While we aim to keep it reliable, we do not guarantee it will be
            error-free or that your locally-stored data will never be lost. Keep
            your own backups of anything important.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, ForkWorkout and its author are
            not liable for any injury, data loss, or damages arising from your use
            of the app.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Third-party services</h2>
          <p className="mt-2">
            If you use the optional Google Drive backup, your use of Google is
            governed by Google&apos;s own terms and privacy policy. See our{" "}
            <Link href={ROUTES.privacy} className="text-primary hover:underline">
              Privacy policy
            </Link>{" "}
            for details on how the backup works.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p className="mt-2">
            These terms may be updated over time. Continued use of the app after a
            change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">Questions? Get in touch.</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <Mail className="size-4" />
            {SUPPORT_EMAIL}
          </a>
        </section>
      </div>
    </main>
  );
}
