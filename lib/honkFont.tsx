
import { Ultra } from 'next/font/google'
import { cn } from "@/lib/utils"

const honk = Ultra({
    weight: '400',})

// export a function that takes a string applys honk font to it
export function honkFont(text: string) {
    return (<span className={cn(honk.className, 'font-extrabold text-transparent bg-clip-text bg-gradient-to-b  from-hot-yellow to-hot-pink outline-text [text-shadow:_0_2px_4px_rgb(0_0_0_/_0.1)]')}>{text}</span>)
  }