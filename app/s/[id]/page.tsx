import type { Metadata } from "next";

import { SharedImportClient } from "@/components/sharing/SharedImportClient";

export const metadata: Metadata = {
  title: "Shared ForkWorkout item",
  description: "Open an encrypted workout, program, or meal shared with ForkWorkout.",
  robots: { index: false, follow: false },
};

export default async function SharedWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedImportClient id={id} />;
}
