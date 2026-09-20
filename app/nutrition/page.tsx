import type { Metadata } from "next";

import { NutritionDashboard } from "@/components/nutrition/NutritionDashboard";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Track daily calories and macros locally on your device.",
};

export default function NutritionPage() {
  return (
    <main className="min-h-dvh bg-background">
      <NutritionDashboard />
    </main>
  );
}

