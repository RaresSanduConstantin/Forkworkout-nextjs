import ForkWorkoutImg from "@/public/Forkworkout.png";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const NavBar = () => {
  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
      <Link href={ROUTES.landing} aria-label="ForkWorkout home">
        <Image src={ForkWorkoutImg} alt="Fork Workout" width={100} height={100} />
      </Link>

      <Button
        asChild
        size="lg"
        className="rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 font-display font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        <Link href={ROUTES.newWorkout}>Create Workout</Link>
      </Button>
    </nav>
  );
};

export default NavBar;

