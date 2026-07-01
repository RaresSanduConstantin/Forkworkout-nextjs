import NavBar from "@/components/Navbar";
import WorkoutList from "@/components/WorkOutList";

export default function Dashboard() {
  return (
    <main className="min-h-dvh bg-slate-50">
      <NavBar />
      <WorkoutList />
    </main>
  );
}
