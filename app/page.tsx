import CalendarComponent from "@/components/Calendar";
import NavBar from "@/components/Navbar";
import WorkoutList from "@/components/WorkOutList";

export default function Home() {

  return (
<main >
    <NavBar />
    <CalendarComponent />
    <WorkoutList />
</main>
  );
}
