import ForkWorkoutImg from "@/public/Forkworkout.png"
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import { Honk } from 'next/font/google'

const honk = Honk({ subsets: ['latin'] })

const NavBar = () => {
    return ( <nav className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-700 bg-slate-100">
        <Image src={ForkWorkoutImg} alt="Fork Workout" width={100} height={100} />

        <Button
  variant="default"
  className={`bg-gradient-to-r from-pink-400 via-yellow-300 to-orange-400 hover:from-pink-500 hover:to-red-500 
              text-white text-xl py-5 px-6 rounded-2xl border-4 border-black shadow-lg 
              transition-all duration-300 transform animate-popbeat hover:scale-105 active:scale-95 ${honk.className}`}
>
  <Link href="/create-workout" >
    Create Workout
  </Link>
</Button>
    </nav> );
}
 
export default NavBar;