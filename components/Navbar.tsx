import ForkWorkoutImg from "@/public/Forkworkout.png"
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";

import { honkFont } from "@/lib/honkFont";


const NavBar = () => {
    return ( <nav className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-700 bg-slate-100">
        <Image src={ForkWorkoutImg} alt="Fork Workout" width={100} height={100} />

        <Button
  variant="default"
  className={`bg-yellow-400
              text-white text-sm py-5 px-6 rounded-2xl border-4 border-black shadow-lg 
             `}
>
  <Link href="/create-workout" >
    {honkFont('Create Workout')}
  </Link>
</Button>
    </nav> );
}
 
export default NavBar;