
import { Honk } from 'next/font/google'

const honk = Honk({ subsets: ['latin'] })

// export a function that takes a string applys honk font to it
export function honkFont(text: string) {
    return (<span className={honk.className}>{text}</span>)
  }