import { ExercisesManager } from "@/components/exercises/ExercisesManager";

export const metadata = {
  title: "Your exercises",
};

export default function ExercisesPage() {
  return (
    <main>
      <ExercisesManager />
    </main>
  );
}
