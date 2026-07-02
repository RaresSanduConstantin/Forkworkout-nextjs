import NavBar from "@/components/Navbar";
import WorkoutList from "@/components/WorkOutList";

export default function Dashboard() {
  return (
    <main className="min-h-dvh bg-background">
      <NavBar />
      <WorkoutList />
    </main>
  );
}
